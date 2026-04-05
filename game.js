/* ===== STATE & CONFIG ===== */
const CELL = 20;
const MODES = {
  classic:   { he: 'קלאסי',   desc: 'נחש קלאסי - אכול, גדל, הישרד!', defaultSpeed: 7, obstacles: false, colorful: false },
  obstacles: { he: 'מכשולים', desc: 'סלעים אקראיים בכל משחק',           defaultSpeed: 6, obstacles: true,  colorful: false },
  colorful:  { he: 'צבעוני',  desc: 'גרסה צבעונית ומיוחדת',             defaultSpeed: 7, obstacles: false, colorful: true },
};

const SNAKE_COLORS = [
  '#39ff14', '#00ffff', '#ff00ff', '#ff4444',
  '#ffd700', '#ff8c00', '#7b68ee', '#00ff7f',
];

let state = {
  currentUser: localStorage.getItem('snakeUser') || '',
  settings: loadSettings(),
  currentMode: null,
  game: null,
};

function loadSettings() {
  const def = {
    speeds: { classic: 7, obstacles: 6, colorful: 7 },
    sound: true,
    snakeColor: '#39ff14',
    startLength: 3,
  };
  try {
    const s = JSON.parse(localStorage.getItem('snakeSettings'));
    return s ? { ...def, ...s, speeds: { ...def.speeds, ...(s.speeds || {}) } } : def;
  } catch { return def; }
}
function saveSettings() { localStorage.setItem('snakeSettings', JSON.stringify(state.settings)); }

function getScores() {
  try { return JSON.parse(localStorage.getItem('snakeScores')) || {}; } catch { return {}; }
}
function getBest(user, mode) {
  const s = getScores();
  return (s[user] && s[user][mode]) || 0;
}
const API_BASE = '/api';

