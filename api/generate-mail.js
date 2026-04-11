// API Vercel : /api/generate-mail.js
// Génère un mail de prospection personnalisé via Claude IA

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { contact, audit, historique_mails, tone, objective, custom_context } = req.body
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Clé API manquante' })

    const toneDescriptions = {
      professionnel: 'Professionnel mais chaleureux, comme un expert bienveillant.',
      amical: 'Amical et décontracté, tutoiement possible, ton startup.',
      direct: 'Direct et efficace, va droit au but, pas de fioritures.',
      formel: 'Très formel et respectueux, vouvoiement, formules de politesse.'
    }

    const objectiveDescriptions = {
      prospection: 'Premier contact commercial. Objectif : décrocher un rendez-vous pour présenter les services de Joker Team (ESN spécialisée IT : développement, data, cloud, cybersécurité). Mentionne un élément spécifique à l\'entreprise pour montrer que le mail n\'est pas générique.',
      relance: 'Relance après un premier contact ou une proposition restée sans réponse. Sois subtil, apporte de la valeur (actualité du secteur, étude de cas) plutôt que de simplement demander "où en êtes-vous?".',
      proposition: 'Envoi ou suivi d\'une proposition commerciale. Mets en avant les bénéfices concrets et le ROI. Propose une prochaine étape claire.',
      suivi: 'Suivi de relation commerciale existante. Prends des nouvelles, partage une info utile, maintiens le lien sans être intrusif.',
      remerciement: 'Remerciement après un rendez-vous, une collaboration ou un échange. Récapitule les points clés discutés et propose la suite.'
    }

    let contextInfo = ''
    if (audit) {
      contextInfo += `\n\nDONNÉES D'AUDIT DE L'ENTREPRISE :`
      if (audit.score_sante) contextInfo += `\n- Score de santé financière : ${audit.score_sante}/100`
      if (audit.budget_it) contextInfo += `\n- Budget IT estimé : ${audit.budget_it}`
      if (audit.analyse) contextInfo += `\n- Analyse : ${audit.analyse}`
      if (audit.resume_actu) contextInfo += `\n- Actualités récentes : ${audit.resume_actu}`
      if (audit.news && audit.news.length > 0) contextInfo += `\n- Titres d'actualité : ${audit.news.join(' | ')}`
      if (audit.recommandation) contextInfo += `\n- Recommandation commerciale : ${audit.recommandation}`
    }

    if (historique_mails && historique_mails.length > 0) {
      contextInfo += `\n\nHISTORIQUE DES MAILS PRÉCÉDENTS :`
      historique_mails.forEach(m => {
        contextInfo += `\n- ${m.date ? new Date(m.date).toLocaleDateString('fr-FR') : '?'} : "${m.sujet}"`
      })
    }

    if (custom_context) {
      contextInfo += `\n\nCONTEXTE PERSONNALISÉ PAR L'UTILISATEUR : ${custom_context}`
    }

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `Tu es un expert en rédaction de mails commerciaux B2B pour Joker Team, une ESN (Entreprise de Services du Numérique) basée en France.

Tu rédiges des mails personnalisés, percutants et professionnels qui génèrent des réponses.

RÈGLES IMPORTANTES :
- Le mail doit être court (150-250 mots max)
- Commence par un accroche personnalisée (actualité de l'entreprise, actualité du secteur, point commun)
- Ne sois JAMAIS générique — chaque mail doit sembler écrit spécifiquement pour ce destinataire
- Inclus un CTA (call-to-action) clair : proposition de RDV de 15-20min
- Signe "Cordialement" suivi du prénom de l'expéditeur (Milan Calic)
- N'utilise PAS de phrases clichées comme "j'espère que ce mail vous trouve bien"
- Joker Team propose : développement web/mobile, data/IA, cloud, cybersécurité, conseil IT, freelances qualifiés
- INTÈGRE les actualités de l'entreprise si disponibles pour personnaliser le mail

Ton : ${toneDescriptions[tone] || toneDescriptions.professionnel}
Objectif : ${objectiveDescriptions[objective] || objectiveDescriptions.prospection}

Réponds UNIQUEMENT en JSON sans markdown :
{
  "subject": "Objet du mail (court et accrocheur, 8 mots max)",
  "body": "Corps du mail complet"
}`,
        messages: [{
          role: 'user',
          content: `Rédige un mail pour ce contact :
- Nom : ${contact?.nom || 'N/A'}
- Poste : ${contact?.poste || 'N/A'}
- Entreprise : ${contact?.entreprise || 'N/A'}
- Email : ${contact?.email || 'N/A'}
${contextInfo}`
        }]
      })
    })

    if (!claudeResp.ok) {
      const errData = await claudeResp.text()
      console.error('Anthropic error:', errData)
      return res.status(500).json({ error: 'Erreur génération IA' })
    }

    const aiData = await claudeResp.json()
    let content = aiData.content?.[0]?.text || '{}'
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const mailData = JSON.parse(content)

    res.status(200).json(mailData)

  } catch (error) {
    console.error('Generate mail error:', error)
    res.status(500).json({ error: error.message })
  }
}
