import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function MFASetup({ onVerified, onSkip }) {
  const [step, setStep] = useState('loading') // loading, setup, verify, verified
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkMFAStatus()
  }, [])

  async function checkMFAStatus() {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error

      const totp = data?.totp || []
      const verified = totp.filter(f => f.status === 'verified')

      if (verified.length > 0) {
        // MFA already set up, need to verify
        setFactorId(verified[0].id)
        setStep('verify')
      } else {
        // No MFA yet, show setup
        setStep('setup')
      }
    } catch (err) {
      console.error('MFA check error:', err)
      setStep('setup')
    }
  }

  async function enrollMFA() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'CRM Joker Team'
      })
      if (error) throw error

      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setFactorId(data.id)
      setStep('scan')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    if (code.length !== 6) {
      setError('Le code doit contenir 6 chiffres')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factorId
      })
      if (challengeError) throw challengeError

      const { data, error } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeData.id,
        code: code
      })
      if (error) throw error

      setStep('verified')
      setTimeout(() => onVerified(), 1500)
    } catch (err) {
      setError('Code incorrect. Réessayez.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#122a33', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(212,175,55,0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(150,190,200,0.05) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%', maxWidth: '440px', padding: '0 1.5rem',
        position: 'relative', zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo-joker-team.png" alt="Joker Team"
            style={{ maxWidth: '200px', width: '100%', height: 'auto' }}
            onError={(e) => { e.target.style.display = 'none' }} />
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(212,175,55,0.15)',
          borderRadius: '16px', padding: '2.5rem 2rem',
          backdropFilter: 'blur(12px)'
        }}>
          {/* Loading */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{
                width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)',
                borderTopColor: '#D4AF37', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto'
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* Setup - First time */}
          {step === 'setup' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem' }}>🔐</span>
                <h2 style={{ color: '#D4AF37', fontSize: '1.15rem', fontWeight: 600, marginTop: '0.75rem' }}>
                  Double authentification
                </h2>
                <p style={{ color: '#8ba5b0', fontSize: '0.85rem', lineHeight: 1.6, marginTop: '0.5rem' }}>
                  Protégez votre compte avec une authentification à deux facteurs (2FA).
                  Vous aurez besoin d'une app comme Google Authenticator ou Microsoft Authenticator.
                </p>
              </div>

              <button onClick={enrollMFA} disabled={loading} style={{
                width: '100%', padding: '0.85rem',
                background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
                border: 'none', borderRadius: '8px', color: '#122a33',
                fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer'
              }}>
                {loading ? 'Configuration...' : '🔐 Configurer la 2FA'}
              </button>

              <button onClick={onSkip} style={{
                width: '100%', padding: '0.7rem', marginTop: '0.75rem',
                background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', color: '#4a6370',
                fontSize: '0.82rem', cursor: 'pointer'
              }}>
                Plus tard
              </button>
            </>
          )}

          {/* Scan QR Code */}
          {step === 'scan' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ color: '#D4AF37', fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  📱 Scannez ce QR Code
                </h2>
                <p style={{ color: '#8ba5b0', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  Ouvrez Google Authenticator ou Microsoft Authenticator et scannez le code ci-dessous
                </p>
              </div>

              {/* QR Code */}
              <div style={{
                background: '#fff', borderRadius: '12px', padding: '1rem',
                display: 'flex', justifyContent: 'center', marginBottom: '1rem'
              }}>
                <img src={qrCode} alt="QR Code MFA"
                  style={{ width: '200px', height: '200px' }} />
              </div>

              {/* Manual secret */}
              <div style={{
                background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.75rem',
                marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.04)'
              }}>
                <div style={{ fontSize: '0.72rem', color: '#4a6370', marginBottom: '0.3rem' }}>
                  Ou entrez ce code manuellement :
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: '0.82rem', color: '#D4AF37',
                  letterSpacing: '0.1em', wordBreak: 'break-all'
                }}>{secret}</div>
              </div>

              {/* Verify code */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block', color: '#8ba5b0', fontSize: '0.8rem',
                  fontWeight: 500, marginBottom: '0.4rem', textTransform: 'uppercase'
                }}>Code à 6 chiffres</label>
                <input type="text" value={code} maxLength={6}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') verifyCode() }}
                  placeholder="000000"
                  style={{
                    width: '100%', padding: '0.85rem 1rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', color: '#e2e8f0',
                    fontSize: '1.5rem', fontWeight: 700,
                    textAlign: 'center', letterSpacing: '0.3em',
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'monospace'
                  }}
                  autoFocus />
              </div>

              {error && (
                <div style={{
                  padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                  color: '#fca5a5', fontSize: '0.82rem', marginBottom: '1rem'
                }}>{error}</div>
              )}

              <button onClick={verifyCode} disabled={loading || code.length !== 6} style={{
                width: '100%', padding: '0.85rem',
                background: code.length === 6 && !loading
                  ? 'linear-gradient(135deg, #D4AF37, #c9a02e)'
                  : 'rgba(212,175,55,0.3)',
                border: 'none', borderRadius: '8px', color: '#122a33',
                fontSize: '0.95rem', fontWeight: 700,
                cursor: code.length === 6 && !loading ? 'pointer' : 'default'
              }}>
                {loading ? 'Vérification...' : '✅ Vérifier et activer'}
              </button>
            </>
          )}

          {/* Verify existing MFA */}
          {step === 'verify' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem' }}>🔐</span>
                <h2 style={{ color: '#D4AF37', fontSize: '1.1rem', fontWeight: 600, marginTop: '0.75rem' }}>
                  Vérification 2FA
                </h2>
                <p style={{ color: '#8ba5b0', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Entrez le code de votre application Authenticator
                </p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <input type="text" value={code} maxLength={6}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') verifyCode() }}
                  placeholder="000000"
                  style={{
                    width: '100%', padding: '0.85rem 1rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', color: '#e2e8f0',
                    fontSize: '1.5rem', fontWeight: 700,
                    textAlign: 'center', letterSpacing: '0.3em',
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'monospace'
                  }}
                  autoFocus />
              </div>

              {error && (
                <div style={{
                  padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                  color: '#fca5a5', fontSize: '0.82rem', marginBottom: '1rem'
                }}>{error}</div>
              )}

              <button onClick={verifyCode} disabled={loading || code.length !== 6} style={{
                width: '100%', padding: '0.85rem',
                background: code.length === 6 && !loading
                  ? 'linear-gradient(135deg, #D4AF37, #c9a02e)'
                  : 'rgba(212,175,55,0.3)',
                border: 'none', borderRadius: '8px', color: '#122a33',
                fontSize: '0.95rem', fontWeight: 700,
                cursor: code.length === 6 && !loading ? 'pointer' : 'default'
              }}>
                {loading ? 'Vérification...' : '🔓 Vérifier'}
              </button>
            </>
          )}

          {/* Verified success */}
          {step === 'verified' && (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <span style={{ fontSize: '3rem' }}>✅</span>
              <h2 style={{ color: '#34d399', fontSize: '1.1rem', fontWeight: 600, marginTop: '0.75rem' }}>
                Authentification réussie !
              </h2>
              <p style={{ color: '#8ba5b0', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Redirection vers le CRM...
              </p>
            </div>
          )}
        </div>

        <p style={{
          textAlign: 'center', marginTop: '1.5rem',
          color: 'rgba(139,165,176,0.3)', fontSize: '0.7rem'
        }}>
          🔒 Connexion sécurisée · Double authentification
        </p>
      </div>
    </div>
  )
}
