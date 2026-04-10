import { useState } from 'react'

export default function DossierCompetences({ candidat, mission, onClose }) {
  const [dossier, setDossier] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generateDossier() {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/generate-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidat, mission })
      })
      if (!resp.ok) throw new Error(`Erreur API: ${resp.status}`)
      const data = await resp.json()
      if (data.success && data.dossier) {
        setDossier(data.dossier)
      } else {
        throw new Error(data.error || 'Erreur de génération')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function printPDF() {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Dossier - ${candidat?.name || 'Candidat'}</title>
<style>
  @page { margin: 20mm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.6; }
  .header { background: linear-gradient(135deg, #122a33, #1a3a45); color: white; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header-left h1 { font-size: 22px; color: #D4AF37; margin-bottom: 4px; }
  .header-left p { font-size: 13px; color: #94a3b8; }
  .logo { text-align: right; }
  .logo .brand { font-size: 18px; font-weight: 700; color: #D4AF37; }
  .logo .tagline { font-size: 10px; color: #8ba5b0; }
  .section { padding: 20px 40px; }
  .section-title { font-size: 14px; font-weight: 700; color: #122a33; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #D4AF37; padding-bottom: 6px; margin-bottom: 14px; }
  .resume { font-size: 13px; color: #475569; line-height: 1.7; background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #D4AF37; }
  .skills-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .skill-cat { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; }
  .skill-cat h4 { font-size: 12px; color: #122a33; margin-bottom: 6px; text-transform: uppercase; }
  .skill-cat .tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .skill-cat .tag { background: #122a33; color: #D4AF37; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .exp-item { margin-bottom: 16px; padding: 14px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #60a5fa; }
  .exp-item h4 { font-size: 13px; color: #122a33; }
  .exp-item .meta { font-size: 11px; color: #64748b; margin: 4px 0 8px; }
  .exp-item p { font-size: 12px; color: #475569; }
  .exp-item .tech { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .exp-item .tech span { background: #e2e8f0; padding: 2px 8px; border-radius: 3px; font-size: 10px; color: #334155; }
  .points { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .point { background: linear-gradient(135deg, #122a33, #1a3a45); color: #D4AF37; padding: 12px; border-radius: 8px; font-size: 12px; text-align: center; font-weight: 600; }
  .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; margin-top: 20px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
  .info-item { font-size: 12px; color: #475569; }
  .info-item strong { color: #122a33; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${dossier.titre || candidat?.name || 'Profil Candidat'}</h1>
      <p>${candidat?.titre_poste || ''} ${candidat?.tjm ? '· TJM: ' + candidat.tjm + '€/jour' : ''}</p>
    </div>
    <div class="logo">
      <div class="brand">JOKER TEAM</div>
      <div class="tagline">La carte pour réussir</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Profil</div>
    <div class="resume">${dossier.resume || ''}</div>
    <div class="info-grid">
      <div class="info-item"><strong>Disponibilité :</strong> ${candidat?.status === 'disponible' ? 'Immédiate' : candidat?.status === 'en_mission' ? 'En mission' : 'À confirmer'}</div>
      <div class="info-item"><strong>Expérience :</strong> ${candidat?.experience_annees || '—'} ans</div>
      ${dossier.langues ? '<div class="info-item"><strong>Langues :</strong> ' + dossier.langues.join(', ') + '</div>' : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Compétences techniques</div>
    <div class="skills-grid">
      ${(dossier.competences_techniques || []).map(cat => `
        <div class="skill-cat">
          <h4>${cat.categorie}</h4>
          <div class="tags">${(cat.items || []).map(i => `<span class="tag">${i}</span>`).join('')}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Expériences professionnelles</div>
    ${(dossier.experiences || []).map(exp => `
      <div class="exp-item">
        <h4>${exp.poste}</h4>
        <div class="meta">${exp.client || ''} ${exp.duree ? '· ' + exp.duree : ''}</div>
        <p>${exp.description || ''}</p>
        <div class="tech">${(exp.technologies || []).map(t => `<span>${t}</span>`).join('')}</div>
      </div>
    `).join('')}
  </div>

  ${dossier.formation && dossier.formation.length > 0 ? `
  <div class="section">
    <div class="section-title">Formation & Certifications</div>
    <ul style="padding-left: 20px; font-size: 12px; color: #475569;">
      ${dossier.formation.map(f => `<li style="margin-bottom: 4px;">${f}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  ${dossier.points_forts && dossier.points_forts.length > 0 ? `
  <div class="section">
    <div class="section-title">Points forts</div>
    <div class="points">
      ${dossier.points_forts.map(p => `<div class="point">${p}</div>`).join('')}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    Document généré par CRM Joker Team · ${new Date().toLocaleDateString('fr-FR')} · Confidentiel
  </div>
</body>
</html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 500)
  }

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        ...card, width: '100%', maxWidth: '700px', maxHeight: '90vh',
        overflowY: 'auto', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              📄 Dossier de compétences
            </h3>
            <div style={{ fontSize: '0.82rem', color: '#D4AF37', marginTop: '0.2rem' }}>
              {candidat?.name} {candidat?.titre_poste ? `· ${candidat.titre_poste}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64808b',
            fontSize: '1.4rem', cursor: 'pointer'
          }}>×</button>
        </div>

        {/* Not generated yet */}
        {!dossier && !loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
            <div style={{ color: '#8ba5b0', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              Générer un dossier de compétences professionnel
            </div>
            <div style={{ color: '#4a6370', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
              L'IA va créer un document PDF aux couleurs Joker Team avec le profil, les compétences, les expériences et les points forts du candidat.
            </div>
            {mission && (
              <div style={{
                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem',
                fontSize: '0.82rem', color: '#60a5fa'
              }}>
                💼 Ciblé pour la mission : <strong>{mission.name}</strong>
              </div>
            )}

            {error && (
              <div style={{
                padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                color: '#fca5a5', fontSize: '0.82rem', marginBottom: '1rem'
              }}>{error}</div>
            )}

            <button onClick={generateDossier} style={{
              background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
              border: 'none', borderRadius: '10px', color: '#122a33',
              padding: '0.85rem 2.5rem', fontWeight: 700, fontSize: '0.95rem',
              cursor: 'pointer'
            }}>✨ Générer le dossier</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{
              width: 50, height: 50, border: '3px solid rgba(212,175,55,0.2)',
              borderTopColor: '#D4AF37', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem'
            }} />
            <div style={{ color: '#D4AF37', fontSize: '0.95rem', fontWeight: 600 }}>
              Génération du dossier en cours...
            </div>
            <div style={{ color: '#4a6370', fontSize: '0.78rem', marginTop: '0.3rem' }}>
              L'IA analyse le profil et crée le document
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Generated preview */}
        {dossier && !loading && (
          <>
            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button onClick={printPDF} style={{
                background: 'linear-gradient(135deg, #D4AF37, #c9a02e)',
                border: 'none', borderRadius: '8px', color: '#122a33',
                padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.88rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}>📥 Télécharger PDF</button>
              <button onClick={generateDossier} style={{
                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                color: '#60a5fa', padding: '0.6rem 1rem', borderRadius: '8px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
              }}>🔄 Régénérer</button>
            </div>

            {/* Preview */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden'
            }}>
              {/* Preview header */}
              <div style={{
                background: 'linear-gradient(135deg, #122a33, #1a3a45)',
                padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#D4AF37' }}>{dossier.titre}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8ba5b0', marginTop: '0.2rem' }}>
                    {candidat?.titre_poste} {candidat?.tjm ? `· TJM: ${candidat.tjm}€/jour` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#D4AF37' }}>JOKER TEAM</div>
                  <div style={{ fontSize: '0.6rem', color: '#64808b' }}>La carte pour réussir</div>
                </div>
              </div>

              <div style={{ padding: '1.25rem 1.5rem' }}>
                {/* Resume */}
                <div style={{
                  background: 'rgba(212,175,55,0.05)', borderLeft: '3px solid #D4AF37',
                  padding: '0.85rem 1rem', borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: '1.25rem'
                }}>{dossier.resume}</div>

                {/* Compétences */}
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                  Compétences techniques
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {(dossier.competences_techniques || []).map((cat, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem',
                      border: '1px solid rgba(255,255,255,0.04)'
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#8ba5b0', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        {cat.categorie}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {(cat.items || []).map((item, j) => (
                          <span key={j} style={{
                            padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem',
                            fontWeight: 600, background: 'rgba(212,175,55,0.12)', color: '#D4AF37',
                            border: '1px solid rgba(212,175,55,0.2)'
                          }}>{item}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Expériences */}
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                  Expériences
                </div>
                {(dossier.experiences || []).map((exp, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.85rem',
                    border: '1px solid rgba(255,255,255,0.04)', borderLeft: '3px solid #60a5fa',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>{exp.poste}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64808b', marginBottom: '0.4rem' }}>
                      {exp.client} {exp.duree ? `· ${exp.duree}` : ''}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.6 }}>{exp.description}</div>
                    {exp.technologies?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.4rem' }}>
                        {exp.technologies.map((t, j) => (
                          <span key={j} style={{
                            padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.65rem',
                            background: 'rgba(96,165,250,0.1)', color: '#60a5fa'
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Points forts */}
                {dossier.points_forts?.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', marginTop: '1rem' }}>
                      Points forts
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                      {dossier.points_forts.map((p, i) => (
                        <div key={i} style={{
                          background: 'linear-gradient(135deg, rgba(18,42,51,0.8), rgba(26,58,69,0.7))',
                          borderRadius: '8px', padding: '0.65rem', textAlign: 'center',
                          fontSize: '0.72rem', fontWeight: 600, color: '#D4AF37',
                          border: '1px solid rgba(212,175,55,0.15)'
                        }}>{p}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{
                textAlign: 'center', padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)',
                fontSize: '0.65rem', color: '#3a5560'
              }}>
                Document généré par CRM Joker Team · {new Date().toLocaleDateString('fr-FR')} · Confidentiel
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
