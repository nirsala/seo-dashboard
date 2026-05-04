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
// הגדרה חד-פעמית (ראה הוראות ב-README):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — מ-Google Cloud Console
//   GOOGLE_REFRESH_TOKEN                   — אחרי OAuth flow ראשוני
//   GOOGLE_BUSINESS_ACCOUNT_ID             — GET /accounts → accounts[0].name
//   GOOGLE_BUSINESS_LOCATION_ID            — GET /accounts/{id}/locations → locations[0].name

// תמונות פרויקטים מהאתר — מסתובבות יומית
const GBP_IMAGES = [
  'assets/images/works-s01.jpg',
  'assets/images/works-s02.jpg',
  'assets/images/works-s03.jpg',
  'assets/images/works-s06.webp',
  'assets/images/works-s10.webp',
  'assets/images/works-g06.webp',
  'assets/images/works-g10.webp',
  'assets/images/portfolio-install.jpg',
  'assets/images/portfolio-store.jpg',
  'assets/images/portfolio-w2.jpg',
  'assets/images/portfolio-w3.jpg',
  'assets/images/strip-2.webp',
  'assets/images/strip-10.jpg',
  'assets/products/img-562.jpg',
  'assets/products/img-982.jpg',
  'assets/products/img-969.jpg',
  'assets/products/img-411.jpg',
  'assets/products/img-639.jpg',
  'assets/products/img-844.jpg',
  'assets/products/img-1063.jpg',
  'assets/products/img-103.jpg',
  'assets/products/img-665.jpg',
  'assets/products/img-512.jpg',
  'assets/products/img-939.jpg',
  'assets/products/img-535.jpg',
  'assets/products/img-286.jpg',
  'assets/products/img-754.jpg',
  'assets/products/img-970.jpg',
];

// תבניות פוסט — מסתובבות יומית (עברית, מקצועי)
const GBP_TEMPLATES = [
  (title, url) => `✨ ${title}\n\nאנחנו ב-Pixel by Keshet מתמחים בפתרונות שילוט דיגיטלי ומסכי LED לעסקים בכל הארץ.\n\n📍 פרויקטים בתל אביב, ירושלים, חיפה ועוד\n📞 *9555\n🌐 ${url}`,
  (title, url) => `💡 ${title}\n\nמסך LED מקצועי — ההשקעה שמחזירה את עצמה.\nלקוחות שהתקינו מסכי תצוגה דיגיטליים מדווחים על עלייה של 30%+ במעורבות לקוחות.\n\n👉 תאמו פגישת ייעוץ חינמית: ${url}`,
  (title, url) => `🏆 ${title}\n\nPixel by Keshet — הפתרון המקצועי למסכי LED ושילוט דיגיטלי.\n✅ מסכי 24/7 לעסקים\n✅ ניהול תוכן מרחוק\n✅ אחריות + תמיכה טכנית\n\n📲 ${url}`,
  (title, url) => `🖥️ ${title}\n\nרשתות, מסעדות, חנויות, לובי, מלונות — כולם כבר עברו לשילוט דיגיטלי.\nהגיע הזמן לעסק שלכם.\n\n📞 *9555 | ${url}`,
  (title, url) => `🔥 ${title}\n\nאל תפספסו את המהפכה הדיגיטלית בשילוט!\nמסכי LED חיצוניים ופנימיים בהתאמה אישית לכל עסק.\n\n💬 מלאו פרטים לקבלת הצעת מחיר: ${url}`,
  (title, url) => `📺 ${title}\n\nמסכי תצוגה מקצועיים מבית Pixel by Keshet:\n• קיר וידאו LED\n• מסכי חלון ראווה\n• שילוט דיגיטלי לפרסום חיצוני\n• ניהול תוכן בענן\n\n${url}`,
  (title, url) => `🌟 ${title}\n\nהתוכן הנכון, במקום הנכון, בזמן הנכון.\nמערכת ניהול תוכן מתקדמת לכל מסכי ה-LED שלכם — ממקום אחד.\n\n🌐 ${url} | 📞 *9555`,
];

