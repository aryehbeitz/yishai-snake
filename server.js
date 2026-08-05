const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3460;
const SCORES_PATH = path.join(__dirname, 'scores.json');
const STATIC_DIR = __dirname;

function loadScores() {
  try { return JSON.parse(fs.readFileSync(SCORES_PATH, 'utf8')); }
  catch { return {}; }
}

function saveScores(scores) {
  fs.writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.setEncoding('utf8');   // multi-byte chars split across chunks otherwise
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve(null); }
    });
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const json = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // API routes
  if (req.method === 'GET' && req.url === '/api/scores') {
    return json(200, loadScores());
  }

  if (req.method === 'GET' && req.url.startsWith('/api/leaderboard')) {
    const url = new URL(req.url, `http://localhost`);
    const mode = url.searchParams.get('mode');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    if (!mode) return json(400, { error: 'mode required' });
    const scores = loadScores();
    const entries = [];
    for (const user in scores) {
      if (scores[user][mode]) entries.push({ user, score: scores[user][mode] });
    }
    entries.sort((a, b) => b.score - a.score);
    return json(200, entries.slice(0, limit));
  }

  if (req.method === 'POST' && req.url === '/api/scores') {
    const body = await readBody(req);
    if (!body?.user || !body?.mode || typeof body.score !== 'number') {
      return json(400, { error: 'user, mode, score required' });
    }
    const scores = loadScores();
    if (!scores[body.user]) scores[body.user] = {};
    if (body.score > (scores[body.user][body.mode] || 0)) {
      scores[body.user][body.mode] = body.score;
      saveScores(scores);
      return json(200, { ok: true, newRecord: true });
    }
    return json(200, { ok: true, newRecord: false });
  }

  // Static files with .html rewrite
  let urlPath = req.url.split('?')[0];
  let filePath = path.join(STATIC_DIR, urlPath);

  // Rewrite: /snake → /snake.html
  if (!path.extname(urlPath) && !urlPath.endsWith('/')) {
    const htmlPath = urlPath + '.html';
    const htmlFile = path.join(STATIC_DIR, htmlPath);
    if (fs.existsSync(htmlFile)) {
      return serveStatic(res, htmlFile);
    }
  }

  // Default to index.html for /
  if (urlPath === '/') {
    return serveStatic(res, path.join(STATIC_DIR, 'index.html'));
  }

  // Serve the file if it exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveStatic(res, filePath);
  }

  json(404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Snake server on port ${PORT}`);
});
