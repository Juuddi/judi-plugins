import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { NudgeEntry, PendingRun } from '../types'

// A watched skill's run is reviewed by a tool-less fork of the live
// transcript ($.model.fork): the session's own context, served from the
// prompt cache, so no transcript file is read and no second process runs.
// The review waits for the person's reaction: it runs when the turn after
// the one the skill ran in completes, or after REVIEW_IDLE_MS of quiet.

const PLUGIN = 'agent-improvement'
const REVIEW_IDLE_MS = 2 * 60_000
const FAILURE_THRESHOLD = 3
const NUDGE_THRESHOLD = 3
const MAX_REVIEW_ATTEMPTS = 2
const REVIEW_HEADING = /^# Skill Review:/
const REVIEW_COMMAND = 'review-now'
const IMPROVE_COMMAND = `/${PLUGIN}:improve-skill`

const pending = atom({ plugin: 'agent-improvement', key: 'pending' } as const, [] as PendingRun[])
const seen = atom({ plugin: 'agent-improvement', key: 'seen' } as const, [] as string[])
const failures = atom({ plugin: 'agent-improvement', key: 'failures' } as const, 0)
const nudge = atom({ plugin: 'agent-improvement', key: 'nudge' } as const, [] as NudgeEntry[])
const isNudgeDismissed = atom({ plugin: 'agent-improvement', key: 'isNudgeDismissed' } as const, false)
const isNudgeNoted = atom({ plugin: 'agent-improvement', key: 'isNudgeNoted' } as const, false)

type Engine = EngineInterface
type LedgerEntry = {
  reviews_since_patch?: number
  last_reviewed_at?: string
  patch_count?: number
  last_patched_at?: string
  usage_count_at_patch?: number
}
type Ledger = Record<string, LedgerEntry>

const text = (value: unknown) => (typeof value === 'string' ? value : '')

const parseWatched = (options: PluginOptions) =>
  text(options.watched_skills)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)

const isWatched = (watched: string[], skill: string) =>
  !skill.startsWith(`${PLUGIN}:`) && (watched.includes('*') || watched.includes(skill))

/** `knowledge-vault:search` -> `knowledge-vault-search`, the review folder's name. */
const sanitize = (skill: string) => skill.replace(/[:/]/g, '-')

const unique = (list: readonly string[]) => [...new Set(list)]

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

async function dataDir($: Engine, options: PluginOptions) {
  const home = (await $.env.get('HOME')) ?? ''
  const raw = text(options.data_dir).trim()
  if (raw === '') return `${home}/.claude/agent-improvement`

  return raw.startsWith('~') ? home + raw.slice(1) : raw
}

async function readLedger($: Engine, dir: string): Promise<Ledger> {
  const path = `${dir}/ledger.json`
  if (!(await $.fs.exists(path))) return {}
  try {
    const parsed: unknown = JSON.parse(await $.fs.read(path))

    return parsed !== null && typeof parsed === 'object' ? (parsed as Ledger) : {}
  } catch {
    return {}
  }
}

/** Counts one review toward the skill's pending pile; improve-skill resets it. */
async function ledgerBump($: Engine, dir: string, skill: string) {
  const ledger = await readLedger($, dir)
  const entry = ledger[skill] ?? {}
  entry.reviews_since_patch = (entry.reviews_since_patch ?? 0) + 1
  entry.last_reviewed_at = new Date(await $.clock.now()).toISOString()
  ledger[skill] = entry
  await $.fs.write(`${dir}/ledger.json`, JSON.stringify(ledger, null, 2) + '\n')

  return entry.reviews_since_patch
}

async function unusedPath($: Engine, dir: string, stem: string, suffix: string) {
  let path = `${dir}/${stem}${suffix}`
  for (let n = 2; await $.fs.exists(path); n += 1) {
    path = `${dir}/${stem}-${n}${suffix}`
  }

  return path
}

const taskBlock = (skill: string, sessionId: string, date: string, runs: PendingRun[]) =>
  [
    `Review how well the skill "${skill}" performed in this conversation, per the instructions above.`,
    '',
    `- Skill: ${skill}`,
    `- Session: ${sessionId}`,
    `- Date: ${date}`,
    '',
    'Recorded invocations of this skill during the session (source is who invoked it):',
    ...runs.map(run => `- ${run.ts} by ${run.source}`),
  ].join('\n')

// Module-level because the validator holds `$` to functions declared at the
// top of the file; a reload starts the module over, so nothing here outlives
// one load, while the atoms above do.
let options: PluginOptions = {}
let currentTurnId: string | null = null
let idle: { cancel: () => void } | null = null
let isReviewing = false

/**
 * Reviews every pending run (except those of `excludeTurn`, the turn that
 * just ended: its feedback is still to come) with one fork per skill.
 */
