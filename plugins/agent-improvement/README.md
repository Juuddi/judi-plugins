# agent-improvement

Skill observability for Claude Code: record when watched skills run, review
each run against the live conversation while the session is still open, and
aggregate the reviews into concrete SKILL.md improvements. Reviewing is
automated; applying edits is always human-gated.

This is a mod (a plugin of function hooks). It runs inside Claude Code 2.1.287
or later, with no shell scripts and no background process.

## Installation

```shell
/plugin install agent-improvement@judi-plugins
```

Then configure via `/plugins` → **agent-improvement** → **Configure Options**:

- `watched_skills`: comma-separated skill names as they appear at invocation
  (e.g. `knowledge-vault:search, dev-utils:brainstorming`); `*` watches all.
  Tip: `jq '.skillUsage' ~/.claude.json` shows Claude Code's native usage
  counts; the heavily-used skills are the ones worth watching.
- `data_dir`: optional; defaults to `~/.claude/agent-improvement`

## How it works

When a watched skill runs (you typed `/skill`, or the agent called the Skill
tool), the mod records it and waits for your reaction. After your next turn
completes, or after two quiet minutes, it asks the session's own model one
tool-less question over the live transcript: how did that skill run go?
The transcript is served from the prompt cache, so the review costs little
more than its own output, and every pending skill shares one such question.
The mod never asks while that cache is cold (four quiet minutes, or a model
switch), since a cold question would re-send the whole conversation at full
price; the run waits for your next turn instead. A band above the prompt
shows what is pending or waiting, with a **Review now** button while the
cache is warm; `/review-now` does the same. Each review ends with the tokens
it cost.

Reviews land under `<data_dir>/reviews/<skill>/` with a structured
`suggestions:` block, and a ledger counts reviews per skill. Two more paths
feed the same files:

- **In-session**: `/agent-improvement:review-run <skill>` reviews the run from
  the live conversation and asks *you* what you expected, the signal no
  transcript has. The mod suggests it when tool failures pile up after a
  watched skill ran.
- **Improvement**: when a skill accumulates 3+ reviews since its last patch,
  the band and a note to the model remind you to run
  `/agent-improvement:improve-skill <skill>`, which aggregates the reviews
  (recurrence-weighted, with guards against skill-degrading "lessons"),
  proposes SKILL.md diffs against the marketplace working copy, and applies
  only what you approve.

## Prerequisites

- Claude Code 2.1.287 or later (mods)
- `jq`: used by the `review-run` and `improve-skill` skills' ledger steps

See [CLAUDE.md](./CLAUDE.md) for the hook table, data-file layout, and caveats.
