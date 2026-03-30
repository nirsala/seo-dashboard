// ═══════════════════════════════════════════
//  SEO TASK RUNNER — Full Pipeline
//  תוכן + פרסום + אינדוקס + רשתות + ניטור
// ═══════════════════════════════════════════
const { execSync } = require('child_process');
const { postToSocial } = require('./social');
const { pingDirectories } = require('./directories');
const { checkPageSpeed, checkUptime } = require('./monitor');

const TOPICS = [
  { title: 'מסכי LED לחנויות קמעונאיות — המדריך המלא', keyword: 'מסכי LED לחנויות' },
  { title: '5 סיבות למה כל מסעדה צריכה שילוט דיגיטלי', keyword: 'שילוט דיגיטלי למסעדות' },
  { title: 'מסכי LED חיצוניים — כל מה שצריך לדעת', keyword: 'מסכי LED חיצוניים' },
  { title: 'מערכת ניהול תוכן למסכים — איך זה עובד?', keyword: 'ניהול תוכן מסכים' },
  { title: 'מסכי לובי — חוויית כניסה שתרשים כל מבקר', keyword: 'מסכי LED לובי' },
  { title: 'מסכי בריכה עמידים לחוץ — המדריך לבחירה', keyword: 'מסכי LED לבריכה' },
  { title: 'כמה עולה מסך LED לעסק? מחיר, גדלים ואפשרויות', keyword: 'מסכי LED לעסקים' },
  { title: 'מסכי LED לבתי מלון — חוויית אורחים ברמה אחרת', keyword: 'מסכי LED מלונות' },
  { title: 'שילוט דיגיטלי לרשתות קמעונאיות — מדריך מקצועי', keyword: 'שילוט דיגיטלי רשתות' },
  { title: 'מסכי LED בתל אביב — פתרונות לעסקים בעיר', keyword: 'מסכי LED תל אביב' },
  { title: 'מסכי LED ירושלים — שילוט דיגיטלי בבירה', keyword: 'מסכי LED ירושלים' },
  { title: 'מסכי LED חיפה — פתרונות לעסקים בצפון', keyword: 'מסכי LED חיפה' },
  { title: 'תחזוקת מסכי LED — המדריך המלא לשמירה על הציוד', keyword: 'תחזוקת מסכי LED' },
  { title: 'השוואת מסכי LED — איך בוחרים את הנכון לעסק?', keyword: 'השוואת מסכי LED' },
];

async function runSEO(site, log, apiKey) {
  const score = { content: 0, publish: 0, index_bing: 0, index_google: 0, social: 0, monitor: 0 };
  const date = new Date().toISOString().split('T')[0];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const topic = TOPICS[dayOfYear % TOPICS.length];
  let articleSlug = '';

  // ── שלב 1: ניטור זמינות ─────────────────────
  log('info', `🌐 שלב 1/6: בודק זמינות אתר...`);
  try {
    await checkUptime(log);
    score.monitor += 5;
  } catch(e) { log('warn', `⚠️ בדיקת זמינות: ${e.message}`); }

  // ── שלב 2: ייצור תוכן SEO ───────────────────
  log('info', `📝 שלב 2/6: מייצר מאמר SEO: "${topic.title}"`);
  let articleHtml = '';

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
          model: 'claude-opus-4-6',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `כתוב מאמר SEO 700 מילים בעברית בנושא: "${topic.title}"
מילת מפתח: "${topic.keyword}"
כולל: כותרת H1, 3 כותרות H2, 2 שאלות FAQ עם Schema markup בסוף.
HTML בלבד. אזכר "Pixel by Keshet" פעם אחת.
הוסף בסוף: <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"שאלה 1","acceptedAnswer":{"@type":"Answer","text":"תשובה 1"}},{"@type":"Question","name":"שאלה 2","acceptedAnswer":{"@type":"Answer","text":"תשובה 2"}}]}</script>`
          }]
        })
      });
      const data = await res.json();
      articleHtml = data.content?.[0]?.text || '';
      score.content = 20;
      log('success', `✅ תוכן נוצר (${articleHtml.length} תווים) + FAQ Schema`);
    } catch(e) {
      log('error', `❌ שגיאה ביצירת תוכן: ${e.message}`);
    }
  } else {
    log('warn', `⚠️ אין Claude API Key — מדלג על ייצור תוכן`);
  }

  // ── שלב 3: פרסום ל-GitHub ───────────────────
  if (site.dir && articleHtml) {
    try {
      const fs = require('fs');
      const path = require('path');
      const blogDir = path.join(site.dir, 'blog');
      if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });
      articleSlug = topic.title.replace(/[^א-תa-zA-Z0-9]/g,'-').replace(/-+/g,'-').slice(0,50);
      const filePath = path.join(blogDir, `${articleSlug}.html`);
      const fullHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${topic.title} | Pixel by Keshet</title>
