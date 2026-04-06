import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        alert('✅ Compte créé ! Vérifiez votre email pour confirmer votre inscription.')
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        if (data?.user) {
          onLogin(data.user)
        }
      }
    } catch (error) {
      setError(error.message)
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
      background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src="https://joker-team.fr/wp-content/uploads/2022/10/Logo-Joker-blanc.svg"
            alt="Joker Team"
            style={{ 
              height: '60px',
              marginBottom: '1rem',
              filter: 'brightness(0) saturate(100%) invert(23%) sepia(15%) saturate(1847%) hue-rotate(142deg) brightness(95%) contrast(91%)'
            }}
          />
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: '0.5rem'
          }}>
            🃏 CRM Joker Team
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {isSignUp ? 'Créer votre compte' : 'Connectez-vous à votre espace'}
          </p>
        </div>
        
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            borderLeft: '4px solid #ef4444',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 500,
              color: '#475569',
              fontSize: '0.9rem'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="votre@email.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.95rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2C4F5A'
                e.target.style.boxShadow = '0 0 0 3px rgba(44, 79, 90, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 500,
              color: '#475569',
              fontSize: '0.9rem'
            }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.95rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2C4F5A'
                e.target.style.boxShadow = '0 0 0 3px rgba(44, 79, 90, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 8px 20px rgba(44, 79, 90, 0.3)'
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = 'none'
            }}
          >
            {loading ? 'Chargement...' : (isSignUp ? '✨ Créer un compte' : '🔐 Se connecter')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#2C4F5A',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            {isSignUp ? '← Déjà un compte ? Se connecter' : '→ Pas de compte ? Créer un compte'}
          </button>
        </div>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.8rem'
        }}>
          <div>🃏 Joker Team - La carte pour réussir</div>
          <div style={{ marginTop: '0.25rem' }}>CRM Pro © 2026</div>
        </div>
      </div>
    </div>
  )
}
