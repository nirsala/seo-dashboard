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
