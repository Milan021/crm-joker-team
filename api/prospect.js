// API Vercel : /api/prospect.js
// Recherche de prospects, scoring IA, generation emails/messages LinkedIn

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { action, query, prospect, channel, tone } = req.body
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

    // ACTION 1: Search prospects
    if (action === 'search') {
      const params = new URLSearchParams({
        q: query || '',
        par_page: '10',
        categorie_entreprise: 'PME,ETI'
      })
      if (req.body.region) params.append('region', req.body.region)
      if (req.body.naf) params.append('activite_principale', req.body.naf)

      const resp = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`)
      if (!resp.ok) throw new Error('API gouv.fr erreur')
      const data = await resp.json()

      const results = (data.results || []).map(r => ({
        nom: r.nom_complet || r.nom_raison_sociale || '',
        siren: r.siren || '',
        siret: r.siege?.siret || '',
        activite: r.activite_principale || '',
        libelle_activite: r.libelle_activite_principale || '',
        categorie: r.categorie_entreprise || '',
        tranche_effectif: r.tranche_effectif_salarie || '',
        date_creation: r.date_creation || '',
        adresse: r.siege?.adresse || '',
        code_postal: r.siege?.code_postal || '',
        ville: r.siege?.libelle_commune || '',
        region: r.siege?.libelle_region || '',
        etat: r.etat_administratif || '',
        nature_juridique: r.nature_juridique || '',
        dirigeants: (r.dirigeants || []).slice(0, 3).map(d => ({
          nom: d.nom + ' ' + (d.prenoms || ''),
          qualite: d.qualite || ''
        }))
      })).filter(r => r.etat === 'A')

      return res.status(200).json({ success: true, results })
    }

    // ACTION 2: Score a prospect
    if (action === 'score' && prospect && ANTHROPIC_KEY) {
      let claudeResp = null
      for (let attempt = 0; attempt < 2; attempt++) {
        claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 600,
            system: `Tu es un expert en prospection commerciale pour Joker Team, une ESN/agence IT specialisee dans le placement de freelances IT.
Tu evalues si une entreprise PME/ETI est un bon prospect pour des prestations IT (developpement, infra, data, cloud, cybersecurite, modernisation SI).

Analyse l'entreprise et reponds UNIQUEMENT en JSON :
{
  "score": 75,
  "potentiel": "Fort|Moyen|Faible",
  "raisons": ["Raison 1", "Raison 2"],
  "signaux_achat": ["Signal 1", "Signal 2"],
  "angle_approche": "Comment approcher cette entreprise",
  "budget_estime": "Estimation du budget IT annuel",
  "decision_maker": "Qui contacter (titre du poste)",
  "timing": "Bon moment pour prospecter ou pas"
}`,
            messages: [{ role: 'user', content: JSON.stringify(prospect) }]
          })
        })
        if (claudeResp.ok || claudeResp.status !== 529) break
        await new Promise(r => setTimeout(r, 2000))
      }

      if (claudeResp && claudeResp.ok) {
        const data = await claudeResp.json()
        let content = data.content?.[0]?.text || '{}'
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        return res.status(200).json({ success: true, scoring: JSON.parse(content) })
      }
      return res.status(200).json({ success: true, scoring: { score: 50, potentiel: 'Non evalue' } })
    }

    // ACTION 3: Generate prospection message
    if (action === 'generate' && prospect && ANTHROPIC_KEY) {
      const channelInstructions = {
        email: `Genere un email de prospection froid.
Regles :
- Objet accrocheur (max 50 caracteres)
- 4-6 lignes maximum dans le corps
- Personnalise avec le nom de l'entreprise et son secteur
- Propose de la valeur concrete (pas de blabla generique)
- Call-to-action clair (proposer un call de 15min)
- Signature : Milan Calic, Fondateur - Joker Team
- Email : milan.calic@joker-team.fr | Tel : a completer
- Ne sois PAS trop formel, reste humain et direct`,

        linkedin: `Genere un message LinkedIn de prospection.
Regles :
- Max 300 caracteres (limite LinkedIn pour les InMails)
- Accroche personnalisee (reference a l'entreprise ou au secteur)
- Proposer de la valeur en 1 phrase
- Call-to-action leger (pas agressif)
- Tutoiement accepte si le ton est decontracte
- PAS de signature formelle (c'est LinkedIn)`
      }

      const toneInstructions = {
        direct: 'Ton direct et business. Va droit au but, pas de fioritures.',
        consultative: 'Ton consultant. Pose une question pertinente sur leur SI, propose ton expertise.',
        challenger: 'Ton challenger. Identifie un probleme potentiel dans leur SI et propose une solution.',
        networking: 'Ton networking. Approche relationnelle, pas de vente directe, juste creer le lien.'
      }

      let claudeResp = null
      for (let attempt = 0; attempt < 2; attempt++) {
        claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 800,
            system: `Tu es le ghostwriter commercial de Milan Calic, fondateur de Joker Team, ESN specialisee dans le placement de freelances IT.
Joker Team propose : developpement (Java, .NET, Python, COBOL), infrastructure (Cloud, DevOps), data (BI, Big Data), cybersecurite, et modernisation de SI.

${channelInstructions[channel] || channelInstructions.email}
${toneInstructions[tone] || toneInstructions.direct}

${prospect.scoring?.angle_approche ? 'Angle recommande : ' + prospect.scoring.angle_approche : ''}

Reponds UNIQUEMENT en JSON :
{
  "subject": "Objet de l'email (si email)",
  "body": "Corps du message",
  "followup": "Message de relance (J+3)"
}`,
            messages: [{ role: 'user', content: `Genere un message de prospection pour : ${JSON.stringify({ nom: prospect.nom, activite: prospect.libelle_activite, ville: prospect.ville, categorie: prospect.categorie, dirigeants: prospect.dirigeants })}` }]
          })
        })
        if (claudeResp.ok || claudeResp.status !== 529) break
        await new Promise(r => setTimeout(r, 2000))
      }

      if (claudeResp && claudeResp.ok) {
        const data = await claudeResp.json()
        let content = data.content?.[0]?.text || '{}'
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        return res.status(200).json({ success: true, message: JSON.parse(content) })
      }
      return res.status(500).json({ error: 'Generation indisponible' })
    }

    return res.status(400).json({ error: 'Action invalide' })
  } catch (error) {
    console.error('Prospect error:', error)
    res.status(500).json({ error: error.message })
  }
}
