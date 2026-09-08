// Muzo - Universal Standalone Node.js Server
// Zero dependencies needed (uses built-in http, fs, path, url)
// Works on Render, Railway, Glitch, Koyeb, Fly.io, or any VPS/Cloud 24/7!

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 5050;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Import serverless API handlers
const searchHandler = require('./api/search.js');
const suggestionsHandler = require('./api/suggestions.js');
const chartsHandler = require('./api/charts.js');
const lyricsHandler = require('./api/lyrics.js');
const recommendationsHandler = require('./api/recommendations.js');
const networkInfoHandler = require('./api/network-info.js');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Polyfill Express-like req.query and res.status / res.json
  req.query = parsedUrl.query || {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };

  // API Routes
  try {
    if (pathname === '/api/search') {
      return await searchHandler(req, res);
    } else if (pathname === '/api/suggestions') {
      return await suggestionsHandler(req, res);
    } else if (pathname === '/api/charts') {
      return await chartsHandler(req, res);
    } else if (pathname === '/api/lyrics') {
      return await lyricsHandler(req, res);
    } else if (pathname === '/api/recommendations') {
      return await recommendationsHandler(req, res);
    } else if (pathname === '/api/network-info') {
      return networkInfoHandler(req, res);
    }
  } catch (err) {
    console.error(`API Error on ${pathname}:`, err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 404;
        return res.end('File Not Found');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Muzo Cloud Server running on http://0.0.0.0:${PORT}`);
});
