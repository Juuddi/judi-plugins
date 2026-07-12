#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook on Bash: auto-normalize qmd BM25 search queries.
# BM25 tokenizes on hyphens AND slashes, so "trusted-services-lite" or
# "config/auth" find nothing while "trusted services lite" / "config auth"
# work. Both are mapped to spaces (then runs collapsed). Most common qmd mistake.

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# Only intercept qmd search (BM25) commands — not vsearch or query
if ! echo "$command" | grep -qE '^\s*qmd\s+search\s'; then
  echo '{"continue": true}'
  exit 0
fi

# Use perl to normalize the first quoted string after "qmd search": map '-' and '/'
# to spaces, then collapse runs and trim (matches BM25 tokenization). Handles both
# double and single quotes. Perl is always available on macOS.
dehyphenated=$(echo "$command" | perl -pe '
  s{(qmd\s+search\s+")([^"]*)(")}{
    my ($pre, $query, $post) = ($1, $2, $3);
    $query =~ s{[-/]}{ }g;
    $query =~ s/\s+/ /g;
    $query =~ s/^\s+|\s+$//g;
    "$pre$query$post"
  }e ||
  s{(qmd\s+search\s+'"'"')([^'"'"']*)('"'"')}{
    my ($pre, $query, $post) = ($1, $2, $3);
    $query =~ s{[-/]}{ }g;
    $query =~ s/\s+/ /g;
    $query =~ s/^\s+|\s+$//g;
    "$pre$query$post"
  }e
')

# If nothing changed, pass through
if [ "$dehyphenated" = "$command" ]; then
  echo '{"continue": true}'
  exit 0
fi

jq -n --arg cmd "$dehyphenated" '{
  continue: true,
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    updatedInput: {
      command: $cmd
    }
  }
}'
