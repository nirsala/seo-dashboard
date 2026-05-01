// ═══════════════════════════════════════════
//  SEO TASK RUNNER — Multi-Site v3
//  תוכן + GitHub API + אינדוקס + רשתות + ניטור
//  תומך ריצה מקבילה על מספר אתרים
// ═══════════════════════════════════════════
const { postToSocial } = require('./social');
const { pingDirectories } = require('./directories');
const { checkUptime } = require('./monitor');
const { createPublisher, buildArticlePage, buildArticlePageForSite, buildBlogIndex, buildLlmsTxt, buildRobotsTxt, publishFile, GITHUB_TOKEN, GITHUB_REPO } = require('./github-publisher');
const { buildBacklinks } = require('./backlinks');
const { generateDailyReport } = require('./rankings-report');
const { generateRssFeed } = require('./rss');
const { getSiteTokens, initSites } = require('./sites-manager');

// KEYWORDS — ברירת מחדל אם לאתר אין keywords בsites.json (עודכן עם ניתוח מתחרים)
const DEFAULT_KEYWORDS = [
  // ── ליבה ──
  'מסכי LED לחנויות', 'שילוט דיגיטלי למסעדות', 'מסכי LED חיצוניים',
  'CMS למסכי LED', 'מסכי LED לובי', 'מסכי LED לבריכה',
  'מסכי LED מלונות', 'שילוט דיגיטלי רשתות', 'מסכי LED תל אביב',
  'תחזוקת מסכי LED', 'שלטי חוצות דיגיטליים', 'מסכי LED ספורט',
  'מסכי LED אירועים', 'שלטים דיגיטליים לעסקים', 'תפריט דיגיטלי למסעדה',
  // ── חדשות ממתחרים (scannerlight, danor, peach) ──
  'מסכי LED לאולמות אירועים', 'מסכי LED לקניונים', 'מסכי LED לאצטדיונים',
  'מסכי LED לתיאטרון', 'מסכי LED לבתים פרטיים', 'רצפת LED וידאו',
  'מסכי LED גמישים', 'מסכי LED שקופים', 'שילוט דיגיטלי לפרסום חיצוני',
  'מסכי LED לגני אירועים', 'מסכי ענק בהתאמה אישית',
  'שילוט דיגיטלי לחדרי כושר', 'מסכי LED לחברות ומשרדים',
  'מסכי LED לתערוכות', 'שילוט דיגיטלי לבנקים',
];
// backward compat
const KEYWORDS = DEFAULT_KEYWORDS;

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
async function generateTitle(keyword, apiKey, companyName = 'Pixel by Keshet') {
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
        content: `צור כותרת מאמר SEO אחת בעברית עבור חברת "${companyName}".
מילת מפתח: "${keyword}"
הכותרת חייבת להכיל את מילת המפתח, להיות מושכת, מקצועית, ולא דומה לקיימות.${usedTitles}

החזר רק את הכותרת, ללא הסברים, ללא מרכאות.`
      }]
    })
  });
  const data = await res.json();
  return (data.content?.[0]?.text || keyword).trim();
}

// בחר 2-3 מילות מפתח משניות קשורות מתוך רשימת keywords של האתר
function pickSecondaryKeywords(primaryKeyword, allKeywords, count = 3) {
  const idx = allKeywords.indexOf(primaryKeyword);
  const base = idx >= 0 ? idx : 0;
  const total = allKeywords.length;
  const candidates = [];
  // לוקח את השכנים הקרובים ברשימה — קשורים נושאית
  for (let offset = 1; candidates.length < count * 2 && offset < total; offset++) {
    const next = allKeywords[(base + offset) % total];
    const prev = allKeywords[(base - offset + total) % total];
    if (next && next !== primaryKeyword) candidates.push(next);
    if (prev && prev !== primaryKeyword && prev !== next) candidates.push(prev);
  }
  return candidates.slice(0, count);
}

