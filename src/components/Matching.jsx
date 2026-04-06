import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function scoreMatch(candidat, opportunite) {
  const reasons = []
  let score = 0

  // 1. Compétences matching (max 40pts)
  const candComp = extractKeywords(candidat.competences, candidat.mots_cles)
  const oppComp = extractKeywords(opportunite.competences_requises, null, opportunite.name)
  const commonComp = candComp.filter(c => oppComp.some(o => 
    o.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(o.toLowerCase())
  ))
  if (commonComp.length > 0) {
    const pts = Math.min(commonComp.length * 12, 40)
    score += pts
    reasons.push({ icon: '🎯', text: `${commonComp.length} compétence(s) en commun`, detail: commonComp.slice(0, 5).join(', '), pts })
  }

  // 2. Technologies matching (max 25pts)
  const candTech = extractKeywords(candidat.technologies)
  const oppTech = extractKeywords(opportunite.technologies_requises)
  const commonTech = candTech.filter(t => oppTech.some(o =>
    o.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(o.toLowerCase())
  ))
  if (commonTech.length > 0) {
    const pts = Math.min(commonTech.length * 10, 25)
    score += pts
    reasons.push({ icon: '💻', text: `${commonTech.length} technologie(s) commune(s)`, detail: commonTech.slice(0, 4).join(', '), pts })
  }

  // 3. Keyword matching from CV mots_cles vs opportunity name/notes (max 15pts)
  const candKeys = candidat.mots_cles || []
  const oppText = `${opportunite.name || ''} ${opportunite.notes || ''} ${opportunite.secteur || ''}`.toLowerCase()
  const keyMatches = candKeys.filter(k => oppText.includes(k.toLowerCase()))
  if (keyMatches.length > 0) {
    const pts = Math.min(keyMatches.length * 5, 15)
    score += pts
    reasons.push({ icon: '🔑', text: `${keyMatches.length} mot(s)-clé(s) CV correspondent`, detail: keyMatches.slice(0, 4).join(', '), pts })
  }

  // 4. TJM compatibility (max 10pts)
  if (candidat.tjm && opportunite.montant && opportunite.nb_jours) {
    const budgetTjm = opportunite.montant / (opportunite.nb_jours || 220)
    if (candidat.tjm <= budgetTjm * 1.15) {
      score += 10
      reasons.push({ icon: '💰', text: 'TJM compatible avec le budget', detail: `${candidat.tjm}€/j vs budget ${Math.round(budgetTjm)}€/j`, pts: 10 })
    } else if (candidat.tjm <= budgetTjm * 1.3) {
      score += 5
      reasons.push({ icon: '💰', text: 'TJM légèrement au-dessus', detail: `${candidat.tjm}€/j vs budget ${Math.round(budgetTjm)}€/j`, pts: 5 })
    }
  }

  // 5. Disponibilité (max 10pts)
  if (candidat.status === 'disponible') {
    score += 10
    reasons.push({ icon: '✅', text: 'Candidat disponible immédiatement', detail: '', pts: 10 })
  } else if (candidat.status === 'en_mission') {
    if (candidat.disponibilite) {
      const dispo = new Date(candidat.disponibilite)
      const diff = Math.floor((dispo - new Date()) / 86400000)
      if (diff <= 30) {
        score += 5
        reasons.push({ icon: '📅', text: `Disponible dans ${diff} jours`, detail: '', pts: 5 })
      }
    }
  }

  // Bonus: if name contains keywords from opportunity
  const candName = (candidat.titre_poste || '').toLowerCase()
  const oppName = (opportunite.name || '').toLowerCase()
  const titleWords = oppName.split(/[\s\-|,]+/).filter(w => w.length > 3)
  const titleMatches = titleWords.filter(w => candName.includes(w))
  if (titleMatches.length > 0) {
    const pts = Math.min(titleMatches.length * 5, 10)
    score += pts
    reasons.push({ icon: '📋', text: 'Intitulé de poste similaire', detail: titleMatches.join(', '), pts })
  }

  return { score: Math.min(score, 100), reasons }
}

function extractKeywords(str, arr, extra) {
  const results = []
  if (Array.isArray(arr)) results.push(...arr)
  if (typeof str === 'string') {
    results.push(...str.split(/[,;|]+/).map(s => s.trim()).filter(s => s.length > 1))
  }
  if (Array.isArray(str)) results.push(...str)
  if (extra) {
    results.push(...extra.split(/[\s\-|,]+/).filter(w => w.length > 3))
  }
  return [...new Set(results.map(r => r.trim()).filter(Boolean))]
}

