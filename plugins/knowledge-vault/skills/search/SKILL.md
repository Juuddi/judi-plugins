---
name: search
description: "You MUST use this before planning, scoping, or any work that could benefit from prior decisions, context, or domain knowledge."
argument-hint: "<query> [--semantic] [--hybrid]"
disable-model-invocation: false
---

# Search Skill

Search the personal vault knowledge store and load relevant prior knowledge before acting.
Prefer searching over reading files directly — the index ranks by relevance, so you load
the right context on the first try.

Search is backed by **qmd** over the `${user_config.vault_collection}` collection, exposed
through the bundled **qmd MCP server**. Use the qmd MCP **`query`** tool to search and
**`get`** to retrieve full notes — that's the preferred surface (no shell-approval friction).
Direct `qmd` CLI commands are the **fallback** if the MCP server is unavailable (see "CLI
Fallback" below).

## Prerequisites

- `${user_config.vault_path}` must be configured (path to vault root).
- The qmd MCP server ships with this plugin and registers automatically. If its tools are
  unavailable, fall back to the `qmd` CLI (must be installed and on `$PATH`).

If `${user_config.vault_path}` is empty or the directory does not exist, abort and tell the
user to configure the plugin via `/plugins` → knowledge-vault → Configure Options.

## Invocation

`/knowledge-vault:search <query>` — keyword search (fast, exact terms)
`/knowledge-vault:search <query> --semantic` — vector search (conceptual similarity)
`/knowledge-vault:search <query> --hybrid` — combined keyword + semantic (best recall)

Default is keyword search. Use `--semantic` when the query is conceptual or phrased as a
question. Use `--hybrid` when precision matters.

## Query types (qmd MCP `query`)

The `query` tool takes one or more typed sub-queries in a single call — the first gets 2×
weight, so lead with your strongest signal:

- **`lex`** — BM25 keywords (exact terms, names, `"quoted phrases"`, `-negation`).
- **`vec`** — a natural-language question (concept / fuzzy recall).
- **`hyde`** — a 1–2 sentence hypothetical answer passage (nuanced topics).

Map the invocation flags: default → `lex`; `--semantic` → `vec`; `--hybrid` → `lex` + `vec`.
Add `vec` (and `hyde`) when keywords miss. Filter with `minScore`. Pass
`collections: ["${user_config.vault_collection}"]`.

## Always pass `intent`

Every `query` call takes an **`intent`** string — a short phrase naming what you're actually
after and the *sense* of any ambiguous term. qmd does **not** search it; it feeds `intent` to
query-expansion and reranking to disambiguate and sharpen snippets. Derive it from the context
that prompted the search (the task, the file open, the surrounding conversation) — e.g. searching
`swing` with `intent: "the golf swing analyzer project, not UI swing states"` reranks toward the
right note. Even when a term is unambiguous, a plain topic phrase (`intent: "web page load
times"`) still improves snippets, so include one on every call.

## ⚠️ Hyphens in query text

De-hyphenate and de-slash `lex` queries — BM25 tokenizes on `-` and `/`:
`trusted-services-lite` → `trusted services lite`, `config/auth` → `config auth`. (The
CLI-fallback path is auto-normalized by the dehyphenate hook, but write `lex` sub-queries
de-hyphenated anyway.)

Do **not** put a negation token — a whitespace-preceded `-term`, e.g. `plugin -search` — in a
`vec`/`hyde` sub-query. The qmd `query` parser supports `-` negation only in `lex`; a token that
*starts* with `-` in a `vec`/`hyde` sub-query **errors** (`Negation (-term) is not supported in
vec/hyde queries. Use lex for exclusions.`). Internal hyphens are fine in `vec`/`hyde` —
`knowledge-vault` and `MCP-first` embed without error — so only a token beginning with `-`
matters here.

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

Call the qmd MCP `query` tool with a `lex` sub-query for the de-hyphenated repo name:

```
query(searches=[{type:"lex", query:"trusted services lite"}], intent:"recent sessions and decisions for the trusted-services-lite repo", collections=["${user_config.vault_collection}"], limit=20)
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

- The user passes specific search terms: `/knowledge-vault:search JWT auth strategy`
- The user asks to find something specific: "search for notes about rate limiting"

In those cases, use the arguments directly as the query (see Argument Parsing below).

## Argument Parsing

The query is everything in `$ARGUMENTS` after stripping any flags.

```
$ARGUMENTS = "JWT auth strategy --semantic"
  → query = "JWT auth strategy"
  → mode = semantic (vec)

$ARGUMENTS = "how to handle session tokens"
  → query = "how to handle session tokens"
  → mode = keyword (lex, default)
```

## Search Execution

### 1. Build and run the query (qmd MCP `query`)

Pick sub-query types from the invocation mode, de-hyphenate `lex` text, then call the
qmd MCP `query` tool with `collections: ["${user_config.vault_collection}"]` and an
`intent` (see above):

- **Keyword (default)**: `searches=[{type:"lex", query:"<de-hyphenated query>"}]`
- **Semantic** (`--semantic`): `searches=[{type:"vec", query:"<natural-language question>"}]`
- **Hybrid** (`--hybrid`): `searches=[{type:"lex", query:"..."}, {type:"vec", query:"..."}]`

Each hit returns a title, file path, score, and a snippet.

### 2. Filter results

- Drop `lex` hits scoring < 0.50.
- Drop `vec` hits more than 15% below the top `vec` score.
- Drop structural/template files (`CLAUDE.md`, `STRUCTURE.md`, `TAGS.md`, `FRONTMATTER.md`,
  any `index.md`, anything under `templates/`).
- Or pass `minScore` to the tool.

### 3. Retrieve full notes before relying on them

Read any note that looks relevant with the qmd MCP `get` tool — don't answer from snippets:

```
get("<file path from the result>")
```

`get` supports a line offset (`path.md:100`) and there's a `multi_get` tool for batch retrieval.

### 4. Freshness check (if results are empty or thin)

Before concluding "nothing found," call the qmd MCP `status` tool. If `needsEmbedding > 0`
(or the `${user_config.vault_collection}` collection's `lastUpdated` predates a note you
expect), the index is stale, not the vault empty. The `PostToolUse` indexer hook normally
runs `qmd update && qmd embed` after any vault write; if it hasn't caught up, run that and
retry rather than looping or reporting "nothing found."

### 5. Present results

Present results as a concise list:

```
My memories for "JWT authentication":

1. **ECA vs Session-Based Auth** (87%)
2. **Setting Up qmd with Bun** (52%)
```

Then offer follow-up actions:

- "Want me to read any of these notes?"
- "Should I search with a different mode?"

## CLI Fallback

If the qmd MCP server is unavailable, use the `qmd` CLI directly (the dehyphenate PreToolUse
hook auto-normalizes `qmd search` queries):

```bash
qmd search "<query>" --json -n 10 -c ${user_config.vault_collection}     # keyword (lex / BM25)
qmd vsearch "<query>" --json -n 10 -c ${user_config.vault_collection}    # semantic (vec)
qmd query "<query>" --json -n 10 -c ${user_config.vault_collection}      # hybrid + rerank
qmd get "<filepath>" --full                                              # retrieve a full note
```

Add `--intent "<what you're after>"` to `search`/`vsearch`/`query` to disambiguate — same effect
as the MCP `intent`.

## Search Tips

- BM25 tokenizes on hyphens and slashes — search `sqlite vec` not `sqlite-vec`, `config auth` not `config/auth`
- BM25 (`lex`) is best for exact terms, file names, and specific identifiers
- Semantic (`vec`) is best for questions and conceptual queries; combine `lex` + `vec` for best recall
- If `lex` returns nothing, add a `vec` sub-query
- Keep `lex` queries concise (2–6 words); phrase `vec` queries as natural language

## Error Handling

- If the MCP `query`/`get` tools error, retry once via the CLI fallback before flagging to the user
- If both surfaces error, stop immediately and flag to the user
- If no results: check freshness (step 4), then suggest a different search mode or broader terms
