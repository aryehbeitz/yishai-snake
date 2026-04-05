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

const HEAD_SHAPES = {
  circle:   { he: 'עיגול' },
  square:   { he: 'ריבוע' },
  triangle: { he: 'משולש' },
  diamond:  { he: 'יהלום' },
};

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
    headColor: '#39ff14',
    snakeStyle: 'smooth',
    snakeThickness: 14,
    headSize: 1.3,       // auto: smooth=1.3, blocky=1.0
    headShape: 'circle', // auto: smooth=circle, blocky=square
    startLength: 3,
    boardSize: 'auto',   // 'auto', 'small', 'medium', 'large'
    ndBoardSize: 8,       // 6-12 for multi-dimensional
    motionControl: false,
    motionSensitivity: 15,
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
  const s = getScores();
  if (!s[user]) s[user] = {};
  const isNew = score > (s[user][mode] || 0);
  if (isNew) {
    s[user][mode] = score;
    localStorage.setItem('snakeScores', JSON.stringify(s));
  }
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
  const s = state.settings;
  const bodyColor = mode === 'colorful' ? null : s.snakeColor;
  const segments = [];
  const startX = w * 0.3, startY = h * 0.5;
  for (let i = 0; i < 8; i++) {
    segments.push({ x: startX + i * 14, y: startY + Math.sin(i * 0.8) * 20 });
  }
  segments.reverse();

  if (s.snakeStyle === 'smooth') {
    // Smooth body line
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s.snakeThickness * 0.6;
    if (mode === 'colorful') {
      // Draw segment by segment for rainbow
      for (let i = 0; i < segments.length - 1; i++) {
        const hue = (i * 40 + Date.now() / 20) % 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 55%)`;
        ctx.beginPath();
        ctx.moveTo(segments[i].x, segments[i].y);
        ctx.lineTo(segments[i + 1].x, segments[i + 1].y);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(segments[0].x, segments[0].y);
      for (let i = 1; i < segments.length; i++) {
        ctx.lineTo(segments[i].x, segments[i].y);
      }
      ctx.stroke();
    }
    // Head
    const head = segments[0];
    const headR = (s.snakeThickness * 0.6 * s.headSize) / 2;
    ctx.fillStyle = mode === 'colorful' ? `hsl(${Date.now() / 20 % 360}, 100%, 65%)` : s.headColor;
    drawHeadShape(ctx, head.x, head.y, headR, s.headShape, 1, 0);
  } else {
    // Blocky style (original)
    segments.forEach((seg, i) => {
      if (mode === 'colorful') {
        const hue = (i * 40 + Date.now() / 20) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 55%)`;
      } else {
        ctx.fillStyle = i === 0 ? s.headColor : bodyColor;
        ctx.globalAlpha = 0.5 + (i / segments.length) * 0.5;
      }
      ctx.beginPath();
      ctx.roundRect(seg.x - 6, seg.y - 6, 12, 12, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

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

/* ===== HEAD SHAPE DRAWING ===== */
function drawHeadShape(ctx, cx, cy, radius, shape, dirX, dirY) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  } else if (shape === 'square') {
    ctx.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, radius * 0.25);
  } else if (shape === 'triangle') {
    // Point in movement direction
    const angle = Math.atan2(dirY, dirX);
    for (let i = 0; i < 3; i++) {
      const a = angle + (i * 2 * Math.PI / 3) - Math.PI / 2;
      const px = cx + Math.cos(a) * radius * 1.2;
      const py = cy + Math.sin(a) * radius * 1.2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'diamond') {
    ctx.moveTo(cx, cy - radius * 1.15);
    ctx.lineTo(cx + radius * 0.85, cy);
    ctx.lineTo(cx, cy + radius * 1.15);
    ctx.lineTo(cx - radius * 0.85, cy);
    ctx.closePath();
  }
  ctx.fill();
}

/* ===== HOME SCREEN ===== */
function renderHome() {
  const homeEl = document.getElementById('home-screen');
  const gameEl = document.getElementById('game-screen');
  document.getElementById('nd-screen').classList.remove('active');
  document.getElementById('ai-screen').classList.remove('active');
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
  const s = state.settings;

  // Classic modes
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
    card.innerHTML = `
      <div class="card-thumb" onclick="startGame('${m}')"><canvas id="thumb-${m}"></canvas></div>
      <div class="card-body" onclick="startGame('${m}')">
        <h3>${mode.he}</h3>
        <p>${mode.desc}</p>
        ${state.currentUser && best ? `<div class="card-best">השיא שלך: ${best}</div>` : ''}
      </div>
      ${lbHtml}
      <div class="card-actions">
        <button class="card-play-btn" onclick="startGame('${m}')">שחק</button>
        <button class="card-auto-btn" onclick="event.stopPropagation();startAiGame('bfs','${m}')">אוטומטי</button>
        <button class="card-settings-toggle" onclick="event.stopPropagation();toggleCardSettings('card-settings-${m}')">&#9881;</button>
      </div>
      <div class="card-settings" id="card-settings-${m}">
        <div class="card-setting-row"><label>מהירות</label><input type="range" min="3" max="15" value="${s.speeds[m]}" oninput="updateSpeed('${m}', this.value)"><span class="range-value" id="speed-val-${m}">${s.speeds[m]}</span></div>
      </div>
    `;
    container.appendChild(card);
  }

  // Section: Multi-dimensional
  const ndTitle = document.createElement('div');
  ndTitle.className = 'cards-section-title';
  ndTitle.textContent = 'רב-ממדי';
  container.appendChild(ndTitle);

  const ND_MODES = {
    '3d': { he: 'תלת ממד', desc: 'נחש בחלל תלת ממדי (X,Y,Z)', dims: 3, icon: '🧊' },
    '4d': { he: 'ארבע ממד', desc: '4 צירים — W מצטרף למשחק', dims: 4, icon: '🌀' },
    '5d': { he: 'חמש ממד', desc: '5 צירים — אתגר מוחי מטורף', dims: 5, icon: '🔮' },
  };
  for (const m in ND_MODES) {
    const mode = ND_MODES[m];
    const best = state.currentUser ? getBest(state.currentUser, 'nd_' + m) : 0;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-thumb" onclick="startNdGame(${mode.dims})" style="display:flex;align-items:center;justify-content:center;font-size:4rem;background:#111;">${mode.icon}</div>
      <div class="card-body" onclick="startNdGame(${mode.dims})">
        <h3>${mode.he}</h3>
        <p>${mode.desc}</p>
        ${state.currentUser && best ? `<div class="card-best">השיא שלך: ${best}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="card-play-btn" onclick="startNdGame(${mode.dims})">שחק</button>
        <button class="card-auto-btn" onclick="event.stopPropagation();startNdAutoGame(${mode.dims})">אוטומטי</button>
        <button class="card-settings-toggle" onclick="event.stopPropagation();toggleCardSettings('card-settings-nd${m}')">&#9881;</button>
      </div>
      <div class="card-settings" id="card-settings-nd${m}">
        <div class="card-setting-row"><label>גודל לוח</label><input type="range" min="6" max="12" value="${s.ndBoardSize}" oninput="updateNdBoardSize(this.value)"><span class="range-value" id="ndsize-val-${m}">${s.ndBoardSize}</span></div>
      </div>
    `;
    container.appendChild(card);
  }

  // Section: AI
  const aiTitle = document.createElement('div');
  aiTitle.className = 'cards-section-title';
  aiTitle.textContent = 'AI אוטומטי';
  container.appendChild(aiTitle);

  const aiCard = document.createElement('div');
  aiCard.className = 'card';
  aiCard.innerHTML = `
    <div class="card-thumb" onclick="startAiGame('bfs')" style="display:flex;align-items:center;justify-content:center;font-size:4rem;background:#111;">🧠</div>
    <div class="card-body" onclick="startAiGame('bfs')">
      <h3>AI — BFS</h3>
      <p>מסלול קצר ביותר לתפוח</p>
    </div>
    <div class="card-actions">
      <button class="card-play-btn" onclick="startAiGame('bfs')">הפעל</button>
    </div>
  `;
  container.appendChild(aiCard);
}

function toggleCardSettings(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
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
  stopCalibration();
}

