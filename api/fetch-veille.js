// API Vercel : /api/fetch-veille.js
// Récupère les actualités IT depuis des flux RSS et sites français

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const keywords = req.query.keywords
      ? req.query.keywords.split(',').map(k => k.trim())
      : ['mainframe', 'COBOL', 'ESN', 'DSI', 'cloud', 'cybersécurité']

    const sources = [
      {
        name: 'InformatiqueNews',
        icon: '💻',
        color: '#60a5fa',
        rssUrl: 'https://www.informatiquenews.fr/feed',
        fallbackSearch: 'site:informatiquenews.fr'
      },
      {
        name: 'Alliancy',
        icon: '🏢',
        color: '#34d399',
        rssUrl: 'https://www.alliancy.fr/feed',
        fallbackSearch: 'site:alliancy.fr'
      },
      {
        name: 'Républik IT',
        icon: '🇫🇷',
        color: '#a78bfa',
        rssUrl: null,
        fallbackSearch: 'site:republikit.com'
      },
      {
        name: 'LeMagIT',
        icon: '📰',
        color: '#f59e0b',
        rssUrl: 'https://www.lemagit.fr/rss/ContentSyndication.xml',
        fallbackSearch: 'site:lemagit.fr'
      },
      {
        name: 'Silicon.fr',
        icon: '🔬',
        color: '#ec4899',
        rssUrl: 'https://www.silicon.fr/feed',
        fallbackSearch: 'site:silicon.fr'
      }
    ]

    const allItems = []

    // Strategy 1: Google News RSS for each keyword + source combo
    for (const keyword of keywords.slice(0, 5)) {
      try {
        const query = encodeURIComponent(`${keyword} informatique DSI France`)
        const googleRssUrl = `https://news.google.com/rss/search?q=${query}&hl=fr&gl=FR&ceid=FR:fr`

        const resp = await fetch(googleRssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 CRM-JokerTeam/1.0' },
          signal: AbortSignal.timeout(8000)
        })

        if (resp.ok) {
          const xml = await resp.text()
          const items = parseRssXml(xml)

          items.slice(0, 5).forEach(item => {
            // Try to match with known sources
            const matchedSource = sources.find(s =>
              item.link?.includes(s.fallbackSearch.replace('site:', '')) ||
              item.source?.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])
            )

            allItems.push({
              title: cleanHtml(item.title),
              description: cleanHtml(item.description || '').slice(0, 300),
              url: item.link,
              source: matchedSource?.name || item.source || 'Google News',
              source_icon: matchedSource?.icon || '📰',
              source_color: matchedSource?.color || '#94a3b8',
              published_at: item.pubDate || new Date().toISOString(),
              keywords: [keyword],
              type: 'news',
              relevance_score: matchedSource ? 90 : 70
            })
          })
        }
      } catch (e) {
        console.log(`Google News fetch failed for ${keyword}:`, e.message)
      }
    }

    // Strategy 2: Direct RSS feeds from known sources
    for (const source of sources) {
      if (!source.rssUrl) continue
      try {
        const resp = await fetch(source.rssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 CRM-JokerTeam/1.0' },
          signal: AbortSignal.timeout(8000)
        })

        if (resp.ok) {
          const xml = await resp.text()
          const items = parseRssXml(xml)

          items.slice(0, 8).forEach(item => {
            const title = cleanHtml(item.title)
            const desc = cleanHtml(item.description || '')

            // Calculate relevance based on keyword matches
            const matchedKeywords = keywords.filter(kw =>
              title.toLowerCase().includes(kw.toLowerCase()) ||
              desc.toLowerCase().includes(kw.toLowerCase())
            )
            const relevance = matchedKeywords.length > 0
              ? Math.min(95, 60 + matchedKeywords.length * 15)
              : 40

            allItems.push({
              title,
              description: desc.slice(0, 300),
              url: item.link,
              source: source.name,
              source_icon: source.icon,
              source_color: source.color,
              published_at: item.pubDate || new Date().toISOString(),
              keywords: matchedKeywords.length > 0 ? matchedKeywords : [detectCategory(title, desc)],
              type: detectType(title, desc),
              relevance_score: relevance
            })
          })
        }
      } catch (e) {
        console.log(`RSS fetch failed for ${source.name}:`, e.message)
      }
    }

    // Deduplicate by title similarity
    const seen = new Set()
    const unique = allItems.filter(item => {
      const key = item.title.toLowerCase().slice(0, 60)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Sort by relevance then date
    unique.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score
      return new Date(b.published_at) - new Date(a.published_at)
    })

    const results = unique.slice(0, 30)

    res.status(200).json({
      success: true,
      count: results.length,
      fetched_at: new Date().toISOString(),
      items: results
    })

  } catch (error) {
    console.error('Veille fetch error:', error)
    res.status(500).json({ error: error.message })
  }
}

// ── Helpers ──

function parseRssXml(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      description: extractTag(block, 'description'),
      pubDate: extractTag(block, 'pubDate'),
      source: extractTag(block, 'source') || extractTag(block, 'dc:creator')
    })
  }

  return items
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 'is')
  const match = regex.exec(xml)
  return match ? match[1].trim() : ''
}

function cleanHtml(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectType(title, desc) {
  const text = (title + ' ' + desc).toLowerCase()
  if (text.includes('recrut') || text.includes('emploi') || text.includes('poste') || text.includes('cdi') || text.includes('freelance'))
    return 'job'
  if (text.includes('nomm') || text.includes('rejoint') || text.includes('promu') || text.includes('nomination'))
    return 'nomination'
  return 'news'
}

function detectCategory(title, desc) {
  const text = (title + ' ' + desc).toLowerCase()
  if (text.includes('ia') || text.includes('intelligence artificielle') || text.includes('machine learning')) return 'IA'
  if (text.includes('cloud') || text.includes('aws') || text.includes('azure')) return 'Cloud'
  if (text.includes('cyber') || text.includes('sécurité') || text.includes('ransomware')) return 'Cybersécurité'
  if (text.includes('dsi') || text.includes('transformation') || text.includes('digital')) return 'DSI'
  if (text.includes('mainframe') || text.includes('cobol') || text.includes('legacy')) return 'Mainframe'
  if (text.includes('data') || text.includes('donnée')) return 'Data'
  return 'IT'
}
