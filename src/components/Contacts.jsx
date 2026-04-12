import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [opportunites, setOpportunites] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [expandedCompanies, setExpandedCompanies] = useState({})
  const [selectedContact, setSelectedContact] = useState(null)
  const [search, setSearch] = useState('')
  const [formType, setFormType] = useState('person') // 'company' or 'person'
  const [formData, setFormData] = useState({
    name: '', company: '', email: '', phone: '', position: '',
    is_company: false, parent_company_id: '', notes: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [contRes, oppRes, intRes] = await Promise.all([
        supabase.from('contacts').select('*').order('name', { ascending: true }),
        supabase.from('opportunites').select('*'),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(100)
      ])
      if (contRes.data) setContacts(contRes.data)
      if (oppRes.data) setOpportunites(oppRes.data)
      if (intRes.data) setInteractions(intRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        company: formData.is_company ? formData.name : (formData.company || null),
        position: formData.position || null,
        is_company: formData.is_company,
        parent_company_id: formData.parent_company_id || null,
        notes: formData.notes || null,
        created_by: user?.id
      }
      if (editingContact) {
        const { created_by, ...upd } = payload
        const { error } = await supabase.from('contacts').update(upd).eq('id', editingContact.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('contacts').insert([payload])
        if (error) throw error
      }
      setShowModal(false); setEditingContact(null); resetForm(); loadData()
    } catch (err) { alert('Erreur: ' + err.message) }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce contact ?')) return
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
      if (selectedContact?.id === id) setSelectedContact(null)
      loadData()
    } catch (err) { alert('Erreur: ' + err.message) }
  }

  function resetForm() {
    setFormData({ name: '', company: '', email: '', phone: '', position: '', is_company: false, parent_company_id: '', notes: '' })
    setFormType('person')
  }

  function openNew(type, companyId) {
    setEditingContact(null)
    resetForm()
    if (type === 'company') {
      setFormType('company')
      setFormData(prev => ({ ...prev, is_company: true }))
    } else {
      setFormType('person')
      setFormData(prev => ({ ...prev, is_company: false, parent_company_id: companyId || '' }))
    }
    setShowModal(true)
  }

  function openEdit(c) {
    setEditingContact(c)
    setFormType(c.is_company ? 'company' : 'person')
    setFormData({
      name: c.name || '', company: c.company || '', email: c.email || '',
      phone: c.phone || '', position: c.position || '',
      is_company: c.is_company || false,
      parent_company_id: c.parent_company_id || '',
      notes: c.notes || ''
    })
    setShowModal(true)
  }

  function toggleCompany(id) {
    setExpandedCompanies(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function getContactOpps(contactId) {
    return opportunites.filter(o => o.contact_id === contactId)
  }

  function getContactInteractions(contactId) {
    return interactions.filter(i => i.contact_id === contactId)
  }

  // Build hierarchy: companies with their contacts
  const companies = contacts.filter(c => c.is_company)
  const persons = contacts.filter(c => !c.is_company)

  // Group persons by parent_company_id or by company name
  function getCompanyContacts(company) {
    return persons.filter(p =>
      p.parent_company_id === company.id ||
      (!p.parent_company_id && p.company && p.company.toLowerCase() === company.name.toLowerCase())
    )
  }

  // Persons without a company
  const orphanPersons = persons.filter(p => {
    if (p.parent_company_id) {
      return !companies.find(c => c.id === p.parent_company_id)
    }
    if (p.company) {
      return !companies.find(c => c.name.toLowerCase() === p.company.toLowerCase())
    }
    return true
  })

  // Search filter
  const searchLower = search.toLowerCase()
  const filteredCompanies = search
    ? companies.filter(c => {
        const compContacts = getCompanyContacts(c)
        return c.name.toLowerCase().includes(searchLower) ||
          compContacts.some(p => p.name.toLowerCase().includes(searchLower) || (p.email || '').toLowerCase().includes(searchLower))
      })
    : companies

  const filteredOrphans = search
    ? orphanPersons.filter(p => p.name.toLowerCase().includes(searchLower) || (p.email || '').toLowerCase().includes(searchLower) || (p.company || '').toLowerCase().includes(searchLower))
    : orphanPersons

  // Stats
  const totalCompanies = companies.length
  const totalPersons = persons.length
  const totalOpps = opportunites.length
  const caGagne = opportunites.filter(o => o.status === 'gagne').reduce((s, o) => s + (o.montant || 0), 0)

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
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      {/* LEFT: List */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '🏢', label: 'Societes', value: totalCompanies, accent: '#D4AF37' },
            { icon: '👤', label: 'Contacts', value: totalPersons, accent: '#60a5fa' },
            { icon: '💼', label: 'Opportunites', value: totalOpps, accent: '#a78bfa' },
            { icon: '💰', label: 'CA Gagne', value: new Intl.NumberFormat('fr-FR').format(caGagne) + ' \u20AC', accent: '#34d399' }
          ].map((s, i) => (
            <div key={i} style={{ ...card, padding: '1rem 1.25rem', borderTop: '3px solid ' + s.accent }}>
              <div style={{ fontSize: '0.78rem', color: '#8ba5b0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>{s.icon}</span> {s.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ ...card, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              🏢 Clients & Contacts
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => openNew('company')} style={{
                background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '8px',
                color: '#122a33', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
              }}>+ Societe</button>
              <button onClick={() => openNew('person')} style={{
                background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)',
                borderRadius: '8px', color: '#60a5fa', padding: '0.5rem 1rem',
                fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer'
              }}>+ Contact</button>
            </div>
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une societe ou un contact..."
            style={{
              width: '100%', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
              color: '#e2e8f0', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box'
            }} />
        </div>

        {/* Companies list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredCompanies.map(company => {
            const compContacts = getCompanyContacts(company)
            const compOpps = getContactOpps(company.id)
            const expanded = expandedCompanies[company.id]
            const compCA = compOpps.filter(o => o.status === 'gagne').reduce((s, o) => s + (o.montant || 0), 0)

            return (
              <div key={company.id} style={{ ...card, overflow: 'hidden' }}>
                {/* Company header */}
                <div
                  onClick={() => toggleCompany(company.id)}
                  style={{
                    padding: '1rem 1.25rem', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'background 0.15s',
                    borderLeft: '4px solid #D4AF37'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <span style={{
                      fontSize: '0.75rem', color: '#D4AF37', transition: 'transform 0.2s',
                      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
                    }}>▶</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>🏢</span>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>{company.name}</span>
                        <span style={{
                          padding: '0.1rem 0.4rem', borderRadius: '8px', fontSize: '0.65rem',
                          fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa'
                        }}>{compContacts.length} contact{compContacts.length > 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#4a6370', marginTop: '0.15rem' }}>
                        {company.email || ''} {company.phone ? ' \u00B7 ' + company.phone : ''}
                        {compOpps.length > 0 ? ' \u00B7 ' + compOpps.length + ' opp.' : ''}
                        {compCA > 0 ? ' \u00B7 CA: ' + new Intl.NumberFormat('fr-FR').format(compCA) + '\u20AC' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); openNew('person', company.id) }} style={{
                      background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                      color: '#60a5fa', width: '30px', height: '30px', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }} title="Ajouter un contact">+👤</button>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedContact(company) }} style={{
                      background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
                      color: '#D4AF37', width: '30px', height: '30px', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }} title="Voir details">👁</button>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(company) }} style={{
                      background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                      color: '#60a5fa', width: '30px', height: '30px', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>✏️</button>
                  </div>
                </div>

                {/* Contacts under company */}
                {expanded && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {compContacts.length === 0 ? (
                      <div style={{ padding: '1rem 1.25rem 1rem 3rem', color: '#4a6370', fontSize: '0.82rem' }}>
                        Aucun contact. <button onClick={() => openNew('person', company.id)} style={{
                          background: 'none', border: 'none', color: '#60a5fa',
                          cursor: 'pointer', textDecoration: 'underline', fontSize: '0.82rem'
                        }}>Ajouter un contact</button>
                      </div>
                    ) : compContacts.map(person => {
                      const pOpps = getContactOpps(person.id)
                      const pInts = getContactInteractions(person.id)
                      return (
                        <div key={person.id}
                          onClick={() => setSelectedContact(person)}
                          style={{
                            padding: '0.75rem 1.25rem 0.75rem 3rem',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            cursor: 'pointer', transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: 'linear-gradient(135deg, rgba(96,165,250,0.2), rgba(96,165,250,0.1))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.7rem', fontWeight: 700, color: '#60a5fa'
                            }}>{(person.name || '?')[0].toUpperCase()}</div>
                            <div>
                              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>{person.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#4a6370' }}>
                                {person.position || ''}{person.email ? ' \u00B7 ' + person.email : ''}
                                {pOpps.length > 0 ? ' \u00B7 ' + pOpps.length + ' opp.' : ''}
                                {pInts.length > 0 ? ' \u00B7 ' + pInts.length + ' interactions' : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button onClick={(e) => { e.stopPropagation(); openEdit(person) }} style={{
                              background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.15)',
                              color: '#60a5fa', width: '28px', height: '28px', borderRadius: '6px',
                              cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
                              alignItems: 'center', justifyContent: 'center'
                            }}>✏️</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(person.id) }} style={{
                              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.15)',
                              color: '#f87171', width: '28px', height: '28px', borderRadius: '6px',
                              cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
                              alignItems: 'center', justifyContent: 'center'
                            }}>🗑️</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Orphan contacts (no company) */}
          {filteredOrphans.length > 0 && (
            <div style={{ ...card, overflow: 'hidden', marginTop: '0.5rem' }}>
              <div style={{
                padding: '0.75rem 1.25rem', borderLeft: '4px solid #64808b',
                fontSize: '0.85rem', fontWeight: 600, color: '#8ba5b0'
              }}>
                👤 Contacts sans societe ({filteredOrphans.length})
              </div>
              {filteredOrphans.map(person => (
                <div key={person.id}
                  onClick={() => setSelectedContact(person)}
                  style={{
                    padding: '0.7rem 1.25rem 0.7rem 2.5rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>{person.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#4a6370' }}>
                      {person.company || 'Pas de societe'}{person.position ? ' \u00B7 ' + person.position : ''}{person.email ? ' \u00B7 ' + person.email : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(person) }} style={{
                      background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.15)',
                      color: '#60a5fa', width: '28px', height: '28px', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(person.id) }} style={{
                      background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.15)',
                      color: '#f87171', width: '28px', height: '28px', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredCompanies.length === 0 && filteredOrphans.length === 0 && (
            <div style={{ ...card, padding: '3rem', textAlign: 'center', color: '#4a6370' }}>
              Aucun resultat
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Detail panel */}
      {selectedContact && (
        <div style={{ width: '380px', flexShrink: 0, position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
          <div style={{ ...card, padding: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>{selectedContact.is_company ? '🏢' : '👤'}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{selectedContact.name}</span>
                </div>
                {selectedContact.position && (
                  <div style={{ fontSize: '0.82rem', color: '#8ba5b0' }}>{selectedContact.position}</div>
                )}
                {selectedContact.company && !selectedContact.is_company && (
                  <div style={{ fontSize: '0.78rem', color: '#D4AF37' }}>🏢 {selectedContact.company}</div>
                )}
              </div>
              <button onClick={() => setSelectedContact(null)} style={{
                background: 'none', border: 'none', color: '#4a6370', fontSize: '1.2rem', cursor: 'pointer'
              }}>✕</button>
            </div>

            {/* Contact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {selectedContact.email && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📧</span> <a href={'mailto:' + selectedContact.email} style={{ color: '#60a5fa', textDecoration: 'none' }}>{selectedContact.email}</a>
                </div>
              )}
              {selectedContact.phone && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📞</span> <a href={'tel:' + selectedContact.phone} style={{ color: '#60a5fa', textDecoration: 'none' }}>{selectedContact.phone}</a>
                </div>
              )}
              {selectedContact.notes && (
                <div style={{ fontSize: '0.82rem', color: '#4a6370', fontStyle: 'italic', marginTop: '0.25rem' }}>
                  📝 {selectedContact.notes}
                </div>
              )}
            </div>

            {/* Opportunities */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                💼 Opportunites ({getContactOpps(selectedContact.id).length})
              </div>
              {getContactOpps(selectedContact.id).length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#3a5560' }}>Aucune opportunite</div>
              ) : getContactOpps(selectedContact.id).map(opp => (
                <div key={opp.id} style={{
                  padding: '0.5rem 0.65rem', marginBottom: '0.3rem', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{opp.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#4a6370' }}>
                    {opp.status} {opp.montant ? ' \u00B7 ' + new Intl.NumberFormat('fr-FR').format(opp.montant) + '\u20AC' : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Interactions */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                📞 Interactions ({getContactInteractions(selectedContact.id).length})
              </div>
              {getContactInteractions(selectedContact.id).length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#3a5560' }}>Aucune interaction</div>
              ) : getContactInteractions(selectedContact.id).slice(0, 5).map((int, i) => (
                <div key={int.id || i} style={{
                  padding: '0.4rem 0.65rem', marginBottom: '0.25rem', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)', fontSize: '0.78rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8ba5b0' }}>{int.type === 'appel' ? '📞' : int.type === 'email' ? '📧' : int.type === 'reunion' ? '🤝' : '📝'} {int.type}</span>
                    <span style={{ color: '#3a5560', fontSize: '0.68rem' }}>{new Date(int.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {int.notes && <div style={{ color: '#4a6370', fontSize: '0.75rem', marginTop: '0.15rem' }}>{int.notes}</div>}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => openEdit(selectedContact)} style={{
                flex: 1, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                color: '#60a5fa', padding: '0.5rem', borderRadius: '8px',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
              }}>✏️ Modifier</button>
              <button onClick={() => handleDelete(selectedContact.id)} style={{
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                color: '#f87171', padding: '0.5rem 1rem', borderRadius: '8px',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
              }}>🗑️</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)'
        }} onClick={() => setShowModal(false)}>
          <div style={{
            ...card, width: '100%', maxWidth: '500px', maxHeight: '90vh',
            overflowY: 'auto', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                {editingContact ? '✏️ Modifier' : formType === 'company' ? '🏢 Nouvelle societe' : '👤 Nouveau contact'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{
                background: 'none', border: 'none', color: '#64808b', fontSize: '1.4rem', cursor: 'pointer'
              }}>x</button>
            </div>

            {/* Type toggle (only for new) */}
            {!editingContact && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button onClick={() => { setFormType('company'); setFormData(prev => ({ ...prev, is_company: true })) }} style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: formType === 'company' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                  color: formType === 'company' ? '#D4AF37' : '#64808b',
                  fontWeight: formType === 'company' ? 600 : 400, fontSize: '0.85rem'
                }}>🏢 Societe</button>
                <button onClick={() => { setFormType('person'); setFormData(prev => ({ ...prev, is_company: false })) }} style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: formType === 'person' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
                  color: formType === 'person' ? '#60a5fa' : '#64808b',
                  fontWeight: formType === 'person' ? 600 : 400, fontSize: '0.85rem'
                }}>👤 Personne</button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>{formType === 'company' ? 'Nom de la societe *' : 'Nom complet *'}</label>
                <input type="text" required value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle} placeholder={formType === 'company' ? 'Ex: BNP Paribas' : 'Ex: Jean Dupont'} />
              </div>

              {formType === 'person' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>Societe</label>
                    <select value={formData.parent_company_id}
                      onChange={e => setFormData({ ...formData, parent_company_id: e.target.value })}
                      style={inputStyle}>
                      <option value="">-- Selectionner une societe --</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>Poste / Fonction</label>
                    <input type="text" value={formData.position}
                      onChange={e => setFormData({ ...formData, position: e.target.value })}
                      style={inputStyle} placeholder="Ex: DSI, Directeur IT, DRH..." />
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Telephone</label>
                  <input type="tel" value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Notes</label>
                <textarea rows={2} value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#8ba5b0', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.88rem', cursor: 'pointer'
                }}>Annuler</button>
                <button type="submit" style={{
                  background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none',
                  color: '#122a33', padding: '0.6rem 1.8rem', borderRadius: '8px',
                  fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer'
                }}>{editingContact ? 'Mettre a jour' : 'Creer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'block', color: '#8ba5b0', fontSize: '0.78rem',
  fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '0.03em', textTransform: 'uppercase'
}

const inputStyle = {
  width: '100%', padding: '0.65rem 0.9rem',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box'
}