function saveBest(user, mode, score) {
  // Save locally
  const s = getScores();
  if (!s[user]) s[user] = {};
  const isNew = score > (s[user][mode] || 0);
  if (isNew) {
    s[user][mode] = score;
    localStorage.setItem('snakeScores', JSON.stringify(s));
  }
  // Persist to server
  fetch(`${API_BASE}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, mode, score }),
  }).catch(() => {});
  return isNew;
}

function getLeaderboard(mode, limit = 3) {
  const s = getScores();
  const entries = [];
  for (const user in s) {
    if (s[user][mode]) entries.push({ user, score: s[user][mode] });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, limit);
}

// Sync scores from server on load
function syncScoresFromServer() {
  fetch(`${API_BASE}/scores`).then(r => r.json()).then(remote => {
    const local = getScores();
    let changed = false;
    for (const user in remote) {
      if (!local[user]) { local[user] = remote[user]; changed = true; continue; }
      for (const mode in remote[user]) {
        if ((remote[user][mode] || 0) > (local[user][mode] || 0)) {
          local[user][mode] = remote[user][mode];
          changed = true;
        }
      }
    }
    if (changed) {
      localStorage.setItem('snakeScores', JSON.stringify(local));
      renderHome();
    }
  }).catch(() => {});
}
syncScoresFromServer();

/* ===== AUDIO ===== */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playSound(type) {
  if (!state.settings.sound) return;
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'eat') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'die') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {}
}

/* ===== CARD THUMBNAILS ===== */
function drawCardThumbnail(canvasId, mode) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  c.width = c.offsetWidth * (window.devicePixelRatio || 1);
  c.height = c.offsetHeight * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  const w = c.offsetWidth, h = c.offsetHeight;

  // BG grid
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1a1a2e44';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 15) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // Draw a sample snake
  const snakeColor = mode === 'colorful' ? null : state.settings.snakeColor;
  const segments = [];
  const startX = w * 0.3, startY = h * 0.5;
  for (let i = 0; i < 8; i++) {
    segments.push({ x: startX + i * 14, y: startY + Math.sin(i * 0.8) * 20 });
  }
  segments.reverse();
  segments.forEach((s, i) => {
    if (mode === 'colorful') {
      const hue = (i * 40 + Date.now() / 20) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 55%)`;
    } else {
      ctx.fillStyle = snakeColor;
      ctx.globalAlpha = 0.5 + (i / segments.length) * 0.5;
    }
    ctx.beginPath();
    ctx.roundRect(s.x - 6, s.y - 6, 12, 12, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Food
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(w * 0.75, h * 0.35, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff444444';
  ctx.beginPath();
  ctx.arc(w * 0.75, h * 0.35, 10, 0, Math.PI * 2);
  ctx.fill();

  // Obstacles
  if (mode === 'obstacles') {
    const rocks = [[w*0.2, h*0.25], [w*0.6, h*0.7], [w*0.8, h*0.6], [w*0.4, h*0.3]];
    rocks.forEach(([rx, ry]) => {
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.roundRect(rx - 8, ry - 8, 16, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.roundRect(rx - 5, ry - 5, 6, 6, 2);
      ctx.fill();
    });
  }

  // Colorful particles
  if (mode === 'colorful') {
    for (let i = 0; i < 15; i++) {
      const hue = Math.random() * 360;
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.3)`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 5 + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ===== HOME SCREEN ===== */
function renderHome() {
  const homeEl = document.getElementById('home-screen');
  const gameEl = document.getElementById('game-screen');
  homeEl.style.display = '';
  gameEl.classList.remove('active');

  renderUser();
  renderCards();
  setTimeout(() => {
    for (const m in MODES) drawCardThumbnail('thumb-' + m, m);
  }, 50);
}

function renderUser() {
  const sec = document.getElementById('user-section');
  if (!state.currentUser) {
    sec.innerHTML = `
      <input id="username-input" type="text" placeholder="הכנס שם..." maxlength="20">
      <button class="user-btn" onclick="loginUser()">כניסה</button>
    `;
    document.getElementById('username-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') loginUser();
    });
  } else {
    const scores = Object.keys(MODES).map(m => {
      const b = getBest(state.currentUser, m);
      return `<span>${MODES[m].he}: ${b}</span>`;
    }).join('');
    sec.innerHTML = `
      <div class="user-info">
        <span class="user-name">${state.currentUser}</span>
        <div class="user-scores">${scores}</div>
        <button class="user-logout" onclick="logoutUser()">יציאה</button>
      </div>
    `;
  }
}

function renderCards() {
  const container = document.getElementById('cards-container');
  container.innerHTML = '';
  for (const m in MODES) {
    const mode = MODES[m];
    const best = state.currentUser ? getBest(state.currentUser, m) : 0;
    const lb = getLeaderboard(m);
    let lbHtml = '';
    if (lb.length) {
      lbHtml = '<div class="card-leaderboard">' +
        lb.map((e, i) => `<div><span class="lb-name">${['🥇','🥈','🥉'][i] || ''} ${e.user}</span><span class="lb-score">${e.score}</span></div>`).join('') +
        '</div>';
    }
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => startGame(m);
    card.innerHTML = `
      <div class="card-thumb"><canvas id="thumb-${m}"></canvas></div>
      <div class="card-body">
        <h3>${mode.he}</h3>
        <p>${mode.desc}</p>
        ${state.currentUser && best ? `<div class="card-best">השיא שלך: ${best}</div>` : ''}
      </div>
      ${lbHtml}
    `;
    container.appendChild(card);
  }
}

function loginUser() {
  const input = document.getElementById('username-input');
  const name = (input.value || '').trim();
  if (!name) return;
  state.currentUser = name;
  localStorage.setItem('snakeUser', name);
  renderHome();
}
function logoutUser() {
  state.currentUser = '';
  localStorage.removeItem('snakeUser');
  renderHome();
}

/* ===== SETTINGS ===== */
function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
  renderSettingsContent();
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-panel').classList.remove('open');
}

function renderSettingsContent() {
  const panel = document.getElementById('settings-content');
  const s = state.settings;
  let html = '';

  // Speed per mode
  for (const m in MODES) {
    html += `
      <div class="setting-group">
        <label>מהירות - ${MODES[m].he} <span class="range-value" id="speed-val-${m}">${s.speeds[m]}</span></label>
        <input type="range" min="3" max="15" value="${s.speeds[m]}" oninput="updateSpeed('${m}', this.value)">
      </div>
    `;
  }

  // Sound
  html += `
    <div class="setting-group">
      <div class="toggle-row">
        <label>צלילים</label>
        <button class="toggle ${s.sound ? 'on' : ''}" onclick="toggleSound(this)"></button>
      </div>
    </div>
  `;

  // Snake color
  html += `<div class="setting-group"><label>צבע נחש</label><div class="color-picker-row">`;
  SNAKE_COLORS.forEach(c => {
    html += `<div class="color-swatch ${s.snakeColor === c ? 'selected' : ''}" style="background:${c}" onclick="pickColor('${c}', this)"></div>`;
  });
  html += `</div></div>`;

  // Start length
  html += `
    <div class="setting-group">
      <label>אורך התחלתי <span class="range-value" id="length-val">${s.startLength}</span></label>
      <input type="range" min="2" max="8" value="${s.startLength}" oninput="updateLength(this.value)">
    </div>
  `;

  panel.innerHTML = html;
}

function updateSpeed(mode, val) {
  state.settings.speeds[mode] = parseInt(val);
  document.getElementById('speed-val-' + mode).textContent = val;
  saveSettings();
}
function toggleSound(btn) {
  state.settings.sound = !state.settings.sound;
  btn.classList.toggle('on');
  saveSettings();
}
function pickColor(color, el) {
  state.settings.snakeColor = color;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  saveSettings();
  // Update thumbnails
  for (const m in MODES) drawCardThumbnail('thumb-' + m, m);
}
function updateLength(val) {
  state.settings.startLength = parseInt(val);
  document.getElementById('length-val').textContent = val;
  saveSettings();
}

/* ===== GAME ENGINE ===== */
function startGame(mode) {
  state.currentMode = mode;
  document.getElementById('home-screen').style.display = 'none';
  const gs = document.getElementById('game-screen');
  gs.classList.add('active');

  const modeConf = MODES[mode];
  document.getElementById('game-mode-title').textContent = modeConf.he;
  document.getElementById('game-score-display').textContent = '0';

  const canvas = document.getElementById('gameCanvas');
  const wrap = document.querySelector('.game-canvas-wrap');

  // Size canvas
  const maxW = Math.min(window.innerWidth - 20, 600);
  const maxH = Math.min(window.innerHeight - 200, 600);
  const cols = Math.floor(maxW / CELL);
  const rows = Math.floor(maxH / CELL);
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';

  const ctx = canvas.getContext('2d');

  const game = {
    cols, rows, ctx, canvas,
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: null,
    obstacles: [],
    score: 0,
    running: false,
    over: false,
    interval: null,
    speed: state.settings.speeds[mode],
    colorful: modeConf.colorful,
    foodParticles: [],
    frameId: null,
  };
  state.game = game;

  // Init snake
  const startLen = state.settings.startLength;
  const startY = Math.floor(rows / 2);
  const startX = Math.floor(cols / 4);
  for (let i = 0; i < startLen; i++) {
    game.snake.push({ x: startX - i, y: startY });
  }

  // Generate obstacles
  if (modeConf.obstacles) {
    const count = Math.floor((cols * rows) * 0.03);
    for (let i = 0; i < count; i++) {
      let ox, oy, tries = 0;
      do {
        ox = Math.floor(Math.random() * cols);
        oy = Math.floor(Math.random() * rows);
        tries++;
      } while (tries < 100 && (
        game.snake.some(s => s.x === ox && s.y === oy) ||
        game.obstacles.some(o => o.x === ox && o.y === oy) ||
        (Math.abs(ox - startX) < 5 && Math.abs(oy - startY) < 3)
      ));
      if (tries < 100) game.obstacles.push({ x: ox, y: oy });
    }
  }

  spawnFood(game);
  showOverlay('start');
}

function reshuffleObstacles(game) {
  game.obstacles = [];
  const count = Math.floor((game.cols * game.rows) * 0.03);
  const head = game.snake[0];
  const dir = game.dir;
  // Build set of 7 tiles ahead of the snake head (safe zone)
  const safeSet = new Set();
  for (let i = 1; i <= 7; i++) {
    safeSet.add(`${head.x + dir.x * i},${head.y + dir.y * i}`);
  }
  for (let i = 0; i < count; i++) {
    let ox, oy, tries = 0;
    do {
      ox = Math.floor(Math.random() * game.cols);
      oy = Math.floor(Math.random() * game.rows);
      tries++;
    } while (tries < 100 && (
      game.snake.some(s => s.x === ox && s.y === oy) ||
      game.obstacles.some(o => o.x === ox && o.y === oy) ||
      safeSet.has(`${ox},${oy}`)
    ));
    if (tries < 100) game.obstacles.push({ x: ox, y: oy });
  }
}

function spawnFood(game) {
  let fx, fy, tries = 0;
  do {
    fx = Math.floor(Math.random() * game.cols);
    fy = Math.floor(Math.random() * game.rows);
    tries++;
  } while (tries < 500 && (
    game.snake.some(s => s.x === fx && s.y === fy) ||
    game.obstacles.some(o => o.x === fx && o.y === fy)
  ));
  game.food = { x: fx, y: fy };
}

function showOverlay(type) {
  const overlay = document.getElementById('game-overlay');
  overlay.classList.remove('hidden');
  const game = state.game;
  if (type === 'start') {
    overlay.innerHTML = `
      <h2>🐍 ${MODES[state.currentMode].he}</h2>
      <button onclick="resumeGame()">התחל!</button>
    `;
  } else if (type === 'gameover') {
    const isRecord = state.currentUser && saveBest(state.currentUser, state.currentMode, game.score);
    overlay.innerHTML = `
      <h2>נגמר!</h2>
      <div class="final-score">ניקוד: ${game.score}</div>
      ${isRecord ? '<div class="new-record">שיא חדש! 🎉</div>' : ''}
      <button onclick="restartGame()">שחק שוב</button>
      <button onclick="backToHome()">חזרה</button>
    `;
  }
}

function resumeGame() {
  const overlay = document.getElementById('game-overlay');
  overlay.classList.add('hidden');
  const game = state.game;
  game.running = true;
  game.over = false;
  playSound('start');
  // Ensure audio context is resumed on user interaction
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  game.interval = setInterval(() => gameTick(game), 1000 / game.speed);
  if (!game.frameId) renderLoop();
}

function restartGame() {
  const game = state.game;
  if (game.interval) clearInterval(game.interval);
  if (game.frameId) cancelAnimationFrame(game.frameId);
  startGame(state.currentMode);
}

function backToHome() {
  const game = state.game;
  if (game) {
    if (game.interval) clearInterval(game.interval);
    if (game.frameId) cancelAnimationFrame(game.frameId);
  }
  state.game = null;
  renderHome();
}

function gameTick(game) {
  if (!game.running) return;

  game.dir = { ...game.nextDir };
  const head = game.snake[0];
  const newHead = { x: head.x + game.dir.x, y: head.y + game.dir.y };

  // Wall collision
  if (newHead.x < 0 || newHead.x >= game.cols || newHead.y < 0 || newHead.y >= game.rows) {
    gameOver(game);
    return;
  }

  // Self collision
  if (game.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
    gameOver(game);
    return;
  }

  // Obstacle collision
  if (game.obstacles.some(o => o.x === newHead.x && o.y === newHead.y)) {
    gameOver(game);
    return;
  }

  game.snake.unshift(newHead);

  // Eat food
  if (newHead.x === game.food.x && newHead.y === game.food.y) {
    game.score += 10;
    document.getElementById('game-score-display').textContent = game.score;
    playSound('eat');
    // Particles
    for (let i = 0; i < 6; i++) {
      game.foodParticles.push({
        x: game.food.x * CELL + CELL / 2,
        y: game.food.y * CELL + CELL / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 20,
        color: game.colorful ? `hsl(${Math.random()*360},100%,60%)` : '#ff4444',
      });
    }
    // Reshuffle obstacles in obstacles mode
    if (MODES[state.currentMode].obstacles) {
      reshuffleObstacles(game);
    }
    spawnFood(game);
    // Speed up slightly
    if (game.score % 50 === 0 && game.speed < 18) {
      game.speed += 0.5;
      clearInterval(game.interval);
      game.interval = setInterval(() => gameTick(game), 1000 / game.speed);
    }
  } else {
    game.snake.pop();
  }
}

function gameOver(game) {
  game.running = false;
  game.over = true;
  clearInterval(game.interval);
  playSound('die');
  if (state.currentUser) saveBest(state.currentUser, state.currentMode, game.score);
  setTimeout(() => showOverlay('gameover'), 300);
}

/* ===== RENDERING ===== */
function renderLoop() {
  const game = state.game;
  if (!game) return;
  drawGame(game);
  game.frameId = requestAnimationFrame(renderLoop);
}

function drawGame(game) {
  const { ctx, canvas, cols, rows, snake, food, obstacles, colorful, foodParticles } = game;

  // Clear
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines (subtle)
  ctx.strokeStyle = '#1a1a2e33';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, rows * CELL); ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(cols * CELL, y * CELL); ctx.stroke();
  }

  // Obstacles
  obstacles.forEach(o => {
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.roundRect(o.x * CELL + 1, o.y * CELL + 1, CELL - 2, CELL - 2, 3);
    ctx.fill();
    ctx.fillStyle = '#777';
    ctx.beginPath();
    ctx.roundRect(o.x * CELL + 3, o.y * CELL + 3, 6, 6, 2);
    ctx.fill();
  });

  // Snake
  snake.forEach((s, i) => {
    const isHead = i === 0;
    if (colorful) {
      const hue = (i * 25 + Date.now() / 50) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, ${isHead ? 65 : 55}%)`;
    } else {
      ctx.fillStyle = state.settings.snakeColor;
      ctx.globalAlpha = 0.5 + (1 - i / snake.length) * 0.5;
    }
    const pad = isHead ? 0 : 1;
    ctx.beginPath();
    ctx.roundRect(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, isHead ? 5 : 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Eyes on head
    if (isHead) {
      ctx.fillStyle = '#111';
      const ex = game.dir.x, ey = game.dir.y;
      const cx = s.x * CELL + CELL / 2;
      const cy = s.y * CELL + CELL / 2;
      if (ex !== 0) {
        ctx.beginPath(); ctx.arc(cx + ex * 4, cy - 4, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + ex * 4, cy + 4, 2.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(cx - 4, cy + ey * 4, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 4, cy + ey * 4, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  });

  // Food
  if (food) {
    const fx = food.x * CELL + CELL / 2;
    const fy = food.y * CELL + CELL / 2;
    // Glow
    const pulse = Math.sin(Date.now() / 200) * 2 + 8;
    ctx.fillStyle = colorful ? `hsla(${Date.now()/10%360},100%,60%,0.2)` : '#ff444433';
    ctx.beginPath();
    ctx.arc(fx, fy, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
    // Core
    ctx.fillStyle = colorful ? `hsl(${Date.now()/10%360},100%,55%)` : '#ff4444';
    ctx.beginPath();
    ctx.arc(fx, fy, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles
  for (let i = foodParticles.length - 1; i >= 0; i--) {
    const p = foodParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) { foodParticles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life / 20;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Game over flash
  if (game.over) {
    ctx.fillStyle = '#ff000022';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

/* ===== INPUT ===== */
document.addEventListener('keydown', e => {
  const game = state.game;
  if (!game || !game.running) return;

  const key = e.key;
  const d = game.dir;
  if ((key === 'ArrowUp' || key === 'w') && d.y !== 1) { game.nextDir = { x: 0, y: -1 }; e.preventDefault(); }
  else if ((key === 'ArrowDown' || key === 's') && d.y !== -1) { game.nextDir = { x: 0, y: 1 }; e.preventDefault(); }
  else if ((key === 'ArrowLeft' || key === 'a') && d.x !== 1) { game.nextDir = { x: -1, y: 0 }; e.preventDefault(); }
  else if ((key === 'ArrowRight' || key === 'd') && d.x !== -1) { game.nextDir = { x: 1, y: 0 }; e.preventDefault(); }
});

// Touch / swipe
let touchStart = null;
document.addEventListener('touchstart', e => {
  if (!state.game || !state.game.running) return;
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!touchStart || !state.game || !state.game.running) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  const d = state.game.dir;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && d.x !== -1) state.game.nextDir = { x: 1, y: 0 };
    else if (dx < 0 && d.x !== 1) state.game.nextDir = { x: -1, y: 0 };
  } else {
    if (dy > 0 && d.y !== -1) state.game.nextDir = { x: 0, y: 1 };
    else if (dy < 0 && d.y !== 1) state.game.nextDir = { x: 0, y: -1 };
  }
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
document.addEventListener('touchend', () => { touchStart = null; }, { passive: true });

// Mobile buttons
function mobileDir(dx, dy) {
  const game = state.game;
  if (!game || !game.running) return;
  const d = game.dir;
  if (dx !== 0 && d.x !== -dx) game.nextDir = { x: dx, y: 0 };
  if (dy !== 0 && d.y !== -dy) game.nextDir = { x: 0, y: dy };
}

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', renderHome);
window.addEventListener('resize', () => {
  if (!state.game) {
    for (const m in MODES) drawCardThumbnail('thumb-' + m, m);
  }
});
