# Game Data v3.10.2 · Correcció de la compilació a Vercel

## Causa corregida

A `src/components/TrainingDashboard.tsx`, la funció `saveCompetitionTitle` accedia a `draft.competition.id` tot i que `draft.competition` pot ser `null` en el tipus `CompetitionDraft`. TypeScript pot aturar `npm run build` amb l’error **TS18047**. Ara es comprova que hi ha una competició i es captura l’ID validat abans d’encuar l’operació asíncrona.

Aquest canvi és exclusivament de codi frontend. **No cal repetir la migració de Supabase** si la migració SQL corregida 3.10.1 ja s’ha aplicat correctament. Si encara no s’ha aplicat, segueix les instruccions d'`UPDATE_V3_10.md` i fes una còpia de seguretat abans de tocar la base de dades.

## Publicació a GitHub/Vercel

1. Descomprimeix `Game-Data-v3.10.2-buildfix.zip` i actualitza els fitxers del repositori GitHub (especialment `src/components/TrainingDashboard.tsx`; si puges la carpeta completa, també el `package.json` i el `package-lock.json`). No afegeixis `.env.local`.
2. Fes commit i push a la branca de producció. Vercel desplegarà el nou commit automàticament.
3. Consulta **Deployments → nou desplegament → Build Logs**, i verifica que apareix `Build Completed` / `Ready`. Si continua fallant, copia **les últimes línies dels Build Logs**, amb el primer error de TypeScript o Vite, perquè el pantallàs anterior no mostrava la causa exacta.
4. Abans d'un partit real, prova un partit i una competició amb diversos jugadors en un entorn segur.

## Verificacions

- `npm run check`: comprovacions de codi i tests Node.
- `tsc` amb declaracions substitutives de React/Supabase/Vite: cap error d’aplicació detectat; no equival a la compilació real.
- **Pendent**: `npm ci && npm run build` complet amb les dependències reals, perquè aquest entorn no té accés al registre npm. Per aquest motiu no es pot garantir que Vercel publiqui sense nous errors fins a veure els Build Logs.
