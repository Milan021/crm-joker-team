import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function IntercontratTracker() {
  const [candidats, setCandidats] = useState([])
  const [opportunites, setOpportunites] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, urgent, warning, safe

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [candRes, oppRes] = await Promise.all([
        supabase.from('candidats').select('*').eq('status', 'en_mission').order('mission_end_date', { ascending: true }),
        supabase.from('opportunites').select('*').in('status', ['prospection', 'qualification', 'proposition', 'negociation'])
      ])
      if (candRes.data) setCandidats(candRes.data)
      if (oppRes.data) setOpportunites(oppRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function getDaysUntilEnd(dateStr) {
    if (!dateStr) return null
    return Math.floor((new Date(dateStr) - new Date()) / 86400000)
  }

  function getStatus(days) {
    if (days === null) return { label: 'Non renseigné', color: '#64808b', bg: 'rgba(100,128,139,0.15)', icon: '❓', level: 'unknown' }
    if (days < 0) return { label: `Terminée depuis ${Math.abs(days)}j`, color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: '🚨', level: 'expired' }
    if (days <= 7) return { label: `${days}j restants`, color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: '🔴', level: 'urgent' }
    if (days <= 30) return { label: `${days}j restants`, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🟡', level: 'warning' }
    if (days <= 60) return { label: `${days}j restants`, color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', icon: '🔵', level: 'safe' }
    return { label: `${days}j restants`, color: '#34d399', bg: 'rgba(52,211,153,0.15)', icon: '🟢', level: 'safe' }
  }

  function findMatchingOpps(candidat) {
    if (!candidat.competences && !candidat.mots_cles?.length) return []
    const candKeywords = [
      ...(candidat.mots_cles || []),
      ...(typeof candidat.competences === 'string' ? candidat.competences.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : Array.isArray(candidat.competences) ? candidat.competences.map(s => String(s).toLowerCase()) : [])
    ].map(k => k.toLowerCase())

    return opportunites.filter(opp => {
      const oppText = `${opp.name || ''} ${opp.notes || ''} ${opp.competences_requises || ''} ${opp.technologies_requises || ''}`.toLowerCase()
      return candKeywords.some(k => oppText.includes(k))
    }).slice(0, 3)
  }

  const enriched = candidats.map(c => {
    const days = getDaysUntilEnd(c.mission_end_date)
    const status = getStatus(days)
    const matches = findMatchingOpps(c)
    return { ...c, _days: days, _status: status, _matches: matches }
  })

  const filtered = filter === 'all' ? enriched
    : filter === 'urgent' ? enriched.filter(c => c._status.level === 'urgent' || c._status.level === 'expired')
    : filter === 'warning' ? enriched.filter(c => c._status.level === 'warning')
    : enriched.filter(c => c._status.level === 'safe')

  const urgent = enriched.filter(c => c._status.level === 'urgent' || c._status.level === 'expired').length
  const warning = enriched.filter(c => c._status.level === 'warning').length
  const safe = enriched.filter(c => c._status.level === 'safe' || c._status.level === 'unknown').length

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
      {/* Header */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⏰ Intercontrat Tracker
        </h2>
        <p style={{ color: '#64808b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>
          Suivi des fins de mission et anticipation des intercontrats
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '👔', label: 'En mission', value: candidats.length, accent: '#60a5fa' },
          { icon: '🔴', label: 'Urgent (<7j)', value: urgent, accent: '#f87171' },
          { icon: '🟡', label: 'Attention (<30j)', value: warning, accent: '#f59e0b' },
          { icon: '🟢', label: 'OK (>30j)', value: safe, accent: '#34d399' },
          { icon: '💼', label: 'Missions ouvertes', value: opportunites.length, accent: '#D4AF37' }
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1.25rem 1.5rem', borderTop: `3px solid ${s.accent}`, cursor: 'pointer' }}
            onClick={() => setFilter(i === 0 ? 'all' : i === 1 ? 'urgent' : i === 2 ? 'warning' : i === 3 ? 'safe' : 'all')}>
            <div style={{ fontSize: '0.8rem', color: '#8ba5b0', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>{s.icon}</span> {s.label}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: `Tous (${enriched.length})` },
          { id: 'urgent', label: `🔴 Urgents (${urgent})` },
          { id: 'warning', label: `🟡 Attention (${warning})` },
          { id: 'safe', label: `🟢 OK (${safe})` }
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            background: filter === f.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
            border: filter === f.id ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: filter === f.id ? '#D4AF37' : '#8ba5b0',
            padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.78rem',
            fontWeight: filter === f.id ? 600 : 400, cursor: 'pointer'
          }}>{f.label}</button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div style={{ ...card, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
          <div style={{ color: '#64808b', fontSize: '0.9rem' }}>
            {filter === 'all' ? 'Aucun freelance en mission actuellement' : 'Aucun freelance dans cette catégorie'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(c => (
            <div key={c.id} style={{
              ...card, padding: '1.25rem 1.5rem',
              borderLeft: `4px solid ${c._status.color}`,
              transition: 'all 0.2s'
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>

              {/* Main info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{c._status.icon}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>{c.name}</span>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.68rem',
                      fontWeight: 600, color: c._status.color, background: c._status.bg
                    }}>{c._status.label}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#8ba5b0', marginBottom: '0.2rem' }}>
                    {c.titre_poste || 'Poste non renseigné'}
                    {c.tjm ? ` · ${c.tjm}€/jour` : ''}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#4a6370' }}>
                    {c.mission_client ? `🏢 ${c.mission_client}` : ''}
                    {c.mission_end_date ? ` · 📅 Fin: ${new Date(c.mission_end_date).toLocaleDateString('fr-FR')}` : ''}
                    {c.recontact_date ? ` · 📞 Recontact: ${new Date(c.recontact_date).toLocaleDateString('fr-FR')}` : ''}
                  </div>

                  {/* Competences tags */}
                  {c.mots_cles?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.5rem' }}>
                      {c.mots_cles.slice(0, 5).map((tag, i) => (
                        <span key={i} style={{
                          padding: '0.12rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem',
                          fontWeight: 600, background: 'rgba(212,175,55,0.1)', color: '#D4AF37',
                          border: '1px solid rgba(212,175,55,0.15)'
                        }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {c._days !== null && c._days >= 0 && (
                  <div style={{ width: '120px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto' }}>
                      <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                        <circle cx="40" cy="40" r="34" fill="none" stroke={c._status.color} strokeWidth="6"
                          strokeDasharray={`${Math.min(c._days / 90 * 213, 213)} 213`}
                          strokeLinecap="round" transform="rotate(-90 40 40)"
                          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                      </svg>
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center'
                      }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: c._status.color }}>{c._days}</div>
                        <div style={{ fontSize: '0.55rem', color: '#64808b' }}>jours</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Matching opportunities */}
              {c._matches.length > 0 && (
                <div style={{
                  marginTop: '0.75rem', paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(255,255,255,0.04)'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#34d399', marginBottom: '0.4rem' }}>
                    💡 Missions compatibles ({c._matches.length})
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {c._matches.map((opp, i) => (
                      <span key={i} style={{
                        padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem',
                        background: 'rgba(52,211,153,0.08)', color: '#34d399',
                        border: '1px solid rgba(52,211,153,0.15)'
                      }}>
                        {opp.name} {opp.montant ? `· ${new Intl.NumberFormat('fr-FR').format(opp.montant)}€` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mission notes */}
              {c.mission_notes && (
                <div style={{
                  marginTop: '0.5rem', fontSize: '0.75rem', color: '#4a6370',
                  fontStyle: 'italic'
                }}>
                  📝 {c.mission_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
