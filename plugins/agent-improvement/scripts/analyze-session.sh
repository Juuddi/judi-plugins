#!/usr/bin/env bash
set -euo pipefail

# SessionEnd hook: for each watched skill recorded during the session, run a
# headless Claude review of the transcript and write a markdown review note
# under $DATA_DIR/reviews/<skill>/. State files come from
# record-skill-invocation.sh; the improve-skill skill aggregates the reviews.

input=$(cat)

pass() { echo '{"continue": true}'; exit 0; }

# Never analyze the analyzer's own headless session (--bare should already
# prevent this hook from loading there; this is the backstop)
if [ -n "${AGENT_IMPROVEMENT_ANALYZER:-}" ]; then
  pass
fi

DATA_DIR="${CLAUDE_PLUGIN_OPTION_DATA_DIR:-$HOME/.claude/agent-improvement}"
DATA_DIR="${DATA_DIR/#\~/$HOME}"

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

date_stamp=$(date +%Y-%m-%d)
short_session="${session_id:0:8}"

jq -r '.skill' "$state_file" | sort -u | while IFS= read -r skill; do
  [ -z "$skill" ] && continue

  runs=$(jq -c --arg s "$skill" 'select(.skill == $s)' "$state_file")
  safe_skill=$(echo "$skill" | tr ':/' '--')
  out_dir="$DATA_DIR/reviews/$safe_skill"
  mkdir -p "$out_dir"
  out_file="$out_dir/${date_stamp}-${short_session}.md"

  prompt=$(cat <<EOF
You are reviewing a completed Claude Code session to evaluate how well the
skill "$skill" performed, so its SKILL.md can be improved over time.

The full session transcript is a JSONL file at: $transcript_path
Read it with the Read tool. It may be large — read in chunks if needed. The
entry format is internal to Claude Code, so interpret it best-effort.

Recorded invocations of this skill during the session (prompt_id correlates
with entries in the transcript; source is who invoked it):
$runs

Write a markdown review with exactly these sections:

# Skill Review: $skill

- **Session**: $session_id
- **Date**: $date_stamp

## What happened
Brief narrative of the skill run(s): what was asked, what the agent did.

## Process adherence
Did the agent follow the skill's instructions? Note steps skipped, reordered,
or misread.

## Friction and failures
Tool errors, retries, dead ends, permission denials, missing prerequisites.

## User feedback
Corrections, clarifications, or approval from the user in the turns after each
invocation — including feedback that arrived many turns later.

## Improvement suggestions
Concrete changes to the skill's SKILL.md that would have prevented the issues
above. Quote the relevant instruction text where possible. End the section
with a fenced block, one entry per suggestion, exactly in this shape:

~~~yaml
suggestions:
  - summary: <one sentence>
    type: <wording | structure | coverage>
    scope: <class | instance>
    evidence: <what happened, cited from the transcript>
    proposed_change: <the concrete edit, quoting current instruction text>
~~~

type: wording = the agent misread an instruction; structure = it skipped or
misordered one (an emphasis/ordering problem); coverage = the situation was
never addressed by the skill at all.
scope: class = the change helps every future run of this skill; instance = it
would merely re-run this session correctly.

Rules for suggestions — these prevent lessons that degrade the skill:
- Never propose negative claims about tools ("X is broken") — they harden
  into refusals that outlive the problem. Record what TO do instead.
- Never derive rules from transient failures (network errors, rate limits,
  one-off API hiccups).
- Never promote environment- or repo-specific details into universal
  instructions.
- Prefer strengthening an existing instruction over adding a new special case.
- Do not artificially generalize an instance-level lesson; mark it
  scope: instance and let aggregation across sessions decide.

Be specific and evidence-based: cite what actually happened in the transcript.
If the run went cleanly, say so briefly with an empty suggestions list rather
than inventing issues. Your entire output is written verbatim to a review
file, so respond with the markdown document only.
EOF
)

  if AGENT_IMPROVEMENT_ANALYZER=1 claude -p --bare --allowedTools "Read" "$prompt" \
      > "$out_file" 2>> "$DATA_DIR/analyzer-errors.log"; then
    ledger_bump "$skill"
  else
    rm -f "$out_file"
  fi
done

rm -f "$state_file" "$DATA_DIR/state/${session_id}.failures"
pass
