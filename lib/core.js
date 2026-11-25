/**
 * Shared pure state & layout derivation for dsh-nexus-grid.
 *
 * Implements:
 * 1. Priority classification: `waiting` (approval / question / plan-review) > `running` > `completed` > `manual` > `idle`
 * 2. Policy A sticky retention: once an active session enters the grid, if it finishes running,
 *    it remains in its exact grid slot as `completed` until the user dismisses it or clears completed panes,
 *    preventing layout jumps while typing.
 * 3. Stable slot reconciliation: existing grid panes keep their visual positions when new active sessions join.
 * 4. Responsive CSS Grid geometry for 1..6 simultaneous native panes.
 *
 * Zero external runtime dependencies.
 * @module dsh-nexus-grid/core
 */

/** Maximum simultaneous live native Conversation panes mounted at once. */
export const MAX_GRID_PANES = 6

/** Supported layout presets. */
export const LAYOUT_PRESETS = ['auto', '2-col', '3-col', '2x2', '1+2', '2x3']

/**
 * Determine if a session projection carries active unanswered user questions.
 * Covers cold/reconnected sessions before the transient waterfall fires.
 * @param {unknown} userQuestionsValue
 * @returns {boolean}
 */
export function hasProjectedUserQuestions(userQuestionsValue) {
  if (!userQuestionsValue || typeof userQuestionsValue !== 'object') return false
  const active = /** @type {any} */ (userQuestionsValue).active
    ?? /** @type {any} */ (userQuestionsValue).values?.userQuestions?.active
  return Array.isArray(active) && active.length > 0
}

/**
 * Normalize pending interaction kind from `SessionStatus` or `userQuestions` projection.
 * @param {string | undefined} pendingKind
 * @param {unknown} userQuestionsProjection
 * @returns {'approval' | 'question' | 'plan-review' | null}
 */
export function resolvePendingKind(pendingKind, userQuestionsProjection) {
  if (pendingKind === 'approval' || pendingKind === 'question' || pendingKind === 'plan-review') {
    return pendingKind
  }
  if (typeof pendingKind === 'string' && pendingKind.length > 0) {
    return 'question'
  }
  if (hasProjectedUserQuestions(userQuestionsProjection)) {
    return 'question'
  }
  return null
}

/**
 * Classify a session's live operational state.
 * Priority:
 *   1. `waiting` — awaiting user input, tool approval, or plan review
 *   2. `running` — agent turn or direct subagent is currently executing
 *   3. `idle`    — not currently active
 *
 * @param {{ pendingKind?: string | null, running?: boolean, runningSubagentCount?: number }} facts
 * @returns {'waiting' | 'running' | 'idle'}
 */
export function classifyLiveActivity(facts = {}) {
  if (facts.pendingKind) return 'waiting'
  if (facts.running === true || (typeof facts.runningSubagentCount === 'number' && facts.runningSubagentCount > 0)) {
    return 'running'
  }
  return 'idle'
}

/**
 * Reconcile the sticky grid roster under Policy A:
 * - Every currently active (`waiting` or `running`) non-dismissed session is tracked.
 * - If an active session transitions to `idle` while in the roster, it stays in the roster
 *   marked as `completed` (preserving its exact slot index so the user is never interrupted mid-typing).
 * - If a dismissed session receives a *new* live trigger (e.g. starts running again or raises a new
 *   pending interaction with a different key), its dismissal is lifted automatically.
 * - Manual selections (`manualIds`) are preserved alongside auto-tracked sessions.
 *
 * @param {object} input
 * @param {Array<{ id: string, liveState: 'waiting' | 'running' | 'idle', pendingKey?: string | null, updatedAt?: number }>} input.sessions
 * @param {Array<{ id: string, reason: 'auto' | 'completed' | 'manual', addedAt: number }>} [input.prevRoster=[]]
 * @param {Record<string, string>} [input.dismissedMap={}] - map of sessionId -> dismissed signature (`running` or `pending:<key>`)
 * @param {string[]} [input.manualIds=[]]
 * @returns {{
 *   roster: Array<{ id: string, reason: 'auto' | 'completed' | 'manual', liveState: 'waiting' | 'running' | 'idle', addedAt: number }>,
 *   nextDismissedMap: Record<string, string>,
 *   activeIds: string[],
 *   waitingCount: number,
 *   runningCount: number,
 *   completedCount: number,
 * }}
 */
