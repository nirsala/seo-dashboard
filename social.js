// ═══════════════════════════════════════════
//  SOCIAL MEDIA AUTO-POSTER
//  Facebook, Instagram, LinkedIn — Hebrew
// ═══════════════════════════════════════════
const cfg = require('./config');
const { getArticleImage } = require('./article-images');

const CAPTIONS = [
  `💡 מסכי LED מקצועיים לעסק שלך — חנויות, מסעדות, לובי ועוד.\nPixel by Keshet — הפתרון המושלם לשילוט דיגיטלי.\n📞 *9555\n#מסכיLED #שילוטדיגיטלי #עסקים`,
  `🔴 מסך LED בכניסה לעסק = רושם ראשוני שלא נשכח.\nPixel by Keshet — מומחים בשילוט דיגיטלי.\n📞 *9555\n#LED #PixelKeshet #שיווקדיגיטלי`,
  `✨ מסכי LED חיצוניים — פרסום שעובד 24/7, בכל מזג אוויר.\nעמיד, בהיר, ומושך עיניים.\n📞 *9555\n#מסכיLEDחיצוניים #שילוטחיצוני #פרסום`,
  `📺 ניהול תוכן מרחוק = שינוי מחירים, מבצעים, פרסומות — בלחיצת כפתור.\nמערכת CMS מתקדמת מבית Pixel.\n📞 *9555\n#CMS #שילוטדיגיטלי #טכנולוגיה`,
  `🏊 מסכי LED לבריכות — עמידים לחום ולחות, צבע מרהיב.\nהפתרון הייחודי שלנו לסביבות לחות.\n📞 *9555\n#מסכיבריכה #LEDלבריכה #PixelKeshet`,
  `💼 מהחנות הקטנה ועד רשת ארצית — אנחנו בשבילך.\nPixel by Keshet מתקין מסכי LED בכל הארץ.\n📞 *9555\n#מסכיLED #ישראל #עסקיםקטנים`,
  `🎯 רוצה לבלוט מהמתחרים? מסך LED זה התשובה.\nצבע, תנועה, מסר — מושכים לקוחות.\n📞 *9555\n#שילוטדיגיטלי #מסכיLED #שיווק`,
];


async function postToSocial(topic, articleUrl) {
  if (!cfg.ayrshareApiKey) {
    console.log('[social] אין Ayrshare API Key — מדלג');
    return { skipped: true };
  }

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const caption = CAPTIONS[dayOfYear % CAPTIONS.length];
  // תמונה מותאמת לנושא המאמר
  const imageUrl = getArticleImage(topic, articleUrl);

  const postText = topic
    ? `📝 מאמר חדש: ${topic}\n\n${caption}\n\n👉 קרא עוד: ${articleUrl}`
    : caption;

  try {
    const res = await fetch('https://app.ayrshare.com/api/post', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.ayrshareApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post: postText,
        platforms: ['facebook', 'instagram', 'linkedin'],
        mediaUrls: [imageUrl],
      }),
    });
    const data = await res.json();
    console.log('[social] פורסם ברשתות חברתיות:', data.status || 'ok');
    return { ok: true, data };
  } catch(e) {
    console.error('[social] שגיאה:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { postToSocial };
