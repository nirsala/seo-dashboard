// ═══════════════════════════════════════════
//  SEO DASHBOARD SERVER
//  Express + WebSocket + node-cron
// ═══════════════════════════════════════════
const express  = require('express');
const { WebSocketServer } = require('ws');
const cron     = require('node-cron');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const { v4: uuid } = require('uuid');
const { runSEO } = require('./runner');
const { getSiteTokens, initSites } = require('./sites-manager');

const DATA_FILE = path.join(__dirname, 'data', 'sites.json');
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'pixel2024';
const validTokens = new Set();
// צור קובץ אם לא קיים
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{"sites":[]}');
const PORT = process.env.PORT || 5555;

// ── State ────────────────────────────────────
let sites = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).sites || [];
let cronJobs = {};   // siteId → cron task
let apiKey       = process.env.ANTHROPIC_API_KEY || '';
let githubToken  = process.env.GITHUB_TOKEN      || '';
let githubRepo   = process.env.GITHUB_REPO       || 'nirsala/xvision-website';
let ayrshareKey  = process.env.AYRSHARE_API_KEY  || '';
let resendKey    = process.env.RESEND_API_KEY    || '';
const REPORT_EMAIL = process.env.REPORT_EMAIL || 'nirsala@gmail.com';

// הזרק לסביבה כך ש-github-publisher ו-social יוכלו לקרוא
function syncEnv() {
  if (githubToken) process.env.GITHUB_TOKEN = githubToken;
  if (githubRepo)  process.env.GITHUB_REPO  = githubRepo;
  if (ayrshareKey) process.env.AYRSHARE_API_KEY = ayrshareKey;
}
syncEnv();

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ sites }, null, 2));
}

// ── Express ──────────────────────────────────
const app = express();
app.use(express.json());

// ── Auth ─────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  if (req.body.password === DASHBOARD_PASSWORD) {
    const token = uuid();
    validTokens.add(token);
    return res.json({ ok: true, token });
  }
  res.status(401).json({ ok: false, error: 'סיסמא שגויה' });
});

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (validTokens.has(token)) return next();
  res.status(401).json({ error: 'לא מורשה' });
}

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  requireAuth(req, res, next);
});

app.use(express.static(path.join(__dirname, 'public')));

// GET sites
app.get('/api/sites', (req, res) => res.json(sites));

// POST add site
app.post('/api/sites', (req, res) => {
  const { name, url, dir, schedule, keywords } = req.body;
  if (!url) return res.status(400).json({ error: 'url נדרש' });
  const site = { id: uuid(), name: name || url, url, dir: dir || '', schedule: schedule || '0 8 * * *', keywords: keywords || [], history: [], active: true };
  sites.push(site);
  save();
  scheduleSite(site);
  res.json(site);
});

// PUT update site
app.put('/api/sites/:id', (req, res) => {
  const idx = sites.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'לא נמצא' });
  sites[idx] = { ...sites[idx], ...req.body };
  save();
  if (cronJobs[req.params.id]) { cronJobs[req.params.id].stop(); delete cronJobs[req.params.id]; }
  scheduleSite(sites[idx]);
  res.json(sites[idx]);
});

// DELETE site
app.delete('/api/sites/:id', (req, res) => {
  if (cronJobs[req.params.id]) { cronJobs[req.params.id].stop(); delete cronJobs[req.params.id]; }
  sites = sites.filter(s => s.id !== req.params.id);
  save();
  res.json({ ok: true });
});

// POST run now
app.post('/api/sites/:id/run', async (req, res) => {
  const site = sites.find(s => s.id === req.params.id);
  if (!site) return res.status(404).json({ error: 'לא נמצא' });
  res.json({ ok: true, message: 'מריץ...' });
  triggerRun(site);
});

