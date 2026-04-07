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
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Clé API manquante' })

    const toneInstructions = {
      expert: 'Ton expert et autoritaire. Tu partages ton expertise du marché IT avec assurance. Utilise des données chiffrées quand possible.',
      inspirant: 'Ton inspirant et motivant. Tu racontes une histoire, partages une leçon apprise. Style storytelling.',
      provocateur: 'Ton provocateur mais professionnel. Tu poses des questions qui dérangent, tu challenges les idées reçues du marché IT.',
      informatif: 'Ton informatif et pédagogique. Tu expliques clairement un sujet technique pour le rendre accessible à tous.',
      personnel: 'Ton personnel et authentique. Tu partages ton vécu en tant que dirigeant d\'ESN/agence freelance. Style conversation.'
    }

    const platformInstructions = {
      linkedin: `GÉNÈRE UN POST LINKEDIN.
Règles :
- Commence par un hook accrocheur (1-2 lignes qui donnent envie de cliquer "voir plus")
- Utilise des sauts de ligne courts pour aérer
- Maximum 1300 caractères (idéal LinkedIn)
- Termine par un call-to-action (question ouverte pour générer des commentaires)
- Ajoute ${hashtags_count || 5} hashtags pertinents à la fin
- Utilise des emojis avec parcimonie (2-4 max)
- PAS de lien dans le post (LinkedIn pénalise les liens) sauf si l'utilisateur le demande
- Style personnel : "je", pas "nous"`,

      blog: `GÉNÈRE UN ARTICLE DE BLOG.
Règles :
- Titre accrocheur et SEO-friendly
- Introduction qui pose le problème (2-3 phrases)
- 3-5 sous-sections avec sous-titres H2
- 400-600 mots total
- Conclusion avec call-to-action
- Ton professionnel mais accessible
- Optimisé pour le SEO avec des mots-clés naturels
- Ajoute une meta-description de 155 caractères max à la fin`
    }

    let sourceContext = ''
    if (source_type === 'article' && article_title) {
      sourceContext = `
SOURCE : Article de veille IT
Titre : ${article_title}
Description : ${article_description || 'Non disponible'}
URL : ${article_url || 'Non disponible'}

Utilise cet article comme point de départ pour créer du contenu original. NE PAS copier l'article, mais t'en inspirer pour partager ton point de vue d'expert ESN/freelance.`
    } else if (source_type === 'free' && free_topic) {
      sourceContext = `
SUJET LIBRE : ${free_topic}

Crée du contenu original sur ce sujet en lien avec le marché IT, les ESN, le freelancing ou la transformation digitale.`
    }

    const angleInstruction = angle ? `\nANGLE SPÉCIFIQUE : ${angle}` : ''

    const systemPrompt = `Tu es le ghostwriter de Milan Calic, fondateur de Joker Team, une agence IT spécialisée dans le placement de freelances IT (Mainframe/COBOL/DB2 et technologies modernes).

PROFIL DE MILAN :
- Dirigeant d'ESN/agence basée en France
- Expert du marché Mainframe/Legacy ET modernisation
- Travaille avec des freelances IT (pas des salariés)
- Passionné par l'innovation, l'IA, la transformation digitale
- Ton : professionnel mais humain, expert mais accessible
- Marque : Joker Team — "La carte pour réussir"

${toneInstructions[tone] || toneInstructions.expert}

${platformInstructions[platform] || platformInstructions.linkedin}

${sourceContext}
${angleInstruction}

IMPORTANT : Le contenu doit sembler écrit par Milan lui-même, pas par une IA. Sois naturel, apporte de la valeur, et positionne Joker Team comme un acteur innovant du marché IT.`

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
        messages: [{ role: 'user', content: `Génère le contenu ${platform === 'blog' ? '(article de blog)' : '(post LinkedIn)'} maintenant.` }]
      })
    })

    if (!claudeResp.ok) {
      const err = await claudeResp.text()
      throw new Error(`Claude API: ${claudeResp.status} - ${err}`)
    }

    const data = await claudeResp.json()
    const content = data.content?.[0]?.text || 'Erreur de génération'

    res.status(200).json({ success: true, content, platform })

  } catch (error) {
    console.error('Generate post error:', error)
    res.status(500).json({ error: error.message })
  }
}
