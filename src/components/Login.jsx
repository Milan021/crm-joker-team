import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
      {/* Subtle geometric pattern overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(212,175,55,0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(150,190,200,0.05) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '0 1.5rem',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <img
            src="/logo-joker-team.png"
            alt="Joker Team - La carte pour réussir"
            style={{
              maxWidth: '260px',
              width: '100%',
              height: 'auto',
              marginBottom: '0.5rem'
            }}
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(212,175,55,0.15)',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          backdropFilter: 'blur(12px)'
        }}>
          <h2 style={{
            textAlign: 'center',
            color: '#D4AF37',
            fontSize: '1.15rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            marginBottom: '2rem',
            textTransform: 'uppercase'
          }}>
            {isSignUp ? 'Créer un compte' : 'Connexion CRM'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                color: '#8ba5b0',
                fontSize: '0.8rem',
                fontWeight: 500,
                marginBottom: '0.4rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(212,175,55,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                placeholder="votre@email.fr"
              />
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{
                display: 'block',
                color: '#8ba5b0',
                fontSize: '0.8rem',
                fontWeight: 500,
                marginBottom: '0.4rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(212,175,55,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                background: error.startsWith('✅')
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(239,68,68,0.1)',
                border: `1px solid ${error.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '8px',
                color: error.startsWith('✅') ? '#4ade80' : '#fca5a5',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                lineHeight: 1.5
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: loading
                  ? 'rgba(212,175,55,0.3)'
                  : 'linear-gradient(135deg, #D4AF37 0%, #c9a02e 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#122a33',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                letterSpacing: '0.04em',
                transition: 'opacity 0.2s, transform 0.1s',
                opacity: loading ? 0.7 : 1
              }}
              onMouseEnter={(e) => { if (!loading) e.target.style.opacity = '0.9' }}
              onMouseLeave={(e) => { if (!loading) e.target.style.opacity = '1' }}
            >
              {loading ? 'Connexion...' : (isSignUp ? 'Créer le compte' : 'Se connecter')}
            </button>
          </form>

          <div style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError('') }}
              style={{
                background: 'none',
                border: 'none',
                color: '#8ba5b0',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '3px'
              }}
            >
              {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un compte'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '2rem',
          color: 'rgba(139,165,176,0.4)',
          fontSize: '0.75rem',
          letterSpacing: '0.05em'
        }}>
          © {new Date().getFullYear()} Joker Team — La carte pour réussir
        </p>
      </div>
    </div>
  )
}
