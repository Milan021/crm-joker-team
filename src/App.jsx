import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Contacts from './components/Contacts'
import Opportunites from './components/Opportunites'
import Candidats from './components/Candidats'
import Veille from './components/Veille'
import VeilleConfig from './components/VeilleConfig'
import Matching from './components/Matching'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    setMobileMenuOpen(false) // Fermer le menu mobile après sélection
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  const tabs = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'contacts', icon: '👥', label: 'Contacts' },
    { id: 'opportunites', icon: '💼', label: 'Opportunités' },
    { id: 'candidats', icon: '👔', label: 'Candidats' },
    { id: 'veille', icon: '📰', label: 'Veille' },
    { id: 'matching', icon: '🤖', label: 'Matching IA' },
    { id: 'parametres', icon: '⚙️', label: 'Paramètres' }
  ]

  const TabButton = ({ tab, isMobile = false }) => (
    <button
      onClick={() => handleTabChange(tab.id)}
      style={{
        background: activeTab === tab.id 
          ? 'rgba(255, 255, 255, 0.2)' 
          : 'transparent',
        color: '#fff',
        border: 'none',
        padding: isMobile ? '1rem' : '0.75rem 1.5rem',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: activeTab === tab.id ? 700 : 500,
        fontSize: isMobile ? '1rem' : '0.95rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        width: isMobile ? '100%' : 'auto',
        justifyContent: isMobile ? 'flex-start' : 'center',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap'
      }}
    >
      <span>{tab.icon}</span>
      <span>{tab.label}</span>
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
        color: '#fff',
        padding: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Logo */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            cursor: 'pointer'
          }}
          onClick={() => handleTabChange('dashboard')}
          >
            <span style={{ fontSize: '1.8rem' }}>🃏</span>
            <div>
              <div style={{ 
                fontSize: '1.2rem', 
                fontWeight: 700,
                lineHeight: 1.2
              }}>
                Joker Team
              </div>
              <div style={{ 
                fontSize: '0.7rem', 
                color: '#D4AF37',
                letterSpacing: '1px'
              }}>
                LA CARTE POUR RÉUSSIR
              </div>
            </div>
          </div>

          {/* Navigation Desktop */}
          <nav className="hide-mobile" style={{ 
            display: 'flex', 
            gap: '0.5rem',
            alignItems: 'center'
          }}>
            {tabs.map(tab => (
              <TabButton key={tab.id} tab={tab} />
            ))}
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(220, 38, 38, 0.2)',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                marginLeft: '1rem'
              }}
            >
              🚪 Déconnexion
            </button>
          </nav>

          {/* Hamburger Menu (Mobile) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="hide-desktop"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#fff',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '50px',
              height: '50px'
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Menu Mobile */}
        {mobileMenuOpen && (
          <nav 
            className="hide-desktop"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.2)',
              animation: 'slideDown 0.3s ease-out'
            }}
          >
            {tabs.map(tab => (
              <TabButton key={tab.id} tab={tab} isMobile />
            ))}
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(220, 38, 38, 0.2)',
                color: '#fff',
                border: 'none',
                padding: '1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '1rem',
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span>🚪</span>
              <span>Déconnexion</span>
            </button>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: window.innerWidth < 768 ? '1rem' : '2rem'
      }}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'contacts' && <Contacts />}
        {activeTab === 'opportunites' && <Opportunites />}
        {activeTab === 'candidats' && <Candidats />}
        {activeTab === 'veille' && <Veille />}
        {activeTab === 'matching' && <Matching />}
        {activeTab === 'parametres' && <VeilleConfig />}
      </main>

      {/* Animation CSS */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
