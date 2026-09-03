import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game } from '../types'
import { ConfirmDialog } from './ConfirmDialog'

interface GamesDashboardProps {
  onOpenGame: (gameId: string) => void
}

export function GamesDashboard({ onOpenGame }: GamesDashboardProps) {
  const [games, setGames] = useState<Game[]>([])
  const [creating, setCreating] = useState(false)
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('game_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return alert(error.message)
    setGames((data ?? []) as Game[])
  }

  useEffect(() => {
    void load()
  }, [])

  const createGame = async () => {
    setCreating(true)
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('games')
      .insert({ opponent_name: 'Rival', game_date: today })
      .select('*')
      .single()

    setCreating(false)

    if (error || !data) return alert(error?.message ?? 'No s’ha pogut crear el partit.')
    onOpenGame(data.id)
  }

  const deleteGame = async () => {
    if (!gameToDelete) return
    setDeleting(true)
    const { error } = await supabase.from('games').delete().eq('id', gameToDelete.id)
    setDeleting(false)
    if (error) return alert(error.message)
    setGameToDelete(null)
    await load()
  }

  return (
    <main className="page-shell dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">PARTITS</p>
          <h1>Game Data</h1>
          <p>Obre un partit existent o crea’n un de nou.</p>
        </div>
        <button className="button primary large" onClick={createGame} disabled={creating}>
          {creating ? 'Creant...' : 'Crear partit'}
        </button>
      </section>

      <section className="dashboard-section">
        <div className="section-heading dashboard-heading">
          <div>
            <h2>Partits</h2>
            <span>{games.length} guardats</span>
          </div>
        </div>

        <div className="games-grid">
          <button className="new-game-card" onClick={createGame} disabled={creating}>
            <span className="new-game-mark">+</span>
            <strong>Nou partit</strong>
            <small>Configura equips, dorsals, posicions i titulars</small>
          </button>

          {games.map((game) => (
            <article className="game-card" key={game.id}>
              <button className="game-card-open" onClick={() => onOpenGame(game.id)}>
                <div className="game-card-top">
                  <span className={`status-pill ${game.status}`}>
                    {game.status === 'draft' ? 'Preparació' : game.status === 'live' ? 'En curs' : 'Finalitzat'}
                  </span>
                  <time>{new Date(`${game.game_date}T12:00:00`).toLocaleDateString('ca-ES')}</time>
                </div>
                <div className="game-versus">
                  <span>Kids&Us Manresa</span>
                  <b>vs</b>
                  <strong>{game.opponent_name || 'Rival'}</strong>
                </div>
                <span className="game-open">Obrir partit</span>
              </button>
              <button className="game-card-delete" onClick={() => setGameToDelete(game)}>
                Eliminar
              </button>
            </article>
          ))}
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(gameToDelete)}
        title="Eliminar partit?"
        message={gameToDelete ? `S’eliminarà definitivament el partit del ${new Date(`${gameToDelete.game_date}T12:00:00`).toLocaleDateString('ca-ES')} contra ${gameToDelete.opponent_name}. Aquesta acció no es pot desfer.` : ''}
        confirmLabel="Eliminar partit"
        danger
        busy={deleting}
        onCancel={() => !deleting && setGameToDelete(null)}
        onConfirm={deleteGame}
      />
    </main>
  )
}
