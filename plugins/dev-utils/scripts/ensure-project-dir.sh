#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${CLAUDE_PLUGIN_DATA}/config"

# Read the vault projects path from plugin config.
# Falls back to DEV_UTILS_PROJECT_ROOT env var if config doesn't exist.
if [ -f "$CONFIG_FILE" ]; then
  BASE_DIR="$(grep '^vault_projects_path=' "$CONFIG_FILE" | cut -d'=' -f2-)"
else
  BASE_DIR="${DEV_UTILS_PROJECT_ROOT:-}"
fi

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
