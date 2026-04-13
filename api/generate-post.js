// API Vercel : /api/generate-post.js
// Génère des posts LinkedIn et articles de blog avec Claude IA

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { platform, source_type, article_title, article_description, article_url, free_topic, tone, angle, hashtags_count } = req.body

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Cle API manquante' })

    const toneInstructions = {
      expert: 'Ton expert et autoritaire. Tu partages ton expertise du marche IT avec assurance. Utilise des donnees chiffrees quand possible.',
      inspirant: 'Ton inspirant et motivant. Tu racontes une histoire, partages une lecon apprise. Style storytelling.',
      provocateur: 'Ton provocateur mais professionnel. Tu poses des questions qui derangent, tu challenges les idees recues du marche IT.',
      informatif: 'Ton informatif et pedagogique. Tu expliques clairement un sujet technique pour le rendre accessible a tous.',
      personnel: "Ton personnel et authentique. Tu partages ton vecu en tant que dirigeant d'ESN/agence freelance. Style conversation."
    }

    const platformInstructions = {
      linkedin: `GENERE UN POST LINKEDIN.
Regles :
- Commence par un hook accrocheur (1-2 lignes qui donnent envie de cliquer "voir plus")
- Utilise des sauts de ligne courts pour aerer
- Maximum 1300 caracteres (ideal LinkedIn)
- Termine par un call-to-action (question ouverte pour generer des commentaires)
- Ajoute ${hashtags_count || 5} hashtags pertinents a la fin
- Utilise des emojis avec parcimonie (2-4 max)
- PAS de lien dans le post (LinkedIn penalise les liens) sauf si l'utilisateur le demande
- Style personnel : "je", pas "nous"`,

      blog: `GENERE UN ARTICLE DE BLOG.
Regles :
- Titre accrocheur et SEO-friendly
- Introduction qui pose le probleme (2-3 phrases)
- 3-5 sous-sections avec sous-titres H2
- 400-600 mots total
- Conclusion avec call-to-action
- Ton professionnel mais accessible
- Optimise pour le SEO avec des mots-cles naturels
- Ajoute une meta-description de 155 caracteres max a la fin`
    }

    let sourceContext = ''
    if (source_type === 'article' && article_title) {
      sourceContext = `
SOURCE : Article de veille IT
Titre : ${article_title}
Description : ${article_description || 'Non disponible'}
URL : ${article_url || 'Non disponible'}

Utilise cet article comme point de depart pour creer du contenu original. NE PAS copier l'article, mais t'en inspirer pour partager ton point de vue d'expert ESN/freelance.`
    } else if (source_type === 'free' && free_topic) {
      sourceContext = `
SUJET LIBRE : ${free_topic}

Cree du contenu original sur ce sujet en lien avec le marche IT, les ESN, le freelancing ou la transformation digitale.`
    }

    const angleInstruction = angle ? `\nANGLE SPECIFIQUE : ${angle}` : ''

    const systemPrompt = `Tu es le ghostwriter de Milan Calic, fondateur de Joker Team, une agence IT specialisee dans le placement de freelances IT (Mainframe/COBOL/DB2 et technologies modernes).

PROFIL DE MILAN :
- Dirigeant d'ESN/agence basee en France
- Expert du marche Mainframe/Legacy ET modernisation
- Travaille avec des freelances IT (pas des salaries)
- Passionne par l'innovation, l'IA, la transformation digitale
- Ton : professionnel mais humain, expert mais accessible
- Marque : Joker Team - "La carte pour reussir"

${toneInstructions[tone] || toneInstructions.expert}

${platformInstructions[platform] || platformInstructions.linkedin}

${sourceContext}
${angleInstruction}

IMPORTANT : Le contenu doit sembler ecrit par Milan lui-meme, pas par une IA. Sois naturel, apporte de la valeur, et positionne Joker Team comme un acteur innovant du marche IT. Ecris en francais avec les accents corrects.`

    // Retry logic for overloaded API (529 errors)
    let claudeResp = null
    let lastError = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
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
            messages: [{ role: 'user', content: `Genere le contenu ${platform === 'blog' ? '(article de blog)' : '(post LinkedIn)'} maintenant.` }]
          })
        })
        if (claudeResp.ok) break
        if (claudeResp.status !== 529) {
          const err = await claudeResp.text()
          throw new Error(`Claude API: ${claudeResp.status} - ${err}`)
        }
        lastError = `Claude API surchargee (tentative ${attempt + 1}/3)`
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000))
      } catch (e) {
        if (e.message.includes('Claude API:') && !e.message.includes('529')) throw e
        lastError = e.message
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000))
      }
    }

    if (!claudeResp || !claudeResp.ok) {
      throw new Error(lastError || 'Claude API indisponible apres 3 tentatives')
    }

    const data = await claudeResp.json()
    const content = data.content?.[0]?.text || 'Erreur de generation'

    res.status(200).json({ success: true, content, platform })

  } catch (error) {
    console.error('Generate post error:', error)
    res.status(500).json({ error: error.message })
  }
}
