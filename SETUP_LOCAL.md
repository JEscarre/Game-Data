# Instal·lació local · Windows

1. Obre la carpeta del projecte amb Visual Studio Code.
2. Obre `Terminal → New Terminal`.
3. Instal·la dependències:

```powershell
npm install
```

4. Comprova que `.env.local` contingui:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_LOGIN_EMAIL=...
```

5. Arrenca l’app:

```powershell
npm run dev
```

L’adreça és sempre:

```text
http://localhost:3000
```

Vite està configurat perquè intenti obrir el navegador predeterminat. Si no s’obre Google Chrome, obre Chrome manualment i escriu `http://localhost:3000`.

També pots obrir-lo des d’un segon PowerShell amb:

```powershell
Start-Process chrome "http://localhost:3000"
```

Per comprovar la versió de producció:

```powershell
npm run build
npm run preview
```

## Canvis v3

Després d’actualitzar la carpeta, executa `npm install` i `npm run build`. Si la base de dades ja existia, recorda executar `supabase/migration_v3_training.sql` i `supabase/seed_training_excel.sql` abans d’utilitzar la pestanya **Entrenaments**.
