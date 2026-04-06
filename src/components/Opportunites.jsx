import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Opportunites() {
  const [opportunites, setOpportunites] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOpp, setEditingOpp] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    contact_id: '',
    type: 'at',
    status: 'prospection',
    probabilite: 50,
    tjm: '',
    nb_jours: '',
    montant: '',
    closing_date: '',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [{ data: opps }, { data: conts }] = await Promise.all([
        supabase.from('opportunites').select('*, contacts(name, company)').order('created_at', { ascending: false }),
        supabase.from('contacts').select('id, name, company')
      ])

      setOpportunites(opps || [])
      setContacts(conts || [])
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    try {
      const dataToSave = {
        ...formData,
        probabilite: parseInt(formData.probabilite) || 50,
        tjm: parseFloat(formData.tjm) || null,
        nb_jours: parseInt(formData.nb_jours) || null,
        montant: parseFloat(formData.montant) || 0,
        contact_id: formData.contact_id || null
      }

      if (editingOpp) {
        const { error } = await supabase
          .from('opportunites')
          .update(dataToSave)
          .eq('id', editingOpp.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('opportunites')
          .insert([dataToSave])
        
        if (error) throw error
      }

      setShowModal(false)
      setEditingOpp(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la sauvegarde')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette opportunité ?')) return
    
    try {
      const { error } = await supabase
        .from('opportunites')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la suppression')
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      contact_id: '',
      type: 'at',
      status: 'prospection',
      probabilite: 50,
      tjm: '',
      nb_jours: '',
      montant: '',
      closing_date: '',
      notes: ''
    })
  }

  function openEditModal(opp) {
    setEditingOpp(opp)
    setFormData({
      name: opp.name || '',
      contact_id: opp.contact_id || '',
      type: opp.type || 'at',
      status: opp.status || 'prospection',
      probabilite: opp.probabilite || 50,
      tjm: opp.tjm || '',
      nb_jours: opp.nb_jours || '',
      montant: opp.montant || '',
      closing_date: opp.closing_date || '',
      notes: opp.notes || ''
    })
    setShowModal(true)
  }

  function openNewModal() {
    setEditingOpp(null)
    resetForm()
    setShowModal(true)
  }

  function getStatusBadge(status) {
    const badges = {
      prospection: 'badge-info',
      qualification: 'badge-warning',
      proposition: 'badge-warning',
      negociation: 'badge-warning',
      gagne: 'badge-success',
      perdu: 'badge-danger'
    }
    return badges[status] || 'badge-info'
  }

  function getStatusLabel(status) {
    const labels = {
      prospection: 'Prospection',
      qualification: 'Qualification',
      proposition: 'Proposition',
      negociation: 'Négociation',
      gagne: 'Gagné',
      perdu: 'Perdu'
    }
    return labels[status] || status
  }

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div></div>
  }

  const caGagne = opportunites
    .filter(o => o.status === 'gagne')
    .reduce((sum, o) => sum + (o.montant || 0), 0)

  const pipeline = opportunites
    .filter(o => o.status !== 'gagne' && o.status !== 'perdu')
    .reduce((sum, o) => sum + ((o.montant || 0) * ((o.probabilite || 0) / 100)), 0)

  return (
    <div>
      <div className="stats-grid" style={{marginBottom: '2rem'}}>
        <div className="stat-card">
          <div className="stat-label">💰 CA Gagné</div>
          <div className="stat-value">{Math.round(caGagne).toLocaleString('fr-FR')} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📈 Pipeline</div>
          <div className="stat-value">{Math.round(pipeline).toLocaleString('fr-FR')} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">💼 Opportunités actives</div>
          <div className="stat-value">
            {opportunites.filter(o => o.status !== 'gagne' && o.status !== 'perdu').length}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">💼 Opportunités ({opportunites.length})</h2>
          <button className="btn btn-primary" onClick={openNewModal}>
            + Nouvelle opportunité
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Client</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Montant</th>
                <th>Proba</th>
                <th>CA Prévu</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {opportunites.map(opp => (
                <tr key={opp.id}>
                  <td style={{fontWeight: 600}}>{opp.name}</td>
                  <td>{opp.contacts?.name || '-'}</td>
                  <td>
                    <span className="badge badge-info">
                      {opp.type?.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(opp.status)}`}>
                      {getStatusLabel(opp.status)}
                    </span>
                  </td>
                  <td>{(opp.montant || 0).toLocaleString('fr-FR')} €</td>
                  <td>{opp.probabilite}%</td>
                  <td style={{fontWeight: 600}}>
                    {Math.round((opp.montant || 0) * ((opp.probabilite || 0) / 100)).toLocaleString('fr-FR')} €
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      style={{marginRight: '0.5rem'}}
                      onClick={() => openEditModal(opp)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => handleDelete(opp.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingOpp ? 'Modifier l\'opportunité' : 'Nouvelle opportunité'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Client</label>
                <select
                  className="form-select"
                  value={formData.contact_id}
                  onChange={e => setFormData({...formData, contact_id: e.target.value})}
                >
                  <option value="">-- Sélectionner un client --</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} {contact.company ? `(${contact.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="at">AT (Assistance Technique)</option>
                  <option value="regie">Régie</option>
                  <option value="forfait">Forfait</option>
                  <option value="conseil">Conseil</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Statut</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                >
                  <option value="prospection">Prospection</option>
                  <option value="qualification">Qualification</option>
                  <option value="proposition">Proposition</option>
                  <option value="negociation">Négociation</option>
                  <option value="gagne">Gagné</option>
                  <option value="perdu">Perdu</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Montant (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.montant}
                  onChange={e => setFormData({...formData, montant: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Probabilité (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-input"
                  value={formData.probabilite}
                  onChange={e => setFormData({...formData, probabilite: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">TJM (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.tjm}
                  onChange={e => setFormData({...formData, tjm: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nombre de jours</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.nb_jours}
                  onChange={e => setFormData({...formData, nb_jours: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date de closing</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.closing_date}
                  onChange={e => setFormData({...formData, closing_date: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingOpp ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}