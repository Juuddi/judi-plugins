import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, ModelUsage, PluginOptions, Register } from 'claude-code'

import type { CacheWarmth, NudgeEntry, PendingRun, ReviewUsage } from '../types'

// A watched skill's run is reviewed by a tool-less fork of the live
// transcript ($.model.fork): the session's own context, served from the
// prompt cache, so no transcript file is read and no second process runs.
// The review waits for the person's reaction: it runs when the turn after
// the one the skill ran in completes, or after REVIEW_IDLE_MS of quiet.
//
// The fork is cheap only while that cache is warm. A cold fork re-sends the
// whole conversation at full price, so no fork is made unless a main-thread
// request ended within CACHE_WARM_MS on the same model; a cold review waits
// for the next turn instead. Every pending skill shares one fork.

const PLUGIN = 'agent-improvement'
const REVIEW_IDLE_MS = 2 * 60_000
/** Under the API's 5-minute cache floor, with a margin for the fork's own latency. */
const CACHE_WARM_MS = 4 * 60_000
const FAILURE_THRESHOLD = 3
const NUDGE_THRESHOLD = 3
const MAX_REVIEW_ATTEMPTS = 2
const REVIEW_HEADING = /^# Skill Review:/
const SECTION_HEADING = /^# Skill Review:[ \t]*(.+?)[ \t]*$/gm
const REVIEW_COMMAND = 'review-now'
const IMPROVE_COMMAND = `/${PLUGIN}:improve-skill`

const pending = atom({ plugin: 'agent-improvement', key: 'pending' } as const, [] as PendingRun[])
const seen = atom({ plugin: 'agent-improvement', key: 'seen' } as const, [] as string[])
const failures = atom({ plugin: 'agent-improvement', key: 'failures' } as const, 0)
const nudge = atom({ plugin: 'agent-improvement', key: 'nudge' } as const, [] as NudgeEntry[])
const isNudgeDismissed = atom({ plugin: 'agent-improvement', key: 'isNudgeDismissed' } as const, false)
const isNudgeNoted = atom({ plugin: 'agent-improvement', key: 'isNudgeNoted' } as const, false)
const isReviewing = atom({ plugin: 'agent-improvement', key: 'isReviewing' } as const, false)
const cache = atom({ plugin: 'agent-improvement', key: 'cache' } as const, { at: null, model: null } as CacheWarmth)
const isCacheCold = atom({ plugin: 'agent-improvement', key: 'isCacheCold' } as const, false)

