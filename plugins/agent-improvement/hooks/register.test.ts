import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const SKILL = 'knowledge-vault:search'
const OPTIONS = { watched_skills: `${SKILL}, dev-utils:brainstorming`, data_dir: '/data' }
const REVIEW = `# Skill Review: ${SKILL}\n\n- **Session**: s\n\n## What happened\nClean run.\n`
const USAGE = { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 }
const START = { cwd: '/work', surface: 'terminal', isInteractive: true } as const
const BAND = {
  plugin: 'agent-improvement',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll: { offset: 0, bodyRows: 5 }, view: {} },
} as const

/** The host beneath the plugin: files, clock, a fork that answers REVIEW. */
function world(on: On, forkReplies: string[] = [REVIEW]) {
  const files = new Map<string, string>()
  const forks: string[] = []
  const notes: string[] = []
  const toasts: string[] = []
  const logs: string[] = []
  const model = { current: 'claude-test-1' }
  mock.env(on, { HOME: '/home/t' })
  mock.store(on)
  const clock = mock.clock(on, { now: Date.parse('2026-10-05T12:00:00Z') })
  // The engine's own events, answered as core would beneath the plugins.
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('fs.exists', ($, e) => ({ value: files.has(e.path) }))
  on('fs.read', ($, e) => {
    if (e.path.endsWith('/scripts/reviewer-prompt.md')) return { value: 'RUBRIC' }
    const text = files.get(e.path)
    if (text === undefined) throw new Error(`no such file: ${e.path}`)

    return { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)

    return { value: undefined }
  })
  on('model.fork', ($, e) => {
    forks.push(e.prompt)
    const text = forkReplies[Math.min(forks.length, forkReplies.length) - 1] ?? REVIEW

    return { value: { isAnswered: true as const, text, usage: USAGE } }
  })
  on('session.id', () => ({ value: 'abcdef12-3456-7890-abcd-ef1234567890' }))
  on('session.model', () => ({ value: model.current }))
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  on('tool.register', ($, e) => ({ value: { tool: `mcp__agent-improvement__${e.name}` } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.append', ($, e) => {
    for (const block of e.message.content as unknown[]) {
      if (block !== null && typeof block === 'object' && 'text' in block) notes.push(String(block.text))
    }

    return { message: e.message, uuid: `row-${notes.length}` }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', ($, e) => {
    logs.push(e.text)

    return { value: undefined }
  })

  return { files, forks, notes, toasts, logs, clock, model }
}

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const turn = (turnId: string) => ({ answer: 'ok', durationMs: 5, isAborted: false, turnId, reason: 'answer' as const })

test('a typed /skill is reviewed once the next turn completes, not before', { options: OPTIONS }, async ($, on) => {
  const { files, forks, clock } = world(on)
  await $.session.start(START)

  // Typed at the prompt: the expansion precedes its own turn.
  await $.skill.prompt({ skill: SKILL, text: 'search the vault' })
  await $.turn.start({ text: `/${SKILL} qmd`, turnId: 't1' })
  await $.turn.complete(turn('t1'))
  await clock.settle()
  expect(forks.length).toBe(0)

  await $.turn.start({ text: 'that was the wrong note', turnId: 't2' })
  await $.turn.complete(turn('t2'))
  await clock.settle()

  expect(forks.length).toBe(1)
  expect(forks[0]).toContain('RUBRIC')
  expect(forks[0]).toContain(`Review how well the skill "${SKILL}"`)
  expect(forks[0]).toContain('by user')
  const written = files.get('/data/reviews/knowledge-vault-search/2026-10-05-abcdef12.md') ?? ''
  expect(written.startsWith(REVIEW.trim())).toBe(true)
  expect(written).toContain('reviewer usage: model claude-test-1; one fork for 1 skill; cache_read 1000, input 10, cache_write 0, output 20 tokens')
  const ledger = JSON.parse(files.get('/data/ledger.json') ?? '{}')
  expect(ledger[SKILL].reviews_since_patch).toBe(1)

  // Reviewed once: a later turn forks nothing more.
  await $.turn.start({ text: 'thanks', turnId: 't3' })
  await $.turn.complete(turn('t3'))
  await clock.settle()
  expect(forks.length).toBe(1)
})

test('an agent-invoked skill run is reviewed after two quiet minutes', { options: OPTIONS }, async ($, on) => {
  const { files, forks, clock } = world(on)
  on('tool.call', { tool: 'Skill' }, async () => {
    // The test's own `$` raises the expansion, as the Skill tool does.
    await $.skill.prompt({ skill: SKILL, text: 'search the vault' })

    return { result: { success: true } }
  })
  await $.session.start(START)
  await $.turn.start({ text: 'find my notes on qmd', turnId: 't1' })
  await $.tool.call({ tool: 'Skill', skill: SKILL })
  await $.turn.complete(turn('t1'))

  await clock.advance(60_000)
  expect(forks.length).toBe(0)
  await clock.advance(60_000)
  expect(forks.length).toBe(1)
  expect(forks[0]).toContain('by agent')
  expect(files.has('/data/reviews/knowledge-vault-search/2026-10-05-abcdef12.md')).toBe(true)
})

test('an unwatched skill is never recorded', { options: OPTIONS }, async ($, on) => {
  const { forks, clock } = world(on)
  await $.session.start(START)
  await $.skill.prompt({ skill: 'hive-mind:search', text: 'x' })
  await $.turn.start({ text: '/hive-mind:search', turnId: 't1' })
  await $.turn.complete(turn('t1'))
  await $.turn.start({ text: 'again', turnId: 't2' })
  await $.turn.complete(turn('t2'))
  await clock.advance(5 * 60_000)
  expect(forks.length).toBe(0)
})

test('review_recorded drops the pending review and bumps the ledger', { options: OPTIONS }, async ($, on) => {
  const { files, forks, clock } = world(on)
  await $.session.start(START)
  await $.skill.prompt({ skill: SKILL, text: 'search' })
  await $.turn.start({ text: `/${SKILL}`, turnId: 't1' })
  await $.turn.complete(turn('t1'))

  const answered = await $.tool.call({ tool: 'mcp__agent-improvement__review_recorded', skill: SKILL })
  expect(answered.deny).toBeUndefined()
  expect(answered.result).toEqual({
    skill: SKILL,
    reviews_since_patch: 1,
    dropped_pending_review: true,
    ledger: '/data/ledger.json',
  })
  expect(JSON.parse(files.get('/data/ledger.json') ?? '{}')[SKILL].reviews_since_patch).toBe(1)

  await $.turn.start({ text: 'next', turnId: 't2' })
  await $.turn.complete(turn('t2'))
  await clock.advance(5 * 60_000)
  expect(forks.length).toBe(0)
})

test('a reply without the review heading is parked as .failed.md with no ledger bump', { options: OPTIONS }, async ($, on) => {
  const { files, clock } = world(on, ['Sorry, I cannot review that.'])
  await $.session.start(START)
  await $.skill.prompt({ skill: SKILL, text: 'search' })
  await $.turn.start({ text: `/${SKILL}`, turnId: 't1' })
  await $.turn.complete(turn('t1'))
  await $.turn.start({ text: 'ok', turnId: 't2' })
  await $.turn.complete(turn('t2'))
  await clock.settle()

  expect(files.get('/data/reviews/knowledge-vault-search/2026-10-05-abcdef12.failed.md')).toBe('Sorry, I cannot review that.')
  expect(files.has('/data/ledger.json')).toBe(false)
})

test('the third tool failure after a watched run raises the friction nudge once', { options: OPTIONS }, async ($, on) => {
  // The kit of this build serves no `session.append` beneath the plugins, so
  // the model-facing note cannot be asserted here; the toast that precedes it can.
  const { toasts } = world(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: 'boom', interrupted: false }, isError: true }))
  await $.session.start(START)
  const nudges = () => toasts.filter(t => t.includes('3 tool failures')).length

  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(nudges()).toBe(0) // no watched skill yet

  await $.skill.prompt({ skill: SKILL, text: 'search' })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(nudges()).toBe(0)
  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(nudges()).toBe(1)
  expect(toasts.find(t => t.includes('3 tool failures'))).toContain('/agent-improvement:review-run')
  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(nudges()).toBe(1)
})

