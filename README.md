# Judi Plugins

A Claude Code plugin marketplace maintained by Judi.

## What are Claude Code Plugins?

Claude Code plugins extend Claude's capabilities through custom skills and tools. Plugins are distributed via marketplaces—Git repositories containing a `.claude-plugin/marketplace.json` catalog that lists available plugins.

Each plugin can provide:

- **Skills**
- **Hooks**
- **Rules**
- **Channels**

## Installation

1. Add this marketplace to Claude Code:

   ```shell
   /plugin marketplace add https://github.com/juuddi/judi-plugins
   ```

2. Install a plugin:

   ```shell
   /plugin install <plugin-name>@judi-plugins
   ```

3. Configure required environment variables (see individual plugin READMEs)

## Plugin Development

For more information on developing Claude Code plugins, see the [Claude plugin documentation](https://docs.anthropic.com/en/docs/claude-code/plugins)
