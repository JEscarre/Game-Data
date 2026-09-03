# Game Data · v3.2 · Training UX + Free Throw bonus + confirmations

## Canvis principals

### Training Control
- Eliminada la barra lateral amb la llista d'entrenaments.
- La navegació entre entrenaments es fa des de la data superior.
- Fletxes anterior/següent per saltar entre dates que tenen entrenament.
- Si es tria una data sense entrenament, l'app permet crear-lo directament en aquella data.
- La classificació ja no mostra un botó `Baixa/Reactivar` a cada jugador.
- Hi ha dos únics controls al costat del títol de classificació: `+ Afegir jugador` i `Eliminar jugador`.
- `Eliminar jugador` obre un selector propi i després una confirmació pròpia. L'eliminació és definitiva i, per les FK amb `ON DELETE CASCADE`, elimina també assistència i resultats vinculats al jugador.

### Competicions
- Redisseny visual de cada competició: 1r/2n/3r/4t, noms i +4/+3/+2/+1 tenen una lectura molt més clara.
- Redisseny del selector de posicions dins del modal.
- Per a `Free throws` s'afegeix el toggle `2 FREE THROWS MADE`.
- Quan està activat, tots els jugadors que:
  1. han assistit a l'entrenament, i
  2. no han obtingut cap punt per posició en aquella competició
  reben automàticament +1 punt de Free Throws.
- Un jugador que ja és 1r, 2n, 3r o 4t no rep aquest +1 addicional.
- El bonus queda guardat a Supabase i es recupera en editar la competició.

### Game Data
- El total de faltes d'equip del quart es mostra també al marcador principal, per als dos equips.
- Inclou número gran i indicador visual de 5 trams.

### Confirmacions personalitzades
- Eliminats tots els `window.confirm()` natius.
- Partits, jugadors, entrenaments, competicions, reset/finalització i confirmació de falta extra utilitzen modals propis de l'app.
- Ja no apareix el diàleg lleig amb `localhost` en aquestes accions.

## Migració Supabase obligatòria

Abans d'utilitzar el bonus de Free Throws cal executar:

`supabase/migration_v3_2_training_ui.sql`

La migració:
- afegeix `training_competitions.free_throw_bonus_made`;
- permet resultats amb `place = NULL` i `points = 1` per representar el bonus 2/2.

No esborra ni modifica les dades de HOJA-1 ja importades.

## QA
- `npm run check`: OK.
- Parser TypeScript/TSX: 14 fitxers, 0 errors de sintaxi.
- No queden `confirm()` natius dins de `src/components`.
- El build complet no s'ha pogut executar en l'entorn de generació perquè les dependències npm no estan disponibles offline. Al Mac, amb les dependències instal·lades, executar `npm run build`.
