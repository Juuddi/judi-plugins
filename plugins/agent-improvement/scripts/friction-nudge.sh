#!/usr/bin/env bash
set -euo pipefail

# PostToolUseFailure hook: when tool failures pile up in a session where a
# watched skill ran, nudge the agent (via additionalContext) to offer the
# user an in-session /agent-improvement:review-run while the friction is
# fresh. Fires the nudge exactly once, at the 3rd failure.

input=$(cat)

DATA_DIR="${CLAUDE_PLUGIN_OPTION_DATA_DIR:-$HOME/.claude/agent-improvement}"
DATA_DIR="${DATA_DIR/#\~/$HOME}"
WATCHED="${CLAUDE_PLUGIN_OPTION_WATCHED_SKILLS:-}"

FAILURE_THRESHOLD=3

pass() { echo '{"continue": true}'; exit 0; }

if [ -z "$WATCHED" ]; then
  pass
fi

session_id=$(echo "$input" | jq -r '.session_id // ""')
state_file="$DATA_DIR/state/${session_id}.jsonl"

# Only care about sessions where a watched skill was actually invoked
if [ -z "$session_id" ] || [ ! -s "$state_file" ]; then
  pass
fi

count_file="$DATA_DIR/state/${session_id}.failures"
n=$(cat "$count_file" 2>/dev/null || echo 0)
case "$n" in (*[!0-9]*|'') n=0 ;; esac
n=$((n + 1))
printf '%s' "$n" > "$count_file"

if [ "$n" -ne "$FAILURE_THRESHOLD" ]; then
  pass
fi

skills=$(jq -r '.skill' "$state_file" | sort -u | paste -sd ', ' -)
msg="agent-improvement: ${FAILURE_THRESHOLD} tool failures have occurred in this session after a watched skill ran (${skills}). If the friction relates to how the skill guided the work, consider offering the user /agent-improvement:review-run to capture it while it's fresh."
jq -cn --arg ctx "$msg" '{hookSpecificOutput: {hookEventName: "PostToolUseFailure", additionalContext: $ctx}}'
