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

// מפה מילות מפתח לתמונות Unsplash רלוונטיות (photo ID)
const KEYWORD_IMAGES = [
  { match: ['מסעד', 'תפריט', 'מזון', 'סופרמרקט'],   id: 'photo-1414235077428-338989a2e8c0' }, // restaurant/food
  { match: ['מלון', 'לובי', 'אורחים'],               id: 'photo-1566073771259-6a8506099945' }, // hotel lobby
  { match: ['ספורט', 'אצטדיון', 'כושר'],             id: 'photo-1540747913346-19212a4b32a6' }, // sports arena
  { match: ['חוצות', 'שלט', 'billboard'],            id: 'photo-1558618666-fcd25c85cd64' }, // billboard outdoor
  { match: ['בריכה', 'חיצוני', 'IP65', 'IP67'],      id: 'photo-1519315901367-f34ff9154487' }, // outdoor LED
  { match: ['חינוך', 'בית ספר', 'מוסד'],             id: 'photo-1580582932707-520aed937b7b' }, // classroom screen
  { match: ['בנק', 'קליניק', 'בית חולים', 'בריאות'], id: 'photo-1587351021759-3e566b6af7cc' }, // professional display
  { match: ['קניון', 'רשת', 'חנות', 'ויטרינה'],      id: 'photo-1441984904996-e0b6ba687e04' }, // retail store
  { match: ['אירוע', 'אולם', 'שמחות'],               id: 'photo-1492684223066-81342ee5ff30' }, // event hall
  { match: ['pixel pitch', 'רזולוציה', 'CMS', 'ניהול'], id: 'photo-1518770660439-4636190af475' }, // tech/tech screen
  { match: ['תחנת דלק', 'תחנה'],                     id: 'photo-1568605117036-5fe5e7bab0b7' }, // gas station
];

function pickArticleImage(keyword) {
  const kw = (keyword || '').toLowerCase();
  for (const item of KEYWORD_IMAGES) {
    if (item.match.some(m => kw.includes(m.toLowerCase()))) {
      return `https://images.unsplash.com/${item.id}?auto=format&fit=crop&w=1200&q=80`;
    }
  }
  // ברירת מחדל — מסך LED עסקי
  return `https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=1200&q=80`;
}

