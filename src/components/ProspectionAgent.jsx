import { useState } from 'react'
import { supabase } from '../supabase'

const REGIONS = [
  { id: '', label: 'Toutes les regions' },
  { id: '11', label: 'Ile-de-France' },
  { id: '84', label: 'Auvergne-Rhone-Alpes' },
  { id: '93', label: "Provence-Alpes-Cote d'Azur" },
  { id: '76', label: 'Occitanie' },
  { id: '75', label: 'Nouvelle-Aquitaine' },
  { id: '32', label: 'Hauts-de-France' },
  { id: '44', label: 'Grand Est' },
  { id: '28', label: 'Normandie' },
  { id: '53', label: 'Bretagne' },
  { id: '52', label: 'Pays de la Loire' },
  { id: '24', label: 'Centre-Val de Loire' },
  { id: '27', label: 'Bourgogne-Franche-Comte' },
  { id: '94', label: 'Corse' },
]

const SECTEURS = [
  { id: '', label: 'Tous les secteurs' },
  { id: '62', label: 'Programmation informatique / conseil' },
  { id: '63', label: 'Services d\'information' },
  { id: '64', label: 'Services financiers' },
  { id: '65', label: 'Assurance' },
  { id: '70', label: 'Conseil de gestion' },
  { id: '71', label: 'Architecture / ingenierie' },
  { id: '46', label: 'Commerce de gros' },
  { id: '47', label: 'Commerce de detail' },
  { id: '86', label: 'Sante humaine' },
  { id: '85', label: 'Enseignement' },
]

