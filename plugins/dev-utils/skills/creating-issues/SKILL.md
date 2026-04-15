---
name: creating-issues
description: Research codebase context and create GitHub issues from a user-provided list.
argument-hint: "<numbered list of issues with context bullets>"
allowed-tools: Read, Grep, Glob, Bash(gh *), Agent
---

# Creating Issues

Take a user-provided list of issues (each with context bullets), research the codebase for relevant files and patterns, draft concise GitHub issues, and — after user confirmation — push them to the remote via `gh`.

**Announce at start:** "I'm using the creating-issues skill to draft and file these GitHub issues."

## Expected Input

The user provides a numbered list. Each item has a title/summary and bullet points with context:

```
1. Flaky retry logic in the webhook dispatcher
   - retries happen but don't respect the backoff config
   - only affects the Stripe webhook path
2. Add pagination to the admin users table
   - currently loads all rows
   - mirror the pattern from the orders table
```

If input is missing or ambiguous, ask the user to provide or clarify before proceeding.

## Procedure

### Step 1: Verify the repo

Run in parallel:
- `gh repo view --json nameWithOwner,url` — confirm remote + auth
- `gh label list --json name,description --limit 100` — fetch available labels
- `gh issue list --json labels --state all --limit 1 -R $(gh repo view --json nameWithOwner -q .nameWithOwner) 2>/dev/null` — probe whether issue types are in use (optional; skip on error)

If `gh repo view` fails, stop and tell the user (not authed, wrong directory, or no remote).

### Step 2: Research each issue in parallel

For each issue in the user's list, dispatch the `research` agent (from dev-utils) **in parallel** — they are independent, read-only, and won't conflict.

Each dispatch prompt must include:
- The issue title and all user-provided bullets as context
- The specific question: "Find the files, functions, and patterns relevant to this issue. Report key files with `path:line` refs, relevant existing patterns, and anything that would help someone fix this."
- Explicit instruction to report back concisely (Summary / Key Files / Findings / Open Questions)

Do **not** have the research agent write anything or draft the issue — its job is context only.

### Step 3: Draft each issue

Using the research report + user context, write each issue body. Keep them concise and pointed:

```markdown
## Context
[1-3 sentences — what's happening and why it matters. Pull from user's bullets.]

## Relevant code
- `path/to/file.ts:42` — [one-line description]
- `path/to/other.ts:101-130` — [one-line description]

## Suggested approach
[2-4 bullets or short paragraph. Only if the research + context make it clear. Otherwise omit.]

## Acceptance criteria
- [ ] [Observable outcome 1]
- [ ] [Observable outcome 2]
```

**Label/type selection:**
- Match each issue against the labels fetched in Step 1
- Only apply a label if it *clearly* fits (e.g., `bug`, `enhancement`, `documentation`)
- Do not force labels — no label is better than a wrong one
- Skip assignees and milestones

### Step 4: Present for confirmation

Show the user a summarized table/list of all drafted issues before pushing. Format:

```
Ready to create N issues in <owner/repo>:

1. <title>
   Labels: bug, webhooks
   Body: <first 1-2 lines of body…>

2. <title>
   Labels: (none)
   Body: <first 1-2 lines…>

Reply 'go' to create all, 'edit N' to revise one, or 'cancel' to abort.
```

Offer the full body of any issue on request. Do **not** push until the user explicitly approves.

### Step 5: Create the issues

After approval, for each issue run:

```bash
gh issue create \
  --title "<title>" \
  --body-file <tmpfile> \
  --label "<label1>,<label2>"   # omit flag if no labels
```

Use a temp file for the body (avoids shell-escaping pain with multi-line markdown). Capture the returned URL.

If any `gh issue create` fails, stop and report which succeeded and which failed — do not retry silently.

### Step 6: Report

Print the created issues as a list with URLs:

```
Created:
- #123 <title> — <url>
- #124 <title> — <url>
```

## Notes

- The `research` agent lives in the dev-utils plugin (`subagent_type: "research"`). It's read-only.
- Parallel research dispatches: send all research Agent calls in a single message with multiple tool-use blocks.
- Never push to the remote without the confirmation step in Step 4 — even if the user's original prompt said "just do it."
