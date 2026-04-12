# judi-plugins

Judi's plugin marketplace for Claude Code.

## Foundation

Build using the [claude code plugins documentation](https://code.claude.com/docs/en/plugins-reference#plugins-reference). Use the `claude-code-setup` plugin for full access to reference material.

## Marketplace Structure

```txt
.claude-plugin/
  marketplace.json              # Marketplace catalog (lists all plugins)
plugins/
  <plugin-name>/
    .claude-plugin/
      plugin.json               # Plugin manifest (name, version)
    skills/                     # One directory per skill, each with a SKILL.md
```

To add another plugin, create a new directory under `plugins/` with its own `.claude-plugin/plugin.json` and add an entry to `.claude-plugin/marketplace.json`.

## Development

- Test locally: `/plugin marketplace add ./path/to/this/repo` then `/plugin install <plugin-name>@judi-plugins`
- After changes: reinstall the plugin and `/reload-plugins`
- Validate structure: `claude plugin validate .`
