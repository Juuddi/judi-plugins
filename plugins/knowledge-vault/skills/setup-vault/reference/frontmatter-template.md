---
title: Vault Frontmatter Rules
description: Rules for YAML frontmatter in notes throughout this vault.
tags: []
icon: LiFileCode
created: {{today}}
updated: {{today}}
---

# Frontmatter

Frontmatter conventions for this vault. Every markdown file should have YAML
frontmatter at the top enclosed in `---` fences. Frontmatter provides metadata
for Dataview queries, graph views, and agent navigation.

Default `author:` for new notes is **{{author_name}}**{{author_email_suffix}}.

## Formatting

Values are written in YAML. Follow Obsidian's property format rules:

- **No quotes by default.** Text, dates, numbers, enums, and booleans
  are written unquoted.
- **Quote internal links.** Wikilinks in properties must be surrounded
  with quotes because `[[` and `]]` are special YAML characters.
- **Quote literal reserved words.** If a value is meant as the literal
  string `"null"`, `"true"`, `"false"`, or a bare number like `"123"`
  but should be treated as text, wrap it in quotes.
- **Quote strings that contain colon characters.** Required by Obsidian.
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

| Field        | Format   | Used on                   | Description                                                     |
| ------------ | -------- | ------------------------- | --------------------------------------------------------------- |
| `repo`       | wikilink | notes in `repos/<slug>/`  | Wikilink to the repo hub note                                   |
| `area`       | wikilink | notes in `areas/<slug>/`  | Wikilink to the area hub note                                   |
| `topic`      | wikilink | notes in `topics/<slug>/` | Wikilink to the topic hub note                                  |
| `status`     | enum     | `decision`, `research`    | `proposed`/`accepted`/`superseded`/`deprecated` or `open`/`resolved` |
| `question`   | string   | `research`                | The open question the research note is tracking                 |
| `supersedes` | wikilink | `decision`                | Wikilink to a prior decision this one replaces                  |
| `aliases`    | array    | `term`                    | Alternate names for the term                                    |
| `related`    | array    | hub notes                 | Wikilinks to related hub notes on other axes                    |
| `author`     | string   | any                       | Note author (defaults to vault owner: {{author_name}})          |

A note has **exactly one** of `repo:`, `area:`, or `topic:` — the structural
axis it belongs to. Glossary terms and top-level vault docs have none.

Structural fields are **wikilinks**, not strings. Wikilinks in frontmatter
create graph edges identically to inline wikilinks.

## Type

The `type` field classifies the note. Every note gets exactly one type.

| Type       | Use for                                                    |
| ---------- | ---------------------------------------------------------- |
| `note`     | Evergreen knowledge — atomic ideas, reference, or concepts |
| `session`  | Dated work log for a focused work block or agent session   |
| `decision` | Architecture or design decision record (ADR)               |
| `research` | Open investigation tracking an unresolved question         |
| `guide`    | How-to, setup instructions, or runbook                     |
| `term`     | Glossary definition of a tool, concept, or acronym         |

**Hub notes** (the `<slug>.md` at the root of a structural directory) are
`type: note` with `icon: LiTableOfContents`.

For full guidance on when to use each type, see `STRUCTURE.md`.

## Icons

Use [Lucide icons](https://lucide.dev/icons/) with the `Li` prefix.

### Reserved Icons

| Icon                | Reserved for                                                  |
| ------------------- | ------------------------------------------------------------- |
| `LiTableOfContents` | Hub notes (`<slug>.md` at the root of a structural directory) |

### Suggested Icons by Type

| Type       | Suggested Icon   |
| ---------- | ---------------- |
| `note`     | `LiFileText`     |
| `session`  | `LiNotebookPen`  |
| `decision` | `LiScale`        |
| `research` | `LiFlaskConical` |
| `guide`    | `LiBookOpen`     |
| `term`     | `LiBookMarked`   |

## Validation Checklist

Before saving a note, verify:

- [ ] `title` is human-readable, not a copy of the filename
- [ ] `description` is 1-2 sentences (Dataview tables truncate long text)
- [ ] `type` is one of the valid enum values
- [ ] `tags` follows `TAGS.md` conventions (0-3 tags)
- [ ] `icon` uses `Li` prefix with a valid Lucide icon name
- [ ] `created` is set and will never change
- [ ] `updated` reflects when the note was last meaningfully edited
- [ ] Notes inside a structural directory have exactly one of `repo:`, `area:`, or `topic:` as a wikilink to the hub
- [ ] `decision` and `research` notes have a valid `status:`
