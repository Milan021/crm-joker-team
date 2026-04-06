import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const SOURCES_META = {
  'InformatiqueNews': { icon: '💻', color: '#60a5fa' },
  'Alliancy': { icon: '🏢', color: '#34d399' },
  'Républik IT': { icon: '🇫🇷', color: '#a78bfa' },
  'LeMagIT': { icon: '📰', color: '#f59e0b' },
  'Silicon.fr': { icon: '🔬', color: '#ec4899' },
  'Google News': { icon: '🌐', color: '#94a3b8' }
}

const TYPE_BADGES = {
  news: { label: 'Article', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  job: { label: 'Emploi', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  nomination: { label: 'Nomination', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' }
}

export default function Veille() {
  const [items, setItems] = useState([])
  const [savedItems, setSavedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)
  const [filterSource, setFilterSource] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [keywords, setKeywords] = useState([])
  const [showConfig, setShowConfig] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')

  useEffect(() => {
    loadSavedItems()
    loadKeywords()
  }, [])

  async function loadSavedItems() {
    try {
      const { data } = await supabase
        .from('veille_items')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(50)
      if (data) setSavedItems(data)
    } catch (e) { console.error('Load saved items:', e) }
  }

  async function loadKeywords() {
    try {
      const { data } = await supabase
        .from('veille_config')
        .select('*')
        .eq('is_active', true)
      if (data) setKeywords(data.map(d => d.value))
    } catch (e) {
      // Default keywords if table doesn't exist
      setKeywords(['mainframe', 'COBOL', 'DSI', 'cloud', 'cybersécurité', 'ESN'])
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
        setItems(result.items)
        setLastFetch(new Date())

        // Save to Supabase (upsert by title)
        const { data: { user } } = await supabase.auth.getUser()
        for (const item of result.items.slice(0, 20)) {
          try {
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
              user_id: user?.id
            }, { onConflict: 'title', ignoreDuplicates: true })
          } catch (e) { /* ignore duplicates */ }
        }

        await loadSavedItems()
      }
    } catch (err) {
      console.error('Fetch veille error:', err)
      alert(`Erreur lors du chargement: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id) {
    try {
      await supabase.from('veille_items').update({ is_read: true }).eq('id', id)
      setSavedItems(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i))
    } catch (e) { console.error(e) }
  }

  async function deleteItem(id) {
    try {
      await supabase.from('veille_items').delete().eq('id', id)
      setSavedItems(prev => prev.filter(i => i.id !== id))
    } catch (e) { console.error(e) }
  }

  async function addKeyword() {
    if (!newKeyword.trim()) return
    try {
      await supabase.from('veille_config').insert({
        type: 'keyword', value: newKeyword.trim(), is_active: true
      })
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

  // Combine live + saved, deduplicate
  const allItems = [...items]
  savedItems.forEach(si => {
    if (!allItems.find(i => i.title === si.title)) {
      allItems.push({
        ...si,
        source_icon: SOURCES_META[si.source]?.icon || '📰',
        source_color: SOURCES_META[si.source]?.color || '#94a3b8'
      })
    }
  })

  // Filters
  const filtered = allItems
    .filter(i => filterSource === 'all' || i.source === filterSource)
    .filter(i => filterType === 'all' || i.type === filterType)

  // Stats
  const totalNews = allItems.filter(i => i.type === 'news').length
  const totalJobs = allItems.filter(i => i.type === 'job').length
  const unread = savedItems.filter(i => !i.is_read).length
  const sources = [...new Set(allItems.map(i => i.source))].filter(Boolean)

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = (new Date() - new Date(dateStr)) / 1000
    if (diff < 3600) return `${Math.floor(diff / 60)}min`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    if (diff < 604800) return `${Math.floor(diff / 86400)}j`
    return `${Math.floor(diff / 604800)}sem`
  }

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  return (
    <div>
      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '📰', label: 'Articles', value: totalNews, accent: '#60a5fa' },
          { icon: '💼', label: 'Offres emploi', value: totalJobs, accent: '#34d399' },
          { icon: '🔔', label: 'Non lues', value: unread, accent: '#D4AF37' },
          { icon: '🌐', label: 'Sources', value: sources.length, accent: '#a78bfa' },
          { icon: '🔑', label: 'Mots-clés', value: keywords.length, accent: '#f59e0b' }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔍 Veille du marché IT
            <span style={{ fontSize: '0.85rem', color: '#8ba5b0', fontWeight: 400 }}>({filtered.length} résultats)</span>
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
              cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
              {loading ? '⏳ Chargement...' : '🔄 Actualiser'}
            </button>
          </div>
        </div>

        {lastFetch && (
          <div style={{ fontSize: '0.75rem', color: '#4a6370', marginBottom: '1rem' }}>
            Dernière mise à jour : {lastFetch.toLocaleTimeString('fr-FR')}
          </div>
        )}

        {/* Keywords config panel */}
        {showConfig && (
          <div style={{
            background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1.25rem',
            marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem' }}>
              🔑 Mots-clés de recherche
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input type="text" value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder="Ajouter un mot-clé..."
                style={{
                  flex: 1, padding: '0.55rem 0.9rem', background: 'rgba(255,255,255,0.06)',
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
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.25rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem',
                  background: 'rgba(212,175,55,0.12)', color: '#D4AF37',
                  border: '1px solid rgba(212,175,55,0.2)'
                }}>
                  {kw}
                  <button onClick={() => removeKeyword(kw)} style={{
                    background: 'none', border: 'none', color: '#D4AF37',
                    cursor: 'pointer', fontSize: '0.85rem', padding: 0, lineHeight: 1
                  }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: '#4a6370' }}>
              Sources : InformatiqueNews · Alliancy · Républik IT · LeMagIT · Silicon.fr · Google News
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Type filter */}
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {[
              { id: 'all', label: 'Tout' },
              { id: 'news', label: '📰 Articles' },
              { id: 'job', label: '💼 Emploi' },
              { id: 'nomination', label: '👤 Nominations' }
            ].map(f => (
              <button key={f.id} onClick={() => setFilterType(f.id)} style={{
                background: filterType === f.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                border: filterType === f.id ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: filterType === f.id ? '#D4AF37' : '#8ba5b0',
                padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem',
                fontWeight: filterType === f.id ? 600 : 400, cursor: 'pointer'
              }}>{f.label}</button>
            ))}
          </div>

          {/* Source filter */}
          {sources.length > 0 && (
            <>
              <span style={{ color: '#2a4a55', fontSize: '0.8rem' }}>|</span>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                <button onClick={() => setFilterSource('all')} style={{
                  background: filterSource === 'all' ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.03)',
                  border: filterSource === 'all' ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: filterSource === 'all' ? '#60a5fa' : '#4a6370',
                  padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.72rem',
                  cursor: 'pointer'
                }}>Toutes sources</button>
                {sources.map(s => {
                  const meta = SOURCES_META[s] || { icon: '📰', color: '#94a3b8' }
                  return (
                    <button key={s} onClick={() => setFilterSource(s)} style={{
                      background: filterSource === s ? `${meta.color}20` : 'rgba(255,255,255,0.03)',
                      border: filterSource === s ? `1px solid ${meta.color}50` : '1px solid rgba(255,255,255,0.06)',
                      color: filterSource === s ? meta.color : '#4a6370',
                      padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.72rem',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}>{meta.icon} {s}</button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ARTICLES GRID ── */}
      {filtered.length === 0 ? (
        <div style={{ ...card, padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📰</div>
          <div style={{ color: '#8ba5b0', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Aucune actualité disponible</div>
          <div style={{ color: '#4a6370', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Cliquez sur "🔄 Actualiser" pour récupérer les dernières news IT
          </div>
          <button onClick={fetchFreshNews} disabled={loading} style={{
            background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none',
            borderRadius: '8px', color: '#122a33', padding: '0.7rem 2rem',
            fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
          }}>🔄 Charger les actualités</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem' }}>
          {filtered.map((item, idx) => {
            const typeBadge = TYPE_BADGES[item.type] || TYPE_BADGES.news
            const sourceMeta = SOURCES_META[item.source] || { icon: item.source_icon || '📰', color: item.source_color || '#94a3b8' }
            const isRead = item.is_read
            const relevance = item.relevance_score || 0

            return (
              <div key={idx} style={{
                ...card,
                padding: '1.5rem',
                opacity: isRead ? 0.6 : 1,
                transition: 'all 0.2s, transform 0.15s',
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)' }}
              >
                {/* Relevance indicator bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: 'rgba(255,255,255,0.03)'
                }}>
                  <div style={{
                    width: `${relevance}%`, height: '100%',
                    background: relevance >= 80 ? '#34d399' : relevance >= 60 ? '#D4AF37' : '#f59e0b',
                    borderRadius: '0 0 2px 0'
                  }} />
                </div>

                {/* Header: source + type + time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem',
                      fontWeight: 600, background: `${sourceMeta.color}15`, color: sourceMeta.color,
                      border: `1px solid ${sourceMeta.color}25`
                    }}>
                      {sourceMeta.icon} {item.source}
                    </span>
                    <span style={{
                      padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem',
                      fontWeight: 600, color: typeBadge.color, background: typeBadge.bg
                    }}>{typeBadge.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#4a6370' }}>{timeAgo(item.published_at)}</span>
                    {relevance > 0 && (
                      <span style={{
                        padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.65rem',
                        fontWeight: 700,
                        color: relevance >= 80 ? '#34d399' : relevance >= 60 ? '#D4AF37' : '#f59e0b',
                        background: relevance >= 80 ? 'rgba(52,211,153,0.12)' : relevance >= 60 ? 'rgba(212,175,55,0.12)' : 'rgba(245,158,11,0.12)'
                      }}>{relevance}%</span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9',
                  lineHeight: 1.4, marginBottom: '0.5rem',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>
                  {item.title}
                </h3>

                {/* Description */}
                {item.description && (
                  <p style={{
                    fontSize: '0.82rem', color: '#8ba5b0', lineHeight: 1.5, marginBottom: '0.75rem',
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>
                    {item.description}
                  </p>
                )}

                {/* Keywords */}
                {item.keywords?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
                    {item.keywords.slice(0, 4).map((kw, ki) => (
                      <span key={ki} style={{
                        padding: '0.12rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem',
                        color: '#D4AF37', background: 'rgba(212,175,55,0.08)',
                        border: '1px solid rgba(212,175,55,0.15)'
                      }}>#{kw}</span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'space-between', alignItems: 'center' }}>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.4rem 0.9rem', borderRadius: '6px', fontSize: '0.78rem',
                      fontWeight: 600, color: '#60a5fa', background: 'rgba(96,165,250,0.1)',
                      border: '1px solid rgba(96,165,250,0.2)', textDecoration: 'none',
                      transition: 'all 0.15s'
                    }}>
                      🔗 Lire l'article
                    </a>
                  )}
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {item.id && !isRead && (
                      <button onClick={() => markAsRead(item.id)} style={{
                        background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                        color: '#34d399', width: '30px', height: '30px', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.8rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                      }} title="Marquer comme lu">✓</button>
                    )}
                    {item.id && (
                      <button onClick={() => deleteItem(item.id)} style={{
                        background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                        color: '#f87171', width: '30px', height: '30px', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.8rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                      }} title="Supprimer">×</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{
            width: 50, height: 50, border: '3px solid rgba(212,175,55,0.2)',
            borderTopColor: '#D4AF37', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', marginBottom: '1rem'
          }} />
          <div style={{ color: '#D4AF37', fontSize: '1rem', fontWeight: 600, marginBottom: '0.3rem' }}>
            Recherche en cours...
          </div>
          <div style={{ color: '#64808b', fontSize: '0.8rem' }}>
            InformatiqueNews · Alliancy · LeMagIT · Silicon.fr
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}
