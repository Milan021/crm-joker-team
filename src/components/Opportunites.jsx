import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const COLUMNS = [
  { id: 'prospection', label: 'Prospection', icon: '🔍', color: '#94a3b8' },
  { id: 'qualification', label: 'Qualification', icon: '✅', color: '#60a5fa' },
  { id: 'proposition', label: 'Proposition', icon: '📄', color: '#D4AF37' },
  { id: 'negociation', label: 'Négociation', icon: '🤝', color: '#f59e0b' },
  { id: 'gagne', label: 'Gagné', icon: '🎉', color: '#34d399' },
  { id: 'archivee', label: 'Archivée', icon: '📦', color: '#94a3b8' },
  { id: 'perdu', label: 'Perdu', icon: '❌', color: '#f87171' }
]

const TYPE_CONFIG = {
  AT: { label: 'AT', color: '#60a5fa' },
  at: { label: 'AT', color: '#60a5fa' },
  FORFAIT: { label: 'Forfait', color: '#a78bfa' },
  forfait: { label: 'Forfait', color: '#a78bfa' },
  REGIE: { label: 'Régie', color: '#34d399' },
  regie: { label: 'Régie', color: '#34d399' },
  CONSEIL: { label: 'Conseil', color: '#fbbf24' },
  conseil: { label: 'Conseil', color: '#fbbf24' }
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
  const [facturations, setFacturations] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingOpp, setEditingOpp] = useState(null)
  const [selectedOpp, setSelectedOpp] = useState(null)
  const [showInteractionModal, setShowInteractionModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [showFacturationModal, setShowFacturationModal] = useState(false)
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [archiveData, setArchiveData] = useState({ ca_reel: 0, marge_reelle: 0, tjm_client: 0, tjm_freelance: 0, archive_notes: '' })
  const [factData, setFactData] = useState({ mois: '', montant_facture: 0, nb_jours: 0, tjm_applique: 0, mode: 'manuel', notes: '' })
  const [formData, setFormData] = useState({
    name: '', contact_id: '', type: 'AT', status: 'prospection',
    probabilite: 10, tjm: 0, nb_jours: 0, montant: 0,
    closing_date: '', notes: '', freelance_name: '',
    tjm_client: 0, tjm_freelance: 0, date_debut_mission: '', date_fin_mission: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [oppRes, contRes, candRes, intRes, factRes] = await Promise.all([
        supabase.from('opportunites').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('id, name'),
        supabase.from('candidats').select('id, name, tjm'),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }),
        supabase.from('facturations_mensuelles').select('*').order('mois', { ascending: true })
      ])
      if (oppRes.data) setOpportunites(oppRes.data)
      if (contRes.data) setContacts(contRes.data)
      if (candRes.data) setCandidats(candRes.data)
      if (intRes.data) setInteractions(intRes.data)
      if (factRes.data) setFacturations(factRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function fmt(n) { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0) }
  function getContactName(id) { const c = contacts.find(c => c.id === id); return c ? c.name : '—' }
  function getOppInteractions(oppId) { return interactions.filter(i => i.opportunite_id === oppId) }
  function getOppFacturations(oppId) { return facturations.filter(f => f.opportunite_id === oppId) }

  function daysSince(dateStr) {
    if (!dateStr) return null
    return Math.floor((new Date() - new Date(dateStr)) / 86400000)
  }

  // ——— Status update ———
  async function updateStatus(oppId, newStatus) {
    try {
      if (newStatus === 'archivee') {
        const opp = opportunites.find(o => o.id === oppId)
        setSelectedOpp(opp)
        const factOpp = getOppFacturations(oppId)
        const totalFacture = factOpp.reduce((s, f) => s + (f.montant_facture || 0), 0)
        const totalJours = factOpp.reduce((s, f) => s + (f.nb_jours || 0), 0)
        const margeJour = (opp.tjm_client || opp.tjm || 0) - (opp.tjm_freelance || 0)
        setArchiveData({
          ca_reel: totalFacture || opp.montant || 0,
          marge_reelle: margeJour * totalJours || 0,
          tjm_client: opp.tjm_client || opp.tjm || 0,
          tjm_freelance: opp.tjm_freelance || 0,
          archive_notes: ''
        })
        setShowArchiveModal(true)
        return
      }
      const prob = newStatus === 'gagne' ? 100 : newStatus === 'perdu' ? 0 : undefined
      const upd = { status: newStatus }
      if (prob !== undefined) upd.probabilite = prob
      await supabase.from('opportunites').update(upd).eq('id', oppId)
      setOpportunites(prev => prev.map(o => o.id === oppId ? { ...o, ...upd } : o))
    } catch (err) { console.error(err) }
  }

  // ——— Archive ———
  async function handleArchive() {
    if (!selectedOpp) return
    try {
      const { error } = await supabase.from('opportunites').update({
        status: 'archivee',
        probabilite: 100,
        ca_reel: Number(archiveData.ca_reel),
        marge_reelle: Number(archiveData.marge_reelle),
        tjm_client: Number(archiveData.tjm_client),
        tjm_freelance: Number(archiveData.tjm_freelance),
        archive_notes: archiveData.archive_notes,
        archived_at: new Date().toISOString()
      }).eq('id', selectedOpp.id)
      if (error) throw error
      setShowArchiveModal(false)
      loadData()
    } catch (err) { alert(`Erreur: ${err.message}`) }
  }

  // ——— Facturation mensuelle ———
  function openFacturation(opp) {
    setSelectedOpp(opp)
    const now = new Date()
    const moisDefault = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    setFactData({
      mois: moisDefault,
      montant_facture: 0,
      nb_jours: 0,
      tjm_applique: opp.tjm_client || opp.tjm || 0,
      mode: 'manuel',
      notes: ''
    })
    setShowFacturationModal(true)
  }

  async function handleFacturation() {
    if (!selectedOpp) return
    try {
      const montant = factData.mode === 'auto'
        ? Number(factData.tjm_applique) * Number(factData.nb_jours)
        : Number(factData.montant_facture)
      const { error } = await supabase.from('facturations_mensuelles').insert([{
        opportunite_id: selectedOpp.id,
        mois: factData.mois,
        montant_facture: montant,
        nb_jours: Number(factData.nb_jours),
        tjm_applique: Number(factData.tjm_applique),
        mode: factData.mode,
        notes: factData.notes
      }])
      if (error) throw error
      setShowFacturationModal(false)
      loadData()
    } catch (err) { alert(`Erreur: ${err.message}`) }
  }

  // ——— CRUD Opportunités ———
  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        ...formData,
        montant: Number(formData.tjm) * Number(formData.nb_jours) || Number(formData.montant),
        tjm_client: Number(formData.tjm_client) || Number(formData.tjm),
        tjm_freelance: Number(formData.tjm_freelance),
        user_id: user?.id
      }
      if (editingOpp) {
        const { user_id, ...updateData } = payload
        const { error } = await supabase.from('opportunites').update(updateData).eq('id', editingOpp.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('opportunites').insert([payload])
        if (error) throw error
      }
      setShowModal(false)
      setEditingOpp(null)
      resetForm()
      loadData()
    } catch (err) { alert(`Erreur: ${err.message}`) }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette opportunité ?')) return
    await supabase.from('opportunites').delete().eq('id', id)
    loadData()
  }

  function resetForm() {
    setFormData({ name: '', contact_id: '', type: 'AT', status: 'prospection', probabilite: 10, tjm: 0, nb_jours: 0, montant: 0, closing_date: '', notes: '', freelance_name: '', tjm_client: 0, tjm_freelance: 0, date_debut_mission: '', date_fin_mission: '' })
  }

  function openEdit(opp) {
    setEditingOpp(opp)
    setFormData({
      name: opp.name || '', contact_id: opp.contact_id || '', type: opp.type || 'AT',
      status: opp.status || 'prospection', probabilite: opp.probabilite || 10,
      tjm: opp.tjm || 0, nb_jours: opp.nb_jours || 0, montant: opp.montant || 0,
      closing_date: opp.closing_date || '', notes: opp.notes || '',
      freelance_name: opp.freelance_name || '',
      tjm_client: opp.tjm_client || opp.tjm || 0, tjm_freelance: opp.tjm_freelance || 0,
      date_debut_mission: opp.date_debut_mission || '', date_fin_mission: opp.date_fin_mission || ''
    })
    setShowModal(true)
  }

  function openNew() { setEditingOpp(null); resetForm(); setShowModal(true) }

  // ——— Interactions ———
  async function addInteraction(type, notes) {
    if (!selectedOpp) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('interactions').insert([{
        opportunite_id: selectedOpp.id,
        type,
        notes,
        created_by: user?.id
      }])
      await supabase.from('opportunites').update({ last_contact_date: new Date().toISOString().split('T')[0] }).eq('id', selectedOpp.id)
      loadData()
    } catch (err) { console.error(err) }
  }

  // ——— Drag & Drop ———
  function handleDragStart(e, opp) { setDraggedItem(opp); e.dataTransfer.effectAllowed = 'move' }
  function handleDragOver(e, colId) { e.preventDefault(); setDragOverCol(colId) }
  function handleDragLeave() { setDragOverCol(null) }
  function handleDrop(e, colId) {
    e.preventDefault(); setDragOverCol(null)
    if (draggedItem && draggedItem.status !== colId) updateStatus(draggedItem.id, colId)
    setDraggedItem(null)
  }

  // ——— Stats ———
  const caGagne = opportunites.filter(o => o.status === 'gagne').reduce((s, o) => s + (o.montant || 0), 0)
  const caArchive = opportunites.filter(o => o.status === 'archivee').reduce((s, o) => s + (o.ca_reel || 0), 0)
  const pipeline = opportunites.filter(o => !['gagne', 'perdu', 'archivee'].includes(o.status)).reduce((s, o) => s + ((o.montant || 0) * (o.probabilite || 0) / 100), 0)
  const actives = opportunites.filter(o => !['gagne', 'perdu', 'archivee'].includes(o.status))
  const margeTotal = opportunites.filter(o => o.status === 'archivee').reduce((s, o) => s + (o.marge_reelle || 0), 0)
  const totalFacture = facturations.reduce((s, f) => s + (f.montant_facture || 0), 0)

  // Filtered
  const filtered = filter === 'all' ? opportunites : opportunites.filter(o => o.status === filter)

  // Relance alerts
  const needsRelance = opportunites.filter(o => {
    if (['gagne', 'perdu', 'archivee'].includes(o.status)) return false
    const days = daysSince(o.last_contact_date || o.created_at)
    return days >= 7
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        <div style={{ color: '#64808b', fontSize: '0.85rem' }}>Chargement des opportunités...</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#e2e8f0', fontWeight: 700 }}>💼 Opportunités</h1>
          <div style={{ color: '#64808b', fontSize: '0.78rem', marginTop: '0.2rem' }}>
            {opportunites.length} affaire{opportunites.length > 1 ? 's' : ''} · Pipeline: {fmt(pipeline)}€ · CA Gagné: {fmt(caGagne)}€ · Archivé: {fmt(caArchive)}€
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setView(view === 'kanban' ? 'table' : 'kanban')} style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#8ba5b0' }}>
            {view === 'kanban' ? '📋 Tableau' : '📊 Kanban'}
          </button>
          <button onClick={openNew} style={{ ...btnStyle, background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
            + Nouvelle affaire
          </button>
        </div>
      </div>

      {/* Alerte relances */}
      {needsRelance.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 500 }}>
            {needsRelance.length} affaire{needsRelance.length > 1 ? 's' : ''} sans contact depuis 7+ jours
          </span>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {needsRelance.slice(0, 3).map(o => (
              <span key={o.id} style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                {o.name}
              </span>
            ))}
            {needsRelance.length > 3 && <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>+{needsRelance.length - 3}</span>}
          </div>
        </div>
      )}

      {/* Stats financières rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Pipeline', value: `${fmt(pipeline)}€`, color: '#60a5fa', icon: '📊' },
          { label: 'CA Gagné', value: `${fmt(caGagne)}€`, color: '#34d399', icon: '🎉' },
          { label: 'CA Archivé', value: `${fmt(caArchive)}€`, color: '#94a3b8', icon: '📦' },
          { label: 'Marge Archivée', value: `${fmt(margeTotal)}€`, color: '#D4AF37', icon: '📈' },
          { label: 'Facturé (mois)', value: `${fmt(totalFacture)}€`, color: '#a78bfa', icon: '🧾' },
          { label: 'Actives', value: actives.length, color: '#f59e0b', icon: '🔥' }
        ].map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.8rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#64808b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color, marginTop: '0.3rem' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Kanban View */}
      {view === 'kanban' ? (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {COLUMNS.map(col => {
            const colOpps = opportunites.filter(o => o.status === col.id)
            const colTotal = colOpps.reduce((s, o) => s + (col.id === 'archivee' ? (o.ca_reel || 0) : (o.montant || 0)), 0)
            return (
              <div key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                style={{
                  minWidth: '220px', flex: 1,
                  background: dragOverCol === col.id ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${dragOverCol === col.id ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '12px', padding: '0.8rem',
                  transition: 'all 0.2s ease'
                }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>{col.icon}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: col.color }}>{col.label}</span>
                    <span style={{ background: `${col.color}22`, color: col.color, padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700 }}>
                      {colOpps.length}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64808b' }}>{fmt(colTotal)}€</span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {colOpps.map(opp => {
                    const oppFacts = getOppFacturations(opp.id)
                    const totalFact = oppFacts.reduce((s, f) => s + (f.montant_facture || 0), 0)
                    const margeJour = (opp.tjm_client || 0) - (opp.tjm_freelance || 0)
                    return (
                      <div key={opp.id} draggable
                        onDragStart={(e) => handleDragStart(e, opp)}
                        style={{
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '10px', padding: '0.7rem', cursor: 'grab',
                          borderLeft: `3px solid ${col.color}`,
                          transition: 'transform 0.15s ease'
                        }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.3rem' }}>{opp.name}</div>
                        <div style={{ fontSize: '0.68rem', color: '#4a6370', marginBottom: '0.25rem' }}>
                          {getContactName(opp.contact_id)} {opp.freelance_name ? `· 👤 ${opp.freelance_name}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: col.color }}>
                            {col.id === 'archivee' ? fmt(opp.ca_reel || 0) : fmt(opp.montant || 0)}€
                          </span>
                          {opp.type && TYPE_CONFIG[opp.type] && (
                            <span style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', background: `${TYPE_CONFIG[opp.type].color}18`, color: TYPE_CONFIG[opp.type].color }}>
                              {TYPE_CONFIG[opp.type].label}
                            </span>
                          )}
                        </div>
                        {/* Financial info for gagne/archivee */}
                        {(opp.status === 'gagne' || opp.status === 'archivee') && (
                          <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            {opp.tjm_client > 0 && (
                              <div style={{ fontSize: '0.65rem', color: '#64808b' }}>
                                TJM: {fmt(opp.tjm_client)}€ client · {opp.tjm_freelance ? `${fmt(opp.tjm_freelance)}€ freelance` : '—'}
                                {margeJour > 0 && <span style={{ color: '#D4AF37' }}> · Marge/j: {fmt(margeJour)}€</span>}
                              </div>
                            )}
                            {opp.status === 'gagne' && totalFact > 0 && (
                              <div style={{ fontSize: '0.65rem', color: '#34d399', marginTop: '0.15rem' }}>
                                💰 Facturé: {fmt(totalFact)}€ / {fmt(opp.montant || 0)}€
                              </div>
                            )}
                            {opp.status === 'archivee' && opp.marge_reelle > 0 && (
                              <div style={{ fontSize: '0.65rem', color: '#D4AF37', marginTop: '0.15rem' }}>
                                📈 Marge: {fmt(opp.marge_reelle)}€
                              </div>
                            )}
                          </div>
                        )}
                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                          <button onClick={(e) => { e.stopPropagation(); openEdit(opp) }} style={cardBtnStyle}>✏️</button>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedOpp(opp); setShowInteractionModal(true) }} style={cardBtnStyle}>📞</button>
                          {opp.status === 'gagne' && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); openFacturation(opp) }} style={{ ...cardBtnStyle, background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }} title="Ajouter facturation mensuelle">🧾</button>
                              <button onClick={(e) => { e.stopPropagation(); updateStatus(opp.id, 'archivee') }} style={{ ...cardBtnStyle, background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }} title="Archiver">📦</button>
                            </>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(opp.id) }} style={{ ...cardBtnStyle, color: '#f87171' }}>🗑️</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Table View */
        <div style={{ overflowX: 'auto' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setFilter('all')} style={{ ...pillStyle, ...(filter === 'all' ? pillActive : {}) }}>Toutes ({opportunites.length})</button>
            {COLUMNS.map(col => {
              const count = opportunites.filter(o => o.status === col.id).length
              return (
                <button key={col.id} onClick={() => setFilter(col.id)} style={{ ...pillStyle, ...(filter === col.id ? { background: `${col.color}22`, color: col.color, borderColor: `${col.color}44` } : {}) }}>
                  {col.icon} {col.label} ({count})
                </button>
              )
            })}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Affaire', 'Client', 'Type', 'Statut', 'Montant', 'TJM C/F', 'Prob.', 'Facturé', 'Marge', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.6rem', textAlign: 'left', color: '#64808b', fontSize: '0.72rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(opp => {
                const col = COLUMNS.find(c => c.id === opp.status) || COLUMNS[0]
                const oppFacts = getOppFacturations(opp.id)
                const totalFact = opp.status === 'archivee' ? (opp.ca_reel || 0) : oppFacts.reduce((s, f) => s + (f.montant_facture || 0), 0)
                const margeJour = (opp.tjm_client || 0) - (opp.tjm_freelance || 0)
                const totalJours = oppFacts.reduce((s, f) => s + (f.nb_jours || 0), 0)
                const marge = opp.status === 'archivee' ? (opp.marge_reelle || 0) : (margeJour * totalJours)
                return (
                  <tr key={opp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.82rem' }}>{opp.name}</div>
                      {opp.freelance_name && <div style={{ fontSize: '0.68rem', color: '#4a6370' }}>👤 {opp.freelance_name}</div>}
                    </td>
                    <td style={tdStyle}><span style={{ color: '#8ba5b0', fontSize: '0.8rem' }}>{getContactName(opp.contact_id)}</span></td>
                    <td style={tdStyle}>
                      {opp.type && TYPE_CONFIG[opp.type] && (
                        <span style={{ padding: '0.15rem 0.4rem', borderRadius: '5px', fontSize: '0.7rem', background: `${TYPE_CONFIG[opp.type].color}18`, color: TYPE_CONFIG[opp.type].color }}>{TYPE_CONFIG[opp.type].label}</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', background: `${col.color}18`, color: col.color, fontWeight: 500 }}>{col.icon} {col.label}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#e2e8f0' }}>{fmt(opp.montant || 0)}€</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '0.75rem', color: '#8ba5b0' }}>
                        {opp.tjm_client ? `${fmt(opp.tjm_client)}` : '—'} / {opp.tjm_freelance ? `${fmt(opp.tjm_freelance)}` : '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '40px', height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${opp.probabilite || 0}%`, height: '100%', background: col.color, borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#8ba5b0' }}>{opp.probabilite || 0}%</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: '#34d399', fontWeight: 600 }}>{totalFact > 0 ? `${fmt(totalFact)}€` : '—'}</td>
                    <td style={{ ...tdStyle, color: '#D4AF37', fontWeight: 600 }}>{marge > 0 ? `${fmt(marge)}€` : '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => openEdit(opp)} style={cardBtnStyle}>✏️</button>
                        <button onClick={() => { setSelectedOpp(opp); setShowInteractionModal(true) }} style={cardBtnStyle}>📞</button>
                        {opp.status === 'gagne' && (
                          <>
                            <button onClick={() => openFacturation(opp)} style={{ ...cardBtnStyle, background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>🧾</button>
                            <button onClick={() => updateStatus(opp.id, 'archivee')} style={{ ...cardBtnStyle, background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>📦</button>
                          </>
                        )}
                        <button onClick={() => handleDelete(opp.id)} style={{ ...cardBtnStyle, color: '#f87171' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========== MODAL: Créer/Modifier Opportunité ========== */}
      {showModal && (
        <div style={overlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem' }}>{editingOpp ? '✏️ Modifier' : '➕ Nouvelle affaire'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nom de l'affaire</label>
                <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} placeholder="Ex: Mission COBOL BNP" />
              </div>
              <div>
                <label style={labelStyle}>Client (contact)</label>
                <select value={formData.contact_id} onChange={e => setFormData({...formData, contact_id: e.target.value})} style={inputStyle}>
                  <option value="">— Sélectionner —</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Freelance proposé</label>
                <input value={formData.freelance_name} onChange={e => setFormData({...formData, freelance_name: e.target.value})} style={inputStyle} placeholder="Nom du freelance" />
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} style={inputStyle}>
                  <option value="AT">AT</option>
                  <option value="REGIE">Régie</option>
                  <option value="FORFAIT">Forfait</option>
                  <option value="CONSEIL">Conseil</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Statut</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={inputStyle}>
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>TJM Client (€)</label>
                <input type="number" value={formData.tjm_client} onChange={e => setFormData({...formData, tjm_client: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TJM Freelance (€)</label>
                <input type="number" value={formData.tjm_freelance} onChange={e => setFormData({...formData, tjm_freelance: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TJM Affaire / Nb jours</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="number" value={formData.tjm} onChange={e => setFormData({...formData, tjm: e.target.value})} style={{ ...inputStyle, flex: 1 }} placeholder="TJM" />
                  <input type="number" value={formData.nb_jours} onChange={e => setFormData({...formData, nb_jours: e.target.value})} style={{ ...inputStyle, flex: 1 }} placeholder="Jours" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Montant total (€)</label>
                <input type="number" value={formData.montant || (formData.tjm * formData.nb_jours)} onChange={e => setFormData({...formData, montant: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Probabilité (%)</label>
                <input type="range" min="0" max="100" step="5" value={formData.probabilite} onChange={e => setFormData({...formData, probabilite: Number(e.target.value)})} style={{ width: '100%' }} />
                <div style={{ textAlign: 'center', color: '#8ba5b0', fontSize: '0.8rem' }}>{formData.probabilite}%</div>
              </div>
              <div>
                <label style={labelStyle}>Date début mission</label>
                <input type="date" value={formData.date_debut_mission} onChange={e => setFormData({...formData, date_debut_mission: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date fin mission</label>
                <input type="date" value={formData.date_fin_mission} onChange={e => setFormData({...formData, date_fin_mission: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date closing</label>
                <input type="date" value={formData.closing_date} onChange={e => setFormData({...formData, closing_date: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#8ba5b0' }}>Annuler</button>
              <button onClick={handleSubmit} style={{ ...btnStyle, background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
                {editingOpp ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: Archiver ========== */}
      {showArchiveModal && selectedOpp && (
        <div style={overlayStyle} onClick={() => setShowArchiveModal(false)}>
          <div style={{ ...modalStyle, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem' }}>📦 Archiver l'affaire</h3>
              <button onClick={() => setShowArchiveModal(false)} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '8px', padding: '0.8rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem' }}>{selectedOpp.name}</div>
              <div style={{ color: '#64808b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                Montant initial: {fmt(selectedOpp.montant)}€ · {selectedOpp.freelance_name || 'Pas de freelance'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>TJM Client (€)</label>
                <input type="number" value={archiveData.tjm_client} onChange={e => setArchiveData({...archiveData, tjm_client: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TJM Freelance (€)</label>
                <input type="number" value={archiveData.tjm_freelance} onChange={e => {
                  const tjmF = Number(e.target.value)
                  const margeAuto = (Number(archiveData.tjm_client) - tjmF) * (selectedOpp.nb_jours || 0)
                  setArchiveData({...archiveData, tjm_freelance: e.target.value, marge_reelle: margeAuto > 0 ? margeAuto : archiveData.marge_reelle})
                }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>CA Réel Encaissé (€)</label>
                <input type="number" value={archiveData.ca_reel} onChange={e => setArchiveData({...archiveData, ca_reel: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Marge Réelle (€)</label>
                <input type="number" value={archiveData.marge_reelle} onChange={e => setArchiveData({...archiveData, marge_reelle: e.target.value})} style={inputStyle} />
                <div style={{ fontSize: '0.65rem', color: '#D4AF37', marginTop: '0.2rem' }}>
                  Auto: ({fmt(archiveData.tjm_client)} - {fmt(archiveData.tjm_freelance)}) × {selectedOpp.nb_jours || '?'}j = {fmt((Number(archiveData.tjm_client) - Number(archiveData.tjm_freelance)) * (selectedOpp.nb_jours || 0))}€
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes d'archivage</label>
                <textarea value={archiveData.archive_notes} onChange={e => setArchiveData({...archiveData, archive_notes: e.target.value})} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} placeholder="Ex: Mission terminée avec succès, client satisfait..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowArchiveModal(false)} style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#8ba5b0' }}>Annuler</button>
              <button onClick={handleArchive} style={{ ...btnStyle, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)' }}>
                📦 Archiver cette affaire
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: Facturation Mensuelle ========== */}
      {showFacturationModal && selectedOpp && (
        <div style={overlayStyle} onClick={() => setShowFacturationModal(false)}>
          <div style={{ ...modalStyle, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem' }}>🧾 Facturation mensuelle</h3>
              <button onClick={() => setShowFacturationModal(false)} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '8px', padding: '0.8rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem' }}>{selectedOpp.name}</div>
              <div style={{ color: '#64808b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                Montant total: {fmt(selectedOpp.montant)}€ · TJM Client: {fmt(selectedOpp.tjm_client || selectedOpp.tjm)}€
              </div>
              {/* Existant */}
              {(() => {
                const existing = getOppFacturations(selectedOpp.id)
                const totalExisting = existing.reduce((s, f) => s + (f.montant_facture || 0), 0)
                const reste = (selectedOpp.montant || 0) - totalExisting
                return existing.length > 0 ? (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#34d399' }}>
                    Déjà facturé: {fmt(totalExisting)}€ · Reste: {fmt(reste)}€ ({existing.length} mois)
                  </div>
                ) : null
              })()}
            </div>

            {/* Mode switch */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {[{ id: 'manuel', label: '✍️ Saisie manuelle' }, { id: 'auto', label: '🔄 Calcul auto (TJM × jours)' }].map(m => (
                <button key={m.id} onClick={() => setFactData({...factData, mode: m.id})}
                  style={{
                    ...btnStyle, flex: 1,
                    background: factData.mode === m.id ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                    color: factData.mode === m.id ? '#D4AF37' : '#64808b',
                    border: `1px solid ${factData.mode === m.id ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.06)'}`
                  }}>{m.label}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Mois</label>
                <input type="month" value={factData.mois ? factData.mois.substring(0, 7) : ''} onChange={e => setFactData({...factData, mois: e.target.value + '-01'})} style={inputStyle} />
              </div>
              {factData.mode === 'manuel' ? (
                <>
                  <div>
                    <label style={labelStyle}>Montant facturé (€)</label>
                    <input type="number" value={factData.montant_facture} onChange={e => setFactData({...factData, montant_facture: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Nb jours travaillés</label>
                    <input type="number" value={factData.nb_jours} onChange={e => setFactData({...factData, nb_jours: e.target.value})} style={inputStyle} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={labelStyle}>TJM appliqué (€)</label>
                    <input type="number" value={factData.tjm_applique} onChange={e => setFactData({...factData, tjm_applique: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Nb jours travaillés</label>
                    <input type="number" value={factData.nb_jours} onChange={e => setFactData({...factData, nb_jours: e.target.value})} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1', background: 'rgba(52,211,153,0.06)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                    <span style={{ color: '#64808b', fontSize: '0.75rem' }}>Montant calculé: </span>
                    <span style={{ color: '#34d399', fontWeight: 700, fontSize: '1.1rem' }}>{fmt(Number(factData.tjm_applique) * Number(factData.nb_jours))}€</span>
                    <div style={{ color: '#D4AF37', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                      Marge: {fmt((Number(factData.tjm_applique) - (selectedOpp.tjm_freelance || 0)) * Number(factData.nb_jours))}€
                    </div>
                  </div>
                </>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <input value={factData.notes} onChange={e => setFactData({...factData, notes: e.target.value})} style={inputStyle} placeholder="Ex: Mois complet, 22 jours ouvrés" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowFacturationModal(false)} style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#8ba5b0' }}>Annuler</button>
              <button onClick={handleFacturation} style={{ ...btnStyle, background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                🧾 Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: Interactions ========== */}
      {showInteractionModal && selectedOpp && (
        <div style={overlayStyle} onClick={() => setShowInteractionModal(false)}>
          <div style={{ ...modalStyle, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem' }}>📞 Interactions — {selectedOpp.name}</h3>
              <button onClick={() => setShowInteractionModal(false)} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            {/* Quick add */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {INTERACTION_TYPES.map(t => (
                <button key={t.id} onClick={() => {
                  const notes = prompt(`Notes pour ${t.label} :`)
                  if (notes !== null) addInteraction(t.id, notes)
                }} style={{ ...btnStyle, background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30`, fontSize: '0.75rem' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {/* Timeline */}
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {getOppInteractions(selectedOpp.id).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#4a6370', padding: '1.5rem', fontSize: '0.82rem' }}>Aucune interaction enregistrée</div>
              ) : getOppInteractions(selectedOpp.id).map(int => {
                const type = INTERACTION_TYPES.find(t => t.id === int.type) || INTERACTION_TYPES[4]
                return (
                  <div key={int.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${type.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>{type.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 500 }}>{type.label}</div>
                      {int.notes && <div style={{ fontSize: '0.72rem', color: '#64808b', marginTop: '0.1rem' }}>{int.notes}</div>}
                      <div style={{ fontSize: '0.65rem', color: '#3a5560', marginTop: '0.15rem' }}>{new Date(int.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

// Styles
const btnStyle = { padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, transition: 'all 0.15s ease' }
const cardBtnStyle = { padding: '0.25rem 0.4rem', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: '0.7rem', transition: 'all 0.15s ease' }
const pillStyle = { padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#64808b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }
const pillActive = { background: 'rgba(212,175,55,0.15)', color: '#D4AF37', borderColor: 'rgba(212,175,55,0.3)' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }
const modalStyle = { background: '#0f2028', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }
const labelStyle = { display: 'block', color: '#8ba5b0', fontSize: '0.72rem', fontWeight: 500, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }
const inputStyle = { width: '100%', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }
const tdStyle = { padding: '0.6rem', fontSize: '0.8rem' }