type Engine = EngineInterface
type LedgerEntry = {
  reviews_since_patch?: number
  last_reviewed_at?: string
  last_review_usage?: ReviewUsage
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

async function sessionModel($: Engine): Promise<string | null> {
  try {
    return await $.session.model()
  } catch {
    return null
  }
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
async function ledgerBump($: Engine, dir: string, skill: string, usage?: ReviewUsage) {
  const ledger = await readLedger($, dir)
  const entry = ledger[skill] ?? {}
  entry.reviews_since_patch = (entry.reviews_since_patch ?? 0) + 1
  entry.last_reviewed_at = new Date(await $.clock.now()).toISOString()
  if (usage !== undefined) entry.last_review_usage = usage
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

const taskBlock = (skills: string[], sessionId: string, date: string, runs: PendingRun[]) =>
  [
    skills.length === 1
      ? `Review how well the skill "${skills[0]}" performed in this conversation, per the instructions above.`
      : `Review how well each of these ${skills.length} skills performed in this conversation, per the instructions above: one review document per skill, in this order.`,
    '',
    `- Session: ${sessionId}`,
    `- Date: ${date}`,
    '',
    ...skills.flatMap(skill => [
      `## ${skill}`,
      'Recorded invocations (source is who invoked it):',
      ...runs.filter(run => run.skill === skill).map(run => `- ${run.ts} by ${run.source}`),
      '',
    ]),
  ].join('\n')

/** The reply cut at its headings: each skill's document, keyed by the skill the heading names. */
function splitReviews(reply: string) {
  const sections = new Map<string, string>()
  const marks = [...reply.matchAll(SECTION_HEADING)]
  marks.forEach((mark, i) => {
    const start = mark.index ?? 0
    const end = marks[i + 1]?.index ?? reply.length
    const skill = (mark[1] ?? '').replace(/^[`'"]|[`'"]$/g, '').trim()
    if (skill !== '' && !sections.has(skill)) sections.set(skill, reply.slice(start, end).trim())
  })

  return sections
}

const toUsage = (usage: ModelUsage, model: string | null, skills: number): ReviewUsage => ({
  model,
  skills_in_fork: skills,
  cache_read_input_tokens: usage.cache_read_input_tokens,
  input_tokens: usage.input_tokens,
  cache_creation_input_tokens: usage.cache_creation_input_tokens,
  output_tokens: usage.output_tokens,
})

const usageFooter = (u: ReviewUsage) =>
  `<!-- ${PLUGIN} reviewer usage: model ${u.model ?? 'unknown'}; one fork for ${u.skills_in_fork} skill${u.skills_in_fork === 1 ? '' : 's'}; ` +
  `cache_read ${u.cache_read_input_tokens}, input ${u.input_tokens}, cache_write ${u.cache_creation_input_tokens}, output ${u.output_tokens} tokens -->`

// Module-level because the validator holds `$` to functions declared at the
// top of the file; a reload starts the module over, so nothing here outlives
// one load, while the atoms above do.
let options: PluginOptions = {}
let currentTurnId: string | null = null
let idle: { cancel: () => void } | null = null
let cold: { cancel: () => void } | null = null
let isBusy = false

/** A main-thread request just ended on `model`: the prefix is in the cache now. */
async function markWarm($: Engine, model: string | null) {
  try {
    const at = await $.clock.now()
    await update($, cache, () => ({ at, model: model ?? null }))
    await update($, isCacheCold, () => false)
  } catch (error) {
    $.ui.log(`${PLUGIN}: could not record the cache warmth: ${String(error)}`, { to: 'debug' })
  }
}

/** True only while a fork would be served from the main thread's cache. */
async function isWarm($: Engine) {
  const warmth = await read($, cache)
  if (warmth.at === null) return false
  if ((await $.clock.now()) - warmth.at > CACHE_WARM_MS) return false
  const model = await sessionModel($)

  return warmth.model === null || model === null || warmth.model === model
}

/** Flips the band to its cold state when the warm window closes on pending runs. */
async function armColdTimer($: Engine) {
  cold?.cancel()
  cold = null
  if ((await read($, pending)).length === 0) return
  const warmth = await read($, cache)
  const left = warmth.at === null ? 0 : CACHE_WARM_MS - ((await $.clock.now()) - warmth.at)
  if (left <= 0) {
    await update($, isCacheCold, () => true)

    return
  }
  cold = $.clock.after(left, () => {
    cold = null
    void update($, isCacheCold, () => true)
  })
}

type ReviewOutcome = 'reviewed' | 'nothing' | 'cold' | 'failed'

/**
 * Reviews every pending run (except those of `excludeTurn`, the turn that
 * just ended: its feedback is still to come) with one fork for all skills.
 * Refuses, leaving the runs pending, while the prompt cache is cold.
 */
async function runReviews($: Engine, excludeTurn: string | null, manual = false): Promise<ReviewOutcome> {
  if (isBusy) return 'nothing'
  isBusy = true
  try {
    const runs = (await read($, pending)).filter(run => run.turnId !== excludeTurn)
    if (runs.length === 0) return 'nothing'
    const skills = unique(runs.map(run => run.skill))

    if (!(await isWarm($))) {
      await update($, isCacheCold, () => true)
      $.ui.log(`${PLUGIN}: prompt cache cold, the ${skills.join(', ')} review waits for the next turn`, { to: 'debug' })
      if (manual) $.ui.toast(`${PLUGIN}: the prompt cache is cold; the ${skills.join(', ')} review waits for your next turn`)

      return 'cold'
    }

    await update($, isReviewing, () => true)
    const dir = await dataDir($, options)
    const sessionId = await $.session.id()
    const date = isoDate(await $.clock.now())
    const rubric = await $.fs.read(`${$.plugin.root}/scripts/reviewer-prompt.md`)
    const stem = `${date}-${sessionId.slice(0, 8)}`
    const label = skills.length === 1 ? skills[0] : `${skills.length} skills`

    $.ui.status(`reviewing ${label}`)
    const reply = await $.model.fork({
      prompt: `${rubric.trim()}\n\n---\n\n${taskBlock(skills, sessionId, date, runs)}`,
    })
    $.ui.status(undefined)

    const isMine = (run: PendingRun) => run.turnId !== excludeTurn && skills.includes(run.skill)
    const dropAll = async () => update($, pending, list => list.filter(run => !isMine(run)))

    if (!reply.isAnswered) {
      $.ui.log(`${PLUGIN}: review of ${label} not run: ${reply.reason}`, { to: 'debug' })
      const retrying = runs.every(run => run.attempts + 1 < MAX_REVIEW_ATTEMPTS)
      if (retrying) {
        await update($, pending, list => list.map(run => (isMine(run) ? { ...run, attempts: run.attempts + 1 } : run)))

        return 'failed'
      }
      await dropAll()
      $.ui.toast(`${PLUGIN}: gave up reviewing ${label} (${reply.reason})`)

      return 'failed'
    }

    const sections = splitReviews(reply.text)
    if (!REVIEW_HEADING.test(reply.text.trimStart()) || sections.size === 0) {
      const path = await unusedPath($, `${dir}/reviews/${sanitize(skills[0] ?? '')}`, stem, '.failed.md')
      await $.fs.write(path, reply.text)
      $.ui.log(`${PLUGIN}: the ${label} review had no "# Skill Review:" heading, parked at ${path}`)
      await dropAll()

      return 'failed'
    }

    const usage = toUsage(reply.usage, await sessionModel($), skills.length)
    const written: string[] = []
    const missing: string[] = []
    for (const skill of skills) {
      const body = sections.get(skill)
      if (body === undefined) {
        missing.push(skill)
        continue
      }
      const path = await unusedPath($, `${dir}/reviews/${sanitize(skill)}`, stem, '.md')
      await $.fs.write(path, `${body}\n\n${usageFooter(usage)}\n`)
      const count = await ledgerBump($, dir, skill, usage)
      written.push(`${skill} (${count} since last patch)`)
      $.ui.log(`${PLUGIN}: review of ${skill} written to ${path}`, { to: 'debug' })
    }
    $.ui.log(
      `${PLUGIN}: fork usage for ${label}: cache_read ${usage.cache_read_input_tokens}, input ${usage.input_tokens}, cache_write ${usage.cache_creation_input_tokens}, output ${usage.output_tokens}`,
      { to: 'debug' },
    )
    if (written.length > 0) $.ui.toast(`${PLUGIN}: reviewed ${written.join(', ')}`)

    // A skill the reply skipped is tried once more; the rest are done.
    await update($, pending, list =>
      list.flatMap(run => {
        if (!isMine(run)) return [run]
        if (!missing.includes(run.skill)) return []
        if (run.attempts + 1 < MAX_REVIEW_ATTEMPTS) return [{ ...run, attempts: run.attempts + 1 }]

        return []
      }),
    )
    for (const skill of missing) {
      $.ui.log(`${PLUGIN}: the fork wrote no "# Skill Review: ${skill}" document`, { to: 'debug' })
      if (runs.filter(run => run.skill === skill).every(run => run.attempts + 1 >= MAX_REVIEW_ATTEMPTS)) {
        $.ui.toast(`${PLUGIN}: gave up reviewing ${skill} (no document in the reply)`)
      }
    }

    return written.length > 0 ? 'reviewed' : 'failed'
  } finally {
    isBusy = false
    await update($, isReviewing, () => false)
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
      await armColdTimer($)
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

  // Each main-thread request refreshes the cache entry the fork would read.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (e.agentId === undefined) await markWarm($, e.model)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    currentTurnId = null
    // The turn's last request has just been answered on the session's model.
    await markWarm($, await sessionModel($))
    const runs = await read($, pending)
    if (runs.some(run => run.turnId !== e.turnId)) {
      idle?.cancel()
      idle = null
      // Its own dispatch, so the turn's end is not held for the fork.
      $.clock.after(0, () => void runReviews($, e.turnId))
    }
    if (runs.some(run => run.turnId === e.turnId)) armIdleTimer($)
    await armColdTimer($)

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
    const outcome = await runReviews($, null, true)
    if (outcome === 'cold') {
      return {
        text: `${PLUGIN}: the prompt cache is cold, so a review now would re-send the whole conversation at full price. ${skills.join(', ')} stays pending and is reviewed after your next turn.`,
      }
    }
    const left = unique((await read($, pending)).map(run => run.skill))
    const done = skills.filter(skill => !left.includes(skill))

    return {
      text:
        (done.length > 0 ? `${PLUGIN}: reviewed ${done.join(', ')}.` : `${PLUGIN}: no review was written.`) +
        (left.length > 0 ? ` Still pending: ${left.join(', ')}.` : ''),
    }
  }).catch(() => ({ text: `${PLUGIN}: the review failed; see the debug log.` }))

  on('session.end', ($, e, next) => {
    idle?.cancel()
    idle = null
    cold?.cancel()
    cold = null

    return next(e)
  })

  // The band: one rounded box in the theme's colors, a status row and an
  // action row per concern, sized to the band's own columns.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const runs = await read($, pending)
    const waiting = await read($, nudge)
    const isDismissed = await read($, isNudgeDismissed)
    const busy = await read($, isReviewing)
    const isCold = await read($, isCacheCold)
    const showsReview = runs.length > 0 || busy
    const showsNudge = waiting.length > 0 && !isDismissed
    if (e.props.hasSurvey || (!showsReview && !showsNudge)) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const skills = unique(runs.map(run => run.skill)).join(', ')
    const count = runs.length === 1 ? '1 run' : `${runs.length} runs`
    const nudged = waiting.map(entry => `${entry.skill} (${entry.reviews})`).join(', ')
    const canReview = showsReview && !busy && !isCold
    const accent: Color = busy ? 'claude' : isCold ? 'inactive' : showsReview ? 'suggestion' : 'warning'
    const heading = busy ? '◆ Reviewing' : isCold ? '◆ Review waiting' : '◆ Review pending'
    const detail = busy
      ? `${PLUGIN} is forking the conversation; the note lands under reviews/`
      : isCold
        ? `prompt cache is cold, so ${PLUGIN} reviews it after your next turn (a cold fork would re-send the whole conversation)`
        : `${PLUGIN} reviews it after your next turn or 2 min idle, or now:`

    return (
      <Box
        flexDirection="column"
        width={e.props.bodyColumns}
        borderStyle="round"
        borderColor={accent}
        paddingX={1}
      >
        {showsReview && (
          <Box flexDirection="column">
            <Text wrap="truncate-end">
              <Text bold color={accent}>
                {heading}
              </Text>
              <Text dimColor>
                {' · '}
                {skills}
                {busy ? '' : ` (${count})`}
              </Text>
            </Text>
            <Box gap={1}>
              <Text dimColor wrap="truncate-end">
                {detail}
              </Text>
              {canReview && (
                <Button key="review-now" variant="primary" hotkey="r" onPress={() => void runReviews($, null, true)}>
                  Review now
                </Button>
              )}
            </Box>
          </Box>
        )}
        {showsNudge && (
          <Box flexDirection="column" marginTop={showsReview ? 1 : 0}>
            <Text wrap="truncate-end">
              <Text bold color="warning">
                ▲ Reviews waiting
              </Text>
              <Text dimColor>
                {' · '}
                {nudged}
              </Text>
            </Text>
            <Box gap={1}>
              <Text dimColor wrap="truncate-end">
                Enough reviews to patch the skill: run {IMPROVE_COMMAND}
              </Text>
              <Button
                key="dismiss-nudge"
                role="dismiss"
                dimColor
                hotkey="d"
                onPress={() => update($, isNudgeDismissed, () => true)}
              >
                Dismiss
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    )
  })
}
