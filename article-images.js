// ═══════════════════════════════════════════
//  ARTICLE IMAGES — תמונות מהאתר xvision.co.il בלבד
//  rotation: כל ריצה תמונה שונה, חוזר רק אחרי שכולן נוצלו
// ═══════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const BASE = 'https://xvision.co.il';

// כל התמונות הזמינות — שירותים + פרויקטים
const ALL_IMAGES = [
  `${BASE}/assets/images/services/svc-indoor.jpg`,
  `${BASE}/assets/images/services/svc-outdoor.jpg`,
  `${BASE}/assets/images/services/svc-cms.jpg`,
  `${BASE}/assets/images/services/svc-install.jpg`,
  `${BASE}/assets/images/services/svc-support.jpg`,
  `${BASE}/assets/images/services/svc-content.jpg`,
  `${BASE}/assets/images/hero-bg.jpg`,
  `${BASE}/assets/images/works-s01.jpg`,
  `${BASE}/assets/images/works-s02.jpg`,
  `${BASE}/assets/images/works-s03.jpg`,
  `${BASE}/assets/images/works-s04.jpg`,
  `${BASE}/assets/images/works-s05.jpg`,
  `${BASE}/assets/images/works-s06.jpg`,
  `${BASE}/assets/images/works-s07.jpg`,
  `${BASE}/assets/images/works-s08.jpg`,
  `${BASE}/assets/images/works-s09.jpg`,
  `${BASE}/assets/images/works-s10.jpg`,
  `${BASE}/assets/images/works-g01.jpg`,
  `${BASE}/assets/images/works-g02.jpg`,
  `${BASE}/assets/images/works-g03.jpg`,
  `${BASE}/assets/images/works-g04.jpg`,
  `${BASE}/assets/images/works-g05.jpg`,
  `${BASE}/assets/images/works-g06.jpg`,
  `${BASE}/assets/images/works-g07.jpg`,
  `${BASE}/assets/images/works-g08.jpg`,
  `${BASE}/assets/images/works-g09.jpg`,
  `${BASE}/assets/images/works-g10.jpg`,
];

// קובץ מצב — שומר את האינדקס הנוכחי
const STATE_FILE = path.join(__dirname, 'data', 'image-index.json');

function readIndex() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw).index || 0;
  } catch {
    return 0;
  }
}

function saveIndex(idx) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ index: idx }));
  } catch {}
}

function getNextImage() {
  const idx = readIndex();
  const img = ALL_IMAGES[idx % ALL_IMAGES.length];
  saveIndex((idx + 1) % ALL_IMAGES.length);
  return img;
}

// ── API ──────────────────────────────────────
function getArticleImage(keyword, title) {
  return getNextImage();
}

module.exports = { getArticleImage, ALL_IMAGES };
