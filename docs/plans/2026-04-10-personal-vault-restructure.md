# Personal Vault Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use dev-utils:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `~/code/vault/` to match the new `dev-utils` skills — clean slate with `repos/`, `glossary/`, and templates, plus register the vault as qmd collection `judi-vault`.

**Architecture:** Build new structure first, update docs, verify, then delete old content. All changes in the `~/code/vault/` git repo, committed in logical chunks. qmd collection `judi-vault` is a brand-new registration — no existing collection to rename.

**Tech Stack:** Markdown files, YAML frontmatter, qmd CLI for indexing, git for version control.

---

## Important Notes

- **Target repo:** `~/code/vault/` (a separate git repo from judi-plugins)
- **All git commands use `-C ~/code/vault`** to operate on the vault repo without changing the working directory
- **The personal vault has no existing qmd collection** — current qmd state shows only `hive-mind`. Task 8 creates a new `judi-vault` collection; there is nothing to rename or remove first.

---

### Task 1: Create new directory scaffolding

Create the two new top-level directories with their directory-index files.

**Files:**

- Create: `~/code/vault/repos/index.md`
- Create: `~/code/vault/glossary/index.md`

- [ ] **Step 1: Create the directories**

```bash
mkdir -p ~/code/vault/repos ~/code/vault/glossary
```

- [ ] **Step 2: Create `repos/index.md`**

Write to `~/code/vault/repos/index.md`:

```markdown
---
type: directory-index
title: Repos
description: Per-repository notes — session notes, research, and decisions tied to a specific code repo.
tags: []
icon: LiTableOfContents
source: directory-manager
created: 2026-04-10
updated: 2026-04-10
---

# Repos

Per-repository notes. Each subdirectory corresponds to a code repository
and contains session notes, decisions, and research for that repo.
```

- [ ] **Step 3: Create `glossary/index.md`**

Write to `~/code/vault/glossary/index.md`:

```markdown
---
type: directory-index
title: Glossary
description: Definitions of tools, concepts, and domain-specific jargon.
tags: []
icon: LiTableOfContents
source: directory-manager
created: 2026-04-10
updated: 2026-04-10
---

# Glossary

Term definitions. Each note defines a single term or concept using the
`term-note` template. Link to glossary terms from other notes via
wikilinks: `[[glossary/jwt|JWT]]`.
```

- [ ] **Step 4: Commit**

```bash
git -C ~/code/vault add repos/index.md glossary/index.md
git -C ~/code/vault commit -m "Add repos/ and glossary/ directory scaffolding"
```

---

### Task 2: Write the session-note and term-note templates

**Files:**

- Create: `~/code/vault/templates/session-note.md`
- Create: `~/code/vault/templates/term-note.md`

- [ ] **Step 1: Create `templates/session-note.md`**

Write to `~/code/vault/templates/session-note.md`:

```markdown
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

- [ ] **Step 2: Create `templates/term-note.md`**

Write to `~/code/vault/templates/term-note.md`:

```markdown
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

- [ ] **Step 3: Commit**

```bash
git -C ~/code/vault add templates/session-note.md templates/term-note.md
git -C ~/code/vault commit -m "Add session-note and term-note templates"
```

---

### Task 3: Write the README.md

**Files:**

- Create: `~/code/vault/README.md`

- [ ] **Step 1: Create `README.md`**

Write to `~/code/vault/README.md`:

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

- [ ] **Step 2: Commit**

```bash
git -C ~/code/vault add README.md
git -C ~/code/vault commit -m "Add README"
```

---

### Task 4: Update FRONTMATTER.md

Remove `status` references, drop `project` optional field, add `repo` and `aliases` optional fields.

**Files:**

- Modify: `~/code/vault/FRONTMATTER.md`

- [ ] **Step 1: Replace the entire `FRONTMATTER.md` file**

Overwrite `~/code/vault/FRONTMATTER.md` with:

