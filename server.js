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

const DATA_FILE = path.join(__dirname, 'data', 'sites.json');
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
  if (req.body.apiKey      !== undefined) apiKey      = req.body.apiKey;
  if (req.body.githubToken !== undefined) githubToken = req.body.githubToken;
  if (req.body.githubRepo  !== undefined) githubRepo  = req.body.githubRepo;
  if (req.body.ayrshareKey !== undefined) ayrshareKey = req.body.ayrshareKey;
  syncEnv();
  res.json({ ok: true });
});
app.get('/api/settings', (req, res) => res.json({
  apiKey:      apiKey      ? '••••' + apiKey.slice(-4)      : '',
  githubToken: githubToken ? '••••' + githubToken.slice(-4) : '',
  githubRepo,
  ayrshareKey: ayrshareKey ? '••••' + ayrshareKey.slice(-4) : ''
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

// ── SEO Runner ───────────────────────────────
async function triggerRun(site) {
  const runId = uuid().slice(0,8);
  broadcast({ type: 'run_start', siteId: site.id, siteName: site.name, runId });

  const log = (level, message) => {
    broadcast({ type: 'log', siteId: site.id, runId, level, message, ts: new Date().toLocaleTimeString('he-IL') });
  };

  try {
    const result = await runSEO(site, log, apiKey);
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
});
