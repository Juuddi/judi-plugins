---
name: record
description: "You MUST invoke this (or ask the user) whenever an architecture decision is made, a non-obvious bug is diagnosed, a reusable code pattern emerges, or something surprising is learned about the repo, tooling, or developer workflow."
argument-hint: "[type] [--no-confirm] e.g. 'decision', 'research --no-confirm'"
disable-model-invocation: false
allowed-tools: Read Write Bash(qmd *) Bash(mkdir *)
---

# Record Skill

Record a piece of knowledge from the current conversation into the appropriate
vault note type. The agent decides the type using the STRUCTURE.md flowchart,
or the user can force a type via argument.

## Vault Location

The vault root is `${user_config.vault_path}`.
The qmd collection is `judi-vault`.

If `${user_config.vault_path}` is empty or the directory does not exist, abort
and tell the user to configure the plugin via `/plugins` → dev-utils → Configure Options.

## Invocation

- `/dev-utils:record` — agent decides type, confirms before writing
- `/dev-utils:record decision` — forces decision type, confirms
- `/dev-utils:record --no-confirm` — agent decides type, writes without confirming
- `/dev-utils:record decision --no-confirm` — forces type, writes without confirming

**Never `session`** — if the user passes `session` as a type, direct them
to `/dev-utils:session` instead.

## Argument Parsing

The arguments are available as `$ARGUMENTS`.

1. Strip `--no-confirm` flag if present → sets confirm mode to OFF
   (default is ON — always confirm unless flag is present).
2. Check remaining text against valid types: `note`, `decision`, `research`,
   `guide`, `term`.
3. If it matches a valid type → force that type, skip the type decision step.
4. If it does not match a type → treat it as a content hint describing
   what to record.
5. If the text is `session` → reject. Tell the user:
   > "Use `/dev-utils:session` for session notes."

## Axis Resolution

Determine the structural axis (repo, area, or topic) that this content
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
- `${user_config.vault_path}/templates/<type>.md` — template for the selected type

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

## Type Decision

If the user did not force a type via argument, follow the STRUCTURE.md
decision flowchart to choose the type:

- Is this a record of a specific choice with rationale? → `decision`
- Does this track an open question being investigated? → `research`
- Does this explain how to do something step-by-step? → `guide`
- Does this define a single term or concept? → `term`
- None of the above → `note`

## Content Templates

Each type has a specific structure. Follow the template from
`${user_config.vault_path}/templates/<type>.md`.

### `note`

- Write evergreen, self-contained content
- If updating an existing note, integrate new information into the
  existing structure — don't just append. Rewrite sections as
  understanding evolves.

### `decision`

- **Context:** What prompted this decision
- **Options:** Alternatives considered (with tradeoffs)
- **Decision:** What was chosen and why
- **Consequences:** What this constrains or enables
- **Revisit trigger:** When to reconsider

### `research`

- **Question:** The specific open question
- **Initial findings** with today's date
- **Sources** if available
- **Open threads** for further investigation

### `guide`

- **Purpose and audience**
- **Prerequisites**
- **Numbered steps** with exact commands
- **Verification and troubleshooting**

### `term`

- Concise definition in plain language
- Concrete example
- Related terms (as wikilinks if they exist in the vault)

## File Naming and Placement

Per STRUCTURE.md directory layout:

- `decision`: `YYYY-MM-DD-decision-<slug>.md` in `decisions/`
- `note`, `guide`: `<concept>.md` at the axis directory root
- `research`: `<concept>.md` in `research/`
- `term`: `<concept>.md` in `glossary/`

The slug should be 2-4 hyphenated words derived from the concept.

**Never include "note" in the filename.**

## Writing Rules

- Be concise. Each bullet or paragraph should be 1-3 sentences max.
- Write for future-you, not present-you. Include enough context to be
  useful in 6 months without the original conversation.
- Use [[wikilinks]] to reference existing vault notes discovered in step 7.
  Use the pre-formatted `[[path|Title]]` syntax from the linking context.
  Do not guess at links — only link to notes confirmed to exist by search.
