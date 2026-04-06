// API Vercel : /api/fetch-veille.js
// 10 sources d'actualités IT françaises

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const keywords = req.query.keywords
      ? req.query.keywords.split(',').map(k => k.trim())
      : ['mainframe', 'COBOL', 'ESN', 'DSI', 'cloud', 'cybersécurité', 'freelance']

    const SOURCES = [
      { name: 'Le Monde Informatique', icon: '🌐', color: '#2563eb', rss: 'https://www.lemondeinformatique.fr/flux-rss/thematique/toutes-les-actualites/rss.xml' },
      { name: 'InformatiqueNews', icon: '💻', color: '#60a5fa', rss: 'https://www.informatiquenews.fr/feed' },
      { name: 'Silicon.fr', icon: '🔬', color: '#ec4899', rss: 'https://www.silicon.fr/feed' },
      { name: 'LeMagIT', icon: '📰', color: '#f59e0b', rss: 'https://www.lemagit.fr/rss/ContentSyndication.xml' },
      { name: 'Alliancy', icon: '🏢', color: '#34d399', rss: 'https://www.alliancy.fr/feed' },
      { name: 'Next.ink', icon: '⚡', color: '#8b5cf6', rss: 'https://next.ink/feed/' },
      { name: 'Clubic', icon: '🖥️', color: '#ef4444', rss: 'https://www.clubic.com/feed/news.rss' },
      { name: "Tom's Hardware FR", icon: '🔧', color: '#f97316', rss: 'https://www.tomshardware.fr/feed/' },
      { name: 'Free-Work IT', icon: '👨‍💻', color: '#06b6d4', rss: 'https://www.free-work.com/fr/tech-it/blog/feed' },
      { name: 'ZDNet France', icon: '📱', color: '#dc2626', rss: 'https://www.zdnet.fr/feeds/rss/actualites/' }
    ]

    const allItems = []

    // Fetch each RSS source
    for (const source of SOURCES) {
      try {
        const resp = await fetch(source.rss, {
          headers: { 'User-Agent': 'Mozilla/5.0 CRM-JokerTeam/2.0' },
          signal: AbortSignal.timeout(8000)
        })
        if (!resp.ok) continue

        const xml = await resp.text()
        const items = parseRssXml(xml)

        items.slice(0, 10).forEach(item => {
          const title = cleanHtml(item.title)
          const desc = cleanHtml(item.description || '')
          const text = (title + ' ' + desc).toLowerCase()

          // Keyword matching
          const matchedKeywords = keywords.filter(kw => text.includes(kw.toLowerCase()))
          const relevance = matchedKeywords.length > 0
            ? Math.min(95, 50 + matchedKeywords.length * 15)
            : 30

          allItems.push({
            title,
            description: desc.slice(0, 350),
            url: item.link,
            source: source.name,
            source_icon: source.icon,
            source_color: source.color,
            published_at: parseDate(item.pubDate),
            keywords: matchedKeywords.length > 0 ? matchedKeywords : [detectCategory(title, desc)],
            type: detectType(title, desc),
            relevance_score: relevance
          })
        })
      } catch (e) {
        console.log(`RSS failed for ${source.name}:`, e.message)
      }
    }

    // Google News as fallback for keyword-specific results
    for (const keyword of keywords.slice(0, 3)) {
      try {
        const q = encodeURIComponent(`${keyword} informatique France`)
        const resp = await fetch(`https://news.google.com/rss/search?q=${q}&hl=fr&gl=FR&ceid=FR:fr`, {
          headers: { 'User-Agent': 'Mozilla/5.0 CRM-JokerTeam/2.0' },
          signal: AbortSignal.timeout(8000)
        })
        if (!resp.ok) continue
        const xml = await resp.text()
        const items = parseRssXml(xml)
        items.slice(0, 3).forEach(item => {
          allItems.push({
            title: cleanHtml(item.title),
            description: cleanHtml(item.description || '').slice(0, 350),
            url: item.link,
            source: item.source || 'Google News',
            source_icon: '🌐',
            source_color: '#94a3b8',
            published_at: parseDate(item.pubDate),
            keywords: [keyword],
            type: 'news',
            relevance_score: 60
          })
        })
      } catch (e) {}
    }

    // Deduplicate
    const seen = new Set()
    const unique = allItems.filter(item => {
      const key = item.title.toLowerCase().slice(0, 50)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Sort: relevance then date
    unique.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score
      return new Date(b.published_at) - new Date(a.published_at)
    })

    res.status(200).json({
      success: true,
      count: unique.length,
      sources_count: SOURCES.length,
      fetched_at: new Date().toISOString(),
      items: unique.slice(0, 50)
    })
  } catch (error) {
    console.error('Veille error:', error)
    res.status(500).json({ error: error.message })
  }
}

function parseRssXml(xml) {
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const b = m[1]
    items.push({
      title: extractTag(b, 'title'),
      link: extractTag(b, 'link'),
      description: extractTag(b, 'description'),
      pubDate: extractTag(b, 'pubDate'),
      source: extractTag(b, 'source') || extractTag(b, 'dc:creator')
    })
  }
  return items
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 'is')
  const m = re.exec(xml)
  return m ? m[1].trim() : ''
}

function cleanHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseDate(d) {
  try { return new Date(d).toISOString() } catch { return new Date().toISOString() }
}

function detectType(t, d) {
  const x = (t + ' ' + d).toLowerCase()
  if (x.match(/recrut|emploi|poste |cdi |freelance|offre d/)) return 'job'
  if (x.match(/nomm|rejoint|promu|nomination/)) return 'nomination'
  return 'news'
}

function detectCategory(t, d) {
  const x = (t + ' ' + d).toLowerCase()
  if (x.match(/\bia\b|intelligence artificielle|machine learning|llm|chatgpt|gemini|copilot/)) return 'IA'
  if (x.match(/cloud|aws|azure|saas/)) return 'Cloud'
  if (x.match(/cyber|sécurité|ransomware|phishing/)) return 'Cybersécurité'
  if (x.match(/mainframe|cobol|legacy/)) return 'Mainframe'
  if (x.match(/data|donnée/)) return 'Data'
  if (x.match(/dsi|transformation|digital/)) return 'DSI'
  return 'IT'
}
