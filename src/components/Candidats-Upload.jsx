import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import CVTemplate from './CVTemplate'

export default function Candidats() {
  const [candidats, setCandidats] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCV, setShowCV] = useState(false)
  const [selectedCandidat, setSelectedCandidat] = useState(null)
  const [editingCandidat, setEditingCandidat] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    titre_poste: '',
    experience_annees: 0,
    competences: '',
    technologies: '',
    tjm: 0,
    status: 'dispo',
    diplomes: '',
    synthese: '',
    disponibilite_date: '',
    experiences: []
  })

  useEffect(() => {
    loadCandidats()
  }, [])

  async function loadCandidats() {
    try {
      const { data, error } = await supabase
        .from('candidats')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setCandidats(data || [])
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    // Vérifier le type de fichier
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
    if (!validTypes.includes(file.type)) {
      alert('Format non supporté. Utilisez PDF ou DOCX.')
      return
    }

    setUploading(true)

    try {
      // Convertir en base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Envoyer à l'API de parsing
      const response = await fetch('https://crm-joker-team.vercel.app/api/parse-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64,
          fileType: file.type
        })
      })

      if (!response.ok) {
        throw new Error('Erreur lors du parsing du CV')
      }

      const result = await response.json()
      
      if (result.success && result.data) {
        // Pré-remplir le formulaire avec les données parsées
        setFormData({
          ...formData,
          ...result.data,
          experiences: result.data.experiences || []
        })
        alert('✅ CV analysé avec succès ! Vérifiez les données avant de sauvegarder.')
      } else {
        throw new Error('Données de parsing invalides')
      }
    } catch (error) {
      console.error('Erreur upload:', error)
      alert('❌ Erreur lors de l\'analyse du CV. Veuillez réessayer.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    try {
      const dataToSave = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        titre_poste: formData.titre_poste || null,
        experience_annees: parseInt(formData.experience_annees) || 0,
        competences: formData.competences || null,
        technologies: formData.technologies || null,
        tjm: parseInt(formData.tjm) || 0,
        status: formData.status || 'dispo',
        diplomes: formData.diplomes || null,
        synthese: formData.synthese || null,
        disponibilite_date: formData.disponibilite_date || null,
        experiences: formData.experiences || []
      }

      if (editingCandidat) {
        const { error } = await supabase
          .from('candidats')
          .update(dataToSave)
          .eq('id', editingCandidat.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('candidats')
          .insert([dataToSave])
        
        if (error) throw error
      }

      setShowModal(false)
      setEditingCandidat(null)
      resetForm()
      loadCandidats()
    } catch (error) {
      console.error('Erreur:', error)
      alert(`Erreur: ${error.message}`)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce candidat ?')) return
    
    try {
      const { error } = await supabase
        .from('candidats')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadCandidats()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      email: '',
      phone: '',
      titre_poste: '',
      experience_annees: 0,
      competences: '',
      technologies: '',
      tjm: 0,
      status: 'dispo',
      diplomes: '',
      synthese: '',
      disponibilite_date: '',
      experiences: []
    })
  }

  function openEditModal(candidat) {
    setEditingCandidat(candidat)
    setFormData({
      name: candidat.name || '',
      email: candidat.email || '',
      phone: candidat.phone || '',
      titre_poste: candidat.titre_poste || '',
      experience_annees: candidat.experience_annees || 0,
      competences: candidat.competences || '',
      technologies: candidat.technologies || '',
      tjm: candidat.tjm || 0,
      status: candidat.status || 'dispo',
      diplomes: candidat.diplomes || '',
      synthese: candidat.synthese || '',
      disponibilite_date: candidat.disponibilite_date || '',
      experiences: candidat.experiences || []
    })
    setShowModal(true)
  }

  function openNewCandidatModal() {
    setEditingCandidat(null)
    resetForm()
    setShowModal(true)
  }

  function openCVPreview(candidat) {
    setSelectedCandidat(candidat)
    setShowCV(true)
  }

  function getStatusColor(status) {
    const colors = {
      dispo: { bg: '#dcfce7', text: '#166534' },
      mission: { bg: '#dbeafe', text: '#1e40af' },
      indispo: { bg: '#fee2e2', text: '#991b1b' }
    }
    return colors[status] || colors.dispo
  }

  function getStatusLabel(status) {
    const labels = {
      dispo: 'Disponible',
      mission: 'En mission',
      indispo: 'Indisponible'
    }
    return labels[status] || status
  }

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div></div>
  }

  const candDispos = candidats.filter(c => c.status === 'dispo').length
  const candMission = candidats.filter(c => c.status === 'mission').length

  return (
    <div style={{ padding: '2rem' }}>
      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>👔 Total Candidats</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{candidats.length}</div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>✅ Disponibles</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{candDispos}</div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>💼 En mission</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{candMission}</div>
        </div>
      </div>

      {/* Liste */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1e293b',
            margin: 0
          }}>
            👔 Candidats ({candidats.length})
          </h2>
          <button
            onClick={openNewCandidatModal}
            style={{
              background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Nouveau candidat
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Nom</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Poste</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>TJM</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Exp.</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Statut</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidats.map((candidat, idx) => (
              <tr
                key={candidat.id}
                style={{
                  borderBottom: idx < candidats.length - 1 ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <td style={{ padding: '1rem', fontWeight: 600, color: '#1e293b' }}>{candidat.name}</td>
                <td style={{ padding: '1rem', color: '#64748b' }}>{candidat.titre_poste || '—'}</td>
                <td style={{ padding: '1rem', color: '#64748b' }}>{candidat.tjm ? `${candidat.tjm}€` : '—'}</td>
                <td style={{ padding: '1rem', color: '#64748b' }}>{candidat.experience_annees ? `${candidat.experience_annees} ans` : '—'}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    background: getStatusColor(candidat.status).bg,
                    color: getStatusColor(candidat.status).text,
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    {getStatusLabel(candidat.status)}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => openCVPreview(candidat)}
                      style={{
                        background: '#fef3c7',
                        color: '#854d0e',
                        border: 'none',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      title="Voir CV Joker Team"
                    >
                      📄
                    </button>
                    <button
                      onClick={() => openEditModal(candidat)}
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        border: 'none',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(candidat.id)}
                      style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: 'none',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
          overflow: 'auto',
          padding: '2rem'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '2rem',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #e2e8f0'
            }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#1e293b',
                margin: 0
              }}>
                {editingCandidat ? 'Modifier le candidat' : 'Nouveau candidat'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 0
                }}
              >
                ×
              </button>
            </div>

            {/* Bouton Upload CV */}
            <div style={{
              background: '#f0fdf4',
              border: '2px dashed #86efac',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '0.5rem'
              }}>
                📎
              </div>
              <div style={{
                fontWeight: 600,
                color: '#166534',
                marginBottom: '0.5rem'
              }}>
                Charger un CV pour pré-remplir automatiquement
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: '#15803d',
                marginBottom: '1rem'
              }}>
                PDF ou DOCX • L'IA analysera le CV et remplira les champs
              </div>
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: 'none' }}
                id="cv-upload"
              />
              <label
                htmlFor="cv-upload"
                style={{
                  background: '#10b981',
                  color: '#fff',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: uploading ? 'wait' : 'pointer',
                  fontWeight: 600,
                  display: 'inline-block',
                  opacity: uploading ? 0.7 : 1
                }}
              >
                {uploading ? '⏳ Analyse en cours...' : '📎 Charger un CV'}
              </label>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Titre du poste
                  </label>
                  <input
                    type="text"
                    value={formData.titre_poste}
                    onChange={e => setFormData({...formData, titre_poste: e.target.value})}
                    placeholder="Ex: Consultant Mainframe Senior"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Expérience (années)
                  </label>
                  <input
                    type="number"
                    value={formData.experience_annees}
                    onChange={e => setFormData({...formData, experience_annees: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    TJM (€)
                  </label>
                  <input
                    type="number"
                    value={formData.tjm}
                    onChange={e => setFormData({...formData, tjm: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Compétences (séparées par des virgules)
                  </label>
                  <input
                    type="text"
                    value={formData.competences}
                    onChange={e => setFormData({...formData, competences: e.target.value})}
                    placeholder="Ex: COBOL, Mainframe, DB2, CICS"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Technologies (séparées par des virgules)
                  </label>
                  <input
                    type="text"
                    value={formData.technologies}
                    onChange={e => setFormData({...formData, technologies: e.target.value})}
                    placeholder="Ex: Java, Python, AWS"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Statut
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  >
                    <option value="dispo">Disponible</option>
                    <option value="mission">En mission</option>
                    <option value="indispo">Indisponible</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Disponibilité
                  </label>
                  <input
                    type="date"
                    value={formData.disponibilite_date}
                    onChange={e => setFormData({...formData, disponibilite_date: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Synthèse du profil
                  </label>
                  <textarea
                    value={formData.synthese}
                    onChange={e => setFormData({...formData, synthese: e.target.value})}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '1rem',
                marginTop: '2rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e2e8f0'
              }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: '#fff',
                    color: '#64748b'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
                    color: '#fff'
                  }}
                >
                  {editingCandidat ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal CV Template */}
      {showCV && selectedCandidat && (
        <CVTemplate
          candidat={selectedCandidat}
          onClose={() => setShowCV(false)}
        />
      )}
    </div>
  )
}