function renderSettingsContent() {
  const panel = document.getElementById('settings-content');
  const s = state.settings;
  let html = '';
  const motionAvailable = window.DeviceOrientationEvent !== undefined;

  // Helper: collapsible folder
  function folder(id, title, icon, open, content) {
    return `<div class="settings-folder ${open ? 'open' : ''}" id="folder-${id}">
      <button class="settings-folder-header" onclick="toggleFolder('${id}')">
        <span>${icon} ${title}</span><span class="folder-arrow">&#9662;</span>
      </button>
      <div class="settings-folder-body">${content}</div>
    </div>`;
  }

  // === 1. Gameplay ===
  let gameplay = '';
  for (const m in MODES) {
    gameplay += `<div class="setting-group"><label>מהירות - ${MODES[m].he} <span class="range-value" id="speed-val-${m}">${s.speeds[m]}</span></label><input type="range" min="3" max="15" value="${s.speeds[m]}" oninput="updateSpeed('${m}', this.value)"></div>`;
  }
  gameplay += `<div class="setting-group"><label>אורך התחלתי <span class="range-value" id="length-val">${s.startLength}</span></label><input type="range" min="2" max="8" value="${s.startLength}" oninput="updateLength(this.value)"></div>`;
  gameplay += `<div class="setting-group"><div class="toggle-row"><label>צלילים</label><button class="toggle ${s.sound ? 'on' : ''}" onclick="toggleSound(this)"></button></div></div>`;
  html += folder('gameplay', 'משחק', '🎮', true, gameplay);

  // === 2. Board Size ===
  let board = '';
  const boardLabels = { auto: 'אוטומטי', small: 'קטן', medium: 'בינוני', large: 'גדול' };
  board += `<div class="setting-group"><label>מצב רגיל</label><div class="style-picker-row">`;
  for (const sz in boardLabels) {
    board += `<button class="style-btn ${s.boardSize === sz ? 'selected' : ''}" onclick="pickBoardSize('${sz}', this)">${boardLabels[sz]}</button>`;
  }
  board += `</div></div>`;
  board += `<div class="setting-group"><label>רב-ממדי <span class="range-value" id="ndsize-val">${s.ndBoardSize}×${s.ndBoardSize}</span></label><input type="range" min="6" max="12" value="${s.ndBoardSize}" oninput="updateNdBoardSize(this.value)"></div>`;
  html += folder('board', 'גודל לוח', '📐', false, board);

  // === 3. Snake Appearance ===
  let appearance = '';
  appearance += `<div class="setting-group"><label>סגנון</label><div class="style-picker-row"><button class="style-btn ${s.snakeStyle === 'smooth' ? 'selected' : ''}" onclick="pickStyle('smooth', this)">רצוף</button><button class="style-btn ${s.snakeStyle === 'blocky' ? 'selected' : ''}" onclick="pickStyle('blocky', this)">חלקים</button></div></div>`;
  appearance += `<div class="setting-group"><label>עובי <span class="range-value" id="thickness-val">${s.snakeThickness}</span></label><input type="range" min="6" max="20" value="${s.snakeThickness}" oninput="updateThickness(this.value)"></div>`;
  appearance += `<div class="setting-group"><label>צבע נחש</label><div class="color-picker-row" id="body-color-row">`;
  SNAKE_COLORS.forEach(c => {
    appearance += `<div class="color-swatch ${s.snakeColor === c ? 'selected' : ''}" style="background:${c}" onclick="pickBodyColor('${c}', this)"></div>`;
  });
  appearance += `</div></div>`;
  appearance += `<div class="setting-group"><label>תצוגה מקדימה</label><canvas id="snake-preview" width="280" height="80" style="width:100%;border-radius:8px;background:#111;border:1px solid var(--neon-dim);"></canvas></div>`;
  html += folder('appearance', 'מראה הנחש', '🐍', false, appearance);

  // === 4. Motion Control ===
  if (motionAvailable) {
    let motion = '';
    motion += `<div class="setting-group"><div class="toggle-row"><label>שליטה בהטיית הטלפון</label><button class="toggle ${s.motionControl ? 'on' : ''}" id="motion-toggle" onclick="toggleMotion(this)"></button></div><div class="sub-label">הטה את הטלפון כדי לשלוט בנחש</div></div>`;
    motion += `<div class="setting-group" id="motion-sensitivity-group" style="${s.motionControl ? '' : 'opacity:0.4;pointer-events:none'}"><label>רגישות הטיה <span class="range-value" id="sensitivity-val">${s.motionSensitivity}</span></label><input type="range" min="5" max="35" value="${s.motionSensitivity}" oninput="updateMotionSensitivity(this.value)"></div>`;
    motion += `<div class="setting-group" id="motion-calibration-group" style="${s.motionControl ? '' : 'opacity:0.4;pointer-events:none'}"><label>כיול תנועה</label><div class="sub-label" id="calib-status">הטה את הטלפון כדי להזיז את הכדור לכל 4 הפינות</div><canvas id="calib-canvas" width="280" height="200" style="width:100%;border-radius:8px;background:#111;border:1px solid var(--neon-dim);margin-top:.5rem;touch-action:none;"></canvas><button class="calib-reset-btn" onclick="resetCalibration()">אפס כיול</button></div>`;
    html += folder('motion', 'שליטה בתנועה', '📱', false, motion);
  }

  panel.innerHTML = html;

  // Draw preview after DOM update
  setTimeout(drawSnakePreview, 10);
  // Start calibration canvas if motion is enabled
  if (motionAvailable && s.motionControl) {
    setTimeout(startCalibration, 50);
  }
}

function drawSnakePreview() {
  const c = document.getElementById('snake-preview');
  if (!c) return;
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);

  const s = state.settings;
  const segments = [];
  for (let i = 0; i < 10; i++) {
    segments.push({ x: 30 + i * 24, y: h / 2 + Math.sin(i * 0.7) * 15 });
  }
  segments.reverse();

  if (s.snakeStyle === 'smooth') {
    drawSmoothSnake(ctx, segments, s.snakeColor, s.headColor, s.snakeThickness, s.headSize, s.headShape, false, 1, 0);
  } else {
    drawBlockySnake(ctx, segments, s.snakeColor, s.headColor, s.snakeThickness, s.headSize, s.headShape, false, 1, 0);
  }
}

