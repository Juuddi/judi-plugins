---
name: search
description: "You MUST use this before planning, scoping, or any work that could benefit from prior decisions, context, or domain knowledge."
argument-hint: "<query> [--semantic] [--hybrid]"
disable-model-invocation: false
---

# Search Skill

Search the personal vault knowledge store using qmd and return relevant results.

## Prerequisites

- `qmd` must be installed and on `$PATH`
- `${user_config.vault_path}` must be configured (path to vault root)

If `${user_config.vault_path}` is empty or the directory does not exist, abort
and tell the user to configure the plugin via `/plugins` → dev-utils → Configure Options.

## Invocation

`/dev-utils:search <query>` — BM25 keyword search (fast, exact terms)
`/dev-utils:search <query> --semantic` — Vector search (conceptual similarity)
`/dev-utils:search <query> --hybrid` — Hybrid with LLM reranking (best quality, slowest)

Default is BM25 keyword search. Use `--semantic` when the query is
conceptual or phrased as a question. Use `--hybrid` when precision matters.

## Context-Aware Search (No Arguments or Vague Arguments)

When you invoke this skill on your own — without specific user-provided search terms — do NOT guess at a query based on the user's intent (e.g., do NOT search `"project-name new feature scope"`). Those queries return irrelevant results because the vault contains highly specific notes, not generalized ones.

Instead, use the **repo-context strategy**:

### 1. Derive the repo name from `pwd`

Extract the final directory component of the current working directory.

```
pwd = /Users/judi/code/trusted-services-lite
  → repo_name = "trusted-services-lite"
  → search_term = "trusted services lite"   (de-hyphenated for BM25)
```

### 2. Search by repo name

```bash
qmd search "<search_term>" --json -n 20 -c judi-vault
```

The vault organizes repo-related notes in `repos/<repo-name>/` directories, and notes include `repos` frontmatter linking to their relevant repository. Searching by repo name surfaces recent sessions, decisions, and context for the project.

### 3. Sort by recency

From the results, prioritize notes with the most recent date in the title.

### 4. Present as project context

Frame the results as "project memories" rather than "search results":

```
Here's my recent memories for trusted-services-lite:

1. **Session: Auth middleware refactor** (2026-03-28)
2. **PR: Add rate limiting to API endpoints** (2026-03-25)
```

### When to use this strategy

- The user says something general like "I want to scope a new feature" or "let's work on X"
- You're self-invoking to gather context before planning or debugging
- `$ARGUMENTS` is empty or contains only the user's intent (not a pointed search query)

### When NOT to use this strategy

- The user passes specific search terms: `/dev-utils:search JWT auth strategy`
- The user asks to find something specific: "search for notes about rate limiting"

In those cases, use the arguments directly as the query (see Argument Parsing below).

## Argument Parsing

The query is everything in `$ARGUMENTS` after stripping any flags.

```
$ARGUMENTS = "JWT auth strategy --semantic"
  → query = "JWT auth strategy"
  → mode = semantic

$ARGUMENTS = "how to handle session tokens"
  → query = "how to handle session tokens"
  → mode = keyword (default)
```

## Search Execution

### 1. Execute the search

**Keyword (default)**:

```bash
qmd search "<query>" --json -n 10 -c judi-vault
```

**Semantic** (`--semantic`):

```bash
qmd vsearch "<query>" --json -n 10 -c judi-vault
```

**Hybrid** (`--hybrid`):

```bash
qmd query "<query>" --json -n 10 -c judi-vault
```

### 2. Parse and present results

From the JSON output, extract for each result:

- **Title** (from document metadata)
- **File path** (relative to vault)
- **Score** (relevance percentage)
- **Snippet** (matched text excerpt)

Present results as a concise list:

```
My memories for "JWT authentication":

1. **ECA vs Session-Based Auth** (87%)
2. **Setting Up qmd with Bun** (52%)
```

### 3. Offer follow-up actions

After presenting results, offer:

- "Want me to read any of these notes?"
- "Should I search with a different mode?"

To read a note, use:

```bash
qmd get "<filepath>" --full
```

## Search Tips

- BM25 tokenizes on hyphens — search `sqlite vec` not `sqlite-vec`
- BM25 is best for exact terms, file names, and specific identifiers
- Semantic search is best for questions and conceptual queries
- If BM25 returns nothing, suggest the user try `--semantic`
- Keep queries concise: 2-6 words for BM25, natural language for semantic

## Error Handling

- If any of the above items error, stop immediately and flag to user
- If no results: suggest trying a different search mode or broader terms