```markdown
---
title: Vault Frontmatter Rules
description: Rules for YAML frontmatter in notes throughout this vault.
tags: []
icon: LiFileCode
created: 2026-02-21
updated: 2026-04-10
---

# Frontmatter

Frontmatter conventions for this vault. Every markdown file should have YAML
frontmatter at the top enclosed in `---` fences. Frontmatter provides metadata
for Dataview queries, graph views, and agent navigation.

## Formatting

Values are written in YAML. Follow Obsidian's property format rules:

- **No quotes by default.** Text, dates, numbers, enums, and booleans
  are written unquoted: `title: A New Hope`, `created: 2026-02-23`.
- **Quote internal links.** Wikilinks in properties must be surrounded
  with quotes because `[[` and `]]` are special YAML characters:
  `link: "[[Episode IV]]"`. This applies to both single values and list
  items.
- **Quote literal reserved words.** If a value is meant as the literal
  string `"null"`, `"true"`, `"false"`, or a bare number like `"123"`
  but should be treated as text, wrap it in quotes. This is rare — only
  do it when the string content collides with a YAML type.
- **Quote strings that contain colon characters.** If a string
  (typically a description or title), contains a `:` character, the entire
  string must be quoted. If it is not, obsidian throws an error.
- **Empty values.** Leave the value blank for null/empty:
  `repo:` (no value). Do not write `repo: ""`.
- **Lists.** Each item on its own line, preceded by `- `:

  ```yaml
  tags:
    - obsidian
    - claude-code
  ```

## Required Fields

Every note must have these fields:

| Field         | Format       | Description                                     |
| ------------- | ------------ | ----------------------------------------------- |
| `title`       | string       | Human-readable name (not the filename)          |
| `description` | string       | 1-2 sentence summary; used by Dataview queries  |
| `type`        | enum         | Note type classification (see Type section)     |
| `tags`        | array        | Tag list; see `TAGS.md` for conventions         |
| `icon`        | string       | Lucide icon identifier (see Icons section)      |
| `created`     | `YYYY-MM-DD` | Date the note was created; never change         |
| `updated`     | `YYYY-MM-DD` | Date of last meaningful edit; update frequently |

## Optional Fields

| Field     | Format | Used on                | Description                                    |
| --------- | ------ | ---------------------- | ---------------------------------------------- |
| `repo`    | string | notes in `repos/<slug>/` | Repo slug matching the parent directory name |
| `aliases` | array  | glossary term notes    | Alternate names for the term (e.g. "JWT" → "JSON Web Token") |

## Type

The `type` field classifies what kind of note this is. Every note gets exactly
one type. This field powers Dataview queries and agent navigation.

| Type              | Use for                                     |
| ----------------- | ------------------------------------------- |
| `note`            | General knowledge, reference, or session note |
| `decision`        | Architecture or design decisions (ADRs)     |
| `research`        | Investigation, spike, or exploration        |
| `idea`            | Rough ideas, brainstorms                    |
| `guide`           | How-to, setup instructions, runbooks        |
| `directory-index` | Directory `index.md` files only             |

**Rules:**

- `directory-index` is reserved for `index.md` files — never use elsewhere
- Choose the most specific type that applies
- If unsure between `note` and something else, use the more specific type

## Icons

Icons provide visual identification in Obsidian's file explorer and graph view.
Use [Lucide icons](https://lucide.dev/icons/) with the `Li` prefix.

### Reserved Icons

Some icons are reserved for specific file types:

| Icon                | Reserved for          |
| ------------------- | --------------------- |
| `LiTableOfContents` | Directory index files |

### Suggested Icons by Type

| Type              | Suggested Icon      |
| ----------------- | ------------------- |
| `note`            | `LiFileText`        |
| `decision`        | `LiScale`           |
| `research`        | `LiFlaskConical`    |
| `idea`            | `LiLightbulb`       |
| `guide`           | `LiBookOpen`        |
| `directory-index` | `LiTableOfContents` |

**Rules:**

- When in doubt, pick a relevant Lucide icon that represents the content
- Consistency within a repo or domain is more important than perfect matches
- Browse [lucide.dev/icons](https://lucide.dev/icons/) for options

## File-Specific Rules

### Directory Index Files

Every directory with notes has an `index.md` with special requirements:

```yaml
---
type: directory-index # MUST be this exact value
title: Directory Title # Human name, not folder name
description: Purpose of this directory.
tags: [] # Broad domain/repo tags only (if inside a repo directory, include a repo tag)
icon: LiTableOfContents # MUST be this icon
source: directory-manager
created: 2026-02-21
updated: 2026-02-21 # Update when index metadata changes
---
```

### Repo Notes

Notes within a `repos/<slug>/` directory should include the `repo` field matching the parent directory:

```yaml
---
type: note
title: JWT auth strategy
description: Session note on authentication approach.
tags:
  - auth
  - jwt
repo: trusted-services-lite
icon: LiFileText
created: 2026-02-21
updated: 2026-02-21
---
```

### Glossary Term Notes

Notes inside `glossary/` define a single term. Use `aliases` for alternate spellings:

```yaml
---
type: note
title: JWT
description: JSON Web Token — a compact token format for claims.
tags:
  - auth
aliases:
  - JSON Web Token
