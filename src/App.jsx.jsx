import { useState } from 'react'
import { supabase } from './supabase'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Contacts from './components/Contacts'
import Opportunites from './components/Opportunites'
import Candidats from './components/Candidats'

export default function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')

  useState(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  // Fonction de navigation pour Dashboard
  function handleNavigate(tab) {
    setActiveTab(tab)
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* En-tête avec logo complet */}
      <header style={{
        background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
        borderBottom: '3px solid #D4AF37',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Logo complet Joker Team */}
          <div>
            <img 
              src="/logo-joker-team.png"
              alt="Joker Team - La carte pour réussir"
              style={{ 
                height: '70px',
                width: 'auto'
              }}
              onError={(e) => {
                e.target.src = 'https://joker-team.fr/wp-content/uploads/2022/10/Logo-Joker-blanc.svg'
                e.target.style.height = '50px'
              }}
            />
          </div>

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                {user.email}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                Connecté
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '0.5rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'rgba(255, 255, 255, 0.15)'
                e.target.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)'
                e.target.style.transform = 'translateY(0)'
              }}
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Navigation moderne - 4 ONGLETS */}
      <nav style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 2rem',
          display: 'flex',
          gap: '0.5rem'
        }}>
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'contacts', icon: '👥', label: 'Contacts' },
            { id: 'opportunites', icon: '💼', label: 'Opportunités' },
            { id: 'candidats', icon: '👔', label: 'Candidats' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id 
                  ? 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)' 
                  : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#64748b',
                border: 'none',
                borderBottom: activeTab === tab.id 
                  ? '3px solid #D4AF37' 
                  : '3px solid transparent',
                padding: '1rem 1.5rem',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: activeTab === tab.id ? 600 : 500,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: activeTab === tab.id ? '8px 8px 0 0' : '0'
              }}
              onMouseEnter={e => {
                if (activeTab !== tab.id) {
                  e.target.style.background = 'rgba(44, 79, 90, 0.05)'
                  e.target.style.color = '#2C4F5A'
                }
              }}
              onMouseLeave={e => {
                if (activeTab !== tab.id) {
                  e.target.style.background = 'transparent'
                  e.target.style.color = '#64748b'
                }
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Contenu principal */}
      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '2rem'
      }}>
        {activeTab === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {activeTab === 'contacts' && <Contacts />}
        {activeTab === 'opportunites' && <Opportunites />}
        {activeTab === 'candidats' && <Candidats />}
      </main>
    </div>
  )
}
