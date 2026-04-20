#!/usr/bin/env bash
set -euo pipefail

# Detect external dependencies. Reports presence/absence; never installs.
# Output is plain key=value lines, one per tool, for the skill to render.

os="$(uname -s)"

# qmd — same on all platforms
if qmd_path="$(command -v qmd 2>/dev/null)"; then
  echo "qmd=found:$qmd_path"
else
  echo "qmd=missing"
fi

# Obsidian — platform-specific detection
case "$os" in
  Darwin)
    if [ -d "/Applications/Obsidian.app" ] || [ -d "$HOME/Applications/Obsidian.app" ]; then
      echo "obsidian=found:Applications"
    elif command -v mdfind >/dev/null 2>&1 && \
         [ -n "$(mdfind "kMDItemCFBundleIdentifier == 'md.obsidian'" 2>/dev/null | head -n 1)" ]; then
      echo "obsidian=found:spotlight"
    else
      echo "obsidian=missing"
    fi
    ;;
  Linux)
    if command -v obsidian >/dev/null 2>&1; then
      echo "obsidian=found:$(command -v obsidian)"
    elif command -v flatpak >/dev/null 2>&1 && \
         flatpak list --app 2>/dev/null | grep -qi 'md\.obsidian\.Obsidian'; then
      echo "obsidian=found:flatpak"
    elif ls "$HOME"/Applications/Obsidian*.AppImage >/dev/null 2>&1; then
      echo "obsidian=found:AppImage"
    else
      echo "obsidian=missing"
    fi
    ;;
  *)
    echo "obsidian=unknown_platform:$os"
    ;;
esac
