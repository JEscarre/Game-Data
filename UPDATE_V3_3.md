# Game Data v3.3 · Retocs Training Control

Actualització visual i d'interacció sobre la v3.2. No necessita cap migració nova de Supabase.

## Canvis

- El bloc de resultats del dia ja no mostra cap referència a Excel.
- El resum del dia agrega els punts de les dades històriques i de les competicions registrades des de l'app.
- La classificació de temporada és més compacta, centrada i visual, amb codis de color diferenciats per Assistència, Shooting, Free Throws, Competition i Total.
- Les competicions es guarden automàticament quan s'assignen o es retiren punts i quan s'activa/desactiva el bonus `2 FREE THROWS MADE`.
- S'elimina el botó `Guardar resultats` i s'afegeix un indicador d'autoguardat.
- La pantalla de registre mostra punts directes (`4 punts`, `3 punts`, `2 punts`, `1 punt`) en lloc de posicions (`1r`, `2n`, etc.).
- L'assistència és ara un desplegable: es pot obrir per passar llista i tancar després per guanyar espai vertical.
- Es manté tota la resta de la v3.2: navegació d'entrenaments per data, eliminació centralitzada de jugadors, bonus FT, modals propis d'eliminació, rellotge en trams de 30 segons i faltes d'equip del quart més visibles.

## Base de dades

No executis cap SQL nou per passar de v3.2 a v3.3. Aquesta versió només modifica frontend i UX.

## Actualització local

Si substitueixes la carpeta completa, conserva el teu `.env.local` anterior o torna a crear-lo amb les mateixes variables de Supabase.

```bash
npm install
npm run check
npm run dev
```
