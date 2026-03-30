// ═══════════════════════════════════════════
//  SEO MONITOR — PageSpeed + Rankings
// ═══════════════════════════════════════════
const cfg = require('./config');
const fs  = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'data/monitor-history.json');

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
}
function saveHistory(h) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(h.slice(0, 90), null, 2));
}

// ── PageSpeed Insights ───────────────────
async function checkPageSpeed(log) {
  const url = cfg.site.url;
  log('info', `⚡ בודק מהירות אתר (PageSpeed Insights)...`);

  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${cfg.googlePageSpeedKey || ''}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
    const data = await res.json();

    if (data.error) { log('warn', `⚠️ PageSpeed API: ${data.error.message}`); return null; }

    const cats = data.lighthouseResult?.categories || {};
    const scores = {
      performance:   Math.round((cats.performance?.score || 0) * 100),
      seo:           Math.round((cats.seo?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
    };

    log('success', `✅ PageSpeed Mobile — ביצועים: ${scores.performance}/100 | SEO: ${scores.seo}/100`);
    log('info',    `   נגישות: ${scores.accessibility}/100 | Best Practices: ${scores.bestPractices}/100`);

    // התרעה אם ביצועים נפלו
    const hist = loadHistory();
    const lastScore = hist[0]?.performance;
    if (lastScore && scores.performance < lastScore - 10) {
      log('warn', `⚠️ ביצועים ירדו! ${lastScore} → ${scores.performance}`);
    }

    // שמירת היסטוריה
    hist.unshift({ date: new Date().toISOString().split('T')[0], ...scores });
    saveHistory(hist);

    return scores;
  } catch(e) {
    log('warn', `⚠️ PageSpeed שגיאה: ${e.message}`);
    return null;
  }
}

// ── Uptime Check ─────────────────────────
async function checkUptime(log) {
  log('info', `🌐 בודק זמינות אתר...`);
  const pages = cfg.pages.map(p => cfg.site.url + p);

  for (const pageUrl of pages) {
    try {
      const start = Date.now();
      const res = await fetch(pageUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      const ms = Date.now() - start;
      if (res.ok) log('success', `✅ ${pageUrl.replace(cfg.site.url,'')||'/'} — ${res.status} (${ms}ms)`);
      else log('error', `❌ ${pageUrl.replace(cfg.site.url,'')||'/'} — ${res.status}`);
    } catch(e) {
      log('error', `❌ ${pageUrl.replace(cfg.site.url,'')||'/'} — לא נגיש: ${e.message}`);
    }
  }
}

// ── Rank Check via Google Search ─────────
async function checkRankings(log) {
  log('info', `📊 בודק דירוגים ב-Google Search Console...`);

  if (!cfg.googleSearchConsoleKey) {
    log('warn', `⚠️ Google Search Console API לא מוגדר — מדלג`);
    log('info', `   להגדרה: הוסף googleSearchConsoleKey ב-config.js`);
    return;
  }

  // GSC API call would go here when key is set
  log('info', `   בדוק דירוגים ב: https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(cfg.site.url)}`);
}

module.exports = { checkPageSpeed, checkUptime, checkRankings };
