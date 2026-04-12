// API Vercel : /api/audit-company.js
// Récupère les données d'une entreprise via API gouv.fr (GRATUIT) + news + analyse IA

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

    // ─── Step 1: Search company via API gouv.fr (100% gratuit) ───
    let companyData = null
    if (siren) {
      const cleanSiren = siren.replace(/\s/g, '').slice(0, 9)
      const resp = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiren}&per_page=1`)
      if (resp.ok) {
        const data = await resp.json()
        if (data.results && data.results.length > 0) companyData = data.results[0]
      }
    } else {
      const resp = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=1`)
      if (resp.ok) {
        const data = await resp.json()
        if (data.results && data.results.length > 0) companyData = data.results[0]
      }
    }

    if (!companyData) {
      return res.status(404).json({ error: 'Entreprise non trouvée' })
    }

    const siege = companyData.siege || {}
    const dirigeants = (companyData.dirigeants || []).slice(0, 5)
    const finances = []
    if (companyData.finances && Object.keys(companyData.finances).length > 0) {
      Object.entries(companyData.finances).forEach(([annee, data]) => {
        finances.push({ annee, chiffre_affaires: data.ca || null, resultat: data.resultat_net || null, effectif: null })
      })
    }

    const companyName = companyData.nom_complet || companyData.nom_raison_sociale || ''

    const companyInfo = {
      nom: companyName,
      siren: companyData.siren || '',
      siret: siege.siret || '',
      forme_juridique: companyData.nature_juridique ? getFormeJuridique(companyData.nature_juridique) : '',
      date_creation: companyData.date_creation || '',
      effectif: getTrancheEffectif(companyData.tranche_effectif_salarie),
      capital: null,
      adresse: siege.adresse || (siege.libelle_voie ? `${siege.numero_voie || ''} ${siege.type_voie || ''} ${siege.libelle_voie || ''}`.trim() : ''),
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
      categorie_entreprise: companyData.categorie_entreprise || '',
      etat_administratif: companyData.etat_administratif === 'A' ? 'Active' : 'Cessée',
      nombre_etablissements: companyData.nombre_etablissements || 0,
      nombre_etablissements_ouverts: companyData.nombre_etablissements_ouverts || 0,
      section_activite_principale: companyData.section_activite_principale || ''
    }

    // ─── Step 2: Fetch NEWS about the company ───
    let news = []
    try {
      const newsResults = await fetchCompanyNews(companyName)
      news = newsResults
    } catch (newsErr) {
      console.error('News fetch error:', newsErr)
    }

    // ─── Step 3: AI Analysis ───
    let aiAnalysis = null
    if (ANTHROPIC_KEY) {
      try {
        const newsContext = news.length > 0
          ? `\n\nActualités récentes sur cette entreprise :\n${news.slice(0, 5).map(n => `- ${n.title} (${n.source}, ${n.date})`).join('\n')}`
          : '\n\nAucune actualité récente trouvée.'

        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1200,
            system: `Tu es un analyste financier expert pour une ESN (Joker Team). 
Tu analyses les données d'une entreprise française pour évaluer :
1. Sa santé financière globale (score /100)
2. Sa capacité à investir dans des prestations IT / freelances
3. Le budget IT estimé qu'elle pourrait allouer
4. Les risques identifiés
5. La recommandation commerciale (approcher / attendre / éviter)
6. Un résumé des actualités récentes si disponibles

Estime à partir de la taille, du secteur, de l'ancienneté, des actualités et des données disponibles.

Réponds UNIQUEMENT en JSON sans markdown :
{
  "score_sante": 75,
  "niveau": "Bonne santé" ou "Santé moyenne" ou "Fragile" ou "Critique",
  "capacite_budget_it": "Estimation du budget IT annuel possible",
  "analyse": "Analyse en 3-4 phrases incluant les actualités récentes",
  "risques": ["Risque 1", "Risque 2"],
  "opportunites": ["Opportunité 1", "Opportunité 2"],
  "recommandation": "approcher" ou "attendre" ou "eviter",
  "recommandation_detail": "Explication en 2 phrases",
  "tjm_max_estime": 600,
  "resume_actualites": "Résumé en 2-3 phrases des actualités récentes de l'entreprise"
}`,
            messages: [{ role: 'user', content: `Analyse cette entreprise :\n${JSON.stringify(companyInfo, null, 2)}${newsContext}` }]
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
      analysis: aiAnalysis,
      news: news
    })

  } catch (error) {
    console.error('Audit error:', error)
    res.status(500).json({ error: error.message })
  }
}

