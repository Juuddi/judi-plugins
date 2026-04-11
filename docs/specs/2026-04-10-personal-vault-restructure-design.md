# Personal Vault Restructure

**Date**: 2026-04-10
**Target vault**: `~/code/vault/`
**Reference structure**: `~/code/hive-mind/` (minus work-specific pieces)

## Context

The `dev-utils` plugin now has `search` and `session-note` skills that expect a personal vault with a specific structure (`repos/<repo-slug>/`, `TAGS.md`, `templates/session-note.md`, qmd collection `judi-vault`). The current personal vault at `~/code/vault/` has a different layout (`projects/`, `domains/`, `daily/`, `notes/`) and qmd collection name (`vault`).

This spec restructures the personal vault to match the new skills while preserving the personal vault's richer frontmatter conventions (Lucide icons, type enum, created/updated dates, directory-index pattern).

## Goals

1. Make the vault compatible with the new `search` and `session-note` skills
2. Mirror hive-mind's structure, scoped for personal use (no meetings, people, PR/issue notes, PROJECTS.md)
3. Build out glossary, templates, and README to match hive-mind's level of infrastructure
4. Start from a clean slate — drop outdated project and domain content

## Final Vault Structure

```
~/code/vault/
├── CLAUDE.md           # updated
├── FRONTMATTER.md      # updated
├── TAGS.md             # updated
├── README.md           # new
├── glossary/           # new
│   └── index.md
├── repos/              # new (replaces projects/)
│   └── index.md
└── templates/
    ├── session-note.md # new
    └── term-note.md    # new
```

### Removed entirely

- `projects/sol/` — outdated
- `domains/` — all contents (`domains/claude/`, `domains/obsidian/`) — outdated
- `daily/` — empty, not part of new structure
- `notes/` — empty, not part of new structure

## Templates

### `templates/session-note.md`

```yaml
---
title: "{{title}}"
description:
type: note
tags: []
repo:
icon: LiFileText
created: "{{date}}"
updated: "{{date}}"
---

## Learnings

-

## Decisions

###

## Code Patterns

###

## Problems Solved

###

**Symptom**:
**Root cause**:
**Fix**:
```

### `templates/term-note.md`

```yaml
---
title: "{{title}}"
description:
type: note
tags: []
aliases: []
icon: LiBookMarked
created: "{{date}}"
updated: "{{date}}"
---

## Definition

## Context

## Related
```

## FRONTMATTER.md Changes

1. **Remove `status` field entirely** — not in the required table anyway, but referenced in directory-index example and CLAUDE.md. Delete all references.
2. **Add `repo` as optional field** — plain string matching the repo slug; used on notes inside `repos/<repo-slug>/` directories.
3. **Add `aliases` as optional field** — array of term variations; used on glossary term notes.

Final required fields: `title`, `description`, `type`, `tags`, `icon`, `created`, `updated`.
Final optional fields: `project` (existing, to be reviewed — may drop since `repo` replaces it), `repo` (new), `aliases` (new).

**Note:** `project` field is being replaced by `repo` in concept. The `project` optional field will be removed from FRONTMATTER.md during implementation since there's no `projects/` directory anymore.

## TAGS.md Changes

1. **Rename "Project" section → "Repo"** — update the heading and table caption.
2. **Drop the `#sol` project tag row** — Sol project is being removed.
3. **Update tag rule** — "Notes inside of a `projects/` subdirectory should have a project tag" → "Notes inside of a `repos/` subdirectory should have a repo tag that matches the `repo:` frontmatter."
4. **Add glossary note** — brief statement that glossary term notes don't need a repo tag; they're classified by domain tags only.
5. **Remove frontmatter field example that uses `project:`** — or update it to use `repo:` instead.

No new domain tags added proactively. New tags are added via the three-check protocol when needed.

## CLAUDE.md Changes

1. **Structure section** — replace old dir list with new:
   - `repos/` — per-repo directories
   - `glossary/` — glossary term notes
   - `templates/` — note templates
   - Remove all references to `projects/`, `domains/`, `daily/`, `notes/`
2. **Remove `status` from required fields list** — fix the current discrepancy with FRONTMATTER.md.
3. **Update qmd commands** — change `-c vault` → `-c judi-vault` in all examples.
4. **Tags section** — update "Project tags" → "Repo tags"; update `#sol` / `#golf-swing-analyzer` examples to reflect removal.
5. **File naming section** — drop the `MM-DD-YY.md` daily notes reference.
6. **Searching the Vault section** — keep the structure, just update collection name.
7. **Keep** — linking rules, directory-index convention, frontmatter principles, search tips, overall tone.

## README.md (new)

```markdown
# Personal Vault

Personal knowledge vault for software engineering, research, and projects.

## Structure

- `repos/` — per-repository notes (session notes, research, decisions tied to a specific code repo)
- `glossary/` — glossary term definitions
- `templates/` — note templates

## Conventions

- See `CLAUDE.md` for agent instructions and vault conventions
- See `FRONTMATTER.md` for frontmatter schema
- See `TAGS.md` for tagging rules

## Searching

Indexed by [qmd](https://github.com/tobi/qmd). Collection name: `judi-vault`.
```

## Directory Index Files

Following the existing directory-index convention, each new top-level directory gets an `index.md` with `type: directory-index`. Required:

- `repos/index.md`
- `glossary/index.md`

Each uses the personal vault's existing directory-index frontmatter pattern (minus `status`), with appropriate title/description.

## qmd Collection Rename

The personal vault is currently indexed under collection `vault`. The new skills use `judi-vault`.

**Change required:**
1. Locate qmd collection config (likely `~/.config/qmd/` or similar — verify during implementation).
2. Rename the existing `vault` collection to `judi-vault`, or remove and re-register pointing at `~/code/vault` as `judi-vault`.
3. Run `qmd update && qmd embed` to rebuild the index.
4. Verify with `qmd search "test" -c judi-vault`.

## Execution Order

Order matters: build and verify new structure before deleting old content. All changes are done in the `~/code/vault/` git repo, so every step is revertible.

1. **Create new directories and index files** — `repos/`, `glossary/`, their `index.md` files.
2. **Write templates** — `templates/session-note.md`, `templates/term-note.md`.
3. **Write README.md**.
4. **Update FRONTMATTER.md** — remove `status`, add `repo` and `aliases` optional fields, remove `project`.
5. **Update TAGS.md** — rename project→repo, drop `#sol`, add glossary note.
6. **Update CLAUDE.md** — structure list, required fields, qmd commands, tags section.
7. **Rename qmd collection to `judi-vault`** — update config, re-run `qmd update && qmd embed`.
8. **Verify** — run `qmd search` with new collection name, inspect new dirs, confirm templates load.
9. **Delete old content** — `projects/`, `domains/`, `daily/`, `notes/`.
10. **Commit in logical chunks** — new structure, doc updates, deletion each get their own commit(s).

## Out of Scope

- Writing actual content into glossary or repos (empty scaffolding only)
- Migrating any existing notes from the deleted directories
- Updating Obsidian-specific configs (`.obsidian/` is untouched)
- Adding new domain tags to TAGS.md proactively (grows organically)
