/* ===== CARS RACING GAME ===== */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

// Sizing
const LANES = 5;
const LANE_W = 60;
const W = LANES * LANE_W;
const H = Math.min(window.innerHeight - 140, 600);
canvas.width = W;
canvas.height = H;
canvas.style.width = W + 'px';
canvas.style.height = H + 'px';

// State
let state = null;
let best = parseInt(localStorage.getItem('carsBest')) || 0;
let animId = null;
document.getElementById('best').textContent = best;

const CAR_W = 40;
const CAR_H = 70;
const COIN_R = 12;
const PLAYER_COLORS = ['#39ff14', '#00ffff', '#ff00ff', '#ffd700'];
let playerColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

function startGame() {
  overlay.classList.add('hidden');
  playerColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  state = {
    playerLane: Math.floor(LANES / 2),
    obstacles: [],
    coins: [],
    score: 0,
    speed: 3,
    distance: 0,
    gameOver: false,
    lastObstacle: 0,
    lastCoin: 0,
    roadOffset: 0,
    particles: [],
  };
  document.getElementById('score').textContent = '0';
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function loop() {
  if (!state) return;
  update();
  draw();
  if (!state.gameOver) {
    animId = requestAnimationFrame(loop);
  }
}

function update() {
  const s = state;
  s.distance += s.speed;
  s.roadOffset = (s.roadOffset + s.speed) % 40;

  // Speed up over time
  s.speed = 3 + Math.floor(s.score / 50) * 0.5;
  if (s.speed > 12) s.speed = 12;

  // Spawn obstacles
  if (s.distance - s.lastObstacle > 120 + Math.random() * 80) {
    const lane = Math.floor(Math.random() * LANES);
    // Sometimes spawn 2
    s.obstacles.push({ lane, y: -CAR_H, color: randomEnemyColor() });
    if (Math.random() > 0.6) {
      let lane2 = lane;
      while (lane2 === lane) lane2 = Math.floor(Math.random() * LANES);
      s.obstacles.push({ lane: lane2, y: -CAR_H - 30, color: randomEnemyColor() });
    }
    s.lastObstacle = s.distance;
  }

  // Spawn coins
  if (s.distance - s.lastCoin > 80 + Math.random() * 60) {
    const lane = Math.floor(Math.random() * LANES);
    s.coins.push({ lane, y: -COIN_R * 2 });
    s.lastCoin = s.distance;
  }

  // Move obstacles
  s.obstacles.forEach(o => o.y += s.speed);
  s.obstacles = s.obstacles.filter(o => o.y < H + CAR_H);

  // Move coins
  s.coins.forEach(c => c.y += s.speed);
  s.coins = s.coins.filter(c => c.y < H + COIN_R * 2);

  // Player position
  const px = s.playerLane * LANE_W + LANE_W / 2;
  const py = H - CAR_H - 20;

  // Coin collection
  s.coins = s.coins.filter(c => {
    const cx = c.lane * LANE_W + LANE_W / 2;
    const cy = c.y;
    if (Math.abs(cx - px) < LANE_W * 0.6 && Math.abs(cy - py) < CAR_H * 0.6) {
      s.score += 10;
      document.getElementById('score').textContent = s.score;
      // Particles
      for (let i = 0; i < 8; i++) {
        s.particles.push({
          x: cx, y: cy,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 15, color: '#ffd700',
        });
      }
      return false;
    }
    return true;
  });

  // Collision with obstacles
  for (const o of s.obstacles) {
    const ox = o.lane * LANE_W + LANE_W / 2;
    if (Math.abs(ox - px) < CAR_W * 0.8 && Math.abs(o.y - py) < CAR_H * 0.7) {
      gameOver();
      return;
    }
  }

  // Particles
  s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
  s.particles = s.particles.filter(p => p.life > 0);
}

function draw() {
  const s = state;
  // Road
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, W, H);

  // Lane lines
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.lineDashOffset = -s.roadOffset;
  for (let i = 1; i < LANES; i++) {
    ctx.beginPath();
    ctx.moveTo(i * LANE_W, 0);
    ctx.lineTo(i * LANE_W, H);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Road edges
  ctx.strokeStyle = '#39ff1444';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(1, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 1, 0); ctx.lineTo(W - 1, H); ctx.stroke();

  // Coins
  s.coins.forEach(c => {
    const cx = c.lane * LANE_W + LANE_W / 2;
    ctx.fillStyle = '#ffd70033';
    ctx.beginPath(); ctx.arc(cx, c.y, COIN_R + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(cx, c.y, COIN_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, c.y);
  });

  // Enemy cars
  s.obstacles.forEach(o => {
    const ox = o.lane * LANE_W + LANE_W / 2;
    drawCar(ctx, ox, o.y, o.color, false);
  });

  // Player car
  const px = s.playerLane * LANE_W + LANE_W / 2;
  const py = H - CAR_H - 20;
  drawCar(ctx, px, py, playerColor, true);

  // Particles
  s.particles.forEach(p => {
    ctx.globalAlpha = p.life / 15;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Game over flash
  if (s.gameOver) {
    ctx.fillStyle = '#ff000033';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCar(ctx, cx, cy, color, isPlayer) {
  const hw = CAR_W / 2, hh = CAR_H / 2;

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - hw, cy - hh, CAR_W, CAR_H, 8);
  ctx.fill();

  // Windshield
  ctx.fillStyle = '#00000066';
  const windY = isPlayer ? cy - hh + 8 : cy + hh - 22;
  ctx.beginPath();
  ctx.roundRect(cx - hw + 6, windY, CAR_W - 12, 14, 4);
  ctx.fill();

  // Headlights/taillights
  const lightY = isPlayer ? cy - hh + 2 : cy + hh - 6;
  ctx.fillStyle = isPlayer ? '#ffff00' : '#ff4444';
  ctx.beginPath(); ctx.roundRect(cx - hw + 3, lightY, 8, 4, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + hw - 11, lightY, 8, 4, 2); ctx.fill();

  // Stripe
  if (isPlayer) {
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(cx - 3, cy - hh + 24, 6, CAR_H - 30);
  }
}

function randomEnemyColor() {
  const colors = ['#ff4444', '#ff8c00', '#4488ff', '#aa44ff', '#ff44aa', '#888888'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function gameOver() {
  state.gameOver = true;
  if (state.score > best) {
    best = state.score;
    localStorage.setItem('carsBest', best);
    document.getElementById('best').textContent = best;
  }
  setTimeout(() => {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h2>נגמר!</h2>
      <div style="color:var(--neon);font-size:1.3rem;font-weight:700">ניקוד: ${state.score}</div>
      ${state.score >= best ? '<div style="color:var(--gold);font-size:1rem">שיא חדש!</div>' : ''}
      <button onclick="startGame()">שחק שוב</button>
      <a href="index.html" style="color:var(--text-dim);font-size:.85rem;margin-top:.5rem">חזרה</a>
    `;
  }, 300);
}

// Move visually LEFT (lower lane index)
function moveLeft() {
  if (!state || state.gameOver) return;
  if (state.playerLane > 0) state.playerLane--;
}
// Move visually RIGHT (higher lane index)
function moveRight() {
  if (!state || state.gameOver) return;
  if (state.playerLane < LANES - 1) state.playerLane++;
}

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') { moveLeft(); e.preventDefault(); }
  else if (e.key === 'ArrowRight' || e.key === 'd') { moveRight(); e.preventDefault(); }
});

// Mobile buttons — use pointer events for reliability
document.getElementById('mc-left').addEventListener('pointerdown', e => { e.preventDefault(); moveLeft(); });
document.getElementById('mc-right').addEventListener('pointerdown', e => { e.preventDefault(); moveRight(); });

// Swipe on canvas area only
let touchX = null;
function isUIElement(el) { return el.closest('.mobile-controls, .game-overlay, .game-hud, button, a'); }
document.addEventListener('touchstart', e => {
  if (!state || state.gameOver || isUIElement(e.target)) return;
  touchX = e.touches[0].clientX;
  e.preventDefault();
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (!state || state.gameOver || !touchX || isUIElement(e.target)) return;
  e.preventDefault();
  const dx = e.touches[0].clientX - touchX;
  if (Math.abs(dx) > 30) {
    if (dx > 0) moveRight();
    else moveLeft();
    touchX = e.touches[0].clientX;
  }
}, { passive: false });
document.addEventListener('touchend', () => { touchX = null; }, { passive: true });
