import fs from 'node:fs'
import path from 'node:path'

const required = [
  'package.json',
  'index.html',
  'src/App.tsx',
  'src/components/MatchConsole.tsx',
  'src/lib/game.ts',
  'supabase/schema.sql',
  'public/kids-us-manresa.png',
]

const missing = required.filter((file) => !fs.existsSync(path.resolve(file)))
if (missing.length) {
  console.error('Falten fitxers:', missing)
  process.exit(1)
}
console.log('Estructura bàsica OK.')
