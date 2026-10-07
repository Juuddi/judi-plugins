# agent-improvement

Skill observability mod: record when watched skills are invoked, review each
run from the live transcript while the session is still open, and aggregate
reviews into concrete SKILL.md improvements. Reviewing is automated;
**applying edits is always human-gated**.

This plugin is a mod (a plugin of function hooks): `hooks/hooks.json` names
one TypeScript module, `hooks/register.tsx`, whose hooks run inside Claude
Code. There are no shell scripts and no second process. It needs Claude Code
2.1.287 or later.

## Pipeline

```txt
watched skill invoked (user typed /skill, or the agent called the Skill tool)
  → skill.prompt hook records a pending run in $.state (session memory)
  → the review waits for the person's reaction, then runs:
      • when the NEXT main-loop turn completes (their feedback is in the
        transcript), or
      • after 2 minutes of idle, or
      • on demand: the band's [Review now] button, or /review-now
  → $.model.fork asks the session's own model one tool-less question over
    the live transcript (prompt-cache served) with scripts/reviewer-prompt.md
  → a reply led by "# Skill Review:" lands in <data_dir>/reviews/<skill>/ and
    ledger.json increments reviews_since_patch; a reply without the heading
    is parked as *.failed.md with no ledger bump
  → /agent-improvement:review-run (in-session, can ask the user what they
    expected) writes the same artifact and calls the review_recorded tool,
    which bumps the ledger and drops the pending automated review
  → at session start, a skill with 3+ reviews since its last patch is shown
    in the band above the prompt and noted to the model
  → /agent-improvement:improve-skill aggregates reviews into SKILL.md edits
    (user-approved; targets the marketplace working copy so git is the
    diff/rollback), then resets the skill's ledger entry
```

## Skills

| Skill           | Purpose                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `review-run`    | In-session review of a skill run; can ask the user what they expected  |
| `improve-skill` | Synthesize accumulated reviews for one skill into SKILL.md edits       |

## Hooks (`hooks/register.tsx`)

| Event            | Matcher                                      | Purpose                                                                   |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `session.start`  |                                              | Register the `review_recorded` tool and `/review-now`; read the ledger nudge |
| `tool.call`      | `Skill`                                      | Mark the skill.prompt it raises as agent-invoked                          |
| `skill.prompt`   |                                              | Record a watched skill's run as pending                                   |
| `turn.start`     |                                              | Claim runs recorded between turns for the turn that starts                |
| `turn.complete`  |                                              | Review runs from earlier turns; arm the idle timer for this turn's        |
| `tool.call`      |                                              | Count failures after a watched run; nudge `review-run` at the third       |
| `tool.call`      | `mcp__agent-improvement__review_recorded`    | review-run's hand-off: bump the ledger, drop the pending review           |
| `command.run`    | `review-now`                                 | Review everything pending now                                             |
| `session.end`    |                                              | Cancel the idle timer                                                     |
| `ui.render`      | `AbovePrompt`                                | The band: a bordered box; pending or running review with [Review now], and the improve-skill nudge |

State lives in `$.state` under the contract in `types/index.d.ts`
(`pending`, `seen`, `failures`, `nudge`, `isNudgeDismissed`, `isNudgeNoted`, `isReviewing`),
so a hot reload keeps it; module variables (the idle timer, the current turn
id) start over on reload.

## Data files (under `<data_dir>`)

- `reviews/<sanitized-skill>/*.md`: one review per skill per review pass
  (`<date>-<session8>.md`, `-2`, `-3` when the same skill is reviewed again in
  one session) or `*-insession-*.md` (review-run). Structured: narrative
  sections plus a machine-readable `suggestions:` yaml block with `type`
  (wording|structure|coverage), `scope` (class|instance), evidence, and
  proposed change.
- `ledger.json`: per-skill review/patch bookkeeping: `reviews_since_patch`,
  `last_reviewed_at`, `patch_count`, `last_patched_at`,
  `usage_count_at_patch`. Writers are all low-frequency (the mod, review-run
  via the tool, improve-skill); updates are best-effort read-modify-write.

Skill **usage counts are NOT tracked here**: Claude Code tracks them natively
in `~/.claude.json` under `.skillUsage` (`usageCount`, `lastUsedAt`, keyed by
skill name as invoked). `improve-skill` reads those directly, and
`usage_count_at_patch` snapshots the native count when a patch lands so
uses-since-patch is computable.

## Plugin Configuration

Set via `/plugins` → agent-improvement → Configure Options:

- `watched_skills`: comma-separated skill names as `skill.prompt` names them
  (e.g. `knowledge-vault:search, dev-utils:brainstorming`); `*` watches all
  but this plugin's own skills. Empty disables recording entirely.
  `jq '.skillUsage' ~/.claude.json` shows which skills are heavily used.
- `data_dir`: review and ledger storage; defaults to `~/.claude/agent-improvement`.

Thresholds are constants at the top of `hooks/register.tsx`: review after
2 minutes idle, nudge at 3 pending reviews, friction nudge at the 3rd tool
failure, 2 review attempts before giving up on a run.

## Development

```shell
claude plugin validate plugins/agent-improvement   # what it hooks and calls
claude plugin test plugins/agent-improvement       # hooks/register.test.ts
claude --plugin-dir plugins/agent-improvement      # run it from the folder
```

Once loaded from a folder, the engine lays this build's API types beside the
mod in `.claude-plugin/types/` (gitignored), so an editor and `tsc -p` type it.
The validator holds `$` to top-level functions and `atom` references to
literal `plugin`/`key` strings; keep that shape when adding hooks.

## Caveats

- The review runs on the session's current model with the session's system
  prompt, over the cached transcript prefix: the cost is the review's output
  plus whatever of the prefix the cache no longer holds (`/model` or a long
  idle lapses it). Watch skills selectively.
- A run with no later turn and less than 2 minutes of idle before the session
  ends is never reviewed: `session.end` has a 1.5 s budget shared by every
  plugin, too short for a model call. Press [Review now] or run `/review-now`
  before leaving if it matters.
- `$.model.fork` denies every tool, and the rubric says so; a reviewer that
  answers without the `# Skill Review:` heading is parked as `*.failed.md`.
- `skill.prompt` also fires when a skill is preloaded into a subagent; such a
  run is recorded like any other.
- Suggestion rules in the review prompts (no tool-negativity, no
  transient-failure rules, no env-specific generalization, class-level gate)
  are load-bearing: they are the guard against lessons that degrade skills
  over time. Keep them in sync across `scripts/reviewer-prompt.md`,
  `review-run`, and `improve-skill`.
- The plugin test kit of 2.1.290 serves no `session.append` beneath the
  plugins, so the model-facing notes (the improve-skill nudge, the friction
  nudge) are best-effort in the mod and asserted through their toasts and the
  band in tests.
