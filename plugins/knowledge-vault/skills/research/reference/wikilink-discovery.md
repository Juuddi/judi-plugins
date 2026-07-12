# Wikilink Discovery

How to search the vault for related notes and insert wikilinks into
generated content. This process runs after content extraction but before
note generation.

Searches run through the bundled **qmd MCP server** (`query`/`get` tools) —
the preferred surface. The `qmd` CLI is the fallback if the MCP server is
unavailable. If neither is available, skip this entire process — the note
will be created without wikilinks.

## Contents

- Extract search entities
- BM25 query formatting
- Run searches
- Build linking context
- Duplicate detection
- Use context during generation

## Extract search entities

From the extracted content, identify every named entity that plausibly
exists as its own vault note. Entity types by priority:

| Priority    | Entity type                         | Examples                        | Always query?    |
| ----------- | ----------------------------------- | ------------------------------- | ---------------- |
| 1 (highest) | Repositories                        | repo slugs from pwd             | Yes — never drop |
| 2           | Glossary terms / internal jargon    | TDS, Command Center, Mascot     | Yes              |
| 2           | Named tools / frameworks            | qmd, Salesforce Shield, Next.js | Yes              |
| 3           | Named concepts / decisions          | JWT Bearer Flow, ECA auth       | If distinctive   |
| 4 (lowest)  | Generic agenda items / action items | "review PR", "update docs"      | Drop first       |

No hard cap on query count. Soft ceiling: ~8 BM25 queries per note.
If approaching the soft ceiling, drop priority 4 and 3 entities first.
**Never drop a repo query.**

## BM25 query formatting — CRITICAL

> **WARNING: BM25 tokenizes on hyphens and slashes.** This vault is full
> of hyphenated content. Failing to de-hyphenate queries will produce
> poor or empty results.
>
> **Always convert hyphens and slashes to spaces before running BM25
> queries:**
>
> | What you want to find             | Wrong query             | Correct query           |
> | --------------------------------- | ----------------------- | ----------------------- |
> | Notes about trusted-services-lite | `trusted-services-lite` | `trusted services lite` |
> | Notes tagged salesforce/lwc       | `salesforce/lwc`        | `salesforce lwc`        |
> | Notes about jwt-auth              | `jwt-auth`              | `jwt auth`              |
>
> Semantic (`vec`) matching doesn't need de-hyphenation — but never start
> a token with `-` there: the qmd MCP `query` parser reads a leading `-`
> as a negation operator (valid only in `lex`), so a `vec` sub-query
> token beginning with `-` errors. Internal hyphens embed fine.

## Run searches

Two sub-query types, used together, via the qmd MCP `query` tool. Pass an
**`intent`** on every call — a short phrase naming what the note is about
and the sense of any ambiguous term (qmd does not search it; it feeds
query expansion and reranking).

**BM25 (per entity)** — One `lex` sub-query per named entity
(de-hyphenated):

```
query(searches=[{type:"lex", query:"<de-hyphenated entity>"}], intent:"<what this entity means in this note's context>", collections=["${user_config.vault_collection}"], limit=5)
```

**Semantic (one pass for primary topic)** — One `vec` sub-query for the
note's overall topic, phrased as a natural language concept:

```
query(searches=[{type:"vec", query:"<conceptual description of the note's topic>"}], intent:"<the note's topic>", collections=["${user_config.vault_collection}"], limit=5)
```

The semantic query should be a 5–15 word natural language description,
not a keyword list.

If total BM25 hits across all entity queries already exceed 8 unique
notes, the semantic pass may be skipped.

**CLI fallback** (if the MCP server is unavailable):

```bash
qmd search "<de-hyphenated entity>" --json -n 5 -c ${user_config.vault_collection}
qmd vsearch "<conceptual description>" --json -n 5 -c ${user_config.vault_collection}
```

Add `--intent "<what you're after>"` for the same disambiguation effect.

No `qmd update` here — re-indexing is handled automatically by the
plugin's `PostToolUse` indexer hook after the note is written.

## Build linking context

From combined BM25 + semantic results, deduplicate by path and discard:

- Results with BM25 score < 0.50
- Semantic results >15% below the top semantic score
- Structural files (CLAUDE.md, STRUCTURE.md, TAGS.md, FRONTMATTER.md, any `index.md`)
- Template files

For each remaining result, record:

- Title, vault path (strip the `qmd://<collection>/` prefix and `.md` extension)
- Pre-formatted wikilink: `[[<vault-path>|<title>]]`
- Tags (from the result metadata, or read the frontmatter of 2–3 top
  results with the qmd MCP `get` tool — CLI `qmd get "<filepath>" -l 20`
  as fallback)
- Brief relevance note

Note which domain tags recur across related notes — this is a signal
(not a directive) for tag selection during frontmatter generation.

## Duplicate detection

If any result has a title or topic that closely matches the note being
created (same axis, overlapping subject matter), flag it:

> **Potential duplicate detected**: `[[path|Title]]` covers a similar topic.

Present the warning to the user and ask whether to:

1. Proceed with creating a new note
2. Update the existing note instead
3. Merge content from both

Do NOT silently create a duplicate.

## Use context during generation

Carry the linking context into note generation. During content writing:

- Insert `[[path|Title]]` wikilinks where the note's content naturally
  references a related note's topic. Link on first mention only.
- When a glossary term is found (result has `type: term`), wikilink
  to it on first mention using `[[glossary/<slug>|<Title>]]`.
- Place links in running prose, not in a separate section.
- Do not force links. A note with zero wikilinks is better than a note
  with irrelevant ones.
- Do not add a separate "Related Notes" or "See Also" section.
