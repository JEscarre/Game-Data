# Update v3.4 · Partit obert sense plantilla completa

## Objectiu

La preparació del partit deixa de ser un bloqueig. Ara es pot començar un partit sense haver completat la plantilla i sense haver seleccionat els cinc titulars.

## Canvis principals

- **Començar sense quintet inicial**: el botó `Començar partit` ja no exigeix 5 titulars.
- **Començar sense plantilla completa**: no cal tenir 5 jugadors locals ni haver introduït tots els jugadors dels dos equips.
- **Gestió amb el partit obert**: nou botó `Jugadors i titulars` a la barra superior del Match Console.
- **Quintet inicial editable en directe**: es poden marcar o desmarcar titulars de Kids&Us fins a un màxim de cinc.
- **Afegir jugadors en directe**: es poden afegir jugadors a Kids&Us o al rival durant el partit.
- **Editar jugadors en directe**: dorsal, nom i posició es poden corregir sense sortir del partit.
- **Eliminar jugadors en directe**: disponible per als dos equips amb el modal de confirmació propi de l'app.
- **Protecció de coherència**: si s'elimina un titular, també es retira de `initial_lineup`. Si el jugador té accions vinculades, el modal ho avisa abans d'eliminar-lo.
- **Pista buida usable**: si encara no hi ha titulars, el Match Console mostra un accés directe per configurar-los en lloc de bloquejar l'entrada al partit.

## Minuts

La selecció de titulars modifica `games.initial_lineup`. Per tant, si es corregeixen els titulars després d'haver avançat el rellotge, els minuts es recalculen des de l'inici del partit segons el quintet inicial corregit i els canvis que ja hi hagi registrats.

## Base de dades

Aquesta versió **no necessita cap migració nova de Supabase**. Utilitza les taules i columnes existents (`games.initial_lineup` i `game_players`).

## Versió

`3.4.0`