export function reconcileStickyRoster({
  sessions = [],
  prevRoster = [],
  dismissedMap = {},
  manualIds = [],
  now = Date.now(),
}) {
  const byId = new Map()
  for (const s of sessions) {
    if (s && typeof s.id === 'string') byId.set(s.id, s)
  }

  const manualSet = new Set(manualIds.filter(id => byId.has(id)))
  const nextDismissedMap = {}

  // Clean up or lift dismissals when session state changes
  for (const [id, sig] of Object.entries(dismissedMap || {})) {
    const s = byId.get(id)
    if (!s) continue
    const currentSig = s.liveState === 'waiting'
      ? `waiting:${s.pendingKey || 'any'}`
      : s.liveState === 'running'
        ? 'running'
        : 'idle'
    if (currentSig === 'idle') {
      // No longer active; dismissal no longer needed once idle
      continue
    }
    if (currentSig === sig) {
      // Still the exact same active state the user explicitly minimized/dismissed
      nextDismissedMap[id] = sig
    }
    // Otherwise state changed (e.g. running -> waiting for approval!): lift dismissal!
  }

  const prevById = new Map()
  for (const entry of prevRoster) {
    if (entry && typeof entry.id === 'string') prevById.set(entry.id, entry)
  }

  /** @type {Array<{ id: string, reason: 'auto' | 'completed' | 'manual', liveState: 'waiting' | 'running' | 'idle', addedAt: number }>} */
  const nextRoster = []
  const included = new Set()

  // Step 1: Preserve existing roster order for stability (zero slot jumping!)
  for (const prev of prevRoster) {
    const s = byId.get(prev.id)
    if (!s) continue
    const isDismissed = Boolean(nextDismissedMap[s.id])
    if (isDismissed && !manualSet.has(s.id)) continue

    if (s.liveState === 'waiting' || s.liveState === 'running') {
      nextRoster.push({
        id: s.id,
        reason: 'auto',
        liveState: s.liveState,
        addedAt: prev.addedAt || now,
      })
      included.add(s.id)
    } else if (manualSet.has(s.id)) {
      nextRoster.push({
        id: s.id,
        reason: 'manual',
        liveState: 'idle',
        addedAt: prev.addedAt || now,
      })
      included.add(s.id)
    } else if (prev.reason === 'auto' || prev.reason === 'completed') {
      // Policy A: was auto-tracked while running/waiting, now finished -> keep in place as 'completed'!
      nextRoster.push({
        id: s.id,
        reason: 'completed',
        liveState: 'idle',
        addedAt: prev.addedAt || now,
      })
      included.add(s.id)
    }
  }

  // Step 2: Append newly active sessions (waiting first, then running, sorted by recency)
  const newlyActive = sessions
    .filter(s => !included.has(s.id) && !nextDismissedMap[s.id] && (s.liveState === 'waiting' || s.liveState === 'running'))
    .sort((a, b) => {
      const pa = a.liveState === 'waiting' ? 0 : 1
      const pb = b.liveState === 'waiting' ? 0 : 1
      if (pa !== pb) return pa - pb
      return (b.updatedAt || 0) - (a.updatedAt || 0)
    })

  for (const s of newlyActive) {
    nextRoster.push({
      id: s.id,
      reason: 'auto',
      liveState: s.liveState,
      addedAt: now,
    })
    included.add(s.id)
  }

  // Step 3: Append any newly checked manual sessions in user-selected order
  for (const id of manualIds) {
    if (included.has(id)) continue
    const s = byId.get(id)
    if (!s) continue
    nextRoster.push({
      id,
      reason: s.liveState === 'idle' ? 'manual' : 'auto',
      liveState: s.liveState,
      addedAt: now,
    })
    included.add(id)
  }

  // Count global live stats across all non-archived sessions (even if dismissed or overflowed)
  let waitingCount = 0
  let runningCount = 0
  for (const s of sessions) {
    if (s.liveState === 'waiting') waitingCount += 1
    else if (s.liveState === 'running') runningCount += 1
  }
  const completedCount = nextRoster.filter(r => r.reason === 'completed').length
  const activeIds = sessions
    .filter(s => s.liveState === 'waiting' || s.liveState === 'running')
    .map(s => s.id)

  return {
    roster: nextRoster,
    nextDismissedMap,
    activeIds,
    waitingCount,
    runningCount,
    completedCount,
  }
}

/**
 * Select visible pane entries up to `maxPanes` (or 1 when `focusId` is zoomed).
 * If roster exceeds `maxPanes`, prioritizes `waiting` and `running` panes over `completed`
 * only for overflow eviction while preserving relative visual order of the chosen panes!
 *
 * @param {Array<{ id: string, reason: 'auto' | 'completed' | 'manual', liveState: 'waiting' | 'running' | 'idle', addedAt: number }>} roster
 * @param {{ maxPanes?: number, page?: number, focusId?: string | null }} [options]
 */
export function selectVisiblePanes(roster = [], options = {}) {
  const cap = Math.max(1, Math.min(MAX_GRID_PANES, options.maxPanes || MAX_GRID_PANES))
  if (options.focusId) {
    const focused = roster.find(r => r.id === options.focusId)
    if (focused) {
      return {
        visible: [focused],
        totalPages: Math.max(1, Math.ceil(roster.length / cap)),
        currentPage: 0,
        overflowCount: Math.max(0, roster.length - 1),
      }
    }
  }

  if (roster.length <= cap) {
    return {
      visible: roster,
      totalPages: 1,
      currentPage: 0,
      overflowCount: 0,
    }
  }

  const totalPages = Math.ceil(roster.length / cap)
  const currentPage = Math.max(0, Math.min(totalPages - 1, Number(options.page) || 0))

  // Rank candidates so urgent waiting/running sessions stay on page 0 when >6 sessions exist,
  // while keeping stable order within page 0.
  const priorityOf = item => {
    if (item.liveState === 'waiting') return 0
    if (item.liveState === 'running') return 1
    if (item.reason === 'manual') return 2
    return 3 // completed
  }

  const indexed = roster.map((item, idx) => ({ item, idx, prio: priorityOf(item) }))
  const sortedByUrgency = [...indexed].sort((a, b) => (a.prio !== b.prio ? a.prio - b.prio : a.idx - b.idx))
  const slice = sortedByUrgency
    .slice(currentPage * cap, (currentPage + 1) * cap)
    .sort((a, b) => a.idx - b.idx)
    .map(x => x.item)

  return {
    visible: slice,
    totalPages,
    currentPage,
    overflowCount: Math.max(0, roster.length - slice.length),
  }
}

