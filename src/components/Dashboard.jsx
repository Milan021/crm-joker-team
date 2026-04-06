import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalOpportunites: 0,
    totalCandidats: 0,
    caGagne: 0,
    pipeline: 0,
    caTotal: 0,
    tjmMoyen: 0,
    tauxConversion: 0
  })
  const [alertes, setAlertes] = useState([])
  const [veilleItems, setVeilleItems] = useState([])
  const [matchings, setMatchings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMatchingModal, setShowMatchingModal] = useState(false)
  const [calculatingMatchings, setCalculatingMatchings] = useState(false)

  useEffect(() => {
    loadStats()
    loadAlertes()
    loadVeille()
    loadTopMatchings()
  }, [])

  async function loadStats() {
    try {
      const [contacts, opportunites, candidats] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('opportunites').select('*'),
        supabase.from('candidats').select('*')
      ])

      const caGagne = (opportunites.data || [])
        .filter(o => o.status === 'gagne')
        .reduce((sum, o) => sum + (o.montant || 0), 0)

      const pipeline = (opportunites.data || [])
        .filter(o => o.status !== 'gagne' && o.status !== 'perdu')
        .reduce((sum, o) => sum + ((o.montant || 0) * ((o.probabilite || 0) / 100)), 0)

      const tjmMoyen = candidats.data?.length > 0
        ? Math.round(candidats.data.reduce((sum, c) => sum + (c.tjm || 0), 0) / candidats.data.length)
        : 0

      const totalOpps = (opportunites.data || []).filter(o => o.status !== 'perdu').length
      const gagnes = (opportunites.data || []).filter(o => o.status === 'gagne').length
      const tauxConversion = totalOpps > 0 ? Math.round((gagnes / totalOpps) * 100) : 0

      setStats({
        totalContacts: contacts.data?.length || 0,
        totalOpportunites: opportunites.data?.length || 0,
        totalCandidats: candidats.data?.length || 0,
        caGagne,
        pipeline,
        caTotal: caGagne + pipeline,
        tjmMoyen,
        tauxConversion
      })
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadAlertes() {
    try {
      const { data, error } = await supabase
        .from('opportunites')
        .select('*, contacts(name, company)')
        .not('status', 'in', '(gagne,perdu)')
        .order('closing_date', { ascending: true, nullsFirst: false })

      if (error) throw error

      const now = new Date()
      const alertesCalculees = (data || []).map(opp => {
        const closingDate = opp.closing_date ? new Date(opp.closing_date) : null
        const lastContactDate = opp.last_contact_date ? new Date(opp.last_contact_date) : null
        
        let urgence = 'normale'
        let message = ''
        let daysUntil = null

        if (closingDate) {
          daysUntil = Math.ceil((closingDate - now) / (1000 * 60 * 60 * 24))
          
          if (daysUntil <= 0) {
            urgence = 'critique'
            message = daysUntil === 0 ? "Closing aujourd'hui !" : `Closing dépassé de ${Math.abs(daysUntil)} jour(s) !`
          } else if (daysUntil === 1) {
            urgence = 'critique'
            message = 'Closing demain !'
          } else if (daysUntil <= 3) {
            urgence = 'urgente'
            message = `Closing dans ${daysUntil} jours`
          } else if (daysUntil <= 7) {
            urgence = 'importante'
            message = `Closing dans ${daysUntil} jours`
          }
        }

        if (lastContactDate && urgence === 'normale') {
          const daysSinceContact = Math.ceil((now - lastContactDate) / (1000 * 60 * 60 * 24))
          if (daysSinceContact > 14) {
            urgence = 'relance'
            message = `Pas de contact depuis ${daysSinceContact} jours`
          }
        }

        return { ...opp, urgence, message, daysUntil }
      })

      const alertesUrgentes = alertesCalculees
        .filter(a => a.urgence !== 'normale')
        .sort((a, b) => {
          const priorite = { critique: 0, urgente: 1, importante: 2, relance: 3 }
          return priorite[a.urgence] - priorite[b.urgence]
        })

      setAlertes(alertesUrgentes)
    } catch (error) {
      console.error('Erreur chargement alertes:', error)
    }
  }

  async function loadVeille() {
    try {
      const { data, error } = await supabase
        .from('veille_items')
        .select('*')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) throw error
      setVeilleItems(data || [])
    } catch (error) {
      console.error('Erreur chargement veille:', error)
    }
  }

  async function loadTopMatchings() {
    try {
      const { data, error } = await supabase
        .from('matchings')
        .select('*, candidats(name, tjm, competences, technologies), opportunites(name, montant, status, competences_requises, technologies_requises)')
        .eq('status', 'suggestion')
        .order('score', { ascending: false })
        .limit(5)

      if (error) throw error
      setMatchings(data || [])
    } catch (error) {
      console.error('Erreur chargement matchings:', error)
    }
  }

  async function recalculateMatchings() {
    setCalculatingMatchings(true)
    
    try {
      // Charger candidats et opportunités
      const [candidatsRes, opportunitesRes] = await Promise.all([
        supabase.from('candidats').select('*').eq('status', 'dispo'),
        supabase.from('opportunites').select('*').not('status', 'in', '(gagne,perdu)')
      ])

      const candidats = candidatsRes.data || []
      const opportunites = opportunitesRes.data || []

      let matchingsCreated = 0

      // Pour chaque combinaison candidat x opportunité
      for (const candidat of candidats) {
        for (const opportunite of opportunites) {
          // Calculer le score
          const score = calculateScore(candidat, opportunite)
          
          if (score >= 40) { // Seuil minimum
            const reasons = getMatchReasons(candidat, opportunite, score)
            
            const { error: upsertError } = await supabase
              .from('matchings')
              .upsert({
                candidat_id: candidat.id,
                opportunite_id: opportunite.id,
                score: score,
                match_reasons: reasons,
                status: 'suggestion',
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'candidat_id,opportunite_id'
              })

            if (!upsertError) matchingsCreated++
          }
        }
      }

      await loadTopMatchings()
      alert(`✅ ${matchingsCreated} matchings calculés !`)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du calcul des matchings')
    } finally {
      setCalculatingMatchings(false)
    }
  }

  function calculateScore(candidat, opportunite) {
    let score = 0
    
    // 1. Compétences (40 pts max)
    const candidatComp = (candidat.competences || '').toLowerCase().split(',').map(c => c.trim()).filter(Boolean)
    const oppComp = (opportunite.competences_requises || '').toLowerCase().split(',').map(c => c.trim()).filter(Boolean)
    const compMatches = candidatComp.filter(c => oppComp.some(o => o.includes(c) || c.includes(o))).length
    score += Math.min(compMatches * 10, 40)
    
    // 2. Technologies (30 pts max)
    const candidatTech = (candidat.technologies || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean)
    const oppTech = (opportunite.technologies_requises || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean)
    const techMatches = candidatTech.filter(t => oppTech.some(o => o.includes(t) || t.includes(o))).length
    score += Math.min(techMatches * 10, 30)
    
    // 3. TJM compatible (20 pts)
    if (candidat.tjm && opportunite.montant) {
      const tjmMax = opportunite.montant / 220 // Approximation
      if (candidat.tjm <= tjmMax) {
        score += 20
      } else if (candidat.tjm <= tjmMax * 1.1) {
        score += 10 // Tolérance 10%
      }
    }
    
    // 4. Disponibilité (10 pts)
    if (candidat.disponibilite_date) {
      const dispo = new Date(candidat.disponibilite_date)
      const now = new Date()
      const daysUntilDispo = Math.ceil((dispo - now) / (1000 * 60 * 60 * 24))
      if (daysUntilDispo <= 0) score += 10 // Dispo immédiatement
      else if (daysUntilDispo <= 30) score += 5 // Dispo sous 30j
    } else {
      score += 10 // Pas de date = dispo maintenant
    }
    
    return Math.min(score, 100)
  }

  function getMatchReasons(candidat, opportunite, score) {
    const reasons = []
    
    const candidatComp = (candidat.competences || '').toLowerCase().split(',').map(c => c.trim()).filter(Boolean)
    const oppComp = (opportunite.competences_requises || '').toLowerCase().split(',').map(c => c.trim()).filter(Boolean)
    const compMatches = candidatComp.filter(c => oppComp.some(o => o.includes(c) || c.includes(o))).length
    if (compMatches > 0) reasons.push(`✅ ${compMatches} compétence(s) commune(s)`)
    
    const candidatTech = (candidat.technologies || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean)
    const oppTech = (opportunite.technologies_requises || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean)
    const techMatches = candidatTech.filter(t => oppTech.some(o => o.includes(t) || t.includes(o))).length
    if (techMatches > 0) reasons.push(`💻 ${techMatches} technologie(s) commune(s)`)
    
    if (candidat.tjm && opportunite.montant) {
      const tjmMax = opportunite.montant / 220
      if (candidat.tjm <= tjmMax) reasons.push(`💰 TJM compatible (${candidat.tjm}€ ≤ ${Math.round(tjmMax)}€)`)
    }
    
    if (candidat.disponibilite_date) {
      const dispo = new Date(candidat.disponibilite_date)
      const now = new Date()
      const daysUntilDispo = Math.ceil((dispo - now) / (1000 * 60 * 60 * 24))
      if (daysUntilDispo <= 0) reasons.push(`📅 Disponible immédiatement`)
      else if (daysUntilDispo <= 30) reasons.push(`📅 Disponible dans ${daysUntilDispo} jour(s)`)
    } else {
      reasons.push(`📅 Disponible immédiatement`)
    }
    
    return reasons
  }

  async function updateMatchingStatus(matchingId, newStatus) {
    try {
      const { error } = await supabase
        .from('matchings')
        .update({ status: newStatus })
        .eq('id', matchingId)

      if (error) throw error
      await loadTopMatchings()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  function getScoreColor(score) {
    if (score >= 80) return { bg: '#dcfce7', border: '#86efac', text: '#166534' }
    if (score >= 60) return { bg: '#fef3c7', border: '#fde047', text: '#854d0e' }
    if (score >= 40) return { bg: '#fed7aa', border: '#fdba74', text: '#9a3412' }
    return { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' }
  }

  function getUrgenceColor(urgence) {
    const colors = {
      critique: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
      urgente: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
      importante: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
      relance: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' }
    }
    return colors[urgence] || colors.normale
  }

  function getUrgenceIcon(urgence) {
    return { critique: '🚨', urgente: '⚠️', importante: '⏰', relance: '📞' }[urgence] || '📋'
  }

  function getTypeIcon(type) {
    return { news: '📰', job: '💼', linkedin: '💼', company: '🏢' }[type] || '📋'
  }

  function formatDate(date) {
    if (!date) return 'Date inconnue'
    const d = new Date(date)
    const now = new Date()
    const diffMs = now - d
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return d.toLocaleDateString('fr-FR')
  }

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div></div>
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 50%, #0f1f26 100%)',
      padding: '2rem'
    }}>
      {/* En-tête */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #D4AF37 0%, #f4d467 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          📊 Tableau de Bord
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '1rem' }}>
          Pilotez votre activité ESN en temps réel
        </p>
        
        {/* Bouton Suggestions IA */}
        <button
          onClick={() => setShowMatchingModal(true)}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            color: '#fff',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(139, 92, 246, 0.3)',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
          onMouseEnter={e => {
            e.target.style.transform = 'translateY(-4px)'
            e.target.style.boxShadow = '0 12px 30px rgba(139, 92, 246, 0.4)'
          }}
          onMouseLeave={e => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.3)'
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>🤖</span>
          <span>Suggestions IA</span>
          {matchings.length > 0 && (
            <span style={{
              background: '#D4AF37',
              color: '#000',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.9rem',
              fontWeight: 700
            }}>
              {matchings.length}
            </span>
          )}
        </button>
      </div>

      {/* ALERTES URGENTES */}
      {alertes.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{
            color: '#D4AF37',
            fontSize: '1.3rem',
            fontWeight: 600,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🔔 Opportunités nécessitant votre attention ({alertes.length})
          </h2>
          <div style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
          }}>
            {alertes.slice(0, 6).map(alerte => {
              const colors = getUrgenceColor(alerte.urgence)
              return (
                <div 
                  key={alerte.id} 
                  onClick={() => onNavigate && onNavigate('opportunites')}
                  style={{
                    background: colors.bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '1rem',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '1.5rem' }}>{getUrgenceIcon(alerte.urgence)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                        {alerte.name}
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        {alerte.contacts?.company || alerte.contacts?.name || 'Client'}
                      </div>
                      <div style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 600 }}>
                        {alerte.message}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {alerte.montant ? `${Math.round(alerte.montant).toLocaleString('fr-FR')} €` : '—'}
                    </div>
                    <div style={{
                      background: colors.text,
                      color: '#fff',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {alerte.urgence}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CARTES STATS CLIQUABLES */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Contacts */}
        <div 
          onClick={() => onNavigate && onNavigate('contacts')}
          style={{
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-8px)'
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(212, 175, 55, 0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(212, 175, 55, 0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>👥</div>
            <div style={{
              color: '#D4AF37',
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Contacts</div>
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {stats.totalContacts}
          </div>
          <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            Cliquez pour voir →
          </div>
        </div>

        {/* Opportunités */}
        <div 
          onClick={() => onNavigate && onNavigate('opportunites')}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-8px)'
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(139, 92, 246, 0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(139, 92, 246, 0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>💼</div>
            <div style={{
              color: '#8b5cf6',
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Opportunités</div>
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {stats.totalOpportunites}
          </div>
          <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            Cliquez pour gérer →
          </div>
        </div>

        {/* Candidats */}
        <div 
          onClick={() => onNavigate && onNavigate('candidats')}
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-8px)'
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>👔</div>
            <div style={{
              color: '#3b82f6',
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Candidats</div>
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {stats.totalCandidats}
          </div>
          <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            Cliquez pour voir →
          </div>
        </div>

        {/* CA Gagné */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(16, 185, 129, 0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>💰</div>
            <div style={{
              color: '#10b981',
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>CA Gagné</div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {Math.round(stats.caGagne).toLocaleString('fr-FR')} €
          </div>
        </div>
      </div>

      {/* Cartes secondaires */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>📈 Pipeline</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>
            {Math.round(stats.pipeline).toLocaleString('fr-FR')} €
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>💎 CA Total Prévu</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>
            {Math.round(stats.caTotal).toLocaleString('fr-FR')} €
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>💶 TJM Moyen</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>
            {stats.tjmMoyen} €
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>🎯 Taux de Conversion</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>
            {stats.tauxConversion}%
          </div>
        </div>
      </div>

      {/* WIDGET NEWS & VEILLE */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
      }}>
        <h2 style={{
          color: '#D4AF37',
          fontSize: '1.3rem',
          fontWeight: 600,
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📰 News & Veille du marché
        </h2>

        {veilleItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Aucune actualité pour le moment
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              Les nouvelles alertes apparaîtront ici
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1rem'
          }}>
            {veilleItems.map(item => (
              <div
                key={item.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  transition: 'all 0.2s',
                  cursor: item.url ? 'pointer' : 'default'
                }}
                onClick={() => item.url && window.open(item.url, '_blank')}
                onMouseEnter={e => {
                  if (item.url) {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(212, 175, 55, 0.2)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{ fontSize: '1.5rem' }}>{getTypeIcon(item.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{
                        background: item.type === 'job' ? '#dcfce7' : '#dbeafe',
                        color: item.type === 'job' ? '#065f46' : '#1e40af',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {item.type === 'job' ? 'Offre' : 'Article'}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                        {item.source} • {formatDate(item.published_at || item.created_at)}
                      </span>
                    </div>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#fff',
                      marginBottom: '0.5rem',
                      lineHeight: 1.4
                    }}>
                      {item.title}
                    </h3>
                    {item.description && (
                      <p style={{
                        margin: 0,
                        color: '#cbd5e1',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                  {item.relevance_score > 0 && (
                    <div style={{
                      background: item.relevance_score >= 80 ? '#10b981' : item.relevance_score >= 60 ? '#eab308' : '#64748b',
                      color: '#fff',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}>
                      {item.relevance_score}%
                    </div>
                  )}
                </div>
                {item.keywords && item.keywords.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    {item.keywords.slice(0, 3).map((keyword, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'rgba(212, 175, 55, 0.2)',
                          color: '#D4AF37',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}
                      >
                        #{keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL MATCHING IA */}
      {showMatchingModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowMatchingModal(false)}
        >
          <div 
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '2rem',
              width: '90%',
              maxWidth: '900px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #D4AF37'
            }}>
              <h2 style={{
                fontSize: '1.8rem',
                fontWeight: 700,
                color: '#1e293b',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '2rem' }}>🤖</span>
                Suggestions IA - Top {matchings.length}
              </h2>
              <button
                onClick={() => setShowMatchingModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontWeight: 600, color: '#166534', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🎯</span> Algorithme de matching intelligent
              </div>
              <div style={{ color: '#15803d', fontSize: '0.9rem', lineHeight: 1.5 }}>
                <strong>Score sur 100 :</strong> 40 pts compétences • 30 pts technologies • 20 pts TJM • 10 pts disponibilité
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <button
                onClick={recalculateMatchings}
                disabled={calculatingMatchings}
                style={{
                  background: 'linear-gradient(135deg, #2C4F5A 0%, #1a3540 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: calculatingMatchings ? 'wait' : 'pointer',
                  opacity: calculatingMatchings ? 0.7 : 1
                }}
              >
                {calculatingMatchings ? '⏳ Calcul en cours...' : '🔄 Recalculer les matchings'}
              </button>
            </div>

            {matchings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Aucun matching calculé
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  Cliquez sur "Recalculer" pour générer les suggestions
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {matchings.map(matching => {
                  const colors = getScoreColor(matching.score)
                  return (
                    <div
                      key={matching.id}
                      style={{
                        background: '#fff',
                        border: `2px solid ${colors.border}`,
                        borderRadius: '12px',
                        padding: '1.5rem',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            marginBottom: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            flexWrap: 'wrap'
                          }}>
                            <span>👔 {matching.candidats?.name}</span>
                            <span style={{ fontSize: '1.5rem' }}>→</span>
                            <span>💼 {matching.opportunites?.name}</span>
                          </div>

                          {matching.match_reasons && matching.match_reasons.length > 0 && (
                            <div style={{
                              background: '#f8fafc',
                              borderRadius: '8px',
                              padding: '1rem',
                              marginTop: '1rem'
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
                                📊 Raisons du match :
                              </div>
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                              }}>
                                {matching.match_reasons.map((reason, idx) => (
                                  <div key={idx} style={{
                                    fontSize: '0.9rem',
                                    color: '#475569'
                                  }}>
                                    {reason}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{
                          marginLeft: '2rem',
                          textAlign: 'center'
                        }}>
                          <div style={{
                            background: colors.bg,
                            border: `2px solid ${colors.border}`,
                            color: colors.text,
                            padding: '1rem',
                            borderRadius: '12px',
                            minWidth: '100px'
                          }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                              {matching.score}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '0.25rem' }}>
                              {matching.score >= 80 ? 'Excellent' : matching.score >= 60 ? 'Bon match' : 'Match possible'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <button
                          onClick={() => updateMatchingStatus(matching.id, 'proposed')}
                          style={{
                            background: '#10b981',
                            color: '#fff',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Proposer
                        </button>
                        <button
                          onClick={() => updateMatchingStatus(matching.id, 'accepted')}
                          style={{
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ⭐ Accepter
                        </button>
                        <button
                          onClick={() => updateMatchingStatus(matching.id, 'rejected')}
                          style={{
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ❌ Rejeter
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
