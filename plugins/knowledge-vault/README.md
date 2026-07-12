# knowledge-vault

Personal knowledge vault: capture, search, and organize markdown notes through
`qmd` and an Obsidian-friendly directory structure.

## Installation

```shell
/plugin install knowledge-vault@judi-plugins
```

After installing, run `/knowledge-vault:setup-vault` to scaffold the vault
directory tree. Then configure the plugin via `/plugins` → **knowledge-vault**
→ **Configure Options**:

- `vault_path` — absolute path to the vault root
- `vault_collection` — qmd collection name that indexes the vault

Optionally run `/knowledge-vault:setup-qmd` once per machine to schedule the
recurring `qmd cleanup` job and scope the index to content files.

## qmd MCP server

The plugin bundles a qmd MCP server (`.mcp.json`) that the skills use for
search and retrieval, with the `qmd` CLI as fallback. By default each session
runs its own stdio server. To share one long-lived daemon across sessions
(loads the embed/rerank models once), export in your shell profile:

```shell
export QMD_MCP_URL=http://localhost:8181/mcp
```

The `bin/qmd-mcp` shim then starts `qmd mcp --http --daemon` if needed and
bridges to it. Unset the variable to restore per-session servers.

## Prerequisites

This plugin does not install dependencies:

- [`qmd`](https://github.com/tobi/qmd) — required for search and wikilink discovery
- [Obsidian](https://obsidian.md) — recommended for browsing the vault

See [CLAUDE.md](./CLAUDE.md) for the full list of skills and hooks.