// ─── Fetch news from Google News RSS + French IT sources ───
async function fetchCompanyNews(companyName) {
  const allNews = []
  const searchName = encodeURIComponent(companyName)

  // Source 1: Google News RSS
  try {
    const googleUrl = `https://news.google.com/rss/search?q=${searchName}&hl=fr&gl=FR&ceid=FR:fr`
    const resp = await fetch(googleUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (resp.ok) {
      const xml = await resp.text()
      const items = parseRSSItems(xml)
      items.slice(0, 8).forEach(item => {
        allNews.push({
          title: item.title,
          url: item.link,
          source: item.source || 'Google News',
          date: item.pubDate ? formatDate(item.pubDate) : '',
          description: item.description ? cleanHTML(item.description).slice(0, 200) : ''
        })
      })
    }
  } catch (e) { console.error('Google News error:', e) }

  // Source 2: French IT sources via Google News
  const itSources = [
    'site:lemondeinformatique.fr',
    'site:silicon.fr',
    'site:lemagit.fr',
    'site:alliancy.fr',
    'site:zdnet.fr'
  ]

  for (const siteFilter of itSources.slice(0, 3)) {
    try {
      const itUrl = `https://news.google.com/rss/search?q=${searchName}+${encodeURIComponent(siteFilter)}&hl=fr&gl=FR&ceid=FR:fr`
      const resp = await fetch(itUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (resp.ok) {
        const xml = await resp.text()
        const items = parseRSSItems(xml)
        items.slice(0, 3).forEach(item => {
          // Avoid duplicates
          if (!allNews.find(n => n.title === item.title)) {
            allNews.push({
              title: item.title,
              url: item.link,
              source: extractSourceFromSiteFilter(siteFilter),
              date: item.pubDate ? formatDate(item.pubDate) : '',
              description: item.description ? cleanHTML(item.description).slice(0, 200) : '',
              is_it_source: true
            })
          }
        })
      }
    } catch (e) { /* continue */ }
  }

  // Sort by date (most recent first) and limit
  return allNews.slice(0, 15)
}

// ─── Parse RSS XML ───
function parseRSSItems(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    items.push({
      title: extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link'),
      description: extractTag(itemXml, 'description'),
      pubDate: extractTag(itemXml, 'pubDate'),
      source: extractTag(itemXml, 'source')
    })
  }
  return items
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return match ? (match[1] || match[2] || '').trim() : ''
}

function cleanHTML(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

function extractSourceFromSiteFilter(filter) {
  const map = {
    'site:lemondeinformatique.fr': 'Le Monde Informatique',
    'site:silicon.fr': 'Silicon.fr',
    'site:lemagit.fr': 'LeMagIT',
    'site:alliancy.fr': 'Alliancy',
    'site:zdnet.fr': 'ZDNet France'
  }
  return map[filter] || 'Source IT'
}

// ─── Helper functions ───
function getFormeJuridique(code) {
  const formes = {
    '1000': 'Entrepreneur individuel', '5410': 'SARL', '5499': 'SARL unipersonnelle',
    '5505': 'SA à conseil d\'administration', '5510': 'SA à directoire', '5599': 'SA NCA',
    '5610': 'SAS', '5710': 'SAS unipersonnelle (SASU)', '5720': 'SASU',
    '6599': 'Société civile', '9110': 'Association non déclarée', '9150': 'Association déclarée',
    '9210': 'Association d\'utilité publique', '9220': 'Congrégation', '9300': 'Fondation'
  }
  return formes[String(code)] || `Forme juridique ${code}`
}

function getTrancheEffectif(code) {
  const tranches = {
    '00': '0 salarié', '01': '1-2 salariés', '02': '3-5 salariés', '03': '6-9 salariés',
    '11': '10-19 salariés', '12': '20-49 salariés', '21': '50-99 salariés',
    '22': '100-199 salariés', '31': '200-249 salariés', '32': '250-499 salariés',
    '33': '500-999 salariés', '41': '1 000-1 999 salariés', '42': '2 000-4 999 salariés',
    '51': '5 000-9 999 salariés', '52': '10 000+ salariés'
  }
  return tranches[String(code)] || code || 'Non renseigné'
}
