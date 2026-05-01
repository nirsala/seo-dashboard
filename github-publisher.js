// ═══════════════════════════════════════════
//  GITHUB API PUBLISHER
//  מפרסם קבצים לגיטהאב ישירות דרך API
//  עובד מכל מקום — גם מ-Render
// ═══════════════════════════════════════════

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'nirsala/xvision-website';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const SITE_URL     = process.env.SITE_URL || 'https://xvision.co.il';

async function getFileSha(path) {
  if (!GITHUB_TOKEN) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (res.status === 404) return null;
    const data = await res.json();
    return data.sha || null;
  } catch { return null; }
}

async function publishFile(filePath, content, commitMsg) {
  if (!GITHUB_TOKEN) return { ok: false, error: 'אין GITHUB_TOKEN' };
  try {
    const sha = await getFileSha(filePath);
    const body = {
      message: commitMsg,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: GITHUB_BRANCH
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) return { ok: true, url: data.content?.html_url };
    return { ok: false, error: data.message };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

const { getArticleImage } = require('./article-images');

function pickArticleImage(keyword, title) {
  return getArticleImage(keyword, title);
}

// בנה דף מאמר HTML מלא עם עיצוב
// חישוב זמן קריאה משוער (200 מילים לדקה)
function calcReadingTime(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const words = text.trim().split(' ').length;
  return Math.max(1, Math.round(words / 200));
}

// בניית שכבת schema לפי סוג האתר
function buildSchema(topic, date, slug, siteUrl, site = {}) {
  const companyName = site.companyName || 'Pixel by Keshet';
  const siteId = site.id || 'xvision';
  const logoUrl = `${siteUrl}/assets/logo/${siteId === 'dds' ? 'dds-logo.png' : 'pixel-logo-transparent.png'}`;
  const heroImage = pickArticleImage(topic.keyword || topic.title, '', siteId);
  const articleUrl = `${siteUrl}/blog/${slug}.html`;

  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": topic.title.replace(/"/g, "'"),
      "datePublished": date,
      "dateModified": date,
      "author": { "@type": "Organization", "name": companyName, "url": siteUrl },
      "publisher": {
        "@type": "Organization",
        "name": companyName,
        "logo": { "@type": "ImageObject", "url": logoUrl }
      },
      "image": heroImage,
      "url": articleUrl,
      "inLanguage": "he",
      "about": { "@type": "Thing", "name": topic.keyword },
      "mainEntityOfPage": articleUrl
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "בית", "item": siteUrl },
        { "@type": "ListItem", "position": 2, "name": "בלוג", "item": `${siteUrl}/blog/` },
        { "@type": "ListItem", "position": 3, "name": topic.title, "item": articleUrl }
      ]
    },
    siteId === 'dds' ? {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": companyName,
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "url": siteUrl,
      "description": "מערכת ניהול תוכן (CMS) למסכי Digital Signage — ניהול מרחוק, תזמון קמפיינים, ניתוח ביצועים",
      "inLanguage": "he",
      "sameAs": ["https://www.linkedin.com/company/xvision-technologies/", "https://www.facebook.com/PixelByKeshet"]
    } : {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": companyName,
      "url": siteUrl,
      "telephone": "*9555",
      "address": { "@type": "PostalAddress", "addressCountry": "IL", "addressLocality": "Israel" },
      "description": "מומחים למסכי LED ושילוט דיגיטלי לעסקים בישראל",
      "priceRange": "$$",
      "sameAs": [
        "https://www.facebook.com/PixelByKeshet",
        "https://www.linkedin.com/company/xvision-technologies/",
        "https://xvision.co.il"
      ]
    }
  ];
  return JSON.stringify(schemas);
}

