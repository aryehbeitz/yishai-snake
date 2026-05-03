/* ===== DINO / JEEP RUNNER GAME ===== */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Responsive canvas
const MAX_W = Math.min(window.innerWidth - 16, 700);
const CANVAS_W = MAX_W;
const CANVAS_H = Math.min(window.innerHeight - 120, 280);
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Ground
const GROUND_Y = CANVAS_H - 50;

// Physics
const GRAVITY = 0.6;
const JUMP_VY = -13;
const DOUBLE_JUMP_VY = -11;

// Game speed
let speed = 5;
const SPEED_INC = 0.0015;
const MAX_SPEED = 18;

// State
let selectedChar = localStorage.getItem('dinoChar') || 'dino';
let best = parseInt(localStorage.getItem('dinoBest')) || 0;
let gameRunning = false;
let animId = null;
let score = 0;
let frameCount = 0;

// Player
let player = null;
let obstacles = [];
let clouds = [];
let particles = [];
let groundOffset = 0;

// ========================
// DRAW HELPERS
// ========================

function drawDino(x, y, w, h, legAnim, color) {
  const c = color || '#39ff14';
  ctx.save();
  // Body
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x + w * 0.2, y + h * 0.2, w * 0.55, h * 0.5, 4);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.roundRect(x + w * 0.55, y, w * 0.45, h * 0.35, 4);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + w * 0.88, y + h * 0.1, 3, 0, Math.PI * 2);
  ctx.fill();
  // Mouth
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.88, y + h * 0.22);
  ctx.lineTo(x + w, y + h * 0.2);
  ctx.stroke();
  // Tail
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.4);
  ctx.lineTo(x, y + h * 0.5);
  ctx.lineTo(x + w * 0.05, y + h * 0.7);
  ctx.lineTo(x + w * 0.25, y + h * 0.65);
  ctx.fill();
  // Legs
  const legOff = legAnim ? Math.sin(frameCount * 0.35) * 5 : 0;
  ctx.fillStyle = c;
  // Back leg
  ctx.beginPath();
  ctx.roundRect(x + w * 0.25, y + h * 0.65, w * 0.15, h * 0.35 - legOff, 3);
  ctx.fill();
  // Front leg
  ctx.beginPath();
  ctx.roundRect(x + w * 0.5, y + h * 0.65, w * 0.15, h * 0.35 + legOff, 3);
  ctx.fill();
  // Small arm
  ctx.beginPath();
  ctx.roundRect(x + w * 0.62, y + h * 0.33, w * 0.12, h * 0.2, 2);
  ctx.fill();
  ctx.restore();
}

