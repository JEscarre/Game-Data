import fs from 'node:fs'
import path from 'node:path'

const required = [
  'package.json',
  'index.html',
  'src/App.tsx',
  'src/components/ConfirmDialog.tsx',
  'src/components/GameSetup.tsx',
  'src/components/MatchConsole.tsx',
  'src/components/TrainingDashboard.tsx',
  'src/lib/game.ts',
  'src/lib/training.ts',
  'supabase/schema.sql',
  'supabase/migration_v3_training.sql',
  'supabase/migration_v3_2_training_ui.sql',
  'supabase/replace_training_with_HOJA1.sql',
  'data/Control competiciones 26-27.xlsx',
  'public/kids-us-manresa.png',
  'UPDATE_V3_3.md',
  'UPDATE_V3_4.md',
  'UPDATE_V3_5.md',
  'UPDATE_V3_6.md',
  'supabase/migration_v3_6_ft_bonus_all.sql',
]

const missing = required.filter((file) => !fs.existsSync(path.resolve(file)))
if (missing.length) {
  console.error('Falten fitxers:', missing)
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))
if (pkg.version !== '3.6.0') {
  console.error('La versió del package no és 3.6.0.')
  process.exit(1)
}

const gameSource = fs.readFileSync(path.resolve('src/lib/game.ts'), 'utf8')
if (!gameSource.includes('nextThirtySeconds')) {
  console.error('No s’ha detectat el pas de rellotge de 30 segons.')
  process.exit(1)
}

const setupSource = fs.readFileSync(path.resolve('src/components/GameSetup.tsx'), 'utf8')
if (setupSource.includes("starters.length !== 5") || setupSource.includes('home.length < 5')) {
  console.error('GameSetup encara bloqueja l’inici sense quintet o plantilla completa.')
  process.exit(1)
}
if (!setupSource.includes('Pots començar el partit encara que la plantilla no estigui completa')) {
  console.error('No s’ha detectat el flux de començament flexible.')
  process.exit(1)
}

const matchSource = fs.readFileSync(path.resolve('src/components/MatchConsole.tsx'), 'utf8')
const requiredMatchTokens = [
  'Jugadors i titulars',
  'addRosterPlayer',
  'savePlayerPatch',
  'toggleInitialStarter',
  'requestDeletePlayer',
  'roster-manager-modal',
  'validInitialLineup',
]
for (const token of requiredMatchTokens) {
  if (!matchSource.includes(token)) {
    console.error(`No s’ha detectat el canvi v3.4: ${token}`)
    process.exit(1)
  }
}
if (/\bprompt\s*\(/.test(matchSource)) {
  console.error('Encara hi ha prompts natius per editar jugadors al partit.')
  process.exit(1)
}

const trainingSource = fs.readFileSync(path.resolve('src/components/TrainingDashboard.tsx'), 'utf8')
const requiredTrainingTokens = [
  '2 FREE THROWS MADE',
  'free_throw_bonus_made',
  'attendance-accordion',
  'daily-results-summary',
  'competition-autosave-status',
  'queueCompetitionSave',
  'Assigna directament els punts',
]
for (const token of requiredTrainingTokens) {
  if (!trainingSource.includes(token)) {
    console.error(`No s’ha detectat el canvi v3.3: ${token}`)
    process.exit(1)
  }
}

if (!trainingSource.includes('Optimistic update') || !trainingSource.includes('patchAttendanceFromRealtime') || !trainingSource.includes('loadSeasonData(true)')) {
  console.error('No s’ha detectat la correcció v3.5 d’assistència sense recàrrega visual.')
  process.exit(1)
}


if (!trainingSource.includes('downloadTrainingBackup') || !trainingSource.includes('Còpia de seguretat') || !trainingSource.includes('fetchAllTrainingRows')) {
  console.error('No s’ha detectat la còpia de seguretat completa de la v3.6.')
  process.exit(1)
}
if (!trainingSource.includes('tots els jugadors presents reben +1 punt') || trainingSource.includes('que tenen 0 punts')) {
  console.error('La regla 2/2 no està actualitzada per premiar tots els presents.')
  process.exit(1)
}
const addResultsIndex = trainingSource.indexOf('<h2>Afegir resultats</h2>')
const dayResultsIndex = trainingSource.indexOf('<strong>Resultats del dia</strong>')
if (addResultsIndex < 0 || dayResultsIndex < 0 || addResultsIndex > dayResultsIndex) {
  console.error('L’ordre de competicions no és Afegir resultats -> Resultats del dia.')
  process.exit(1)
}

const trainingLib = fs.readFileSync(path.resolve('src/lib/training.ts'), 'utf8')
if (!trainingLib.includes('freeThrowPoints += 1') || !trainingLib.includes('result.place === null')) {
  console.error('No s’ha detectat el càlcul dinàmic del bonus 2/2 de la v3.6.')
  process.exit(1)
}

if (trainingSource.includes('Guardar resultats')) {
  console.error('Encara existeix el botó manual de guardar resultats.')
  process.exit(1)
}
if (/Excel/i.test(trainingSource)) {
  console.error('Encara hi ha una referència visible a Excel al TrainingDashboard.')
  process.exit(1)
}

const allUiSource = fs.readdirSync(path.resolve('src/components'))
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => fs.readFileSync(path.resolve('src/components', name), 'utf8'))
  .join('\n')
if (/\bconfirm\s*\(/.test(allUiSource)) {
  console.error('Encara hi ha confirmacions natives del navegador.')
  process.exit(1)
}

console.log('Estructura v3.6 OK · bonus 2/2 per a tots els presents + backup complet + ordre de resultats corregit.')
