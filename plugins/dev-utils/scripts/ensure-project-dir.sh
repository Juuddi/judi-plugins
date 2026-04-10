#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${CLAUDE_PLUGIN_OPTION_VAULT_PROJECTS_PATH:-}"

if [ -z "$BASE_DIR" ]; then
  exit 0
fi

# Expand ~ if present
BASE_DIR="${BASE_DIR/#\~/$HOME}"

PROJECT_NAME="$(basename "$PWD")"
TARGET_DIR="${BASE_DIR}/${PROJECT_NAME}"

if [ ! -d "$TARGET_DIR" ]; then
  mkdir -p "$TARGET_DIR"
fi