export default function ProspectionAgent() {
  const [searchQuery, setSearchQuery] = useState('')
  const [region, setRegion] = useState('')
  const [secteur, setSecteur] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [scoring, setScoring] = useState(null)
  const [scoringLoading, setScoringLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageLoading, setMessageLoading] = useState(false)
  const [channel, setChannel] = useState('email')
  const [tone, setTone] = useState('direct')
  const [savedProspects, setSavedProspects] = useState([])
  const [view, setView] = useState('search')

  async function handleSearch(e) {
    e?.preventDefault()
    if (!searchQuery.trim()) return
    setLoading(true)
    setResults([])
    try {
      const resp = await fetch('/api/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: searchQuery, region, naf: secteur })
      })
      if (resp.ok) {
        const data = await resp.json()
        setResults(data.results || [])
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleScore(prospect) {
    setSelectedProspect(prospect)
    setScoring(null)
    setMessage(null)
    setScoringLoading(true)
    try {
      const resp = await fetch('/api/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score', prospect })
      })
      if (resp.ok) {
        const data = await resp.json()
        setScoring(data.scoring)
        setSelectedProspect(prev => ({ ...prev, scoring: data.scoring }))
      }
    } catch (err) { console.error(err) }
    setScoringLoading(false)
  }

  async function handleGenerate() {
    if (!selectedProspect) return
    setMessageLoading(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prospect: selectedProspect, channel, tone })
      })
      if (resp.ok) {
        const data = await resp.json()
        setMessage(data.message)
      }
    } catch (err) { console.error(err) }
    setMessageLoading(false)
  }

  async function saveAsContact(prospect) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('contacts').insert([{
        name: prospect.nom,
        company: prospect.nom,
        is_company: true,
        notes: `SIREN: ${prospect.siren}\nActivite: ${prospect.libelle_activite}\nEffectif: ${prospect.tranche_effectif}\nAdresse: ${prospect.adresse} ${prospect.code_postal} ${prospect.ville}\n${prospect.scoring ? '\nScore: ' + prospect.scoring.score + '/100\nPotentiel: ' + prospect.scoring.potentiel : ''}`,
        created_by: user?.id
      }])
      if (error) throw error
      setSavedProspects(prev => [...prev, prospect.siren])
      alert('Contact cree dans le CRM !')
    } catch (err) { alert('Erreur: ' + err.message) }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
    alert('Copie dans le presse-papier !')
  }

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>🎯 Agent de Prospection</h2>
        <p style={{ color: '#64808b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>Recherchez des prospects PME/ETI, scorez-les avec l'IA, et generez des messages personnalises</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '🔍', label: 'Resultats', value: results.length, accent: '#60a5fa' },
          { icon: '🎯', label: 'Scores', value: scoring ? '1' : '0', accent: '#D4AF37' },
          { icon: '📧', label: 'Messages generes', value: message ? '1' : '0', accent: '#34d399' },
          { icon: '💾', label: 'Sauvegardes', value: savedProspects.length, accent: '#a78bfa' },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1rem 1.25rem', borderTop: `3px solid ${s.accent}` }}>
            <div style={{ fontSize: '0.78rem', color: '#8ba5b0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span>{s.icon}</span> {s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Rechercher des entreprises</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ex: informatique, banque, industrie, transport..."
              style={{ ...inputStyle, fontSize: '1rem', padding: '0.8rem 1rem' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Region</label>
              <select value={region} onChange={e => setRegion(e.target.value)} style={inputStyle}>
                {REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Secteur</label>
              <select value={secteur} onChange={e => setSecteur(e.target.value)} style={inputStyle}>
                {SECTEURS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} style={{
              background: loading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
              border: 'none', borderRadius: '8px', color: '#122a33',
              padding: '0.7rem 2rem', fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'wait' : 'pointer'
            }}>{loading ? '🔄 Recherche...' : '🔍 Rechercher'}</button>
          </div>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedProspect ? '1fr 420px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Results */}
        <div>
          {loading && (
            <div style={{ ...card, padding: '3rem', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
              <div style={{ color: '#D4AF37' }}>Recherche en cours sur la base INSEE...</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {results.map((r, i) => {
                const isSaved = savedProspects.includes(r.siren)
                const isSelected = selectedProspect?.siren === r.siren
                return (
                  <div key={r.siren || i} style={{
                    ...card, padding: '1rem 1.25rem', cursor: 'pointer',
                    borderLeft: isSelected ? '4px solid #D4AF37' : '4px solid transparent',
                    transition: 'all 0.15s'
                  }}
                    onClick={() => handleScore(r)}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>{r.nom}</span>
                          <span style={{ padding: '0.1rem 0.4rem', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>{r.categorie}</span>
                          {isSaved && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 600, background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>Sauvegarde</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#8ba5b0' }}>{r.libelle_activite}</div>
                        <div style={{ fontSize: '0.72rem', color: '#4a6370', marginTop: '0.15rem' }}>
                          📍 {r.ville} ({r.code_postal}) · SIREN: {r.siren}
                          {r.tranche_effectif ? ` · Effectif: ${r.tranche_effectif}` : ''}
                          {r.date_creation ? ` · Creee: ${r.date_creation}` : ''}
                        </div>
                        {r.dirigeants?.length > 0 && (
                          <div style={{ fontSize: '0.7rem', color: '#64808b', marginTop: '0.2rem' }}>
                            👤 {r.dirigeants.map(d => `${d.nom} (${d.qualite})`).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={e => { e.stopPropagation(); handleScore(r) }} style={{
                          background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
                          color: '#D4AF37', padding: '0.4rem 0.8rem', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                        }}>🎯 Scorer</button>
                        {!isSaved && (
                          <button onClick={e => { e.stopPropagation(); saveAsContact(r) }} style={{
                            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                            color: '#34d399', padding: '0.4rem 0.8rem', borderRadius: '6px',
                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                          }}>💾 Sauver</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && results.length === 0 && searchQuery && (
            <div style={{ ...card, padding: '3rem', textAlign: 'center', color: '#4a6370' }}>Aucun resultat. Essayez un autre terme de recherche.</div>
          )}
        </div>

        {/* Detail panel */}
        {selectedProspect && (
          <div style={{ position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
            <div style={{ ...card, padding: '1.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{selectedProspect.nom}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8ba5b0' }}>{selectedProspect.libelle_activite}</div>
                  <div style={{ fontSize: '0.72rem', color: '#4a6370' }}>📍 {selectedProspect.ville} · {selectedProspect.categorie}</div>
                </div>
                <button onClick={() => { setSelectedProspect(null); setScoring(null); setMessage(null) }} style={{ background: 'none', border: 'none', color: '#4a6370', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>

              {/* Scoring */}
              {scoringLoading && (
                <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <div style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.82rem', color: '#D4AF37' }}>🤖 Scoring IA en cours...</div>
                </div>
              )}

              {scoring && (
                <div>
                  {/* Score gauge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ position: 'relative', width: '70px', height: '70px' }}>
                      <svg width="70" height="70" viewBox="0 0 70 70">
                        <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                        <circle cx="35" cy="35" r="30" fill="none"
                          stroke={scoring.score >= 70 ? '#34d399' : scoring.score >= 40 ? '#f59e0b' : '#f87171'}
                          strokeWidth="6" strokeDasharray={`${(scoring.score / 100) * 188} 188`}
                          strokeLinecap="round" transform="rotate(-90 35 35)" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: scoring.score >= 70 ? '#34d399' : scoring.score >= 40 ? '#f59e0b' : '#f87171' }}>{scoring.score}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: scoring.potentiel === 'Fort' ? '#34d399' : scoring.potentiel === 'Moyen' ? '#f59e0b' : '#f87171' }}>Potentiel {scoring.potentiel}</div>
                      {scoring.budget_estime && <div style={{ fontSize: '0.72rem', color: '#D4AF37' }}>💰 {scoring.budget_estime}</div>}
                      {scoring.decision_maker && <div style={{ fontSize: '0.72rem', color: '#8ba5b0' }}>👤 Contacter: {scoring.decision_maker}</div>}
                    </div>
                  </div>

                  {scoring.raisons?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#34d399', marginBottom: '0.3rem' }}>✅ Pourquoi c'est un bon prospect</div>
                      {scoring.raisons.map((r, i) => <div key={i} style={{ fontSize: '0.75rem', color: '#94a3b8', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(52,211,153,0.3)', marginBottom: '0.2rem' }}>{r}</div>)}
                    </div>
                  )}

                  {scoring.signaux_achat?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.3rem' }}>📡 Signaux d'achat</div>
                      {scoring.signaux_achat.map((s, i) => <div key={i} style={{ fontSize: '0.75rem', color: '#94a3b8', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(96,165,250,0.3)', marginBottom: '0.2rem' }}>{s}</div>)}
                    </div>
                  )}

                  {scoring.angle_approche && (
                    <div style={{ fontSize: '0.75rem', color: '#D4AF37', fontStyle: 'italic', padding: '0.5rem', background: 'rgba(212,175,55,0.05)', borderRadius: '6px', marginBottom: '0.75rem' }}>
                      💡 {scoring.angle_approche}
                    </div>
                  )}

                  {scoring.timing && (
                    <div style={{ fontSize: '0.72rem', color: '#4a6370' }}>⏰ {scoring.timing}</div>
                  )}
                </div>
              )}
            </div>

            {/* Message Generator */}
            {scoring && (
              <div style={{ ...card, padding: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#D4AF37', marginBottom: '0.75rem' }}>✉️ Generer un message de prospection</div>

                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <button onClick={() => setChannel('email')} style={{
                    flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: channel === 'email' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
                    color: channel === 'email' ? '#60a5fa' : '#64808b', fontWeight: channel === 'email' ? 600 : 400, fontSize: '0.82rem'
                  }}>📧 Email</button>
                  <button onClick={() => setChannel('linkedin')} style={{
                    flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: channel === 'linkedin' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
                    color: channel === 'linkedin' ? '#60a5fa' : '#64808b', fontWeight: channel === 'linkedin' ? 600 : 400, fontSize: '0.82rem'
                  }}>💼 LinkedIn</button>
                </div>

                <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'direct', label: '🎯 Direct' },
                    { id: 'consultative', label: '🧠 Consultant' },
                    { id: 'challenger', label: '⚡ Challenger' },
                    { id: 'networking', label: '🤝 Networking' }
                  ].map(t => (
                    <button key={t.id} onClick={() => setTone(t.id)} style={{
                      padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      background: tone === t.id ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                      color: tone === t.id ? '#D4AF37' : '#64808b', fontSize: '0.72rem', fontWeight: tone === t.id ? 600 : 400
                    }}>{t.label}</button>
                  ))}
                </div>

                <button onClick={handleGenerate} disabled={messageLoading} style={{
                  width: '100%', background: messageLoading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
                  border: 'none', borderRadius: '8px', color: '#122a33',
                  padding: '0.6rem', fontWeight: 700, fontSize: '0.88rem', cursor: messageLoading ? 'wait' : 'pointer'
                }}>{messageLoading ? '🤖 Generation IA...' : '✨ Generer le message'}</button>

                {/* Generated message */}
                {message && (
                  <div style={{ marginTop: '1rem' }}>
                    {message.subject && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.68rem', color: '#4a6370', textTransform: 'uppercase' }}>Objet</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>{message.subject}</div>
                      </div>
                    )}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.68rem', color: '#4a6370', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Message</div>
                      <div style={{
                        padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem',
                        color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap'
                      }}>{message.body}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => copyToClipboard(message.subject ? `Objet: ${message.subject}\n\n${message.body}` : message.body)} style={{
                        flex: 1, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                        color: '#34d399', padding: '0.5rem', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
                      }}>📋 Copier</button>
                      <button onClick={() => handleGenerate()} style={{
                        background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                        color: '#60a5fa', padding: '0.5rem 0.8rem', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
                      }}>🔄 Regenerer</button>
                    </div>

                    {message.followup && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.68rem', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>📅 Relance J+3</div>
                        <div style={{
                          padding: '0.6rem', borderRadius: '8px', background: 'rgba(245,158,11,0.05)',
                          border: '1px solid rgba(245,158,11,0.15)', fontSize: '0.78rem',
                          color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap'
                        }}>{message.followup}</div>
                        <button onClick={() => copyToClipboard(message.followup)} style={{
                          marginTop: '0.3rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)',
                          color: '#f59e0b', padding: '0.3rem 0.6rem', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.7rem'
                        }}>📋 Copier la relance</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', color: '#8ba5b0', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '0.03em', textTransform: 'uppercase' }
const inputStyle = { width: '100%', padding: '0.65rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }
