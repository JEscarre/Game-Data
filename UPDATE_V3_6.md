# Game Data v3.6 · Bonus 2/2 correcte + còpia de seguretat

## Canvis principals

### 1. Regla correcta de `2 FREE THROWS MADE`

Quan una competició de Free Throws té activat `2 FREE THROWS MADE`, **cada jugador present a aquell entrenament rep +1 punt de Free Throws**, encara que ja hagi aconseguit 4, 3, 2 o 1 punt en la mateixa competició.

A partir de la v3.6, els resultats de competició guarden només els punts base de classificació (4/3/2/1). El bonus +1 es deriva de:

- `training_competitions.free_throw_bonus_made = true`
- assistència `present` del jugador en la sessió corresponent.

Això evita duplicats i fa que, si després es corregeix l'assistència, la puntuació del bonus quedi coherent automàticament.

### 2. Correcció de bonus 2/2 ja registrats

Executa una vegada:

```text
supabase/migration_v3_6_ft_bonus_all.sql
```

La query és idempotent. Elimina exclusivament les antigues files sintètiques de bonus (+1 amb `place = null`) de les competicions FT que ja tenien 2/2 activat i conserva tots els resultats base 4/3/2/1. La v3.6 calcula després el +1 per a **tots** els presents.

No elimina entrenaments, assistències, jugadors, competicions ni resultats classificats.

### 3. Còpia de seguretat manual

A la capçalera d'`Entrenaments` hi ha el botó **Còpia de seguretat**.

En prémer-lo, l'app consulta totes les files de totes les temporades (amb paginació de 1.000 registres) i descarrega un únic fitxer JSON amb:

- temporades;
- jugadors;
- entrenaments;
- assistència per dia;
- competicions;
- resultats 4/3/2/1;
- estat del bonus 2/2;
- punts importats;
- vista llegible per entrenament;
- classificació calculada per temporada;
- còpia `raw` de totes les taules d'entrenaments.

El fitxer no inclou credencials, claus de Supabase ni dades de partits.

### 4. Ordre de la secció de competicions

La pantalla mostra ara:

1. **Afegir resultats** (Shooting / Free Throws / Competition).
2. **Resultats del dia** agregats.
3. Detall de les competicions registrades.

## Versió

`3.6.0`
