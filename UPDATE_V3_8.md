# Game Data v3.8 · Local / visitant

## Canvi principal

Abans de començar cada partit ara es pot escollir si **Kids&Us Manresa juga com a local o com a visitant**.

La selecció es fa a la pantalla de preparació del partit i queda guardada al mateix partit.

## Què canvia durant el partit

- El marcador sempre es mostra en ordre real **LOCAL — VISITANT**.
- Kids&Us apareix a l’esquerra si és local i a la dreta si és visitant.
- La cronologia del marcador conserva aquest mateix ordre local–visitant.
- Els punts s’assignen al costat físic correcte.
- Les faltes d’equip es compten al costat físic correcte, de manera que l’avís de bonus correspon a l’equip correcte.
- Els temps morts també queden associats al costat local o visitant real.
- La pantalla de faltes identifica explícitament quin equip és local i quin és visitant.
- La gestió de plantilla continua distingint internament Kids&Us i Rival, de manera que els minuts, titulars i substitucions continuen funcionant igual.

## Compatibilitat amb partits existents

Els partits creats abans d’aquesta versió queden automàticament amb **Kids&Us com a local**. Això reprodueix exactament el comportament que tenia l’app fins ara i evita reinterpretar dades històriques.

## Migració de Supabase

En una instal·lació existent, executa una vegada al SQL Editor:

```text
supabase/migration_v3_8_home_away.sql
```

La migració només afegeix la columna `games.team_side` amb valor per defecte `home`. No elimina ni reinicia partits, jugadors o esdeveniments.

En una instal·lació nova, `supabase/schema.sql` ja incorpora aquest camp.

## Versió

`3.8.0`
