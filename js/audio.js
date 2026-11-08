const Sfx = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let hiss = null;
  let stream = null;
  // iOS can leave a context silent after the page is backgrounded or interrupted,
  // even while it reports "running", so such contexts get replaced on the next tap.
  let stale = false;

  const markStale = () => { if (ctx) stale = true; };
  document.addEventListener('visibilitychange', () => { if (document.hidden) markStale(); });
  window.addEventListener('pagehide', markStale);
  window.addEventListener('pageshow', (e) => { if (e.persisted) markStale(); });

  function teardown() {
    try { ctx.close(); } catch (_) { /* already closed */ }
    ctx = null;
    master = null;
    hiss = null;
    stream = null;
  }

  function init() {
    if (ctx && (stale || ctx.state === 'closed' || ctx.state === 'interrupted')) teardown();
    stale = false;
    if (ctx) {
      if (ctx.state !== 'running') {
        const resumed = ctx.resume();
        if (resumed) resumed.then(() => { if (ctx && ctx.state !== 'running') stale = true; }, markStale);
        playSilence();
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // Without this, the iPhone ring/silent switch mutes all Web Audio.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* unsupported */ }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    playSilence();
  }

  // iOS only fully unlocks audio once a sound actually starts inside a user gesture.
  function playSilence() {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination);
    src.start(0);
  }

  function envelope(gain, t0, vol, dur) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function tone({ freq = 440, end = null, type = 'square', dur = 0.1, vol = 0.2, delay = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, t0 + dur);
    envelope(gain, t0, vol, dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.2, type = 'bandpass', freq = 1000, end = null, q = 1, delay = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (end) filter.frequency.exponentialRampToValueAtTime(end, t0 + dur);
    filter.Q.value = q;
    const gain = ctx.createGain();
    envelope(gain, t0, vol, dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.02);
  }

  function loop(type, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return { src, filter, gain };
  }

  function fadeOut(node, time = 0.1) {
    if (!node) return;
    const now = ctx.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setTargetAtTime(0, now, time / 3);
    node.src.stop(now + time + 0.1);
  }

  function startHiss() {
    if (!ctx) return;
    stopHiss();
    hiss = loop('highpass', 2500, 0.7);
  }

  function setHiss(p) {
    if (!hiss) return;
    const now = ctx.currentTime;
    hiss.gain.gain.setTargetAtTime(p < 0.45 ? 0 : (p - 0.45) * 0.4, now, 0.05);
    hiss.filter.frequency.setTargetAtTime(2500 + p * 4000, now, 0.05);
  }

  function stopHiss() {
    if (!hiss) return;
    fadeOut(hiss, 0.15);
    hiss = null;
  }

  function startStream(p) {
    if (!ctx) return;
    stopStream();
    stream = loop('bandpass', 1300 + p * 1000, 0.9);
    stream.gain.gain.setTargetAtTime(0.35, ctx.currentTime, 0.02);
  }

  function stopStream() {
    if (!stream) return;
    fadeOut(stream, 0.12);
    stream = null;
  }

  function playNotes(notes, { type = 'square', vol = 0.08, gap = 0.07, dur = 0.09 } = {}) {
    notes.forEach((freq, i) => tone({ freq, type, dur, vol, delay: i * gap }));
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  return {
    init,
    startHiss,
    setHiss,
    stopHiss,
    startStream,
    stopStream,
    pump() {
      tone({ freq: 110, end: 55, type: 'square', dur: 0.07, vol: 0.12 });
      noise({ dur: 0.05, vol: 0.15, type: 'lowpass', freq: 700 });
    },
    splash() {
      noise({ dur: 0.18, vol: 0.3, type: 'bandpass', freq: 900, end: 300, q: 0.8 });
    },
    plink() {
      tone({ freq: rand(1600, 2000), end: 1400, type: 'triangle', dur: 0.1, vol: 0.12 });
    },
    yell() {
      const base = rand(380, 620);
      tone({ freq: base, end: base * 0.45, type: 'sawtooth', dur: 0.32, vol: 0.1 });
      tone({ freq: base * 1.5, end: base * 0.6, type: 'square', dur: 0.25, vol: 0.04, delay: 0.02 });
    },
    combo(mult) {
      playNotes(mult >= 3 ? [523, 659, 784, 1047] : [523, 659, 784], { gap: 0.06, dur: 0.08 });
    },
    miss() {
      tone({ freq: 220, end: 140, type: 'square', dur: 0.18, vol: 0.07 });
    },
    blowout() {
      noise({ dur: 0.35, vol: 0.5, type: 'lowpass', freq: 2000, end: 200 });
      tone({ freq: 140, end: 40, type: 'sine', dur: 0.35, vol: 0.45 });
      noise({ dur: 1.4, vol: 0.25, type: 'highpass', freq: 5000, end: 1500, delay: 0.05 });
      tone({ freq: 300, end: 900, type: 'square', dur: 0.25, vol: 0.05, delay: 0.3 });
    },
    tick() {
      tone({ freq: 1000, type: 'square', dur: 0.04, vol: 0.06 });
    },
    start() {
      playNotes([392, 523, 659, 784]);
    },
    timeUp() {
      playNotes([784, 659, 523, 392], { gap: 0.12, dur: 0.12 });
    },
    birthday() {
      if (!ctx) return;
      const G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99;
      const song = [
        [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
        [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
        [G4, 0.75], [G4, 0.25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 2],
        [F5, 0.75], [F5, 0.25], [E5, 1], [C5, 1], [D5, 1], [C5, 3],
      ];
      const beat = 0.32;
      let t = 0.3;
      for (const [freq, beats] of song) {
        const dur = beats * beat;
        tone({ freq, type: 'square', dur: dur * 0.9, vol: 0.07, delay: t });
        tone({ freq: freq / 2, type: 'triangle', dur: dur * 0.9, vol: 0.12, delay: t });
        t += dur;
      }
    },
  };
})();
