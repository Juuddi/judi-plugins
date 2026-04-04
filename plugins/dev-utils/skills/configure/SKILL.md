---
name: configure
description: Configure dev-utils plugin settings (e.g. vault projects path)
---

# Configure dev-utils

Set plugin configuration values that persist across updates.

## Usage

When the user invokes this skill, ask which setting to configure. Currently supported:

| Setting | Key | Description | Example |
|---------|-----|-------------|---------|
| Vault projects path | `vault_projects_path` | Directory where per-project directories are created on session start | `~/code/vault/projects` |

## To set a value

Run the configure script:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/configure.sh" "<key>" "<value>"
```

## To show current config

```bash
cat "${CLAUDE_PLUGIN_DATA}/config" 2>/dev/null || echo "No configuration set."
```