function drawJeep(x, y, w, h, wheelAnim, color) {
  const c = color || '#ff8c00';
  const wheelR = h * 0.22;
  const wheelY = y + h - wheelR;
  ctx.save();
  // Body
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x + w * 0.05, y + h * 0.3, w * 0.9, h * 0.5, 5);
  ctx.fill();
  // Cabin
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x + w * 0.2, y + h * 0.08, w * 0.6, h * 0.28, 4);
  ctx.fill();
  // Windows
  ctx.fillStyle = '#7df8ff88';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.24, y + h * 0.12, w * 0.22, h * 0.18, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.52, y + h * 0.12, w * 0.22, h * 0.18, 2);
  ctx.fill();
  // Bumpers
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.02, y + h * 0.55, w * 0.1, h * 0.15, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.88, y + h * 0.55, w * 0.1, h * 0.15, 2);
  ctx.fill();
  // Wheels
  const wobble = wheelAnim ? Math.sin(frameCount * 0.4) * 1.5 : 0;
  for (let i = 0; i < 2; i++) {
    const wx = i === 0 ? x + w * 0.22 : x + w * 0.72;
    // Tire
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(wx, wheelY + wobble * (i === 0 ? 1 : -1), wheelR, 0, Math.PI * 2);
    ctx.fill();
    // Rim
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(wx, wheelY + wobble * (i === 0 ? 1 : -1), wheelR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Lug nuts
    ctx.fillStyle = '#666';
    for (let j = 0; j < 4; j++) {
      const angle = (j / 4) * Math.PI * 2 + frameCount * 0.15;
      ctx.beginPath();
      ctx.arc(wx + Math.cos(angle) * wheelR * 0.3, wheelY + wobble * (i === 0 ? 1 : -1) + Math.sin(angle) * wheelR * 0.3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCactus(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#2d8a2d';
  // Main trunk
  ctx.beginPath();
  ctx.roundRect(x + w * 0.35, y, w * 0.3, h, 3);
  ctx.fill();
  // Left arm
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.25, w * 0.37, h * 0.18, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.1, w * 0.18, h * 0.3, 3);
  ctx.fill();
  // Right arm
  ctx.beginPath();
  ctx.roundRect(x + w * 0.63, y + h * 0.35, w * 0.37, h * 0.18, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.82, y + h * 0.2, w * 0.18, h * 0.3, 3);
  ctx.fill();
  ctx.restore();
}

function drawRock(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h);
  ctx.lineTo(x, y + h * 0.6);
  ctx.lineTo(x + w * 0.15, y + h * 0.2);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.85, y + h * 0.15);
  ctx.lineTo(x + w, y + h * 0.55);
  ctx.lineTo(x + w * 0.8, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.05);
  ctx.lineTo(x + w * 0.6, y + h * 0.35);
  ctx.lineTo(x + w * 0.45, y + h * 0.45);
  ctx.lineTo(x + w * 0.25, y + h * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPterodactyl(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#9b59b6';
  const wingFlap = Math.sin(frameCount * 0.25) * h * 0.3;
  // Body
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.6, w * 0.25, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Left wing
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.55);
  ctx.quadraticCurveTo(x + w * 0.1, y - wingFlap, x, y + h * 0.3);
  ctx.quadraticCurveTo(x + w * 0.1, y + h * 0.7, x + w * 0.35, y + h * 0.7);
  ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(x + w * 0.65, y + h * 0.55);
  ctx.quadraticCurveTo(x + w * 0.9, y - wingFlap, x + w, y + h * 0.3);
  ctx.quadraticCurveTo(x + w * 0.9, y + h * 0.7, x + w * 0.65, y + h * 0.7);
  ctx.fill();
  // Head
  ctx.fillStyle = '#8e44ad';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.7, y + h * 0.45, w * 0.18, h * 0.15, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.82, y + h * 0.42);
  ctx.lineTo(x + w, y + h * 0.38);
  ctx.lineTo(x + w * 0.82, y + h * 0.52);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + w * 0.73, y + h * 0.43, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + w * 0.74, y + h * 0.43, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCloud(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#ffffff18';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.6, w * 0.4, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.3, y + h * 0.7, w * 0.3, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.7, y + h * 0.7, w * 0.28, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ========================
// PARTICLES
// ========================
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * -5 - 2,
      life: 1,
      color: color || '#39ff14',
      r: Math.random() * 5 + 2
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life -= 0.04;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ========================
// INIT & SPAWN
// ========================
function initPlayer() {
  const isJeep = selectedChar === 'jeep';
  player = {
    x: 80,
    y: GROUND_Y - (isJeep ? 48 : 52),
    w: isJeep ? 72 : 52,
    h: isJeep ? 48 : 52,
    vy: 0,
    onGround: true,
    jumpsLeft: 2,
    isJeep
  };
}

function spawnObstacle() {
  const roll = Math.random();
  const x = CANVAS_W + 20;
  // Pterodactyl at higher speed
  if (speed > 9 && Math.random() < 0.25) {
    const h = 40 + Math.random() * 20;
    const w = 60;
    const flyY = GROUND_Y - 80 - Math.random() * 60;
    obstacles.push({ type: 'ptero', x, y: flyY, w, h });
  } else if (roll < 0.5) {
    // Cactus
    const h = 40 + Math.random() * 30;
    obstacles.push({ type: 'cactus', x, y: GROUND_Y - h, w: 30, h });
  } else {
    // Rock
    const h = 25 + Math.random() * 20;
    obstacles.push({ type: 'rock', x, y: GROUND_Y - h, w: 35 + Math.random() * 15, h });
  }
}

function spawnCloud() {
  clouds.push({ x: CANVAS_W + 20, y: 20 + Math.random() * (CANVAS_H * 0.4), w: 80 + Math.random() * 60, h: 40 + Math.random() * 20 });
}

// ========================
// COLLISION
// ========================
function rectsOverlap(a, b) {
  const pad = 6;
  return (
    a.x + pad < b.x + b.w - pad &&
    a.x + a.w - pad > b.x + pad &&
    a.y + pad < b.y + b.h - pad &&
    a.y + a.h - pad > b.y + pad
  );
}

// ========================
// JUMP
// ========================
function doJump() {
  if (!gameRunning) return;
  if (player.jumpsLeft > 0) {
    player.vy = player.jumpsLeft === 2 ? JUMP_VY : DOUBLE_JUMP_VY;
    player.onGround = false;
    player.jumpsLeft--;
    spawnParticles(player.x + player.w / 2, player.y + player.h, selectedChar === 'dino' ? '#39ff14' : '#ff8c00', 5);
    playJumpSound();
  }
}

// ========================
// SOUND
// ========================
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playJumpSound() {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.frequency.setValueAtTime(300, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    osc.start(); osc.stop(ac.currentTime + 0.15);
  } catch (e) {}
}

function playDeathSound() {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain); gain.connect(ac.destination);
    osc.frequency.setValueAtTime(400, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
    osc.start(); osc.stop(ac.currentTime + 0.3);
  } catch (e) {}
}

function playScoreSound() {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + 0.1);
  } catch (e) {}
}