export default function Matching() {
  const [candidats, setCandidats] = useState([])
  const [opportunites, setOpportunites] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [filterMin, setFilterMin] = useState(0)
  const [savedStatuses, setSavedStatuses] = useState({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [candRes, oppRes, matchRes] = await Promise.all([
        supabase.from('candidats').select('*'),
        supabase.from('opportunites').select('*').not('status', 'eq', 'perdu'),
        supabase.from('matchings').select('*')
      ])
      if (candRes.data) setCandidats(candRes.data)
      if (oppRes.data) setOpportunites(oppRes.data)
      if (matchRes.data) {
        const statusMap = {}
        matchRes.data.forEach(m => {
          statusMap[`${m.candidat_id}_${m.opportunite_id}`] = m.status
        })
        setSavedStatuses(statusMap)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function calculateMatches() {
    setCalculating(true)
    setTimeout(() => {
      const results = []
      const activeOpps = opportunites.filter(o => !['perdu'].includes(o.status))

      for (const cand of candidats) {
        for (const opp of activeOpps) {
          const { score, reasons } = scoreMatch(cand, opp)
          if (score > 0) {
            const key = `${cand.id}_${opp.id}`
            results.push({
              candidat: cand,
              opportunite: opp,
              score,
              reasons,
              status: savedStatuses[key] || 'suggestion'
            })
          }
        }
      }

      results.sort((a, b) => b.score - a.score)
      setMatches(results)
      setCalculating(false)

      // Save to Supabase
      saveMatches(results.slice(0, 50))
    }, 800)
  }

  async function saveMatches(results) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      for (const m of results) {
        await supabase.from('matchings').upsert({
          candidat_id: m.candidat.id,
          opportunite_id: m.opportunite.id,
          score: m.score,
          match_reasons: m.reasons.map(r => r.text),
          status: m.status,
          user_id: user?.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'candidat_id,opportunite_id' })
      }
    } catch (e) { console.error('Save matches error:', e) }
  }

  async function updateMatchStatus(candidatId, oppId, newStatus) {
    const key = `${candidatId}_${oppId}`
    setSavedStatuses(prev => ({ ...prev, [key]: newStatus }))
    setMatches(prev => prev.map(m =>
      m.candidat.id === candidatId && m.opportunite.id === oppId
        ? { ...m, status: newStatus } : m
    ))
    try {
      await supabase.from('matchings').upsert({
        candidat_id: candidatId, opportunite_id: oppId,
        status: newStatus, updated_at: new Date().toISOString()
      }, { onConflict: 'candidat_id,opportunite_id' })
    } catch (e) { console.error(e) }
  }

  // Stats
  const excellent = matches.filter(m => m.score >= 75).length
  const bon = matches.filter(m => m.score >= 50 && m.score < 75).length
  const moyen = matches.filter(m => m.score >= 25 && m.score < 50).length
  const proposed = matches.filter(m => m.status === 'proposed').length
  const accepted = matches.filter(m => m.status === 'accepted').length

  const filtered = matches.filter(m => m.score >= filterMin)

  const STATUS_ACTIONS = {
    suggestion: { next: 'proposed', label: '📤 Proposer', color: '#60a5fa' },
    proposed: { next: 'accepted', label: '✅ Accepter', color: '#34d399' },
    accepted: { next: 'suggestion', label: '↩️ Réinitialiser', color: '#94a3b8' }
  }

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  function scoreColor(s) {
    if (s >= 75) return '#34d399'
    if (s >= 50) return '#D4AF37'
    if (s >= 25) return '#f59e0b'
    return '#f87171'
  }

  function scoreLabel(s) {
    if (s >= 75) return 'Excellent'
    if (s >= 50) return 'Bon'
    if (s >= 25) return 'Possible'
    return 'Faible'
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '🤖', label: 'Total matchs', value: matches.length, accent: '#D4AF37' },
          { icon: '⭐', label: 'Excellents (75+)', value: excellent, accent: '#34d399' },
          { icon: '👍', label: 'Bons (50+)', value: bon, accent: '#60a5fa' },
          { icon: '📤', label: 'Proposés', value: proposed, accent: '#a78bfa' },
          { icon: '✅', label: 'Acceptés', value: accepted, accent: '#f59e0b' }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🤖 Matching IA — CV vs Missions
            </h2>
            <p style={{ color: '#64808b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>
              Analyse les compétences des CV et les compare aux exigences des missions
            </p>
          </div>
          <button onClick={calculateMatches} disabled={calculating} style={{
            background: calculating ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
            border: 'none', borderRadius: '8px', color: '#122a33',
            padding: '0.7rem 1.6rem', fontWeight: 700, fontSize: '0.9rem',
            cursor: calculating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            {calculating ? '⏳ Analyse en cours...' : '🔄 Lancer le matching'}
          </button>
        </div>

        {/* Algorithm explanation */}
        <div style={{
          background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1rem 1.25rem',
          marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.04)'
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.5rem' }}>
            🧠 Algorithme de scoring (100 pts)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {[
              { pts: '40', label: 'Compétences communes', color: '#34d399' },
              { pts: '25', label: 'Technologies communes', color: '#60a5fa' },
              { pts: '15', label: 'Mots-clés CV', color: '#D4AF37' },
              { pts: '10', label: 'TJM compatible', color: '#f59e0b' },
              { pts: '10', label: 'Disponibilité', color: '#a78bfa' }
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{
                  display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: r.color
                }} />
                <span style={{ fontSize: '0.72rem', color: '#8ba5b0' }}>{r.pts}pts — {r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filter by score */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { min: 0, label: `Tous (${matches.length})` },
            { min: 75, label: `⭐ Excellents (${excellent})` },
            { min: 50, label: `👍 Bons (${bon})` },
            { min: 25, label: `🔍 Possibles (${moyen})` }
          ].map(f => (
            <button key={f.min} onClick={() => setFilterMin(f.min)} style={{
              background: filterMin === f.min ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
              border: filterMin === f.min ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)',
              color: filterMin === f.min ? '#D4AF37' : '#8ba5b0',
              padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.78rem',
              fontWeight: filterMin === f.min ? 600 : 400, cursor: 'pointer'
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── MATCHES LIST ── */}
      {matches.length === 0 ? (
        <div style={{ ...card, padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤖</div>
          <div style={{ color: '#8ba5b0', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Aucun matching calculé</div>
          <div style={{ color: '#4a6370', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {candidats.length} candidat(s) · {opportunites.length} mission(s) disponible(s)
          </div>
          <div style={{ color: '#4a6370', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            Cliquez sur "🔄 Lancer le matching" pour analyser les correspondances CV ↔ Missions
          </div>
          <button onClick={calculateMatches} style={{
            background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none',
            borderRadius: '8px', color: '#122a33', padding: '0.7rem 2rem',
            fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
          }}>🔄 Lancer le matching</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((m, idx) => {
            const sc = m.score
            const col = scoreColor(sc)
            const lbl = scoreLabel(sc)
            const isExpanded = selectedMatch === idx
            const statusAction = STATUS_ACTIONS[m.status] || STATUS_ACTIONS.suggestion

            return (
              <div key={idx} style={{
                ...card, padding: 0, overflow: 'hidden',
                borderLeft: `4px solid ${col}`,
                transition: 'all 0.2s'
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = `rgba(212,175,55,0.35)`}
                onMouseLeave={e => e.currentTarget.style.borderLeftColor = col}
              >
                {/* Main row */}
                <div style={{
                  padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center',
                  gap: '1.25rem', cursor: 'pointer', flexWrap: 'wrap'
                }} onClick={() => setSelectedMatch(isExpanded ? null : idx)}>

                  {/* Score circle */}
                  <div style={{
                    width: '60px', height: '60px', borderRadius: '50%',
                    background: `conic-gradient(${col} ${sc * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, position: 'relative'
                  }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: 'rgba(18,42,51,0.95)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: col }}>{sc}</span>
                      <span style={{ fontSize: '0.5rem', color: '#64808b', marginTop: '-2px' }}>/ 100</span>
                    </div>
                  </div>

                  {/* Candidat → Mission */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>
                        👔 {m.candidat.name}
                      </span>
                      <span style={{ color: '#4a6370', fontSize: '0.85rem' }}>→</span>
                      <span style={{ fontWeight: 600, color: '#D4AF37', fontSize: '0.95rem' }}>
                        💼 {m.opportunite.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64808b' }}>
                      {m.candidat.titre_poste || 'Poste non renseigné'} · TJM: {m.candidat.tjm ? `${m.candidat.tjm}€` : '—'}
                      {m.opportunite.montant ? ` · Mission: ${new Intl.NumberFormat('fr-FR').format(m.opportunite.montant)}€` : ''}
                    </div>
                    {/* Quick reasons preview */}
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {m.reasons.slice(0, 3).map((r, ri) => (
                        <span key={ri} style={{
                          padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem',
                          background: 'rgba(212,175,55,0.08)', color: '#D4AF37',
                          border: '1px solid rgba(212,175,55,0.15)'
                        }}>{r.icon} {r.text}</span>
                      ))}
                    </div>
                  </div>

                  {/* Score badge + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span style={{
                      padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.78rem',
                      fontWeight: 700, color: col, background: `${col}18`
                    }}>{lbl}</span>

                    {m.status !== 'suggestion' && (
                      <span style={{
                        padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem',
                        fontWeight: 600,
                        color: m.status === 'accepted' ? '#34d399' : '#a78bfa',
                        background: m.status === 'accepted' ? 'rgba(52,211,153,0.12)' : 'rgba(167,139,250,0.12)'
                      }}>{m.status === 'proposed' ? '📤 Proposé' : '✅ Accepté'}</span>
                    )}

                    <button onClick={(e) => {
                      e.stopPropagation()
                      updateMatchStatus(m.candidat.id, m.opportunite.id, statusAction.next)
                    }} style={{
                      background: `${statusAction.color}15`, border: `1px solid ${statusAction.color}30`,
                      color: statusAction.color, padding: '0.4rem 0.9rem', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap'
                    }}>{statusAction.label}</button>

                    {m.status !== 'suggestion' && (
                      <button onClick={(e) => {
                        e.stopPropagation()
                        updateMatchStatus(m.candidat.id, m.opportunite.id, 'rejected')
                      }} style={{
                        background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                        color: '#f87171', padding: '0.4rem 0.7rem', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
                      }}>❌</button>
                    )}

                    <span style={{ color: '#3a5560', fontSize: '1.2rem', cursor: 'pointer' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    padding: '0 1.5rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ paddingTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      {/* Left: Candidat */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          👔 Candidat
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>{m.candidat.name}</div>
                        <div style={{ fontSize: '0.82rem', color: '#8ba5b0', marginBottom: '0.5rem' }}>{m.candidat.titre_poste || '—'}</div>
                        {m.candidat.competences && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', color: '#4a6370', textTransform: 'uppercase' }}>Compétences:</span>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                              {typeof m.candidat.competences === 'string' ? m.candidat.competences.slice(0, 150) : '—'}
                            </div>
                          </div>
                        )}
                        {m.candidat.mots_cles?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.3rem' }}>
                            {m.candidat.mots_cles.slice(0, 8).map((k, ki) => (
                              <span key={ki} style={{
                                padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.65rem',
                                background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.15)'
                              }}>{k}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: '0.78rem', color: '#64808b', marginTop: '0.5rem' }}>
                          TJM: {m.candidat.tjm ? `${m.candidat.tjm}€/j` : '—'} · Statut: {m.candidat.status || '—'}
                        </div>
                      </div>

                      {/* Right: Mission */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          💼 Mission
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>{m.opportunite.name}</div>
                        <div style={{ fontSize: '0.82rem', color: '#8ba5b0', marginBottom: '0.5rem' }}>
                          {m.opportunite.type || 'AT'} · {m.opportunite.status || '—'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64808b', marginBottom: '0.3rem' }}>
                          Montant: {m.opportunite.montant ? `${new Intl.NumberFormat('fr-FR').format(m.opportunite.montant)}€` : '—'}
                          {m.opportunite.nb_jours ? ` · ${m.opportunite.nb_jours}j` : ''}
                          {m.opportunite.probabilite ? ` · Proba: ${m.opportunite.probabilite}%` : ''}
                        </div>
                        {m.opportunite.notes && (
                          <div style={{ fontSize: '0.78rem', color: '#4a6370', fontStyle: 'italic', marginTop: '0.3rem' }}>
                            "{m.opportunite.notes.slice(0, 120)}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scoring breakdown */}
                    <div style={{
                      marginTop: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '10px',
                      padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.04)'
                    }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#D4AF37', marginBottom: '0.75rem' }}>
                        📊 Détail du scoring — {sc}/100
                      </div>
                      {m.reasons.map((r, ri) => (
                        <div key={ri} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.5rem 0',
                          borderBottom: ri < m.reasons.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none'
                        }}>
                          <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 500 }}>{r.text}</div>
                            {r.detail && <div style={{ fontSize: '0.72rem', color: '#4a6370' }}>{r.detail}</div>}
                          </div>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem',
                            fontWeight: 700, color: '#D4AF37', background: 'rgba(212,175,55,0.1)'
                          }}>+{r.pts}pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Calculating overlay */}
      {calculating && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{ width: 50, height: 50, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
          <div style={{ color: '#D4AF37', fontSize: '1rem', fontWeight: 600, marginBottom: '0.3rem' }}>
            🤖 Analyse IA en cours...
          </div>
          <div style={{ color: '#64808b', fontSize: '0.8rem' }}>
            {candidats.length} candidats × {opportunites.length} missions
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}
