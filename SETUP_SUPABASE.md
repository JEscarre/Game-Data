# Supabase · Game Data v2

## Si ja vas executar la primera versió

Com que el projecte de Supabase ja existeix, ves a `SQL Editor → New query`, copia el contingut de:

```text
supabase/migration_v2.sql
```

i prem `Run`.

La migració conserva els partits i dades existents, però elimina la funcionalitat de plantilla persistent.

## Instal·lació nova

En un projecte Supabase nou executa directament:

```text
supabase/schema.sql
```

## Usuari compartit

A `Authentication → Users` crea un únic usuari amb email i contrasenya i activa `Auto Confirm User`.

L’email només s’utilitza internament i va a `.env.local` com `VITE_LOGIN_EMAIL`. A la pantalla de l’app només es demana la contrasenya.

## Variables

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_LOGIN_EMAIL=...
```

No facis servir la `secret key` ni `service_role` al navegador.
