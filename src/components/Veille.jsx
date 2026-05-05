import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const SOURCES_META = {
  'Le Monde Informatique': { icon: '🌍', color: '#2563eb' },
  'InformatiqueNews': { icon: '💻', color: '#60a5fa' },
  'Silicon.fr': { icon: '🔬', color: '#ec4899' },
  'LeMagIT': { icon: '📰', color: '#f59e0b' },
  'Alliancy': { icon: '🏣', color: '#34d399' },
  'Next.ink': { icon: '⚡', color: '#8b5cf6' },
  'Clubic': { icon: '🖥️', color: '#ef4444' },
  "Tom's Hardware FR": { icon: '🔧', color: '#f97316' },
  'Free-Work IT': { icon: '👨‍💻', color: '#06b6d4' },
  'ZDNet France': { icon: '📱', color: '#dc2626' },
  'Planet Mainframe': { icon: '🖥️', color: '#6366f1' },
  'IT-Connect': { icon: '🔌', color: '#0ea5e9' },
  'La Revue du Digital': { icon: '📲', color: '#7c3aed' },
  'Techniques Ingenieur': { icon: '🏭', color: '#059669' },
  'Numerama': { icon: '🌐', color: '#e11d48' },
  'Journal du Net': { icon: '📊', color: '#0284c7' },
  '01net': { icon: '📡', color: '#d946ef' },
  'CNIL': { icon: '🔒', color: '#1d4ed8' },
  "L'Usine Digitale": { icon: '🏗️', color: '#ca8a04' },
  'GreenIT': { icon: '🌿', color: '#16a34a' },
  'Google News': { icon: '🌍', color: '#94a3b8' }
}