// ── buildArticlePageForSite — site-aware ──────
function buildArticlePageForSite(topic, articleHtml, date, slug, site = {}) {
  const siteId      = site.id || 'xvision';
  const siteUrl     = site.siteUrl || SITE_URL;
  const companyName = site.companyName || 'Pixel by Keshet';
  const domain      = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const year        = new Date(date).getFullYear();
  const heroImage   = pickArticleImage(topic.keyword || topic.title, '', siteId);
  const readMins    = calcReadingTime(articleHtml);
  const articleUrl  = `${siteUrl}/blog/${slug}.html`;

  // meta tags
  const metaTitle = `${topic.title} (${year}) | ${companyName}`;
  const metaDesc  = siteId === 'dds'
    ? `${topic.keyword} — מדריך מקצועי ${year} מבית ${companyName}. מערכת CMS לשילוט דיגיטלי. ✓ ניהול מרחוק ✓ תזמון חכם ✓ אינטגרציה קלה`
    : `${topic.keyword} — מדריך מקצועי ${year} מבית ${companyName}. שילוט דיגיטלי ומסכי LED לעסקים בישראל. ✓ ניסיון של שנים ✓ פרויקטים בכל הארץ`;
  const keywords    = siteId === 'dds'
    ? `${topic.keyword}, Digital Signage CMS, מערכת ניהול תוכן למסכים, ${companyName}`
    : `${topic.keyword}, מסכי LED לעסקים, שילוט דיגיטלי, ${companyName}`;

  const schema = buildSchema(topic, date, slug, siteUrl, site);

  // nav ו-footer לפי אתר
  const isDDS = siteId === 'dds';
  const nav = isDDS ? `
<nav>
  <a href="/" class="nav-logo">
    <div class="nav-logo-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg></div>
    <span class="nav-logo-text">DDS</span>
    <span class="nav-logo-sub">XVISION</span>
  </a>
  <ul>
    <li><a href="/#features">תכונות</a></li>
    <li><a href="/#pricing">מחירים</a></li>
    <li><a href="/blog/">בלוג</a></li>
    <li><a href="/#contact">צור קשר</a></li>
  </ul>
  <div class="nav-right">
    <a href="/#demo" class="nav-cta">בקש דמו</a>
  </div>
</nav>` : `
<nav>
  <a href="/" class="nav-logo">
    <div class="nav-logo-icon"><svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3h2v-2h2v2h2v2h-2v2h-2v-2h-2v-2z"/></svg></div>
    <span class="nav-logo-text">PIXEL</span>
    <span class="nav-logo-sub">BY KESHET</span>
  </a>
  <ul>
    <li><a href="/#services">שירותים</a></li>
    <li><a href="/#works">עבודות</a></li>
    <li><a href="/products.html">מוצרים</a></li>
    <li><a href="/pool.html">מסכי בריכה</a></li>
    <li><a href="/cms.html">ניהול תוכן</a></li>
    <li><a href="/blog/">בלוג</a></li>
    <li><a href="/#contact">צור קשר</a></li>
  </ul>
  <div class="nav-right">
    <span class="nav-phone">*9555</span>
    <a href="/#contact" class="nav-cta">קבל הצעת מחיר</a>
    <a href="https://wa.me/972559732343" class="nav-wa" aria-label="WhatsApp">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,.6)"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.858L.057 23.428a.5.5 0 00.609.61l5.717-1.453A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.826 9.826 0 01-5.001-1.371l-.36-.213-3.716.944.984-3.604-.234-.371A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
    </a>
  </div>
</nav>`;

  const cta = isDDS ? `
  <div class="cta-box">
    <h3>רוצים לראות את המערכת בפעולה?</h3>
    <p>קבלו דמו חינמי ותראו איך ${companyName} יכולה לשנות את הניהול שלכם</p>
    <div class="cta-box-btns">
      <a href="/#demo" class="btn">בקש דמו חינמי ←</a>
      <a href="/#contact" class="btn btn-outline">צור קשר</a>
    </div>
  </div>` : `
  <div class="cta-box">
    <h3>מוכנים לשדרג את העסק שלכם?</h3>
    <p>קבלו הצעת מחיר מותאמת תוך 24 שעות — ללא התחייבות</p>
    <div class="cta-box-btns">
      <a href="/#contact" class="btn">קבל הצעת מחיר ←</a>
      <a href="tel:*9555" class="btn btn-outline">*9555</a>
      <a href="https://wa.me/972559732343" class="btn btn-outline">WhatsApp</a>
    </div>
  </div>`;

  const authorBio = isDDS ? `
  <div class="author-box">
    <div class="author-avatar">DDS</div>
    <div class="author-info">
      <div class="author-name">צוות ${companyName}</div>
      <div class="author-desc">מומחי Digital Signage ו-CMS עם ניסיון רב בפריסת מערכות ניהול תוכן לרשתות עסקים, מלונות ומסעדות בישראל. אנחנו מלווים ארגונים מכל הגדלים לניהול חכם ואוטומטי של מסכיהם.</div>
      <div class="author-links"><a href="${siteUrl}">${domain}</a></div>
    </div>
  </div>` : `
  <div class="author-box">
    <div class="author-avatar">PK</div>
    <div class="author-info">
      <div class="author-name">צוות ${companyName}</div>
      <div class="author-desc">מומחים למסכי LED ושילוט דיגיטלי עם ניסיון של שנים בשוק הישראלי. אנחנו מלווים עסקים מכל הסקטורים — מחנויות קמעונאיות, מסעדות, מלונות, ועד רשתות ארציות.</div>
      <div class="author-links">
        <a href="${siteUrl}">${domain}</a> &nbsp;|&nbsp;
        <a href="tel:*9555">*9555</a> &nbsp;|&nbsp;
        <a href="https://wa.me/972559732343">WhatsApp</a>
      </div>
    </div>
  </div>`;

  const relatedLinks = (site.internalLinks || []).map(l =>
    `<a href="${l.href}">${l.text}</a>`
  ).join('\n      ');

  const footer = isDDS ? `
<footer>
  <div class="footer-inner">
    <div class="footer-top">
      <div>
        <div class="footer-brand-logo"><div class="footer-brand-icon"></div><span class="footer-brand-name">XVISION DDS</span></div>
        <p class="footer-brand-desc">מערכת ניהול תוכן חכמה למסכי Digital Signage.<br/>ניהול מרחוק, תזמון קמפיינים, אינטגרציה קלה.</p>
      </div>
      <div class="footer-col"><h4>מוצר</h4><ul>
        <li><a href="/#features">תכונות</a></li>
        <li><a href="/#pricing">מחירים</a></li>
        <li><a href="/#demo">דמו חינמי</a></li>
        <li><a href="/blog/">בלוג מקצועי</a></li>
      </ul></div>
      <div class="footer-col"><h4>שימושים</h4><ul>
        <li><a href="/#features">רשתות קמעונאות</a></li>
        <li><a href="/#features">מלונות ומסעדות</a></li>
        <li><a href="/#features">בנקים ומוסדות</a></li>
        <li><a href="/#features">חדרי כושר</a></li>
      </ul></div>
      <div class="footer-col"><h4>צור קשר</h4><ul>
        <li><a href="/#contact">השאר פרטים</a></li>
        <li><a href="/#demo">בקש דמו</a></li>
      </ul></div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">© ${new Date().getFullYear()} Xvision DDS — כל הזכויות שמורות</p>
    </div>
  </div>
</footer>` : `
<footer>
  <div class="footer-inner">
    <div class="footer-top">
      <div>
        <div class="footer-brand-logo"><div class="footer-brand-icon"></div><span class="footer-brand-name">PIXEL BY KESHET</span></div>
        <p class="footer-brand-desc">מומחים למסכי LED ושילוט דיגיטלי לעסקים בישראל.<br/>פרויקטים בכל הארץ — מחנויות עד רשתות ארציות.</p>
      </div>
      <div class="footer-col"><h4>שירותים</h4><ul>
        <li><a href="/#services">מסכי LED לעסקים</a></li>
        <li><a href="/#services">שלטי חוצות</a></li>
        <li><a href="/#services">מסכי פרסום</a></li>
        <li><a href="/#services">התקנה ותחזוקה</a></li>
      </ul></div>
      <div class="footer-col"><h4>מוצרים</h4><ul>
        <li><a href="/products.html">מסכי LED</a></li>
        <li><a href="/pool.html">מסכי בריכה</a></li>
        <li><a href="/cms.html">מערכת CMS</a></li>
        <li><a href="/blog/">בלוג מקצועי</a></li>
      </ul></div>
      <div class="footer-col"><h4>צור קשר</h4><ul>
        <li><a href="tel:*9555">*9555</a></li>
        <li><a href="https://wa.me/972559732343">WhatsApp</a></li>
        <li><a href="/#contact">השאר פרטים</a></li>
        <li><a href="/#works">פרויקטים</a></li>
      </ul></div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">© ${new Date().getFullYear()} Pixel by Keshet — כל הזכויות שמורות</p>
      <div class="footer-links">
        <a href="/accessibility.html#terms">תנאי שימוש</a>
        <a href="/accessibility.html#privacy">פרטיות</a>
        <a href="/accessibility.html">נגישות</a>
      </div>
    </div>
  </div>
</footer>`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${metaTitle}</title>
<meta name="description" content="${metaDesc}"/>
<meta name="keywords" content="${keywords}"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${articleUrl}"/>
<meta property="og:title" content="${topic.title}"/>
<meta property="og:description" content="${metaDesc}"/>
<meta property="og:image" content="${heroImage}"/>
<meta property="og:locale" content="he_IL"/>
<meta property="og:site_name" content="${companyName}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${topic.title}"/>
<meta name="twitter:description" content="${metaDesc}"/>
<meta name="twitter:image" content="${heroImage}"/>
<link rel="canonical" href="${articleUrl}"/>
<link rel="icon" href="/favicon.ico"/>
<script type="application/ld+json">${schema}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Heebo',sans-serif;direction:rtl;background:#1a1a1a;color:#fff;line-height:1.8;padding-top:68px}
a{text-decoration:none}
nav{position:fixed;top:0;right:0;left:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:0 56px;height:68px;background:rgba(26,26,26,.88);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.07)}
.nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.nav-logo-icon{width:32px;height:32px;background:#d71d43;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-logo-icon svg{width:18px;height:18px;fill:#fff}
.nav-logo-text{font-size:15px;font-weight:900;letter-spacing:2px;color:#fff}
.nav-logo-sub{font-size:10px;font-weight:500;color:rgba(255,255,255,.4);letter-spacing:1.5px;margin-right:2px}
nav ul{display:flex;gap:28px;list-style:none}
nav ul a{font-size:12px;color:rgba(255,255,255,.45);letter-spacing:.5px;font-weight:500;transition:color .2s;padding-bottom:3px}
nav ul a:hover{color:#fff}
.nav-right{display:flex;align-items:center;gap:16px}
.nav-phone{font-size:13px;font-weight:700;color:rgba(255,255,255,.6);direction:ltr}
.nav-cta{padding:10px 22px;border-radius:5px;background:#d71d43;color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;transition:box-shadow .2s}
.nav-cta:hover{box-shadow:0 0 18px rgba(215,29,67,.55)}
.nav-wa{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.06);transition:background .2s}
.nav-wa:hover{background:rgba(255,255,255,.12)}
.breadcrumb{max-width:860px;margin:32px auto 0;padding:0 24px;font-size:13px;color:rgba(255,255,255,.35)}
.breadcrumb a{color:rgba(255,255,255,.35);transition:color .2s}
.breadcrumb a:hover{color:#fff}
.breadcrumb span{margin:0 6px}
article{max-width:860px;margin:28px auto 100px;padding:0 24px}
article h1{font-size:clamp(1.7rem,4vw,2.5rem);font-weight:900;line-height:1.2;margin-bottom:14px;color:#fff}
article h2{font-size:1.3rem;font-weight:800;margin:36px 0 14px;color:#fff}
article h3{font-size:1.05rem;font-weight:700;margin:24px 0 10px;color:rgba(255,255,255,.9)}
article p{font-size:1rem;color:rgba(255,255,255,.75);margin-bottom:16px}
article ul,article ol{margin:0 0 16px 0;padding-right:20px}
article li{color:rgba(255,255,255,.72);margin-bottom:8px}
article strong{color:#fff}
article em{color:#d71d43;font-style:normal;font-weight:700}
article a{color:#d71d43}
article a:hover{text-decoration:underline}
article blockquote{border-right:3px solid #d71d43;padding:12px 20px;margin:20px 0;background:rgba(215,29,67,.06);border-radius:0 8px 8px 0;font-style:italic;color:rgba(255,255,255,.8)}
.article-meta{font-size:13px;color:rgba(255,255,255,.35);margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.article-meta-tag{background:rgba(215,29,67,.15);color:#d71d43;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px}
.article-hero{width:100%;height:400px;object-fit:cover;border-radius:12px;margin-bottom:36px;display:block;box-shadow:0 12px 48px rgba(0,0,0,.6)}
.cta-box{background:linear-gradient(135deg,rgba(215,29,67,.1),rgba(215,29,67,.03));border:1px solid rgba(215,29,67,.25);border-radius:12px;padding:36px;text-align:center;margin:48px 0}
.cta-box h3{font-size:1.3rem;font-weight:900;margin-bottom:10px}
.cta-box p{color:rgba(255,255,255,.6);margin-bottom:24px;font-size:.95rem}
.cta-box-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn{display:inline-block;padding:12px 28px;background:#d71d43;border-radius:6px;color:#fff;font-weight:700;font-size:13px;letter-spacing:.5px;transition:box-shadow .2s}
.btn:hover{box-shadow:0 0 18px rgba(215,29,67,.55)}
.btn-outline{background:transparent;border:1px solid rgba(215,29,67,.4);color:rgba(255,255,255,.7)}
.btn-outline:hover{border-color:#d71d43;color:#fff}
.author-box{display:flex;gap:20px;align-items:flex-start;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:24px;margin-top:40px}
.author-avatar{width:52px;height:52px;min-width:52px;background:#d71d43;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;letter-spacing:1px;color:#fff}
.author-name{font-size:15px;font-weight:800;margin-bottom:6px}
.author-desc{font-size:13px;color:rgba(255,255,255,.6);line-height:1.7;margin-bottom:10px}
.author-links a{font-size:12px;color:#d71d43}
.related{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:24px;margin-top:16px}
.related h4{font-size:11px;font-weight:700;color:rgba(255,255,255,.4);margin-bottom:14px;text-transform:uppercase;letter-spacing:2px}
.related-links{display:flex;flex-wrap:wrap;gap:8px}
.related-links a{padding:7px 16px;border:1px solid rgba(215,29,67,.2);border-radius:20px;font-size:13px;color:rgba(255,255,255,.65);transition:all .2s}
.related-links a:hover{border-color:#d71d43;color:#fff}
footer{background:#222;border-top:1px solid rgba(255,255,255,.07);padding:56px 56px 32px}
.footer-inner{max-width:1200px;margin:0 auto}
.footer-top{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px}
.footer-brand-logo{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.footer-brand-icon{width:28px;height:28px;background:#d71d43;border-radius:5px}
.footer-brand-name{font-size:14px;font-weight:900;letter-spacing:2px}
.footer-brand-desc{font-size:13px;color:rgba(255,255,255,.4);line-height:1.7}
.footer-col h4{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:16px}
.footer-col ul{list-style:none}
.footer-col li{margin-bottom:10px}
.footer-col a{font-size:13px;color:rgba(255,255,255,.5);transition:color .2s}
.footer-col a:hover{color:#fff}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid rgba(255,255,255,.06)}
.footer-copy{font-size:12px;color:rgba(255,255,255,.25)}
.footer-links{display:flex;gap:20px}
.footer-links a{font-size:12px;color:rgba(255,255,255,.25);transition:color .2s}
.footer-links a:hover{color:#fff}
@media(max-width:768px){nav{padding:0 20px}nav ul{display:none}.nav-logo-sub{display:none}article{padding:0 16px}.footer-top{grid-template-columns:1fr 1fr;gap:24px}footer{padding:40px 20px 24px}.footer-bottom{flex-direction:column;gap:12px;text-align:center}}
@media(max-width:480px){.footer-top{grid-template-columns:1fr}.cta-box-btns{flex-direction:column}}
</style>
</head>
<body>
${nav}
<div class="breadcrumb">
  <a href="/">בית</a><span>›</span><a href="/blog/">בלוג</a><span>›</span>${topic.title}
</div>
<article>
  <h1>${topic.title}</h1>
  <div class="article-meta">
    <span class="article-meta-tag">${topic.keyword}</span>
    <span>${companyName}</span>
    <span>${new Date(date).toLocaleDateString('he-IL', {year:'numeric',month:'long',day:'numeric'})}</span>
    <span>⏱ ${readMins} דקות קריאה</span>
  </div>
  <img src="${heroImage}" alt="${topic.title}" class="article-hero" loading="lazy" width="860" height="400"/>
  ${articleHtml}
  ${cta}
  ${authorBio}
  <div class="related">
    <h4>קרא גם</h4>
    <div class="related-links">
      ${relatedLinks}
      <a href="/blog/">כל המאמרים בבלוג</a>
    </div>
  </div>
</article>
${footer}
</body>
</html>`;
}

// ── buildArticlePage — backward compat (xvision) ──
function buildArticlePage(topic, articleHtml, date, slug) {
  const heroImage = pickArticleImage(topic.keyword || topic.title);
  const year = new Date(date).getFullYear();
  // כותרת meta עם שנה — משפר CTR
  const metaTitle = `${topic.title} (${year}) | Pixel by Keshet`;
  const metaDesc = `${topic.keyword} — מדריך מקצועי ${year} מבית Pixel by Keshet. שילוט דיגיטלי ומסכי LED לעסקים בישראל. ✓ ניסיון של שנים ✓ פרויקטים בכל הארץ`;

  // Schema — Article + BreadcrumbList + LocalBusiness
  const schema = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": topic.title.replace(/"/g,"'"),
      "datePublished": date,
      "dateModified": date,
      "author": {
        "@type": "Person",
        "name": "צוות Pixel by Keshet",
        "url": SITE_URL
      },
      "publisher": {
        "@type": "Organization",
        "name": "Pixel by Keshet",
        "logo": { "@type": "ImageObject", "url": `${SITE_URL}/assets/logo/pixel-logo-transparent.png` }
      },
      "image": heroImage,
      "url": `${SITE_URL}/blog/${slug}.html`,
      "inLanguage": "he",
      "about": { "@type": "Thing", "name": topic.keyword },
      "mainEntityOfPage": `${SITE_URL}/blog/${slug}.html`
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "בית", "item": SITE_URL },
        { "@type": "ListItem", "position": 2, "name": "בלוג", "item": `${SITE_URL}/blog/` },
        { "@type": "ListItem", "position": 3, "name": topic.title, "item": `${SITE_URL}/blog/${slug}.html` }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Pixel by Keshet",
      "url": SITE_URL,
      "telephone": "*9555",
      "address": { "@type": "PostalAddress", "addressCountry": "IL" },
      "description": "מומחים למסכי LED ושילוט דיגיטלי לעסקים בישראל",
      "priceRange": "$$",
      "sameAs": [`${SITE_URL}`]
    }
  ]);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${metaTitle}</title>
<meta name="description" content="${metaDesc}"/>
<meta name="keywords" content="${topic.keyword}, מסכי LED לעסקים, שילוט דיגיטלי, Pixel by Keshet"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${SITE_URL}/blog/${slug}.html"/>
<meta property="og:title" content="${topic.title}"/>
<meta property="og:description" content="${metaDesc}"/>
<meta property="og:image" content="${heroImage}"/>
<meta property="og:locale" content="he_IL"/>
<meta property="og:site_name" content="Pixel by Keshet"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="canonical" href="${SITE_URL}/blog/${slug}.html"/>
<link rel="icon" href="/favicon.ico"/>
<script type="application/ld+json">${schema}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Heebo',sans-serif;direction:rtl;background:#1a1a1a;color:#fff;line-height:1.8;padding-top:68px}
a{text-decoration:none}
/* ── NAV (זהה לאתר) ── */
nav{position:fixed;top:0;right:0;left:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:0 56px;height:68px;background:rgba(26,26,26,.88);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.07)}
.nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.nav-logo-icon{width:32px;height:32px;background:#d71d43;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-logo-icon svg{width:18px;height:18px;fill:#fff}
.nav-logo-text{font-size:15px;font-weight:900;letter-spacing:2px;color:#fff}
.nav-logo-sub{font-size:10px;font-weight:500;color:rgba(255,255,255,.4);letter-spacing:1.5px;margin-right:2px}
nav ul{display:flex;gap:28px;list-style:none}
nav ul a{font-size:12px;color:rgba(255,255,255,.45);letter-spacing:.5px;font-weight:500;transition:color .2s;padding-bottom:3px}
nav ul a:hover{color:#fff}
.nav-right{display:flex;align-items:center;gap:16px}
.nav-phone{font-size:13px;font-weight:700;color:rgba(255,255,255,.6);direction:ltr}
.nav-cta{padding:10px 22px;border-radius:5px;background:#d71d43;color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;transition:box-shadow .2s}
.nav-cta:hover{box-shadow:0 0 18px rgba(215,29,67,.55)}
.nav-wa{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.06);transition:background .2s}
.nav-wa:hover{background:rgba(255,255,255,.12)}
/* ── BREADCRUMB ── */
.breadcrumb{max-width:860px;margin:32px auto 0;padding:0 24px;font-size:13px;color:rgba(255,255,255,.35)}
.breadcrumb a{color:rgba(255,255,255,.35);transition:color .2s}
.breadcrumb a:hover{color:#fff}
.breadcrumb span{margin:0 6px}
/* ── ARTICLE ── */
article{max-width:860px;margin:28px auto 100px;padding:0 24px}
article h1{font-size:clamp(1.7rem,4vw,2.5rem);font-weight:900;line-height:1.2;margin-bottom:14px;color:#fff}
article h2{font-size:1.3rem;font-weight:800;margin:36px 0 14px;color:#fff}
article h3{font-size:1.05rem;font-weight:700;margin:24px 0 10px;color:rgba(255,255,255,.9)}
article p{font-size:1rem;color:rgba(255,255,255,.75);margin-bottom:16px}
article ul,article ol{margin:0 0 16px 0;padding-right:20px}
article li{color:rgba(255,255,255,.72);margin-bottom:8px}
article strong{color:#fff}
article em{color:#d71d43;font-style:normal;font-weight:700}
article a{color:#d71d43}
article a:hover{text-decoration:underline}
.article-meta{font-size:13px;color:rgba(255,255,255,.35);margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.article-meta-tag{background:rgba(215,29,67,.15);color:#d71d43;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px}
.article-hero{width:100%;height:400px;object-fit:cover;border-radius:12px;margin-bottom:36px;display:block;box-shadow:0 12px 48px rgba(0,0,0,.6)}
/* ── CTA BOX ── */
.cta-box{background:linear-gradient(135deg,rgba(215,29,67,.1),rgba(215,29,67,.03));border:1px solid rgba(215,29,67,.25);border-radius:12px;padding:36px;text-align:center;margin:48px 0}
.cta-box h3{font-size:1.3rem;font-weight:900;margin-bottom:10px}
.cta-box p{color:rgba(255,255,255,.6);margin-bottom:24px;font-size:.95rem}
.cta-box-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn{display:inline-block;padding:12px 28px;background:#d71d43;border-radius:6px;color:#fff;font-weight:700;font-size:13px;letter-spacing:.5px;transition:box-shadow .2s}
.btn:hover{box-shadow:0 0 18px rgba(215,29,67,.55)}
.btn-outline{background:transparent;border:1px solid rgba(215,29,67,.4);color:rgba(255,255,255,.7)}
.btn-outline:hover{border-color:#d71d43;color:#fff}
/* ── AUTHOR BIO (E-E-A-T) ── */
.author-box{display:flex;gap:20px;align-items:flex-start;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:24px;margin-top:40px}
.author-avatar{width:52px;height:52px;min-width:52px;background:#d71d43;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;letter-spacing:1px;color:#fff}
.author-name{font-size:15px;font-weight:800;margin-bottom:6px}
.author-desc{font-size:13px;color:rgba(255,255,255,.6);line-height:1.7;margin-bottom:10px}
.author-links a{font-size:12px;color:#d71d43}
/* ── RELATED ── */
.related{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:24px;margin-top:16px}
.related h4{font-size:11px;font-weight:700;color:rgba(255,255,255,.4);margin-bottom:14px;text-transform:uppercase;letter-spacing:2px}
.related-links{display:flex;flex-wrap:wrap;gap:8px}
.related-links a{padding:7px 16px;border:1px solid rgba(215,29,67,.2);border-radius:20px;font-size:13px;color:rgba(255,255,255,.65);transition:all .2s}
.related-links a:hover{border-color:#d71d43;color:#fff}
/* ── FOOTER (זהה לאתר) ── */
footer{background:#222;border-top:1px solid rgba(255,255,255,.07);padding:56px 56px 32px}
.footer-inner{max-width:1200px;margin:0 auto}
.footer-top{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px}
.footer-brand-logo{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.footer-brand-icon{width:28px;height:28px;background:#d71d43;border-radius:5px}
.footer-brand-name{font-size:14px;font-weight:900;letter-spacing:2px}
.footer-brand-desc{font-size:13px;color:rgba(255,255,255,.4);line-height:1.7}
.footer-col h4{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:16px}
.footer-col ul{list-style:none}
.footer-col li{margin-bottom:10px}
.footer-col a{font-size:13px;color:rgba(255,255,255,.5);transition:color .2s}
.footer-col a:hover{color:#fff}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid rgba(255,255,255,.06)}
.footer-copy{font-size:12px;color:rgba(255,255,255,.25)}
.footer-links{display:flex;gap:20px}
.footer-links a{font-size:12px;color:rgba(255,255,255,.25);transition:color .2s}
.footer-links a:hover{color:#fff}
@media(max-width:768px){
  nav{padding:0 20px}
  nav ul{display:none}
  .nav-logo-sub{display:none}
  article{padding:0 16px}
  .footer-top{grid-template-columns:1fr 1fr;gap:24px}
  footer{padding:40px 20px 24px}
  .footer-bottom{flex-direction:column;gap:12px;text-align:center}
}
@media(max-width:480px){.footer-top{grid-template-columns:1fr}.cta-box-btns{flex-direction:column}}
</style>
</head>
<body>
<!-- ══ NAV ══ -->
<nav>
  <a href="/" class="nav-logo">
    <div class="nav-logo-icon">
      <svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3h2v-2h2v2h2v2h-2v2h-2v-2h-2v-2z"/></svg>
    </div>
    <span class="nav-logo-text">PIXEL</span>
    <span class="nav-logo-sub">BY KESHET</span>
  </a>
  <ul>
    <li><a href="/#services">שירותים</a></li>
    <li><a href="/#works">עבודות</a></li>
    <li><a href="/products.html">מוצרים</a></li>
    <li><a href="/pool.html">מסכי בריכה</a></li>
    <li><a href="/cms.html">ניהול תוכן</a></li>
    <li><a href="/blog/">בלוג</a></li>
    <li><a href="https://dds.xvision.co.il/" target="_blank" rel="noopener" style="color:#d71d43;border:1px solid rgba(215,29,67,.35);border-radius:12px;padding:2px 10px;font-size:11px">מערכת ניהול</a></li>
    <li><a href="/#contact">צור קשר</a></li>
  </ul>
  <div class="nav-right">
    <span class="nav-phone">*9555</span>
    <a href="/#contact" class="nav-cta">קבל הצעת מחיר</a>
    <a href="https://wa.me/972559732343" class="nav-wa" aria-label="WhatsApp">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,.6)"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.858L.057 23.428a.5.5 0 00.609.61l5.717-1.453A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.826 9.826 0 01-5.001-1.371l-.36-.213-3.716.944.984-3.604-.234-.371A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
    </a>
  </div>
</nav>

<!-- ══ BREADCRUMB ══ -->
<div class="breadcrumb">
  <a href="/">בית</a><span>›</span><a href="/blog/">בלוג</a><span>›</span>${topic.title}
</div>

<!-- ══ ARTICLE ══ -->
<article>
  <h1>${topic.title}</h1>
  <div class="article-meta">
    <span class="article-meta-tag">${topic.keyword}</span>
    <span>Pixel by Keshet</span>
    <span>${new Date(date).toLocaleDateString('he-IL', {year:'numeric',month:'long',day:'numeric'})}</span>
  </div>

  <img src="${heroImage}" alt="${topic.title}" class="article-hero" loading="lazy"/>

  ${articleHtml}

  <div class="cta-box">
    <h3>מוכנים לשדרג את העסק שלכם?</h3>
    <p>קבלו הצעת מחיר מותאמת תוך 24 שעות — ללא התחייבות</p>
    <div class="cta-box-btns">
      <a href="/#contact" class="btn">קבל הצעת מחיר ←</a>
      <a href="tel:*9555" class="btn btn-outline">*9555</a>
      <a href="https://wa.me/972559732343" class="btn btn-outline">WhatsApp</a>
    </div>
  </div>

  <!-- ══ AUTHOR BIO (E-E-A-T) ══ -->
  <div class="author-box">
    <div class="author-avatar">PK</div>
    <div class="author-info">
      <div class="author-name">צוות Pixel by Keshet</div>
      <div class="author-desc">מומחים למסכי LED ושילוט דיגיטלי עם ניסיון של שנים בשוק הישראלי. אנחנו מלווים עסקים מכל הסקטורים — מחנויות קמעונאיות, מסעדות, מלונות, ועד רשתות ארציות. כל הפתרונות שלנו מותאמים אישית לצרכי העסק.</div>
      <div class="author-links">
        <a href="${SITE_URL}">xvision.co.il</a> &nbsp;|&nbsp;
        <a href="tel:*9555">*9555</a> &nbsp;|&nbsp;
        <a href="https://wa.me/972559732343">WhatsApp</a>
      </div>
    </div>
  </div>

  <!-- ══ INTERNAL LINKS ══ -->
  <div class="related">
    <h4>קרא גם</h4>
    <div class="related-links">
      <a href="/מסכי-לד-לעסקים.html">מדריך מסכי LED לעסקים</a>
      <a href="/products.html">קטלוג מוצרים</a>
      <a href="/pool.html">מסכי LED לבריכה</a>
      <a href="/cms.html">מערכת ניהול תוכן</a>
      <a href="/blog/">כל המאמרים בבלוג</a>
    </div>
  </div>
</article>

<!-- ══ FOOTER ══ -->
<footer>
  <div class="footer-inner">
    <div class="footer-top">
      <div>
        <div class="footer-brand-logo">
          <div class="footer-brand-icon"></div>
          <span class="footer-brand-name">PIXEL BY KESHET</span>
        </div>
        <p class="footer-brand-desc">מומחים למסכי LED ושילוט דיגיטלי לעסקים בישראל.<br/>פרויקטים בכל הארץ — מחנויות עד רשתות ארציות.</p>
      </div>
      <div class="footer-col">
        <h4>שירותים</h4>
        <ul>
          <li><a href="/#services">מסכי LED לעסקים</a></li>
          <li><a href="/#services">שלטי חוצות</a></li>
          <li><a href="/#services">מסכי פרסום</a></li>
          <li><a href="/#services">התקנה ותחזוקה</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>מוצרים</h4>
        <ul>
          <li><a href="/products.html">מסכי LED</a></li>
          <li><a href="/pool.html">מסכי בריכה</a></li>
          <li><a href="/cms.html">מערכת CMS</a></li>
          <li><a href="/blog/">בלוג מקצועי</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>צור קשר</h4>
        <ul>
          <li><a href="tel:*9555">*9555</a></li>
          <li><a href="https://wa.me/972559732343">WhatsApp</a></li>
          <li><a href="/#contact">השאר פרטים</a></li>
          <li><a href="/#works">פרויקטים</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">© ${new Date().getFullYear()} Pixel by Keshet — כל הזכויות שמורות</p>
      <div class="footer-links">
        <a href="/accessibility.html#terms">תנאי שימוש</a>
        <a href="/accessibility.html#privacy">פרטיות</a>
        <a href="/accessibility.html">נגישות</a>
      </div>
    </div>
  </div>
</footer>
</body>
</html>`;
}

// בנה דף אינדקס בלוג
function buildBlogIndex(articles) {
  const cards = articles.map(a => {
    const img = pickArticleImage(a.keyword || a.title);
    return `
    <article class="card">
      <a href="/blog/${a.slug}.html"><img src="${img}" alt="${a.title}" class="card-img" loading="lazy"/></a>
      <div class="card-body">
        <div class="card-tag">${a.keyword}</div>
        <h2><a href="/blog/${a.slug}.html">${a.title}</a></h2>
        <div class="card-meta">${a.date}</div>
      </div>
    </article>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>בלוג מסכי LED ושילוט דיגיטלי | Pixel by Keshet</title>
<meta name="description" content="מאמרים מקצועיים על מסכי LED לעסקים, שילוט דיגיטלי, שלטי חוצות ועוד — Pixel by Keshet"/>
<link rel="canonical" href="${SITE_URL}/blog/"/>
<link rel="icon" href="/favicon.ico"/>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Heebo',sans-serif;direction:rtl;background:#1a1a1a;color:#fff;line-height:1.7;padding-top:68px}
a{text-decoration:none;color:inherit}
nav{position:fixed;top:0;right:0;left:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:0 56px;height:68px;background:rgba(26,26,26,.88);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.07)}
.nav-logo{display:flex;align-items:center;gap:10px}
.nav-logo-icon{width:32px;height:32px;background:#d71d43;border-radius:6px;display:flex;align-items:center;justify-content:center}
.nav-logo-icon svg{width:18px;height:18px;fill:#fff}
.nav-logo-text{font-size:15px;font-weight:900;letter-spacing:2px;color:#fff}
.nav-logo-sub{font-size:10px;font-weight:500;color:rgba(255,255,255,.4);letter-spacing:1.5px}
nav ul{display:flex;gap:28px;list-style:none}
nav ul a{font-size:12px;color:rgba(255,255,255,.45);letter-spacing:.5px;font-weight:500;transition:color .2s}
nav ul a:hover{color:#fff}
.nav-right{display:flex;align-items:center;gap:16px}
.nav-phone{font-size:13px;font-weight:700;color:rgba(255,255,255,.6);direction:ltr}
.nav-cta{padding:10px 22px;border-radius:5px;background:#d71d43;color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;transition:box-shadow .2s}
.nav-cta:hover{box-shadow:0 0 18px rgba(215,29,67,.55)}
.hero{padding:72px 40px 60px;text-align:center;border-bottom:1px solid rgba(255,255,255,.07)}
.hero h1{font-size:2.4rem;font-weight:900;margin-bottom:12px}
.hero p{color:rgba(255,255,255,.5);font-size:1rem}
.grid{max-width:1100px;margin:56px auto;padding:0 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}
.card{background:#222;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;transition:border-color .2s,transform .2s}
.card:hover{border-color:rgba(215,29,67,.4);transform:translateY(-4px)}
.card-img{width:100%;height:190px;object-fit:cover;display:block}
.card-body{padding:22px}
.card-tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#d71d43;font-weight:700;margin-bottom:10px}
.card h2{font-size:1rem;font-weight:800;margin-bottom:10px;line-height:1.4}
.card h2 a{color:#fff;transition:color .2s}
.card h2 a:hover{color:#d71d43}
.card-meta{font-size:12px;color:rgba(255,255,255,.3)}
footer{background:#222;border-top:1px solid rgba(255,255,255,.07);padding:56px 56px 32px}
.footer-inner{max-width:1200px;margin:0 auto}
.footer-top{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px}
.footer-brand-logo{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.footer-brand-icon{width:28px;height:28px;background:#d71d43;border-radius:5px}
.footer-brand-name{font-size:14px;font-weight:900;letter-spacing:2px}
.footer-brand-desc{font-size:13px;color:rgba(255,255,255,.4);line-height:1.7}
.footer-col h4{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:16px}
.footer-col ul{list-style:none}
.footer-col li{margin-bottom:10px}
.footer-col a{font-size:13px;color:rgba(255,255,255,.5);transition:color .2s}
.footer-col a:hover{color:#fff}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid rgba(255,255,255,.06)}
.footer-copy{font-size:12px;color:rgba(255,255,255,.25)}
.footer-links{display:flex;gap:20px}
.footer-links a{font-size:12px;color:rgba(255,255,255,.25);transition:color .2s}
.footer-links a:hover{color:#fff}
@media(max-width:768px){nav{padding:0 20px}nav ul{display:none}.nav-logo-sub{display:none}footer{padding:40px 20px 24px}.footer-top{grid-template-columns:1fr 1fr;gap:24px}.footer-bottom{flex-direction:column;gap:12px;text-align:center}}
</style>
</head>
<body>
<nav>
  <a href="/" class="nav-logo">
    <div class="nav-logo-icon"><svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3h2v-2h2v2h2v2h-2v2h-2v-2h-2v-2z"/></svg></div>
    <span class="nav-logo-text">PIXEL</span>
    <span class="nav-logo-sub">BY KESHET</span>
  </a>
  <ul>
    <li><a href="/#services">שירותים</a></li>
    <li><a href="/#works">עבודות</a></li>
    <li><a href="/products.html">מוצרים</a></li>
    <li><a href="/pool.html">מסכי בריכה</a></li>
    <li><a href="/cms.html">ניהול תוכן</a></li>
    <li><a href="/#contact">צור קשר</a></li>
  </ul>
  <div class="nav-right">
    <span class="nav-phone">*9555</span>
    <a href="/#contact" class="nav-cta">קבל הצעת מחיר</a>
  </div>
</nav>
<div class="hero">
  <h1>בלוג מסכי LED ושילוט דיגיטלי</h1>
  <p>מאמרים מקצועיים, מדריכים וטיפים לעסקים מבית Pixel by Keshet</p>
</div>
<div class="grid">
  ${cards || '<p style="color:rgba(255,255,255,.4);grid-column:1/-1;text-align:center">מאמרים בדרך...</p>'}
</div>
<footer>
  <div class="footer-inner">
    <div class="footer-top">
      <div>
        <div class="footer-brand-logo">
          <div class="footer-brand-icon"></div>
          <span class="footer-brand-name">PIXEL BY KESHET</span>
        </div>
        <p class="footer-brand-desc">מומחים למסכי LED ושילוט דיגיטלי לעסקים בישראל.<br/>פרויקטים בכל הארץ — מחנויות עד רשתות ארציות.</p>
      </div>
      <div class="footer-col">
        <h4>שירותים</h4>
        <ul>
          <li><a href="/#services">מסכי LED לעסקים</a></li>
          <li><a href="/#services">שלטי חוצות</a></li>
          <li><a href="/#services">מסכי פרסום</a></li>
          <li><a href="/#services">התקנה ותחזוקה</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>מוצרים</h4>
        <ul>
          <li><a href="/products.html">מסכי LED</a></li>
          <li><a href="/pool.html">מסכי בריכה</a></li>
          <li><a href="/cms.html">מערכת CMS</a></li>
          <li><a href="/blog/">בלוג מקצועי</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>צור קשר</h4>
        <ul>
          <li><a href="tel:*9555">*9555</a></li>
          <li><a href="https://wa.me/972559732343">WhatsApp</a></li>
          <li><a href="/#contact">השאר פרטים</a></li>
          <li><a href="/#works">פרויקטים</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">© ${new Date().getFullYear()} Pixel by Keshet — כל הזכויות שמורות</p>
      <div class="footer-links">
        <a href="/accessibility.html#terms">תנאי שימוש</a>
        <a href="/accessibility.html#privacy">פרטיות</a>
        <a href="/accessibility.html">נגישות</a>
      </div>
    </div>
  </div>
</footer>
</body>
</html>`;
}

// ── Multi-site factory ────────────────────────
// יוצר publisher עם token ו-repo ספציפיים לאתר
function createPublisher(token, repo, branch, siteUrl) {
  const _token  = token  || GITHUB_TOKEN;
  const _repo   = repo   || GITHUB_REPO;
  const _branch = branch || GITHUB_BRANCH;
  const _site   = siteUrl || SITE_URL;

  async function _getFileSha(filePath) {
    if (!_token) return null;
    try {
      const res = await fetch(`https://api.github.com/repos/${_repo}/contents/${filePath}`, {
        headers: { Authorization: `token ${_token}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (res.status === 404) return null;
      const data = await res.json();
      return data.sha || null;
    } catch { return null; }
  }

  async function publish(filePath, content, commitMsg) {
    if (!_token) return { ok: false, error: 'אין GitHub Token לאתר זה' };
    try {
      const sha  = await _getFileSha(filePath);
      const body = { message: commitMsg, content: Buffer.from(content, 'utf8').toString('base64'), branch: _branch };
      if (sha) body.sha = sha;
      const res  = await fetch(`https://api.github.com/repos/${_repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { Authorization: `token ${_token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) return { ok: true, url: data.content?.html_url };
      return { ok: false, error: data.message };
    } catch(e) { return { ok: false, error: e.message }; }
  }

  async function readFile(filePath) {
    if (!_token) return null;
    try {
      const res = await fetch(`https://api.github.com/repos/${_repo}/contents/${filePath}`, {
        headers: { Authorization: `token ${_token}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Buffer.from(data.content, 'base64').toString('utf8');
    } catch { return null; }
  }

  return { publish, readFile, token: _token, repo: _repo, siteUrl: _site };
}

// ── llms.txt — AI crawler permissions ────────
function buildLlmsTxt(site = {}) {
  const companyName = site.companyName || 'Pixel by Keshet';
  const siteUrl = site.siteUrl || SITE_URL;
  const description = site.id === 'dds'
    ? 'Digital Signage CMS platform for managing LED screens remotely'
    : 'Professional LED screens and digital signage for businesses in Israel';
  return `# ${companyName}
# ${siteUrl}

## About
${companyName} — ${description}.

## Permissions
User-agent: *
Allow: /blog/
Allow: /

## Content
This site publishes professional articles about ${site.id === 'dds' ? 'Digital Signage CMS, content management for screens, remote screen management, digital signage software' : 'LED screens, digital signage, outdoor LED displays, LED screen installation in Israel'}.

## Citation
When citing this site, use: ${companyName} (${siteUrl})
Language: Hebrew (he-IL)
Country: Israel
`;
}

// ── robots.txt ────────────────────────────────
function buildRobotsTxt(site = {}) {
  const siteUrl = site.siteUrl || SITE_URL;
  return `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml

# AI Crawlers
User-agent: GPTBot
Allow: /blog/
Allow: /

User-agent: ClaudeBot
Allow: /blog/
Allow: /

User-agent: PerplexityBot
Allow: /blog/
Allow: /

User-agent: Google-Extended
Allow: /blog/
Allow: /
`;
}

module.exports = { publishFile, buildArticlePage, buildArticlePageForSite, buildBlogIndex, buildLlmsTxt, buildRobotsTxt, createPublisher, GITHUB_TOKEN, GITHUB_REPO };