/**
 * Compute CSS Grid template descriptor for `paneCount` (1..6) and `preset`.
 * @param {number} paneCount
 * @param {string} [preset='auto']
 * @returns {{ cols: number, rows: number, areas: string[], templateColumns: string, templateRows: string }}
 */
export function computeGridLayout(paneCount, preset = 'auto') {
  const count = Math.max(1, Math.min(MAX_GRID_PANES, Number(paneCount) || 1))

  if (count === 1) {
    return {
      cols: 1,
      rows: 1,
      areas: ['1 / 1 / 2 / 2'],
      templateColumns: 'minmax(0, 1fr)',
      templateRows: 'minmax(0, 1fr)',
    }
  }

  if (count === 2) {
    return {
      cols: 2,
      rows: 1,
      areas: ['1 / 1 / 2 / 2', '1 / 2 / 2 / 3'],
      templateColumns: 'repeat(2, minmax(0, 1fr))',
      templateRows: 'minmax(0, 1fr)',
    }
  }

  if (count === 3) {
    if (preset === '3-col') {
      return {
        cols: 3,
        rows: 1,
        areas: ['1 / 1 / 2 / 2', '1 / 2 / 2 / 3', '1 / 3 / 2 / 4'],
        templateColumns: 'repeat(3, minmax(0, 1fr))',
        templateRows: 'minmax(0, 1fr)',
      }
    }
    if (preset === '2x2') {
      return {
        cols: 2,
        rows: 2,
        areas: ['1 / 1 / 2 / 2', '1 / 2 / 2 / 3', '2 / 1 / 3 / 3'],
        templateColumns: 'repeat(2, minmax(0, 1fr))',
        templateRows: 'repeat(2, minmax(0, 1fr))',
      }
    }
    // Default for 3 panes ('auto' or '1+2'): left primary pane full height, two stacked on right
    return {
      cols: 2,
      rows: 2,
      areas: [
        '1 / 1 / 3 / 2',
        '1 / 2 / 2 / 3',
        '2 / 2 / 3 / 3',
      ],
      templateColumns: 'minmax(0, 1.08fr) minmax(0, 0.92fr)',
      templateRows: 'repeat(2, minmax(0, 1fr))',
    }
  }

  if (count === 4 && preset !== '3-col') {
    return {
      cols: 2,
      rows: 2,
      areas: [
        '1 / 1 / 2 / 2',
        '1 / 2 / 2 / 3',
        '2 / 1 / 3 / 2',
        '2 / 2 / 3 / 3',
      ],
      templateColumns: 'repeat(2, minmax(0, 1fr))',
      templateRows: 'repeat(2, minmax(0, 1fr))',
    }
  }

  if (preset === '2-col') {
    const rows = Math.ceil(count / 2)
    return {
      cols: 2,
      rows,
      areas: Array.from({ length: count }, (_, i) => {
        const r = Math.floor(i / 2) + 1
        const c = (i % 2) + 1
        return `${r} / ${c} / ${r + 1} / ${c + 1}`
      }),
      templateColumns: 'repeat(2, minmax(0, 1fr))',
      templateRows: `repeat(${rows}, minmax(0, 1fr))`,
    }
  }

  // 5 or 6 panes (or 4 with 3-col): 3 columns x 2 rows
  const cols = 3
  const rows = Math.ceil(count / 3)
  if (count === 5) {
    // Top row 3 panes, bottom row 2 panes (last pane spans 2 columns for clean full-bleed fill)
    return {
      cols: 3,
      rows: 2,
      areas: [
        '1 / 1 / 2 / 2',
        '1 / 2 / 2 / 3',
        '1 / 3 / 2 / 4',
        '2 / 1 / 3 / 2',
        '2 / 2 / 3 / 4',
      ],
      templateColumns: 'repeat(3, minmax(0, 1fr))',
      templateRows: 'repeat(2, minmax(0, 1fr))',
    }
  }

  return {
    cols,
    rows,
    areas: Array.from({ length: count }, (_, i) => {
      const r = Math.floor(i / 3) + 1
      const c = (i % 3) + 1
      return `${r} / ${c} / ${r + 1} / ${c + 1}`
    }),
    templateColumns: 'repeat(3, minmax(0, 1fr))',
    templateRows: `repeat(${rows}, minmax(0, 1fr))`,
  }
}
