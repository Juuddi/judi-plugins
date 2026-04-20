#!/usr/bin/env bash
set -euo pipefail

# Verify expected vault structure exists.
# Usage: verify-vault.sh <vault_path>
# Exits 0 if all expected paths exist, 1 otherwise.

VAULT_PATH="${1:-}"
if [ -z "$VAULT_PATH" ]; then
  echo "ERROR: vault_path argument required" >&2
  exit 1
fi

VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

fail=0
check() {
  local kind="$1" path="$2"
  if [ -e "$VAULT_PATH/$path" ]; then
    echo "  PASS  $kind  $path"
  else
    echo "  FAIL  $kind  $path"
    fail=1
  fi
}

echo "Verifying vault at: $VAULT_PATH"
check dir  areas
check dir  repos
check dir  topics
check dir  templates
check file STRUCTURE.md
check file TAGS.md
check file FRONTMATTER.md
check file CLAUDE.md

if [ "$fail" -eq 0 ]; then
  echo "OK: vault structure complete"
  exit 0
else
  echo "INCOMPLETE: re-run setup-vault to fill in missing pieces"
  exit 1
fi
