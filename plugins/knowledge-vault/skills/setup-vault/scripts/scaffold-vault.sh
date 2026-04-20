#!/usr/bin/env bash
set -euo pipefail

# Idempotently scaffold the vault directory tree.
# Usage: scaffold-vault.sh <vault_path>

VAULT_PATH="${1:-}"
if [ -z "$VAULT_PATH" ]; then
  echo "ERROR: vault_path argument required" >&2
  exit 1
fi

VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

mkdir -p "$VAULT_PATH"/{areas,repos,topics,templates}

# .gitignore — only create if missing
if [ ! -f "$VAULT_PATH/.gitignore" ]; then
  cat > "$VAULT_PATH/.gitignore" <<'EOF'
.obsidian/workspace*
.obsidian/cache
.DS_Store
.qmd/
EOF
fi

# Placeholder README — only if missing
if [ ! -f "$VAULT_PATH/README.md" ]; then
  cat > "$VAULT_PATH/README.md" <<EOF
# Vault

Personal knowledge vault. See \`STRUCTURE.md\` for organization rules.
EOF
fi

echo "Scaffolded: $VAULT_PATH"
echo "  areas/ repos/ topics/ templates/"
echo "  .gitignore README.md"
