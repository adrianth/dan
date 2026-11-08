const W = 180;
const H = 320;

const Game = (() => {
  const ORIGIN = { x: 23, y: 187 };
  const AIM_Y = 238;
  const FLOOR_Y = 241;
  const BASIN_Y = 206;
  const GRAVITY = 650;
  const ANGLE = (40 * Math.PI) / 180;
  const STATUE_POS = { x: 13, y: 176 };
  const DIAL = { x: 84, y: 292, r: 21 };
  const DIAL_A0 = Math.PI * 0.9;
  const DIAL_A1 = Math.PI * 2.1;
  const ZONES = [[0, 0.55, '#3fae4a'], [0.55, 0.8, '#f0c020'], [0.8, 1, '#d83a3a']];
  const BOILER = { x0: 8, x1: 172, y0: 266, y1: 316 };
  const VALVE = { x: 44, y: 259 };
  const LEVER_PIVOT = { x: 116, y: 266 };
  const LEVER_LENGTH = 22;
  const OPERATOR_HEAD = { x: 142, y: 236, w: 38 };
  const PEE = '#f7e04a';
  const PEE_DARK = '#d9b81f';

  const YELLS = {
    tourist: ['Sacrebleu!', 'Godverdomme!', 'Mamma mia!', 'Oh my God!', 'Une fois!', 'Verdorie!', 'Mein Gott!', 'Zut alors!', 'Nooo!', 'Ay caramba!'],
    bureaucrat: ['Mon dossier!', 'My briefcase!', 'Objection!', 'Not the suit!'],
    selfie: ['My selfie!', '#nofilter!', 'Delete that!'],
    vendor: ['Gaufre!', 'Mes gaufres!', 'Gaufre!!'],
  };
  const TAUNTS = ['Ha ha!', 'Nice try!', 'Merci!', 'Still dry!'];

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dialAngle = (p) => DIAL_A0 + p * (DIAL_A1 - DIAL_A0);
  const vibrate = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* unsupported */ } };

  let background = null;
  let operatorImg = null;
  let operatorCheer = 0;
  let state = 'title';
  let stateTime = 0;
  let clock = 0;

  let score = 0;
  let best = Number(localStorage.getItem('mp-best') || 0);
  let combo = 0;
  let soakedCount = 0;
  let timeLeft = CONFIG.roundSeconds;
  let lastTick = 0;

  let phase = 'ready';
  let phaseTime = 0;
  let pressure = 0;
  let holding = false;
  let needRelease = false;
  let strokeTimer = 0;
  let strokePhase = 1;
  let plinkCooldown = 0;

  let tourists = [];
  let drops = [];
  let particles = [];
  let texts = [];
  let puddles = [];
  let shots = [];
  let current = null;
  let spawnTimer = 0;
  let shake = 0;
  let statueWet = 0;
  let banner = null;

  function setState(s) {
    state = s;
    stateTime = 0;
  }

  function init() {
    Sprites.init();
    background = Sprites.buildBackground();
    operatorImg = new Image();
    operatorImg.src = 'img/head.png';
    for (let i = 0; i < 3; i++) spawnTourist(rand(50, 170));
  }

  // ---------- Tourists ----------

  function spawnTourist(atX = null) {
    const r = Math.random();
    let kind = 'tourist';
    if (r < 0.04 && !tourists.some((t) => t.kind === 'vendor')) kind = 'vendor';
    else if (r < 0.11) kind = 'bureaucrat';
    else if (r < 0.18) kind = 'selfie';

    const dir = Math.random() < 0.5 ? 1 : -1;
    const margin = kind === 'vendor' ? 32 : 14;
    const t = {
      kind,
      dir,
      x: atX !== null ? atX : dir === 1 ? -margin : W + margin,
      y: AIM_Y + ((Math.random() * 3) | 0),
      look: Sprites.look(kind),
      speed: rand(13, 22),
      umbrella: null,
      soaked: false,
      flee: 0,
      jz: 0,
      vz: 0,
      anim: Math.random() * 2,
      wobble: 0,
      bubble: null,
      taunted: false,
      dripTime: 0,
      stopAt: null,
      stopTime: 0,
    };
    if (kind === 'tourist' && Math.random() < CONFIG.umbrellaChance) t.umbrella = Sprites.umbrella();
    if (kind === 'bureaucrat') t.speed = rand(34, 42);
    if (kind === 'vendor') t.speed = rand(8, 11);
    if (kind === 'selfie') {
      t.speed = rand(14, 19);
      t.stopAt = rand(75, 160);
    }
    tourists.push(t);
  }

  function updateTourists(dt) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      if (tourists.length < CONFIG.maxTourists) spawnTourist();
      const progress = state === 'playing' ? 1 - timeLeft / CONFIG.roundSeconds : 0;
      spawnTimer = lerp(CONFIG.spawnStart, CONFIG.spawnEnd, progress) * rand(0.7, 1.3);
    }

    for (let i = tourists.length - 1; i >= 0; i--) {
      const t = tourists[i];
      t.wobble = Math.max(0, t.wobble - dt);
      if (t.bubble && (t.bubble.life -= dt) <= 0) t.bubble = null;
      if (t.jz > 0 || t.vz > 0) {
        t.jz += t.vz * dt;
        t.vz -= 320 * dt;
        if (t.jz <= 0) t.jz = t.vz = 0;
      }

      let speed = t.soaked ? t.flee : t.speed;
      if (!t.soaked && t.stopAt !== null && (t.dir === 1 ? t.x >= t.stopAt : t.x <= t.stopAt)) {
        t.stopAt = null;
        t.stopTime = CONFIG.selfieStopSeconds;
      }
      if (t.stopTime > 0 && !t.soaked) {
        t.stopTime -= dt;
        speed = 0;
      }
      t.x += t.dir * speed * dt;
      t.anim += (dt * speed) / 7;

      if (t.soaked && t.dripTime > 0) {
        t.dripTime -= dt;
        if (Math.random() < dt * 25) {
          particles.push({ x: t.x + rand(-3, 3), y: t.y - t.jz - rand(4, 18), vx: 0, vy: 10, g: 300, life: 0.4, max: 0.4, color: PEE, size: 1 });
        }
      }
      if (t.x < -45 || t.x > W + 45) tourists.splice(i, 1);
    }
  }

  function touristBoxes(t) {
    const top = t.y - t.jz - 21;
    const bottom = t.y - t.jz;
    const boxes = [{ x0: t.x - 4, x1: t.x + 4, y0: top, y1: bottom }];
    if (t.umbrella) {
      const px = t.x + 3 * t.dir;
      boxes.push({ x0: px - 8, x1: px + 8, y0: top - 7, y1: top + 1 });
    }
    if (t.kind === 'vendor') {
      const a = t.x + 6 * t.dir;
      const b = t.x + 26 * t.dir;
      boxes.push({ x0: Math.min(a, b), x1: Math.max(a, b), y0: bottom - 20, y1: bottom });
    }
    return boxes;
  }

  function hitTest(d) {
    for (const t of tourists) {
      for (const b of touristBoxes(t)) {
        if (d.x >= b.x0 && d.x <= b.x1 && d.y >= b.y0 && d.y <= b.y1) return t;
      }
    }
    return null;
  }

  // ---------- Pressure and stream ----------

  function startPumping() {
    phase = 'pumping';
    phaseTime = 0;
    pressure = 0;
    strokeTimer = 0;
    Sfx.startHiss();
  }

  function rangeFor(p) {
    return CONFIG.minRange + clamp(p, 0, 1) * (CONFIG.maxRange - CONFIG.minRange);
  }

  function fire() {
    Sfx.stopHiss();
    const p = pressure;
    const dribble = p < 0.06;
    current = {
      p,
      t: 0,
      dur: dribble ? 0.45 : CONFIG.streamSeconds,
      dribble,
      acc: 0,
      hits: 0,
      alive: 0,
      done: false,
      landX: dribble ? ORIGIN.x + 10 : ORIGIN.x + rangeFor(p),
    };
    shots.push(current);
    phase = 'streaming';
    phaseTime = 0;
    Sfx.startStream(dribble ? 0 : p);
  }

  function emitDrop(shot, dribble) {
    let vx;
    let vy;
    if (dribble) {
      vx = rand(4, 18);
      vy = rand(-15, 5);
    } else {
      const p = shot.p * (1 - 0.06 * (shot.t / shot.dur));
      const D = rangeFor(p);
      const dy = AIM_Y - ORIGIN.y;
      const c = Math.cos(ANGLE);
      const v = Math.sqrt((GRAVITY * D * D) / (2 * c * c * (dy + D * Math.tan(ANGLE)))) * rand(0.985, 1.015);
      const a = ANGLE + rand(-0.015, 0.015);
      vx = v * Math.cos(a);
      vy = -v * Math.sin(a);
    }
    drops.push({ x: ORIGIN.x, y: ORIGIN.y, vx, vy, shot, bounced: false, harmless: false });
    shot.alive++;
  }

  function blowout() {
    phase = 'blowout';
    phaseTime = 0;
    needRelease = true;
    pressure = 1;
    Sfx.stopHiss();
    Sfx.blowout();
    vibrate(250);
    shake = 0.5;
    combo = 0;
    statueWet = 3.5;
    for (let i = 0; i < 40; i++) {
      particles.push({ x: VALVE.x + rand(-3, 3), y: VALVE.y, vx: rand(-40, 40), vy: rand(-90, -20), g: -20, life: rand(0.6, 1.4), max: 1.4, steam: true, size: rand(2, 4) });
    }
    for (let i = 0; i < 16; i++) {
      particles.push({ x: 8, y: 184, vx: rand(-10, 30), vy: rand(-50, -10), g: -20, life: rand(0.5, 1.1), max: 1.1, steam: true, size: rand(2, 3) });
    }
    for (let i = 0; i < 60; i++) {
      drops.push({ x: 14 + rand(-1, 2), y: 183, vx: rand(-15, 30), vy: rand(-170, -70), shot: null, bounced: false, harmless: true });
    }
    banner = { str: 'KABOOM!', life: 1.2, color: '#ff5a3c' };
  }

  function soak(t, shot) {
    t.soaked = true;
    t.vz = 75;
    t.flee = t.kind === 'vendor' ? 35 : 60;
    t.stopTime = 0;
    t.dripTime = 1.6;
    combo++;
    const mult = Math.min(CONFIG.maxMultiplier, combo);
    const pts = CONFIG.points[t.kind] * mult;
    score += pts;
    soakedCount++;
    if (shot) shot.hits++;
    const tx = clamp(t.x, 18, W - 18);
    texts.push({ x: tx, y: t.y - 36, str: '+' + pts, color: '#fff27a', life: 1.1, size: 6 });
    if (mult >= 2) {
      texts.push({ x: tx, y: t.y - 45, str: 'x' + mult + ' COMBO', color: '#ff9a3c', life: 1.1, size: 5 });
      Sfx.combo(mult);
    }
    t.bubble = { str: pick(YELLS[t.kind]), life: 1.6 };
    operatorCheer = 0.4;
    Sfx.yell();
    Sfx.splash();
    vibrate(40);
    shake = Math.max(shake, 0.18);
  }

  function deflect(d, t) {
    const px = t.x + 3 * t.dir;
    d.bounced = true;
    d.vy = -Math.abs(d.vy) * 0.3;
    d.vx = (d.x < px ? -1 : 1) * rand(25, 60);
    t.wobble = 0.4;
    if (plinkCooldown <= 0) {
      Sfx.plink();
      plinkCooldown = 0.12;
    }
    if (!t.taunted && !t.bubble && Math.random() < 0.05) {
      t.taunted = true;
      t.bubble = { str: pick(TAUNTS), life: 1.3 };
    }
  }

  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      let remove = false;

      if (!d.bounced && !d.harmless) {
        const t = hitTest(d);
        if (t) {
          if (t.umbrella) {
            deflect(d, t);
          } else {
            if (!t.soaked) soak(t, d.shot);
            if (Math.random() < 0.5) splashAt(d.x, d.y, 2);
            remove = true;
          }
        }
      }

      const floor = d.x < 35 ? BASIN_Y : FLOOR_Y;
      if (!remove && d.y >= floor) {
        remove = true;
        if (Math.random() < 0.4) splashAt(d.x, floor, 2);
        if (floor === FLOOR_Y) addPuddle(d.x);
      }
      if (!remove && (d.x > W + 10 || d.x < -10 || d.y > H)) remove = true;
      if (remove) {
        drops.splice(i, 1);
        if (d.shot) d.shot.alive--;
      }
    }
  }

  function splashAt(x, y, n) {
    for (let i = 0; i < n; i++) {
      particles.push({ x, y, vx: rand(-25, 25), vy: rand(-55, -20), g: 300, life: 0.4, max: 0.4, color: PEE, size: 1 });
    }
  }

  function addPuddle(x) {
    const near = puddles.find((p) => Math.abs(p.x - x) < 6);
    if (near) {
      near.w = Math.min(12, near.w + 0.15);
      near.life = 4;
    } else {
      puddles.push({ x, w: 2, life: 4 });
    }
  }

  function updateShot(dt) {
    plinkCooldown -= dt;

    if (phase === 'pumping') {
      phaseTime += dt;
      pressure += dt * CONFIG.pumpRate * (CONFIG.pumpBase + pressure);
      strokeTimer -= dt;
      if (strokeTimer <= 0) {
        strokeTimer = 0.26 - 0.12 * Math.min(pressure, 1);
        strokePhase = 0;
        Sfx.pump();
      }
      Sfx.setHiss(pressure);
      if (pressure > 0.8 && Math.random() < dt * 30 * (pressure - 0.7)) {
        particles.push({ x: VALVE.x + rand(-1, 1), y: VALVE.y, vx: rand(-8, 8), vy: rand(-40, -20), g: -10, life: 0.6, max: 0.6, steam: true, size: 1.5 });
      }
      if (pressure >= 1) blowout();
    }
    strokePhase = Math.min(1, strokePhase + dt / 0.2);

    if (current) {
      current.t += dt;
      current.acc += dt * CONFIG.dropsPerSecond;
      while (current.acc >= 1) {
        current.acc -= 1;
        emitDrop(current, current.dribble);
      }
      pressure = current.dribble ? 0 : current.p * (1 - current.t / current.dur);
      if (current.t >= current.dur) {
        for (let i = 0; i < 6; i++) emitDrop(current, true);
        current.done = true;
        current = null;
        Sfx.stopStream();
        phase = 'cooldown';
        phaseTime = 0;
      }
    } else if (phase !== 'pumping') {
      pressure = Math.max(0, pressure - dt * 3);
    }

    if (phase === 'cooldown') {
      phaseTime += dt;
      if (phaseTime >= CONFIG.cooldownSeconds) phase = 'ready';
    } else if (phase === 'blowout') {
      phaseTime += dt;
      if (phaseTime >= CONFIG.blowoutSeconds) phase = 'ready';
    }

    if (state === 'playing' && phase === 'ready' && holding && !needRelease) startPumping();

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (!s.done || s.alive > 0) continue;
      shots.splice(i, 1);
      if (s.hits === 0) {
        combo = 0;
        texts.push({ x: clamp(s.landX, 20, W - 20), y: 200, str: s.dribble ? 'OOPS!' : 'MISS', color: '#d0d0d0', life: 0.8, size: 5 });
        Sfx.miss();
      }
    }
  }

  // ---------- Main update ----------

  function resetRound() {
    score = 0;
    combo = 0;
    soakedCount = 0;
    timeLeft = CONFIG.roundSeconds;
    lastTick = Math.ceil(timeLeft);
    phase = 'ready';
    pressure = 0;
    needRelease = false;
    drops = [];
    shots = [];
    current = null;
    texts = [];
    puddles = [];
    particles = [];
    statueWet = 0;
    tourists = tourists.filter((t) => !t.soaked);
    while (tourists.length < 3) spawnTourist(rand(60, 170));
    spawnTimer = 0.6;
    setState('playing');
    banner = { str: 'GO!', life: 1, color: '#fff27a' };
    Sfx.start();
  }

  function finishRound() {
    if (score > best) {
      best = score;
      try { localStorage.setItem('mp-best', String(best)); } catch (_) { /* private mode */ }
    }
    if (score >= CONFIG.targetScore) {
      setState('finale');
      Sfx.birthday();
      vibrate([60, 60, 60, 60, 200]);
    } else {
      setState('results');
    }
  }

  function update(dt) {
    clock += dt;
    stateTime += dt;
    shake = Math.max(0, shake - dt);
    statueWet = Math.max(0, statueWet - dt);
    operatorCheer = Math.max(0, operatorCheer - dt);
    if (state === 'finale' && operatorCheer <= 0) operatorCheer = 0.4;
    if (banner && (banner.life -= dt) <= 0) banner = null;

    if (state === 'playing') {
      timeLeft -= dt;
      const sec = Math.ceil(timeLeft);
      if (sec < lastTick) {
        lastTick = sec;
        if (sec <= 5 && sec > 0) Sfx.tick();
      }
      if (timeLeft <= 0) {
        timeLeft = 0;
        if (phase === 'pumping') {
          Sfx.stopHiss();
          phase = 'cooldown';
          phaseTime = 0;
        }
        setState('timeup');
        banner = { str: "TIME'S UP!", life: 2, color: '#fff27a' };
        Sfx.timeUp();
      }
    } else if (state === 'timeup' && stateTime > 2.2 && !current && shots.length === 0) {
      finishRound();
    }

    updateShot(dt);
    updateTourists(dt);
    updateDrops(dt);

    if (statueWet > 0 && Math.random() < dt * 12) {
      particles.push({ x: STATUE_POS.x + rand(2, 10), y: STATUE_POS.y + rand(4, 16), vx: 0, vy: 5, g: 200, life: 0.3, max: 0.3, color: PEE, size: 1 });
    }

    if (state === 'finale') {
      if (Math.random() < dt * 40) {
        particles.push({
          x: rand(0, W), y: -4, vx: rand(-10, 10), vy: rand(20, 45), g: 0, life: 6, max: 6,
          confetti: true, color: pick(['#f5c542', '#e04848', '#3a8ee0', '#48c070', '#f08ad0', '#ffffff']),
          rot: rand(0, 6), vr: rand(-6, 6), size: 2,
        });
      }
      if (Math.random() < dt * 60) {
        particles.push({ x: 68, y: 167, vx: -rand(50, 75), vy: rand(-60, -40), g: 200, life: 1.2, max: 1.2, sparkle: true, color: pick(['#fff27a', '#f5c542', '#ffffff']), size: 1.5 });
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.confetti) {
        p.rot += p.vr * dt;
        p.x += Math.sin(clock * 3 + p.rot) * 10 * dt;
      }
      if (p.steam) p.size += dt * 4;
      if ((p.life -= dt) <= 0 || p.y > H + 5) particles.splice(i, 1);
    }

    for (let i = texts.length - 1; i >= 0; i--) {
      texts[i].y -= 14 * dt;
      if ((texts[i].life -= dt) <= 0) texts.splice(i, 1);
    }
    for (let i = puddles.length - 1; i >= 0; i--) {
      if ((puddles[i].life -= dt) <= 0) puddles.splice(i, 1);
    }
  }

  // ---------- Input ----------

  function pressStart() {
    holding = true;
    if (state === 'playing' && phase === 'ready' && !needRelease) startPumping();
  }

  function pressEnd() {
    holding = false;
    needRelease = false;
    if (phase === 'pumping') {
      if (state === 'playing') fire();
      return;
    }
    if (state === 'title' && stateTime > 0.3) resetRound();
    else if ((state === 'results' || state === 'finale') && stateTime > 1.5) resetRound();
  }

  function leverLabel() {
    if (state === 'title') return 'TAP TO START';
    if (state === 'playing') return 'HOLD TO PUMP';
    if (state === 'timeup') return '...';
    return 'PLAY AGAIN';
  }

  // ---------- Rendering ----------

  function text(ctx, str, x, y, size, color, align = 'center', outline = '#1a1008') {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (outline) {
      ctx.lineWidth = Math.max(1, size / 3);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = outline;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function circle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStatue(ctx) {
    const jitter = phase === 'blowout' && phaseTime < 0.6 ? Math.round(rand(-1, 1)) : 0;
    const img = statueWet > 0 ? Sprites.statueWet : Sprites.statue;
    ctx.drawImage(img, STATUE_POS.x + jitter, STATUE_POS.y);
  }

  function drawCart(ctx) {
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(3, -11, 5, 1);
    ctx.fillRect(7, -13, 19, 10);
    ctx.fillStyle = '#9a6a34';
    ctx.fillRect(8, -12, 17, 8);
    ctx.fillStyle = '#c08a4a';
    ctx.fillRect(8, -12, 17, 1);
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(16, -19, 1, 6);
    ctx.fillRect(11, -27, 12, 9);
    ctx.fillStyle = '#f0c050';
    ctx.fillRect(12, -26, 10, 7);
    ctx.fillStyle = '#c08a2a';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(14 + i * 3, -26, 1, 7);
      ctx.fillRect(12, -24 + i * 2, 10, 1);
    }
    circle(ctx, 11, -2, 2.2, '#1a1a1a');
    circle(ctx, 22, -2, 2.2, '#1a1a1a');
  }

  function drawTourist(ctx, t) {
    const stopped = t.stopTime > 0 && !t.soaked;
    const frame = stopped ? 1 : Math.floor(t.anim) % 2;
    ctx.save();
    ctx.translate(Math.round(t.x), Math.round(t.y - t.jz));
    if (t.dir < 0) ctx.scale(-1, 1);

    if (t.kind === 'vendor') drawCart(ctx);
    ctx.drawImage(t.soaked ? t.look.wet[frame] : t.look.frames[frame], -5, -21);
    if (t.look.cap) ctx.drawImage(t.look.cap, -5, -22);

    if (t.kind === 'bureaucrat') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -14, 4, 1);
      ctx.fillStyle = '#c0201a';
      ctx.fillRect(-1, -13, 2, 5);
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(2, -10, 6, 5);
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(4, -11, 2, 1);
      ctx.fillStyle = '#f5c542';
      ctx.fillRect(4, -8, 2, 1);
    }

    if (t.kind === 'selfie') {
      ctx.strokeStyle = '#8a8a8a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(3.5, -11.5);
      ctx.lineTo(8.5, -27);
      ctx.stroke();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(6, -31, 5, 4);
      if (stopped && Math.floor(clock * 2.5) % 2 === 0) {
        circle(ctx, 8.5, -29, 3, 'rgba(255,255,255,0.85)');
      }
    }

    if (t.umbrella) {
      ctx.save();
      ctx.translate(3, -12);
      if (t.wobble > 0) ctx.rotate(Math.sin(t.wobble * 45) * 0.2 * (t.wobble / 0.4));
      ctx.drawImage(t.umbrella, -8, -16);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBubble(ctx, t) {
    ctx.font = '5px "Press Start 2P", monospace';
    const w = Math.ceil(ctx.measureText(t.bubble.str).width) + 6;
    const h = 10;
    const headY = t.y - t.jz - (t.umbrella ? 30 : t.kind === 'selfie' ? 34 : 24);
    const x = clamp(Math.round(t.x - w / 2), 1, W - w - 1);
    const y = Math.round(headY - h - 4);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    const tx = clamp(Math.round(t.x), x + 2, x + w - 4);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(tx - 1, y + h, 4, 2);
    ctx.fillRect(tx, y + h + 2, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tx, y + h, 2, 1);
    ctx.fillRect(tx + 1, y + h + 1, 1, 1);
    text(ctx, t.bubble.str, x + w / 2, y + h / 2 + 0.5, 5, '#1a1a1a', 'center', null);
  }

  function drawBoiler(ctx) {
    const { x0, x1, y0, y1 } = BOILER;
    const pumping = phase === 'pumping';
    const danger = pumping ? clamp((pressure - 0.75) / 0.25, 0, 1) : 0;
    const sx = danger > 0 ? Math.round(rand(-1, 1) * danger * 1.5) : 0;
    const sy = danger > 0.5 ? Math.round(rand(-1, 1) * danger) : 0;

    ctx.save();
    ctx.translate(sx, sy);

    ctx.fillStyle = '#3b2a10';
    ctx.fillRect(x0 + 2, y0 - 1, x1 - x0 - 4, y1 - y0 + 2);
    ctx.fillRect(x0, y0 + 1, x1 - x0, y1 - y0 - 2);
    ctx.fillStyle = '#d4a347';
    ctx.fillRect(x0 + 2, y0, x1 - x0 - 4, y1 - y0);
    ctx.fillRect(x0 + 1, y0 + 2, x1 - x0 - 2, y1 - y0 - 4);
    ctx.fillStyle = '#f0cf7a';
    ctx.fillRect(x0 + 3, y0 + 3, x1 - x0 - 6, 2);
    ctx.fillStyle = '#a87f30';
    ctx.fillRect(x0 + 2, y1 - 6, x1 - x0 - 4, 5);

    for (const bx of [x0 + 14, x1 - 17]) {
      ctx.fillStyle = '#8e6a24';
      ctx.fillRect(bx, y0, 3, y1 - y0);
      ctx.fillStyle = '#f0cf7a';
      ctx.fillRect(bx, y0, 1, y1 - y0);
    }
    for (let x = x0 + 4; x < x1 - 3; x += 6) {
      for (const ry of [y0 + 1, y1 - 3]) {
        ctx.fillStyle = '#6a4e1a';
        ctx.fillRect(x, ry, 2, 2);
        ctx.fillStyle = '#f6e0a0';
        ctx.fillRect(x, ry, 1, 1);
      }
    }

    if (pressure > 0.6) {
      ctx.fillStyle = `rgba(255,60,30,${(Math.min(pressure, 1) - 0.6) * 0.45})`;
      ctx.fillRect(x0 + 1, y0, x1 - x0 - 2, y1 - y0);
    }

    // Plaque
    const cx = DIAL.x - 46;
    ctx.fillStyle = '#3b2a10';
    ctx.fillRect(cx - 17, y0 + 18, 34, 13);
    ctx.fillStyle = '#e8d8a8';
    ctx.fillRect(cx - 16, y0 + 19, 32, 11);
    text(ctx, 'PIS-O-', cx, y0 + 22.5, 4, '#3b2a10', 'center', null);
    text(ctx, 'MATIC', cx, y0 + 27, 4, '#3b2a10', 'center', null);

    // Safety valve
    ctx.fillStyle = '#3b2a10';
    ctx.fillRect(VALVE.x - 4, VALVE.y, 8, y0 - VALVE.y + 1);
    ctx.fillStyle = '#d4a347';
    ctx.fillRect(VALVE.x - 3, VALVE.y + 1, 6, y0 - VALVE.y);
    const capLift = phase === 'blowout' && phaseTime < 0.8 ? -4 : danger > 0.6 ? -Math.round(rand(0, 1.5)) : 0;
    ctx.fillStyle = '#c0201a';
    ctx.fillRect(VALVE.x - 4, VALVE.y - 2 + capLift, 8, 3);

    drawDial(ctx);
    drawLever(ctx);
    ctx.restore();
  }

  function drawDial(ctx) {
    const { x, y, r } = DIAL;
    circle(ctx, x, y, r + 3, '#3b2a10');
    circle(ctx, x, y, r + 2, '#f0cf7a');
    circle(ctx, x, y, r + 1, '#8e6a24');
    circle(ctx, x, y, r, '#f6eed6');

    ctx.lineCap = 'butt';
    for (const [a, b, col] of ZONES) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r - 3, dialAngle(a), dialAngle(b));
      ctx.stroke();
    }
    ctx.strokeStyle = '#3b2a10';
    for (let i = 0; i <= 10; i++) {
      const a = dialAngle(i / 10);
      const len = i % 2 === 0 ? 6 : 4;
      ctx.lineWidth = i % 2 === 0 ? 1 : 0.6;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1));
      ctx.lineTo(x + Math.cos(a) * (r - 1 - len), y + Math.sin(a) * (r - 1 - len));
      ctx.stroke();
    }
    for (const [v, label] of [[0, '0'], [0.5, '5'], [1, '10']]) {
      const a = dialAngle(v);
      text(ctx, label, x + Math.cos(a) * (r - 11), y + Math.sin(a) * (r - 11), 3, '#3b2a10', 'center', null);
    }
    text(ctx, 'BAR', x, y + 9, 4, '#3b2a10', 'center', null);

    let p = Math.min(pressure, 1.02);
    if (phase === 'pumping') {
      p += (Math.sin(clock * 53) * 0.5 + Math.sin(clock * 31) * 0.5) * (0.008 + 0.03 * pressure * pressure);
    } else if (phase === 'blowout' && phaseTime < 0.8) {
      p = 1.02 + Math.sin(clock * 60) * 0.02;
    }
    const a = dialAngle(p);
    ctx.strokeStyle = '#c0201a';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3);
    ctx.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
    ctx.stroke();
    circle(ctx, x, y, 2.5, '#3b2a10');
    circle(ctx, x, y, 1, '#f0cf7a');

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r - 1.5, Math.PI * 1.12, Math.PI * 1.42);
    ctx.stroke();
  }

  function leverKnob() {
    const angle = -0.6 + (phase === 'pumping' ? 0.45 * Math.sin(Math.PI * strokePhase) : 0);
    return {
      x: LEVER_PIVOT.x + Math.cos(angle) * LEVER_LENGTH,
      y: LEVER_PIVOT.y + Math.sin(angle) * LEVER_LENGTH,
    };
  }

  function drawLever(ctx) {
    const { x, y } = LEVER_PIVOT;
    const { x: ex, y: ey } = leverKnob();
    ctx.fillStyle = '#3b2a10';
    ctx.fillRect(x - 3, y - 1, 7, 3);
    ctx.strokeStyle = '#3b2a10';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = '#9a9a9a';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    circle(ctx, ex, ey, 3.5, '#3b2a10');
    circle(ctx, ex, ey, 2.6, '#d83a3a');
    circle(ctx, ex - 0.8, ey - 0.8, 0.9, '#ff9a8a');
    circle(ctx, x, y, 1.6, '#3b2a10');
  }

  function drawOperator(ctx) {
    const bob = phase === 'pumping' ? Math.sin(Math.PI * strokePhase) * 1.5 : 0;
    const hop = operatorCheer > 0 ? -Math.sin((operatorCheer / 0.4) * Math.PI) * 4 : 0;
    const panic = (phase === 'blowout' && phaseTime < 0.8) || (phase === 'pumping' && pressure > 0.85);
    const ox = panic ? Math.round(rand(-1, 1)) : 0;
    const oy = Math.round(bob + hop);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = '#2f3a5a';
    ctx.fillRect(153, 301, 7, 15);
    ctx.fillRect(164, 301, 7, 15);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(151, 315, 10, 3);
    ctx.fillRect(163, 315, 10, 3);
    ctx.fillStyle = '#7a1010';
    ctx.fillRect(151, 271, 22, 1);
    ctx.fillRect(149, 272, 26, 31);
    ctx.fillRect(174, 275, 5, 19);
    ctx.fillStyle = '#e03a2a';
    ctx.fillRect(152, 272, 20, 1);
    ctx.fillRect(150, 273, 24, 29);
    ctx.fillRect(175, 276, 3, 17);
    ctx.fillStyle = '#ff6a50';
    ctx.fillRect(151, 274, 2, 25);
    ctx.fillStyle = '#b02418';
    ctx.fillRect(171, 274, 2, 27);
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(161, 275, 2, 27);
    ctx.fillStyle = '#e8b48a';
    ctx.fillRect(175, 293, 3, 3);
    ctx.restore();

    // Two-segment arm: solve the elbow so the hand stays on the knob, bending outward and down.
    const knob = leverKnob();
    const shoulder = { x: 151 + ox, y: 277 + oy };
    const hand = { x: knob.x + 1, y: knob.y + 1 };
    const upper = 15;
    const fore = 14;
    const dx = hand.x - shoulder.x;
    const dy = hand.y - shoulder.y;
    const reach = clamp(Math.hypot(dx, dy), Math.abs(upper - fore) + 0.01, upper + fore - 0.01);
    const bend = Math.acos(clamp((upper * upper + reach * reach - fore * fore) / (2 * upper * reach), -1, 1));
    const toHand = Math.atan2(dy, dx);
    const elbow = {
      x: shoulder.x + Math.cos(toHand - bend) * upper,
      y: shoulder.y + Math.sin(toHand - bend) * upper,
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(hand.x, hand.y);
    ctx.strokeStyle = '#7a1010';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = '#e03a2a';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    circle(ctx, elbow.x, elbow.y, 1, '#b02418');

    const wrist = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
    ctx.save();
    ctx.translate(knob.x + 0.5, knob.y + 0.5);
    ctx.rotate(wrist);
    ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(-2.8, -2.6, 5.4, 5.2);
    ctx.fillStyle = '#e8b48a';
    ctx.fillRect(-2.2, -2, 4.2, 4);
    ctx.fillStyle = '#c98e64';
    ctx.fillRect(0.6, -2, 0.6, 4);
    ctx.restore();

    if (operatorImg && operatorImg.complete && operatorImg.naturalWidth) {
      const { x, y, w } = OPERATOR_HEAD;
      const h = (w * operatorImg.naturalHeight) / operatorImg.naturalWidth;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.translate(x + w / 2 + ox, y + h + oy);
      if (panic) ctx.rotate(Math.sin(clock * 40) * 0.06);
      else if (operatorCheer > 0) ctx.rotate(Math.sin(clock * 12) * 0.08);
      ctx.drawImage(operatorImg, -w / 2, -h, w, h);
      ctx.restore();
    }
  }

  function drawHud(ctx) {
    ctx.fillStyle = 'rgba(20,14,10,0.75)';
    ctx.fillRect(0, 0, W, 15);
    text(ctx, 'SCORE ' + score, 3, 6, 5, '#ffffff', 'left');
    const sec = Math.ceil(timeLeft);
    const low = sec <= 10 && state === 'playing';
    const timeStr = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    text(ctx, timeStr, W / 2 + 18, 6, 5, low && Math.floor(clock * 4) % 2 ? '#ff5a3c' : '#ffffff');
    if (combo >= 1) {
      text(ctx, 'x' + Math.min(CONFIG.maxMultiplier, combo + 1), W - 3, 6, 5, '#ff9a3c', 'right');
    }
    const frac = clamp(score / CONFIG.targetScore, 0, 1);
    ctx.fillStyle = '#3b2a10';
    ctx.fillRect(0, 12, W, 3);
    ctx.fillStyle = frac >= 1 ? (Math.floor(clock * 6) % 2 ? '#fff27a' : '#f5c542') : '#f5c542';
    ctx.fillRect(0, 12, Math.round(W * frac), 3);
  }

  function drawPanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(20,14,10,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#d4a347';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = '#8e6a24';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  }

  function possessive(name) {
    return name.toUpperCase() + (/s$/i.test(name) ? "'" : "'S");
  }

  function drawTitle(ctx) {
    drawPanel(ctx, 8, 30, 164, 178);
    text(ctx, possessive(CONFIG.playerName), W / 2, 46, 8, '#f5c542');
    text(ctx, 'BRUSSELS', W / 2, 59, 8, '#f5c542');
    text(ctx, 'BIRTHDAY DRIZZLE', W / 2, 72, 8, '#f5c542');
    const lines = [
      ['HOLD to pump pressure', '#fff27a'],
      ['RELEASE to pee', '#fff27a'],
      ['Soak tourists with', '#ffffff'],
      ['NO umbrella!', '#ffffff'],
      ["Don't blow the boiler!", '#ff8a6a'],
    ];
    lines.forEach(([s, c], i) => text(ctx, s, W / 2, 94 + i * 14, 6, c));
    text(ctx, `Score ${CONFIG.targetScore} for a`, W / 2, 172, 5, '#f08ad0');
    text(ctx, 'birthday surprise!', W / 2, 182, 5, '#f08ad0');
    if (Math.floor(clock * 2) % 2 === 0) text(ctx, 'TAP TO START', W / 2, 197, 6, '#ffffff');
    if (best > 0) text(ctx, 'BEST ' + best, W / 2, 22, 4, '#d0d0d0');
  }

  function drawResults(ctx) {
    drawPanel(ctx, 14, 44, 152, 150);
    text(ctx, "TIME'S UP!", W / 2, 60, 8, '#fff27a');
    text(ctx, 'SCORE', W / 2, 80, 5, '#d0d0d0');
    text(ctx, String(score), W / 2, 93, 10, '#ffffff');
    text(ctx, `Soaked: ${soakedCount}`, W / 2, 112, 5, '#ffffff');
    text(ctx, `Goal: ${CONFIG.targetScore}`, W / 2, 123, 5, '#f08ad0');
    text(ctx, `Best: ${best}`, W / 2, 134, 5, '#d0d0d0');
    const msg = score >= CONFIG.targetScore * 0.7 ? 'So close!' : 'Keep pumping!';
    text(ctx, msg, W / 2, 152, 6, '#ff9a3c');
    if (stateTime > 1.5 && Math.floor(clock * 2) % 2 === 0) text(ctx, 'TAP TO RETRY', W / 2, 178, 6, '#ffffff');
  }

  function drawFinale(ctx) {
    ctx.fillStyle = 'rgba(10,6,20,0.6)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(90, 145);
    ctx.rotate(clock * 0.4);
    ctx.fillStyle = 'rgba(245,197,66,0.13)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-12, -160);
      ctx.lineTo(12, -160);
      ctx.fill();
    }
    ctx.restore();

    const scale = 5;
    const sx = 90 - Math.round((Sprites.statue.width * scale) / 2);
    const sy = 110 + Math.round(Math.sin(clock * 3) * 2);
    ctx.save();
    ctx.translate(sx + Sprites.statue.width * scale, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(Sprites.statue, 0, 0, Sprites.statue.width * scale, Sprites.statue.height * scale);
    ctx.restore();
    const hat = Sprites.partyHat;
    ctx.drawImage(hat, sx + 3 * scale, sy - hat.height * scale + scale, hat.width * scale, hat.height * scale);

    for (const p of particles) {
      if (!p.sparkle && !p.confetti) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.confetti) ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size * (p.confetti ? 1.6 : 1), p.size);
      ctx.restore();
    }

    const pulse = 1 + Math.sin(clock * 5) * 0.05;
    ctx.save();
    ctx.translate(W / 2, 34);
    ctx.scale(pulse, pulse);
    text(ctx, 'HAPPY BIRTHDAY', 0, 0, 8, '#f5c542');
    ctx.restore();
    const name = CONFIG.playerName.toUpperCase() + '!';
    const size = Math.min(16, Math.floor(164 / name.length));
    text(ctx, name, W / 2, 58, size, '#ffffff', 'center', '#c0201a');
    text(ctx, 'Brussels is proud', W / 2, 82, 4, '#fff27a');
    text(ctx, 'of you!', W / 2, 90, 4, '#fff27a');
    text(ctx, `Score ${score}`, W / 2, 214, 6, '#ffffff');
    text(ctx, `${soakedCount} tourists soaked`, W / 2, 226, 4, '#d0d0d0');
    if (stateTime > 1.5 && Math.floor(clock * 2) % 2 === 0) text(ctx, 'TAP TO PLAY AGAIN', W / 2, 244, 5, '#ffffff');
  }

  function render(ctx) {
    ctx.save();
    if (shake > 0) ctx.translate(Math.round(rand(-1, 1) * shake * 8), Math.round(rand(-1, 1) * shake * 8));

    ctx.drawImage(background, 0, 0);

    for (const p of puddles) {
      ctx.fillStyle = `rgba(247,224,74,${0.55 * Math.min(1, p.life / 1.5)})`;
      const w = Math.round(p.w);
      ctx.fillRect(Math.round(p.x - w), FLOOR_Y - 1, w * 2, 2);
      ctx.fillRect(Math.round(p.x - w + 1), FLOOR_Y - 2, Math.max(0, w * 2 - 2), 1);
    }

    drawStatue(ctx);

    const sorted = tourists.slice().sort((a, b) => a.y - b.y);
    for (const t of sorted) drawTourist(ctx, t);

    for (const d of drops) {
      ctx.fillStyle = d.bounced || d.harmless ? PEE_DARK : PEE;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
    }

    drawBoiler(ctx);

    for (const p of particles) {
      if (p.confetti || p.sparkle) continue;
      if (p.steam) {
        circle(ctx, p.x, p.y, p.size, `rgba(240,240,240,${0.7 * (p.life / p.max)})`);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }

    for (const t of tourists) if (t.bubble) drawBubble(ctx, t);
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, t.life / 0.3);
      text(ctx, t.str, t.x, t.y, t.size, t.color);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (state === 'playing' || state === 'timeup') drawHud(ctx);

    if (banner) {
      const age = 1 - banner.life;
      const s = age < 0.15 ? 0.5 + age * 3.3 : 1;
      ctx.save();
      ctx.translate(W / 2, 120);
      ctx.scale(s, s);
      text(ctx, banner.str, 0, 0, 12, banner.color);
      ctx.restore();
    }

    if (state === 'title') drawTitle(ctx);
    else if (state === 'results') drawResults(ctx);
    else if (state === 'finale') drawFinale(ctx);

    drawOperator(ctx);
  }

  return { init, update, render, pressStart, pressEnd, leverLabel };
})();
