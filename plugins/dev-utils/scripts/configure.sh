#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${CLAUDE_PLUGIN_DATA}/config"
KEY="$1"
VALUE="$2"

# Create or update a key=value pair in the config file.
if [ -f "$CONFIG_FILE" ] && grep -q "^${KEY}=" "$CONFIG_FILE"; then
  sed -i '' "s|^${KEY}=.*|${KEY}=${VALUE}|" "$CONFIG_FILE"
else
  echo "${KEY}=${VALUE}" >> "$CONFIG_FILE"
fi
