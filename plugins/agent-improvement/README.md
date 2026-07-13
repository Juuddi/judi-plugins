# agent-improvement

Skill observability: record when watched skills run, review each run against
the session transcript (automatically at session end, or in-session while
it's fresh), and aggregate the reviews into concrete SKILL.md improvements.
Reviewing is automated; applying edits is always human-gated.

## Installation

```shell
/plugin install agent-improvement@judi-plugins
```

Then configure via `/plugins` → **agent-improvement** → **Configure Options**:

- `watched_skills` — comma-separated skill names as they appear at invocation
  (e.g. `knowledge-vault:search, dev-utils:brainstorming`); `*` watches all.
  Tip: `jq '.skillUsage' ~/.claude.json` shows Claude Code's native usage
  counts — the heavily-used skills are the ones worth watching.
- `data_dir` — optional; defaults to `~/.claude/agent-improvement`

## How it works

Hooks detect skill invocations from both directions — `UserPromptExpansion`
for user-typed `/skill` commands, `PostToolUse` on the `Skill` tool for
agent-initiated runs — and record them per session. Reviews then happen two
ways, producing identical artifacts under `<data_dir>/reviews/<skill>/`:

- **Automated**: when the session ends, a hook launches a headless
  `claude -p --bare` review of the transcript for each watched skill that ran
  — process adherence, friction, user feedback from any later turn, and
  structured improvement suggestions.
- **In-session**: `/agent-improvement:review-run <skill>` reviews the run from
  the live conversation and asks *you* what you expected — the signal no
  transcript has. A `PostToolUseFailure` hook suggests it automatically when
  tool failures pile up after a watched skill ran.

The loop closes through you: when a skill accumulates 3+ reviews since its
last patch, a `SessionStart` nudge reminds you to run:

```shell
/agent-improvement:improve-skill <skill-name>
```

which aggregates the reviews (recurrence-weighted, with guards against
skill-degrading "lessons"), proposes SKILL.md diffs against the marketplace
working copy (so git is the rollback), and applies only what you approve.

## First-run verification

Three hook payload details are undocumented upstream, so verify them once:
watch a skill, invoke it both ways (type `/the-skill`, and ask Claude to use
it), then check `<data_dir>/state/` for markers. If a detection misfired, its
raw payload is in `<data_dir>/unmatched-payloads.log` — adjust the jq paths in
`scripts/record-skill-invocation.sh` to match. Set `AGENT_IMPROVEMENT_DEBUG=1`
(or `touch <data_dir>/debug`) to log every payload the detection hooks
receive. The friction nudge (`PostToolUseFailure`) is best-effort until its
output contract is confirmed.

## Prerequisites

This plugin does not install dependencies:

- `jq` — required by the hook scripts
- `claude` CLI on `$PATH` — required for session-end analysis

See [CLAUDE.md](./CLAUDE.md) for the full pipeline, hook table, data-file
layout, and caveats.