icon: LiBookMarked
created: 2026-02-21
updated: 2026-02-21
---
```

## Example

A complete example showing all fields for a repo-linked session note:

```yaml
---
title: JWT auth strategy for external callouts
description: Session note chose JWT Bearer Flow over VF Session ID.
type: note
tags:
  - auth
  - salesforce
repo: trusted-services-lite
icon: LiFileText
created: 2026-02-15
updated: 2026-02-21
---
```

## Validation Checklist

Before saving a note, verify:

- [ ] `title` is human-readable, not a copy of the filename
- [ ] `description` is 1-2 sentences (Dataview tables truncate long text)
- [ ] `type` is one of the valid enum values
- [ ] `tags` follows `TAGS.md` conventions (2-5 tags)
- [ ] `icon` uses `Li` prefix with a valid Lucide icon name
- [ ] `created` is set and will never change
- [ ] `updated` reflects when the note was last meaningfully edited
```

- [ ] **Step 2: Commit**

```bash
git -C ~/code/vault add FRONTMATTER.md
git -C ~/code/vault commit -m "Update FRONTMATTER.md: drop status and project, add repo and aliases"
```

---

### Task 5: Update TAGS.md

Rename Project section → Repo, drop `#sol`, update tag rule to reference `repos/`, add glossary note.

**Files:**

- Modify: `~/code/vault/TAGS.md`

- [ ] **Step 1: Replace the entire `TAGS.md` file**

Overwrite `~/code/vault/TAGS.md` with:

```markdown
---
title: Vault Tagging Rules
description: Rules for file and directory tagging in this vault.
tags: []
icon: LiTags
created: 2026-02-20
updated: 2026-04-10
---

# Tags

Tagging conventions for this vault. Tags classify what a note is _about_.

## Rules

- Lowercase, hyphen-separated: `#api-design`, not `#APIDesign`
- Place tags in YAML frontmatter under `tags:`
- Inline hashtags only to tag a specific paragraph, not the whole note
- 0-3 tags per note — if you need more, the note should probably be split
- Tags classify; `[[wikilinks]]` connect — don't use tags as links
- Notes inside of a `repos/` subdirectory should have a repo tag that matches the `repo:` frontmatter
- Glossary term notes in `glossary/` don't need a repo tag — classify by domain tags only
- Do not include a `type` tag, this is reserved for frontmatter

## Note Type

Do not include type as a tag. This assertion is handled by frontmatter. For
further reference, see `FRONTMATTER.md`

## Domain

What technical or subject area the note covers. Add new domains as needed.
One level of nesting is allowed when it adds genuine precision.

| Tag            | Scope                                        |
| -------------- | -------------------------------------------- |
| `#api`         | REST, GraphQL, API design                    |
| `#docker`      | Containers, compose, orchestration           |
| `#frontend`    | HTML, CSS, JS, UI                            |
| `#nextjs`      | Next.js or Vercel                            |
| `#backend`     | Server-side, Django, Node                    |
| `#payments`    | Billing, stripe, revenue                     |
| `#devops`      | CI/CD, deployments, infrastructure           |
| `#database`    | Schema, queries, data modeling               |
| `#tooling`     | Dev environment, CLI, editor setup           |
| `#claude-code` | Claude Code agent, skills, config, workflows |
| `#obsidian`    | Obsidian app, plugins, vault management      |
| `#git`         | Git, version control, GPG signing            |
| `#golf`        | Golf notes, stats, tournaments               |
| `#travel`      | Trips, destinations, plans                   |
| `#finance`     | Personal finance, investments                |
| `#health`      | Fitness, nutrition, medical                  |
| `#gear`        | Equipment, hardware, purchases               |

## Repo

Use a repo tag when a note is tied to a specific repository.
These mirror the `repos/` directory structure.

No repo tags are defined yet. Add them as repos are added to the vault.

Repo tags are essential for graph view and note linkage, but the
full repo context lives in the repo's `index.md` file. Use
repo tags for cross-referencing, not as a substitute for
placing notes in the repo directory.

## Frontmatter Fields (Not Tags)

These are **not tags**. Track them as frontmatter key-value pairs:

```yaml
---
type: note # see `FRONTMATTER.md` for enum values
repo: trusted-services-lite # repo slug matching the parent directory
created: 2026-02-21
updated: 2026-02-21
---
```

Agents and Dataview can query these fields directly.

## Adding New Tags

Agents and users may add new tags to this file at the time they use them,
provided all three checks pass:

1. **No existing tag covers the concept** — check the tables above and
   Obsidian's tag pane for synonyms or broader tags that already fit.
   When in doubt, prefer the existing tag.
