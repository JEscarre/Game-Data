# Auditoria Local / Visitant · v3.9

## Contracte de dades

La base de dades conserva la compatibilitat històrica:

- `game_players.side = home` = jugador de **Kids&Us**.
- `game_players.side = away` = jugador del **rival**.
- `games.team_side = home` = Kids&Us és **Local**.
- `games.team_side = away` = Kids&Us és **Visitant**.

Els esdeveniments (`score`, `foul`, `timeout`) es guarden amb el costat físic real `home/away`.

## Matriu verificada

| Acció | Kids&Us Local | Kids&Us Visitant |
| --- | --- | --- |
| Nom al marcador | Kids&Us a Local | Kids&Us a Visitant |
| +1 / +2 / +3 de Kids&Us | suma a `home` | suma a `away` |
| -1 de Kids&Us | resta a `home` | resta a `away` |
| Falta jugador Kids&Us | suma faltes `home` | suma faltes `away` |
| Falta jugador rival | suma faltes `away` | suma faltes `home` |
| Bonus | apareix a l'equip contrari quan l'oponent arriba a 4 faltes | igual, respectant el costat físic |
| Temps mort Local | es registra a `home` | es registra a `home` |
| Temps mort Visitant | es registra a `away` | es registra a `away` |
| Cronologia marcador | sempre Local–Visitant | sempre Local–Visitant |
| Panell de faltes | Local a dalt / Visitant a sota | Local a dalt / Visitant a sota |
| Plantilles preparació | Local esquerra / Visitant dreta | Local esquerra / Visitant dreta |
| Gestor de jugadors en directe | Local esquerra / Visitant dreta | Local esquerra / Visitant dreta |
| Quintet i minuts Kids&Us | conserva jugadors Kids&Us | conserva jugadors Kids&Us |

## Proves automàtiques

Executa:

```bash
npm run check
```

A la v3.9 això inclou `npm run test:home-away`, que comprova els dos escenaris i valida marcador, cronologia, faltes, bonus, temps morts, quintet, correccions `-1` i accions desfetes.

## Supabase

La v3.9 **no necessita cap migració nova**. Només cal haver executat prèviament:

```text
supabase/migration_v3_8_home_away.sql
```
