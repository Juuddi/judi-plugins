#!/usr/bin/env bash
set -euo pipefail

# SessionEnd hook: for each watched skill recorded during the session, run a
# headless Claude review of the transcript and write a markdown review note
# under $DATA_DIR/reviews/<skill>/. State files come from
# record-skill-invocation.sh; the improve-skill skill aggregates the reviews.
#
# Claude Code kills SessionEnd hooks (whole process tree) ~1.5s after exit
# begins — plugin hooks.json timeouts are NOT counted toward that budget, so
# a review that takes minutes can never run inside the hook. The hook
# therefore only validates its input and re-invokes this script as a
# detached worker (--worker) that survives the hook process and runs the
# reviews. Success leaves the review file + a ledger increment; worker
# errors append to $DATA_DIR/analyzer-errors.log.
#
# The worker reviews a pre-filtered copy of the transcript (~10x smaller;
# see filter-transcript.py) and pins the reviewer's toolset, model, and
# system prompt (reviewer-prompt.md) so every run is identical and cheap.

DATA_DIR="${CLAUDE_PLUGIN_OPTION_DATA_DIR:-$HOME/.claude/agent-improvement}"
DATA_DIR="${DATA_DIR/#\~/$HOME}"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Count a completed review toward the skill's pending pile; the SessionStart
# nudge reads this and improve-skill resets it when a patch lands.
ledger_bump() {
  local s="$1" ts tmp
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  [ -s "$DATA_DIR/ledger.json" ] || echo '{}' > "$DATA_DIR/ledger.json"
  tmp=$(mktemp "$DATA_DIR/.ledger.XXXXXX")
  if jq --arg s "$s" --arg ts "$ts" \
      '.[$s] = ((.[$s] // {})
        | .reviews_since_patch = ((.reviews_since_patch // 0) + 1)
        | .last_reviewed_at = $ts)' \
      "$DATA_DIR/ledger.json" > "$tmp" 2>/dev/null; then
    mv "$tmp" "$DATA_DIR/ledger.json"
  else
    rm -f "$tmp"
  fi
}

run_reviews() {
  local session_id="$1" transcript_path="$2"
  local state_file="$DATA_DIR/state/${session_id}.jsonl"
  local date_stamp short_session system_prompt
  date_stamp=$(date +%Y-%m-%d)
  short_session="${session_id:0:8}"
  system_prompt=$(cat "$SCRIPT_DIR/reviewer-prompt.md")

  # Review a pre-filtered copy of the transcript: ~10x smaller, so the
  # reviewer reads it in 1-2 chunks instead of dozens (the call count is
  # what drives cache-read cost). Falls back to the raw transcript if
  # python3 is missing or the filter produces nothing.
  local review_src="$transcript_path" filtered=""
  if command -v python3 >/dev/null 2>&1; then
    filtered=$(mktemp "$DATA_DIR/.filtered-${short_session}-XXXXXX")
    if python3 "$SCRIPT_DIR/filter-transcript.py" "$transcript_path" "$filtered" \
        >> "$DATA_DIR/analyzer-errors.log" 2>&1 && [ -s "$filtered" ]; then
      review_src="$filtered"
    else
      rm -f "$filtered"; filtered=""
    fi
  fi

  jq -r '.skill' "$state_file" | sort -u | while IFS= read -r skill; do
    [ -z "$skill" ] && continue

    runs=$(jq -c --arg s "$skill" 'select(.skill == $s)' "$state_file")
    safe_skill=$(echo "$skill" | tr ':/' '--')
    out_dir="$DATA_DIR/reviews/$safe_skill"
    mkdir -p "$out_dir"
    out_file="$out_dir/${date_stamp}-${short_session}.md"

    prompt=$(cat <<EOF
Review how well the skill "$skill" performed in the session below, per your
system instructions.

- Skill: $skill
- Session: $session_id
- Date: $date_stamp
- Transcript (JSONL): $review_src

Recorded invocations of this skill during the session (prompt_id correlates
with entries in the transcript; source is who invoked it):
$runs
EOF
)

    # Task prompt goes via stdin: --allowedTools is variadic, so a trailing
    # positional prompt gets swallowed as tool rules. --setting-sources ""
    # skips plugin hooks like --bare, but keeps keychain reads (--bare skips
    # them, which breaks claude.ai OAuth auth); note it does NOT remove
    # built-in tools or skills — hence the explicit denials. --disallowedTools
    # hard-blocks the escape hatches: Agent/Task (subagents spawn without a
    # permission gate and have their own full toolsets), Bash (exec), and
    # ToolSearch (unlocks deferred tools, including account-level MCP
    # connectors). --model sonnet + the pinned system prompt keep every run
    # identical and cheap; identical system prefixes also cache across the
    # sequential reviews of one worker run.
    if printf '%s' "$prompt" | AGENT_IMPROVEMENT_ANALYZER=1 claude -p \
        --model sonnet --setting-sources "" \
        --allowedTools "Read" \
        --disallowedTools "Agent" "Task" "Bash" "ToolSearch" \
        --append-system-prompt "$system_prompt" \
        > "$out_file" 2>> "$DATA_DIR/analyzer-errors.log"; then
      # Count only real reviews: a reviewer that went sideways (e.g. tried to
      # wait on background work) writes prose, not the required heading.
      if head -n 3 "$out_file" | grep -q '^# Skill Review:'; then
        ledger_bump "$skill"
      else
        mv "$out_file" "$out_dir/${date_stamp}-${short_session}.failed.md"
      fi
    else
      rm -f "$out_file"
    fi
  done

  [ -n "$filtered" ] && rm -f "$filtered"
  rm -f "$state_file" "$DATA_DIR/state/${session_id}.failures"
}

# Worker mode: detached re-invocation from hook mode below.
if [ "${1:-}" = "--worker" ]; then
  run_reviews "$2" "$3"
  exit 0
fi

# Hook mode: validate, detach the worker, return within the SessionEnd budget.
input=$(cat)

pass() { echo '{"continue": true}'; exit 0; }

# Never analyze the analyzer's own headless session (--setting-sources ""
# should already prevent this hook from loading there; this is the backstop)
if [ -n "${AGENT_IMPROVEMENT_ANALYZER:-}" ]; then
  pass
fi

session_id=$(echo "$input" | jq -r '.session_id // ""')
transcript_path=$(echo "$input" | jq -r '.transcript_path // ""')
state_file="$DATA_DIR/state/${session_id}.jsonl"

if [ -z "$session_id" ] || [ ! -s "$state_file" ]; then
  pass
fi
if [ -z "$transcript_path" ] || [ ! -f "$transcript_path" ]; then
  pass
fi
command -v claude >/dev/null 2>&1 || pass

# Detach: double-fork (the subshell exits at once, reparenting the worker to
# launchd) + nohup (terminal-close SIGHUP) + stdio off the hook's pipes so
# nothing ties the worker to the hook's process tree when Claude Code tears
# it down at the SessionEnd deadline.
( nohup bash "$0" --worker "$session_id" "$transcript_path" \
    </dev/null >>"$DATA_DIR/analyzer-errors.log" 2>&1 & )

pass
