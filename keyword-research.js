// ═══════════════════════════════════════════
//  DAILY KEYWORD RESEARCH
//  סורק מתחרים יומית → מוצא ביטויים חדשים → מחזיר לרנר
// ═══════════════════════════════════════════
const fs   = require('fs');
const path = require('path');

// רשימת מתחרים לסריקה (rotating — כל יום אחר)
const COMPETITORS = [
  'https://www.digitalled.co.il/',
  'https://uptv.co.il/',
  'https://be2beat.com/lp/lp-2/',
  'https://www.nirtech.co.il/34917-%D7%9E%D7%A1%D7%9B%D7%99%D7%9D-%D7%9E%D7%A7%D7%A6%D7%95%D7%A2%D7%99%D7%99%D7%9D',
  'https://copysahar.co.il/product-category/%D7%9E%D7%A1%D7%9B%D7%99-%D7%9E%D7%92%D7%A2-%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%90%D7%A7%D7%98%D7%99%D7%91%D7%99%D7%99%D7%9D-%D7%9E%D7%A1%D7%9B%D7%99%D7%9D-%D7%9E%D7%A7%D7%A6%D7%95%D7%A2%D7%99%D7%99/%D7%9E%D7%A1%D7%9B%D7%99%D7%9D-%D7%9E%D7%A7%D7%A6%D7%95%D7%A2%D7%99%D7%99%D7%9D-%D7%9C%D7%AA%D7%A6%D7%95%D7%92%D7%94-24-7/',
  'https://www.generalltd.co.il/%D7%9E%D7%A1%D7%9B%D7%99%D7%9D/%D7%9E%D7%A1%D7%9B%D7%99%D7%9D-%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%90%D7%A7%D7%98%D7%99%D7%91%D7%99%D7%99%D7%9D',
  'https://www.samsung.com/il/business/displays/',
];

// מאגר מילות מפתח ידועות — לא להוסיף כפילויות
const KNOWN_LOG = path.join(__dirname, 'data', 'known-keywords.json');

function loadKnown() {
  try { return new Set(JSON.parse(fs.readFileSync(KNOWN_LOG, 'utf8'))); }
  catch { return new Set(); }
}

function saveKnown(set) {
  if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
  fs.writeFileSync(KNOWN_LOG, JSON.stringify([...set], null, 2));
}

// חלץ מילות מפתח מ-HTML גולמי
function extractKeywords(html, url) {
  const found = new Set();

  // Title
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleM) titleM[1].split(/[|–—-]/).forEach(p => p.trim().length > 4 && found.add(p.trim()));

  // Meta keywords + description
  const metaKw = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)/i);
  if (metaKw) metaKw[1].split(',').map(k => k.trim()).filter(k => k.length > 4).forEach(k => found.add(k));

  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
  if (metaDesc) {
    metaDesc[1].split(/[,.|–—]/).map(p => p.trim()).filter(p => p.length > 6 && p.length < 50).forEach(p => found.add(p));
  }

  // H1/H2/H3
  const hMatches = html.matchAll(/<h[123][^>]*>([^<]+)<\/h[123]>/gi);
  for (const m of hMatches) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 5 && text.length < 60) found.add(text);
  }

  // סינון — רק עברית + ביטויים עם "מסך" / "LED" / "שילוט" / "תצוגה" / "שלט"
  const relevant = [...found].filter(kw => {
    const hasHebrew = /[א-ת]/.test(kw);
    const isRelevant = /מסך|LED|שילוט|תצוגה|שלט|פרסום|ניהול|digital|signage/i.test(kw);
    return hasHebrew && isRelevant;
  });

  return relevant;
}

async function researchCompetitor(url, log) {
  try {
    log('info', `🔍 סורק מתחרה: ${new URL(url).hostname}`);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) { log('warn', `⚠️ ${url}: ${res.status}`); return []; }
    const html = await res.text();
    const keywords = extractKeywords(html, url);
    log('success', `✅ ${new URL(url).hostname}: ${keywords.length} ביטויים נמצאו`);
    return keywords;
  } catch(e) {
    log('warn', `⚠️ ${url}: ${e.message.slice(0, 60)}`);
    return [];
  }
}

async function runDailyResearch(log) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const competitor = COMPETITORS[dayOfYear % COMPETITORS.length];

  const known = loadKnown();
  const found = await researchCompetitor(competitor, log);

  const newKeywords = found.filter(kw => !known.has(kw));

  if (newKeywords.length) {
    newKeywords.forEach(kw => known.add(kw));
    saveKnown(known);
    log('success', `🆕 ${newKeywords.length} מילות מפתח חדשות: ${newKeywords.slice(0, 5).join(', ')}...`);
  } else {
    log('info', `ℹ️ אין מילות מפתח חדשות היום`);
  }

  return { competitor, found: found.length, newKeywords };
}

module.exports = { runDailyResearch };
