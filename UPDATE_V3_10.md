# Game Data v3.10.1 · Correcció de competicions i estabilitat dels partits

## Revisió SQL 3.10.1

La primera migració 3.10 tenia una condició `IF` amb un `CASE ... THEN` que podia provocar `ERROR 42601: syntax error at end of input` al SQL Editor de Supabase. S'han reescrit **les dues condicions afectades** (rellotge i substitució) com a comparacions booleanes simples, i les comparacions del rellotge esperat ara també detecten valors nuls. Executa **l'arxiu actualitzat** `supabase/migration_v3_10_reliability.sql`, no una còpia de la versió anterior. El script és reexecutable gràcies a `IF NOT EXISTS` i `CREATE OR REPLACE FUNCTION`, sense esborrar dades del partit.

## Què s'ha corregit

1. **Competicions**: en puntuar un jugador ja no s'esborren i reescriuen tots els resultats. Cada pulsació modifica només la fila del jugador afectat (`upsert` o eliminació puntual). Els canvis es processen en ordre, el diàleg indica si encara s'està desant i es poden reintentar els errors. No es permet tancar accidentalment mentre hi ha dades en trànsit. Per descartar canvis no guardats cal confirmar-ho.
2. **Sincronització**: les actualitzacions de Realtime als entrenaments s'agrupen per reduir peticions, i les respostes de càrregues antigues ja no poden sobreescriure les més recents. Les consultes de resultats, assistència i competicions es fan per lots i amb paginació, per evitar el límit implícit de 1.000 registres.
3. **Partits**: els canvis de rellotge amb confirmació d'alineació, les substitucions amb actualització de rellotge i les operacions de desfer es fan en una sola transacció de PostgreSQL. Si falla una part, la base de dades desfà l'operació sencera. Un identificador d'acció i un bloqueig d'interfície redueixen els duplicats i els dobles clics. El servidor detecta canvis de rellotge simultanis en altres dispositius.
4. **Recuperació**: es recorda el partit obert dins de la pestanya del navegador; si es recarrega, es recupera de Supabase. S'actualitza en recuperar la connexió o tornar a la pestanya, amb comprovacions periòdiques mentre és visible. Els errors de càrrega són visibles i hi ha botó de reintent.

## Important: ordre de desplegament

**No publiquis la versió 3.10.1 sense haver aplicat la migració!** El nou codi dels partits necessita les funcions RPC noves.

1. Fes una **còpia de seguretat real** de la base de dades de Supabase, incloent les taules `games`, `game_players`, `game_events` i totes les `training_*`. La còpia JSON de l'app cobreix entrenaments, no partits.
2. Recomanació: prova la migració i la nova app en un projecte Supabase de *staging* amb dades fictícies o una còpia controlada, abans de tocar la producció.
3. Amb el projecte existent, obre **Supabase → SQL Editor**, crea una consulta nova i executa **tot** `supabase/migration_v3_10_reliability.sql`. És additiu: no esborra els partits ni les puntuacions existents. Verifica que no hi ha errors SQL.
4. Actualitza el codi a GitHub i desplega'l a Vercel amb les variables d'entorn habituals (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_LOGIN_EMAIL`). No pugis `.env.local` ni cap clau secreta.
5. Comprova el funcionament real a la web de producció i, sobretot, en els dispositius utilitzats als partits.

**Instal·lació nova**: primer aplica `supabase/schema.sql` i la configuració habitual de l'aplicació, i després `supabase/migration_v3_10_reliability.sql`.

## Comprovar a l'ordinador

```bash
npm ci
npm run check
npm run build
npm run dev
```

La comanda `npm run check` executa la revisió d'estructura, els tests de Local/Visitant i proves dels totals de diversos jugadors, del bonus 2/2 i dels mecanismes de fiabilitat. `npm run build` és obligatori abans de desplegar.

## Proves manuals imprescindibles

- Crea una competició de cada tipus i puntua consecutivament **6-10 jugadors**. Comprova que es mantenen tots els punts sense tancar el modal.
- Canvia la puntuació d'un jugador, treu-la, torna a assignar-la, activa/desactiva el bonus 2/2 i comprova l'historial i la classificació.
- Prova una connexió lenta o una desconnexió controlada: comprova l'avís i el reintent; no tanquis mentre indica que està desant.
- Crea un partit de prova, introdueix jugadors, tria local/visitant, registra punts, faltes, temps morts, canvis, rellotge, desfer i inici de període.
- Recarrega la pestanya durant un partit de prova i verifica que es recupera el mateix partit amb els registres guardats.
- Utilitza dos dispositius alhora i comprova que els canvis es sincronitzen i que no se sobreescriuen rellotges modificats simultàniament.
- Comprova un partit finalitzat, la reobertura i la navegació per l'historial.

## Límits i precaucions

Cap app ni xarxa pot garantir el **0% d'errors en qualsevol circumstància**. Els canvis desats correctament a Supabase persisteixen, però les accions pendents durant una apagada, una fallada de xarxa o abans de rebre confirmació necessiten comprovació. Aquesta revisió s'ha efectuat sobre el codi lliurat: no inclou proves d'integració contra el Supabase ni el Vercel reals, ni auditoria de penetració. A l'entorn de revisió no s'han pogut descarregar dependències del registre npm, de manera que s'han executat els tests Node i la comprovació sintàctica TypeScript, però **no un `npm run build` complet**. Cal executar-lo en un entorn amb dependències instal·lades i fer el pilot abans del desplegament.

En cas de problemes, conserva les dades a Supabase, torna temporalment a l'anterior versió del frontend i revisa els errors abans de tornar a desplegar. La migració additiva no requereix revertir dades.
