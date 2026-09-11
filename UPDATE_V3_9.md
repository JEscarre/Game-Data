# Actualització v3.9 · Revisió Local / Visitant

Aquesta versió no necessita cap migració nova de Supabase si ja has executat `supabase/migration_v3_8_home_away.sql`.

## Canvis visuals

- El comptador de titulars de la pantalla de preparació ja no queda estret ni talla el text “Opcional”.
- Ara mostra el recompte `0/5`, l’etiqueta `Titulars` i un distintiu `Opcional` en un bloc més ample i llegible.
- Les dues targetes d’equip de la preparació s’ordenen sempre físicament com `LOCAL` a l’esquerra i `VISITANT` a la dreta, encara que Kids&Us sigui visitant.
- El gestor de jugadors durant el partit segueix el mateix ordre físic Local / Visitant.

## Revisió funcional Local / Visitant

S’ha centralitzat i verificat el contracte següent:

- `game_players.side = home` continua significat **jugador de Kids&Us** (compatibilitat amb les dades existents).
- `game_players.side = away` continua significat **jugador del rival**.
- `games.team_side` és qui decideix si Kids&Us és físicament `home` (local) o `away` (visitant).
- Els esdeveniments de partit (`score`, `foul`, `timeout`) utilitzen sempre el costat físic real Local / Visitant.

Això garanteix que, si Kids&Us és visitant, una falta d’un jugador de Manresa suma a les faltes del costat visitant, i si és local suma al costat local.

## Bonus

- El bonus es calcula segons les faltes de l’oponent.
- Amb 4 faltes d’equip de l’oponent en el període, l’altre equip queda marcat com a `BONUS`.
- El distintiu es mostra al costat de l’equip que rep el bonus, no al costat de l’equip que ha comès les faltes.

## Test automàtic

S’ha afegit:

```bash
npm run test:home-away
```

El test comprova els dos escenaris (Kids&Us local i Kids&Us visitant) per a:

- noms i costat físic dels equips;
- punts i marcador;
- cronologia del marcador;
- faltes individuals;
- faltes d’equip;
- bonus;
- temps morts;
- quintet / jugadors de Kids&Us;
- correccions `-1` i accions desfetes.

`npm run check` executa també aquest test.
