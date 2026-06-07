// api/digest-signaux.js
// Digest quotidien "signaux chauds" — Joker Team CRM
// Déclenchement : Vercel Cron 07h00 chaque matin
// Flux : RSS → Claude IA → Supabase → Gmail

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // clé service pour contourner RLS
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

const DEST_EMAIL = 'milan.calic@joker-team.fr';
const FROM_EMAIL = 'majimico@gmail.com';

// ── 20 flux RSS de la Veille ──────────────────────────────────────────────────
const RSS_SOURCES = [
  'https://www.lemondeinformatique.fr/flux-rss/thematique/infrastructures-reseaux/rss.xml',
  'https://www.silicon.fr/feed',
  'https://www.journaldunet.com/rss/',
  'https://www.zdnet.fr/feeds/rss/',
  'https://www.01net.com/rss/',
  'https://news.google.com/rss/search?q=transformation+digitale+DSI+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=mainframe+COBOL+IBM+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=recrutement+informatique+ESN+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=migration+cloud+banque+assurance+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=projet+SI+DSI+PME+ETI+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=freelance+informatique+2025&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=intelligence+artificielle+entreprise+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=cybersécurité+entreprise+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=ERP+SAP+migration+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://www.infoq.com/fr/feed/',
  'https://www.developpez.com/index/rss',
  'https://news.google.com/rss/search?q=Société+Générale+BNP+Crédit+Agricole+DSI&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=infrastructure+IT+outsourcing+France&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=legacy+modernisation+systèmes+information&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=prestataire+informatique+appel+offre&hl=fr&gl=FR&ceid=FR:fr',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchRSS(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'JokerTeamCRM/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const text = await res.text();

    // Extraction XML basique — items des dernières 24h
    const items = [];
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    const matches = text.match(itemRegex) || [];

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const item of matches.slice(0, 5)) {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
                     item.match(/<title>(.*?)<\/title>/i) || [])[1] || '';
      const desc  = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) ||
                     item.match(/<description>(.*?)<\/description>/i) || [])[1] || '';
      const link  = (item.match(/<link>(.*?)<\/link>/i) || [])[1] || '';
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/i) || [])[1] || '';

      const parsed = pubDate ? new Date(pubDate) : new Date();
      if (parsed < yesterday) continue; // on ne garde que les 24 dernières heures

      const cleanDesc = desc.replace(/<[^>]+>/g, '').trim().slice(0, 300);
      if (title.length > 5) {
        items.push({ title: title.trim(), desc: cleanDesc, link: link.trim(), pubDate: parsed.toISOString() });
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchAllRSS() {
  const results = await Promise.allSettled(RSS_SOURCES.map(fetchRSS));
  const all = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  // Dédoublonnage sur le titre
  const seen = new Set();
  return all.filter(item => {
    const key = item.title.slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scoreWithClaude(articles, contacts) {
  // Prépare le contexte contacts pour le croisement
  const contactsCtx = contacts.map(c =>
    `- ${c.nom || ''} ${c.prenom || ''} | Société: ${c.societe || ''} | Secteur: ${c.secteur || ''}`
  ).join('\n');

  const articlesCtx = articles.map((a, i) =>
    `[${i + 1}] "${a.title}" — ${a.desc}`
  ).join('\n');

  const prompt = `Tu es un assistant commercial pour Joker Team, une ESN française spécialisée dans le placement de freelances IT (Mainframe/COBOL/DB2, Cloud, IA, Cybersécurité).

Voici ${articles.length} articles parus dans les dernières 24h dans la presse IT française :

${articlesCtx}

Voici les contacts et clients actuels du CRM :
${contactsCtx || 'Aucun contact enregistré'}

Ta mission :
1. Identifie les articles qui représentent un SIGNAL CHAUD pour Joker Team (transformation digitale, recrutement IT, migration système, projet mainframe, modernisation legacy, appel d'offres IT, annonce investissement DSI).
2. Pour chaque signal retenu, donne un score /100 (pertinence pour une ESN freelance IT).
3. Si le signal mentionne une entreprise présente dans les contacts CRM, indique le nom du contact lié.
4. Ignore les articles génériques sans lien direct avec une opportunité commerciale.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaire :
{
  "signaux": [
    {
      "score": 87,
      "titre": "...",
      "entreprise": "...",
      "resume": "En 2 phrases max : pourquoi c'est une opportunité pour Joker Team",
      "contact_lie": "Nom Prénom (fonction)" ou null,
      "angle": "Angle d'approche recommandé en 1 phrase",
      "lien": "..."
    }
  ]
}

Retourne entre 3 et 8 signaux maximum, triés par score décroissant. Si aucun signal pertinent, retourne {"signaux": []}.`;

  // Retry avec backoff exponentiel (gestion erreur 529)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.status === 529) {
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
        continue;
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '{"signaux":[]}';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      if (attempt === 2) return { signaux: [] };
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
    }
  }
  return { signaux: [] };
}

// ── Génération HTML du digest ─────────────────────────────────────────────────

function buildEmailHTML(signaux, date) {
  const dateStr = new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const scoreColor = (s) => s >= 80 ? '#D4AF37' : s >= 60 ? '#E8853C' : '#6B9FD4';
  const scoreBg   = (s) => s >= 80 ? '#1a1500' : s >= 60 ? '#1a0e00' : '#001220';

  const cardsHTML = signaux.length === 0
    ? '<p style="color:#8ba5b0;text-align:center;padding:40px 0">Aucun signal chaud détecté aujourd\'hui.</p>'
    : signaux.map(s => `
      <div style="background:#0d2029;border:1px solid rgba(212,175,55,0.15);border-radius:10px;padding:20px 24px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div style="flex:1">
            <div style="font-size:11px;color:#8ba5b0;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${s.entreprise || 'Entreprise inconnue'}</div>
            <div style="font-size:16px;color:#e8f4f8;font-weight:600;line-height:1.4">${s.titre}</div>
          </div>
          <div style="background:${scoreBg(s.score)};border:1px solid ${scoreColor(s.score)};border-radius:6px;padding:4px 10px;margin-left:16px;flex-shrink:0">
            <span style="color:${scoreColor(s.score)};font-weight:700;font-size:18px">${s.score}</span>
            <span style="color:${scoreColor(s.score)};font-size:11px">/100</span>
          </div>
        </div>

        <p style="color:#c2d8e0;font-size:14px;line-height:1.6;margin:0 0 12px">${s.resume}</p>

        ${s.contact_lie ? `
        <div style="background:#0a1f2a;border-left:3px solid #D4AF37;padding:8px 12px;border-radius:0 6px 6px 0;margin-bottom:12px">
          <span style="color:#8ba5b0;font-size:12px">Contact CRM lié : </span>
          <span style="color:#D4AF37;font-size:13px;font-weight:600">${s.contact_lie}</span>
        </div>` : ''}

        <div style="background:#081820;border-radius:6px;padding:10px 14px;margin-bottom:14px">
          <span style="color:#8ba5b0;font-size:12px">Angle d'approche : </span>
          <span style="color:#a8c8d8;font-size:13px;font-style:italic">${s.angle}</span>
        </div>

        <a href="${s.lien}" style="display:inline-block;background:transparent;border:1px solid rgba(212,175,55,0.4);color:#D4AF37;font-size:12px;padding:6px 14px;border-radius:6px;text-decoration:none" target="_blank">Lire l'article →</a>
      </div>
    `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1820;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:28px;font-weight:700;color:#D4AF37;letter-spacing:2px">JOKER TEAM</div>
      <div style="font-size:12px;color:#8ba5b0;margin-top:4px;text-transform:uppercase;letter-spacing:1px">CRM — Digest Signaux Chauds</div>
      <div style="font-size:13px;color:#6b8a9a;margin-top:8px">${dateStr}</div>
      <div style="width:60px;height:2px;background:linear-gradient(90deg,transparent,#D4AF37,transparent);margin:16px auto 0"></div>
    </div>

    <!-- Résumé -->
    <div style="background:#0d2029;border:1px solid rgba(212,175,55,0.2);border-radius:10px;padding:16px 24px;margin-bottom:24px;text-align:center">
      <span style="color:#8ba5b0;font-size:13px">${signaux.length} signal${signaux.length > 1 ? 's' : ''} chaud${signaux.length > 1 ? 's' : ''} détecté${signaux.length > 1 ? 's' : ''} ce matin</span>
      ${signaux.filter(s => s.contact_lie).length > 0 ? `
      <span style="color:#8ba5b0;font-size:13px"> · </span>
      <span style="color:#D4AF37;font-size:13px;font-weight:600">${signaux.filter(s => s.contact_lie).length} contact${signaux.filter(s => s.contact_lie).length > 1 ? 's' : ''} CRM concerné${signaux.filter(s => s.contact_lie).length > 1 ? 's' : ''}</span>
      ` : ''}
    </div>

    <!-- Cartes signaux -->
    ${cardsHTML}

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06)">
      <a href="https://crm.joker-team.fr" style="display:inline-block;background:#D4AF37;color:#0a1820;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">
        Ouvrir le CRM →
      </a>
      <p style="color:#4a6070;font-size:11px;margin-top:16px">
        Joker Team CRM · Digest automatique quotidien · 07h00<br>
        Généré par Claude IA · ${signaux.length} articles analysés
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Envoi Gmail via OAuth2 ────────────────────────────────────────────────────

async function getGmailAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

function buildRawEmail(html, subject) {
  const boundary = 'boundary_' + Date.now();
  const raw = [
    `From: Joker Team CRM <${FROM_EMAIL}>`,
    `To: ${DEST_EMAIL}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendGmail(html, subject) {
  const accessToken = await getGmailAccessToken();
  const raw = buildRawEmail(html, subject);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${err}`);
  }
  return res.json();
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Sécurité : seul Vercel Cron ou une requête avec le bon header peut déclencher
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[digest-signaux] Démarrage —', new Date().toISOString());

    // 1. Lecture de tous les flux RSS
    const articles = await fetchAllRSS();
    console.log(`[digest-signaux] ${articles.length} articles collectés`);

    if (articles.length === 0) {
      return res.status(200).json({ message: 'Aucun article RSS — digest non envoyé' });
    }

    // 2. Récupération des contacts Supabase pour croisement
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: contacts } = await supabase
      .from('contacts')
      .select('nom, prenom, societe, secteur')
      .limit(200);

    // 3. Scoring IA avec Claude (on envoie max 40 articles pour ne pas dépasser le contexte)
    const { signaux } = await scoreWithClaude(articles.slice(0, 40), contacts || []);
    console.log(`[digest-signaux] ${signaux.length} signaux chauds détectés`);

    // 4. Construction et envoi du digest email
    const today = new Date().toISOString();
    const subject = `🔥 ${signaux.length} signal${signaux.length > 1 ? 's' : ''} chaud${signaux.length > 1 ? 's' : ''} — Joker Team CRM ${new Date().toLocaleDateString('fr-FR')}`;
    const html = buildEmailHTML(signaux, today);

    await sendGmail(html, subject);
    console.log(`[digest-signaux] Email envoyé à ${DEST_EMAIL}`);

    return res.status(200).json({
      success: true,
      articles_lus: articles.length,
      signaux_detectes: signaux.length,
      email_envoye_a: DEST_EMAIL,
    });

  } catch (err) {
    console.error('[digest-signaux] Erreur :', err);
    return res.status(500).json({ error: err.message });
  }
}