test('a ledger with 3+ reviews since the last patch nudges improve-skill at start', { options: OPTIONS }, async ($, on) => {
  const { files } = world(on)
  files.set('/data/ledger.json', JSON.stringify({ [SKILL]: { reviews_since_patch: 3 }, other: { reviews_since_patch: 1 } }))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const line = await ui.find({ type: 'Text', text: /Reviews waiting/ })
  expect(line?.text).toContain(`${SKILL} (3)`)
  expect(line?.text).not.toContain('other')
  expect(await ui.find({ type: 'Text', text: /agent-improvement:improve-skill/ })).toBeDefined()
  await ui.unmount()
})

test('/review-now reviews what is pending and says so', { options: OPTIONS }, async ($, on) => {
  const { forks } = world(on)
  await $.session.start(START)
  const idle = await $.command.run({ command: 'review-now', args: '', ...RUN })
  expect(idle.text).toContain('no watched-skill runs')

  await $.skill.prompt({ skill: SKILL, text: 'search' })
  await $.turn.start({ text: `/${SKILL}`, turnId: 't1' })
  await $.turn.complete(turn('t1'))
  const ran = await $.command.run({ command: 'review-now', args: '', ...RUN })
  expect(forks.length).toBe(1)
  expect(ran.text).toContain(`reviewed ${SKILL}`)
})