// ── פרומפט xvision (מסכי LED) ────────────────
function buildXvisionPrompt({ topic, secondaryLine, date, companyName, domain, internalLinks }) {
  return `כתוב מאמר SEO מקצועי בעברית עבור חברת "${companyName}" — מומחים למסכי LED ושילוט דיגיטלי.

נושא המאמר: "${topic.title}"
מילת מפתח ראשית: "${topic.keyword}"
${secondaryLine}
תאריך: ${date}

===== עקרונות E-E-A-T שחובה לקיים =====
1. EXPERIENCE: כלול דוגמאות ספציפיות מהשטח, מספרים אמיתיים, מצבי לקוח אמיתיים
2. EXPERTISE: השתמש במינוח מקצועי: pixel pitch, IP65, ניט, refresh rate, PWM
3. AUTHORITATIVENESS: ציין ש-${companyName} פועלת בישראל עם עשרות פרויקטים
4. TRUSTWORTHINESS: כלול נתונים, השוואות, יתרונות וחסרונות — לא רק שיווק

===== מבנה חובה =====
- <h1> אחד בדיוק עם מילת המפתח הראשית + שנה (${date.slice(0,4)})
- 4-5 כותרות <h2> — לפחות אחת עם מספר, אחת בפורמט שאלה
- פסקת מסקנה עם CTA עדין
- 900-1200 מילים
- 3 קישורים פנימיים מגוונים:\n${internalLinks}
- אזכור "${companyName}"${domain ? ` ו-"${domain}"` : ''} פעם אחת כל אחד
- לפחות רשימה <ul> אחת עם 4-6 פריטים
${secondaryLine ? `\n===== מילות מפתח משניות =====\n${secondaryLine}\nשלב אותן טבעית בכותרות h2, פסקאות ו-FAQ.` : ''}

===== FAQ Schema בסוף =====
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"[שאלה 1]","acceptedAnswer":{"@type":"Answer","text":"[תשובה]"}},{"@type":"Question","name":"[שאלה 2]","acceptedAnswer":{"@type":"Answer","text":"[תשובה]"}},{"@type":"Question","name":"[שאלה 3]","acceptedAnswer":{"@type":"Answer","text":"[תשובה]"}}]}</script>

אל תציין מחירים/עלויות — הפנה ל"קבל הצעת מחיר".
החזר HTML בלבד (ללא DOCTYPE/html/head/body).`;
}

