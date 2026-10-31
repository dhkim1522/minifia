/* minifia v2.0 3D 에셋 공용 코드 — three r128 (전역 THREE)
 * 배경: 승인 시안(design/v2.0/backgrounds/minifia-bg-concepts.html)의 응접실·시계탑 광장을 옮기고
 *       게임 장면 8개(시간대 5 + 최후 변론·밤 마피아·밤 시민)를 더했다.
 * 캐릭터: 1번 시안의 구·원통 조립 인물(세트 C 인물 5명)을 그대로 쓰고 의상 8·표정 10·동작 8 을 마피아 게임에 맞췄다.
 */
(function () {
  'use strict';
  var MF = window.MF3D = {};

  // ================= 공용 도구 =================
  var matCache = {};
  function M(c, o) {
    if (o) return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o));
    if (!matCache[c]) matCache[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });
    return matCache[c];
  }
  function add(p, geo, m, x, y, z, cast) {
    var o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = cast !== false; o.receiveShadow = true; p.add(o); return o;
  }
  function box(p, w, h, d, m, x, y, z, cast) { return add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, cast); }
  function cyl(p, rt, rb, h, seg, m, x, y, z) { return add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z); }
  function sph(p, r, m, x, y, z, ws, hs) { return add(p, new THREE.SphereGeometry(r, ws || 16, hs || 12), m, x, y, z); }
  function E(ctx, c, k) { var m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.6 }); ctx.em.push({ m: m, k: k }); return m; }
  function lampL(ctx, p, c, k, dist, x, y, z) { var l = new THREE.PointLight(c, k, dist, 2); l.position.set(x, y, z); p.add(l); ctx.lamps.push({ l: l, k: k }); return l; }
  var glowTex = null;
  function getGlowTex() {
    if (glowTex) return glowTex;
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); return glowTex;
  }
  function glow(ctx, p, c, size, x, y, z, k) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: k || 0.85 }));
    s.scale.set(size, size, 1); s.position.set(x, y, z); p.add(s); ctx.glows.push({ s: s, k: k || 0.85 }); return s;
  }
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function gable(w, h, d, m) {
    var s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    var g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2);
    var o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o;
  }
  function townTex(sp) {
    return canvasTex(256, 320, function (g) {
      var gr = g.createLinearGradient(0, 0, 0, 320);
      sp.sky.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
      g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
      for (var s = 0; s < (sp.stars || 0); s++) { g.fillStyle = 'rgba(201,211,234,' + (0.3 + Math.random() * 0.6) + ')'; g.fillRect(Math.random() * 256, Math.random() * 170, 2, 2); }
      var b = sp.body;
      var halo = g.createRadialGradient(b[0], b[1], 6, b[0], b[1], b[2] * 3.2); halo.addColorStop(0, b[4]); halo.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = halo; g.fillRect(0, 0, 256, 320);
      g.fillStyle = b[3]; g.beginPath(); g.arc(b[0], b[1], b[2], 0, Math.PI * 2); g.fill();
      if (sp.clouds) {
        g.fillStyle = sp.clouds;
        [[120, 70, 76, 14], [150, 56, 44, 14], [14, 150, 64, 12], [172, 132, 70, 12], [60, 112, 50, 10]].forEach(function (c) { g.beginPath(); g.ellipse(c[0] + c[2] / 2, c[1], c[2] / 2, c[3] / 2, 0, 0, Math.PI * 2); g.fill(); });
      }
      g.fillStyle = sp.far;
      [[0, 230, 60, 90], [50, 210, 40, 110], [88, 240, 70, 80], [150, 200, 30, 120], [176, 225, 80, 95]].forEach(function (r) { g.fillRect(r[0], r[1], r[2], r[3]); });
      g.beginPath(); g.moveTo(150, 200); g.lineTo(165, 175); g.lineTo(180, 200); g.fill();
      g.fillStyle = sp.near; [[0, 270, 90, 50], [80, 262, 60, 58], [136, 280, 120, 40]].forEach(function (r) { g.fillRect(r[0], r[1], r[2], r[3]); });
      if (sp.lit) { g.fillStyle = sp.lit; [[20, 250], [64, 230], [110, 260], [196, 245], [220, 262]].forEach(function (w) { g.fillRect(w[0], w[1], 6, 8); }); }
    });
  }
  function signTex(text, w, h, font, bg, fg) {
    return canvasTex(w, h, function (g) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(169,174,187,0.6)'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
      g.font = font; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
    });
  }
  var brickCache = {};
  function brickMat(base) {
    if (!brickCache[base]) {
      var t = canvasTex(256, 256, function (g) {
        var c = new THREE.Color(base);
        g.fillStyle = '#' + c.clone().multiplyScalar(0.62).getHexString(); g.fillRect(0, 0, 256, 256);
        for (var y = 0; y < 256; y += 16) for (var x = ((y / 16) % 2) * -16; x < 256; x += 32) {
          var k = 0.88 + Math.random() * 0.22; g.fillStyle = '#' + c.clone().multiplyScalar(k).getHexString(); g.fillRect(x + 1.5, y + 1.5, 29, 13);
        }
      });
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3);
      brickCache[base] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
    }
    return brickCache[base];
  }
  function stripeMat(a, b) {
    var t = canvasTex(128, 32, function (g) { for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * 16, 0, 16, 32); } });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  }
  function motes(ctx, p, colors, n, spread, top) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      var s = glow(ctx, p, colors[i % colors.length], 0.22 + Math.random() * 0.3, (Math.random() - 0.5) * spread, 0.8 + Math.random() * top, (Math.random() - 0.5) * spread, 0.6);
      s.userData = { v: 0.06 + Math.random() * 0.1, ph: Math.random() * 6 }; arr.push(s);
    }
    ctx.tick.push(function (dt, t) {
      arr.forEach(function (s) { s.position.y += s.userData.v * dt; s.position.x += Math.sin(t * 0.5 + s.userData.ph) * 0.002; if (s.position.y > top + 1.5) s.position.y = 0.8; });
    });
  }

  // ================= 시간대 5개 (승인 시안 값 그대로) =================
  var TIMES = [
    { id: 'dawn', label: '해뜰녘', sky: '#5e5878', ground: '#16182a', hemi: 0.55, sunC: '#b8908a', sun: 0.6, pos: [14, 5, 6], fog: '#2a2840', bg: '#2a2840', exp: 0.92, ek: 0.6, lk: 0.6, gk: 0.55, on: 0.7, pool: ['#b89a94', 0.06],
      tex: { sky: [[0, '#1e2442'], [0.6, '#4e4664'], [1, '#806670']], body: [196, 240, 18, '#b89890', 'rgba(184,152,144,0.35)'], stars: 18, clouds: 'rgba(110,96,120,0.4)', far: '#1c2038', near: '#10132a', lit: 'rgba(201,214,240,0.6)' } },
    { id: 'morning', label: '아침', sky: '#6e7490', ground: '#1a1d2e', hemi: 0.62, sunC: '#c4c0c4', sun: 0.75, pos: [12, 11, 8], fog: '#323650', bg: '#323650', exp: 0.96, ek: 0.15, lk: 0.1, gk: 0.15, on: 0.2, pool: ['#c4c4d0', 0.07],
      tex: { sky: [[0, '#2e3656'], [1, '#6a6e88']], body: [200, 130, 14, '#c8c6cc', 'rgba(200,198,204,0.3)'], clouds: 'rgba(120,124,146,0.45)', far: '#262c48', near: '#181d34' } },
    { id: 'day', label: '낮', sky: '#8a7a96', ground: '#22243a', hemi: 0.7, sunC: '#d0b4a8', sun: 0.9, pos: [5, 22, 7], fog: '#3e3a56', bg: '#3e3a56', exp: 1.0, ek: 0.05, lk: 0, gk: 0.1, on: 0, pool: ['#d0c0bc', 0.08],
      tex: { sky: [[0, '#363c5e'], [1, '#7a7090']], body: [128, 50, 14, '#d0c4c4', 'rgba(208,196,196,0.35)'], clouds: 'rgba(140,130,152,0.45)', far: '#2e3250', near: '#1c2038' } },
    { id: 'sunset', label: '해질녘', sky: '#76606e', ground: '#1a1420', hemi: 0.58, sunC: '#c08070', sun: 0.75, pos: [-3, 6, 14], fog: '#33263a', bg: '#33263a', exp: 0.95, ek: 0.75, lk: 0.75, gk: 0.6, on: 0.8, pool: ['#c0907e', 0.07],
      tex: { sky: [[0, '#1e2240'], [0.55, '#5a4256'], [1, '#90665c']], body: [64, 232, 20, '#c89478', 'rgba(200,148,120,0.35)'], clouds: 'rgba(120,90,100,0.4)', far: '#20192c', near: '#120e1c', lit: 'rgba(201,214,240,0.55)' } },
    { id: 'night', label: '저녁', sky: '#1e2a50', ground: '#04060d', hemi: 0.28, sunC: '#9fb0d8', sun: 0.38, pos: [6, 14, 10], fog: '#080c1c', bg: '#060914', exp: 0.85, ek: 1, lk: 1, gk: 0.8, on: 1, pool: ['#9fb3e0', 0.05], fogK: 0.72,
      tex: { sky: [[0, '#141d3c'], [1, '#05070f']], body: [176, 84, 20, '#c9d0e2', 'rgba(150,170,220,0.3)'], stars: 22, clouds: 'rgba(30,40,70,0.7)', far: '#0e1430', near: '#070a18', lit: 'rgba(159,179,224,0.35)' } }
  ];
  MF.TIMES = TIMES;
  var townTexCache = {};
  function townTexFor(id) { if (!townTexCache[id]) townTexCache[id] = townTex(TIMES.filter(function (t) { return t.id === id; })[0].tex); return townTexCache[id]; }

  // ================= 게임 장면 8개 =================
  // time: 바탕 시간대, mod: 그 위에 덧씌우는 값, hour: 광장 시계탑 바늘
  MF.SCENES = [
    { id: 'dawn', label: '해뜰녘', time: 'dawn', hour: 6, use: '밤이 끝나는 전환' },
    { id: 'morning', label: '아침', time: 'morning', hour: 8, use: '아침 발표(분필 윤곽·유언·쪽지)' },
    { id: 'day', label: '낮', time: 'day', hour: 13, use: '낮 토론 — 자유 이동' },
    { id: 'sunset', label: '해질녘', time: 'sunset', hour: 18, use: '지목 투표 — 원탁에 모여 앉음' },
    { id: 'trial', label: '최후 변론', time: 'sunset', hour: 18.5, spot: true, use: '조명이 꺼지고 변론자만 비춤',
      mod: function (p) { return { hemi: p.hemi * 0.3, sun: p.sun * 0.18, lk: p.lk * 0.12, ek: p.ek * 0.3, gk: p.gk * 0.25, exp: p.exp * 0.95, fogK: (p.fogK || 1) * 0.8 }; } },
    { id: 'night', label: '저녁', time: 'night', hour: 21, use: '로비 · 밤 기본' },
    { id: 'mafia', label: '밤 · 마피아', time: 'night', hour: 0, accent: true, use: '마피아만 움직이는 밤',
      mod: function (p) { return { hemi: p.hemi * 0.75, ground: '#22060c', lk: p.lk * 0.55, gk: p.gk * 0.6, fog: '#0c0610', bg: '#08050b', fogK: (p.fogK || 1) * 0.85 }; } },
    { id: 'citizen', label: '밤 · 시민', time: 'night', hour: 0, dark: true, use: '깜깜한 화면 — 다른 사람 안 보임',
      mod: function (p) { return { hemi: 0.07, sun: 0.06, lk: p.lk * 0.06, ek: p.ek * 0.12, gk: p.gk * 0.06, exp: 0.62, fog: '#020308', bg: '#020308', fogK: 0.5 }; } }
  ];

  // ================= A. 달빛 응접실 =================
  function buildParlor(ctx, root) {
    var pa = M('#5a3f2f'), pb = M('#4e3628');
    for (var i = 0; i < 40; i++) box(root, 0.5, 0.1, 22, i % 2 ? pa : pb, -6.75 + i * 0.5, -0.05, 4, false);
    var paper = canvasTex(128, 128, function (g) {
      g.fillStyle = '#2b2f55'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#32376a';
      for (var x = 0; x < 128; x += 32) g.fillRect(x, 0, 12, 128);
      g.fillStyle = 'rgba(201,211,234,0.12)'; for (var y = 16; y < 128; y += 32) for (var xx = 22; xx < 128; xx += 32) { g.beginPath(); g.arc(xx, y, 3, 0, 7); g.fill(); }
    });
    paper.wrapS = paper.wrapT = THREE.RepeatWrapping; paper.repeat.set(14, 3);
    var wallM = new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9 });
    var L = 22, mid = 4;
    box(root, 0.3, 3.6, L, wallM, -7.15, 1.8, mid); box(root, L, 3.6, 0.3, wallM, mid, 1.8, -7.15);
    var wain = M('#1e2140'), trim = M('#4a4f7a');
    box(root, 0.08, 1.1, L, wain, -6.97, 0.55, mid); box(root, L, 1.1, 0.08, wain, mid, 0.55, -6.97);
    box(root, 0.12, 0.08, L, trim, -6.95, 1.12, mid); box(root, L, 0.08, 0.12, trim, mid, 1.12, -6.95);
    box(root, 0.22, 0.16, L, trim, -7.0, 3.62, mid); box(root, L, 0.16, 0.22, trim, mid, 3.62, -7.0);
    var glassM = new THREE.MeshBasicMaterial({ map: townTexFor('night') });
    ctx.windows.push(glassM);
    [-1.8, 3.4].forEach(function (wx) {
      var win = new THREE.Group(); win.position.set(wx, 2.0, -6.98); root.add(win);
      var glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2), glassM); glass.position.z = 0.02; win.add(glass);
      var fr = M('#4a4f7a');
      [[0, 1.04, 1.8, 0.1], [0, -1.04, 1.8, 0.1], [-0.85, 0, 0.1, 2.18], [0.85, 0, 0.1, 2.18], [0, 0, 0.06, 2], [0, 0.1, 1.6, 0.06]].forEach(function (f) { box(win, f[2], f[3], 0.1, fr, f[0], f[1], 0.05); });
      box(win, 2, 0.08, 0.3, fr, 0, -1.12, 0.12);
      var cur = M('#4a2a44', { roughness: 0.95 });
      [-1.2, 1.2].forEach(function (x) { for (var k = 0; k < 4; k++) cyl(win, 0.1, 0.13, 2.8, 10, cur, x + (k - 1.5) * 0.12, 0.05, 0.18 + (k % 2) * 0.04); });
      var rod = cyl(win, 0.03, 0.03, 3, 8, M('#6b7180'), 0, 1.5, 0.2); rod.rotation.z = Math.PI / 2;
      var pool = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.8), new THREE.MeshBasicMaterial({ color: '#c9d6ff', transparent: true, opacity: 0.08, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.rotation.z = 0.35; pool.position.set(wx + 0.6, 0.02, -4.9); root.add(pool); ctx.pools.push(pool.material);
    });
    [0.8, 5.8].forEach(function (wx) {
      box(root, 0.12, 0.3, 0.1, M('#6b7180'), wx, 2.5, -6.95);
      add(root, new THREE.SphereGeometry(0.09, 10, 8), E(ctx, '#ffe2b8', 1.4), wx, 2.72, -6.86, false);
      glow(ctx, root, '#ffd9a8', 1.0, wx, 2.72, -6.8, 0.6);
      lampL(ctx, root, '#ffdcb4', 0.55, 6, wx, 2.6, -6.4);
    });
    [-3.2, 3.6].forEach(function (wz) {
      box(root, 0.1, 0.3, 0.12, M('#6b7180'), -6.95, 2.5, wz);
      add(root, new THREE.SphereGeometry(0.09, 10, 8), E(ctx, '#ffe2b8', 1.4), -6.86, 2.72, wz, false);
      glow(ctx, root, '#ffd9a8', 1.0, -6.8, 2.72, wz, 0.6);
      lampL(ctx, root, '#ffdcb4', 0.5, 6, -6.4, 2.6, wz);
    });
    var fl = new THREE.Group(); fl.position.set(-5.9, 0, 6.0); root.add(fl);
    cyl(fl, 0.2, 0.24, 0.05, 14, M('#3a3f4b'), 0, 0.03, 0); cyl(fl, 0.025, 0.025, 1.7, 8, M('#3a3f4b'), 0, 0.88, 0);
    var shade = add(fl, new THREE.CylinderGeometry(0.2, 0.32, 0.36, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#e8dccc', emissive: '#ffd9a8', emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.9 }), 0, 1.8, 0);
    ctx.em.push({ m: shade.material, k: 0.6 });
    glow(ctx, fl, '#ffd2a0', 1.2, 0, 1.7, 0, 0.5);
    lampL(ctx, fl, '#ffd8b0', 0.6, 6, 0, 1.6, 0);
    lampL(ctx, root, '#f2dcc4', 0.7, 16, 0, 3.4, 1.5);
    var fp = new THREE.Group(); fp.position.set(-6.75, 0, 0.2); root.add(fp);
    box(fp, 0.5, 1.3, 1.8, M('#5f5b78'), 0, 0.65, 0); box(fp, 0.7, 0.12, 2.0, M('#3b2a22'), 0.08, 1.36, 0);
    box(fp, 0.1, 0.7, 0.9, M('#120e14'), 0.22, 0.45, 0);
    var fire = add(fp, new THREE.ConeGeometry(0.22, 0.45, 6), E(ctx, '#ff9a4a', 1.4), 0.2, 0.32, 0);
    glow(ctx, fp, '#ff9a4a', 1.4, 0.35, 0.4, 0, 0.75);
    lampL(ctx, fp, '#ff9a5a', 1.0, 5, 0.7, 0.6, 0);
    ctx.tick.push(function (dt, t) { fire.scale.y = 1 + Math.sin(t * 9) * 0.12; });
    var portrait = canvasTex(128, 160, function (g) {
      g.fillStyle = '#1e2140'; g.fillRect(0, 0, 128, 160); g.fillStyle = '#2b2f55'; g.fillRect(8, 8, 112, 144);
      g.fillStyle = '#4a5163'; g.beginPath(); g.ellipse(64, 140, 40, 34, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8c4a8'; g.beginPath(); g.arc(64, 74, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#16181e'; g.fillRect(34, 40, 60, 14); g.fillRect(24, 52, 80, 6);
    });
    box(fp, 0.06, 1.0, 0.8, M('#3b2a22'), 0.02, 2.3, 0);
    var pic = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.84), new THREE.MeshStandardMaterial({ map: portrait, roughness: 0.8 }));
    pic.rotation.y = Math.PI / 2; pic.position.set(0.06, 2.3, 0); fp.add(pic);
    var arm = M('#2e3a5e');
    [-1.4, 1.8].forEach(function (z) {
      var ac = new THREE.Group(); ac.position.set(-5.0, 0, 0.2 + z); ac.rotation.y = -Math.PI / 2 + (z < 0 ? 0.35 : -0.35); root.add(ac);
      box(ac, 0.8, 0.4, 0.8, arm, 0, 0.3, 0); box(ac, 0.8, 0.7, 0.2, arm, 0, 0.75, -0.32);
      [-0.38, 0.38].forEach(function (x) { box(ac, 0.14, 0.5, 0.8, arm, x, 0.45, 0); });
    });
    var bc = ['#7a8fb8', '#8e7ab8', '#6fa59a', '#b89a6f', '#6f8fa8', '#9aa86f', '#b87a5c', '#a9aebb'];
    function shelf(x, z, rotY) {
      var sh = new THREE.Group(); sh.position.set(x, 0, z); sh.rotation.y = rotY; root.add(sh);
      box(sh, 1.6, 2.6, 0.5, M('#3b2a22'), 0, 1.3, 0);
      [0.45, 1.1, 1.75].forEach(function (y, r) {
        box(sh, 1.46, 0.55, 0.06, M('#21170f'), 0, y + 0.27, 0.24, false);
        for (var b = 0; b < 9; b++) { var h = 0.3 + ((b * 7 + r * 3) % 5) * 0.035; box(sh, 0.14, h, 0.3, M(bc[(b + r * 3) % 8]), -0.62 + b * 0.155, y + h / 2 + 0.02, 0.12); }
      });
    }
    shelf(-4.9, -6.72, 0); shelf(-6.72, -4.4, Math.PI / 2);
    var ck = new THREE.Group(); ck.position.set(1.4, 0, -6.72); root.add(ck);
    box(ck, 0.6, 2.5, 0.42, M('#3b2a22'), 0, 1.25, 0); box(ck, 0.7, 0.2, 0.5, M('#2b1e18'), 0, 2.55, 0);
    var face = cyl(ck, 0.22, 0.22, 0.04, 24, M('#e6e8ee'), 0, 2.05, 0.22); face.rotation.x = Math.PI / 2;
    var pend = box(ck, 0.04, 0.6, 0.02, M('#a9aebb', { metalness: 0.5, roughness: 0.4 }), 0, 1.3, 0.22);
    ctx.tick.push(function (dt, t) { pend.rotation.z = Math.sin(t * 2.4) * 0.25; });
    var pn = new THREE.Group(); pn.position.set(4.6, 0, -4.4); pn.rotation.y = -0.6; root.add(pn);
    var black = M('#0e0e14', { roughness: 0.35, metalness: 0.2 });
    box(pn, 1.5, 0.35, 1.9, black, 0, 0.85, 0); cyl(pn, 0.75, 0.75, 0.35, 20, black, 0, 0.85, -0.6);
    var lid = box(pn, 1.4, 0.04, 1.6, black, -0.25, 1.35, -0.2); lid.rotation.z = 0.45;
    box(pn, 1.4, 0.06, 0.25, M('#f1f2f5'), 0, 1.03, 0.9);
    [[-0.6, 0.8], [0.6, 0.8], [0, -1.1]].forEach(function (l) { box(pn, 0.1, 0.68, 0.1, black, l[0], 0.34, l[1]); });
    box(pn, 0.9, 0.45, 0.4, black, 0, 0.23, 1.5);
    var so = new THREE.Group(); so.position.set(-6.4, 0, 4.4); root.add(so);
    var sM = M('#2e3a5e');
    box(so, 0.9, 0.42, 2.4, sM, 0, 0.25, 0); box(so, 0.3, 0.6, 2.4, sM, -0.3, 0.7, 0);
    [-1.12, 1.12].forEach(function (z) { box(so, 0.9, 0.55, 0.22, sM, 0, 0.45, z); });
    box(so, 0.25, 0.3, 0.4, M('#8e7ab8'), -0.1, 0.6, 0.6).rotation.x = 0.2;
    box(root, 0.8, 0.35, 1.4, M('#3b2a22'), -4.9, 0.2, 4.4);
    [[-6.4, -6.4], [6.2, -6.4]].forEach(function (pp) {
      var pl = new THREE.Group(); pl.position.set(pp[0], 0, pp[1]); root.add(pl);
      cyl(pl, 0.3, 0.22, 0.5, 16, M('#6b7180'), 0, 0.25, 0);
      [[0, 0.8, 0, 0.36], [0.18, 1.05, 0.1, 0.26], [-0.16, 1.0, -0.05, 0.28]].forEach(function (l) { sph(pl, l[3], M('#3f6b5a'), l[0], l[1], l[2]); });
    });
    // 모이는 자리: 러그 + 크림 대리석 원탁 + 의자 8개 (지목 투표 때 모두 앉는 자리)
    cyl(root, 3.3, 3.3, 0.03, 56, M('#3a2440', { roughness: 1 }), 0, 0.015, 0);
    cyl(root, 3.0, 3.0, 0.035, 56, M('#4a2f50', { roughness: 1 }), 0, 0.02, 0);
    cyl(root, 1.1, 1.1, 0.1, 40, M('#e0d8c4', { roughness: 0.4 }), 0, 0.8, 0);
    cyl(root, 0.1, 0.14, 0.72, 12, M('#4a4f5c'), 0, 0.4, 0); cyl(root, 0.4, 0.45, 0.06, 20, M('#4a4f5c'), 0, 0.05, 0);
    cyl(root, 0.05, 0.05, 0.18, 10, M('#f1f2f5'), 0, 0.95, 0);
    add(root, new THREE.SphereGeometry(0.035, 8, 6), E(ctx, '#ffd59a', 2), 0, 1.07, 0, false);
    glow(ctx, root, '#ffcf8a', 0.7, 0, 1.08, 0, 0.8);
    lampL(ctx, root, '#ffd2a0', 0.5, 3, 0, 1.2, 0);
    // 의자: 3D 캐릭터가 앉도록 시안보다 폭을 넓혔다(0.44 → 0.56)
    var chairM = M('#3b2a22'), cushM = M('#5a3a5e');
    ctx.seats = [];
    for (var c = 0; c < 8; c++) {
      var a = c / 8 * Math.PI * 2 + Math.PI / 8, ch = new THREE.Group(), sx = Math.cos(a) * 1.85, sz = Math.sin(a) * 1.85;
      ch.position.set(sx, 0, sz); ch.rotation.y = -a - Math.PI / 2; root.add(ch);
      box(ch, 0.56, 0.08, 0.5, cushM, 0, 0.47, 0); box(ch, 0.56, 0.6, 0.06, chairM, 0, 0.8, -0.24);
      [[-0.23, -0.2], [0.23, -0.2], [-0.23, 0.2], [0.23, 0.2]].forEach(function (l) { box(ch, 0.05, 0.45, 0.05, chairM, l[0], 0.22, l[1]); });
      // 앉으면 원탁을 본다: 의자 앞(+z 지역)이 원탁 쪽
      ctx.seats.push({ x: sx, z: sz, yaw: Math.atan2(-sx, -sz), top: 0.51, ax: Math.cos(a) * 2.55, az: Math.sin(a) * 2.55, fx: Math.cos(a) * 1.3, fz: Math.sin(a) * 1.3 });
    }
    var chd = new THREE.Group(); chd.position.set(0, 3.3, 0); root.add(chd);
    cyl(chd, 0.015, 0.015, 1.2, 6, M('#2b2f38'), 0, 0.6, 0);
    var ring = add(chd, new THREE.TorusGeometry(0.55, 0.035, 8, 32), M('#a9aebb', { metalness: 0.5, roughness: 0.4 })); ring.rotation.x = Math.PI / 2;
    for (var b2 = 0; b2 < 6; b2++) { var ba = b2 / 6 * Math.PI * 2; add(chd, new THREE.SphereGeometry(0.05, 8, 6), E(ctx, '#ffe2b8', 1.6), Math.cos(ba) * 0.55, 0.08, Math.sin(ba) * 0.55, false); }
    glow(ctx, chd, '#ffd9a8', 1.6, 0, 0.05, 0, 0.6);
    lampL(ctx, chd, '#ffe0b8', 0.9, 7, 0, -0.1, 0);
    motes(ctx, root, ['#c9d6ff'], 8, 10, 3);
    ctx.gather = [0, 0]; ctx.stageY = 0.85;
  }

  // ================= B. 달빛 시계탑 광장 =================
  function buildPlaza(ctx, root) {
    box(root, 120, 0.1, 120, M('#0e1326'), 0, -0.06, 0, false);
    var asphalt = M('#141b33', { roughness: 0.75 }), walk = M('#1e2847'), curbM = M('#3a3f4b'), railM = M('#4a4f5c', { metalness: 0.5, roughness: 0.4 });
    box(root, 120, 0.04, 3.2, asphalt, 0, 0.0, 9.2, false); box(root, 3.2, 0.04, 120, asphalt, 9.2, 0.0, 0, false);
    box(root, 120, 0.12, 1.2, walk, 0, 0.06, 7.4, false); box(root, 1.2, 0.12, 120, walk, 7.4, 0.06, 0, false);
    box(root, 120, 0.12, 1.2, walk, 0, 0.06, 11.4, false); box(root, 1.2, 0.12, 120, walk, 11.4, 0.06, 0, false);
    [8.0, 10.8].forEach(function (p) { box(root, 120, 0.14, 0.12, curbM, 0, 0.07, p, false); box(root, 0.12, 0.14, 120, curbM, p, 0.07, 0, false); });
    [8.75, 9.65].forEach(function (p) { box(root, 120, 0.03, 0.07, railM, 0, 0.04, p, false); box(root, 0.07, 0.03, 120, railM, p, 0.04, 0, false); });
    var cob = ['#18213f', '#1c2546', '#151d38', '#1f2948'];
    for (var ix = 0; ix < 14; ix++) for (var iz = 0; iz < 14; iz++) box(root, 0.94, 0.08, 0.94, M(cob[(ix * 3 + iz * 5) % 4]), -6.5 + ix, 0.04, -6.5 + iz, false);
    cyl(root, 2.7, 2.7, 0.06, 56, M('#b9b09a', { roughness: 0.5 }), 0, 0.1, 0);
    cyl(root, 2.5, 2.5, 0.07, 56, M('#e0d8c4', { roughness: 0.45 }), 0, 0.11, 0);
    // 가운데 단: 원판 가운데를 한 단 높여 최후 변론 무대로 쓴다
    cyl(root, 1.0, 1.05, 0.28, 40, M('#f2ecdc', { roughness: 0.4 }), 0, 0.22, 0);
    cyl(root, 1.06, 1.06, 0.04, 40, M('#b9b09a', { roughness: 0.5 }), 0, 0.37, 0);
    for (var k = 0; k < 4; k++) { var rb = box(root, 0.06, 0.02, 4.8, M('#b9b09a'), 0, 0.155, 0, false); rb.rotation.y = k * Math.PI / 4; }
    // 서는 자리 8개: 원판에 박힌 놋쇠 표시 (지목 투표 때 이 자리에 선다)
    ctx.seats = [];
    for (var s8 = 0; s8 < 8; s8++) {
      var sa = s8 / 8 * Math.PI * 2 + Math.PI / 8, mx = Math.cos(sa) * 1.85, mz = Math.sin(sa) * 1.85;
      cyl(root, 0.22, 0.22, 0.02, 8, M('#a98559', { metalness: 0.5, roughness: 0.35 }), mx, 0.155, mz);
      ctx.seats.push({ x: mx, z: mz, yaw: Math.atan2(-mx, -mz), top: 0.15, ax: Math.cos(sa) * 2.4, az: Math.sin(sa) * 2.4, stand: true });
    }
    [[3.6, -1.2], [-1.2, 3.6], [3.6, 4.4]].forEach(function (m) { cyl(root, 0.32, 0.32, 0.02, 18, M('#2b2f38', { metalness: 0.4 }), m[0], 0.09, m[1]); });
    function lamp(x, z, withLight) {
      var g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
      var iron = M('#0b1024');
      cyl(g, 0.18, 0.22, 0.25, 10, iron, 0, 0.12, 0); cyl(g, 0.05, 0.07, 2.6, 10, iron, 0, 1.4, 0);
      box(g, 0.8, 0.05, 0.05, iron, 0, 2.6, 0);
      [-0.38, 0.38].forEach(function (lx) {
        add(g, new THREE.SphereGeometry(0.15, 14, 10), E(ctx, '#e6ebff', 1.3), lx, 2.82, 0, false);
        cyl(g, 0.1, 0.1, 0.06, 10, iron, lx, 2.65, 0);
        glow(ctx, g, '#cfd9ff', 1.3, lx, 2.82, 0, 0.75);
      });
      if (withLight) return lampL(ctx, g, '#dfe6ff', 1.1, 9, 0, 2.6, 0);
    }
    lamp(2.6, 2.6, true); lamp(-2.6, 2.6, true); lamp(2.6, -2.6, true);
    var flick = lamp(-2.6, -2.6, true);
    var flickK = null;
    ctx.tick.push(function (dt, t) {
      if (!flickK) flickK = ctx.lamps.filter(function (l) { return l.l === flick; })[0];
      var s = Math.sin(t * 7.3) + Math.sin(t * 13.1);
      flick.intensity = flickK.k * flickK.cur * (s > 1.6 ? 0.45 : 1);
    });
    lamp(6.6, 7.4, false); lamp(7.4, -0.6, false); lamp(-4, 7.4, false); lamp(7.4, -6.0, false);
    // 시계탑: 바늘이 지금 장면의 시각을 가리킨다(게임 시계)
    var tw = new THREE.Group(); tw.position.set(-5.2, 0, -5.2); root.add(tw);
    var stoneD = brickMat('#1e2847'), stoneL = M('#2a3760'), quoin = M('#3a3f4b'), cream = M('#e0d8c4', { roughness: 0.5 });
    box(tw, 2.6, 1.0, 2.6, stoneL, 0, 0.5, 0); box(tw, 2.8, 0.15, 2.8, quoin, 0, 1.05, 0);
    box(tw, 2.0, 5.2, 2.0, stoneD, 0, 3.7, 0);
    for (var q = 0; q < 10; q++) [[1, 1], [1, -1], [-1, 1]].forEach(function (s) { box(tw, 0.24, 0.26, 0.24, quoin, s[0] * 0.95, 1.4 + q * 0.5, s[1] * 0.95); });
    box(tw, 0.9, 1.3, 0.1, M('#0b1024'), 0, 0.65, 1.31); var ta = cyl(tw, 0.45, 0.45, 0.1, 16, M('#0b1024'), 0, 1.3, 1.31); ta.rotation.x = Math.PI / 2;
    [2.0, 3.4, 4.8].forEach(function (y) { box(tw, 0.3, 0.6, 0.04, M('#0b1024'), 0, y, 1.01); box(tw, 0.04, 0.6, 0.3, M('#0b1024'), 1.01, y, 0); });
    box(tw, 2.4, 1.9, 2.4, stoneL, 0, 7.25, 0); box(tw, 2.6, 0.18, 2.6, quoin, 0, 6.3, 0); box(tw, 2.6, 0.18, 2.6, quoin, 0, 8.2, 0);
    var faceTex = canvasTex(256, 256, function (g) {
      g.fillStyle = '#f2ecdc'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b2f38'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#2b2f38';
      for (var h = 0; h < 12; h++) { g.save(); g.translate(128, 128); g.rotate(h / 12 * Math.PI * 2); g.fillRect(-4, -104, 8, h % 3 ? 14 : 24); g.restore(); }
    });
    var faceM = new THREE.MeshStandardMaterial({ map: faceTex, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.55, roughness: 0.6, transparent: true });
    ctx.em.push({ m: faceM, k: 0.55 });
    var hands = [];
    [[0, 1.22, 0], [1.22, 0, Math.PI / 2]].forEach(function (f) {
      var fg = new THREE.Group(); fg.position.set(f[0], 7.25, f[1]); fg.rotation.y = f[2]; tw.add(fg);
      var fc = new THREE.Mesh(new THREE.CircleGeometry(0.85, 40), faceM); fc.position.z = 0.01; fg.add(fc);
      var rim = add(fg, new THREE.TorusGeometry(0.88, 0.06, 8, 40), M('#2b2f38')); rim.position.z = 0.02;
      var hh = box(fg, 0.08, 0.45, 0.03, M('#151c36'), 0, 0.2, 0.04, false); var mh = box(fg, 0.05, 0.7, 0.03, M('#151c36'), 0, 0.33, 0.06, false);
      hands.push([hh, mh]);
      glow(ctx, fg, '#dde3f0', 2.6, 0, 0, 0.3, 0.35);
    });
    var hourNow = 21, hourShown = 21;
    ctx.setHour = function (h) { hourNow = h; };
    ctx.settle = function () { hourShown = hourNow; };
    ctx.tick.push(function (dt) {
      // 장면이 바뀌면 바늘이 빠르게 돌아 새 시각으로 간다
      var d = hourNow - hourShown; if (d < -12) d += 24; if (d > 12) d -= 24;
      hourShown += d * Math.min(1, dt * 3);
      var ha = (hourShown % 12) / 12 * Math.PI * 2, ma = (hourShown % 1) * Math.PI * 2;
      hands.forEach(function (p) {
        p[0].position.set(Math.sin(ha) * 0.2, Math.cos(ha) * 0.2, 0.04); p[0].rotation.z = -ha;
        p[1].position.set(Math.sin(ma) * 0.33, Math.cos(ma) * 0.33, 0.06); p[1].rotation.z = -ma;
      });
    });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) { box(tw, 0.3, 1.3, 0.3, stoneL, s[0] * 0.95, 8.95, s[1] * 0.95); });
    var bell = add(tw, new THREE.CylinderGeometry(0.2, 0.4, 0.55, 14), M('#6b7180', { metalness: 0.5, roughness: 0.4 }), 0, 8.95, 0);
    ctx.bell = bell;
    box(tw, 2.5, 0.16, 2.5, quoin, 0, 9.65, 0);
    var spire = add(tw, new THREE.ConeGeometry(1.7, 2.6, 4), M('#151c36'), 0, 11.0, 0); spire.rotation.y = Math.PI / 4;
    cyl(tw, 0.03, 0.03, 0.8, 6, M('#a9aebb'), 0, 12.6, 0);

    var litC = ['#c9d6f0', '#9fb3e0'];
    var shutterC = ['#2a3760', '#3a3f4b', '#4a4f7a'];
    var flowerC = ['#8e7ab8', '#6fa59a', '#a9aebb', '#7a8fb8'];
    function building(o) {
      var g = new THREE.Group(); g.position.set(o.x, 0, o.z); g.rotation.y = o.ry || 0; root.add(g);
      var W = o.w, D = o.d, fh = 1.05, H = o.floors * fh + 0.5, front = D / 2;
      var trimM = M(o.trim || '#3a3f4b'), body = brickMat(o.body);
      box(g, W, H, D, body, 0, H / 2, 0);
      box(g, W + 0.06, 0.5, D + 0.06, M('#2a3760'), 0, 0.25, 0);
      for (var f = 1; f < o.floors; f++) box(g, W + 0.06, 0.07, D + 0.06, trimM, 0, f * fh + 0.5, 0, false);
      box(g, W + 0.32, 0.22, D + 0.32, trimM, 0, H + 0.11, 0);
      for (var dn = 0; dn < Math.floor(W / 0.3); dn++) box(g, 0.12, 0.1, 0.1, trimM, -W / 2 + 0.15 + dn * 0.3, H - 0.06, front + 0.05, false);
      if (o.roof === 'mansard') {
        var s = new THREE.Shape(); s.moveTo(-D / 2 - 0.1, 0); s.lineTo(D / 2 + 0.1, 0); s.lineTo(D / 2 - 0.45, 1.0); s.lineTo(-D / 2 + 0.45, 1.0); s.closePath();
        var mg = new THREE.ExtrudeGeometry(s, { depth: W + 0.2, bevelEnabled: false }); mg.translate(0, 0, -(W + 0.2) / 2); mg.rotateY(Math.PI / 2);
        var mm = new THREE.Mesh(mg, M('#151c36', { roughness: 0.7 })); mm.position.y = H + 0.22; mm.castShadow = true; mm.receiveShadow = true; g.add(mm);
        for (var dr = 0; dr < Math.max(1, Math.floor(W / 1.2)); dr++) {
          var dx = (dr - (Math.max(1, Math.floor(W / 1.2)) - 1) / 2) * 1.2;
          box(g, 0.5, 0.55, 0.4, M('#2a3760'), dx, H + 0.62, front - 0.1);
          var dg = gable(0.62, 0.28, 0.5, M('#151c36')); dg.position.set(dx, H + 0.9, front - 0.12); g.add(dg);
          var dp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.36), (dr + o.floors) % 2 ? E(ctx, litC[0], 0.8) : M('#151c36', { roughness: 0.3 })); dp.position.set(dx, H + 0.6, front + 0.11); g.add(dp);
        }
      } else if (o.roof === 'gable') {
        var gb = gable(W + 0.2, 1.3, D + 0.2, M('#151c36', { roughness: 0.7 })); gb.position.y = H + 0.22; g.add(gb);
        var gw = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), E(ctx, litC[1], 0.7)); gw.position.set(0, H + 0.7, front + 0.12); g.add(gw);
      } else {
        box(g, W + 0.32, 0.4, 0.12, trimM, 0, H + 0.42, front + 0.1); box(g, W + 0.32, 0.4, 0.12, trimM, 0, H + 0.42, -front - 0.1);
        box(g, 0.12, 0.4, D + 0.32, trimM, W / 2 + 0.1, H + 0.42, 0); box(g, 0.12, 0.4, D + 0.32, trimM, -W / 2 - 0.1, H + 0.42, 0);
      }
      if (o.tank) {
        var tk = new THREE.Group(); tk.position.set(-W * 0.2, H + 0.22, -D * 0.15); g.add(tk);
        cyl(tk, 0.42, 0.42, 0.75, 14, M('#3b2a22'), 0, 0.85, 0); add(tk, new THREE.ConeGeometry(0.48, 0.32, 14), M('#2b1e18'), 0, 1.38, 0);
        [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(function (l) { box(tk, 0.05, 0.48, 0.05, M('#0b1024'), l[0], 0.24, l[1]); });
      }
      box(g, 0.32, 0.8, 0.32, trimM, W * 0.3, H + 0.6, -D * 0.25); box(g, 0.26, 0.6, 0.26, trimM, W * 0.36, H + 0.5, -D * 0.05);
      if (o.antenna) { cyl(g, 0.02, 0.02, 1.4, 5, M('#0b1024'), W * 0.1, H + 0.9, D * 0.1); box(g, 0.5, 0.02, 0.02, M('#0b1024'), W * 0.1, H + 1.4, D * 0.1); box(g, 0.34, 0.02, 0.02, M('#0b1024'), W * 0.1, H + 1.2, D * 0.1); }
      var n = Math.max(2, Math.floor(W / 1.0)), seed = Math.abs(Math.floor(o.x * 7 + o.z * 13));
      for (var fl = 1; fl < o.floors; fl++) for (var c = 0; c < n; c++) {
        var cx = (c - (n - 1) / 2) * (W / n), y = fl * fh + 0.98, pick = (seed + fl * 5 + c * 3) % 7;
        var pm = pick === 0 ? E(ctx, litC[0], 0.9) : pick === 1 ? E(ctx, litC[1], 0.6) : M('#151c36', { roughness: 0.25, metalness: 0.2 });
        box(g, 0.56, 0.76, 0.05, trimM, cx, y, front + 0.01, false);
        var pane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), pm); pane.position.set(cx, y, front + 0.045); g.add(pane);
        box(g, 0.04, 0.62, 0.02, trimM, cx, y, front + 0.055, false);
        box(g, 0.64, 0.06, 0.14, trimM, cx, y - 0.4, front + 0.07, false);
        if (o.shutters && (c + fl) % 3 !== 0) { [-1, 1].forEach(function (sd) { box(g, 0.13, 0.66, 0.03, M(shutterC[(seed + c) % 3]), cx + sd * 0.36, y, front + 0.04, false); }); }
        if (o.flowers && (c * 3 + fl + seed) % 4 === 0) {
          box(g, 0.5, 0.12, 0.16, M('#3b2a22'), cx, y - 0.32, front + 0.12, false);
          for (var fw = 0; fw < 4; fw++) sph(g, 0.06, M(flowerC[(fw + c) % 4]), cx - 0.18 + fw * 0.12, y - 0.22, front + 0.12, 8, 6);
        }
      }
      if (o.balcony && o.floors > 2) {
        var by = 2 * fh + 0.52;
        box(g, W * 0.55, 0.08, 0.55, trimM, 0, by, front + 0.27);
        box(g, W * 0.55, 0.04, 0.04, M('#0b1024'), 0, by + 0.5, front + 0.53, false);
        for (var bp = 0; bp <= 8; bp++) box(g, 0.025, 0.5, 0.025, M('#0b1024'), -W * 0.275 + bp * W * 0.55 / 8, by + 0.25, front + 0.53, false);
        [-1, 1].forEach(function (sd) { box(g, 0.04, 0.04, 0.55, M('#0b1024'), sd * W * 0.275, by + 0.5, front + 0.27, false); });
      }
      if (o.shop) {
        var gl = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.7, 0.85), E(ctx, '#9fb3e0', 0.35)); gl.position.set(-W * 0.08, 0.95, front + 0.01); g.add(gl);
        for (var mu = 0; mu <= 3; mu++) box(g, 0.05, 0.9, 0.04, trimM, -W * 0.08 - W * 0.35 + mu * W * 0.7 / 3, 0.95, front + 0.03, false);
        box(g, 0.5, 1.15, 0.05, M('#0b1024'), W * 0.36, 1.0, front + 0.02, false);
        var aw = box(g, W * 0.92, 0.06, 0.8, stripeMat(o.awning || '#2a3760', '#a9aebb'), 0, 1.62, front + 0.38); aw.rotation.x = 0.28;
        var sg = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.55, 0.34), new THREE.MeshStandardMaterial({ map: signTex(o.shop, 256, 72, '700 44px "Gowun Dodum", sans-serif', '#151c36', '#e6e8ee'), roughness: 0.7 }));
        sg.position.set(0, 1.98, front + 0.03); g.add(sg);
      } else {
        box(g, 0.66, 1.25, 0.06, M('#0b1024'), 0, 1.15, front + 0.02, false);
        var tr = cyl(g, 0.33, 0.33, 0.06, 16, E(ctx, litC[1], 0.4), 0, 1.78, front + 0.02); tr.rotation.x = Math.PI / 2;
        [0, 1, 2].forEach(function (st) { box(g, 1.1 - st * 0.12, 0.13, 0.32, M('#3a3f4b'), 0, 0.065 + st * 0.13, front + 0.5 - st * 0.14); });
        [-0.5, 0.5].forEach(function (sd) { add(g, new THREE.SphereGeometry(0.07, 8, 6), E(ctx, '#e6ebff', 1.2), sd, 1.55, front + 0.12, false); });
      }
      if (o.poster) {
        var pt = canvasTex(96, 128, function (gx) {
          gx.fillStyle = '#e0d8c4'; gx.fillRect(0, 0, 96, 128); gx.fillStyle = '#2b2f38'; gx.font = '700 22px "Gowun Dodum", sans-serif'; gx.textAlign = 'center'; gx.fillText('수배', 48, 26);
          gx.fillStyle = '#4a4f5c'; gx.fillRect(22, 36, 52, 52); gx.fillStyle = '#16181e'; gx.fillRect(28, 40, 40, 10); gx.fillRect(20, 50, 56, 4);
          gx.fillStyle = '#2b2f38'; gx.fillRect(18, 98, 60, 4); gx.fillRect(26, 108, 44, 4);
        });
        [0, 0.55].forEach(function (off) {
          var ps = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9 }));
          ps.position.set(-W / 2 + 0.4 + off, 1.0, front + 0.02); g.add(ps);
        });
      }
      if (o.fire) {
        var sd2 = o.fire, fe = M('#0b1024');
        for (var fl2 = 1; fl2 < o.floors; fl2++) {
          var py = fl2 * fh + 0.45, px = sd2 * (W / 2 + 0.3);
          box(g, 0.55, 0.05, D * 0.7, fe, px, py, 0);
          box(g, 0.03, 0.45, D * 0.7, fe, sd2 * (W / 2 + 0.56), py + 0.22, 0, false);
          var stp = box(g, 0.45, 0.04, 1.3, fe, px, py + 0.5, fl2 % 2 ? D * 0.12 : -D * 0.12); stp.rotation.x = fl2 % 2 ? -0.72 : 0.72;
        }
      }
      return g;
    }
    var RX = Math.PI / 2, RB = Math.PI, RL = -Math.PI / 2;
    building({ x: -8.5, z: 4.6, w: 3.4, d: 3.0, floors: 4, body: '#1e2847', ry: RX, roof: 'mansard', shop: '식당', awning: '#2a3760', balcony: true, flowers: true });
    building({ x: -8.7, z: 1.0, w: 3.4, d: 3.4, floors: 5, body: '#24305a', ry: RX, roof: 'flat', tank: true, shop: '신문', awning: '#3a3f4b', poster: true, shutters: true, fire: 1 });
    building({ x: -8.5, z: -2.3, w: 2.8, d: 3.0, floors: 4, body: '#1b2442', ry: RX, roof: 'gable', flowers: true, shutters: true });
    building({ x: -8.6, z: 8.3, w: 3.4, d: 3.2, floors: 3, body: '#2a3760', ry: RX, roof: 'gable', shop: '이발소', awning: '#4a4f7a', flowers: true });
    building({ x: -8.5, z: 12.0, w: 3.6, d: 3.0, floors: 4, body: '#1e2847', ry: RX, roof: 'mansard', balcony: true, antenna: true });
    building({ x: -8.5, z: 15.8, w: 3.4, d: 3.0, floors: 3, body: '#24305a', ry: RX, roof: 'flat', shutters: true });
    building({ x: -9.6, z: -6.6, w: 3.0, d: 3.2, floors: 6, body: '#1b2442', ry: RX, roof: 'flat', tank: true, antenna: true });
    building({ x: -6.4, z: -9.6, w: 2.6, d: 3.2, floors: 5, body: '#24305a', roof: 'mansard' });
    var bank = new THREE.Group(); bank.position.set(1.6, 0, -8.8); root.add(bank);
    var bankBody = brickMat('#2a3760');
    box(bank, 6.0, 3.6, 3.2, bankBody, 0, 1.8, 0);
    box(bank, 6.4, 0.3, 3.6, cream, 0, 3.75, 0);
    var ped = gable(6.4, 1.0, 0.4, cream); ped.position.set(0, 3.9, 1.55); bank.add(ped);
    box(bank, 6.6, 0.12, 3.8, M('#151c36'), 0, 4.95, -0.2);
    box(bank, 5.6, 0.9, 2.6, M('#151c36'), 0, 4.35, -0.4);
    add(bank, new THREE.SphereGeometry(0.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#2a3760', { metalness: 0.3, roughness: 0.5 }), 0, 4.8, -0.6);
    for (var col = 0; col < 6; col++) { cyl(bank, 0.18, 0.2, 3.1, 14, cream, -2.5 + col * 1.0, 1.85, 1.95); box(bank, 0.5, 0.12, 0.5, cream, -2.5 + col * 1.0, 0.36, 1.95); box(bank, 0.46, 0.12, 0.46, cream, -2.5 + col * 1.0, 3.42, 1.95); }
    [0, 1, 2].forEach(function (s) { box(bank, 6.2 - s * 0.3, 0.15, 0.5, M('#b9b09a'), 0, 0.075 + s * 0.15, 2.5 - s * 0.25); });
    box(bank, 1.0, 1.9, 0.05, M('#0b1024'), 0, 1.25, 1.62);
    [-1.5, 1.5].forEach(function (wx) { var bw = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.3), E(ctx, '#9fb3e0', 0.5)); bw.position.set(wx, 1.6, 1.61); bank.add(bw); });
    var bsign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.4), new THREE.MeshStandardMaterial({ map: signTex('중앙 은행', 320, 64, '700 40px "Gowun Dodum", sans-serif', '#e0d8c4', '#151c36'), roughness: 0.7 }));
    bsign.position.set(0, 3.75, 1.81); bank.add(bsign);
    [-2.9, 2.9].forEach(function (lx) { add(bank, new THREE.SphereGeometry(0.12, 10, 8), E(ctx, '#e6ebff', 1.2), lx, 2.4, 1.85, false); glow(ctx, bank, '#cfd9ff', 0.9, lx, 2.4, 1.95, 0.6); });
    building({ x: 6.2, z: -8.6, w: 3.0, d: 3.2, floors: 6, body: '#1e2847', roof: 'flat', shop: '호텔', awning: '#2a3760', balcony: true, tank: true, flowers: true });
    building({ x: 9.6, z: -8.5, w: 3.4, d: 3.0, floors: 4, body: '#24305a', roof: 'gable', shutters: true, fire: 1 });
    building({ x: 13.2, z: -8.5, w: 3.4, d: 3.0, floors: 5, body: '#1b2442', roof: 'mansard', shop: '양복점', awning: '#3a3f4b', flowers: true });
    building({ x: 16.8, z: -8.5, w: 3.4, d: 3.0, floors: 3, body: '#2a3760', roof: 'flat', antenna: true });
    building({ x: -2.6, z: -8.6, w: 2.0, d: 3.2, floors: 3, body: '#1b2442', roof: 'gable', shutters: true });
    [-9, -5.4, -1.8, 1.8, 5.4].forEach(function (x, i) { building({ x: x, z: 13.6, w: 3.4, d: 3.4, floors: 2 + (i % 2), body: ['#1e2847', '#24305a', '#1b2442'][i % 3], ry: RB, roof: i % 2 ? 'gable' : 'flat', shop: i === 2 ? '찻집' : null, flowers: true, shutters: i % 2 === 0 }); });
    [-9, -5.4, -1.8, 1.8, 5.4].forEach(function (z, i) { building({ x: 13.6, z: z, w: 3.4, d: 3.4, floors: 2 + ((i + 1) % 2), body: ['#24305a', '#1b2442', '#1e2847'][i % 3], ry: RL, roof: i % 2 ? 'flat' : 'mansard', shop: i === 3 ? '전당포' : null, shutters: true }); });
    building({ x: 13.6, z: 13.6, w: 3.4, d: 3.4, floors: 3, body: '#1e2847', ry: RB, roof: 'mansard' });
    var ks = new THREE.Group(); ks.position.set(4.6, 0, -4.4); ks.rotation.y = -Math.PI / 4; root.add(ks);
    box(ks, 1.4, 1.2, 0.9, M('#2a3760'), 0, 0.6, 0);
    var kr = add(ks, new THREE.ConeGeometry(1.1, 0.5, 4), M('#151c36'), 0, 1.45, 0); kr.rotation.y = Math.PI / 4; kr.scale.z = 0.7;
    for (var np = 0; np < 4; np++) box(ks, 0.3, 0.05 + np * 0.01, 0.4, M('#e6e8ee'), -0.45 + np * 0.3, 1.0, 0.55);
    var pane2 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), new THREE.MeshStandardMaterial({ map: signTex('신문', 200, 60, '700 36px "Gowun Dodum", sans-serif', '#e0d8c4', '#151c36') })); pane2.position.set(0, 1.25, 0.46); ks.add(pane2);
    [[-5.6, 5.6], [-5.6, 3.7]].forEach(function (p) {
      var ct = new THREE.Group(); ct.position.set(p[0], 0, p[1]); root.add(ct);
      cyl(ct, 0.36, 0.36, 0.05, 16, M('#e0d8c4'), 0, 0.72, 0); cyl(ct, 0.04, 0.04, 0.7, 8, M('#0b1024'), 0, 0.36, 0);
      cyl(ct, 0.03, 0.03, 1.5, 6, M('#0b1024'), 0, 1.4, 0); add(ct, new THREE.ConeGeometry(0.85, 0.4, 8), stripeMat('#2a3760', '#a9aebb'), 0, 2.05, 0);
      [-0.6, 0.6].forEach(function (cx) { box(ct, 0.3, 0.05, 0.3, M('#3b2a22'), cx, 0.45, 0); box(ct, 0.3, 0.4, 0.04, M('#3b2a22'), cx + (cx > 0 ? 0.13 : -0.13), 0.65, 0).rotation.y = Math.PI / 2; });
    });
    var mb = new THREE.Group(); mb.position.set(6.4, 0, 2.2); root.add(mb);
    box(mb, 0.4, 0.8, 0.36, M('#2a3760'), 0, 0.5, 0); var mt = cyl(mb, 0.2, 0.2, 0.4, 14, M('#2a3760'), 0, 0.9, 0); mt.rotation.z = Math.PI / 2; mt.scale.set(1, 1, 0.9);
    box(mb, 0.42, 0.06, 0.38, M('#e0d8c4'), 0, 0.66, 0);
    var pb = new THREE.Group(); pb.position.set(6.3, 0, -2.0); root.add(pb);
    box(pb, 0.8, 2.1, 0.8, M('#1e2847'), 0, 1.05, 0); box(pb, 0.9, 0.12, 0.9, M('#e0d8c4'), 0, 2.16, 0);
    [[0, 0.41, 0], [0.41, 0, Math.PI / 2]].forEach(function (f) { var gp = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.4), E(ctx, '#9fb3e0', 0.35)); gp.position.set(f[0], 1.15, f[1]); gp.rotation.y = f[2]; pb.add(gp); });
    function bench(x, z, ry) {
      var b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; root.add(b);
      box(b, 1.4, 0.08, 0.4, M('#3b2a22'), 0, 0.42, 0); box(b, 1.4, 0.3, 0.06, M('#3b2a22'), 0, 0.68, -0.18);
      [-0.6, 0.6].forEach(function (lx) { box(b, 0.06, 0.42, 0.36, M('#0b1024'), lx, 0.21, 0); });
    }
    bench(4.6, 1.6, -Math.PI / 2); bench(1.6, 4.6, Math.PI); bench(-4.4, -1.4, Math.PI / 2);
    cyl(root, 0.11, 0.13, 0.45, 12, M('#3a3f4b'), 6.4, 0.3, 4.2);
    function bareTree(x, z) {
      var t = new THREE.Group(); t.position.set(x, 0, z); root.add(t);
      box(t, 0.9, 0.4, 0.9, M('#3a3f4b'), 0, 0.2, 0);
      var bark = M('#0b1024');
      cyl(t, 0.07, 0.11, 1.8, 7, bark, 0, 1.2, 0);
      [[0.4, 1.7, 0.2, 0.7], [-0.5, 1.9, -0.3, 0.6], [0.2, 2.3, -0.5, 0.5], [-0.3, 1.5, 0.5, -0.6]].forEach(function (b) {
        var br = cyl(t, 0.025, 0.05, 1.0, 6, bark, b[0] / 2, b[1], b[2] / 2); br.rotation.set(b[2], 0, -b[3]);
      });
    }
    bareTree(-5.6, 1.4); bareTree(2.8, -5.8); bareTree(5.8, 5.8); bareTree(-1.0, -6.0);
    [[-6.6, -3.4, 0.6], [-6.4, -2.7, 0.5], [-6.6, -2.8, 0.45]].forEach(function (c2, i) { box(root, c2[2], c2[2], c2[2], M('#4a3a2e'), c2[0], c2[2] / 2 + (i === 2 ? 0.55 : 0), c2[1]).rotation.y = 0.3 * i; });
    [[-6.5, -4.2], [-6.1, -4.5]].forEach(function (p) { cyl(root, 0.24, 0.22, 0.6, 12, M('#3a3f4b'), p[0], 0.3, p[1]); cyl(root, 0.26, 0.26, 0.05, 12, M('#2b2f38'), p[0], 0.62, p[1]); });
    function sedan(x, z, ry) {
      var car = new THREE.Group(); car.position.set(x, 0.02, z); car.rotation.y = ry; root.add(car);
      var paint = M('#0e1326', { roughness: 0.3, metalness: 0.4 });
      box(car, 2.5, 0.4, 1.0, paint, 0, 0.45, 0); box(car, 1.0, 0.25, 0.8, paint, 0.75, 0.75, 0);
      box(car, 1.1, 0.48, 0.9, paint, -0.35, 0.85, 0);
      box(car, 1.0, 0.36, 0.92, new THREE.MeshStandardMaterial({ color: '#25375f', roughness: 0.15, metalness: 0.3 }), -0.35, 0.88, 0);
      [[-0.85, 0.5], [0.85, 0.5], [-0.85, -0.5], [0.85, -0.5]].forEach(function (w) {
        var fe = cyl(car, 0.36, 0.36, 0.24, 16, paint, w[0], 0.36, w[1]); fe.rotation.x = Math.PI / 2;
        var wh = cyl(car, 0.26, 0.26, 0.26, 16, M('#0a0a10'), w[0], 0.27, w[1]); wh.rotation.x = Math.PI / 2;
      });
      box(car, 2.2, 0.05, 0.25, M('#2b2f38'), 0, 0.22, 0.55); box(car, 2.2, 0.05, 0.25, M('#2b2f38'), 0, 0.22, -0.55);
      [-0.3, 0.3].forEach(function (lz) { add(car, new THREE.SphereGeometry(0.1, 10, 8), E(ctx, '#e6ebff', 0.6), 1.28, 0.6, lz, false); });
      box(car, 0.08, 0.3, 0.5, M('#a9aebb', { metalness: 0.6, roughness: 0.3 }), 1.27, 0.5, 0);
    }
    sedan(2.0, 9.0, 0); sedan(9.0, -3.2, Math.PI / 2); sedan(-6.0, 10.0, Math.PI);
    var rail = M('#0b1024');
    box(root, 13, 0.05, 0.05, rail, -0.5, 0.6, 6.9); box(root, 0.05, 0.05, 13, rail, 6.9, 0.6, -0.5);
    for (var r = -7; r <= 6; r++) { box(root, 0.04, 0.6, 0.04, rail, r, 0.3, 6.9); box(root, 0.04, 0.6, 0.04, rail, 6.9, 0.3, r); }
    motes(ctx, root, ['#cfd9ff', '#dde3f0'], 12, 16, 5);
    ctx.gather = [0, 0]; ctx.stageY = 0.38;
  }

  MF.MAPS = {
    parlor: { id: 'parlor', label: '달빛 응접실', view: 8.4, pan: 3.2, build: buildParlor, fog: [16, 40],
      tune: function (p) {
        return { hemi: Math.max(p.hemi * 0.85, 0.36 + p.on * 0.06), ground: p.on > 0.5 ? '#2a1e1a' : p.ground, sun: p.sun * 0.85,
          exp: Math.max(p.exp, 0.98), lk: 0.15 + p.on * 1.05, ek: Math.max(0.25, p.on), gk: 0.2 + p.on * 0.7, fogK: 1.6 };
      } },
    plaza: { id: 'plaza', label: '달빛 시계탑 광장', view: 9.6, pan: 3.6, build: buildPlaza, fog: [17, 46],
      tune: function (p) {
        return { hemi: Math.max(p.hemi, 0.3 + p.on * 0.04), exp: Math.max(p.exp, 0.9), lk: p.on * 1.25, ek: Math.max(p.ek, p.on), gk: 0.1 + p.on * 0.75 };
      } }
  };

  function disposeTree(o) {
    o.traverse(function (n) {
      if (n.geometry) n.geometry.dispose();
    });
  }

  // ================= 월드: 렌더러·카메라·조명 =================
  MF.createWorld = function (canvas, opt) {
    opt = opt || {};
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: !!opt.keep });
    renderer.setPixelRatio(opt.dpr || Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#141d3c', 18, 44);
    scene.background = new THREE.Color('#060914');
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 140);
    var hemi = new THREE.HemisphereLight('#25375f', '#0a0e1c', 0.6); scene.add(hemi);
    var sun = new THREE.DirectionalLight('#dde3f0', 0.8);
    sun.castShadow = true; sun.shadow.mapSize.set(opt.shadow || 2048, opt.shadow || 2048);
    var sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0012;
    scene.add(sun); scene.add(sun.target);
    // 최후 변론 스포트라이트
    var spot = new THREE.SpotLight('#ffe6c4', 0, 14, 0.32, 0.55, 1.4);
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.002;
    scene.add(spot); scene.add(spot.target);
    var spotCone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.25, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe6c4', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    scene.add(spotCone);
    // 밤 마피아 화면의 진홍 기운
    var accent = new THREE.PointLight('#c8102e', 0, 9, 2); scene.add(accent);

    var CAM_R = 17, CAM_H = 12.5, SIN_E = CAM_H / Math.sqrt(CAM_H * CAM_H + CAM_R * CAM_R);
    var w = {
      renderer: renderer, scene: scene, camera: camera, SIN_E: SIN_E,
      yaw: Math.PI / 4, yawTo: Math.PI / 4, view: 8.4, target: new THREE.Vector3(0, 0.6, 0),
      map: null, ctx: null, sceneDef: MF.SCENES[5], params: null, cw: 1, ch: 1,
      spotPos: null, spotK: 0, spotTo: 0, accentK: 0, accentTo: 0, staticShadow: !!opt.staticShadow
    };
    var sunDir = new THREE.Vector3(6, 14, 10);
    function placeCamera() {
      var t = w.target;
      camera.position.set(t.x + Math.sin(w.yaw) * CAM_R, CAM_H, t.z + Math.cos(w.yaw) * CAM_R);
      camera.lookAt(t.x, 0.6, t.z);
      sun.position.set(t.x + sunDir.x, sunDir.y, t.z + sunDir.z);
      sun.target.position.set(t.x, 0, t.z);
      camera.updateMatrixWorld();
    }
    w.setSize = function (cw, ch) {
      w.cw = cw; w.ch = ch;
      renderer.setSize(cw, ch, false);
      var a = cw / ch;
      camera.left = -w.view * a / 2; camera.right = w.view * a / 2; camera.top = w.view / 2; camera.bottom = -w.view / 2;
      camera.updateProjectionMatrix();
    };
    w.setView = function (v) {
      w.view = v; var a = w.cw / w.ch;
      camera.left = -v * a / 2; camera.right = v * a / 2; camera.top = v / 2; camera.bottom = -v / 2;
      camera.updateProjectionMatrix();
    };
    w.setMap = function (id) {
      if (w.ctx) { scene.remove(w.ctx.root); disposeTree(w.ctx.root); }
      w.map = MF.MAPS[id];
      var root = new THREE.Group(); scene.add(root);
      w.ctx = { root: root, em: [], lamps: [], glows: [], tick: [], windows: [], pools: [], seats: [] };
      w.map.build(w.ctx, root);
      w.view = opt.view || w.map.view;
      w.setSize(w.cw, w.ch);
      w.setScene(w.sceneDef.id);
    };
    w.setScene = function (id) {
      var def = MF.SCENES.filter(function (s) { return s.id === id; })[0];
      w.sceneDef = def;
      if (!w.map) return;
      var base = TIMES.filter(function (t) { return t.id === def.time; })[0];
      var p = Object.assign({}, base, w.map.tune ? w.map.tune(base) : {});
      if (def.mod) Object.assign(p, def.mod(p));
      w.params = p;
      hemi.color.set(p.sky); hemi.groundColor.set(p.ground); hemi.intensity = p.hemi;
      sun.color.set(p.sunC); sun.intensity = p.sun; sunDir.set(p.pos[0], p.pos[1], p.pos[2]);
      scene.fog.color.set(p.fog); scene.fog.near = w.map.fog[0] * (p.fogK || 1); scene.fog.far = w.map.fog[1] * (p.fogK || 1);
      scene.background.set(p.bg);
      renderer.toneMappingExposure = p.exp;
      var c = w.ctx;
      c.em.forEach(function (e) { e.m.emissiveIntensity = e.k * p.ek; });
      c.lamps.forEach(function (l) { l.cur = p.lk; l.l.intensity = l.k * p.lk; });
      c.glows.forEach(function (g) { g.s.material.opacity = g.k * p.gk; });
      c.windows.forEach(function (m) { m.map = townTexFor(def.time); m.needsUpdate = true; });
      c.pools.forEach(function (m) { m.color.set(p.pool[0]); m.opacity = p.pool[1]; });
      if (c.setHour) c.setHour(def.hour);
      w.spotTo = def.spot ? 1 : 0;
      if (def.spot && !w.spotPos) w.spotPos = { x: c.gather[0], y: c.stageY || 0, z: c.gather[1] };
      w.accentTo = def.accent ? 1 : 0;
      accent.position.set(c.gather[0], 2.4, c.gather[1]);
      placeCamera();
      renderer.shadowMap.needsUpdate = true;
    };
    // 스포트라이트를 받을 사람 위치 (null 이면 가운데)
    w.setSpot = function (pos) { w.spotPos = pos; renderer.shadowMap.needsUpdate = true; };
    w.lookAt = function (x, z) { w.target.x = x; w.target.z = z; };
    // 전환 없이 바로 그 장면으로 (미리보기 그림용)
    w.settle = function () { w.spotK = w.spotTo; w.accentK = w.accentTo; w.yaw = w.yawTo; if (w.ctx && w.ctx.settle) w.ctx.settle(); };
    w.rotate = function (dir) { w.yawTo += dir * Math.PI / 2; };
    w.render = function (dt, t) {
      if (w.ctx) w.ctx.tick.forEach(function (f) { f(dt, t); });
      w.yaw += (w.yawTo - w.yaw) * Math.min(1, dt * 6);
      w.spotK += (w.spotTo - w.spotK) * Math.min(1, dt * 3);
      w.accentK += (w.accentTo - w.accentK) * Math.min(1, dt * 3);
      var sp = w.spotPos || { x: 0, y: 0, z: 0 };
      spot.position.set(sp.x + 0.4, sp.y + 6.2, sp.z + 0.4);
      spot.target.position.set(sp.x, sp.y, sp.z); spot.target.updateMatrixWorld();
      spot.intensity = 3.2 * w.spotK; spot.visible = w.spotK > 0.01;
      spotCone.position.set(sp.x + 0.2, sp.y + 3.5, sp.z + 0.2);
      spotCone.material.opacity = 0.07 * w.spotK; spotCone.visible = w.spotK > 0.01;
      accent.intensity = 1.1 * w.accentK;
      placeCamera();
      if (w.staticShadow) renderer.shadowMap.autoUpdate = false;
      renderer.render(scene, camera);
    };
    var v3 = new THREE.Vector3();
    w.toScreen = function (x, y, z, out) {
      v3.set(x, y, z).project(camera);
      out.x = (v3.x + 1) / 2 * w.cw; out.y = (1 - v3.y) / 2 * w.ch; return out;
    };
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    w.toGround = function (sx, sy) {
      ndc.set(sx / w.cw * 2 - 1, -(sy / w.ch) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(plane, hit);
      return { x: hit.x, z: hit.z };
    };
    w.add = function (o) { scene.add(o); };
    w.dispose = function () { if (w.ctx) disposeTree(w.ctx.root); renderer.dispose(); };
    w.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);
    if (opt.map) w.setMap(opt.map);
    return w;
  };

  // ================= 캐릭터 =================
  // 1번 시안(https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5)의 구·원통 조립 인물을 그대로 쓰고,
  // 의상·표정·동작만 마피아 게임에 맞게 바꿨다. 1번 좌표 그대로 만들고 키 약 1.7 단위로 줄인다.
  var FIGK = 0.83, HIP = 0.38, R = 0.56;
  var SKIN = '#f7c9a6', EYE = '#2b2118', MOUTH = '#7a3b2e', TEAR = '#9ec2ff';

  // 인물 5명 (1번 시안 그대로)
  MF.FIGS = [
    { id: 'brown', label: '갈색 머리', hair: '#6b4630', style: 'boy', hat: '', tie: '#7a8fb8' },
    { id: 'blond', label: '금발', hair: '#d9b25c', style: 'boy', hat: '', tie: '#6fa59a' },
    { id: 'bob', label: '단발', hair: '#6b4630', style: 'girl', hat: '', tie: '#b89a6f' },
    { id: 'fedoraDark', label: '검은 페도라', hair: '#2b2118', style: 'boy', hat: 'fedoraDark', tie: '#b87a5c' },
    { id: 'fedoraTan', label: '갈색 페도라', hair: '#5a3a26', style: 'girl', hat: 'fedoraTan', tie: '#a9aebb' }
  ];

  // 의상 8종: tie null = 인물 넥타이, '' = 없음 / hat null = 인물 모자, '' = 없음
  MF.COSTUMES = [
    { id: 'citizen', label: '시민', fig: 0, coat: '#4a5163', shirt: '#eef0f4', tie: null, pants: '#2b2f38', shoe: '#1f2229', hat: null },
    { id: 'mafia', label: '마피아', fig: 3, coat: '#1a1d24', shirt: '#3a3f4b', tie: '#8e0b21', pants: '#16181e', shoe: '#0a0e1c', hat: 'mafia', glasses: true },
    { id: 'police', label: '경찰', fig: 1, coat: '#2a4372', shirt: '#c9d3ea', tie: '#16213d', pants: '#1e2847', shoe: '#16181e', hat: 'police', badge: 'star' },
    { id: 'doctor', label: '의사', fig: 2, coat: '#e9ecf2', shirt: '#2fa4a0', tie: '', pants: '#6b7180', shoe: '#3a3f4b', hat: '', badge: 'cross', steth: true },
    { id: 'detective', label: '탐정', fig: 4, coat: '#8a6a45', shirt: '#eef0f4', tie: '#4a3a28', pants: '#3a3f4b', shoe: '#2b2118', hat: 'deer', prop: 'mag' },
    { id: 'elder', label: '어르신', fig: 1, coat: '#6b5a48', shirt: '#e6e8ee', tie: '', pants: '#3a3f4b', shoe: '#2b2118', hat: '', hair: '#d8dbe3', beard: true, prop: 'cane' },
    { id: 'hood', label: '후드', fig: 2, coat: '#5a5f6c', shirt: '#3a3f4b', tie: '', pants: '#3a3f4b', shoe: '#2b2118', hat: 'hood', glove: '#7a5236' },
    { id: 'reporter', label: '기자', fig: 0, coat: '#6f8fa8', shirt: '#eef0f4', tie: '', pants: '#3a3f4b', shoe: '#2b2118', hat: 'news', badge: 'press', prop: 'cam' }
  ];
  var COSTUME_BY_ID = {}; MF.COSTUMES.forEach(function (c, i) { c.index = i; COSTUME_BY_ID[c.id] = c; });

  function mk(p, geo, color, x, y, z, o) {
    var m = new THREE.Mesh(geo, typeof color === 'string' ? M(color) : color);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true;
    if (o && o.keep) m.userData.keep = true;
    p.add(m); return m;
  }
  function grp(p, x, y, z, flag) { var g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (flag) g.userData[flag] = true; p.add(g); return g; }
  function faceSphere(r, color, sx, sy, sz) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), M(color)); m.scale.set(sx || 1, sy || 1, sz || 1); return m; }
  function faceBox(w, h, color) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), M(color)); }
  function arc(r, tube, color, full) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 20, full ? Math.PI * 2 : Math.PI), M(color)); }
  // 머리 구 표면에 붙이고 바깥을 보게 한다. 돌리기는 붙인 뒤 지역 z 축으로
  function onHead(obj, x, y, rad, out, rz) {
    var z = Math.sqrt(Math.max(0, rad * rad - x * x - y * y)) + (out === undefined ? 0.005 : out);
    var holder = new THREE.Group(); holder.position.set(x, y, z); holder.lookAt(x * 2, y * 2, z * 2 + 0.0001);
    obj.rotation.z = rz || 0; holder.add(obj); return holder;
  }

  // ---------- 표정 10종 (1번 시안 7종 + 당황·윙크·시큰둥) ----------
  MF.FACES = [
    { id: 'base', label: '기본' }, { id: 'happy', label: '웃음' }, { id: 'worried', label: '당황' }, { id: 'cry', label: '울음' },
    { id: 'angry', label: '화남' }, { id: 'wink', label: '윙크' }, { id: 'meh', label: '시큰둥' }, { id: 'smug', label: '의심' },
    { id: 'surprise', label: '놀람' }, { id: 'dead', label: '기절' }
  ];
  function buildFaces(head, r) {
    var faces = {}, ex = 0.21, ey = 0.02;
    function g(name) { var o = grp(head, 0, 0, 0, 'toggle'); o.visible = false; faces[name] = o; return o; }
    function eyes(f, mk2) { [-ex, ex].forEach(function (x) { f.add(onHead(mk2(), x, ey, r)); }); }
    var f = g('base');
    eyes(f, function () { return faceSphere(0.058, EYE, 1, 1.25, 0.5); });
    f.add(onHead(arc(0.075, 0.018, MOUTH), 0, -0.16, r, 0.005, Math.PI));
    f = g('happy');
    [-ex, ex].forEach(function (x) { f.add(onHead(arc(0.055, 0.017, EYE), x, ey - 0.02, r)); });
    f.add(onHead(faceSphere(0.085, MOUTH, 1, 0.75, 0.3), 0, -0.17, r));
    f = g('angry');
    eyes(f, function () { return faceSphere(0.052, EYE, 1, 1.1, 0.5); });
    [-1, 1].forEach(function (s) { f.add(onHead(faceBox(0.15, 0.03, EYE), s * ex, 0.13, r, 0.005, -s * 0.45)); });
    f.add(onHead(faceBox(0.13, 0.026, MOUTH), 0, -0.18, r));
    f = g('cry');
    [-ex, ex].forEach(function (x) { f.add(onHead(arc(0.055, 0.017, EYE), x, ey + 0.01, r, 0.005, Math.PI)); });
    [-ex, ex].forEach(function (x) { f.add(onHead(faceSphere(0.04, TEAR, 1, 1.9, 0.6), x + (x > 0 ? 0.02 : -0.02), -0.11, r, 0.02)); });
    f.add(onHead(faceSphere(0.06, MOUTH, 1.2, 0.8, 0.3), 0, -0.19, r));
    f = g('surprise');
    [-ex, ex].forEach(function (x) { f.add(onHead(faceSphere(0.075, EYE, 1, 1.15, 0.5), x, ey + 0.01, r)); f.add(onHead(faceSphere(0.022, '#ffffff'), x + 0.025, ey + 0.045, r, 0.03)); });
    f.add(onHead(arc(0.05, 0.02, MOUTH, true), 0, -0.19, r));
    f = g('smug');
    [-ex, ex].forEach(function (x) { f.add(onHead(faceBox(0.12, 0.034, EYE), x, ey, r)); });
    f.add(onHead(faceBox(0.15, 0.03, EYE), ex, 0.14, r, 0.005, 0.25));
    f.add(onHead(arc(0.06, 0.017, MOUTH), 0.05, -0.17, r, 0.005, Math.PI + 0.45));
    f = g('dead');
    [-ex, ex].forEach(function (x) { [0.78, -0.78].forEach(function (rz) { f.add(onHead(faceBox(0.13, 0.028, EYE), x, ey, r, 0.005, rz)); }); });
    f.add(onHead(faceBox(0.1, 0.024, MOUTH), 0, -0.18, r));
    f = g('worried');
    eyes(f, function () { return faceSphere(0.045, EYE, 1, 1.2, 0.5); });
    [-1, 1].forEach(function (s) { f.add(onHead(faceBox(0.13, 0.026, EYE), s * ex, 0.13, r, 0.005, s * 0.35)); });
    [[-0.06, 0.4], [0, -0.4], [0.06, 0.4]].forEach(function (z) { f.add(onHead(faceBox(0.07, 0.022, MOUTH), z[0], -0.18, r, 0.005, z[1])); });
    f = g('wink');
    f.add(onHead(arc(0.055, 0.017, EYE), -ex, ey - 0.02, r));
    f.add(onHead(faceSphere(0.058, EYE, 1, 1.25, 0.5), ex, ey, r));
    f.add(onHead(arc(0.085, 0.02, MOUTH), 0, -0.15, r, 0.005, Math.PI));
    f = g('meh');
    [-ex, ex].forEach(function (x) { f.add(onHead(faceSphere(0.05, EYE, 1, 0.6, 0.5), x, ey - 0.01, r)); f.add(onHead(faceBox(0.13, 0.028, EYE), x, ey + 0.03, r, 0.01)); });
    f.add(onHead(faceBox(0.11, 0.024, MOUTH), 0.01, -0.18, r, 0.005, -0.08));
    // 볼·코는 늘 보인다
    head.add(onHead(faceSphere(0.05, '#ef9a7c', 1, 1, 0.8), 0, -0.065, r, 0.01));
    [-0.31, 0.31].forEach(function (x) { head.add(onHead(faceSphere(0.085, '#f2988a', 1.35, 0.8, 0.25), x, -0.11, r, 0)); });
    return faces;
  }

  // ---------- 모자 ----------
  function buildHat(head, id) {
    var h = grp(head, 0, 0, 0);
    function fedora(crownC, bandC) {
      mk(h, new THREE.CylinderGeometry(0.36, 0.44, 0.36, 24), crownC, 0, R * 0.78, 0);
      var dent = mk(h, new THREE.SphereGeometry(0.36, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), crownC, 0, R * 0.78 + 0.17, 0); dent.scale.y = 0.35;
      mk(h, new THREE.CylinderGeometry(0.445, 0.45, 0.09, 24), bandC, 0, R * 0.78 - 0.12, 0);
      mk(h, new THREE.CylinderGeometry(0.78, 0.8, 0.05, 32), crownC, 0, R * 0.78 - 0.18, 0);
      h.rotation.x = -0.08;
    }
    if (id === 'fedoraDark') fedora('#3d4357', '#22252e');
    else if (id === 'fedoraTan') fedora('#a98559', '#5a3a26');
    else if (id === 'mafia') fedora('#1a1d24', '#8e0b21');
    else if (id === 'police') {
      mk(h, new THREE.CylinderGeometry(0.5, 0.46, 0.28, 24), '#2a4372', 0, R * 0.8, 0);
      mk(h, new THREE.CylinderGeometry(0.505, 0.505, 0.04, 24), '#d9a441', 0, R * 0.8 - 0.1, 0);
      mk(h, new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24, 1, false, -0.9, 1.8), '#121a30', 0, R * 0.8 - 0.16, 0.18);
      mk(h, new THREE.SphereGeometry(0.07, 10, 8), M('#d9a441', { metalness: 0.4, roughness: 0.4 }), 0, R * 0.8 + 0.02, 0.47);
    } else if (id === 'deer') {
      mk(h, new THREE.SphereGeometry(R + 0.04, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), '#8a6a45');
      var dv = mk(h, new THREE.SphereGeometry(0.24, 12, 8), '#6b5236', 0, R * 0.62, R * 0.62); dv.scale.set(1.2, 0.2, 1);
      var dv2 = mk(h, new THREE.SphereGeometry(0.24, 12, 8), '#6b5236', 0, R * 0.62, -R * 0.62); dv2.scale.set(1.2, 0.2, 1);
      mk(h, new THREE.SphereGeometry(0.05, 8, 6), '#6b5236', 0, R + 0.06, 0);
    } else if (id === 'news') {
      var nc = mk(h, new THREE.SphereGeometry(R + 0.06, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), '#4a4f5c'); nc.scale.y = 0.9;
      mk(h, new THREE.CylinderGeometry(0.36, 0.36, 0.04, 20, 1, false, -0.8, 1.6), '#3a3f4b', 0, R * 0.55, 0.2);
      mk(h, new THREE.SphereGeometry(0.05, 8, 6), '#3a3f4b', 0, R + 0.02, 0);
    } else if (id === 'hood') {
      // 앞이 트인 두건: 얼굴만 보이게 둘러싼다
      var hd = mk(h, new THREE.SphereGeometry(R + 0.12, 28, 18, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.82), '#5a5f6c'); hd.scale.set(1.05, 1.06, 1.05);
      var tip = mk(h, new THREE.ConeGeometry(0.16, 0.34, 10), '#5a5f6c', 0, R + 0.08, -0.32); tip.rotation.x = -0.9;
    }
    return h;
  }

  // ---------- 동작 8종 (1번 시안 키프레임을 손봄) ----------
  // aAx·aBx: 왼팔·오른팔 앞으로 들기(-), aAz: 왼팔 바깥(+), aBz: 오른팔 바깥(-), lA·lB 다리, hx·hy·hz 머리, y 몸 높이, s 찌그러짐, ry 몸 비틀기, sh 어깨 으쓱, hA·hB 손 모양
  MF.EMOTES = [
    { id: 'throat', label: '목 긋기', face: 'smug', fx: 'lines', seg: 0.32, cycles: 1, hold: 0.6, frames: [
      { aBx: -0.4, aBz: -0.2 }, { aBx: -2.3, aBz: -0.55, hz: 0.12, hB: 'open' },
      { aBx: -2.35, aBz: 0.6, hz: -0.15, hB: 'open' }, { aBx: -2.3, aBz: 0.6, hz: -0.15, hB: 'open' }] },
    { id: 'deny', label: '손사래', face: 'worried', fx: 'sweat', seg: 0.2, cycles: 3, hold: 0.1, frames: [
      { aAx: -1.5, aAz: -0.45, aBx: -1.5, aBz: 0.45, hy: 0.35, hA: 'open', hB: 'open' },
      { aAx: -1.5, aAz: 0.15, aBx: -1.5, aBz: -0.15, hy: -0.35, hA: 'open', hB: 'open' }] },
    { id: 'clap', label: '박수', face: 'happy', fx: 'sparkle', seg: 0.14, cycles: 5, hold: 0.1, frames: [
      { aAx: -1.2, aAz: -0.2, aBx: -1.2, aBz: 0.2, hA: 'open', hB: 'open' },
      { aAx: -1.25, aAz: -0.6, aBx: -1.25, aBz: 0.6, y: 0.03, hA: 'open', hB: 'open' }] },
    { id: 'cry', label: '울기', face: 'cry', fx: 'tears', seg: 0.22, cycles: 4, hold: 0, frames: [
      { aAx: -2.55, aAz: -0.5, aBx: -2.55, aBz: 0.5, hx: 0.12 },
      { aAx: -2.5, aAz: -0.45, aBx: -2.5, aBz: 0.45, hx: 0.18, y: -0.03, s: 0.96 }] },
    { id: 'shake', label: '악수 내밀기', face: 'happy', fx: null, seg: 0.18, cycles: 3, hold: 0.4, frames: [
      { aBx: -1.3, aBz: -0.15, hz: -0.08, hB: 'open' }, { aBx: -1.6, aBz: -0.15, hz: -0.08, hB: 'open' }] },
    { id: 'point', label: '지목', face: 'angry', fx: 'lines', seg: 0.3, cycles: 1, hold: 1.2, frames: [
      { aBx: -0.6, aBz: -0.3 }, { aBx: -1.55, aBz: -0.55, aAz: 0.55, aAx: 0.25, hy: -0.25, hz: 0.1, hB: 'point' }] },
    { id: 'thumb', label: '엄지척', face: 'wink', fx: 'sparkle', seg: 0.18, cycles: 3, hold: 0.3, frames: [
      { aBz: -2.75, y: 0.06, hB: 'thumb' }, { aBz: -2.45, y: 0, hB: 'thumb' }] },
    { id: 'shrug', label: '어깨 으쓱', face: 'meh', fx: null, seg: 0.3, cycles: 2, hold: 0.5, frames: [
      { aAx: -0.45, aAz: 0.85, aBx: -0.45, aBz: -0.85, sh: 0.07, hz: 0.15, hA: 'open', hB: 'open' },
      { aAx: -0.4, aAz: 0.75, aBx: -0.4, aBz: -0.75, sh: 0.03, hz: 0.1, hA: 'open', hB: 'open' }] }
  ];
  var EMOTE_BY_ID = {}; MF.EMOTES.forEach(function (e, i) { e.index = i; EMOTE_BY_ID[e.id] = e; });
  var KEYS = ['aAx', 'aAz', 'aBx', 'aBz', 'lA', 'lB', 'hx', 'hy', 'hz', 'y', 's', 'ry', 'sh'];

  // ---------- 효과 ----------
  function starG(r) {
    var s = new THREE.Shape();
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2, rr = i % 2 ? r * 0.32 : r; var x = Math.sin(a) * rr, y = Math.cos(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
    s.closePath(); return new THREE.ShapeGeometry(s);
  }
  var basicCache = {};
  function BM(c) { if (!basicCache[c]) basicCache[c] = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }); return basicCache[c]; }
  function buildFx(c) {
    var fx = {};
    var sp = grp(c.head, 0, 0, 0, 'toggle'); sp.visible = false; fx.sparkle = sp;
    [[0.72, 0.42, 0.12], [0.86, 0.08, 0.08], [-0.74, 0.5, 0.08]].forEach(function (s) { mk(sp, starG(s[2]), BM('#f1f2f5'), s[0], s[1], 0.3, { keep: true }); });
    var sw = grp(c.head, 0, 0, 0, 'toggle'); sw.visible = false; fx.sweat = sw;
    var drop = mk(sw, new THREE.SphereGeometry(0.07, 8, 6), BM(TEAR), 0.55, 0.42, 0.3, { keep: true }); drop.scale.set(0.8, 1.3, 0.8);
    mk(sw, new THREE.ConeGeometry(0.052, 0.09, 8), BM(TEAR), 0.55, 0.51, 0.3, { keep: true });
    var ln = grp(c.body, 0, 0, 0, 'toggle'); ln.visible = false; fx.lines = ln;
    [[-0.78, 1.15, 0.0], [-0.84, 1.03, -0.15], [-0.76, 0.91, -0.3]].forEach(function (l) { var m = mk(ln, new THREE.BoxGeometry(0.22, 0.03, 0.03), BM('#e6e8ee'), l[0], l[1], 0.4, { keep: true }); m.rotation.z = l[2]; });
    var td = grp(c.head, 0, 0, 0, 'toggle'); td.visible = false; fx.tears = td;
    [-1, 1].forEach(function (sd) { var d = mk(td, new THREE.SphereGeometry(0.05, 8, 6), BM(TEAR), sd * 0.5, -0.05, 0.38, { keep: true }); d.scale.y = 1.4; d.userData.sd = sd; });
    return fx;
  }

  function Character(costumeId, opt) {
    opt = opt || {};
    this.root = new THREE.Group();
    this.x = 0; this.z = 0; this.y = 0; this.yaw = 0; this.yawTo = 0;
    this.moving = false; this.walkT = 0; this.sitTop = 0; this.sitK = 0;
    this.emote = null; this.faceOverride = null; this.t = Math.random() * 10;
    this.castShadow = opt.castShadow !== false;
    this.scale = opt.scale || 1; this.root.scale.setScalar(this.scale);
    this.figIndex = opt.fig;
    this.build(costumeId);
  }
  Character.prototype.build = function (costumeId) {
    var self = this;
    if (this.fig) { this.root.remove(this.fig); disposeTree(this.fig); }
    var o = COSTUME_BY_ID[costumeId] || MF.COSTUMES[0];
    var F = MF.FIGS[this.figIndex === undefined ? o.fig : this.figIndex];
    this.costume = o; this.figure = F;
    var fig = this.fig = new THREE.Group(); fig.scale.setScalar(FIGK); this.root.add(fig);
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; shadow.userData.keep = true; fig.add(shadow); this.shadow = shadow;
    var body = this.body = grp(fig, 0, 0, 0, 'pivot');
    var hairC = o.hair || F.hair, tieC = o.tie === null ? F.tie : o.tie, hat = o.hat === null ? F.hat : o.hat;
    var hand = o.glove || SKIN;
    function leg(x) {
      var g = grp(body, x, HIP, 0, 'pivot');
      mk(g, new THREE.CylinderGeometry(0.1, 0.1, 0.26, 12), o.pants, 0, -0.12, 0);
      var s = mk(g, new THREE.SphereGeometry(0.13, 14, 10), o.shoe, 0, -0.25, 0.05); s.scale.set(0.9, 0.55, 1.3);
      return g;
    }
    this.legA = leg(0.13); this.legB = leg(-0.13);
    mk(body, new THREE.CylinderGeometry(0.29, 0.39, 0.6, 24), o.coat, 0, 0.66, 0);
    mk(body, new THREE.SphereGeometry(0.39, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.18), o.coat, 0, 0.38, 0);
    var sh = mk(body, new THREE.SphereGeometry(0.3, 24, 14), o.coat, 0, 0.94, 0); sh.scale.set(1.18, 0.55, 1);
    var shirt = mk(body, new THREE.ConeGeometry(0.12, 0.3, 3), o.shirt, 0, 0.88, 0.27); shirt.rotation.x = Math.PI; shirt.scale.set(1, 1, 0.25);
    if (tieC) { var tie = mk(body, new THREE.BoxGeometry(0.06, 0.24, 0.025), tieC, 0, 0.8, 0.305); tie.rotation.x = -0.18; }
    [-1, 1].forEach(function (s) { var lap = mk(body, new THREE.BoxGeometry(0.1, 0.32, 0.03), o.coat, s * 0.085, 0.88, 0.29); lap.rotation.set(-0.15, 0, s * 0.42); });
    [0.68, 0.55].forEach(function (y) { mk(body, new THREE.SphereGeometry(0.025, 8, 6), '#22252e', 0.07, y, 0.33); });
    if (o.badge === 'star') { var st = mk(body, new THREE.SphereGeometry(0.05, 10, 8), M('#d9a441', { metalness: 0.4, roughness: 0.4 }), 0.17, 0.8, 0.29); st.scale.z = 0.4; }
    if (o.badge === 'cross') { mk(body, new THREE.BoxGeometry(0.03, 0.1, 0.02), '#2fa4a0', 0.17, 0.8, 0.3); mk(body, new THREE.BoxGeometry(0.1, 0.03, 0.02), '#2fa4a0', 0.17, 0.8, 0.3); }
    if (o.badge === 'press') mk(body, new THREE.BoxGeometry(0.1, 0.07, 0.02), '#f1f2f5', 0.16, 0.78, 0.3);
    if (o.steth) { var tor = mk(body, new THREE.TorusGeometry(0.17, 0.018, 6, 16, Math.PI), '#3a3f4b', 0, 0.9, 0.24); tor.rotation.set(-0.5, 0, Math.PI); mk(body, new THREE.SphereGeometry(0.035, 8, 6), '#a9aebb', 0.12, 0.72, 0.31); }
    // 머리
    var neck = this.neck = grp(body, 0, 1.0, 0, 'pivot');
    var head = this.head = grp(neck, 0, 0.48, 0);
    var skull = mk(head, new THREE.SphereGeometry(R, 32, 24), SKIN); skull.scale.set(1.04, 0.96, 0.98);
    [-1, 1].forEach(function (s) { var ear = mk(head, new THREE.SphereGeometry(0.15, 14, 10), SKIN, s * (R + 0.02), 0, 0); ear.scale.set(0.6, 1, 0.8); });
    if (hat !== 'hood') {
      if (!hat) mk(head, new THREE.SphereGeometry(R + 0.035, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.4), hairC);
      mk(head, new THREE.SphereGeometry(R + 0.04, 32, 10, Math.PI / 2 - 1.15, 2.3, Math.PI * 0.3, Math.PI * 0.16), hairC);
      if (F.style === 'girl') { var bk = mk(head, new THREE.SphereGeometry(R + 0.06, 32, 18, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0, Math.PI * 0.8), hairC); bk.scale.set(1.04, 1.02, 1.0); }
      else mk(head, new THREE.SphereGeometry(R + 0.03, 32, 14, Math.PI / 2 + 1.2, Math.PI * 2 - 2.4, 0, Math.PI * 0.55), hairC);
    } else {
      mk(head, new THREE.SphereGeometry(R + 0.03, 32, 10, Math.PI / 2 - 0.75, 1.5, Math.PI * 0.3, Math.PI * 0.1), '#2e2a28');
    }
    this.faces = buildFaces(head, R * 0.98);
    if (o.glasses) {
      [-0.21, 0.21].forEach(function (x) { head.add(onHead(faceSphere(0.11, '#14161c', 1.15, 0.7, 0.3), x, 0.03, R, 0.025)); });
      head.add(onHead(faceBox(0.14, 0.03, '#14161c'), 0, 0.06, R, 0.03));
    }
    if (o.beard) {
      head.add(onHead(faceSphere(0.2, '#e6e8ee', 1.5, 1.2, 0.55), 0, -0.3, R, -0.02));
      head.add(onHead(faceSphere(0.09, '#eef0f4', 1.8, 0.6, 0.5), 0, -0.13, R, 0.02));
    }
    if (hat) buildHat(head, hat);
    // 팔: 1번 시안처럼 한 마디. 손 모양만 바꿔 끼운다
    function arm(x, side) {
      var g = grp(body, x, 0.9, 0, 'pivot');
      mk(g, new THREE.CylinderGeometry(0.085, 0.095, 0.4, 12), o.coat, 0, -0.2, 0);
      var hands = {};
      ['base', 'open', 'point', 'thumb'].forEach(function (k) {
        var hg = grp(g, 0, -0.43, 0, 'toggle'); hg.visible = k === 'base'; hands[k] = hg;
        if (k === 'open') { var op = mk(hg, new THREE.SphereGeometry(0.11, 14, 10), hand); op.scale.set(1.1, 1.05, 0.55); }
        else mk(hg, new THREE.SphereGeometry(0.1, 14, 10), hand);
        if (k === 'point') { var fp = mk(hg, new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), hand, 0, -0.13, 0.02); fp.rotation.x = 0; }
        if (k === 'thumb') { var th = mk(hg, new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), hand, side * -0.02, -0.04, 0.1); th.rotation.x = Math.PI / 2; }
      });
      return { g: g, hands: hands };
    }
    var A = arm(0.37, 1), B = arm(-0.37, -1);
    this.armA = A.g; this.handsA = A.hands; this.armB = B.g; this.handsB = B.hands;
    // 소품: 오른손
    if (o.prop === 'mag') {
      var mg = grp(this.armB, 0, -0.48, 0.08);
      mk(mg, new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), '#4a3a28', 0, -0.05, 0);
      mk(mg, new THREE.TorusGeometry(0.1, 0.025, 8, 20), '#6b5236', 0, -0.22, 0);
      mk(mg, new THREE.CircleGeometry(0.09, 20), new THREE.MeshStandardMaterial({ color: '#9ec2ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, -0.22, 0, { keep: true }).castShadow = false;
    } else if (o.prop === 'cam') {
      var cm = grp(this.armB, 0, -0.5, 0.1);
      mk(cm, new THREE.BoxGeometry(0.24, 0.15, 0.12), '#2b2f38');
      var lens = mk(cm, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), '#6b7180', 0, 0, 0.08); lens.rotation.x = Math.PI / 2;
    } else if (o.prop === 'cane') {
      var cn = grp(this.armB, 0, -0.45, 0.04);
      mk(cn, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), '#7a5236', 0, -0.2, 0);
      var hk = mk(cn, new THREE.TorusGeometry(0.06, 0.022, 6, 12, Math.PI), '#7a5236', 0.06, 0.05, 0); hk.rotation.z = 0;
    }
    this.fx = buildFx(this);
    this.faceId = null; this.setFace('base');
    this.idle = { aAx: 0, aAz: 0.12, aBx: 0, aBz: -0.12, lA: 0, lB: 0, hx: 0, hy: 0, hz: 0, y: 0, s: 1, ry: 0, sh: 0, hA: 'base', hB: 'base' };
    fig.traverse(function (m) { if (m.isMesh && !m.userData.keep) m.castShadow = self.castShadow; });
    this.merged = false;
  };
  Character.prototype.setFace = function (id) {
    if (this.faceId === id) return;
    var faces = this.faces; Object.keys(faces).forEach(function (k) { faces[k].visible = k === id; });
    this.faceId = id;
  };
  function setHand(hs, h) { Object.keys(hs).forEach(function (k) { hs[k].visible = k === h; }); }
  Character.prototype.play = function (id) { var e = EMOTE_BY_ID[id]; if (e) this.emote = { def: e, t: 0 }; };
  Character.prototype.stop = function () { this.emote = null; };
  Character.prototype.update = function (dt) {
    this.t += dt;
    var p = Object.assign({}, this.idle), face = this.faceOverride || 'base', fx = null;
    p.hz = Math.sin(this.t * 0.7 + this.x) * 0.03; p.y = Math.sin(this.t * 2 + this.z) * 0.012;
    if (this.moving) {
      this.walkT += dt * 11;
      var sw = Math.sin(this.walkT);
      p.aAx = sw * 0.5; p.aBx = -sw * 0.5; p.lA = -sw * 0.6; p.lB = sw * 0.6; p.hx = 0.04; p.y = Math.abs(Math.cos(this.walkT)) * 0.06; p.hz = 0;
    }
    this.sitK += ((this.sitTop > 0 ? 1 : 0) - this.sitK) * Math.min(1, dt * 8);
    if (this.sitK > 0.01) { p.lA = p.lB = -1.45 * this.sitK; if (!this.emote) { p.aAx = p.aBx = -0.55 * this.sitK; p.aAz = 0.05; p.aBz = -0.05; } }
    if (this.emote) {
      var d = this.emote.def, n = d.frames.length, last = n * d.cycles - 1, total = n * d.seg * d.cycles;
      this.emote.t += dt;
      if (this.emote.t > total + d.hold) this.emote = null;
      else {
        var t = Math.min(this.emote.t, total), idx = Math.min(Math.floor(t / d.seg), last), local = Math.min(1, (t - idx * d.seg) / d.seg);
        var fa = d.frames[idx % n], fb = idx >= last ? fa : d.frames[(idx + 1) % n];
        var k = local * local * (3 - 2 * local), base = p, q = {}, blendIn = Math.min(1, this.emote.t / 0.15);
        KEYS.forEach(function (key) {
          var a = fa[key] === undefined ? base[key] : fa[key], b = fb[key] === undefined ? base[key] : fb[key];
          q[key] = base[key] + ((a + (b - a) * k) - base[key]) * blendIn;
        });
        if (this.sitK > 0.5) { q.lA = p.lA; q.lB = p.lB; }
        Object.assign(p, q);
        p.hA = (k < 0.5 ? fa.hA : fb.hA) || 'base'; p.hB = (k < 0.5 ? fa.hB : fb.hB) || 'base';
        face = d.face; fx = d.fx;
      }
    }
    this.applyPose(p);
    this.setFace(face);
    var F = this.fx, self = this;
    Object.keys(F).forEach(function (k) { F[k].visible = k === fx; });
    if (fx === 'sparkle') F.sparkle.children.forEach(function (s, i) { var sc = 0.6 + 0.4 * Math.abs(Math.sin(self.t * 6 + i * 2)); s.scale.set(sc, sc, sc); s.rotation.z = self.t * 2; });
    if (fx === 'tears') F.tears.children.forEach(function (d, i) { var u = (self.t * 1.6 + i * 0.5) % 1; d.position.set(d.userData.sd * (0.5 + u * 0.3), -0.05 - u * 0.55, 0.38); });
    if (fx === 'sweat') F.sweat.position.y = -Math.abs(Math.sin(this.t * 3)) * 0.04;
    if (fx === 'lines') F.lines.position.x = Math.sin(this.t * 20) * 0.02;
    var dy = this.yawTo - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 10);
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
  };
  Character.prototype.applyPose = function (p) {
    var sit = this.sitK;
    this.armA.rotation.set(p.aAx, 0, p.aAz); this.armB.rotation.set(p.aBx, 0, p.aBz);
    this.armA.position.y = 0.9 + p.sh; this.armB.position.y = 0.9 + p.sh;
    this.legA.rotation.x = p.lA; this.legB.rotation.x = p.lB;
    this.neck.rotation.set(p.hx, p.hy, p.hz);
    this.neck.position.y = 1.0 - p.sh * 0.4;
    // 앉으면 엉덩이를 의자 높이로 (1번 좌표 단위)
    var sitY = this.sitTop > 0 ? this.sitTop / (this.scale * FIGK) - HIP : (this.lastSit || 0);
    if (this.sitTop > 0) this.lastSit = sitY;
    this.body.position.y = p.y + sitY * sit;
    this.body.position.z = -0.08 * sit;
    this.body.scale.set(1 + (1 - p.s) * 0.6, p.s, 1 + (1 - p.s) * 0.6);
    this.body.rotation.y = p.ry;
    this.shadow.visible = sit < 0.5;
    setHand(this.handsA, p.hA); setHand(this.handsB, p.hB);
  };
  Character.prototype.dispose = function () { disposeTree(this.root); };

  // 같은 관절에 붙은 부품을 색 정점 메시 하나로 합친다(드로우콜 줄이기). 표정·손 모양·효과는 묶음별로 합친다
  var vcMat = null;
  Character.prototype.optimize = function () {
    if (this.merged) return;
    if (!vcMat) vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
    var self = this;
    this.fig.updateMatrixWorld(true);
    function mergeUnder(owner) {
      var list = [];
      (function walk(o) {
        o.children.forEach(function (ch) {
          if (ch.isMesh) { if (!ch.userData.keep && ch.material && !ch.material.transparent && ch.material.isMeshStandardMaterial && !ch.material.map && !(ch.material.metalness > 0)) list.push(ch); }
          else if (!ch.userData.pivot && !ch.userData.toggle) walk(ch);
        });
      })(owner);
      if (list.length < 2) return;
      var inv = new THREE.Matrix4().copy(owner.matrixWorld).invert();
      var pos = [], nrm = [], col = [], c = new THREE.Color(), m = new THREE.Matrix4(), nm = new THREE.Matrix3();
      list.forEach(function (mesh) {
        var g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        if (!g.attributes.normal) g.computeVertexNormals();
        m.multiplyMatrices(inv, mesh.matrixWorld); g.applyMatrix4(m);
        c.copy(mesh.material.color);
        var pa = g.attributes.position.array, na = g.attributes.normal.array;
        for (var i = 0; i < pa.length; i += 3) { pos.push(pa[i], pa[i + 1], pa[i + 2]); nrm.push(na[i], na[i + 1], na[i + 2]); col.push(c.r, c.g, c.b); }
        g.dispose(); mesh.parent.remove(mesh); mesh.geometry.dispose();
      });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      var mm = new THREE.Mesh(geo, vcMat); mm.castShadow = self.castShadow; mm.receiveShadow = true; owner.add(mm);
    }
    var owners = [];
    this.fig.traverse(function (o) { if (o.userData.pivot || o.userData.toggle) owners.push(o); });
    owners.forEach(mergeUnder);
    this.merged = true;
  };
  MF.Character = Character;
  MF.COSTUME_BY_ID = COSTUME_BY_ID;
  MF.EMOTE_BY_ID = EMOTE_BY_ID;

  // ================= 응접실 이동 격자 (가구를 돌아간다) =================
  MF.parlorBlocked = function (x, z, r) {
    r = r === undefined ? 0.3 : r;
    function inRect(x0, x1, z0, z1) { return x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r; }
    function inCircle(cx, cz, rad) { var dx = x - cx, dz = z - cz; return dx * dx + dz * dz < (rad + r) * (rad + r); }
    if (x < -6.55 || z < -6.55 || x > 6.9 || z > 6.9) return true;
    if (inCircle(0, 0, 2.2)) return true;
    if (inRect(-7, -6.1, -0.8, 1.2)) return true;
    if (inCircle(-5.0, -1.2, 0.55) || inCircle(-5.0, 2.0, 0.55)) return true;
    if (inRect(-5.7, -4.1, -7, -6.4) || inRect(-7, -6.4, -5.2, -3.6)) return true;
    if (inRect(1.1, 1.7, -7, -6.45)) return true;
    if (inCircle(4.5, -4.5, 1.25) || inCircle(5.3, -3.3, 0.5)) return true;
    if (inRect(-7, -5.95, 3.2, 5.6) || inRect(-5.3, -4.5, 3.7, 5.1)) return true;
    if (inCircle(-6.4, -6.4, 0.4) || inCircle(6.2, -6.4, 0.4)) return true;
    if (inCircle(-5.9, 6.0, 0.3)) return true;
    return false;
  };
  MF.Grid = function (blocked, min, n, cell) {
    var g = new Uint8Array(n * n);
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) g[j * n + i] = blocked(min + (i + 0.5) * cell, min + (j + 0.5) * cell) ? 0 : 1;
    this.g = g; this.min = min; this.n = n; this.cell = cell;
  };
  var GP = MF.Grid.prototype;
  GP.cellOf = function (x, z) { return { i: Math.floor((x - this.min) / this.cell), j: Math.floor((z - this.min) / this.cell) }; };
  GP.ok = function (i, j) { return i >= 0 && j >= 0 && i < this.n && j < this.n && this.g[j * this.n + i] === 1; };
  GP.okAt = function (x, z) { var c = this.cellOf(x, z); return this.ok(c.i, c.j); };
  GP.nearest = function (x, z) {
    var c = this.cellOf(x, z), best = null, bd = 1e9, n = this.n;
    for (var r = 0; r < n && !best; r++) {
      for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !this.ok(c.i + di, c.j + dj)) continue;
        var px = this.min + (c.i + di + 0.5) * this.cell, pz = this.min + (c.j + dj + 0.5) * this.cell, d = (px - x) * (px - x) + (pz - z) * (pz - z);
        if (d < bd) { bd = d; best = { x: px, z: pz }; }
      }
    }
    return best;
  };
  GP.clear = function (a, b) {
    var dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.hypot(dx, dz) / 0.08);
    for (var k = 1; k < n; k++) if (!this.okAt(a.x + dx * k / n, a.z + dz * k / n)) return false;
    return true;
  };
  GP.path = function (from, to) {
    var self = this, N = this.n;
    if (this.clear(from, to)) return [to];
    var s = this.cellOf(from.x, from.z), e = this.cellOf(to.x, to.z);
    if (!this.ok(s.i, s.j)) { var ns = this.nearest(from.x, from.z); s = this.cellOf(ns.x, ns.z); }
    var gs = new Float32Array(N * N).fill(1e9), prev = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N), open = [];
    var si = s.j * N + s.i, ei = e.j * N + e.i;
    gs[si] = 0; open.push(si);
    function h(k) { var di = Math.abs(k % N - e.i), dj = Math.abs(Math.floor(k / N) - e.j); return Math.max(di, dj) + 0.414 * Math.min(di, dj); }
    while (open.length) {
      var bi = 0;
      for (var q = 1; q < open.length; q++) if (gs[open[q]] + h(open[q]) < gs[open[bi]] + h(open[bi])) bi = q;
      var cur = open[bi]; open.splice(bi, 1);
      if (cur === ei) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      var ci = cur % N, cj = Math.floor(cur / N);
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        var ni = ci + di, nj = cj + dj;
        if (!self.ok(ni, nj)) continue;
        if (di && dj && (!self.ok(ci + di, cj) || !self.ok(ci, cj + dj))) continue;
        var nk = nj * N + ni, cost = gs[cur] + (di && dj ? 1.414 : 1);
        if (cost < gs[nk]) { gs[nk] = cost; prev[nk] = cur; open.push(nk); }
      }
    }
    if (prev[ei] < 0) return [];
    var pts = [];
    for (var k = ei; k !== si && k >= 0; k = prev[k]) pts.unshift({ x: this.min + (k % N + 0.5) * this.cell, z: this.min + (Math.floor(k / N) + 0.5) * this.cell });
    pts[pts.length - 1] = to;
    var out = [], a = from, idx = 0;
    while (idx < pts.length) {
      var far = idx;
      for (var m = pts.length - 1; m > idx; m--) if (this.clear(a, pts[m])) { far = m; break; }
      out.push(pts[far]); a = pts[far]; idx = far + 1;
    }
    return out;
  };
})();
