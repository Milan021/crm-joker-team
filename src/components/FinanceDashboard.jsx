import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function FinanceDashboard() {
  const [opportunites, setOpportunites] = useState([])
  const [facturations, setFacturations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [detailOpp, setDetailOpp] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [oppRes, factRes] = await Promise.all([
        supabase.from('opportunites').select('*').in('status', ['gagne', 'archivee']),
        supabase.from('facturations_mensuelles').select('*').order('mois', { ascending: true })
      ])
      if (oppRes.data) setOpportunites(oppRes.data)
      if (factRes.data) setFacturations(factRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function fmt(n) { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0) }

  // ——— Calculs financiers ———
  const archivees = opportunites.filter(o => o.status === 'archivee')
  const gagnees = opportunites.filter(o => o.status === 'gagne')

  // CA réel encaissé = somme des ca_reel des archivées + facturations mensuelles des gagnées
  const caArchive = archivees.reduce((s, o) => s + (o.ca_reel || 0), 0)
  const caFacture = facturations.reduce((s, f) => s + (f.montant_facture || 0), 0)
  const caTotal = caArchive + caFacture

  // Marge totale
  const margeArchive = archivees.reduce((s, o) => s + (o.marge_reelle || 0), 0)
  const margeFacture = facturations.reduce((s, f) => {
    const opp = opportunites.find(o => o.id === f.opportunite_id)
    if (!opp) return s
    const margeJour = (opp.tjm_client || 0) - (opp.tjm_freelance || 0)
    return s + (margeJour * (f.nb_jours || 0))
  }, 0)
  const margeTotal = margeArchive + margeFacture
  const tauxMarge = caTotal > 0 ? Math.round(margeTotal / caTotal * 100) : 0

  // Montant initial total (des affaires gagnées actives)
  const montantInitialGagne = gagnees.reduce((s, o) => s + (o.montant || 0), 0)
  const factureGagne = facturations
    .filter(f => gagnees.some(o => o.id === f.opportunite_id))
    .reduce((s, f) => s + (f.montant_facture || 0), 0)
  const resteAFacturer = montantInitialGagne - factureGagne

  // Par mois (année sélectionnée)
  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const parMois = moisLabels.map((label, i) => {
    const moisStart = `${selectedYear}-${String(i + 1).padStart(2, '0')}`
    const factMois = facturations.filter(f => f.mois && f.mois.startsWith(moisStart))
    const ca = factMois.reduce((s, f) => s + (f.montant_facture || 0), 0)
    const marge = factMois.reduce((s, f) => {
      const opp = opportunites.find(o => o.id === f.opportunite_id)
      if (!opp) return s
      return s + ((opp.tjm_client || 0) - (opp.tjm_freelance || 0)) * (f.nb_jours || 0)
    }, 0)
    // Ajouter les archivées du mois
    const archMois = archivees.filter(o => o.archived_at && o.archived_at.startsWith(moisStart))
    const caArch = archMois.reduce((s, o) => s + (o.ca_reel || 0), 0)
    const margeArch = archMois.reduce((s, o) => s + (o.marge_reelle || 0), 0)
    return { label, ca: ca + caArch, marge: marge + margeArch }
  })
  const maxMois = Math.max(...parMois.map(m => m.ca), 1)

  // Par dossier
  const parDossier = [...gagnees, ...archivees].map(opp => {
    const factOpp = facturations.filter(f => f.opportunite_id === opp.id)
    const totalFacture = factOpp.reduce((s, f) => s + (f.montant_facture || 0), 0)
    const totalJours = factOpp.reduce((s, f) => s + (f.nb_jours || 0), 0)
    const montantInitial = opp.montant || 0
    const margeJour = (opp.tjm_client || 0) - (opp.tjm_freelance || 0)
    const margeTotale = opp.status === 'archivee' ? (opp.marge_reelle || 0) : (margeJour * totalJours)
    const reste = opp.status === 'archivee' ? 0 : (montantInitial - totalFacture)
    const pct = montantInitial > 0 ? Math.min(Math.round(totalFacture / montantInitial * 100), 100) : 0
    return { ...opp, _totalFacture: totalFacture + (opp.status === 'archivee' ? (opp.ca_reel || 0) : 0), _totalJours: totalJours, _marge: margeTotale, _reste: reste, _pct: pct, _factMois: factOpp }
  }).sort((a, b) => (b._totalFacture || 0) - (a._totalFacture || 0))

  // Années disponibles
  const years = [...new Set([
    ...facturations.map(f => f.mois ? new Date(f.mois).getFullYear() : null),
    ...archivees.map(o => o.archived_at ? new Date(o.archived_at).getFullYear() : null),
    new Date().getFullYear()
  ].filter(Boolean))].sort((a, b) => b - a)

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#64808b' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
      Chargement des données financières...
    </div>
  )

  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#e2e8f0', fontWeight: 700 }}>
            💰 Suivi Financier
          </h2>
          <div style={{ color: '#64808b', fontSize: '0.78rem', marginTop: '0.2rem' }}>
            {archivees.length} archivée{archivees.length > 1 ? 's' : ''} · {gagnees.length} en cours
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)} style={{
              padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: selectedYear === y ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)',
              color: selectedYear === y ? '#D4AF37' : '#64808b', fontSize: '0.8rem', fontWeight: 600
            }}>{y}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'CA Encaissé', value: `${fmt(caTotal)}€`, icon: '💵', color: '#34d399' },
          { label: 'Marge Totale', value: `${fmt(margeTotal)}€`, icon: '📈', color: '#D4AF37', sub: `${tauxMarge}% de marge` },
          { label: 'Reste à Facturer', value: `${fmt(resteAFacturer)}€`, icon: '⏳', color: '#f59e0b' },
          { label: 'Dossiers Actifs', value: gagnees.length, icon: '📂', color: '#60a5fa' }
        ].map((kpi, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px', padding: '1.1rem', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-8px', right: '-8px', fontSize: '3rem', opacity: 0.06 }}>{kpi.icon}</div>
            <div style={{ fontSize: '0.72rem', color: '#64808b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{kpi.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: kpi.color, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</div>
            {kpi.sub && <div style={{ fontSize: '0.7rem', color: kpi.color, opacity: 0.7, marginTop: '0.2rem' }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Graphique barres par mois */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '1.2rem', marginBottom: '1.5rem'
      }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
          📊 CA & Marge par mois — {selectedYear}
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.35rem', height: '160px', padding: '0 0.5rem' }}>
          {parMois.map((m, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', height: '100%', justifyContent: 'flex-end' }}>
              {m.ca > 0 && (
                <div style={{ fontSize: '0.6rem', color: '#34d399', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {m.ca >= 1000 ? `${Math.round(m.ca / 1000)}k` : fmt(m.ca)}
                </div>
              )}
              <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end' }}>
                {/* Barre CA */}
                <div style={{
                  flex: 1, borderRadius: '4px 4px 0 0',
                  background: 'linear-gradient(180deg, #34d399, rgba(52,211,153,0.4))',
                  height: `${Math.max(m.ca / maxMois * 130, m.ca > 0 ? 4 : 0)}px`,
                  transition: 'height 0.5s ease'
                }} />
                {/* Barre Marge */}
                <div style={{
                  flex: 1, borderRadius: '4px 4px 0 0',
                  background: 'linear-gradient(180deg, #D4AF37, rgba(212,175,55,0.4))',
                  height: `${Math.max(m.marge / maxMois * 130, m.marge > 0 ? 4 : 0)}px`,
                  transition: 'height 0.5s ease'
                }} />
              </div>
              <div style={{ fontSize: '0.65rem', color: '#4a6370', fontWeight: 500 }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: '#64808b' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#34d399' }} /> CA facturé
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: '#64808b' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#D4AF37' }} /> Marge
          </div>
        </div>
      </div>

      {/* Tableau par dossier */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '1.2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
          📂 Détail par dossier
        </h3>
        {parDossier.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#4a6370', fontSize: '0.85rem' }}>
            Aucune affaire gagnée ou archivée pour le moment
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {parDossier.map(opp => (
              <div key={opp.id} onClick={() => setDetailOpp(detailOpp?.id === opp.id ? null : opp)}
                style={{
                  background: detailOpp?.id === opp.id ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${detailOpp?.id === opp.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)'}`,
                  borderRadius: '10px', padding: '0.9rem', cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                {/* Ligne principale */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                      {opp.status === 'archivee' ? '📦' : '🟢'} {opp.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#4a6370', marginTop: '0.15rem' }}>
                      {opp.freelance_name && `${opp.freelance_name} · `}
                      TJM Client: {fmt(opp.tjm_client || opp.tjm)}€ 
                      {opp.tjm_freelance ? ` · Freelance: ${fmt(opp.tjm_freelance)}€` : ''}
                      {opp.tjm_client && opp.tjm_freelance ? ` · Marge/j: ${fmt((opp.tjm_client || 0) - (opp.tjm_freelance || 0))}€` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>{fmt(opp._totalFacture)}€</div>
                    <div style={{ fontSize: '0.68rem', color: '#D4AF37' }}>Marge: {fmt(opp._marge)}€</div>
                  </div>
                  {opp.status !== 'archivee' && opp.montant > 0 && (
                    <div style={{ width: '80px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64808b', marginBottom: '0.2rem' }}>
                        <span>{opp._pct}%</span>
                        <span>Reste: {fmt(opp._reste)}€</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${opp._pct}%`, height: '100%', borderRadius: '3px',
                          background: opp._pct >= 80 ? '#34d399' : opp._pct >= 50 ? '#D4AF37' : '#f59e0b',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  )}
                  {opp.status === 'archivee' && (
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem',
                      background: 'rgba(148,163,184,0.15)', color: '#94a3b8', fontWeight: 500
                    }}>Archivée</span>
                  )}
                </div>

                {/* Détail facturations mensuelles (toggle) */}
                {detailOpp?.id === opp.id && (
                  <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {opp._factMois.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                        {opp._factMois.sort((a, b) => a.mois.localeCompare(b.mois)).map(f => {
                          const d = new Date(f.mois)
                          const margeJ = (opp.tjm_client || 0) - (opp.tjm_freelance || 0)
                          return (
                            <div key={f.id} style={{
                              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: '8px', padding: '0.6rem'
                            }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8ba5b0', marginBottom: '0.3rem' }}>
                                {d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                              </div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#34d399' }}>{fmt(f.montant_facture)}€</div>
                              <div style={{ fontSize: '0.65rem', color: '#4a6370', marginTop: '0.15rem' }}>
                                {f.nb_jours}j {f.mode === 'auto' ? '(auto)' : '(manuel)'} · Marge: {fmt(margeJ * (f.nb_jours || 0))}€
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: '#4a6370', textAlign: 'center', padding: '0.5rem' }}>
                        {opp.status === 'archivee' ? 'Dossier archivé — CA et marge saisis à l\'archivage' : 'Aucune facturation mensuelle enregistrée'}
                      </div>
                    )}
                    {opp.archive_notes && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64808b', fontStyle: 'italic' }}>
                        📝 {opp.archive_notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