// ── פרומפט DDS (מערכת CMS למסכים) ───────────
function buildDDSPrompt({ topic, secondaryLine, date, companyName, domain, internalLinks }) {
  return `כתוב מאמר SEO מקצועי בעברית עבור "${companyName}" — מערכת ניהול תוכן (CMS) מתקדמת למסכי Digital Signage.

נושא המאמר: "${topic.title}"
מילת מפתח ראשית: "${topic.keyword}"
${secondaryLine}
תאריך: ${date}

===== הקשר עסקי =====
${companyName} היא מערכת ענן לניהול תוכן על מסכי Digital Signage — מאפשרת לרשתות עסקים, מלונות, חנויות ומסעדות לנהל תוכן על מסכים מרחוק, לתזמן קמפיינים, לעדכן מחירים ומבצעים בלחיצת כפתור.

===== גישה לכתיבה =====
כתוב כמומחה תוכן שמכיר את שוק ה-Digital Signage ואת האתגרים של מנהלי שיווק ברשתות עסקים.
השתמש בנתונים ודוגמאות אמיתיות מהתעשייה — למשל:
- "רשת של 50 סניפים יכולה לעדכן תפריט בכל המסכים בו זמנית"
- "מחקרים מראים שתוכן דינמי מגדיל מכירות ב-30%"
- "ניהול מרכזי חוסך שעות עבודה שבועיות"

===== עקרונות E-E-A-T =====
1. EXPERIENCE: דוגמאות קונקרטיות — מסעדה, מלון, חנות שרשת
2. EXPERTISE: מינוח מקצועי: playlist scheduling, content loop, zone management, API integration, cloud-based CMS
3. AUTHORITATIVENESS: השווה ל"פתרונות דומים בשוק" (ללא שמות ספציפיים) — הצג יתרונות
4. TRUSTWORTHINESS: כלול נתונים, use cases אמיתיים, גם מגבלות/שיקולים

===== מבנה חובה =====
- <h1> אחד בדיוק עם מילת המפתח הראשית + שנה (${date.slice(0,4)})
- 4-5 כותרות <h2> — לפחות אחת עם מספר ("5 יתרונות...", "3 תרחישים..."), אחת בפורמט שאלה
- כלול use case אחד לפחות כ-<blockquote> או קטע "לדוגמה"
- פסקת מסקנה עם CTA עדין לנסות/לפנות
- 900-1200 מילים
- 3 קישורים פנימיים מגוונים:\n${internalLinks}
- אזכור "${companyName}"${domain ? ` ו-"${domain}"` : ''} פעם אחת כל אחד
- לפחות רשימה <ul> אחת עם 4-6 פריטים
${secondaryLine ? `\n===== מילות מפתח משניות =====\n${secondaryLine}\nשלב אותן טבעית בכותרות, פסקאות ו-FAQ.` : ''}

===== FAQ Schema בסוף =====
3 שאלות ותשובות ספציפיות לנושא ה-CMS/Digital Signage:
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"[שאלה 1]","acceptedAnswer":{"@type":"Answer","text":"[תשובה]"}},{"@type":"Question","name":"[שאלה 2]","acceptedAnswer":{"@type":"Answer","text":"[תשובה]"}},{"@type":"Question","name":"[שאלה 3]","acceptedAnswer":{"@type":"Answer","text":"[תשובה]"}}]}</script>

אל תציין מחירים ספציפיים — הפנה ל"בקש דמו" או "צור קשר".
החזר HTML בלבד (ללא DOCTYPE/html/head/body).`;
}

