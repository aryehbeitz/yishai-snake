const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3461;
const SECRET = process.env.WEBHOOK_SECRET || '';
const REPO_DIR = '/home/admin/dev/yishai-snake';
const CHANGELOG = path.join(REPO_DIR, 'changelog.json');
const GIT = `git -C ${REPO_DIR}`;

let deploying = false;

function getLatestVersion() {
  try {
    const data = JSON.parse(fs.readFileSync(CHANGELOG, 'utf8'));
    return data[0]?.version || '1.0.0';
  } catch { return '1.0.0'; }
}

function bumpPatch(ver) {
  const parts = ver.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

function generateHebrewChanges(commits) {
  const filtered = commits.filter(c => !c.startsWith('Merge') && !c.startsWith('snake-agent:') && !c.startsWith('auto:'));
  if (!filtered.length) return null;
  try {
    const prompt = `תרגם את הודעות הקומיט הבאות לתיאורי שינויים בעברית. כל שורה = שינוי אחד. ללא מספור, ללא מקף, רק טקסט בעברית. תמציתי וברור.\n\n${filtered.join('\n')}`;
    const result = execSync(
      `docker exec -i yishai-snake claude -p --model haiku`,
      { input: prompt, encoding: 'utf8', timeout: 30000 }
    ).trim();
    return result.split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
  } catch (err) {
    console.error('[webhook] Claude changelog generation failed:', err.message);
    return filtered.map(c => c.slice(0, 120));
  }
}

function updateChangelog(commits) {
  const changes = generateHebrewChanges(commits);
  if (!changes || !changes.length) return false;

  const data = JSON.parse(fs.readFileSync(CHANGELOG, 'utf8'));
  const newVer = bumpPatch(getLatestVersion());
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jerusalem' }).replace(' ', 'T').slice(0, 19);

  data.unshift({ version: newVer, date: now, changes });
  fs.writeFileSync(CHANGELOG, JSON.stringify(data, null, 2));
  console.log(`[webhook] Changelog updated: v${newVer} with ${changes.length} changes`);
  return true;
}

function getNewCommitMessages(beforeSha, afterSha) {
  try {
    const log = execSync(`${GIT} log --oneline ${beforeSha}..${afterSha} --format=%s`, { encoding: 'utf8', timeout: 5000 });
    return log.trim().split('\n').filter(Boolean);
  } catch { return []; }
}

function changelogUpdatedInPush(beforeSha, afterSha) {
  try {
    const diff = execSync(`${GIT} diff --name-only ${beforeSha}..${afterSha}`, { encoding: 'utf8', timeout: 5000 });
    return diff.includes('changelog.json');
  } catch { return false; }
}

http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    if (SECRET) {
      const crypto = require('crypto');
      const sig = req.headers['x-hub-signature-256'] || '';
      const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
      if (sig !== expected) {
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
        res.end('Ignored');
        return;
      }

      // Prevent re-entry from our own push
      if (deploying) {
        res.writeHead(200);
        res.end('Already deploying');
        return;
      }
      deploying = true;

      const before = payload.before;
      const after = payload.after;
      console.log(`[webhook] Push to ${ref} (${before?.slice(0,7)}..${after?.slice(0,7)}) — pulling...`);

      // Pull
      execSync(`${GIT} fetch origin master && ${GIT} reset --hard origin/master`, { timeout: 30000 });

      // Check if changelog needs updating
      if (before && after && !changelogUpdatedInPush(before, after)) {
        const commits = getNewCommitMessages(before, after);
        if (updateChangelog(commits)) {
          // Deploy first (cache bust), then commit and push
          execSync(`cd ${REPO_DIR} && bash deploy.sh`, { timeout: 15000 });
          execSync(`${GIT} add changelog.json && ${GIT} commit -m "auto: update changelog"`, { timeout: 10000 });
          execSync(`${GIT} push origin master`, { timeout: 15000 });
          console.log('[webhook] Changelog committed and pushed');
        }
      }

      // Deploy (cache bust)
      execSync(`cd ${REPO_DIR} && bash deploy.sh`, { timeout: 15000 });

      console.log('[webhook] Deploy complete');
      res.writeHead(200);
      res.end('Deployed');
    } catch (err) {
      console.error('[webhook] Error:', err.message);
      res.writeHead(500);
      res.end(err.message);
    } finally {
      deploying = false;
    }
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Snake webhook on port ${PORT}`);
});
