# Actualitzar el projecte local existent a la v2

Aquesta carpeta està pensada per substituir el codi de la v1 conservant el teu `.env.local`.

## 1. Atura Vite

Al terminal on estigui corrent:

```powershell
Ctrl + C
```

## 2. Conserva `.env.local`

No l’esborris. Conté la URL, la publishable key i l’email intern de Supabase.

## 3. Substitueix els fitxers del projecte

Copia el contingut de la carpeta v2 damunt de `C:\Users\Usuari\Desktop\Game Data`.

La v2 ja no utilitza `src/components/RosterManager.tsx`; si encara existeix a la teva carpeta local, el pots eliminar.

## 4. Migra Supabase

A `Supabase → SQL Editor → New query`, executa tot el contingut de:

```text
supabase/migration_v2.sql
```

## 5. Torna a arrencar

Com que no s’han afegit dependències noves, normalment no cal tornar a fer `npm install`.

```powershell
npm run dev
```

Obre Google Chrome a:

```text
http://localhost:3000
```

Si vols forçar Chrome des d’un segon PowerShell:

```powershell
Start-Process chrome "http://localhost:3000"
```

## v3.6 · 2/2 + backup d'entrenaments

Si ja tens la v3.5 en producció:

1. Substitueix el frontend per la carpeta v3.6 conservant `.env.local`.
2. Executa una vegada `supabase/migration_v3_6_ft_bonus_all.sql` al SQL Editor de Supabase.
3. Executa `npm install`, `npm run check` i `npm run build`.
4. Prova una competició de Free Throws amb `2 FREE THROWS MADE`: tots els presents han de rebre +1, també els que tinguin 4/3/2/1 punts base.
5. Prova el botó `Còpia de seguretat` a Entrenaments i verifica que es descarrega un JSON amb totes les temporades i taules d'entrenament.
