// ═══════════════════════════════════════════
//  RANKINGS — Google positions via ValueSERP
//  https://www.valueserp.com/
// ═══════════════════════════════════════════

async function fetchRankings(keywords, siteUrl, apiKey) {
  const domain = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const results = [];

  for (const kw of keywords) {
    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        q: kw,
        location: 'Israel',
        google_domain: 'google.co.il',
        gl: 'il',
        hl: 'iw',
        num: '100',
        device: 'desktop',
      });
      const res = await fetch(`https://api.valueserp.com/search?${params}`);
      const data = await res.json();

      if (data.request_info?.success === false) {
        results.push({ keyword: kw, position: null, error: data.request_info.message || 'API error' });
        continue;
      }

      let position = null;
      let resultUrl = null;
      for (const r of data.organic_results || []) {
        if (r.link && r.link.includes(domain)) {
          position = r.position;
          resultUrl = r.link;
          break;
        }
      }
      results.push({ keyword: kw, position, url: resultUrl });
    } catch (e) {
      results.push({ keyword: kw, position: null, error: e.message });
    }
  }

  return results;
}

module.exports = { fetchRankings };
