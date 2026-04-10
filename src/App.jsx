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
import GlobalSearch from './components/GlobalSearch'
import ChatBot from './components/ChatBot'
import ContentGenerator from './components/ContentGenerator'
import MFASetup from './components/MFASetup'

const TABS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'contacts', icon: '👥', label: 'Contacts' },
  { id: 'opportunites', icon: '💼', label: 'Opportunités' },
  { id: 'candidats', icon: '👔', label: 'Candidats' },
  { id: 'veille', icon: '🔍', label: 'Veille' },
  { id: 'content', icon: '✍️', label: 'Contenu' },
  { id: 'matching', icon: '🤖', label: 'Matching IA' },
  { id: 'config', icon: '⚙️', label: 'Paramètres' }
]

export default function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [mfaVerified, setMfaVerified] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) setMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)

    // Ctrl+K global shortcut
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  function switchTab(tabId) {
    setActiveTab(tabId)
    setMenuOpen(false)
  }

  if (!user) return <Login onLogin={setUser} />

  // Show MFA setup/verify after login
  if (!mfaVerified) {
    return <MFASetup 
      onVerified={() => setMfaVerified(true)} 
      onSkip={() => setMfaVerified(true)} 
    />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* ─── GLOBAL SEARCH OVERLAY ─── */}
      {showSearch && (
        <GlobalSearch
          onNavigate={(tab) => switchTab(tab)}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* ─── HEADER ─── */}
      <header style={{
        background: 'linear-gradient(135deg, #122a33 0%, #1a3a45 100%)',
        borderBottom: '3px solid #D4AF37',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        position: 'relative', zIndex: 300
      }}>
        <div style={{
          maxWidth: '1400px', margin: '0 auto',
          padding: isMobile ? '0.6rem 1rem' : '0.75rem 2rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <img src="/logo-joker-team.png" alt="Joker Team"
            style={{ height: isMobile ? '42px' : '65px', width: 'auto', cursor: 'pointer' }}
            onClick={() => switchTab('dashboard')}
            onError={(e) => { e.target.style.display = 'none' }} />

          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Search button */}
              <button onClick={() => setShowSearch(true)} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '0.4rem 1rem',
                color: '#64808b', fontSize: '0.82rem', cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                🔍 Rechercher...
                <kbd style={{
                  padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.6rem',
                  background: 'rgba(255,255,255,0.08)', color: '#4a6370',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>Ctrl+K</kbd>
              </button>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>{user.email}</div>
                <div style={{ color: '#64808b', fontSize: '0.7rem' }}>Connecté</div>
              </div>
              <button onClick={handleLogout} style={{
                background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
                color: '#D4AF37', padding: '0.45rem 1.2rem', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
              }}>Déconnexion</button>
            </div>
          )}

          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setShowSearch(true)} style={{
                background: 'none', border: 'none', color: '#D4AF37',
                fontSize: '1.3rem', cursor: 'pointer', padding: '0.25rem'
              }}>🔍</button>
              <button onClick={() => setMenuOpen(!menuOpen)} style={{
                background: 'none', border: 'none', color: '#D4AF37',
                fontSize: '1.6rem', cursor: 'pointer', padding: '0.25rem', lineHeight: 1
              }}>{menuOpen ? '✕' : '☰'}</button>
            </div>
          )}
        </div>
      </header>

      {/* ─── DESKTOP NAV ─── */}
      {!isMobile && (
        <nav style={{
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          position: 'sticky', top: 0, zIndex: 200
        }}>
          <div style={{
            maxWidth: '1400px', margin: '0 auto', padding: '0 2rem',
            display: 'flex', gap: '0.25rem', overflowX: 'auto'
          }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => switchTab(tab.id)} style={{
                background: activeTab === tab.id ? 'linear-gradient(135deg, #122a33, #1a3a45)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#475569',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #D4AF37' : '3px solid transparent',
                padding: '0.85rem 1.2rem', cursor: 'pointer', fontSize: '0.88rem',
                fontWeight: activeTab === tab.id ? 600 : 500,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                borderRadius: activeTab === tab.id ? '6px 6px 0 0' : '0', whiteSpace: 'nowrap'
              }}>
                <span>{tab.icon}</span><span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* ─── MOBILE SLIDE-DOWN NAV ─── */}
      {isMobile && menuOpen && (
        <>
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 250, animation: 'fadeIn 0.2s ease'
          }} onClick={() => setMenuOpen(false)} />
          <nav style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            background: '#122a33', borderBottom: '3px solid #D4AF37',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 260,
            animation: 'slideDown 0.25s ease', maxHeight: '100vh', overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
              <img src="/logo-joker-team.png" alt="Joker Team" style={{ height: '36px' }}
                onError={(e) => { e.target.style.display = 'none' }} />
              <button onClick={() => setMenuOpen(false)} style={{
                background: 'none', border: 'none', color: '#D4AF37',
                fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1
              }}>✕</button>
            </div>
            <div style={{ padding: '0.5rem 0' }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => switchTab(tab.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  width: '100%', padding: '0.9rem 1.5rem',
                  background: activeTab === tab.id ? 'rgba(212,175,55,0.12)' : 'transparent',
                  border: 'none',
                  borderLeft: `3px solid ${activeTab === tab.id ? '#D4AF37' : 'transparent'}`,
                  color: activeTab === tab.id ? '#D4AF37' : '#8ba5b0',
                  fontSize: '1rem', fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left'
                }}>
                  <span style={{ fontSize: '1.25rem', width: '28px', textAlign: 'center' }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: '#64808b', fontSize: '0.8rem', marginBottom: '0.6rem' }}>{user.email}</div>
              <button onClick={handleLogout} style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171', padding: '0.6rem 1rem', borderRadius: '8px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, width: '100%'
              }}>🚪 Déconnexion</button>
            </div>
          </nav>
        </>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main style={{
        maxWidth: '1400px', margin: '0 auto',
        padding: isMobile ? '1rem 0.75rem' : '2rem',
        paddingBottom: isMobile ? '5rem' : '2rem'
      }}>
        {activeTab === 'dashboard' && <Dashboard onNavigate={switchTab} />}
        {activeTab === 'contacts' && <Contacts />}
        {activeTab === 'opportunites' && <Opportunites />}
        {activeTab === 'candidats' && <Candidats />}
        {activeTab === 'veille' && <Veille />}
        {activeTab === 'content' && <ContentGenerator />}
        {activeTab === 'matching' && <Matching />}
        {activeTab === 'config' && <VeilleConfig />}
      </main>

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      {isMobile && !menuOpen && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#122a33', borderTop: '2px solid #D4AF37',
          display: 'flex', justifyContent: 'space-around',
          padding: '0.35rem 0 calc(0.35rem + env(safe-area-inset-bottom, 0px)) 0',
          zIndex: 200, boxShadow: '0 -4px 16px rgba(0,0,0,0.2)'
        }}>
          {TABS.slice(0, 5).map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id)} style={{
              background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem',
              padding: '0.25rem 0.4rem', cursor: 'pointer',
              color: activeTab === tab.id ? '#D4AF37' : '#4a6370',
              minWidth: '44px', minHeight: '44px', justifyContent: 'center'
            }}>
              <span style={{ fontSize: '1.15rem' }}>{tab.icon}</span>
              <span style={{ fontSize: '0.58rem', fontWeight: activeTab === tab.id ? 600 : 400 }}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ─── AI CHATBOT ─── */}
      <ChatBot />

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideDown { from { transform: translateY(-100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}
