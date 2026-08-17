# Kids&Us Manresa · Game Data

Web app responsive, optimitzada especialment per tablet, per registrar el seguiment dels partits.

## Versió 2

Aquesta versió incorpora:

- Menú principal només amb partits guardats i creador de partits.
- Eliminació de partits des del menú principal.
- Sense plantilla persistent: els jugadors es creen dins de cada partit.
- Nom, dorsal i posició manual per jugador: Guard / Wing / Big.
- Color diferent per cada posició.
- Selecció dels 5 titulars abans de començar.
- 4 quarts de 10 minuts i pròrrogues de 5 minuts.
- Rellotge de partit manual, sempre inicialitzat amb l’últim temps registrat.
- Botó gran per avançar al següent minut sencer i confirmar els 5 jugadors a pista.
- Substitucions amb moment exacte del canvi; el temps proposat és l’últim temps registrat.
- Minuts totals i temps consecutiu calculats a partir del rellotge de partit.
- Avís visual quan un jugador supera 3:00 consecutius.
- Marcador +1 / +2 / +3 per cada equip i cronologia del marcador.
- Faltes individuals dels dos equips i faltes d’equip automàtiques.
- Color de faltes progressiu d’1 a 5.
- Bloqueig d’un jugador a partir de 5 faltes, amb possibilitat de corregir faltes.
- Temps morts: 2 botons per equip a la primera part i 3 a la segona; vermell = gastat.
- Cronologia general del partit i acció de desfer.
- Reiniciar dades del partit conservant jugadors i titulars.
- Supabase Realtime per sincronitzar diversos dispositius.
- Login compartit amb una única contrasenya visible a la interfície.
- Logo del Kids&Us Manresa incorporat.
- Vite configurat a `http://localhost:3000` i amb obertura automàtica al navegador predeterminat.

## Estructura

```text
kidsus-manresa-seguiment/
├─ public/
│  ├─ kids-us-manresa.png
│  └─ manifest.webmanifest
├─ src/
│  ├─ components/
│  │  ├─ GameSetup.tsx
│  │  ├─ GamesDashboard.tsx
│  │  ├─ Header.tsx
│  │  ├─ Login.tsx
│  │  └─ MatchConsole.tsx
│  ├─ lib/
│  │  ├─ game.ts
│  │  └─ supabase.ts
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ styles.css
│  ├─ types.ts
│  └─ vite-env.d.ts
├─ supabase/
│  ├─ schema.sql
│  └─ migration_v2.sql
├─ .env.example
├─ package.json
├─ vite.config.ts
└─ README.md
```

## Si ja tens la v1 a Supabase

No tornis a executar tot l’esquema. Ves a Supabase → SQL Editor i executa:

```text
supabase/migration_v2.sql
```

Aquesta migració:

- afegeix la posició als jugadors del partit;
- elimina la referència a la plantilla persistent;
- elimina `roster_players`;
- conserva els partits, jugadors de partit i esdeveniments existents.

## Variables d’entorn

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxx
VITE_LOGIN_EMAIL=usuari-intern@exemple.cat
```

`VITE_LOGIN_EMAIL` és l’email intern de l’únic usuari creat a Supabase Auth. La pantalla de login només demana la contrasenya.

No utilitzis mai una `sb_secret_...`, `service_role` o qualsevol secret del servidor dins d’una variable `VITE_*`.

## Local

```powershell
npm install
npm run dev
```

L’app s’obre a:

```text
http://localhost:3000
```

Vite intentarà obrir el navegador predeterminat automàticament. Si VS Code obre un navegador intern, obre Google Chrome manualment i enganxa `http://localhost:3000`.

## Build

```powershell
npm run build
```

## GitHub + Vercel

Puja la carpeta sencera al repositori, però no `.env.local`. A Vercel afegeix les tres variables d’entorn indicades abans.