test('the band shows the pending review on every surface and Review now runs it', { options: OPTIONS }, async ($, on) => {
  const { forks, clock } = world(on)
  await $.session.start(START)
  await $.skill.prompt({ skill: SKILL, text: 'search' })
  await $.turn.start({ text: `/${SKILL}`, turnId: 't1' })
  await $.turn.complete(turn('t1'))

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Review pending · knowledge-vault:search \(1 run\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'review-now' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'review-now' })
  await clock.settle()
  expect(forks.length).toBe(1)
  await ui.unmount()
})

test('the band yields while a survey holds it and when nothing is pending', { options: OPTIONS }, async ($, on) => {
  world(on)
  await $.session.start(START)
  const quiet = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await quiet.find({ type: 'Text', text: /agent-improvement/ })).toBeUndefined()
  await quiet.unmount()

  await $.skill.prompt({ skill: SKILL, text: 'search' })
  const survey = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, hasSurvey: true } })
  expect(await survey.find({ type: 'Text', text: /agent-improvement/ })).toBeUndefined()
  await survey.unmount()
})

test('the improve-skill nudge draws from the ledger and Dismiss hides it', { options: OPTIONS }, async ($, on) => {
  const { files } = world(on)
  files.set('/data/ledger.json', JSON.stringify({ [SKILL]: { reviews_since_patch: 4 } }))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Reviews waiting · knowledge-vault:search \(4\)/ })).toBeDefined()
  await ui.press({ key: 'dismiss-nudge' })
  expect(await ui.find({ type: 'Text', text: /Reviews waiting/ })).toBeUndefined()
  await ui.unmount()
})

