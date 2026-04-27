// ═══════════════════════════════════════════
//  ARTICLE IMAGES — תמונות לפי אתר
//  xvision: תמונות מהאתר xvision.co.il
//  dds: תמונות Unsplash בנושא CMS / Digital Signage
//  rotation: כל ריצה תמונה שונה, חוזר רק אחרי שכולן נוצלו
// ═══════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const BASE_XVISION = 'https://xvision.co.il';

// ── xvision: תמונות מהאתר ───────────────────
const XVISION_IMAGES = [
  `${BASE_XVISION}/assets/images/services/svc-indoor.jpg`,
  `${BASE_XVISION}/assets/images/services/svc-outdoor.jpg`,
  `${BASE_XVISION}/assets/images/services/svc-cms.jpg`,
  `${BASE_XVISION}/assets/images/services/svc-install.jpg`,
  `${BASE_XVISION}/assets/images/services/svc-support.jpg`,
  `${BASE_XVISION}/assets/images/services/svc-content.jpg`,
  `${BASE_XVISION}/assets/images/hero-bg.jpg`,
  `${BASE_XVISION}/assets/images/works-s01.jpg`,
  `${BASE_XVISION}/assets/images/works-s02.jpg`,
  `${BASE_XVISION}/assets/images/works-s03.jpg`,
  `${BASE_XVISION}/assets/images/works-s04.jpg`,
  `${BASE_XVISION}/assets/images/works-s05.jpg`,
  `${BASE_XVISION}/assets/images/works-s06.jpg`,
  `${BASE_XVISION}/assets/images/works-s07.jpg`,
  `${BASE_XVISION}/assets/images/works-s08.jpg`,
  `${BASE_XVISION}/assets/images/works-s09.jpg`,
  `${BASE_XVISION}/assets/images/works-s10.jpg`,
  `${BASE_XVISION}/assets/images/works-g01.jpg`,
  `${BASE_XVISION}/assets/images/works-g02.jpg`,
  `${BASE_XVISION}/assets/images/works-g03.jpg`,
  `${BASE_XVISION}/assets/images/works-g04.jpg`,
  `${BASE_XVISION}/assets/images/works-g05.jpg`,
  `${BASE_XVISION}/assets/images/works-g06.jpg`,
  `${BASE_XVISION}/assets/images/works-g07.jpg`,
  `${BASE_XVISION}/assets/images/works-g08.jpg`,
  `${BASE_XVISION}/assets/images/works-g09.jpg`,
  `${BASE_XVISION}/assets/images/works-g10.jpg`,
];

// ── DDS: תמונות Unsplash — CMS / Digital Signage ──
// תמונות איכות גבוהה בנושאי תוכנה, מסכים ו-CMS
const UNSPLASH = 'https://images.unsplash.com/photo';
const DDS_IMAGES = [
  `${UNSPLASH}-1551288049-bebda4e38f71?w=1200&q=80`,  // business dashboard
  `${UNSPLASH}-1460925895917-afdab827c52f?w=1200&q=80`, // analytics screens
  `${UNSPLASH}-1504868584819-f8e8b4b6d7e3?w=1200&q=80`, // data dashboard
  `${UNSPLASH}-1531297484001-80022131f5a1?w=1200&q=80`, // laptop screens tech
  `${UNSPLASH}-1519389950473-47ba0277781c?w=1200&q=80`, // tech workspace
  `${UNSPLASH}-1556742049-0cfed4f6a45d?w=1200&q=80`,   // crm/dashboard UI
  `${UNSPLASH}-1593642632559-0c6d3fc62b89?w=1200&q=80`, // modern office tech
  `${UNSPLASH}-1542744094-3a31f272c490?w=1200&q=80`,   // digital display
  `${UNSPLASH}-1454165804606-c3d57bc86b40?w=1200&q=80`, // working on laptop
  `${UNSPLASH}-1517694712202-14dd9538aa97?w=1200&q=80`, // coding screen
  `${UNSPLASH}-1467232004584-a241de8bcf5d?w=1200&q=80`, // web/software dev
  `${UNSPLASH}-1555066931-4365d14bab8c?w=1200&q=80`,   // code on screen
  `${UNSPLASH}-1551434678-e076c223a692?w=1200&q=80`,   // team + laptop
  `${UNSPLASH}-1486312338219-ce68d2c6f44d?w=1200&q=80`, // person at computer
  `${UNSPLASH}-1518770660439-4636190af475?w=1200&q=80`, // tech circuit board
  `${UNSPLASH}-1507003211169-0a1dd7228f2d?w=1200&q=80`, // software interface
  `${UNSPLASH}-1588196749597-9ff075ee6b5b?w=1200&q=80`, // software dashboard
  `${UNSPLASH}-1611162616475-46b635cb6868?w=1200&q=80`, // content creation
  `${UNSPLASH}-1611162616305-c69b3fa7fbe0?w=1200&q=80`, // digital signage
  `${UNSPLASH}-1611532736597-de2d4265fba3?w=1200&q=80`, // LED/digital screen
  `${UNSPLASH}-1480694313141-fce5e697ee25?w=1200&q=80`, // retail digital display
  `${UNSPLASH}-1526628953301-3cd8a4b87456?w=1200&q=80`, // data visualization
  `${UNSPLASH}-1432888498266-38ffec3eaf0a?w=1200&q=80`, // analytics
  `${UNSPLASH}-1563986768609-322da13575f3?w=1200&q=80`, // digital marketing
];

// ── state files — נפרד לכל אתר ──────────────
function stateFile(siteId) {
  return path.join(__dirname, 'data', `image-index-${siteId || 'xvision'}.json`);
}

function readIndex(siteId) {
  try {
    const raw = fs.readFileSync(stateFile(siteId), 'utf8');
    return JSON.parse(raw).index || 0;
  } catch {
    // backward compat: קרא מהקובץ הישן עבור xvision
    if (!siteId || siteId === 'xvision') {
      try {
        const old = fs.readFileSync(path.join(__dirname, 'data', 'image-index.json'), 'utf8');
        return JSON.parse(old).index || 0;
      } catch { return 0; }
    }
    return 0;
  }
}

function saveIndex(siteId, idx) {
  try {
    const dir = path.join(__dirname, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(stateFile(siteId), JSON.stringify({ index: idx }));
    // backward compat
    if (!siteId || siteId === 'xvision') {
      fs.writeFileSync(path.join(dir, 'image-index.json'), JSON.stringify({ index: idx }));
    }
  } catch {}
}

function getNextImage(siteId) {
  const images = (siteId === 'dds') ? DDS_IMAGES : XVISION_IMAGES;
  const idx = readIndex(siteId);
  const img = images[idx % images.length];
  saveIndex(siteId, (idx + 1) % images.length);
  return img;
}

// ── API ──────────────────────────────────────
// siteId: 'xvision' | 'dds' | undefined (backward compat)
function getArticleImage(keyword, title, siteId) {
  return getNextImage(siteId);
}

module.exports = { getArticleImage, XVISION_IMAGES, DDS_IMAGES };
