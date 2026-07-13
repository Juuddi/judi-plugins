# agent-improvement

Skill observability pipeline: record when watched skills are invoked, review
each run (automatically at session end, or in-session while friction is
fresh), and aggregate reviews into concrete SKILL.md improvements. Reviewing
is automated; **applying edits is always human-gated**.

## Pipeline

```txt
skill invoked (user or agent)
  → detection hooks append {skill, source, prompt_id, ts}
    to <data_dir>/state/<session_id>.jsonl
  → reviews happen via either path (same output format):
      • SessionEnd hook detaches a worker that runs headless `claude -p`
        per watched skill (automated)
      • /agent-improvement:review-run in-session (user-triggered; nudged by
        the PostToolUseFailure hook when failures pile up after a skill ran)
  → review notes land in <data_dir>/reviews/<skill>/, and ledger.json
    increments reviews_since_patch for the skill
  → SessionStart hook nudges when a skill has 3+ unprocessed reviews
  → /agent-improvement:improve-skill aggregates reviews into SKILL.md edits
    (user-approved; targets the marketplace working copy so git is the
    diff/rollback), then resets the skill's ledger entry
```

## Skills

| Skill           | Purpose                                                              |
| --------------- | -------------------------------------------------------------------- |
| `review-run`    | In-session review of a skill run — can ask the user what they expected |
| `improve-skill` | Synthesize accumulated reviews for one skill into SKILL.md edits      |

## Hooks

| Event                 | Matcher           | Script                       | Purpose                                                       |
| --------------------- | ----------------- | ---------------------------- | ------------------------------------------------------------- |
| `UserPromptExpansion` | —                 | `record-skill-invocation.sh` | Record user-typed `/skill` invocations (filtered in script)   |
| `PostToolUse`         | `Skill`           | `record-skill-invocation.sh` | Record agent-initiated Skill tool invocations                 |
| `PostToolUseFailure`  | —                 | `friction-nudge.sh`          | At 3 failures after a watched skill ran, suggest `review-run` |
| `SessionStart`        | `startup\|clear`  | `session-start-nudge.sh`     | Nudge `improve-skill` when a skill has 3+ pending reviews     |
| `SessionEnd`          | —                 | `analyze-session.sh`         | Detach a worker that reviews each watched skill run           |

## Data files (under `<data_dir>`)

- `state/<session_id>.jsonl` — invocation markers for one session; consumed
  and deleted by the SessionEnd analyzer (plus a `.failures` counter used by
  the friction nudge).
- `reviews/<sanitized-skill>/*.md` — one review per skill per session
  (analyzer) or `*-insession-*.md` (review-run). Structured: narrative
  sections plus a machine-readable `suggestions:` yaml block with
  `type` (wording|structure|coverage), `scope` (class|instance), evidence,
  and proposed change.
- `ledger.json` — per-skill review/patch bookkeeping the harness can't track:
  `reviews_since_patch`, `last_reviewed_at`, `patch_count`, `last_patched_at`,
  `usage_count_at_patch`. Writers are all low-frequency (analyzer, review-run,
  improve-skill); updates are best-effort read-modify-write.

Skill **usage counts are NOT tracked here** — Claude Code already tracks them
natively in `~/.claude.json` under `.skillUsage` (`usageCount`, `lastUsedAt`,
keyed by skill name as invoked). `improve-skill` reads those directly, and
`usage_count_at_patch` snapshots the native count when a patch lands so
uses-since-patch is computable.

## Plugin Configuration

Set via `/plugins` → agent-improvement → Configure Options:

- `watched_skills` — comma-separated skill names as they appear at invocation
  (e.g. `knowledge-vault:search, dev-utils:brainstorming`); `*` watches all.
  Empty disables recording entirely. `jq '.skillUsage' ~/.claude.json` shows
  which skills are heavily used and worth watching.
- `data_dir` — state and review storage; defaults to `~/.claude/agent-improvement`.

Nudge thresholds (3 pending reviews; 3rd tool failure) are deliberately
hardcoded in the scripts.

## Payload schema discovery

Hook details that are undocumented upstream and must be pinned empirically:

1. `UserPromptExpansion`'s field carrying the command name — the recorder
   tries `.command_name // .command // .skill_name`.
2. Whether `PostToolUse` fires with matcher `Skill` for agent skill
   invocations, and the shape of `.tool_input` — the recorder tries
   `.tool_input.skill // .tool_input.command`.
3. Whether `PostToolUseFailure` accepts `additionalContext` in
   `hookSpecificOutput` — if not, the friction nudge is silently inert.

Any matched detection event whose payload yields no skill name is dumped to
`<data_dir>/unmatched-payloads.log`. To capture *every* payload the detection
hooks receive, set `AGENT_IMPROVEMENT_DEBUG=1` or `touch <data_dir>/debug`.
Update the jq extraction paths in `record-skill-invocation.sh` once the real
fields are known, and remove the fallbacks.

## Caveats

- The transcript JSONL format is internal to Claude Code and changes between
  versions — that's why the analyzer is an LLM reading the file, not a parser.
- Claude Code kills SessionEnd hooks (whole process tree) ~1.5s after exit
  begins, and plugin hooks.json timeouts are not counted toward that budget —
  so the hook detaches the analyzer worker (double-fork + nohup) and returns
  immediately. A completed review shows up as the review file plus a ledger
  increment; worker errors append to `analyzer-errors.log`. There is no
  success signal back to the hook.
- Each watched skill run costs a headless Claude session (`--model sonnet` —
  a review replays most of the session's context with no cache-reuse
  guarantee, and several reviews can queue up per exit), sequential per
  skill. Watch skills selectively; `review-run` reviews done in-session are
  removed from the analyzer's queue.
- The analyzer runs with `--setting-sources ""` (plugin enablement lives in
  user settings, so no settings means no plugin hooks) plus an
  `AGENT_IMPROVEMENT_ANALYZER` env guard so it can never recursively trigger
  this plugin's own hooks. Not `--bare`: that skips keychain reads, which
  breaks claude.ai OAuth auth.
- Suggestion rules in the review prompts (no tool-negativity, no
  transient-failure rules, no env-specific generalization, class-level gate)
  are load-bearing: they are the guard against lessons that degrade skills
  over time. Keep them in sync across `analyze-session.sh`, `review-run`, and
  `improve-skill`.
- Sessions that never end cleanly (crash, machine sleep) never reach the
  analyzer; their state files accumulate until a later session of the same id
  ends, or forever. Stale files under `state/` are harmless but can be
  deleted freely.

## External dependencies

- `jq` — used by all hook scripts
- `claude` CLI on `$PATH` — the SessionEnd analyzer silently skips if missing
