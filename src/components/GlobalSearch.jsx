import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function GlobalSearch({ onNavigate, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ contacts: [], opportunites: [], candidats: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults({ contacts: [], opportunites: [], candidats: [] })
      return
    }
    const timer = setTimeout(() => search(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  async function search(q) {
    setLoading(true)
    try {
      const term = `%${q}%`
      const [contRes, oppRes, candRes] = await Promise.all([
        supabase.from('contacts').select('id, name, company, email, phone').or(`name.ilike.${term},company.ilike.${term},email.ilike.${term}`).limit(8),
        supabase.from('opportunites').select('id, name, type, status, montant, notes').or(`name.ilike.${term},notes.ilike.${term},type.ilike.${term}`).limit(8),
        supabase.from('candidats').select('id, name, titre_poste, competences, tjm, status').or(`name.ilike.${term},titre_poste.ilike.${term},competences.ilike.${term}`).limit(8)
      ])
      setResults({
        contacts: contRes.data || [],
        opportunites: oppRes.data || [],
        candidats: candRes.data || []
      })
      setSelectedIndex(0)
    } catch (e) { console.error('Search error:', e) }
    finally { setLoading(false) }
  }

  const allResults = [
    ...results.contacts.map(r => ({ ...r, _type: 'contacts', _icon: '👥', _label: r.name, _sub: r.company || r.email || '' })),
    ...results.opportunites.map(r => ({ ...r, _type: 'opportunites', _icon: '💼', _label: r.name, _sub: `${r.type || 'AT'} · ${new Intl.NumberFormat('fr-FR').format(r.montant || 0)} €` })),
    ...results.candidats.map(r => ({ ...r, _type: 'candidats', _icon: '👔', _label: r.name, _sub: r.titre_poste || `TJM: ${r.tjm || '—'}€` }))
  ]

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, allResults.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && allResults[selectedIndex]) {
      handleSelect(allResults[selectedIndex])
    }
  }

  function handleSelect(item) {
    onNavigate(item._type)
    onClose()
  }

  function highlight(text, q) {
    if (!text || !q || q.length < 2) return text
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = String(text).split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} style={{ background: 'rgba(212,175,55,0.3)', color: '#D4AF37', borderRadius: '2px', padding: '0 2px' }}>{part}</mark> : part
    )
  }

  const groupLabels = { contacts: '👥 Contacts', opportunites: '💼 Opportunités', candidats: '👔 Candidats' }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '12vh'
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: '620px',
        background: 'linear-gradient(135deg, rgba(18,42,51,0.98) 0%, rgba(26,58,69,0.95) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(212,175,55,0.2)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        animation: 'searchSlideIn 0.2s ease'
      }} onClick={e => e.stopPropagation()}>

        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <span style={{ fontSize: '1.2rem', color: '#D4AF37' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher contacts, opportunités, candidats..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#f1f5f9', fontSize: '1.05rem', fontWeight: 500
            }}
          />
          {loading && (
            <div style={{ width: 18, height: 18, border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          )}
          <kbd style={{
            padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem',
            background: 'rgba(255,255,255,0.06)', color: '#4a6370', border: '1px solid rgba(255,255,255,0.08)'
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '0.5rem' }}>
          {query.length < 2 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#4a6370', fontSize: '0.85rem' }}>
              Tapez au moins 2 caractères pour rechercher...
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['COBOL', 'Mainframe', 'BNP', 'Java'].map(s => (
                  <button key={s} onClick={() => setQuery(s)} style={{
                    background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)',
                    color: '#D4AF37', padding: '0.25rem 0.7rem', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '0.75rem'
                  }}>{s}</button>
                ))}
              </div>
            </div>
          ) : allResults.length === 0 && !loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#4a6370', fontSize: '0.85rem' }}>
              Aucun résultat pour "{query}"
            </div>
          ) : (
            <>
              {['contacts', 'opportunites', 'candidats'].map(type => {
                const items = allResults.filter(r => r._type === type)
                if (items.length === 0) return null
                return (
                  <div key={type}>
                    <div style={{
                      padding: '0.5rem 0.75rem', fontSize: '0.72rem', fontWeight: 600,
                      color: '#64808b', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {groupLabels[type]} ({items.length})
                    </div>
                    {items.map((item, idx) => {
                      const globalIdx = allResults.indexOf(item)
                      const isSelected = globalIdx === selectedIndex
                      return (
                        <button key={item.id} onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px',
                            border: 'none', cursor: 'pointer', textAlign: 'left',
                            background: isSelected ? 'rgba(212,175,55,0.1)' : 'transparent',
                            borderLeft: isSelected ? '3px solid #D4AF37' : '3px solid transparent',
                            transition: 'all 0.1s'
                          }}>
                          <span style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center' }}>{item._icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {highlight(item._label, query)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64808b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {highlight(item._sub, query)}
                            </div>
                          </div>
                          {isSelected && (
                            <span style={{ fontSize: '0.65rem', color: '#4a6370' }}>↵ Entrée</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        {allResults.length > 0 && (
          <div style={{
            padding: '0.6rem 1rem', borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#3a5560' }}>{allResults.length} résultat(s)</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <kbd style={{ padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.6rem', background: 'rgba(255,255,255,0.05)', color: '#4a6370', border: '1px solid rgba(255,255,255,0.06)' }}>↑↓</kbd>
              <span style={{ fontSize: '0.6rem', color: '#3a5560' }}>naviguer</span>
              <kbd style={{ padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.6rem', background: 'rgba(255,255,255,0.05)', color: '#4a6370', border: '1px solid rgba(255,255,255,0.06)' }}>↵</kbd>
              <span style={{ fontSize: '0.6rem', color: '#3a5560' }}>ouvrir</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes searchSlideIn { from { opacity: 0; transform: translateY(-20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
