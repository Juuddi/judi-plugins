#!/usr/bin/env bash
set -euo pipefail

# Records watched-skill invocations to a per-session state file that the
# SessionEnd analyzer (analyze-session.sh) consumes. Fires on two events:
#   - UserPromptExpansion: user typed /skill-name (no matcher; filtered here)
#   - PostToolUse with matcher "Skill": the agent invoked the Skill tool
#
# Payload caveat: the docs don't pin the exact field carrying the skill name
# for either event, so extraction tries known candidates and any payload that
# yields no name is captured to unmatched-payloads.log for schema discovery.

input=$(cat)

DATA_DIR="${CLAUDE_PLUGIN_OPTION_DATA_DIR:-$HOME/.claude/agent-improvement}"
DATA_DIR="${DATA_DIR/#\~/$HOME}"
WATCHED="${CLAUDE_PLUGIN_OPTION_WATCHED_SKILLS:-}"

pass() { echo '{"continue": true}'; exit 0; }

# Debug capture: AGENT_IMPROVEMENT_DEBUG=1 in the environment, or a `debug`
# marker file in the data dir, logs every raw payload this hook receives.
if [ "${AGENT_IMPROVEMENT_DEBUG:-0}" = "1" ] || [ -f "$DATA_DIR/debug" ]; then
  mkdir -p "$DATA_DIR"
  printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$input" >> "$DATA_DIR/debug.log"
fi

# Nothing configured to watch: pass through
if [ -z "$WATCHED" ]; then
  pass
fi

event=$(echo "$input" | jq -r '.hook_event_name // ""')
session_id=$(echo "$input" | jq -r '.session_id // ""')
prompt_id=$(echo "$input" | jq -r '.prompt_id // ""')

case "$event" in
  UserPromptExpansion)
    skill=$(echo "$input" | jq -r '.command_name // .command // .skill_name // ""')
    source="user"
    ;;
  PostToolUse)
    skill=$(echo "$input" | jq -r '.tool_input.skill // .tool_input.command // ""')
    source="agent"
    ;;
  *)
    pass
    ;;
esac

if [ -z "$skill" ]; then
  mkdir -p "$DATA_DIR"
  printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$input" >> "$DATA_DIR/unmatched-payloads.log"
  pass
fi

# Match against the watched list (comma-separated; * watches everything)
matched=0
IFS=',' read -ra entries <<< "$WATCHED"
for entry in "${entries[@]}"; do
  entry=$(echo "$entry" | xargs)
  if [ -n "$entry" ] && { [ "$entry" = "*" ] || [ "$entry" = "$skill" ]; }; then
    matched=1
    break
  fi
done
if [ "$matched" -eq 0 ] || [ -z "$session_id" ]; then
  pass
fi

mkdir -p "$DATA_DIR/state"
jq -cn \
  --arg skill "$skill" \
  --arg source "$source" \
  --arg prompt_id "$prompt_id" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{skill: $skill, source: $source, prompt_id: $prompt_id, ts: $ts}' \
  >> "$DATA_DIR/state/${session_id}.jsonl"

pass
