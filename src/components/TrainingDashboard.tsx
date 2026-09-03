import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  deriveTrainingSummaries,
  formatTrainingDate,
  isPlayerEligibleForSession,
  sessionCompetitionCounts,
  sortTrainingSummaries,
  trainingCategoryLabel,
} from '../lib/training'
import type {
  AttendanceStatus,
  TrainingAttendance,
  TrainingCompetition,
  TrainingCompetitionCategory,
  TrainingCompetitionResult,
  TrainingImportedPoint,
  TrainingPlayer,
  TrainingSeason,
  TrainingSession,
} from '../types'
import { ConfirmDialog } from './ConfirmDialog'

interface CompetitionDraft {
  competition: TrainingCompetition | null
  sessionId: string
  category: TrainingCompetitionCategory
  title: string
  placements: Record<string, number | null>
  freeThrowBonusMade: boolean
}

interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  action: () => Promise<void>
}

const categoryOrder: TrainingCompetitionCategory[] = ['shooting', 'free_throw', 'competition']
const pointsForPlace = (place: number) => 5 - place
const pointShortLabel: Record<number, string> = { 1: '4 PTS', 2: '3 PTS', 3: '2 PTS', 4: '1 PT' }
const todayIso = () => new Date().toISOString().slice(0, 10)

