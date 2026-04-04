#!/usr/bin/env bash
#
# bump-version.sh — bump plugin versions in marketplace.json
#
# Usage:
#   bump-version.sh              Interactive TUI (select plugin, bump type)
#   bump-version.sh --check      Report current versions, detect drift
#   bump-version.sh --audit      Check + grep repo for stale version strings
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MARKETPLACE="$REPO_ROOT/.claude-plugin/marketplace.json"

if [[ ! -f "$MARKETPLACE" ]]; then
  gum style --foreground 196 "error: marketplace.json not found."
  exit 1
fi

if ! command -v gum &>/dev/null; then
  echo "error: gum is required. Install from https://github.com/charmbracelet/gum" >&2
  exit 1
fi

# --- helpers ---

# Read all plugin names and versions from marketplace.json
# Outputs lines of "name<TAB>version"
read_plugins() {
  jq -r '.plugins[] | "\(.name)\t\(.version // "0.0.0")"' "$MARKETPLACE"
}

# Write a plugin's version by name
write_plugin_version() {
  local name="$1" version="$2"
  local tmp="${MARKETPLACE}.tmp"
  jq --arg n "$name" --arg v "$version" \
    '(.plugins[] | select(.name == $n)).version = $v' \
    "$MARKETPLACE" > "$tmp" && mv "$tmp" "$MARKETPLACE"
}

# --- commands ---

