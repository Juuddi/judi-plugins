# knowledge-vault

Personal knowledge vault management. Capture, search, and organize markdown
notes through `qmd` and an Obsidian-friendly directory structure.

## Skills

| Skill         | Purpose                                                             |
| ------------- | ------------------------------------------------------------------- |
| `setup-vault` | One-time scaffolding of the vault directory tree and templates      |
| `setup-qmd`   | One-time (per machine) qmd maintenance: cleanup schedule, index scoping |
| `search`      | Query the vault via qmd (BM25, semantic, or hybrid)                 |
| `session`     | Capture session insights as a vault note                            |
| `record`      | Record mid-conversation knowledge (decisions, research, notes...)   |
| `research`    | Research a topic via web search and land findings as a vault note   |

## MCP Server

`.mcp.json` bundles a `qmd` MCP server (`query`/`get`/`multi_get`/`status`) — the skills'
preferred search surface, with the `qmd` CLI as fallback. The server command is the
`bin/qmd-mcp` shim: per-session stdio by default, but if `QMD_MCP_URL` is exported (e.g.
`http://localhost:8181/mcp`) it bridges to one shared `qmd mcp --http --daemon` so concurrent
sessions load the embed/rerank models once instead of N times.

## Hooks

| Event              | Matcher                    | Script                     | Purpose                                                                        |
| ------------------ | -------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `SessionStart`     | `startup\|clear\|compact`  | `session-index.sh`         | Injects an index of recent `repos/<pwd-basename>/` notes as session context    |
| `UserPromptSubmit` | —                          | `prompt-skill-reminder.sh` | Injects skill reminders when prompt mentions decisions, learnings, or sessions |
| `PostToolUse`      | `Write\|Edit`              | `vault-note-indexer.sh`    | Runs `qmd update && qmd embed` when a vault `.md` is written or edited         |
| `PreToolUse`       | `Bash`                     | `qmd-dehyphenate.sh`       | Normalizes `qmd search` queries (BM25 tokenizes on hyphens and slashes)        |

## Plugin Configuration

Set both via `/plugins` → knowledge-vault → Configure Options:

- `vault_path` — Absolute path to the vault root
- `vault_collection` — qmd collection name that indexes the vault

## External dependencies

This plugin does **not** install dependencies. Users must install:

- [`qmd`](https://github.com/judi/qmd) — required for `search` and wikilink discovery
- [Obsidian](https://obsidian.md) — recommended for browsing the vault

Run `/knowledge-vault:setup-vault` to scaffold the directory tree and check
which dependencies are available. Run `/knowledge-vault:setup-qmd` once per
machine to schedule the recurring `qmd cleanup` job and scope the index to
content files.
