/* ===== CARS RACING GAME — Multi-Mode ===== */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Sizing
const LANES = 5;
const LANE_W = 60;
const W = LANES * LANE_W;
const H = Math.min(window.innerHeight - 140, 600);
const CAR_W = 40;
const CAR_H = 70;
const COIN_R = 12;
canvas.width = W;
canvas.height = H;

// ===== PERSISTENCE =====
let totalCoins = parseInt(localStorage.getItem('carsCoins')) || 0;
let ownedCars = JSON.parse(localStorage.getItem('carsOwnedCars')) || ['sedan'];
let selectedCar = localStorage.getItem('carsSelectedCar') || 'sedan';
let best = parseInt(localStorage.getItem('carsBest')) || 0;
let animId = null;

// ===== CAR CATALOG =====
const CAR_CATALOG = [
  { id: 'sedan',      icon: '🚗', name: 'סדאן',       price: 0,     color: '#39ff14', speed: 1, handling: 1 },
  { id: 'sports',     icon: '🏎️', name: 'ספורט',      price: 200,   color: '#ff4444', speed: 1.2, handling: 1.1 },
  { id: 'truck',      icon: '🚛', name: 'משאית',       price: 300,   color: '#ff8c00', speed: 0.8, handling: 0.8 },
  { id: 'taxi',       icon: '🚕', name: 'מונית',       price: 150,   color: '#ffd700', speed: 1, handling: 1 },
  { id: 'police',     icon: '🚓', name: 'משטרה',       price: 500,   color: '#4488ff', speed: 1.3, handling: 1.2 },
  { id: 'ambulance',  icon: '🚑', name: 'אמבולנס',    price: 500,   color: '#ffffff', speed: 1.2, handling: 1.1 },
  { id: 'firetruck',  icon: '🚒', name: 'כבאית',       price: 600,   color: '#ff2222', speed: 0.9, handling: 0.9 },
  { id: 'bus',        icon: '🚌', name: 'אוטובוס',     price: 800,   color: '#44aaff', speed: 0.7, handling: 0.7 },
  { id: 'formula',    icon: '🏁', name: 'פורמולה',     price: 1500,  color: '#ff00ff', speed: 1.5, handling: 1.4 },
  { id: 'tank',       icon: '🪖', name: 'טנק',         price: 3000,  color: '#556b2f', speed: 0.6, handling: 1.5 },
  { id: 'rocket',     icon: '🚀', name: 'טיל',         price: 5000,  color: '#00ffff', speed: 2.0, handling: 1.3 },
  { id: 'ufo',        icon: '🛸', name: 'עב"מ',        price: 10000, color: '#aa44ff', speed: 1.8, handling: 2.0 },
];

function getCarDef(id) { return CAR_CATALOG.find(c => c.id === id) || CAR_CATALOG[0]; }

// ===== STATE =====
let state = null;
let currentMode = 'basic';

function updateHUD() {
  document.getElementById('best').textContent = best;
  document.getElementById('total-coins').textContent = totalCoins;
}
updateHUD();

// ===== MODE SELECTION =====
function selectMode(mode) {
  currentMode = mode;
  document.getElementById('overlay-menu').classList.add('hidden');
  startGame();
}

function showMainMenu() {
  document.getElementById('gameover-menu').classList.add('hidden');
  document.getElementById('overlay-menu').classList.remove('hidden');
  state = null;
  if (animId) cancelAnimationFrame(animId);
}

function restartGame() {
  document.getElementById('gameover-menu').classList.add('hidden');
  startGame();
}

// ===== CAR SELECT =====
function openCarSelect() {
  if (state && !state.gameOver) return;
  renderCarGrid();
  document.getElementById('car-select-menu').classList.remove('hidden');
}

function closeCarSelect() {
  document.getElementById('car-select-menu').classList.add('hidden');
}

function renderCarGrid() {
  const grid = document.getElementById('car-grid');
  grid.innerHTML = '';
  CAR_CATALOG.forEach(car => {
    const owned = ownedCars.includes(car.id);
    const locked = !owned;
    const selected = selectedCar === car.id;
    const card = document.createElement('div');
    card.className = `car-card${locked ? ' locked' : ''}${selected ? ' selected' : ''}`;
    card.innerHTML = `
      <div class="car-icon">${car.icon}</div>
      <div class="car-name">${car.name}</div>
      <div class="${owned ? 'car-owned' : 'car-price'}">${owned ? '✓ נבחר' : `🪙 ${car.price}`}</div>
    `;
    card.onclick = () => handleCarClick(car);
    grid.appendChild(card);
  });
}

