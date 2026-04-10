// API Vercel : /api/generate-dossier.js
// Génère un dossier de compétences structuré via Claude IA

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { candidat, mission } = req.body
    if (!candidat) return res.status(400).json({ error: 'Candidat requis' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Clé API manquante' })

    const missionContext = mission ? `
MISSION CIBLÉE :
- Nom : ${mission.name || 'Non spécifié'}
- Type : ${mission.type || 'AT'}
- Client : ${mission.client || 'Non spécifié'}
- Notes : ${mission.notes || ''}
Adapte le dossier pour mettre en avant les compétences pertinentes pour cette mission.
` : ''

    const systemPrompt = `Tu es un expert RH d'une ESN (Joker Team). Tu génères des dossiers de compétences professionnels pour présenter des freelances IT aux clients.

CANDIDAT :
- Nom : ${candidat.name || 'Non renseigné'}
- Poste : ${candidat.titre_poste || 'Non renseigné'}
- TJM : ${candidat.tjm || 'Non renseigné'}€/jour
- Compétences : ${candidat.competences || 'Non renseigné'}
- Mots-clés : ${(candidat.mots_cles || []).join(', ') || 'Non renseigné'}
- Expérience : ${candidat.experience_annees || 'Non renseigné'} ans
- Synthèse : ${candidat.synthese || 'Non disponible'}
- Statut : ${candidat.status || 'Non renseigné'}
${missionContext}

Génère un dossier de compétences au format JSON avec cette structure exacte :
{
  "titre": "Titre du profil (ex: Expert COBOL/DB2 - 15 ans d'expérience)",
  "resume": "Résumé professionnel en 3-4 phrases",
  "competences_techniques": [
    { "categorie": "Langages", "items": ["COBOL", "JCL", "SQL"] },
    { "categorie": "Environnements", "items": ["z/OS", "CICS", "DB2"] }
  ],
  "experiences": [
    {
      "poste": "Consultant Mainframe Senior",
      "client": "Grande banque française",
      "duree": "2022-2024",
      "description": "Description de la mission en 2-3 phrases",
      "technologies": ["COBOL", "DB2", "CICS"]
    }
  ],
  "formation": ["Diplôme ou certification"],
  "langues": ["Français (natif)", "Anglais (professionnel)"],
  "points_forts": ["Point fort 1", "Point fort 2", "Point fort 3"]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans markdown, sans backticks, sans texte avant ou après.
Si des informations manquent, invente des données réalistes et cohérentes basées sur le profil.`

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Génère le dossier de compétences maintenant en JSON.' }]
      })
    })

    if (!claudeResp.ok) throw new Error(`Claude API: ${claudeResp.status}`)

    const data = await claudeResp.json()
    let content = data.content?.[0]?.text || '{}'

    // Clean potential markdown fences
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    const dossier = JSON.parse(content)

    res.status(200).json({ success: true, dossier })
  } catch (error) {
    console.error('Generate dossier error:', error)
    res.status(500).json({ error: error.message })
  }
}
