import React from 'react'

export default function CVTemplate({ candidat, onClose }) {
  // Données du candidat avec fallbacks
  const {
    name = 'Nom du candidat',
    email = 'email@example.com',
    phone = '06.00.00.00.00',
    titre_poste = 'Consultant',
    experience_annees = 0,
    competences = '',
    technologies = '',
    tjm = 0,
    diplomes = '',
    synthese = '',
    experiences = []
  } = candidat || {}

  const handlePrint = () => {
    window.print()
  }

  return (
    <div id="cv-template" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      zIndex: 2000,
      overflow: 'auto',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '210mm',
        margin: '0 auto',
        background: '#fff',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Boutons d'action */}
        <div style={{
          background: '#f8fafc',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          borderBottom: '1px solid #e2e8f0'
        }} className="no-print">
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#64748b',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            ✕ Fermer
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            💾 Télécharger PDF
          </button>
        </div>

        {/* Header avec motif géométrique */}
        <div style={{
          background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
          position: 'relative',
          height: '200px',
          overflow: 'hidden'
        }}>
          {/* Motif géométrique */}
          <svg style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.3
          }}>
            <defs>
              <pattern id="network" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="2" fill="#D4AF37" />
                <circle cx="90" cy="30" r="2" fill="#D4AF37" />
                <circle cx="50" cy="70" r="2" fill="#D4AF37" />
                <circle cx="30" cy="90" r="2" fill="#D4AF37" />
                <line x1="10" y1="10" x2="90" y2="30" stroke="#D4AF37" strokeWidth="1" />
                <line x1="90" y1="30" x2="50" y2="70" stroke="#D4AF37" strokeWidth="1" />
                <line x1="50" y1="70" x2="30" y2="90" stroke="#D4AF37" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#network)" />
          </svg>

          {/* Logo Joker Team */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            paddingTop: '3rem'
          }}>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: '#D4AF37',
              letterSpacing: '2px',
              marginBottom: '0.5rem'
            }}>
              🃏 JOKER TEAM
            </div>
            <div style={{
              fontSize: '0.9rem',
              color: '#D4AF37',
              letterSpacing: '3px',
              fontWeight: 300
            }}>
              LA CARTE POUR RÉUSSIR
            </div>
          </div>

          {/* Coordonnées en haut à droite */}
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '2rem',
            textAlign: 'right',
            color: '#fff',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            zIndex: 2
          }}>
            <div>{email}</div>
            <div>{phone}</div>
            <div>www.joker-team.fr</div>
          </div>
        </div>

        {/* Contenu du CV */}
        <div style={{ padding: '2rem 3rem' }}>
          
          {/* Titre du poste */}
          <div style={{
            border: '2px solid #1e293b',
            padding: '1rem',
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            <h1 style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: '#1e293b',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              {titre_poste}
            </h1>
          </div>

          {/* Informations */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: '#2C4F5A',
              marginBottom: '1rem',
              textTransform: 'uppercase'
            }}>
              INFORMATIONS
            </h2>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.8 }}>
              <div><strong>Poste :</strong> {titre_poste}</div>
              <div><strong>Expérience :</strong> +{experience_annees} ans</div>
              {tjm > 0 && <div><strong>TJM :</strong> {tjm}€</div>}
            </div>
          </div>

          {/* Synthèse si disponible */}
          {synthese && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#2C4F5A',
                marginBottom: '1rem',
                textTransform: 'uppercase'
              }}>
                PROFIL
              </h2>
              <p style={{ 
                fontSize: '0.9rem', 
                lineHeight: 1.6,
                margin: 0,
                textAlign: 'justify'
              }}>
                {synthese}
              </p>
            </div>
          )}

          {/* Savoir-faire */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: '#2C4F5A',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              borderBottom: '2px solid #2C4F5A',
              paddingBottom: '0.5rem'
            }}>
              SAVOIR-FAIRE
            </h2>
            
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '0.85rem'
            }}>
              <tbody>
                {competences && (
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{
                      padding: '0.75rem',
                      fontWeight: 700,
                      width: '40%',
                      verticalAlign: 'top',
                      background: '#f8fafc'
                    }}>
                      Compétences principales
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                      {competences.split(',').map((comp, idx) => (
                        <div key={idx} style={{ marginBottom: '0.25rem' }}>
                          • {comp.trim()}
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
                
                {technologies && (
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{
                      padding: '0.75rem',
                      fontWeight: 700,
                      width: '40%',
                      verticalAlign: 'top',
                      background: '#f8fafc'
                    }}>
                      Technologies
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                      {technologies.split(',').map((tech, idx) => (
                        <div key={idx} style={{ marginBottom: '0.25rem' }}>
                          • {tech.trim()}
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Formation */}
          {diplomes && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#2C4F5A',
                marginBottom: '1rem',
                textTransform: 'uppercase',
                borderBottom: '2px solid #2C4F5A',
                paddingBottom: '0.5rem'
              }}>
                FORMATION & LANGUES
              </h2>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.8 }}>
                {diplomes.split(',').map((diplome, idx) => (
                  <div key={idx} style={{ marginBottom: '0.5rem' }}>
                    <strong>{diplome.trim()}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expériences */}
          {experiences && experiences.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#2C4F5A',
                marginBottom: '1rem',
                textTransform: 'uppercase',
                borderBottom: '2px solid #2C4F5A',
                paddingBottom: '0.5rem'
              }}>
                EXPÉRIENCES PROFESSIONNELLES
              </h2>

              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                border: '1px solid #1e293b'
              }}>
                <thead>
                  <tr style={{ background: '#2C4F5A', color: '#fff' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #1e293b' }}>Société</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #1e293b' }}>Poste</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #1e293b' }}>Période</th>
                  </tr>
                </thead>
              </table>

              {experiences.map((exp, idx) => (
                <div key={idx} style={{
                  border: '1px solid #e2e8f0',
                  padding: '1rem',
                  marginBottom: '1rem',
                  pageBreakInside: 'avoid'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#2C4F5A' }}>
                      {exp.entreprise} | {exp.poste} | {exp.periode}
                    </strong>
                  </div>
                  
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Activité</div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line'
                    }}>
                      {exp.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '2px solid #2C4F5A',
          padding: '1.5rem 3rem',
          textAlign: 'center',
          background: '#f8fafc'
        }}>
          <div style={{ 
            color: '#2C4F5A', 
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '0.25rem'
          }}>
            <a href={`mailto:${email}`} style={{ color: '#2C4F5A', textDecoration: 'none' }}>
              {email}
            </a>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {phone}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
            www.joker-team.fr
          </div>
        </div>
      </div>

      {/* Styles pour l'impression */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          #cv-template {
            position: static !important;
            background: white !important;
            padding: 0 !important;
          }
          
          @page {
            size: A4;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  )
}
