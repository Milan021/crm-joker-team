// API Vercel : /api/fetch-veille.js
// Recupere les actualites IT depuis 20 sources RSS francaises

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const keywords = (req.query.keywords || 'mainframe,COBOL,DSI,cloud,ESN,IA').split(',').map(k => k.trim().toLowerCase())

    const SOURCES = [
      { name: 'Le Monde Informatique', url: 'https://www.lemondeinformatique.fr/flux-rss/rss.xml' },
      { name: 'InformatiqueNews', url: 'https://www.informatiquenews.fr/feed' },
      { name: 'Silicon.fr', url: 'https://www.silicon.fr/feed' },
      { name: 'LeMagIT', url: 'https://www.lemagit.fr/rss/ContentSyndication.xml' },
      { name: 'Alliancy', url: 'https://www.alliancy.fr/feed' },
      { name: 'Next.ink', url: 'https://next.ink/feed/rss2' },
      { name: 'Clubic', url: 'https://www.clubic.com/feed/news.rss' },
      { name: "Tom's Hardware FR", url: 'https://www.tomshardware.fr/feed/' },
      { name: 'Free-Work IT', url: 'https://www.free-work.com/fr/tech-it/blog/feed' },
      { name: 'ZDNet France', url: 'https://www.zdnet.fr/feeds/rss/actualites.xml' },
      { name: 'Planet Mainframe', url: 'https://planetmainframe.com/feed/' },
      { name: 'IT-Connect', url: 'https://www.it-connect.fr/feed/' },
      { name: 'La Revue du Digital', url: 'https://www.larevuedudigital.com/feed/' },
      { name: 'Techniques Ingenieur', url: 'https://www.techniques-ingenieur.fr/actualite/informatique-numerique/feed/' },
      { name: 'Numerama', url: 'https://www.numerama.com/feed/' },
      { name: 'Journal du Net', url: 'https://www.journaldunet.com/rss/' },
      { name: '01net', url: 'https://www.01net.com/rss/info/flux-rss/flux-toutes-les-actualites/' },
      { name: 'CNIL', url: 'https://www.cnil.fr/fr/rss.xml' },
      { name: "L'Usine Digitale", url: 'https://www.usine-digitale.fr/rss' },
      { name: 'GreenIT', url: 'https://www.greenit.fr/feed/' },
    ]

    const allItems = []
    const fetchPromises = SOURCES.map(async (source) => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const resp = await fetch(source.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'CRM-Joker-Team-Veille/1.0' }
        })
        clearTimeout(timeout)
        if (!resp.ok) return
        const xml = await resp.text()
        const items = parseRSS(xml, source.name)
        allItems.push(...items)
      } catch (e) { /* source indisponible */ }
    })

    await Promise.all(fetchPromises)

    const scored = allItems.map(item => {
      const text = `${item.title} ${item.description}`.toLowerCase()
      let score = 0
      const matchedKeywords = []
      for (const kw of keywords) {
        if (text.includes(kw)) { score += 20; matchedKeywords.push(kw) }
      }
      if (item.published_at) {
        const hoursAgo = (Date.now() - new Date(item.published_at).getTime()) / 3600000
        if (hoursAgo < 6) score += 30
        else if (hoursAgo < 24) score += 20
        else if (hoursAgo < 72) score += 10
      }
      return { ...item, relevance_score: Math.min(score, 100), keywords: matchedKeywords }
    })

    scored.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score
      return new Date(b.published_at || 0) - new Date(a.published_at || 0)
    })

    const seen = new Set()
    const unique = scored.filter(item => {
      const key = item.title?.toLowerCase().slice(0, 50)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    res.status(200).json({
      success: true,
      items: unique.slice(0, 100),
      sources_count: SOURCES.length,
      total_found: allItems.length
    })
  } catch (error) {
    console.error('Fetch veille error:', error)
    res.status(500).json({ error: error.message })
  }
}

function parseRSS(xml, sourceName) {
  const items = []
  try {
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi
    let match
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1] || match[2]
      const title = extractTag(block, 'title')
      if (!title) continue
      const link = extractLink(block)
      const description = cleanHTML(extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content') || '')
      const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated') || extractTag(block, 'dc:date')
      let published_at = null
      if (pubDate) { try { published_at = new Date(pubDate).toISOString() } catch {} }
      let type = 'news'
      const textLower = `${title} ${description}`.toLowerCase()
      if (textLower.includes('emploi') || textLower.includes('recrutement') || textLower.includes('recrute')) type = 'job'
      if (textLower.includes('nomm') || textLower.includes('nomination') || textLower.includes('promu')) type = 'nomination'
      items.push({
        type, title: cleanHTML(title).slice(0, 200), description: description.slice(0, 500),
        url: link, source: sourceName, published_at, keywords: []
      })
    }
  } catch (e) {}
  return items.slice(0, 15)
}

function extractTag(block, tag) {
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i')
  const cdataMatch = block.match(cdataRegex)
  if (cdataMatch) return cdataMatch[1].trim()
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = block.match(regex)
  return match ? match[1].trim() : ''
}

function extractLink(block) {
  const linkTag = block.match(/<link[^>]*>([^<]+)<\/link>/i)
  if (linkTag) return linkTag[1].trim()
  const linkHref = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)
  if (linkHref) return linkHref[1].trim()
  const guid = block.match(/<guid[^>]*>([^<]+)<\/guid>/i)
  if (guid && guid[1].startsWith('http')) return guid[1].trim()
  return ''
}

function cleanHTML(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'").replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/&eacute;/g, 'e').replace(/&egrave;/g, 'e')
    .replace(/&agrave;/g, 'a').replace(/&ecirc;/g, 'e').replace(/&ocirc;/g, 'o')
    .replace(/&ucirc;/g, 'u').replace(/&iuml;/g, 'i').replace(/&ccedil;/g, 'c')
    .replace(/&hellip;/g, '...').replace(/\s+/g, ' ').trim()
}
