# Supabase · Game Data v3

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

## 5. Actualització v3 · Entrenaments

Si el projecte ja tenia la versió de partits en producció, **no tornis a executar tot `schema.sql`**. Executa, en aquest ordre:

1. `supabase/migration_v3_training.sql`
2. `supabase/seed_training_excel.sql`

El seed és idempotent: utilitza `source_key` i es pot tornar a executar si cal. Crea la temporada 2026-27, el roster importat i les dades històriques recuperables de l’Excel.

Per una base de dades nova, executa `supabase/schema.sql` i després `supabase/seed_training_excel.sql`.