// ── רענן Access Token מ-Refresh Token ──────────
async function refreshGoogleToken() {
  const clientId     = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&refresh_token=${encodeURIComponent(refreshToken)}&grant_type=refresh_token`
  });
  const data = await res.json();
  return data.access_token || null;
}

async function postToGoogleBusiness(title, articleUrl) {
  const accountId  = process.env.GOOGLE_BUSINESS_ACCOUNT_ID || '';
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID || '';
  const hasRefresh = !!(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID);
  const hasStatic  = !!process.env.GOOGLE_BUSINESS_TOKEN;

  if (!accountId || !locationId || (!hasRefresh && !hasStatic)) return {
    skipped: true, platform: 'Google Business',
    reason: 'נדרש: GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + ACCOUNT_ID + LOCATION_ID'
  };

  try {
    // קבל access token — refresh token מנצח static token
    let accessToken = hasRefresh
      ? await refreshGoogleToken()
      : process.env.GOOGLE_BUSINESS_TOKEN;

    if (!accessToken) return { ok: false, platform: 'Google Business', error: 'לא הצלחתי לרענן token' };

    // תמונה + תבנית — לפי יום השנה
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const imagePath = GBP_IMAGES[dayOfYear % GBP_IMAGES.length];
    const imageUrl  = `${SITE_URL}/${imagePath}`;
    const template  = GBP_TEMPLATES[dayOfYear % GBP_TEMPLATES.length];
    const summary   = template(title, articleUrl || SITE_URL);

    const body = {
      languageCode: 'he',
      summary,
      callToAction: { actionType: 'LEARN_MORE', url: articleUrl || SITE_URL },
      topicType: 'STANDARD',
      media: [{ mediaFormat: 'PHOTO', sourceUrl: imageUrl }],
    };

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const data = await res.json();
    if (data.name) return { ok: true, platform: 'Google Business', url: SITE_URL, image: imageUrl };
    return { ok: false, platform: 'Google Business', error: JSON.stringify(data.error || data) };
  } catch(e) { return { ok: false, platform: 'Google Business', error: e.message }; }
}

// ── דפי זהב (d.co.il) — Ping + submit ────────
// שולח את ה-URL לאינדקס דפי הזהב הישראלי
async function pingDapeiZahav(articleUrl) {
  try {
    const pingUrl = `https://www.d.co.il/api/ping?url=${encodeURIComponent(articleUrl || SITE_URL)}&sitemap=${encodeURIComponent(SITE_URL + '/sitemap.xml')}`;
    const res = await fetch(pingUrl, { signal: AbortSignal.timeout(8000) });
    return { ok: res.status < 400, platform: 'דפי זהב', status: res.status };
  } catch(e) {
    return { ok: false, platform: 'דפי זהב', error: e.message };
  }
}

// ── Blogli.co.il — פינג אגרגטור בלוגים ישראלי ─
async function pingBlogli(title, articleUrl) {
  const xmlBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>weblogUpdates.ping</methodName>
  <params>
    <param><value><string>${SITE_NAME}</string></value></param>
    <param><value><string>${articleUrl || SITE_URL}</string></value></param>
  </params>
</methodCall>`;
  try {
    const res = await fetch('https://www.blogli.co.il/ping/', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlBody,
      signal: AbortSignal.timeout(8000)
    });
    return { ok: res.status < 400, platform: 'Blogli', status: res.status };
  } catch(e) {
    return { ok: false, platform: 'Blogli', error: e.message };
  }
}

// ── Tapuz — פינג RSS לאגרגטור ────────────────
async function pingTapuz(articleUrl) {
  try {
    const res = await fetch(
      `https://www.tapuz.co.il/ping/?url=${encodeURIComponent(SITE_URL + '/feed.xml')}`,
      { method: 'GET', signal: AbortSignal.timeout(8000) }
    );
    return { ok: res.status < 400, platform: 'Tapuz', status: res.status };
  } catch(e) {
    return { ok: false, platform: 'Tapuz', error: e.message };
  }
}

// ── IsraelBiz ping — מנועי חיפוש ישראליים ────
async function pingIsraeliEngines(siteUrl) {
  const endpoints = [
    `https://www.walla.co.il/websearch/ping?url=${encodeURIComponent(siteUrl)}`,
    `https://www.nana10.co.il/ping/?url=${encodeURIComponent(siteUrl)}`,
  ];
  const results = [];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { signal: AbortSignal.timeout(6000) });
      results.push({ ep, ok: res.status < 400 });
    } catch(e) { results.push({ ep, ok: false }); }
  }
  return { ok: results.some(r => r.ok), platform: 'מנועי חיפוש ישראליים', results };
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

  // ── 🇮🇱 פלטפורמות ישראליות ──────────────────
  log('info', `🇮🇱 Backlinks ישראלי: דפי זהב, Blogli, Tapuz, Walla/Nana...`);
  const [dapeiZahav, blogli, tapuz, israeliEngines] = await Promise.all([
    pingDapeiZahav(articleUrl || SITE_URL),
    pingBlogli(topic.title, articleUrl || SITE_URL),
    pingTapuz(articleUrl || SITE_URL),
    pingIsraeliEngines(SITE_URL),
  ]);

  for (const r of [dapeiZahav, blogli, tapuz, israeliEngines]) {
    if (r.ok) log('success', `✅ ${r.platform}: פינג נשלח`);
    else      log('warn',    `⚠️ ${r.platform}: ${r.error || `status ${r.status}`}`);
  }

  return results;
}

module.exports = { buildBacklinks };
