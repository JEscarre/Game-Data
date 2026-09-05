# Kids&Us Manresa · Game Data

Web app responsive, optimitzada especialment per tablet, per registrar el seguiment dels partits.

## Versió 3.3

Aquesta versió incorpora:

- Menú principal només amb partits guardats i creador de partits.
- Eliminació de partits des del menú principal.
- Sense plantilla persistent: els jugadors es creen dins de cada partit.
- Nom, dorsal i posició manual per jugador: Guard / Wing / Big.
- Color diferent per cada posició.
- Quintet inicial opcional abans de començar i editable amb el partit obert.
- 4 quarts de 10 minuts i pròrrogues de 5 minuts.
- Rellotge de partit manual, sempre inicialitzat amb l’últim temps registrat.
- Botó gran per avançar el rellotge en blocs de **30 segons** i confirmar els 5 jugadors a pista.
- Substitucions amb moment exacte del canvi; el temps proposat és l’últim temps registrat.
- Minuts totals i temps consecutiu calculats a partir del rellotge de partit.
- Avís visual quan un jugador supera 3:00 consecutius.
- Marcador +1 / +2 / +3 per cada equip i cronologia del marcador.
- Faltes individuals dels dos equips i faltes d’equip automàtiques.
- Faltes molt més visuals: indicador gran `F x/5` a pista i banqueta, més color progressiu d’1 a 5.
- Bloqueig d’un jugador a partir de 5 faltes, amb possibilitat de corregir faltes.
- Temps morts: 2 botons per equip a la primera part i 3 a la segona; vermell = gastat.
- Cronologia general del partit i acció de desfer.
- Reiniciar dades del partit conservant jugadors i titulars.
- Supabase Realtime per sincronitzar diversos dispositius.
- Login compartit amb una única contrasenya visible a la interfície.
- Logo del Kids&Us Manresa incorporat.
- Vite configurat a `http://localhost:3000` i amb obertura automàtica al navegador predeterminat.

### Entrenaments · v3

- Navegació principal separada entre **Partits** i **Entrenaments**.
- Temporades independents i selector de temporada; `2026-27` queda activa per defecte.
- Alta de jugadors amb **data d’alta** i eliminació centralitzada des d’un únic botó, de manera que els entrenaments anteriors al fitxatge no perjudiquen el % d’assistència.
- Registre d’assistència per dia amb botons **P/A**, “Tots presents” i “Tots absents”, dins d’un desplegable que es pot tancar un cop passada la llista.
- Resum acumulat per jugador: presències, sessions elegibles i **% d’assistència**.
- Tres famílies de competició: **Shooting**, **Free throws** i **Competition**.
- Es poden crear tantes competicions de cada tipus com calgui dins un mateix entrenament.
- Puntuació directa per competició amb empats: **4, 3, 2 o 1 punt** per jugador. La interfície mostra punts directament i no posicions.
- Autoguardat dels resultats de competició: no cal cap botó de “Guardar resultats”.
- Resum visual dels **resultats del dia**, agregant punts per jugador i categoria sense mostrar la font d’importació.
- Classificació de temporada compacta i visual, amb colors diferenciats per assistència, Shooting, Free Throws, Competition i total general.
- Dades de l’Excel incloses a `data/` i seed idempotent a `supabase/seed_training_excel.sql`.

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
│  │  ├─ MatchConsole.tsx
│  │  └─ TrainingDashboard.tsx
│  ├─ lib/
│  │  ├─ game.ts
│  │  ├─ training.ts
│  │  └─ supabase.ts
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ styles.css
│  ├─ types.ts
│  └─ vite-env.d.ts
├─ supabase/
│  ├─ schema.sql
│  ├─ migration_v2.sql
│  ├─ migration_v3_training.sql
│  ├─ migration_v3_2_training_ui.sql
│  ├─ replace_training_with_HOJA1.sql
│  └─ seed_training_excel.sql
├─ data/
│  └─ Control competiciones 26-27.xlsx
├─ .env.example
├─ package.json
├─ vite.config.ts
└─ README.md
```

## Actualitzar Supabase

Si ja tens la **v2 de Game Data** funcionant, conserva totes les dades de partits i executa al SQL Editor, en aquest ordre:

```text
supabase/migration_v3_training.sql
supabase/seed_training_excel.sql
```

La primera migració crea tota la infraestructura d’entrenaments. El seed carrega les dades recuperables de l’Excel de forma idempotent.

Si encara vens de la v1, executa primer `supabase/migration_v2.sql` i després els dos fitxers anteriors. En una instal·lació nova, executa `supabase/schema.sql` i després `supabase/seed_training_excel.sql`.

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


## Actualització v3.3

Si ja tens la v3.2 funcionant, **no cal executar cap SQL nou**. Substitueix els fitxers de frontend, conserva `.env.local` i executa `npm install`, `npm run check` i `npm run dev`.


## Update v3.4

Consulta `UPDATE_V3_4.md` per als canvis de plantilla i quintet editable durant el partit.

## Update v3.5

Consulta `UPDATE_V3_5.md` per a la correcció d'assistència fluida sense recàrregues visuals.

## Update v3.6

Consulta `UPDATE_V3_6.md`. Aquesta versió corregeix el bonus `2 FREE THROWS MADE` perquè sumi +1 a tots els jugadors presents, afegeix una còpia de seguretat manual completa d'entrenaments i posa `Afegir resultats` abans de `Resultats del dia`.

Si ja tens v3.5, executa una vegada `supabase/migration_v3_6_ft_bonus_all.sql` després d'actualitzar el frontend.