async function runReviews($: Engine, excludeTurn: string | null) {
  if (isReviewing) return
  isReviewing = true
  try {
    const runs = (await read($, pending)).filter(run => run.turnId !== excludeTurn)
    if (runs.length === 0) return

    const dir = await dataDir($, options)
    const sessionId = await $.session.id()
    const date = isoDate(await $.clock.now())
    const rubric = await $.fs.read(`${$.plugin.root}/scripts/reviewer-prompt.md`)

    for (const skill of unique(runs.map(run => run.skill))) {
      const mine = runs.filter(run => run.skill === skill)
      $.ui.status(`reviewing the ${skill} run`)
      const reply = await $.model.fork({
        prompt: `${rubric.trim()}\n\n---\n\n${taskBlock(skill, sessionId, date, mine)}`,
      })
      const outDir = `${dir}/reviews/${sanitize(skill)}`
      const stem = `${date}-${sessionId.slice(0, 8)}`

      if (reply.isAnswered && REVIEW_HEADING.test(reply.text.trimStart())) {
        const path = await unusedPath($, outDir, stem, '.md')
        await $.fs.write(path, reply.text.trim() + '\n')
        const count = await ledgerBump($, dir, skill)
        $.ui.toast(`${PLUGIN}: reviewed ${skill} (${count} since last patch)`)
        $.ui.log(`${PLUGIN}: review of ${skill} written to ${path}`, { to: 'debug' })
      } else if (reply.isAnswered) {
        const path = await unusedPath($, outDir, stem, '.failed.md')
        await $.fs.write(path, reply.text)
        $.ui.log(`${PLUGIN}: the ${skill} review had no "# Skill Review:" heading, parked at ${path}`)
      } else {
        $.ui.log(`${PLUGIN}: review of ${skill} not run: ${reply.reason}`, { to: 'debug' })
        const retrying = mine.every(run => run.attempts + 1 < MAX_REVIEW_ATTEMPTS)
        await update($, pending, list =>
          list.map(run =>
            run.skill === skill && run.turnId !== excludeTurn
              ? { ...run, attempts: run.attempts + 1 }
              : run,
          ),
        )
        if (retrying) continue
        $.ui.toast(`${PLUGIN}: gave up reviewing ${skill} (${reply.reason})`)
      }
      await update($, pending, list =>
        list.filter(run => run.skill !== skill || run.turnId === excludeTurn),
      )
    }
    $.ui.status(undefined)
  } finally {
    isReviewing = false
  }
}

/** Reviews after a quiet spell, unless a turn is running (its end reviews instead). */
function armIdleTimer($: Engine) {
  idle?.cancel()
  idle = $.clock.after(REVIEW_IDLE_MS, () => {
    idle = null
    if (currentTurnId === null) void runReviews($, null)
  })
}