2. **The tag plausibly applies to 2+ notes** — a tag used once is noise.
   Ask: "Is this a recurring domain or a one-off detail?" One-off details
   belong in note content, not tags.
3. **The tag follows naming conventions** — lowercase, hyphen-separated,
   one level of nesting max (`salesforce/shield` is fine,
   `salesforce/shield/encryption` is not).

If a tag passes all three checks, add it to the appropriate table above
with a short scope description, then use it. If it fails any check, fall
back to the closest broader tag that already exists.

New repo tags should be added when a repo directory is created.

### Tag Hygiene

- Periodically review the tag pane for tags with only 1 note — consider
  merging them into a broader tag or removing them.
- If two tags converge in meaning over time, consolidate to one and
  update all affected notes.
```

- [ ] **Step 2: Commit**

```bash
git -C ~/code/vault add TAGS.md
git -C ~/code/vault commit -m "Update TAGS.md: rename projects to repos, drop sol, add glossary note"
```

---

### Task 6: Update CLAUDE.md

Update structure list, remove status from required fields, switch qmd collection name to `judi-vault`, drop daily-notes references, update tags wording.

**Files:**

- Modify: `~/code/vault/CLAUDE.md`

- [ ] **Step 1: Replace the entire `CLAUDE.md` file**

Overwrite `~/code/vault/CLAUDE.md` with:

```markdown
---
title: CLAUDE
description: Directions and useful tips for Claude agents for this vault
tags: []
icon: LiBot
created: 2026-02-20
updated: 2026-04-10
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a personal knowledge vault for a software engineer. It contains
per-repo session notes, glossary terms, and reusable templates.

## Structure

- `repos/` — Per-repository notes (session notes, research, decisions)
- `glossary/` — Glossary term definitions
- `templates/` — Reusable note templates

## Directory Index Convention

Every directory containing notes has an `index.md` file with
`type: directory-index` in its frontmatter. These serve as the
navigational backbone of the vault.

To orient on vault structure:

```bash
grep -rl "type: directory-index" . --include="*.md" | head -50
```

Read relevant index files before diving into individual notes.

## Frontmatter

See `FRONTMATTER.md` for the full frontmatter reference. Key principles:

- **Required fields**: `title`, `description`, `type`, `tags`, `icon`, `created`, `updated`
- **Type field** classifies the note: `note`, `decision`, `research`, `idea`, `guide`, `directory-index`
- **Icons** use Lucide identifiers with `Li` prefix: `LiFileText`, `LiTableOfContents`
- **Dates** use `YYYY-MM-DD` format; `created` never changes, `updated` changes often

## Tags

See `TAGS.md` for the full tagging reference. Key principles:

- **Domain tags** describe the subject: `#obsidian`, `#claude-code`, `#golf`
- **Repo tags** are shorthand links: match the `repos/` subdirectory name
- One level of tag nesting max: `#salesforce/shield` is fine,
  `#salesforce/shield/encryption` is not
- Agents may add new domain tags to `TAGS.md` when content demands it,
  following the three-check protocol defined in that file

## Linking

- Use wikilinks: `[[note-name]]` or `[[folder/note-name|Display Text]]`
- Link liberally to existing notes when mentioning concepts, tools, or glossary terms
- Prefer linking over creating duplicate content

## File Naming

- Directory index files are always named `index.md`
- Session notes use `YYYY-MM-DD-session-<slug>.md` format
- Use kebab-case for all filenames: `jwt-auth-strategy.md`, not `JWT Auth Strategy.md`

## Searching the Vault

