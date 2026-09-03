import { useCallback, useEffect, useState } from 'react'
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
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [events, setEvents] = useState<GameEvent[]>([])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setSelectedGameId(null)
        setGame(null)
        setPlayers([])
        setEvents([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadGame = useCallback(async () => {
    if (!selectedGameId) return

    const [gameResult, playersResult, eventsResult] = await Promise.all([
      supabase.from('games').select('*').eq('id', selectedGameId).single(),
      supabase.from('game_players').select('*').eq('game_id', selectedGameId).order('side').order('sort_order').order('created_at'),
      supabase.from('game_events').select('*').eq('game_id', selectedGameId).order('created_at'),
    ])

    if (gameResult.error) return alert(gameResult.error.message)
    if (playersResult.error) return alert(playersResult.error.message)
    if (eventsResult.error) return alert(eventsResult.error.message)

    setGame(gameResult.data as Game)
    setPlayers((playersResult.data ?? []) as GamePlayer[])
    setEvents((eventsResult.data ?? []) as GameEvent[])
  }, [selectedGameId])

  useEffect(() => {
    if (!selectedGameId || !session) return

    void loadGame()

    const channel = supabase
      .channel(`game:${selectedGameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${selectedGameId}` }, () => void loadGame())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${selectedGameId}` }, () => void loadGame())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_events', filter: `game_id=eq.${selectedGameId}` }, () => void loadGame())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedGameId, session, loadGame])

  const closeGame = () => {
    setSelectedGameId(null)
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

  if (selectedGameId && game) {
    return game.status === 'draft' ? (
      <>
        <Header section="games" onNavigate={navigate} />
        <GameSetup game={game} players={players} onReload={loadGame} onBack={closeGame} />
      </>
    ) : (
      <MatchConsole game={game} players={players} events={events} onReload={loadGame} onBack={closeGame} />
    )
  }

  return (
    <>
      <Header section={section} onNavigate={navigate} />
      {section === 'games' ? <GamesDashboard onOpenGame={setSelectedGameId} /> : <TrainingDashboard />}
    </>
  )
}

export default App
