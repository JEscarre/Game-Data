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

export type TrainingCompetitionCategory = 'shooting' | 'free_throw' | 'competition'
export type AttendanceStatus = 'present' | 'absent'

export interface TrainingSeason {
  id: string
  name: string
  starts_on: string
  ends_on: string
  is_current: boolean
  created_at: string
}

export interface TrainingPlayer {
  id: string
  season_id: string
  name: string
  jersey_number: string
  joined_on: string
  left_on: string | null
  active: boolean
  source_key: string | null
  attendance_credit: number
  shooting_points_credit: number
  free_throw_points_credit: number
  competition_points_credit: number
  created_at: string
}

export interface TrainingSession {
  id: string
  season_id: string
  session_date: string
  title: string
  counts_for_attendance: boolean
  source_key: string | null
  created_at: string
  updated_at: string
}

export interface TrainingAttendance {
  session_id: string
  player_id: string
  status: AttendanceStatus
  created_at: string
  updated_at: string
}

export interface TrainingCompetition {
  id: string
  session_id: string
  category: TrainingCompetitionCategory
  title: string
  free_throw_bonus_made: boolean
  source_key: string | null
  created_at: string
}

export interface TrainingCompetitionResult {
  competition_id: string
  player_id: string
  place: number | null
  points: number
  raw_value: number | null
  created_at: string
}

export interface TrainingImportedPoint {
  session_id: string
  player_id: string
  category: TrainingCompetitionCategory
  points: number
  source_key: string
  created_at: string
}

export interface TrainingPlayerSummary {
  player: TrainingPlayer
  attended: number
  eligibleSessions: number
  attendancePct: number
  shootingPoints: number
  freeThrowPoints: number
  competitionPoints: number
  totalPoints: number
  shootingScore: number
  freeThrowScore: number
  competitionScore: number
  finalScore: number
}
