// ═══════════════════════════════════════════
//  RSS FEED GENERATOR
//  מייצר feed.xml ומפרסם ל-GitHub
// ═══════════════════════════════════════════
const { publishFile } = require('./github-publisher');

const SITE_URL  = process.env.SITE_URL  || 'https://xvision.co.il';
const SITE_NAME = process.env.SITE_NAME || 'Pixel by Keshet — מסכי LED ושילוט דיגיטלי';

function escapeXml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function getPublishedArticles() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
  const GITHUB_REPO  = process.env.GITHUB_REPO  || 'nirsala/xvision-website';
  if (!GITHUB_TOKEN) return [];
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/blog/index.json`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch { return []; }
}

async function generateRssFeed(log) {
  const articles = await getPublishedArticles();
  if (!articles.length) {
    if (log) log('warn', '⚠️ RSS: אין מאמרים עדיין');
    return { skipped: true };
  }

  const items = articles.slice(0, 20).map(a => {
    const url = `${SITE_URL}/blog/${a.slug}.html`;
    const pubDate = a.date ? new Date(a.date).toUTCString() : new Date().toUTCString();
    return `
  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${escapeXml(url)}</link>
    <guid isPermaLink="true">${escapeXml(url)}</guid>
    <description>${escapeXml(a.title)} — מאמר מקצועי מאת Pixel by Keshet בנושא מסכי LED ושילוט דיגיטלי בישראל.</description>
    <pubDate>${pubDate}</pubDate>
    <category>מסכי LED</category>
    <category>שילוט דיגיטלי</category>
  </item>`;
  }).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>מאמרים מקצועיים על מסכי LED, שילוט דיגיטלי ופתרונות תצוגה לעסקים בישראל מאת Pixel by Keshet.</description>
    <language>he</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/assets/logo/pixel-logo-transparent.png</url>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${SITE_URL}</link>
    </image>${items}
  </channel>
</rss>`;

  const result = await publishFile('feed.xml', rss, 'seo: update RSS feed');
  if (result.ok) {
    if (log) log('success', `✅ RSS Feed עודכן: ${SITE_URL}/feed.xml (${articles.length} מאמרים)`);
    // הגש את ה-feed לדירקטוריות RSS
    await submitFeedToDirectories(log);
    return { ok: true, url: `${SITE_URL}/feed.xml` };
  }
  if (log) log('warn', `⚠️ RSS: ${result.error}`);
  return { ok: false };
}

async function submitFeedToDirectories(log) {
  const feedUrl = `${SITE_URL}/feed.xml`;
  const dirs = [
    `https://www.feedspot.com/?url=${encodeURIComponent(feedUrl)}`,
  ];

  // Ping Google ו-Bing עם ה-feed
  try {
    await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(feedUrl)}`);
    await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(feedUrl)}`);
    if (log) log('success', `✅ RSS Feed נשלח ל-Google ו-Bing`);
  } catch(e) {
    if (log) log('warn', `⚠️ RSS ping: ${e.message}`);
  }
}

module.exports = { generateRssFeed };