function handleCarClick(car) {
  const owned = ownedCars.includes(car.id);
  if (owned) {
    selectedCar = car.id;
    localStorage.setItem('carsSelectedCar', car.id);
    renderCarGrid();
  } else if (totalCoins >= car.price) {
    totalCoins -= car.price;
    ownedCars.push(car.id);
    selectedCar = car.id;
    localStorage.setItem('carsCoins', totalCoins);
    localStorage.setItem('carsOwnedCars', JSON.stringify(ownedCars));
    localStorage.setItem('carsSelectedCar', car.id);
    updateHUD();
    renderCarGrid();
  }
}

// ===== START GAME =====
function startGame() {
  const carDef = getCarDef(selectedCar);
  state = {
    mode: currentMode,
    playerLane: Math.floor(LANES / 2),
    obstacles: [],
    coins: [],
    barriers: [],        // advanced mode
    mapBuildings: [],    // map mode
    aiRacer: null,       // competitive mode
    score: 0,
    distance: 0,
    coinsCollected: 0,
    speed: 3,
    gameOver: false,
    lastObstacle: 0,
    lastCoin: 0,
    lastBarrier: 0,
    roadOffset: 0,
    particles: [],
    weather: 'clear',
    weatherTimer: 0,
    playerColor: carDef.color,
    carSpeed: carDef.speed,
    carHandling: carDef.handling,
    mapSeed: Date.now(),
  };

  // Competitive mode: AI opponent
  if (currentMode === 'competitive') {
    state.aiRacer = {
      lane: Math.floor(LANES / 2),
      y: H - CAR_H - 20,
      score: 0,
      targetLane: Math.floor(LANES / 2),
      reactionDelay: 0,
      skill: 0.5 + Math.random() * 0.5, // 0.5-1.0
    };
  }

  // Map mode: generate buildings
  if (currentMode === 'map') {
    generateMapBuildings();
  }

  document.getElementById('score').textContent = '0';
  if (animId) cancelAnimationFrame(animId);
  loop();
}

// ===== GAME LOOP =====
function loop() {
  if (!state) return;
  update();
  draw();
  if (!state.gameOver) {
    animId = requestAnimationFrame(loop);
  }
}

// ===== UPDATE =====
function update() {
  const s = state;
  const speedMult = s.carSpeed;
  s.distance += s.speed * speedMult;
  s.roadOffset = (s.roadOffset + s.speed * speedMult) % 40;

  // Speed progression
  let baseSpeed = 3;
  if (s.mode === 'advanced') baseSpeed = 4;
  if (s.mode === 'map') baseSpeed = 3.5;
  if (s.mode === 'competitive') baseSpeed = 4.5;
  s.speed = baseSpeed + Math.floor(s.score / 50) * 0.5;
  const maxSpeed = s.mode === 'advanced' ? 15 : s.mode === 'competitive' ? 16 : 12;
  if (s.speed > maxSpeed) s.speed = maxSpeed;

  // Weather (advanced mode)
  if (s.mode === 'advanced') {
    s.weatherTimer++;
    if (s.weatherTimer > 600) {
      s.weather = ['clear', 'rain', 'fog'][Math.floor(Math.random() * 3)];
      s.weatherTimer = 0;
    }
  }

  // Spawn obstacles
  let spawnInterval = 120;
  if (s.mode === 'advanced') spawnInterval = 90;
  if (s.mode === 'map') spawnInterval = 100;
  if (s.mode === 'competitive') spawnInterval = 80;

  if (s.distance - s.lastObstacle > spawnInterval + Math.random() * 80) {
    const lane = Math.floor(Math.random() * LANES);
    s.obstacles.push({ lane, y: -CAR_H, color: randomEnemyColor() });
    // More obstacles in advanced/competitive
    const extraChance = s.mode === 'advanced' ? 0.4 : s.mode === 'competitive' ? 0.5 : 0.3;
    if (Math.random() > extraChance) {
      let lane2 = lane;
      while (lane2 === lane) lane2 = Math.floor(Math.random() * LANES);
      s.obstacles.push({ lane: lane2, y: -CAR_H - 30, color: randomEnemyColor() });
    }
    s.lastObstacle = s.distance;
  }

  // Barriers (advanced mode)
  if (s.mode === 'advanced') {
    if (s.distance - s.lastBarrier > 200 + Math.random() * 100) {
      // Multi-lane barrier with gap
      const gapLane = Math.floor(Math.random() * LANES);
      for (let i = 0; i < LANES; i++) {
        if (i !== gapLane) {
          s.barriers.push({ lane: i, y: -CAR_H });
        }
      }
      s.lastBarrier = s.distance;
    }
    s.barriers.forEach(b => b.y += s.speed * speedMult);
    s.barriers = s.barriers.filter(b => b.y < H + CAR_H);
  }

  // Spawn coins
  let coinInterval = 80;
  if (s.mode === 'advanced') coinInterval = 70;
  if (s.distance - s.lastCoin > coinInterval + Math.random() * 60) {
    const lane = Math.floor(Math.random() * LANES);
    // Sometimes spawn coin line
    const count = Math.random() > 0.7 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      s.coins.push({ lane, y: -COIN_R * 2 - i * 30 });
    }
    s.lastCoin = s.distance;
  }

  // Move
  const effectiveSpeed = s.speed * speedMult;
  s.obstacles.forEach(o => o.y += effectiveSpeed);
  s.obstacles = s.obstacles.filter(o => o.y < H + CAR_H);
  s.coins.forEach(c => c.y += effectiveSpeed);
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
      s.coinsCollected++;
      document.getElementById('score').textContent = s.score;
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

  // Collision
  for (const o of s.obstacles) {
    const ox = o.lane * LANE_W + LANE_W / 2;
    if (Math.abs(ox - px) < CAR_W * 0.8 && Math.abs(o.y - py) < CAR_H * 0.7) {
      gameOver(); return;
    }
  }
  // Barriers collision
  for (const b of (s.barriers || [])) {
    const bx = b.lane * LANE_W + LANE_W / 2;
    if (Math.abs(bx - px) < CAR_W * 0.9 && Math.abs(b.y - py) < CAR_H * 0.7) {
      gameOver(); return;
    }
  }

  // AI opponent (competitive mode)
  if (s.mode === 'competitive' && s.aiRacer) {
    updateAIRacer(s.aiRacer, s);
  }

  // Particles
  s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
  s.particles = s.particles.filter(p => p.life > 0);

  // Score from distance
  if (Math.floor(s.distance) % 10 === 0) {
    s.score++;
    document.getElementById('score').textContent = s.score;
  }
}