// PUT settings
app.put('/api/settings', (req, res) => {
  if (req.body.apiKey            !== undefined) { apiKey      = req.body.apiKey;      process.env.ANTHROPIC_API_KEY = apiKey; }
  if (req.body.githubToken       !== undefined) { githubToken = req.body.githubToken; }
  if (req.body.githubRepo        !== undefined) { githubRepo  = req.body.githubRepo;  }
  if (req.body.ayrshareKey       !== undefined) { ayrshareKey = req.body.ayrshareKey; }
  if (req.body.resendKey         !== undefined) { resendKey   = req.body.resendKey;   process.env.RESEND_API_KEY = resendKey; }
  if (req.body.reportEmail       !== undefined) { process.env.REPORT_EMAIL = req.body.reportEmail; }
  if (req.body.dashboardPassword !== undefined) { /* store in memory for session */ }
  syncEnv();
  res.json({ ok: true });
});
app.get('/api/settings', (req, res) => res.json({
  apiKey:      apiKey      ? '••••' + apiKey.slice(-4)      : '',
  githubToken: githubToken ? '••••' + githubToken.slice(-4) : '',
  githubRepo,
  ayrshareKey: ayrshareKey ? '••••' + ayrshareKey.slice(-4) : '',
  resendKey:   resendKey   ? '••••' + resendKey.slice(-4)   : '',
  reportEmail: process.env.REPORT_EMAIL || '',
}));

// ── WebSocket ────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(msg) {
  const str = JSON.stringify(msg);
  clients.forEach(c => { if (c.readyState === 1) c.send(str); });
}

// ── Email Report ─────────────────────────────
async function sendEmailReport(result, site) {
  const key = resendKey || process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[email] אין RESEND_API_KEY — מדלג על שליחת מייל');
    return;
  }

  const scoreBar = '█'.repeat(Math.floor(result.score / 10)) + '░'.repeat(10 - Math.floor(result.score / 10));
  const html = `
<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f1a;color:#e8eaf0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#d71d43,#8b0020);padding:28px 32px">
    <h1 style="margin:0;font-size:20px;color:#fff">🔍 דוח SEO יומי — Pixel by Keshet</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px">${result.date} | ${site.name}</p>
  </div>
  <div style="padding:28px 32px">
    <div style="background:#1a1a2e;border-radius:10px;padding:20px;margin-bottom:20px;text-align:center">
      <div style="font-size:48px;font-weight:900;color:${result.score >= 70 ? '#00cc66' : result.score >= 40 ? '#f59e0b' : '#d71d43'}">${result.score}<span style="font-size:20px;color:rgba(255,255,255,.4)">/100</span></div>
      <div style="font-family:monospace;color:#d71d43;font-size:18px;letter-spacing:2px;margin-top:4px">${scoreBar}</div>
      <div style="color:rgba(255,255,255,.5);font-size:12px;margin-top:6px">ציון SEO יומי</div>
    </div>
    ${result.topic ? `
    <div style="background:#1a1a2e;border-radius:10px;padding:16px 20px;margin-bottom:16px;border-right:3px solid #d71d43">
      <div style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">מאמר שפורסם</div>
      <div style="font-weight:700;color:#fff">${result.topic}</div>
    </div>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="border-bottom:1px solid rgba(255,255,255,.07)">
        <td style="padding:10px 0;color:rgba(255,255,255,.5)">📝 תוכן</td>
        <td style="padding:10px 0;text-align:left;color:#fff;font-weight:700">${result.breakdown?.content || 0}/20</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,.07)">
        <td style="padding:10px 0;color:rgba(255,255,255,.5)">🚀 פרסום GitHub</td>
        <td style="padding:10px 0;text-align:left;color:#fff;font-weight:700">${result.breakdown?.publish || 0}/20</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,.07)">
        <td style="padding:10px 0;color:rgba(255,255,255,.5)">🔍 Bing IndexNow</td>
        <td style="padding:10px 0;text-align:left;color:#fff;font-weight:700">${result.breakdown?.index_bing || 0}/15</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,.07)">
        <td style="padding:10px 0;color:rgba(255,255,255,.5)">🔎 Google Sitemap</td>
        <td style="padding:10px 0;text-align:left;color:#fff;font-weight:700">${result.breakdown?.index_google || 0}/15</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,.07)">
        <td style="padding:10px 0;color:rgba(255,255,255,.5)">📱 רשתות חברתיות</td>
        <td style="padding:10px 0;text-align:left;color:#fff;font-weight:700">${result.breakdown?.social || 0}/10</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:rgba(255,255,255,.5)">🌐 ניטור אתר</td>
        <td style="padding:10px 0;text-align:left;color:#fff;font-weight:700">${result.breakdown?.monitor || 0}/10</td>
      </tr>
    </table>
    <div style="margin-top:24px;text-align:center">
      <a href="https://xvision.co.il" style="display:inline-block;padding:11px 24px;background:#d71d43;color:#fff;border-radius:7px;text-decoration:none;font-size:13px;font-weight:700">צפה באתר ←</a>
    </div>
  </div>
  <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,.07);text-align:center;font-size:11px;color:rgba(255,255,255,.3)">
    Pixel by Keshet SEO Dashboard | xvision.co.il
  </div>
