#!/usr/bin/env bash
set -euo pipefail

# UserPromptSubmit hook: pattern-match keywords and inject skill reminders.
# Bumps auto-invocation of record/session skills from ~50% to ~80%.

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt // ""')

# Normalize to lowercase for matching
lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')

context=""

# Match session/capture patterns -> session skill
if echo "$lower" | grep -qE '\b(session note|capture this session|what did we learn|end of session|wrap up session|session summary)\b'; then
  context="Reminder: use /knowledge-vault:session to capture session insights into a vault note."

# Match decision/chose/picked patterns -> record skill
elif echo "$lower" | grep -qE '\b(we decided|i decided|decision made|decided to|chose to|picked|going with|settled on)\b'; then
  context="Reminder: use /knowledge-vault:record decision to capture this decision in the vault."

# Match learning/discovery patterns -> record skill
elif echo "$lower" | grep -qE '\b(learned that|turns out|discovered that|til |today i learned|interesting find|good to know|now i know)\b'; then
  context="Reminder: use /knowledge-vault:record to capture this learning in the vault."

# Match pattern/technique patterns -> record skill
elif echo "$lower" | grep -qE '\b(useful pattern|reusable pattern|code pattern|neat trick|good technique)\b'; then
  context="Reminder: use /knowledge-vault:record to capture this pattern in the vault."
fi

if [ -z "$context" ]; then
  echo '{"continue": true}'
else
  jq -n --arg ctx "$context" '{
    continue: true,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: $ctx
    }
  }'
fi