export const register: Register = (on, loaded) => {
  options = loaded
  const watched = parseWatched(options)
  const agentInvoking = new Set<string>()

  const agentInvoked = (skill: string) =>
    agentInvoking.has(skill) ||
    [...agentInvoking].some(name => skill.endsWith(`:${name}`) || name.endsWith(`:${skill}`))

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'review_recorded',
      description:
        'Record that a skill-run review was written in-session (by the review-run skill): ' +
        'bumps the ledger and drops the pending automated review of that skill.',
      inputSchema: {
        type: 'object',
        properties: { skill: { type: 'string', description: 'The skill as invoked, e.g. knowledge-vault:search' } },
        required: ['skill'],
      },
    })
    await $.command.register({
      name: REVIEW_COMMAND,
      description: 'Review the pending watched-skill runs of this session now',
    })

    let waiting: NudgeEntry[] = []
    try {
      const ledger = await readLedger($, await dataDir($, options))
      waiting = Object.entries(ledger)
        .map(([skill, entry]) => ({ skill, reviews: entry.reviews_since_patch ?? 0 }))
        .filter(entry => entry.reviews >= NUDGE_THRESHOLD)
    } catch (error) {
      $.ui.log(`${PLUGIN}: could not read the ledger at start: ${String(error)}`, { to: 'debug' })
    }
    await update($, nudge, () => waiting)

    // The band shows the person; this row tells the model, once per session.
    if (waiting.length > 0 && !(await read($, isNudgeNoted))) {
      const list = waiting.map(entry => `${entry.skill} (${entry.reviews} reviews)`).join(', ')
      try {
        await $.session.append({
          message: {
            type: 'user',
            content: [
              {
                type: 'text',
                text: `${PLUGIN}: accumulated skill-run reviews are waiting: ${list}. At a natural break, consider suggesting ${IMPROVE_COMMAND} to the user.`,
              },
            ],
          },
        })
        await update($, isNudgeNoted, () => true)
      } catch (error) {
        $.ui.log(`${PLUGIN}: could not note the pending reviews for the model: ${String(error)}`, { to: 'debug' })
      }
    }

    return next(e)
  })

  // Detection. The Skill tool's call brackets the skill.prompt it raises, so
  // a prompt expanded inside it was the agent's doing; any other is the person's.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    agentInvoking.add(e.skill)
    try {
      return await next(e)
    } finally {
      agentInvoking.delete(e.skill)
    }
  }).catch(($, e, next) => next(e))

  on('skill.prompt', async ($, e, next) => {
    if (watched.length > 0 && isWatched(watched, e.skill)) {
      const run: PendingRun = {
        skill: e.skill,
        source: agentInvoked(e.skill) ? 'agent' : 'user',
        turnId: currentTurnId,
        ts: new Date(await $.clock.now()).toISOString(),
        attempts: 0,
      }
      await update($, pending, list => [...list, run])
      await update($, seen, list => unique([...list, e.skill]))
      armIdleTimer($)
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    currentTurnId = e.turnId
    // A `/skill` typed at the prompt expands before its turn starts: that run
    // belongs to this turn.
    if ((await read($, pending)).some(run => run.turnId === null)) {
      await update($, pending, list =>
        list.map(run => (run.turnId === null ? { ...run, turnId: e.turnId } : run)),
      )
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    currentTurnId = null
    const runs = await read($, pending)
    if (runs.some(run => run.turnId !== e.turnId)) {
      idle?.cancel()
      idle = null
      // Its own dispatch, so the turn's end is not held for the fork.
      $.clock.after(0, () => void runReviews($, e.turnId))
    }
    if (runs.some(run => run.turnId === e.turnId)) armIdleTimer($)

    return next(e)
  })

  // Friction: the third tool failure after a watched skill ran offers review-run.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      if (ran.isError === true && e.agentId === undefined && (await read($, seen)).length > 0) {
        await update($, failures, n => n + 1)
        if ((await read($, failures)) === FAILURE_THRESHOLD) {
          const skills = (await read($, seen)).join(', ')
          $.ui.toast(`${PLUGIN}: ${FAILURE_THRESHOLD} tool failures since ${skills} ran; /${PLUGIN}:review-run captures it while fresh`)
          await $.session.append({
            message: {
              type: 'user',
              content: [
                {
                  type: 'text',
                  text: `${PLUGIN}: ${FAILURE_THRESHOLD} tool failures have occurred in this session after a watched skill ran (${skills}). If the friction relates to how the skill guided the work, consider offering the user /${PLUGIN}:review-run to capture it while it's fresh.`,
                },
              ],
            },
          })
        }
      }
    } catch (error) {
      $.ui.log(`${PLUGIN}: friction counter failed: ${String(error)}`, { to: 'debug' })
    }

    return ran
  }).catch(($, e, next) => next(e))

  // review-run's hand-off: the in-session review replaces the automated one.
  on('tool.call', { tool: 'mcp__agent-improvement__review_recorded' }, async ($, e) => {
    const skill = text(e.skill).trim()
    if (skill === '') return { deny: `${PLUGIN}: review_recorded needs a skill name.` }
    const dir = await dataDir($, options)
    const count = await ledgerBump($, dir, skill)
    const wasPending = (await read($, pending)).some(run => run.skill === skill)
    await update($, pending, list => list.filter(run => run.skill !== skill))

    return {
      result: {
        skill,
        reviews_since_patch: count,
        dropped_pending_review: wasPending,
        ledger: `${dir}/ledger.json`,
      },
    }
  }).catch(() => ({ deny: `${PLUGIN}: review_recorded failed; see the debug log.` }))

  on('command.run', { command: REVIEW_COMMAND }, async $ => {
    const runs = await read($, pending)
    if (runs.length === 0) return { text: `${PLUGIN}: no watched-skill runs are waiting for review.` }
    idle?.cancel()
    idle = null
    const skills = unique(runs.map(run => run.skill))
    await runReviews($, null)
    const left = unique((await read($, pending)).map(run => run.skill))
    const done = skills.filter(skill => !left.includes(skill))

    return {
      text:
        (done.length > 0 ? `${PLUGIN}: reviewed ${done.join(', ')}.` : `${PLUGIN}: no review was written.`) +
        (left.length > 0 ? ` Still pending: ${left.join(', ')}.` : ''),
    }
  })

  on('session.end', ($, e, next) => {
    idle?.cancel()
    idle = null

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const runs = await read($, pending)
    const waiting = await read($, nudge)
    const isDismissed = await read($, isNudgeDismissed)
    const showsNudge = waiting.length > 0 && !isDismissed
    if (e.props.hasSurvey || (runs.length === 0 && !showsNudge)) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const skills = unique(runs.map(run => run.skill)).join(', ')
    const nudged = waiting.map(entry => `${entry.skill} (${entry.reviews})`).join(', ')

    return (
      <Box flexDirection="column">
        {runs.length > 0 && (
          <Box>
            <Text dimColor>
              {PLUGIN}: review pending for {skills}, after your next turn or 2 min idle{' '}
            </Text>
            <Button
              key="review-now"
              label={isReviewing ? 'Reviewing' : 'Review now'}
              onPress={() => void runReviews($, null)}
            />
          </Box>
        )}
        {showsNudge && (
          <Box>
            <Text dimColor>
              {PLUGIN}: reviews waiting for {nudged}, run {IMPROVE_COMMAND}{' '}
            </Text>
            <Button key="dismiss-nudge" label="Dismiss" onPress={() => update($, isNudgeDismissed, () => true)} />
          </Box>
        )}
      </Box>
    )
  })
}