</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SEO Dashboard <onboarding@resend.dev>',
        to: [REPORT_EMAIL],
        subject: `📊 דוח SEO יומי — ציון ${result.score}/100 | ${result.date}`,
        html
      })
    });
    const data = await res.json();
    if (res.ok) console.log(`[email] ✅ דוח נשלח ל-${REPORT_EMAIL}`);
    else        console.error('[email] ❌ שגיאה:', data.message || JSON.stringify(data));
  } catch(e) {
    console.error('[email] ❌ שגיאת רשת:', e.message);
  }
}

// ── SEO Runner ───────────────────────────────
async function triggerRun(site) {
  const runId = uuid().slice(0,8);
  broadcast({ type: 'run_start', siteId: site.id, siteName: site.name, runId });

  const log = (level, message) => {
    broadcast({ type: 'log', siteId: site.id, runId, level, message, ts: new Date().toLocaleTimeString('he-IL') });
  };

  try {
    // הוסף siteUrl ו-_tokens לאובייקט לפני הריצה
    const siteWithTokens = {
      ...site,
      siteUrl: site.siteUrl || site.url,
      _tokens: getSiteTokens(site),
    };
    const result = await runSEO(siteWithTokens, log, apiKey);
    // שמירת היסטוריה
    const entry = { runId, date: result.date, score: result.score, topic: result.topic, breakdown: result.breakdown };
    const idx = sites.findIndex(s => s.id === site.id);
    if (idx !== -1) {
      sites[idx].history = [entry, ...(sites[idx].history || [])].slice(0, 30);
      sites[idx].lastScore = result.score;
      sites[idx].lastRun = result.date;
      save();
    }
    broadcast({ type: 'run_end', siteId: site.id, runId, score: result.score, topic: result.topic });

    // שליחת דוח במייל
    await sendEmailReport(result, site).catch(e => console.error('[email] שגיאה:', e.message));
  } catch(e) {
    broadcast({ type: 'log', siteId: site.id, runId, level: 'error', message: `שגיאה: ${e.message}` });
    broadcast({ type: 'run_end', siteId: site.id, runId, score: 0 });
  }
}

// ── Cron Scheduler ───────────────────────────
function scheduleSite(site) {
  if (!site.active || !site.schedule) return;
  try {
    const task = cron.schedule(site.schedule, () => triggerRun(site), { timezone: 'Asia/Jerusalem' });
    cronJobs[site.id] = task;
    console.log(`[cron] מתוזמן: ${site.name} @ ${site.schedule}`);
  } catch(e) {
    console.error(`[cron] שגיאה בתזמון ${site.name}:`, e.message);
  }
}

// טעינת כל האתרים הקיימים
sites.forEach(scheduleSite);

server.listen(PORT, () => {
  console.log(`\n🚀 SEO Dashboard רץ על http://localhost:${PORT}\n`);

  // ── Keep-alive: מונע שינה של Render Free Tier ──
  // מבצע ping לעצמו כל 10 דקות כדי שהכרון יעבוד
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SITE_DASHBOARD_URL || '';
  if (SELF_URL) {
    setInterval(() => {
      fetch(`${SELF_URL}/api/health`).catch(() => {});
    }, 10 * 60 * 1000); // כל 10 דקות
    console.log(`[keep-alive] 🔄 ping כל 10 דקות → ${SELF_URL}`);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
