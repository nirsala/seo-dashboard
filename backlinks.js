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

// ── Blogger (Google) ─────────────────────────
// OAuth token: console.cloud.google.com → Blogger API v3
// blogId: Blogger dashboard → Settings → Basic
async function postToBlogger(title, bodyHtml, labels) {
  const token  = process.env.BLOGGER_TOKEN || '';
  const blogId = process.env.BLOGGER_BLOG_ID || '';
  if (!token || !blogId) return { skipped: true, platform: 'Blogger', reason: 'אין BLOGGER_TOKEN / BLOGGER_BLOG_ID' };

  try {
    const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'blogger#post', title, content: bodyHtml, labels: labels.slice(0, 5) })
    });
    const data = await res.json();
    if (data.url) return { ok: true, platform: 'Blogger', url: data.url };
    return { ok: false, platform: 'Blogger', error: JSON.stringify(data.error || data) };
  } catch(e) { return { ok: false, platform: 'Blogger', error: e.message }; }
}

// ── WordPress.com ─────────────────────────────
// Token: developer.wordpress.com/applications → OAuth token
// siteId: yoursite.wordpress.com
async function postToWordPress(title, bodyHtml, tags) {
  const token  = process.env.WORDPRESS_TOKEN || '';
  const siteId = process.env.WORDPRESS_SITE_ID || '';
  if (!token || !siteId) return { skipped: true, platform: 'WordPress.com', reason: 'אין WORDPRESS_TOKEN / WORDPRESS_SITE_ID' };

  try {
    const res = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${siteId}/posts/new`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: bodyHtml, tags: tags.join(','), status: 'publish' })
    });
    const data = await res.json();
    if (data.URL) return { ok: true, platform: 'WordPress.com', url: data.URL };
    return { ok: false, platform: 'WordPress.com', error: JSON.stringify(data.error || data) };
  } catch(e) { return { ok: false, platform: 'WordPress.com', error: e.message }; }
}

// ── Tumblr ────────────────────────────────────
// API key: www.tumblr.com/oauth/apps → Consumer Key + OAuth token
async function postToTumblr(title, bodyHtml, tags) {
  const token  = process.env.TUMBLR_TOKEN || '';
  const blogId = process.env.TUMBLR_BLOG_ID || '';  // yourblog.tumblr.com
  if (!token || !blogId) return { skipped: true, platform: 'Tumblr', reason: 'אין TUMBLR_TOKEN / TUMBLR_BLOG_ID' };

  try {
    const res = await fetch(`https://api.tumblr.com/v2/blog/${blogId}/post`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'text', title, body: bodyHtml, tags })
    });
    const data = await res.json();
    if (data.meta?.status === 201) {
      return { ok: true, platform: 'Tumblr', url: `https://${blogId}/post/${data.response?.id}` };
    }
    return { ok: false, platform: 'Tumblr', error: JSON.stringify(data.meta || data) };
  } catch(e) { return { ok: false, platform: 'Tumblr', error: e.message }; }
}

// ── Reddit ────────────────────────────────────
// reddit.com/prefs/apps → script app → client_id + client_secret + username/password
// Subreddits: r/digitalsignage, r/signage, r/smallbusiness, r/Israel (link post)
async function postToReddit(title, articleUrl) {
  const clientId     = process.env.REDDIT_CLIENT_ID || '';
  const clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
  const username     = process.env.REDDIT_USERNAME || '';
  const password     = process.env.REDDIT_PASSWORD || '';
  if (!clientId || !username) return { skipped: true, platform: 'Reddit', reason: 'אין REDDIT_CLIENT_ID / USERNAME' };

  const subreddits = ['digitalsignage', 'signage', 'smallbusiness'];
  const results = [];

  try {
    // Get access token
    const authRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PixelKeshetSEO/1.0'
      },
      body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    });
    const auth = await authRes.json();
    if (!auth.access_token) return { ok: false, platform: 'Reddit', error: 'auth failed' };

    for (const sub of subreddits) {
      const res = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PixelKeshetSEO/1.0'
        },
        body: `kind=link&sr=${sub}&title=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}&resubmit=false`
      });
      const data = await res.json();
      if (data.json?.data?.url) results.push(data.json.data.url);
    }
    return results.length
      ? { ok: true, platform: 'Reddit', url: results[0], count: results.length }
      : { ok: false, platform: 'Reddit', error: 'no posts created' };
  } catch(e) { return { ok: false, platform: 'Reddit', error: e.message }; }
}

