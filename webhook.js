const http = require('http');
const { execSync } = require('child_process');

const PORT = 3461;
const SECRET = process.env.WEBHOOK_SECRET || '';
const REPO_DIR = '/home/admin/dev/yishai-snake';

http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    // Verify secret if configured
    if (SECRET) {
      const crypto = require('crypto');
      const sig = req.headers['x-hub-signature-256'] || '';
      const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
      if (sig !== expected) {
        console.log('[webhook] Invalid signature');
        res.writeHead(401);
        res.end('Invalid signature');
        return;
      }
    }

    try {
      const payload = JSON.parse(body);
      const ref = payload.ref || '';
      if (!ref.endsWith('/master') && !ref.endsWith('/main')) {
        res.writeHead(200);
        res.end('Ignored (not master/main)');
        return;
      }

      console.log(`[webhook] Push to ${ref} — pulling and deploying...`);

      // Pull
      execSync(`git -C ${REPO_DIR} fetch origin master && git -C ${REPO_DIR} reset --hard origin/master`, { timeout: 30000 });

      // Deploy (cache bust)
      execSync(`cd ${REPO_DIR} && bash deploy.sh`, { timeout: 15000 });

      console.log('[webhook] Deploy complete');
      res.writeHead(200);
      res.end('Deployed');
    } catch (err) {
      console.error('[webhook] Error:', err.message);
      res.writeHead(500);
      res.end(err.message);
    }
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Snake webhook on port ${PORT}`);
});