function updateAIRacer(ai, s) {
  ai.reactionDelay++;
  // React to obstacles ahead
  const nearestObs = s.obstacles.filter(o => o.y > ai.y - 200 && o.y < ai.y).sort((a, b) => b.y - a.y)[0];
  if (nearestObs && ai.reactionDelay > 15 - ai.skill * 10) {
    // Find safe lane
    let bestLane = ai.lane;
    for (let i = 0; i < LANES; i++) {
      const blocked = s.obstacles.some(o => o.lane === i && o.y > ai.y - 150 && o.y < ai.y + 50);
      if (!blocked) { bestLane = i; break; }
    }
    ai.targetLane = bestLane;
    ai.reactionDelay = 0;
  }
  // Move toward target lane
  if (ai.lane < ai.targetLane) ai.lane++;
  else if (ai.lane > ai.targetLane) ai.lane--;
  // Score similar to player
  ai.score = Math.floor(s.score * (0.7 + ai.skill * 0.5));
}

// ===== DRAW =====
function draw() {
  const s = state;

  if (s.mode === 'map') {
    drawMapBackground(s);
  } else {
    drawRoad(s);
  }

  // Weather effects
  if (s.mode === 'advanced') {
    if (s.weather === 'rain') {
      ctx.fillStyle = '#ffffff11';
      for (let i = 0; i < 30; i++) {
        const rx = Math.random() * W;
        const ry = Math.random() * H;
        ctx.fillRect(rx, ry, 1, 8);
      }
    } else if (s.weather === 'fog') {
      ctx.fillStyle = '#88888833';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Barriers
  (s.barriers || []).forEach(b => {
    const bx = b.lane * LANE_W + LANE_W / 2;
    ctx.fillStyle = '#ff660088';
    ctx.fillRect(bx - LANE_W / 2 + 2, b.y - CAR_H / 2, LANE_W - 4, CAR_H);
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - LANE_W / 2 + 4, b.y - CAR_H / 2 + 4, LANE_W - 8, CAR_H - 8);
  });

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

  // Enemies
  s.obstacles.forEach(o => drawCar(ctx, o.lane * LANE_W + LANE_W / 2, o.y, o.color, false));

  // AI opponent
  if (s.mode === 'competitive' && s.aiRacer) {
    const ai = s.aiRacer;
    const ax = ai.lane * LANE_W + LANE_W / 2;
    drawCar(ctx, ax, ai.y, '#ff8800', true);
    ctx.fillStyle = '#ff8800';
    ctx.font = '10px sans-serif';
    ctx.fillText('AI', ax, ai.y - CAR_H / 2 - 5);
  }

  // Player
  drawCar(ctx, s.playerLane * LANE_W + LANE_W / 2, H - CAR_H - 20, s.playerColor, true);

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

  // Competitive: AI score
  if (s.mode === 'competitive' && s.aiRacer) {
    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`AI: ${s.aiRacer.score}`, 10, 20);
    ctx.textAlign = 'right';
  }
}

