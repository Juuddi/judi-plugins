#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: if any skill has accumulated 3+ reviews since its last
# patch, inject a reminder to run improve-skill. Reads the ledger maintained
# by analyze-session.sh / review-run / improve-skill.

input=$(cat)

DATA_DIR="${CLAUDE_PLUGIN_OPTION_DATA_DIR:-$HOME/.claude/agent-improvement}"
DATA_DIR="${DATA_DIR/#\~/$HOME}"
ledger="$DATA_DIR/ledger.json"

NUDGE_THRESHOLD=3

pass() { echo '{"continue": true}'; exit 0; }

if [ ! -s "$ledger" ]; then
  pass
fi

pending=$(jq -r --argjson t "$NUDGE_THRESHOLD" \
  'to_entries
   | map(select((.value.reviews_since_patch // 0) >= $t))
   | map("\(.key) (\(.value.reviews_since_patch) reviews)")
   | join(", ")' "$ledger" 2>/dev/null) || pass

if [ -z "$pending" ]; then
  pass
fi

msg="agent-improvement: accumulated skill-run reviews are waiting: ${pending}. At a natural break, consider suggesting /agent-improvement:improve-skill to the user."
jq -cn --arg ctx "$msg" '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
