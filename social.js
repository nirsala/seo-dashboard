// ═══════════════════════════════════════════
//  SOCIAL MEDIA AUTO-POSTER
//  Facebook, Instagram, LinkedIn — Hebrew
// ═══════════════════════════════════════════
const cfg = require('./config');
const { getArticleImage } = require('./article-images');

const CAPTIONS_HE = [
  `💡 מסכי LED מקצועיים לעסק שלך — חנויות, מסעדות, לובי ועוד.\nPixel by Keshet — הפתרון המושלם לשילוט דיגיטלי.\n📞 *9555\n#מסכיLED #שילוטדיגיטלי #עסקים`,
  `🔴 מסך LED בכניסה לעסק = רושם ראשוני שלא נשכח.\nPixel by Keshet — מומחים בשילוט דיגיטלי.\n📞 *9555\n#LED #PixelKeshet #שיווקדיגיטלי`,
  `✨ מסכי LED חיצוניים — פרסום שעובד 24/7, בכל מזג אוויר.\nעמיד, בהיר, ומושך עיניים.\n📞 *9555\n#מסכיLEDחיצוניים #שילוטחיצוני #פרסום`,
  `📺 ניהול תוכן מרחוק = שינוי מחירים, מבצעים, פרסומות — בלחיצת כפתור.\nמערכת CMS מתקדמת מבית Pixel.\n📞 *9555\n#CMS #שילוטדיגיטלי #טכנולוגיה`,
  `🏊 מסכי LED לבריכות — עמידים לחום ולחות, צבע מרהיב.\nהפתרון הייחודי שלנו לסביבות לחות.\n📞 *9555\n#מסכיבריכה #LEDלבריכה #PixelKeshet`,
  `💼 מהחנות הקטנה ועד רשת ארצית — אנחנו בשבילך.\nPixel by Keshet מתקין מסכי LED בכל הארץ.\n📞 *9555\n#מסכיLED #ישראל #עסקיםקטנים`,
  `🎯 רוצה לבלוט מהמתחרים? מסך LED זה התשובה.\nצבע, תנועה, מסר — מושכים לקוחות.\n📞 *9555\n#שילוטדיגיטלי #מסכיLED #שיווק`,
];

const CAPTIONS_EN = [
  `💡 Professional LED screens for your business — stores, restaurants, lobbies & more.\nPixel by Keshet — Israel's leading digital signage experts.\n📞 *9555\n#LEDScreens #DigitalSignage #Business`,
  `🔴 An LED screen at your entrance = a first impression that lasts.\nPixel by Keshet — digital signage specialists.\n📞 *9555\n#LED #PixelKeshet #Marketing`,
  `✨ Outdoor LED screens — advertising that works 24/7, in any weather.\nDurable, bright, and eye-catching.\n📞 *9555\n#OutdoorLED #DigitalSignage #Advertising`,
  `📺 Remote content management = update prices, promotions & ads with one click.\nAdvanced CMS system by Pixel by Keshet.\n📞 *9555\n#CMS #DigitalSignage #Technology`,
  `🏊 LED screens for pools & wet environments — waterproof, vivid colors.\nOur unique solution for humid environments.\n📞 *9555\n#PoolLED #WaterproofLED #PixelKeshet`,
  `💼 From small businesses to nationwide chains — we've got you covered.\nPixel by Keshet installs LED screens across Israel.\n📞 *9555\n#LEDScreens #Israel #SmallBusiness`,
  `🎯 Want to stand out from the competition? LED screens are the answer.\nColor, motion, message — attracting customers.\n📞 *9555\n#DigitalSignage #LEDScreens #Marketing`,
];

// תרגום כותרת לאנגלית דרך Claude API
async function translateToEnglish(hebrewText) {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return hebrewText; // fallback — השאר עברית אם אין מפתח
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: `Translate this Hebrew article title to English. Return ONLY the translated title, nothing else:\n${hebrewText}` }]
      })
    });
    const data = await res.json();
    return (data.content?.[0]?.text || hebrewText).trim();
  } catch { return hebrewText; }
}


