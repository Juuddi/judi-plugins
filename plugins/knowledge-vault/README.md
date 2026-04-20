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

## Prerequisites

This plugin does not install dependencies:

- [`qmd`](https://github.com/tobi/qmd) — required for search and wikilink discovery
- [Obsidian](https://obsidian.md) — recommended for browsing the vault

See [CLAUDE.md](./CLAUDE.md) for the full list of skills and hooks.
