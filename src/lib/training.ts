import type {
  TrainingAttendance,
  TrainingCompetition,
  TrainingCompetitionCategory,
  TrainingCompetitionResult,
  TrainingImportedPoint,
  TrainingPlayer,
  TrainingPlayerSummary,
  TrainingSession,
} from '../types'

export const trainingCategoryLabel: Record<TrainingCompetitionCategory, string> = {
  shooting: 'Shooting',
  free_throw: 'Free throws',
  competition: 'Competition',
}

export const trainingCategoryShortLabel: Record<TrainingCompetitionCategory, string> = {
  shooting: 'SHT',
  free_throw: 'FT',
  competition: 'COMP',
}

export const formatTrainingDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('ca-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

export const isPlayerEligibleForSession = (player: TrainingPlayer, session: TrainingSession) =>
  session.session_date >= player.joined_on && (!player.left_on || session.session_date <= player.left_on)

export const deriveTrainingSummaries = (
  players: TrainingPlayer[],
  sessions: TrainingSession[],
  attendance: TrainingAttendance[],
  competitions: TrainingCompetition[],
  results: TrainingCompetitionResult[],
  importedPoints: TrainingImportedPoint[] = [],
): TrainingPlayerSummary[] => {
  const attendanceMap = new Map(attendance.map((row) => [`${row.session_id}:${row.player_id}`, row.status]))
  const competitionMap = new Map(competitions.map((competition) => [competition.id, competition]))

  return players.map((player) => {
    const eligible = sessions.filter(
      (session) => session.counts_for_attendance && isPlayerEligibleForSession(player, session),
    )
    const recordedAttended = eligible.filter(
      (session) => attendanceMap.get(`${session.id}:${player.id}`) === 'present',
    ).length
    const attendanceCredit = player.attendance_credit ?? 0
    const attended = recordedAttended + attendanceCredit

    let shootingPoints = player.shooting_points_credit ?? 0
    let freeThrowPoints = player.free_throw_points_credit ?? 0
    let competitionPoints = player.competition_points_credit ?? 0

    for (const result of results) {
      if (result.player_id !== player.id || result.points <= 0) continue
      const competition = competitionMap.get(result.competition_id)
      if (!competition) continue

      // v3.2-v3.5 stored the 2/2 bonus as a synthetic +1 result with no place.
      // From v3.6 onward the bonus is derived from attendance + the competition flag,
      // so ignore those legacy rows to avoid counting the same bonus twice.
      if (competition.category === 'free_throw' && competition.free_throw_bonus_made && result.place === null) continue

      if (competition.category === 'shooting') shootingPoints += result.points
      if (competition.category === 'free_throw') freeThrowPoints += result.points
      if (competition.category === 'competition') competitionPoints += result.points
    }

    // A successful 2/2 gives +1 FT point to every player who attended that session,
    // including players who already earned 1st/2nd/3rd/4th-place points.
    for (const competition of competitions) {
      if (competition.category !== 'free_throw' || !competition.free_throw_bonus_made) continue
      if (attendanceMap.get(`${competition.session_id}:${player.id}`) === 'present') freeThrowPoints += 1
    }

    for (const imported of importedPoints) {
      if (imported.player_id !== player.id || imported.points <= 0) continue
      if (imported.category === 'shooting') shootingPoints += imported.points
      if (imported.category === 'free_throw') freeThrowPoints += imported.points
      if (imported.category === 'competition') competitionPoints += imported.points
    }

    const eligibleSessions = eligible.length
    const totalPoints = shootingPoints + freeThrowPoints + competitionPoints
    const divisor = attended > 0 ? attended : 0

    return {
      player,
      attended,
      eligibleSessions,
      attendancePct: eligibleSessions ? (attended / eligibleSessions) * 100 : 0,
      shootingPoints,
      freeThrowPoints,
      competitionPoints,
      totalPoints,
      shootingScore: divisor ? shootingPoints / divisor : 0,
      freeThrowScore: divisor ? freeThrowPoints / divisor : 0,
      competitionScore: divisor ? competitionPoints / divisor : 0,
      finalScore: divisor ? totalPoints / divisor : 0,
    }
  })
}

export const sortTrainingSummaries = (summaries: TrainingPlayerSummary[]) =>
  [...summaries].sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.attendancePct !== a.attendancePct) return b.attendancePct - a.attendancePct
    return a.player.name.localeCompare(b.player.name, 'ca')
  })

export const sessionCompetitionCounts = (
  sessionId: string,
  competitions: TrainingCompetition[],
) => {
  const counts: Record<TrainingCompetitionCategory, number> = {
    shooting: 0,
    free_throw: 0,
    competition: 0,
  }
  for (const competition of competitions) {
    if (competition.session_id === sessionId) counts[competition.category] += 1
  }
  return counts
}
