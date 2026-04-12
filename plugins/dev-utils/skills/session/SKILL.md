---
name: session
description: "Capture session insights as a vault note. Invoke at end of session or when a meaningful chunk of work is complete."
argument-hint: "[optional focus: e.g. 'the JWT auth decision']"
disable-model-invocation: false
---

# Session Skill

Extract insights from the current Claude Code session and write a structured
note to the personal vault knowledge base.

## Vault Location

The vault root is `${user_config.vault_path}`.
The qmd collection is `judi-vault`.

If `${user_config.vault_path}` is empty or the directory does not exist, abort
and tell the user to configure the plugin via `/plugins` → dev-utils → Configure Options.

## Invocation Modes

**Full session** — `/dev-utils:session`
Extract all notable insights from the entire session.

**Focused** — `/dev-utils:session <focus>`
Extract insights related only to the specified focus area.
The focus text is available as `$ARGUMENTS`.

When `$ARGUMENTS` is provided, filter extraction to ONLY content relevant
to that focus. Ignore session activity unrelated to the focus.

## Axis Resolution

Determine the structural axis (repo, area, or topic) that this session
belongs to.

### 1. Extract slug from `pwd`

Use the basename of the current working directory (or its git root) as
the slug. Use the name exactly as-is — do not strip suffixes or
transform it.

### 2. Find the matching vault directory

Check for the slug under `${user_config.vault_path}/repos`:

```bash
REPO_DIR="${user_config.vault_path}/repos/<slug>"
```

- If the directory exists: use `repos/<slug>` as the structural axis.
- If it does not exist: ask the user which axis to file under. Present
  the available options by listing directories:
  - `repos/` — for repo-specific content
  - `areas/` — for life domains (golf, finance, health, etc.)
  - `topics/` — for cross-cutting subjects (ai, pkm, software-engineering, etc.)

### 3. Derive axis frontmatter

The axis is a wikilink to the hub file. The field name depends on the axis type:

```yaml
# For repos:
repo: "[[repos/<slug>/<slug>|<slug>]]"

# For areas:
area: "[[areas/<slug>/<slug>|<slug>]]"

# For topics:
topic: "[[topics/<slug>/<slug>|<slug>]]"
```

## Vault Conventions

Read these files every invocation — do not cache or hardcode their contents:

- `${user_config.vault_path}/STRUCTURE.md` — type rules and placement
- `${user_config.vault_path}/TAGS.md` — valid tags and tagging rules
- `${user_config.vault_path}/FRONTMATTER.md` — frontmatter formatting
- `${user_config.vault_path}/templates/session.md` — session note template

### Tag Rules

- Include 0-3 domain tags that describe the technical subject matter.
- All tags MUST exist in `${user_config.vault_path}/TAGS.md`.
- If a tag you need is not in TAGS.md, apply the three-check protocol
  defined in the "Adding New Tags" section of TAGS.md:
  1. No existing tag covers the concept (check for synonyms/broader tags)
  2. The tag plausibly applies to 2+ notes
  3. The tag follows naming conventions
- If the tag passes all checks, add it to TAGS.md with a scope
  description, then use it in the note.
- If it fails any check, fall back to the closest broader existing tag.

## Substantiveness Gate

Before extracting content, assess whether the conversation contains
extractable knowledge. If the session is purely mechanical (e.g., only
code generation with no discussion, trivial Q&A, routine file edits),
tell the user:

> "This session doesn't have extractable insights worth recording."

Do not create a note. Stop here.

## Extraction Process

Review the full conversation context (it is already loaded — do NOT attempt
to parse JSONL transcript files). Then extract ONLY the following categories.
Skip any category that has nothing meaningful to report.

### 1. Learnings

New information discovered during the session. Things the user (or agent)
did not know before and now does. 5-8 bullets max. Examples:

- "Locker Service prevents LWCs from accessing parent frame session tokens"
- "pytest-xdist requires `--forked` flag on macOS for module isolation"

Write each learning as a standalone, self-contained statement. Someone
reading this note 6 months from now should understand the learning without
needing the session context.

### 2. Decisions

Choices made during the session that affect architecture, implementation
strategy, tooling, or approach. For each decision, capture:

- **What** was decided
- **Why** it was chosen (over alternatives if discussed)
- **Impact** — what does this change or constrain going forward

