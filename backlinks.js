// ═══════════════════════════════════════════
//  BACKLINK BUILDER
//  מפרסם תוכן עם קישורים חוזרים לאתר
//  פלטפורמות: Medium, Dev.to, Hashnode
// ═══════════════════════════════════════════
const cfg = require('./config');
const SITE_URL = cfg.site.url || 'https://xvision.co.il';
const SITE_NAME = cfg.site.name || 'Pixel by Keshet';

// ── Medium ───────────────────────────────────
// API token: medium.com/me/settings → Integration tokens
async function postToMedium(title, bodyHtml, tags) {
  const token = process.env.MEDIUM_TOKEN || '';
  if (!token) return { skipped: true, platform: 'Medium', reason: 'אין MEDIUM_TOKEN' };

  try {
    // קבל userId
    const meRes = await fetch('https://api.medium.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!meRes.ok) return { ok: false, platform: 'Medium', error: `auth: ${meRes.status}` };
    const me = await meRes.json();
    const userId = me.data?.id;

    const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        contentFormat: 'html',
        content: bodyHtml,
        tags: tags.slice(0, 5),
        publishStatus: 'public',
        canonicalUrl: SITE_URL,
      })
    });
    const data = await res.json();
    if (data.data?.url) return { ok: true, platform: 'Medium', url: data.data.url };
    return { ok: false, platform: 'Medium', error: JSON.stringify(data.errors || data) };
  } catch(e) {
    return { ok: false, platform: 'Medium', error: e.message };
  }
}

// ── Dev.to ───────────────────────────────────
// API key: dev.to/settings/extensions → DEV Community API Keys
async function postToDevTo(title, bodyMarkdown, tags) {
  const token = process.env.DEVTO_API_KEY || '';
  if (!token) return { skipped: true, platform: 'Dev.to', reason: 'אין DEVTO_API_KEY' };

  try {
    const res = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: { 'api-key': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article: {
          title,
          body_markdown: bodyMarkdown,
          published: true,
          tags: tags.slice(0, 4).map(t => t.replace(/\s+/g, '').slice(0, 20)),
          canonical_url: SITE_URL,
        }
      })
    });
    const data = await res.json();
    if (data.url) return { ok: true, platform: 'Dev.to', url: data.url };
    return { ok: false, platform: 'Dev.to', error: JSON.stringify(data.error || data) };
  } catch(e) {
    return { ok: false, platform: 'Dev.to', error: e.message };
  }
}

// ── Hashnode ─────────────────────────────────
// API token: hashnode.com/settings/developer → Personal Access Token
// publicationId: hashnode.com/@username — מצא בדשבורד
async function postToHashnode(title, contentMarkdown, tags) {
  const token = process.env.HASHNODE_TOKEN || '';
  const pubId  = process.env.HASHNODE_PUBLICATION_ID || '';
  if (!token || !pubId) return { skipped: true, platform: 'Hashnode', reason: 'אין HASHNODE_TOKEN / HASHNODE_PUBLICATION_ID' };

  const query = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post { url title }
      }
    }`;
  const variables = {
    input: {
      title,
      contentMarkdown,
      publicationId: pubId,
      tags: [],
      originalArticleURL: SITE_URL,
    }
  };

  try {
    const res = await fetch('https://gql.hashnode.com', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const data = await res.json();
    const url = data.data?.publishPost?.post?.url;
    if (url) return { ok: true, platform: 'Hashnode', url };
    return { ok: false, platform: 'Hashnode', error: JSON.stringify(data.errors || data) };
  } catch(e) {
    return { ok: false, platform: 'Hashnode', error: e.message };
  }
}

// ── Telegraph (telegra.ph) — ללא רישום ────────
// יוצר דף ציבורי שגוגל מאנדקס, ללא חשבון
async function postToTelegraph(title, bodyHtml, articleUrl) {
  try {
    // שלב 1: צור account אנונימי (token חד-פעמי)
    const accRes = await fetch('https://api.telegra.ph/createAccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ short_name: 'PixelKeshet', author_name: SITE_NAME, author_url: SITE_URL })
    });
    const acc = await accRes.json();
    if (!acc.ok) return { ok: false, platform: 'Telegraph', error: acc.error };
    const accessToken = acc.result.access_token;

    // שלב 2: פרסם דף
    const content = [
      { tag: 'h3', children: [title] },
      { tag: 'p', children: [`מאמר מקצועי מאת `, { tag: 'a', attrs: { href: SITE_URL }, children: [SITE_NAME] }, ` — מומחים למסכי LED ושילוט דיגיטלי בישראל.` ] },
      { tag: 'p', children: [articleUrl ? { tag: 'a', attrs: { href: articleUrl }, children: [`📖 קראו את המאמר המלא`] } : ''] },
      { tag: 'p', children: [`${SITE_NAME} מספקים פתרונות שילוט דיגיטלי לעסקים בכל הארץ — חנויות, מסעדות, מלונות ועוד.`] },
      { tag: 'p', children: [`📞 *9555 | 🌐 `, { tag: 'a', attrs: { href: SITE_URL }, children: [SITE_URL] }] },
    ];

    const pageRes = await fetch('https://api.telegra.ph/createPage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, title, content, return_content: false })
    });
    const page = await pageRes.json();
    if (page.ok) return { ok: true, platform: 'Telegraph', url: `https://telegra.ph${page.result.path}` };
    return { ok: false, platform: 'Telegraph', error: page.error };
  } catch(e) {
    return { ok: false, platform: 'Telegraph', error: e.message };
  }
}

