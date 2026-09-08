// Muzo Cloud Serverless API: /api/suggestions
// Autocomplete search suggestions from Google Suggest

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query.q || '';
  if (!query.trim()) {
    return res.status(200).json([]);
  }

  try {
    const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const text = await resp.text();
    
    // Parse JSONP response: window.google.ac.h(["query", [["item", 0, ...]]])
    const match = text.match(/window\.google\.ac\.h\((.*)\)/);
    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      if (Array.isArray(data[1])) {
        const suggestions = data[1].map(item => item[0]);
        return res.status(200).json(suggestions.slice(0, 8));
      }
    }
    return res.status(200).json([]);
  } catch (err) {
    return res.status(200).json([]);
  }
};
