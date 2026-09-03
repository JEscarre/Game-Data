import { FormEvent, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, GamePlayer, PlayerPosition, Side } from '../types'
import { ConfirmDialog } from './ConfirmDialog'

interface GameSetupProps {
  game: Game
  players: GamePlayer[]
  onReload: () => Promise<void>
  onBack: () => void
}

const positionLabel: Record<PlayerPosition, string> = {
  guard: 'Guard',
  wing: 'Wing',
  big: 'Big',
}

export function GameSetup({ game, players, onReload, onBack }: GameSetupProps) {
  const [opponentName, setOpponentName] = useState(game.opponent_name)
  const [gameDate, setGameDate] = useState(game.game_date)
  const [newPlayer, setNewPlayer] = useState({
    side: 'home' as Side,
    number: '',
    name: '',
    position: 'guard' as PlayerPosition,
  })
  const [starters, setStarters] = useState<string[]>(game.initial_lineup ?? [])
  const [playerToDelete, setPlayerToDelete] = useState<GamePlayer | null>(null)
  const [deleteGameOpen, setDeleteGameOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const home = useMemo(() => players.filter((player) => player.side === 'home'), [players])
  const away = useMemo(() => players.filter((player) => player.side === 'away'), [players])

  const saveGame = async () => {
    const { error } = await supabase
      .from('games')
      .update({ opponent_name: opponentName.trim() || 'Rival', game_date: gameDate })
      .eq('id', game.id)

    if (error) return alert(error.message)
    await onReload()
  }

  const addPlayer = async (event: FormEvent) => {
    event.preventDefault()
    if (!newPlayer.name.trim()) return

    const sidePlayers = players.filter((player) => player.side === newPlayer.side)
    const { error } = await supabase.from('game_players').insert({
      game_id: game.id,
      side: newPlayer.side,
      name: newPlayer.name.trim(),
      jersey_number: newPlayer.number.trim(),
      position: newPlayer.position,
      sort_order: sidePlayers.length,
    })

    if (error) return alert(error.message)

    setNewPlayer((previous) => ({ ...previous, number: '', name: '' }))
    await onReload()
  }

  const updatePlayer = async (player: GamePlayer, patch: Partial<GamePlayer>) => {
    const { error } = await supabase.from('game_players').update(patch).eq('id', player.id)
    if (error) return alert(error.message)
    await onReload()
  }

  const removePlayer = async () => {
    if (!playerToDelete) return
    setDeleteBusy(true)
    if (starters.includes(playerToDelete.id)) setStarters((previous) => previous.filter((id) => id !== playerToDelete.id))

    const { error } = await supabase.from('game_players').delete().eq('id', playerToDelete.id)
    setDeleteBusy(false)
    if (error) return alert(error.message)
    setPlayerToDelete(null)
    await onReload()
  }

  const toggleStarter = (id: string) => {
    setStarters((previous) => {
      if (previous.includes(id)) return previous.filter((value) => value !== id)
      if (previous.length >= 5) return previous
      return [...previous, id]
    })
  }

  const deleteGame = async () => {
    setDeleteBusy(true)
    const { error } = await supabase.from('games').delete().eq('id', game.id)
    setDeleteBusy(false)
    if (error) return alert(error.message)
    setDeleteGameOpen(false)
    onBack()
  }

  const startGame = async () => {
    if (starters.length !== 5) return alert('Selecciona exactament 5 titulars de Kids&Us Manresa.')
    if (home.length < 5) return alert('Necessites com a mínim 5 jugadors de Kids&Us Manresa.')

    const { error } = await supabase
      .from('games')
      .update({
        opponent_name: opponentName.trim() || 'Rival',
        game_date: gameDate,
        initial_lineup: starters,
        status: 'live',
        current_period: 1,
        current_clock_seconds: 600,
      })
      .eq('id', game.id)

    if (error) return alert(error.message)
    await onReload()
  }

  const playerList = (teamPlayers: GamePlayer[], side: Side) => (
    <div className="setup-player-list">
      {teamPlayers.length === 0 ? (
        <p className="empty-inline">Encara no hi ha jugadors.</p>
      ) : (
        teamPlayers.map((player) => (
          <div className="setup-player-row" key={player.id}>
            {side === 'home' ? (
              <button
                type="button"
                className={`starter-toggle ${starters.includes(player.id) ? 'selected' : ''}`}
                onClick={() => toggleStarter(player.id)}
              >
                {starters.includes(player.id) ? 'Titular' : 'Banqueta'}
              </button>
            ) : (
              <span className="starter-spacer">Rival</span>
            )}

            <label className="compact-field number-field">
              <span>Dorsal</span>
              <input
                defaultValue={player.jersey_number}
                onBlur={(event) => updatePlayer(player, { jersey_number: event.target.value })}
                aria-label="Dorsal"
              />
            </label>

            <label className="compact-field">
              <span>Nom</span>
              <input
                defaultValue={player.name}
                onBlur={(event) => updatePlayer(player, { name: event.target.value })}
                aria-label="Nom"
              />
            </label>

            <label className="compact-field position-field">
              <span>Posició</span>
              <select
                className={`position-select pos-${player.position ?? 'none'}`}
                value={player.position ?? ''}
                onChange={(event) => updatePlayer(player, { position: event.target.value as PlayerPosition })}
              >
                <option value="" disabled>Posició</option>
                {(Object.keys(positionLabel) as PlayerPosition[]).map((position) => (
                  <option key={position} value={position}>{positionLabel[position]}</option>
                ))}
              </select>
            </label>

            <button className="text-button danger-text" type="button" onClick={() => setPlayerToDelete(player)}>
              Eliminar
            </button>
          </div>
        ))
      )}
    </div>
  )

  return (
    <main className="page-shell setup-shell">
      <button className="back-link" onClick={onBack}>← Tornar als partits</button>

      <div className="page-title-row setup-title-row">
        <div>
          <p className="eyebrow">PREPARACIÓ</p>
          <h1>Configura el partit</h1>
          <p className="muted">Afegeix jugadors, dorsal i posició. Selecciona els 5 titulars abans de començar.</p>
        </div>
        <div className="starter-count"><strong>{starters.length}/5</strong><span>titulars</span></div>
      </div>

      <section className="card setup-meta">
        <label className="field">
          <span>Rival</span>
          <input value={opponentName} onChange={(event) => setOpponentName(event.target.value)} onBlur={saveGame} />
        </label>
        <label className="field">
          <span>Data</span>
          <input type="date" value={gameDate} onChange={(event) => setGameDate(event.target.value)} onBlur={saveGame} />
        </label>
      </section>

      <form className="card add-match-player" onSubmit={addPlayer}>
        <div className="add-player-copy">
          <p className="eyebrow">AFEGIR JUGADOR</p>
          <strong>Nou registre</strong>
        </div>
        <select value={newPlayer.side} onChange={(event) => setNewPlayer((previous) => ({ ...previous, side: event.target.value as Side }))}>
          <option value="home">Kids&Us</option>
          <option value="away">Rival</option>
        </select>
        <input value={newPlayer.number} onChange={(event) => setNewPlayer((previous) => ({ ...previous, number: event.target.value }))} placeholder="Dorsal" />
        <input value={newPlayer.name} onChange={(event) => setNewPlayer((previous) => ({ ...previous, name: event.target.value }))} placeholder="Nom del jugador" />
        <select className={`position-select pos-${newPlayer.position}`} value={newPlayer.position} onChange={(event) => setNewPlayer((previous) => ({ ...previous, position: event.target.value as PlayerPosition }))}>
          <option value="guard">Guard</option>
          <option value="wing">Wing</option>
          <option value="big">Big</option>
        </select>
        <button className="button secondary">Afegir jugador</button>
      </form>

      <div className="two-col setup-teams">
        <section className="card">
          <div className="section-heading">
            <div><p className="eyebrow">LOCAL</p><h2>Kids&Us Manresa</h2></div>
            <span>{home.length} jugadors</span>
          </div>
          {playerList(home, 'home')}
        </section>

        <section className="card">
          <div className="section-heading">
            <div><p className="eyebrow">RIVAL</p><h2>{opponentName || 'Rival'}</h2></div>
            <span>{away.length} jugadors</span>
          </div>
          {playerList(away, 'away')}
        </section>
      </div>

      <div className="sticky-action-bar">
        <div><strong>Partit preparat</strong><span>Els canvis i els minuts es calcularan a partir del rellotge de partit.</span></div>
        <div className="setup-final-actions">
          <button className="button danger-on-dark" onClick={() => setDeleteGameOpen(true)}>Eliminar partit</button>
          <button className="button primary light-primary large" onClick={startGame} disabled={starters.length !== 5}>Començar partit</button>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(playerToDelete)}
        title={playerToDelete ? `Eliminar ${playerToDelete.name}?` : 'Eliminar jugador?'}
        message="El jugador s’eliminarà d’aquest partit. Aquesta acció no es pot desfer."
        confirmLabel="Eliminar jugador"
        danger
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setPlayerToDelete(null)}
        onConfirm={removePlayer}
      />

      <ConfirmDialog
        open={deleteGameOpen}
        title="Eliminar partit?"
        message="S’eliminarà definitivament aquest partit, els jugadors i totes les dades registrades. Aquesta acció no es pot desfer."
        confirmLabel="Eliminar partit"
        danger
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setDeleteGameOpen(false)}
        onConfirm={deleteGame}
      />
    </main>
  )
}
