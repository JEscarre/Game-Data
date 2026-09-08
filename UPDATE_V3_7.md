# Game Data v3.7 · Botó -1 al marcador

## Canvi principal

S'ha afegit un botó **-1** al marcador de cadascun dels dos equips. Serveix per corregir ràpidament un punt picat per error durant el partit sense haver d'anar a la cronologia ni desfer altres accions.

- El botó apareix al costat de `+1`, `+2` i `+3`.
- Resta exactament **1 punt** de l'equip corresponent.
- Queda desactivat quan l'equip té 0 punts i quan el partit està finalitzat.
- La correcció queda registrada com una acció del partit, apareix a la cronologia com `-1` i també es pot desfer com qualsevol altra acció.
- L'historial del marcador reflecteix el resultat corregit.

## Compatibilitat amb Supabase

**No cal cap migració SQL.** La taula existent només admet `points` 1, 2 o 3. Per mantenir compatibilitat, una correcció -1 es desa com un esdeveniment `score` amb `points = 1` i `metadata.score_delta = -1`. L'app interpreta aquest metadada com una resta en el marcador i en la cronologia.

Això preserva totes les dades i funcions existents de la v3.6.

## Versió

`3.7.0`
