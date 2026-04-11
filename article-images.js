// ═══════════════════════════════════════════
//  ARTICLE IMAGES — תמונות מהאתר xvision.co.il בלבד
// ═══════════════════════════════════════════

const BASE = 'https://xvision.co.il';

// תמונות שירותים
const SVC = {
  indoor:   `${BASE}/assets/images/services/svc-indoor.jpg`,
  outdoor:  `${BASE}/assets/images/services/svc-outdoor.jpg`,
  cms:      `${BASE}/assets/images/services/svc-cms.jpg`,
  install:  `${BASE}/assets/images/services/svc-install.jpg`,
  support:  `${BASE}/assets/images/services/svc-support.jpg`,
  content:  `${BASE}/assets/images/services/svc-content.jpg`,
  hero:     `${BASE}/assets/images/hero-bg.jpg`,
};

// תמונות פרויקטים — סדרה מגוונת
const WORKS = [
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

// מיפוי לפי קטגוריה
const CATEGORY_MAP = [
  { words: ['חיצוני', 'חוצות', 'שלט', 'ביליבורד', 'IP65', 'IP67', 'outdoor'],  img: SVC.outdoor },
  { words: ['CMS', 'ניהול', 'תוכן', 'pixel pitch', 'תוכנה'],                   img: SVC.cms     },
  { words: ['התקנ', 'פרויקט', 'הקמ'],                                           img: SVC.install },
  { words: ['תחזוק', 'שירות', 'תיקון', 'תמיכה'],                               img: SVC.support },
  { words: ['לובי', 'מלון', 'קבלה', 'כניסה'],                                  img: SVC.indoor  },
  { words: ['בריכה', 'ספורט', 'כושר', 'אצטדיון', 'פיטנס'],                    img: SVC.outdoor },
  { words: ['מסעד', 'תפריט', 'קפה', 'מזון', 'אוכל'],                           img: SVC.indoor  },
  { words: ['חנות', 'קמעונאי', 'רשת', 'ויטרינה', 'סופרמרקט', 'קניון'],       img: SVC.indoor  },
  { words: ['בנק', 'בית חולים', 'קליניקה', 'בריאות', 'חינוך', 'כיתה'],        img: SVC.indoor  },
  { words: ['אירוע', 'אולם', 'שמחות', 'חתונה'],                                img: SVC.content },
];

// בחר תמונת works לפי keyword (deterministc)
function pickWork(keyword) {
  let hash = 0;
  for (let i = 0; i < keyword.length; i++) hash = ((hash << 5) - hash + keyword.charCodeAt(i)) | 0;
  return WORKS[Math.abs(hash) % WORKS.length];
}

function getArticleImage(keyword, title) {
  const text = (keyword || title || '').trim();
  const lower = text.toLowerCase();

  // התאמה לפי קטגוריה
  for (const cat of CATEGORY_MAP) {
    if (cat.words.some(w => lower.includes(w.toLowerCase()))) {
      return cat.img;
    }
  }

  // ברירת מחדל — תמונת פרויקט אמיתית מהאתר
  return pickWork(text);
}

module.exports = { getArticleImage };
