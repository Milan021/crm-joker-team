import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Dashboard({ onNavigate }) {
  const [contacts, setContacts] = useState([])
  const [opportunites, setOpportunites] = useState([])
  const [candidats, setCandidats] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [contRes, oppRes, candRes, intRes] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('opportunites').select('*'),
        supabase.from('candidats').select('*'),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(20)
      ])
      if (contRes.data) setContacts(contRes.data)
      if (oppRes.data) setOpportunites(oppRes.data)
      if (candRes.data) setCandidats(candRes.data)
      if (intRes.data) setInteractions(intRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function fmt(n) { return new Intl.NumberFormat('fr-FR').format(n || 0) }

  // Computed stats
  const caGagne = opportunites.filter(o => o.status === 'gagne').reduce((s, o) => s + (o.montant || 0), 0)
  const pipeline = opportunites.filter(o => !['gagne', 'perdu'].includes(o.status)).reduce((s, o) => s + ((o.montant || 0) * (o.probabilite || 0) / 100), 0)
  const caTotal = opportunites.reduce((s, o) => s + (o.montant || 0), 0)
  const actives = opportunites.filter(o => !['gagne', 'perdu'].includes(o.status))
  const gagnes = opportunites.filter(o => o.status === 'gagne')
  const perdus = opportunites.filter(o => o.status === 'perdu')
  const taux = gagnes.length + perdus.length > 0 ? Math.round(gagnes.length / (gagnes.length + perdus.length) * 100) : 0
  const tjmMoyen = candidats.filter(c => c.tjm).length > 0 ? Math.round(candidats.filter(c => c.tjm).reduce((s, c) => s + c.tjm, 0) / candidats.filter(c => c.tjm).length) : 0
  const dispos = candidats.filter(c => c.status === 'disponible')
  const enMission = candidats.filter(c => c.status === 'en_mission')

  // Intercontrat: missions ending in 30 days
  const today = new Date()
  const intercontrat = candidats.filter(c => {
    if (c.status !== 'en_mission' || !c.mission_end_date) return false
    const end = new Date(c.mission_end_date)
    const diff = Math.floor((end - today) / 86400000)
    return diff >= 0 && diff <= 30
  })

  // Relances needed
  const needsRelance = opportunites.filter(o => {
    if (['gagne', 'perdu'].includes(o.status)) return false
    if (!o.last_contact_date) return true
    return Math.floor((today - new Date(o.last_contact_date)) / 86400000) > 7
  })

  // Pipeline by status for chart
  const statusData = [
    { label: 'Prospection', count: opportunites.filter(o => o.status === 'prospection').length, amount: opportunites.filter(o => o.status === 'prospection').reduce((s, o) => s + (o.montant || 0), 0), color: '#94a3b8' },
    { label: 'Qualification', count: opportunites.filter(o => o.status === 'qualification').length, amount: opportunites.filter(o => o.status === 'qualification').reduce((s, o) => s + (o.montant || 0), 0), color: '#60a5fa' },
    { label: 'Proposition', count: opportunites.filter(o => o.status === 'proposition').length, amount: opportunites.filter(o => o.status === 'proposition').reduce((s, o) => s + (o.montant || 0), 0), color: '#D4AF37' },
    { label: 'Négociation', count: opportunites.filter(o => o.status === 'negociation').length, amount: opportunites.filter(o => o.status === 'negociation').reduce((s, o) => s + (o.montant || 0), 0), color: '#f59e0b' },
    { label: 'Gagné', count: gagnes.length, amount: caGagne, color: '#34d399' },
    { label: 'Perdu', count: perdus.length, amount: perdus.reduce((s, o) => s + (o.montant || 0), 0), color: '#f87171' }
  ]
  const maxAmount = Math.max(...statusData.map(d => d.amount), 1)

  // Type distribution for donut
  const typeData = [
    { label: 'AT', count: opportunites.filter(o => o.type === 'AT').length, color: '#60a5fa' },
    { label: 'Forfait', count: opportunites.filter(o => o.type === 'FORFAIT').length, color: '#a78bfa' },
    { label: 'Régie', count: opportunites.filter(o => o.type === 'REGIE').length, color: '#34d399' },
    { label: 'Conseil', count: opportunites.filter(o => o.type === 'CONSEIL').length, color: '#fbbf24' }
  ].filter(d => d.count > 0)
  const totalType = typeData.reduce((s, d) => s + d.count, 0) || 1

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
      {(intercontrat.length > 0 || needsRelance.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {intercontrat.map(c => {
            const diff = Math.floor((new Date(c.mission_end_date) - today) / 86400000)
            return (
              <div key={`ic-${c.id}`} style={{
                ...card, padding: '1rem 1.5rem', borderLeft: `4px solid ${diff <= 7 ? '#f87171' : '#f59e0b'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>{diff <= 7 ? '🚨' : '⏰'}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.88rem' }}>
                      {c.name} — Mission se termine {diff === 0 ? "aujourd'hui" : `dans ${diff}j`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64808b' }}>
                      {c.mission_client ? `Client: ${c.mission_client}` : c.titre_poste || ''} · Fin: {new Date(c.mission_end_date).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
                <button onClick={() => onNavigate('candidats')} style={{
                  background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
                  color: '#D4AF37', padding: '0.35rem 0.9rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                }}>Voir le candidat →</button>
              </div>
            )
          })}
          {needsRelance.length > 0 && (
            <div style={{
              ...card, padding: '1rem 1.5rem', borderLeft: '4px solid #f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📞</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.88rem' }}>
                    {needsRelance.length} opportunité(s) à relancer
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64808b' }}>Pas de contact depuis 7+ jours</div>
                </div>
              </div>
              <button onClick={() => onNavigate('opportunites')} style={{
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                color: '#fbbf24', padding: '0.35rem 0.9rem', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
              }}>Voir les relances →</button>
            </div>
          )}
        </div>
      )}

      {/* ── MAIN STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '👥', label: 'CONTACTS', value: contacts.length, accent: '#60a5fa', tab: 'contacts' },
          { icon: '💼', label: 'OPPORTUNITÉS', value: opportunites.length, accent: '#D4AF37', tab: 'opportunites' },
          { icon: '👔', label: 'CANDIDATS', value: candidats.length, accent: '#a78bfa', tab: 'candidats' },
          { icon: '💰', label: 'CA GAGNÉ', value: `${fmt(caGagne)} €`, accent: '#34d399', tab: 'opportunites' }
        ].map((s, i) => (
          <div key={i} onClick={() => onNavigate(s.tab)} style={{
            ...card, padding: '1.25rem 1.5rem', borderTop: `3px solid ${s.accent}`,
            cursor: 'pointer', transition: 'all 0.2s'
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderTopColor = s.accent}
          >
            <div style={{ fontSize: '0.78rem', color: '#8ba5b0', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <span>{s.icon}</span> {s.label}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#4a6370', marginTop: '0.2rem' }}>Cliquez pour voir →</div>
          </div>
        ))}
      </div>

      {/* ── SECONDARY STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '📊', label: 'Pipeline', value: `${fmt(Math.round(pipeline))} €` },
          { icon: '📈', label: 'CA Total Prévu', value: `${fmt(caTotal)} €` },
          { icon: '💵', label: 'TJM Moyen', value: `${tjmMoyen} €` },
          { icon: '🎯', label: 'Taux de conversion', value: `${taux}%` },
          { icon: '✅', label: 'Disponibles', value: dispos.length },
          { icon: '🚀', label: 'En mission', value: enMission.length }
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64808b', marginBottom: '0.2rem' }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e2e8f0' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Pipeline bar chart */}
        <div style={{ ...card, padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem' }}>
            📊 Pipeline par étape
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {statusData.map((d, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#8ba5b0' }}>{d.label} ({d.count})</span>
                  <span style={{ fontSize: '0.75rem', color: d.color, fontWeight: 600 }}>{fmt(d.amount)} €</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(d.amount / maxAmount) * 100}%`, height: '100%',
                    borderRadius: '4px', background: d.color,
                    transition: 'width 0.8s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Type distribution donut */}
        <div style={{ ...card, padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem' }}>
            🎯 Répartition par type
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* SVG Donut */}
            <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
              {(() => {
                let cumulative = 0
                return typeData.map((d, i) => {
                  const pct = d.count / totalType
                  const dashArray = pct * 283
                  const dashOffset = -cumulative * 283
                  cumulative += pct
                  return (
                    <circle key={i} cx="60" cy="60" r="45"
                      fill="none" stroke={d.color} strokeWidth="18"
                      strokeDasharray={`${dashArray} ${283 - dashArray}`}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 60 60)"
                      style={{ transition: 'all 0.8s ease' }}
                    />
                  )
                })
              })()}
              <text x="60" y="56" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">{opportunites.length}</text>
              <text x="60" y="72" textAnchor="middle" fill="#64808b" fontSize="9">opportunités</text>
            </svg>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {typeData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color }} />
                  <span style={{ fontSize: '0.8rem', color: '#8ba5b0' }}>{d.label}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>{d.count}</span>
                  <span style={{ fontSize: '0.68rem', color: '#4a6370' }}>({Math.round(d.count / totalType * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Conversion + Recent Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Conversion gauge */}
        <div style={{ ...card, padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem' }}>
            📈 Taux de conversion
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <svg width="160" height="100" viewBox="0 0 160 100">
              {/* Background arc */}
              <path d="M 20 90 A 60 60 0 0 1 140 90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
              {/* Filled arc */}
              <path d="M 20 90 A 60 60 0 0 1 140 90" fill="none"
                stroke={taux >= 60 ? '#34d399' : taux >= 40 ? '#D4AF37' : '#f59e0b'}
                strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${(taux / 100) * 188} 188`}
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
              />
              <text x="80" y="75" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="700">{taux}%</text>
              <text x="80" y="95" textAnchor="middle" fill="#64808b" fontSize="10">conversion</text>
            </svg>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '0.75rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{gagnes.length}</div>
                <div style={{ fontSize: '0.68rem', color: '#64808b' }}>Gagnés</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f87171' }}>{perdus.length}</div>
                <div style={{ fontSize: '0.68rem', color: '#64808b' }}>Perdus</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#D4AF37' }}>{actives.length}</div>
                <div style={{ fontSize: '0.68rem', color: '#64808b' }}>En cours</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity timeline */}
        <div style={{ ...card, padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
            🕐 Activité récente
          </div>
          {interactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#4a6370', fontSize: '0.82rem' }}>
              Aucune interaction enregistrée
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
              {interactions.slice(0, 8).map((int, i) => {
                const icons = { appel: '📞', email: '📧', reunion: '🤝', linkedin: '💼', autre: '📝' }
                const opp = opportunites.find(o => o.id === int.opportunite_id)
                return (
                  <div key={int.id || i} style={{
                    display: 'flex', gap: '0.6rem', padding: '0.5rem 0.6rem',
                    borderRadius: '8px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <span style={{ fontSize: '1rem' }}>{icons[int.type] || '📝'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {int.type} {opp ? `— ${opp.name}` : ''}
                      </div>
                      {int.notes && <div style={{ fontSize: '0.7rem', color: '#64808b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{int.notes}</div>}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#3a5560', flexShrink: 0 }}>
                      {new Date(int.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
