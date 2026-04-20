---
title: Vault Structure
description: How the vault is organized, what each note type is for, when to create vs. update, and where files are placed.
tags: []
icon: LiFolder
created: {{today}}
updated: {{today}}
---

# Structure

This document is the authoritative reference for vault organization.
It answers: what type of note should I create, when should I update an
existing one instead, and where does the file go?

For YAML formatting rules, see `FRONTMATTER.md`. For tagging rules,
see `TAGS.md`. For note body templates, see `templates/`.

## Three Axes

Every piece of content in the vault belongs to one of three structural
axes, or to the glossary:

| Axis       | Directory  | What belongs here                                          | Bounded? |
| ---------- | ---------- | ---------------------------------------------------------- | -------- |
| **Repos**  | `repos/`   | Software projects you actively work on                     | Yes      |
| **Areas**  | `areas/`   | Ongoing life activities: hobbies, skills, responsibilities | No       |
| **Topics** | `topics/`  | Pure research or learning not tied to an activity          | No       |
| Glossary   | `glossary/`| Single-term definitions (no structural axis)               | —        |

**How to choose:**

- If it has a code repository you work in, it's a **repo**.
- If it's ongoing but produces no code, it's an **area**.
- If it's pure learning with no direct action, it's a **topic**.

## Hub Notes

Every structural directory contains a hub note named `<slug>.md` —
matching the directory name. Hub notes are the graph anchor and
Dataview query page for the unit. They use `type: note` with
`icon: LiTableOfContents`.

Other notes connect to the hub via a frontmatter wikilink (`repo:`,
`area:`, or `topic:`). Hub notes may also have a `related:` field
linking to hubs on other axes.

## Note Types

There are six note types. Each has a distinct purpose, lifecycle, and
placement within a structural directory.

### note

Evergreen knowledge. Rewritable — update as your understanding evolves.
Self-contained: a reader six months later should understand it without
the original context.

Filename: `<concept>.md`. Placement: structural directory root.

### session

A frozen, dated record of one focused work block. Captures learnings,
decisions, code patterns, and problems solved in that sitting. Immutable
after creation — new work gets a new session note.

Filename: `YYYY-MM-DD-session-<slug>.md`. Placement: `<axis>/<slug>/sessions/`.

### decision

A frozen, dated record of a specific choice with rationale and
consequences. Immutable once accepted. When reversed, status changes to
`superseded` and a new decision is created with `supersedes:` linking
back.

Filename: `YYYY-MM-DD-decision-<slug>.md`. Placement: `<axis>/<slug>/decisions/`.

### research

A long-lived investigation tracking an unresolved `question:`. Has a
`status:` of `open` or `resolved`. Findings accumulate over time as
dated entries.

Filename: `<concept>.md`. Placement: `<axis>/<slug>/research/`.

### guide

Step-by-step instructions for a repeatable procedure — setup guides,
runbooks. Rewritable when the procedure changes.

Filename: `<concept>.md`. Placement: structural directory root.

### term

Glossary definition of a single tool, concept, or acronym. Short,
precise, with an example and related links.

Filename: `<concept>.md`. Placement: `glossary/`.

## Directory Layout

Every structural unit follows the same internal layout:

```
<slug>/
  <slug>.md              ← hub note (type: note, icon: LiTableOfContents)
  some-concept.md        ← evergreen note (type: note)
  setup.md               ← guide (type: guide)
  sessions/              ← dated work logs (type: session)
  decisions/             ← dated decision records (type: decision)
  research/              ← long-lived investigations (type: research)
```

| Type       | Location                   | Filename format                    |
| ---------- | -------------------------- | ---------------------------------- |
| `note`     | Directory root             | `<concept>.md`                     |
| `guide`    | Directory root             | `<concept>.md`                     |
| `session`  | `sessions/` subdirectory   | `YYYY-MM-DD-session-<slug>.md`     |
| `decision` | `decisions/` subdirectory  | `YYYY-MM-DD-decision-<slug>.md`    |
| `research` | `research/` subdirectory   | `<concept>.md`                     |
| `term`     | `glossary/` (top-level)    | `<concept>.md`                     |

Subdirectories are created lazily — only when the first file of that
type is written.

## Decision Flowchart

When writing vault content, follow this order:

1. **Identify the axis.** Repo, area, or topic? Create the hub note
   first if missing.
2. **Check for an existing note.** Search the vault for related content.
   If a `note`, `research`, or `guide` covers the topic → update it. If
   a `session` or `decision` exists → write a new file.
3. **Choose the type.** In order: session → decision → research → guide
   → term → note.
4. **Name the file.** Dated types get `YYYY-MM-DD-<type>-<slug>.md`.
   Evergreen types get `<concept>.md`. Never include "note" in the
   filename.
5. **Place the file.** Use the directory layout table above.
6. **Link it.** Add the structural wikilink (`repo:`, `area:`, or
   `topic:`) and inline `[[wikilinks]]` to related notes found via search.

## Create vs. Update

**Update an existing file when:**

- It is `type: note`, `research`, or `guide` (rewritable types)
- The new information is about the _same concept_ the file covers
- The update refines, extends, or corrects existing content

**Create a new file when:**

- No existing file covers this concept
- The existing file is `type: session` or `decision` (frozen types)
- The new content is from a different work session

**Never:**

- Update a `session` or `decision` note (they're immutable snapshots)
- Create a duplicate `note` for the same concept
- Create a note for ephemeral content that won't matter in 6 months
