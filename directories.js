// ═══════════════════════════════════════════
//  DIRECTORY SUBMISSION PINGER
//  ישראלי + בינלאומי
// ═══════════════════════════════════════════
const cfg = require('./config');

const DIRECTORIES = [
  // ── Israeli ─────────────────────────────
  { name: 'Zap Business', url: 'https://www.zap.co.il/search.aspx?keyword=xvision', ping: true },
  { name: 'B144', url: 'https://www.b144.co.il/', ping: false, manual: 'https://www.b144.co.il/AddBusiness' },
  { name: 'CheckID', url: 'https://en.checkid.co.il/', ping: false, manual: 'https://en.checkid.co.il/add-business' },
  { name: 'IsraeliYP', url: 'https://www.israeliyp.com/', ping: false, manual: 'https://www.israeliyp.com/add-listing' },
  { name: 'Snap Israel', url: 'https://snapisrael.com/', ping: false, manual: 'https://snapisrael.com/add' },
  // ── International ────────────────────────
  { name: 'Hotfrog', url: 'https://www.hotfrog.com/', ping: false, manual: 'https://www.hotfrog.com/AddBusiness.aspx' },
  { name: 'Cylex', url: 'https://www.cylex.us.com/', ping: false, manual: 'https://www.cylex.us.com/register' },
  { name: 'EZlocal', url: 'https://www.ezlocal.com/', ping: false, manual: 'https://www.ezlocal.com/addlisting.aspx' },
  { name: 'Foursquare', url: 'https://foursquare.com/', ping: false, manual: 'https://foursquare.com/add-place' },
];

// ping search engine update notification URLs
const PING_URLS = [
  // IndexNow — Bing (פרוטוקול תקני, עובד)
  `https://www.bing.com/indexnow?url=${encodeURIComponent(cfg.site.url)}&key=pixel2024seo`,
  // Yandex IndexNow
  `https://yandex.com/indexnow?url=${encodeURIComponent(cfg.site.url)}&key=pixel2024seo`,
  // Seznam IndexNow (הצטרפו לפרוטוקול IndexNow)
  `https://api.indexnow.org/indexnow?url=${encodeURIComponent(cfg.site.url)}&key=pixel2024seo`,
];

async function pingDirectories(log) {
  log('info', `📋 שולח ping ל-${PING_URLS.length} מנועי חיפוש + ${DIRECTORIES.length} דירקטוריות...`);

  let success = 0;

  // Ping search engines
  for (const url of PING_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.status < 400) { success++; log('success', `✅ Ping: ${new URL(url).hostname}`); }
      else log('warn', `⚠️ ${new URL(url).hostname}: ${res.status}`);
    } catch(e) {
      log('warn', `⚠️ ${url.slice(0,40)}: ${e.message.slice(0,50)}`);
    }
  }

  // Manual directories to register (list for user)
  const manualDirs = DIRECTORIES.filter(d => !d.ping && d.manual);
  if (manualDirs.length) {
    log('info', `📌 דירקטוריות לרישום ידני (חד-פעמי):`);
    manualDirs.forEach(d => log('info', `   ${d.name}: ${d.manual}`));
  }

  return { success, total: PING_URLS.length };
}

module.exports = { pingDirectories, DIRECTORIES };