const TYPE_BADGES = {
  news: { label: 'Article', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  job: { label: 'Emploi', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  nomination: { label: 'Nomination', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' }
}

const THEMES = {
  all: { label: 'Tous', icon: '📰', color: '#D4AF37', keywords: [] },
  mainframe: { label: 'Mainframe / Legacy', icon: '🖥️', color: '#6366f1', keywords: ['mainframe', 'cobol', 'db2', 'as400', 'iseries', 'legacy', 'z/os', 'jcl', 'cics', 'vsam', 'rpg', 'natural', 'adabas', 'pacbase'] },
  cloud: { label: 'Cloud / DevOps', icon: '☁️', color: '#06b6d4', keywords: ['cloud', 'aws', 'azure', 'gcp', 'devops', 'kubernetes', 'docker', 'terraform', 'serverless', 'saas', 'iaas', 'paas', 'microservices', 'conteneur', 'orchestration', 'ci/cd', 'gitlab', 'jenkins'] },
  ia: { label: 'IA / Data', icon: '🤖', color: '#a78bfa', keywords: ['intelligence artificielle', 'ia', 'machine learning', 'deep learning', 'chatgpt', 'claude', 'llm', 'gpt', 'openai', 'anthropic', 'data', 'big data', 'analytics', 'donnees', 'algorithme', 'nlp', 'generative', 'copilot'] },
  cyber: { label: 'Cybersecurite', icon: '🔒', color: '#ef4444', keywords: ['cybersecurite', 'securite', 'ransomware', 'phishing', 'cyberattaque', 'soc', 'siem', 'firewall', 'pentest', 'rgpd', 'zero trust', 'vulnerability', 'malware', 'chiffrement', 'nist', 'iso27001'] },
  freelance: { label: 'Freelance / ESN', icon: '💼', color: '#34d399', keywords: ['freelance', 'esn', 'ssii', 'consultant', 'independant', 'portage', 'tjm', 'mission', 'placement', 'prestation', 'recrutement', 'talent', 'embauche', 'marche it', 'numerique'] },
  infra: { label: 'Infrastructure', icon: '🏗️', color: '#f59e0b', keywords: ['infrastructure', 'reseau', 'serveur', 'datacenter', 'vmware', 'linux', 'windows server', 'stockage', 'virtualisation', 'active directory', 'sdn', 'wan', 'lan', 'backup', 'supervision'] },
}

function classifyArticle(item) {
  const text = `${item.title || ''} ${item.description || ''} ${(item.keywords || []).join(' ')}`.toLowerCase()
  const matches = []
  for (const [themeId, theme] of Object.entries(THEMES)) {
    if (themeId === 'all') continue
    const matchCount = theme.keywords.filter(kw => text.includes(kw)).length
    if (matchCount > 0) matches.push({ id: themeId, count: matchCount })
  }
  matches.sort((a, b) => b.count - a.count)
  return matches.length > 0 ? matches[0].id : 'other'
}

export default function Veille() {
  const [freshItems, setFreshItems] = useState([])
  const [savedItems, setSavedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)
  const [filterSource, setFilterSource] = useState('all')
  const [filterTheme, setFilterTheme] = useState('all')
  const [tab, setTab] = useState('fresh')
  const [keywords, setKeywords] = useState([])
  const [showConfig, setShowConfig] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [viewMode, setViewMode] = useState('cards')

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
      else setKeywords(['mainframe', 'COBOL', 'DSI', 'cloud', 'cybersecurite', 'ESN', 'freelance', 'IA', 'intelligence artificielle'])
    } catch (e) {
      setKeywords(['mainframe', 'COBOL', 'DSI', 'cloud', 'cybersecurite', 'ESN', 'freelance', 'IA'])
    }
  }

  async function fetchFreshNews() {
    setLoading(true)
    try {
      const kw = keywords.length > 0 ? keywords.join(',') : 'mainframe,COBOL,DSI,cloud,ESN,IA'
      const resp = await fetch(`/api/fetch-veille?keywords=${encodeURIComponent(kw)}`)
      if (!resp.ok) throw new Error('API error: ' + resp.status)
      const result = await resp.json()
      if (result.success && result.items) {
        const savedTitles = new Set(savedItems.map(s => s.title?.toLowerCase().slice(0, 50)))
        const fresh = result.items.filter(i => !savedTitles.has(i.title?.toLowerCase().slice(0, 50)))
        setFreshItems(fresh)
        setLastFetch(new Date())
        setTab('fresh')
      }
    } catch (err) {
      console.error('Fetch veille error:', err)
      alert('Erreur: ' + err.message)
    } finally { setLoading(false) }
  }

  async function keepArticle(item) {
    try {
      await supabase.from('veille_items').upsert({
        type: item.type || 'news', title: item.title, description: item.description,
        url: item.url, source: item.source, keywords: item.keywords,
        relevance_score: item.relevance_score, published_at: item.published_at, is_read: false,
      }, { onConflict: 'title', ignoreDuplicates: true })
      setFreshItems(prev => prev.filter(i => i.title !== item.title))
      setSavedItems(prev => [{ ...item, id: Date.now(), is_read: false }, ...prev])
    } catch (e) { console.error(e) }
  }

  function dismissArticle(item) {
    setFreshItems(prev => prev.filter(i => i.title !== item.title))
  }

  async function keepAllVisible() {
    const visible = getFilteredItems(freshItems)
    for (const item of visible.slice(0, 20)) {
      try {
        await supabase.from('veille_items').upsert({
          type: item.type || 'news', title: item.title, description: item.description,
          url: item.url, source: item.source, keywords: item.keywords,
          relevance_score: item.relevance_score, published_at: item.published_at, is_read: false
        }, { onConflict: 'title', ignoreDuplicates: true })
      } catch (e) {}
    }
    setFreshItems(prev => prev.filter(i => !visible.includes(i)))
    loadSavedItems()
  }

  function dismissAllVisible() {
    const visible = getFilteredItems(freshItems)
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

  function getFilteredItems(items) {
    return items.filter(i => {
      if (filterSource !== 'all' && i.source !== filterSource) return false
      if (filterTheme !== 'all' && classifyArticle(i) !== filterTheme) return false
      return true
    })
  }

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = (new Date() - new Date(dateStr)) / 1000
    if (diff < 3600) return Math.floor(diff / 60) + 'min'
    if (diff < 86400) return Math.floor(diff / 3600) + 'h'
    if (diff < 604800) return Math.floor(diff / 86400) + 'j'
    return Math.floor(diff / 604800) + 'sem'
  }

  // Compute theme counts
  const currentItems = tab === 'fresh' ? freshItems : savedItems
  const themeCounts = {}
  for (const item of currentItems) {
    const theme = classifyArticle(item)
    themeCounts[theme] = (themeCounts[theme] || 0) + 1
  }

  const filteredFresh = getFilteredItems(freshItems)
  const filteredSaved = getFilteredItems(savedItems)
  const freshSources = [...new Set(freshItems.map(i => i.source))].filter(Boolean)

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '📰', label: 'A trier', value: freshItems.length, accent: '#f59e0b' },
          { icon: '✅', label: 'Gardes', value: savedItems.length, accent: '#34d399' },
          { icon: '🌍', label: 'Sources', value: '20', accent: '#60a5fa' },
          { icon: '🔑', label: 'Mots-cles', value: keywords.length, accent: '#D4AF37' }
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1.25rem 1.5rem', borderTop: '3px solid ' + s.accent }}>
            <div style={{ fontSize: '0.8rem', color: '#8ba5b0', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span>{s.icon}</span> {s.label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>🔍 Veille IT — 20 sources francaises</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setShowConfig(!showConfig)} style={{
              background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
              color: '#a78bfa', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
            }}>⚙️ Mots-cles</button>
            <button onClick={fetchFreshNews} disabled={loading} style={{
              background: loading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
              border: 'none', borderRadius: '8px', color: '#122a33', padding: '0.5rem 1.2rem', fontWeight: 700, fontSize: '0.85rem', cursor: loading ? 'wait' : 'pointer'
            }}>{loading ? '⏳ Chargement...' : '🔄 Chercher les news'}</button>
          </div>
        </div>

        {lastFetch && (
          <div style={{ fontSize: '0.75rem', color: '#4a6370', marginBottom: '0.75rem' }}>
            Derniere recherche : {lastFetch.toLocaleTimeString('fr-FR')} — {freshItems.length} articles trouves
          </div>
        )}

        {/* Keywords panel */}
        {showConfig && (
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.6rem' }}>🔑 Mots-cles de recherche</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <input type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder="Ajouter un mot-cle..." style={{
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
                    background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: '0.85rem', padding: 0, lineHeight: 1
                  }}>x</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tab toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button onClick={() => setTab('fresh')} style={{
              padding: '0.5rem 1.2rem', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              background: tab === 'fresh' ? '#D4AF37' : 'rgba(255,255,255,0.05)',
              color: tab === 'fresh' ? '#122a33' : '#8ba5b0'
            }}>📰 A trier ({freshItems.length})</button>
            <button onClick={() => setTab('saved')} style={{
              padding: '0.5rem 1.2rem', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              background: tab === 'saved' ? '#34d399' : 'rgba(255,255,255,0.05)',
              color: tab === 'saved' ? '#122a33' : '#8ba5b0'
            }}>✅ Gardes ({savedItems.length})</button>
          </div>

          {/* View mode */}
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button onClick={() => setViewMode('cards')} style={{
              background: viewMode === 'cards' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
              border: '1px solid ' + (viewMode === 'cards' ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'),
              color: viewMode === 'cards' ? '#D4AF37' : '#4a6370',
              padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer'
            }}>📋 Cartes</button>
            <button onClick={() => setViewMode('compact')} style={{
              background: viewMode === 'compact' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
              border: '1px solid ' + (viewMode === 'compact' ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'),
              color: viewMode === 'compact' ? '#D4AF37' : '#4a6370',
              padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer'
            }}>📄 Compact</button>
          </div>
        </div>

        {/* THEME FILTERS */}
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {Object.entries(THEMES).map(([id, theme]) => {
            const count = id === 'all' ? currentItems.length : (themeCounts[id] || 0)
            return (
              <button key={id} onClick={() => setFilterTheme(id)} style={{
                background: filterTheme === id ? theme.color + '25' : 'rgba(255,255,255,0.04)',
                border: filterTheme === id ? '1px solid ' + theme.color + '50' : '1px solid rgba(255,255,255,0.06)',
                color: filterTheme === id ? theme.color : '#64808b',
                padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem',
                cursor: 'pointer', fontWeight: filterTheme === id ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: '0.3rem'
              }}>
                <span>{theme.icon}</span> {theme.label}
                {count > 0 && <span style={{
                  padding: '0.05rem 0.3rem', borderRadius: '8px', fontSize: '0.6rem', fontWeight: 700,
                  background: filterTheme === id ? theme.color + '30' : 'rgba(255,255,255,0.06)',
                  color: filterTheme === id ? theme.color : '#4a6370'
                }}>{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Source filter */}
        {tab === 'fresh' && freshSources.length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterSource('all')} style={{
              background: filterSource === 'all' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.03)',
              border: filterSource === 'all' ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)',
              color: filterSource === 'all' ? '#D4AF37' : '#4a6370',
              padding: '0.25rem 0.6rem', borderRadius: '16px', fontSize: '0.7rem', cursor: 'pointer'
            }}>Toutes sources</button>
            {freshSources.map(s => {
              const meta = SOURCES_META[s] || { icon: '📰', color: '#94a3b8' }
              return (
                <button key={s} onClick={() => setFilterSource(s)} style={{
                  background: filterSource === s ? meta.color + '20' : 'rgba(255,255,255,0.03)',
                  border: filterSource === s ? '1px solid ' + meta.color + '50' : '1px solid rgba(255,255,255,0.06)',
                  color: filterSource === s ? meta.color : '#4a6370',
                  padding: '0.25rem 0.6rem', borderRadius: '16px', fontSize: '0.7rem', cursor: 'pointer'
                }}>{meta.icon} {s}</button>
              )
            })}
          </div>
        )}

        {/* Bulk actions */}
        {tab === 'fresh' && filteredFresh.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={keepAllVisible} style={{
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
              color: '#34d399', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
            }}>✅ Tout garder ({filteredFresh.length})</button>
            <button onClick={dismissAllVisible} style={{
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
              color: '#f87171', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
            }}>🗑️ Tout supprimer</button>
          </div>
        )}
      </div>

      {/* FRESH ARTICLES */}
      {tab === 'fresh' && (
        <>
          {filteredFresh.length === 0 && !loading ? (
            <div style={{ ...card, padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📰</div>
              <div style={{ color: '#8ba5b0', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                {freshItems.length === 0 ? 'Aucune actualite chargee' : filterTheme !== 'all' ? 'Aucun article dans ce theme' : 'Toutes les actualites ont ete triees !'}
              </div>
              <button onClick={fetchFreshNews} disabled={loading} style={{
                background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none',
                borderRadius: '8px', color: '#122a33', padding: '0.7rem 2rem',
                fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', marginTop: '1rem'
              }}>🔄 Charger les actualites</button>
            </div>
          ) : viewMode === 'compact' ? (
            <div style={{ ...card, overflow: 'hidden' }}>
              {filteredFresh.map((item, idx) => {
                const theme = classifyArticle(item)
                const themeConfig = THEMES[theme] || { icon: '📰', color: '#94a3b8' }
                const sourceMeta = SOURCES_META[item.source] || { icon: '📰', color: '#94a3b8' }
                return (
                  <div key={idx} style={{
                    padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', borderRadius: '4px', background: themeConfig.color + '20', color: themeConfig.color }}>{themeConfig.icon}</span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</a>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#4a6370' }}>{sourceMeta.icon} {item.source} · {timeAgo(item.published_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                      <button onClick={() => keepArticle(item)} style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>✅</button>
                      <button onClick={() => dismissArticle(item)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem' }}>🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
              {filteredFresh.map((item, idx) => (
                <ArticleCard key={idx} item={item} card={card} onKeep={() => keepArticle(item)} onDismiss={() => dismissArticle(item)} actionType="sort" timeAgo={timeAgo} />
              ))}
            </div>
          )}
        </>
      )}

      {/* SAVED ARTICLES */}
      {tab === 'saved' && (
        <>
          {filteredSaved.length === 0 ? (
            <div style={{ ...card, padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <div style={{ color: '#8ba5b0', fontSize: '1.1rem' }}>
                {filterTheme !== 'all' ? 'Aucun article sauvegarde dans ce theme' : 'Aucun article sauvegarde'}
              </div>
            </div>
          ) : viewMode === 'compact' ? (
            <div style={{ ...card, overflow: 'hidden' }}>
              {filteredSaved.map((item, idx) => {
                const theme = classifyArticle(item)
                const themeConfig = THEMES[theme] || { icon: '📰', color: '#94a3b8' }
                const sourceMeta = SOURCES_META[item.source] || { icon: '📰', color: '#94a3b8' }
                return (
                  <div key={item.id || idx} style={{
                    padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', borderRadius: '4px', background: themeConfig.color + '20', color: themeConfig.color }}>{themeConfig.icon}</span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', textDecoration: 'none' }}>{item.title}</a>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#4a6370' }}>{sourceMeta.icon} {item.source} · {timeAgo(item.published_at)}</div>
                    </div>
                    <button onClick={() => deleteSavedItem(item.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem' }}>🗑️</button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
              {filteredSaved.map((item, idx) => (
                <ArticleCard key={item.id || idx} item={item} card={card} onDismiss={() => deleteSavedItem(item.id)} actionType="saved" timeAgo={timeAgo} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ width: 50, height: 50, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
          <div style={{ color: '#D4AF37', fontSize: '1rem', fontWeight: 600, marginBottom: '0.3rem' }}>Recherche sur 20 sources...</div>
          <div style={{ color: '#64808b', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.6 }}>
            Le Monde Informatique · InformatiqueNews · Silicon.fr · LeMagIT<br />
            Alliancy · Next.ink · Clubic · Tom's Hardware · Free-Work IT<br />
            ZDNet France · Planet Mainframe · IT-Connect · La Revue du Digital<br />
            Techniques Ingenieur · Numerama · Journal du Net · 01net<br />
            CNIL · L'Usine Digitale · GreenIT
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}

function ArticleCard({ item, card, onKeep, onDismiss, actionType, timeAgo }) {
  const sourceMeta = SOURCES_META[item.source] || { icon: '📰', color: '#94a3b8' }
  const typeBadge = TYPE_BADGES[item.type] || TYPE_BADGES.news
  const relevance = item.relevance_score || 0
  const theme = classifyArticle(item)
  const themeConfig = THEMES[theme] || { icon: '📰', color: '#94a3b8', label: 'Autre' }

  return (
    <div style={{ ...card, padding: '1.25rem', position: 'relative', overflow: 'hidden', transition: 'all 0.2s, transform 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)' }}>
      {/* Theme + relevance bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ width: relevance ? relevance + '%' : '50%', height: '100%', background: themeConfig.color }} />
      </div>

      {/* Source + theme + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem',
            fontWeight: 600, background: sourceMeta.color + '15', color: sourceMeta.color,
            border: '1px solid ' + sourceMeta.color + '25'
          }}>{sourceMeta.icon} {item.source}</span>
          <span style={{
            padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem',
            fontWeight: 600, color: themeConfig.color, background: themeConfig.color + '15'
          }}>{themeConfig.icon} {themeConfig.label}</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: '#4a6370' }}>{timeAgo(item.published_at)}</span>
      </div>

      {/* Title */}
      <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4, marginBottom: '0.4rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</h3>

      {/* Description */}
      {item.description && (
        <p style={{ fontSize: '0.78rem', color: '#8ba5b0', lineHeight: 1.5, marginBottom: '0.6rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>
      )}

      {/* Keywords */}
      {item.keywords?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginBottom: '0.75rem' }}>
          {item.keywords.slice(0, 4).map((kw, i) => (
            <span key={i} style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', color: '#D4AF37', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)' }}>#{kw}</span>
          ))}
        </div>
      )}

      {/* Actions */}
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
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
            }}>✅ Garder</button>
          )}
          <button onClick={onDismiss} style={{
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
            color: '#f87171', padding: '0.4rem 0.9rem', borderRadius: '6px',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
          }}>🗑️ {actionType === 'saved' ? 'Supprimer' : 'Ignorer'}</button>
        </div>
      </div>
    </div>
  )
}
