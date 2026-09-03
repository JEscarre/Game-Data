# GitHub + Vercel

## GitHub

Des del terminal dins del projecte:

```bash
git init
git add .
git commit -m "KidsUs Game Data v2"
git branch -M main
git remote add origin URL_DEL_REPOSITORI
git push -u origin main
```

`.env.local` està ignorat i no s’ha de pujar.

## Vercel

1. Importa el repositori de GitHub.
2. Vercel detectarà Vite automàticament.
3. A `Environment Variables` afegeix:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_LOGIN_EMAIL
```

4. Assigna-les a `Production` i, si vols, també a `Preview`.
5. Desplega.

Cada `git push` posterior generarà un nou desplegament.


## Entrenaments v3

Abans d'obrir la nova pestanya **Entrenaments** en producció, actualitza Supabase:

1. Executa `supabase/migration_v3_training.sql`.
2. Executa `supabase/seed_training_excel.sql`.
3. Després fes `git push`; Vercel desplegarà el codi nou amb les mateixes variables d'entorn.

El seed és idempotent i no elimina ni modifica els partits existents.
