import { supabase } from '../lib/supabase'

interface HeaderProps {
  onHome: () => void
}

export function Header({ onHome }: HeaderProps) {
  return (
    <header className="app-header">
      <button className="brand-button" onClick={onHome} aria-label="Anar als partits">
        <img src="/kids-us-manresa.png" alt="" />
        <div>
          <strong>Kids&Us Manresa</strong>
          <span>Game Data</span>
        </div>
      </button>

      <div className="header-actions">
        <span className="header-context">Seguiment de partits</span>
        <button className="button ghost compact" onClick={() => supabase.auth.signOut()}>
          Tancar sessió
        </button>
      </div>
    </header>
  )
}
