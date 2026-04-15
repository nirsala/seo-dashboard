// ═══════════════════════════════════════════
//  SITES MANAGER — ניהול מרובה אתרים
//  כל אתר עם tokens, keywords ו-repo משלו
// ═══════════════════════════════════════════
const fs   = require('fs');
const path = require('path');

const SITES_FILE = path.join(__dirname, 'data', 'sites.json');

// ── Load / Save ──────────────────────────────
function loadSites() {
  try {
    const raw = fs.readFileSync(SITES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    // תמיכה בשני פורמטים: { sites: [] } ו-[]
    return Array.isArray(parsed) ? parsed : (parsed.sites || []);
  } catch {
    return [];
  }
}

function saveSites(sites) {
  const dir = path.dirname(SITES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SITES_FILE, JSON.stringify({ sites }, null, 2));
}

// ── Token resolution per site ─────────────────
// כל אתר מקבל prefix ב-env vars, למשל:
//   XVISION_FB_PAGE_TOKEN, DDS_FB_PAGE_TOKEN
// fallback למשתנים הגלובליים עבור xvision (backward compat)
function getSiteTokens(site) {
  // עדיפות: 1. tokens שמורים ב-DB (הוזנו דרך UI)
  //          2. env vars עם prefix (XVISION_, DDS_)
  //          3. env vars גלובליים (backward compat)
  const t = site.tokens || {};
  const p = (site.envPrefix || site.id || 'XVISION').toUpperCase();
  const env = process.env;

  const get = (dbKey, envKey, globalFallback) =>
    t[dbKey] || env[`${p}_${envKey}`] || (globalFallback ? env[globalFallback] : '') || '';

  return {
    // GitHub
    githubToken:       get('githubToken',       'GITHUB_TOKEN',        'GITHUB_TOKEN'),
    githubRepo:        t.githubRepo || env[`${p}_GITHUB_REPO`] || site.githubRepo || env.GITHUB_REPO || '',
    githubBranch:      t.githubBranch || env[`${p}_GITHUB_BRANCH`] || env.GITHUB_BRANCH || 'main',

    // Facebook
    facebookPageToken: get('facebookPageToken', 'FB_PAGE_TOKEN',       'FACEBOOK_PAGE_TOKEN'),
    facebookPageId:    get('facebookPageId',    'FB_PAGE_ID',          'FACEBOOK_PAGE_ID'),

    // LinkedIn
    linkedinToken:     get('linkedinToken',     'LINKEDIN_TOKEN',      'LINKEDIN_ACCESS_TOKEN'),
    linkedinCompanyId: get('linkedinCompanyId', 'LINKEDIN_COMPANY_ID', 'LINKEDIN_COMPANY_ID'),

    // Instagram (future)
    instagramToken:    get('instagramToken',    'INSTAGRAM_TOKEN',     ''),

    // Google Business (future)
    googleBizToken:    get('googleBizToken',    'GOOGLE_BIZ_TOKEN',    'GOOGLE_BUSINESS_TOKEN'),
    googleBizLocation: get('googleBizLocation', 'GOOGLE_BIZ_LOC',      'GOOGLE_BUSINESS_LOCATION_ID'),
  };
}

// ── Default site configs ──────────────────────
function getDefaultSites() {
  return [
    {
      id: 'xvision',
      name: 'Pixel by Keshet — מסכי LED',
      siteUrl: 'https://xvision.co.il',
      githubRepo: 'nirsala/xvision-website',
      companyName: 'Pixel by Keshet',
      envPrefix: 'XVISION',
      active: true,
      schedule: '0 8 * * *',
      keywords: [
        'מסכי LED לחנויות', 'שילוט דיגיטלי למסעדות', 'מסכי LED חיצוניים',
        'CMS למסכי LED', 'מסכי LED לובי', 'מסכי LED לבריכה',
        'מסכי LED מלונות', 'שילוט דיגיטלי רשתות', 'מסכי LED תל אביב',
        'מסכי LED ירושלים', 'מסכי LED חיפה', 'תחזוקת מסכי LED',
        'השוואת מסכי LED', 'שלטי חוצות דיגיטליים', 'מסכי LED חינוך',
        'שילוט דיגיטלי בנקים', 'מסכי LED ספורט', 'מסכי LED חדר כושר',
        'שילוט דיגיטלי בריאות', 'מסכי LED אירועים', 'תצוגות ויטרינה LED',
        'מסכי LED פתח תקווה', 'מסכי LED רמת גן', 'היתר שלט חוצות',
        'IP65 מסכי LED', 'pixel pitch LED', 'מסכי LED סופרמרקט',
        'שלטים דיגיטליים לעסקים', 'תפריט דיגיטלי למסעדה', 'מסכי LED למלונות',
        'מסכי LED לאולמות אירועים', 'שילוט דיגיטלי לקניונים',
        'מסכי LED לחדרי כושר', 'מסכי LED לסופרמרקט', 'מסכי LED לתחנות דלק',
        'מסכי LED לקליניקות', 'שלטי חוצות LED ישראל',
      ],
      internalLinks: [
        { href: '/products.html', text: 'קטלוג המוצרים שלנו' },
        { href: '/pool.html',     text: 'מסכי LED לבריכה' },
        { href: '/cms.html',      text: 'מערכת ניהול תוכן' },
        { href: '/#contact',      text: 'קבל הצעת מחיר' },
      ],
      lastRun: null,
      lastScore: 0,
    },
    {
      id: 'dds',
      name: 'DDS — מערכת ניהול תוכן למסכים',
      siteUrl: 'https://dds.xvision.co.il',
      githubRepo: '',           // ימולא על ידי המשתמש
      companyName: 'Xvision DDS',
      envPrefix: 'DDS',
      active: false,            // יופעל אחרי הגדרת repo
      schedule: '0 9 * * *',
      keywords: [
        'מערכת ניהול תוכן למסכים', 'Digital Signage CMS', 'תוכנה לניהול מסכי LED',
        'פתרון CMS לשילוט דיגיטלי', 'ניהול תוכן מסכים מרחוק', 'CMS ענן למסכים',
        'עדכון תוכן מסך מרחוק', 'לוח זמנים דיגיטלי למסכים', 'תוכנת שידור מסכי LED',
        'ניהול רשת מסכים', 'CMS לרשתות חנויות', 'מערכת שידור לשלטים דיגיטליים',
        'ממשק ניהול מסכים', 'CMS לבתי מלון', 'תוכנת CMS לרשת מסכות',
        'Digital Signage Software ישראל', 'מערכת ניהול פרסום מסכים',
        'CMS למסכי LED מסעדות', 'ניהול קמפיינים דיגיטליים למסכים',
        'פלטפורמת Digital Signage ישראל',
      ],
      internalLinks: [
        { href: '/#features', text: 'תכונות המערכת' },
        { href: '/#pricing',  text: 'תוכניות מחיר' },
        { href: '/#contact',  text: 'צור קשר' },
        { href: '/#demo',     text: 'בקש דמו' },
      ],
      lastRun: null,
      lastScore: 0,
    },
  ];
}

// ── Initialize — מיזוג מה שיש עם ברירת המחדל ──
function initSites() {
  const existing = loadSites();

  // אם אין קבצי sites.json מהדש או הוא ריק, הגדר ברירת מחדל
  if (!existing || existing.length === 0) {
    const defaults = getDefaultSites();
    saveSites(defaults);
    return defaults;
  }

  // מזג sites קיימים עם הגדרות חסרות
  const defaults = getDefaultSites();
  let changed = false;
  for (const def of defaults) {
    const found = existing.find(s => s.id === def.id);
    if (!found) {
      existing.push(def);
      changed = true;
    } else {
      // הוסף שדות חסרים
      for (const key of ['envPrefix', 'keywords', 'internalLinks', 'companyName', 'siteUrl']) {
        if (!found[key] && def[key]) { found[key] = def[key]; changed = true; }
      }
    }
  }
  if (changed) saveSites(existing);
  return existing;
}

module.exports = { loadSites, saveSites, getSiteTokens, initSites, getDefaultSites };
