/* minifia v2.0 지목·변론 배경 블록아웃 공용 코드 — three r128 (전역 THREE), character.js(MFChar) 위에서 돈다.
 * 기획안 파일(bar.js 등)이 MFB.CONCEPTS[id] 에 장소를 등록하고, 이 파일이 카메라·단계별 조명·8명 배치·스포트라이트를 맡는다.
 * 투표 표시(머리 위 표 수, 알림, 채팅)는 화면 겹침 층이 맡는다. 맵에는 투표 장치를 두지 않는다.
 * 단계: talk(토론) · vote(지목) · trial(최후 변론) · night(밤)
 */
(function () {
  'use strict';
  var B = window.MFB = { CONCEPTS: {} };

  // ---------- 만들기 도구 ----------
  var cache = {};
  function M(c, o) {
    if (o) return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o));
    if (!cache[c]) cache[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });
    return cache[c];
  }
  function add(p, geo, m, x, y, z, cast) {
    var o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = cast !== false; o.receiveShadow = true; p.add(o); return o;
  }
  function box(p, w, h, d, m, x, y, z, cast) { return add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, cast); }
  function cyl(p, rt, rb, h, seg, m, x, y, z, cast) { return add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, cast); }
  function sph(p, r, m, x, y, z, cast) { return add(p, new THREE.SphereGeometry(r, 16, 12), m, x, y, z, cast); }
  var glowTex = null;
  function getGlowTex() {
    if (glowTex) return glowTex;
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); return glowTex;
  }
  // 단계마다 켜고 끄는 빛은 무리(grp)로 묶는다: room 실내등, vote 지목 장치, trial 변론 장치, night 밤 전용
  function E(ctx, c, k, grp) { var m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.6 }); ctx.em.push({ m: m, k: k, grp: grp || 'room' }); return m; }
  function glow(ctx, p, c, size, x, y, z, k, grp) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: k }));
    s.scale.set(size, size, 1); s.position.set(x, y, z); p.add(s); ctx.glows.push({ s: s, k: k, grp: grp || 'room' }); return s;
  }
  function lamp(ctx, p, c, k, dist, x, y, z, grp) {
    var l = new THREE.PointLight(c, k, dist, 2); l.position.set(x, y, z); p.add(l); ctx.lamps.push({ l: l, k: k, grp: grp || 'room' }); return l;
  }
  // 반지름 r 원 위 n 자리. 첫 자리는 카메라 쪽(+x+z)에서 시작해 돈다. 각 자리는 가운데를 본다
  function ring(n, r, y, cx, cz) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = Math.PI / 4 + i / n * Math.PI * 2, x = (cx || 0) + Math.sin(a) * r, z = (cz || 0) + Math.cos(a) * r;
      out.push({ x: x, y: y || 0, z: z, yaw: Math.atan2((cx || 0) - x, (cz || 0) - z) });
    }
    return out;
  }
  B.kit = { M: M, E: E, add: add, box: box, cyl: cyl, sph: sph, glow: glow, lamp: lamp, ring: ring };

  // ---------- 단계별 빛 ----------
  // grp 배율과 하늘·안개. 기획안이 env 로 단계별 값을 덮어쓸 수 있다
  var PHASE = {
    talk: { grp: { room: 1, vote: 0, trial: 0, night: 0 }, hemi: 0.42, moon: 0.35, spot: 0, accent: 0, exp: 1.0 },
    vote: { grp: { room: 0.45, vote: 1, trial: 0, night: 0 }, hemi: 0.3, moon: 0.25, spot: 0, accent: 0, exp: 1.0 },
    trial: { grp: { room: 0.05, vote: 0.12, trial: 1, night: 0 }, hemi: 0.1, moon: 0.06, spot: 1, accent: 0, exp: 0.95 },
    night: { grp: { room: 0, vote: 0, trial: 0, night: 1 }, hemi: 0.16, moon: 0.45, spot: 0, accent: 1, exp: 0.9 },
    morning: { grp: { room: 0.25, vote: 0, trial: 0, night: 0.7 }, hemi: 0.5, moon: 0.55, spot: 0, accent: 0, exp: 1.0 },
    // 판 끝: 결과는 지목 조명, 시상식은 무대 스포트라이트
    result: { grp: { room: 0.3, vote: 0.8, trial: 0, night: 0 }, hemi: 0.3, moon: 0.25, spot: 0, accent: 0, exp: 1.0 },
    award: { grp: { room: 0.1, vote: 0.25, trial: 1, night: 0 }, hemi: 0.16, moon: 0.1, spot: 1, accent: 0, exp: 1.0 }
  };
  var SKY = {
    indoor: { talk: ['#1a1830', '#0b0a14', '#120f1c'], vote: ['#161428', '#09080f', '#0e0c16'], trial: ['#08080e', '#030306', '#050508'], night: ['#141c3a', '#04050b', '#05070f'], morning: ['#4a4560', '#120f18', '#1f1a28'], result: ['#161428', '#09080f', '#0e0c16'], award: ['#08080e', '#030306', '#050508'] },
    outdoor: { talk: ['#8a8496', '#24222e', '#5e5a6c'], vote: ['#5a5468', '#1a1822', '#3a3646'], trial: ['#1c1a26', '#07070b', '#0e0d14'], night: ['#1e2850', '#04060d', '#070a16'], morning: ['#7a7488', '#1c1a24', '#4a4658'], result: ['#5a5468', '#1a1822', '#3a3646'], award: ['#1c1a26', '#07070b', '#0e0d14'] }
  };

  // ---------- 사람 8명 ----------
  B.PEOPLE = [
    { fig: 0, name: '지호', outfit: 'coat', color: '#7a8fb8' }, { fig: 1, name: '민준', outfit: 'police', color: '#6fa59a' },
    { fig: 2, name: '서연', outfit: 'doctor', color: '#b89a6f' }, { fig: 3, name: '도윤', outfit: 'noir', color: '#b87a5c' },
    { fig: 4, name: '하은', outfit: 'detective', color: '#a9aebb' }, { fig: 0, name: '태오', outfit: 'reporter', color: '#8f86b0' },
    { fig: 2, name: '수아', outfit: 'hood', color: '#7f9f7a' }, { fig: 1, name: '현우', outfit: 'elder', color: '#a88f9a' }
  ];
  // 지목 예시: i 번이 VOTES[i] 번을 가리킨다. 3번 도윤이 5표로 최후 변론에 선다. 밤에는 3·6번이 마피아
  B.VOTES = [3, 3, 5, 0, 3, 3, 3, 5];
  B.ACCUSED = 3;
  B.MAFIA = [3, 6];

  // ---------- 무대 ----------
  B.createStage = function (canvas, conceptId, opt) {
    opt = opt || {};
    var concept = B.CONCEPTS[conceptId], W = opt.width, H = opt.height, K = MFChar.SCALE;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    var scene = new THREE.Scene();
    scene.background = new THREE.Color('#060914');
    scene.fog = new THREE.Fog('#060914', 20, 44);
    var hemi = new THREE.HemisphereLight('#25375f', '#0a0e1c', 0.4); scene.add(hemi);
    var moon = new THREE.DirectionalLight('#c9d4ff', 0.4);
    moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0015;
    var sc = moon.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 60;
    scene.add(moon); scene.add(moon.target);
    var spot = new THREE.SpotLight('#ffe6c4', 0, 14, 0.3, 0.5, 1.3); scene.add(spot); scene.add(spot.target);
    var cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.15, 6.5, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe6c4', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    scene.add(cone);
    var accent = new THREE.PointLight('#c8102e', 0, 9, 2); scene.add(accent);
    // 지목 긴장 연출: 선두 위에 모이는 빛
    var focus = new THREE.PointLight('#ffe0b0', 0, 4.5, 2); scene.add(focus);
    // 시민 밤 화면: 나만 겨우 보이게 감싸는 빛
    var selfLight = new THREE.PointLight('#9fb3e0', 0, 3.2, 2); scene.add(selfLight);

    var root = new THREE.Group(); scene.add(root);
    var ctx = { root: root, em: [], lamps: [], glows: [], tick: [], K: K, kit: B.kit, votes: B.VOTES, accused: B.ACCUSED };
    concept.build(ctx, root);

    // 카메라: 아이소(약 36° 위). 아래 고르기 판에 가리는 만큼 그림을 위로 올린다
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120), view = opt.view || ctx.view || 14, yaw = ctx.yaw === undefined ? Math.PI / 4 : ctx.yaw;
    var t0 = ctx.target || { x: 0, z: 0 };
    camera.left = -view * W / H / 2; camera.right = view * W / H / 2; camera.top = view / 2; camera.bottom = -view / 2;
    camera.position.set(t0.x + Math.sin(yaw) * 17, 12.5, t0.z + Math.cos(yaw) * 17); camera.lookAt(t0.x, 0.6, t0.z);
    camera.setViewOffset(W, H, 0, opt.offsetY || 0, W, H);
    camera.updateProjectionMatrix();
    moon.position.set(t0.x - 5, 12, t0.z + 7); moon.target.position.set(t0.x, 0, t0.z);

    // 사람
    var people = B.PEOPLE.map(function (p, i) {
      var c = MFChar.create(MFChar.FIGS[p.fig], { scale: K, outfit: p.outfit });
      c.i = i; c.name = p.name; c.color = p.color; c.nextEmote = 1 + i * 0.7; root.add(c.root); return c;
    });

    var st = { renderer: renderer, scene: scene, camera: camera, people: people, ctx: ctx, phase: null, W: W, H: H };
    var camYaw = yaw, scr = new THREE.Vector3();
    function face(c, x, z) { c.yaw = Math.atan2(x - c.pos.x, z - c.pos.z); }
    function place(c, m) { c.pos.x = m.x; c.pos.z = m.z; c.y = m.y || 0; c.sit = m.sit; c.yaw = m.yaw === undefined ? camYaw : m.yaw; }

    st.setPhase = function (ph, opt) {
      opt = opt || {};
      st.phase = ph; st.view = opt.view || null; st.selfIdx = opt.view === 'citizen' ? opt.me : -1; selfLight.intensity = st.selfIdx >= 0 ? 1.4 : 0;
      var P = Object.assign({}, PHASE[ph], (ctx.env && ctx.env[ph]) || {});
      if (ph === 'night' && opt.view === 'citizen') P = Object.assign({}, P, { grp: { room: 0, vote: 0, trial: 0, night: 0.15 }, hemi: 0.05, moon: 0.08, accent: 0, exp: 0.75 });
      if (ph === 'night' && opt.view === 'ghost') P = Object.assign({}, P, { accent: 0.4 });
      var sky = SKY[ctx.outdoor ? 'outdoor' : 'indoor'][ph];
      hemi.color.set(sky[0]); hemi.groundColor.set(sky[1]); hemi.intensity = P.hemi;
      scene.background.set(sky[2]); scene.fog.color.set(sky[2]);
      moon.intensity = P.moon; moon.color.set(ph === 'talk' && ctx.outdoor ? '#d6d2dc' : '#c9d4ff');
      renderer.toneMappingExposure = P.exp;
      ctx.em.forEach(function (e) { e.m.emissiveIntensity = e.k * (P.grp[e.grp] || 0); });
      ctx.lamps.forEach(function (l) { l.base = l.k * (P.grp[l.grp] || 0); l.l.intensity = l.base; });
      st.tension = { level: 0, who: -1, k: 0, dim: 1, zoom: 1 };
      ctx.glows.forEach(function (g) { g.s.material.opacity = g.k * (P.grp[g.grp] || 0); });
      st.spotK = P.spot; accent.intensity = (ctx.accentK || 0.7) * P.accent;
      var cen = ctx.center; accent.position.set(cen.x, 2.4, cen.z);
      // 자리
      people.forEach(function (c, i) {
        c.root.visible = true; c.emote = null; c.voted = false; c.walk = null; if (c.ghost) st.setGhost(i, false); if (c.dim) st.setDim(i, false);
        if (ph === 'talk') place(c, ctx.talk[i]);
        else if (ph === 'result' || ph === 'award') {
          // 판 끝: 무대 둘레에 서서 카메라를 본다
          // 시상식은 둘레를 넓혀 앞사람이 무대를 가리지 않게 한다
          var spread = ph === 'award' ? 1.45 : 1;
          place(c, { x: cen.x + (ctx.marks[i].x - cen.x) * spread, z: cen.z + (ctx.marks[i].z - cen.z) * spread, yaw: camYaw });
        } else if (ph === 'night' || ph === 'morning') {
          // 밤에는 각자 토론이 끝난 자리로 돌아간다. 시민 화면에는 나만 보인다
          place(c, ctx.talk[i]);
          if (ph === 'night' && opt.view === 'citizen') c.root.visible = i === opt.me;
        } else {
          place(c, ctx.marks[i]);
          face(c, cen.x, cen.z);
          if (ctx.marks[i].sit) c.yaw = ctx.marks[i].yaw;
          if (ph === 'trial' && i === B.ACCUSED) { place(c, { x: cen.x, z: cen.z, y: cen.y, yaw: camYaw }); }
        }
      });
      var spotPos = ph === 'trial' ? cen : cen;
      spot.position.set(spotPos.x + 0.3, (spotPos.y || 0) + 6.4, spotPos.z + 0.3); spot.target.position.set(spotPos.x, spotPos.y || 0, spotPos.z); spot.target.updateMatrixWorld();
      cone.position.set(spotPos.x + 0.15, (spotPos.y || 0) + 3.25, spotPos.z + 0.15);
      if (ctx.onPhase) ctx.onPhase(ph);
      renderer.shadowMap.needsUpdate = true;
    };

    var t = 0;
    // level 0 없음 · 1 선두(빛이 모이고 당황) · 2 과반(실내등을 낮추고 카메라가 다가감)
    st.setTension = function (level, who) { st.tension.level = level; st.tension.who = who; };
    st.frame = function (dt) {
      t += dt;
      ctx.tick.forEach(function (f) { f(dt, t, st.phase); });
      var T = st.tension, kk = Math.min(1, dt * 3);
      if (T) {
        T.k += ((T.level === 0 ? 0 : T.level === 1 ? 0.9 : 1.7) - T.k) * kk;
        T.dim += ((T.level === 2 ? 0.5 : 1) - T.dim) * kk;
        T.zoom += ((T.level === 2 ? 1.08 : 1) - T.zoom) * kk;
        if (T.who >= 0) { var lc = people[T.who]; focus.position.set(lc.pos.x, (lc.y || 0) + 2.6, lc.pos.z); }
        focus.intensity = T.k;
        ctx.lamps.forEach(function (l) { if (l.grp === 'room' || l.grp === 'vote') l.l.intensity = l.base * T.dim; });
        if (Math.abs(camera.zoom - T.zoom) > 0.0005) { camera.zoom = T.zoom; camera.updateProjectionMatrix(); }
      }
      if (st.selfIdx >= 0) { var sc0 = people[st.selfIdx]; selfLight.position.set(sc0.pos.x + 0.3, 1.6, sc0.pos.z + 0.6); }
      spot.intensity = 3.4 * (st.spotK || 0); spot.visible = !!st.spotK;
      cone.material.opacity = 0.06 * (st.spotK || 0); cone.visible = !!st.spotK;
      people.forEach(function (c, i) {
        if (!c.root.visible) return;
        // 단계마다 가끔 하는 동작
        if (t > c.nextEmote && !c.emote) {
          var ph = st.phase, id = null;
          if (ph === 'talk') id = ['clap', 'deny', 'praise', 'handshake', 'point'][(i + Math.floor(t)) % 5];
          else if (ph === 'vote') id = c.voted ? 'point' : null;
          else if (ph === 'trial' && i === B.ACCUSED) id = ['deny', 'cry'][Math.floor(t / 4) % 2];
          else if (ph === 'result') id = (st.winners || []).indexOf(i) >= 0 ? ['dance', 'clap', 'praise'][(i + Math.floor(t)) % 3] : null;
          else if (ph === 'award') id = i === st.awardee ? (c.walk ? null : 'praise') : 'clap';
          if (id && !(c.sit && id !== 'point' && id !== 'clap')) MFChar.playEmote(c, id);
          c.nextEmote = t + 2.6 + ((i * 37) % 10) / 6;
        }
        var moving = false;
        if (c.walk) {
          var wx = c.walk.x - c.pos.x, wz = c.walk.z - c.pos.z, wd = Math.sqrt(wx * wx + wz * wz);
          if (wd < 0.05) { if (c.walk.faceCam) c.yaw = camYaw; c.walk = null; }
          else { var stp = Math.min(wd, (c.walk.speed || 1.5) * K * dt); c.pos.x += wx / wd * stp; c.pos.z += wz / wd * stp; c.yaw = Math.atan2(wx, wz); moving = true; }
        }
        var pose = MFChar.animate(c, dt, t, moving);
        if (c.sit) { c.legA.rotation.x = -1.45; c.legB.rotation.x = -1.45; }
        if (st.tension && st.tension.level > 0 && st.tension.who === i && !c.emote) MFChar.setFace(c, 'surprise');
        c.root.position.set(c.pos.x, (c.sit ? c.sit - 0.23 : (c.y || 0)) + (c.ghost ? 0.35 + Math.sin(t * 2) * 0.08 : 0), c.pos.z);
        c.root.rotation.y = c.yaw;
        var top = (c.sit ? c.sit - 0.23 : (c.y || 0)) + (2.45 + pose.y) * K;
        scr.set(c.pos.x, top, c.pos.z).project(camera);
        c.sx = (scr.x + 1) / 2 * W; c.sy = (1 - scr.y) / 2 * H;
      });
      renderer.render(scene, camera);
    };
    // i 번이 지목한다: 지목한 사람을 보고 손가락으로 가리킨다(앉은 자리는 몸을 돌리지 않는다)
    st.castVote = function (i) {
      var c = people[i], t = ctx.marks[B.VOTES[i]];
      if (!ctx.marks[i].sit) face(c, t.x, t.z);
      c.voted = true; MFChar.playEmote(c, 'point'); c.nextEmote = t + 3;
    };
    st.emote = function (i, id) { MFChar.playEmote(people[i], id); };
    // i 번이 t 번을 가리킨다(지목을 바꿀 때도 쓴다)
    st.pointAt = function (i, tIdx) {
      var c = people[i], m = ctx.marks[tIdx];
      if (!ctx.marks[i].sit) face(c, m.x, m.z);
      c.voted = true; MFChar.playEmote(c, 'point'); c.nextEmote = t + 3;
    };
    // i 번을 가운데 변론 자리에 세운다(찬반 등)
    st.toCenter = function (i) { place(people[i], { x: ctx.center.x, z: ctx.center.z, y: ctx.center.y, yaw: camYaw }); };
    // 처형된 사람: 반투명 유령으로 떠오른다
    st.setGhost = function (i, on) {
      var c = people[i];
      c.ghost = on;
      c.root.traverse(function (o) {
        if (!o.material) return;
        if (on) { o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; }
        else { o.material.opacity = 1; o.material.transparent = false; o.material.depthWrite = true; }
        o.material.needsUpdate = true;
      });
    };
    // 걸어가기(직선). 다 오면 멈춘다
    st.walkTo = function (i, x, z, faceCam, speed) { people[i].walk = { x: x, z: z, faceCam: !!faceCam, speed: speed }; people[i].emote = null; };
    // 진 팀: 색을 낮춰 어둡게 남긴다
    st.setDim = function (i, on) {
      var c = people[i]; c.dim = on;
      c.root.traverse(function (o) {
        if (!o.material || !o.material.color) return;
        if (!o.userData.c0) o.userData.c0 = o.material.color.clone();
        o.material.color.copy(o.userData.c0); if (on) o.material.color.multiplyScalar(0.45);
      });
    };
    // 발밑 고리(마피아 화면의 고른 사람 등)
    var rings = {};
    st.ring = function (key, i, color, on) {
      var r = rings[key];
      if (!r) { r = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 })); r.rotation.x = Math.PI / 2; root.add(r); rings[key] = r; }
      r.material.color.set(color); r.visible = !!on;
      if (on) { var c = people[i]; r.position.set(c.pos.x, (c.y || 0) + 0.04, c.pos.z); r.userData.who = i; }
    };
    ctx.tick.push(function (dt, tt) {
      Object.keys(rings).forEach(function (k) {
        var r = rings[k]; if (!r.visible) return;
        var c = people[r.userData.who]; r.position.x = c.pos.x; r.position.z = c.pos.z; r.scale.setScalar(1 + Math.sin(tt * 4) * 0.06);
      });
    });
    // 분필 윤곽: 쓰러진 자리에 그날 낮 동안 남는다
    var chalk = null;
    st.chalk = function (x, z, on) {
      if (!chalk) {
        var pts = [[0.12, 1.15], [0.35, 1.3], [0.3, 1.62], [0, 1.76], [-0.3, 1.62], [-0.35, 1.3], [-0.12, 1.15], [-0.7, 1.0], [-0.76, 0.88], [-0.2, 0.9], [-0.26, 0.35], [-0.56, -0.05],
          [-0.4, -0.13], [-0.05, 0.25], [0.05, 0.25], [0.4, -0.13], [0.56, -0.05], [0.26, 0.35], [0.2, 0.9], [0.76, 0.96], [0.72, 1.08]].map(function (p) { return new THREE.Vector3(p[0] * K, 0, -p[1] * K + 0.75 * K); });
        chalk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.2), 120, 0.022, 6, true), new THREE.MeshBasicMaterial({ color: '#e8e6dc', transparent: true, opacity: 0.85 }));
        chalk.rotation.y = 0.7; root.add(chalk);
      }
      chalk.visible = !!on; chalk.position.set(x, 0.015, z);
    };
    st.dispose = function () { renderer.dispose(); };
    return st;
  };
})();