async function runSEO(site, log, apiKey) {
  const score = { content: 0, publish: 0, index_bing: 0, index_google: 0, social: 0, monitor: 0, sitemap: 0, backlinks: 0 };
  const date = new Date().toISOString().split('T')[0];

  // ── פותר tokens לפי האתר ──
  const tokens = site._tokens || getSiteTokens(site) || {};
  const siteKeywords = (site.keywords && site.keywords.length > 0) ? site.keywords : DEFAULT_KEYWORDS;
  const companyName  = site.companyName || 'Pixel by Keshet';
  const siteName     = site.name || companyName;

  // Publisher ייעודי לאתר זה
  const pub = createPublisher(tokens.githubToken, tokens.githubRepo, tokens.githubBranch, site.siteUrl || site.url);

  // בחר keyword לפי האתר
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const keyword = siteKeywords[dayOfYear % siteKeywords.length];
  log('info', `🔑 [${siteName}] מילת מפתח: "${keyword}" — מייצר כותרת...`);
  let articleTitle = keyword;
  if (apiKey) {
    try {
      articleTitle = await generateTitle(keyword, apiKey, companyName);
    } catch(e) {
      log('warn', `⚠️ לא הצלחתי לייצר כותרת: ${e.message}`);
    }
  }
  const topic = { title: articleTitle, keyword };
  log('info', `📌 כותרת נבחרה: "${topic.title}"`);
  let articleSlug = '';
  let articleHtml = '';

  // ── שלב 0: קבצי תשתית (IndexNow + llms.txt + robots.txt) ──
  try {
    if (tokens.githubToken) {
      await pub.publish('pixel2024seo.txt', 'pixel2024seo', 'seo: IndexNow verification');
      await pub.publish('llms.txt', buildLlmsTxt(site), 'seo: update llms.txt for AI crawlers');
      await pub.publish('robots.txt', buildRobotsTxt(site), 'seo: update robots.txt');
      log('success', `✅ llms.txt + robots.txt פורסמו`);
    }
  } catch(e) { /* לא קריטי */ }

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
      // מילות מפתח משניות — עוזרות לדירוג על כל מילות המפתח של האתר
      const secondaryKws = pickSecondaryKeywords(topic.keyword, siteKeywords, 3);
      const secondaryLine = secondaryKws.length
        ? `מילות מפתח משניות (שלב אותן באופן טבעי, אל תבלוט): "${secondaryKws.join('", "')}"`
        : '';

      // קישורים פנימיים — מתוך הגדרות האתר
      const internalLinks = (site.internalLinks || [])
        .map(l => `  <a href="${l.href}">${l.text}</a>`)
        .join('\n') || '  <a href="/#contact">קבל הצעת מחיר</a>';

      // שם הדומיין לאזכור
      const siteUrl = site.siteUrl || site.url || '';
      const domain = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

      // בניית פרומפט — שונה לפי סוג האתר
      const isDDS = site.id === 'dds';
      const articlePrompt = isDDS
        ? buildDDSPrompt({ topic, secondaryLine, date, companyName, domain, internalLinks })
        : buildXvisionPrompt({ topic, secondaryLine, date, companyName, domain, internalLinks });

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
          messages: [{ role: 'user', content: articlePrompt }]
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
      const kwIndex = siteKeywords.indexOf(topic.keyword);
      const slugPrefix = site.id === 'dds' ? 'cms-article' : 'led-article';
      articleSlug = `${slugPrefix}-${kwIndex >= 0 ? kwIndex : (dayOfYear % siteKeywords.length)}-${date}`;

      const fullHtml = buildArticlePageForSite(topic, articleHtml, date, articleSlug, site);
      const result = await pub.publish(`blog/${articleSlug}.html`, fullHtml, `seo: ${topic.title}`);

      if (result.ok) {
        score.publish = 20;
        log('success', `✅ פורסם: blog/${articleSlug}.html`);
        markTopicPublished(topic.title, topic.keyword);

        // עדכן אינדקס בלוג
        await updateBlogIndex(topic, articleSlug, date, log, pub);
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
      if (tokens.githubToken) {
        const smText = await pub.readFile('sitemap.xml');
        let existingUrls = [];
        if (smText) {
          const matches = smText.match(/<loc>([^<]+)<\/loc>/g) || [];
          existingUrls = matches.map(m => m.replace(/<\/?loc>/g, ''));
        }
        const newUrl = `${siteUrl}/blog/${articleSlug}.html`;
        if (!existingUrls.includes(newUrl)) existingUrls.push(newUrl);
        // סנן URLs שגויים (http://, www., כפילויות)
        const cleanUrls = [...new Set(existingUrls.filter(u => u.startsWith('https://')))];
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${cleanUrls.map(u => `  <url><loc>${u}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>`;
        const smResult = await pub.publish('sitemap.xml', sitemap, `seo: update sitemap — ${articleSlug}`);
        if (smResult.ok) { score.sitemap = 10; log('success', `✅ sitemap.xml עודכן (${existingUrls.length} URLs)`); }
        else log('warn', `⚠️ sitemap: ${smResult.error}`);
      } else {
        log('warn', `⚠️ sitemap: אין GitHub Token`);
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
    const socialRes = await postToSocial(topic.title, articleUrl, tokens, site.id);
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
async function updateBlogIndex(topic, slug, date, log, pub) {
  try {
    const indexPath = 'blog/index.json';
    let articles = [];

    const raw = await pub.readFile(indexPath);
    if (raw) {
      try { articles = JSON.parse(raw); } catch {}
    }

    const alreadyExists = articles.some(a => a.slug === slug);
    if (!alreadyExists) {
      articles.unshift({ title: topic.title, keyword: topic.keyword, slug, date });
    }
    articles = articles.slice(0, 50);

    await pub.publish(indexPath, JSON.stringify(articles, null, 2), `seo: update blog index`);
    await pub.publish('blog/index.html', buildBlogIndex(articles), `seo: update blog page`);

    log('success', `✅ אינדקס בלוג עודכן (${articles.length} מאמרים)`);
  } catch(e) {
    log('warn', `⚠️ עדכון אינדקס: ${e.message}`);
  }
}

module.exports = { runSEO };
