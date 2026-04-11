import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [opportunites, setOpportunites] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [selectedContact, setSelectedContact] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', company: '', position: '', is_company: false, notes: ''
  })
  const [auditLoading, setAuditLoading] = useState(null)
  const [audits, setAudits] = useState({})
  const [alerts, setAlerts] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [contRes, oppRes, intRes, auditRes] = await Promise.all([
        supabase.from('contacts').select('*').order('name'),
        supabase.from('opportunites').select('id, name, status, montant, contact_id, type, probabilite'),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('audits').select('*').order('created_at', { ascending: false }).limit(200)
      ])
      if (contRes.data) setContacts(contRes.data)
      if (oppRes.data) setOpportunites(oppRes.data)
      if (intRes.data) setInteractions(intRes.data)
      if (auditRes.data) {
        const auditMap = {}
        const fragileAlerts = []
        auditRes.data.forEach(a => {
          if (a.contact_id && !auditMap[a.contact_id]) auditMap[a.contact_id] = a
          if (a.score_sante !== null && a.score_sante < 40) fragileAlerts.push(a)
        })
        setAudits(auditMap)
        setAlerts(fragileAlerts.slice(0, 5))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function runAutoAudit(contactId, companyName) {
    if (!companyName || companyName.trim().length < 2) return
    setAuditLoading(contactId)
    try {
      const resp = await fetch('/api/audit-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: companyName.trim() })
      })
      if (!resp.ok) return
      const data = await resp.json()
      if (data.success) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('audits').insert([{
          company_name: data.company?.nom || companyName,
          siren: data.company?.siren || null,
          contact_id: contactId,
          company_data: data.company,
          analysis: data.analysis,
          news: data.news || [],
          score_sante: data.analysis?.score_sante || null,
          recommandation: data.analysis?.recommandation || null,
          created_by: user?.id
        }])
        setAudits(prev => ({ ...prev, [contactId]: {
          company_data: data.company, analysis: data.analysis, news: data.news || [],
          score_sante: data.analysis?.score_sante, recommandation: data.analysis?.recommandation
        }}))
        if (data.analysis?.score_sante < 40) {
          setAlerts(prev => [{ company_name: data.company?.nom || companyName,
            score_sante: data.analysis.score_sante, recommandation: data.analysis.recommandation,
            contact_id: contactId }, ...prev.slice(0, 4)])
        }
      }
    } catch (err) { console.error('Auto audit error:', err) }
    finally { setAuditLoading(null) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        name: formData.name, email: formData.email || null, phone: formData.phone || null,
        company: formData.company || null, position: formData.position || null,
        is_company: formData.is_company || false, notes: formData.notes || null, created_by: user?.id
      }
      let newContactId = null
      if (editingContact) {
        const { created_by, ...upd } = payload
        await supabase.from('contacts').update(upd).eq('id', editingContact.id)
        newContactId = editingContact.id
      } else {
        const { data: inserted } = await supabase.from('contacts').insert([payload]).select()
        if (inserted && inserted[0]) newContactId = inserted[0].id
      }
      const wasNew = !editingContact
      const auditName = formData.is_company ? formData.name : formData.company
      setShowModal(false); setEditingContact(null); resetForm(); await loadData()
      if (wasNew && newContactId && auditName && auditName.trim().length >= 2) {
        runAutoAudit(newContactId, auditName)
      }
    } catch (err) { alert('Erreur: ' + err.message) }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce contact ?')) return
    await supabase.from('contacts').delete().eq('id', id)
    if (selectedContact?.id === id) setSelectedContact(null)
    loadData()
  }

  function resetForm() { setFormData({ name: '', email: '', phone: '', company: '', position: '', is_company: false, notes: '' }) }

  function openEdit(c) {
    setEditingContact(c)
    setFormData({ name: c.name || '', email: c.email || '', phone: c.phone || '',
      company: c.company || '', position: c.position || '', is_company: c.is_company || false, notes: c.notes || '' })
    setShowModal(true)
  }

  function getContactOpps(cid) { return opportunites.filter(o => o.contact_id === cid) }
  function getContactInteractions(cid) { return interactions.filter(i => i.contact_id === cid) }
  function fmt(n) { return new Intl.NumberFormat('fr-FR').format(n || 0) }

  function getAuditBadge(cid) {
    const a = audits[cid]
    if (!a || !a.score_sante) return null
    const s = a.score_sante
    if (s >= 70) return { color: '#34d399', bg: 'rgba(52,211,153,0.15)', label: s, icon: '\u{1F7E2}' }
    if (s >= 40) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: s, icon: '\u{1F7E1}' }
    return { color: '#f87171', bg: 'rgba(248,113,113,0.15)', label: s, icon: '\u{1F534}' }
  }

  const searchLower = search.toLowerCase()
  const filteredContacts = contacts.filter(c => {
    if (search && !c.name?.toLowerCase().includes(searchLower) && !c.company?.toLowerCase().includes(searchLower) && !c.email?.toLowerCase().includes(searchLower) && !c.position?.toLowerCase().includes(searchLower)) return false
    if (filter === 'companies') return c.is_company
    if (filter === 'people') return !c.is_company
    return true
  })

  const companiesMap = {}
  contacts.forEach(c => { if (c.company) { if (!companiesMap[c.company]) companiesMap[c.company] = []; companiesMap[c.company].push(c) } })
  const totalCompanies = Object.keys(companiesMap).length
  const totalPeople = contacts.filter(c => !c.is_company).length
  const withOpps = contacts.filter(c => getContactOpps(c.id).length > 0).length
  const caTotal = contacts.reduce((sum, c) => sum + getContactOpps(c.id).filter(o => o.status === 'gagne').reduce((s, o) => s + (o.montant || 0), 0), 0)

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }
  const STATUS_COLORS = { prospection: '#94a3b8', qualification: '#60a5fa', proposition: '#D4AF37', negociation: '#f59e0b', gagne: '#34d399', perdu: '#f87171' }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )

  return (
    <div>
      {/* FRAGILE ALERTS */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ ...card, padding: '0.85rem 1.25rem', borderLeft: '4px solid #f87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{'\u{1F6A8}'}</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#f87171', fontSize: '0.85rem' }}>{a.company_name} — Sant\u00e9 fragile (score: {a.score_sante}/100)</div>
                  <div style={{ fontSize: '0.72rem', color: '#64808b' }}>Recommandation : {a.recommandation === 'eviter' ? '\u274C \u00c9viter' : '\u23F3 Attendre'}</div>
                </div>
              </div>
              <button onClick={() => { const c = contacts.find(ct => ct.id === a.contact_id); if (c) setSelectedContact(c) }} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Voir le contact →</button>
            </div>
          ))}
        </div>
      )}

      {/* AUDIT IN PROGRESS */}
      {auditLoading && (
        <div style={{ ...card, padding: '0.85rem 1.25rem', marginBottom: '1rem', borderLeft: '4px solid #D4AF37', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 20, height: 20, border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: '0.85rem', color: '#D4AF37', fontWeight: 600 }}>{'\u{1F50D}'} Audit automatique en cours... Recherche d'informations et d'actualit\u00e9s</div>
          <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
        </div>
      )}

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '\u{1F465}', label: 'Total Contacts', value: contacts.length, accent: '#D4AF37' },
          { icon: '\u{1F3E2}', label: 'Entreprises', value: totalCompanies, accent: '#60a5fa' },
          { icon: '\u{1F464}', label: 'Personnes', value: totalPeople, accent: '#34d399' },
          { icon: '\u{1F4BC}', label: 'Avec opportunit\u00e9s', value: withOpps, accent: '#a78bfa' },
          { icon: '\u{1F4B0}', label: 'CA Clients', value: fmt(caTotal) + ' \u20AC', accent: '#f59e0b' }
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1.25rem 1.5rem', borderTop: '3px solid ' + s.accent }}>
            <div style={{ fontSize: '0.8rem', color: '#8ba5b0', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span>{s.icon}</span> {s.label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* HEADER */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>{'\u{1F465}'} Contacts & Clients</h2>
          <button onClick={() => { setEditingContact(null); resetForm(); setShowModal(true) }} style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '8px', color: '#122a33', padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>+ Nouveau contact</button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 0 200px' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem' }}>{'\u{1F50D}'}</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un contact..." style={{ width: '100%', padding: '0.55rem 0.9rem 0.55rem 2.2rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {[{ id: 'all', label: 'Tous (' + contacts.length + ')' }, { id: 'companies', label: '\u{1F3E2} Entreprises (' + totalCompanies + ')' }, { id: 'people', label: '\u{1F464} Personnes (' + totalPeople + ')' }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ background: filter === f.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)', border: filter === f.id ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)', color: filter === f.id ? '#D4AF37' : '#8ba5b0', padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: filter === f.id ? 600 : 400, cursor: 'pointer' }}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLE + DETAIL */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedContact ? '1fr 380px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Nom', 'Entreprise', 'Poste', 'Sant\u00e9', 'Opps', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#64808b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredContacts.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64808b' }}>Aucun contact trouv\u00e9</td></tr>
                ) : filteredContacts.map(c => {
                  const opps = getContactOpps(c.id)
                  const isSelected = selectedContact?.id === c.id
                  const badge = getAuditBadge(c.id)
                  const isAuditing = auditLoading === c.id
                  return (
                    <tr key={c.id} onClick={() => setSelectedContact(isSelected ? null : c)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s', background: isSelected ? 'rgba(212,175,55,0.08)' : 'transparent' }} onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(212,175,55,0.04)' }} onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: c.is_company ? 'rgba(96,165,250,0.15)' : 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>{c.is_company ? '\u{1F3E2}' : '\u{1F464}'}</div>
                          <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>{c.company || '\u2014'}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64808b', fontSize: '0.82rem' }}>{c.position || '\u2014'}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isAuditing ? (
                          <div style={{ width: 18, height: 18, border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        ) : badge ? (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, color: badge.color, background: badge.bg }}>{badge.icon} {badge.label}</span>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); runAutoAudit(c.id, c.is_company ? c.name : c.company) }} disabled={!c.company && !c.is_company} style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)', color: '#D4AF37', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: c.company || c.is_company ? 'pointer' : 'default', fontSize: '0.68rem', opacity: c.company || c.is_company ? 1 : 0.3 }}>{'\u{1F50D}'} Auditer</button>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {opps.length > 0 ? <span style={{ padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>{opps.length}</span> : <span style={{ color: '#4a6370', fontSize: '0.8rem' }}>0</span>}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEdit(c)} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u270F\uFE0F'}</button>
                          <button onClick={() => handleDelete(c.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u{1F5D1}\uFE0F'}</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DETAIL PANEL */}
        {selectedContact && (() => {
          const audit = audits[selectedContact.id]
          const analysis = audit?.analysis
          const news = audit?.news || []
          const scoreColor = (audit?.score_sante || 0) >= 70 ? '#34d399' : (audit?.score_sante || 0) >= 40 ? '#f59e0b' : '#f87171'
          return (
            <div style={{ ...card, padding: '1.5rem', position: 'sticky', top: '80px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, color: '#122a33' }}>{selectedContact.name[0]?.toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>{selectedContact.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64808b' }}>{selectedContact.position || ''}{selectedContact.position && selectedContact.company ? ' \u00B7 ' : ''}{selectedContact.company || ''}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedContact(null)} style={{ background: 'none', border: 'none', color: '#4a6370', fontSize: '1.2rem', cursor: 'pointer' }}>{'\u2715'}</button>
              </div>

              {/* Contact info */}
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                {selectedContact.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}><span style={{ fontSize: '0.85rem' }}>{'\u{1F4E7}'}</span><a href={'mailto:' + selectedContact.email} style={{ color: '#60a5fa', fontSize: '0.82rem', textDecoration: 'none' }}>{selectedContact.email}</a></div>}
                {selectedContact.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}><span style={{ fontSize: '0.85rem' }}>{'\u{1F4DE}'}</span><a href={'tel:' + selectedContact.phone} style={{ color: '#e2e8f0', fontSize: '0.82rem', textDecoration: 'none' }}>{selectedContact.phone}</a></div>}
                {selectedContact.notes && <div style={{ fontSize: '0.78rem', color: '#4a6370', fontStyle: 'italic', marginTop: '0.3rem' }}>"{selectedContact.notes.slice(0, 150)}"</div>}
              </div>

              {/* AUDIT SECTION */}
              {!audit ? (
                <div style={{ marginBottom: '1rem' }}>
                  <button onClick={() => runAutoAudit(selectedContact.id, selectedContact.is_company ? selectedContact.name : selectedContact.company)} disabled={auditLoading || (!selectedContact.company && !selectedContact.is_company)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>{'\u{1F50D}'} Lancer l'audit de l'entreprise</button>
                </div>
              ) : (
                <>
                  {analysis && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'\u{1F3E6}'} Audit entreprise</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'conic-gradient(' + scoreColor + ' ' + ((audit.score_sante || 0) * 3.6) + 'deg, rgba(255,255,255,0.05) 0deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(18,42,51,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: scoreColor }}>{audit.score_sante}</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>{analysis.niveau}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64808b' }}>{(analysis.recommandation_detail || '').slice(0, 80)}</div>
                        </div>
                      </div>
                      {analysis.capacite_budget_it && <div style={{ fontSize: '0.75rem', color: '#D4AF37', marginTop: '0.3rem' }}>{'\u{1F4B0}'} Budget IT estim\u00e9 : {analysis.capacite_budget_it}</div>}
                      {analysis.tjm_max_estime && <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '0.2rem' }}>{'\u{1F4CA}'} TJM max : {analysis.tjm_max_estime}\u20AC/j</div>}
                      {analysis.resume_actualites && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem' }}>{'\u{1F4F0}'} {analysis.resume_actualites}</div>}
                    </div>
                  )}

                  {/* NEWS */}
                  {news.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'\u{1F4F0}'} Actualit\u00e9s ({news.length})</div>
                      {news.slice(0, 4).map((n, i) => (
                        <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '0.5rem 0.6rem', borderRadius: '8px', marginBottom: '0.3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', textDecoration: 'none', transition: 'background 0.15s' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3 }}>{(n.title || '').slice(0, 80)}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.65rem', color: n.is_it_source ? '#60a5fa' : '#4a6370' }}>{n.is_it_source ? '\u{1F4BB}' : '\u{1F4F0}'} {n.source}</span>
                            <span style={{ fontSize: '0.65rem', color: '#4a6370' }}>{n.date}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Opportunities */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'\u{1F4BC}'} Opportunit\u00e9s ({getContactOpps(selectedContact.id).length})</div>
                {getContactOpps(selectedContact.id).length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#4a6370', padding: '0.5rem 0' }}>Aucune opportunit\u00e9 li\u00e9e</div>
                ) : getContactOpps(selectedContact.id).map(o => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.6rem', borderRadius: '8px', marginBottom: '0.3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>{o.name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64808b' }}>{o.type} \u00B7 {fmt(o.montant)} \u20AC</div>
                    </div>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 600, color: STATUS_COLORS[o.status] || '#94a3b8', background: (STATUS_COLORS[o.status] || '#94a3b8') + '18' }}>{o.status}</span>
                  </div>
                ))}
              </div>

              {/* Interactions */}
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'\u{1F4DE}'} Derni\u00e8res interactions ({getContactInteractions(selectedContact.id).length})</div>
                {getContactInteractions(selectedContact.id).length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#4a6370', padding: '0.5rem 0' }}>Aucune interaction</div>
                ) : getContactInteractions(selectedContact.id).slice(0, 5).map((int, i) => (
                  <div key={int.id || i} style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', marginBottom: '0.3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#e2e8f0' }}>{int.type === 'appel' ? '\u{1F4DE}' : int.type === 'email' ? '\u{1F4E7}' : int.type === 'reunion' ? '\u{1F91D}' : '\u{1F4DD}'} {int.type}</span>
                      <span style={{ fontSize: '0.65rem', color: '#4a6370' }}>{new Date(int.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {int.notes && <div style={{ fontSize: '0.72rem', color: '#64808b', marginTop: '0.2rem' }}>{int.notes.slice(0, 80)}</div>}
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem' }}>
                <button onClick={() => openEdit(selectedContact)} style={{ flex: 1, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>{'\u270F\uFE0F'} Modifier</button>
                {selectedContact.email && <a href={'mailto:' + selectedContact.email} style={{ flex: 1, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'block' }}>{'\u{1F4E7}'} Email</a>}
                {selectedContact.phone && <a href={'tel:' + selectedContact.phone} style={{ flex: 1, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'block' }}>{'\u{1F4DE}'} Appeler</a>}
              </div>
            </div>
          )
        })()}
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
          <div style={{ ...card, width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>{editingContact ? '\u270F\uFE0F Modifier le contact' : '\u2795 Nouveau contact'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.4rem', cursor: 'pointer' }}>{'\u00D7'}</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button type="button" onClick={() => setFormData({ ...formData, is_company: false })} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: !formData.is_company ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)', color: !formData.is_company ? '#D4AF37' : '#64808b', fontWeight: !formData.is_company ? 600 : 400, fontSize: '0.85rem' }}>{'\u{1F464}'} Personne</button>
                <button type="button" onClick={() => setFormData({ ...formData, is_company: true })} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: formData.is_company ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)', color: formData.is_company ? '#60a5fa' : '#64808b', fontWeight: formData.is_company ? 600 : 400, fontSize: '0.85rem' }}>{'\u{1F3E2}'} Entreprise</button>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>{formData.is_company ? "Nom de l'entreprise" : 'Nom complet'} *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputStyle} />
              </div>
              {!formData.is_company && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div><label style={labelStyle}>Entreprise</label><input type="text" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Poste</label><input type="text" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} style={inputStyle} /></div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><label style={labelStyle}>Email</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>T\u00e9l\u00e9phone</label><input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Notes</label>
                <textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8ba5b0', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', color: '#122a33', padding: '0.6rem 1.8rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>{editingContact ? 'Mettre \u00e0 jour' : 'Cr\u00e9er'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', color: '#8ba5b0', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '0.03em', textTransform: 'uppercase' }
const inputStyle = { width: '100%', padding: '0.65rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }
