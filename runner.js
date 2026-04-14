// ═══════════════════════════════════════════
//  SEO TASK RUNNER — Full Pipeline v2
//  תוכן + GitHub API + אינדוקס + רשתות + ניטור
// ═══════════════════════════════════════════
const { postToSocial } = require('./social');
const { pingDirectories } = require('./directories');
const { checkUptime } = require('./monitor');
const { publishFile, buildArticlePage, buildBlogIndex } = require('./github-publisher');
const { buildBacklinks } = require('./backlinks');
const { generateDailyReport } = require('./rankings-report');
const { generateRssFeed } = require('./rss');

// מאגר מילות מפתח — המערכת תייצר כותרת חדשה לכל אחת בכל הרצה
const KEYWORDS = [
  'מסכי LED לחנויות',
  'שילוט דיגיטלי למסעדות',
  'מסכי LED חיצוניים',
  'CMS למסכי LED',
  'מסכי LED לובי',
  'מסכי LED לבריכה',
  'מחיר מסך LED לעסק',
  'מסכי LED מלונות',
  'שילוט דיגיטלי רשתות',
  'מסכי LED תל אביב',
  'מסכי LED ירושלים',
  'מסכי LED חיפה',
  'תחזוקת מסכי LED',
  'השוואת מסכי LED',
  'שלטי חוצות דיגיטליים',
  'מסכי LED חינוך',
  'שילוט דיגיטלי בנקים',
  'מסכי LED ספורט',
  'מסכי LED חדר כושר',
  'שילוט דיגיטלי בריאות',
  'מסכי LED אירועים',
  'תצוגות ויטרינה LED',
  'מסכי LED פתח תקווה',
  'מסכי LED רמת גן',
  'היתר שלט חוצות',
  'IP65 מסכי LED',
  'pixel pitch LED',
  'מסכי LED סופרמרקט',
  'שלטים דיגיטליים לעסקים',
  'תפריט דיגיטלי למסעדה',
  'מסכי LED למלונות',
  'מסכי LED לאולמות אירועים',
  'שילוט דיגיטלי לקניונים',
  'מסכי LED לחדרי כושר',
  'מסכי LED לסופרמרקט',
  'מסכי LED לתחנות דלק',
  'מסכי LED לקליניקות',
  'שלטי חוצות LED ישראל',
];

// מעקב כותרות שפורסמו — מונע כפילויות
const fs = require('fs');
const PUBLISHED_LOG = 'data/published-topics.json';

function getPublishedTopics() {
  try { return JSON.parse(fs.readFileSync(PUBLISHED_LOG, 'utf8')); } catch { return []; }
}

function markTopicPublished(title, keyword) {
  const published = getPublishedTopics();
  published.push({ title, keyword, date: new Date().toISOString().split('T')[0] });
  if (!fs.existsSync('data')) fs.mkdirSync('data');
  fs.writeFileSync(PUBLISHED_LOG, JSON.stringify(published, null, 2));
}

// בוחר מילת מפתח — מסתחרר על כל המילות לפי סדר
function pickKeyword() {
  const published = getPublishedTopics();
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return KEYWORDS[dayOfYear % KEYWORDS.length];
}

// מבקש מ-Claude לייצר כותרת חדשה וייחודית למילת מפתח
async function generateTitle(keyword, apiKey) {
  const published = getPublishedTopics().map(p => p.title);
  const usedTitles = published.length
    ? `\nכותרות שכבר נכתבו (אל תחזור עליהן):\n${published.map(t => `- ${t}`).join('\n')}`
    : '';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `צור כותרת מאמר SEO אחת בעברית עבור חברת "Pixel by Keshet" — מומחים למסכי LED ושילוט דיגיטלי בישראל.
מילת מפתח: "${keyword}"
הכותרת חייבת להכיל את מילת המפתח, להיות מושכת, מקצועית, ולא דומה לקיימות.${usedTitles}

החזר רק את הכותרת, ללא הסברים, ללא מרכאות.`
      }]
    })
  });
  const data = await res.json();
  return (data.content?.[0]?.text || keyword).trim();
}

async function runSEO(site, log, apiKey) {
  const score = { content: 0, publish: 0, index_bing: 0, index_google: 0, social: 0, monitor: 0, sitemap: 0, backlinks: 0 };
  const date = new Date().toISOString().split('T')[0];
  const keyword = pickKeyword();
  log('info', `🔑 מילת מפתח: "${keyword}" — מייצר כותרת...`);
  let articleTitle = keyword;
  if (apiKey) {
    try {
      articleTitle = await generateTitle(keyword, apiKey);
    } catch(e) {
      log('warn', `⚠️ לא הצלחתי לייצר כותרת: ${e.message}`);
    }
  }
  const topic = { title: articleTitle, keyword };
  log('info', `📌 כותרת נבחרה: "${topic.title}"`);
  let articleSlug = '';
  let articleHtml = '';

  // ── שלב 1: ניטור זמינות ─────────────────────
  log('info', `🌐 שלב 1/6: בודק זמינות אתר...`);
  try {
    await checkUptime(log);
    score.monitor += 5;
  } catch(e) { log('warn', `⚠️ זמינות: ${e.message}`); }

  // ── שלב 2: ייצור מאמר ─────────────────────
  log('info', `📝 שלב 2/6: מייצר מאמר: "${topic.title}"`);

  if (apiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: `כתוב מאמר SEO מקצועי בעברית עבור חברת "Pixel by Keshet" — מומחים למסכי LED ושילוט דיגיטלי בישראל.

נושא המאמר: "${topic.title}"
מילת מפתח ראשית: "${topic.keyword}"
תאריך: ${date}

===== עקרונות E-E-A-T שחובה לקיים =====
1. EXPERIENCE (ניסיון): כלול דוגמאות ספציפיות מהשטח, מספרים אמיתיים, מצבי לקוח אמיתיים
2. EXPERTISE (מומחיות): השתמש במינוח מקצועי: pixel pitch, IP65, ניט, refresh rate, PWM
3. AUTHORITATIVENESS: ציין שPixel by Keshet פועלת בישראל עם עשרות פרויקטים
4. TRUSTWORTHINESS: כלול נתונים, השוואות, יתרונות וחסרונות — לא רק שיווק

===== מבנה חובה =====
- <h1> אחד בדיוק עם מילת המפתח + שנה (${date.slice(0,4)})
- 4-5 כותרות <h2> שמכסות כוונות חיפוש שונות — לפחות אחת עם מספר ("5 סיבות...", "3 דברים שחשוב לדעת...")
- כותרת אחת <h2> בפורמט שאלה ("האם...?", "מתי כדאי...?", "מה ההבדל בין...?")
- פסקת מסקנה עם CTA עדין
- 900-1200 מילים
- 3 קישורים פנימיים מגוונים:
  <a href="/products.html">קטלוג המוצרים שלנו</a>
  <a href="/pool.html">מסכי LED לבריכה</a>
  <a href="/cms.html">מערכת ניהול תוכן</a>
  <a href="/#contact">קבל הצעת מחיר</a>
  (בחר 3 מהרשימה הנ"ל שמתאימים להקשר)
- אזכור "Pixel by Keshet" ו-"xvision.co.il" פעם אחת כל אחד
- לפחות רשימה אחת <ul> עם 4-6 פריטים

===== FAQ Schema בסוף =====
הוסף בסיום:
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"[שאלה 1 ספציפית לנושא]","acceptedAnswer":{"@type":"Answer","text":"[תשובה מפורטת 2-3 משפטים]"}},{"@type":"Question","name":"[שאלה 2 ספציפית]","acceptedAnswer":{"@type":"Answer","text":"[תשובה מפורטת]"}},{"@type":"Question","name":"[שאלה 3 ספציפית]","acceptedAnswer":{"@type":"Answer","text":"[תשובה מפורטת]"}}]}</script>

===== חשוב =====
אל תציין מחירים, עלויות, סכומי כסף, טווחי מחיר, או כל אזכור של שקלים/דולרים — גם אם מילת המפתח כוללת "מחיר". במקום זאת הפנה ל"קבל הצעת מחיר" (קישור פנימי).

החזר HTML בלבד (גוף המאמר, ללא DOCTYPE/html/head/body).`
          }]
        })
      });
      const data = await res.json();
      articleHtml = data.content?.[0]?.text || '';
      score.content = 20;
      log('success', `✅ מאמר נוצר: ${articleHtml.length} תווים`);
    } catch(e) {
      log('error', `❌ יצירת תוכן: ${e.message}`);
    }
  } else {
    log('warn', `⚠️ אין ANTHROPIC_API_KEY — מדלג על יצירת תוכן`);
  }

  // ── שלב 3: פרסום ל-GitHub ──────────────────
  if (articleHtml) {
    log('info', `🚀 שלב 3/6: מפרסם ל-GitHub...`);
    try {
      // slug באנגלית בלבד — מונע URL שבור עם עברית
      const kwIndex = KEYWORDS.indexOf(topic.keyword);
      articleSlug = `led-article-${kwIndex >= 0 ? kwIndex : 0}-${date}`;

      const fullHtml = buildArticlePage(topic, articleHtml, date, articleSlug);
      const result = await publishFile(`blog/${articleSlug}.html`, fullHtml, `seo: ${topic.title}`);

      if (result.ok) {
        score.publish = 20;
        log('success', `✅ פורסם: blog/${articleSlug}.html`);
        markTopicPublished(topic.title, topic.keyword);

        // עדכן אינדקס בלוג
        await updateBlogIndex(topic, articleSlug, date, log);
      } else {
        log('error', `❌ GitHub: ${result.error}`);
        if (result.error?.includes('GITHUB_TOKEN')) {
          log('warn', `💡 הוסף GITHUB_TOKEN ב-Environment Variables של Render`);
        }
      }
    } catch(e) {
      log('error', `❌ פרסום: ${e.message.slice(0, 120)}`);
    }
  } else {
    log('warn', `⚠️ שלב 3/6: אין תוכן לפרסם`);
  }

  // ── שלב 4: אינדוקס ─────────────────────────
  log('info', `🔍 שלב 4/6: שולח לאינדוקס...`);
  const siteUrl = site.url || 'https://xvision.co.il';
  const urlsToIndex = [
    siteUrl,
    `${siteUrl}/sitemap.xml`,
    articleSlug ? `${siteUrl}/blog/${articleSlug}.html` : null
  ].filter(Boolean);

  // Bing IndexNow
  try {
    const bingBody = {
      host: new URL(siteUrl).hostname,
      key: 'pixel2024seo',
      keyLocation: `${siteUrl}/pixel2024seo.txt`,
      urlList: urlsToIndex.filter(u => !u.includes('sitemap'))
    };
    const bingRes = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bingBody)
    });
    score.index_bing = bingRes.status < 400 ? 15 : 5;
    log('success', `✅ Bing IndexNow: ${bingRes.status}`);
  } catch(e) { log('error', `❌ Bing: ${e.message}`); }

  // Google IndexNow + Search Console
  try {
    const googleBody = {
      host: new URL(siteUrl).hostname,
      key: 'pixel2024seo',
      keyLocation: `${siteUrl}/pixel2024seo.txt`,
      urlList: urlsToIndex.filter(u => !u.includes('sitemap'))
    };
    const gRes = await fetch('https://www.google.com/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googleBody)
    });
    // Google Search Console — Indexing API (דורש GOOGLE_INDEXING_KEY)
    const gscKey = process.env.GOOGLE_INDEXING_KEY || '';
    if (gscKey && articleSlug) {
      const articleFullUrl = `${siteUrl}/blog/${articleSlug}.html`;
      await fetch(`https://indexing.googleapis.com/v3/urlNotifications:publish?key=${gscKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: articleFullUrl, type: 'URL_UPDATED' })
      });
      log('success', `✅ Google Search Console Indexing API: נשלח`);
    }
    score.index_google = gRes.status < 400 ? 15 : 5;
    log('success', `✅ Google IndexNow: ${gRes.status}`);
  } catch(e) { log('warn', `⚠️ Google IndexNow: ${e.message}`); }

  // ── שלב 4.5: עדכון sitemap.xml ──────────────
  if (articleSlug) {
    try {
      const { publishFile: pub, GITHUB_TOKEN: ghToken, GITHUB_REPO: ghRepo } = require('./github-publisher');
      if (ghToken) {
        // קרא sitemap קיים מ-GitHub
        let existingUrls = [];
        const smRes = await fetch(`https://api.github.com/repos/${ghRepo}/contents/sitemap.xml`, {
          headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github.v3+json' }
        });
        if (smRes.ok) {
          const smData = await smRes.json();
          const smText = Buffer.from(smData.content, 'base64').toString('utf8');
          const matches = smText.match(/<loc>([^<]+)<\/loc>/g) || [];
          existingUrls = matches.map(m => m.replace(/<\/?loc>/g, ''));
        }
        const newUrl = `${siteUrl}/blog/${articleSlug}.html`;
        if (!existingUrls.includes(newUrl)) existingUrls.push(newUrl);
        // בנה sitemap חדש
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${existingUrls.map(u => `  <url><loc>${u}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join('\n')}
</urlset>`;
        const smResult = await pub('sitemap.xml', sitemap, `seo: update sitemap — ${articleSlug}`);
        if (smResult.ok) {
          score.sitemap = 10;
          log('success', `✅ sitemap.xml עודכן (${existingUrls.length} URLs)`);
        } else {
          log('warn', `⚠️ sitemap: ${smResult.error}`);
        }
      } else {
        log('warn', `⚠️ sitemap: אין GITHUB_TOKEN`);
      }
    } catch(e) { log('warn', `⚠️ sitemap: ${e.message}`); }
  }

  // ── שלב 5: דירקטוריות ──────────────────────
  log('info', `📋 שלב 5/6: פינג מנועי חיפוש ודירקטוריות...`);
  try {
    await pingDirectories(log);
    score.monitor += 5;
  } catch(e) { log('warn', `⚠️ ${e.message}`); }

  // ── שלב 6: בניית קישורים חיצוניים ──────────
  log('info', `🔗 שלב 6/7: בונה קישורים חיצוניים (Medium, Dev.to, Hashnode)...`);
  try {
    const articleUrl = articleSlug ? `${siteUrl}/blog/${articleSlug}.html` : siteUrl;
    const blResults = await buildBacklinks(topic, articleUrl, log);
    score.backlinks = blResults.length * 5; // 5 נקודות לכל פלטפורמה מוצלחת
  } catch(e) { log('error', `❌ Backlinks: ${e.message}`); }

  // ── שלב 7: רשתות חברתיות ────────────────────
  log('info', `📱 שלב 7/7: מפרסם ברשתות חברתיות...`);
  try {
    const articleUrl = articleSlug ? `${siteUrl}/blog/${articleSlug}.html` : siteUrl;
    const socialRes = await postToSocial(topic.title, articleUrl);
    if (socialRes.ok)      { score.social = 10; log('success', `✅ פורסם ברשתות חברתיות`); }
    else if (socialRes.skipped) { log('warn', `⚠️ הוסף AYRSHARE_API_KEY לפרסום ברשתות`); }
    else                   { log('error', `❌ רשתות: ${socialRes.error}`); }
  } catch(e) { log('error', `❌ רשתות: ${e.message}`); }

  // ── RSS Feed ─────────────────────────────────
  try {
    await generateRssFeed(log);
  } catch(e) { log('warn', `⚠️ RSS: ${e.message}`); }

  // ── דוח מיקומים יומי ────────────────────────
  try {
    await generateDailyReport(log);
  } catch(e) { log('warn', `⚠️ דוח מיקומים: ${e.message}`); }

  const total = Object.values(score).reduce((a, b) => a + b, 0);
  log('info', `\n🏆 ציון: ${total}/100 | תוכן:${score.content} פרסום:${score.publish} Bing:${score.index_bing} Google:${score.index_google} סושיאל:${score.social} ניטור:${score.monitor} Sitemap:${score.sitemap} Backlinks:${score.backlinks}`);
  log('score', String(total));

  return { score: total, breakdown: score, topic: topic.title, date };
}

// עדכון אינדקס הבלוג
async function updateBlogIndex(topic, slug, date, log) {
  try {
    // קרא אינדקס קיים מ-GitHub
    const fs = require('fs');
    const indexPath = 'blog/index.json';
    let articles = [];

    const { GITHUB_TOKEN, GITHUB_REPO } = require('./github-publisher');
    if (GITHUB_TOKEN) {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${indexPath}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (res.ok) {
        const data = await res.json();
        articles = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      }
    }

    // הוסף מאמר חדש רק אם ה-slug לא קיים כבר
    const alreadyExists = articles.some(a => a.slug === slug);
    if (!alreadyExists) {
      articles.unshift({ title: topic.title, keyword: topic.keyword, slug, date });
    }
    // שמור רק 50 האחרונים
    articles = articles.slice(0, 50);

    // פרסם אינדקס JSON
    const { publishFile, buildBlogIndex } = require('./github-publisher');
    await publishFile(indexPath, JSON.stringify(articles, null, 2), `seo: update blog index`);

    // פרסם דף HTML של בלוג
    await publishFile('blog/index.html', buildBlogIndex(articles), `seo: update blog page`);

    log('success', `✅ אינדקס בלוג עודכן (${articles.length} מאמרים)`);
  } catch(e) {
    log('warn', `⚠️ עדכון אינדקס: ${e.message}`);
  }
}

module.exports = { runSEO };