// ── Google Business Profile ────────────────────
// OAuth: console.cloud.google.com → Business Profile API → OAuth 2.0
// accountId + locationId: My Business API
async function postToGoogleBusiness(title, articleUrl) {
  const token      = process.env.GOOGLE_BUSINESS_TOKEN || '';
  const accountId  = process.env.GOOGLE_BUSINESS_ACCOUNT_ID || '';
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID || '';
  if (!token || !accountId || !locationId) return {
    skipped: true, platform: 'Google Business',
    reason: 'אין GOOGLE_BUSINESS_TOKEN / ACCOUNT_ID / LOCATION_ID'
  };

  try {
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languageCode: 'he',
          summary: `${title} — Pixel by Keshet, מומחים למסכי LED ושילוט דיגיטלי בישראל. ✓ פרויקטים בכל הארץ ✓ שירות מהיר ✓ אחריות מלאה`,
          callToAction: { actionType: 'LEARN_MORE', url: articleUrl || SITE_URL },
          topicType: 'STANDARD',
        })
      }
    );
    const data = await res.json();
    if (data.name) return { ok: true, platform: 'Google Business', url: SITE_URL };
    return { ok: false, platform: 'Google Business', error: JSON.stringify(data.error || data) };
  } catch(e) { return { ok: false, platform: 'Google Business', error: e.message }; }
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
  const [medium, devto, hashnode, blogger, wordpress, tumblr] = await Promise.all([
    postToMedium(topic.title, html, tags),
    postToDevTo(topic.title, markdown, tags),
    postToHashnode(topic.title, markdown, tags),
    postToBlogger(topic.title, html, tags),
    postToWordPress(topic.title, html, tags),
    postToTumblr(topic.title, html, tags),
  ]);

  for (const r of [medium, devto, hashnode, blogger, wordpress, tumblr]) {
    if (r.skipped) {
      log('warn', `⚠️ Backlink ${r.platform}: ${r.reason}`);
    } else if (r.ok) {
      log('success', `✅ Backlink ${r.platform}: ${r.url}`);
      results.push(r);
    } else {
      log('error', `❌ Backlink ${r.platform}: ${r.error}`);
    }
  }

  // ── Reddit (קישורים בכמה subreddits) ──
  log('info', `🔗 Backlinks: Reddit...`);
  const redditRes = await postToReddit(topic.title, articleUrl || SITE_URL);
  if (redditRes.skipped) {
    log('warn', `⚠️ Backlink Reddit: ${redditRes.reason}`);
  } else if (redditRes.ok) {
    log('success', `✅ Backlink Reddit: ${redditRes.count} פוסטים`);
    results.push(redditRes);
  } else {
    log('error', `❌ Backlink Reddit: ${redditRes.error}`);
  }

  // ── Google Business Profile ──
  log('info', `🔗 Backlinks: Google Business Profile...`);
  const gbRes = await postToGoogleBusiness(topic.title, articleUrl || SITE_URL);
  if (gbRes.skipped) {
    log('warn', `⚠️ Google Business: ${gbRes.reason}`);
  } else if (gbRes.ok) {
    log('success', `✅ Google Business: פוסט נוצר`);
    results.push(gbRes);
  } else {
    log('error', `❌ Google Business: ${gbRes.error}`);
  }

  return results;
}

module.exports = { buildBacklinks };
