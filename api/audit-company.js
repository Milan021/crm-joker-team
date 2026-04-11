// API Vercel : /api/audit-company.js
// Récupère les données d'une entreprise via API gouv.fr (GRATUIT) + analyse IA

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { query, siren } = req.body
    if (!query && !siren) return res.status(400).json({ error: 'Nom ou SIREN requis' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

    // Step 1: Search company via API gouv.fr (100% gratuit, illimité)
    let companyData = null

    if (siren) {
      // Recherche par SIREN/SIRET
      const cleanSiren = siren.replace(/\s/g, '').slice(0, 9)
      const resp = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiren}&per_page=1`)
      if (resp.ok) {
        const data = await resp.json()
        if (data.results && data.results.length > 0) {
          companyData = data.results[0]
        }
      }
    } else {
      // Recherche par nom
      const resp = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=1`)
      if (resp.ok) {
        const data = await resp.json()
        if (data.results && data.results.length > 0) {
          companyData = data.results[0]
        }
      }
    }

    if (!companyData) {
      return res.status(404).json({ error: 'Entreprise non trouvée' })
    }

    // Extract company info from API gouv.fr format
    const siege = companyData.siege || {}
    const dirigeants = (companyData.dirigeants || []).slice(0, 5)
    
    // Get financial data from API gouv.fr if available
    const finances = []
    if (companyData.finances && Object.keys(companyData.finances).length > 0) {
      // API gouv.fr peut avoir des données financières
      Object.entries(companyData.finances).forEach(([annee, data]) => {
        finances.push({
          annee: annee,
          chiffre_affaires: data.ca || null,
          resultat: data.resultat_net || null,
          effectif: null
        })
      })
    }

    // Try to get more details from SIRENE API
    let extraData = {}
    try {
      const sirenNum = companyData.siren
      if (sirenNum) {
        const sireneResp = await fetch(`https://api.insee.fr/entreprises/sirene/V3.11/siren/${sirenNum}`, {
          headers: { 'Accept': 'application/json' }
        }).catch(() => null)
        
        // INSEE API may require auth, so we just try
        if (sireneResp && sireneResp.ok) {
          const sireneData = await sireneResp.json()
          if (sireneData.uniteLegale) {
            extraData = sireneData.uniteLegale
          }
        }
      }
    } catch (e) {
      // INSEE API is optional, continue without it
    }

    const companyInfo = {
      nom: companyData.nom_complet || companyData.nom_raison_sociale || '',
      siren: companyData.siren || '',
      siret: siege.siret || '',
      forme_juridique: companyData.nature_juridique 
        ? getFormeJuridique(companyData.nature_juridique) 
        : '',
      date_creation: companyData.date_creation || '',
      effectif: getTrancheEffectif(companyData.tranche_effectif_salarie),
      capital: extraData.capitalSocial || null,
      adresse: siege.adresse || siege.libelle_voie 
        ? `${siege.numero_voie || ''} ${siege.type_voie || ''} ${siege.libelle_voie || ''}`.trim()
        : '',
      code_postal: siege.code_postal || '',
      ville: siege.libelle_commune || siege.commune || '',
      code_naf: companyData.activite_principale || siege.activite_principale || '',
      libelle_naf: companyData.libelle_activite_principale || '',
      dirigeants: dirigeants.map(d => ({
        nom: `${d.prenom || ''} ${d.nom || ''}`.trim() || d.denomination || '',
        qualite: d.qualite || d.fonction || '',
        date_naissance: d.date_de_naissance || ''
      })),
      finances: finances.slice(0, 3),
      statut_rcs: companyData.etat_administratif === 'A' ? 'Actif' : 'Fermé',
      derniere_mise_a_jour: companyData.date_mise_a_jour || '',
      // Extra info from API gouv.fr
      categorie_entreprise: companyData.categorie_entreprise || '',
      etat_administratif: companyData.etat_administratif === 'A' ? 'Active' : 'Cessée',
      nombre_etablissements: companyData.nombre_etablissements || 0,
      nombre_etablissements_ouverts: companyData.nombre_etablissements_ouverts || 0,
      est_ess: companyData.est_ess || false,
      section_activite_principale: companyData.section_activite_principale || ''
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
Tu analyses les données d'une entreprise française pour évaluer :
1. Sa santé financière globale (score /100) — estime à partir de la taille, du secteur, de l'ancienneté et des données disponibles
2. Sa capacité à investir dans des prestations IT / freelances
3. Le budget IT estimé qu'elle pourrait allouer (basé sur le secteur et la taille)
4. Les risques identifiés
5. La recommandation commerciale (approcher / attendre / éviter)

Note : les données financières détaillées (CA, résultat) ne sont pas toujours disponibles. 
Dans ce cas, fais une estimation basée sur :
- La catégorie d'entreprise (PME, ETI, GE)
- Le secteur d'activité (code NAF)
- Le nombre d'établissements
- L'ancienneté de l'entreprise
- La tranche d'effectif

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

// Helper: Convert nature juridique code to label
function getFormeJuridique(code) {
  const formes = {
    '1000': 'Entrepreneur individuel',
    '5410': 'SARL',
    '5499': 'SARL unipersonnelle',
    '5505': 'SA à conseil d\'administration',
    '5510': 'SA à directoire',
    '5599': 'SA NCA',
    '5610': 'SAS',
    '5710': 'SAS unipersonnelle (SASU)',
    '5720': 'SASU',
    '6100': 'Caisse d\'épargne',
    '6210': 'GEIE',
    '6220': 'GIE',
    '6316': 'CUMA',
    '6317': 'Société coopérative agricole',
    '6411': 'Société d\'assurance mutuelle',
    '6521': 'SCOP',
    '6532': 'SCIC',
    '6533': 'Coopérative',
    '6540': 'Société de courtage d\'assurances',
    '6599': 'Société civile',
    '6901': 'Autre personne morale de droit privé',
    '7111': 'Autorité constitutionnelle',
    '7112': 'Autorité administrative ou publique indépendante',
    '7120': 'Service central d\'un ministère',
    '7150': 'Service déconcentré à compétence nationale',
    '7160': 'Service déconcentré de l\'État',
    '7210': 'Commune et commune nouvelle',
    '7220': 'Département',
    '7225': 'Collectivité et territoire d\'Outre Mer',
    '7229': 'Région',
    '7230': 'Commune associée et commune déléguée',
    '7312': 'Communauté de communes',
    '7313': 'Communauté d\'agglomération',
    '7314': 'Métropole',
    '7321': 'Syndicat intercommunal',
    '7331': 'Établissement public local d\'enseignement',
    '7340': 'Établissement public local social et médico-social',
    '7341': 'Centre communal d\'action sociale',
    '7344': 'Établissement public local culturel',
    '7345': 'Régies',
    '7346': 'SDIS',
    '7348': 'Établissement public local économique',
    '7351': 'EPT',
    '7361': 'Établissement public national à caractère scientifique culturel et professionnel',
    '7362': 'Établissement public national à caractère administratif',
    '7363': 'Établissement public national à caractère industriel et commercial',
    '7364': 'EPA local',
    '7365': 'Chambre de commerce et d\'industrie',
    '7366': 'Chambre de métiers',
    '7381': 'Organisme consulaire',
    '8110': 'Régime général de sécurité sociale',
    '8120': 'Régime spécial de sécurité sociale',
    '8130': 'Institution de retraite complémentaire',
    '8140': 'Mutualité sociale agricole',
    '8150': 'Régime d\'assurance chômage',
    '8160': 'AGIRC-ARRCO',
    '8170': 'Caisse d\'assurance retraite',
    '8210': 'Mutuelle',
    '8250': 'Assurance mutuelle agricole',
    '8290': 'Prévoyance',
    '8310': 'Comité social et économique',
    '8311': 'Comité central d\'entreprise',
    '8410': 'Syndicat de salariés',
    '8420': 'Syndicat patronal',
    '8450': 'Ordre professionnel',
    '8470': 'Centre technique industriel',
    '8510': 'Syndicat de copropriétaires',
    '8520': 'Association syndicale libre',
    '9110': 'Association non déclarée',
    '9150': 'Association déclarée',
    '9210': 'Association d\'utilité publique',
    '9220': 'Congrégation',
    '9221': 'Association de droit local (Alsace-Moselle)',
    '9222': 'Association déclarée d\'insertion par l\'activité économique',
    '9223': 'Association intermédiaire',
    '9224': 'Association d\'insertion',
    '9230': 'Association déclarée, reconnue d\'utilité publique',
    '9240': 'Congrégation',
    '9260': 'Association de droit local',
    '9300': 'Fondation',
    '9900': 'Autre personne morale de droit privé'
  }
  return formes[String(code)] || `Code ${code}`
}

// Helper: Convert tranche effectif code to readable label
function getTrancheEffectif(code) {
  const tranches = {
    '00': '0 salarié',
    '01': '1 ou 2 salariés',
    '02': '3 à 5 salariés',
    '03': '6 à 9 salariés',
    '11': '10 à 19 salariés',
    '12': '20 à 49 salariés',
    '21': '50 à 99 salariés',
    '22': '100 à 199 salariés',
    '31': '200 à 249 salariés',
    '32': '250 à 499 salariés',
    '33': '500 à 999 salariés',
    '41': '1 000 à 1 999 salariés',
    '42': '2 000 à 4 999 salariés',
    '51': '5 000 à 9 999 salariés',
    '52': '10 000 salariés et plus'
  }
  return tranches[String(code)] || code || 'Non renseigné'
}
