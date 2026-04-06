// API Vercel : /api/chat.js
// Chatbot IA Joker Team — interroge la base Supabase + Claude

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { message, history } = req.body
    if (!message) return res.status(400).json({ error: 'Message requis' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Clé API Anthropic manquante' })

    // Connect to Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    
    let dbContext = ''
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      try {
        // Fetch relevant data based on the question
        const [candidats, opportunites, contacts] = await Promise.all([
          supabase.from('candidats').select('name, titre_poste, competences, tjm, status, mots_cles, mission_end_date, mission_client, created_at').limit(50),
          supabase.from('opportunites').select('name, type, status, montant, probabilite, tjm, nb_jours, closing_date, notes, last_contact_date, freelance_name, created_at').limit(50),
          supabase.from('contacts').select('name, company, email, phone, position, is_company, created_at').limit(50)
        ])

        const cands = candidats.data || []
        const opps = opportunites.data || []
        const conts = contacts.data || []

        // Stats
        const caGagne = opps.filter(o => o.status === 'gagne').reduce((s, o) => s + (o.montant || 0), 0)
        const pipeline = opps.filter(o => !['gagne', 'perdu'].includes(o.status)).reduce((s, o) => s + ((o.montant || 0) * (o.probabilite || 0) / 100), 0)
        const dispos = cands.filter(c => c.status === 'disponible')
        const enMission = cands.filter(c => c.status === 'en_mission')
        const actives = opps.filter(o => !['gagne', 'perdu'].includes(o.status))

        // Build context
        dbContext = `
=== DONNÉES CRM JOKER TEAM (temps réel) ===

📊 STATISTIQUES GLOBALES:
- CA Gagné: ${caGagne.toLocaleString('fr-FR')} €
- Pipeline pondéré: ${Math.round(pipeline).toLocaleString('fr-FR')} €
- Contacts: ${conts.length}
- Opportunités actives: ${actives.length} / ${opps.length} total
- Candidats: ${cands.length} (${dispos.length} disponibles, ${enMission.length} en mission)

👔 CANDIDATS/FREELANCES:
${cands.map(c => `- ${c.name} | ${c.titre_poste || '?'} | TJM: ${c.tjm || '?'}€ | ${c.status} | Compétences: ${c.competences || c.mots_cles?.join(', ') || '?'}${c.mission_client ? ` | Mission: ${c.mission_client}` : ''}${c.mission_end_date ? ` | Fin: ${c.mission_end_date}` : ''}`).join('\n')}

💼 OPPORTUNITÉS/MISSIONS:
${opps.map(o => `- ${o.name} | ${o.type} | ${o.status} | ${(o.montant || 0).toLocaleString('fr-FR')}€ | Proba: ${o.probabilite || 0}% | TJM: ${o.tjm || '?'}€${o.freelance_name ? ` | Freelance: ${o.freelance_name}` : ''}${o.last_contact_date ? ` | Dernier contact: ${o.last_contact_date}` : ''}${o.notes ? ` | Notes: ${o.notes.slice(0, 100)}` : ''}`).join('\n')}

👥 CONTACTS/CLIENTS:
${conts.map(c => `- ${c.name}${c.company ? ` (${c.company})` : ''} | ${c.position || ''} | ${c.email || ''} | ${c.phone || ''}`).join('\n')}
`
      } catch (dbErr) {
        console.error('DB query error:', dbErr)
        dbContext = '\n(Erreur lors de la récupération des données CRM)\n'
      }
    }

    // Build messages for Claude
    const systemPrompt = `Tu es l'assistant IA de Joker Team, une agence/ESN spécialisée dans le placement de freelances IT, notamment sur le marché Mainframe/COBOL/DB2 et les technologies modernes.

TON RÔLE:
- Répondre aux questions sur les données du CRM (candidats, opportunités, contacts)
- Aider Milan (le fondateur) à prendre des décisions commerciales
- Suggérer des matchings freelances ↔ missions
- Identifier les relances à faire, les deals à risque
- Donner des insights sur l'activité

RÈGLES:
- Réponds toujours en français
- Sois concis et actionnable (pas de blabla)
- Utilise les données CRM ci-dessous pour répondre avec précision
- Si tu ne trouves pas l'info dans les données, dis-le clairement
- Formate tes réponses avec des emojis pour la lisibilité
- Pour les montants, utilise le format français (1 234 €)
- Tu es un expert du marché IT français, des ESN et du freelancing

${dbContext}`

    const messages = []
    
    // Add conversation history (last 6 messages)
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        messages.push({ role: h.role, content: h.content })
      })
    }
    
    messages.push({ role: 'user', content: message })

    // Call Claude API
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
        system: systemPrompt,
        messages
      })
    })

    if (!claudeResp.ok) {
      const errText = await claudeResp.text()
      console.error('Claude API error:', errText)
      throw new Error(`Claude API error: ${claudeResp.status}`)
    }

    const claudeData = await claudeResp.json()
    const reply = claudeData.content?.[0]?.text || 'Désolé, je n\'ai pas pu générer de réponse.'

    res.status(200).json({ success: true, reply })

  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: error.message })
  }
}
