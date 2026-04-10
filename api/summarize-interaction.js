// API Vercel : /api/summarize-interaction.js
// Résume automatiquement un email ou texte d'interaction via Claude IA

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { text, context } = req.body
    if (!text) return res.status(400).json({ error: 'Texte requis' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Clé API manquante' })

    const systemPrompt = `Tu es l'assistant IA de Joker Team, une ESN spécialisée freelances IT.
On te donne un email ou un texte d'échange professionnel. Tu dois :

1. Résumer en 2-3 phrases courtes les points clés
2. Identifier le type d'interaction (appel, email, reunion, linkedin, autre)
3. Détecter le sentiment (positif, neutre, négatif)
4. Lister les actions à faire (next steps)
5. Détecter l'urgence (haute, moyenne, basse)

${context ? `Contexte : ${context}` : ''}

Réponds UNIQUEMENT en JSON sans markdown :
{
  "resume": "Résumé en 2-3 phrases",
  "type": "email|appel|reunion|linkedin|autre",
  "sentiment": "positif|neutre|negatif",
  "actions": ["Action 1", "Action 2"],
  "urgence": "haute|moyenne|basse",
  "mots_cles": ["mot1", "mot2"]
}`

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }]
      })
    })

    if (!claudeResp.ok) throw new Error(`Claude API: ${claudeResp.status}`)

    const data = await claudeResp.json()
    let content = data.content?.[0]?.text || '{}'
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    const summary = JSON.parse(content)
    res.status(200).json({ success: true, summary })
  } catch (error) {
    console.error('Summarize error:', error)
    res.status(500).json({ error: error.message })
  }
}
