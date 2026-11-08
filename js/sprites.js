const Sprites = (() => {
  const PAL = {
    k: '#1a1a1a',
    w: '#ffffff',
    n: '#4e3818',
    b: '#7a5a2e',
    B: '#a8803f',
    r: '#d83a3a',
    g: '#f5c542',
    u: '#3a6fd8',
  };

  const SHIRTS = ['#e04848', '#3a8ee0', '#f0d040', '#48c070', '#f08ad0', '#ff9a3c', '#9a6ae0', '#40c8c8', '#ffffff'];
  const PANTS = ['#3a4a8a', '#5a4a3a', '#2a2a2a', '#7a8a5a', '#c8b48a'];
  const SKINS = ['#f7d7b5', '#f2c29b', '#d9a066', '#a86c3c', '#6e4424'];
  const HAIRS = ['#3a2410', '#5a3a1a', '#e8c860', '#1a1a1a', '#a0522d', '#c8c8c8'];
  const CAPS = ['#e04848', '#3a6fd8', '#f0d040', '#ffffff', '#48c070'];
  const UMBRELLAS = [
    ['#e04848', '#ffffff'], ['#3a6fd8', '#f0d040'], ['#48c070', '#ffffff'], ['#f08ad0', '#9a6ae0'],
    ['#2a2a2a', '#4a4a4a'], ['#f0d040', '#e04848'], ['#ff9a3c', '#ffffff'],
  ];

  // Feet at the bottom row; the right hand is at column 8, row 9.
  const TOURIST_TOP = [
    '...3333...',
    '..333333..',
    '..3ssss3..',
    '..skssks..',
    '..ssssss..',
    '...ssss...',
    '....ss....',
    '..111111..',
    '.11111111.',
    '.s111111s.',
    '.s111111s.',
    '.s111111s.',
    '..111111..',
    '..111111..',
    '..222222..',
    '..222222..',
  ];
  const LEGS_APART = ['..22..22..', '..22..22..', '..22..22..', '..22..22..', '.kkk..kkk.'];
  const LEGS_TOGETHER = ['...2222...', '...2222...', '...2222...', '...2222...', '...kkkk...'];

  const CAP = ['...4444...', '..444444..', '..44444444'];

  const STATUE = [
    '...nnnn....',
    '..nBBbbn...',
    '..nBbbbbn..',
    '..nbbbkbn..',
    '..nbbbbbn..',
    '...nbbbn...',
    '....nbn....',
    '...nbbbn...',
    '..nBbbbbn..',
    '.nBnbbbbn..',
    '.nn.nbbbbn.',
    '....nbbbbBn',
    '....nbbbbn.',
    '....nbnnbn.',
    '....nbn.nbn',
    '....nbn.nbn',
    '...nnbn.nnn',
  ];

  const PARTY_HAT = ['..w..', '..r..', '.rgr.', '.grg.', 'rgrgr'];

  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function make(rows, map = {}) {
    const w = Math.max(...rows.map((r) => r.length));
    const c = canvas(w, rows.length);
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = map[row[x]] || PAL[row[x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  }

  function tint(src, color, alpha) {
    const c = canvas(src.width, src.height);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function look(kind) {
    let shirt = pick(SHIRTS);
    let pants = pick(PANTS);
    let hair = pick(HAIRS);
    let cap = Math.random() < 0.35 ? pick(CAPS) : null;
    if (kind === 'bureaucrat') {
      shirt = '#2b2d42';
      pants = '#2b2d42';
      hair = pick(['#3a2410', '#c8c8c8', '#1a1a1a']);
      cap = null;
    } else if (kind === 'vendor') {
      shirt = '#f4f4f4';
      pants = '#3a3a3a';
      cap = '#ffffff';
    }
    const map = { 1: shirt, 2: pants, 3: hair, s: pick(SKINS) };
    const frames = [make([...TOURIST_TOP, ...LEGS_APART], map), make([...TOURIST_TOP, ...LEGS_TOGETHER], map)];
    return {
      frames,
      wet: frames.map((f) => tint(f, '#f7e04a', 0.45)),
      cap: cap ? make(CAP, { 4: cap }) : null,
    };
  }

  // 17x17: canopy rows 0-6, pole down column 8 to row 16 (the hand).
  function umbrella() {
    const [a, b] = pick(UMBRELLAS);
    const c = canvas(17, 17);
    const g = c.getContext('2d');
    const halfWidths = [2, 4, 6, 7, 8, 8];
    halfWidths.forEach((hw, row) => {
      for (let x = -hw; x <= hw; x++) {
        const edge = row === 0 || Math.abs(x) === hw;
        const stripe = Math.floor((x + 8) / 3) % 2;
        g.fillStyle = edge ? PAL.k : stripe ? b : a;
        g.fillRect(8 + x, row, 1, 1);
      }
    });
    g.fillStyle = PAL.k;
    for (let x = -8; x <= 8; x++) {
      if ((x + 8) % 4 !== 2) g.fillRect(8 + x, 6, 1, 1);
    }
    g.fillRect(8, 6, 1, 11);
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(4, 2, 2, 1);
    g.fillRect(3, 3, 1, 1);
    return c;
  }

  function buildBackground() {
    const c = canvas(W, H);
    const g = c.getContext('2d');
    const R = (col, x, y, w, h) => {
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
    };
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const BASE = 206;

    const sky = ['#5fb0e6', '#6db8e8', '#7cc2ec', '#8dccf0', '#a0d6f3', '#b5e0f6', '#c9eaf8'];
    sky.forEach((col, i) => R(col, 0, i * 20, W, 20));
    R(sky[sky.length - 1], 0, 140, W, 70);

    const cloud = (x, y, w) => {
      R('#ffffff', x + 3, y, w - 6, 2);
      R('#ffffff', x, y + 2, w, 4);
      R('#e4f2fa', x + 1, y + 6, w - 2, 1);
    };
    cloud(12, 36, 26);
    cloud(120, 22, 30);
    cloud(150, 62, 22);
    cloud(58, 56, 18);

    function house(x, w, top, col, trim) {
      const gableH = 14;
      R(col, x, top + gableH, w, BASE - top - gableH);
      for (let i = 0; i < 4; i++) {
        const inset = Math.round(((i + 1) * w) / 10);
        R(col, x + inset, top + gableH - Math.round((i + 1) * 3.5), w - 2 * inset, 4);
      }
      R(trim, x + Math.floor(w / 2) - 1, top - 1, 2, 3);
      R(trim, x, top + gableH, w, 1);
      for (let wy = top + gableH + 5; wy < BASE - 18; wy += 12) {
        for (let wx = x + 3; wx < x + w - 5; wx += 7) {
          R('#1e2a38', wx, wy, 4, 7);
          R(trim, wx - 1, wy - 1, 6, 1);
          R('#5a7090', wx, wy, 1, 2);
        }
      }
      R(trim, x + 2, BASE - 13, w - 4, 1);
      R('#2a1e16', x + 2, BASE - 12, w - 4, 12);
      R('#f0d890', x + 4, BASE - 9, w - 8, 3);
    }

    house(0, 30, 96, '#4b3a2a', '#f5c542');
    house(30, 32, 110, '#8a3d2c', '#f0d080');
    house(142, 22, 100, '#2f4a3a', '#f5c542');
    house(164, 16, 118, '#6a4a6a', '#e8d090');

    // Town hall: slate roof, stone body, gothic tower with spire and the golden St Michael.
    for (let i = 0; i < 12; i++) R(i % 4 === 3 ? '#3c414b' : '#4a4f5a', 73 - i, 116 + i, 58 + 2 * i, 1);
    for (let x = 70; x < 136; x += 9) R('#2a2e36', x, 121, 2, 3);
    R('#d8c79e', 62, 128, 80, BASE - 128);
    R('#c4b288', 62, 128, 80, 2);
    for (const y of [145, 161, 177]) R('#b9a67c', 62, y, 80, 1);
    for (const wy of [134, 150, 166]) {
      for (let wx = 65; wx < 139; wx += 6) {
        R('#3a4658', wx, wy, 3, 8);
        R('#d8c79e', wx, wy, 1, 1);
        R('#d8c79e', wx + 2, wy, 1, 1);
      }
    }
    for (let x = 63; x < 140; x += 8) {
      R('#2c2620', x + 1, 186, 6, 20);
      R('#d8c79e', x + 1, 186, 1, 1);
      R('#d8c79e', x + 6, 186, 1, 1);
    }
    R('#d8c79e', 95, 44, 14, 84);
    R('#b9a67c', 107, 44, 2, 84);
    for (const y of [60, 76, 92, 108]) R('#b9a67c', 95, y, 14, 1);
    for (const y of [48, 64, 80, 96, 112]) {
      R('#3a4658', 98, y, 2, 8);
      R('#3a4658', 104, y, 2, 8);
    }
    R('#d8c79e', 97, 30, 10, 14);
    R('#3a4658', 100, 33, 1, 7);
    R('#3a4658', 103, 33, 1, 7);
    for (let i = 0; i < 26; i++) {
      const w = Math.max(1, Math.round((10 * i) / 26));
      R('#8f969e', 102 - Math.floor(w / 2), 4 + i, w, 1);
      if (i % 5 === 4) {
        R('#8f969e', 101 - Math.floor(w / 2), 4 + i, 1, 1);
        R('#8f969e', 102 + Math.ceil(w / 2), 4 + i, 1, 1);
      }
    }
    R('#f5c542', 101, 0, 2, 5);
    R('#f5c542', 99, 1, 6, 1);

    // Street: sidewalk, cobblestones, curb, and the brick wall the boiler sits against.
    R('#b8ab92', 0, BASE, W, 6);
    R('#a39780', 0, BASE + 5, W, 1);
    for (let x = 0; x < W; x += 12) R('#a39780', x, BASE, 1, 6);
    R('#5f5649', 0, BASE + 6, W, 50);
    const stones = ['#8c8170', '#958a78', '#83786a', '#7b7163'];
    for (let row = 0; row < 11; row++) {
      const y = BASE + 7 + row * 4;
      for (let x = -(row % 2) * 3; x < W; x += 6) {
        R(stones[(rnd() * stones.length) | 0], x, y, 5, 3);
        R('#a49986', x + 1, y, 3, 1);
      }
    }
    R('#a59a85', 0, 256, W, 3);
    R('#7a705f', 0, 259, W, 1);
    R('#3b2b22', 0, 260, W, 60);
    for (let y = 262, row = 0; y < H; y += 5, row++) {
      R('#2e211a', 0, y, W, 1);
      for (let x = (row % 2) * 5; x < W; x += 10) R('#2e211a', x, y + 1, 1, 4);
    }

    // Manneken Pis' corner: niche, pedestal, basin, fence.
    R('#cdbb94', 1, 168, 36, 44);
    R('#cdbb94', 5, 164, 28, 4);
    R('#cdbb94', 10, 161, 18, 3);
    R('#b5a27a', 10, 161, 18, 1);
    R('#8f7d5c', 6, 172, 26, 34);
    R('#8f7d5c', 9, 169, 20, 3);
    R('#8f7d5c', 13, 167, 12, 2);
    R('#e0d0a8', 12, 193, 16, 12);
    R('#f0e4c4', 13, 193, 14, 1);
    R('#b5a27a', 12, 197, 16, 1);
    R('#b5a27a', 12, 201, 16, 1);
    R('#bfae88', 3, 204, 32, 8);
    R('#5aa0d8', 5, 204, 28, 2);
    R('#a8d4f0', 7, 204, 8, 1);
    R('#1a1a1a', 0, 216, 39, 1);
    R('#1a1a1a', 0, 225, 39, 1);
    for (let x = 1; x < 39; x += 3) {
      R('#1a1a1a', x, 213, 1, 15);
      R('#f5c542', x, 212, 1, 1);
    }

    // Brass pipe from the boiler up the left edge into the statue's back.
    R('#8e6a24', 1, 182, 4, 92);
    R('#d4a347', 2, 182, 2, 92);
    R('#8e6a24', 1, 182, 13, 4);
    R('#d4a347', 2, 183, 11, 2);
    R('#8e6a24', 1, 270, 8, 4);
    R('#d4a347', 2, 271, 7, 2);
    for (const y of [198, 236]) R('#6a4e1a', 0, y, 6, 2);

    return c;
  }

  let statue = null;
  let statueWet = null;
  let partyHat = null;

  function init() {
    statue = make(STATUE);
    statueWet = tint(statue, '#f7e04a', 0.4);
    partyHat = make(PARTY_HAT);
  }

  return {
    init,
    look,
    umbrella,
    buildBackground,
    get statue() { return statue; },
    get statueWet() { return statueWet; },
    get partyHat() { return partyHat; },
  };
})();
