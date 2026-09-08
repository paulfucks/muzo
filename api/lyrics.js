// Muzo Cloud Serverless API: /api/lyrics
// Synced Karaoke & Plain Lyrics Engine

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const title = (req.query.title || '').replace(/\(Official.*?\)|\[Official.*?\]|Official Audio|Official Video|Lyric Video|Lyrics/gi, '').trim();
  const artist = (req.query.artist || '').replace(/- Topic/gi, '').trim();

  if (!title) {
    return res.status(200).json({ found: false, plainLyrics: '', syncedLyrics: '' });
  }

  try {
    // 1. Try LRCLIB for synced timestamped lyrics
    const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const lrcRes = await fetch(lrcUrl, {
      headers: { 'User-Agent': 'Muzo-Free-Music-App/2.0' }
    });

    if (lrcRes.ok) {
      const lrcData = await lrcRes.json();
      if (lrcData.syncedLyrics || lrcData.plainLyrics) {
        return res.status(200).json({
          found: true,
          syncedLyrics: lrcData.syncedLyrics || '',
          plainLyrics: lrcData.plainLyrics || ''
        });
      }
    }

    // 2. Fallback: lyrics.ovh
    const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const ovhRes = await fetch(ovhUrl);
    if (ovhRes.ok) {
      const ovhData = await ovhRes.json();
      if (ovhData.lyrics) {
        return res.status(200).json({
          found: true,
          syncedLyrics: '',
          plainLyrics: ovhData.lyrics
        });
      }
    }

    return res.status(200).json({ found: false, plainLyrics: '', syncedLyrics: '' });
  } catch (err) {
    return res.status(200).json({ found: false, plainLyrics: '', syncedLyrics: '' });
  }
};
