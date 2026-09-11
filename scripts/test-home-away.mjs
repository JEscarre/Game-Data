import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'game-data-home-away-'))
const localTsc = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
const tsc = fs.existsSync(localTsc) ? localTsc : 'tsc'

try {
  execFileSync(tsc, [
    'src/lib/game.ts',
    'src/types.ts',
    '--target', 'ES2022',
    '--module', 'ES2022',
    '--moduleResolution', 'Bundler',
    '--outDir', temp,
    '--skipLibCheck',
    '--strict',
  ], { cwd: root, stdio: 'pipe' })

  const gameLibPath = path.join(temp, 'lib', 'game.js')
  const gameLib = await import(`${pathToFileURL(gameLibPath).href}?t=${Date.now()}`)
  const {
    kidsUsPhysicalSide,
    rivalPhysicalSide,
    teamNameForSide,
    physicalSideForPlayer,
    isTeamInBonus,
    deriveScore,
    deriveScoreTimeline,
    deriveFouls,
    deriveTimeoutSlots,
    derivePlayerStats,
    currentLineup,
  } = gameLib

  const game = (team_side) => ({
    id: `game-${team_side}`,
    opponent_name: 'Rival Test',
    game_date: '2026-09-11',
    team_side,
    status: 'live',
    current_period: 1,
    current_clock_seconds: 540,
    initial_lineup: ['kids-1'],
    created_at: '2026-09-11T08:00:00.000Z',
    updated_at: '2026-09-11T08:00:00.000Z',
  })

  const kids = {
    id: 'kids-1', game_id: 'g', side: 'home', name: 'Jugador Manresa', jersey_number: '7',
    position: 'guard', sort_order: 0, created_at: '2026-09-11T08:00:00.000Z',
  }
  const rival = {
    id: 'rival-1', game_id: 'g', side: 'away', name: 'Jugador Rival', jersey_number: '9',
    position: 'wing', sort_order: 0, created_at: '2026-09-11T08:00:00.000Z',
  }

  const event = (id, event_type, side, player_id = null, points = null, createdIndex = 0, metadata = {}) => ({
    id,
    game_id: 'g',
    event_type,
    side,
    player_id,
    related_player_id: null,
    period: 1,
    clock_seconds: 600 - createdIndex,
    points,
    metadata,
    created_at: `2026-09-11T08:00:${String(createdIndex).padStart(2, '0')}.000Z`,
    undone_at: null,
    created_by: null,
  })

  // Contracte de propietat: game_players.home continua sent Kids&Us; team_side decideix local/visitant real.
  for (const teamSide of ['home', 'away']) {
    const g = game(teamSide)
    const kidsPhysical = teamSide
    const rivalPhysical = teamSide === 'home' ? 'away' : 'home'

    assert.equal(kidsUsPhysicalSide(g), kidsPhysical)
    assert.equal(rivalPhysicalSide(g), rivalPhysical)
    assert.equal(teamNameForSide(g, kidsPhysical), 'Kids&Us Manresa')
    assert.equal(teamNameForSide(g, rivalPhysical), 'Rival Test')
    assert.equal(physicalSideForPlayer(g, kids), kidsPhysical)
    assert.equal(physicalSideForPlayer(g, rival), rivalPhysical)

    const scoreEvents = [
      event('score-kids', 'score', kidsPhysical, null, 2, 1),
      event('score-rival', 'score', rivalPhysical, null, 3, 2),
    ]
    const score = deriveScore(scoreEvents)
    assert.equal(score[kidsPhysical], 2, `Els punts de Kids&Us han d'anar al costat ${kidsPhysical}`)
    assert.equal(score[rivalPhysical], 3, `Els punts del rival han d'anar al costat ${rivalPhysical}`)

    const timeline = deriveScoreTimeline(scoreEvents)
    assert.equal(timeline.at(-1).home, score.home)
    assert.equal(timeline.at(-1).away, score.away)

    const foulEvents = [
      event('foul-kids-1', 'foul', physicalSideForPlayer(g, kids), kids.id, null, 3),
      event('foul-kids-2', 'foul', physicalSideForPlayer(g, kids), kids.id, null, 4),
      event('foul-rival', 'foul', physicalSideForPlayer(g, rival), rival.id, null, 5),
    ]
    const fouls = deriveFouls(foulEvents)
    assert.equal(fouls.byPlayer.get(kids.id), 2)
    assert.equal(fouls.bySidePeriod.get(`${kidsPhysical}:1`), 2, `Les faltes de Manresa han de sumar al costat ${kidsPhysical}`)
    assert.equal(fouls.bySidePeriod.get(`${rivalPhysical}:1`), 1, `Les faltes del rival han de sumar al costat ${rivalPhysical}`)

    const timeoutEvents = [
      event('to-kids', 'timeout', kidsPhysical, null, null, 6, { slot: 'H1-1', half: 1 }),
      event('to-rival', 'timeout', rivalPhysical, null, null, 7, { slot: 'H1-1', half: 1 }),
    ]
    const timeouts = deriveTimeoutSlots(timeoutEvents)
    assert.equal(timeouts[kidsPhysical].get('H1-1')?.id, 'to-kids')
    assert.equal(timeouts[rivalPhysical].get('H1-1')?.id, 'to-rival')

    const stats = derivePlayerStats(g, [kids, rival], foulEvents)
    assert.equal(stats.get(kids.id)?.fouls, 2)
    assert.deepEqual(currentLineup(g, [kids, rival], foulEvents).map((player) => player.id), [kids.id])
  }

  // Bonus FIBA: amb 4 faltes de l'oponent, l'equip contrari ja està en bonus.
  assert.equal(isTeamInBonus(0), false)
  assert.equal(isTeamInBonus(3), false)
  assert.equal(isTeamInBonus(4), true)
  assert.equal(isTeamInBonus(5), true)

  // Correccions de marcador i accions desfetes no han de contaminar el resultat.
  const corrected = [
    event('s1', 'score', 'home', null, 2, 1),
    event('s2', 'score', 'home', null, 1, 2, { score_delta: -1, source: 'score_correction' }),
    { ...event('s3', 'score', 'away', null, 3, 3), undone_at: '2026-09-11T09:00:00.000Z' },
  ]
  assert.deepEqual(deriveScore(corrected), { home: 1, away: 0 })

  console.log('Home/Away contract OK · marcador, cronologia, faltes per jugador/equip, bonus, temps morts i quintet validats en Local i Visitant.')
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