<meta name="description" content="${topic.keyword} — מידע מקצועי מבית Pixel by Keshet."/>
<link rel="canonical" href="${site.url}/blog/${articleSlug}.html"/>
<link rel="icon" href="/favicon.ico"/>
</head>
<body style="font-family:'Heebo',sans-serif;direction:rtl;max-width:820px;margin:auto;padding:24px;background:#fff;color:#111;line-height:1.8">
<a href="/" style="color:#d71d43;text-decoration:none;font-size:14px">← חזרה לאתר</a>
${articleHtml}
<hr style="margin:32px 0;border:none;border-top:1px solid #eee"/>
<p style="font-size:12px;color:#888">פורסם: ${date} | <a href="${site.url}" style="color:#d71d43">Pixel by Keshet</a></p>
</body>
</html>`;
      fs.writeFileSync(filePath, fullHtml, 'utf8');
      log('info', `💾 שלב 3/6: שומר ומפרסם ל-GitHub...`);
      execSync('git add -A && git commit -m "seo: daily article + FAQ schema" && git push origin main', { cwd: site.dir, encoding: 'utf8' });
      score.publish = 20;
      log('success', `✅ פורסם: blog/${articleSlug}.html`);
    } catch(e) {
      log('error', `❌ שגיאה בפרסום: ${e.message.slice(0,120)}`);
    }
  } else if (!site.dir) {
    log('warn', `⚠️ שלב 3/6: אין תיקיית פרויקט — לא מפרסם ל-GitHub`);
  }

  // ── שלב 4: אינדוקס ──────────────────────────
  log('info', `🔍 שלב 4/6: שולח לאינדוקס...`);
  try {
    const bingRes = await fetch(`https://api.indexnow.org/indexnow?url=${encodeURIComponent(site.url)}&key=pixel2024seo`);
    score.index_bing = bingRes.status < 400 ? 15 : 5;
    log('success', `✅ Bing IndexNow: ${bingRes.status}`);
  } catch(e) { log('error', `❌ Bing: ${e.message}`); }

  try {
    const gRes = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(site.url + '/sitemap.xml')}`);
    score.index_google = gRes.status < 400 ? 15 : 5;
    log('success', `✅ Google Sitemap: ${gRes.status}`);
  } catch(e) { log('error', `❌ Google: ${e.message}`); }

  // ── שלב 5: פינג דירקטוריות ──────────────────
  log('info', `📋 שלב 5/6: פינג מנועי חיפוש...`);
  try {
    await pingDirectories(log);
    score.monitor += 5;
  } catch(e) { log('warn', `⚠️ ${e.message}`); }

  // ── שלב 6: רשתות חברתיות ────────────────────
  log('info', `📱 שלב 6/6: מפרסם ברשתות חברתיות...`);
  try {
    const articleUrl = articleSlug ? `${site.url}/blog/${articleSlug}.html` : site.url;
    const socialRes = await postToSocial(topic.title, articleUrl);
    if (socialRes.ok) { score.social = 10; log('success', `✅ פורסם בפייסבוק, אינסטגרם, לינקדאין`); }
    else if (socialRes.skipped) { log('warn', `⚠️ הוסף Ayrshare API Key לפרסום ברשתות חברתיות`); }
  } catch(e) { log('error', `❌ רשתות חברתיות: ${e.message}`); }

  const total = score.content + score.publish + score.index_bing + score.index_google + score.social + score.monitor;
  log('info', `\n🏆 ציון סופי: ${total}/100`);
  log('info', `   תוכן:${score.content} | פרסום:${score.publish} | Bing:${score.index_bing} | Google:${score.index_google} | סושיאל:${score.social} | ניטור:${score.monitor}`);
  log('score', String(total));

  return { score: total, breakdown: score, topic: topic.title, date };
}

module.exports = { runSEO };
