import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const COLUMNS = [
  { id: 'prospection', label: 'Prospection', icon: '🔍', color: '#94a3b8' },
  { id: 'qualification', label: 'Qualification', icon: '✅', color: '#60a5fa' },
  { id: 'proposition', label: 'Proposition', icon: '📄', color: '#D4AF37' },
  { id: 'negociation', label: 'Négociation', icon: '🤝', color: '#f59e0b' },
  { id: 'gagne', label: 'Gagné', icon: '🎉', color: '#34d399' },
  { id: 'perdu', label: 'Perdu', icon: '❌', color: '#f87171' }
]

const TYPE_CONFIG = {
  AT: { label: 'AT', color: '#60a5fa' },
  FORFAIT: { label: 'Forfait', color: '#a78bfa' },
  REGIE: { label: 'Régie', color: '#34d399' },
  CONSEIL: { label: 'Conseil', color: '#fbbf24' }
}

const INTERACTION_TYPES = [
  { id: 'appel', icon: '📞', label: 'Appel', color: '#60a5fa' },
  { id: 'email', icon: '📧', label: 'Email', color: '#34d399' },
  { id: 'reunion', icon: '🤝', label: 'Réunion', color: '#D4AF37' },
  { id: 'linkedin', icon: '💼', label: 'LinkedIn', color: '#a78bfa' },
  { id: 'autre', icon: '📝', label: 'Autre', color: '#94a3b8' }
]

