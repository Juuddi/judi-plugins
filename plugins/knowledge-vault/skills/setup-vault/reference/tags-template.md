---
title: Vault Tagging Rules
description: Rules for file and directory tagging in this vault.
tags: []
icon: LiTags
created: {{today}}
updated: {{today}}
---

# Tags

Tagging conventions for this vault. Tags classify what a note is _about_.

## Rules

- Lowercase, hyphen-separated: `#api-design`, not `#APIDesign`
- Place tags in YAML frontmatter under `tags:`
- Inline hashtags only to tag a specific paragraph, not the whole note
- 0-3 tags per note — if you need more, the note should probably be split
- Tags classify; `[[wikilinks]]` connect — don't use tags as links
- **Tags describe WHAT a note is about, not WHERE it lives.** Structural
  location (repo/area/topic) is handled by frontmatter wikilinks — don't
  duplicate it with a tag.
- Glossary term notes in `glossary/` classify by domain tags only
- Do not include a `type` tag — this is reserved for frontmatter

## Domain

What technical or subject area the note covers. Add new domains as needed.
One level of nesting is allowed when it adds genuine precision.

The starter set below is intentionally small. Add tags as you write the
notes that need them, following the three-check protocol below.

| Tag           | Scope                                        |
| ------------- | -------------------------------------------- |
| `#tooling`    | Dev environment, CLI, editor setup           |
| `#pkm`        | Personal knowledge management, note systems  |

## Structural Axes Are Not Tags

Repos, areas, and topics are tracked by frontmatter wikilinks, not tags:

- `repo:` — wikilink to a `repos/<slug>/<slug>.md` hub note
- `area:` — wikilink to an `areas/<slug>/<slug>.md` hub note
- `topic:` — wikilink to a `topics/<slug>/<slug>.md` hub note

A note has exactly one of these. The wikilink creates a graph edge
identical to an inline link, so the hub note is connected to every note in
its directory automatically. See `FRONTMATTER.md` for details.

## Adding New Tags

Agents and users may add new tags to this file at the time they use them,
provided all three checks pass:

1. **No existing tag covers the concept** — check the table above and
   Obsidian's tag pane for synonyms or broader tags that already fit.
   When in doubt, prefer the existing tag.
2. **The tag plausibly applies to 2+ notes** — a tag used once is noise.
   Ask: "Is this a recurring domain or a one-off detail?" One-off details
   belong in note content, not tags.
3. **The tag follows naming conventions** — lowercase, hyphen-separated,
   one level of nesting max (`salesforce/shield` is fine,
   `salesforce/shield/encryption` is not).

If a tag passes all three checks, add it to the domain table with a short
scope description, then use it. If it fails any check, fall back to the
closest broader tag that already exists.

### Tag Hygiene

- Periodically review the tag pane for tags with only 1 note — consider
  merging them into a broader tag or removing them.
- If two tags converge in meaning over time, consolidate to one and
  update all affected notes.
