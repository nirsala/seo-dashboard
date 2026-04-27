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


// ── Facebook Direct API ──────────────────────
// token: business.facebook.com/settings → System Users → Generate Token
// scopes: pages_manage_posts, pages_read_engagement
async function postToFacebook(topic, articleUrl, caption, imageUrl, tokens = {}) {
  const userToken = tokens.facebookPageToken || process.env.FACEBOOK_PAGE_TOKEN || '';
  const pageId    = tokens.facebookPageId    || process.env.FACEBOOK_PAGE_ID   || '';
  if (!userToken || !pageId) return { skipped: true, platform: 'Facebook', reason: 'אין FACEBOOK_PAGE_TOKEN / FACEBOOK_PAGE_ID' };

  try {
    // המר System User Token ל-Page Access Token
    const pageTokenRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${userToken}`
    );
    const pageTokenData = await pageTokenRes.json();
    const token = pageTokenData.access_token || userToken; // fallback לטוקן המקורי

    const postText = articleUrl
      ? `\u200F${caption}\n\n${articleUrl}`
      : `\u200F${caption}`;

    // פרסום עם תמונה (photos endpoint)
    if (imageUrl) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl, caption: postText, access_token: token, published: true })
      });
      const data = await res.json();
      if (data.id) return { ok: true, platform: 'Facebook', id: data.id };
      // fallback לפוסט טקסט בלבד
    }

    // פרסום טקסט בלבד
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: postText, link: articleUrl || undefined, access_token: token })
    });
    const data = await res.json();
    if (data.id) return { ok: true, platform: 'Facebook', id: data.id, url: `https://facebook.com/${data.id}` };
    return { ok: false, platform: 'Facebook', error: JSON.stringify(data.error || data) };
  } catch(e) {
    return { ok: false, platform: 'Facebook', error: e.message };
  }
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
// Scopes needed: w_member_social, r_liteprofile, rw_organization_admin
// LINKEDIN_COMPANY_ID: linkedin.com/company/YOUR-COMPANY → מספר ב-URL
async function postToLinkedIn(topic, articleUrl, caption, tokens = {}) {
  const token     = tokens.linkedinToken     || process.env.LINKEDIN_ACCESS_TOKEN || '';
  const companyId = tokens.linkedinCompanyId || process.env.LINKEDIN_COMPANY_ID  || '';
  if (!token) return { skipped: true, platform: 'LinkedIn', reason: 'אין LINKEDIN_ACCESS_TOKEN' };

  try {
    // קבל person URN
    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!meRes.ok) return { ok: false, platform: 'LinkedIn', error: `auth: ${meRes.status}` };
    const me = await meRes.json();
    const personUrn = `urn:li:person:${me.sub}`;

    const postText = articleUrl
      ? `\u200F${caption}\n\n${articleUrl}`
      : `\u200F${caption}`;

    // פונקציה לבניית גוף הפוסט
    const buildPost = (authorUrn) => ({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: postText },
          shareMediaCategory: articleUrl ? 'ARTICLE' : 'NONE',
          ...(articleUrl ? {
            media: [{
              status: 'READY',
              originalUrl: articleUrl,
              title: { text: topic || 'Pixel by Keshet — LED Screens' },
            }]
          } : {})
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    });

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    };

    // פרסום בפרופיל האישי
    const personalRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST', headers, body: JSON.stringify(buildPost(personUrn))
    });
    const personalData = await personalRes.json();
    const personalOk = personalRes.ok && personalData.id;
    if (personalOk) console.log(`[social] ✅ LinkedIn אישי: ${personalData.id}`);
    else console.error(`[social] ❌ LinkedIn אישי:`, JSON.stringify(personalData));

    // שיתוף הפוסט האישי לדף החברה (reshare — עובד בלי Marketing API)
    let companyOk = false;
    if (companyId && personalOk && personalData.id) {
      try {
        const reshareBody = {
          author: `urn:li:organization:${companyId}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: postText },
              shareMediaCategory: 'NONE',
              shareFeatureContext: {
                'com.linkedin.ugc.ShareFeatureContext': {
                  resharedShare: personalData.id
                }
              }
            }
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
        };
        const reshareRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST', headers, body: JSON.stringify(reshareBody)
        });
        const reshareData = await reshareRes.json();
        companyOk = reshareRes.ok && reshareData.id;
        if (companyOk) console.log(`[social] ✅ LinkedIn חברה (reshare): ${reshareData.id}`);
        else {
          // fallback — נסה פוסט ישיר עם ה-API החדש
          const newApiBody = {
            author: `urn:li:organization:${companyId}`,
            commentary: postText,
            visibility: 'PUBLIC',
            distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
            lifecycleState: 'PUBLISHED',
            isReshareDisabledByAuthor: false,
            ...(articleUrl ? { content: { article: { source: articleUrl, title: topic || '' } } } : {})
          };
          const newApiRes = await fetch('https://api.linkedin.com/rest/posts', {
            method: 'POST',
            headers: { ...headers, 'LinkedIn-Version': '202304' },
            body: JSON.stringify(newApiBody)
          });
          const newApiData = newApiRes.status === 201 ? { id: newApiRes.headers.get('x-restli-id') } : await newApiRes.json();
          companyOk = newApiRes.status === 201;
          if (companyOk) console.log(`[social] ✅ LinkedIn חברה (new API): ${newApiData.id}`);
          else console.log(`[social] ⚠️ LinkedIn חברה: נדרש אישור LinkedIn Marketing API (${newApiData?.message || newApiRes.status})`);
        }
      } catch(e) {
        console.log(`[social] ⚠️ LinkedIn חברה: ${e.message}`);
      }
    }

    if (personalOk || companyOk) {
      return { ok: true, platform: 'LinkedIn', url: `https://www.linkedin.com/feed/update/${personalData.id}` };
    }
    return { ok: false, platform: 'LinkedIn', error: JSON.stringify(personalData) };
  } catch(e) {
    return { ok: false, platform: 'LinkedIn', error: e.message };
  }
}

