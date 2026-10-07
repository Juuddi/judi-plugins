You are now acting as a skill-run reviewer for this Claude Code session. The
conversation above IS the session under review: every prompt, tool call,
result and reply is already in your context, so there is nothing to read,
fetch or run. Do not call any tool. Answer with the review document alone.

The task block after these instructions names the skill, the session id, the
review date, and the recorded invocations of the skill (who invoked it, and
when). Review how the agent performed each time the skill's instructions were
in play, from the invocation through every later turn, including feedback the
person gave much later.

Write a markdown review with exactly these sections, substituting the values
from the task block:

# Skill Review: <skill>

- **Session**: <session id>
- **Date**: <date>

## What happened
Brief narrative of the skill run(s): what was asked, what the agent did.

## Process adherence
Did the agent follow the skill's instructions? Note steps skipped, reordered,
or misread.

## Friction and failures
Tool errors, retries, dead ends, permission denials, missing prerequisites.
An oversized tool result that the skill could have avoided (a query that
could have projected less data) counts as friction.

## User feedback
Corrections, clarifications, or approval from the person in the turns after
each invocation, including feedback that arrived many turns later. Quote them.

## Improvement suggestions
Concrete changes to the skill's SKILL.md that would have prevented the issues
above. Quote the relevant instruction text where possible. End the section
with a fenced block, one entry per suggestion, exactly in this shape:

~~~yaml
suggestions:
  - summary: <one sentence>
    type: <wording | structure | coverage>
    scope: <class | instance>
    evidence: <what happened, cited from the conversation>
    proposed_change: <the concrete edit, quoting current instruction text>
~~~

type: wording = the agent misread an instruction; structure = it skipped or
misordered one (an emphasis/ordering problem); coverage = the situation was
never addressed by the skill at all.
scope: class = the change helps every future run of this skill; instance = it
would merely re-run this session correctly.

Rules for suggestions. These prevent lessons that degrade the skill:
- Never propose negative claims about tools ("X is broken"). They harden
  into refusals that outlive the problem. Record what TO do instead.
- Never derive rules from transient failures (network errors, rate limits,
  one-off API hiccups).
- Never promote environment- or repo-specific details into universal
  instructions.
- Prefer strengthening an existing instruction over adding a new special case.
- Do not artificially generalize an instance-level lesson; mark it
  scope: instance and let aggregation across sessions decide.

Be specific and evidence-based: cite what actually happened in the
conversation. If the run went cleanly, say so briefly with an empty
suggestions list rather than inventing issues. Your entire reply is written
verbatim to a review file, so respond with the markdown document only. The
first line must be the "# Skill Review:" heading, with no preamble before it
and nothing after the yaml block.
