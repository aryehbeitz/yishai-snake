const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3460;
const SCORES_PATH = path.join(__dirname, 'scores.json');

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
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve(null); }
    });
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

  // GET /api/scores — full scores object
  if (req.method === 'GET' && req.url === '/api/scores') {
    return json(200, loadScores());
  }

  // GET /api/leaderboard?mode=classic&limit=10
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

  // POST /api/scores { user, mode, score }
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

  json(404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Snake scores API on port ${PORT}`);
});