function toggleFolder(id) {
  const folder = document.getElementById('folder-' + id);
  if (folder) folder.classList.toggle('open');
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
function pickStyle(style, el) {
  state.settings.snakeStyle = style;
  // Auto-set head shape and size based on style
  if (style === 'smooth') {
    state.settings.headShape = 'circle';
    state.settings.headSize = 1.3;
  } else {
    state.settings.headShape = 'square';
    state.settings.headSize = 1.0;
  }
  document.querySelectorAll('.style-picker-row .style-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  saveSettings();
  drawSnakePreview();
  for (const m in MODES) drawCardThumbnail('thumb-' + m, m);
}
function pickBodyColor(color, el) {
  state.settings.snakeColor = color;
  state.settings.headColor = color;
  document.querySelectorAll('#body-color-row .color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  saveSettings();
  drawSnakePreview();
  for (const m in MODES) drawCardThumbnail('thumb-' + m, m);
}
function pickHeadColor(color, el) {
  state.settings.headColor = color;
  document.querySelectorAll('#head-color-row .color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  saveSettings();
  drawSnakePreview();
  for (const m in MODES) drawCardThumbnail('thumb-' + m, m);
}
function pickColor(color, el) {
  // Backward compat — maps to body color
  pickBodyColor(color, el);
}
function updateThickness(val) {
  state.settings.snakeThickness = parseInt(val);
  document.getElementById('thickness-val').textContent = val;
  saveSettings();
  drawSnakePreview();
}
function updateHeadSize(val) {
  state.settings.headSize = parseInt(val) / 10;
  document.getElementById('headsize-val').textContent = state.settings.headSize.toFixed(1);
  saveSettings();
  drawSnakePreview();
}
function pickHeadShape(shape, el) {
  state.settings.headShape = shape;
  el.parentElement.querySelectorAll('.style-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  saveSettings();
  drawSnakePreview();
  for (const m in MODES) drawCardThumbnail('thumb-' + m, m);
}
function updateLength(val) {
  state.settings.startLength = parseInt(val);
  document.getElementById('length-val').textContent = val;
  saveSettings();
}
function pickBoardSize(size, el) {
  state.settings.boardSize = size;
  el.parentElement.querySelectorAll('.style-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  saveSettings();
}
function updateNdBoardSize(val) {
  state.settings.ndBoardSize = parseInt(val);
  document.getElementById('ndsize-val').textContent = val + '×' + val;
  saveSettings();
}

/* ===== MOTION / GYROSCOPE CONTROL ===== */
let motionListenerActive = false;
let motionBaseline = null; // calibration: tilt when game starts

async function toggleMotion(btn) {
  const enabling = !state.settings.motionControl;

  if (enabling) {
    // iOS 13+ requires explicit permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') {
          alert('יש לאשר גישה לחיישן התנועה');
          return;
        }
      } catch {
        alert('לא ניתן לגשת לחיישן התנועה');
        return;
      }
    }
    // Quick test — check if events actually fire
    const works = await testMotionSensor();
    if (!works) {
      alert('המכשיר לא תומך בחיישן תנועה');
      return;
    }
  }

  state.settings.motionControl = enabling;
  btn.classList.toggle('on');
  saveSettings();

  // Enable/disable sensitivity slider + calibration
  ['motion-sensitivity-group', 'motion-calibration-group'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.opacity = enabling ? '' : '0.4';
      el.style.pointerEvents = enabling ? '' : 'none';
    }
  });

  if (enabling) {
    startMotionListener();
    startCalibration();
  } else {
    stopMotionListener();
    stopCalibration();
  }
}

function testMotionSensor() {
  return new Promise(resolve => {
    let received = false;
    function handler(e) {
      if (e.gamma !== null || e.beta !== null) received = true;
    }
    window.addEventListener('deviceorientation', handler);
    setTimeout(() => {
      window.removeEventListener('deviceorientation', handler);
      resolve(received);
    }, 500);
  });
}

function updateMotionSensitivity(val) {
  state.settings.motionSensitivity = parseInt(val);
  document.getElementById('sensitivity-val').textContent = val;
  saveSettings();
}

/* ===== CALIBRATION MINI-GAME ===== */
let calibState = null;
let calibAnimId = null;
let calibHandler = null;

function startCalibration() {
  const canvas = document.getElementById('calib-canvas');
  if (!canvas) return;
  stopCalibration();

  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cornerR = 22;
  const pad = cornerR + 4;

  calibState = {
    ctx, canvas, w, h,
    ballX: w / 2, ballY: h / 2,
    baseline: null,
    corners: [
      { x: pad,     y: pad,     hit: false, label: '1' },  // top-right (RTL)
      { x: w - pad, y: pad,     hit: false, label: '2' },  // top-left
      { x: w - pad, y: h - pad, hit: false, label: '3' },  // bottom-left
      { x: pad,     y: h - pad, hit: false, label: '4' },  // bottom-right
    ],
    cornerR,
    done: false,
  };

  calibHandler = (e) => {
    if (!calibState || calibState.done) return;
    const beta = e.beta;
    const gamma = e.gamma;
    if (beta === null || gamma === null) return;

    if (!calibState.baseline) {
      calibState.baseline = { beta, gamma };
      return;
    }

    const sens = state.settings.motionSensitivity;
    // Map tilt to ball position — scale factor: lower sensitivity = more movement per degree
    const scale = (40 - sens) * 0.15 + 1.5;
    const dg = gamma - calibState.baseline.gamma;
    const db = beta - calibState.baseline.beta;

    // Move ball — gamma is left-right, beta is forward-back
    calibState.ballX = calibState.w / 2 + dg * scale;
    calibState.ballY = calibState.h / 2 + db * scale;

    // Clamp to canvas
    calibState.ballX = Math.max(8, Math.min(calibState.w - 8, calibState.ballX));
    calibState.ballY = Math.max(8, Math.min(calibState.h - 8, calibState.ballY));

    // Check corner hits
    calibState.corners.forEach(c => {
      if (c.hit) return;
      const dist = Math.hypot(calibState.ballX - c.x, calibState.ballY - c.y);
      if (dist < calibState.cornerR + 8) {
        c.hit = true;
        playSound('eat');
      }
    });

    // Check if all done
    if (calibState.corners.every(c => c.hit) && !calibState.done) {
      calibState.done = true;
      playSound('start');
      const statusEl = document.getElementById('calib-status');
      if (statusEl) statusEl.textContent = '✓ כיול הושלם בהצלחה!';
    }
  };

  window.addEventListener('deviceorientation', calibHandler);
  drawCalibration();
}

function drawCalibration() {
  if (!calibState) return;
  const { ctx, w, h, ballX, ballY, corners, cornerR, done } = calibState;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = '#1a1a2e44';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // Corner targets
  corners.forEach((c, i) => {
    // Outer ring
    ctx.beginPath();
    ctx.arc(c.x, c.y, cornerR, 0, Math.PI * 2);
    if (c.hit) {
      ctx.fillStyle = '#39ff1433';
      ctx.fill();
      ctx.strokeStyle = '#39ff14';
    } else {
      ctx.fillStyle = '#ff444422';
      ctx.fill();
      // Pulsing ring for unhit corners
      const pulse = Math.sin(Date.now() / 300 + i) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(255, 68, 68, ${pulse})`;
    }
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dot / checkmark
    if (c.hit) {
      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', c.x, c.y);
    } else {
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
      // Number label
      ctx.fillStyle = '#ff444488';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.label, c.x, c.y - 12);
    }
  });

  // Crosshair at center (neutral position indicator)
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w/2 - 10, h/2); ctx.lineTo(w/2 + 10, h/2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w/2, h/2 - 10); ctx.lineTo(w/2, h/2 + 10); ctx.stroke();

  // Ball
  const ballR = 10;
  // Glow
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballR + 4, 0, Math.PI * 2);
  ctx.fillStyle = done ? '#39ff1422' : '#00ffff22';
  ctx.fill();
  // Ball body
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
  ctx.fillStyle = done ? '#39ff14' : '#00ffff';
  ctx.fill();
  // Highlight
  ctx.beginPath();
  ctx.arc(ballX - 3, ballY - 3, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff66';
  ctx.fill();

  // Done overlay
  if (done) {
    ctx.fillStyle = '#39ff1411';
    ctx.fillRect(0, 0, w, h);
  }

  // Trail line from center to ball
  ctx.strokeStyle = done ? '#39ff1444' : '#00ffff33';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2);
  ctx.lineTo(ballX, ballY);
  ctx.stroke();
  ctx.setLineDash([]);

  calibAnimId = requestAnimationFrame(drawCalibration);
}

function stopCalibration() {
  if (calibAnimId) { cancelAnimationFrame(calibAnimId); calibAnimId = null; }
  if (calibHandler) { window.removeEventListener('deviceorientation', calibHandler); calibHandler = null; }
  calibState = null;
}

function resetCalibration() {
  stopCalibration();
  const statusEl = document.getElementById('calib-status');
  if (statusEl) statusEl.textContent = 'הטה את הטלפון כדי להזיז את הכדור לכל 4 הפינות';
  startCalibration();
}

function startMotionListener() {
  if (motionListenerActive) return;
  motionListenerActive = true;
  motionBaseline = null;
  window.addEventListener('deviceorientation', handleMotion);
}

function stopMotionListener() {
  motionListenerActive = false;
  motionBaseline = null;
  window.removeEventListener('deviceorientation', handleMotion);
}

function handleMotion(e) {
  const game = state.game;
  if (!game || !game.running || !state.settings.motionControl) return;

  // beta = front-back tilt (-180..180), gamma = left-right tilt (-90..90)
  const beta = e.beta;
  const gamma = e.gamma;
  if (beta === null || gamma === null) return;

  // Calibrate on first reading — treat current tilt as "neutral"
  if (!motionBaseline) {
    motionBaseline = { beta, gamma };
    return;
  }

  const threshold = state.settings.motionSensitivity;
  const db = beta - motionBaseline.beta;
  const dg = gamma - motionBaseline.gamma;
  const d = game.dir;

  // Pick the dominant axis
  if (Math.abs(dg) > Math.abs(db)) {
    // Left-right tilt
    if (dg > threshold && d.x !== -1) game.nextDir = { x: 1, y: 0 };
    else if (dg < -threshold && d.x !== 1) game.nextDir = { x: -1, y: 0 };
  } else {
    // Forward-back tilt
    if (db > threshold && d.y !== -1) game.nextDir = { x: 0, y: 1 };
    else if (db < -threshold && d.y !== 1) game.nextDir = { x: 0, y: -1 };
  }
}

/* ===== SNAKE DRAWING HELPERS ===== */
function drawSmoothSnake(ctx, snake, bodyColor, headColor, thickness, headSize, headShape, colorful, dirX, dirY) {
  if (snake.length < 2) return;

  // Build center points
  const pts = snake.map(s => ({
    x: s.x * CELL !== undefined && typeof s.x === 'number' && s.x < 100 ? s.x : s.x,
    y: s.y * CELL !== undefined && typeof s.y === 'number' && s.y < 100 ? s.y : s.y,
  }));
  // If points are in grid coords (game), convert to pixel coords
  const isGrid = snake[0].x < 100 && snake.length > 1 && Math.abs(snake[0].x - snake[1].x) <= 1 && Math.abs(snake[0].y - snake[1].y) <= 1;
  const points = isGrid
    ? snake.map(s => ({ x: s.x * CELL + CELL / 2, y: s.y * CELL + CELL / 2 }))
    : snake;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (colorful) {
    // Draw segment by segment for rainbow effect
    for (let i = 0; i < points.length - 1; i++) {
      const hue = (i * 25 + Date.now() / 50) % 360;
      ctx.strokeStyle = `hsl(${hue}, 100%, 55%)`;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      // Smooth curve through midpoints
      if (i < points.length - 2) {
        const mx = (points[i + 1].x + points[i].x) / 2;
        const my = (points[i + 1].y + points[i].y) / 2;
        ctx.lineTo(mx, my);
      } else {
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
      }
      ctx.stroke();
    }
  } else {
    // Single color smooth body with fade
    // Draw from tail to head so head overlaps
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  }

  // Draw head
  const head = points[0];
  const headR = (thickness * headSize) / 2;
  ctx.fillStyle = colorful ? `hsl(${Date.now() / 50 % 360}, 100%, 65%)` : headColor;
  drawHeadShape(ctx, head.x, head.y, headR, headShape, dirX, dirY);

  // Eyes on head
  ctx.fillStyle = '#111';
  const eyeR = Math.max(1.5, headR * 0.2);
  const eyeOff = headR * 0.35;
  if (dirX !== 0) {
    ctx.beginPath(); ctx.arc(head.x + dirX * eyeOff * 1.2, head.y - eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(head.x + dirX * eyeOff * 1.2, head.y + eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(head.x - eyeOff, head.y + dirY * eyeOff * 1.2, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(head.x + eyeOff, head.y + dirY * eyeOff * 1.2, eyeR, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBlockySnake(ctx, snake, bodyColor, headColor, thickness, headSize, headShape, colorful, dirX, dirY) {
  // Determine if grid coords or pixel coords
  const isGrid = snake.length > 1 && Math.abs(snake[0].x - snake[1].x) <= 1 && Math.abs(snake[0].y - snake[1].y) <= 1;
  const cellPx = isGrid ? CELL : thickness;

  snake.forEach((s, i) => {
    const isHead = i === 0;
    const px = isGrid ? s.x * CELL : s.x;
    const py = isGrid ? s.y * CELL : s.y;
    const cx = isGrid ? px + CELL / 2 : px;
    const cy = isGrid ? py + CELL / 2 : py;

    if (colorful) {
      const hue = (i * 25 + Date.now() / 50) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, ${isHead ? 65 : 55}%)`;
    } else {
      ctx.fillStyle = isHead ? headColor : bodyColor;
      ctx.globalAlpha = isHead ? 1 : 0.5 + (1 - i / snake.length) * 0.5;
    }

    if (isHead) {
      const headBase = isGrid ? CELL : thickness;
      const headR = (headBase * headSize) / 2;
      drawHeadShape(ctx, cx, cy, headR, headShape, dirX, dirY);
      ctx.globalAlpha = 1;

      // Eyes
      ctx.fillStyle = '#111';
      const eyeR = Math.max(1.5, headR * 0.2);
      const eyeOff = headR * 0.35;
      if (dirX !== 0) {
        ctx.beginPath(); ctx.arc(cx + dirX * eyeOff * 1.2, cy - eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + dirX * eyeOff * 1.2, cy + eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(cx - eyeOff, cy + dirY * eyeOff * 1.2, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + eyeOff, cy + dirY * eyeOff * 1.2, eyeR, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const pad = isGrid ? 1 : 0;
      const size = isGrid ? CELL - pad * 2 : thickness - 2;
      ctx.beginPath();
      ctx.roundRect(px + pad - (isGrid ? 0 : size / 2), py + pad - (isGrid ? 0 : size / 2), size, size, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
}

/* ===== GAME ENGINE ===== */
function startGame(mode) {
  state.currentMode = mode;
  document.getElementById('home-screen').style.display = 'none';
  const gs = document.getElementById('game-screen');
  gs.classList.add('active');
  document.body.classList.add('game-active');

  const modeConf = MODES[mode];
  document.getElementById('game-mode-title').textContent = modeConf.he;
  document.getElementById('game-score-display').textContent = '0';

  const canvas = document.getElementById('gameCanvas');

  // Calculate available space for the canvas
  const { cols, rows } = calcCanvasDims();
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
    explosionParticles: [],
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
  game.paused = false;
  game.over = false;
  playSound('start');
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  game.interval = setInterval(() => gameTick(game), 1000 / game.speed);
  if (!game.frameId) renderLoop();
  document.getElementById('pause-btn').innerHTML = '&#10074;&#10074;';
  // Start gyroscope if enabled — recalibrate each resume
  if (state.settings.motionControl) {
    motionBaseline = null;
    startMotionListener();
  }
}

function togglePause() {
  const game = state.game;
  if (!game || game.over) return;
  if (!game.running && !game.paused) return;

  if (game.paused) {
    game.paused = false;
    game.running = true;
    game.interval = setInterval(() => gameTick(game), 1000 / game.speed);
    if (!game.frameId) renderLoop();
    document.getElementById('game-overlay').classList.add('hidden');
    document.getElementById('pause-btn').innerHTML = '&#10074;&#10074;';
    if (state.settings.motionControl) { motionBaseline = null; startMotionListener(); }
  } else {
    game.paused = true;
    game.running = false;
    if (game.interval) { clearInterval(game.interval); game.interval = null; }
    stopMotionListener();
    document.getElementById('pause-btn').innerHTML = '&#9654;';
    const overlay = document.getElementById('game-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h2>⏸️ השהייה</h2>
      <button onclick="togglePause()">המשך</button>
      <button onclick="backToHome()">חזרה</button>
    `;
  }
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
  stopMotionListener();
  document.body.classList.remove('game-active');
  renderHome();
}

function gameTick(game) {
  if (!game.running) return;

  game.dir = { ...game.nextDir };
  const head = game.snake[0];
  const newHead = { x: head.x + game.dir.x, y: head.y + game.dir.y };

  if (newHead.x < 0 || newHead.x >= game.cols || newHead.y < 0 || newHead.y >= game.rows) {
    gameOver(game); return;
  }
  if (game.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
    gameOver(game); return;
  }
  if (game.obstacles.some(o => o.x === newHead.x && o.y === newHead.y)) {
    gameOver(game); return;
  }

  game.snake.unshift(newHead);

  if (newHead.x === game.food.x && newHead.y === game.food.y) {
    game.score += 10;
    document.getElementById('game-score-display').textContent = game.score;
    playSound('eat');
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
    if (MODES[state.currentMode].obstacles) reshuffleObstacles(game);
    spawnFood(game);
    if (game.score % 50 === 0 && game.speed < 18) {
      game.speed += 0.5;
      clearInterval(game.interval);
      game.interval = setInterval(() => gameTick(game), 1000 / game.speed);
    }
  } else {
    game.snake.pop();
  }
}

function spawnExplosion(game) {
  const colors = game.colorful
    ? null  // will use HSL per segment
    : [state.settings.snakeColor || '#39ff14', '#ff4444', '#ffaa00', '#ffffff'];
  game.snake.forEach((seg, idx) => {
    const cx = seg.x * CELL + CELL / 2;
    const cy = seg.y * CELL + CELL / 2;
    const count = idx === 0 ? 12 : 5;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + (idx === 0 ? 3 : 1);
      const color = game.colorful
        ? `hsl(${(idx * 30 + Math.random() * 60) % 360},100%,60%)`
        : colors[Math.floor(Math.random() * colors.length)];
      game.explosionParticles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 35 + Math.floor(Math.random() * 20),
        maxLife: 55,
        color,
        r: Math.random() * 3 + 1.5,
      });
    }
  });
}

function gameOver(game) {
  game.running = false;
  game.over = true;
  clearInterval(game.interval);
  stopMotionListener();
  playSound('die');
  spawnExplosion(game);
  if (state.currentUser) saveBest(state.currentUser, state.currentMode, game.score);
  setTimeout(() => showOverlay('gameover'), 800);
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
  const s = state.settings;

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
  if (s.snakeStyle === 'smooth') {
    drawSmoothSnake(ctx, snake, s.snakeColor, s.headColor, s.snakeThickness, s.headSize, s.headShape, colorful, game.dir.x, game.dir.y);
  } else {
    drawBlockySnake(ctx, snake, s.snakeColor, s.headColor, s.snakeThickness, s.headSize, s.headShape, colorful, game.dir.x, game.dir.y);
  }

  // Food
  if (food) {
    const fx = food.x * CELL + CELL / 2;
    const fy = food.y * CELL + CELL / 2;
    const pulse = Math.sin(Date.now() / 200) * 2 + 8;
    ctx.fillStyle = colorful ? `hsla(${Date.now()/10%360},100%,60%,0.2)` : '#ff444433';
    ctx.beginPath();
    ctx.arc(fx, fy, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
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

  // Explosion particles
  for (let i = game.explosionParticles.length - 1; i >= 0; i--) {
    const p = game.explosionParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life--;
    if (p.life <= 0) { game.explosionParticles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Game over flash
  if (game.over && game.explosionParticles.length === 0) {
    ctx.fillStyle = '#ff000022';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

/* ===== INPUT ===== */
document.addEventListener('keydown', e => {
  const game = state.game;
  if (!game) return;

  if (e.key === ' ' || e.key === 'Escape') {
    if (game.running || game.paused) {
      e.preventDefault();
      togglePause();
      return;
    }
  }

  if (!game.running) return;

  const key = e.key;
  const d = game.dir;
  if ((key === 'ArrowUp' || key === 'w') && d.y !== 1) { game.nextDir = { x: 0, y: -1 }; e.preventDefault(); }
  else if ((key === 'ArrowDown' || key === 's') && d.y !== -1) { game.nextDir = { x: 0, y: 1 }; e.preventDefault(); }
  else if ((key === 'ArrowLeft' || key === 'a') && d.x !== 1) { game.nextDir = { x: -1, y: 0 }; e.preventDefault(); }
  else if ((key === 'ArrowRight' || key === 'd') && d.x !== -1) { game.nextDir = { x: 1, y: 0 }; e.preventDefault(); }
});

// Touch / swipe — non-passive to prevent scroll during game
let touchStart = null;
function isUIElement(el) {
  return el.closest('.game-header, .mobile-controls, .game-overlay');
}
document.addEventListener('touchstart', e => {
  if (!state.game) return;
  // Don't interfere with button taps (pause, back, d-pad, overlay buttons)
  if (isUIElement(e.target)) return;
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
  if (state.game.running) e.preventDefault();
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (!state.game) return;
  if (isUIElement(e.target)) return;
  // Prevent scroll when game screen is active
  e.preventDefault();
  if (!touchStart || !state.game.running) return;
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
}, { passive: false });
document.addEventListener('touchend', () => { touchStart = null; }, { passive: true });

// Mobile buttons
function mobileDir(dx, dy) {
  const game = state.game;
  if (!game || !game.running) return;
  const d = game.dir;
  if (dx !== 0 && d.x !== -dx) game.nextDir = { x: dx, y: 0 };
  if (dy !== 0 && d.y !== -dy) game.nextDir = { x: 0, y: dy };
}

/* ===== ND (MULTI-DIMENSIONAL) GAME ===== */
const AXIS_NAMES = ['X', 'Y', 'Z', 'W', 'V'];
const AXIS_COLORS = ['#39ff14', '#00ffff', '#ff00ff', '#ffd700', '#ff8c00'];
function getNdSize() { return state.settings.ndBoardSize || 8; }

let ndState = null;

function startNdGame(dims) {
  document.getElementById('home-screen').style.display = 'none';
  const screen = document.getElementById('nd-screen');
  screen.classList.add('active');
  document.body.classList.add('game-active');
  document.getElementById('nd-mode-title').textContent = dims + 'D';
  document.getElementById('nd-score-display').textContent = '0';

  const canvas = document.getElementById('ndCanvas');
  const vw = window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const hasCube = dims >= 3;
  const headerH = 44;
  const cubeH = hasCube ? Math.min(180, Math.floor((vh - headerH) * 0.3)) : 0;
  const gap = hasCube ? 8 : 0;
  const availH = vh - headerH - cubeH - gap - 10;
  const size = Math.min(Math.max(200, vw - 140), availH, 500);
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';

  // Init snake — starts at center of each dimension
  const center = Math.floor(getNdSize() / 2);
  const headPos = Array(dims).fill(center);
  const tail = [headPos.map((v, i) => i === 0 ? v - 1 : v)]; // one tail segment

  // Spawn food
  const food = ndSpawnFood(dims, [headPos, ...tail]);

  // Cube visualization canvas
  const cubeCanvas = document.getElementById('ndCubeCanvas');
  const cubeSize = hasCube ? Math.min(size, cubeH) : 0;
  cubeCanvas.width = cubeSize;
  cubeCanvas.height = cubeSize;
  cubeCanvas.style.width = cubeSize + 'px';
  cubeCanvas.style.height = cubeSize + 'px';
  cubeCanvas.style.display = dims >= 3 ? 'block' : 'none';

  ndState = {
    dims,
    head: headPos,
    tail: [headPos.map((v, i) => i === 0 ? v - 1 : v)],
    food,
    score: 0,
    running: true,
    paused: false,
    over: false,
    canvas,
    ctx: canvas.getContext('2d'),
    size,
    moveCount: 0,
    cubeCanvas,
    cubeCtx: cubeCanvas.getContext('2d'),
    cubeSize,
    cubeAngle: 0,
    cubeFrameId: null,
  };

  ndRenderControls();
  ndRenderCoords();
  ndDraw();
  if (dims >= 3) ndStartCubeLoop();
  document.getElementById('nd-overlay').classList.add('hidden');
}

function ndSpawnFood(dims, occupied) {
  let food, tries = 0;
  do {
    food = Array.from({ length: dims }, () => Math.floor(Math.random() * getNdSize()));
    tries++;
  } while (tries < 500 && occupied.some(s => s.every((v, i) => v === food[i])));
  return food;
}

function ndRenderControls() {
  const el = document.getElementById('nd-controls');
  let html = '';
  for (let d = 0; d < ndState.dims; d++) {
    html += `
      <div class="nd-axis-group">
        <button class="nd-axis-btn" onclick="ndMove(${d},1)" style="border-color:${AXIS_COLORS[d]}">+</button>
        <span class="nd-axis-label" style="color:${AXIS_COLORS[d]}">${AXIS_NAMES[d]}</span>
        <button class="nd-axis-btn" onclick="ndMove(${d},-1)" style="border-color:${AXIS_COLORS[d]}">−</button>
      </div>
    `;
  }
  el.innerHTML = html;
}

function ndRenderCoords() {
  const el = document.getElementById('nd-coords');
  if (!ndState) return;
  let html = '<div class="coord-row"><span class="coord-label">ציר</span><span class="coord-label">ראש</span><span class="coord-label coord-food">תפוח</span><span class="coord-label">מרחק</span></div>';
  for (let d = 0; d < ndState.dims; d++) {
    const hv = ndState.head[d];
    const fv = ndState.food[d];
    const diff = Math.abs(hv - fv);
    const match = hv === fv;
    html += `<div class="coord-row">
      <span class="coord-val" style="color:${AXIS_COLORS[d]}">${AXIS_NAMES[d]}</span>
      <span class="coord-val">${hv}</span>
      <span class="coord-val coord-food">${fv}</span>
      <span class="coord-val" style="color:${match ? '#39ff14' : '#ff8c00'}">${diff}${match ? ' ✓' : ''}</span>
    </div>`;
  }
  html += `<div class="coord-row" style="border:none;padding-top:.3rem"><span class="coord-label">צעדים</span><span class="coord-val">${ndState.moveCount}</span></div>`;
  el.innerHTML = html;
}

function ndMove(axis, dir) {
  if (!ndState || !ndState.running) return;

  const newHead = [...ndState.head];
  newHead[axis] += dir;

  // Wall check
  if (newHead[axis] < 0 || newHead[axis] >= getNdSize()) { playSound('die'); return; }

  // Self collision
  if (ndState.tail.some(s => s.every((v, i) => v === newHead[i]))) {
    ndGameOver();
    return;
  }

  // Move
  ndState.tail.unshift([...ndState.head]);
  ndState.head = newHead;
  ndState.moveCount++;

  // Eat food?
  if (ndState.head.every((v, i) => v === ndState.food[i])) {
    ndState.score += 10 * ndState.dims;
    document.getElementById('nd-score-display').textContent = ndState.score;
    playSound('eat');
    ndState.food = ndSpawnFood(ndState.dims, [ndState.head, ...ndState.tail]);
  } else {
    ndState.tail.pop();
  }

  ndRenderCoords();
  ndDraw();
}

function ndDraw() {
  if (!ndState) return;
  const { ctx, size, head, tail, food, dims } = ndState;
  const cellSize = size / getNdSize();

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, size, size);

  // Grid (X,Y plane)
  ctx.strokeStyle = '#1a1a2e44';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= getNdSize(); i++) {
    ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(size, i * cellSize); ctx.stroke();
  }

  // Axis labels
  ctx.fillStyle = AXIS_COLORS[0];
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('X →', size / 2, size - 3);
  ctx.save();
  ctx.translate(10, size / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = AXIS_COLORS[1];
  ctx.fillText('Y →', 0, 0);
  ctx.restore();

  // Check if food matches extra dimensions (dims > 2)
  const foodExtraMatch = head.slice(2).every((v, i) => v === food[i + 2]);
  const headExtraMatchFood = foodExtraMatch;

  // Draw food (only fully visible if extra dims match)
  const fx = food[0] * cellSize + cellSize / 2;
  const fy = food[1] * cellSize + cellSize / 2;
  const foodAlpha = headExtraMatchFood ? 1 : 0.3;
  ctx.globalAlpha = foodAlpha;
  // Glow
  ctx.fillStyle = '#ff444433';
  ctx.beginPath();
  ctx.arc(fx, fy, cellSize / 2 + 3, 0, Math.PI * 2);
  ctx.fill();
  // Core
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(fx, fy, cellSize / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  if (!headExtraMatchFood) {
    // Show which extra dims don't match
    ctx.fillStyle = '#ff8c00';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    const missingAxes = [];
    for (let d = 2; d < dims; d++) {
      if (head[d] !== food[d]) missingAxes.push(AXIS_NAMES[d] + '=' + food[d]);
    }
    ctx.fillText(missingAxes.join(' '), fx, fy + cellSize / 2 + 10);
  }
  ctx.globalAlpha = 1;

  // Draw tail segments (on X,Y plane)
  tail.forEach((seg, i) => {
    const sx = seg[0] * cellSize + cellSize / 2;
    const sy = seg[1] * cellSize + cellSize / 2;
    const extraMatch = seg.slice(2).every((v, j) => v === head[j + 2]);
    ctx.globalAlpha = extraMatch ? 0.4 + (1 - i / tail.length) * 0.4 : 0.15;
    ctx.fillStyle = state.settings.snakeColor;
    ctx.beginPath();
    ctx.roundRect(sx - cellSize / 2 + 2, sy - cellSize / 2 + 2, cellSize - 4, cellSize - 4, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Draw head
  const hx = head[0] * cellSize + cellSize / 2;
  const hy = head[1] * cellSize + cellSize / 2;
  ctx.fillStyle = state.settings.headColor || state.settings.snakeColor;
  ctx.beginPath();
  ctx.arc(hx, hy, cellSize / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(hx - 4, hy - 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + 4, hy - 2, 2, 0, Math.PI * 2); ctx.fill();

  // Extra dimension indicator badges on head
  if (dims > 2) {
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    for (let d = 2; d < dims; d++) {
      const badge = AXIS_NAMES[d] + ':' + head[d];
      ctx.fillStyle = AXIS_COLORS[d];
      ctx.fillText(badge, hx, hy + cellSize / 2 + 8 + (d - 2) * 10);
    }
  }

  // Game over overlay
  if (ndState.over) {
    ctx.fillStyle = '#ff000033';
    ctx.fillRect(0, 0, size, size);
  }
}

function ndGameOver() {
  ndState.running = false;
  ndState.over = true;
  playSound('die');
  if (state.currentUser) saveBest(state.currentUser, 'nd_' + ndState.dims + 'd', ndState.score);
  const overlay = document.getElementById('nd-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <h2>נגמר!</h2>
    <div class="final-score">ניקוד: ${ndState.score}</div>
    <div style="color:var(--text-dim);font-size:.85rem">${ndState.moveCount} צעדים</div>
    <button onclick="startNdGame(${ndState.dims})">שחק שוב</button>
    <button onclick="ndBackToHome()">חזרה</button>
  `;
}

function ndTogglePause() {
  if (!ndState || ndState.over) return;
  ndState.running = !ndState.running;
  ndState.paused = !ndState.running;
  document.getElementById('nd-pause-btn').innerHTML = ndState.running ? '&#10074;&#10074;' : '&#9654;';
  const overlay = document.getElementById('nd-overlay');
  if (ndState.paused) {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<h2>⏸️ השהייה</h2><button onclick="ndTogglePause()">המשך</button><button onclick="ndBackToHome()">חזרה</button>`;
  } else {
    overlay.classList.add('hidden');
  }
}

function ndBackToHome() {
  if (ndState && ndState.cubeFrameId) cancelAnimationFrame(ndState.cubeFrameId);
  ndState = null;
  document.getElementById('nd-screen').classList.remove('active');
  document.body.classList.remove('game-active');
  renderHome();
}

/* ===== ND AUTO-PLAY ===== */
let ndAutoInterval = null;

function startNdAutoGame(dims) {
  startNdGame(dims);
  if (!ndState) return;
  ndState.autoPlay = true;
  document.getElementById('nd-mode-title').textContent = dims + 'D — אוטומטי';
  ndAutoInterval = setInterval(ndAutoTick, 300);
}

function ndAutoTick() {
  if (!ndState || !ndState.running) {
    clearInterval(ndAutoInterval);
    return;
  }
  const gridSize = getNdSize();
  const { head, food, tail, dims } = ndState;

  // Greedy: pick the axis with the largest distance to food, move towards it
  let bestAxis = -1, bestDist = -1;
  for (let d = 0; d < dims; d++) {
    const dist = Math.abs(head[d] - food[d]);
    if (dist > bestDist) { bestDist = dist; bestAxis = d; }
  }

  if (bestDist === 0) {
    // All axes match — shouldn't happen, but pick any valid move
    for (let d = 0; d < dims; d++) {
      if (head[d] < gridSize - 1) { ndMove(d, 1); return; }
      if (head[d] > 0) { ndMove(d, -1); return; }
    }
    return;
  }

  const dir = food[bestAxis] > head[bestAxis] ? 1 : -1;
  const newVal = head[bestAxis] + dir;

  // Check if move is safe (no self collision)
  const newHead = [...head];
  newHead[bestAxis] += dir;
  const isSafe = newVal >= 0 && newVal < gridSize &&
    !tail.some(s => s.every((v, i) => v === newHead[i]));

  if (isSafe) {
    ndMove(bestAxis, dir);
  } else {
    // Try other axes
    for (let d = 0; d < dims; d++) {
      if (d === bestAxis) continue;
      for (const tryDir of [1, -1]) {
        const tryHead = [...head];
        tryHead[d] += tryDir;
        if (tryHead[d] >= 0 && tryHead[d] < gridSize &&
            !tail.some(s => s.every((v, i) => v === tryHead[i]))) {
          ndMove(d, tryDir);
          return;
        }
      }
    }
    // No safe move
    ndGameOver();
  }
}

// Clean up auto interval on back/gameover
const origNdBackToHome = ndBackToHome;
ndBackToHome = function() {
  if (ndAutoInterval) { clearInterval(ndAutoInterval); ndAutoInterval = null; }
  origNdBackToHome();
};

const origNdGameOver = ndGameOver;
ndGameOver = function() {
  if (ndAutoInterval) { clearInterval(ndAutoInterval); ndAutoInterval = null; }
  origNdGameOver();
};

/* ===== HYPERCUBE VISUALIZATION ===== */
function ndStartCubeLoop() {
  if (!ndState) return;
  ndState.cubeAngle += 0.008;
  ndDrawCube();
  ndState.cubeFrameId = requestAnimationFrame(ndStartCubeLoop);
}

function ndDrawCube() {
  if (!ndState) return;
  const { cubeCtx: ctx, cubeSize: sz, dims, head, tail, food, cubeAngle } = ndState;
  const gridSize = getNdSize();
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, sz, sz);

  // Generate hypercube vertices (corners of the grid)
  const verts = ndHypercubeVerts(dims);
  const edges = ndHypercubeEdges(dims);

  // Project all vertices to 2D
  const projected = verts.map(v => ndProject(v, dims, cubeAngle, sz));

  // Draw edges
  ctx.strokeStyle = '#39ff1418';
  ctx.lineWidth = 0.8;
  edges.forEach(([a, b]) => {
    const pa = projected[a], pb = projected[b];
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  });

  // Draw tail segments as small dots
  tail.forEach((seg, i) => {
    const norm = seg.map(v => v / (gridSize - 1)); // normalize 0-1
    const p = ndProject(norm, dims, cubeAngle, sz);
    ctx.globalAlpha = 0.3 + (1 - i / tail.length) * 0.4;
    ctx.fillStyle = state.settings.snakeColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Draw food
  const foodNorm = food.map(v => v / (gridSize - 1));
  const fp = ndProject(foodNorm, dims, cubeAngle, sz);
  // Pulse
  const pulse = Math.sin(Date.now() / 200) * 2 + 6;
  ctx.fillStyle = '#ff444433';
  ctx.beginPath();
  ctx.arc(fp.x, fp.y, pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(fp.x, fp.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Draw head
  const headNorm = head.map(v => v / (gridSize - 1));
  const hp = ndProject(headNorm, dims, cubeAngle, sz);
  // Glow
  ctx.fillStyle = (state.settings.headColor || state.settings.snakeColor) + '44';
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = state.settings.headColor || state.settings.snakeColor;
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Draw line from head to food
  ctx.strokeStyle = '#ff444444';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(hp.x, hp.y);
  ctx.lineTo(fp.x, fp.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label
  ctx.fillStyle = '#ffffff44';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(dims + 'D', sz / 2, sz - 6);
}

// Generate 2^N vertices of a unit hypercube (each coord 0 or 1)
function ndHypercubeVerts(dims) {
  const count = 1 << dims;
  const verts = [];
  for (let i = 0; i < count; i++) {
    const v = [];
    for (let d = 0; d < dims; d++) {
      v.push((i >> d) & 1);
    }
    verts.push(v);
  }
  return verts;
}

// Generate edges: pairs of vertex indices that differ in exactly one dimension
function ndHypercubeEdges(dims) {
  const count = 1 << dims;
  const edges = [];
  for (let i = 0; i < count; i++) {
    for (let d = 0; d < dims; d++) {
      const j = i ^ (1 << d); // flip bit d
      if (j > i) edges.push([i, j]); // avoid duplicates
    }
  }
  return edges;
}

// Project N-dimensional point (0-1 range) to 2D with rotation
function ndProject(point, dims, angle, canvasSize) {
  // Center the point: map 0-1 to -1..1
  let coords = point.map(v => v * 2 - 1);

  // Apply rotations in successive dimension pairs for visualization
  for (let d = 0; d < dims - 1; d++) {
    const a = angle * (1 + d * 0.6); // different speed per pair
    const cos = Math.cos(a), sin = Math.sin(a);
    const i = d, j = d + 1;
    const ci = coords[i], cj = coords[j];
    coords[i] = ci * cos - cj * sin;
    coords[j] = ci * sin + cj * cos;
  }

  // Perspective projection: use first two coords, with depth from remaining
  let depth = 0;
  for (let d = 2; d < dims; d++) depth += coords[d] * 0.3;
  const perspective = 1 / (2.5 - depth);

  const margin = canvasSize * 0.15;
  const scale = (canvasSize - margin * 2) / 2;
  return {
    x: canvasSize / 2 + coords[0] * scale * perspective,
    y: canvasSize / 2 + coords[1] * scale * perspective,
    depth,
  };
}

// Keyboard for ND: Q/A=X, W/S=Y, E/D=Z, R/F=W, T/G=V
document.addEventListener('keydown', e => {
  if (!ndState || !ndState.running) return;
  const keyMap = {
    'q': [0, -1], 'a': [0, 1],
    'w': [1, -1], 's': [1, 1],
    'e': [2, -1], 'd': [2, 1],
    'r': [3, -1], 'f': [3, 1],
    't': [4, -1], 'g': [4, 1],
  };
  const action = keyMap[e.key.toLowerCase()];
  if (action && action[0] < ndState.dims) {
    e.preventDefault();
    ndMove(action[0], action[1]);
  }
});

/* ===== AI GAME ===== */
let aiState = null;

function startAiGame(algo, gameMode) {
  document.getElementById('home-screen').style.display = 'none';
  const screen = document.getElementById('ai-screen');
  screen.classList.add('active');
  document.body.classList.add('game-active');
  const modeLabel = gameMode ? (MODES[gameMode] ? MODES[gameMode].he : gameMode) : 'AI';
  document.getElementById('ai-mode-title').textContent = modeLabel + ' — אוטומטי';
  document.getElementById('ai-score-display').textContent = '0';
  document.getElementById('ai-algo-label').textContent = algo.toUpperCase();

  const canvas = document.getElementById('aiCanvas');
  const { cols, rows } = calcCanvasDims();
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';

  const ctx = canvas.getContext('2d');

  const startY = Math.floor(rows / 2);
  const startX = Math.floor(cols / 4);
  const snake = [];
  for (let i = 0; i < 3; i++) snake.push({ x: startX - i, y: startY });

  const modeConf = gameMode && MODES[gameMode] ? MODES[gameMode] : null;
  const obstacles = [];
  if (modeConf && modeConf.obstacles) {
    const count = Math.floor((cols * rows) * 0.03);
    for (let i = 0; i < count; i++) {
      let ox, oy, tries = 0;
      do { ox = Math.floor(Math.random() * cols); oy = Math.floor(Math.random() * rows); tries++; }
      while (tries < 100 && (snake.some(s => s.x === ox && s.y === oy) || obstacles.some(o => o.x === ox && o.y === oy) || (Math.abs(ox - startX) < 5 && Math.abs(oy - startY) < 3)));
      if (tries < 100) obstacles.push({ x: ox, y: oy });
    }
  }

  aiState = {
    cols, rows, ctx, canvas,
    snake,
    dir: { x: 1, y: 0 },
    food: null,
    obstacles,
    score: 0,
    running: true,
    paused: false,
    over: false,
    interval: null,
    speed: modeConf ? state.settings.speeds[gameMode] || 10 : 10,
    algo,
    gameMode: gameMode || null,
    colorful: modeConf ? modeConf.colorful : false,
    frameId: null,
    foodParticles: [],
  };

  aiSpawnFood();
  aiState.interval = setInterval(aiTick, 1000 / aiState.speed);
  aiRenderLoop();
  document.getElementById('ai-overlay').classList.add('hidden');
  // Sync speed slider
  const speedSlider = document.querySelector('#ai-info input[type="range"]');
  if (speedSlider) { speedSlider.value = aiState.speed; document.getElementById('ai-speed-val').textContent = aiState.speed; }
}

function aiReshuffleObstacles() {
  const { snake, cols, rows, dir } = aiState;
  aiState.obstacles = [];
  const count = Math.floor((cols * rows) * 0.03);
  const head = snake[0];
  const safeSet = new Set();
  for (let i = 1; i <= 7; i++) safeSet.add(`${head.x + dir.x * i},${head.y + dir.y * i}`);
  for (let i = 0; i < count; i++) {
    let ox, oy, tries = 0;
    do { ox = Math.floor(Math.random() * cols); oy = Math.floor(Math.random() * rows); tries++; }
    while (tries < 100 && (snake.some(s => s.x === ox && s.y === oy) || aiState.obstacles.some(o => o.x === ox && o.y === oy) || safeSet.has(`${ox},${oy}`)));
    if (tries < 100) aiState.obstacles.push({ x: ox, y: oy });
  }
}

function aiSpawnFood() {
  let fx, fy, tries = 0;
  do {
    fx = Math.floor(Math.random() * aiState.cols);
    fy = Math.floor(Math.random() * aiState.rows);
    tries++;
  } while (tries < 500 && (aiState.snake.some(s => s.x === fx && s.y === fy) || (aiState.obstacles || []).some(o => o.x === fx && o.y === fy)));
  aiState.food = { x: fx, y: fy };
}

function aiTick() {
  if (!aiState || !aiState.running) return;
  const { snake, food, cols, rows, algo } = aiState;
  const head = snake[0];

  // Choose direction based on algorithm
  let dir;
  if (algo === 'bfs') {
    dir = aiBFS(head, food, snake, cols, rows);
  } else if (algo === 'greedy') {
    dir = aiGreedy(head, food, snake, cols, rows);
  } else if (algo === 'hamiltonian') {
    dir = aiHamiltonian(head, food, snake, cols, rows);
  }

  if (!dir) {
    // No safe move — game over
    aiGameOver();
    return;
  }

  aiState.dir = dir;
  const newHead = { x: head.x + dir.x, y: head.y + dir.y };

  // Collision check
  if (newHead.x < 0 || newHead.x >= cols || newHead.y < 0 || newHead.y >= rows ||
      snake.some(s => s.x === newHead.x && s.y === newHead.y) ||
      (aiState.obstacles || []).some(o => o.x === newHead.x && o.y === newHead.y)) {
    aiGameOver();
    return;
  }

  snake.unshift(newHead);

  if (newHead.x === food.x && newHead.y === food.y) {
    aiState.score += 10;
    document.getElementById('ai-score-display').textContent = aiState.score;
    playSound('eat');
    for (let i = 0; i < 6; i++) {
      aiState.foodParticles.push({
        x: food.x * CELL + CELL / 2, y: food.y * CELL + CELL / 2,
        vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
        life: 20, color: '#ff4444',
      });
    }
    // Reshuffle obstacles in obstacles mode
    if ((aiState.obstacles || []).length > 0) {
      aiReshuffleObstacles();
    }
    aiSpawnFood();
  } else {
    snake.pop();
  }
}

function aiBFS(head, food, snake, cols, rows) {
  const occupied = new Set(snake.map(s => s.x + ',' + s.y));
  (aiState.obstacles || []).forEach(o => occupied.add(o.x + ',' + o.y));
  const queue = [{ x: head.x, y: head.y, firstDir: null }];
  const visited = new Set([head.x + ',' + head.y]);
  const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

  while (queue.length) {
    const cur = queue.shift();
    for (const d of dirs) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      const key = nx + ',' + ny;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (visited.has(key)) continue;
      // Can't go through snake body (except tail which will move)
      if (occupied.has(key) && !(nx === snake[snake.length - 1].x && ny === snake[snake.length - 1].y)) continue;
      visited.add(key);
      const firstDir = cur.firstDir || d;
      if (nx === food.x && ny === food.y) return firstDir;
      queue.push({ x: nx, y: ny, firstDir });
    }
  }
  // No path to food — try to chase tail (survival)
  return aiChaseTail(head, snake, cols, rows);
}

function aiChaseTail(head, snake, cols, rows) {
  const tail = snake[snake.length - 1];
  const occupied = new Set(snake.map(s => s.x + ',' + s.y));
  const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
  let bestDir = null, bestDist = Infinity;
  for (const d of dirs) {
    const nx = head.x + d.x, ny = head.y + d.y;
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    const key = nx + ',' + ny;
    if (occupied.has(key) && !(nx === tail.x && ny === tail.y)) continue;
    const dist = Math.abs(nx - tail.x) + Math.abs(ny - tail.y);
    if (dist < bestDist) { bestDist = dist; bestDir = d; }
  }
  return bestDir;
}

function aiGreedy(head, food, snake, cols, rows) {
  const occupied = new Set(snake.map(s => s.x + ',' + s.y));
  const tail = snake[snake.length - 1];
  const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
  let bestDir = null, bestDist = Infinity;
  for (const d of dirs) {
    const nx = head.x + d.x, ny = head.y + d.y;
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    const key = nx + ',' + ny;
    if (occupied.has(key) && !(nx === tail.x && ny === tail.y)) continue;
    const dist = Math.abs(nx - food.x) + Math.abs(ny - food.y);
    if (dist < bestDist) { bestDist = dist; bestDir = d; }
  }
  return bestDir || aiChaseTail(head, snake, cols, rows);
}

function aiHamiltonian(head, food, snake, cols, rows) {
  // Simplified: zig-zag pattern covering entire grid
  // Row-by-row snake pattern: go right on even rows, left on odd rows, step down at edges
  const { x, y } = head;
  if (y % 2 === 0) {
    // Even row: go right
    if (x < cols - 1) return { x: 1, y: 0 };
    else return { x: 0, y: 1 }; // step down
  } else {
    // Odd row: go left
    if (x > 0) return { x: -1, y: 0 };
    else {
      if (y < rows - 1) return { x: 0, y: 1 };
      else return { x: 1, y: 0 }; // wrap top — will hit wall, use fallback
    }
  }
}

function aiGameOver() {
  if (!aiState) return;
  aiState.running = false;
  aiState.over = true;
  if (aiState.interval) clearInterval(aiState.interval);
  if (aiState.frameId) cancelAnimationFrame(aiState.frameId);
  playSound('die');
  const overlay = document.getElementById('ai-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <h2>נגמר!</h2>
    <div class="final-score">ניקוד: ${aiState.score}</div>
    <button onclick="startAiGame('${aiState.algo}'${aiState.gameMode ? ",'" + aiState.gameMode + "'" : ''})">שחק שוב</button>
    <button onclick="aiBackToHome()">חזרה</button>
  `;
}

function aiRenderLoop() {
  if (!aiState) return;
  aiDrawGame();
  aiState.frameId = requestAnimationFrame(aiRenderLoop);
}

function aiDrawGame() {
  const { ctx, canvas, cols, rows, snake, food, foodParticles, over } = aiState;
  const s = state.settings;

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = '#1a1a2e33';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, rows * CELL); ctx.stroke(); }
  for (let y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(cols * CELL, y * CELL); ctx.stroke(); }

  // Obstacles
  (aiState.obstacles || []).forEach(o => {
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.roundRect(o.x * CELL + 1, o.y * CELL + 1, CELL - 2, CELL - 2, 3); ctx.fill();
    ctx.fillStyle = '#777';
    ctx.beginPath(); ctx.roundRect(o.x * CELL + 3, o.y * CELL + 3, 6, 6, 2); ctx.fill();
  });

  // Snake
  const colorful = aiState.colorful || false;
  if (s.snakeStyle === 'smooth') {
    drawSmoothSnake(ctx, snake, s.snakeColor, s.headColor, s.snakeThickness, s.headSize, s.headShape, colorful, aiState.dir.x, aiState.dir.y);
  } else {
    drawBlockySnake(ctx, snake, s.snakeColor, s.headColor, s.snakeThickness, s.headSize, s.headShape, colorful, aiState.dir.x, aiState.dir.y);
  }

  // Food
  if (food) {
    const fx = food.x * CELL + CELL / 2, fy = food.y * CELL + CELL / 2;
    const pulse = Math.sin(Date.now() / 200) * 2 + 8;
    ctx.fillStyle = '#ff444433';
    ctx.beginPath(); ctx.arc(fx, fy, pulse + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(fx, fy, CELL / 2 - 3, 0, Math.PI * 2); ctx.fill();
  }

  // Particles
  for (let i = foodParticles.length - 1; i >= 0; i--) {
    const p = foodParticles[i];
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0) { foodParticles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life / 20;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (over) { ctx.fillStyle = '#ff000022'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

function aiSetSpeed(val) {
  if (!aiState) return;
  aiState.speed = parseInt(val);
  document.getElementById('ai-speed-val').textContent = val;
  if (aiState.interval) clearInterval(aiState.interval);
  if (aiState.running) aiState.interval = setInterval(aiTick, 1000 / aiState.speed);
}

function aiTogglePause() {
  if (!aiState || aiState.over) return;
  if (aiState.paused) {
    aiState.paused = false;
    aiState.running = true;
    aiState.interval = setInterval(aiTick, 1000 / aiState.speed);
    if (!aiState.frameId) aiRenderLoop();
    document.getElementById('ai-overlay').classList.add('hidden');
    document.getElementById('ai-pause-btn').innerHTML = '&#10074;&#10074;';
  } else {
    aiState.paused = true;
    aiState.running = false;
    if (aiState.interval) clearInterval(aiState.interval);
    document.getElementById('ai-pause-btn').innerHTML = '&#9654;';
    const overlay = document.getElementById('ai-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<h2>⏸️ השהייה</h2><button onclick="aiTogglePause()">המשך</button><button onclick="aiBackToHome()">חזרה</button>`;
  }
}

function aiBackToHome() {
  if (aiState) {
    if (aiState.interval) clearInterval(aiState.interval);
    if (aiState.frameId) cancelAnimationFrame(aiState.frameId);
  }
  aiState = null;
  document.getElementById('ai-screen').classList.remove('active');
  document.body.classList.remove('game-active');
  renderHome();
}

/* ===== HARD REFRESH ===== */
function hardRefresh() {
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(name => caches.delete(name)));
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
  window.location.reload(true);
}

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', renderHome);
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!state.game) {
    for (const m in MODES) drawCardThumbnail('thumb-' + m, m);
  } else {
    // Debounce to let orientation settle
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeGameCanvas, 80);
  }
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (state.game) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeGameCanvas, 80);
    }
  });
}

function calcCanvasDims() {
  const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isLandscape = isMobile && window.innerWidth > window.innerHeight;
  const vw = window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const headerH = isLandscape ? 30 : 42;
  const controlsH = isMobile && !isLandscape ? Math.min(vw * 0.24 + 10, 150) : 0;
  const controlsW = isLandscape ? Math.min(vh * 0.24 + 16, 160) : 0;
  const padding = isMobile ? 8 : 16;
  const availW = vw - padding - controlsW;
  const availH = vh - headerH - controlsH - padding;
  // Apply board size setting
  const bs = state.settings.boardSize;
  let capW, capH;
  if (bs === 'small')       { capW = 300; capH = 300; }
  else if (bs === 'medium') { capW = 440; capH = 440; }
  else if (bs === 'large')  { capW = 700; capH = 700; }
  else                      { capW = 600; capH = 600; } // auto
  const maxW = Math.min(availW, capW);
  const maxH = Math.min(availH, capH);
  return { cols: Math.floor(maxW / CELL), rows: Math.floor(maxH / CELL) };
}

function resizeGameCanvas() {
  const game = state.game;
  if (!game) return;
  const canvas = game.canvas;
  const { cols: newCols, rows: newRows } = calcCanvasDims();
  if (newCols === game.cols && newRows === game.rows) return;

  // Find the bounding box of the snake + food + obstacles
  let maxX = 0, maxY = 0;
  game.snake.forEach(s => { if (s.x > maxX) maxX = s.x; if (s.y > maxY) maxY = s.y; });
  game.obstacles.forEach(o => { if (o.x > maxX) maxX = o.x; if (o.y > maxY) maxY = o.y; });
  if (game.food) { if (game.food.x > maxX) maxX = game.food.x; if (game.food.y > maxY) maxY = game.food.y; }

  // Grid must be at least big enough to contain all game objects
  const cols = Math.max(newCols, maxX + 2);
  const rows = Math.max(newRows, maxY + 2);

  game.cols = cols;
  game.rows = rows;
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;

  // CSS-scale to fit the available viewport area
  const fitW = newCols * CELL;
  const fitH = newRows * CELL;
  const scale = Math.min(fitW / canvas.width, fitH / canvas.height, 1);
  canvas.style.width = Math.floor(canvas.width * scale) + 'px';
  canvas.style.height = Math.floor(canvas.height * scale) + 'px';
}
