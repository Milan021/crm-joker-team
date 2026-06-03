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
      // ✅ CORRECTION : suppression de categorie_entreprise qui bloquait tout
      // L'API gouv.fr ne supporte pas ce filtre en query string de cette façon
      const params = new URLSearchParams({
        q: query || '',
        per_page: '20',   // ✅ "per_page" et non "par_page"
      })
      if (req.body.region) params.append('region', req.body.region)
      if (req.body.naf) params.append('activite_principale', req.body.naf)

      const url = `https://recherche-entreprises.api.gouv.fr/search?${params}`
      console.log('Fetching:', url)

      const resp = await fetch(url)
      if (!resp.ok) {
        const errText = await resp.text()
        console.error('API gouv.fr erreur:', resp.status, errText)
        throw new Error(`API gouv.fr erreur ${resp.status}`)
      }
      const data = await resp.json()
      console.log('Total results:', data.total_results, '| Page results:', data.results?.length)

      const results = (data.results || []).map(r => {
        // ✅ CORRECTION : les champs sont dans r.siege pour l'adresse
        const siege = r.siege || {}
        return {
          nom: r.nom_complet || r.nom_raison_sociale || '',
          siren: r.siren || '',
          siret: siege.siret || '',
          activite: siege.activite_principale || r.activite_principale || '',
          libelle_activite: siege.libelle_activite_principale || r.libelle_activite_principale || '',
          categorie: r.categorie_entreprise || '',
          tranche_effectif: siege.tranche_effectif_salarie || r.tranche_effectif_salarie || '',
          date_creation: r.date_creation || '',
          adresse: siege.adresse || siege.numero_voie && `${siege.numero_voie} ${siege.type_voie} ${siege.libelle_voie}`.trim() || '',
          code_postal: siege.code_postal || '',
          ville: siege.libelle_commune || '',
          region: siege.libelle_region || '',
          etat: r.etat_administratif || siege.etat_administratif || '',
          nature_juridique: r.nature_juridique || '',
          chiffre_affaires: r.chiffre_affaires_annuel_moyen || null,
          dirigeants: (r.dirigeants || []).slice(0, 3).map(d => ({
            nom: `${d.nom || ''} ${d.prenoms || ''}`.trim(),
            qualite: d.qualite || ''
          }))
        }
      })
      // ✅ Filtre uniquement les entreprises actives
      .filter(r => r.etat === 'A' || r.etat === '')

      console.log('Filtered results:', results.length)
      return res.status(200).json({ success: true, results, total: data.total_results || results.length })
    }

    // ACTION 4: Fetch buying signals (levées de fonds, LinkedIn, offres IT)
    if (action === 'signals') {
      const { nom, dirigeants = [], siren } = req.body.prospect || {}
      const signals = []

      // Helper: parse Google News RSS
      async function fetchRSS(url) {
        try {
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          if (!r.ok) return []
          const xml = await r.text()
          const items = []
          const itemRegex = /<item>([\s\S]*?)<\/item>/g
          let m
          while ((m = itemRegex.exec(xml)) !== null) {
            const block = m[1]
            const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) || /<title>(.*?)<\/title>/.exec(block) || [])[1] || ''
            const link  = (/<link>(.*?)<\/link>/.exec(block) || [])[1] || ''
            const date  = (/<pubDate>(.*?)<\/pubDate>/.exec(block) || [])[1] || ''
            const source = (/<source[^>]*>(.*?)<\/source>/.exec(block) || [])[1] || ''
            if (title) items.push({ title: title.trim(), link: link.trim(), date: date.trim(), source: source.trim() })
          }
          return items.slice(0, 5)
        } catch { return [] }
      }

      // 1. Levées de fonds
      const fundsQuery = encodeURIComponent(`"${nom}" levée de fonds OR financement OR investissement OR série`)
      const fundsItems = await fetchRSS(`https://news.google.com/rss/search?q=${fundsQuery}&hl=fr&gl=FR&ceid=FR:fr`)
      for (const item of fundsItems) {
        signals.push({
          type: 'levee_fonds',
          icon: '💰',
          label: 'Levée de fonds',
          title: item.title,
          link: item.link,
          date: item.date,
          source: item.source,
          heat: 3
        })
      }

      // 2. Actualités presse générale sur l'entreprise
      const newsQuery = encodeURIComponent(`"${nom}" expansion OR croissance OR transformation OR digital OR SI OR recrutement`)
      const newsItems = await fetchRSS(`https://news.google.com/rss/search?q=${newsQuery}&hl=fr&gl=FR&ceid=FR:fr`)
      for (const item of newsItems.slice(0, 3)) {
        signals.push({
          type: 'actualite',
          icon: '📰',
          label: 'Actualité',
          title: item.title,
          link: item.link,
          date: item.date,
          source: item.source,
          heat: 1
        })
      }

      // 3. Posts / activité LinkedIn du dirigeant principal
      const dirigeant = dirigeants[0]
      if (dirigeant?.nom) {
        const liQuery = encodeURIComponent(`"${dirigeant.nom}" site:linkedin.com OR recrutement IT OR DSI OR transformation numérique`)
        const liItems = await fetchRSS(`https://news.google.com/rss/search?q=${liQuery}&hl=fr&gl=FR&ceid=FR:fr`)
        for (const item of liItems.slice(0, 3)) {
          signals.push({
            type: 'linkedin',
            icon: '💼',
            label: `LinkedIn – ${dirigeant.nom}`,
            title: item.title,
            link: item.link,
            date: item.date,
            source: item.source,
            heat: 2
          })
        }
        // Recherche directe LinkedIn
        signals.push({
          type: 'linkedin_search',
          icon: '🔗',
          label: 'Rechercher sur LinkedIn',
          title: `Voir le profil de ${dirigeant.nom}`,
          link: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(dirigeant.nom)}`,
          date: '',
          source: 'LinkedIn',
          heat: 0
        })
      }

      // 4. Offres d'emploi IT (Indeed / Google News)
      const jobsQuery = encodeURIComponent(`"${nom}" recrutement OR "offre d'emploi" développeur OR DSI OR informatique OR cloud OR data`)
      const jobsItems = await fetchRSS(`https://news.google.com/rss/search?q=${jobsQuery}&hl=fr&gl=FR&ceid=FR:fr`)
      for (const item of jobsItems.slice(0, 3)) {
        signals.push({
          type: 'emploi',
          icon: '🧑‍💻',
          label: 'Offre emploi IT',
          title: item.title,
          link: item.link,
          date: item.date,
          source: item.source,
          heat: 2
        })
      }
      // Lien direct recherche Indeed
      signals.push({
        type: 'indeed_search',
        icon: '🔍',
        label: 'Rechercher offres IT',
        title: `Voir les offres IT de ${nom} sur Indeed`,
        link: `https://fr.indeed.com/emplois?q=informatique+developpeur+data&l=${encodeURIComponent(nom)}`,
        date: '',
        source: 'Indeed',
        heat: 0
      })

      // Score de chaleur global
      const totalHeat = signals.reduce((acc, s) => acc + (s.heat || 0), 0)
      const heatLevel = totalHeat >= 6 ? 'Très chaud 🔥🔥' : totalHeat >= 3 ? 'Chaud 🔥' : totalHeat >= 1 ? 'Tiède 🌡️' : 'Froid ❄️'

      return res.status(200).json({ success: true, signals, heatLevel, totalHeat })
    }

    // ACTION 2: Score a prospect
    if (action === 'score' && prospect && ANTHROPIC_KEY) {
      let claudeResp = null
      for (let attempt = 0; attempt < 3; attempt++) {
        claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 600,
            system: `Tu es un expert en prospection commerciale pour Joker Team, une ESN/agence IT specialisee dans le placement de freelances IT.
Tu evalues si une entreprise PME/ETI est un bon prospect pour des prestations IT (developpement, infra, data, cloud, cybersecurite, modernisation SI).

Analyse l'entreprise et reponds UNIQUEMENT en JSON valide, sans markdown :
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
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      }

      if (claudeResp && claudeResp.ok) {
        const data = await claudeResp.json()
        let content = data.content?.[0]?.text || '{}'
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        try {
          return res.status(200).json({ success: true, scoring: JSON.parse(content) })
        } catch {
          return res.status(200).json({ success: true, scoring: { score: 50, potentiel: 'Non evalue', raisons: [], signaux_achat: [] } })
        }
      }
      return res.status(200).json({ success: true, scoring: { score: 50, potentiel: 'Non evalue', raisons: [], signaux_achat: [] } })
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
      for (let attempt = 0; attempt < 3; attempt++) {
        claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 800,
            system: `Tu es le ghostwriter commercial de Milan Calic, fondateur de Joker Team, ESN specialisee dans le placement de freelances IT.
Joker Team propose : developpement (Java, .NET, Python, COBOL), infrastructure (Cloud, DevOps), data (BI, Big Data), cybersecurite, et modernisation de SI.

${channelInstructions[channel] || channelInstructions.email}
${toneInstructions[tone] || toneInstructions.direct}

${prospect.scoring?.angle_approche ? 'Angle recommande : ' + prospect.scoring.angle_approche : ''}

Reponds UNIQUEMENT en JSON valide, sans markdown :
{
  "subject": "Objet de l'email (si email, sinon null)",
  "body": "Corps du message",
  "followup": "Message de relance (J+3)"
}`,
            messages: [{ role: 'user', content: `Genere un message de prospection pour : ${JSON.stringify({ nom: prospect.nom, activite: prospect.libelle_activite, ville: prospect.ville, categorie: prospect.categorie, dirigeants: prospect.dirigeants })}` }]
          })
        })
        if (claudeResp.ok || claudeResp.status !== 529) break
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      }

      if (claudeResp && claudeResp.ok) {
        const data = await claudeResp.json()
        let content = data.content?.[0]?.text || '{}'
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        try {
          return res.status(200).json({ success: true, message: JSON.parse(content) })
        } catch {
          return res.status(500).json({ error: 'Parsing JSON echoue' })
        }
      }
      return res.status(500).json({ error: 'Generation indisponible' })
    }

    return res.status(400).json({ error: 'Action invalide' })
  } catch (error) {
    console.error('Prospect error:', error)
    res.status(500).json({ error: error.message })
  }
}
