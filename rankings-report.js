// ═══════════════════════════════════════════
//  DAILY RANKINGS REPORT
//  דוח יומי מיקומים בגוגל ישראל
//  מקור: Google Search Console API (Service Account)
// ═══════════════════════════════════════════
const cfg    = require('./config');
const crypto = require('crypto');

const SITE_URL     = cfg.site.url || 'https://xvision.co.il';
const RESEND_KEY   = process.env.RESEND_API_KEY   || '';
const REPORT_EMAIL = process.env.REPORT_EMAIL     || 'nirsala@gmail.com';

// GOOGLE_SERVICE_ACCOUNT_JSON = תוכן קובץ ה-JSON של Service Account
function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// JWT + OAuth2 לאימות מול Google API
function buildJwt(sa) {
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64url');
  return `${header}.${payload}.${sig}`;
}

async function getAccessToken(sa) {
  const jwt = buildJwt(sa);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth: ${JSON.stringify(data)}`);
  return data.access_token;
}

// מילות מפתח לניטור
const TRACKED_KEYWORDS = [
  'מסכי LED לחנויות',
  'שילוט דיגיטלי למסעדות',
  'מסכי LED חיצוניים',
  'מסכי LED לובי',
  'מסכי LED לבריכה',
  'מחיר מסך LED לעסק',
  'מסכי LED מלונות',
  'שלטי חוצות דיגיטליים',
  'מסכי LED ספורט',
  'מסכי LED חדר כושר',
  'תצוגות ויטרינה LED',
  'מסכי LED סופרמרקט',
  'שילוט דיגיטלי',
  'מסכי LED לעסקים',
  'LED ישראל',
];

async function fetchSearchConsoleData(startDate, endDate) {
  const sa = getServiceAccount();
  if (!sa) return null;

  let token;
  try { token = await getAccessToken(sa); } catch(e) { return { error: e.message }; }

  const siteEncoded = encodeURIComponent(SITE_URL);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${siteEncoded}/searchAnalytics/query`;

  const body = {
    startDate, endDate,
    dimensions: ['query', 'country'],
    dimensionFilterGroups: [{ filters: [{ dimension: 'country', operator: 'equals', expression: 'isr' }] }],
    rowLimit: 100, startRow: 0,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const err = await res.text(); return { error: `GSC API: ${res.status} — ${err.slice(0, 200)}` }; }
    return await res.json();
  } catch(e) { return { error: e.message }; }
}

function buildReportHtml(rows, date, prevRows) {
  const prevMap = {};
  if (prevRows) prevRows.forEach(r => { prevMap[r.keys[0]] = r.position; });

  // מיון לפי מיקום
  const sorted = [...rows].sort((a, b) => a.position - b.position);

  // סנן רק מילות מפתח רלוונטיות + כל top 20
  const relevant = sorted.filter(r =>
    TRACKED_KEYWORDS.some(kw => r.keys[0].includes(kw)) || r.position <= 20
  );

  const rows_html = relevant.map(r => {
    const kw = r.keys[0];
    const pos = Math.round(r.position * 10) / 10;
    const prev = prevMap[kw];
    let trend = '';
    let trendColor = '#888';
    if (prev) {
      const diff = prev - pos; // חיובי = עלייה
      if (diff > 0.5)       { trend = `▲ ${diff.toFixed(1)}`; trendColor = '#10b981'; }
      else if (diff < -0.5) { trend = `▼ ${Math.abs(diff).toFixed(1)}`; trendColor = '#ef4444'; }
      else                  { trend = '—'; trendColor = '#888'; }
    }
    const posColor = pos <= 3 ? '#10b981' : pos <= 10 ? '#f59e0b' : '#ef4444';
    const isTracked = TRACKED_KEYWORDS.some(kw2 => kw.includes(kw2));

    return `<tr style="background:${isTracked ? 'rgba(215,29,67,.06)' : 'transparent'}">
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px">${kw}</td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center;font-weight:800;font-size:15px;color:${posColor}">${pos}</td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center;font-size:13px;color:${trendColor}">${trend}</td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center;font-size:12px;color:#888">${r.clicks || 0}</td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center;font-size:12px;color:#888">${r.impressions || 0}</td>
    </tr>`;
  }).join('');

  const top3 = sorted.filter(r => r.position <= 3).length;
  const top10 = sorted.filter(r => r.position <= 10).length;
  const totalClicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions || 0), 0);

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/><title>דוח מיקומים ${date}</title></head>
<body style="font-family:'Segoe UI',sans-serif;background:#0d1220;color:#f0f4ff;margin:0;padding:24px;direction:rtl">
  <div style="max-width:800px;margin:0 auto">
    <div style="background:#161f30;border-radius:12px;padding:28px;margin-bottom:20px;border:1px solid rgba(255,255,255,.07)">
      <h1 style="font-size:22px;font-weight:900;margin-bottom:4px">📊 דוח מיקומים יומי</h1>
      <p style="color:rgba(255,255,255,.5);font-size:14px;margin:0">${SITE_URL} &nbsp;|&nbsp; ${date} &nbsp;|&nbsp; גוגל ישראל</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      ${[
        ['🥇 Top 3', top3, '#10b981'],
        ['📍 Top 10', top10, '#f59e0b'],
        ['👆 קליקים', totalClicks, '#3b82f6'],
        ['👁️ חשיפות', totalImpressions, '#8b5cf6'],
      ].map(([label, val, color]) => `
        <div style="background:#161f30;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:6px">${label}</div>
          <div style="font-size:26px;font-weight:900;color:${color}">${val.toLocaleString()}</div>
        </div>`).join('')}
    </div>

    <div style="background:#161f30;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:rgba(255,255,255,.04)">
            <th style="padding:12px;text-align:right;font-size:11px;color:rgba(255,255,255,.4);letter-spacing:1px;font-weight:600">מילת מפתח</th>
            <th style="padding:12px;text-align:center;font-size:11px;color:rgba(255,255,255,.4);letter-spacing:1px;font-weight:600">מיקום</th>
            <th style="padding:12px;text-align:center;font-size:11px;color:rgba(255,255,255,.4);letter-spacing:1px;font-weight:600">שינוי</th>
            <th style="padding:12px;text-align:center;font-size:11px;color:rgba(255,255,255,.4);letter-spacing:1px;font-weight:600">קליקים</th>
            <th style="padding:12px;text-align:center;font-size:11px;color:rgba(255,255,255,.4);letter-spacing:1px;font-weight:600">חשיפות</th>
          </tr>
        </thead>
        <tbody>${rows_html}</tbody>
      </table>
    </div>
    <p style="text-align:center;font-size:12px;color:rgba(255,255,255,.3);margin-top:16px">
      נשלח אוטומטית ע"י SEO Dashboard &nbsp;|&nbsp; ${SITE_URL}
    </p>
  </div>
