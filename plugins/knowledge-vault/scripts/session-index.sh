#!/usr/bin/env bash
# session-index.sh — emit a project-scoped index of recent vault notes for context injection.
# Scans repos/<pwd-basename>/ and prints a markdown index to stdout; Claude Code injects that
# stdout as session context (SessionStart). The index is the Tier-1 "primer": titles + dates +
# descriptions + paths, NOT full note bodies — the agent reads any relevant note on demand.
#
# Additive and NEVER fatal: missing config, no matching repo folder, or no notes → exit 0 with
# no output (silent no-op). It must never be noisy or block a session start.
#
# Config from env:
#   KNOWLEDGE_VAULT_PATH            absolute path to the vault (required; unset/missing → no-op)
#   KNOWLEDGE_VAULT_INDEX_LIMIT     count cap: max notes in the index            (default 8)
#   KNOWLEDGE_VAULT_INDEX_DESC_MAX  per-row description char cap before ellipsis (default 200)
# A hard ~8000-char budget guard (constant below) is the true ceiling under the harness's
# ~10000-char additionalContext cap; it drops the oldest rows first.
set -uo pipefail

VAULT="${KNOWLEDGE_VAULT_PATH:-}"
VAULT="${VAULT/#\~/$HOME}"                           # expand leading ~ (matches vault-note-indexer.sh)
LIMIT="${KNOWLEDGE_VAULT_INDEX_LIMIT:-8}"
DESC_MAX="${KNOWLEDGE_VAULT_INDEX_DESC_MAX:-200}"
BUDGET=8000                                          # headroom under the ~10000-char cap

[[ -n "$VAULT" && -d "$VAULT" ]] || exit 0          # no vault → silent no-op

# pwd-only scoping: basename of the working dir (no override, no fuzzy match).
SLUG="$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")"
DIR="$VAULT/repos/$SLUG"
[[ -d "$DIR" ]] || exit 0                            # no matching repo folder → silent no-op

# Tier-1 header + one-line retrieval nudge (kept lean).
out="## Knowledge Vault — project memories for \`$SLUG\`
Recent notes from your personal vault for this repo. These are NOT loaded in full — read any
that look relevant before you act (open the path, or knowledge-vault:search → qmd get).

"

# Recent N notes, newest-first. Index only DATE-PREFIXED notes (YYYY-MM-DD-*.md, i.e. the
# session/decision records) so every row has a valid date and a correct recency position; this
# naturally excludes the hub note (repos/<slug>/<slug>.md) and any undated topic rollups
# (still findable via search). Key the sort on the FILENAME (tab-separated), NOT the full
# path, so sessions/ and decisions/ notes interleave by date rather than grouping by subdir.
# `while read … < <(…)` (not a pipe) so the loop runs in THIS shell and keeps $out/$count,
# and avoids bash-4-only `mapfile` (stock macOS ships bash 3.2).
count=0
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  title=$(awk '/^title:/{sub(/^title:[[:space:]]*/,"");gsub(/"/,"");print;exit}' "$f")
  desc=$(awk '/^description:/{sub(/^description:[[:space:]]*/,"");gsub(/"/,"");print;exit}' "$f")
  date=$(basename "$f" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
  (( ${#desc} > DESC_MAX )) && desc="${desc:0:DESC_MAX}…"          # trim step 1: cap description
  printf -v row -- '- **%s** (%s) — %s\n  `%s`\n' \
    "${title:-$(basename "$f")}" "$date" "$desc" "${f#"$VAULT"/}"
  (( ${#out} + ${#row} > BUDGET )) && break                        # trim step 3: char guard (newest-first → drops oldest)
  out+="$row"
  count=$((count + 1))
done < <(
  find "$DIR" -type f -name '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*.md' -print0 \
    | while IFS= read -r -d '' f; do printf '%s\t%s\n' "$(basename "$f")" "$f"; done \
    | sort -r | cut -f2- | head -n "$LIMIT"
)

(( count > 0 )) || exit 0                            # nothing to show → silent no-op
printf '%s' "$out"
