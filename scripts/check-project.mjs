import fs from 'node:fs'
import path from 'node:path'

const required = [
  'package.json',
  'index.html',
  'src/App.tsx',
  'src/components/ConfirmDialog.tsx',
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
]

const missing = required.filter((file) => !fs.existsSync(path.resolve(file)))
if (missing.length) {
  console.error('Falten fitxers:', missing)
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))
if (pkg.version !== '3.3.0') {
  console.error('La versió del package no és 3.3.0.')
  process.exit(1)
}

const gameSource = fs.readFileSync(path.resolve('src/lib/game.ts'), 'utf8')
if (!gameSource.includes('nextThirtySeconds')) {
  console.error('No s’ha detectat el pas de rellotge de 30 segons.')
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
if (trainingSource.includes('Guardar resultats')) {
  console.error('Encara existeix el botó manual de guardar resultats.')
  process.exit(1)
}
if (/Excel/i.test(trainingSource)) {
  console.error('Encara hi ha una referència visible a Excel al TrainingDashboard.')
  process.exit(1)
}
if (trainingSource.includes('Baixa') || trainingSource.includes('Reactivar')) {
  console.error('Encara hi ha controls de baixa/reactivació al llistat de training.')
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

const migration = fs.readFileSync(path.resolve('supabase/migration_v3_2_training_ui.sql'), 'utf8')
if (!migration.includes('free_throw_bonus_made') || !migration.includes('points in (0, 1)')) {
  console.error('La migració v3.2 no sembla completa.')
  process.exit(1)
}

console.log('Estructura v3.3 OK · resultats del dia nets + taula compacta + autoguardat + assistència desplegable.')
