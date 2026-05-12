import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function ContactCalendar({ contactId, contactName }) {
  const [followups, setFollowups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    contacted: false, contact_date: '', contact_method: 'email', contact_notes: '',
    next_step: false, next_step_date: '', next_step_subject: ''
  })

  useEffect(() => { if (contactId) loadFollowups() }, [contactId])

  async function loadFollowups() {
    setLoading(true)
    try {
      const { data } = await supabase.from('contact_followups').select('*')
        .eq('contact_id', contactId).order('created_at', { ascending: false }).limit(20)
      if (data) setFollowups(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e?.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('contact_followups').insert([{
        contact_id: contactId,
        contacted: formData.contacted,
        contact_date: formData.contacted && formData.contact_date ? formData.contact_date : null,
        contact_method: formData.contacted ? formData.contact_method : null,
        contact_notes: formData.contact_notes || null,
        next_step: formData.next_step,
        next_step_date: formData.next_step && formData.next_step_date ? formData.next_step_date : null,
        next_step_subject: formData.next_step ? formData.next_step_subject : null,
        next_step_done: false,
        created_by: user?.id
      }])
      setShowForm(false)
      resetForm()
      loadFollowups()
    } catch (err) { alert('Erreur: ' + err.message) }
  }

  async function markNextStepDone(id) {
    await supabase.from('contact_followups').update({ next_step_done: true }).eq('id', id)
    loadFollowups()
  }

  async function deleteFollowup(id) {
    if (!confirm('Supprimer ce suivi ?')) return
    await supabase.from('contact_followups').delete().eq('id', id)
    loadFollowups()
  }

  function resetForm() {
    setFormData({ contacted: false, contact_date: '', contact_method: 'email', contact_notes: '', next_step: false, next_step_date: '', next_step_subject: '' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const pendingSteps = followups.filter(f => f.next_step && !f.next_step_done && f.next_step_date)
  const overdueSteps = pendingSteps.filter(f => f.next_step_date < today)
  const upcomingSteps = pendingSteps.filter(f => f.next_step_date >= today)
  const lastContact = followups.find(f => f.contacted && f.contact_date)
  const daysSinceContact = lastContact ? Math.floor((new Date() - new Date(lastContact.contact_date)) / 86400000) : null

  const METHOD_ICONS = { email: '📧', appel: '📞', reunion: '🤝', linkedin: '💼', autre: '📝' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📅 Suivi & Rappels</div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} style={{
          background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
          color: '#D4AF37', padding: '0.25rem 0.6rem', borderRadius: '6px',
          cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
        }}>{showForm ? '✕' : '+ Suivi'}</button>
      </div>

      {/* Last contact indicator */}
      {daysSinceContact !== null && (
        <div style={{
          padding: '0.4rem 0.6rem', borderRadius: '8px', marginBottom: '0.5rem',
          background: daysSinceContact > 30 ? 'rgba(248,113,113,0.08)' : daysSinceContact > 14 ? 'rgba(245,158,11,0.08)' : 'rgba(52,211,153,0.08)',
          border: '1px solid ' + (daysSinceContact > 30 ? 'rgba(248,113,113,0.15)' : daysSinceContact > 14 ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)'),
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.72rem', color: daysSinceContact > 30 ? '#f87171' : daysSinceContact > 14 ? '#f59e0b' : '#34d399' }}>
            {daysSinceContact > 30 ? '🔴' : daysSinceContact > 14 ? '🟡' : '🟢'} Dernier contact : il y a {daysSinceContact}j
          </span>
          <span style={{ fontSize: '0.65rem', color: '#4a6370' }}>
            {METHOD_ICONS[lastContact.contact_method] || '📝'} {new Date(lastContact.contact_date).toLocaleDateString('fr-FR')}
          </span>
        </div>
      )}
      {daysSinceContact === null && followups.length === 0 && (
        <div style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', marginBottom: '0.5rem', background: 'rgba(100,128,139,0.08)', border: '1px solid rgba(100,128,139,0.15)' }}>
          <span style={{ fontSize: '0.72rem', color: '#64808b' }}>⚪ Jamais contacte</span>
        </div>
      )}

      {/* Overdue alerts */}
      {overdueSteps.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          {overdueSteps.map(f => (
            <div key={f.id} style={{
              padding: '0.4rem 0.6rem', borderRadius: '6px', marginBottom: '0.25rem',
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f87171' }}>
                  🚨 En retard : {f.next_step_subject || 'Action a faire'}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#f87171' }}>
                  Prevu le {new Date(f.next_step_date).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <button onClick={() => markNextStepDone(f.id)} style={{
                background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)',
                color: '#34d399', padding: '0.2rem 0.5rem', borderRadius: '4px',
                cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600
              }}>✅ Fait</button>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming next steps */}
      {upcomingSteps.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          {upcomingSteps.map(f => {
            const daysUntil = Math.floor((new Date(f.next_step_date) - new Date()) / 86400000)
            return (
              <div key={f.id} style={{
                padding: '0.4rem 0.6rem', borderRadius: '6px', marginBottom: '0.25rem',
                background: daysUntil <= 3 ? 'rgba(245,158,11,0.08)' : 'rgba(96,165,250,0.08)',
                border: '1px solid ' + (daysUntil <= 3 ? 'rgba(245,158,11,0.15)' : 'rgba(96,165,250,0.15)'),
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: daysUntil <= 3 ? '#f59e0b' : '#60a5fa' }}>
                    {daysUntil <= 3 ? '⏰' : '📌'} {f.next_step_subject || 'Prochaine action'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#4a6370' }}>
                    {daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? 'Demain' : 'Dans ' + daysUntil + 'j'} — {new Date(f.next_step_date).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <button onClick={() => markNextStepDone(f.id)} style={{
                  background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)',
                  color: '#34d399', padding: '0.2rem 0.5rem', borderRadius: '4px',
                  cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600
                }}>✅ Fait</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add followup form */}
      {showForm && (
        <div style={{
          background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '0.75rem',
          marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.04)'
        }}>
          {/* Contacted? */}
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <button onClick={() => setFormData({ ...formData, contacted: true })} style={{
                flex: 1, padding: '0.35rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: formData.contacted ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                color: formData.contacted ? '#34d399' : '#64808b', fontSize: '0.75rem', fontWeight: formData.contacted ? 600 : 400
              }}>✅ Contacte</button>
              <button onClick={() => setFormData({ ...formData, contacted: false })} style={{
                flex: 1, padding: '0.35rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: !formData.contacted ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)',
                color: !formData.contacted ? '#f87171' : '#64808b', fontSize: '0.75rem', fontWeight: !formData.contacted ? 600 : 400
              }}>❌ Pas contacte</button>
            </div>
          </div>

          {formData.contacted && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.3rem' }}>
                <div>
                  <label style={miniLabel}>Date du contact</label>
                  <input type="date" value={formData.contact_date} onChange={e => setFormData({ ...formData, contact_date: e.target.value })} style={miniInput} />
                </div>
                <div>
                  <label style={miniLabel}>Methode</label>
                  <select value={formData.contact_method} onChange={e => setFormData({ ...formData, contact_method: e.target.value })} style={miniInput}>
                    <option value="email">📧 Email</option>
                    <option value="appel">📞 Appel</option>
                    <option value="reunion">🤝 Reunion</option>
                    <option value="linkedin">💼 LinkedIn</option>
                    <option value="autre">📝 Autre</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={miniLabel}>Notes</label>
                <textarea rows={2} value={formData.contact_notes} onChange={e => setFormData({ ...formData, contact_notes: e.target.value })} style={{ ...miniInput, resize: 'vertical' }} placeholder="Resume de l'echange..." />
              </div>
            </div>
          )}

          {/* Next step? */}
          <div style={{ marginBottom: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <button onClick={() => setFormData({ ...formData, next_step: true })} style={{
                flex: 1, padding: '0.35rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: formData.next_step ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
                color: formData.next_step ? '#60a5fa' : '#64808b', fontSize: '0.75rem', fontWeight: formData.next_step ? 600 : 400
              }}>📌 Next step: Oui</button>
              <button onClick={() => setFormData({ ...formData, next_step: false })} style={{
                flex: 1, padding: '0.35rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: !formData.next_step ? 'rgba(100,128,139,0.15)' : 'rgba(255,255,255,0.05)',
                color: !formData.next_step ? '#64808b' : '#64808b', fontSize: '0.75rem', fontWeight: !formData.next_step ? 600 : 400
              }}>Pas de next step</button>
            </div>
          </div>

          {formData.next_step && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ marginBottom: '0.3rem' }}>
                <label style={miniLabel}>Quand ?</label>
                <input type="date" value={formData.next_step_date} onChange={e => setFormData({ ...formData, next_step_date: e.target.value })} style={miniInput} />
              </div>
              <div>
                <label style={miniLabel}>Quel sujet ?</label>
                <input type="text" value={formData.next_step_subject} onChange={e => setFormData({ ...formData, next_step_subject: e.target.value })} style={miniInput} placeholder="Ex: Relancer pour proposition, Envoyer devis..." />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#64808b', padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer'
            }}>Annuler</button>
            <button onClick={handleSubmit} style={{
              background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none',
              color: '#122a33', padding: '0.3rem 1rem', borderRadius: '6px',
              fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
            }}>Enregistrer</button>
          </div>
        </div>
      )}

      {/* History */}
      {!loading && followups.length > 0 && (
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {followups.filter(f => f.contacted || (f.next_step && f.next_step_done)).map(f => (
            <div key={f.id} style={{
              padding: '0.35rem 0.5rem', borderRadius: '6px', marginBottom: '0.2rem',
              background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.7rem', color: '#8ba5b0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {f.contacted ? (
                    <><span>{METHOD_ICONS[f.contact_method] || '📝'}</span> Contacte le {f.contact_date ? new Date(f.contact_date).toLocaleDateString('fr-FR') : '?'}</>
                  ) : f.next_step_done ? (
                    <><span>✅</span> {f.next_step_subject || 'Action'} - Fait</>
                  ) : null}
                </div>
                {f.contact_notes && <div style={{ fontSize: '0.68rem', color: '#4a6370', marginTop: '0.1rem' }}>{f.contact_notes.slice(0, 80)}</div>}
              </div>
              <button onClick={() => deleteFollowup(f.id)} style={{
                background: 'none', border: 'none', color: '#3a5560', cursor: 'pointer', fontSize: '0.65rem', padding: '0.1rem'
              }}>x</button>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ fontSize: '0.72rem', color: '#4a6370', padding: '0.5rem 0' }}>Chargement...</div>}
    </div>
  )
}

const miniLabel = { display: 'block', color: '#64808b', fontSize: '0.68rem', fontWeight: 500, marginBottom: '0.15rem', textTransform: 'uppercase' }
const miniInput = { width: '100%', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box' }