test('a cold prompt cache refuses to fork: a changed model, then four quiet minutes', { options: OPTIONS }, async ($, on) => {
  const { forks, toasts, clock, model } = world(on)
  await $.session.start(START)
  await $.skill.prompt({ skill: SKILL, text: 'search' })
  await $.turn.start({ text: `/${SKILL}`, turnId: 't1' })
  await $.turn.complete(turn('t1'))

  // The person switched models since the last request: the prefix is not cached.
  model.current = 'claude-test-2'
  const refused = await $.command.run({ command: 'review-now', args: '', ...RUN })
  expect(refused.text).toContain('prompt cache is cold')
  expect(refused.text).toContain('stays pending')
  expect(forks.length).toBe(0)

  // Same model again, but the warm window has closed: the band waits, no button.
  model.current = 'claude-test-1'
  await clock.advance(4 * 60_000 + 1)
  expect(forks.length).toBe(0)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Review waiting · knowledge-vault:search/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'review-now' })).toBeUndefined()
  await ui.unmount()
  await $.command.run({ command: 'review-now', args: '', ...RUN })
  expect(forks.length).toBe(0)
  expect(toasts.some(t => t.includes('prompt cache is cold'))).toBe(true)

  // The next turn's end warms the cache and reviews what waited.
  await $.turn.start({ text: 'back', turnId: 't2' })
  await $.turn.complete(turn('t2'))
  await clock.settle()
  expect(forks.length).toBe(1)
})

test('a request inside a long turn keeps the cache warm for Review now', { options: OPTIONS }, async ($, on) => {
  const { forks, clock } = world(on)
  on('tool.call', { tool: 'Skill' }, async () => {
    await $.skill.prompt({ skill: SKILL, text: 'search' })

    return { result: { success: true } }
  })
  await $.session.start(START)
  await $.turn.start({ text: 'find it', turnId: 't1' })
  await $.tool.call({ tool: 'Skill', skill: SKILL })
  await clock.advance(10 * 60_000) // a long tool call: no request for ten minutes
  const stream = $.turn.step({ turnId: 't1', index: 3, model: 'claude-test-1', messageCount: 9 })
  for await (const chunk of stream) void chunk
  await stream.result
  const ran = await $.command.run({ command: 'review-now', args: '', ...RUN })
  expect(ran.text).toContain(`reviewed ${SKILL}`)
  expect(forks.length).toBe(1)
})

test('several pending skills share one fork and the reply is split per heading', { options: OPTIONS }, async ($, on) => {
  const OTHER = 'dev-utils:brainstorming'
  const second = `# Skill Review: ${OTHER}\n\n- **Session**: s\n\n## What happened\nAlso clean.\n`
  const { files, forks, clock } = world(on, [`${REVIEW}\n${second}`])
  await $.session.start(START)
  await $.skill.prompt({ skill: SKILL, text: 'search' })
  await $.skill.prompt({ skill: OTHER, text: 'brainstorm' })
  await $.turn.start({ text: `/${SKILL}`, turnId: 't1' })
  await $.turn.complete(turn('t1'))
  await $.turn.start({ text: 'ok', turnId: 't2' })
  await $.turn.complete(turn('t2'))
  await clock.settle()

  expect(forks.length).toBe(1)
  expect(forks[0]).toContain('each of these 2 skills')
  expect(forks[0]).toContain(`## ${SKILL}`)
  expect(forks[0]).toContain(`## ${OTHER}`)
  const first = files.get('/data/reviews/knowledge-vault-search/2026-10-05-abcdef12.md') ?? ''
  const other = files.get('/data/reviews/dev-utils-brainstorming/2026-10-05-abcdef12.md') ?? ''
  expect(first.startsWith(REVIEW.trim())).toBe(true)
  expect(first).not.toContain(OTHER)
  expect(other.startsWith(`# Skill Review: ${OTHER}`)).toBe(true)
  expect(other).toContain('one fork for 2 skills')
  const ledger = JSON.parse(files.get('/data/ledger.json') ?? '{}')
  expect(ledger[SKILL].reviews_since_patch).toBe(1)
  expect(ledger[OTHER].reviews_since_patch).toBe(1)
  expect(ledger[OTHER].last_review_usage.skills_in_fork).toBe(2)
})
