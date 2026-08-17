export type Side = 'home' | 'away'
export type GameStatus = 'draft' | 'live' | 'finished'
export type EventType = 'score' | 'foul' | 'timeout' | 'substitution' | 'lineup_check'
export type PlayerPosition = 'guard' | 'wing' | 'big'

export interface Game {
  id: string
  opponent_name: string
  game_date: string
  status: GameStatus
  current_period: number
  current_clock_seconds: number
  initial_lineup: string[]
  created_at: string
  updated_at: string
}

export interface GamePlayer {
  id: string
  game_id: string
  side: Side
  name: string
  jersey_number: string
  position: PlayerPosition | null
  sort_order: number
  created_at: string
}

export interface GameEvent {
  id: string
  game_id: string
  event_type: EventType
  side: Side | null
  player_id: string | null
  related_player_id: string | null
  period: number
  clock_seconds: number
  points: number | null
  metadata: Record<string, unknown>
  created_at: string
  undone_at: string | null
  created_by: string | null
}

export interface PlayerRuntimeStats {
  playerId: string
  totalSeconds: number
  stintSeconds: number
  onCourt: boolean
  fouls: number
}

export interface ScoreStep {
  eventId: string
  home: number
  away: number
  side: Side
  points: number
  createdAt: string
}
