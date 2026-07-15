---
name: review-run
description: "Review a skill run from the current session while it's fresh, capturing in-context observations and direct user feedback into a review note. Use when the user says a skill run went wrong, asks to review how a skill performed just now, or when the user accepts your offer to review a watched skill's run after noticeable friction. Never self-invoke for unwatched skills or because the user mentioned the automated session-end reviewer."
argument-hint: "<skill-name>"
disable-model-invocation: false
---

# Review Run

Write a review of a skill run from the **current session**, using the
conversation already in context. This is the in-session counterpart to the
automated SessionEnd analyzer — cheaper (nothing to re-read) and able to do
the one thing the analyzer can't: ask the user directly what they expected.

Reviews land in the same place and format as the analyzer's, so
`improve-skill` aggregates both without caring which path produced them.

## Invocation bounds

Watched skills: `${user_config.watched_skills}` (comma-separated; `*` = all).

Who triggered this invocation determines what may be reviewed:

- **User-invoked** (slash command, or the user asked for a review in their
  own words): review whatever skill they name — an explicit request is not
  gated by the watch list.
- **Self-invoked**: only for a skill on the watched list, and only on a
  genuine trigger — the user described a problem with the run, the user
  accepted your offer to review it, or a friction nudge fired. Friction you
  noticed on your own is grounds for an *offer*, never a run.

The user saying the automated/session-end reviewer will handle it is NOT a
trigger — it is a decision to defer, so do not run. But check the watch
list before agreeing: if the skill is not on it, the analyzer will never
see it (only watched skills are recorded at invocation). Say so, and let
the user choose: review in-session now, add the skill to watched_skills,
or drop it.

## Prerequisites

The data directory: `${user_config.data_dir}` if configured, otherwise
`~/.claude/agent-improvement`.

## Steps

### 1. Identify the skill and its run(s)

`$ARGUMENTS` names the skill (e.g. `knowledge-vault:search`). If empty, infer
which skill's run the user means from the conversation; if more than one skill
ran recently, ask which one.

### 2. Ask the user for the missing signal

Before writing, ask 1-2 targeted questions the transcript can't answer — e.g.
"What did you expect the run to produce?" or "Which part of the output was
wrong?" Skip this if the user already stated the problem explicitly.

### 3. Write the review

Write to `<data_dir>/reviews/<sanitized-skill>/YYYY-MM-DD-insession-HHMM.md`
(sanitize `:` and `/` in the skill name to `-`; HHMM is the current time —
this filename shape never collides with the analyzer's `<date>-<session>.md`).
Create the directory if needed. Use exactly this structure:

```markdown
# Skill Review: <skill>

- **Session**: in-session review
- **Date**: YYYY-MM-DD

## What happened
## Process adherence
## Friction and failures
## User feedback
## Improvement suggestions
```

End "Improvement suggestions" with a fenced yaml block, one entry per
suggestion:

~~~yaml
suggestions:
  - summary: <one sentence>
    type: <wording | structure | coverage>
    scope: <class | instance>
    evidence: <what happened in this session>
    proposed_change: <the concrete edit, quoting current instruction text>
~~~

`type`: wording = instruction misread; structure = instruction skipped or
misordered; coverage = situation the skill never addresses. `scope`: class =
helps every future run; instance = only re-runs this session correctly.

Suggestion rules (these prevent lessons that degrade the skill):

- Never propose negative claims about tools ("X is broken") — record what TO
  do instead.
- Never derive rules from transient failures (network errors, rate limits).
- Never promote environment- or repo-specific details into universal
  instructions.
- Prefer strengthening an existing instruction over adding a new special case.
- Don't artificially generalize an instance-level lesson — mark it
  `scope: instance` and let aggregation across sessions decide.

Ground every claim in what actually happened this session, including the
user's answers from step 2 (quote them in "User feedback").

### 4. Update the ledger

```bash
DATA_DIR=<resolved data dir>
[ -s "$DATA_DIR/ledger.json" ] || echo '{}' > "$DATA_DIR/ledger.json"
jq --arg s "<skill>" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '.[$s] = ((.[$s] // {})
    | .reviews_since_patch = ((.reviews_since_patch // 0) + 1)
    | .last_reviewed_at = $ts)' \
  "$DATA_DIR/ledger.json" > "$DATA_DIR/ledger.json.tmp" \
  && mv "$DATA_DIR/ledger.json.tmp" "$DATA_DIR/ledger.json"
```

### 5. Prevent a duplicate SessionEnd review

The SessionEnd analyzer would otherwise review this same skill again from the
transcript. Remove this skill's marker lines from the current session's state
file: find the most recently modified `.jsonl` in `<data_dir>/state/`, confirm
its `ts` values line up with this conversation, then rewrite it without this
skill's lines (delete the file if that leaves it empty). If another Claude
session is running concurrently the newest file may be theirs — when the
timestamps don't match this conversation, leave everything alone and accept
the duplicate review instead.
