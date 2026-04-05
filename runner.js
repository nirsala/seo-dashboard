// ═══════════════════════════════════════════
//  SEO TASK RUNNER — Full Pipeline v2
//  תוכן + GitHub API + אינדוקס + רשתות + ניטור
// ═══════════════════════════════════════════
const { postToSocial } = require('./social');
const { pingDirectories } = require('./directories');
const { checkUptime } = require('./monitor');
const { publishFile, buildArticlePage, buildBlogIndex } = require('./github-publisher');

const TOPICS = [
  { title: 'מסכי LED לחנויות קמעונאיות — המדריך המלא', keyword: 'מסכי LED לחנויות' },
  { title: '5 סיבות למה כל מסעדה צריכה שילוט דיגיטלי', keyword: 'שילוט דיגיטלי למסעדות' },
  { title: 'מסכי LED חיצוניים — כל מה שצריך לדעת לפני הרכישה', keyword: 'מסכי LED חיצוניים' },
  { title: 'מערכת ניהול תוכן למסכים (CMS) — המדריך המלא', keyword: 'CMS למסכי LED' },
  { title: 'מסכי לובי — חוויית כניסה שתרשים כל מבקר', keyword: 'מסכי LED לובי' },
  { title: 'מסכי בריכה עמידים לחוץ — המדריך לבחירה הנכונה', keyword: 'מסכי LED לבריכה' },
  { title: 'כמה עולה מסך LED לעסק? מחיר, גדלים ואפשרויות', keyword: 'מחיר מסך LED לעסק' },
  { title: 'מסכי LED לבתי מלון — חוויית אורחים ברמה אחרת', keyword: 'מסכי LED מלונות' },
  { title: 'שילוט דיגיטלי לרשתות קמעונאיות — מדריך מקצועי', keyword: 'שילוט דיגיטלי רשתות' },
  { title: 'מסכי LED בתל אביב — פתרונות שילוט לעסקים בעיר', keyword: 'מסכי LED תל אביב' },
  { title: 'מסכי LED ירושלים — שילוט דיגיטלי בבירה', keyword: 'מסכי LED ירושלים' },
  { title: 'מסכי LED חיפה — פתרונות לעסקים בצפון', keyword: 'מסכי LED חיפה' },
  { title: 'תחזוקת מסכי LED — המדריך לשמירה על הציוד', keyword: 'תחזוקת מסכי LED' },
  { title: 'השוואת מסכי LED — איך בוחרים את הנכון לעסק?', keyword: 'השוואת מסכי LED' },
  { title: 'שלטי חוצות דיגיטליים — כל מה שצריך לדעת', keyword: 'שלטי חוצות דיגיטליים' },
  { title: 'מסכי LED לבית ספר ולמוסדות חינוך', keyword: 'מסכי LED חינוך' },
  { title: 'שילוט דיגיטלי לסניפי בנק — פתרונות מקצועיים', keyword: 'שילוט דיגיטלי בנקים' },
  { title: 'מסכי LED לאולמות ספורט ואצטדיונים', keyword: 'מסכי LED ספורט' },
  { title: 'מסכי LED לחדרי כושר ופיטנס', keyword: 'מסכי LED חדר כושר' },
  { title: 'שילוט דיגיטלי לבתי חולים ומרפאות', keyword: 'שילוט דיגיטלי בריאות' },
  { title: 'מסכי LED לאולמות שמחות ואירועים', keyword: 'מסכי LED אירועים' },
  { title: 'תצוגות ויטרינה LED — פתרון חדשני לחנויות', keyword: 'תצוגות ויטרינה LED' },
  { title: 'מסכי LED לפתח תקווה — שילוט דיגיטלי לעסקים מקומיים', keyword: 'מסכי LED פתח תקווה' },
  { title: 'מסכי LED לרמת גן וגבעתיים', keyword: 'מסכי LED רמת גן' },
  { title: 'היתר שלט חוצות דיגיטלי — מה שצריך לדעת', keyword: 'היתר שלט חוצות' },
  { title: 'IP65 ו-IP67 — מה זה אומר למסכי LED חיצוניים?', keyword: 'IP65 מסכי LED' },
  { title: 'pixel pitch מסכי LED — המדריך להבנת הרזולוציה', keyword: 'pixel pitch LED' },
  { title: 'מסכי LED לסופרמרקטים ורשתות מזון', keyword: 'מסכי LED סופרמרקט' },
];

