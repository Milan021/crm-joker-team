import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [expandedCompanies, setExpandedCompanies] = useState(new Set())
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    position: '',
    email: '',
    phone: '',
    status: 'prospect',
    notes: ''
  })

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('company', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // Grouper les contacts par entreprise
  function groupContactsByCompany() {
    const grouped = {}
    contacts.forEach(contact => {
      const company = contact.company || 'Sans entreprise'
      if (!grouped[company]) {
        grouped[company] = []
      }
      grouped[company].push(contact)
    })
    return grouped
  }

  function toggleCompany(companyName) {
    const newExpanded = new Set(expandedCompanies)
    if (newExpanded.has(companyName)) {
      newExpanded.delete(companyName)
    } else {
      newExpanded.add(companyName)
    }
    setExpandedCompanies(newExpanded)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    try {
      const dataToSave = {
        name: formData.name,
        company: formData.company || null,
        position: formData.position || null,
        email: formData.email || null,
        phone: formData.phone || null,
        status: formData.status || 'prospect',
        notes: formData.notes || null
      }

      if (editingContact) {
        const { error } = await supabase
          .from('contacts')
          .update(dataToSave)
          .eq('id', editingContact.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert([dataToSave])
        
        if (error) throw error
      }

      setShowModal(false)
      setEditingContact(null)
      resetForm()
      loadContacts()
    } catch (error) {
      console.error('Erreur:', error)
      alert(`Erreur lors de la sauvegarde: ${error.message}`)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce contact ?')) return
    
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadContacts()
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la suppression')
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      company: '',
      position: '',
      email: '',
      phone: '',
      status: 'prospect',
      notes: ''
    })
  }

  function openEditModal(contact) {
    setEditingContact(contact)
    setFormData({
      name: contact.name || '',
      company: contact.company || '',
      position: contact.position || '',
      email: contact.email || '',
      phone: contact.phone || '',
      status: contact.status || 'prospect',
      notes: contact.notes || ''
    })
    setShowModal(true)
  }

  function openNewContactModal() {
    setEditingContact(null)
    resetForm()
    setShowModal(true)
  }

  function getStatusColor(status) {
    const colors = {
      client: { bg: '#dcfce7', text: '#166534' },
      prospect: { bg: '#dbeafe', text: '#1e40af' },
      inactif: { bg: '#fee2e2', text: '#991b1b' }
    }
    return colors[status] || colors.prospect
  }

  function getStatusLabel(status) {
    const labels = {
      client: 'Client',
      prospect: 'Prospect',
      inactif: 'Inactif'
    }
    return labels[status] || status
  }

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div></div>
  }

  const totalClients = contacts.filter(c => c.status === 'client').length
  const totalProspects = contacts.filter(c => c.status === 'prospect').length
  const groupedContacts = groupContactsByCompany()
  const companies = Object.keys(groupedContacts).sort()

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
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>👥 Total Contacts</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{contacts.length}</div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>✅ Clients</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{totalClients}</div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>🎯 Prospects</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{totalProspects}</div>
        </div>
      </div>

      {/* Header */}
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
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            👥 Contacts ({contacts.length})
          </h2>
          <button
            onClick={openNewContactModal}
            style={{
              background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            + Nouveau contact
          </button>
        </div>

        {/* Liste des entreprises */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {companies.map(companyName => {
            const companyContacts = groupedContacts[companyName]
            const isExpanded = expandedCompanies.has(companyName)
            
            return (
              <div
                key={companyName}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                {/* En-tête entreprise */}
                <div
                  onClick={() => toggleCompany(companyName)}
                  style={{
                    background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
                    padding: '1rem 1.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <span style={{
                      fontSize: '1.5rem',
                      transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                    }}>
                      ▶
                    </span>
                    <span style={{
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color: '#fff'
                    }}>
                      🏢 {companyName}
                    </span>
                    <span style={{
                      background: '#D4AF37',
                      color: '#000',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}>
                      {companyContacts.length} contact{companyContacts.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Contacts de l'entreprise */}
                {isExpanded && (
                  <div style={{
                    background: '#fff'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <tr>
                          <th style={{
                            padding: '1rem',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#475569',
                            fontSize: '0.9rem'
                          }}>
                            Nom
                          </th>
                          <th style={{
                            padding: '1rem',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#475569',
                            fontSize: '0.9rem'
                          }}>
                            Position
                          </th>
                          <th style={{
                            padding: '1rem',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#475569',
                            fontSize: '0.9rem'
                          }}>
                            Email
                          </th>
                          <th style={{
                            padding: '1rem',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#475569',
                            fontSize: '0.9rem'
                          }}>
                            Téléphone
                          </th>
                          <th style={{
                            padding: '1rem',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#475569',
                            fontSize: '0.9rem'
                          }}>
                            Statut
                          </th>
                          <th style={{
                            padding: '1rem',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#475569',
                            fontSize: '0.9rem'
                          }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyContacts.map((contact, idx) => (
                          <tr
                            key={contact.id}
                            style={{
                              borderBottom: idx < companyContacts.length - 1 ? '1px solid #f1f5f9' : 'none',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                          >
                            <td style={{
                              padding: '1rem',
                              fontWeight: 600,
                              color: '#1e293b'
                            }}>
                              {contact.name}
                            </td>
                            <td style={{
                              padding: '1rem',
                              color: '#64748b',
                              fontStyle: contact.position ? 'normal' : 'italic'
                            }}>
                              {contact.position || '—'}
                            </td>
                            <td style={{
                              padding: '1rem',
                              color: '#64748b'
                            }}>
                              {contact.email || '—'}
                            </td>
                            <td style={{
                              padding: '1rem',
                              color: '#64748b'
                            }}>
                              {contact.phone || '—'}
                            </td>
                            <td style={{
                              padding: '1rem'
                            }}>
                              <span style={{
                                background: getStatusColor(contact.status).bg,
                                color: getStatusColor(contact.status).text,
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                fontWeight: 600
                              }}>
                                {getStatusLabel(contact.status)}
                              </span>
                            </td>
                            <td style={{
                              padding: '1rem'
                            }}>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => openEditModal(contact)}
                                  style={{
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    border: 'none',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => e.target.style.background = '#bae6fd'}
                                  onMouseLeave={e => e.target.style.background = '#e0f2fe'}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDelete(contact.id)}
                                  style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    border: 'none',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => e.target.style.background = '#fecaca'}
                                  onMouseLeave={e => e.target.style.background = '#fee2e2'}
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
                )}
              </div>
            )
          })}
        </div>
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
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '2rem',
            width: '90%',
            maxWidth: '600px',
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
                {editingContact ? 'Modifier le contact' : 'Nouveau contact'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '0',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#475569'
                  }}>
                    Nom *
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
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#475569'
                  }}>
                    Entreprise
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={e => setFormData({...formData, company: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#475569'
                  }}>
                    Position / Fonction
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={e => setFormData({...formData, position: e.target.value})}
                    placeholder="Ex: Directeur SI, Chef de Projet..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#475569'
                  }}>
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
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#475569'
                  }}>
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
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#475569'
                  }}>
                    Statut
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="prospect">Prospect</option>
                    <option value="client">Client</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#475569'
                  }}>
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
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
                    fontSize: '1rem',
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
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
                    color: '#fff'
                  }}
                >
                  {editingContact ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
