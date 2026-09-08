// Muzo Cloud Serverless API: /api/charts
// Curated charts & trending hits for instant playback

const categoryQueries = {
  trending: 'Top Global Music Hits 2025 official audio',
  anime: 'popular anime openings ost full songs',
  pop: 'top pop hits music 2024 2025',
  hiphop: 'best hip hop rap songs official audio',
  chill: 'chill lofi hip hop study beats music',
  rock: 'classic and modern rock songs official audio',
  bollywood: 'top bollywood romantic and dance songs'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=14400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const cat = (req.query.category || 'trending').toLowerCase();
  const query = categoryQueries[cat] || categoryQueries.trending;

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
        if (tracks.length >= 24) break;
        searchVideos(obj[k]);
      }
    }

    searchVideos(data);
    return res.status(200).json(tracks.slice(0, 20));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch charts', message: err.message });
  }
};
