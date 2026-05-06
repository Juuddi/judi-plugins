---
name: merge-main
description: Pull a branch or PR locally, merge latest main into it, resolve any conflicts, and push if clean. Use when user says "merge main into <branch/PR>", "update PR #X with main", "sync this branch with main", or "bring this PR up to date".
argument-hint: "<branch-name | PR-number>"
allowed-tools: Read, Edit, Grep, Bash(git *), Bash(gh *)
---

# Merge Main

Pull a branch or PR locally, merge the latest default branch into it, resolve any conflicts, and push if the result is clean.

**Announce at start:** "I'm using the merge-main skill to merge main into <target>."

## Procedure

### Step 1: Assess

Run in parallel:
- `git status --porcelain` — working tree state
- `git symbolic-ref --short refs/remotes/origin/HEAD` — detect the default branch (e.g., `origin/main`)
- `git rev-parse --abbrev-ref HEAD` — current branch
- `git fetch origin --prune` — refresh remote refs

From the output:
- Determine the main branch name by stripping the `origin/` prefix (could be `main`, `master`, `develop`, etc.). Use this everywhere below in place of `<main>`.
- Classify the user's argument: digits-only or `#NNN` → PR number; else → branch name.
- If the working tree is dirty: ask the user to stash, commit, or abort. Do not proceed silently.

### Step 2: Check out the target

For a **PR** (`#123` or `123`):
```bash
gh pr checkout <num>
```

For a **branch name**:
- If already on it: no-op.
- If a local branch exists: `git checkout <name> && git pull --ff-only`.
- Otherwise: `git checkout <name>` (creates a tracking branch from `origin/<name>`).

If neither path succeeds, stop and report the cause (branch/PR doesn't exist, auth issue, etc.).

### Step 3: Merge main into the target

```bash
git merge origin/<main> --no-edit
```

Outcomes:
- **Already up to date** → skip to Step 6 (no push needed).
- **Clean merge** (fast-forward or merge commit) → skip to Step 5.
- **Conflicts** → go to Step 4.

### Step 4: Resolve conflicts

You drive this end-to-end. Ask the user only when you genuinely lack context. Never hand a half-merged state back to the user.

#### 4a. Categorize the conflicts

```bash
git status --porcelain
```

Group the conflicted files (`UU`, `AA`, `DU`, `UD`, etc.):
- **Mechanical** — lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `Gemfile.lock`, `poetry.lock`, `go.sum`, `uv.lock`), generated code (`*.pb.go`, schema dumps), snapshot test outputs.
- **Logic** — application/source code where both sides changed semantics.

#### 4b. Resolve mechanical conflicts

- **Lockfiles**: take the branch's manifest (`package.json`, `Cargo.toml`, etc.) as the source of truth and regenerate with the project's install command (`npm install`, `pnpm install`, `cargo update`, `bundle install`, `poetry lock --no-update`, `uv lock`, etc.).
- **Generated code**: regenerate via the project's codegen command if it's obvious from `Makefile` / `package.json` scripts / `CONTRIBUTING.md`. Otherwise take the side matching the source of truth.
- **Snapshots**: regenerate via the project's test runner with the update flag (`npm test -- -u`, `pytest --snapshot-update`, etc.).

If the regen command isn't obvious after a quick look, ask the user — but only that one targeted question, then continue.

#### 4c. Resolve logic conflicts

Work file-by-file, simplest first. For each:

1. Read the file. Read the conflict markers.
2. Read enough surrounding context to understand both intents:
   - `git log -p origin/<main> -- <file>` — main's recent changes
   - `git log -p HEAD -- <file>` — the branch's recent changes
3. Decide:
   - **Confident** (additive merges, non-overlapping concerns, obvious precedence) → resolve, `git add <file>`, continue.
   - **Uncertain** → ask the user a *targeted* question. Show: the conflict hunk, what each side was trying to do, and your proposed resolution. Apply their answer and continue.
4. Batch questions when possible — collect questions across multiple hunks and ask in one round, then resume resolving.

#### 4d. Finalize the merge

After all conflicts are resolved:

```bash
git status                  # confirm no remaining U?/?U entries
git diff --check            # confirm no stray conflict markers
git commit --no-edit        # complete the merge commit
```

If the project has an obvious fast sanity check (`npm test`, `pytest -x`, `cargo check`), run it. If it fails because of the merge, treat the failure as another conflict and loop back to 4c.

### Step 5: Push

After a successful merge (clean or conflict-resolved), push:

```bash
git push
```

If the branch has no upstream yet:

```bash
git push -u origin HEAD
```

**Never force-push.** If `git push` is rejected as non-fast-forward, stop and report — do not retry with `--force` or `--force-with-lease`.

### Step 6: Report

One short summary:
- Commits merged: `"<N> commits from <main> into <branch>"`
- Conflicts: `"no conflicts"`, or `"<N> resolved (<M> mechanical, <K> with your input)"`
- Push outcome: `"pushed to origin/<branch>"`, `"already up to date — no push needed"`, or the rejection reason if it failed

## Notes

- **Never force-push.** Plain `git push` only.
- **Never abandon the merge.** When uncertain, ask a targeted question and continue. The user shouldn't have to finish the merge themselves.
- **Auto-detect the main branch every time** — don't assume `main`.
- `git merge --abort` is available if the user explicitly asks to back out. Don't run it on your own.
