# Game Data v3 · Actualització de partits + entrenaments

## Què canvia

### Partits
- El control ràpid del rellotge passa de minut en minut a blocs de **30 segons**.
- Si el rellotge està en un temps no rodó (per exemple 6:37), el primer toc el porta a 6:30 i després continua 6:00, 5:30, etc.
- Les faltes es veuen directament a pista i banqueta amb un indicador gran `F x/5`, amb intensitat visual creixent fins a la cinquena falta.

### Entrenaments
- Nova pestanya **Entrenaments** separada de Partits.
- Registre d'assistència per data amb P/A individual i accions massives.
- Percentatge i totals d'assistència per jugador.
- Competicions il·limitades per entrenament en tres categories: **Shooting**, **Free throws** i **Competition**.
- Puntuació: 1r = 4, 2n = 3, 3r = 2, 4t = 1; es permeten empats a qualsevol posició.
- Classificació acumulada de temporada per categoria i total.
- Alta de jugadors amb data d'incorporació; els entrenaments previs a la seva alta no entren al seu denominador d'assistència.
- Baixa/reactivació de jugadors sense perdre historial.
- Selector de temporada i temporada històrica importada.

## Dades importades de l'Excel

El fitxer original queda a `data/Control competiciones 26-27.xlsx` i la conversió estructurada a `data/excel_import.json`.

S'han preparat:
- 15 jugadors de la temporada 2026-27.
- La classificació recuperable del full `Challengue`.
- 29 jugadors històrics, 9 registres d'entrenament detallats, 227 registres d'assistència i 13 competicions recuperables del bloc coherent de `HOJA-1`.

Els fulls `SEPTIEMBRE` i `OCTUBRE` mostren totals cachejats de 20 assistències però no contenen el detall de les marques que permetria reconstruir les dates. Per això aquests 20 no s'han convertit en sessions fictícies. Consulta `EXCEL_IMPORT_NOTES.md` per al detall complet.

## Actualitzar un Supabase que ja té Game Data v2

A **Supabase → SQL Editor**, executa en aquest ordre:

```text
supabase/migration_v3_training.sql
supabase/seed_training_excel.sql
```

No tornis a executar `schema.sql` sobre una base de dades v2 existent.

## Local

```bash
npm install
npm run check
npm run build
npm run dev
```

## Vercel

Un cop executada la migració i el seed a Supabase, puja el codi al mateix repositori. No calen variables d'entorn noves.
