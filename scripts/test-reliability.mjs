import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'game-data-reliability-'))
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
try {
  // Run the actual rules with TypeScript compiled to JavaScript (no fake scores).
  const localTsc = path.join(root, 'node_modules/.bin/tsc')
  execFileSync(fs.existsSync(localTsc) ? localTsc : 'tsc', [
    'src/lib/training.ts', 'src/lib/game.ts', 'src/types.ts',
    '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler',
    '--outDir', temp, '--skipLibCheck', '--typeRoots', path.join(temp, 'no-types'), '--strict',
  ], { cwd: root })
  const { deriveTrainingSummaries } = await import(pathToFileURL(path.join(temp, 'lib/training.js')).href)
  const player = (id) => ({ id, name: id, season_id: 'season', joined_on: '2026-09-01', left_on: null,
    attendance_credit: 0, shooting_points_credit: 0, free_throw_points_credit: 0,
    competition_points_credit: 0, active: true })
  const players = [player('a'), player('b'), player('c')]
  const session = { id: 'session', season_id: 'season', session_date: '2026-10-01', counts_for_attendance: true }
  const competition = { id: 'competition', session_id: 'session', category: 'free_throw', free_throw_bonus_made: true }
  const attendance = ['a', 'b', 'c'].map((player_id) => ({ session_id: 'session', player_id, status: 'present' }))
  const results = [
    { competition_id: 'competition', player_id: 'a', place: 1, points: 4 },
    { competition_id: 'competition', player_id: 'b', place: 2, points: 3 },
    { competition_id: 'competition', player_id: 'c', place: null, points: 1 }, // legacy 2/2
  ]
  const sums = deriveTrainingSummaries(players, [session], attendance, [competition], results)
  assert.deepEqual(sums.map((s) => s.freeThrowPoints), [5, 4, 1], 'Several players must score; bonus once per present player')
  assert.deepEqual(sums.map((s) => s.attended), [1, 1, 1])

  const training = read('src/components/TrainingDashboard.tsx')
  const match = read('src/components/MatchConsole.tsx')
  const app = read('src/App.tsx')
  const sql = read('supabase/migration_v3_10_reliability.sql')
  assert.match(training, /persistCompetitionPlacement/)
  assert.match(training, /\.delete\(\)\.eq\('competition_id', competitionId\)\.eq\('player_id', playerId\)/)
  assert.match(training, /onConflict: 'competition_id,player_id'/)
  assert.doesNotMatch(training, /\.delete\(\)\.eq\('competition_id', competitionId\)\s*\n\s*if/)
  assert.match(training, /failedCompetitionWrites/)
  assert.match(training, /fetchLinkedRows/)
  assert.match(training, /requestId !== loadRevision\.current/)
  for (const fn of ['record_game_clock', 'record_game_substitution', 'record_game_event', 'undo_game_action']) {
    assert.ok(sql.includes(`function public.${fn}`), `Missing atomic server function ${fn}`)
    assert.ok(match.includes(`rpc('${fn}'`), `Match UI not calling ${fn}`)
  }
  assert.match(sql, /for update/i)
  assert.match(sql, /create unique index if not exists game_events_client_action_id_key/)
  assert.match(sql, /p_expected_clock_seconds/)
  assert.doesNotMatch(sql, /\bif\b[^;]*?\bcase\s+when\b/i, 'Do not embed unparenthesized CASE in PL/pgSQL IF: THEN may terminate the condition')
  assert.match(sql, /p_period <= 4 and p_clock_seconds > 600/)
  assert.match(sql, /v_game.current_period <= 4 and p_clock_seconds > 600/)
  assert.match(app, /sessionStorage\.setItem\('game-data\.active-match'/)
  assert.match(app, /visibilitychange/)
  assert.match(match, /actionInFlight\.current/)
  console.log('Reliability tests OK · multipuntuació, bonus, desament incremental, recuperació de sessió i operacions atòmiques.')
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
