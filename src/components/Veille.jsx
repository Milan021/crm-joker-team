import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const SOURCES_META = {
  'Le Monde Informatique': { icon: '🌐', color: '#2563eb' },
  'InformatiqueNews': { icon: '💻', color: '#60a5fa' },
  'Silicon.fr': { icon: '🔬', color: '#ec4899' },
  'LeMagIT': { icon: '📰', color: '#f59e0b' },
  'Alliancy': { icon: '🏢', color: '#34d399' },
  'Next.ink': { icon: '⚡', color: '#8b5cf6' },
  'Clubic': { icon: '🖥️', color: '#ef4444' },
  "Tom's Hardware FR": { icon: '🔧', color: '#f97316' },
  'Free-Work IT': { icon: '👨‍💻', color: '#06b6d4' },
  'ZDNet France': { icon: '📱', color: '#dc2626' },
  'Google News': { icon: '🌐', color: '#94a3b8' }
}

const TYPE_BADGES = {
  news: { label: 'Article', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  job: { label: 'Emploi', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  nomination: { label: 'Nomination', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' }
}

export default function Veille() {
  const [freshItems, setFreshItems] = useState([])
  const [savedItems, setSavedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)
  const [filterSource, setFilterSource] = useState('all')
  const [tab, setTab] = useState('fresh')
  const [keywords, setKeywords] = useState([])
  const [showConfig, setShowConfig] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')

  useEffect(() => { loadSavedItems(); loadKeywords() }, [])

  async function loadSavedItems() {
    try {
      const { data } = await supabase.from('veille_items').select('*').eq('is_read', false).order('published_at', { ascending: false }).limit(100)
      if (data) setSavedItems(data)
    } catch (e) { console.error(e) }
  }

  async function loadKeywords() {
    try {
      const { data } = await supabase.from('veille_config').select('*').eq('is_active', true)
      if (data?.length) setKeywords(data.map(d => d.value))
      else setKeywords(['mainframe', 'COBOL', 'DSI', 'cloud', 'cybersécurité', 'ESN', 'freelance'])
    } catch (e) {
      setKeywords(['mainframe', 'COBOL', 'DSI', 'cloud', 'cybersécurité', 'ESN', 'freelance'])
    }
  }

  async function fetchFreshNews() {
    setLoading(true)
    try {
      const kw = keywords.length > 0 ? keywords.join(',') : 'mainframe,COBOL,DSI,cloud,ESN'
      const resp = await fetch(`/api/fetch-veille?keywords=${encodeURIComponent(kw)}`)
      if (!resp.ok) throw new Error(`API error: ${resp.status}`)
      const result = await resp.json()
      if (result.success && result.items) {
        // Filter out already saved items
        const savedTitles = new Set(savedItems.map(s => s.title?.toLowerCase().slice(0, 50)))
        const fresh = result.items.filter(i => !savedTitles.has(i.title?.toLowerCase().slice(0, 50)))
        setFreshItems(fresh)
        setLastFetch(new Date())
        setTab('fresh')
      }
    } catch (err) {
      console.error('Fetch veille error:', err)
      alert(`Erreur: ${err.message}`)
    } finally { setLoading(false) }
  }

  async function keepArticle(item) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('veille_items').upsert({
        type: item.type || 'news',
        title: item.title,
        description: item.description,
        url: item.url,
        source: item.source,
        keywords: item.keywords,
        relevance_score: item.relevance_score,
        published_at: item.published_at,
        is_read: false,
      }, { onConflict: 'title', ignoreDuplicates: true })
      // Remove from fresh list, add to saved
      setFreshItems(prev => prev.filter(i => i.title !== item.title))
      setSavedItems(prev => [{ ...item, id: Date.now(), is_read: false }, ...prev])
    } catch (e) { console.error(e) }
  }

  function dismissArticle(item) {
    setFreshItems(prev => prev.filter(i => i.title !== item.title))
  }

  async function keepAllVisible() {
    const visible = getFilteredFresh()
    for (const item of visible.slice(0, 20)) {
      try {
        await supabase.from('veille_items').upsert({
          type: item.type || 'news', title: item.title, description: item.description,
          url: item.url, source: item.source, keywords: item.keywords,
          relevance_score: item.relevance_score, published_at: item.published_at,
          is_read: false, user_id: user?.id
        }, { onConflict: 'title', ignoreDuplicates: true })
      } catch (e) {}
    }
    setFreshItems(prev => prev.filter(i => !visible.includes(i)))
    loadSavedItems()
  }

  function dismissAllVisible() {
    const visible = getFilteredFresh()
    setFreshItems(prev => prev.filter(i => !visible.includes(i)))
  }

  async function deleteSavedItem(id) {
    try {
      await supabase.from('veille_items').delete().eq('id', id)
      setSavedItems(prev => prev.filter(i => i.id !== id))
    } catch (e) { console.error(e) }
  }

  async function addKeyword() {
    if (!newKeyword.trim()) return
    try {
      await supabase.from('veille_config').insert({ type: 'keyword', value: newKeyword.trim(), is_active: true })
      setKeywords(prev => [...prev, newKeyword.trim()])
      setNewKeyword('')
    } catch (e) { console.error(e) }
  }

  async function removeKeyword(kw) {
    try {
      await supabase.from('veille_config').delete().eq('value', kw).eq('type', 'keyword')
      setKeywords(prev => prev.filter(k => k !== kw))
    } catch (e) { console.error(e) }
  }

  function getFilteredFresh() {
    return freshItems.filter(i => filterSource === 'all' || i.source === filterSource)
  }

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = (new Date() - new Date(dateStr)) / 1000
    if (diff < 3600) return `${Math.floor(diff / 60)}min`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    if (diff < 604800) return `${Math.floor(diff / 86400)}j`
    return `${Math.floor(diff / 604800)}sem`
  }

  const filteredFresh = getFilteredFresh()
  const freshSources = [...new Set(freshItems.map(i => i.source))].filter(Boolean)

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  return (
    <div>
      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '📰', label: 'À trier', value: freshItems.length, accent: '#f59e0b' },
          { icon: '✅', label: 'Gardés', value: savedItems.length, accent: '#34d399' },
          { icon: '🌐', label: 'Sources', value: '10', accent: '#60a5fa' },
          { icon: '🔑', label: 'Mots-clés', value: keywords.length, accent: '#D4AF37' }
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1.25rem 1.5rem', borderTop: `3px solid ${s.accent}` }}>
            <div style={{ fontSize: '0.8rem', color: '#8ba5b0', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>{s.icon}</span> {s.label}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── HEADER ── */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            🔍 Veille IT — 10 sources françaises
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setShowConfig(!showConfig)} style={{
              background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
              color: '#a78bfa', padding: '0.5rem 1rem', borderRadius: '8px',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
            }}>⚙️ Mots-clés</button>
            <button onClick={fetchFreshNews} disabled={loading} style={{
              background: loading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
              border: 'none', borderRadius: '8px', color: '#122a33',
              padding: '0.5rem 1.2rem', fontWeight: 700, fontSize: '0.85rem',
              cursor: loading ? 'wait' : 'pointer'
            }}>{loading ? '⏳ Chargement...' : '🔄 Chercher les news'}</button>
          </div>
        </div>

        {lastFetch && (
          <div style={{ fontSize: '0.75rem', color: '#4a6370', marginBottom: '0.75rem' }}>
            Dernière recherche : {lastFetch.toLocaleTimeString('fr-FR')} — {freshItems.length} articles trouvés
          </div>
        )}

        {/* Keywords panel */}
        {showConfig && (
          <div style={{
            background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1.25rem',
            marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.04)'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.6rem' }}>🔑 Mots-clés de recherche</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <input type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder="Ajouter un mot-clé..." style={{
                  flex: 1, padding: '0.5rem 0.8rem', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
                }} />
              <button onClick={addKeyword} style={{
                background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
                color: '#D4AF37', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700
              }}>+</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {keywords.map((kw, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem',
                  background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)'
                }}>{kw}
                  <button onClick={() => removeKeyword(kw)} style={{
                    background: 'none', border: 'none', color: '#D4AF37',
                    cursor: 'pointer', fontSize: '0.85rem', padding: 0, lineHeight: 1
                  }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '0.7rem', color: '#4a6370' }}>
              Sources : Le Monde Informatique · InformatiqueNews · Silicon.fr · LeMagIT · Alliancy · Next.ink · Clubic · Tom's Hardware · Free-Work IT · ZDNet France
            </div>
          </div>
        )}

        {/* Tab toggle + source filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button onClick={() => setTab('fresh')} style={{
              padding: '0.5rem 1.2rem', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              background: tab === 'fresh' ? '#D4AF37' : 'rgba(255,255,255,0.05)',
              color: tab === 'fresh' ? '#122a33' : '#8ba5b0'
            }}>📰 À trier ({freshItems.length})</button>
            <button onClick={() => setTab('saved')} style={{
              padding: '0.5rem 1.2rem', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              background: tab === 'saved' ? '#34d399' : 'rgba(255,255,255,0.05)',
              color: tab === 'saved' ? '#122a33' : '#8ba5b0'
            }}>✅ Gardés ({savedItems.length})</button>
          </div>

          {tab === 'fresh' && freshSources.length > 0 && (
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              <button onClick={() => setFilterSource('all')} style={{
                background: filterSource === 'all' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.03)',
                border: filterSource === 'all' ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)',
                color: filterSource === 'all' ? '#D4AF37' : '#4a6370',
                padding: '0.25rem 0.6rem', borderRadius: '16px', fontSize: '0.7rem', cursor: 'pointer'
              }}>Toutes</button>
              {freshSources.map(s => {
                const meta = SOURCES_META[s] || { icon: '📰', color: '#94a3b8' }
                return (
                  <button key={s} onClick={() => setFilterSource(s)} style={{
                    background: filterSource === s ? `${meta.color}20` : 'rgba(255,255,255,0.03)',
                    border: filterSource === s ? `1px solid ${meta.color}50` : '1px solid rgba(255,255,255,0.06)',
                    color: filterSource === s ? meta.color : '#4a6370',
                    padding: '0.25rem 0.6rem', borderRadius: '16px', fontSize: '0.7rem', cursor: 'pointer'
                  }}>{meta.icon} {s}</button>
                )
              })}
            </div>
          )}
        </div>

        {/* Bulk actions */}
        {tab === 'fresh' && filteredFresh.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={keepAllVisible} style={{
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
              color: '#34d399', padding: '0.4rem 1rem', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
            }}>✅ Tout garder ({filteredFresh.length})</button>
            <button onClick={dismissAllVisible} style={{
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
              color: '#f87171', padding: '0.4rem 1rem', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
            }}>🗑️ Tout supprimer</button>
          </div>
        )}
      </div>

      {/* ── FRESH ARTICLES (to sort) ── */}
      {tab === 'fresh' && (
        <>
          {filteredFresh.length === 0 && !loading ? (
            <div style={{ ...card, padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📰</div>
              <div style={{ color: '#8ba5b0', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                {freshItems.length === 0 ? 'Aucune actualité chargée' : 'Toutes les actualités ont été triées !'}
              </div>
              <div style={{ color: '#4a6370', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Cliquez "🔄 Chercher les news" pour récupérer les dernières actualités IT
              </div>
              <button onClick={fetchFreshNews} disabled={loading} style={{
                background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none',
                borderRadius: '8px', color: '#122a33', padding: '0.7rem 2rem',
                fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
              }}>🔄 Charger les actualités</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
              {filteredFresh.map((item, idx) => (
                <ArticleCard key={idx} item={item} card={card}
                  onKeep={() => keepArticle(item)}
                  onDismiss={() => dismissArticle(item)}
                  actionType="sort"
                  timeAgo={timeAgo}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SAVED ARTICLES ── */}
      {tab === 'saved' && (
        <>
          {savedItems.length === 0 ? (
            <div style={{ ...card, padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <div style={{ color: '#8ba5b0', fontSize: '1.1rem' }}>Aucun article sauvegardé</div>
              <div style={{ color: '#4a6370', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                Cherchez des news et gardez celles qui vous intéressent
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
              {savedItems.map((item, idx) => (
                <ArticleCard key={item.id || idx} item={item} card={card}
                  onDismiss={() => deleteSavedItem(item.id)}
                  actionType="saved"
                  timeAgo={timeAgo}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{ width: 50, height: 50, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
          <div style={{ color: '#D4AF37', fontSize: '1rem', fontWeight: 600, marginBottom: '0.3rem' }}>Recherche sur 10 sources...</div>
          <div style={{ color: '#64808b', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.6 }}>
            Le Monde Informatique · InformatiqueNews · Silicon.fr<br />
            LeMagIT · Alliancy · Next.ink · Clubic<br />
            Tom's Hardware · Free-Work IT · ZDNet France
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}

// ── Article Card Component ──
function ArticleCard({ item, card, onKeep, onDismiss, actionType, timeAgo }) {
  const sourceMeta = SOURCES_META[item.source] || { icon: '📰', color: '#94a3b8' }
  const typeBadge = TYPE_BADGES[item.type] || TYPE_BADGES.news
  const relevance = item.relevance_score || 0

  return (
    <div style={{
      ...card, padding: '1.25rem', position: 'relative', overflow: 'hidden',
      transition: 'all 0.2s, transform 0.15s'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)' }}
    >
      {/* Relevance bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{
          width: `${relevance}%`, height: '100%',
          background: relevance >= 80 ? '#34d399' : relevance >= 50 ? '#D4AF37' : '#f59e0b'
        }} />
      </div>

      {/* Source + type + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem',
            fontWeight: 600, background: `${sourceMeta.color}15`, color: sourceMeta.color,
            border: `1px solid ${sourceMeta.color}25`
          }}>{sourceMeta.icon} {item.source}</span>
          <span style={{
            padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem',
            fontWeight: 600, color: typeBadge.color, background: typeBadge.bg
          }}>{typeBadge.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.68rem', color: '#4a6370' }}>{timeAgo(item.published_at)}</span>
          {relevance > 0 && (
            <span style={{
              padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
              color: relevance >= 80 ? '#34d399' : relevance >= 50 ? '#D4AF37' : '#f59e0b',
              background: relevance >= 80 ? 'rgba(52,211,153,0.12)' : relevance >= 50 ? 'rgba(212,175,55,0.12)' : 'rgba(245,158,11,0.12)'
            }}>{relevance}%</span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: '0.92rem', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4,
        marginBottom: '0.4rem', display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>{item.title}</h3>

      {/* Description */}
      {item.description && (
        <p style={{
          fontSize: '0.78rem', color: '#8ba5b0', lineHeight: 1.5, marginBottom: '0.6rem',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>{item.description}</p>
      )}

      {/* Keywords */}
      {item.keywords?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginBottom: '0.75rem' }}>
          {item.keywords.slice(0, 4).map((kw, i) => (
            <span key={i} style={{
              padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem',
              color: '#D4AF37', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)'
            }}>#{kw}</span>
          ))}
        </div>
      )}

      {/* Actions: Keep / Delete / Read */}
      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'space-between', alignItems: 'center' }}>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.35rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem',
            fontWeight: 600, color: '#60a5fa', background: 'rgba(96,165,250,0.1)',
            border: '1px solid rgba(96,165,250,0.2)', textDecoration: 'none'
          }}>🔗 Lire</a>
        )}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {actionType === 'sort' && onKeep && (
            <button onClick={onKeep} style={{
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
              color: '#34d399', padding: '0.4rem 0.9rem', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.25rem'
            }}>✅ Garder</button>
          )}
          <button onClick={onDismiss} style={{
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
            color: '#f87171', padding: '0.4rem 0.9rem', borderRadius: '6px',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.25rem'
          }}>🗑️ {actionType === 'saved' ? 'Supprimer' : 'Ignorer'}</button>
        </div>
      </div>
    </div>
  )
}
