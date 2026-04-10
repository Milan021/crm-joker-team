import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import DossierCompetences from './DossierCompetences'

const STATUS_CONFIG = {
  disponible: { label: 'Disponible', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  en_mission: { label: 'En mission', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  indisponible: { label: 'Indisponible', color: '#f87171', bg: 'rgba(248,113,113,0.15)' }
}

function getAnciennete(createdAt) {
  if (!createdAt) return { label: 'Inconnu', badge: '—', color: '#64808b', bg: 'rgba(100,128,139,0.15)', days: 999 }
  const days = Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24))
  if (days <= 7) return { label: `${days}j`, badge: 'Nouveau', color: '#34d399', bg: 'rgba(52,211,153,0.15)', days }
  if (days <= 30) return { label: `${days}j`, badge: 'Récent', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', days }
  if (days <= 90) return { label: `${Math.floor(days / 30)}m`, badge: 'Ancien', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', days }
  return { label: `${Math.floor(days / 30)}m`, badge: 'Ancien', color: '#64808b', bg: 'rgba(100,128,139,0.15)', days }
}

export default function Candidats() {
  const [candidats, setCandidats] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCandidat, setEditingCandidat] = useState(null)
  const [dossierCandidat, setDossierCandidat] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', titre_poste: '', tjm: 0,
    status: 'disponible', competences: '', mots_cles: [],
    mission_end_date: '', recontact_date: '', mission_client: '', mission_notes: ''
  })
  const [newTag, setNewTag] = useState('')

  useEffect(() => { loadCandidats() }, [])

  async function loadCandidats() {
    try {
      const { data, error } = await supabase.from('candidats').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setCandidats(data || [])
    } catch (err) { console.error('Erreur:', err) }
    finally { setLoading(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        titre_poste: formData.titre_poste || null,
        tjm: Number(formData.tjm) || null,
        status: formData.status,
        competences: formData.competences || null,
        mots_cles: formData.mots_cles?.length ? formData.mots_cles : null,
        mission_end_date: formData.mission_end_date || null,
        recontact_date: formData.recontact_date || null,
        mission_client: formData.mission_client || null,
        mission_notes: formData.mission_notes || null,
        user_id: user?.id
      }
      if (editingCandidat) {
        const { user_id, ...upd } = payload
        const { error } = await supabase.from('candidats').update(upd).eq('id', editingCandidat.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('candidats').insert([payload])
        if (error) throw error
      }
      setShowModal(false); setEditingCandidat(null); resetForm(); loadCandidats()
    } catch (err) { alert(`Erreur: ${err.message}`) }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce candidat ?')) return
    try {
      const { error } = await supabase.from('candidats').delete().eq('id', id)
      if (error) throw error
      loadCandidats()
    } catch (err) { alert(`Erreur: ${err.message}`) }
  }

  async function handleCVUpload(candidatId, file) {
    if (!file) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${Date.now()}_${safeName}`

      const { error: uploadErr } = await supabase.storage.from('cvs').upload(path, file)
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('cvs').getPublicUrl(path)

      await supabase.from('candidats').update({
        cv_url: urlData.publicUrl,
        cv_filename: file.name,
        cv_uploaded_at: new Date().toISOString()
      }).eq('id', candidatId)

      try {
        const reader = new FileReader()
        const base64 = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result.split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        const resp = await fetch('/api/parse-cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64, fileType: file.type })
        })
        if (resp.ok) {
          const result = await resp.json()
          if (result.data && result.data.nom) {
            const parsed = result.data
            const keywords = []
            const comp = parsed.competences
            if (Array.isArray(comp)) keywords.push(...comp)
            else if (typeof comp === 'string') keywords.push(...comp.split(',').map(s => s.trim()).filter(Boolean))

            await supabase.from('candidats').update({
              titre_poste: parsed.titre || parsed.titre_poste || null,
              competences: Array.isArray(comp) ? comp.join(', ') : (comp || null),
              mots_cles: keywords.slice(0, 20),
              experience_annees: parsed.experience_annees || null,
              synthese: parsed.synthese || null
            }).eq('id', candidatId)

            alert(`✅ CV uploadé et analysé !\nCompétences: ${keywords.slice(0, 5).join(', ')}...`)
          } else {
            alert('✅ CV uploadé ! (parsing partiel)')
          }
        } else {
          alert('✅ CV uploadé ! (parsing indisponible)')
        }
      } catch { alert('✅ CV uploadé !') }

      loadCandidats()
    } catch (err) { alert(`Erreur upload: ${err.message}`) }
    finally { setUploading(false) }
  }

  function resetForm() {
    setFormData({ name: '', email: '', phone: '', titre_poste: '', tjm: 0, status: 'disponible', competences: '', mots_cles: [], mission_end_date: '', recontact_date: '', mission_client: '', mission_notes: '' })
    setNewTag('')
  }

  function openEdit(c) {
    setEditingCandidat(c)
    setFormData({
      name: c.name || '', email: c.email || '', phone: c.phone || '',
      titre_poste: c.titre_poste || '', tjm: c.tjm || 0, status: c.status || 'disponible',
      competences: c.competences || '', mots_cles: c.mots_cles || [],
      mission_end_date: c.mission_end_date || '', recontact_date: c.recontact_date || '',
      mission_client: c.mission_client || '', mission_notes: c.mission_notes || ''
    })
    setShowModal(true)
  }

  function openNew() { setEditingCandidat(null); resetForm(); setShowModal(true) }

  function addTag() {
    if (newTag.trim() && !formData.mots_cles.includes(newTag.trim())) {
      setFormData({ ...formData, mots_cles: [...formData.mots_cles, newTag.trim()] })
      setNewTag('')
    }
  }

  function removeTag(tag) {
    setFormData({ ...formData, mots_cles: formData.mots_cles.filter(t => t !== tag) })
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const now = new Date()
  const withAge = candidats.map(c => ({ ...c, _age: Math.floor((now - new Date(c.created_at)) / 86400000) }))

  const filtered = filter === 'all' ? withAge
    : filter === 'nouveau' ? withAge.filter(c => c._age <= 7)
    : filter === 'recent' ? withAge.filter(c => c._age > 7 && c._age <= 30)
    : withAge.filter(c => c._age > 30)

  const sorted = [...filtered].sort((a, b) => {
    let va, vb
    if (sortField === 'name') { va = a.name || ''; vb = b.name || '' }
    else if (sortField === 'created_at') { va = a._age; vb = b._age }
    else { va = a[sortField] || ''; vb = b[sortField] || '' }
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    return sortDir === 'asc' ? cmp : -cmp
  })

  const dispos = candidats.filter(c => c.status === 'disponible').length
  const enMission = candidats.filter(c => c.status === 'en_mission').length
  const nouveaux = withAge.filter(c => c._age <= 7).length
  const tjmMoyen = candidats.length ? Math.round(candidats.reduce((s, c) => s + (c.tjm || 0), 0) / candidats.filter(c => c.tjm).length || 0) : 0

  const today = new Date().toISOString().slice(0, 10)
  const missionEndingSoon = candidats.filter(c => {
    if (!c.mission_end_date) return false
    const diff = Math.floor((new Date(c.mission_end_date) - new Date()) / 86400000)
    return diff >= 0 && diff <= 14
  })
  const recontactDue = candidats.filter(c => {
    if (!c.recontact_date) return false
    return c.recontact_date <= today
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
      {/* ── ALERTS ── */}
      {(missionEndingSoon.length > 0 || recontactDue.length > 0) && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {missionEndingSoon.map(c => {
            const diff = Math.floor((new Date(c.mission_end_date) - new Date()) / 86400000)
            return (
              <div key={`me-${c.id}`} style={{
                ...card, padding: '1rem 1.5rem', borderLeft: `4px solid ${diff <= 3 ? '#f87171' : '#f59e0b'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>{diff <= 3 ? '🚨' : '⏰'}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>
                      {c.name} — Mission se termine {diff === 0 ? "aujourd'hui" : `dans ${diff} jour${diff > 1 ? 's' : ''}`}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64808b' }}>
                      {c.mission_client ? `Client: ${c.mission_client} · ` : ''}Fin: {new Date(c.mission_end_date).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
                <button onClick={() => openEdit(c)} style={{
                  background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
                  color: '#D4AF37', padding: '0.4rem 1rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
                }}>✏️ Gérer</button>
              </div>
            )
          })}
          {recontactDue.map(c => (
            <div key={`rc-${c.id}`} style={{
              ...card, padding: '1rem 1.5rem', borderLeft: '4px solid #a78bfa',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.3rem' }}>📞</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>
                    {c.name} — Recontact prévu pour aujourd'hui
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64808b' }}>
                    {c.titre_poste || 'Poste non renseigné'} · Date: {new Date(c.recontact_date).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
              <button onClick={() => openEdit(c)} style={{
                background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                color: '#a78bfa', padding: '0.4rem 1rem', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
              }}>📞 Contacter</button>
            </div>
          ))}
        </div>
      )}

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '👔', label: 'Total Candidats', value: candidats.length, accent: '#D4AF37' },
          { icon: '✅', label: 'Disponibles', value: dispos, accent: '#34d399' },
          { icon: '🚀', label: 'En mission', value: enMission, accent: '#60a5fa' },
          { icon: '🆕', label: 'Nouveaux (7j)', value: nouveaux, accent: '#a78bfa' },
          { icon: '💰', label: 'TJM Moyen', value: tjmMoyen ? `${tjmMoyen} €` : '—', accent: '#f59e0b' }
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1.25rem 1.5rem', borderTop: `3px solid ${s.accent}` }}>
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
            👔 Candidats <span style={{ fontSize: '0.9rem', color: '#8ba5b0', fontWeight: 400 }}>({sorted.length})</span>
          </h2>
          <button onClick={openNew} style={{
            background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '8px',
            color: '#122a33', padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
          }}>+ Nouveau candidat</button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `Tous (${candidats.length})` },
            { id: 'nouveau', label: `🆕 Nouveaux (${nouveaux})` },
            { id: 'recent', label: `📅 Récents (${withAge.filter(c => c._age > 7 && c._age <= 30).length})` },
            { id: 'ancien', label: `📦 Anciens (${withAge.filter(c => c._age > 30).length})` }
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
                <th onClick={() => toggleSort('name')} style={{ ...thStyle, cursor: 'pointer' }}>
                  Nom {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th style={thStyle}>Poste</th>
                <th style={thStyle}>Mots-clés</th>
                <th onClick={() => toggleSort('created_at')} style={{ ...thStyle, cursor: 'pointer' }}>
                  Ancienneté {sortField === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th style={thStyle}>CV</th>
                <th style={thStyle}>TJM</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64808b' }}>
                  Aucun candidat trouvé
                </td></tr>
              ) : sorted.map(c => {
                const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.disponible
                const anc = getAnciennete(c.created_at)
                const tags = c.mots_cles || []
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>
                      {c.name || '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.85rem', maxWidth: '200px' }}>
                      {c.titre_poste || '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {tags.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {tags.slice(0, 3).map((t, i) => (
                            <span key={i} style={{
                              padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem',
                              fontWeight: 600, background: 'rgba(212,175,55,0.12)', color: '#D4AF37',
                              border: '1px solid rgba(212,175,55,0.2)'
                            }}>{t}</span>
                          ))}
                          {tags.length > 3 && (
                            <span style={{ fontSize: '0.7rem', color: '#64808b', padding: '0.15rem 0.3rem' }}>
                              +{tags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : <span style={{ color: '#4a6370', fontSize: '0.8rem' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem',
                          fontWeight: 600, color: anc.color, background: anc.bg
                        }}>{anc.badge}</span>
                        <span style={{ color: '#64808b', fontSize: '0.75rem' }}>{anc.label}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {c.cv_url ? (
                        <a href={c.cv_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#60a5fa', fontSize: '1.1rem', textDecoration: 'none' }}
                          title={c.cv_filename || 'Télécharger CV'}>📎</a>
                      ) : (
                        <label style={{ cursor: uploading ? 'wait' : 'pointer', color: '#4a6370', fontSize: '1.1rem' }} title="Uploader un CV">
                          📄
                          <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                            onChange={e => handleCVUpload(c.id, e.target.files[0])} disabled={uploading} />
                        </label>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#D4AF37', fontWeight: 600, fontSize: '0.9rem' }}>
                      {c.tjm ? `${c.tjm} €` : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem',
                        fontWeight: 600, color: st.color, background: st.bg
                      }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {/* Dossier compétences */}
                        <button onClick={() => setDossierCandidat(c)} style={{
                          background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
                          color: '#D4AF37', width: '32px', height: '32px', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.85rem', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
                        }} title="Dossier de compétences">📄</button>
                        {/* Upload CV */}
                        <label style={{
                          background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
                          color: '#a78bfa', width: '32px', height: '32px', borderRadius: '6px',
                          cursor: uploading ? 'wait' : 'pointer', fontSize: '0.85rem', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
                        }} title="Charger CV">
                          📎
                          <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                            onChange={e => handleCVUpload(c.id, e.target.files[0])} disabled={uploading} />
                        </label>
                        {/* Edit */}
                        <button onClick={() => openEdit(c)} style={{
                          background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                          color: '#60a5fa', width: '32px', height: '32px', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.85rem', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
                        }}>✏️</button>
                        {/* Delete */}
                        <button onClick={() => handleDelete(c.id)} style={{
                          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                          color: '#f87171', width: '32px', height: '32px', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.85rem', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
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

      {/* ── MODAL FORMULAIRE ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)'
        }} onClick={() => setShowModal(false)}>
          <div style={{
            ...card, width: '100%', maxWidth: '560px', maxHeight: '90vh',
            overflowY: 'auto', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                {editingCandidat ? '✏️ Modifier le candidat' : '➕ Nouveau candidat'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{
                background: 'none', border: 'none', color: '#64808b', fontSize: '1.4rem', cursor: 'pointer'
              }}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Nom complet *</label>
                <input type="text" required value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input type="tel" value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Poste / Fonction</label>
                <input type="text" value={formData.titre_poste}
                  onChange={e => setFormData({ ...formData, titre_poste: e.target.value })}
                  style={inputStyle} placeholder="Ex: Consultant Mainframe Senior" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>TJM (€)</label>
                  <input type="number" min="0" value={formData.tjm}
                    onChange={e => setFormData({ ...formData, tjm: Number(e.target.value) })}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Statut</label>
                  <select value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={inputStyle}>
                    <option value="disponible">Disponible</option>
                    <option value="en_mission">En mission</option>
                    <option value="indisponible">Indisponible</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Compétences</label>
                <textarea rows={2} value={formData.competences}
                  onChange={e => setFormData({ ...formData, competences: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="COBOL, Mainframe, DB2, Java..." />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Mots-clés</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="text" value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Ajouter un mot-clé + Entrée" />
                  <button type="button" onClick={addTag} style={{
                    background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
                    color: '#D4AF37', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer',
                    fontWeight: 600, fontSize: '0.85rem'
                  }}>+</button>
                </div>
                {formData.mots_cles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {formData.mots_cles.map((tag, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem',
                        background: 'rgba(212,175,55,0.12)', color: '#D4AF37',
                        border: '1px solid rgba(212,175,55,0.2)'
                      }}>
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} style={{
                          background: 'none', border: 'none', color: '#D4AF37',
                          cursor: 'pointer', fontSize: '0.9rem', padding: 0, lineHeight: 1
                        }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {formData.status === 'en_mission' && (
                <div style={{
                  background: 'rgba(96,165,250,0.05)', borderRadius: '10px', padding: '1.25rem',
                  marginBottom: '1.5rem', border: '1px solid rgba(96,165,250,0.15)'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.75rem' }}>
                    🚀 Détails de la mission
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={labelStyle}>Client de la mission</label>
                    <input type="text" value={formData.mission_client}
                      onChange={e => setFormData({ ...formData, mission_client: e.target.value })}
                      style={inputStyle} placeholder="Ex: BNP Paribas, Société Générale..." />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={labelStyle}>📅 Fin de mission</label>
                      <input type="date" value={formData.mission_end_date}
                        onChange={e => setFormData({ ...formData, mission_end_date: e.target.value })}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>📞 Date de recontact</label>
                      <input type="date" value={formData.recontact_date}
                        onChange={e => setFormData({ ...formData, recontact_date: e.target.value })}
                        style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Notes mission</label>
                    <textarea rows={2} value={formData.mission_notes}
                      onChange={e => setFormData({ ...formData, mission_notes: e.target.value })}
                      style={{ ...inputStyle, resize: 'vertical' }}
                      placeholder="Infos sur la mission en cours..." />
                  </div>
                </div>
              )}

              {formData.status !== 'en_mission' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>📞 Date de recontact (rappel)</label>
                  <input type="date" value={formData.recontact_date}
                    onChange={e => setFormData({ ...formData, recontact_date: e.target.value })}
                    style={inputStyle} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#8ba5b0', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer'
                }}>Annuler</button>
                <button type="submit" style={{
                  background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none',
                  color: '#122a33', padding: '0.6rem 1.8rem', borderRadius: '8px',
                  fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
                }}>{editingCandidat ? 'Mettre à jour' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DOSSIER COMPÉTENCES MODAL ── */}
      {dossierCandidat && (
        <DossierCompetences candidat={dossierCandidat} onClose={() => setDossierCandidat(null)} />
      )}

      {/* ── UPLOAD OVERLAY ── */}
      {uploading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, color: '#D4AF37'
        }}>
          <div style={{ width: 50, height: 50, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>Upload et analyse du CV en cours...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}

const thStyle = {
  padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.72rem',
  fontWeight: 600, color: '#64808b', textTransform: 'uppercase', letterSpacing: '0.06em'
}

const labelStyle = {
  display: 'block', color: '#8ba5b0', fontSize: '0.78rem',
  fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '0.03em', textTransform: 'uppercase'
}

const inputStyle = {
  width: '100%', padding: '0.65rem 0.9rem',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
}
