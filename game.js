/* 奶龙大冒险 — Web 完整实现 */
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  const startBtn = document.getElementById('startBtn');
  const challengeBtn = document.getElementById('challengeBtn');
  const menu = document.getElementById('menu');
  const hud = document.getElementById('hud');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const targetEl = document.getElementById('target');
  const energyBar = document.getElementById('energyBar');
  const skillBtn = document.getElementById('skillBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const overlayMsg = document.getElementById('overlayMsg');
  const msgTitle = document.getElementById('msgTitle');
  const msgText = document.getElementById('msgText');
  const retryBtn = document.getElementById('retryBtn');
  const menuBtn = document.getElementById('menuBtn');

  function resize() {
    const DPR = window.devicePixelRatio || 1;
    canvas.width = innerWidth * DPR;
    canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  const Audio = (() => {
    const ac = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(freq = 440, time = 0.06, type = 'sine', gain = 0.08) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + time);
      o.stop(ac.currentTime + time + 0.02);
    }

    function click(){ playTone(800, 0.04, 'square', 0.06); }
    function eat(){
      playTone(520, 0.08, 'sine', 0.08);
      setTimeout(() => playTone(720, 0.06, 'sine', 0.05), 60);
    }
    function skill(){
      playTone(260, 0.12, 'triangle', 0.12);
      playTone(380, 0.06, 'sine', 0.06);
    }
    function die(){ playTone(120, 0.3, 'sawtooth', 0.14); }
    function win(){
      playTone(980, 0.14, 'sine', 0.08);
      playTone(680, 0.12, 'sine', 0.06);
    }

    return { click, eat, skill, die, win };
  })();

  const pointer = { x: innerWidth / 2, y: innerHeight / 2, down: false };
  addEventListener('mousemove', e => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t) {
      pointer.x = t.clientX;
      pointer.y = t.clientY;
    }
  }, { passive: true });
  addEventListener('touchstart', () => { pointer.down = true; }, { passive: true });
  addEventListener('touchend', () => { pointer.down = false; }, { passive: true });
  addEventListener('mousedown', e => {
    pointer.down = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  addEventListener('mouseup', () => { pointer.down = false; });

  addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      game.tryUseSkill();
    }
    if (e.code === 'KeyP') togglePause();
  });

  const FOOD_TYPES = {
    milk: { color: '#fff', score: 10, grow: 2, energy: 6, weight: 60 },
    bottle: { color: '#FFF0F3', score: 45, grow: 4, energy: 18, weight: 8 },
    yogurt: { color: '#FFF7E6', score: 25, grow: 0, energy: 12, speed: 1.4, weight: 14 },
    cheese: { color: '#FAE7C6', score: 18, grow: 3, energy: 4, slow: 0.8, weight: 10 },
    heart: { color: '#FFDDE6', score: 120, grow: 6, energy: 40, rare: true, weight: 1 }
  };

  function rand(min, max) { return Math.random() * (max - min) + min; }

  const game = {
    running: false,
    paused: false,
    level: 1,
    score: 0,
    target: 100,
    head: { x: innerWidth / 2, y: innerHeight / 2, angle: 0, speed: 2.2 },
    trail: [],
    segmentSpacing: 8,
    segments: 6,
    foods: [],
    obstacles: [],
    particles: [],
    energy: 0,
    maxEnergy: 100,
    skillCooldown: 0,
    skillReady: true,
    speedBuff: 0,
    speedBuffTimer: 0,
    slowTimer: 0,
    lastSpawn: 0,
    spawnInterval: 900,
    lastTime: 0
  };

  startBtn.onclick = () => { startGame(false); };
  challengeBtn.onclick = () => { startGame(true); };
  skillBtn.onclick = () => { tryUserSkill(); };
  pauseBtn.onclick = () => { togglePause(); };
  retryBtn.onclick = () => { startGame(false); overlayMsg.classList.add('hidden'); };
  menuBtn.onclick = () => { showMenu(); };

  function showMenu() {
    menu.classList.remove('hidden');
    menu.classList.add('active');
    hud.classList.add('hidden');
    overlayMsg.classList.add('hidden');
    game.running = false;
  }

  function startGame(challenge = false) {
    menu.classList.add('hidden');
    menu.classList.remove('active');
    hud.classList.remove('hidden');
    overlayMsg.classList.add('hidden');
    resetState();
    if (challenge) game.target = 200;
    else game.target = 100;
    updateHUD();
    game.running = true;
    game.paused = false;
    game.lastTime = performance.now();
    requestAnimationFrame(loop);
    Audio.click();
  }

  function resetState() {
    const W = innerWidth, H = innerHeight;
    game.level = 1;
    game.score = 0;
    game.head.x = W / 2;
    game.head.y = H / 2;
    game.head.angle = 0;
    game.head.speed = 2.2;
    game.trail = [];
    game.segments = 6;
    game.foods = [];
    game.obstacles = [];
    game.particles = [];
    game.energy = 12;
    game.skillCooldown = 0;
    game.skillReady = true;
    game.speedBuff = 0;
    game.speedBuffTimer = 0;
    game.slowTimer = 0;
    game.lastSpawn = 0;
    game.spawnInterval = 900;
    spawnFoods(7);
    spawnObstacles(2);
  }

  function updateHUD() {
    scoreEl.textContent = '分数: ' + game.score;
    levelEl.textContent = '关卡: ' + game.level;
    targetEl.textContent = '目标: ' + game.target;
    energyBar.style.width = Math.min(100, Math.floor(game.energy)) + '%';
  }

  function spawnFoods(n = 1) {
    const pool = [];
    for (const [key, info] of Object.entries(FOOD_TYPES)) {
      const weight = info.weight || 1;
      for (let i = 0; i < weight; i++) pool.push(key);
    }

    for (let i = 0; i < n; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      game.foods.push({
        id: Math.random().toString(36).slice(2, 9),
        type,
        x: rand(40, innerWidth - 40),
        y: rand(60, innerHeight - 80),
        r: rand(8, 14)
      });
    }
  }

  function spawnObstacles(n = 1) {
    for (let i = 0; i < n; i++) {
      const w = rand(36, 80), h = rand(24, 60);
      game.obstacles.push({
        id: Math.random().toString(36).slice(2, 9),
        x: rand(40, innerWidth - 40 - w),
        y: rand(80, innerHeight - 120 - h),
        w,
        h,
        vx: Math.random() < 0.5 ? rand(-0.6, -0.2) : rand(0.2, 0.6)
      });
    }
  }

  game.tryUseSkill = () => {
    if (!game.running || game.paused) return;
    if (game.energy >= 30 && game.skillReady) useSkill();
  };

  function tryUserSkill() { game.tryUseSkill(); }

  function useSkill() {
    const angle = game.head.angle;
    const sx = game.head.x + Math.cos(angle) * 28;
    const sy = game.head.y + Math.sin(angle) * 28;

    for (let i = game.obstacles.length - 1; i >= 0; i--) {
      const o = game.obstacles[i];
      const dx = (o.x + o.w / 2) - sx;
      const dy = (o.y + o.h / 2) - sy;
      if (Math.hypot(dx, dy) < 150) {
        game.obstacles.splice(i, 1);
        spawnParticles(sx, sy, 12, '#fff');
      }
    }

    for (let i = game.foods.length - 1; i >= 0; i--) {
      const f = game.foods[i];
      const dx = f.x - sx;
      const dy = f.y - sy;
      if (Math.hypot(dx, dy) < 90 && !FOOD_TYPES[f.type].rare) {
        f.x += dx * 0.6;
        f.y += dy * 0.6;
      }
    }

    game.energy = Math.max(0, game.energy - 30);
    game.skillReady = false;
    game.skillCooldown = 1200;
    Audio.skill();
  }

  function spawnParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      game.particles.push({
        x,
        y,
        vx: rand(-1.6, 1.6),
        vy: rand(-2.2, 0.6),
        life: rand(400, 900),
        age: 0,
        color
      });
    }
  }

  function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (r * r);
  }

  function loop(t) {
    if (!game.running) return;
    if (game.paused) {
      game.lastTime = t;
      requestAnimationFrame(loop);
      return;
    }

    const dt = Math.min(40, t - game.lastTime);
    game.lastTime = t;
    step(dt);
    render();
    requestAnimationFrame(loop);
  }

  function step(dt) {
    if (!game.skillReady) {
      game.skillCooldown -= dt;
      if (game.skillCooldown <= 0) {
        game.skillReady = true;
        game.skillCooldown = 0;
      }
    }

    if (game.speedBuffTimer > 0) {
      game.speedBuffTimer -= dt;
      if (game.speedBuffTimer <= 0) game.speedBuff = 0;
    }

    if (game.slowTimer > 0) {
      game.slowTimer -= dt;
      if (game.slowTimer <= 0) game.head.speed = 2.2;
    }

    const dx = pointer.x - game.head.x;
    const dy = pointer.y - game.head.y;
    const target = Math.atan2(dy, dx);
    let diff = ((target - game.head.angle + Math.PI) % (Math.PI * 2)) - Math.PI;
    game.head.angle += diff * 0.14;

    const speed = game.head.speed + (game.speedBuff || 0);
    game.head.x += Math.cos(game.head.angle) * speed;
    game.head.y += Math.sin(game.head.angle) * speed;

    if (game.head.x < 0) { game.head.x = 0; game.head.angle += Math.PI * 0.6; }
    if (game.head.x > innerWidth) { game.head.x = innerWidth; game.head.angle += Math.PI * 0.6; }
    if (game.head.y < 0) { game.head.y = 0; game.head.angle += Math.PI * 0.6; }
    if (game.head.y > innerHeight) { game.head.y = innerHeight; game.head.angle += Math.PI * 0.6; }

    game.trail.unshift({ x: game.head.x, y: game.head.y });
    const need = Math.ceil((game.segments + 12) * game.segmentSpacing);
    if (game.trail.length > need) game.trail.length = need;

    for (let i = game.foods.length - 1; i >= 0; i--) {
      const f = game.foods[i];
      const dist = Math.hypot(f.x - game.head.x, f.y - game.head.y);
      if (dist < (f.r + 14)) {
        const info = FOOD_TYPES[f.type];
        game.score += info.score;
        game.segments += info.grow || 0;
        game.energy = Math.min(game.maxEnergy, game.energy + (info.energy || 6));
        if (info.speed) { game.speedBuff = info.speed; game.speedBuffTimer = 2200; }
        if (info.slow) { game.slowTimer = 1400; game.head.speed = 1.6; }
        spawnParticles(f.x, f.y, 12, info.color || '#fff');
        game.foods.splice(i, 1);
        Audio.eat();
        if (game.score >= game.target) levelUp();
      }
    }

    for (const o of game.obstacles) {
      o.x += o.vx * (dt / 16);
      if (o.x < 10 || o.x + o.w > innerWidth - 10) o.vx *= -1;
    }

    for (const o of game.obstacles) {
      if (circleRectCollision(game.head.x, game.head.y, 12, o.x, o.y, o.w, o.h)) {
        const lost = Math.max(2, Math.floor(game.segments * 0.35));
        game.segments = Math.max(3, game.segments - lost);
        spawnParticles(game.head.x, game.head.y, 18, '#f2e6e6');
        Audio.die();
        game.head.x -= Math.cos(game.head.angle) * 30;
        game.head.y -= Math.sin(game.head.angle) * 30;
      }
    }

    for (let i = 12; i < game.segments * game.segmentSpacing && i < game.trail.length; i += 6) {
      const p = game.trail[i];
      const dist = Math.hypot(p.x - game.head.x, p.y - game.head.y);
      if (dist < 12) {
        gameOver();
        return;
      }
    }

    game.lastSpawn += dt;
    if (game.lastSpawn > game.spawnInterval) {
      spawnFoods(1);
      game.lastSpawn = 0;
      game.spawnInterval = Math.max(450, 900 - game.level * 60);
    }

    if (game.obstacles.length < Math.min(8, 1 + Math.floor(game.level / 2))) {
      if (Math.random() < 0.01) spawnObstacles(1);
    }

    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.age += dt;
      p.x += p.vx * (dt / 16) * 1.6;
      p.y += p.vy * (dt / 16) * 1.6;
      p.vy += 0.04 * (dt / 16);
      if (p.age >= p.life) game.particles.splice(i, 1);
    }

    updateHUD();
  }

  function levelUp() {
    game.level++;
    game.target = Math.floor(game.target * 1.45) + 40;
    game.segments += 1;
    game.energy = Math.min(game.maxEnergy, game.energy + 25);
    spawnObstacles(1 + Math.floor(game.level / 3));
    spawnFoods(4);
    Audio.win();
  }

  function gameOver() {
    game.running = false;
    overlayMsg.classList.remove('hidden');
    msgTitle.textContent = '游戏结束';
    msgText.textContent = '分数: ' + game.score + ' — 关卡: ' + game.level;
    hud.classList.add('hidden');
    Audio.die();
  }

  function render() {
    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    for (const o of game.obstacles) {
      ctx.fillStyle = '#F6EDED';
      ctx.strokeStyle = '#E9DCDC';
      ctx.lineWidth = 2;
      roundRect(ctx, o.x, o.y, o.w, o.h, 8);
      ctx.fill();
      ctx.stroke();
    }

    for (const f of game.foods) {
      const info = FOOD_TYPES[f.type];
      ctx.beginPath();
      ctx.fillStyle = info.color || '#fff';
      ctx.strokeStyle = '#E6E6E6';
      ctx.lineWidth = 2;
      ctx.ellipse(f.x, f.y, f.r, f.r * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6b6b6b';
      ctx.font = '10px sans-serif';
      ctx.fillText(String(info.score || 0), f.x - 6, f.y + 4);
    }

    for (const p of game.particles) {
      const alpha = 1 - p.age / p.life;
      ctx.fillStyle = hexToRgba(p.color || '#FFF', alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < game.segments; i++) {
      const idx = i * game.segmentSpacing;
      if (!game.trail[idx]) continue;
      const p = game.trail[idx];
      const size = Math.max(6, 16 - i * 0.5);
      const alpha = 1 - i / game.segments;
      ctx.beginPath();
      ctx.fillStyle = hexToRgba('#ffffff', alpha);
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(game.head.x, game.head.y);
    ctx.rotate(game.head.angle);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#F0DCDC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(8, -4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (!game.skillReady) {
      const x = innerWidth - 80, y = innerHeight - 50, r = 18;
      const frac = Math.max(0, game.skillCooldown / 1200);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = '#FFB6C1';
      ctx.lineWidth = 4;
      ctx.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + (1 - frac) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function hexToRgba(h, a = 1) {
    const c = h.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function togglePause() {
    if (!game.running) return;
    game.paused = !game.paused;
    if (game.paused) {
      overlayMsg.classList.remove('hidden');
      msgTitle.textContent = '已暂停';
      msgText.textContent = '';
      retryBtn.style.display = 'none';
      menuBtn.style.display = 'inline-block';
      hud.classList.add('hidden');
    } else {
      overlayMsg.classList.add('hidden');
      retryBtn.style.display = 'inline-block';
      menuBtn.style.display = 'inline-block';
      hud.classList.remove('hidden');
    }
  }

  skillBtn.addEventListener('click', () => { tryUserSkill(); });
  showMenu();
})();
