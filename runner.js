// ═══════════════════════════════════════════
//  SEO TASK RUNNER
// ═══════════════════════════════════════════
const { execSync } = require('child_process');

const TOPICS = [
  { title: 'מסכי LED לחנויות קמעונאיות — המדריך המלא', keyword: 'מסכי LED לחנויות' },
  { title: '5 סיבות למה כל מסעדה צריכה שילוט דיגיטלי', keyword: 'שילוט דיגיטלי למסעדות' },
  { title: 'מסכי LED חיצוניים — כל מה שצריך לדעת', keyword: 'מסכי LED חיצוניים' },
  { title: 'מערכת ניהול תוכן למסכים — איך זה עובד?', keyword: 'ניהול תוכן מסכים' },
  { title: 'מסכי לובי — חוויית כניסה שתרשים כל מבקר', keyword: 'מסכי LED לובי' },
  { title: 'מסכי בריכה עמידים לחוץ — המדריך לבחירה', keyword: 'מסכי LED לבריכה' },
  { title: 'כמה עולה מסך LED לעסק? מחיר, גדלים ואפשרויות', keyword: 'מסכי LED לעסקים' },
];

async function runSEO(site, log, apiKey) {
  const score = { content: 0, publish: 0, index_bing: 0, index_google: 0 };
  const date = new Date().toISOString().split('T')[0];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const topic = TOPICS[dayOfYear % TOPICS.length];

  // ── שלב 1: ייצור תוכן ──────────────────────
  log('info', `📝 מייצר מאמר SEO: "${topic.title}"`);
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
          max_tokens: 1800,
          messages: [{ role: 'user', content: `כתוב מאמר SEO 600 מילים בעברית בנושא: "${topic.title}" מילת מפתח: "${topic.keyword}". כותרת H1, 3 כותרות H2, 2 שאלות FAQ בסוף. HTML בלבד.` }]
        })
      });
      const data = await res.json();
      articleHtml = data.content?.[0]?.text || '';
      score.content = 25;
      log('success', `✅ תוכן נוצר (${articleHtml.length} תווים)`);
    } catch(e) {
      log('error', `❌ שגיאה ביצירת תוכן: ${e.message}`);
    }
  } else {
    log('warn', `⚠️ אין API Key — מדלג על ייצור תוכן`);
  }

  // ── שלב 2: שמירה + Git Push ─────────────────
  if (site.dir && articleHtml) {
    try {
      const fs = require('fs');
      const path = require('path');
      const blogDir = path.join(site.dir, 'blog');
      if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });
      const slug = topic.title.replace(/[^א-תa-zA-Z0-9]/g,'-').replace(/-+/g,'-').slice(0,50);
      const filePath = path.join(blogDir, `${slug}.html`);
      const fullHtml = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"/><title>${topic.title}</title><meta name="description" content="${topic.keyword} — מידע מקצועי."/></head><body style="font-family:sans-serif;direction:rtl;max-width:800px;margin:auto;padding:20px">${articleHtml}<p>פורסם: ${date}</p></body></html>`;
      fs.writeFileSync(filePath, fullHtml, 'utf8');
      log('info', `💾 נשמר: blog/${slug}.html`);

      // git push
      log('info', `🚀 מעלה ל-GitHub...`);
      execSync('git add -A && git commit -m "seo: daily article" && git push origin main', { cwd: site.dir, encoding: 'utf8' });
      score.publish = 25;
      log('success', `✅ פורסם ל-GitHub Pages`);
    } catch(e) {
      log('error', `❌ שגיאה בפרסום: ${e.message.slice(0,120)}`);
    }
  }

  // ── שלב 3: Bing IndexNow ────────────────────
  log('info', `🔍 שולח לאינדוקס Bing...`);
  try {
    const res = await fetch(`https://api.indexnow.org/indexnow?url=${encodeURIComponent(site.url)}&key=pixel2024seo`);
    score.index_bing = res.status < 400 ? 25 : 10;
    log('success', `✅ Bing IndexNow: ${res.status}`);
  } catch(e) {
    log('error', `❌ Bing: ${e.message}`);
  }

  // ── שלב 4: Google Sitemap Ping ──────────────
  log('info', `🔍 שולח Sitemap לגוגל...`);
  try {
    const res = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(site.url + '/sitemap.xml')}`);
    score.index_google = res.status < 400 ? 25 : 10;
    log('success', `✅ Google Sitemap ping: ${res.status}`);
  } catch(e) {
    log('error', `❌ Google: ${e.message}`);
  }

  const total = score.content + score.publish + score.index_bing + score.index_google;
  log('info', `\n🏆 ציון סופי: ${total}/100`);
  log('score', String(total));

  return { score: total, breakdown: score, topic: topic.title, date };
}

module.exports = { runSEO };