cmd_check() {
  local has_drift=0
  local versions=()
  local lines=()

  while IFS=$'\t' read -r name version; do
    lines+=("$(printf "  %-30s  %s" "$name" "$version")")
    versions+=("$version")
  done < <(read_plugins)

  if [[ ${#versions[@]} -eq 0 ]]; then
    gum style --foreground 196 "No plugins found in marketplace.json"
    return 1
  fi

  gum style --bold "Version check:"
  printf '%s\n' "${lines[@]}"
  echo ""

  local unique
  unique=$(printf '%s\n' "${versions[@]}" | sort -u | wc -l | tr -d ' ')
  if [[ "$unique" -gt 1 ]]; then
    gum style --foreground 196 --bold "DRIFT DETECTED — versions are not in sync:"
    printf '%s\n' "${versions[@]}" | sort | uniq -c | sort -rn | while read -r count ver; do
      echo "  $ver ($count plugins)"
    done
    has_drift=1
  else
    gum style --foreground 76 "All plugins in sync at ${versions[0]}"
  fi

  return $has_drift
}

cmd_audit() {
  cmd_check || true
  echo ""

  # Collect all current version strings
  local -a current_versions=()
  while IFS=$'\t' read -r _name version; do
    current_versions+=("$version")
  done < <(read_plugins)

  # Deduplicate
  local -a unique_versions=()
  while IFS= read -r v; do
    unique_versions+=("$v")
  done < <(printf '%s\n' "${current_versions[@]}" | sort -u)

  if [[ ${#unique_versions[@]} -eq 0 ]]; then
    gum style --foreground 196 "error: no versions found"
    return 1
  fi

  local found_undeclared=0

  for version in "${unique_versions[@]}"; do
    gum style --faint "Scanning for version string '$version'..."
    echo ""

    while IFS= read -r match; do
      local rel_path
      rel_path="${match#$REPO_ROOT/}"
      local match_file
      match_file=$(echo "$rel_path" | cut -d: -f1)

      # Skip known files
      if [[ "$match_file" == ".claude-plugin/marketplace.json" ]]; then
        continue
      fi

      if [[ "$found_undeclared" -eq 0 ]]; then
        gum style --foreground 214 --bold "UNDECLARED files containing '$version':"
        found_undeclared=1
      fi
      echo "  $rel_path"
    done < <(grep -rn \
      --exclude-dir=.git \
      --exclude-dir=node_modules \
      --binary-files=without-match \
      -F "$version" "$REPO_ROOT" 2>/dev/null || true)
  done

  echo ""
  if [[ "$found_undeclared" -eq 0 ]]; then
    gum style --foreground 76 "No undeclared files contain version strings. All clear."
  else
    echo "Review the above files — if they contain version references, update them."
  fi
}

cmd_bump() {
  # --- Load plugin data ---

  gum style --border rounded --border-foreground 99 --padding "0 2" --bold "Version Bump"

  local plugin_names=()
  local plugin_versions=()
  local plugin_labels=()

  while IFS=$'\t' read -r name version; do
    plugin_names+=("$name")
    plugin_versions+=("$version")
    plugin_labels+=("$name ($version)")
  done < <(read_plugins)

  if [[ ${#plugin_names[@]} -eq 0 ]]; then
    gum style --foreground 196 "No plugins found in marketplace.json"
    exit 1
  fi

  # --- Step 1: Select plugin ---

  local selected_label
  selected_label=$(gum choose --header="Select a plugin to bump:" "${plugin_labels[@]}")

  # Find index of selected label
  local selected_idx=0
  for i in "${!plugin_labels[@]}"; do
    if [[ "${plugin_labels[$i]}" == "$selected_label" ]]; then
      selected_idx=$i
      break
    fi
  done

  local plugin_name="${plugin_names[$selected_idx]}"
  local current_version="${plugin_versions[$selected_idx]}"

  # Parse current version
  local major minor patch
  IFS='.' read -r major minor patch <<< "$current_version"

  # --- Step 2: Analyze diff for suggestion ---

  local suggest_bump="patch"
  local suggest_reason="default"

  local plugin_dir="plugins/${plugin_name}"
  if git rev-parse --verify main &>/dev/null; then
    local diff_stat
    diff_stat=$(git diff --name-status main -- "$plugin_dir" 2>/dev/null || true)

    if [[ -n "$diff_stat" ]]; then
      local has_added=false
      local has_deleted=false
      local has_modified=false

      while IFS=$'\t' read -r status filepath; do
        case "$status" in
          A*) has_added=true ;;
          D*) has_deleted=true ;;
          R*) has_deleted=true ;;
          M*) has_modified=true ;;
        esac
      done <<< "$diff_stat"

      if $has_deleted; then
        suggest_bump="major"
        suggest_reason="deleted or renamed files detected"
      elif $has_added && ! $has_modified; then
        suggest_bump="minor"
        suggest_reason="new files added, no existing files modified"
      elif $has_added && $has_modified; then
        suggest_bump="minor"
        suggest_reason="new files added with modifications"
      else
        suggest_bump="patch"
        suggest_reason="existing files modified"
      fi
    fi
  fi

  # Build bump options with suggestion marker
  local patch_ver="$major.$minor.$((patch + 1))"
  local minor_ver="$major.$((minor + 1)).0"
  local major_ver="$((major + 1)).0.0"

  local suggested_marker=" <- suggested ($suggest_reason)"
  local patch_label="patch  ->  ${patch_ver}"
  local minor_label="minor  ->  ${minor_ver}"
  local major_label="major  ->  ${major_ver}"
  local custom_label="custom"

  case "$suggest_bump" in
    patch) patch_label="${patch_label}${suggested_marker}" ;;
    minor) minor_label="${minor_label}${suggested_marker}" ;;
    major) major_label="${major_label}${suggested_marker}" ;;
  esac

  # --- Step 3: Select bump type ---

  local bump_choice
  bump_choice=$(gum choose --header="Bump type for $plugin_name ($current_version):" \
    "$patch_label" "$minor_label" "$major_label" "$custom_label")

  local new_version
  case "$bump_choice" in
    patch*) new_version="$patch_ver" ;;
    minor*) new_version="$minor_ver" ;;
    major*) new_version="$major_ver" ;;
    custom*)
      new_version=$(gum input \
        --header="Custom version for $plugin_name" \
        --prompt="Version: " \
        --placeholder="$current_version" \
        --value="$current_version")
      ;;
  esac

  # Validate semver-ish format
  if ! echo "$new_version" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+'; then
    gum style --foreground 196 "error: '$new_version' doesn't look like a version (expected X.Y.Z)"
    exit 1
  fi

  # --- Step 4: Confirm ---

  echo ""
  if ! gum confirm "Bump $plugin_name: $current_version -> $new_version?"; then
    gum style --faint "Aborted."
    exit 0
  fi

  # --- Apply ---

  write_plugin_version "$plugin_name" "$new_version"

  echo ""
  gum style --foreground 76 --bold "✓ $plugin_name bumped: $current_version -> $new_version"
  gum style --faint "  Updated ${MARKETPLACE#$REPO_ROOT/}"
  echo ""

  gum style --faint "Running audit to check for stale version strings..."
  echo ""
  cmd_audit
}

# --- main ---

case "${1:-}" in
  --check)
    cmd_check
    ;;
  --audit)
    cmd_audit
    ;;
  --help|-h)
    echo "Usage: bump-version.sh [--check | --audit | --help]"
    echo ""
    echo "  (no args)    Interactive TUI to bump a plugin version"
    echo "  --check      Show current versions, detect drift"
    echo "  --audit      Check + scan repo for stale version references"
    exit 0
    ;;
  --*)
    echo "error: unknown flag '$1'" >&2
    exit 1
    ;;
  "")
    cmd_bump
    ;;
  *)
    echo "error: unexpected argument '$1'. Use --help for usage." >&2
    exit 1
    ;;
esac
