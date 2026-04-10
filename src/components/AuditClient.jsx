import { useState } from 'react'

const RECOMMANDATION_CONFIG = {
  approcher: { label: 'Approcher', color: '#34d399', bg: 'rgba(52,211,153,0.15)', icon: '🟢' },
  attendre: { label: 'Attendre', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🟡' },
  eviter: { label: 'Éviter', color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: '🔴' }
}

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(n)
}

export default function AuditClient() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  async function handleSearch(e) {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const isSiren = /^\d{9,14}$/.test(query.trim().replace(/\s/g, ''))
      const body = isSiren
        ? { siren: query.trim().replace(/\s/g, '') }
        : { query: query.trim() }

      const resp = await fetch('/api/audit-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `Erreur ${resp.status}`)
      }

      const data = await resp.json()
      if (data.success) {
        setResult(data)
        setHistory(prev => [{ query: query.trim(), company: data.company?.nom, date: new Date() }, ...prev.slice(0, 9)])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  const company = result?.company
  const analysis = result?.analysis
  const reco = analysis ? RECOMMANDATION_CONFIG[analysis.recommandation] || RECOMMANDATION_CONFIG.attendre : null

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏦 Audit Client
        </h2>
        <p style={{ color: '#64808b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>
          Analysez la santé financière de vos prospects et leur capacité à allouer du budget IT
        </p>
      </div>

      {/* Search */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#8ba5b0', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Nom de l'entreprise ou SIREN
            </label>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Ex: BNP Paribas, Société Générale, 552120222..."
              style={{
                width: '100%', padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#e2e8f0', fontSize: '0.95rem',
                outline: 'none', boxSizing: 'border-box'
              }} />
          </div>
          <button type="submit" disabled={loading || !query.trim()} style={{
            background: loading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
            border: 'none', borderRadius: '8px', color: '#122a33',
            padding: '0.75rem 2rem', fontWeight: 700, fontSize: '0.95rem',
            cursor: loading ? 'wait' : 'pointer', whiteSpace: 'nowrap'
          }}>
            {loading ? '🔄 Analyse...' : '🔍 Auditer'}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem 1rem',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem'
          }}>{error}</div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ ...card, padding: '3rem', textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <div style={{ color: '#D4AF37', fontSize: '0.95rem', fontWeight: 600 }}>Recherche Pappers + Analyse IA en cours...</div>
          <div style={{ color: '#4a6370', fontSize: '0.78rem', marginTop: '0.3rem' }}>Récupération des données financières officielles</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', animation: 'fadeSlideIn 0.3s ease' }}>

          {/* Company Info */}
          <div style={{ ...card, padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{company.nom}</div>
                <div style={{ fontSize: '0.82rem', color: '#8ba5b0', marginTop: '0.2rem' }}>
                  SIREN: {company.siren} · {company.forme_juridique} · {company.libelle_naf}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#4a6370', marginTop: '0.2rem' }}>
                  📍 {company.adresse} {company.code_postal} {company.ville}
                  {company.date_creation ? ` · 📅 Créée le ${company.date_creation}` : ''}
                  {company.effectif ? ` · 👥 ${company.effectif} salariés` : ''}
                  {company.capital ? ` · 💰 Capital: ${fmt(company.capital)}€` : ''}
                </div>
              </div>

              {/* AI Score */}
              {analysis && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto' }}>
                    <svg width="90" height="90" viewBox="0 0 90 90">
                      <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                      <circle cx="45" cy="45" r="38" fill="none"
                        stroke={analysis.score_sante >= 70 ? '#34d399' : analysis.score_sante >= 40 ? '#f59e0b' : '#f87171'}
                        strokeWidth="7"
                        strokeDasharray={`${(analysis.score_sante / 100) * 239} 239`}
                        strokeLinecap="round" transform="rotate(-90 45 45)" />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: analysis.score_sante >= 70 ? '#34d399' : analysis.score_sante >= 40 ? '#f59e0b' : '#f87171' }}>
                        {analysis.score_sante}
                      </div>
                      <div style={{ fontSize: '0.55rem', color: '#64808b' }}>/100</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8ba5b0', marginTop: '0.3rem' }}>
                    {analysis.niveau}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dirigeants */}
          {company.dirigeants?.length > 0 && (
            <div style={{ ...card, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#D4AF37', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                👤 Dirigeants
              </div>
              {company.dirigeants.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0',
                  borderBottom: i < company.dirigeants.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  fontSize: '0.82rem'
                }}>
                  <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{d.nom}</span>
                  <span style={{ color: '#64808b', fontSize: '0.75rem' }}>{d.qualite}</span>
                </div>
              ))}
            </div>
          )}

          {/* Finances */}
          <div style={{ ...card, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📊 Données financières
            </div>
            {company.finances?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: '0.7rem', color: '#4a6370', padding: '0.3rem 0', fontWeight: 600 }}>Année</th>
                    <th style={{ textAlign: 'right', fontSize: '0.7rem', color: '#4a6370', padding: '0.3rem 0', fontWeight: 600 }}>CA</th>
                    <th style={{ textAlign: 'right', fontSize: '0.7rem', color: '#4a6370', padding: '0.3rem 0', fontWeight: 600 }}>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {company.finances.map((f, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.4rem 0', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600 }}>{f.annee}</td>
                      <td style={{ padding: '0.4rem 0', fontSize: '0.82rem', color: '#D4AF37', fontWeight: 600, textAlign: 'right' }}>
                        {f.chiffre_affaires ? `${fmt(f.chiffre_affaires)}€` : '—'}
                      </td>
                      <td style={{
                        padding: '0.4rem 0', fontSize: '0.82rem', fontWeight: 600, textAlign: 'right',
                        color: f.resultat > 0 ? '#34d399' : f.resultat < 0 ? '#f87171' : '#8ba5b0'
                      }}>
                        {f.resultat !== null ? `${fmt(f.resultat)}€` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#4a6370', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>
                Données financières non disponibles (non déposées ou confidentielles)
              </div>
            )}
          </div>

          {/* AI Analysis */}
          {analysis && (
            <>
              {/* Recommandation */}
              <div style={{ ...card, padding: '1.25rem', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{
                    padding: '0.5rem 1.2rem', borderRadius: '10px', fontSize: '1rem',
                    fontWeight: 700, color: reco.color, background: reco.bg,
                    display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}>
                    {reco.icon} {reco.label}
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '0.88rem', color: '#f1f5f9', fontWeight: 500 }}>{analysis.recommandation_detail}</div>
                  </div>
                  {analysis.capacite_budget_it && (
                    <div style={{
                      background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
                      borderRadius: '10px', padding: '0.6rem 1rem', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.65rem', color: '#8ba5b0', textTransform: 'uppercase' }}>Budget IT estimé</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#D4AF37' }}>{analysis.capacite_budget_it}</div>
                    </div>
                  )}
                  {analysis.tjm_max_estime && (
                    <div style={{
                      background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                      borderRadius: '10px', padding: '0.6rem 1rem', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.65rem', color: '#8ba5b0', textTransform: 'uppercase' }}>TJM max estimé</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#60a5fa' }}>{analysis.tjm_max_estime}€/j</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Analyse détaillée */}
              <div style={{ ...card, padding: '1.25rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💡 Analyse IA
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.7 }}>{analysis.analyse}</div>
              </div>

              {/* Risques & Opportunités */}
              <div style={{ ...card, padding: '1.25rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    ⚠️ Risques
                  </div>
                  {(analysis.risques || []).map((r, i) => (
                    <div key={i} style={{
                      padding: '0.35rem 0.6rem', marginBottom: '0.3rem',
                      background: 'rgba(248,113,113,0.06)', borderRadius: '6px',
                      fontSize: '0.78rem', color: '#fca5a5',
                      borderLeft: '3px solid rgba(248,113,113,0.3)'
                    }}>{r}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    🚀 Opportunités
                  </div>
                  {(analysis.opportunites || []).map((o, i) => (
                    <div key={i} style={{
                      padding: '0.35rem 0.6rem', marginBottom: '0.3rem',
                      background: 'rgba(52,211,153,0.06)', borderRadius: '6px',
                      fontSize: '0.78rem', color: '#6ee7b7',
                      borderLeft: '3px solid rgba(52,211,153,0.3)'
                    }}>{o}</div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && !loading && (
        <div style={{ ...card, padding: '1.25rem', marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#8ba5b0', marginBottom: '0.5rem' }}>
            🕐 Recherches récentes
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {history.map((h, i) => (
              <button key={i} onClick={() => { setQuery(h.query); }} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '6px', padding: '0.3rem 0.7rem',
                color: '#8ba5b0', fontSize: '0.75rem', cursor: 'pointer'
              }}>{h.company || h.query}</button>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}
