// Muzo Cloud Serverless API: /api/recommendations
// Smart Taste Match recommendations engine

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const seed = (req.query.seed || 'popular songs mix').trim();
  const query = `${seed} songs mix`;

  try {
    const ytRes = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        context: { client: { hl: 'en', gl: 'US', clientName: 'WEB', clientVersion: '2.20231201.00.00' } },
        query: query
      })
    });

    const data = await ytRes.json();
    const tracks = [];

    function searchVideos(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (obj.videoRenderer) {
        const vr = obj.videoRenderer;
        const videoId = vr.videoId;
        if (videoId && vr.lengthText && vr.lengthText.simpleText) {
          const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || 'Unknown Song';
          const artist = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || 'Muzo Artist';
          const duration = vr.lengthText?.simpleText || '3:30';
          const thumbnail = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          tracks.push({
            id: videoId,
            title: title,
            artist: artist,
            duration: duration,
            thumbnail: thumbnail
          });
        }
      }
      for (const k of Object.keys(obj)) {
        if (tracks.length >= 20) break;
        searchVideos(obj[k]);
      }
    }

    searchVideos(data);
    return res.status(200).json(tracks.slice(0, 15));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch recommendations', message: err.message });
  }
};