### 3. Code Patterns

Reusable patterns, snippets, or techniques discovered or created. Only
include patterns that are:

- Non-obvious (not a basic CRUD operation)
- Reusable (would apply in similar situations)
- Worth remembering (solves a specific problem)

Include a short code block with the pattern and a 1-2 sentence explanation
of when to use it. Strip repo-specific variable names in favor of
generic ones where possible.

### 4. Problems Solved

Bugs fixed, errors resolved, or blockers unblocked. For each, capture:

- **Symptom** — what was broken or failing
- **Root cause** — why it was happening
- **Fix** — what resolved it

Only include problems where the root cause was non-obvious or the fix
is worth remembering. Skip trivial typos and syntax errors.

## Output Format

Use the template from `${user_config.vault_path}/templates/session.md` as the
structural starting point. Populate each section following these guidelines:

- **Title**: Concise title summarizing the session focus
- **Context paragraph** (optional): 2-3 sentences on what the session was about
  at a high level. Only include if helpful for future discovery.
- **Learnings**: Bulleted list of standalone, self-contained statements.
- **Decisions**: One H3 per decision. Include what, why, and impact.
- **Code Patterns**: One H3 per pattern. Include a short code block and a 1-2
  sentence explanation of when to use it.
- **Problems Solved**: One H3 per problem. Each with **Symptom**, **Root cause**,
  and **Fix** fields.

Omit any section that has no content. Do not include empty sections.

## File Naming

`YYYY-MM-DD-session-<slug>.md`

The slug should be 2-4 hyphenated words derived from the primary topic.

Examples:

- `2026-02-21-session-jwt-auth-strategy.md`
- `2026-02-21-session-batch-apex-debugging.md`

**Never include "note" in the filename.**

## Writing Rules

- Be concise. Each bullet or paragraph should be 1-3 sentences max.
- Write for future-you, not present-you. Include enough context to be
  useful in 6 months without the original session.
- Use [[wikilinks]] to reference existing vault notes discovered in step 7.
  Use the pre-formatted `[[path|Title]]` syntax from the linking context.
  Do not guess at links — only link to notes confirmed to exist by search.
- Do NOT include a chronological recap of the session. This is not a
  summary — it is an extraction of durable knowledge.
- Do NOT pad sections to fill space. A note with only Learnings and one
  Decision is better than a note with empty boilerplate.

## Execution Steps

1. Read `$ARGUMENTS` to determine mode (full vs focused).
2. Determine slug from `pwd` (basename of working directory or git root).
3. Resolve structural axis using the axis resolution logic above. Find
   the target directory by checking `${user_config.vault_path}/repos/<slug>`
   exists. If not, ask the user which axis (repo/area/topic) to use.
4. Read vault convention files:
   - `${user_config.vault_path}/STRUCTURE.md`
   - `${user_config.vault_path}/TAGS.md`
   - `${user_config.vault_path}/FRONTMATTER.md`
   - `${user_config.vault_path}/templates/session.md`
5. **Substantiveness gate.** Assess whether the session contains extractable
   knowledge. If purely mechanical, tell the user and stop.