// בנה דף מאמר HTML מלא עם עיצוב
function buildArticlePage(topic, articleHtml, date, slug) {
  const heroImage = pickArticleImage(topic.keyword || topic.title);
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${topic.title} | Pixel by Keshet</title>
<meta name="description" content="${topic.keyword} — מידע מקצועי מבית Pixel by Keshet. שילוט דיגיטלי ומסכי LED לעסקים."/>
<meta name="keywords" content="${topic.keyword}, מסכי LED לעסקים, שילוט דיגיטלי, Pixel by Keshet"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${SITE_URL}/blog/${slug}.html"/>
<meta property="og:title" content="${topic.title}"/>
<meta property="og:description" content="${topic.keyword} — מידע מקצועי מבית Pixel by Keshet"/>
<meta property="og:image" content="${heroImage}"/>
<meta property="og:locale" content="he_IL"/>
<meta property="og:site_name" content="Pixel by Keshet"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="canonical" href="${SITE_URL}/blog/${slug}.html"/>
<link rel="icon" href="/favicon.ico"/>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"${topic.title.replace(/"/g,"'")}","datePublished":"${date}","dateModified":"${date}","author":{"@type":"Organization","name":"Pixel by Keshet"},"publisher":{"@type":"Organization","name":"Pixel by Keshet","logo":{"@type":"ImageObject","url":"${SITE_URL}/assets/logo/pixel-logo-transparent.png"}},"url":"${SITE_URL}/blog/${slug}.html","inLanguage":"he"}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Heebo',sans-serif;direction:rtl;background:#1a1a1a;color:#fff;line-height:1.8}
a{color:#d71d43;text-decoration:none}
a:hover{text-decoration:underline}
/* NAV */
nav{background:rgba(26,26,26,.97);border-bottom:1px solid rgba(255,255,255,.07);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.nav-brand{font-weight:900;font-size:16px;letter-spacing:2px;color:#fff}
.nav-brand span{color:#d71d43}
.nav-links{display:flex;gap:24px;list-style:none}
.nav-links a{color:rgba(255,255,255,.6);font-size:13px;transition:color .2s}
.nav-links a:hover{color:#fff;text-decoration:none}
.nav-cta{background:#d71d43;color:#fff!important;padding:8px 18px;border-radius:5px;font-size:12px;font-weight:700;letter-spacing:1px}
/* BREADCRUMB */
.breadcrumb{max-width:820px;margin:24px auto 0;padding:0 24px;font-size:13px;color:rgba(255,255,255,.4)}
.breadcrumb a{color:rgba(255,255,255,.4)}
/* ARTICLE */
article{max-width:820px;margin:32px auto 80px;padding:0 24px}
article h1{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:900;line-height:1.2;margin-bottom:16px;color:#fff}
article h2{font-size:1.3rem;font-weight:800;margin:36px 0 14px;color:#fff}
article h3{font-size:1.05rem;font-weight:700;margin:24px 0 10px;color:rgba(255,255,255,.9)}
article p{font-size:1rem;color:rgba(255,255,255,.78);margin-bottom:16px}
article ul,article ol{margin:0 0 16px 0;padding-right:20px}
article li{color:rgba(255,255,255,.75);margin-bottom:8px}
article strong{color:#fff}
article em{color:#d71d43;font-style:normal;font-weight:700}
.article-meta{font-size:13px;color:rgba(255,255,255,.4);margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,.07)}
.article-hero{width:100%;height:380px;object-fit:cover;border-radius:14px;margin-bottom:32px;display:block;box-shadow:0 8px 40px rgba(0,0,0,.5)}
/* CTA BOX */
.cta-box{background:linear-gradient(135deg,rgba(215,29,67,.12),rgba(215,29,67,.04));border:1px solid rgba(215,29,67,.3);border-radius:12px;padding:32px;text-align:center;margin:40px 0}
.cta-box h3{font-size:1.25rem;font-weight:800;margin-bottom:10px}
.cta-box p{color:rgba(255,255,255,.65);margin-bottom:20px}
.btn{display:inline-block;padding:12px 28px;background:#d71d43;border-radius:7px;color:#fff;font-weight:700;font-size:14px}
/* RELATED */
.related{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:24px;margin-top:40px}
.related h4{font-size:14px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:16px;text-transform:uppercase;letter-spacing:1px}
.related-links{display:flex;flex-wrap:wrap;gap:10px}
.related-links a{padding:7px 16px;border:1px solid rgba(215,29,67,.25);border-radius:20px;font-size:13px;color:rgba(255,255,255,.7);transition:all .2s}
.related-links a:hover{border-color:#d71d43;color:#fff;text-decoration:none}
/* FOOTER */
footer{background:#111;border-top:1px solid rgba(255,255,255,.06);padding:28px 40px;text-align:center;font-size:13px;color:rgba(255,255,255,.35)}
@media(max-width:640px){nav{padding:0 16px}.nav-links{display:none}article{padding:0 16px}}
</style>
</head>
<body>
<nav>
  <a href="/" class="nav-brand">PIXEL <span>●</span> by Keshet</a>
  <ul class="nav-links">
    <li><a href="/#services">שירותים</a></li>
    <li><a href="/#works">פרויקטים</a></li>
    <li><a href="/products.html">מוצרים</a></li>
    <li><a href="/blog/">בלוג</a></li>
  </ul>
  <a href="tel:*9555" class="nav-cta">*9555</a>
</nav>

<div class="breadcrumb">
  <a href="/">בית</a> › <a href="/blog/">בלוג</a> › ${topic.title}
</div>

<article>
  <h1>${topic.title}</h1>
  <div class="article-meta">
    על ידי Pixel by Keshet &nbsp;|&nbsp; ${new Date(date).toLocaleDateString('he-IL', {year:'numeric',month:'long',day:'numeric'})} &nbsp;|&nbsp; ${topic.keyword}
  </div>

  <img src="${heroImage}" alt="${topic.title}" class="article-hero" loading="lazy"/>

  ${articleHtml}

  <div class="cta-box">
    <h3>מוכנים לשדרג את העסק שלכם?</h3>
    <p>קבלו הצעת מחיר מותאמת תוך 24 שעות — ללא התחייבות</p>
    <a href="/#contact" class="btn">קבל הצעת מחיר ←</a>
    &nbsp;
    <a href="tel:*9555" class="btn" style="background:transparent;border:1px solid rgba(215,29,67,.5)">*9555</a>
  </div>

  <div class="related">
    <h4>קרא גם</h4>
    <div class="related-links">
      <a href="/מסכי-לד-לעסקים.html">מדריך מסכי LED לעסקים</a>
      <a href="/products.html">קטלוג מוצרים</a>
      <a href="/pool.html">מסכי LED לבריכה</a>
      <a href="/cms.html">מערכת ניהול תוכן</a>
      <a href="/blog/">כל המאמרים</a>
    </div>
  </div>
</article>

<footer>
  © ${new Date().getFullYear()} Pixel by Keshet — מסכי LED ושילוט דיגיטלי לעסקים |
  <a href="tel:*9555" style="color:#d71d43">*9555</a> |
  <a href="${SITE_URL}" style="color:#d71d43">xvision.co.il</a>
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
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Heebo',sans-serif;direction:rtl;background:#1a1a1a;color:#fff;line-height:1.7}
a{color:inherit;text-decoration:none}
nav{background:rgba(26,26,26,.97);border-bottom:1px solid rgba(255,255,255,.07);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between}
.nav-brand{font-weight:900;font-size:16px;letter-spacing:2px}
.nav-brand span{color:#d71d43}
.nav-cta{background:#d71d43;color:#fff;padding:8px 18px;border-radius:5px;font-size:12px;font-weight:700}
.hero{padding:60px 40px;text-align:center;border-bottom:1px solid rgba(255,255,255,.07)}
.hero h1{font-size:2.2rem;font-weight:900;margin-bottom:12px}
.hero p{color:rgba(255,255,255,.55);font-size:1rem}
.grid{max-width:1000px;margin:48px auto;padding:0 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.card{background:#222;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;transition:border-color .2s,transform .2s}
.card:hover{border-color:rgba(215,29,67,.4);transform:translateY(-4px)}
.card-img{width:100%;height:180px;object-fit:cover;display:block}
.card-body{padding:20px}
.card-tag{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d71d43;font-weight:700;margin-bottom:10px}
.card h2{font-size:1rem;font-weight:800;margin-bottom:10px;line-height:1.4}
.card h2 a:hover{color:#d71d43}
.card-meta{font-size:12px;color:rgba(255,255,255,.35)}
footer{text-align:center;padding:28px;font-size:13px;color:rgba(255,255,255,.3);border-top:1px solid rgba(255,255,255,.06);margin-top:40px}
</style>
</head>
<body>
<nav>
  <a href="/" class="nav-brand">PIXEL <span>●</span> by Keshet</a>
  <a href="tel:*9555" class="nav-cta">*9555</a>
</nav>
<div class="hero">
  <h1>בלוג מסכי LED ושילוט דיגיטלי</h1>
  <p>מאמרים מקצועיים, מדריכים וטיפים לעסקים מבית Pixel by Keshet</p>
</div>
<div class="grid">
  ${cards || '<p style="color:rgba(255,255,255,.4);grid-column:1/-1;text-align:center">מאמרים בדרך...</p>'}
</div>
<footer>© ${new Date().getFullYear()} Pixel by Keshet | <a href="${SITE_URL}" style="color:#d71d43">xvision.co.il</a></footer>
</body>
</html>`;
}

module.exports = { publishFile, buildArticlePage, buildBlogIndex, GITHUB_TOKEN, GITHUB_REPO };
