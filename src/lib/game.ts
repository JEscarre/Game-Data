import type { Game, GameEvent, GamePlayer, PlayerRuntimeStats, ScoreStep, Side } from '../types'

export const periodDuration = (period: number) => (period <= 4 ? 600 : 300)

export const elapsedAt = (period: number, clockSeconds: number) => {
  const safePeriod = Math.max(1, period)
  const duration = periodDuration(safePeriod)
  const safeClock = Math.max(0, Math.min(duration, clockSeconds))
  const before = safePeriod <= 4 ? (safePeriod - 1) * 600 : 2400 + (safePeriod - 5) * 300
  return before + (duration - safeClock)
}

export const periodLabel = (period: number) => (period <= 4 ? `Q${period}` : `OT${period - 4}`)

export const formatClock = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export const formatPlayed = (seconds: number) => formatClock(seconds)

export const parseClock = (value: string, duration: number) => {
  const normalized = value.trim().replace('.', ':').replace(',', ':')
  if (!normalized) return null

  if (/^\d+$/.test(normalized)) {
    const minutes = Number(normalized)
    if (!Number.isFinite(minutes)) return null
    return Math.max(0, Math.min(duration, minutes * 60))
  }

  const match = normalized.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!match) return null

  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (seconds > 59) return null

  const total = minutes * 60 + seconds
  if (total > duration) return null
  return total
}

export const activeEvents = (events: GameEvent[]) => events.filter((event) => !event.undone_at)

export const chronologicalGameEvents = (events: GameEvent[]) =>
  [...activeEvents(events)].sort((a, b) => {
    const byElapsed = elapsedAt(a.period, a.clock_seconds) - elapsedAt(b.period, b.clock_seconds)
    if (byElapsed !== 0) return byElapsed
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

export const creationOrderedEvents = (events: GameEvent[]) =>
  [...activeEvents(events)].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

export const deriveScore = (events: GameEvent[]) => {
  let home = 0
  let away = 0

  for (const event of activeEvents(events)) {
    if (event.event_type !== 'score' || !event.side || !event.points) continue
    if (event.side === 'home') home += event.points
    else away += event.points
  }

  return { home, away }
}

export const deriveScoreTimeline = (events: GameEvent[]): ScoreStep[] => {
  let home = 0
  let away = 0
  const steps: ScoreStep[] = []

  for (const event of creationOrderedEvents(events)) {
    if (event.event_type !== 'score' || !event.side || !event.points) continue
    if (event.side === 'home') home += event.points
    else away += event.points

    steps.push({
      eventId: event.id,
      home,
      away,
      side: event.side,
      points: event.points,
      createdAt: event.created_at,
    })
  }

  return steps
}

export const deriveFouls = (events: GameEvent[]) => {
  const byPlayer = new Map<string, number>()
  const bySidePeriod = new Map<string, number>()

  for (const event of activeEvents(events)) {
    if (event.event_type !== 'foul' || !event.player_id || !event.side) continue

    byPlayer.set(event.player_id, (byPlayer.get(event.player_id) ?? 0) + 1)
    const key = `${event.side}:${event.period}`
    bySidePeriod.set(key, (bySidePeriod.get(key) ?? 0) + 1)
  }

  return { byPlayer, bySidePeriod }
}

export type TimeoutSlot = 'H1-1' | 'H1-2' | 'H2-1' | 'H2-2' | 'H2-3'

export const timeoutSlots: TimeoutSlot[] = ['H1-1', 'H1-2', 'H2-1', 'H2-2', 'H2-3']

export const timeoutSlotHalf = (slot: TimeoutSlot) => (slot.startsWith('H1') ? 1 : 2)

export const deriveTimeoutSlots = (events: GameEvent[]) => {
  const slots: Record<Side, Map<TimeoutSlot, GameEvent>> = {
    home: new Map(),
    away: new Map(),
  }

  const legacyCounters: Record<Side, { first: number; second: number }> = {
    home: { first: 0, second: 0 },
    away: { first: 0, second: 0 },
  }

  for (const event of creationOrderedEvents(events)) {
    if (event.event_type !== 'timeout' || !event.side) continue

    const metadataSlot = typeof event.metadata?.slot === 'string' ? event.metadata.slot as TimeoutSlot : null
    if (metadataSlot && timeoutSlots.includes(metadataSlot)) {
      slots[event.side].set(metadataSlot, event)
      continue
    }

    const half = event.period <= 2 ? 1 : 2
    if (half === 1) {
      legacyCounters[event.side].first += 1
      const slot = `H1-${Math.min(legacyCounters[event.side].first, 2)}` as TimeoutSlot
      slots[event.side].set(slot, event)
    } else {
      legacyCounters[event.side].second += 1
      const slot = `H2-${Math.min(legacyCounters[event.side].second, 3)}` as TimeoutSlot
      slots[event.side].set(slot, event)
    }
  }

  return slots
}

export const derivePlayerStats = (
  game: Game,
  players: GamePlayer[],
  events: GameEvent[],
): Map<string, PlayerRuntimeStats> => {
  const currentElapsed = elapsedAt(game.current_period, game.current_clock_seconds)
  const substitutions = chronologicalGameEvents(events).filter(
    (event) => event.event_type === 'substitution' && elapsedAt(event.period, event.clock_seconds) <= currentElapsed,
  )
  const fouls = deriveFouls(events).byPlayer
  const totals = new Map<string, number>()
  const onCourt = new Set<string>()
  const stintStart = new Map<string, number>()

  for (const id of game.initial_lineup ?? []) {
    if (!players.some((player) => player.id === id)) continue
    onCourt.add(id)
    stintStart.set(id, 0)
  }

  for (const event of substitutions) {
    const at = elapsedAt(event.period, event.clock_seconds)
    const outId = event.player_id
    const inId = event.related_player_id

    if (outId && onCourt.has(outId)) {
      const started = stintStart.get(outId) ?? at
      totals.set(outId, (totals.get(outId) ?? 0) + Math.max(0, at - started))
      onCourt.delete(outId)
      stintStart.delete(outId)
    }

    if (inId && !onCourt.has(inId)) {
      onCourt.add(inId)
      stintStart.set(inId, at)
    }
  }

  const stats = new Map<string, PlayerRuntimeStats>()

  for (const player of players) {
    const started = stintStart.get(player.id)
    const currentStint = onCourt.has(player.id) && started !== undefined ? Math.max(0, currentElapsed - started) : 0

    stats.set(player.id, {
      playerId: player.id,
      totalSeconds: (totals.get(player.id) ?? 0) + currentStint,
      stintSeconds: currentStint,
      onCourt: onCourt.has(player.id),
      fouls: fouls.get(player.id) ?? 0,
    })
  }

  return stats
}

export const nextThirtySeconds = (clockSeconds: number) => {
  if (clockSeconds <= 0) return 0
  if (clockSeconds % 30 === 0) return Math.max(0, clockSeconds - 30)
  return Math.floor(clockSeconds / 30) * 30
}

export const currentLineup = (
  game: Game,
  players: GamePlayer[],
  events: GameEvent[],
): GamePlayer[] => {
  const stats = derivePlayerStats(game, players, events)
  return players.filter((player) => player.side === 'home' && stats.get(player.id)?.onCourt)
}