export function TrainingDashboard() {
  const [seasons, setSeasons] = useState<TrainingSeason[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [players, setPlayers] = useState<TrainingPlayer[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [attendance, setAttendance] = useState<TrainingAttendance[]>([])
  const [competitions, setCompetitions] = useState<TrainingCompetition[]>([])
  const [results, setResults] = useState<TrainingCompetitionResult[]>([])
  const [importedPoints, setImportedPoints] = useState<TrainingImportedPoint[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [navigationDate, setNavigationDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const [competitionDraft, setCompetitionDraft] = useState<CompetitionDraft | null>(null)
  const [newPlayer, setNewPlayer] = useState({ name: '', jersey: '', joinedOn: todayIso() })
  const [showPlayerForm, setShowPlayerForm] = useState(false)
  const [showDeletePlayerPicker, setShowDeletePlayerPicker] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(true)
  const [competitionSaveState, setCompetitionSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const competitionSaveChain = useRef<Promise<void>>(Promise.resolve())

  const loadSeasons = useCallback(async () => {
    const { data, error } = await supabase
      .from('training_seasons')
      .select('*')
      .order('starts_on', { ascending: false })

    if (error) return alert(`No s'han pogut carregar les temporades: ${error.message}`)
    const next = (data ?? []) as TrainingSeason[]
    setSeasons(next)
    setSeasonId((previous) => previous || next.find((season) => season.is_current)?.id || next[0]?.id || '')
  }, [])

  const loadSeasonData = useCallback(async () => {
    if (!seasonId) return
    setLoading(true)

    const [playersResult, sessionsResult] = await Promise.all([
      supabase.from('training_players').select('*').eq('season_id', seasonId).order('active', { ascending: false }).order('jersey_number').order('name'),
      supabase.from('training_sessions').select('*').eq('season_id', seasonId).order('session_date', { ascending: false }).order('created_at', { ascending: false }),
    ])

    if (playersResult.error) {
      setLoading(false)
      return alert(playersResult.error.message)
    }
    if (sessionsResult.error) {
      setLoading(false)
      return alert(sessionsResult.error.message)
    }

    const nextPlayers = (playersResult.data ?? []) as TrainingPlayer[]
    const nextSessions = (sessionsResult.data ?? []) as TrainingSession[]
    const sessionIds = nextSessions.map((session) => session.id)

    let nextAttendance: TrainingAttendance[] = []
    let nextCompetitions: TrainingCompetition[] = []
    let nextResults: TrainingCompetitionResult[] = []
    let nextImportedPoints: TrainingImportedPoint[] = []

    if (sessionIds.length) {
      const [attendanceResult, competitionsResult, importedPointsResult] = await Promise.all([
        supabase.from('training_attendance').select('*').in('session_id', sessionIds),
        supabase.from('training_competitions').select('*').in('session_id', sessionIds).order('created_at'),
        supabase.from('training_imported_points').select('*').in('session_id', sessionIds),
      ])
      if (attendanceResult.error) return alert(attendanceResult.error.message)
      if (competitionsResult.error) return alert(competitionsResult.error.message)
      if (importedPointsResult.error) return alert(importedPointsResult.error.message)
      nextAttendance = (attendanceResult.data ?? []) as TrainingAttendance[]
      nextCompetitions = (competitionsResult.data ?? []) as TrainingCompetition[]
      nextImportedPoints = (importedPointsResult.data ?? []) as TrainingImportedPoint[]

      const competitionIds = nextCompetitions.map((competition) => competition.id)
      if (competitionIds.length) {
        const { data, error } = await supabase.from('training_competition_results').select('*').in('competition_id', competitionIds)
        if (error) return alert(error.message)
        nextResults = (data ?? []) as TrainingCompetitionResult[]
      }
    }

    setPlayers(nextPlayers)
    setSessions(nextSessions)
    setAttendance(nextAttendance)
    setCompetitions(nextCompetitions)
    setResults(nextResults)
    setImportedPoints(nextImportedPoints)
    setSelectedSessionId((previous) => previous && nextSessions.some((session) => session.id === previous) ? previous : nextSessions[0]?.id ?? null)
    setLoading(false)
  }, [seasonId])

  useEffect(() => {
    void loadSeasons()
  }, [loadSeasons])

  useEffect(() => {
    void loadSeasonData()
    if (!seasonId) return

    const channel = supabase
      .channel(`training:${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_players', filter: `season_id=eq.${seasonId}` }, () => void loadSeasonData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_sessions', filter: `season_id=eq.${seasonId}` }, () => void loadSeasonData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_attendance' }, () => void loadSeasonData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_competitions' }, () => void loadSeasonData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_competition_results' }, () => void loadSeasonData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_imported_points' }, () => void loadSeasonData())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [seasonId, loadSeasonData])

  const selectedSeason = seasons.find((season) => season.id === seasonId) ?? null
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null

  useEffect(() => {
    if (selectedSession) {
      setNavigationDate(selectedSession.session_date)
      return
    }
    if (!navigationDate && selectedSeason) {
      const date = todayIso()
      setNavigationDate(date < selectedSeason.starts_on ? selectedSeason.starts_on : date > selectedSeason.ends_on ? selectedSeason.ends_on : date)
    }
  }, [selectedSession, selectedSeason, navigationDate])

  useEffect(() => {
    setAttendanceOpen(true)
  }, [selectedSessionId])

  const summaries = useMemo(
    () => sortTrainingSummaries(deriveTrainingSummaries(players, sessions, attendance, competitions, results, importedPoints)),
    [players, sessions, attendance, competitions, results, importedPoints],
  )
  const totalEligible = summaries.reduce((sum, summary) => sum + summary.eligibleSessions, 0)
  const totalPresent = summaries.reduce((sum, summary) => sum + summary.attended, 0)
  const teamAttendancePct = totalEligible ? (totalPresent / totalEligible) * 100 : 0
  const sessionCompetitions = selectedSession ? competitions.filter((competition) => competition.session_id === selectedSession.id) : []
  const sessionImportedPoints = selectedSession ? importedPoints.filter((row) => row.session_id === selectedSession.id) : []
  const selectedAttendance = new Map(
    attendance.filter((row) => row.session_id === selectedSessionId).map((row) => [row.player_id, row.status]),
  )
  const sessionEligiblePlayers = selectedSession
    ? players.filter((player) => isPlayerEligibleForSession(player, selectedSession))
    : []

  const attendancePresentCount = sessionEligiblePlayers.filter((player) => selectedAttendance.get(player.id) === 'present').length
  const attendanceAbsentCount = Math.max(sessionEligiblePlayers.length - attendancePresentCount, 0)
  const attendanceDayPct = sessionEligiblePlayers.length ? (attendancePresentCount / sessionEligiblePlayers.length) * 100 : 0

  const dailyPointsByCategory = useMemo(() => {
    const totals: Record<TrainingCompetitionCategory, Map<string, number>> = {
      shooting: new Map(),
      free_throw: new Map(),
      competition: new Map(),
    }

    for (const row of sessionImportedPoints) {
      if (row.points <= 0) continue
      totals[row.category].set(row.player_id, (totals[row.category].get(row.player_id) ?? 0) + row.points)
    }

    const competitionById = new Map<string, TrainingCompetition>(sessionCompetitions.map((competition) => [competition.id, competition] as const))
    for (const row of results) {
      if (row.points <= 0) continue
      const competition = competitionById.get(row.competition_id)
      if (!competition) continue
      const bucket = totals[competition.category]
      bucket.set(row.player_id, (bucket.get(row.player_id) ?? 0) + row.points)
    }

    return categoryOrder.reduce((output, category) => {
      output[category] = [...totals[category].entries()]
        .map(([playerId, points]) => ({
          playerId,
          points,
          name: players.find((player) => player.id === playerId)?.name ?? 'Jugador',
        }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'ca'))
      return output
    }, { shooting: [], free_throw: [], competition: [] } as Record<TrainingCompetitionCategory, Array<{ playerId: string; points: number; name: string }>>)
  }, [sessionImportedPoints, sessionCompetitions, results, players])

  const hasDailyPoints = categoryOrder.some((category) => dailyPointsByCategory[category].length > 0)

  const orderedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date) || a.created_at.localeCompare(b.created_at)),
    [sessions],
  )
  const selectedSessionIndex = selectedSession ? orderedSessions.findIndex((session) => session.id === selectedSession.id) : -1

  const navigateToDate = (date: string) => {
    setNavigationDate(date)
    const target = sessions.find((session) => session.session_date === date)
    setSelectedSessionId(target?.id ?? null)
  }

  const navigateTraining = (direction: -1 | 1) => {
    if (selectedSessionIndex < 0) return
    const target = orderedSessions[selectedSessionIndex + direction]
    if (!target) return
    setSelectedSessionId(target.id)
    setNavigationDate(target.session_date)
  }

  const createSession = async (requestedDate?: string) => {
    if (!seasonId || !selectedSeason) return
    const existing = requestedDate ? sessions.find((session) => session.session_date === requestedDate) : null
    if (existing) {
      setSelectedSessionId(existing.id)
      setNavigationDate(existing.session_date)
      return
    }

    setCreatingSession(true)
    const today = requestedDate || todayIso()
    const date = today < selectedSeason.starts_on ? selectedSeason.starts_on : today > selectedSeason.ends_on ? selectedSeason.ends_on : today
    const { data, error } = await supabase
      .from('training_sessions')
      .insert({ season_id: seasonId, session_date: date, title: `Entrenament ${formatTrainingDate(date)}` })
      .select('*')
      .single()

    if (error || !data) {
      setCreatingSession(false)
      return alert(error?.message ?? "No s'ha pogut crear l'entrenament.")
    }

    const session = data as TrainingSession
    const eligible = players.filter((player) => player.active && isPlayerEligibleForSession(player, session))
    if (eligible.length) {
      const { error: attendanceError } = await supabase.from('training_attendance').upsert(
        eligible.map((player) => ({ session_id: session.id, player_id: player.id, status: 'present' as AttendanceStatus })),
        { onConflict: 'session_id,player_id' },
      )
      if (attendanceError) alert(attendanceError.message)
    }

    setSelectedSessionId(session.id)
    setNavigationDate(session.session_date)
    setCreatingSession(false)
    await loadSeasonData()
  }

  const askDeleteSession = (session: TrainingSession) => {
    setConfirmState({
      title: 'Eliminar entrenament?',
      message: `S'eliminarà l'entrenament del ${formatTrainingDate(session.session_date)}, la seva assistència i totes les competicions vinculades. Aquesta acció no es pot desfer.`,
      confirmLabel: 'Eliminar entrenament',
      action: async () => {
        const { error } = await supabase.from('training_sessions').delete().eq('id', session.id)
        if (error) return alert(error.message)
        setSelectedSessionId(null)
        await loadSeasonData()
      },
    })
  }

  const updateSession = async (session: TrainingSession, patch: Partial<TrainingSession>) => {
    const { error } = await supabase.from('training_sessions').update(patch).eq('id', session.id)
    if (error) return alert(error.message)
    await loadSeasonData()
  }

  const setAttendanceStatus = async (playerId: string, status: AttendanceStatus) => {
    if (!selectedSession) return
    const { error } = await supabase.from('training_attendance').upsert(
      { session_id: selectedSession.id, player_id: playerId, status },
      { onConflict: 'session_id,player_id' },
    )
    if (error) return alert(error.message)
    setAttendance((previous) => {
      const filtered = previous.filter((row) => !(row.session_id === selectedSession.id && row.player_id === playerId))
      return [...filtered, { session_id: selectedSession.id, player_id: playerId, status } as TrainingAttendance]
    })
  }

  const setAllAttendance = async (status: AttendanceStatus) => {
    if (!selectedSession || !sessionEligiblePlayers.length) return
    const payload = sessionEligiblePlayers.map((player) => ({ session_id: selectedSession.id, player_id: player.id, status }))
    const { error } = await supabase.from('training_attendance').upsert(payload, { onConflict: 'session_id,player_id' })
    if (error) return alert(error.message)
    await loadSeasonData()
  }

  const addPlayer = async (event: FormEvent) => {
    event.preventDefault()
    if (!newPlayer.name.trim() || !seasonId) return
    const { error } = await supabase.from('training_players').insert({
      season_id: seasonId,
      name: newPlayer.name.trim(),
      jersey_number: newPlayer.jersey.trim(),
      joined_on: newPlayer.joinedOn,
      active: true,
    })
    if (error) return alert(error.message)
    setNewPlayer({ name: '', jersey: '', joinedOn: todayIso() })
    setShowPlayerForm(false)
    await loadSeasonData()
  }

  const askDeletePlayer = (player: TrainingPlayer) => {
    setShowDeletePlayerPicker(false)
    setConfirmState({
      title: `Eliminar ${player.name}?`,
      message: 'S’eliminarà el jugador de la temporada i també tota la seva assistència, puntuacions i resultats de competicions. Aquesta acció no es pot desfer.',
      confirmLabel: 'Eliminar jugador',
      action: async () => {
        const { error } = await supabase.from('training_players').delete().eq('id', player.id)
        if (error) return alert(error.message)
        await loadSeasonData()
      },
    })
  }

  const openCompetition = async (category: TrainingCompetitionCategory, competition?: TrainingCompetition) => {
    if (!selectedSession) return
    let activeCompetition = competition ?? null

    if (!activeCompetition) {
      const counts = sessionCompetitionCounts(selectedSession.id, competitions)
      const title = `${trainingCategoryLabel[category]} #${counts[category] + 1}`
      const { data, error } = await supabase
        .from('training_competitions')
        .insert({
          session_id: selectedSession.id,
          category,
          title,
          free_throw_bonus_made: false,
        })
        .select('*')
        .single()

      if (error || !data) return alert(error?.message ?? "No s'ha pogut crear la competició.")
      activeCompetition = data as TrainingCompetition
      setCompetitions((previous) => [...previous, activeCompetition as TrainingCompetition])
    }

    const placements: Record<string, number | null> = {}
    for (const player of players) placements[player.id] = null
    for (const result of results.filter((row) => row.competition_id === activeCompetition.id && row.place)) {
      placements[result.player_id] = result.place
    }

    setCompetitionSaveState('saved')
    setCompetitionDraft({
      competition: activeCompetition,
      sessionId: selectedSession.id,
      category,
      title: activeCompetition.title,
      placements,
      freeThrowBonusMade: activeCompetition.free_throw_bonus_made ?? false,
    })
  }

  const persistCompetitionDraft = async (draft: CompetitionDraft) => {
    if (!draft.competition) return
    const competitionId = draft.competition.id
    const bonusMade = draft.category === 'free_throw' && draft.freeThrowBonusMade
    const title = draft.title.trim() || trainingCategoryLabel[draft.category]

    const { error: updateError } = await supabase
      .from('training_competitions')
      .update({ title, category: draft.category, free_throw_bonus_made: bonusMade })
      .eq('id', competitionId)
    if (updateError) throw updateError

    const { error: deleteError } = await supabase.from('training_competition_results').delete().eq('competition_id', competitionId)
    if (deleteError) throw deleteError

    const ranked = Object.entries(draft.placements)
      .filter(([, place]) => typeof place === 'number' && place >= 1 && place <= 4)
      .map(([playerId, place]) => ({
        competition_id: competitionId,
        player_id: playerId,
        place: place as number,
        points: pointsForPlace(place as number),
      }))

    const rankedPlayerIds = new Set(ranked.map((row) => row.player_id))
    const bonusRows = bonusMade
      ? sessionEligiblePlayers
          .filter((player) => selectedAttendance.get(player.id) === 'present' && !rankedPlayerIds.has(player.id))
          .map((player) => ({
            competition_id: competitionId,
            player_id: player.id,
            place: null,
            points: 1,
          }))
      : []

    const payload = [...ranked, ...bonusRows]
    if (payload.length) {
      const { error } = await supabase.from('training_competition_results').insert(payload)
      if (error) throw error
    }

    const savedAt = new Date().toISOString()
    setCompetitions((previous) => previous.map((item) => item.id === competitionId ? { ...item, title, category: draft.category, free_throw_bonus_made: bonusMade } : item))
    setResults((previous) => [
      ...previous.filter((row) => row.competition_id !== competitionId),
      ...payload.map((row) => ({ ...row, raw_value: null, created_at: savedAt } as TrainingCompetitionResult)),
    ])
  }

  const queueCompetitionSave = (draft: CompetitionDraft) => {
    setCompetitionSaveState('saving')
    competitionSaveChain.current = competitionSaveChain.current
      .catch(() => undefined)
      .then(() => persistCompetitionDraft(draft))
      .then(() => setCompetitionSaveState('saved'))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'No s’han pogut guardar els resultats.'
        setCompetitionSaveState('error')
        alert(message)
      })
  }

  const setCompetitionPlacement = (playerId: string, value: number) => {
    if (!competitionDraft) return
    const next: CompetitionDraft = {
      ...competitionDraft,
      placements: {
        ...competitionDraft.placements,
        [playerId]: competitionDraft.placements[playerId] === value ? null : value,
      },
    }
    setCompetitionDraft(next)
    queueCompetitionSave(next)
  }

  const setFreeThrowBonus = (checked: boolean) => {
    if (!competitionDraft) return
    const next = { ...competitionDraft, freeThrowBonusMade: checked }
    setCompetitionDraft(next)
    queueCompetitionSave(next)
  }

  const saveCompetitionTitle = () => {
    if (!competitionDraft) return
    queueCompetitionSave(competitionDraft)
  }

  const askDeleteCompetition = (competition: TrainingCompetition) => {
    setConfirmState({
      title: 'Eliminar competició?',
      message: `S'eliminarà “${competition.title}” i tots els punts registrats en aquesta competició.`,
      confirmLabel: 'Eliminar competició',
      action: async () => {
        const { error } = await supabase.from('training_competitions').delete().eq('id', competition.id)
        if (error) return alert(error.message)
        await loadSeasonData()
      },
    })
  }

  const runConfirmation = async () => {
    if (!confirmState) return
    setConfirmBusy(true)
    try {
      await confirmState.action()
      setConfirmState(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  const competitionPlacements = (competition: TrainingCompetition) => {
    const compResults = results.filter((row) => row.competition_id === competition.id && row.place)
    return [1, 2, 3, 4].map((place) => ({
      place,
      names: compResults
        .filter((row) => row.place === place)
        .map((row) => players.find((player) => player.id === row.player_id)?.name)
        .filter(Boolean) as string[],
    }))
  }

  const competitionBonusNames = (competition: TrainingCompetition) =>
    results
      .filter((row) => row.competition_id === competition.id && row.place === null && row.points === 1)
      .map((row) => players.find((player) => player.id === row.player_id)?.name)
      .filter(Boolean) as string[]

  return (
    <main className="page-shell training-shell">
      <section className="training-hero">
        <div>
          <p className="eyebrow">ENTRENAMENTS</p>
          <h1>Training Control</h1>
          <p>Assistència, competicions i classificació de tota la temporada.</p>
        </div>
        <div className="training-hero-actions">
          <label className="season-select">
            <span>Temporada</span>
            <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
              {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
            </select>
          </label>
          <button className="button primary large" onClick={() => createSession()} disabled={creatingSession || !selectedSeason?.is_current}>
            {creatingSession ? 'Creant...' : '+ Nou entrenament'}
          </button>
        </div>
      </section>

      <section className="training-kpis">
        <article><span>Entrenaments</span><strong>{sessions.filter((session) => session.counts_for_attendance).length}</strong><small>registrats</small></article>
        <article><span>Assistència equip</span><strong>{teamAttendancePct.toFixed(0)}%</strong><small>{totalPresent}/{totalEligible} presències</small></article>
        <article><span>Competicions</span><strong>{competitions.length}</strong><small>shooting + FT + competition</small></article>
        <article><span>Líder final</span><strong>{summaries[0] ? summaries[0].finalScore.toFixed(2) : '0.00'}</strong><small>{summaries[0]?.player.name ?? 'Sense dades'}</small></article>
      </section>

      <section className="training-main">
        {loading ? (
          <section className="panel"><p className="empty-inline">Carregant dades...</p></section>
        ) : selectedSession ? (
          <>
            <section className="panel training-day-panel">
              <div className="training-day-heading">
                <div>
                  <p className="eyebrow">ENTRENAMENT</p>
                  <h2>{formatTrainingDate(selectedSession.session_date)}</h2>
                  <span>{selectedSession.title}</span>
                </div>
                <button className="button danger-outline compact" onClick={() => askDeleteSession(selectedSession)} disabled={!selectedSeason?.is_current}>Eliminar entrenament</button>
              </div>

              <div className="training-date-navigation">
                <button className="date-nav-arrow" onClick={() => navigateTraining(-1)} disabled={selectedSessionIndex <= 0} aria-label="Entrenament anterior">‹</button>
                <label className="training-date-picker">
                  <span>Data de l’entrenament</span>
                  <input
                    type="date"
                    value={navigationDate}
                    min={selectedSeason?.starts_on}
                    max={selectedSeason?.ends_on}
                    onChange={(event) => navigateToDate(event.target.value)}
                  />
                </label>
                <button className="date-nav-arrow" onClick={() => navigateTraining(1)} disabled={selectedSessionIndex < 0 || selectedSessionIndex >= orderedSessions.length - 1} aria-label="Entrenament següent">›</button>
                <div className="training-date-index"><strong>{selectedSessionIndex + 1}</strong><span>de {orderedSessions.length}</span></div>
              </div>

              {selectedSeason?.is_current && (
                <div className="training-session-fields single-field">
                  <label><span>Nom / nota</span><input key={`${selectedSession.id}-title`} defaultValue={selectedSession.title} onBlur={(event) => event.target.value.trim() && event.target.value.trim() !== selectedSession.title && updateSession(selectedSession, { title: event.target.value.trim() })} /></label>
                </div>
              )}

              {selectedSession.counts_for_attendance ? (
                <div className={`attendance-accordion ${attendanceOpen ? 'open' : ''}`}>
                  <button className="attendance-accordion-toggle" onClick={() => setAttendanceOpen((value) => !value)} aria-expanded={attendanceOpen}>
                    <div className="attendance-accordion-title">
                      <span className="attendance-icon">✓</span>
                      <div><strong>Assistència</strong><span>{attendancePresentCount} presents · {attendanceAbsentCount} absents</span></div>
                    </div>
                    <div className="attendance-accordion-summary">
                      <strong>{attendanceDayPct.toFixed(0)}%</strong>
                      <span>{attendanceOpen ? 'Tancar' : 'Obrir'}</span>
                      <i aria-hidden="true">⌄</i>
                    </div>
                  </button>
                  {attendanceOpen && (
                    <div className="attendance-accordion-body">
                      <div className="attendance-actions">
                        <div><strong>Passar llista</strong><span>Toca P/A per canviar ràpidament.</span></div>
                        <div>
                          <button className="button secondary compact" onClick={() => setAllAttendance('present')}>Tots presents</button>
                          <button className="button secondary compact" onClick={() => setAllAttendance('absent')}>Tots absents</button>
                        </div>
                      </div>
                      <div className="attendance-grid">
                        {sessionEligiblePlayers.map((player) => {
                          const status = selectedAttendance.get(player.id) ?? 'absent'
                          return (
                            <div className={`attendance-player ${status}`} key={player.id}>
                              <span className="training-jersey">{player.jersey_number || '–'}</span>
                              <strong>{player.name}</strong>
                              <div className="attendance-toggle">
                                <button className={status === 'present' ? 'active present' : ''} onClick={() => setAttendanceStatus(player.id, 'present')}>P</button>
                                <button className={status === 'absent' ? 'active absent' : ''} onClick={() => setAttendanceStatus(player.id, 'absent')}>A</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="import-note">Aquest registre no compta per al percentatge d’assistència. Els punts associats sí que s’inclouen a la classificació.</div>
              )}
            </section>

            <section className="panel competitions-panel">
              <div className="section-heading">
                <div><p className="eyebrow">COMPETICIONS</p><h2>Resultats del dia</h2></div>
                <span>Pots assignar els mateixos punts a més d’un jugador</span>
              </div>
              {hasDailyPoints && (
                <div className="daily-results-summary">
                  <div className="daily-results-summary-head">
                    <div><strong>Punts agregats del dia</strong><span>Suma total per jugador i categoria en aquest entrenament.</span></div>
                  </div>
                  <div className="daily-results-summary-grid">
                    {categoryOrder.map((category) => {
                      const rows = dailyPointsByCategory[category]
                      return (
                        <div className={`daily-results-category category-${category}`} key={category}>
                          <strong>{trainingCategoryLabel[category]}</strong>
                          {rows.length === 0 ? <span className="daily-result-empty">Sense punts</span> : rows.map((row) => (
                            <span className="daily-result-row" key={`${row.playerId}-${category}`}>
                              <span>{row.name}</span><b>{row.points}</b>
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="add-competition-row">
                {categoryOrder.map((category) => (
                  <button key={category} className={`quick-competition category-${category}`} onClick={() => void openCompetition(category)} disabled={!selectedSeason?.is_current}>
                    <span>+</span><strong>{trainingCategoryLabel[category]}</strong>
                  </button>
                ))}
              </div>

              <div className="competition-groups">
                {categoryOrder.map((category) => {
                  const items = sessionCompetitions.filter((competition) => competition.category === category)
                  return (
                    <div className="competition-group" key={category}>
                      <div className="competition-group-title"><strong>{trainingCategoryLabel[category]}</strong><span>{items.length}</span></div>
                      {items.length === 0 ? <p className="empty-inline">Cap competició.</p> : items.map((competition) => {
                        const bonusNames = competitionBonusNames(competition)
                        return (
                          <article className={`competition-card category-${category}`} key={competition.id}>
                            <div className="competition-card-head">
                              <strong>{competition.title}</strong>
                              <div>
                                <button onClick={() => void openCompetition(category, competition)} disabled={!selectedSeason?.is_current}>Editar</button>
                                <button className="competition-delete" onClick={() => askDeleteCompetition(competition)} disabled={!selectedSeason?.is_current}>Eliminar</button>
                              </div>
                            </div>
                            <div className="competition-result-board">
                              {competitionPlacements(competition).map(({ place, names }) => (
                                <div key={place} className={`competition-result-row place-${place} ${names.length ? 'has-result' : ''}`}>
                                  <span className="result-place">{pointShortLabel[place]}</span>
                                  <span className="result-names">{names.length ? names.join(' · ') : '—'}</span>
                                  <strong className="result-points">+{pointsForPlace(place)} <small>PTS</small></strong>
                                </div>
                              ))}
                              {competition.free_throw_bonus_made && (
                                <div className="competition-result-row ft-bonus-result">
                                  <span className="result-place">2/2</span>
                                  <span className="result-names">{bonusNames.length ? bonusNames.join(' · ') : 'Sense jugadors amb 0 punts'}</span>
                                  <strong className="result-points">+1 <small>PTS</small></strong>
                                </div>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="panel training-empty training-date-empty">
            <p className="eyebrow">DATA</p>
            <strong>No hi ha cap entrenament el {navigationDate ? formatTrainingDate(navigationDate) : 'dia seleccionat'}</strong>
            <span>Selecciona una altra data o crea un entrenament nou per aquest dia.</span>
            <div className="empty-date-actions">
              <label className="training-date-picker">
                <span>Data</span>
                <input type="date" value={navigationDate} min={selectedSeason?.starts_on} max={selectedSeason?.ends_on} onChange={(event) => navigateToDate(event.target.value)} />
              </label>
              <button className="button primary" onClick={() => createSession(navigationDate)} disabled={!selectedSeason?.is_current || !navigationDate || creatingSession}>{creatingSession ? 'Creant...' : 'Crear entrenament aquest dia'}</button>
            </div>
          </section>
        )}
      </section>

      <section className="panel season-table-panel">
        <div className="section-heading season-ranking-heading">
          <div><p className="eyebrow">TEMPORADA</p><h2>Classificació i assistència</h2></div>
          <div className="player-management-actions">
            <button className="button secondary compact" onClick={() => setShowPlayerForm((value) => !value)} disabled={!selectedSeason?.is_current}>+ Afegir jugador</button>
            <button className="button danger-outline compact" onClick={() => setShowDeletePlayerPicker(true)} disabled={!selectedSeason?.is_current || players.length === 0}>Eliminar jugador</button>
          </div>
        </div>

        {showPlayerForm && (
          <form className="add-training-player" onSubmit={addPlayer}>
            <label><span>Dorsal</span><input value={newPlayer.jersey} onChange={(event) => setNewPlayer((previous) => ({ ...previous, jersey: event.target.value }))} /></label>
            <label><span>Nom</span><input required value={newPlayer.name} onChange={(event) => setNewPlayer((previous) => ({ ...previous, name: event.target.value }))} /></label>
            <label><span>Data d’alta</span><input type="date" value={newPlayer.joinedOn} onChange={(event) => setNewPlayer((previous) => ({ ...previous, joinedOn: event.target.value }))} /></label>
            <button className="button primary" type="submit">Guardar jugador</button>
          </form>
        )}

        <div className="training-table-wrap">
          <table className="training-table">
            <thead><tr><th>#</th><th>Jugador</th><th className="th-attendance">Assistència</th><th className="th-shooting">Shooting</th><th className="th-free-throw">Free throws</th><th className="th-competition">Competition</th><th className="th-total">Total</th></tr></thead>
            <tbody>
              {summaries.map((summary, index) => (
                <tr className={`standings-row ${index < 3 ? `top-${index + 1}` : ''}`} key={summary.player.id}>
                  <td><span className={`rank-badge rank-${Math.min(index + 1, 4)}`}>{index + 1}</span></td>
                  <td><div className="table-player"><span className="training-jersey">{summary.player.jersey_number || '–'}</span><strong>{summary.player.name}</strong></div></td>
                  <td><div className="attendance-cell"><div><strong>{summary.attendancePct.toFixed(0)}%</strong><span>{summary.attended}/{summary.eligibleSessions}</span></div><i><b style={{ width: `${Math.min(summary.attendancePct, 100)}%` }} /></i></div></td>
                  <td><div className="score-cell score-shooting"><strong>{summary.shootingScore.toFixed(2)}</strong><span>{summary.shootingPoints} pts</span></div></td>
                  <td><div className="score-cell score-free-throw"><strong>{summary.freeThrowScore.toFixed(2)}</strong><span>{summary.freeThrowPoints} pts</span></div></td>
                  <td><div className="score-cell score-competition"><strong>{summary.competitionScore.toFixed(2)}</strong><span>{summary.competitionPoints} pts</span></div></td>
                  <td><div className="score-cell final-score-cell"><strong className="total-points">{summary.finalScore.toFixed(2)}</strong><span>{summary.totalPoints} pts</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {competitionDraft && (
        <div className="modal-backdrop" onMouseDown={() => setCompetitionDraft(null)}>
          <section className="modal competition-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">{trainingCategoryLabel[competitionDraft.category]}</p><h2>Registrar punts</h2></div>
              <button className="modal-close" onClick={() => setCompetitionDraft(null)}>Tancar</button>
            </div>
            <label className="field"><span>Nom de la competició</span><input value={competitionDraft.title} onChange={(event) => setCompetitionDraft((previous) => previous ? { ...previous, title: event.target.value } : previous)} onBlur={saveCompetitionTitle} /></label>

            <div className="points-rule points-rule-cards">
              {[1, 2, 3, 4].map((place) => <span key={place} className={`place-rule place-${place}`}><b>{pointsForPlace(place)}</b><em>{pointsForPlace(place) === 1 ? 'punt' : 'punts'}</em></span>)}
              <small className="points-rule-note">Assigna directament els punts. Pots donar la mateixa puntuació a més d’un jugador.</small>
            </div>

            {competitionDraft.category === 'free_throw' && (
              <label className={`ft-bonus-toggle ${competitionDraft.freeThrowBonusMade ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={competitionDraft.freeThrowBonusMade}
                  onChange={(event) => setFreeThrowBonus(event.target.checked)}
                />
                <span className="ft-bonus-mark">2/2</span>
                <span className="ft-bonus-copy"><strong>2 FREE THROWS MADE</strong><small>Si s’activa, tots els jugadors presents que tenen 0 punts en aquesta competició reben +1 punt de Free Throws.</small></span>
                <span className="ft-bonus-switch" aria-hidden="true" />
              </label>
            )}

            <div className="ranking-entry-list">
              {sessionEligiblePlayers.map((player) => {
                const place = competitionDraft.placements[player.id] ?? null
                const present = selectedAttendance.get(player.id) === 'present' || !selectedSession?.counts_for_attendance
                return (
                  <div className={`ranking-entry ${present ? '' : 'player-absent'}`} key={player.id}>
                    <span className="training-jersey">{player.jersey_number || '–'}</span>
                    <strong>{player.name}</strong>
                    <div className="place-buttons">
                      {[1, 2, 3, 4].map((value) => (
                        <button key={value} className={place === value ? `selected place-${value}` : ''} disabled={!present} onClick={() => setCompetitionPlacement(player.id, value)}>
                          <b>{pointsForPlace(value)}</b><span>{pointsForPlace(value) === 1 ? 'punt' : 'punts'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className={`competition-autosave-status ${competitionSaveState}`}>
              <span aria-hidden="true" />
              <strong>{competitionSaveState === 'saving' ? 'Desant automàticament…' : competitionSaveState === 'error' ? 'Error en desar' : 'Resultats guardats automàticament'}</strong>
            </div>
          </section>
        </div>
      )}

      {showDeletePlayerPicker && (
        <div className="modal-backdrop" onMouseDown={() => setShowDeletePlayerPicker(false)}>
          <section className="modal delete-player-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">JUGADORS</p><h2>Eliminar jugador</h2><span>Selecciona el jugador que vols eliminar.</span></div>
              <button className="modal-close" onClick={() => setShowDeletePlayerPicker(false)}>Tancar</button>
            </div>
            <div className="delete-player-list">
              {players.map((player) => (
                <button key={player.id} className="delete-player-option" onClick={() => askDeletePlayer(player)}>
                  <span className="training-jersey">{player.jersey_number || '–'}</span>
                  <strong>{player.name}</strong>
                  <span>Eliminar</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        danger
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setConfirmState(null)}
        onConfirm={runConfirmation}
      />
    </main>
  )
}
