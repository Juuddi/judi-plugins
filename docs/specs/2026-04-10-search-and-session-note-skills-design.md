# Search and Session Note Skills for dev-utils

**Date**: 2026-04-10
**Approach**: Fork and simplify from hive-mind plugin skills

## Context

The hive-mind plugin (in arctype-plugins) has a mature set of skills for interacting with an Obsidian vault as a knowledge base. Two of those skills — `search` and `session-note` — are being adapted for the dev-utils plugin to support a personal vault with similar conventions but scoped for personal use (no meetings, no PR/issue notes, no author resolution).

The personal vault will mirror hive-mind's structure: `repos/<repo-name>/`, `TAGS.md`, `FRONTMATTER.md`, `templates/`, glossary terms, and wikilinks. The qmd collection is hardcoded to `judi-vault`.

## Scope

### New Skills

1. **`search`** — Query the personal vault via qmd
2. **`session-note`** — Extract session insights and write a structured note to the personal vault

### Infrastructure Changes

1. **Rename userConfig**: `vault_projects_path` → `vault_path`
2. **Update SessionStart hook**: create `repos/<project-name>/` instead of `<project-name>/`
3. **Update CLAUDE.md**: reflect new skills and vault structure
4. **Version bump**: plugin.json and marketplace.json

## Search Skill

Fork from `hive-mind:search`. The following describes what changes.

### Identical to hive-mind

- Argument parsing (query extraction, `--semantic`/`--hybrid` flags)
- Search execution (BM25 via `qmd search`, semantic via `qmd vsearch`, hybrid via `qmd query`)
- BM25 de-hyphenation guidance
- Result parsing and presentation format
- Context-aware search strategy (derive repo name from `pwd`, search by it)
- Follow-up actions (offer to read notes, suggest different mode)
- Error handling
- Search tips

### Changes from hive-mind

| Aspect | hive-mind | dev-utils |
|--------|-----------|-----------|
| Collection | `hive-mind` | `judi-vault` |
| Config key | `${user_config.vault_path}` | `${user_config.vault_path}` (same name, different vault) |
| Invocation | `/hive-mind:search` | `/dev-utils:search` |
| Vault note paths | `repos/<repo-name>/` | `repos/<repo-name>/` (same structure) |
| Prerequisites | `qmd` + `gh` CLI | `qmd` only |

## Session-Note Skill

Fork from `hive-mind:session-note`. The following describes what changes.

### Identical to hive-mind

- Extraction process (learnings, decisions, code patterns, problems solved)
- Writing rules (concise, future-you oriented, no chronological recap)
- TAGS.md validation with three-check protocol
- Template usage from `${user_config.vault_path}/templates/session-note.md`
- qmd linking context (entity extraction, BM25 + semantic search, linking context building, duplicate detection)
- File naming: `YYYY-MM-DD-session-<slug>.md`
- qmd index update after writing (`qmd update && qmd embed`)
- Wikilinks woven into prose on first mention

### Removed from hive-mind

| Feature | Reason |
|---------|--------|
| Author resolution | No `author_name` config, no `people/` notes in personal vault |
| PROJECTS.md lookup | No project-name mapping needed |
| `author:` frontmatter field | No author tracking |
| `project:` frontmatter field | No project mapping |
| Meeting note guidance in entity search | No meetings in personal vault |
| People as priority-1 entities | No `people/` notes to link to |

### Changes from hive-mind

| Aspect | hive-mind | dev-utils |
|--------|-----------|-----------|
| Collection | `hive-mind` | `judi-vault` |
| Invocation | `/hive-mind:session-note` | `/dev-utils:session-note` |
| Repo resolution | `${user_config.vault_path}/repos/<repo-slug>/sessions/` | `${user_config.vault_path}/repos/<repo-slug>/` (no sessions/ subdir) |
| `repo:` frontmatter | Wikilink `[[repos/<slug>/<slug>\|<slug>]]` | Simple string (just the slug) |
| Entity search ceiling | ~8 BM25 for sessions, ~15 for meetings | ~8 BM25 (sessions only) |

## Plugin Infrastructure

### plugin.json userConfig

```json
{
  "vault_path": {
    "title": "Vault path",
    "description": "Absolute path to vault root (e.g. ~/code/my-vault)",
    "type": "directory",
    "sensitive": false
  }
}
```

Replaces the current `vault_projects_path` config.

### SessionStart Hook (ensure-project-dir.sh)

```bash
BASE_DIR="${CLAUDE_PLUGIN_OPTION_VAULT_PATH:-}"
# ...
TARGET_DIR="${BASE_DIR}/repos/${PROJECT_NAME}"
```

Changes:
- Env var: `CLAUDE_PLUGIN_OPTION_VAULT_PROJECTS_PATH` → `CLAUDE_PLUGIN_OPTION_VAULT_PATH`
- Directory: `${BASE_DIR}/${PROJECT_NAME}` → `${BASE_DIR}/repos/${PROJECT_NAME}`

### CLAUDE.md

Update to list all seven skills with their purposes, and document the vault path config and `judi-vault` collection convention.

### Version

Bump to `0.4.0` in both `plugin.json` and `marketplace.json` (new features).
