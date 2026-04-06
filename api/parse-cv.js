// API Vercel pour parser les CV avec Claude IA
// Chemin: /api/parse-cv.js

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Gérer les requêtes OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
  // Accepter seulement POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { fileData, fileType } = req.body
    
    if (!fileData || !fileType) {
      return res.status(400).json({ error: 'Missing fileData or fileType' })
    }
    
    // Appeler l'API Claude (la clé est dans les variables d'environnement Vercel)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: fileType,
                data: fileData
              }
            },
            {
              type: 'text',
              text: `Analyse ce CV et extrait les informations au format JSON strict (sans markdown, sans backticks) :

{
  "nom": "Prénom NOM complet",
  "titre_poste": "Titre du poste actuel ou recherché",
  "email": "email si trouvé, sinon null",
  "telephone": "téléphone si trouvé, sinon null",
  "experience_annees": nombre total d'années d'expérience (nombre entier),
  "competences": "liste des compétences séparées par des virgules (ex: COBOL, Mainframe, DB2)",
  "technologies": "liste des technologies séparées par des virgules (ex: Java, Python, AWS)",
  "tjm_suggere": estimation du TJM en euros basé sur l'expérience et les compétences (nombre entier),
  "status": "dispo",
  "synthese": "courte synthèse du profil en 2-3 lignes max",
  "diplomes": "diplômes et formations séparés par des virgules",
  "experiences": [
    {
      "entreprise": "Nom entreprise",
      "poste": "Titre du poste",
      "periode": "Dates (ex: 04/2019 à 08/2023)",
      "duree": "Durée (ex: 4 ans)",
      "description": "Description des activités principales"
    }
  ]
}

IMPORTANT:
- Retourne UNIQUEMENT le JSON, sans texte avant ou après
- Pas de backticks, pas de \`\`\`json
- Pour tjm_suggere: base-toi sur l'expérience (junior: 300-400€, confirmé: 450-600€, senior: 600-800€, expert: 800-1000€)
- Pour competences et technologies: sépare par des virgules, pas de tableau
- Pour experience_annees: compte le total d'années d'expérience professionnelle`
            }
          ]
        }]
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      return res.status(response.status).json({ 
        error: 'Claude API error', 
        details: errorText 
      })
    }
    
    const result = await response.json()
    
    // Extraire le JSON de la réponse
    let parsedData
    try {
      const textContent = result.content[0].text
      // Nettoyer les backticks markdown si présents
      const jsonText = textContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      parsedData = JSON.parse(jsonText)
      
      // Nettoyer les guillemets échappés dans les valeurs
      Object.keys(parsedData).forEach(key => {
        if (typeof parsedData[key] === 'string') {
          // Enlever les guillemets doubles au début et à la fin
          parsedData[key] = parsedData[key].replace(/^"|"$/g, '')
        }
      })
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw response:', result.content[0].text)
      return res.status(500).json({ 
        error: 'Failed to parse CV data',
        raw: result.content[0].text
      })
    }
    
    // Retourner les données parsées
    res.status(200).json({ 
      success: true,
      data: parsedData 
    })
    
  } catch (error) {
    console.error('Error parsing CV:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
}
