import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const STATUS_CONFIG = {
  prospection: { label: 'Prospection', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  qualification: { label: 'Qualification', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  proposition: { label: 'Proposition', color: '#D4AF37', bg: 'rgba(212,175,55,0.15)' },
  negociation: { label: 'Négociation', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  gagne: { label: 'Gagné', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  perdu: { label: 'Perdu', color: '#f87171', bg: 'rgba(248,113,113,0.15)' }
}

const TYPE_CONFIG = {
  AT: { label: 'AT', color: '#60a5fa' },
  FORFAIT: { label: 'Forfait', color: '#a78bfa' },
  REGIE: { label: 'Régie', color: '#34d399' },
  CONSEIL: { label: 'Conseil', color: '#fbbf24' }
}

export default function Opportunites() {
  const [opportunites, setOpportunites] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOpp, setEditingOpp] = useState(null)
  const [filter, setFilter] = useState('all')
  const [formData, setFormData] = useState({
    name: '', contact_id: '', type: 'AT', status: 'prospection',
    probabilite: 10, tjm: 0, nb_jours: 0, montant: 0,
    closing_date: '', notes: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [oppResult, contactResult] = await Promise.all([
        supabase.from('opportunites').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('id, name')
      ])
      if (oppResult.data) setOpportunites(oppResult.data)
      if (contactResult.data) setContacts(contactResult.data)
    } catch (err) {
      console.error('Erreur chargement:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        ...formData,
        montant: Number(formData.tjm) * Number(formData.nb_jours) || Number(formData.montant),
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
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      alert(`Erreur: ${err.message}`)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette opportunité ?')) return
    try {
      const { error } = await supabase.from('opportunites').delete().eq('id', id)
      if (error) throw error
      loadData()
    } catch (err) { alert(`Erreur: ${err.message}`) }
  }

  function resetForm() {
    setFormData({ name: '', contact_id: '', type: 'AT', status: 'prospection', probabilite: 10, tjm: 0, nb_jours: 0, montant: 0, closing_date: '', notes: '' })
  }

  function openEdit(opp) {
    setEditingOpp(opp)
    setFormData({
      name: opp.name || '', contact_id: opp.contact_id || '', type: opp.type || 'AT',
      status: opp.status || 'prospection', probabilite: opp.probabilite || 10,
      tjm: opp.tjm || 0, nb_jours: opp.nb_jours || 0, montant: opp.montant || 0,
      closing_date: opp.closing_date || '', notes: opp.notes || ''
    })
    setShowModal(true)
  }

  function openNew() { setEditingOpp(null); resetForm(); setShowModal(true) }

  function getContactName(id) {
    const c = contacts.find(c => c.id === id)
    return c ? c.name : '—'
  }

  function fmt(n) {
    return new Intl.NumberFormat('fr-FR').format(n || 0)
  }

  // Computed
  const filtered = filter === 'all' ? opportunites : opportunites.filter(o => o.status === filter)
  const caGagne = opportunites.filter(o => o.status === 'gagne').reduce((s, o) => s + (o.montant || 0), 0)
  const pipeline = opportunites.filter(o => !['gagne', 'perdu'].includes(o.status)).reduce((s, o) => s + ((o.montant || 0) * (o.probabilite || 0) / 100), 0)
  const actives = opportunites.filter(o => !['gagne', 'perdu'].includes(o.status)).length

  // Card style (matching Dashboard)
  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)',
    color: '#e2e8f0'
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div>
      {/* ── STATS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {[
          { icon: '💰', label: 'CA Gagné', value: `${fmt(caGagne)} €`, accent: '#34d399' },
          { icon: '📊', label: 'Pipeline', value: `${fmt(Math.round(pipeline))} €`, accent: '#60a5fa' },
          { icon: '🎯', label: 'Actives', value: actives, accent: '#D4AF37' }
        ].map((s, i) => (
          <div key={i} style={{
            ...card,
            padding: '1.25rem 1.5rem',
            borderTop: `3px solid ${s.accent}`
          }}>
            <div style={{ fontSize: '0.8rem', color: '#8ba5b0', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>{s.icon}</span> {s.label}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── HEADER + FILTERS ── */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💼 Opportunités <span style={{ fontSize: '0.9rem', color: '#8ba5b0', fontWeight: 400 }}>({filtered.length})</span>
          </h2>
          <button onClick={openNew} style={{
            background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
            border: 'none', borderRadius: '8px', color: '#122a33',
            padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9rem',
            cursor: 'pointer', transition: 'opacity 0.2s'
          }}>+ Nouvelle opportunité</button>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Toutes' },
            ...Object.entries(STATUS_CONFIG).map(([id, cfg]) => ({ id, label: cfg.label }))
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
              border: filter === f.id ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)',
              color: filter === f.id ? '#D4AF37' : '#8ba5b0',
              padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.78rem',
              fontWeight: filter === f.id ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Nom', 'Client', 'Type', 'Statut', 'Montant', 'Proba', 'CA Prévu', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.72rem',
                    fontWeight: 600, color: '#64808b', textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64808b' }}>
                  Aucune opportunité trouvée
                </td></tr>
              ) : filtered.map((opp, idx) => {
                const st = STATUS_CONFIG[opp.status] || STATUS_CONFIG.prospection
                const tp = TYPE_CONFIG[opp.type] || TYPE_CONFIG.AT
                const caPrevu = Math.round((opp.montant || 0) * (opp.probabilite || 0) / 100)
                return (
                  <tr key={opp.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                    cursor: 'default'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>
                      {opp.name || '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                      {getContactName(opp.contact_id)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        display: 'inline-block', padding: '0.2rem 0.6rem',
                        borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                        color: tp.color, background: `${tp.color}18`, letterSpacing: '0.03em'
                      }}>{tp.label}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        display: 'inline-block', padding: '0.25rem 0.75rem',
                        borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                        color: st.color, background: st.bg
                      }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
                      {fmt(opp.montant)} €
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '48px', height: '6px', borderRadius: '3px',
                          background: 'rgba(255,255,255,0.08)', overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${opp.probabilite || 0}%`, height: '100%',
                            borderRadius: '3px',
                            background: (opp.probabilite || 0) >= 80 ? '#34d399'
                              : (opp.probabilite || 0) >= 50 ? '#D4AF37'
                              : '#f59e0b'
                          }} />
                        </div>
                        <span style={{ color: '#8ba5b0', fontSize: '0.8rem' }}>{opp.probabilite || 0}%</span>
                      </div>
                    </td>
                    <td style={{
                      padding: '0.85rem 1rem', fontWeight: 700, fontSize: '0.9rem',
                      color: opp.status === 'gagne' ? '#34d399' : '#D4AF37'
                    }}>
                      {fmt(caPrevu)} €
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => openEdit(opp)} style={{
                          background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                          color: '#60a5fa', width: '32px', height: '32px', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.85rem', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                        }}>✏️</button>
                        <button onClick={() => handleDelete(opp.id)} style={{
                          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                          color: '#f87171', width: '32px', height: '32px', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.85rem', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                        }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)'
        }} onClick={() => setShowModal(false)}>
          <div style={{
            ...card,
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
            padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                {editingOpp ? '✏️ Modifier' : '➕ Nouvelle opportunité'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{
                background: 'none', border: 'none', color: '#64808b',
                fontSize: '1.4rem', cursor: 'pointer'
              }}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Nom de l'opportunité *</label>
                <input type="text" required value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  style={inputStyle} />
              </div>

              {/* Client + Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Client</label>
                  <select value={formData.contact_id}
                    onChange={e => setFormData({...formData, contact_id: e.target.value})}
                    style={inputStyle}>
                    <option value="">— Sélectionner —</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    style={inputStyle}>
                    <option value="AT">Assistance Technique</option>
                    <option value="FORFAIT">Forfait</option>
                    <option value="REGIE">Régie</option>
                    <option value="CONSEIL">Conseil</option>
                  </select>
                </div>
              </div>

              {/* Status + Proba */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Statut</label>
                  <select value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    style={inputStyle}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Probabilité (%)</label>
                  <input type="number" min="0" max="100" value={formData.probabilite}
                    onChange={e => setFormData({...formData, probabilite: Number(e.target.value)})}
                    style={inputStyle} />
                </div>
              </div>

              {/* TJM + Jours + Montant */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>TJM (€)</label>
                  <input type="number" min="0" value={formData.tjm}
                    onChange={e => setFormData({...formData, tjm: Number(e.target.value)})}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nb jours</label>
                  <input type="number" min="0" value={formData.nb_jours}
                    onChange={e => setFormData({...formData, nb_jours: Number(e.target.value)})}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Montant (€)</label>
                  <input type="number" min="0"
                    value={formData.tjm && formData.nb_jours ? formData.tjm * formData.nb_jours : formData.montant}
                    onChange={e => setFormData({...formData, montant: Number(e.target.value)})}
                    style={inputStyle} />
                </div>
              </div>

              {/* Closing date */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Date de closing</label>
                <input type="date" value={formData.closing_date}
                  onChange={e => setFormData({...formData, closing_date: e.target.value})}
                  style={inputStyle} />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Notes</label>
                <textarea rows={3} value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  style={{...inputStyle, resize: 'vertical'}} />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#8ba5b0', padding: '0.6rem 1.4rem', borderRadius: '8px',
                  fontSize: '0.9rem', cursor: 'pointer'
                }}>Annuler</button>
                <button type="submit" style={{
                  background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
                  border: 'none', color: '#122a33', padding: '0.6rem 1.8rem',
                  borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
                }}>{editingOpp ? 'Mettre à jour' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared styles
const labelStyle = {
  display: 'block', color: '#8ba5b0', fontSize: '0.78rem',
  fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '0.03em',
  textTransform: 'uppercase'
}

const inputStyle = {
  width: '100%', padding: '0.65rem 0.9rem',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s'
}
