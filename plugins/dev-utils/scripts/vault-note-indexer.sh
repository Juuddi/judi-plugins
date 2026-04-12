#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook on Write: re-index qmd when a vault note is written.
# Keeps the search index fresh without relying on each skill to remember.

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')

VAULT_PATH="${CLAUDE_PLUGIN_OPTION_VAULT_PATH:-}"

# Expand ~ if present
VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

# If vault path isn't configured or the written file isn't under it, pass through
if [ -z "$VAULT_PATH" ] || [ -z "$file_path" ]; then
  echo '{"continue": true}'
  exit 0
fi

# Normalize both paths for comparison (resolve symlinks, trailing slashes)
norm_vault=$(cd "$VAULT_PATH" 2>/dev/null && pwd -P) || { echo '{"continue": true}'; exit 0; }
norm_file=$(dirname "$file_path")
norm_file=$(cd "$norm_file" 2>/dev/null && pwd -P) || { echo '{"continue": true}'; exit 0; }

if [[ "$norm_file" != "$norm_vault"* ]]; then
  echo '{"continue": true}'
  exit 0
fi

# Only index markdown files
if [[ "$file_path" != *.md ]]; then
  echo '{"continue": true}'
  exit 0
fi

# Run qmd update + embed in background so we don't block the tool response
(qmd update 2>/dev/null && qmd embed 2>/dev/null) &

echo '{"continue": true}'