// ── Google Business Profile Post ────────────
// מפרסם עדכון ישירות בגוגל מפות/גוגל חיפוש מקומי
// טוקן: console.cloud.google.com → My Business API
async function postToGoogleBusiness(topic, articleUrl, caption) {
  const token = process.env.GOOGLE_BUSINESS_TOKEN || '';
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID || ''; // accounts/XXX/locations/YYY
  if (!token || !locationId) return { skipped: true, platform: 'Google Business', reason: 'אין GOOGLE_BUSINESS_TOKEN / GOOGLE_BUSINESS_LOCATION_ID' };

  try {
    const body = {
      languageCode: 'he',
      summary: topic ? `${topic}\n\n${caption}` : caption,
      callToAction: articleUrl ? { actionType: 'LEARN_MORE', url: articleUrl } : undefined,
      topicType: 'STANDARD',
    };
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${locationId}/localPosts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data.name) return { ok: true, platform: 'Google Business', url: data.searchUrl || '' };
    return { ok: false, platform: 'Google Business', error: JSON.stringify(data.error || data) };
  } catch(e) {
    return { ok: false, platform: 'Google Business', error: e.message };
  }
}

// ── LinkedIn Direct API ──────────────────────
// token: linkedin.com/developers → My Apps → OAuth 2.0 tools → get token
// Scopes needed: w_member_social, r_liteprofile
async function postToLinkedIn(topic, articleUrl, caption) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN || '';
  if (!token) return { skipped: true, platform: 'LinkedIn', reason: 'אין LINKEDIN_ACCESS_TOKEN' };

  try {
    // קבל person URN
    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!meRes.ok) return { ok: false, platform: 'LinkedIn', error: `auth: ${meRes.status}` };
    const me = await meRes.json();
    const urn = `urn:li:person:${me.sub}`;

    const postText = topic
      ? `\u200F📝 מאמר חדש באתר שלנו:\n${topic}\n\n${caption}\n\n${articleUrl}`
      : `\u200F${caption}`;

    const body = {
      author: urn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: postText },
          shareMediaCategory: articleUrl ? 'ARTICLE' : 'NONE',
          ...(articleUrl ? {
            media: [{
              status: 'READY',
              originalUrl: articleUrl,
              title: { text: topic || 'Pixel by Keshet — מסכי LED' },
            }]
          } : {})
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    };

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok && data.id) {
      const postId = data.id.split(':').pop();
      return { ok: true, platform: 'LinkedIn', url: `https://www.linkedin.com/feed/update/${data.id}` };
    }
    return { ok: false, platform: 'LinkedIn', error: JSON.stringify(data) };
  } catch(e) {
    return { ok: false, platform: 'LinkedIn', error: e.message };
  }
}

async function postToSocial(topic, articleUrl) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const captionHe = CAPTIONS_HE[dayOfYear % CAPTIONS_HE.length];
  const captionEn = CAPTIONS_EN[dayOfYear % CAPTIONS_EN.length];
  const imageUrl  = getArticleImage(topic, articleUrl);

  // תרגם כותרת לאנגלית עבור LinkedIn
  const topicEn = topic ? await translateToEnglish(topic) : '';
  const caption  = captionHe; // Facebook/Instagram — עברית

  // ── Google Business Profile ──
  const gbpResult = await postToGoogleBusiness(topic, articleUrl, caption);
  if (gbpResult.skipped) console.log(`[social] Google Business: ${gbpResult.reason}`);
  else if (gbpResult.ok)  console.log(`[social] ✅ Google Business: פורסם`);
  else                    console.error(`[social] ❌ Google Business: ${gbpResult.error}`);

  // ── LinkedIn ישיר — באנגלית ──
  const linkedinResult = await postToLinkedIn(topicEn, articleUrl, captionEn);
  if (linkedinResult.skipped) {
    console.log(`[social] LinkedIn: ${linkedinResult.reason}`);
  } else if (linkedinResult.ok) {
    console.log(`[social] ✅ LinkedIn: ${linkedinResult.url}`);
  } else {
    console.error(`[social] ❌ LinkedIn: ${linkedinResult.error}`);
  }

  if (!cfg.ayrshareApiKey) {
    console.log('[social] אין Ayrshare API Key — מדלג Facebook/Instagram');
    return linkedinResult.ok ? linkedinResult : { skipped: true };
  }

  // \u200F = סימן כיוון RTL — מונע ערבוב עברית/אנגלית
  const postText = topic
    ? `\u200F📝 מאמר חדש באתר שלנו:\n${topic}\n\n${caption}\n\n${articleUrl}`
    : `\u200F${caption}`;

  try {
    const res = await fetch('https://app.ayrshare.com/api/post', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.ayrshareApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post: postText,
        platforms: ['facebook', 'gmb'],  // LinkedIn מטופל בנפרד (ללא watermark)
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