// ── Write.as — ללא רישום ──────────────────────
// פוסטים אנונימיים פומביים עם קישורים
async function postToWriteAs(title, bodyMarkdown) {
  try {
    const res = await fetch('https://write.as/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: `# ${title}\n\n${bodyMarkdown}`, title, lang: 'he', appearance: 'norm' })
    });
    const data = await res.json();
    if (data.data?.id) return { ok: true, platform: 'Write.as', url: `https://write.as/${data.data.id}` };
    return { ok: false, platform: 'Write.as', error: JSON.stringify(data.error || data) };
  } catch(e) {
    return { ok: false, platform: 'Write.as', error: e.message };
  }
}

// ── Ping Services — 15+ שירותי אינדוקס ────────
async function pingOmatic(title, siteUrl) {
  const xmlBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>weblogUpdates.extendedPing</methodName>
  <params>
    <param><value><string>${SITE_NAME}</string></value></param>
    <param><value><string>${siteUrl}</string></value></param>
    <param><value><string>${siteUrl}</string></value></param>
    <param><value><string>${siteUrl}/sitemap.xml</string></value></param>
  </params>
</methodCall>`;

  const endpoints = [
    'https://rpc.pingomatic.com/',
    'https://ping.feedburner.com/',
    'https://ping.blo.gs/',
    'https://rpc.twingly.com/',
    'https://blogsearch.google.com/ping/RPC2',
    'https://ping.syndic8.com/xmlrpc.php',
    'https://www.bloglines.com/ping',
    'https://api.moreover.com/RPC2',
    'https://ping.weblogalot.com/rpc.php',
    'https://rpc.weblogs.com/RPC2',
  ];

  const results = [];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xmlBody,
        signal: AbortSignal.timeout(8000)
      });
      results.push({ ep, status: res.status });
    } catch(e) {
      results.push({ ep, error: e.message });
    }
  }
  const success = results.filter(r => r.status < 400).length;
  return { ok: success > 0, platform: 'Ping services', count: success, total: endpoints.length };
}

// ── בנה תוכן לפרסום ─────────────────────────
function buildBacklinkContent(topic, articleUrl, apiKey) {
  const intro = `${topic.title} — מאמר מקצועי מאת ${SITE_NAME}.`;
  const cta = `לקריאה נוספת ולהצעת מחיר: [${SITE_NAME}](${SITE_URL})`;
  const articleLink = articleUrl ? `קראו את המאמר המלא: [${topic.title}](${articleUrl})` : '';

  const markdown = `## ${topic.title}

מאמר זה נכתב על ידי **${SITE_NAME}** — מומחים למסכי LED ושילוט דיגיטלי בישראל.

**מילת מפתח:** ${topic.keyword}

> ${intro}

${articleLink}

---

${SITE_NAME} מספקים פתרונות שילוט דיגיטלי מקצועיים לעסקים בישראל — חנויות, מסעדות, מלונות, לובי ועוד.

📞 *9555 | 🌐 [${SITE_URL}](${SITE_URL})

*המאמר המלא זמין באתר ${SITE_NAME}*
`;

  const html = `<h2>${topic.title}</h2>
<p>מאמר מקצועי מאת <a href="${SITE_URL}" rel="dofollow"><strong>${SITE_NAME}</strong></a> — מומחים למסכי LED ושילוט דיגיטלי בישראל.</p>
${articleUrl ? `<p>📖 <a href="${articleUrl}">קראו את המאמר המלא ← ${topic.title}</a></p>` : ''}
<p>${SITE_NAME} מספקים פתרונות שילוט דיגיטלי לעסקים — חנויות, מסעדות, מלונות ועוד.</p>
<p>📞 *9555 | 🌐 <a href="${SITE_URL}">${SITE_URL}</a></p>`;

  const tags = ['LED', 'digitalsignage', 'israel', 'business', 'technology'];

  return { markdown, html, tags };
}

// ── ראשי ────────────────────────────────────
async function buildBacklinks(topic, articleUrl, log) {
  const { markdown, html, tags } = buildBacklinkContent(topic, articleUrl);
  const results = [];

  // ── ללא רישום (תמיד פועל) ──
  log('info', `🔗 Backlinks ללא רישום: Telegraph, Write.as, Ping services...`);
  const [telegraph, writeas, ping] = await Promise.all([
    postToTelegraph(topic.title, html, articleUrl),
    postToWriteAs(topic.title, markdown),
    pingOmatic(topic.title, articleUrl || SITE_URL),
  ]);

  for (const r of [telegraph, writeas]) {
    if (r.ok) { log('success', `✅ Backlink ${r.platform}: ${r.url}`); results.push(r); }
    else       { log('warn',    `⚠️ Backlink ${r.platform}: ${r.error}`); }
  }
  if (ping.ok) log('success', `✅ Ping services: ${ping.count}/${ping.total} הצליחו`);
  else         log('warn',    `⚠️ Ping services: לא הגיבו`);

  // ── עם API key (אופציונלי) ──
  const [medium, devto, hashnode] = await Promise.all([
    postToMedium(topic.title, html, tags),
    postToDevTo(topic.title, markdown, tags),
    postToHashnode(topic.title, markdown, tags),
  ]);

  for (const r of [medium, devto, hashnode]) {
    if (r.skipped) {
      log('warn', `⚠️ Backlink ${r.platform}: ${r.reason}`);
    } else if (r.ok) {
      log('success', `✅ Backlink ${r.platform}: ${r.url}`);
      results.push(r);
    } else {
      log('error', `❌ Backlink ${r.platform}: ${r.error}`);
    }
  }

  return results;
}

module.exports = { buildBacklinks };
