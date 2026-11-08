(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const lever = document.getElementById('lever');
  const leverLabel = lever.querySelector('.label');
  const controls = document.getElementById('controls');

  let pixelScale = 1;

  function resize() {
    const availW = window.innerWidth;
    const availH = window.innerHeight - controls.offsetHeight;
    let s = Math.min(availW / W, availH / H);
    const whole = Math.floor(s);
    if (whole >= 2 && whole / s >= 0.85) s = whole;
    const cssW = Math.floor(W * s);
    const cssH = Math.floor(H * s);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    pixelScale = canvas.width / W;
    lever.style.maxWidth = Math.max(260, Math.min(cssW, 420)) + 'px';
  }

  let activePointer = null;

  function onDown(e) {
    e.preventDefault();
    Sfx.init();
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
    lever.classList.add('pressed');
    Game.pressStart();
  }

  // Touch browsers only allow audio to start on finger-up, not finger-down.
  function unlockAudio() {
    Sfx.init();
  }
  window.addEventListener('pointerup', unlockAudio, true);
  window.addEventListener('touchend', unlockAudio, true);
  window.addEventListener('click', unlockAudio, true);

  function onUp(e) {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    lever.classList.remove('pressed');
    Game.pressEnd();
  }

  for (const el of [lever, canvas]) {
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
    el.addEventListener('lostpointercapture', onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  let keyDown = false;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    e.preventDefault();
    if (keyDown) return;
    keyDown = true;
    Sfx.init();
    lever.classList.add('pressed');
    Game.pressStart();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    e.preventDefault();
    if (!keyDown) return;
    keyDown = false;
    lever.classList.remove('pressed');
    Game.pressEnd();
  });

  function releaseAll() {
    if (activePointer === null && !keyDown) return;
    activePointer = null;
    keyDown = false;
    lever.classList.remove('pressed');
    Game.pressEnd();
  }
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  Game.init();
  resize();

  let lastLabel = '';
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Game.update(dt);
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    Game.render(ctx);
    const label = Game.leverLabel();
    if (label !== lastLabel) {
      leverLabel.textContent = label;
      lastLabel = label;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
