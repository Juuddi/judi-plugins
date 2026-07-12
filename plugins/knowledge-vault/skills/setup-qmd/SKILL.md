---
name: setup-qmd
description: "Set up local qmd maintenance for the knowledge vault on a new machine. Step 1: schedule the recurring qmd index-cleanup job. Step 2: scope the qmd collection to content files."
argument-hint: ""
disable-model-invocation: true
---

# Setup qmd Maintenance

One-time (per machine) setup for the local qmd search index behind the knowledge vault. Each
step configures one piece of local maintenance. Run the steps that apply; they're idempotent,
so re-running is safe.

This is separate from `/knowledge-vault:setup-vault` (which scaffolds the vault directory
tree) — this skill maintains the qmd index that sits on top of it.

## Step 1 — Schedule recurring `qmd cleanup`

**Why:** `qmd cleanup` removes orphaned vectors and VACUUMs the index database — a full-DB
rewrite under a global write lock. Far too expensive to run on every note write (the
`PostToolUse` indexer hook stays `update && embed` only), but it must run *sometime* or
orphaned vectors accumulate indefinitely. The fix is a scheduled job, off the hot path.

**One job per machine:** `qmd cleanup` operates on the machine's global qmd index — every
collection, not just this vault. Before creating anything, check whether a qmd-cleanup job
already exists (e.g. registered by another vault plugin such as hive-mind:
`launchctl list | grep -i qmd`, `crontab -l | grep -i qmd`, `schtasks /query | findstr qmd`).
If one exists, report it to the user and skip this step — a second job would be pure
duplication.

**What to schedule:** the single command `qmd cleanup`, on a recurring timer — **weekly** is
plenty (orphans accrue slowly), at a **low-traffic hour** (~4am) so the VACUUM's write lock
never stalls an active search or a shared daemon.

**How:** you know what OS you're on — use its native scheduler. No wrapper script is needed; the
job is just `qmd cleanup`.

- **macOS** → a launchd LaunchAgent in `~/Library/LaunchAgents/`, loaded with `launchctl`.
- **Ubuntu / Linux** → a `cron` entry (`crontab -e`) or a systemd user timer.
- **Windows** → a Scheduled Task (`schtasks`).

**Mind the scheduler's environment:** scheduled jobs run with a minimal `PATH` and none of your
shell's setup, so a bare `qmd` — or the runtime its shebang points at (e.g. `node`) — often won't
resolve. The job then registers fine but never actually runs. Resolve `qmd`'s absolute path and
give the job whatever environment it needs to find both `qmd` and its interpreter.

**Make it idempotent:** give the job a stable, recognizable label (e.g.
`com.judi.qmd-cleanup`, or a named crontab comment). Before creating it, check whether it
already exists and update in place rather than adding a duplicate.

**Verify — run it once, don't just list it:** a job whose command doesn't resolve still registers
and lists cleanly, then silently fails on its first real fire (which could be days or weeks away).
So trigger a one-off run now, confirm it exits successfully and that cleanup actually ran (check
the job's exit status and any log output), *then* confirm it's registered on the schedule with the
scheduler's list command (`launchctl list | grep qmd`, `crontab -l`, `schtasks /query`). Report
both to the user.

## Step 2 — Scope the qmd collection to content files

**Why:** the vault's structural files (`STRUCTURE.md`, `TAGS.md`, `FRONTMATTER.md`,
`CLAUDE.md`) and `templates/` are consumed by explicit path-reads in the skills and are
already post-filtered out of search results — indexing them only burns embedding cycles and
adds rerank noise. Excluding them at index time is cleaner.

**How:** add an `ignore:` list to the `${user_config.vault_collection}` collection in
`~/.config/qmd/index.yml`:

```yaml
collections:
  ${user_config.vault_collection}:
    path: <vault path — leave as-is>
    pattern: "**/*.md"
    ignore:
      - "templates/**"     # directory → needs /**
      - "README.md"        # bare name → ROOT-anchored (a nested README.md stays indexed)
      - "CLAUDE.md"
      - "STRUCTURE.md"
      - "TAGS.md"
      - "FRONTMATTER.md"
```

Only add entries for files that actually exist at the vault root — check first. Pattern
semantics (fast-glob):

- A bare filename is **root-anchored** — `README.md` drops only the collection-root file,
  never a nested `sub/README.md`. Directories need the `templates/**` form.
- Dotdirs (`.claude/`, `.obsidian/`) are **already excluded** by qmd's file scan — don't
  list them.
- Keep `glossary/` and hub notes indexed — they're searchable content, not structure.

**Apply and verify:** run `qmd update` — it deactivates the now-ignored docs (their orphaned
vectors clear on the next `qmd cleanup` from Step 1). Then confirm with `qmd status` that the
collection's document count dropped by the expected number, and report the delta to the user.