// tokens: { facebookPageToken, facebookPageId, linkedinToken, linkedinCompanyId }
// אם לא מועבר — משתמש ב-env vars הגלובליים (backward compat)
async function postToSocial(topic, articleUrl, tokens = {}) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const captionHe = CAPTIONS_HE[dayOfYear % CAPTIONS_HE.length];
  const captionEn = CAPTIONS_EN[dayOfYear % CAPTIONS_EN.length];
  const imageUrl  = getArticleImage(topic, articleUrl);

  // תרגם כותרת לאנגלית עבור LinkedIn
  const topicEn = topic ? await translateToEnglish(topic) : '';
  const caption  = captionHe; // Facebook — עברית

  // ── Facebook Direct ──────────────────────────
  const fbResult = await postToFacebook(topic, articleUrl, caption, imageUrl, tokens);
  if (fbResult.skipped) {
    console.log(`[social] Facebook: ${fbResult.reason}`);
  } else if (fbResult.ok) {
    console.log(`[social] ✅ Facebook פורסם (id: ${fbResult.id})`);
  } else {
    console.error(`[social] ❌ Facebook שגיאה:`, fbResult.error);
  }

  // ── LinkedIn Direct ──────────────────────────
  const liResult = await postToLinkedIn(topicEn || topic, articleUrl, captionEn, tokens);
  if (liResult.skipped) {
    console.log(`[social] LinkedIn: ${liResult.reason}`);
  } else if (liResult.ok) {
    console.log(`[social] ✅ LinkedIn פורסם: ${liResult.url}`);
  } else {
    console.error(`[social] ❌ LinkedIn שגיאה:`, liResult.error);
  }

  return { ok: fbResult.ok || liResult.ok, fbResult, liResult };
}

module.exports = { postToSocial };
