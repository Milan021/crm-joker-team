// API Vercel : /api/audit-company.js
// Récupère les données financières d'une entreprise via Pappers + analyse IA

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { query, siren } = req.body
    if (!query && !siren) return res.status(400).json({ error: 'Nom ou SIREN requis' })

    const PAPPERS_KEY = process.env.PAPPERS_API_KEY
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!PAPPERS_KEY) return res.status(500).json({ error: 'Clé Pappers manquante' })

    // Step 1: Search company on Pappers
    let companyData = null

    if (siren) {
      const resp = await fetch(`https://api.pappers.fr/v2/entreprise?api_token=${PAPPERS_KEY}&siren=${siren}`)
      if (resp.ok) companyData = await resp.json()
    } else {
      const resp = await fetch(`https://api.pappers.fr/v2/recherche?api_token=${PAPPERS_KEY}&q=${encodeURIComponent(query)}&par_page=1`)
      if (resp.ok) {
        const searchData = await resp.json()
        if (searchData.resultats && searchData.resultats.length > 0) {
          const sirenFound = searchData.resultats[0].siren
          const detailResp = await fetch(`https://api.pappers.fr/v2/entreprise?api_token=${PAPPERS_KEY}&siren=${sirenFound}`)
          if (detailResp.ok) companyData = await detailResp.json()
        }
      }
    }

    if (!companyData) {
      return res.status(404).json({ error: 'Entreprise non trouvée' })
    }

    // Extract key financial data
    const finances = companyData.finances || companyData.comptes || []
    const lastFinances = Array.isArray(finances) ? finances.slice(0, 3) : []

    const companyInfo = {
      nom: companyData.nom_entreprise || companyData.denomination || '',
      siren: companyData.siren || '',
      siret: companyData.siege?.siret || '',
      forme_juridique: companyData.forme_juridique || '',
      date_creation: companyData.date_creation || '',
      effectif: companyData.effectif || companyData.tranche_effectif || '',
      capital: companyData.capital || '',
      adresse: companyData.siege?.adresse_ligne_1 || '',
      code_postal: companyData.siege?.code_postal || '',
      ville: companyData.siege?.ville || '',
      code_naf: companyData.code_naf || '',
      libelle_naf: companyData.libelle_code_naf || '',
      dirigeants: (companyData.representants || []).slice(0, 5).map(d => ({
        nom: `${d.prenom || ''} ${d.nom || ''}`.trim(),
        qualite: d.qualite || '',
        date_naissance: d.date_de_naissance || ''
      })),
      finances: lastFinances.map(f => ({
        annee: f.annee || f.date_cloture?.slice(0, 4) || '',
        chiffre_affaires: f.chiffre_d_affaires || f.ca || null,
        resultat: f.resultat || f.resultat_net || null,
        effectif: f.effectif || null
      })),
      statut_rcs: companyData.statut_rcs || '',
      derniere_mise_a_jour: companyData.derniere_mise_a_jour || ''
    }

    // Step 2: AI Analysis (if Anthropic key available)
    let aiAnalysis = null
    if (ANTHROPIC_KEY) {
      try {
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: `Tu es un analyste financier expert pour une ESN (Joker Team). 
Tu analyses les données financières d'une entreprise pour évaluer :
1. Sa santé financière globale (score /100)
2. Sa capacité à investir dans des prestations IT / freelances
3. Le budget IT estimé qu'elle pourrait allouer
4. Les risques identifiés
5. La recommandation commerciale (approcher / attendre / éviter)

Réponds UNIQUEMENT en JSON sans markdown :
{
  "score_sante": 75,
  "niveau": "Bonne santé" ou "Santé moyenne" ou "Fragile" ou "Critique",
  "capacite_budget_it": "Estimation du budget IT annuel possible",
  "analyse": "Analyse en 3-4 phrases",
  "risques": ["Risque 1", "Risque 2"],
  "opportunites": ["Opportunité 1", "Opportunité 2"],
  "recommandation": "approcher" ou "attendre" ou "eviter",
  "recommandation_detail": "Explication en 2 phrases",
  "tjm_max_estime": 600
}`,
            messages: [{ role: 'user', content: `Analyse cette entreprise :\n${JSON.stringify(companyInfo, null, 2)}` }]
          })
        })

        if (claudeResp.ok) {
          const aiData = await claudeResp.json()
          let content = aiData.content?.[0]?.text || '{}'
          content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
          aiAnalysis = JSON.parse(content)
        }
      } catch (aiErr) {
        console.error('AI analysis error:', aiErr)
      }
    }

    res.status(200).json({
      success: true,
      company: companyInfo,
      analysis: aiAnalysis
    })

  } catch (error) {
    console.error('Audit error:', error)
    res.status(500).json({ error: error.message })
  }
}
