---
title: CLAUDE
description: Directions for Claude agents working with this vault
tags: []
icon: LiBot
created: {{today}}
updated: {{today}}
---

# CLAUDE.md

Personal knowledge vault for **{{author_name}}**. Contains per-repo session
notes, research, decisions, glossary terms, and reusable templates.

This vault is indexed by `qmd` under collection `{{vault_collection}}`.

## Structure

See `STRUCTURE.md` for the full reference. Summary:

- `repos/` — Per-repository notes for software projects you actively work on (bounded)
- `areas/` — Ongoing life areas: hobbies, skills, responsibilities (unbounded)
- `topics/` — Pure research/knowledge topics not tied to an activity (unbounded)
- `glossary/` — Glossary term definitions
- `templates/` — Reusable note templates

A note belongs to exactly one of `repos/`, `areas/`, or `topics/` via a
wikilink frontmatter field (`repo:`, `area:`, or `topic:`). The axis rule:

- **If it has a code repo, it's a repo.**
- **If it's ongoing but produces no code, it's an area.**
- **If it's pure learning with no direct action, it's a topic.**

## Hub Note Convention

Every structural directory contains a hub note named `<slug>.md` —
matching the directory name. Hub notes use `type: note` with
`icon: LiTableOfContents` and act as the graph anchor for the unit.

## Frontmatter

See `FRONTMATTER.md` for the full reference. Required fields: `title`,
`description`, `type`, `tags`, `icon`, `created`, `updated`. Plus exactly
one structural field (`repo:`, `area:`, or `topic:`) for notes inside a
structural directory.

## Tags

See `TAGS.md` for the full reference. Domain tags describe the subject;
they do not duplicate structural location. 0-3 tags per note. Add new
tags when content demands it, following the three-check protocol in
`TAGS.md`.

## Linking

- Use wikilinks: `[[note-name]]` or `[[folder/note-name|Display Text]]`
- Link liberally to existing notes when mentioning concepts, tools, or glossary terms
- Prefer linking over creating duplicate content

## File Naming

- Session notes: `YYYY-MM-DD-session-<slug>.md`
- Decision notes: `YYYY-MM-DD-decision-<slug>.md`
- Research notes: concept-named kebab-case (long-lived, not dated)
- Hub notes: `<slug>.md` matching parent directory
- Use kebab-case for all filenames
- **Do not include "note" in filenames** — the `.md` extension and `type:`
  frontmatter already classify the file as a note.

## Searching the Vault

Indexed by [qmd](https://github.com/tobi/qmd) under collection
`{{vault_collection}}`. Use qmd for discovery queries; use grep/glob for
targeted structural lookups.