This vault is indexed by [qmd](https://github.com/tobi/qmd), a local
search tool with BM25 keyword and vector-based semantic search. **Use
qmd for discovery queries** — finding notes about a concept, topic, or
question when you don't know exact filenames or phrases. Use grep/glob
for targeted structural lookups (specific tags, frontmatter fields,
exact strings).

Run `qmd update` before searching to pick up recent changes (fast,
file-scan only). Run `qmd embed` after editing vault files if you plan
to use semantic search — without it, `vsearch` operates on stale vectors.

### Commands

| Command | When to use |
| --- | --- |
| `qmd search "<query>" -n 10 -c judi-vault` | Exact terms, file names, identifiers |
| `qmd vsearch "<query>" -n 10 -c judi-vault` | Conceptual questions, fuzzy topics |
| `qmd query "<query>" -n 10 -c judi-vault` | Best quality — hybrid with LLM reranking (slower) |
| `qmd get "<filepath>" --full` | Read a specific note by its vault-relative path |

Add `--json` to any search command for structured output.

### Tips

- BM25 tokenizes on hyphens — search `sqlite vec` not `sqlite-vec`
- Use keyword search for known terms; semantic search when exploring
- If keyword search returns nothing, try semantic before broadening
- The `dev-utils:search` skill wraps these commands with argument parsing
  and result formatting
```

- [ ] **Step 2: Commit**

```bash
git -C ~/code/vault add CLAUDE.md
git -C ~/code/vault commit -m "Update CLAUDE.md for new structure and judi-vault collection"
```

---

### Task 7: Delete old directories

Remove the obsolete `projects/`, `domains/`, `daily/`, and `notes/` directories.

**Files:**

- Delete: `~/code/vault/projects/`
- Delete: `~/code/vault/domains/`
- Delete: `~/code/vault/daily/`
- Delete: `~/code/vault/notes/`

- [ ] **Step 1: Remove the directories via git**

```bash
git -C ~/code/vault rm -r projects domains daily notes
```

Expected output: lists all removed files (including `projects/sol/index.md`, `domains/claude/...`, `domains/obsidian/...`, and the empty `daily/` / `notes/` dirs if they contain tracked files — if any dir is empty and untracked, `git rm` will skip it).

- [ ] **Step 2: If `daily/` or `notes/` are empty and not tracked, remove them from the filesystem**

```bash
rmdir ~/code/vault/daily ~/code/vault/notes 2>/dev/null || true
```

The `|| true` tolerates the case where they were already removed by git or don't exist.

- [ ] **Step 3: Verify new vault structure**

```bash
ls ~/code/vault/
```

Expected: `CLAUDE.md`, `FRONTMATTER.md`, `README.md`, `TAGS.md`, `glossary/`, `repos/`, `templates/` (plus `.git`, `.obsidian`, `.claude`, `.vscode`, `.gitignore`).

- [ ] **Step 4: Commit**

```bash
git -C ~/code/vault commit -m "Remove obsolete projects, domains, daily, and notes directories"
```

---

### Task 8: Register qmd collection `judi-vault`

Create a new qmd collection pointing at the personal vault, index it, and verify.

**Files:**

- Modify: `~/.config/qmd/index.yml` (managed by qmd CLI, don't edit by hand)

- [ ] **Step 1: Confirm no existing `vault` or `judi-vault` collection**

```bash
qmd collection list
```

Expected: shows `hive-mind` only. If `judi-vault` already exists, stop and ask the user before continuing.

- [ ] **Step 2: Add the `judi-vault` collection**

```bash
qmd collection add /Users/judi/code/vault --name judi-vault --mask "**/*.md"
```

Expected: confirmation that the collection was added. This also performs an initial scan.

- [ ] **Step 3: Run a full index update**

```bash
qmd update
```

Expected: confirms indexing completed across both collections (hive-mind and judi-vault).

- [ ] **Step 4: Build vector embeddings for semantic search**

```bash
qmd embed
```

Expected: confirms embedding completed. May take a moment.

- [ ] **Step 5: Verify with a test search**

```bash
qmd search "frontmatter" -n 5 -c judi-vault
```

Expected: returns results from the personal vault (at minimum, `FRONTMATTER.md` should match).

- [ ] **Step 6: Verify directory-index notes are indexed**

```bash
qmd search "directory index" -n 5 -c judi-vault
```

Expected: returns results including `repos/index.md` and `glossary/index.md`.

- [ ] **Step 7: No commit needed**

qmd config is stored outside the vault repo (`~/.config/qmd/index.yml`) and is not committed. This task is done when verification passes.

---

## Final Verification

After all tasks complete, perform a final sanity check:

- [ ] **Step 1: Check git log in the vault repo**

```bash
git -C ~/code/vault log --oneline -10
```

Expected: shows 7 new commits from this plan (tasks 1-7).

- [ ] **Step 2: Check vault structure**

```bash
ls ~/code/vault/ && echo "---" && ls ~/code/vault/repos/ && echo "---" && ls ~/code/vault/glossary/ && echo "---" && ls ~/code/vault/templates/
```

Expected:
- Root: `CLAUDE.md`, `FRONTMATTER.md`, `README.md`, `TAGS.md`, plus `glossary/`, `repos/`, `templates/` (and hidden dirs)
- `repos/`: `index.md`
- `glossary/`: `index.md`
- `templates/`: `session-note.md`, `term-note.md`

- [ ] **Step 3: Confirm qmd collection is registered**

```bash
qmd collection list
```

Expected: shows both `hive-mind` and `judi-vault`.
