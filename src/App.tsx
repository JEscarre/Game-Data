import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Game, GameEvent, GamePlayer } from './types'
import { Login } from './components/Login'
import { Header } from './components/Header'
import { GamesDashboard } from './components/GamesDashboard'
import { GameSetup } from './components/GameSetup'
import { MatchConsole } from './components/MatchConsole'
import { TrainingDashboard } from './components/TrainingDashboard'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [section, setSection] = useState<'games' | 'training'>('games')
  const [selectedGameId, setSelectedGameId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('game-data.active-match') || null }
    catch { return null }
  })
  const selectedIdRef = useRef(selectedGameId)
  selectedIdRef.current = selectedGameId
  const requestSerial = useRef(0)
  const [loadError, setLoadError] = useState('')
  const [realtimeConnected, setRealtimeConnected] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [events, setEvents] = useState<GameEvent[]>([])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('No s’ha pogut recuperar la sessió:', error.message)
      setSession(data.session)
      setAuthReady(true)
    }).catch((error: unknown) => {
      console.error('Error recuperant la sessió:', error)
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setSelectedGameId(null)
        try { sessionStorage.removeItem('game-data.active-match') } catch { /* Storage disabled */ }
        setGame(null)
        setPlayers([])
        setEvents([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    try {
      if (selectedGameId) sessionStorage.setItem('game-data.active-match', selectedGameId)
      else sessionStorage.removeItem('game-data.active-match')
    } catch { /* Session storage may be disabled by the browser. */ }
  }, [selectedGameId])

  const loadGame = useCallback(async () => {
    if (!selectedGameId) return
    const requestedGameId = selectedGameId
    const serial = ++requestSerial.current
    try {
      const [gameResult, playersResult, eventsResult] = await Promise.all([
        supabase.from('games').select('*').eq('id', requestedGameId).single(),
        supabase.from('game_players').select('*').eq('game_id', requestedGameId).order('side').order('sort_order').order('created_at'),
        supabase.from('game_events').select('*').eq('game_id', requestedGameId).order('created_at'),
      ])
      if (selectedIdRef.current !== requestedGameId || serial !== requestSerial.current) return
      if (gameResult.error) throw gameResult.error
      if (playersResult.error) throw playersResult.error
      if (eventsResult.error) throw eventsResult.error
      setGame(gameResult.data as Game)
      setPlayers((playersResult.data ?? []) as GamePlayer[])
      setEvents((eventsResult.data ?? []) as GameEvent[])
      setLoadError('')
    } catch (error) {
      if (selectedIdRef.current !== requestedGameId || serial !== requestSerial.current) return
      setLoadError(error instanceof Error ? error.message : 'No s’han pogut recuperar les dades del partit.')
    }
  }, [selectedGameId])

  useEffect(() => {
    if (!selectedGameId || !session) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void loadGame(), 250)
    }
    void loadGame()
    setRealtimeConnected(true)
    const channel = supabase
      .channel(`game:${selectedGameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${selectedGameId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${selectedGameId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_events', filter: `game_id=eq.${selectedGameId}` }, scheduleReload)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { setRealtimeConnected(true); scheduleReload() }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeConnected(false)
      })

    // Recover after sleep, connection loss or a missed Realtime notification.
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void loadGame() }, 20000)
    const refresh = () => { if (document.visibilityState === 'visible') void loadGame() }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      ++requestSerial.current
      if (timer) clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
      void supabase.removeChannel(channel)
    }
  }, [selectedGameId, session?.user.id, loadGame])

  const closeGame = () => {
    ++requestSerial.current
    setSelectedGameId(null)
    setLoadError('')
    setGame(null)
    setPlayers([])
    setEvents([])
  }

  const navigate = (nextSection: 'games' | 'training') => {
    closeGame()
    setSection(nextSection)
  }

  if (!authReady) {
    return (
      <div className="splash">
        <img src="/kids-us-manresa.png" alt="Kids&Us Manresa" />
        <strong>Carregant</strong>
      </div>
    )
  }

  if (!session) return <Login />

  if (selectedGameId && !game) {
    return (
      <main className="splash" role="status">
        <img src="/kids-us-manresa.png" alt="Kids&Us Manresa" />
        <strong>{loadError ? 'No s’ha pogut obrir el partit' : 'Recuperant el partit…'}</strong>
        {loadError && <><p className="error-banner">{loadError}</p><button className="button primary" onClick={() => void loadGame()}>Reintentar</button><button className="back-link" onClick={closeGame}>Tornar als partits</button></>}
      </main>
    )
  }

  if (selectedGameId && game) {
    return game.status === 'draft' ? (
      <>
        <Header section="games" onNavigate={navigate} />
        {(loadError || !realtimeConnected) && <div className="sync-warning" role="alert">{loadError || 'Sincronització en temps real interrompuda. Es continuarà intentant recuperar.'} <button onClick={() => void loadGame()}>Reintentar</button></div>}
        <GameSetup game={game} players={players} onReload={loadGame} onBack={closeGame} />
      </>
    ) : (
      <>
        {(loadError || !realtimeConnected) && <div className="sync-warning" role="alert">{loadError || 'Sincronització en temps real interrompuda. Es continuarà intentant recuperar.'} <button onClick={() => void loadGame()}>Reintentar</button></div>}
        <MatchConsole game={game} players={players} events={events} onReload={loadGame} onBack={closeGame} />
      </>
    )
  }

  return (
    <>
      <Header section={section} onNavigate={navigate} />
      {section === 'games' ? <GamesDashboard onOpenGame={(id) => { setLoadError(''); setGame(null); setPlayers([]); setEvents([]); setSelectedGameId(id) }} /> : <TrainingDashboard />}
    </>
  )
}

export default App