function drawRoad(s) {
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.lineDashOffset = -s.roadOffset;
  for (let i = 1; i < LANES; i++) {
    ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, H); ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = '#39ff1444';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(1, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 1, 0); ctx.lineTo(W - 1, H); ctx.stroke();
}

function drawMapBackground(s) {
  // Simulated street map view
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, W, H);

  // Streets
  ctx.fillStyle = '#444';
  ctx.fillRect(0, 0, W, H);

  // Road markings
  ctx.strokeStyle = '#fff3';
  ctx.lineWidth = 2;
  ctx.setLineDash([15, 15]);
  ctx.lineDashOffset = -s.roadOffset;
  for (let i = 1; i < LANES; i++) {
    ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, H); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings
  ctx.fillStyle = '#555';
  s.mapBuildings.forEach(b => {
    const by = ((b.y + s.distance * b.parallax) % (H + b.h)) - b.h;
    ctx.fillRect(b.x, by, b.w, b.h);
    // Windows
    ctx.fillStyle = '#ffdd4422';
    for (let wy = by + 5; wy < by + b.h - 5; wy += 12) {
      for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += 10) {
        ctx.fillRect(wx, wy, 5, 5);
      }
    }
    ctx.fillStyle = '#555';
  });

  // Sidewalks
  ctx.fillStyle = '#666';
  ctx.fillRect(0, 0, 8, H);
  ctx.fillRect(W - 8, 0, 8, H);
}

function generateMapBuildings() {
  const s = state;
  let seed = s.mapSeed;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 20; i++) {
    const side = rng() > 0.5;
    const w = 30 + rng() * 40;
    const h = 40 + rng() * 60;
    s.mapBuildings.push({
      x: side ? W - w - 8 - rng() * 20 : 8 + rng() * 20,
      y: rng() * H,
      w, h,
      parallax: 0.2 + rng() * 0.3,
    });
  }
}

function drawCar(ctx, cx, cy, color, isPlayer) {
  const hw = CAR_W / 2, hh = CAR_H / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - hw, cy - hh, CAR_W, CAR_H, 8);
  ctx.fill();

  ctx.fillStyle = '#00000066';
  const windY = isPlayer ? cy - hh + 8 : cy + hh - 22;
  ctx.beginPath();
  ctx.roundRect(cx - hw + 6, windY, CAR_W - 12, 14, 4);
  ctx.fill();

  const lightY = isPlayer ? cy - hh + 2 : cy + hh - 6;
  ctx.fillStyle = isPlayer ? '#ffff00' : '#ff4444';
  ctx.beginPath(); ctx.roundRect(cx - hw + 3, lightY, 8, 4, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + hw - 11, lightY, 8, 4, 2); ctx.fill();

  if (isPlayer) {
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(cx - 3, cy - hh + 24, 6, CAR_H - 30);
  }
}

function randomEnemyColor() {
  return ['#ff4444', '#ff8c00', '#4488ff', '#aa44ff', '#ff44aa', '#888888'][Math.floor(Math.random() * 6)];
}

function gameOver() {
  state.gameOver = true;
  const isNewRecord = state.score > best;
  if (isNewRecord) {
    best = state.score;
    localStorage.setItem('carsBest', best);
  }
  // Award coins
  const earnedCoins = state.coinsCollected + Math.floor(state.score / 10);
  totalCoins += earnedCoins;
  localStorage.setItem('carsCoins', totalCoins);
  localStorage.setItem('carsOwnedCars', JSON.stringify(ownedCars));
  updateHUD();

  setTimeout(() => {
    document.getElementById('go-score').textContent = state.score;
    document.getElementById('go-distance').textContent = Math.floor(state.distance) + 'm';
    document.getElementById('go-coins').textContent = `+${earnedCoins} 🪙`;
    if (isNewRecord) {
      document.getElementById('go-new-record').classList.remove('hidden');
    } else {
      document.getElementById('go-new-record').classList.add('hidden');
    }
    document.getElementById('gameover-menu').classList.remove('hidden');
  }, 300);
}

function moveLeft() {
  if (!state || state.gameOver) return;
  if (state.playerLane > 0) state.playerLane--;
}

function moveRight() {
  if (!state || state.gameOver) return;
  if (state.playerLane < LANES - 1) state.playerLane++;
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') { moveLeft(); e.preventDefault(); }
  else if (e.key === 'ArrowRight' || e.key === 'd') { moveRight(); e.preventDefault(); }
});

document.getElementById('mc-left').addEventListener('pointerdown', e => { e.preventDefault(); moveLeft(); });
document.getElementById('mc-right').addEventListener('pointerdown', e => { e.preventDefault(); moveRight(); });

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
    if (dx > 0) moveRight(); else moveLeft();
    touchX = e.touches[0].clientX;
  }
}, { passive: false });
document.addEventListener('touchend', () => { touchX = null; }, { passive: true });