</body></html>`;
}

async function sendReportEmail(html, date) {
  if (!RESEND_KEY) return { skipped: true, reason: 'אין RESEND_API_KEY' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'SEO Dashboard <onboarding@resend.dev>',
      to: [REPORT_EMAIL],
      subject: `📊 דוח מיקומים ${date} — ${SITE_URL}`,
      html,
    })
  });
  const data = await res.json();
  if (res.ok) return { ok: true, id: data.id };
  return { ok: false, error: JSON.stringify(data) };
}

async function generateDailyReport(log) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const prev7 = new Date(today - 7 * 86400000).toISOString().split('T')[0];
  const prev14 = new Date(today - 14 * 86400000).toISOString().split('T')[0];

  if (!getServiceAccount()) {
    log('warn', `⚠️ דוח מיקומים: הוסף GOOGLE_SERVICE_ACCOUNT_JSON ב-Render`);
    return { skipped: true };
  }

  log('info', `📊 מייצר דוח מיקומים גוגל ישראל...`);

  // נתוני 7 ימים אחרונים
  const current = await fetchSearchConsoleData(prev7, dateStr);
  if (current?.error) {
    log('error', `❌ GSC: ${current.error}`);
    return { ok: false };
  }

  const rows = current?.rows || [];
  if (rows.length === 0) {
    log('warn', `⚠️ GSC: אין נתונים עדיין (ייתכן שהאתר לא מחובר ל-Search Console)`);
    return { skipped: true };
  }

  // נתוני 7-14 ימים קודמים (לשינוי מיקום)
  const prev = await fetchSearchConsoleData(prev14, prev7);
  const prevRows = prev?.rows || [];

  log('success', `✅ נמצאו ${rows.length} מילות מפתח`);

  // top 10
  const top10 = [...rows].sort((a, b) => a.position - b.position).slice(0, 10);
  top10.forEach(r => {
    const pos = Math.round(r.position * 10) / 10;
    const icon = pos <= 3 ? '🥇' : pos <= 10 ? '📍' : '📌';
    log('info', `   ${icon} מיקום ${pos}: "${r.keys[0]}" (${r.clicks || 0} קליקים)`);
  });

  const html = buildReportHtml(rows, dateStr, prevRows);
  const emailResult = await sendReportEmail(html, dateStr);

  if (emailResult.skipped) {
    log('warn', `⚠️ דוח מיקומים נוצר אבל לא נשלח — הוסף RESEND_API_KEY + REPORT_EMAIL`);
  } else if (emailResult.ok) {
    log('success', `✅ דוח מיקומים נשלח ל-${REPORT_EMAIL}`);
  } else {
    log('error', `❌ שליחת דוח: ${emailResult.error}`);
  }

  return { ok: true, rows: rows.length, html };
}

module.exports = { generateDailyReport };