// ========================
// GAME LOOP
// ========================
let obstacleCooldown = 0;
let cloudCooldown = 0;

function gameLoop() {
  animId = requestAnimationFrame(gameLoop);
  frameCount++;

  // Update speed
  if (speed < MAX_SPEED) speed += SPEED_INC;

  // Ground scroll
  groundOffset = (groundOffset + speed) % 40;

  // Player physics
  if (!player.onGround) {
    player.vy += GRAVITY;
    player.y += player.vy;
    if (player.y >= GROUND_Y - player.h) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumpsLeft = 2;
    }
  }

  // Spawn obstacles
  obstacleCooldown--;
  if (obstacleCooldown <= 0) {
    spawnObstacle();
    obstacleCooldown = Math.floor(60 / (speed / 5)) + Math.random() * 30;
  }

  // Spawn clouds
  cloudCooldown--;
  if (cloudCooldown <= 0) {
    spawnCloud();
    cloudCooldown = 80 + Math.random() * 120;
  }

  // Move obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= speed;
    if (obstacles[i].x + obstacles[i].w < -20) obstacles.splice(i, 1);
  }

  // Move clouds
  for (let i = clouds.length - 1; i >= 0; i--) {
    clouds[i].x -= speed * 0.3;
    if (clouds[i].x + clouds[i].w < -20) clouds.splice(i, 1);
  }

  // Score
  score = Math.floor(frameCount / 6);
  document.getElementById('score').textContent = score;
  if (score > 0 && score % 100 === 0 && frameCount % 6 === 0) {
    playScoreSound();
    spawnParticles(player.x + player.w / 2, player.y, '#ffd700', 8);
  }

  // Collision
  for (const obs of obstacles) {
    if (rectsOverlap(player, obs)) {
      endGame();
      return;
    }
  }

  updateParticles();
  draw();
}

