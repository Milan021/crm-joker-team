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
    experiences: [],
    mots_cles: []
  })
  const [filtreAnciennete, setFiltreAnciennete] = useState('tous')
  const [triColonne, setTriColonne] = useState('created_at')
  const [triOrdre, setTriOrdre] = useState('desc')

  useEffect(() => {
    loadCandidats()
  }, [])

  async function loadCandidats() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('candidats')
        .select('*')
        .eq('user_id', user.id)
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

    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
    if (!validTypes.includes(file.type)) {
      alert('Format non supporté. Utilisez PDF ou DOCX.')
      return
    }

    setUploading(true)

    try {
      console.log('📎 Début upload CV:', file.name)
      
      // 1. Upload dans Supabase Storage
      const { data: { user } } = await supabase.auth.getUser()
      
      // Nettoyer le nom du fichier (enlever espaces, accents, caractères spéciaux)
      const cleanFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Remplacer caractères spéciaux par _
      
      const fileName = `${Date.now()}_${cleanFileName}`
      const filePath = `${user.id}/${fileName}`

      console.log('☁️ Upload vers Storage...', filePath)
      
      const { error: uploadError } = await supabase.storage
        .from('cvs')
        .upload(filePath, file)

      if (uploadError) {
        console.error('❌ Erreur upload Storage:', uploadError)
        throw uploadError
      }

      console.log('✅ Upload Storage réussi')

      // 2. Récupérer l'URL publique signée
      const { data: urlData } = await supabase.storage
        .from('cvs')
        .createSignedUrl(filePath, 31536000) // 1 an

      const cvUrl = urlData.signedUrl
      console.log('🔗 URL générée:', cvUrl)

      // 3. Convertir en base64 pour parsing
      console.log('🔄 Conversion en base64...')
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      console.log('✅ Base64 généré')

      // 4. Parser avec IA
      console.log('🤖 Envoi à l\'API de parsing...')
      const response = await fetch('https://crm-joker-team.vercel.app/api/parse-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64,
          fileType: file.type
        })
      })

      console.log('📡 Réponse API:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Erreur API:', errorText)
        throw new Error(`Erreur API: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Résultat parsing:', result)
      
      // L'API retourne {data: {...}}
      const parsedData = result.data || result
      
      if (parsedData && parsedData.nom) {
        console.log('📝 Données reçues:', parsedData)
        
        // 5. Extraire mots-clés
        const motsCles = extractMotsCles(parsedData)
        console.log('🏷️ Mots-clés extraits:', motsCles)

        // 6. Pré-remplir le formulaire - MAPPING EXACT
        const newFormData = {
          ...formData,
          name: parsedData.nom || '',
          titre_poste: parsedData.titre || parsedData.titre_poste || '',  // API retourne "titre"
          email: parsedData.email || '',
          phone: parsedData.telephone || '',
          experience_annees: parseInt(parsedData.experience_annees) || 0,
          // Convertir array en string si nécessaire
          competences: Array.isArray(parsedData.competences) 
            ? parsedData.competences.join(', ') 
            : (parsedData.competences || ''),
          technologies: Array.isArray(parsedData.technologies)
            ? parsedData.technologies.join(', ')
            : (parsedData.technologies || ''),
          tjm: parseInt(parsedData.tjm_suggere) || 0,
          diplomes: Array.isArray(parsedData.diplomes)
            ? parsedData.diplomes.join(', ')
            : (parsedData.diplomes || ''),
          synthese: parsedData.synthese || '',
          status: 'dispo',
          experiences: parsedData.experiences || [],
          mots_cles: motsCles,
          cv_url: cvUrl,
          cv_filename: file.name,
          cv_uploaded_at: new Date().toISOString()
        }

        console.log('✅ Formulaire pré-rempli:', newFormData)
        setFormData(newFormData)
        
        alert('✅ CV analysé avec succès !\n\nCandidatt: ' + newFormData.name + '\nPoste: ' + newFormData.titre_poste + '\n\nVérifiez les données et cliquez Créer.')
      } else {
        console.error('❌ Données invalides ou vides:', result)
        throw new Error('Aucune donnée extraite du CV')
      }
    } catch (error) {
      console.error('❌ Erreur complète:', error)
      alert(`❌ Erreur: ${error.message}\n\nVérifiez la console F12 pour plus de détails.`)
    } finally {
      setUploading(false)
      console.log('🏁 Upload terminé')
    }
  }

  function extractMotsCles(data) {
    const mots = new Set()
    
    // Fonction helper pour ajouter des mots
    const addMots = (value) => {
      if (!value) return
      
      // Si c'est une chaîne
      if (typeof value === 'string') {
        value.split(',').forEach(item => {
          const cleaned = item.trim()
          if (cleaned && cleaned.length > 2) mots.add(cleaned)
        })
      }
      // Si c'est un tableau
      else if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string') {
            const cleaned = item.trim()
            if (cleaned && cleaned.length > 2) mots.add(cleaned)
          }
        })
      }
    }
    
    // Compétences
    addMots(data.competences)
    
    // Technologies
    addMots(data.technologies)

    // Diplômes (optionnel)
    if (data.diplomes) {
      addMots(data.diplomes)
    }

    return Array.from(mots).slice(0, 20) // Max 20 mots-clés
  }

  function addMotCle(motCle) {
    const cleaned = motCle.trim()
    if (cleaned && !formData.mots_cles.includes(cleaned)) {
      setFormData({
        ...formData,
        mots_cles: [...formData.mots_cles, cleaned]
      })
    }
  }

  function removeMotCle(motCle) {
    setFormData({
      ...formData,
      mots_cles: formData.mots_cles.filter(m => m !== motCle)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
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
        experiences: formData.experiences || [],
        mots_cles: formData.mots_cles || [],
        cv_url: formData.cv_url || null,
        cv_filename: formData.cv_filename || null,
        cv_uploaded_at: formData.cv_uploaded_at || null,
        user_id: user.id
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
    if (!confirm('Supprimer ce candidat et son CV ?')) return
    
    try {
      // Supprimer le CV du storage si existe
      const candidat = candidats.find(c => c.id === id)
      if (candidat?.cv_url) {
        const { data: { user } } = await supabase.auth.getUser()
        const filePath = `${user.id}/${candidat.cv_filename}`
        await supabase.storage.from('cvs').remove([filePath])
      }

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
      experiences: [],
      mots_cles: []
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
      experiences: candidat.experiences || [],
      mots_cles: candidat.mots_cles || [],
      cv_url: candidat.cv_url || null,
      cv_filename: candidat.cv_filename || null,
      cv_uploaded_at: candidat.cv_uploaded_at || null
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

  function getAnciennete(createdAt) {
    if (!createdAt) return { type: 'ancien', label: 'Date inconnue', jours: 999 }
    
    const now = new Date()
    const created = new Date(createdAt)
    const diffMs = now - created
    const diffJours = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffJours <= 7) {
      return { type: 'nouveau', label: `Il y a ${diffJours} jour${diffJours > 1 ? 's' : ''}`, jours: diffJours }
    } else if (diffJours <= 30) {
      return { type: 'recent', label: `Il y a ${diffJours} jours`, jours: diffJours }
    } else if (diffJours <= 365) {
      const mois = Math.floor(diffJours / 30)
      return { type: 'ancien', label: `Il y a ${mois} mois`, jours: diffJours }
    } else {
      const annees = Math.floor(diffJours / 365)
      return { type: 'ancien', label: `Il y a ${annees} an${annees > 1 ? 's' : ''}`, jours: diffJours }
    }
  }

  function getAncienneteBadge(type) {
    const badges = {
      nouveau: { bg: '#dcfce7', text: '#166534', icon: '🆕', label: 'Nouveau' },
      recent: { bg: '#dbeafe', text: '#1e40af', icon: '📅', label: 'Récent' },
      ancien: { bg: '#f1f5f9', text: '#475569', icon: '📦', label: 'Ancien' }
    }
    return badges[type] || badges.ancien
  }

  function filtrerCandidats(candidats) {
    if (filtreAnciennete === 'tous') return candidats
    
    return candidats.filter(c => {
      const { type } = getAnciennete(c.created_at)
      return type === filtreAnciennete
    })
  }

  function trierCandidats(candidats) {
    const sorted = [...candidats].sort((a, b) => {
      let valA, valB
      
      if (triColonne === 'created_at') {
        valA = new Date(a.created_at || 0)
        valB = new Date(b.created_at || 0)
      } else if (triColonne === 'name') {
        valA = (a.name || '').toLowerCase()
        valB = (b.name || '').toLowerCase()
      } else if (triColonne === 'tjm') {
        valA = a.tjm || 0
        valB = b.tjm || 0
      }
      
      if (triOrdre === 'asc') {
        return valA > valB ? 1 : -1
      } else {
        return valA < valB ? 1 : -1
      }
    })
    
    return sorted
  }

  function toggleTri(colonne) {
    if (triColonne === colonne) {
      setTriOrdre(triOrdre === 'asc' ? 'desc' : 'asc')
    } else {
      setTriColonne(colonne)
      setTriOrdre('desc')
    }
  }

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div></div>
  }

  const candDispos = candidats.filter(c => c.status === 'dispo').length
  const candMission = candidats.filter(c => c.status === 'mission').length
  const candNouveaux = candidats.filter(c => getAnciennete(c.created_at).type === 'nouveau').length
  const candRecents = candidats.filter(c => getAnciennete(c.created_at).type === 'recent').length
  const candAnciens = candidats.filter(c => getAnciennete(c.created_at).type === 'ancien').length

  const candidatsFiltres = trierCandidats(filtrerCandidats(candidats))

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
            👔 Candidats ({candidatsFiltres.length})
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

        {/* Filtres par ancienneté */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setFiltreAnciennete('tous')}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: filtreAnciennete === 'tous' ? '2px solid #2C4F5A' : '1px solid #e2e8f0',
              background: filtreAnciennete === 'tous' ? '#2C4F5A' : '#fff',
              color: filtreAnciennete === 'tous' ? '#fff' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            Tous ({candidats.length})
          </button>
          
          <button
            onClick={() => setFiltreAnciennete('nouveau')}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: filtreAnciennete === 'nouveau' ? '2px solid #16a34a' : '1px solid #e2e8f0',
              background: filtreAnciennete === 'nouveau' ? '#dcfce7' : '#fff',
              color: filtreAnciennete === 'nouveau' ? '#166534' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            🆕 Nouveaux ({candNouveaux})
          </button>
          
          <button
            onClick={() => setFiltreAnciennete('recent')}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: filtreAnciennete === 'recent' ? '2px solid #2563eb' : '1px solid #e2e8f0',
              background: filtreAnciennete === 'recent' ? '#dbeafe' : '#fff',
              color: filtreAnciennete === 'recent' ? '#1e40af' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            📅 Récents ({candRecents})
          </button>
          
          <button
            onClick={() => setFiltreAnciennete('ancien')}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: filtreAnciennete === 'ancien' ? '2px solid #64748b' : '1px solid #e2e8f0',
              background: filtreAnciennete === 'ancien' ? '#f1f5f9' : '#fff',
              color: filtreAnciennete === 'ancien' ? '#475569' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            📦 Anciens ({candAnciens})
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th 
                onClick={() => toggleTri('name')}
                style={{ 
                  padding: '1rem', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#475569',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                Nom {triColonne === 'name' && (triOrdre === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Poste</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Mots-clés</th>
              <th 
                onClick={() => toggleTri('created_at')}
                style={{ 
                  padding: '1rem', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#475569',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                Ancienneté {triColonne === 'created_at' && (triOrdre === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>CV</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Statut</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidatsFiltres.map((candidat, idx) => {
              const anciennete = getAnciennete(candidat.created_at)
              const badge = getAncienneteBadge(anciennete.type)
              
              return (
                <tr
                  key={candidat.id}
                  style={{
                    borderBottom: idx < candidatsFiltres.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  <td style={{ padding: '1rem', fontWeight: 600, color: '#1e293b' }}>{candidat.name}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{candidat.titre_poste || '—'}</td>
                  <td style={{ padding: '1rem' }}>
                    {candidat.mots_cles && candidat.mots_cles.length > 0 ? (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {candidat.mots_cles.slice(0, 3).map((mot, i) => (
                          <span key={i} style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {mot}
                          </span>
                        ))}
                        {candidat.mots_cles.length > 3 && (
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            +{candidat.mots_cles.length - 3}
                          </span>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        background: badge.bg,
                        color: badge.text,
                        padding: '0.3rem 0.7rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        {badge.icon} {badge.label}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {anciennete.label}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {candidat.cv_url ? (
                      <a 
                        href={candidat.cv_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          color: '#2C4F5A',
                          textDecoration: 'none',
                          fontWeight: 600,
                          fontSize: '1.2rem'
                        }}
                        title="Télécharger le CV"
                      >
                        📎
                      </a>
                    ) : '—'}
                  </td>
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
              )
            })}
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
            maxWidth: '800px',
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

            {/* Upload CV */}
            <div style={{
              background: '#f0fdf4',
              border: '2px dashed #86efac',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📎</div>
              <div style={{ fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>
                Charger un CV pour extraction automatique
              </div>
              <div style={{ fontSize: '0.85rem', color: '#15803d', marginBottom: '1rem' }}>
                PDF ou DOCX • L'IA analysera le CV et extraira les mots-clés
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
              
              {formData.cv_filename && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: '#fff',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: '#166534',
                  fontWeight: 600
                }}>
                  ✅ CV chargé : {formData.cv_filename}
                </div>
              )}
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

                {/* Mots-clés */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>
                    Mots-clés
                  </label>
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    minHeight: '80px',
                    background: '#f8fafc'
                  }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {formData.mots_cles.map((mot, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: '#2C4F5A',
                            color: '#fff',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          {mot}
                          <button
                            type="button"
                            onClick={() => removeMotCle(mot)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#D4AF37',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              padding: 0,
                              lineHeight: 1
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Ajouter un mot-clé et appuyez sur Entrée"
                      onKeyPress={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addMotCle(e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                    Appuyez sur Entrée pour ajouter • Cliquez sur × pour supprimer
                  </div>
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