export default function Opportunites() {
  const [opportunites, setOpportunites] = useState([])
  const [contacts, setContacts] = useState([])
  const [candidats, setCandidats] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [showModal, setShowModal] = useState(false)
  const [showInteractionModal, setShowInteractionModal] = useState(false)
  const [editingOpp, setEditingOpp] = useState(null)
  const [selectedOpp, setSelectedOpp] = useState(null)
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [filter, setFilter] = useState('all')
  const [formData, setFormData] = useState({
    name: '', contact_id: '', type: 'AT', status: 'prospection',
    probabilite: 10, tjm: 0, nb_jours: 0, montant: 0,
    closing_date: '', notes: '', freelance_name: ''
  })
  const [interactionForm, setInteractionForm] = useState({
    type: 'appel', notes: '', next_action_date: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [oppRes, contRes, candRes, intRes] = await Promise.all([
        supabase.from('opportunites').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('id, name, company'),
        supabase.from('candidats').select('id, name, titre_poste, tjm, status'),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(200)
      ])
      if (oppRes.data) setOpportunites(oppRes.data)
      if (contRes.data) setContacts(contRes.data)
      if (candRes.data) setCandidats(candRes.data)
      if (intRes.data) setInteractions(intRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const montant = Number(formData.tjm) * Number(formData.nb_jours) || Number(formData.montant)
      const payload = {
        name: formData.name,
        contact_id: formData.contact_id || null,
        type: formData.type || 'AT',
        status: formData.status || 'prospection',
        probabilite: Number(formData.probabilite) || 10,
        tjm: Number(formData.tjm) || 0,
        nb_jours: Number(formData.nb_jours) || 0,
        montant: montant,
        closing_date: formData.closing_date || null,
        notes: formData.notes || null,
        freelance_name: formData.freelance_name || null,
        created_by: user?.id
      }
      if (editingOpp) {
        const { created_by, ...upd } = payload
        await supabase.from('opportunites').update(upd).eq('id', editingOpp.id)
      } else {
        await supabase.from('opportunites').insert([payload])
      }
      setShowModal(false); setEditingOpp(null); resetForm(); loadData()
    } catch (err) { alert(`Erreur: ${err.message}`) }
  }

  async function addInteraction(e) {
    e.preventDefault()
    if (!selectedOpp) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('interactions').insert([{
        opportunite_id: selectedOpp.id,
        contact_id: selectedOpp.contact_id,
        type: interactionForm.type,
        notes: interactionForm.notes,
        created_by: user?.id
      }])
      const updates = { last_contact_date: new Date().toISOString().slice(0, 10) }
      if (interactionForm.next_action_date) updates.next_action_date = interactionForm.next_action_date
      await supabase.from('opportunites').update(updates).eq('id', selectedOpp.id)
      setInteractionForm({ type: 'appel', notes: '', next_action_date: '' })
      loadData()
    } catch (err) { alert(`Erreur: ${err.message}`) }
  }

  async function updateStatus(oppId, newStatus) {
    try {
      const prob = newStatus === 'gagne' ? 100 : newStatus === 'perdu' ? 0 : undefined
      const upd = { status: newStatus }
      if (prob !== undefined) upd.probabilite = prob
      await supabase.from('opportunites').update(upd).eq('id', oppId)
      setOpportunites(prev => prev.map(o => o.id === oppId ? { ...o, ...upd } : o))
    } catch (err) { console.error(err) }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette opportunité ?')) return
    await supabase.from('opportunites').delete().eq('id', id)
    loadData()
  }

  function resetForm() {
    setFormData({ name: '', contact_id: '', type: 'AT', status: 'prospection', probabilite: 10, tjm: 0, nb_jours: 0, montant: 0, closing_date: '', notes: '', freelance_name: '' })
  }

  function openEdit(opp) {
    setEditingOpp(opp)
    setFormData({
      name: opp.name || '', contact_id: opp.contact_id || '', type: opp.type || 'AT',
      status: opp.status || 'prospection', probabilite: opp.probabilite || 10,
      tjm: opp.tjm || 0, nb_jours: opp.nb_jours || 0, montant: opp.montant || 0,
      closing_date: opp.closing_date || '', notes: opp.notes || '',
      freelance_name: opp.freelance_name || ''
    })
    setShowModal(true)
  }

  function openInteractions(opp) {
    setSelectedOpp(opp)
    setShowInteractionModal(true)
  }

  function getContactName(id) {
    const c = contacts.find(c => c.id === id)
    return c ? c.name : '—'
  }

  function getOppInteractions(oppId) {
    return interactions.filter(i => i.opportunite_id === oppId)
  }

  function daysSince(dateStr) {
    if (!dateStr) return null
    return Math.floor((new Date() - new Date(dateStr)) / 86400000)
  }

  function fmt(n) { return new Intl.NumberFormat('fr-FR').format(n || 0) }

  // Drag & drop
  function handleDragStart(e, opp) {
    setDraggedItem(opp)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e, colId) {
    e.preventDefault()
    setDragOverCol(colId)
  }
  function handleDragLeave() { setDragOverCol(null) }
  function handleDrop(e, colId) {
    e.preventDefault()
    setDragOverCol(null)
    if (draggedItem && draggedItem.status !== colId) {
      updateStatus(draggedItem.id, colId)
    }
    setDraggedItem(null)
  }

  // Stats
  const caGagne = opportunites.filter(o => o.status === 'gagne').reduce((s, o) => s + (o.montant || 0), 0)
  const pipeline = opportunites.filter(o => !['gagne', 'perdu'].includes(o.status)).reduce((s, o) => s + ((o.montant || 0) * (o.probabilite || 0) / 100), 0)
  const actives = opportunites.filter(o => !['gagne', 'perdu'].includes(o.status)).length
  const needsRelance = opportunites.filter(o => {
    if (['gagne', 'perdu'].includes(o.status)) return false
    const days = daysSince(o.last_contact_date)
    return days === null || days > 7
  })

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
      {/* ── RELANCE ALERTS ── */}
      {needsRelance.length > 0 && (
        <div style={{ ...card, padding: '1rem 1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.5rem' }}>
            ⚠️ {needsRelance.length} opportunité(s) à relancer (pas de contact depuis 7j+)
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {needsRelance.slice(0, 5).map(o => (
              <button key={o.id} onClick={() => openInteractions(o)} style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                color: '#fbbf24', padding: '0.3rem 0.8rem', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500
              }}>📞 {o.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '💰', label: 'CA Gagné', value: `${fmt(caGagne)} €`, accent: '#34d399' },
          { icon: '📊', label: 'Pipeline pondéré', value: `${fmt(Math.round(pipeline))} €`, accent: '#60a5fa' },
          { icon: '🎯', label: 'Actives', value: actives, accent: '#D4AF37' },
          { icon: '⚠️', label: 'À relancer', value: needsRelance.length, accent: '#f59e0b' }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            💼 Pipeline Opportunités
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => setView('kanban')} style={{
                padding: '0.45rem 1rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: view === 'kanban' ? '#D4AF37' : 'rgba(255,255,255,0.05)',
                color: view === 'kanban' ? '#122a33' : '#8ba5b0'
              }}>▦ Kanban</button>
              <button onClick={() => setView('table')} style={{
                padding: '0.45rem 1rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: view === 'table' ? '#D4AF37' : 'rgba(255,255,255,0.05)',
                color: view === 'table' ? '#122a33' : '#8ba5b0'
              }}>≡ Tableau</button>
            </div>
            <button onClick={() => { setEditingOpp(null); resetForm(); setShowModal(true) }} style={{
              background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '8px',
              color: '#122a33', padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
            }}>+ Nouvelle opportunité</button>
          </div>
        </div>
      </div>

      {/* ── KANBAN VIEW ── */}
      {view === 'kanban' && (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {COLUMNS.map(col => {
            const colOpps = opportunites.filter(o => o.status === col.id)
            const colTotal = colOpps.reduce((s, o) => s + (o.montant || 0), 0)
            const isDragOver = dragOverCol === col.id
            return (
              <div key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                style={{
                  minWidth: '260px', flex: '1 0 260px',
                  background: isDragOver ? 'rgba(212,175,55,0.08)' : 'rgba(18,42,51,0.4)',
                  borderRadius: '12px',
                  border: isDragOver ? '2px dashed #D4AF37' : '1px solid rgba(255,255,255,0.06)',
                  padding: '0.75rem', transition: 'all 0.2s',
                  maxHeight: '75vh', overflowY: 'auto'
                }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '0.75rem', padding: '0.5rem 0.25rem',
                  borderBottom: `2px solid ${col.color}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>{col.icon}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>{col.label}</span>
                    <span style={{ padding: '0.1rem 0.45rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700, background: `${col.color}20`, color: col.color }}>{colOpps.length}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64808b' }}>{fmt(colTotal)} €</span>
                </div>
                {colOpps.map(opp => {
                  const tp = TYPE_CONFIG[opp.type] || TYPE_CONFIG.AT
                  const lastDays = daysSince(opp.last_contact_date)
                  const oppInts = getOppInteractions(opp.id)
                  const needsAction = lastDays === null || lastDays > 7
                  return (
                    <div key={opp.id} draggable onDragStart={(e) => handleDragStart(e, opp)}
                      style={{
                        ...card, padding: '0.85rem', marginBottom: '0.5rem',
                        cursor: 'grab', transition: 'all 0.15s',
                        borderLeft: needsAction && !['gagne', 'perdu'].includes(opp.status) ? '3px solid #f59e0b' : '1px solid rgba(212,175,55,0.12)',
                        opacity: draggedItem?.id === opp.id ? 0.4 : 1
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3 }}>{opp.name}</span>
                        <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 600, color: tp.color, background: `${tp.color}15`, flexShrink: 0, marginLeft: '0.3rem' }}>{tp.label}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#8ba5b0', marginBottom: '0.3rem' }}>🏢 {getContactName(opp.contact_id)}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#D4AF37' }}>{fmt(opp.montant)} €</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${opp.probabilite || 0}%`, height: '100%', borderRadius: '2px', background: (opp.probabilite || 0) >= 80 ? '#34d399' : (opp.probabilite || 0) >= 50 ? '#D4AF37' : '#f59e0b' }} />
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#64808b' }}>{opp.probabilite || 0}%</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: needsAction ? '#f59e0b' : '#4a6370', marginBottom: '0.4rem' }}>
                        {lastDays !== null ? (<>{needsAction ? '⚠️' : '✅'} Dernier contact : il y a {lastDays}j</>) : '📞 Aucun contact enregistré'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button onClick={(e) => { e.stopPropagation(); openInteractions(opp) }} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Historique">📞</button>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(opp) }} style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(opp.id) }} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                      </div>
                    </div>
                  )
                })}
                {colOpps.length === 0 && (
                  <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: '#3a5560', fontSize: '0.78rem' }}>Déposez une opportunité ici</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {view === 'table' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Nom', 'Client', 'Type', 'Statut', 'Montant', 'Proba', 'Dernier contact', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#64808b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {opportunites.map(opp => {
                  const col = COLUMNS.find(c => c.id === opp.status) || COLUMNS[0]
                  const tp = TYPE_CONFIG[opp.type] || TYPE_CONFIG.AT
                  const lastDays = daysSince(opp.last_contact_date)
                  const oppInts = getOppInteractions(opp.id)
                  return (
                    <tr key={opp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>{opp.name}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>{getContactName(opp.contact_id)}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, color: tp.color, background: `${tp.color}18` }}>{tp.label}</span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, color: col.color, background: `${col.color}18` }}>{col.icon} {col.label}</span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#D4AF37', fontWeight: 600 }}>{fmt(opp.montant)} €</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#8ba5b0', fontSize: '0.85rem' }}>{opp.probabilite || 0}%</td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: lastDays !== null && lastDays <= 7 ? '#34d399' : '#f59e0b' }}>
                        {lastDays !== null ? `il y a ${lastDays}j` : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => openInteractions(opp)} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📞</button>
                          <button onClick={() => openEdit(opp)} style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                          <button onClick={() => handleDelete(opp.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── OPPORTUNITY FORM MODAL ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
          <div style={{ ...card, width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>{editingOpp ? '✏️ Modifier' : '➕ Nouvelle opportunité'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Nom de la mission *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputStyle} placeholder="Ex: Expert COBOL - BNP Paribas" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Client</label>
                  <select value={formData.contact_id} onChange={e => setFormData({ ...formData, contact_id: e.target.value })} style={inputStyle}>
                    <option value="">— Sélectionner —</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} style={inputStyle}>
                    <option value="AT">Assistance Technique</option>
                    <option value="FORFAIT">Forfait</option>
                    <option value="REGIE">Régie</option>
                    <option value="CONSEIL">Conseil</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Statut</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={inputStyle}>
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Probabilité (%)</label>
                  <input type="number" min="0" max="100" value={formData.probabilite} onChange={e => setFormData({ ...formData, probabilite: Number(e.target.value) })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><label style={labelStyle}>TJM (€)</label><input type="number" min="0" value={formData.tjm} onChange={e => setFormData({ ...formData, tjm: Number(e.target.value) })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Nb jours</label><input type="number" min="0" value={formData.nb_jours} onChange={e => setFormData({ ...formData, nb_jours: Number(e.target.value) })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Montant (€)</label><input type="number" min="0" value={formData.tjm && formData.nb_jours ? formData.tjm * formData.nb_jours : formData.montant} onChange={e => setFormData({ ...formData, montant: Number(e.target.value) })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><label style={labelStyle}>Date de closing</label><input type="date" value={formData.closing_date} onChange={e => setFormData({ ...formData, closing_date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Freelance proposé</label><input type="text" value={formData.freelance_name} onChange={e => setFormData({ ...formData, freelance_name: e.target.value })} style={inputStyle} placeholder="Nom du freelance" /></div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Notes</label>
                <textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8ba5b0', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', color: '#122a33', padding: '0.6rem 1.8rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>{editingOpp ? 'Mettre à jour' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── INTERACTION HISTORY MODAL ── */}
      {showInteractionModal && selectedOpp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={() => setShowInteractionModal(false)}>
          <div style={{ ...card, width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>📞 Historique — {selectedOpp.name}</h3>
                <div style={{ fontSize: '0.78rem', color: '#64808b', marginTop: '0.2rem' }}>Client: {getContactName(selectedOpp.contact_id)}</div>
              </div>
              <button onClick={() => setShowInteractionModal(false)} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={addInteraction} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem' }}>➕ Nouvelle interaction</div>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {INTERACTION_TYPES.map(t => (
                  <button key={t.id} type="button" onClick={() => setInteractionForm({ ...interactionForm, type: t.id })} style={{
                    padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 600,
                    background: interactionForm.type === t.id ? `${t.color}20` : 'rgba(255,255,255,0.05)',
                    color: interactionForm.type === t.id ? t.color : '#64808b',
                    border: interactionForm.type === t.id ? `1px solid ${t.color}40` : '1px solid rgba(255,255,255,0.06)'
                  }}>{t.icon} {t.label}</button>
                ))}
              </div>
              <textarea rows={2} value={interactionForm.notes} onChange={e => setInteractionForm({ ...interactionForm, notes: e.target.value })}
                placeholder="Résumé de l'échange..." style={{ ...inputStyle, resize: 'vertical', marginBottom: '0.75rem' }} />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Prochaine action le</label>
                  <input type="date" value={interactionForm.next_action_date} onChange={e => setInteractionForm({ ...interactionForm, next_action_date: e.target.value })} style={inputStyle} />
                </div>
                <button type="submit" style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '8px', color: '#122a33', padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>💾 Enregistrer</button>
              </div>
            </form>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#8ba5b0', marginBottom: '0.75rem' }}>
              📋 Historique ({getOppInteractions(selectedOpp.id).length} interactions)
            </div>
            {getOppInteractions(selectedOpp.id).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#4a6370', fontSize: '0.85rem' }}>Aucune interaction enregistrée</div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                <div style={{ position: 'absolute', left: '8px', top: 0, bottom: 0, width: '2px', background: 'rgba(255,255,255,0.06)' }} />
                {getOppInteractions(selectedOpp.id).map((int, i) => {
                  const typeInfo = INTERACTION_TYPES.find(t => t.id === int.type) || INTERACTION_TYPES[4]
                  return (
                    <div key={int.id || i} style={{ position: 'relative', marginBottom: '1rem', paddingLeft: '1rem' }}>
                      <div style={{ position: 'absolute', left: '-1.5rem', top: '4px', width: '18px', height: '18px', borderRadius: '50%', background: `${typeInfo.color}20`, border: `2px solid ${typeInfo.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', zIndex: 1 }}>{typeInfo.icon}</div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: typeInfo.color }}>{typeInfo.icon} {typeInfo.label}</span>
                          <span style={{ fontSize: '0.68rem', color: '#4a6370' }}>{new Date(int.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {int.notes && <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>{int.notes}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', color: '#8ba5b0', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '0.03em', textTransform: 'uppercase' }
const inputStyle = { width: '100%', padding: '0.65rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }
