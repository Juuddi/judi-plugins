---
name: improve-skill
description: "Aggregate accumulated skill-run reviews into concrete SKILL.md improvements. Use when the user asks to improve a skill, asks how a skill has been performing, or when several reviews have accumulated for a watched skill."
argument-hint: "<skill-name>"
disable-model-invocation: false
---

# Improve Skill

Synthesize the review notes that the agent-improvement pipeline has accumulated
for one skill, and turn recurring problems into concrete SKILL.md edits.

Reviews arrive from two paths — the automated SessionEnd analyzer and the
in-session `review-run` skill — in the same format. This skill is the second
pass: it reads across many reviews to find patterns a single-session review
can't see. Edits are always user-approved before applying.

## Prerequisites

- The data directory: `${user_config.data_dir}` if configured, otherwise
  `~/.claude/agent-improvement`.
- At least one review under `<data_dir>/reviews/<skill>/`. Review directories
  use sanitized names (`:` and `/` become `-`, e.g. `knowledge-vault:search` →
  `knowledge-vault-search`).

If there are no reviews for the requested skill, stop and tell the user: the
skill must be listed in the plugin's `watched_skills` config, and reviews only
appear after a session using that skill ends (or after `review-run`).

## Argument Parsing

`$ARGUMENTS` is the skill to improve (e.g. `knowledge-vault:search`). If empty,
list the subdirectories of `<data_dir>/reviews/` with their review counts and
ask the user which skill to work on.

## Steps

### 1. Read the reviews and the skill's track record

Read every `.md` file in `<data_dir>/reviews/<sanitized-skill>/` (skip any
`archive/` subdirectory). Then pull context:

```bash
jq --arg s "<skill>" '.[$s] // {}' <data_dir>/ledger.json
jq --arg s "<skill>" '.skillUsage[$s] // {}' ~/.claude.json
```

The ledger holds `reviews_since_patch`, `patch_count`, `last_patched_at`, and
`usage_count_at_patch`; `~/.claude.json` holds Claude Code's native
`usageCount`/`lastUsedAt` for the skill. Together they answer: how heavily is
this skill used, and — if it was patched before — how have the runs looked
since (`usageCount - usage_count_at_patch` uses, N reviews, how many clean)?
Clean reviews since the last patch are the signal that the patch worked;
recurring issues since it mean the last edit missed.

### 2. Synthesize recurring themes

Each review ends with a `suggestions:` yaml block whose entries carry
`type` (wording | structure | coverage), `scope` (class | instance),
`evidence`, and `proposed_change`. Aggregate across all reviews:

- Group suggestions by root cause, and weight by **recurrence** — the same
  cause appearing in 2+ reviews drives the proposal. One-offs matter only if
  severe (data loss, dead-end failure).
- Count clean runs (empty suggestion lists) — they calibrate urgency.
- **Drop anti-lessons**, even recurring ones: negative claims about tools
  ("X is broken" hardens into a refusal that outlives the problem), rules
  derived from transient failures, and environment-specific details promoted
  to universal instructions.
- **Apply the class-level gate**: for each candidate edit ask "does this help
  every future run of this skill, or does it merely re-run one session
  correctly?" Discard `scope: instance` entries unless the same instance
  keeps recurring — recurrence is what promotes an instance to a class.
- Let `type` shape the fix: `wording` → rewrite the instruction; `structure` →
  reorder, split, or add emphasis (the instruction was fine but got skipped);
  `coverage` → add a missing instruction. Prefer strengthening existing text
  over adding new special cases — a skill that accumulates special cases for
  every incident is degrading, not improving.

### 3. Locate the skill's SKILL.md source

Use the marketplace working copy (e.g. this repo's
`plugins/<plugin>/skills/<skill>/SKILL.md`) — never the installed cache under
`~/.claude/`. The working copy is version-controlled, so git provides the
diff, history, and rollback for every patch this skill applies. Search the
user's code directories if the location isn't obvious; ask if it can't be
found.

### 4. Propose concrete edits

For each surviving theme, propose a specific edit — quoted current text,
proposed replacement, and the review evidence (which sessions hit the
problem, how often). Consult the `building-skills` skill for skill-authoring
patterns (progressive disclosure, frontmatter triggers, step structure)
before rewriting instructions.

Present the proposal as a single message with three parts, in order:

1. **Inventory** — every suggestion from every review, one line each
   (review date/id, one-sentence summary, type/scope). Include the items
   you are dropping — the user is approving the synthesis, and they can't
   judge it without seeing what was left out.
2. **Dispositions** — which proposed edit each inventory item feeds, or why
   it was dropped (anti-lesson, instance-scoped, unrepeated one-off).
3. **Edits** — for each edit: the quoted current text, the proposed
   replacement, and which inventory items back it.

End your turn on that message so it lands as a durable response the user can
read and scroll back to. Do NOT bundle the proposal with an AskUserQuestion
call in the same turn: text emitted ahead of a same-turn tool call is not
guaranteed to persist — it can stream as ephemeral narration that never
reaches the transcript, leaving the user at a question dialog with the
proposal nowhere on screen (verified twice from transcripts, 2026-07-14).
Once the proposal is on screen as a completed message, collect approval
either from an ordinary reply ("apply 1 and 3", "all of them") or with an
AskUserQuestion in the follow-up turn — each option self-contained either way.

### 5. Apply approved edits and update the ledger

Apply only the edits the user approves. Then record the patch:

```bash
DATA_DIR=<resolved data dir>
usage_now=$(jq -r --arg s "<skill>" '.skillUsage[$s].usageCount // 0' ~/.claude.json)
[ -s "$DATA_DIR/ledger.json" ] || echo '{}' > "$DATA_DIR/ledger.json"
jq --arg s "<skill>" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson u "$usage_now" \
  '.[$s] = ((.[$s] // {})
    | .reviews_since_patch = 0
    | .patch_count = ((.patch_count // 0) + 1)
    | .last_patched_at = $ts
    | .usage_count_at_patch = $u)' \
  "$DATA_DIR/ledger.json" > "$DATA_DIR/ledger.json.tmp" \
  && mv "$DATA_DIR/ledger.json.tmp" "$DATA_DIR/ledger.json"
```

Afterward, remind the user to reinstall the plugin and `/reload-plugins` for
the change to take effect.

### 6. Archive processed reviews

Offer to move the reviews that informed the change into
`<data_dir>/reviews/<sanitized-skill>/archive/`, so the next improvement pass
starts fresh and step 1's track record measures whether the edits worked.
