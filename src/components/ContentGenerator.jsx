import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TONES = [
  { id: 'expert', icon: '🎓', label: 'Expert', desc: 'Autoritaire, données chiffrées' },
  { id: 'inspirant', icon: '✨', label: 'Inspirant', desc: 'Storytelling, motivant' },
  { id: 'provocateur', icon: '🔥', label: 'Provocateur', desc: 'Challenging, questions' },
  { id: 'informatif', icon: '📚', label: 'Informatif', desc: 'Pédagogique, clair' },
  { id: 'personnel', icon: '💬', label: 'Personnel', desc: 'Authentique, vécu' }
]

export default function ContentGenerator() {
  const [sourceType, setSourceType] = useState('article')
  const [platform, setPlatform] = useState('linkedin')
  const [tone, setTone] = useState('expert')
  const [freeTopic, setFreeTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [savedArticles, setSavedArticles] = useState([])
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [generatedContent, setGeneratedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => { loadArticles() }, [])

  async function loadArticles() {
    try {
      const { data } = await supabase.from('veille_items').select('*')
        .order('published_at', { ascending: false }).limit(30)
      if (data) setSavedArticles(data)
    } catch (e) { console.error(e) }
  }

  async function generate() {
    setLoading(true)
    setGeneratedContent('')
    try {
      const body = {
        platform,
        tone,
        angle: angle || undefined,
        source_type: sourceType,
        hashtags_count: 5
      }
      if (sourceType === 'article' && selectedArticle) {
        body.article_title = selectedArticle.title
        body.article_description = selectedArticle.description
        body.article_url = selectedArticle.url
      } else if (sourceType === 'free') {
        body.free_topic = freeTopic
      }

      const resp = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!resp.ok) throw new Error(`Erreur API: ${resp.status}`)
      const data = await resp.json()

      if (data.success) {
        setGeneratedContent(data.content)
        setHistory(prev => [{ content: data.content, platform, tone, date: new Date(), source: sourceType === 'article' ? selectedArticle?.title : freeTopic }, ...prev.slice(0, 9)])
      } else {
        throw new Error(data.error || 'Erreur')
      }
    } catch (err) {
      alert(`Erreur: ${err.message}`)
    } finally { setLoading(false) }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generatedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ✍️ Générateur de contenu
        </h2>
        <p style={{ color: '#64808b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>
          Créez des posts LinkedIn et articles de blog à partir de votre veille IT ou d'un sujet libre
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: generatedContent ? '1fr 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* ── LEFT: Configuration ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Source type */}
          <div style={{ ...card, padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem' }}>
              1️⃣ Source du contenu
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => setSourceType('article')} style={{
                flex: 1, padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: sourceType === 'article' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                color: sourceType === 'article' ? '#D4AF37' : '#64808b',
                fontWeight: sourceType === 'article' ? 600 : 400, fontSize: '0.85rem'
              }}>📰 Depuis un article de veille</button>
              <button onClick={() => setSourceType('free')} style={{
                flex: 1, padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: sourceType === 'free' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                color: sourceType === 'free' ? '#D4AF37' : '#64808b',
                fontWeight: sourceType === 'free' ? 600 : 400, fontSize: '0.85rem'
              }}>💡 Sujet libre</button>
            </div>

            {sourceType === 'article' ? (
              <div>
                <div style={{ fontSize: '0.78rem', color: '#8ba5b0', marginBottom: '0.5rem' }}>
                  Sélectionnez un article de votre veille :
                </div>
                <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {savedArticles.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#4a6370', fontSize: '0.82rem' }}>
                      Aucun article sauvegardé. Allez dans Veille → Gardez des articles d'abord.
                    </div>
                  ) : savedArticles.map((art, i) => (
                    <button key={art.id || i} onClick={() => setSelectedArticle(art)} style={{
                      display: 'flex', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '8px',
                      border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                      background: selectedArticle?.id === art.id ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                      borderLeft: selectedArticle?.id === art.id ? '3px solid #D4AF37' : '3px solid transparent',
                      transition: 'all 0.15s'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.8rem', fontWeight: 600,
                          color: selectedArticle?.id === art.id ? '#D4AF37' : '#e2e8f0',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>{art.title}</div>
                        <div style={{ fontSize: '0.68rem', color: '#4a6370' }}>{art.source}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.78rem', color: '#8ba5b0', marginBottom: '0.4rem' }}>
                  Décrivez votre sujet :
                </div>
                <textarea rows={3} value={freeTopic} onChange={e => setFreeTopic(e.target.value)}
                  placeholder="Ex: L'avenir du Mainframe face au Cloud, pourquoi les freelances COBOL sont toujours recherchés en 2026, l'IA va-t-elle remplacer les développeurs..."
                  style={{
                    width: '100%', padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                    color: '#e2e8f0', fontSize: '0.85rem', outline: 'none',
                    resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
                  }} />
              </div>
            )}
          </div>

          {/* Platform */}
          <div style={{ ...card, padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem' }}>
              2️⃣ Plateforme
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setPlatform('linkedin')} style={{
                flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: platform === 'linkedin' ? 'rgba(10,102,194,0.2)' : 'rgba(255,255,255,0.05)',
                color: platform === 'linkedin' ? '#0a66c2' : '#64808b',
                fontWeight: platform === 'linkedin' ? 600 : 400, fontSize: '0.88rem',
                border: platform === 'linkedin' ? '1px solid rgba(10,102,194,0.4)' : '1px solid rgba(255,255,255,0.06)'
              }}>💼 LinkedIn</button>
              <button onClick={() => setPlatform('blog')} style={{
                flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: platform === 'blog' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                color: platform === 'blog' ? '#D4AF37' : '#64808b',
                fontWeight: platform === 'blog' ? 600 : 400, fontSize: '0.88rem',
                border: platform === 'blog' ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.06)'
              }}>📝 Blog / Site web</button>
            </div>
          </div>

          {/* Tone */}
          <div style={{ ...card, padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem' }}>
              3️⃣ Ton
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {TONES.map(t => (
                <button key={t.id} onClick={() => setTone(t.id)} style={{
                  padding: '0.5rem 0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: tone === t.id ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                  color: tone === t.id ? '#D4AF37' : '#8ba5b0',
                  fontWeight: tone === t.id ? 600 : 400, fontSize: '0.8rem',
                  border: tone === t.id ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', gap: '0.3rem'
                }}>{t.icon} {t.label}</button>
              ))}
            </div>
          </div>

          {/* Angle (optional) */}
          <div style={{ ...card, padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.5rem' }}>
              4️⃣ Angle spécifique <span style={{ fontSize: '0.72rem', color: '#4a6370', fontWeight: 400 }}>(optionnel)</span>
            </div>
            <input type="text" value={angle} onChange={e => setAngle(e.target.value)}
              placeholder="Ex: impact sur les freelances Mainframe, point de vue ESN, retour d'expérience..."
              style={{
                width: '100%', padding: '0.6rem 0.9rem', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
              }} />
          </div>

          {/* Generate button */}
          <button onClick={generate} disabled={loading || (sourceType === 'article' && !selectedArticle) || (sourceType === 'free' && !freeTopic.trim())}
            style={{
              background: loading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
              border: 'none', borderRadius: '12px', color: '#122a33',
              padding: '1rem 2rem', fontWeight: 700, fontSize: '1rem',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              width: '100%', transition: 'all 0.2s'
            }}>
            {loading ? (
              <><span style={{ width: 18, height: 18, border: '2px solid rgba(18,42,51,0.3)', borderTopColor: '#122a33', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} /> Génération en cours...</>
            ) : (
              <>✨ Générer le {platform === 'linkedin' ? 'post LinkedIn' : 'article de blog'}</>
            )}
          </button>
        </div>

        {/* ── RIGHT: Preview ── */}
        {generatedContent && (
          <div style={{ ...card, padding: '1.5rem', position: 'sticky', top: '80px' }}>
            {/* Preview header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{platform === 'linkedin' ? '💼' : '📝'}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                  {platform === 'linkedin' ? 'Post LinkedIn' : 'Article Blog'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button onClick={copyToClipboard} style={{
                  background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(212,175,55,0.15)',
                  border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(212,175,55,0.3)'}`,
                  color: copied ? '#34d399' : '#D4AF37',
                  padding: '0.4rem 0.9rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
                }}>{copied ? '✅ Copié !' : '📋 Copier'}</button>
                <button onClick={generate} disabled={loading} style={{
                  background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)',
                  color: '#60a5fa', padding: '0.4rem 0.9rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
                }}>🔄 Régénérer</button>
              </div>
            </div>

            {/* LinkedIn preview mockup */}
            {platform === 'linkedin' && (
              <div style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.25rem',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                {/* LinkedIn header */}
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', fontWeight: 700, color: '#122a33'
                  }}>M</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>Milan Calic</div>
                    <div style={{ fontSize: '0.68rem', color: '#64808b' }}>Fondateur Joker Team | ESN & Freelances IT</div>
                    <div style={{ fontSize: '0.62rem', color: '#4a6370' }}>À l'instant · 🌐</div>
                  </div>
                </div>
                {/* Content */}
                <div style={{
                  fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.65,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: '400px', overflowY: 'auto'
                }}>{generatedContent}</div>
                {/* Reactions mock */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginTop: '1rem',
                  paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '0.72rem', color: '#4a6370'
                }}>
                  <span>👍 💡 12</span>
                  <span>3 commentaires</span>
                </div>
              </div>
            )}

            {/* Blog preview */}
            {platform === 'blog' && (
              <div style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid rgba(255,255,255,0.06)',
                maxHeight: '500px', overflowY: 'auto'
              }}>
                <div style={{ fontSize: '0.65rem', color: '#D4AF37', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                  Blog Joker Team
                </div>
                <div style={{
                  fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.7,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>{generatedContent}</div>
              </div>
            )}

            {/* Character count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.7rem', color: '#4a6370' }}>
              <span>{generatedContent.length} caractères</span>
              <span>{generatedContent.split(/\s+/).length} mots</span>
              {platform === 'linkedin' && (
                <span style={{ color: generatedContent.length > 3000 ? '#f87171' : '#34d399' }}>
                  {generatedContent.length > 3000 ? '⚠️ Trop long' : '✅ Longueur OK'}
                </span>
              )}
            </div>

            {/* Edit area */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8ba5b0', marginBottom: '0.4rem' }}>
                ✏️ Modifier avant de copier :
              </div>
              <textarea value={generatedContent} onChange={e => setGeneratedContent(e.target.value)}
                rows={8}
                style={{
                  width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                  color: '#e2e8f0', fontSize: '0.82rem', outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
                  lineHeight: 1.6
                }} />
            </div>
          </div>
        )}
      </div>

      {/* ── HISTORY ── */}
      {history.length > 0 && (
        <div style={{ ...card, padding: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
            🕐 Historique des générations ({history.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {history.map((h, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0.75rem', borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer'
              }} onClick={() => setGeneratedContent(h.content)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.platform === 'linkedin' ? '💼' : '📝'} {h.source || 'Sujet libre'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#4a6370' }}>
                    {h.date.toLocaleTimeString('fr-FR')} · {TONES.find(t => t.id === h.tone)?.label || h.tone}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(h.content) }} style={{
                  background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
                  color: '#D4AF37', padding: '0.3rem 0.6rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.7rem'
                }}>📋</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
