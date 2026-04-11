import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function CopilotCommercial() {
  const [contacts, setContacts] = useState([])
  const [audits, setAudits] = useState({})
  const [selectedContact, setSelectedContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatedMail, setGeneratedMail] = useState(null)
  const [history, setHistory] = useState([])
  const [tone, setTone] = useState('professionnel')
  const [objective, setObjective] = useState('prospection')
  const [customContext, setCustomContext] = useState('')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  // Scoring state
  const [scores, setScores] = useState({})
  const [scoringInProgress, setScoringInProgress] = useState(false)

  // Alerts state
  const [alerts, setAlerts] = useState([])
  const [showAlerts, setShowAlerts] = useState(true)

  // Relance suggestions
  const [relances, setRelances] = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [contRes, auditRes, mailRes, scoreRes, alertRes, intRes, oppRes] = await Promise.all([
        supabase.from('contacts').select('*').order('name'),
        supabase.from('audits').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('generated_mails').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('prospect_scores').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('smart_alerts').select('*').eq('read', false).order('created_at', { ascending: false }).limit(20),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('opportunites').select('*')
      ])

      const contactsList = contRes.data || []
      setContacts(contactsList)

      // Build audit map
      const auditMap = {}
      if (auditRes.data) auditRes.data.forEach(a => { if (a.contact_id && !auditMap[a.contact_id]) auditMap[a.contact_id] = a })
      setAudits(auditMap)

      if (mailRes.data) setHistory(mailRes.data)

      // Build score map
      const scoreMap = {}
      if (scoreRes.data) scoreRes.data.forEach(s => { if (s.contact_id && !scoreMap[s.contact_id]) scoreMap[s.contact_id] = s })
      setScores(scoreMap)

      if (alertRes.data) setAlerts(alertRes.data)

      // Compute relance suggestions
      const interactions = intRes.data || []
      const opps = oppRes.data || []
      computeRelances(contactsList, interactions, opps, auditMap)

    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function computeRelances(contactsList, interactions, opps, auditMap) {
    const now = new Date()
    const suggestions = []

    contactsList.forEach(c => {
      const contactInts = interactions.filter(i => i.contact_id === c.id)
      const lastInt = contactInts[0]
      const contactOpps = opps.filter(o => o.contact_id === c.id)
      const activeOpps = contactOpps.filter(o => !['gagne', 'perdu'].includes(o.status))
      const audit = auditMap[c.id]

      let reason = null
      let priority = 'medium'
      let daysSince = null

      if (lastInt) {
        daysSince = Math.floor((now - new Date(lastInt.created_at)) / (1000 * 60 * 60 * 24))
        if (daysSince > 30) {
          reason = `Pas de contact depuis ${daysSince} jours`
          priority = daysSince > 60 ? 'high' : 'medium'
        }
      } else if (c.created_at) {
        daysSince = Math.floor((now - new Date(c.created_at)) / (1000 * 60 * 60 * 24))
        if (daysSince > 7) {
          reason = `Nouveau contact jamais contacté (${daysSince}j)`
          priority = 'high'
        }
      }

      if (activeOpps.length > 0) {
        const stalledOpps = activeOpps.filter(o => {
          const oppAge = Math.floor((now - new Date(o.created_at)) / (1000 * 60 * 60 * 24))
          return oppAge > 14
        })
        if (stalledOpps.length > 0) {
          reason = `${stalledOpps.length} opportunité(s) en attente depuis 14j+`
          priority = 'high'
        }
      }

      if (reason) {
        suggestions.push({
          contact: c,
          reason,
          priority,
          daysSince,
          hasAudit: !!audit,
          score: audit?.score_sante
        })
      }
    })

    suggestions.sort((a, b) => {
      const prio = { high: 0, medium: 1, low: 2 }
      return (prio[a.priority] || 1) - (prio[b.priority] || 1)
    })

    setRelances(suggestions.slice(0, 10))
  }

  async function generateMail() {
    if (!selectedContact) return
    setGenerating(true)
    setGeneratedMail(null)
    try {
      const audit = audits[selectedContact.id]
      const contactMails = history.filter(h => h.contact_id === selectedContact.id)

      const context = {
        contact: {
          nom: selectedContact.name,
          email: selectedContact.email,
          poste: selectedContact.position,
          entreprise: selectedContact.company
        },
        audit: audit ? {
          score_sante: audit.score_sante,
          analyse: audit.analysis?.analyse,
          recommandation: audit.analysis?.recommandation,
          budget_it: audit.analysis?.capacite_budget_it,
          news: (audit.news || []).slice(0, 3).map(n => n.title),
          resume_actu: audit.analysis?.resume_actualites
        } : null,
        historique_mails: contactMails.slice(0, 3).map(m => ({ sujet: m.subject, date: m.created_at })),
        tone,
        objective,
        custom_context: customContext
      }

      const resp = await fetch('/api/audit-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: selectedContact.company || selectedContact.name,
          generate_mail: true,
          mail_context: context
        })
      })

      // If API doesn't support mail gen, use direct Anthropic call
      const data = await resp.json()
      if (data.generated_mail) {
        setGeneratedMail(data.generated_mail)
      } else {
        // Fallback: generate via separate API call logic
        const mailResp = await fetch('/api/generate-mail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(context)
        })
        if (mailResp.ok) {
          const mailData = await mailResp.json()
          setGeneratedMail(mailData)
        }
      }

      // Save to DB
      if (generatedMail || true) {
        const { data: { user } } = await supabase.auth.getUser()
        const mail = generatedMail || { subject: 'Généré', body: 'En cours...' }
        await supabase.from('generated_mails').insert([{
          contact_id: selectedContact.id,
          company_name: selectedContact.company || selectedContact.name,
          subject: mail.subject,
          body: mail.body,
          tone,
          context: objective,
          created_by: user?.id
        }])
      }
    } catch (err) {
      console.error('Mail generation error:', err)
    } finally {
      setGenerating(false)
    }
  }

  async function computeAllScores() {
    setScoringInProgress(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: interactions } = await supabase.from('interactions').select('*').order('created_at', { ascending: false })
      const { data: opps } = await supabase.from('opportunites').select('*')
      const now = new Date()

      for (const contact of contacts) {
        const audit = audits[contact.id]
        const contactInts = (interactions || []).filter(i => i.contact_id === contact.id)
        const contactOpps = (opps || []).filter(o => o.contact_id === contact.id)
        const lastInt = contactInts[0]
        const daysSinceContact = lastInt ? Math.floor((now - new Date(lastInt.created_at)) / 86400000) : 999

        // Score financier (0-25) basé sur audit
        const scoreFinancier = audit?.score_sante ? Math.round(audit.score_sante * 0.25) : 10

        // Score activité (0-25) basé sur interactions
        const nbInts = contactInts.length
        const scoreActivite = Math.min(25, nbInts * 3)

        // Score timing (0-25) basé sur récence
        const scoreTiming = daysSinceContact < 7 ? 25 : daysSinceContact < 30 ? 18 : daysSinceContact < 60 ? 10 : 3

        // Score relationnel (0-25) basé sur opps
        const wonOpps = contactOpps.filter(o => o.status === 'gagne').length
        const activeOpps = contactOpps.filter(o => !['gagne', 'perdu'].includes(o.status)).length
        const scoreRelationnel = Math.min(25, wonOpps * 10 + activeOpps * 5)

        const scoreGlobal = scoreFinancier + scoreActivite + scoreTiming + scoreRelationnel

        await supabase.from('prospect_scores').upsert({
          contact_id: contact.id,
          score_global: scoreGlobal,
          score_financier: scoreFinancier,
          score_activite: scoreActivite,
          score_timing: scoreTiming,
          score_relationnel: scoreRelationnel,
          details: {
            daysSinceContact,
            nbInteractions: nbInts,
            nbOpps: contactOpps.length,
            wonOpps,
            auditScore: audit?.score_sante
          }
        }, { onConflict: 'contact_id' })

        setScores(prev => ({
          ...prev,
          [contact.id]: { score_global: scoreGlobal, score_financier: scoreFinancier, score_activite: scoreActivite, score_timing: scoreTiming, score_relationnel: scoreRelationnel }
        }))
      }

      // Generate smart alerts
      await generateSmartAlerts(interactions || [], opps || [])
      await loadAll()
    } catch (err) { console.error('Scoring error:', err) }
    finally { setScoringInProgress(false) }
  }

  async function generateSmartAlerts(interactions, opps) {
    const now = new Date()
    const { data: { user } } = await supabase.auth.getUser()
    const newAlerts = []

    for (const contact of contacts) {
      const contactInts = interactions.filter(i => i.contact_id === contact.id)
      const contactOpps = opps.filter(o => o.contact_id === contact.id)
      const lastInt = contactInts[0]
      const audit = audits[contact.id]

      // Alert: pas de contact depuis 30j+ avec opp active
      if (lastInt) {
        const days = Math.floor((now - new Date(lastInt.created_at)) / 86400000)
        const hasActiveOpp = contactOpps.some(o => !['gagne', 'perdu'].includes(o.status))
        if (days > 30 && hasActiveOpp) {
          newAlerts.push({
            type: 'relance_urgente',
            title: `${contact.name} : ${days}j sans contact avec opportunité active`,
            description: `Dernière interaction il y a ${days} jours. ${contactOpps.filter(o => !['gagne','perdu'].includes(o.status)).length} opp en cours.`,
            contact_id: contact.id,
            priority: 'high',
            created_by: user?.id
          })
        }
      }

      // Alert: santé fragile
      if (audit?.score_sante < 40) {
        newAlerts.push({
          type: 'sante_fragile',
          title: `${contact.company || contact.name} : santé financière fragile (${audit.score_sante}/100)`,
          description: audit.analysis?.recommandation_detail || 'Entreprise à surveiller',
          contact_id: contact.id,
          priority: audit.score_sante < 20 ? 'critical' : 'high',
          created_by: user?.id
        })
      }

      // Alert: nouveau contact sans interaction
      if (contactInts.length === 0 && contact.created_at) {
        const days = Math.floor((now - new Date(contact.created_at)) / 86400000)
        if (days > 3 && days < 30) {
          newAlerts.push({
            type: 'premier_contact',
            title: `${contact.name} : jamais contacté depuis ${days}j`,
            description: `Contact ajouté il y a ${days} jours sans aucune interaction.`,
            contact_id: contact.id,
            priority: 'medium',
            created_by: user?.id
          })
        }
      }
    }

    // Clear old unread alerts and insert new ones
    if (newAlerts.length > 0) {
      await supabase.from('smart_alerts').delete().eq('read', false)
      await supabase.from('smart_alerts').insert(newAlerts)
    }
  }

  async function dismissAlert(id) {
    await supabase.from('smart_alerts').update({ read: true }).eq('id', id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  function copyMail() {
    if (!generatedMail) return
    navigator.clipboard.writeText(`Objet: ${generatedMail.subject}\n\n${generatedMail.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const searchLower = search.toLowerCase()
  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(searchLower) ||
    c.company?.toLowerCase().includes(searchLower) ||
    c.email?.toLowerCase().includes(searchLower)
  )

  // Top prospects by score
  const topProspects = [...contacts]
    .map(c => ({ ...c, score: scores[c.id]?.score_global || 0 }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  const PRIORITY_COLORS = {
    critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '🔥' },
    high: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', icon: '🚨' },
    medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⚡' },
    low: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '💡' }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🧠 Copilot Commercial</h2>
            <p style={{ color: '#64808b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>IA de prospection, scoring, alertes et génération de mails personnalisés</p>
          </div>
          <button onClick={computeAllScores} disabled={scoringInProgress} style={{
            background: scoringInProgress ? 'rgba(212,175,55,0.2)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
            border: 'none', borderRadius: '8px', color: '#122a33', padding: '0.6rem 1.4rem',
            fontWeight: 700, fontSize: '0.85rem', cursor: scoringInProgress ? 'wait' : 'pointer'
          }}>{scoringInProgress ? '⏳ Calcul en cours...' : '🎯 Recalculer les scores'}</button>
        </div>
      </div>

      {/* SMART ALERTS */}
      {alerts.length > 0 && showAlerts && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🚨 Alertes intelligentes ({alerts.length})</div>
            <button onClick={() => setShowAlerts(false)} style={{ background: 'none', border: 'none', color: '#4a6370', cursor: 'pointer', fontSize: '0.75rem' }}>Masquer</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alerts.slice(0, 5).map(a => {
              const p = PRIORITY_COLORS[a.priority] || PRIORITY_COLORS.medium
              return (
                <div key={a.id} style={{ ...card, padding: '0.85rem 1.25rem', borderLeft: `4px solid ${p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                    <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: p.color, fontSize: '0.82rem' }}>{a.title}</div>
                      {a.description && <div style={{ fontSize: '0.72rem', color: '#64808b', marginTop: '0.1rem' }}>{a.description.slice(0, 100)}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={() => { setSelectedContact(contacts.find(c => c.id === a.contact_id)); setSearch('') }} style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', padding: '0.25rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>✉️ Mail</button>
                    <button onClick={() => dismissAlert(a.id)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4a6370', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* LEFT: Contact selector + Mail generator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Contact picker */}
          <div style={{ ...card, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#D4AF37', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✉️ Générer un mail de prospection</div>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un contact..." style={{ width: '100%', padding: '0.55rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem' }} />

            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {filteredContacts.slice(0, 15).map(c => (
                <div key={c.id} onClick={() => setSelectedContact(c)} style={{
                  padding: '0.5rem 0.6rem', borderRadius: '8px', marginBottom: '0.2rem', cursor: 'pointer',
                  background: selectedContact?.id === c.id ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.02)',
                  border: selectedContact?.id === c.id ? '1px solid rgba(212,175,55,0.3)' : '1px solid transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>{c.name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#64808b' }}>{c.position ? c.position + ' · ' : ''}{c.company || ''}</div>
                  </div>
                  {scores[c.id] && (
                    <span style={{ padding: '0.15rem 0.4rem', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, color: scores[c.id].score_global >= 60 ? '#34d399' : scores[c.id].score_global >= 30 ? '#f59e0b' : '#f87171', background: scores[c.id].score_global >= 60 ? 'rgba(52,211,153,0.15)' : scores[c.id].score_global >= 30 ? 'rgba(245,158,11,0.15)' : 'rgba(248,113,113,0.15)' }}>{scores[c.id].score_global}/100</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mail config */}
          {selectedContact && (
            <div style={{ ...card, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚙️ Configuration du mail</div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#8ba5b0', marginBottom: '0.3rem', fontWeight: 500 }}>OBJECTIF</div>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'prospection', label: '🎯 Prospection' },
                    { id: 'relance', label: '🔄 Relance' },
                    { id: 'proposition', label: '📋 Proposition' },
                    { id: 'suivi', label: '📞 Suivi' },
                    { id: 'remerciement', label: '🙏 Remerciement' }
                  ].map(o => (
                    <button key={o.id} onClick={() => setObjective(o.id)} style={{
                      padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 500,
                      background: objective === o.id ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                      border: objective === o.id ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: objective === o.id ? '#D4AF37' : '#8ba5b0'
                    }}>{o.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#8ba5b0', marginBottom: '0.3rem', fontWeight: 500 }}>TON</div>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[
                    { id: 'professionnel', label: '👔 Pro' },
                    { id: 'amical', label: '😊 Amical' },
                    { id: 'direct', label: '⚡ Direct' },
                    { id: 'formel', label: '📜 Formel' }
                  ].map(t => (
                    <button key={t.id} onClick={() => setTone(t.id)} style={{
                      padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 500,
                      background: tone === t.id ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                      border: tone === t.id ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: tone === t.id ? '#60a5fa' : '#8ba5b0'
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#8ba5b0', marginBottom: '0.3rem', fontWeight: 500 }}>CONTEXTE PERSONNALISÉ (optionnel)</div>
                <textarea value={customContext} onChange={e => setCustomContext(e.target.value)} placeholder="Ex: On s'est croisés au salon IT Paris, ils cherchent un dev React senior..." rows={2} style={{ width: '100%', padding: '0.55rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <button onClick={generateMail} disabled={generating} style={{
                width: '100%', padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: generating ? 'wait' : 'pointer',
                background: generating ? 'rgba(212,175,55,0.2)' : 'linear-gradient(135deg, #D4AF37, #c9a02e)',
                color: '#122a33', fontWeight: 700, fontSize: '0.9rem'
              }}>{generating ? '✍️ Rédaction en cours...' : '✨ Générer le mail'}</button>
            </div>
          )}

          {/* Generated mail */}
          {generatedMail && (
            <div style={{ ...card, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✨ Mail généré</div>
                <button onClick={copyMail} style={{
                  background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', color: copied ? '#34d399' : '#8ba5b0',
                  padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                }}>{copied ? '✅ Copié !' : '📋 Copier'}</button>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.72rem', color: '#64808b', marginBottom: '0.2rem' }}>OBJET</div>
                <div style={{ fontSize: '0.9rem', color: '#D4AF37', fontWeight: 600, marginBottom: '0.75rem' }}>{generatedMail.subject}</div>
                <div style={{ fontSize: '0.72rem', color: '#64808b', marginBottom: '0.2rem' }}>CORPS</div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{generatedMail.body}</div>
              </div>
              {selectedContact?.email && (
                <a href={`mailto:${selectedContact.email}?subject=${encodeURIComponent(generatedMail.subject)}&body=${encodeURIComponent(generatedMail.body)}`} style={{
                  display: 'block', width: '100%', padding: '0.6rem', borderRadius: '8px', marginTop: '0.75rem', textAlign: 'center',
                  background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399',
                  textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem'
                }}>📧 Ouvrir dans ma messagerie</a>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Top prospects + Relances */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Top Prospects */}
          <div style={{ ...card, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏆 Top Prospects (score)</div>
            {topProspects.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#4a6370', textAlign: 'center', padding: '1rem' }}>Cliquez "Recalculer les scores" pour voir le classement</div>
            ) : topProspects.map((c, i) => {
              const s = scores[c.id]
              const scoreColor = c.score >= 60 ? '#34d399' : c.score >= 30 ? '#f59e0b' : '#f87171'
              return (
                <div key={c.id} onClick={() => setSelectedContact(c)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.6rem',
                  borderRadius: '8px', marginBottom: '0.3rem', cursor: 'pointer',
                  background: selectedContact?.id === c.id ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)'
                }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: i < 3 ? 'linear-gradient(135deg, #D4AF37, #c9a02e)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, color: i < 3 ? '#122a33' : '#64808b', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>{c.name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64808b' }}>{c.company || ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: scoreColor }}>{c.score}</div>
                    <div style={{ fontSize: '0.55rem', color: '#4a6370' }}>/100</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Relance suggestions */}
          <div style={{ ...card, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⏰ À relancer</div>
            {relances.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#4a6370', textAlign: 'center', padding: '1rem' }}>Aucune relance suggérée</div>
            ) : relances.map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0.6rem', borderRadius: '8px', marginBottom: '0.3rem',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                borderLeft: `3px solid ${r.priority === 'high' ? '#f87171' : '#f59e0b'}`
              }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>{r.contact.name}</div>
                  <div style={{ fontSize: '0.68rem', color: r.priority === 'high' ? '#fca5a5' : '#fcd34d' }}>{r.reason}</div>
                </div>
                <button onClick={() => { setSelectedContact(r.contact); setObjective('relance') }} style={{
                  background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
                  color: '#D4AF37', padding: '0.25rem 0.6rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600
                }}>✉️ Mail</button>
              </div>
            ))}
          </div>

          {/* Mail history */}
          {history.length > 0 && (
            <div style={{ ...card, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#8ba5b0', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🕐 Mails générés</div>
              {history.slice(0, 8).map((h, i) => (
                <div key={h.id || i} style={{
                  padding: '0.4rem 0.6rem', borderRadius: '8px', marginBottom: '0.2rem',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer'
                }} onClick={() => setGeneratedMail({ subject: h.subject, body: h.body })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#e2e8f0' }}>{h.company_name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#4a6370' }}>{h.created_at ? new Date(h.created_at).toLocaleDateString('fr-FR') : ''}</div>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64808b' }}>{h.subject}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}
