#!/usr/bin/env bash
set -euo pipefail

# UserPromptSubmit hook: pattern-match keywords and inject skill reminders.
# Bumps auto-invocation of record/session skills from ~50% to ~80%.
#
# Gate: this personal vault coexists with the team hive-mind plugin, which
# owns Arctype knowledge and fires its own reminders unconditionally. To
# avoid dueling nudges, this hook only speaks in explicitly personal
# territory. Two requirements, both must hold:
#   1. the repo/dir is marked personal: `git config vault.domain personal`
#      (local overrides --global)
#   2. the git remote is not in the arctype-ventures GitHub org
# Everything else — unmarked repos included — is assumed to be hive-mind's
# realm and gets no reminder.

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt // ""')
cwd=$(echo "$input" | jq -r '.cwd // ""')

domain=$(git -C "${cwd:-.}" config --get vault.domain 2>/dev/null || true)
if [ "$domain" != "personal" ]; then
  echo '{"continue": true}'
  exit 0
fi

remote=$(git -C "${cwd:-.}" remote get-url origin 2>/dev/null || true)
if echo "$remote" | grep -qiE 'github\.com[:/]arctype-ventures/'; then
  echo '{"continue": true}'
  exit 0
fi

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