6. Scan current session context for extractable content per the 4 categories.
7. **Discover vault context for linking.** If `qmd` is not installed, skip
   this entire step — the note will be created without wikilinks. Otherwise,
   execute sub-steps 7a–7f:

   **7a. Extract search entities** — From the extracted content (step 6),
   identify every named entity that plausibly exists as its own vault note.
   Entity types by priority:

   | Priority    | Entity type                         | Examples                        | Always query?    |
   | ----------- | ----------------------------------- | ------------------------------- | ---------------- |
   | 1 (highest) | Repositories                        | repo slugs from step 2          | Yes — never drop |
   | 2           | Glossary terms / internal jargon    | TDS, Command Center, Mascot     | Yes              |
   | 2           | Named tools / frameworks            | qmd, Salesforce Shield, Next.js | Yes              |
   | 3           | Named concepts / decisions          | JWT Bearer Flow, ECA auth       | If distinctive   |
   | 4 (lowest)  | Generic agenda items / action items | "review PR", "update docs"      | Drop first       |

   No hard cap on query count. Soft ceiling: ~8 BM25 queries per note.
   If approaching the soft ceiling, drop priority 4 and 3 entities first.
   **Never drop a repo query.**

   **7b. BM25 query formatting — CRITICAL**

   > **WARNING: BM25 tokenizes on hyphens and slashes.** This vault is full
   > of hyphenated content. Failing to de-hyphenate queries will produce
   > poor or empty results.
   >
   > **Always convert hyphens and slashes to spaces before running BM25
   > queries:**
   >
   > | What you want to find              | Wrong query             | Correct query           |
   > | ---------------------------------- | ----------------------- | ----------------------- |
   > | Notes about trusted-services-lite  | `trusted-services-lite` | `trusted services lite` |
   > | Notes tagged salesforce/lwc        | `salesforce/lwc`        | `salesforce lwc`        |
   > | Notes about jwt-auth               | `jwt-auth`              | `jwt auth`              |
   >
   > This does NOT apply to semantic search — the embedding model handles
   > hyphens and compound terms naturally.

   **7c. Run searches** — Two search strategies, used together:

   **BM25 (per entity)** — One query per named entity from 7a:

   ```bash
   qmd search "<de-hyphenated entity>" --json -n 5 -c judi-vault
   ```

   **Semantic (one pass for primary topic)** — One `vsearch` query for
   the note's overall topic, phrased as a natural language concept:

   ```bash
   qmd vsearch "<conceptual description of the note's topic>" --json -n 5 -c judi-vault
   ```

   The semantic query should be a 5–15 word natural language description,
   not a keyword list.

   If total BM25 hits across all entity queries already exceed 8 unique
   notes, the semantic pass may be skipped.

   **7d. Build linking context** — From combined BM25 + semantic results,
   deduplicate by path and discard:
   - Results with BM25 score < 0.50
   - Semantic results >15% below the top semantic score
   - Structural files (CLAUDE.md, TAGS.md, FRONTMATTER.md, any `index.md`)
   - Template files

   For each remaining result, record:
   - Title, vault path (strip `qmd://vault/` prefix and `.md` extension)
   - Pre-formatted wikilink: `[[<vault-path>|<title>]]`
   - Tags (from the result metadata, or run `qmd get "<filepath>" -l 20`
     for 2–3 top results to read their frontmatter tags)
   - Brief relevance note

   Note which domain tags recur across related notes — this is a signal
   (not a directive) for tag selection in step 9.

   **7e. Duplicate detection** — If any result has a title or topic that
   closely matches the note being created (same axis, overlapping
   subject matter), flag it:

   > **Potential duplicate detected**: `[[path|Title]]` covers a similar topic.

   Present the warning to the user and ask whether to:
   1. Proceed with creating a new note
   2. Update the existing note instead
   3. Merge content from both

   Do NOT silently create a duplicate.

   **7f. Use context during generation** — Carry the linking context into
   step 8. During note generation:
   - Insert `[[path|Title]]` wikilinks where the note's content naturally
     references a related note's topic. Link on first mention only.
   - When a glossary term is found (result has `type: term`), wikilink
     to it on first mention using `[[glossary/<slug>|<Title>]]`.
   - Place links in running prose, not in a separate section.
   - Do not force links. A note with zero wikilinks is better than a note
     with irrelevant ones.
   - Do not add a separate "Related Notes" or "See Also" section.

8. Generate the note content following the output format. Use the linking
   context from step 7 to insert `[[wikilinks]]` to related vault notes
   where the content naturally references their topics.
9. Validate that ALL tags in frontmatter exist in `${user_config.vault_path}/TAGS.md`.
   For any tag that doesn't exist, apply the three-check protocol from
   TAGS.md. Cross-reference domain tags observed on related notes in step 7d.
   Use related notes' tags as a weak signal — do not blindly copy them.
10. Determine target directory:
    - Use the axis directory from step 3.
    - Place the file in `<vault>/<axis>/<slug>/sessions/<filename>`.
    - Create the `sessions/` directory if it doesn't exist.
11. Write the file. No user confirmation needed — session notes are always
    new files, low-risk.
12. Update the qmd index so the new note is immediately searchable:
    ```bash
        qmd update 2>/dev/null && qmd embed 2>/dev/null
    ```
    If `qmd` is not installed, skip silently.
13. Report to the user: file path, title, which sections were populated,
    the number of wikilinks added, and which notes were linked.
