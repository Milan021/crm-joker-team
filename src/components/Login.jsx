import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      let result
      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password })
        if (result.error) throw result.error
        setError('✅ Compte créé ! Vérifiez votre email pour confirmer.')
        setIsSignUp(false)
        setLoading(false)
        return
      } else {
        result = await supabase.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        onLogin(result.data.user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (err) {
      setError(err.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#122a33',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(212,175,55,0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(150,190,200,0.05) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%', maxWidth: '420px', padding: '0 1.5rem',
        position: 'relative', zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <img src="/logo-joker-team.png" alt="Joker Team - La carte pour réussir"
            style={{ maxWidth: '260px', width: '100%', height: 'auto', marginBottom: '0.5rem' }}
            onError={(e) => { e.target.style.display = 'none' }} />
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(212,175,55,0.15)',
          borderRadius: '16px', padding: '2.5rem 2rem',
          backdropFilter: 'blur(12px)'
        }}>
          <h2 style={{
            textAlign: 'center', color: '#D4AF37', fontSize: '1.15rem',
            fontWeight: 600, letterSpacing: '0.08em', marginBottom: '1.5rem',
            textTransform: 'uppercase'
          }}>
            {isSignUp ? 'Créer un compte' : 'Connexion CRM'}
          </h2>

          {/* Google Login Button */}
          <button onClick={handleGoogleLogin} disabled={googleLoading} style={{
            width: '100%', padding: '0.8rem', marginBottom: '1.25rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px', cursor: googleLoading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            color: '#e2e8f0', fontSize: '0.92rem', fontWeight: 500,
            transition: 'all 0.2s'
          }}
            onMouseEnter={e => { if (!googleLoading) e.target.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.06)'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Connexion...' : 'Continuer avec Google'}
          </button>

          {/* Separator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ color: '#4a6370', fontSize: '0.75rem' }}>ou</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block', color: '#8ba5b0', fontSize: '0.8rem',
                fontWeight: 500, marginBottom: '0.4rem', letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>Email</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required disabled={loading}
                style={{
                  width: '100%', padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', color: '#e2e8f0', fontSize: '0.95rem',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(212,175,55,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                placeholder="votre@email.fr" />
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{
                display: 'block', color: '#8ba5b0', fontSize: '0.8rem',
                fontWeight: 500, marginBottom: '0.4rem', letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>Mot de passe</label>
              <input type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required disabled={loading}
                style={{
                  width: '100%', padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', color: '#e2e8f0', fontSize: '0.95rem',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(212,175,55,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                placeholder="••••••••" />
            </div>

            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                background: error.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${error.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '8px',
                color: error.startsWith('✅') ? '#4ade80' : '#fca5a5',
                fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '0.85rem',
              background: loading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37 0%, #c9a02e 100%)',
              border: 'none', borderRadius: '8px', color: '#122a33',
              fontSize: '0.95rem', fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              letterSpacing: '0.04em', transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}>
              {loading ? 'Connexion...' : (isSignUp ? 'Créer le compte' : 'Se connecter')}
            </button>
          </form>

          <div style={{
            textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button onClick={() => { setIsSignUp(!isSignUp); setError('') }}
              style={{
                background: 'none', border: 'none', color: '#8ba5b0',
                fontSize: '0.85rem', cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: '3px'
              }}>
              {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un compte'}
            </button>
          </div>
        </div>

        {/* Security badge */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem', marginTop: '1.5rem'
        }}>
          <span style={{ fontSize: '0.8rem' }}>🔒</span>
          <span style={{ color: 'rgba(139,165,176,0.4)', fontSize: '0.72rem' }}>
            Connexion sécurisée · Données chiffrées
          </span>
        </div>

        <p style={{
          textAlign: 'center', marginTop: '0.75rem',
          color: 'rgba(139,165,176,0.3)', fontSize: '0.7rem', letterSpacing: '0.05em'
        }}>
          © {new Date().getFullYear()} Joker Team — La carte pour réussir
        </p>
      </div>
    </div>
  )
}
