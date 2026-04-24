import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const STATUS_CONFIG = {
  disponible: { label: 'Disponible', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  en_mission: { label: 'En mission', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  indisponible: { label: 'Indisponible', color: '#f87171', bg: 'rgba(248,113,113,0.15)' }
}

const PIPELINE_CONFIG = {
  identifie: { label: 'Identifie', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: '🔍' },
  propose: { label: 'Propose', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', icon: '📤' },
  presente: { label: 'Presente', color: '#D4AF37', bg: 'rgba(212,175,55,0.15)', icon: '🤝' },
  entretien: { label: 'Entretien', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: '💬' },
  retenu: { label: 'Retenu', color: '#34d399', bg: 'rgba(52,211,153,0.15)', icon: '✅' },
  place: { label: 'Place', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🚀' },
  refuse: { label: 'Refuse', color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: '❌' }
}

export default function Candidats() {
  const [candidats, setCandidats] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCandidat, setEditingCandidat] = useState(null)
  const [selectedCandidat, setSelectedCandidat] = useState(null)
  const [filter, setFilter] = useState('all')
  const [pipelineFilter, setPipelineFilter] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', titre_poste: '', tjm: 0,
    status: 'disponible', competences: '', mots_cles: [],
    mission_end_date: '', recontact_date: '', mission_client: '', mission_notes: '',
    pipeline_status: 'identifie', proposed_to: '', proposed_date: '',
    presented_date: '', interview_date: '', interview_notes: '',
    tjm_propose: '', tjm_client: '', notes_detaillees: '', disponibilite_date: ''
  })

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
        name: formData.name, email: formData.email || null, phone: formData.phone || null,
        titre_poste: formData.titre_poste || null, tjm: Number(formData.tjm) || null,
        status: formData.status, competences: formData.competences || null,
        mots_cles: formData.mots_cles?.length ? formData.mots_cles : null,
        mission_end_date: formData.mission_end_date || null, recontact_date: formData.recontact_date || null,
        mission_client: formData.mission_client || null, mission_notes: formData.mission_notes || null,
        pipeline_status: formData.pipeline_status || 'identifie',
        proposed_to: formData.proposed_to || null, proposed_date: formData.proposed_date || null,
        presented_date: formData.presented_date || null, interview_date: formData.interview_date || null,
        interview_notes: formData.interview_notes || null,
        tjm_propose: Number(formData.tjm_propose) || null, tjm_client: Number(formData.tjm_client) || null,
        notes_detaillees: formData.notes_detaillees || null, disponibilite_date: formData.disponibilite_date || null,
        user_id: user?.id
      }
      if (editingCandidat) {
        const { user_id, ...upd } = payload
        await supabase.from('candidats').update(upd).eq('id', editingCandidat.id)
      } else {
        await supabase.from('candidats').insert([payload])
      }
      setShowModal(false); setEditingCandidat(null); resetForm(); loadCandidats()
    } catch (err) { alert('Erreur: ' + err.message) }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce candidat ?')) return
    await supabase.from('candidats').delete().eq('id', id)
    if (selectedCandidat?.id === id) setSelectedCandidat(null)
    loadCandidats()
  }

  async function quickUpdatePipeline(id, newStatus) {
    await supabase.from('candidats').update({ pipeline_status: newStatus }).eq('id', id)
    loadCandidats()
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
      await supabase.from('candidats').update({ cv_url: urlData.publicUrl, cv_filename: file.name, cv_uploaded_at: new Date().toISOString() }).eq('id', candidatId)
      try {
        const reader = new FileReader()
        const base64 = await new Promise((res, rej) => { reader.onload = () => res(reader.result.split(',')[1]); reader.onerror = rej; reader.readAsDataURL(file) })
        const resp = await fetch('/api/parse-cv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileData: base64, fileType: file.type }) })
        if (resp.ok) {
          const result = await resp.json()
          if (result.data?.nom) {
            const parsed = result.data
            const keywords = []
            const comp = parsed.competences
            if (Array.isArray(comp)) keywords.push(...comp)
            else if (typeof comp === 'string') keywords.push(...comp.split(',').map(s => s.trim()).filter(Boolean))
            await supabase.from('candidats').update({ titre_poste: parsed.titre || parsed.titre_poste || null, competences: Array.isArray(comp) ? comp.join(', ') : (comp || null), mots_cles: keywords.slice(0, 20) }).eq('id', candidatId)
            alert('CV uploade et analyse !')
          } else { alert('CV uploade ! (parsing partiel)') }
        } else { alert('CV uploade !') }
      } catch { alert('CV uploade !') }
      loadCandidats()
    } catch (err) { alert('Erreur upload: ' + err.message) }
    finally { setUploading(false) }
  }

  function resetForm() {
    setFormData({ name: '', email: '', phone: '', titre_poste: '', tjm: 0, status: 'disponible', competences: '', mots_cles: [], mission_end_date: '', recontact_date: '', mission_client: '', mission_notes: '', pipeline_status: 'identifie', proposed_to: '', proposed_date: '', presented_date: '', interview_date: '', interview_notes: '', tjm_propose: '', tjm_client: '', notes_detaillees: '', disponibilite_date: '' })
    setNewTag('')
  }

  function openEdit(c) {
    setEditingCandidat(c)
    setFormData({
      name: c.name || '', email: c.email || '', phone: c.phone || '', titre_poste: c.titre_poste || '',
      tjm: c.tjm || 0, status: c.status || 'disponible', competences: c.competences || '',
      mots_cles: c.mots_cles || [], mission_end_date: c.mission_end_date || '', recontact_date: c.recontact_date || '',
      mission_client: c.mission_client || '', mission_notes: c.mission_notes || '',
      pipeline_status: c.pipeline_status || 'identifie', proposed_to: c.proposed_to || '',
      proposed_date: c.proposed_date || '', presented_date: c.presented_date || '',
      interview_date: c.interview_date || '', interview_notes: c.interview_notes || '',
      tjm_propose: c.tjm_propose || '', tjm_client: c.tjm_client || '',
      notes_detaillees: c.notes_detaillees || '', disponibilite_date: c.disponibilite_date || ''
    })
    setShowModal(true)
  }

  function addTag() {
    if (newTag.trim() && !formData.mots_cles.includes(newTag.trim())) {
      setFormData({ ...formData, mots_cles: [...formData.mots_cles, newTag.trim()] })
      setNewTag('')
    }
  }

  function removeTag(tag) { setFormData({ ...formData, mots_cles: formData.mots_cles.filter(t => t !== tag) }) }

  // Filters
  const filtered = candidats.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    if (pipelineFilter !== 'all' && c.pipeline_status !== pipelineFilter) return false
    return true
  })

  // Stats
  const dispos = candidats.filter(c => c.status === 'disponible').length
  const enMission = candidats.filter(c => c.status === 'en_mission').length
  const proposes = candidats.filter(c => c.pipeline_status === 'propose').length
  const presentes = candidats.filter(c => c.pipeline_status === 'presente').length
  const tjmMoyen = candidats.filter(c => c.tjm).length > 0 ? Math.round(candidats.filter(c => c.tjm).reduce((s, c) => s + c.tjm, 0) / candidats.filter(c => c.tjm).length) : 0

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
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '👔', label: 'Total', value: candidats.length, accent: '#D4AF37' },
          { icon: '✅', label: 'Disponibles', value: dispos, accent: '#34d399' },
          { icon: '🚀', label: 'En mission', value: enMission, accent: '#60a5fa' },
          { icon: '📤', label: 'Proposes', value: proposes, accent: '#a78bfa' },
          { icon: '🤝', label: 'Presentes', value: presentes, accent: '#f59e0b' },
          { icon: '💰', label: 'TJM moyen', value: tjmMoyen ? tjmMoyen + '€' : '—', accent: '#D4AF37' }
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1rem 1.25rem', borderTop: `3px solid ${s.accent}` }}>
            <div style={{ fontSize: '0.75rem', color: '#8ba5b0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span>{s.icon}</span> {s.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Header + Filters */}
      <div style={{ ...card, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0 }}>👔 Candidats ({filtered.length})</h2>
          <button onClick={() => { setEditingCandidat(null); resetForm(); setShowModal(true) }} style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '8px', color: '#122a33', padding: '0.5rem 1.2rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>+ Nouveau candidat</button>
        </div>
        {/* Status filter */}
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {[{ id: 'all', label: 'Tous' }, { id: 'disponible', label: '✅ Dispo' }, { id: 'en_mission', label: '🚀 Mission' }, { id: 'indisponible', label: '❌ Indispo' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
              border: filter === f.id ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)',
              color: filter === f.id ? '#D4AF37' : '#8ba5b0',
              padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: filter === f.id ? 600 : 400
            }}>{f.label}</button>
          ))}
        </div>
        {/* Pipeline filter */}
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'Pipeline: Tous' }, ...Object.entries(PIPELINE_CONFIG).map(([k, v]) => ({ id: k, label: v.icon + ' ' + v.label }))].map(f => (
            <button key={f.id} onClick={() => setPipelineFilter(f.id)} style={{
              background: pipelineFilter === f.id ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
              border: pipelineFilter === f.id ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
              color: pipelineFilter === f.id ? '#60a5fa' : '#64808b',
              padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: pipelineFilter === f.id ? 600 : 400
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedCandidat ? '1fr 380px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Nom', 'Poste', 'Pipeline', 'TJM', 'Statut', 'Client', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.8rem 0.8rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#64808b', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64808b' }}>Aucun candidat</td></tr>
                ) : filtered.map(c => {
                  const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.disponible
                  const pl = PIPELINE_CONFIG[c.pipeline_status] || PIPELINE_CONFIG.identifie
                  const isSelected = selectedCandidat?.id === c.id
                  return (
                    <tr key={c.id} onClick={() => setSelectedCandidat(isSelected ? null : c)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(212,175,55,0.08)' : 'transparent', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(212,175,55,0.04)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '0.7rem 0.8rem', fontWeight: 600, color: '#f1f5f9', fontSize: '0.88rem' }}>{c.name}</td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#94a3b8', fontSize: '0.82rem' }}>{c.titre_poste || '—'}</td>
                      <td style={{ padding: '0.7rem 0.8rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: pl.color, background: pl.bg }}>{pl.icon} {pl.label}</span>
                      </td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#D4AF37', fontWeight: 600, fontSize: '0.85rem' }}>
                        {c.tjm ? c.tjm + '€' : '—'}
                        {c.tjm_client ? <div style={{ fontSize: '0.65rem', color: '#34d399' }}>Client: {c.tjm_client}€</div> : null}
                      </td>
                      <td style={{ padding: '0.7rem 0.8rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, color: st.color, background: st.bg }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#8ba5b0', fontSize: '0.8rem' }}>{c.proposed_to || c.mission_client || '—'}</td>
                      <td style={{ padding: '0.7rem 0.8rem' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <label style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa', width: '28px', height: '28px', borderRadius: '6px', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Charger CV">
                            📎<input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleCVUpload(c.id, e.target.files[0])} disabled={uploading} />
                          </label>
                          <button onClick={() => openEdit(c)} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                          <button onClick={() => handleDelete(c.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selectedCandidat && (
          <div style={{ ...card, padding: '1.5rem', position: 'sticky', top: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{selectedCandidat.name}</div>
                <div style={{ fontSize: '0.82rem', color: '#8ba5b0' }}>{selectedCandidat.titre_poste || 'Poste non renseigne'}</div>
              </div>
              <button onClick={() => setSelectedCandidat(null)} style={{ background: 'none', border: 'none', color: '#4a6370', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Pipeline quick actions */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Pipeline</div>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {Object.entries(PIPELINE_CONFIG).map(([k, v]) => (
                  <button key={k} onClick={() => { quickUpdatePipeline(selectedCandidat.id, k); setSelectedCandidat(prev => ({ ...prev, pipeline_status: k })) }} style={{
                    padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', cursor: 'pointer', border: 'none',
                    background: selectedCandidat.pipeline_status === k ? v.bg : 'rgba(255,255,255,0.03)',
                    color: selectedCandidat.pipeline_status === k ? v.color : '#4a6370',
                    fontWeight: selectedCandidat.pipeline_status === k ? 700 : 400
                  }}>{v.icon} {v.label}</button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              {selectedCandidat.email && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📧 {selectedCandidat.email}</div>}
              {selectedCandidat.phone && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📞 {selectedCandidat.phone}</div>}
              <div style={{ display: 'flex', gap: '1rem' }}>
                {selectedCandidat.tjm && <div style={{ fontSize: '0.8rem' }}><span style={{ color: '#4a6370' }}>TJM:</span> <span style={{ color: '#D4AF37', fontWeight: 600 }}>{selectedCandidat.tjm}€</span></div>}
                {selectedCandidat.tjm_propose && <div style={{ fontSize: '0.8rem' }}><span style={{ color: '#4a6370' }}>Propose:</span> <span style={{ color: '#60a5fa', fontWeight: 600 }}>{selectedCandidat.tjm_propose}€</span></div>}
                {selectedCandidat.tjm_client && <div style={{ fontSize: '0.8rem' }}><span style={{ color: '#4a6370' }}>Client:</span> <span style={{ color: '#34d399', fontWeight: 600 }}>{selectedCandidat.tjm_client}€</span></div>}
              </div>
              {selectedCandidat.proposed_to && <div style={{ fontSize: '0.8rem', color: '#8ba5b0' }}>🏢 Propose a: {selectedCandidat.proposed_to}</div>}
              {selectedCandidat.cv_url && <a href={selectedCandidat.cv_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#60a5fa', textDecoration: 'none' }}>📎 Voir le CV</a>}
            </div>

            {/* Dates */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>📅 Dates</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', color: '#8ba5b0' }}>
                {selectedCandidat.proposed_date && <div>📤 Propose le: {new Date(selectedCandidat.proposed_date).toLocaleDateString('fr-FR')}</div>}
                {selectedCandidat.presented_date && <div>🤝 Presente le: {new Date(selectedCandidat.presented_date).toLocaleDateString('fr-FR')}</div>}
                {selectedCandidat.interview_date && <div>💬 Entretien le: {new Date(selectedCandidat.interview_date).toLocaleDateString('fr-FR')}</div>}
                {selectedCandidat.disponibilite_date && <div>📆 Disponible le: {new Date(selectedCandidat.disponibilite_date).toLocaleDateString('fr-FR')}</div>}
                {selectedCandidat.mission_end_date && <div>🏁 Fin mission: {new Date(selectedCandidat.mission_end_date).toLocaleDateString('fr-FR')}</div>}
                {selectedCandidat.recontact_date && <div>📞 Recontact: {new Date(selectedCandidat.recontact_date).toLocaleDateString('fr-FR')}</div>}
              </div>
            </div>

            {/* Mots-cles */}
            {selectedCandidat.mots_cles?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Competences</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                  {selectedCandidat.mots_cles.map((t, i) => (
                    <span key={i} style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {(selectedCandidat.notes_detaillees || selectedCandidat.interview_notes) && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#a78bfa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>📝 Notes</div>
                {selectedCandidat.notes_detaillees && <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem', whiteSpace: 'pre-wrap' }}>{selectedCandidat.notes_detaillees}</div>}
                {selectedCandidat.interview_notes && <div style={{ fontSize: '0.78rem', color: '#8ba5b0', fontStyle: 'italic', padding: '0.4rem', background: 'rgba(167,139,250,0.05)', borderRadius: '6px', borderLeft: '3px solid rgba(167,139,250,0.3)' }}>💬 {selectedCandidat.interview_notes}</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => openEdit(selectedCandidat)} style={{ flex: 1, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>✏️ Modifier</button>
              <button onClick={() => handleDelete(selectedCandidat.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>🗑️</button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
          <div style={{ ...card, width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>{editingCandidat ? '✏️ Modifier' : '➕ Nouveau candidat'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.4rem', cursor: 'pointer' }}>x</button>
            </div>
            <form onSubmit={handleSubmit}>
              {/* Nom */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Nom complet *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputStyle} />
              </div>
              {/* Email + Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div><label style={labelStyle}>Email</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Telephone</label><input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={inputStyle} /></div>
              </div>
              {/* Poste */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Poste / Fonction</label>
                <input type="text" value={formData.titre_poste} onChange={e => setFormData({ ...formData, titre_poste: e.target.value })} style={inputStyle} placeholder="Ex: Consultant Java Senior" />
              </div>
              {/* TJM + Status + Pipeline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div><label style={labelStyle}>TJM (€)</label><input type="number" min="0" value={formData.tjm} onChange={e => setFormData({ ...formData, tjm: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Statut</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={inputStyle}>
                    <option value="disponible">Disponible</option><option value="en_mission">En mission</option><option value="indisponible">Indisponible</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Pipeline</label>
                  <select value={formData.pipeline_status} onChange={e => setFormData({ ...formData, pipeline_status: e.target.value })} style={inputStyle}>
                    {Object.entries(PIPELINE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
              </div>
              {/* TJM propose + TJM client + Propose a */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div><label style={labelStyle}>TJM propose (€)</label><input type="number" min="0" value={formData.tjm_propose} onChange={e => setFormData({ ...formData, tjm_propose: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>TJM client (€)</label><input type="number" min="0" value={formData.tjm_client} onChange={e => setFormData({ ...formData, tjm_client: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Propose a</label><input type="text" value={formData.proposed_to} onChange={e => setFormData({ ...formData, proposed_to: e.target.value })} style={inputStyle} placeholder="Nom du client" /></div>
              </div>
              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div><label style={labelStyle}>📤 Date proposition</label><input type="date" value={formData.proposed_date} onChange={e => setFormData({ ...formData, proposed_date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>🤝 Date presentation</label><input type="date" value={formData.presented_date} onChange={e => setFormData({ ...formData, presented_date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>💬 Date entretien</label><input type="date" value={formData.interview_date} onChange={e => setFormData({ ...formData, interview_date: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div><label style={labelStyle}>📆 Disponible le</label><input type="date" value={formData.disponibilite_date} onChange={e => setFormData({ ...formData, disponibilite_date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>📞 Recontact le</label><input type="date" value={formData.recontact_date} onChange={e => setFormData({ ...formData, recontact_date: e.target.value })} style={inputStyle} /></div>
              </div>
              {/* Competences */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Competences</label>
                <textarea rows={2} value={formData.competences} onChange={e => setFormData({ ...formData, competences: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} placeholder="COBOL, Java, DB2..." />
              </div>
              {/* Tags */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Mots-cles</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} style={{ ...inputStyle, flex: 1 }} placeholder="+ Entree" />
                  <button type="button" onClick={addTag} style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', padding: '0 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>+</button>
                </div>
                {formData.mots_cles.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                  {formData.mots_cles.map((tag, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>{tag} <button type="button" onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>x</button></span>)}
                </div>}
              </div>
              {/* Notes entretien */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>💬 Notes d'entretien</label>
                <textarea rows={2} value={formData.interview_notes} onChange={e => setFormData({ ...formData, interview_notes: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Retour de l'entretien client..." />
              </div>
              {/* Notes detaillees */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>📝 Notes detaillees</label>
                <textarea rows={3} value={formData.notes_detaillees} onChange={e => setFormData({ ...formData, notes_detaillees: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Informations complementaires..." />
              </div>
              {/* Mission fields */}
              {formData.status === 'en_mission' && (
                <div style={{ background: 'rgba(96,165,250,0.05)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.5rem' }}>🚀 Mission en cours</div>
                  <div style={{ marginBottom: '0.5rem' }}><label style={labelStyle}>Client</label><input type="text" value={formData.mission_client} onChange={e => setFormData({ ...formData, mission_client: e.target.value })} style={inputStyle} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div><label style={labelStyle}>Fin de mission</label><input type="date" value={formData.mission_end_date} onChange={e => setFormData({ ...formData, mission_end_date: e.target.value })} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Recontact</label><input type="date" value={formData.recontact_date} onChange={e => setFormData({ ...formData, recontact_date: e.target.value })} style={inputStyle} /></div>
                  </div>
                  <div><label style={labelStyle}>Notes mission</label><textarea rows={2} value={formData.mission_notes} onChange={e => setFormData({ ...formData, mission_notes: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8ba5b0', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', color: '#122a33', padding: '0.6rem 1.8rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>{editingCandidat ? 'Mettre a jour' : 'Creer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {uploading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, color: '#D4AF37' }}>
          <div style={{ width: 50, height: 50, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>Upload et analyse du CV...</div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', color: '#8ba5b0', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem', letterSpacing: '0.03em', textTransform: 'uppercase' }
const inputStyle = { width: '100%', padding: '0.55rem 0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }
