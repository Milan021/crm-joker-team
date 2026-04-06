import { useState, useRef, useEffect } from 'react'

const SUGGESTIONS = [
  "Qui est disponible en COBOL ?",
  "Combien j'ai gagné ce mois ?",
  "Quels deals dois-je relancer ?",
  "Quel freelance pour la mission BNP ?",
  "Résume l'activité de la semaine",
  "Liste les candidats en intercontrat",
  "Quel est mon pipeline total ?",
  "Qui a le TJM le plus élevé ?"
]

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "👋 Bonjour Milan ! Je suis l'assistant IA Joker Team.\n\nJe peux interroger votre CRM en temps réel. Posez-moi une question !" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPulse, setShowPulse] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
    if (isOpen) setShowPulse(false)
  }, [isOpen])

  async function sendMessage(text) {
    const msg = text || input.trim()
    if (!msg || loading) return

    const userMsg = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.filter(m => m.role !== 'system').slice(-6)
        })
      })

      if (!resp.ok) throw new Error(`Erreur API: ${resp.status}`)

      const data = await resp.json()
      
      if (data.success && data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        throw new Error(data.error || 'Erreur inconnue')
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Erreur : ${err.message}\n\nVérifiez que l'API est déployée sur Vercel.`
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function clearHistory() {
    setMessages([
      { role: 'assistant', content: "🔄 Conversation réinitialisée. Comment puis-je vous aider ?" }
    ])
  }

  return (
    <>
      {/* ── FLOATING BUTTON ── */}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} style={{
          position: 'fixed', bottom: '90px', right: '24px', zIndex: 500,
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(212,175,55,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.6rem', transition: 'all 0.3s',
          animation: showPulse ? 'chatPulse 2s infinite' : 'none'
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          🤖
        </button>
      )}

      {/* ── CHAT PANEL ── */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '24px', zIndex: 500,
          width: '400px', maxWidth: 'calc(100vw - 48px)',
          height: '550px', maxHeight: 'calc(100vh - 140px)',
          background: 'linear-gradient(135deg, rgba(18,42,51,0.98) 0%, rgba(26,58,69,0.96) 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(212,175,55,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatSlideUp 0.25s ease'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            background: 'rgba(0,0,0,0.2)',
            borderBottom: '1px solid rgba(212,175,55,0.15)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem'
              }}>🤖</div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Assistant IA</div>
                <div style={{ fontSize: '0.65rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                  Connecté à votre CRM
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={clearHistory} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#64808b', width: '30px', height: '30px', borderRadius: '8px',
                cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }} title="Effacer l'historique">🔄</button>
              <button onClick={() => setIsOpen(false)} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#64808b', width: '30px', height: '30px', borderRadius: '8px',
                cursor: 'pointer', fontSize: '1rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem'
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '0.7rem 1rem',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #D4AF37, #c9a02e)'
                    : 'rgba(255,255,255,0.06)',
                  color: msg.role === 'user' ? '#122a33' : '#e2e8f0',
                  fontSize: '0.85rem',
                  lineHeight: 1.55,
                  fontWeight: msg.role === 'user' ? 600 : 400,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '0.7rem 1.2rem', borderRadius: '14px 14px 14px 4px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', gap: '0.3rem', alignItems: 'center'
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D4AF37', animation: 'dotBounce 1.4s infinite', animationDelay: '0s' }} />
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D4AF37', animation: 'dotBounce 1.4s infinite', animationDelay: '0.2s' }} />
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D4AF37', animation: 'dotBounce 1.4s infinite', animationDelay: '0.4s' }} />
                </div>
              </div>
            )}

            {/* Suggestions (only on first message) */}
            {messages.length <= 1 && !loading && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#4a6370', marginBottom: '0.5rem' }}>💡 Suggestions :</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {SUGGESTIONS.slice(0, 4).map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)} style={{
                      background: 'rgba(212,175,55,0.08)',
                      border: '1px solid rgba(212,175,55,0.15)',
                      color: '#D4AF37', padding: '0.3rem 0.65rem',
                      borderRadius: '8px', fontSize: '0.72rem',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s'
                    }}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                disabled={loading}
                style={{
                  flex: 1, padding: '0.6rem 0.85rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', color: '#e2e8f0',
                  fontSize: '0.88rem', outline: 'none',
                  resize: 'none', maxHeight: '80px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
              <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #D4AF37, #c9a02e)'
                  : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '12px',
                width: '42px', height: '42px',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem',
                transition: 'all 0.2s',
                flexShrink: 0
              }}>
                {loading ? '⏳' : '➤'}
              </button>
            </div>
            <div style={{ fontSize: '0.6rem', color: '#2a4a55', marginTop: '0.4rem', textAlign: 'center' }}>
              Propulsé par Claude IA · Données CRM en temps réel
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(212,175,55,0.35) }
          50% { box-shadow: 0 8px 48px rgba(212,175,55,0.6) }
        }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0) }
          40% { transform: translateY(-6px) }
        }
      `}</style>
    </>
  )
}
