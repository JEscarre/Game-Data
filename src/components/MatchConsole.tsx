import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  currentLineup,
  deriveFouls,
  derivePlayerStats,
  deriveScore,
  deriveScoreTimeline,
  deriveTimeoutSlots,
  formatClock,
  formatPlayed,
  nextThirtySeconds,
  parseClock,
  periodDuration,
  periodLabel,
  timeoutSlotHalf,
  timeoutSlots,
  type TimeoutSlot,
} from '../lib/game'
import type { Game, GameEvent, GamePlayer, PlayerPosition, Side } from '../types'
import { ConfirmDialog } from './ConfirmDialog'


interface MatchConfirmState {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  action: () => Promise<void>
}

interface MatchConsoleProps {
  game: Game
  players: GamePlayer[]
  events: GameEvent[]
  onReload: () => Promise<void>
  onBack: () => void
}

const positionLabel: Record<PlayerPosition, string> = {
  guard: 'Guard',
  wing: 'Wing',
  big: 'Big',
}

const foulLevelClass = (count: number) => `foul-level-${Math.max(0, Math.min(count, 5))}`

export function MatchConsole({ game, players, events, onReload, onBack }: MatchConsoleProps) {
  const [clockDraft, setClockDraft] = useState(formatClock(game.current_clock_seconds))
  const [subOut, setSubOut] = useState<GamePlayer | null>(null)
  const [subIn, setSubIn] = useState<GamePlayer | null>(null)
  const [subClock, setSubClock] = useState(formatClock(game.current_clock_seconds))
  const [tab, setTab] = useState<'control' | 'fouls' | 'timeline'>('control')
  const [confirmState, setConfirmState] = useState<MatchConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [newRosterPlayer, setNewRosterPlayer] = useState({
    side: 'home' as Side,
    number: '',
    name: '',
    position: 'guard' as PlayerPosition,
  })

  useEffect(() => {
    setClockDraft(formatClock(game.current_clock_seconds))
  }, [game.current_clock_seconds, game.current_period])

  const score = useMemo(() => deriveScore(events), [events])
  const scoreTimeline = useMemo(() => deriveScoreTimeline(events), [events])
  const playerStats = useMemo(() => derivePlayerStats(game, players, events), [game, players, events])
  const lineup = useMemo(() => currentLineup(game, players, events), [game, players, events])
  const homePlayers = useMemo(() => players.filter((player) => player.side === 'home'), [players])
  const awayPlayers = useMemo(() => players.filter((player) => player.side === 'away'), [players])
  const bench = homePlayers.filter((player) => !playerStats.get(player.id)?.onCourt)
  const fouls = useMemo(() => deriveFouls(events), [events])
  const timeoutState = useMemo(() => deriveTimeoutSlots(events), [events])
  const activeEvents = useMemo(() => events.filter((event) => !event.undone_at), [events])
  const teamFoulsHome = fouls.bySidePeriod.get(`home:${game.current_period}`) ?? 0
  const teamFoulsAway = fouls.bySidePeriod.get(`away:${game.current_period}`) ?? 0
  const nextStep = nextThirtySeconds(game.current_clock_seconds)
  const currentHalf = game.current_period <= 2 ? 1 : 2
  const isFinished = game.status === 'finished'
  const validInitialLineup = useMemo(
    () => (game.initial_lineup ?? []).filter((id) => homePlayers.some((player) => player.id === id)),
    [game.initial_lineup, homePlayers],
  )

  const updateClock = async (period: number, clockSeconds: number, registerLineup = false, source = 'manual') => {
    const { error } = await supabase
      .from('games')
      .update({ current_period: period, current_clock_seconds: clockSeconds })
      .eq('id', game.id)

    if (error) return alert(error.message)

    if (registerLineup) {
      const ids = lineup.map((player) => player.id)
      const { error: eventError } = await supabase.from('game_events').insert({
        game_id: game.id,
        event_type: 'lineup_check',
        side: 'home',
        period,
        clock_seconds: clockSeconds,
        metadata: { player_ids: ids, source },
      })
      if (eventError) return alert(eventError.message)
    }

    setClockDraft(formatClock(clockSeconds))
    await onReload()
  }

  const saveClockDraft = async () => {
    const parsed = parseClock(clockDraft, periodDuration(game.current_period))
    if (parsed === null) return alert('Temps no vàlid. Utilitza un format com 6:37.')
    await updateClock(game.current_period, parsed, true, 'manual')
  }

  const confirmNextStep = async () => {
    if (game.current_clock_seconds === 0) return
    await updateClock(game.current_period, nextStep, true, 'half-minute')
  }

  const addEvent = async (payload: Partial<GameEvent>) => {
    const { error } = await supabase.from('game_events').insert({
      game_id: game.id,
      period: game.current_period,
      clock_seconds: game.current_clock_seconds,
      metadata: {},
      ...payload,
    })

    if (error) return alert(error.message)
    await onReload()
  }

  const addScore = (side: Side, points: number) => addEvent({ event_type: 'score', side, points })

  const addFoul = async (player: GamePlayer) => {
    const current = playerStats.get(player.id)?.fouls ?? 0
    if (current >= 5) {
      setConfirmState({
        title: 'Afegir una altra falta?',
        message: `${player.name} ja consta amb 5 faltes. Confirma només si vols corregir o registrar una situació excepcional.`,
        confirmLabel: 'Afegir falta',
        action: async () => { await addEvent({ event_type: 'foul', side: player.side, player_id: player.id }) },
      })
      return
    }
    await addEvent({ event_type: 'foul', side: player.side, player_id: player.id })
  }

  const removeLastFoul = async (player: GamePlayer) => {
    const last = activeEvents
      .filter((event) => event.event_type === 'foul' && event.player_id === player.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    if (!last) return
    const { error } = await supabase.rpc('undo_event', { p_event_id: last.id })
    if (error) return alert(error.message)
    await onReload()
  }

  const toggleTimeout = async (side: Side, slot: TimeoutSlot) => {
    const existing = timeoutState[side].get(slot)

    if (existing) {
      const { error } = await supabase.rpc('undo_event', { p_event_id: existing.id })
      if (error) return alert(error.message)
      await onReload()
      return
    }

    const slotHalf = timeoutSlotHalf(slot)
    if (slotHalf !== currentHalf) return

    await addEvent({
      event_type: 'timeout',
      side,
      metadata: { slot, half: slotHalf },
    })
  }

  const openSubstitution = (player: GamePlayer) => {
    if (isFinished) return
    setSubOut(player)
    setSubIn(null)
    setSubClock(formatClock(game.current_clock_seconds))
  }

  const saveSubstitution = async () => {
    if (!subOut || !subIn) return
    if (!playerStats.get(subOut.id)?.onCourt) return alert(`${subOut.name} ja no consta a pista.`)
    if (playerStats.get(subIn.id)?.onCourt) return alert(`${subIn.name} ja consta a pista.`)

    const parsed = parseClock(subClock, periodDuration(game.current_period))
    if (parsed === null) return alert('Temps de canvi no vàlid. Utilitza un format com 6:37.')

    const incomingStats = playerStats.get(subIn.id)
    if ((incomingStats?.fouls ?? 0) >= 5) return alert(`${subIn.name} té 5 faltes i no pot tornar a pista.`)

    const { error: eventError } = await supabase.from('game_events').insert({
      game_id: game.id,
      event_type: 'substitution',
      side: 'home',
      player_id: subOut.id,
      related_player_id: subIn.id,
      period: game.current_period,
      clock_seconds: parsed,
      metadata: {},
    })

    if (eventError) return alert(eventError.message)

    const { error: gameError } = await supabase
      .from('games')
      .update({ current_clock_seconds: parsed })
      .eq('id', game.id)

    if (gameError) return alert(gameError.message)

    setSubOut(null)
    setSubIn(null)
    setSubClock(formatClock(parsed))
    setClockDraft(formatClock(parsed))
    await onReload()
  }

  const restoreClockAfterUndo = async (eventId: string) => {
    const clockEvents = activeEvents
      .filter((event) => event.id !== eventId && (event.event_type === 'substitution' || event.event_type === 'lineup_check'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const previous = clockEvents[0]
    const period = previous?.period ?? 1
    const clockSeconds = previous?.clock_seconds ?? 600

    const { error } = await supabase
      .from('games')
      .update({ current_period: period, current_clock_seconds: clockSeconds })
      .eq('id', game.id)

    if (error) alert(error.message)
  }

  const undoLast = async () => {
    const target = [...activeEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    const { data, error } = await supabase.rpc('undo_last_event', { p_game_id: game.id })
    if (error) return alert(error.message)
    if (!data) return alert('No hi ha cap acció per desfer.')

    if (target && (target.event_type === 'substitution' || target.event_type === 'lineup_check')) {
      await restoreClockAfterUndo(target.id)
    }

    await onReload()
  }

  const undoSpecific = async (eventId: string) => {
    const target = activeEvents.find((event) => event.id === eventId)
    const latestClockEvent = [...activeEvents]
      .filter((event) => event.event_type === 'substitution' || event.event_type === 'lineup_check')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    const { error } = await supabase.rpc('undo_event', { p_event_id: eventId })
    if (error) return alert(error.message)

    if (target && latestClockEvent?.id === target.id) {
      await restoreClockAfterUndo(target.id)
    }

    await onReload()
  }

  const nextPeriod = async () => {
    const next = game.current_period + 1
    await updateClock(next, periodDuration(next), true, 'period')
  }

  const finishGame = () => {
    setConfirmState({
      title: 'Finalitzar partit?',
      message: 'El partit quedarà marcat com a finalitzat. El podràs reobrir més endavant si cal.',
      confirmLabel: 'Finalitzar partit',
      action: async () => {
        const { error } = await supabase.from('games').update({ status: 'finished' }).eq('id', game.id)
        if (error) return alert(error.message)
        await onReload()
      },
    })
  }

  const resumeGame = async () => {
    const { error } = await supabase.from('games').update({ status: 'live' }).eq('id', game.id)
    if (error) return alert(error.message)
    await onReload()
  }

  const resetGame = () => {
    setConfirmState({
      title: 'Reiniciar dades del partit?',
      message: 'S’esborraran marcador, canvis, faltes i temps morts. Es conservaran els jugadors i els titulars.',
      confirmLabel: 'Reiniciar partit',
      danger: true,
      action: async () => {
        const { error } = await supabase.rpc('reset_game', { p_game_id: game.id })
        if (error) return alert(error.message)
        setClockDraft('10:00')
        await onReload()
      },
    })
  }

  const deleteGame = () => {
    setConfirmState({
      title: 'Eliminar partit?',
      message: 'S’eliminarà definitivament aquest partit de l’historial, amb totes les dades registrades. Aquesta acció no es pot desfer.',
      confirmLabel: 'Eliminar partit',
      danger: true,
      action: async () => {
        const { error } = await supabase.from('games').delete().eq('id', game.id)
        if (error) return alert(error.message)
        onBack()
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

  const savePlayerPatch = async (player: GamePlayer, patch: Partial<GamePlayer>) => {
    const cleanedPatch: Partial<GamePlayer> = { ...patch }
    if (typeof cleanedPatch.name === 'string') {
      cleanedPatch.name = cleanedPatch.name.trim()
      if (!cleanedPatch.name) return
    }
    if (typeof cleanedPatch.jersey_number === 'string') cleanedPatch.jersey_number = cleanedPatch.jersey_number.trim()

    const { error } = await supabase.from('game_players').update(cleanedPatch).eq('id', player.id)
    if (error) return alert(error.message)
    await onReload()
  }

  const addRosterPlayer = async (event: FormEvent) => {
    event.preventDefault()
    if (!newRosterPlayer.name.trim()) return

    const sidePlayers = players.filter((player) => player.side === newRosterPlayer.side)
    const { error } = await supabase.from('game_players').insert({
      game_id: game.id,
      side: newRosterPlayer.side,
      name: newRosterPlayer.name.trim(),
      jersey_number: newRosterPlayer.number.trim(),
      position: newRosterPlayer.position,
      sort_order: sidePlayers.length,
    })

    if (error) return alert(error.message)
    setNewRosterPlayer((previous) => ({ ...previous, number: '', name: '' }))
    await onReload()
  }

  const toggleInitialStarter = async (player: GamePlayer) => {
    if (player.side !== 'home') return
    const current = validInitialLineup
    const selected = current.includes(player.id)
    if (!selected && current.length >= 5) return

    const next = selected ? current.filter((id) => id !== player.id) : [...current, player.id]
    const { error } = await supabase.from('games').update({ initial_lineup: next }).eq('id', game.id)
    if (error) return alert(error.message)
    await onReload()
  }

  const requestDeletePlayer = (player: GamePlayer) => {
    const linkedEvents = activeEvents.filter(
      (event) => event.player_id === player.id || event.related_player_id === player.id,
    ).length
    const isStarter = validInitialLineup.includes(player.id)
    const details = [
      isStarter ? 'També es traurà del quintet inicial.' : '',
      linkedEvents > 0 ? `Té ${linkedEvents} acció${linkedEvents === 1 ? '' : 'ns'} vinculada${linkedEvents === 1 ? '' : 'es'}; en eliminar-lo també s’eliminaran aquestes accions.` : '',
    ].filter(Boolean).join(' ')

    setConfirmState({
      title: `Eliminar ${player.name}?`,
      message: `El jugador s’eliminarà d’aquest partit. ${details} Aquesta acció no es pot desfer.`.trim(),
      confirmLabel: 'Eliminar jugador',
      danger: true,
      action: async () => {
        if (isStarter) {
          const { error: lineupError } = await supabase
            .from('games')
            .update({ initial_lineup: validInitialLineup.filter((id) => id !== player.id) })
            .eq('id', game.id)
          if (lineupError) return alert(lineupError.message)
        }

        const { error } = await supabase.from('game_players').delete().eq('id', player.id)
        if (error) return alert(error.message)
        if (subOut?.id === player.id) setSubOut(null)
        if (subIn?.id === player.id) setSubIn(null)
        await onReload()
      },
    })
  }

  const openRosterManager = () => setRosterOpen(true)

  const describeEvent = (event: GameEvent) => {
    const player = players.find((item) => item.id === event.player_id)
    const related = players.find((item) => item.id === event.related_player_id)

    if (event.event_type === 'score') return `${event.side === 'home' ? 'Kids&Us' : game.opponent_name} +${event.points}`
    if (event.event_type === 'foul') return `Falta · ${player?.jersey_number ? `#${player.jersey_number} ` : ''}${player?.name ?? 'Jugador'}`
    if (event.event_type === 'timeout') return `Temps mort · ${event.side === 'home' ? 'Kids&Us' : game.opponent_name}`
    if (event.event_type === 'substitution') return `Canvi · surt ${player?.name ?? '?'} · entra ${related?.name ?? '?'}`

    const source = event.metadata?.source
    if (source === 'manual') return 'Temps actualitzat manualment'
    if (source === 'period') return `Inici de ${periodLabel(event.period)}`

    const ids = Array.isArray(event.metadata?.player_ids) ? event.metadata.player_ids as string[] : []
    const names = ids.map((id) => players.find((item) => item.id === id)?.name).filter(Boolean).join(', ')
    return names ? `Alineació confirmada · ${names}` : 'Alineació confirmada'
  }

  const scoreHistoryByEvent = new Map(scoreTimeline.map((step) => [step.eventId, `${step.home}–${step.away}`]))
  const timeline = [...activeEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const renderPosition = (player: GamePlayer) => (
    <span className={`position-badge pos-${player.position ?? 'none'}`}>
      {player.position ? positionLabel[player.position] : 'Sense posició'}
    </span>
  )

  const renderFoulTeam = (teamPlayers: GamePlayer[], side: Side) => {
    const teamFouls = side === 'home' ? teamFoulsHome : teamFoulsAway

    return (
      <div className="foul-team">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">{side === 'home' ? 'LOCAL' : 'RIVAL'}</p>
            <h3>{side === 'home' ? 'Kids&Us Manresa' : game.opponent_name}</h3>
          </div>
          <div className={`team-foul-badge ${teamFouls >= 5 ? 'warning' : ''}`}>
            {periodLabel(game.current_period)} · <strong>{teamFouls}</strong> faltes d’equip
          </div>
        </div>

        <div className="foul-list">
          {teamPlayers.map((player) => {
            const count = playerStats.get(player.id)?.fouls ?? 0

            return (
              <div className={`foul-row ${foulLevelClass(count)}`} key={player.id}>
                <button className="player-name-button" onClick={openRosterManager} title="Editar plantilla">
                  <span className={`jersey pos-border-${player.position ?? 'none'}`}>{player.jersey_number || '–'}</span>
                  <span className="foul-player-copy">
                    <strong>{player.name}</strong>
                    {renderPosition(player)}
                  </span>
                </button>

                <div className={`foul-count ${foulLevelClass(count)}`}><b>F {count}</b><small>/5</small></div>

                <div className="foul-dots" aria-label={`${count} faltes`}>
                  {[1, 2, 3, 4, 5].map((number) => (
                    <span key={number} className={`${number <= count ? 'filled' : ''} dot-${number}`} />
                  ))}
                </div>

                <div className="stepper">
                  <button onClick={() => removeLastFoul(player)} disabled={count === 0}>−</button>
                  <button onClick={() => addFoul(player)}>+</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderTimeoutTeam = (side: Side, label: string) => (
    <div className="timeout-team">
      <div className="timeout-team-name">{label}</div>
      <div className="timeout-halves">
        <div>
          <span className="timeout-half-label">1a part</span>
          <div className="timeout-slots">
            {timeoutSlots.slice(0, 2).map((slot, index) => {
              const used = timeoutState[side].has(slot)
              const disabled = !used && currentHalf !== 1
              return (
                <button
                  key={slot}
                  className={`timeout-slot ${used ? 'used' : ''}`}
                  disabled={disabled || isFinished}
                  onClick={() => toggleTimeout(side, slot)}
                  title={used ? 'Temps mort gastat. Toca per corregir.' : disabled ? 'Només disponible a la primera part.' : 'Registrar temps mort'}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <span className="timeout-half-label">2a part</span>
          <div className="timeout-slots">
            {timeoutSlots.slice(2).map((slot, index) => {
              const used = timeoutState[side].has(slot)
              const disabled = !used && currentHalf !== 2
              return (
                <button
                  key={slot}
                  className={`timeout-slot ${used ? 'used' : ''}`}
                  disabled={disabled || isFinished}
                  onClick={() => toggleTimeout(side, slot)}
                  title={used ? 'Temps mort gastat. Toca per corregir.' : disabled ? 'Només disponible a la segona part.' : 'Registrar temps mort'}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <main className="match-shell">
      <div className="match-topbar">
        <div className="match-back-brand">
          <img src="/kids-us-manresa.png" alt="Kids&Us Manresa" />
          <button className="back-link light" onClick={onBack}>← Partits</button>
        </div>
        <div className="game-meta-inline">
          <span>{new Date(`${game.game_date}T12:00:00`).toLocaleDateString('ca-ES')}</span>
          <strong>{isFinished ? 'FINALITZAT' : 'EN CURS'}</strong>
        </div>
        <div className="match-topbar-actions">
          <button className="button ghost-on-dark" onClick={openRosterManager}>Jugadors i titulars</button>
          <button className="button ghost-on-dark" onClick={undoLast}>Desfer última acció</button>
        </div>
      </div>

      <section className="scoreboard">
        <div className="score-team home-team">
          <span className="score-label">KIDS&US MANRESA</span>
          <strong className="score-number">{score.home}</strong>
          <div className="score-buttons">
            {[1, 2, 3].map((points) => (
              <button key={points} disabled={isFinished} onClick={() => addScore('home', points)}>+{points}</button>
            ))}
          </div>
          <div className={`score-team-fouls ${teamFoulsHome >= 5 ? 'warning' : ''}`}>
            <div><span>FALTES {periodLabel(game.current_period)}</span><strong>{teamFoulsHome}</strong></div>
            <div className="score-foul-meter" aria-label={`${teamFoulsHome} faltes d’equip`}>
              {[1, 2, 3, 4, 5].map((value) => <i key={value} className={value <= Math.min(teamFoulsHome, 5) ? 'filled' : ''} />)}
            </div>
          </div>
        </div>

        <div className="game-clock-box">
          <span className="period-pill">{periodLabel(game.current_period)}</span>
          <strong className="clock-main">{formatClock(game.current_clock_seconds)}</strong>
          <div className="clock-manual">
            <input
              value={clockDraft}
              onChange={(event) => setClockDraft(event.target.value)}
              inputMode="numeric"
              aria-label="Temps manual"
              disabled={isFinished}
            />
            <button onClick={saveClockDraft} disabled={isFinished}>Actualitza</button>
          </div>
          <button className="minute-button" onClick={confirmNextStep} disabled={game.current_clock_seconds === 0 || isFinished}>
            <span>PASSAR 30 SEGONS</span>
            <strong>{formatClock(game.current_clock_seconds)} → {formatClock(nextStep)}</strong>
          </button>
        </div>

        <div className="score-team away-team">
          <span className="score-label">{game.opponent_name.toUpperCase()}</span>
          <strong className="score-number">{score.away}</strong>
          <div className="score-buttons">
            {[1, 2, 3].map((points) => (
              <button key={points} disabled={isFinished} onClick={() => addScore('away', points)}>+{points}</button>
            ))}
          </div>
          <div className={`score-team-fouls ${teamFoulsAway >= 5 ? 'warning' : ''}`}>
            <div><span>FALTES {periodLabel(game.current_period)}</span><strong>{teamFoulsAway}</strong></div>
            <div className="score-foul-meter" aria-label={`${teamFoulsAway} faltes d’equip`}>
              {[1, 2, 3, 4, 5].map((value) => <i key={value} className={value <= Math.min(teamFoulsAway, 5) ? 'filled' : ''} />)}
            </div>
          </div>
        </div>
      </section>

      <div className="mobile-tabs">
        <button className={tab === 'control' ? 'active' : ''} onClick={() => setTab('control')}>Pista</button>
        <button className={tab === 'fouls' ? 'active' : ''} onClick={() => setTab('fouls')}>Faltes</button>
        <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Cronologia</button>
      </div>

      <div className="match-grid">
        <div className={`match-main ${tab !== 'control' ? 'mobile-hidden' : ''}`}>
          <section className="panel rotation-panel">
            <div className="section-heading">
              <div><p className="eyebrow">ROTACIÓ ACTUAL</p><h2>Jugadors a pista</h2></div>
              <div className="rotation-heading-actions">
                <span className="hint">Toca un jugador per fer una substitució</span>
                <button className="button secondary compact" onClick={openRosterManager}>Editar quintet / plantilla</button>
              </div>
            </div>

            <div className="court-grid">
              {lineup.length === 0 && (
                <button type="button" className="lineup-empty-state" onClick={openRosterManager}>
                  <strong>Encara no hi ha cap jugador a pista</strong>
                  <span>Obre “Jugadors i titulars” i selecciona els titulars quan els tinguis.</span>
                </button>
              )}
              {lineup.map((player) => {
                const stats = playerStats.get(player.id)!
                const alert = stats.stintSeconds > 180
                const fouledOut = stats.fouls >= 5

                return (
                  <button
                    key={player.id}
                    className={`court-player pos-card-${player.position ?? 'none'} ${alert ? 'stint-alert' : ''} ${fouledOut ? 'court-fouled-out' : ''}`}
                    onClick={() => openSubstitution(player)}
                    disabled={isFinished}
                  >
                    <div className="player-card-top">
                      <span className={`jersey large-jersey pos-border-${player.position ?? 'none'}`}>{player.jersey_number || '–'}</span>
                      <div className="player-card-badges">
                        {renderPosition(player)}
                        <span className={`court-foul-badge ${foulLevelClass(stats.fouls)}`}>
                          <b>F {stats.fouls}</b><small>/5</small>
                        </span>
                      </div>
                    </div>
                    <strong className="player-card-name">{player.name}</strong>
                    <div className="player-stat-line"><span>Seguit</span><b>{formatPlayed(stats.stintSeconds)}</b></div>
                    <div className="player-stat-line"><span>Total</span><b>{formatPlayed(stats.totalSeconds)}</b></div>
                    <div className={`player-card-footer ${foulLevelClass(stats.fouls)}`}>
                      <span>{stats.fouls} faltes</span>
                      {fouledOut ? <strong>ELIMINAT</strong> : alert ? <strong>MÉS DE 3:00</strong> : <span>En pista</span>}
                    </div>
                  </button>
                )
              })}

              {lineup.length < 5 && (
                <div className="lineup-error">Hi ha {lineup.length} jugadors a pista. Completa o corregeix el quintet des de “Jugadors i titulars”.</div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div><p className="eyebrow">BANQUETA</p><h2>Jugadors disponibles</h2></div>
              <span>{bench.filter((player) => (playerStats.get(player.id)?.fouls ?? 0) < 5).length} disponibles</span>
            </div>

            <div className="bench-grid">
              {bench.map((player) => {
                const stats = playerStats.get(player.id)!
                const disqualified = stats.fouls >= 5

                return (
                  <div key={player.id} className={`bench-player pos-card-${player.position ?? 'none'} ${disqualified ? 'disabled-player' : ''}`}>
                    <span className={`jersey pos-border-${player.position ?? 'none'}`}>{player.jersey_number || '–'}</span>
                    <span className="bench-name">
                      <strong>{player.name}</strong>
                      <small>Total {formatPlayed(stats.totalSeconds)}</small>
                    </span>
                    <span className={`bench-foul-badge ${foulLevelClass(stats.fouls)}`}>F {stats.fouls}/5</span>
                    {renderPosition(player)}
                    <button className="bench-edit" onClick={openRosterManager}>Editar</button>
                    {disqualified && <span className="eliminated-tag">5 F · ELIMINAT</span>}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel timeouts-panel">
            <div className="section-heading">
              <div><p className="eyebrow">TEMPS MORTS</p><h2>Control per meitats</h2></div>
              <span className="hint">Vermell = gastat. Toca un gastat per corregir-lo.</span>
            </div>
            <div className="timeout-grid">
              {renderTimeoutTeam('home', 'Kids&Us Manresa')}
              {renderTimeoutTeam('away', game.opponent_name)}
            </div>
          </section>

          <section className="panel period-panel">
            <div className="period-actions">
              <button className="button secondary" onClick={() => updateClock(game.current_period, 0, true, 'manual')} disabled={isFinished}>Final del període</button>
              <button className="button secondary" onClick={nextPeriod} disabled={isFinished}>{game.current_period < 4 ? `Anar a Q${game.current_period + 1}` : `Anar a ${periodLabel(game.current_period + 1)}`}</button>
              {game.status === 'live' ? (
                <button className="button success" onClick={finishGame}>Finalitzar partit</button>
              ) : (
                <button className="button success" onClick={resumeGame}>Reobrir partit</button>
              )}
            </div>
          </section>
        </div>

        <aside className={`match-side ${tab !== 'fouls' ? 'mobile-hidden-on-tab' : ''}`}>
          <section className="panel fouls-panel">
            <div className="section-heading">
              <div><p className="eyebrow">FALTES</p><h2>Dos equips</h2></div>
            </div>
            {renderFoulTeam(homePlayers, 'home')}
            {renderFoulTeam(awayPlayers, 'away')}
          </section>
        </aside>

        <aside className={`match-timeline ${tab !== 'timeline' ? 'mobile-hidden-on-tab' : ''}`}>
          <section className="panel timeline-panel">
            <div className="section-heading">
              <div><p className="eyebrow">CRONOLOGIA</p><h2>Partit</h2></div>
              <span>{activeEvents.length} accions</span>
            </div>

            <div className="timeline-list">
              {timeline.length === 0 ? (
                <p className="empty-inline">Encara no hi ha accions.</p>
              ) : (
                timeline.map((event) => (
                  <div className={`timeline-item type-${event.event_type}`} key={event.id}>
                    <div className="timeline-time"><strong>{periodLabel(event.period)}</strong><span>{formatClock(event.clock_seconds)}</span></div>
                    <div className="timeline-copy">
                      <strong>{describeEvent(event)}</strong>
                      {event.event_type === 'score' && <span>Marcador: {scoreHistoryByEvent.get(event.id)}</span>}
                    </div>
                    <button className="timeline-undo" onClick={() => undoSpecific(event.id)} title="Desfer aquesta acció">Desfer</button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel score-history-panel">
            <div className="section-heading"><div><p className="eyebrow">MARCADOR</p><h2>Cronologia</h2></div></div>
            <div className="score-history">
              <span className="score-chip">0–0</span>
              {scoreTimeline.map((step) => <span className="score-chip" key={step.eventId}>{step.home}–{step.away}</span>)}
            </div>
          </section>
        </aside>
      </div>

      <section className="danger-zone">
        <button className="button danger-outline" onClick={resetGame}>Reiniciar dades del partit</button>
        <button className="button danger-outline" onClick={deleteGame}>Eliminar partit</button>
      </section>

      {rosterOpen && (
        <div className="modal-backdrop" onMouseDown={() => setRosterOpen(false)}>
          <section className="modal roster-manager-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header roster-modal-header">
              <div>
                <p className="eyebrow">PARTIT EN CURS</p>
                <h2>Jugadors i quintet inicial</h2>
                <span>Pots afegir, editar o eliminar jugadors dels dos equips en qualsevol moment.</span>
              </div>
              <button className="modal-close" onClick={() => setRosterOpen(false)}>Tancar</button>
            </div>

            <div className="live-lineup-summary">
              <div>
                <span>QUINTET INICIAL KIDS&US</span>
                <strong>{validInitialLineup.length}/5</strong>
              </div>
              <p>Seleccionar un titular aquí recalcula els minuts des de l’inici del partit. Pots corregir-ho encara que el partit ja hagi començat.</p>
            </div>

            <form className="live-add-player-form" onSubmit={addRosterPlayer}>
              <div className="live-add-copy">
                <span>AFEGIR JUGADOR</span>
                <strong>Nou jugador al partit</strong>
              </div>
              <select
                value={newRosterPlayer.side}
                onChange={(event) => setNewRosterPlayer((previous) => ({ ...previous, side: event.target.value as Side }))}
                aria-label="Equip"
              >
                <option value="home">Kids&Us</option>
                <option value="away">Rival</option>
              </select>
              <input
                value={newRosterPlayer.number}
                onChange={(event) => setNewRosterPlayer((previous) => ({ ...previous, number: event.target.value }))}
                placeholder="Dorsal"
                aria-label="Dorsal nou jugador"
              />
              <input
                value={newRosterPlayer.name}
                onChange={(event) => setNewRosterPlayer((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="Nom del jugador"
                aria-label="Nom nou jugador"
              />
              <select
                className={`position-select pos-${newRosterPlayer.position}`}
                value={newRosterPlayer.position}
                onChange={(event) => setNewRosterPlayer((previous) => ({ ...previous, position: event.target.value as PlayerPosition }))}
                aria-label="Posició nou jugador"
              >
                <option value="guard">Guard</option>
                <option value="wing">Wing</option>
                <option value="big">Big</option>
              </select>
              <button className="button primary">Afegir</button>
            </form>

            <div className="live-roster-columns">
              {(['home', 'away'] as Side[]).map((side) => {
                const teamPlayers = side === 'home' ? homePlayers : awayPlayers
                return (
                  <section className="live-roster-team" key={side}>
                    <div className="live-roster-team-heading">
                      <div>
                        <span>{side === 'home' ? 'LOCAL' : 'RIVAL'}</span>
                        <strong>{side === 'home' ? 'Kids&Us Manresa' : game.opponent_name}</strong>
                      </div>
                      <b>{teamPlayers.length} jugadors</b>
                    </div>

                    <div className="live-roster-list">
                      {teamPlayers.length === 0 ? (
                        <p className="empty-inline">Encara no hi ha jugadors.</p>
                      ) : teamPlayers.map((player) => {
                        const selectedStarter = validInitialLineup.includes(player.id)
                        const starterBlocked = side === 'home' && !selectedStarter && validInitialLineup.length >= 5
                        return (
                          <div className="live-roster-row" key={player.id}>
                            {side === 'home' ? (
                              <button
                                type="button"
                                className={`live-starter-toggle ${selectedStarter ? 'selected' : ''}`}
                                disabled={starterBlocked}
                                onClick={() => void toggleInitialStarter(player)}
                              >
                                {selectedStarter ? 'Titular' : 'Banqueta'}
                              </button>
                            ) : (
                              <span className="live-rival-tag">Rival</span>
                            )}

                            <input
                              key={`${player.id}-number-${player.jersey_number}`}
                              defaultValue={player.jersey_number}
                              onBlur={(event) => void savePlayerPatch(player, { jersey_number: event.target.value })}
                              aria-label={`Dorsal ${player.name}`}
                              placeholder="#"
                            />
                            <input
                              key={`${player.id}-name-${player.name}`}
                              defaultValue={player.name}
                              onBlur={(event) => void savePlayerPatch(player, { name: event.target.value })}
                              aria-label={`Nom ${player.name}`}
                            />
                            <select
                              className={`position-select pos-${player.position ?? 'guard'}`}
                              value={player.position ?? 'guard'}
                              onChange={(event) => void savePlayerPatch(player, { position: event.target.value as PlayerPosition })}
                              aria-label={`Posició ${player.name}`}
                            >
                              <option value="guard">Guard</option>
                              <option value="wing">Wing</option>
                              <option value="big">Big</option>
                            </select>
                            <button type="button" className="live-delete-player" onClick={() => requestDeletePlayer(player)}>Eliminar</button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {subOut && (
        <div className="modal-backdrop" onMouseDown={() => setSubOut(null)}>
          <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">SUBSTITUCIÓ</p><h2>Surt {subOut.name}</h2></div>
              <button className="modal-close" onClick={() => setSubOut(null)}>Tancar</button>
            </div>

            <label className="field substitution-clock">
              <span>Moment exacte · {periodLabel(game.current_period)}</span>
              <input value={subClock} onChange={(event) => setSubClock(event.target.value)} inputMode="numeric" />
              <small>Per defecte apareix l’últim temps registrat.</small>
            </label>

            <div className="modal-player-grid">
              {bench.map((player) => {
                const stats = playerStats.get(player.id)!
                const disabled = stats.fouls >= 5

                return (
                  <button
                    key={player.id}
                    disabled={disabled}
                    className={`modal-player pos-card-${player.position ?? 'none'} ${subIn?.id === player.id ? 'selected' : ''}`}
                    onClick={() => setSubIn(player)}
                  >
                    <span className={`jersey pos-border-${player.position ?? 'none'}`}>{player.jersey_number || '–'}</span>
                    <strong>{player.name}</strong>
                    <small>{stats.fouls} faltes · total {formatPlayed(stats.totalSeconds)}</small>
                    {renderPosition(player)}
                  </button>
                )
              })}
            </div>

            <button className="button primary large full-width" onClick={saveSubstitution} disabled={!subIn}>Confirmar canvi</button>
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        danger={confirmState?.danger}
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setConfirmState(null)}
        onConfirm={runConfirmation}
      />
    </main>
  )
}
