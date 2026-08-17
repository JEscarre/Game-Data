import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const email = import.meta.env.VITE_LOGIN_EMAIL
    if (!email) {
      setError('Falta configurar VITE_LOGIN_EMAIL a .env.local.')
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError('La contrasenya no és correcta.')
    setLoading(false)
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <img className="login-logo" src="/kids-us-manresa.png" alt="Kids&Us Manresa" />
          <div>
            <p className="eyebrow">GAME DATA</p>
            <h1>Seguiment de partits</h1>
          </div>
        </div>

        <p className="login-intro">Accés compartit de l’staff. Introdueix la contrasenya per continuar.</p>

        <form onSubmit={submit} className="stack gap-md">
          <label className="field">
            <span>Contrasenya</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              required
            />
          </label>

          {error && <div className="error-banner">{error}</div>}

          <button className="button primary large full-width" disabled={loading}>
            {loading ? 'Entrant...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
