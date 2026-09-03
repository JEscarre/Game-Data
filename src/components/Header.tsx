import { supabase } from '../lib/supabase'

interface HeaderProps {
  section: 'games' | 'training'
  onNavigate: (section: 'games' | 'training') => void
}

export function Header({ section, onNavigate }: HeaderProps) {
  return (
    <header className="app-header">
      <button className="brand-button" onClick={() => onNavigate(section)} aria-label="Anar a l'inici">
        <img src="/kids-us-manresa.png" alt="" />
        <div>
          <strong>Kids&Us Manresa</strong>
          <span>Game Data</span>
        </div>
      </button>

      <nav className="header-nav" aria-label="Seccions principals">
        <button className={section === 'games' ? 'active' : ''} onClick={() => onNavigate('games')}>Partits</button>
        <button className={section === 'training' ? 'active' : ''} onClick={() => onNavigate('training')}>Entrenaments</button>
      </nav>

      <div className="header-actions">
        <span className="header-context">{section === 'games' ? 'Seguiment de partits' : 'Control d’entrenaments'}</span>
        <button className="button ghost compact" onClick={() => supabase.auth.signOut()}>
          Tancar sessió
        </button>
      </div>
    </header>
  )
}
