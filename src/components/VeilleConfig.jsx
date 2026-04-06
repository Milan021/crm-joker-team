import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const SECTIONS = [
  { id: 'veille', icon: '🔑', label: 'Mots-clés de veille' },
  { id: 'profil', icon: '👤', label: 'Mon profil' },
  { id: 'affichage', icon: '🎨', label: 'Préférences d\'affichage' },
  { id: 'donnees', icon: '💾', label: 'Données & Export' },
  { id: 'about', icon: 'ℹ️', label: 'À propos du CRM' }
]

export default function VeilleConfig() {
  const [activeSection, setActiveSection] = useState('veille')
  const [keywords, setKeywords] = useState([])
  const [newKeyword, setNewKeyword] = useState('')
  const [newKeywordType, setNewKeywordType] = useState('keyword')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({ contacts: 0, opportunites: 0, candidats: 0, veille: 0, matchings: 0 })
  const [exporting, setExporting] = useState(false)
  const [preferences, setPreferences] = useState({
    itemsPerPage: 25,
    defaultTab: 'dashboard',
    showTjm: true,
    showPipeline: true,
    veilleAutoRefresh: false,
    matchingAutoCalc: false
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)

      const [kwRes, contactRes, oppRes, candRes, veilleRes, matchRes] = await Promise.all([
        supabase.from('veille_config').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('opportunites').select('id', { count: 'exact', head: true }),
        supabase.from('candidats').select('id', { count: 'exact', head: true }),
        supabase.from('veille_items').select('id', { count: 'exact', head: true }),
        supabase.from('matchings').select('id', { count: 'exact', head: true })
      ])

      if (kwRes.data) setKeywords(kwRes.data)
      setStats({
        contacts: contactRes.count || 0,
        opportunites: oppRes.count || 0,
        candidats: candRes.count || 0,
        veille: veilleRes.count || 0,
        matchings: matchRes.count || 0
      })

      // Load preferences from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('crm_preferences') || '{}')
        if (Object.keys(saved).length) setPreferences(prev => ({ ...prev, ...saved }))
      } catch (e) {}
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function addKeyword() {
    if (!newKeyword.trim()) return
    try {
      const { data, error } = await supabase.from('veille_config').insert({
        type: newKeywordType, value: newKeyword.trim(), is_active: true
      }).select()
      if (error) throw error
      if (data) setKeywords(prev => [data[0], ...prev])
      setNewKeyword('')
    } catch (e) { alert(`Erreur: ${e.message}`) }
  }

  async function toggleKeyword(id, current) {
    try {
      await supabase.from('veille_config').update({ is_active: !current }).eq('id', id)
      setKeywords(prev => prev.map(k => k.id === id ? { ...k, is_active: !current } : k))
    } catch (e) { console.error(e) }
  }

  async function deleteKeyword(id) {
    try {
      await supabase.from('veille_config').delete().eq('id', id)
      setKeywords(prev => prev.filter(k => k.id !== id))
    } catch (e) { console.error(e) }
  }

  function savePreferences(newPrefs) {
    setPreferences(newPrefs)
    localStorage.setItem('crm_preferences', JSON.stringify(newPrefs))
  }

  async function exportData(table) {
    setExporting(true)
    try {
      const { data, error } = await supabase.from(table).select('*')
      if (error) throw error
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crm-${table}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert(`Erreur export: ${e.message}`) }
    finally { setExporting(false) }
  }

  async function exportAllCSV() {
    setExporting(true)
    try {
      const tables = ['contacts', 'opportunites', 'candidats']
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*')
        if (!data?.length) continue
        const headers = Object.keys(data[0])
        const csv = [
          headers.join(';'),
          ...data.map(row => headers.map(h => {
            let val = row[h]
            if (val === null || val === undefined) return ''
            if (typeof val === 'object') val = JSON.stringify(val)
            return `"${String(val).replace(/"/g, '""')}"`
          }).join(';'))
        ].join('\n')
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `crm-${table}-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) { alert(`Erreur: ${e.message}`) }
    finally { setExporting(false) }
  }

  // Grouping keywords by type
  const kwByType = { keyword: [], technology: [], location: [], company: [] }
  keywords.forEach(k => {
    if (kwByType[k.type]) kwByType[k.type].push(k)
    else kwByType.keyword.push(k)
  })

  const typeLabels = {
    keyword: { label: '🔑 Mots-clés', color: '#D4AF37' },
    technology: { label: '💻 Technologies', color: '#60a5fa' },
    location: { label: '📍 Localisations', color: '#34d399' },
    company: { label: '🏢 Entreprises', color: '#a78bfa' }
  }

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⚙️ Paramètres
        </h2>
        <p style={{ color: '#64808b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>
          Configurez votre CRM Joker Team
        </p>
      </div>

      {/* ── LAYOUT: sidebar + content ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* Sidebar */}
        <div style={{ ...card, padding: '0.75rem', position: 'sticky', top: '80px' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
              padding: '0.75rem 1rem', borderRadius: '8px', border: 'none',
              background: activeSection === s.id ? 'rgba(212,175,55,0.12)' : 'transparent',
              color: activeSection === s.id ? '#D4AF37' : '#8ba5b0',
              fontSize: '0.88rem', fontWeight: activeSection === s.id ? 600 : 400,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              borderLeft: activeSection === s.id ? '3px solid #D4AF37' : '3px solid transparent'
            }}>
              <span style={{ fontSize: '1.1rem' }}>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>

          {/* ════════ VEILLE KEYWORDS ════════ */}
          {activeSection === 'veille' && (
            <div style={{ ...card, padding: '2rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
                🔑 Mots-clés de veille
              </h3>
              <p style={{ color: '#64808b', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                Ces mots-clés sont utilisés pour rechercher des actualités sur InformatiqueNews, Alliancy, LeMagIT, Silicon.fr et Google News.
              </p>

              {/* Add form */}
              <div style={{
                display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap',
                background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1rem',
                border: '1px solid rgba(255,255,255,0.04)'
              }}>
                <select value={newKeywordType} onChange={e => setNewKeywordType(e.target.value)} style={{
                  padding: '0.6rem 0.9rem', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  color: '#e2e8f0', fontSize: '0.85rem', outline: 'none'
                }}>
                  <option value="keyword">🔑 Mot-clé</option>
                  <option value="technology">💻 Technologie</option>
                  <option value="location">📍 Localisation</option>
                  <option value="company">🏢 Entreprise</option>
                </select>
                <input type="text" value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                  placeholder="Ex: Mainframe, COBOL, Paris, BNP..."
                  style={{
                    flex: 1, minWidth: '200px', padding: '0.6rem 0.9rem',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none',
                    boxSizing: 'border-box'
                  }} />
                <button onClick={addKeyword} style={{
                  background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none',
                  borderRadius: '8px', color: '#122a33', padding: '0.6rem 1.4rem',
                  fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap'
                }}>➕ Ajouter</button>
              </div>

              {/* Keywords grouped by type */}
              {Object.entries(kwByType).map(([type, items]) => {
                if (items.length === 0) return null
                const meta = typeLabels[type]
                return (
                  <div key={type} style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                      fontSize: '0.82rem', fontWeight: 600, color: meta.color,
                      marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem'
                    }}>
                      {meta.label}
                      <span style={{
                        padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.68rem',
                        background: `${meta.color}15`, color: meta.color
                      }}>{items.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {items.map(kw => (
                        <div key={kw.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.3rem 0.75rem', borderRadius: '8px',
                          background: kw.is_active ? `${meta.color}10` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${kw.is_active ? `${meta.color}25` : 'rgba(255,255,255,0.06)'}`,
                          opacity: kw.is_active ? 1 : 0.4, transition: 'all 0.2s'
                        }}>
                          <span style={{ fontSize: '0.82rem', color: kw.is_active ? '#e2e8f0' : '#4a6370' }}>
                            {kw.value}
                          </span>
                          <button onClick={() => toggleKeyword(kw.id, kw.is_active)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '0.75rem', color: kw.is_active ? '#34d399' : '#4a6370'
                          }} title={kw.is_active ? 'Désactiver' : 'Activer'}>
                            {kw.is_active ? '●' : '○'}
                          </button>
                          <button onClick={() => deleteKeyword(kw.id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '0.8rem', color: '#4a6370', transition: 'color 0.15s'
                          }}
                            onMouseEnter={e => e.target.style.color = '#f87171'}
                            onMouseLeave={e => e.target.style.color = '#4a6370'}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {keywords.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#4a6370' }}>
                  Aucun mot-clé configuré. Ajoutez-en pour activer la veille automatique.
                </div>
              )}
            </div>
          )}

          {/* ════════ PROFIL ════════ */}
          {activeSection === 'profil' && (
            <div style={{ ...card, padding: '2rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '1.5rem' }}>
                👤 Mon profil
              </h3>

              <div style={{
                background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', fontWeight: 700, color: '#122a33'
                  }}>
                    {(user?.email || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9' }}>
                      {user?.email || 'Utilisateur'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64808b', marginTop: '0.2rem' }}>
                      ID: {user?.id?.slice(0, 8)}...
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#4a6370', marginTop: '0.15rem' }}>
                      Inscrit le {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  {[
                    { label: 'Contacts', value: stats.contacts, icon: '👥' },
                    { label: 'Opportunités', value: stats.opportunites, icon: '💼' },
                    { label: 'Candidats', value: stats.candidats, icon: '👔' },
                    { label: 'Articles veille', value: stats.veille, icon: '📰' },
                    { label: 'Matchings', value: stats.matchings, icon: '🤖' }
                  ].map((s, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                      padding: '0.75rem', border: '1px solid rgba(255,255,255,0.04)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '1.3rem' }}>{s.icon}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64808b' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => supabase.auth.signOut()} style={{
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                color: '#f87171', padding: '0.6rem 1.4rem', borderRadius: '8px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
              }}>🚪 Se déconnecter</button>
            </div>
          )}

          {/* ════════ AFFICHAGE ════════ */}
          {activeSection === 'affichage' && (
            <div style={{ ...card, padding: '2rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
                🎨 Préférences d'affichage
              </h3>
              <p style={{ color: '#64808b', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                Personnalisez l'apparence et le comportement du CRM
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Toggle switches */}
                {[
                  { key: 'showTjm', label: 'Afficher les TJM dans les tableaux', desc: 'Montrer la colonne TJM dans Candidats et Opportunités' },
                  { key: 'showPipeline', label: 'Afficher le pipeline sur le Dashboard', desc: 'Montrer les cartes Pipeline et CA Total Prévu' },
                  { key: 'veilleAutoRefresh', label: 'Actualisation auto de la veille', desc: 'Rafraîchir automatiquement les actualités au chargement' },
                  { key: 'matchingAutoCalc', label: 'Matching automatique', desc: 'Recalculer les matchings à chaque nouveau candidat/opportunité' }
                ].map(opt => (
                  <div key={opt.key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem 1.25rem', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 500 }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#4a6370', marginTop: '0.15rem' }}>{opt.desc}</div>
                    </div>
                    <button onClick={() => savePreferences({ ...preferences, [opt.key]: !preferences[opt.key] })} style={{
                      width: '48px', height: '26px', borderRadius: '13px', border: 'none',
                      background: preferences[opt.key] ? '#D4AF37' : 'rgba(255,255,255,0.1)',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: '#fff', position: 'absolute', top: '3px',
                        left: preferences[opt.key] ? '25px' : '3px',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                      }} />
                    </button>
                  </div>
                ))}

                {/* Items per page */}
                <div style={{
                  padding: '1rem 1.25rem', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 500 }}>Éléments par page</div>
                    <div style={{ fontSize: '0.75rem', color: '#4a6370' }}>Nombre d'éléments affichés par défaut</div>
                  </div>
                  <select value={preferences.itemsPerPage}
                    onChange={e => savePreferences({ ...preferences, itemsPerPage: Number(e.target.value) })}
                    style={{
                      padding: '0.45rem 0.75rem', background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                      color: '#e2e8f0', fontSize: '0.85rem', outline: 'none'
                    }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ════════ DONNÉES & EXPORT ════════ */}
          {activeSection === 'donnees' && (
            <div style={{ ...card, padding: '2rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
                💾 Données & Export
              </h3>
              <p style={{ color: '#64808b', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                Exportez vos données ou gérez vos sauvegardes
              </p>

              {/* Export JSON */}
              <div style={{
                background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.25rem'
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem' }}>
                  📦 Export JSON (par table)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { table: 'contacts', label: '👥 Contacts', count: stats.contacts },
                    { table: 'opportunites', label: '💼 Opportunités', count: stats.opportunites },
                    { table: 'candidats', label: '👔 Candidats', count: stats.candidats },
                    { table: 'veille_items', label: '📰 Veille', count: stats.veille },
                    { table: 'matchings', label: '🤖 Matchings', count: stats.matchings }
                  ].map(t => (
                    <button key={t.table} onClick={() => exportData(t.table)} disabled={exporting} style={{
                      background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                      color: '#60a5fa', padding: '0.5rem 1rem', borderRadius: '8px',
                      cursor: exporting ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: '0.4rem'
                    }}>
                      {t.label}
                      <span style={{
                        padding: '0.1rem 0.4rem', borderRadius: '8px', fontSize: '0.65rem',
                        background: 'rgba(96,165,250,0.15)'
                      }}>{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Export CSV all */}
              <div style={{
                background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.25rem'
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#34d399', marginBottom: '0.5rem' }}>
                  📊 Export CSV complet
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64808b', marginBottom: '0.75rem' }}>
                  Exporte Contacts + Opportunités + Candidats en fichiers CSV séparés (compatible Excel)
                </p>
                <button onClick={exportAllCSV} disabled={exporting} style={{
                  background: 'linear-gradient(135deg, #34d399, #22c55e)', border: 'none',
                  borderRadius: '8px', color: '#122a33', padding: '0.6rem 1.4rem',
                  fontWeight: 700, fontSize: '0.85rem', cursor: exporting ? 'wait' : 'pointer'
                }}>
                  {exporting ? '⏳ Export en cours...' : '📥 Télécharger tout en CSV'}
                </button>
              </div>

              {/* Danger zone */}
              <div style={{
                background: 'rgba(248,113,113,0.05)', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid rgba(248,113,113,0.15)'
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f87171', marginBottom: '0.5rem' }}>
                  ⚠️ Zone dangereuse
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64808b', marginBottom: '0.75rem' }}>
                  Ces actions sont irréversibles. Exportez vos données avant de procéder.
                </p>
                <button onClick={() => {
                  if (confirm('⚠️ Supprimer TOUS les articles de veille ? Cette action est irréversible.')) {
                    supabase.from('veille_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                      .then(() => { alert('✅ Veille vidée'); loadAll() })
                  }
                }} style={{
                  background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                  color: '#f87171', padding: '0.5rem 1rem', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500
                }}>🗑️ Vider la veille</button>
              </div>
            </div>
          )}

          {/* ════════ ABOUT ════════ */}
          {activeSection === 'about' && (
            <div style={{ ...card, padding: '2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <img src="/logo-joker-team.png" alt="Joker Team" style={{ height: '80px', marginBottom: '1rem' }}
                  onError={e => { e.target.style.display = 'none' }} />
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#D4AF37', margin: 0 }}>
                  CRM Joker Team
                </h3>
                <p style={{ color: '#8ba5b0', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  La carte pour réussir
                </p>
                <div style={{
                  display: 'inline-block', padding: '0.25rem 0.8rem', borderRadius: '20px',
                  background: 'rgba(212,175,55,0.1)', color: '#D4AF37', fontSize: '0.75rem',
                  fontWeight: 600, marginTop: '0.5rem', border: '1px solid rgba(212,175,55,0.2)'
                }}>v2.0</div>
              </div>

              <div style={{
                background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid rgba(255,255,255,0.04)'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1rem' }}>
                  Fonctionnalités
                </div>
                {[
                  { icon: '📊', label: 'Dashboard interactif', desc: 'Stats cliquables, alertes urgentes, widget news' },
                  { icon: '👥', label: 'Gestion des contacts', desc: 'Groupement par entreprise, recherche, filtres' },
                  { icon: '💼', label: 'Pipeline d\'opportunités', desc: 'Suivi commercial, relances, probabilités' },
                  { icon: '👔', label: 'Gestion des candidats', desc: 'Upload CV, parsing IA, mots-clés automatiques' },
                  { icon: '🔍', label: 'Veille du marché IT', desc: 'Actualités automatiques depuis 5+ sources françaises' },
                  { icon: '🤖', label: 'Matching IA', desc: 'Correspondance automatique CV ↔ Missions' },
                  { icon: '📱', label: 'Responsive', desc: 'Interface adaptée mobile, tablette et desktop' }
                ].map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '0.75rem', padding: '0.6rem 0',
                    borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 500 }}>{f.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#4a6370' }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#2a4a55', fontSize: '0.72rem' }}>
                © {new Date().getFullYear()} Joker Team · Propulsé par Supabase + Vercel + Claude IA
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
