/**
 * The agent-improvement mod's state contract: every value it keeps in
 * `$.state` for the session, declared under the plugin's name.
 */

/** One watched-skill invocation that has not been reviewed yet. */
export type PendingRun = {
  /** The skill as `skill.prompt` named it (`knowledge-vault:search`). */
  skill: string
  /** Who invoked it: the person typed `/skill`, or the agent called the Skill tool. */
  source: 'user' | 'agent'
  /**
   * The main-loop turn the run belongs to; null while recorded between turns
   * (a `/skill` typed at the prompt expands before its turn starts) until
   * `turn.start` claims it.
   */
  turnId: string | null
  /** When it was recorded, ISO 8601 UTC. */
  ts: string
  /** How many review attempts failed (an API error, nothing to fork yet). */
  attempts: number
}

/** A skill whose accumulated reviews are waiting for `improve-skill`. */
export type NudgeEntry = { skill: string; reviews: number }

/**
 * When the main thread's prompt cache was last refreshed, and on which model:
 * a fork is made only while this is recent and the model is unchanged.
 */
export type CacheWarmth = {
  /** Clock ms when the last main-thread request ended; null before the first. */
  at: number | null
  /** The model that request named; null when unknown. */
  model: string | null
}

/** What one review fork cost, as written to the review's footer and the ledger. */
export type ReviewUsage = {
  model: string | null
  /** How many skills shared the fork. */
  skills_in_fork: number
  cache_read_input_tokens: number
  input_tokens: number
  cache_creation_input_tokens: number
  output_tokens: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-improvement': {
      /** Runs recorded this session and not yet reviewed. */
      pending: PendingRun[]
      /** Every watched skill that ran this session, reviewed or not. */
      seen: string[]
      /** Tool failures since the first watched run (the friction nudge's counter). */
      failures: number
      /** Skills with 3+ reviews since their last patch, read from the ledger at start. */
      nudge: NudgeEntry[]
      /** The person pressed Dismiss on the improve-skill nudge. */
      isNudgeDismissed: boolean
      /** The improve-skill note was already appended for the model this session. */
      isNudgeNoted: boolean
      /** A review fork is running; the band shows it instead of the pending line. */
      isReviewing: boolean
      /** When the prompt cache was last refreshed and on which model. */
      cache: CacheWarmth
      /** The warm window closed on pending runs; the band shows them waiting for the next turn. */
      isCacheCold: boolean
    }
  }
}
