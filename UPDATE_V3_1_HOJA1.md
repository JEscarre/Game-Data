# v3.1 · Correcció import HOJA-1

Aquesta versió corregeix l'import del mòdul d'entrenaments.

## Font correcta

La font de dades és exclusivament **HOJA-1** del fitxer `Control competiciones 26-27.xlsx`, és a dir la fulla amb jugadors com **JD NOTAE, KOLENDA, BENITEZ, VILA, BASSAS, ORIOLA, etc.**

No s'importen `SEPTIEMBRE`, `OCTUBRE` ni `Challengue`.

## Dates

HOJA-1 conserva dates Excel de 2025 als primers registres (20–29 d'agost), tot i que el fitxer correspon a 2026-27. Per a la temporada actual s'han mapat a **20–29/08/2026**, mantenint dia i mes.

## Com s'interpreta l'Excel

- `ASISTENCIA`: `x` = present.
- `SHOOTING`: punts agregats del dia.
- `FREE THROW`: punts agregats del dia.
- `GAMES`: Competition. En les dades actuals de HOJA-1 no hi ha punts registrats en aquesta categoria.
- L'Excel calcula les xifres de temporada dividint els punts acumulats entre el nombre d'assistències. La v3.1 replica aquesta lògica i, alhora, mostra els punts bruts.

L'Excel no conserva el podi individual de cada competició històrica quan en un mateix entrenament n'hi havia més d'una; només en conserva el total de punts del dia per jugador i categoria. Per això aquests valors s'emmagatzemen com a punts importats agregats. Les competicions noves sí que es registren una a una amb 1r/2n/3r/4t.

## Ajustos de cel·les antigues dins HOJA-1

Hi ha tres cel·les llunyanes de la zona principal que afecten els totals calculats de l'Excel. Per mantenir exactament els totals de la fulla sense crear entrenaments amb dates incoherents, es conserven com a crèdits d'import:

- DREJER: +3 punts de Free Throw.
- SHALEV: +5 punts de Free Throw.
- SHALEV: +2 assistències.

## Query de correcció

Per a un Supabase on ja s'havia executat la v3 anterior, executar una sola vegada:

`supabase/replace_training_with_HOJA1.sql`

Aquesta query elimina exclusivament les dades de les taules `training_*` i les reemplaça per HOJA-1. No toca cap dada de partits (`games`, `game_players`, `game_events`, etc.).
