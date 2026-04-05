// ═══════════════════════════════════════════
//  CONFIG — קורא מ-Environment Variables
//  הגדר את המשתנים ב-Render → Environment
// ═══════════════════════════════════════════

const config = {
  // כתובת האתר
  site: {
    url:  process.env.SITE_URL  || 'https://xvision.co.il',
    name: process.env.SITE_NAME || 'Pixel by Keshet',
  },

  // דפים לבדיקת זמינות
  pages: [
    '',
    '/products.html',
    '/pool.html',
    '/cms.html',
    '/blog/',
  ],

  // מפתחות API
  ayrshareApiKey:        process.env.AYRSHARE_API_KEY        || '',
  googlePageSpeedKey:    process.env.GOOGLE_PAGESPEED_KEY    || '',
  googleSearchConsoleKey:process.env.GOOGLE_SEARCH_CONSOLE_KEY || '',
  anthropicApiKey:       process.env.ANTHROPIC_API_KEY       || '',
  githubToken:           process.env.GITHUB_TOKEN            || '',
  githubRepo:            process.env.GITHUB_REPO             || 'nirsala/xvision-website',
};

module.exports = config;
