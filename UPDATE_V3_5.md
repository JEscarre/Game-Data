# Game Data v3.5 · Assistència fluida

## Objectiu

Eliminar el salt visual i la sensació de recàrrega de pàgina quan es modifica l'assistència d'un jugador durant un entrenament.

## Canvis

- L'assistència s'actualitza de manera optimista al moment de prémer `P` o `A`.
- Ja no s'activa l'estat global de `Carregant dades...` en actualitzacions Realtime de fons.
- Els canvis Realtime d'assistència s'apliquen directament a la fila afectada, sense tornar a carregar totes les dades de la temporada.
- `Tots presents` i `Tots absents` també actualitzen la interfície immediatament, sense salt de pantalla.
- Si Supabase rebutja una modificació, només es desfà el canvi afectat i es mostra l'error.
- Les recàrregues necessàries després d'altres accions es fan en segon pla, mantenint l'estructura de la pàgina estable.

## Base de dades

No requereix cap migració ni cap query nova a Supabase.

## Compatibilitat

Es mantenen totes les funcionalitats de la v3.4: inici flexible de partit, plantilla i titulars editables amb el partit obert, competicions, autoguardat, bonus de tirs lliures i classificació d'entrenaments.