// ========================
// DRAW
// ========================
function draw() {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Clouds
  for (const c of clouds) drawCloud(c.x, c.y, c.w, c.h);

  // Stars (static, subtle)
  ctx.fillStyle = '#ffffff22';
  for (let i = 0; i < 30; i++) {
    // deterministic pseudo-random using index
    const sx = ((i * 137 + 17) % CANVAS_W);
    const sy = ((i * 97 + 13) % (GROUND_Y - 20));
    ctx.beginPath();
    ctx.arc(sx, sy, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
  // Ground line
  ctx.strokeStyle = '#39ff1466';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_W, GROUND_Y);
  ctx.stroke();
  // Ground dashes
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  for (let x = -groundOffset; x < CANVAS_W; x += 40) {
    ctx.moveTo(x, GROUND_Y + 15);
    ctx.lineTo(x + 20, GROUND_Y + 15);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Obstacles
  for (const obs of obstacles) {
    if (obs.type === 'cactus') drawCactus(obs.x, obs.y, obs.w, obs.h);
    else if (obs.type === 'rock') drawRock(obs.x, obs.y, obs.w, obs.h);
    else if (obs.type === 'ptero') drawPterodactyl(obs.x, obs.y, obs.w, obs.h);
  }

  // Player
  const moving = player.onGround;
  if (player.isJeep) {
    drawJeep(player.x, player.y, player.w, player.h, moving, '#ff8c00');
  } else {
    drawDino(player.x, player.y, player.w, player.h, moving, '#39ff14');
  }

  // Particles
  drawParticles();

  // Speed indicator
  const speedPct = (speed - 5) / (MAX_SPEED - 5);
  ctx.fillStyle = '#39ff1422';
  ctx.fillRect(CANVAS_W - 60, CANVAS_H - 8, 50 * speedPct, 4);
  ctx.strokeStyle = '#39ff1444';
  ctx.lineWidth = 1;
  ctx.strokeRect(CANVAS_W - 60, CANVAS_H - 8, 50, 4);
}

// ========================
// PREVIEW CANVASES
// ========================
function drawPreviews() {
  // Dino preview
  const dinoCanvas = document.createElement('canvas');
  dinoCanvas.width = 64; dinoCanvas.height = 64;
  const dc = dinoCanvas.getContext('2d');
  dc.save();
  // mini dino
  function miniDino(ctx2) {
    ctx2.fillStyle = '#39ff14';
    ctx2.beginPath(); ctx2.roundRect(13, 13, 29, 26, 3); ctx2.fill();
    ctx2.beginPath(); ctx2.roundRect(29, 4, 24, 18, 3); ctx2.fill();
    ctx2.fillStyle = '#111';
    ctx2.beginPath(); ctx2.arc(48, 9, 2.5, 0, Math.PI * 2); ctx2.fill();
    ctx2.fillStyle = '#39ff14';
    ctx2.beginPath(); ctx2.moveTo(13, 22); ctx2.lineTo(4, 28); ctx2.lineTo(6, 38); ctx2.lineTo(14, 35); ctx2.fill();
    ctx2.beginPath(); ctx2.roundRect(16, 36, 8, 20, 2); ctx2.fill();
    ctx2.beginPath(); ctx2.roundRect(26, 36, 8, 20, 2); ctx2.fill();
  }
  miniDino(dc);
  const dinoPreview = document.getElementById('preview-dino');
  dinoPreview.appendChild(dinoCanvas);

  // Jeep preview
  const jeepCanvas = document.createElement('canvas');
  jeepCanvas.width = 64; jeepCanvas.height = 64;
  const jc = jeepCanvas.getContext('2d');
  jc.fillStyle = '#ff8c00';
  jc.beginPath(); jc.roundRect(4, 26, 56, 24, 4); jc.fill();
  jc.beginPath(); jc.roundRect(12, 10, 38, 18, 3); jc.fill();
  jc.fillStyle = '#7df8ff88';
  jc.beginPath(); jc.roundRect(15, 13, 14, 12, 2); jc.fill();
  jc.beginPath(); jc.roundRect(33, 13, 14, 12, 2); jc.fill();
  jc.fillStyle = '#333';
  jc.beginPath(); jc.arc(16, 52, 10, 0, Math.PI * 2); jc.fill();
  jc.beginPath(); jc.arc(48, 52, 10, 0, Math.PI * 2); jc.fill();
  jc.fillStyle = '#aaa';
  jc.beginPath(); jc.arc(16, 52, 5, 0, Math.PI * 2); jc.fill();
  jc.beginPath(); jc.arc(48, 52, 5, 0, Math.PI * 2); jc.fill();
  const jeepPreview = document.getElementById('preview-jeep');
  jeepPreview.appendChild(jeepCanvas);
}

// ========================
// UI FUNCTIONS
// ========================
function selectChar(ch) {
  selectedChar = ch;
  localStorage.setItem('dinoChar', ch);
  document.getElementById('btn-dino').classList.toggle('selected', ch === 'dino');
  document.getElementById('btn-jeep').classList.toggle('selected', ch === 'jeep');
}

function startGame() {
  document.getElementById('overlay-menu').classList.add('hidden');
  document.getElementById('overlay-gameover').classList.add('hidden');
  document.getElementById('mobile-jump').style.display = '';

  score = 0;
  frameCount = 0;
  speed = 5;
  obstacles = [];
  clouds = [];
  particles = [];
  obstacleCooldown = 60;
  cloudCooldown = 40;

  initPlayer();
  gameRunning = true;
  if (animId) cancelAnimationFrame(animId);
  gameLoop();
}

function restartGame() {
  startGame();
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animId);
  playDeathSound();
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4444', 15);

  const isNew = score > best;
  if (isNew) {
    best = score;
    localStorage.setItem('dinoBest', best);
  }

  document.getElementById('go-score').textContent = score;
  document.getElementById('go-best').textContent = best;
  document.getElementById('best').textContent = best;
  document.getElementById('go-record').classList.toggle('hidden', !isNew);

  // Draw final frame with particles
  updateParticles();
  draw();

  document.getElementById('overlay-gameover').classList.remove('hidden');
}

function showMenu() {
  gameRunning = false;
  if (animId) cancelAnimationFrame(animId);
  document.getElementById('overlay-gameover').classList.add('hidden');
  document.getElementById('overlay-menu').classList.remove('hidden');
  document.getElementById('mobile-jump').style.display = 'none';
}

function onJumpInput() {
  if (!gameRunning) {
    if (!document.getElementById('overlay-menu').classList.contains('hidden')) startGame();
    return;
  }
  doJump();
}

// ========================
// INPUT
// ========================
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (!gameRunning) {
      if (!document.getElementById('overlay-menu').classList.contains('hidden')) startGame();
      return;
    }
    doJump();
  }
});

canvas.addEventListener('click', () => {
  if (!gameRunning) return;
  doJump();
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  onJumpInput();
}, { passive: false });

// ========================
// INIT
// ========================
document.getElementById('best').textContent = best;
drawPreviews();
selectChar(selectedChar);