- Do not add a separate "Related Notes" or "See Also" section. Place
  links in running prose on first mention only.
- Do not force links. A note with zero wikilinks is better than a note
  with irrelevant ones.

## Execution Steps

1. **Identify what to record.** Read the recent conversation context to
   understand what the user wants preserved. If `$ARGUMENTS` contains a
   content hint, use it. If ambiguous, ask:
   > "What specifically should I record — the decision about X,
   > the research question about Y, or the general concept of Z?"

2. **Parse arguments.** Strip `--no-confirm` flag. Check for forced type.
   See Argument Parsing section above.

3. **Resolve structural axis.** Same logic as above — check `pwd`, match
   to vault repo, ask user if ambiguous.

4. **Read vault conventions.** Read `STRUCTURE.md`, `TAGS.md`,
   `FRONTMATTER.md`. Hold off on reading the type template until the
   type is chosen (step 6).

5. **Search for existing notes.** This is critical — determines whether
   to create a new note or update an existing one.

   **BM25 search:**
   ```bash
   qmd search "<de-hyphenated concept>" --json -n 10 -c judi-vault
   ```

   **Semantic search:**
   ```bash
   qmd vsearch "<conceptual description>" --json -n 5 -c judi-vault
   ```

   > **BM25 query formatting — CRITICAL**
   >
   > **Always convert hyphens and slashes to spaces before running BM25
   > queries:**
   >
   > | What you want to find              | Wrong query             | Correct query           |
   > | ---------------------------------- | ----------------------- | ----------------------- |
   > | Notes about trusted-services-lite  | `trusted-services-lite` | `trusted services lite` |
   > | Notes tagged salesforce/lwc        | `salesforce/lwc`        | `salesforce lwc`        |
   >
   > This does NOT apply to semantic search.

   **Create vs update decision:**
   - If an existing note covers the same concept AND is a rewritable type
     (`note`, `research`, `guide`) → **update it** instead of creating new.
   - If an existing note is a frozen type (`session`, `decision`) →
     always create a new file. Never update frozen types.
   - If no existing note covers this concept → create a new file.

6. **Choose type.** If the user forced a type via argument, use it. Otherwise,
   follow the STRUCTURE.md decision flowchart (see Type Decision above).
   Then read the template: `${user_config.vault_path}/templates/<type>.md`.

7. **Discover vault context for linking.** Follow the full process in
   [reference/wikilink-discovery.md](reference/wikilink-discovery.md).
   If `qmd` is not installed, skip this step entirely.

8. **Confirm with user** (unless `--no-confirm` flag was set). Present:

   > **Recording plan:**
   > - **Action:** Create / Update
   > - **Type:** note / decision / research / guide / term
   > - **File:** `<full vault path>`
   > - **Title:** "<proposed title>"
   > - **Summary:** <1-2 sentence description of what will be recorded>
   >
   > Proceed?

   Wait for user confirmation. If the user disagrees with the type or
   location, adjust accordingly.

9. **Generate content** following the appropriate type template (see
   Content Templates above). Insert wikilinks from linking context on
   first mention where content naturally references related notes.

   **For updates:** Read the existing file first. Integrate new content
   into the existing structure. Preserve what's there. Add, don't replace
   (unless correcting errors).

10. **Build frontmatter** per `FRONTMATTER.md` rules. Include:
    - All required fields (`title`, `description`, `type`, `tags`,
      `icon`, `created`, `updated`)
    - The structural axis wikilink (`repo:`, `area:`, or `topic:`)
    - Type-specific fields (`status:`, `question:`, `supersedes:`,
      `aliases:` as applicable)
    - For updates: change only `updated`, preserve `created`.
    - Validate all tags against TAGS.md. Cross-reference tags from
      related notes in step 7c as a weak signal.

11. **Write or update the file.**
    - New file: Write the full note to the path from step 6.
    - Update: Write the integrated content back to the existing file.
    - Create parent directories if they don't exist.

12. **Report to the user:** file path, action taken (created/updated),
    type, title, and any wikilinks added.