async function runSEO(site, log, apiKey) {
  const score = { content: 0, publish: 0, index_bing: 0, index_google: 0, social: 0, monitor: 0 };
  const date = new Date().toISOString().split('T')[0];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const topic = TOPICS[dayOfYear % TOPICS.length];
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
          max_tokens: 2500,
          messages: [{
            role: 'user',
            content: `כתוב מאמר SEO בעברית בנושא: "${topic.title}"
מילת מפתח ראשית: "${topic.keyword}"

דרישות:
- 700-900 מילים
- כותרת H1 אחת בדיוק
- 3 כותרות H2
- אזכור "Pixel by Keshet" ו-"xvision.co.il" פעם אחת כל אחד
- סגנון מקצועי אך נגיש
- בסוף הוסף 2 שאלות FAQ בפורמט JSON-LD:
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"[שאלה 1]","acceptedAnswer":{"@type":"Answer","text":"[תשובה מפורטת]"}},{"@type":"Question","name":"[שאלה 2]","acceptedAnswer":{"@type":"Answer","text":"[תשובה מפורטת]"}}]}</script>

החזר HTML בלבד (גוף המאמר בלבד, ללא DOCTYPE/html/head).`
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
      articleSlug = topic.title
        .replace(/[^א-תa-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 60);

      const fullHtml = buildArticlePage(topic, articleHtml, date, articleSlug);
      const result = await publishFile(`blog/${articleSlug}.html`, fullHtml, `seo: ${topic.title}`);

      if (result.ok) {
        score.publish = 20;
        log('success', `✅ פורסם: blog/${articleSlug}.html`);

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

  // Google sitemap ping (deprecated but still works)
  try {
    const gRes = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(siteUrl + '/sitemap.xml')}`);
    score.index_google = gRes.status < 400 ? 15 : 5;
    log('success', `✅ Google Sitemap ping: ${gRes.status}`);
  } catch(e) { log('warn', `⚠️ Google ping: ${e.message}`); }

  // ── שלב 5: דירקטוריות ──────────────────────
  log('info', `📋 שלב 5/6: פינג מנועי חיפוש ודירקטוריות...`);
  try {
    await pingDirectories(log);
    score.monitor += 5;
  } catch(e) { log('warn', `⚠️ ${e.message}`); }

  // ── שלב 6: רשתות חברתיות ────────────────────
  log('info', `📱 שלב 6/6: מפרסם ברשתות חברתיות...`);
  try {
    const articleUrl = articleSlug ? `${siteUrl}/blog/${articleSlug}.html` : siteUrl;
    const socialRes = await postToSocial(topic.title, articleUrl);
    if (socialRes.ok)      { score.social = 10; log('success', `✅ פורסם ברשתות חברתיות`); }
    else if (socialRes.skipped) { log('warn', `⚠️ הוסף AYRSHARE_API_KEY לפרסום ברשתות`); }
    else                   { log('error', `❌ רשתות: ${socialRes.error}`); }
  } catch(e) { log('error', `❌ רשתות: ${e.message}`); }

  const total = Object.values(score).reduce((a, b) => a + b, 0);
  log('info', `\n🏆 ציון: ${total}/100 | תוכן:${score.content} פרסום:${score.publish} Bing:${score.index_bing} Google:${score.index_google} סושיאל:${score.social} ניטור:${score.monitor}`);
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

    // הוסף מאמר חדש בהתחלה
    articles.unshift({ title: topic.title, keyword: topic.keyword, slug, date });
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
