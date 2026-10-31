/* minifia v2.0 캐릭터 에셋 — three r128 (전역 THREE), 결정 0047·0048
 * 1번 시안(세트 C)의 구·원통 조립 인물 5명, 의상 9종, 표정 7, 동작 9.
 * 모자는 머리띠 높이에서 머리카락 둘레에 맞춰 머리를 덮고, 모자 안의 머리카락은 잘라 낸 벌로 바꾼다.
 * 원래 크기는 키 약 2.1 단위다. 맵(world.js) 위에서는 scale 0.83 으로 줄여 쓴다(키 약 1.7).
 * 캐릭터는 실시간 그림자를 만들지 않고 발밑 타원을 쓴다(결정 0047-3).
 */
(function () {
  'use strict';
  function mat(c, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.82, metalness: 0 }, opts || {})); }
  function mesh(geo, m) { var o = new THREE.Mesh(geo, m); o.castShadow = false; o.receiveShadow = true; return o; }

  // ---------- 인물 5명과 의상 9종 ----------
  var SKIN = '#f7c9a6';
  var FIGS = [
    { id: 'fig1', name: '지호', hair: '#6b4630', style: 'boy', hat: '', tie: '#7a8fb8' },
    { id: 'fig3', name: '민준', hair: '#d9b25c', style: 'boy', hat: '', tie: '#6fa59a' },
    { id: 'fig4', name: '서연', hair: '#6b4630', style: 'girl', hat: '', tie: '#b89a6f' },
    { id: 'fig7', name: '도윤', hair: '#2b2118', style: 'boy', hat: 'fedoraDark', tie: '#b87a5c' },
    { id: 'fig8', name: '하은', hair: '#5a3a26', style: 'girl', hat: 'fedoraTan', tie: '#a9aebb' }
  ];
  var OUTFITS = {
    coat: { label: '기본 코트', coat: '#4a5163', shirt: '#eef0f4', tie: null, pants: '#2b2f38', shoe: '#1f2229', hat: null, badge: '', prop: '' },
    police: { label: '경찰', coat: '#2a4372', shirt: '#c9d3ea', tie: '#16213d', pants: '#1e2847', shoe: '#16181e', hat: 'police', badge: 'star', prop: '' },
    doctor: { label: '의사', coat: '#e9ecf2', shirt: '#2FA4A0', tie: '', pants: '#6b7180', shoe: '#3a3f4b', hat: '', badge: 'cross', prop: '' },
    detective: { label: '탐정', coat: '#8a6a45', shirt: '#eef0f4', tie: '#4a3a28', pants: '#3a3f4b', shoe: '#2b2118', hat: 'deer', badge: '', prop: 'mag' },
    noir: { label: '누아르 정장', coat: '#1a1d24', shirt: '#a9aebb', tie: '#3a3f4b', pants: '#16181e', shoe: '#0a0e1c', hat: 'fedoraDark', badge: '', prop: '' },
    mafia: { label: '마피아', coat: '#1a1d24', shirt: '#3a3f4b', tie: '#8e0b21', pants: '#16181e', shoe: '#0a0e1c', hat: 'fedoraMafia', badge: '', prop: '', acc: 'shades' },
    reporter: { label: '기자', coat: '#6f8fa8', shirt: '#eef0f4', tie: '', pants: '#3a3f4b', shoe: '#2b2118', hat: 'news', badge: 'press', prop: 'cam' },
    elder: { label: '어르신', coat: '#6b5a48', shirt: '#e6e8ee', tie: '', pants: '#3a3f4b', shoe: '#2b2118', hat: '', badge: '', prop: 'cane', hair: '#d8dbe3', acc: 'beard' },
    hood: { label: '후드', coat: '#5a5f6c', shirt: '#3a3f4b', tie: '', pants: '#3a3f4b', shoe: '#2b2118', hat: 'hood', badge: '', prop: '', glove: '#7a5236' }
  };

  var EYE = '#2b2118', MOUTH = '#7a3b2e';
  function faceSphere(r, color, sx, sy, sz) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 }));
    m.scale.set(sx || 1, sy || 1, sz || 1); return m;
  }
  function faceBox(w, h, color) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 })); }
  function arc(r, tube, color, full) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 20, full ? Math.PI * 2 : Math.PI), new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 })); }
  // 머리 구 표면에 붙이고 바깥을 보게 한다. 돌리기는 붙인 뒤 local z 축으로
  function onHead(obj, x, y, R, out, rz) {
    var z = Math.sqrt(Math.max(0, R * R - x * x - y * y)) + (out === undefined ? 0.005 : out);
    var holder = new THREE.Group(); holder.position.set(x, y, z); holder.lookAt(x * 2, y * 2, z * 2 + 0.0001);
    obj.rotation.z = rz || 0; holder.add(obj); return holder;
  }

  // browR: 앞머리 바깥 반지름. 눈썹은 앞머리에 묻히지 않게 그 위에 붙인다
  function buildFaces(head, R, browR) {
    var faces = {};
    function grp(name) { var g = new THREE.Group(); head.add(g); faces[name] = g; g.visible = false; return g; }
    var ex = 0.21, ey = 0.02;
    var g = grp('base');
    [-ex, ex].forEach(function (x) { g.add(onHead(faceSphere(0.058, EYE, 1, 1.25, 0.5), x, ey, R)); });
    g.add(onHead(arc(0.075, 0.018, MOUTH), 0, -0.16, R, 0.005, Math.PI));
    g = grp('happy');
    [-ex, ex].forEach(function (x) { g.add(onHead(arc(0.055, 0.017, EYE), x, ey - 0.02, R)); });
    g.add(onHead(faceSphere(0.085, MOUTH, 1, 0.75, 0.3), 0, -0.17, R));
    g = grp('angry');
    [-ex, ex].forEach(function (x) { g.add(onHead(faceSphere(0.052, EYE, 1, 1.1, 0.5), x, ey, R)); });
    [-1, 1].forEach(function (s) { g.add(onHead(faceBox(0.15, 0.03, EYE), s * ex, 0.13, browR, 0.006, s * 0.45)); });
    g.add(onHead(faceBox(0.13, 0.026, MOUTH), 0, -0.18, R));
    g = grp('cry');
    [-ex, ex].forEach(function (x) { g.add(onHead(arc(0.055, 0.017, EYE), x, ey + 0.01, R, 0.005, Math.PI)); });
    [-ex, ex].forEach(function (x) { g.add(onHead(faceSphere(0.04, '#9ec2ff', 1, 1.9, 0.6), x + (x > 0 ? 0.02 : -0.02), -0.11, R, 0.02)); });
    g.add(onHead(faceSphere(0.06, MOUTH, 1.2, 0.8, 0.3), 0, -0.19, R));
    g = grp('surprise');
    [-ex, ex].forEach(function (x) { g.add(onHead(faceSphere(0.075, EYE, 1, 1.15, 0.5), x, ey + 0.01, R)); g.add(onHead(faceSphere(0.022, '#ffffff'), x + 0.025, ey + 0.045, R, 0.03)); });
    g.add(onHead(arc(0.05, 0.02, MOUTH, true), 0, -0.19, R));
    g = grp('sus');
    [-ex, ex].forEach(function (x) { g.add(onHead(faceBox(0.12, 0.034, EYE), x, ey, R)); });
    g.add(onHead(faceBox(0.15, 0.03, EYE), ex, 0.14, browR, 0.006, 0.25));
    g.add(onHead(arc(0.06, 0.017, MOUTH), 0.05, -0.17, R, 0.005, Math.PI + 0.45));
    g = grp('dead');
    [-ex, ex].forEach(function (x) { [0.78, -0.78].forEach(function (r) { g.add(onHead(faceBox(0.13, 0.028, EYE), x, ey, R, 0.005, r)); }); });
    g.add(onHead(faceBox(0.1, 0.024, MOUTH), 0, -0.18, R));
    head.add(onHead(faceSphere(0.05, '#ef9a7c', 1, 1, 0.8), 0, -0.065, R, 0.01));
    [-0.31, 0.31].forEach(function (x) { head.add(onHead(faceSphere(0.085, '#f2988a', 1.35, 0.8, 0.25), x, -0.11, R, 0)); });
    return faces;
  }

  // 모자는 머리띠 높이 HAT_Y 에 얹는다. F 는 그 높이의 머리카락 바깥 둘레라 모자가 머리에 끼거나 떠 보이지 않는다.
  // 챙은 아이소 카메라(약 36° 위)에서 눈을 가리지 않을 만큼만 내민다
  var HAT_Y = 0.26;
  // 챙: 안쪽 반지름 rIn, 바깥은 각도 a(0 이 앞)마다 outR(a), bend(a, d) 는 안쪽에서 d 만큼 나간 곳의 높이 변화. 위·아래 면과 테두리를 한 메시로
  function brimGeo(rIn, outR, a0, a1, thick, bend) {
    var AS = 48, RS = 4, W = RS + 1, pos = [], idx = [], i, j;
    function sheet(off) {
      for (i = 0; i <= AS; i++) {
        var a = a0 + (a1 - a0) * i / AS, ro = outR(a);
        for (j = 0; j <= RS; j++) { var r = rIn + (ro - rIn) * j / RS; pos.push(Math.sin(a) * r, off + bend(a, r - rIn), Math.cos(a) * r); }
      }
    }
    sheet(0); var B = pos.length / 3; sheet(-thick);
    for (i = 0; i < AS; i++) {
      for (j = 0; j < RS; j++) { var k = i * W + j; idx.push(k, k + 1, k + W, k + 1, k + W + 1, k + W, B + k, B + k + W, B + k + 1, B + k + 1, B + k + W, B + k + W + 1); }
      var o = i * W + RS, n = i * W;
      idx.push(o, B + o, o + W, o + W, B + o, B + o + W, n, n + W, B + n, n + W, B + n + W, B + n);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // 앞(또는 뒤)으로 내민 챙의 바깥 둘레: 가운데가 len 만큼 길고 양 끝(±half)에서 0
  function visorR(F, len, half) { return function (a) { var k = Math.min(1, Math.abs(a) / half); return F + len * Math.pow(Math.cos(k * Math.PI / 2), 0.6); }; }

  function buildHats(head, F) {
    var hats = {};
    function grp(n) { var g = new THREE.Group(); g.visible = false; head.add(g); hats[n] = g; return g; }
    function add(g, geo, m, x, y, z) { var o = mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); g.add(o); return o; }
    function dome(r, k) { var d = new THREE.SphereGeometry(r, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, k, 1); return d; }
    var metal = { metalness: 0.3, roughness: 0.4 };
    // 챙 모자(페도라·밀짚): 위로 살짝 좁아지는 몸통, 둥근 윗면, 띠, 뒤가 말려 올라간 챙
    function brimmed(n, o) {
      var g = grp(n), H = o.h, top = F - o.taper;
      add(g, new THREE.CylinderGeometry(top, F + 0.005, H, 32), mat(o.crown), 0, HAT_Y + H / 2);
      add(g, dome(top, o.dome), mat(o.crown), 0, HAT_Y + H);
      if (o.crease) { var cr = add(g, new THREE.SphereGeometry(0.2, 16, 8), mat(o.crease), 0, HAT_Y + H + top * o.dome - 0.035); cr.scale.set(0.42, 0.28, 1.45); }
      add(g, new THREE.CylinderGeometry(F + 0.014, F + 0.018, 0.09, 32), mat(o.band), 0, HAT_Y + 0.07);
      add(g, brimGeo(F - 0.03, function () { return F + o.brim; }, -Math.PI, Math.PI, 0.035, function (a, d) {
        var c = Math.cos(a); return d * (c > 0 ? o.lift : o.lift - o.flip * c) + d * d * o.curl;
      }), mat(o.crown, { side: THREE.DoubleSide }), 0, HAT_Y + 0.03);
    }
    brimmed('fedoraDark', { crown: '#3d4357', band: '#22252e', crease: '#30354a', h: 0.33, taper: 0.07, dome: 0.26, brim: 0.27, lift: 0.02, flip: 0.3, curl: 0.4 });
    brimmed('fedoraTan', { crown: '#a98559', band: '#5a3a26', crease: '#8f7048', h: 0.33, taper: 0.07, dome: 0.26, brim: 0.27, lift: 0.02, flip: 0.3, curl: 0.4 });
    brimmed('fedoraMafia', { crown: '#1a1d24', band: '#8e0b21', crease: '#14161c', h: 0.33, taper: 0.07, dome: 0.26, brim: 0.27, lift: 0.02, flip: 0.3, curl: 0.4 });

    // 경찰 모자: 검은 띠, 위로 퍼지는 윗판(앞이 살짝 들림), 은빛 휘장·턱끈, 반짝이는 검은 챙
    var g = grp('police');
    add(g, new THREE.CylinderGeometry(F + 0.012, F + 0.012, 0.14, 32), mat('#16213d'), 0, HAT_Y + 0.07);
    add(g, new THREE.CylinderGeometry(F + 0.022, F + 0.022, 0.026, 32), mat('#c9d3ea', metal), 0, HAT_Y + 0.03);
    var crown = new THREE.Group(); crown.position.y = HAT_Y + 0.13; crown.rotation.x = -0.1; g.add(crown);
    add(crown, new THREE.CylinderGeometry(F + 0.1, F + 0.008, 0.17, 32), mat('#2a4372'), 0, 0.085);
    add(crown, dome(F + 0.1, 0.16), mat('#2a4372'), 0, 0.17);
    var emb = add(crown, new THREE.SphereGeometry(0.075, 14, 10), mat('#c9d3ea', metal), 0, 0.075, F + 0.05); emb.scale.z = 0.35;
    add(g, brimGeo(F - 0.03, visorR(F, 0.22, 1.2), -1.2, 1.2, 0.03, function (a, d) { return -d * 0.3; }),
      mat('#121a30', { roughness: 0.3, side: THREE.DoubleSide }), 0, HAT_Y + 0.012);

    // 탐정 모자(디어스토커): 머리를 감싸는 둥근 몸통, 앞뒤 짧은 챙, 위로 묶어 올린 귀덮개와 매듭
    g = grp('deer');
    var Rd = Math.sqrt(F * F + HAT_Y * HAT_Y);
    add(g, new THREE.SphereGeometry(Rd, 32, 14, 0, Math.PI * 2, 0, Math.acos(HAT_Y / Rd)), mat('#8a6a45'));
    [0, Math.PI].forEach(function (rot) {
      var v = add(g, brimGeo(F - 0.03, visorR(F, 0.17, 1.15), -1.15, 1.15, 0.03, function (a, d) { return -d * 0.4; }),
        mat('#6b5236', { side: THREE.DoubleSide }), 0, HAT_Y + 0.012);
      v.rotation.y = rot;
    });
    // 귀덮개는 몸통 옆면에 납작하게 붙인다(얇은 축을 면의 바깥 방향으로)
    var fa = Math.acos((HAT_Y + 0.1) / Rd);
    [-1, 1].forEach(function (s) {
      var flap = add(g, new THREE.SphereGeometry(0.2, 16, 10), mat('#7d6040'), s * (Rd + 0.012) * Math.sin(fa), (Rd + 0.012) * Math.cos(fa), 0);
      flap.scale.set(0.16, 0.7, 0.9); flap.rotation.z = s * (Math.PI / 2 - fa);
    });
    add(g, new THREE.SphereGeometry(0.045, 10, 8), mat('#4a3a28'), 0, Rd + 0.01, 0);
    [-1, 1].forEach(function (s) {
      var loop = add(g, new THREE.TorusGeometry(0.05, 0.016, 6, 14), mat('#4a3a28'), s * 0.07, Rd - 0.005, 0);
      loop.scale.y = 0.7;
    });

    // 기자 모자(뉴스보이): 띠 위에 앞으로 쏠려 부푼 윗면, 꼭지 단추, 짧은 앞 챙
    g = grp('news');
    add(g, new THREE.CylinderGeometry(F + 0.008, F + 0.008, 0.1, 32), mat('#3a3f4b'), 0, HAT_Y + 0.05);
    var puff = new THREE.Group(); puff.position.set(0, HAT_Y + 0.1, 0.04); g.add(puff);
    add(puff, dome(F + 0.07, 0.62), mat('#4a4f5c'));
    var rim = add(puff, new THREE.TorusGeometry(F + 0.035, 0.045, 8, 40), mat('#4a4f5c')); rim.rotation.x = Math.PI / 2;
    add(puff, new THREE.SphereGeometry(0.05, 10, 8), mat('#3a3f4b'), 0, (F + 0.07) * 0.62, 0);
    add(g, brimGeo(F - 0.03, visorR(F, 0.18, 1.15), -1.15, 1.15, 0.03, function (a, d) { return -d * 0.3; }),
      mat('#3a3f4b', { side: THREE.DoubleSide }), 0, HAT_Y + 0.02);

    // 후드: 머리카락보다 큰 두건. 앞은 이마부터 목까지 트고(가장자리 테), 아래는 어깨로 내려간다
    g = grp('hood');
    var Rh = F + 0.1, open = 1.0, tilt = 0.35;
    var hoodGeo = new THREE.SphereGeometry(Rh, 32, 20, 0, Math.PI * 2, open, Math.PI - open); hoodGeo.rotateX(Math.PI / 2 + tilt);
    add(g, hoodGeo, mat('#5a5f6c', { side: THREE.DoubleSide }));
    var rimH = add(g, new THREE.TorusGeometry(Rh * Math.sin(open), 0.045, 8, 40), mat('#4e5360'), 0, -Math.sin(tilt) * Rh * Math.cos(open), Math.cos(tilt) * Rh * Math.cos(open));
    rimH.rotation.x = tilt;
    return hats;
  }

  // 캐릭터 하나를 만든다. 장면에 넣기·이름표·이동은 쓰는 쪽이 맡는다
  function create(fig, opt) {
    opt = opt || {};
    var c = { fig: fig };
    var root = new THREE.Group(); root.scale.setScalar(opt.scale || 1); c.root = root;
    var body = new THREE.Group(); root.add(body); c.body = body;
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; root.add(shadow);
    c.m = { coat: mat('#4a5163'), shirt: mat('#eef0f4'), tie: mat(fig.tie), pants: mat('#2b2f38'), shoe: mat('#1f2229'), skin: mat(SKIN, { roughness: 0.7 }), hand: mat(SKIN, { roughness: 0.7 }), hair: mat(fig.hair, { roughness: 0.75 }) };
    function leg(x) {
      var g = new THREE.Group(); g.position.set(x, 0.38, 0); body.add(g);
      var l = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 12), c.m.pants); l.position.y = -0.12; g.add(l);
      var s = mesh(new THREE.SphereGeometry(0.13, 14, 10), c.m.shoe); s.scale.set(0.9, 0.55, 1.3); s.position.set(0, -0.25, 0.05); g.add(s);
      return g;
    }
    c.legA = leg(0.13); c.legB = leg(-0.13);
    var torso = mesh(new THREE.CylinderGeometry(0.29, 0.39, 0.6, 24), c.m.coat); torso.position.y = 0.66; body.add(torso);
    var hem = mesh(new THREE.SphereGeometry(0.39, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.18), c.m.coat); hem.position.y = 0.38; body.add(hem);
    var shoulder = mesh(new THREE.SphereGeometry(0.3, 24, 14), c.m.coat); shoulder.scale.set(1.18, 0.55, 1); shoulder.position.y = 0.94; body.add(shoulder);
    var shirt = mesh(new THREE.ConeGeometry(0.12, 0.3, 3), c.m.shirt); shirt.rotation.x = Math.PI; shirt.scale.set(1, 1, 0.25); shirt.position.set(0, 0.88, 0.27); body.add(shirt);
    c.tie = mesh(new THREE.BoxGeometry(0.06, 0.24, 0.025), c.m.tie); c.tie.position.set(0, 0.8, 0.305); c.tie.rotation.x = -0.18; body.add(c.tie);
    [-1, 1].forEach(function (s) { var lap = mesh(new THREE.BoxGeometry(0.1, 0.32, 0.03), c.m.coat); lap.position.set(s * 0.085, 0.88, 0.29); lap.rotation.set(-0.15, 0, s * 0.42); body.add(lap); });
    [0.68, 0.55].forEach(function (y) { var b = mesh(new THREE.SphereGeometry(0.025, 8, 6), mat('#22252e')); b.position.set(0.07, y, 0.33); body.add(b); });
    c.badges = {};
    var star = mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#c9d3ea', { metalness: 0.3, roughness: 0.4 })); star.scale.z = 0.4; star.position.set(0.17, 0.8, 0.29); body.add(star); c.badges.star = star;
    var cross = new THREE.Group(); cross.position.set(0.17, 0.8, 0.3); body.add(cross);
    cross.add(mesh(new THREE.BoxGeometry(0.03, 0.1, 0.02), mat('#2FA4A0'))); cross.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), mat('#2FA4A0'))); c.badges.cross = cross;
    var press = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.02), mat('#f1f2f5')); press.position.set(0.16, 0.78, 0.3); body.add(press); c.badges.press = press;
    var R = 0.56;
    var neck = new THREE.Group(); neck.position.y = 1.0; body.add(neck); c.head = neck;
    var head = new THREE.Group(); head.position.y = 0.48; neck.add(head);
    var skull = mesh(new THREE.SphereGeometry(R, 32, 24), c.m.skin); skull.scale.set(1.04, 0.96, 0.98); head.add(skull);
    var girl = fig.style === 'girl';
    // 단발은 귀를 덮는다. 귀를 그리면 머리카락을 뚫고 나온다
    c.ears = [];
    if (!girl) [-1, 1].forEach(function (s) { var ear = mesh(new THREE.SphereGeometry(0.15, 14, 10), c.m.skin); ear.scale.set(0.6, 1, 0.8); ear.position.set(s * (R + 0.02), 0, 0); head.add(ear); c.ears.push(ear); });
    // 머리카락 조각: r 반지름, sc 비율, phi·th 범위(phi = π/2 가 앞). top 은 정수리라 모자를 쓰면 통째로 감춘다
    var hair = girl ? [
      { r: R + 0.058, sc: [1.04, 1.02, 1], phi: [Math.PI / 2 - 1.1, 2.2], th: [0, Math.PI * 0.4], top: true },
      { r: R + 0.07, sc: [1.04, 1.02, 1], phi: [Math.PI / 2 - 1.05, 2.1], th: [Math.PI * 0.3, Math.PI * 0.16] },
      { r: R + 0.06, sc: [1.04, 1.02, 1], phi: [Math.PI / 2 + 1.05, Math.PI * 2 - 2.1], th: [0, Math.PI * 0.8] }
    ] : [
      { r: R + 0.035, sc: [1, 1, 1], phi: [0, Math.PI * 2], th: [0, Math.PI * 0.4], top: true },
      { r: R + 0.04, sc: [1, 1, 1], phi: [Math.PI / 2 - 1.15, 2.3], th: [Math.PI * 0.3, Math.PI * 0.16] },
      { r: R + 0.03, sc: [1, 1, 1], phi: [Math.PI / 2 + 1.2, Math.PI * 2 - 2.4], th: [0, Math.PI * 0.55] }
    ];
    function hairMesh(h, th0, th1) {
      var m = mesh(new THREE.SphereGeometry(h.r, 32, 16, h.phi[0], h.phi[1], th0, th1 - th0), c.m.hair);
      m.scale.set(h.sc[0], h.sc[1], h.sc[2]); head.add(m); return m;
    }
    // 모자를 쓰면 띠(HAT_Y)보다 조금 위(HAT_CUT)를 잘라 낸 머리카락으로 바꾼다. 모자 둘레(fit)는 그 높이의 머리카락 바깥에 맞춘다
    var HAT_CUT = HAT_Y + 0.03, fit = 1.04 * Math.sqrt(R * R - Math.pow(HAT_Y / 0.96, 2));
    c.hairParts = []; c.hatHair = [];
    hair.forEach(function (h) {
      c.hairParts.push(hairMesh(h, h.th[0], h.th[0] + h.th[1]));
      if (h.top) return;
      var cut = Math.max(h.th[0], Math.acos(Math.min(1, HAT_CUT / h.sc[1] / h.r)));
      c.hatHair.push(hairMesh(h, cut, h.th[0] + h.th[1]));
      fit = Math.max(fit, h.sc[0] * Math.sqrt(h.r * h.r - Math.pow(HAT_Y / h.sc[1], 2)));
    });
    c.faces = buildFaces(head, R * 0.98, hair[1].r + 0.006);
    c.hats = buildHats(head, fit + 0.012);
    c.acc = {};
    var FR = R * 0.98, shades = new THREE.Group(), beard = new THREE.Group();
    shades.visible = beard.visible = false; head.add(shades); head.add(beard); c.acc.shades = shades; c.acc.beard = beard;
    [-1, 1].forEach(function (s) {
      shades.add(onHead(faceSphere(0.11, '#14161c', 1.15, 0.7, 0.3), s * 0.21, 0.03, FR, 0.025));
      var a = new THREE.Vector3(s * 0.33, 0.05, Math.sqrt(FR * FR - 0.33 * 0.33 - 0.0025) + 0.02), b = new THREE.Vector3(s * (R + 0.01), 0.06, 0.04);
      var d = new THREE.Vector3().subVectors(b, a), arm = mesh(new THREE.CylinderGeometry(0.014, 0.014, d.length(), 6), mat('#14161c'));
      arm.position.copy(a).addScaledVector(d, 0.5); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); shades.add(arm);
    });
    shades.add(onHead(faceBox(0.14, 0.03, '#14161c'), 0, 0.06, FR, 0.03));
    beard.add(onHead(faceSphere(0.075, '#eef0f4', 1.9, 0.55, 0.5), 0, -0.118, FR, 0.012));
    beard.add(onHead(faceSphere(0.17, '#e6e8ee', 1.6, 1.0, 0.5), 0, -0.37, FR, -0.03));
    function arm(x) {
      var g = new THREE.Group(); g.position.set(x, 0.9, 0); body.add(g);
      var a = mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.4, 12), c.m.coat); a.position.y = -0.2; g.add(a);
      var h = mesh(new THREE.SphereGeometry(0.1, 14, 10), c.m.hand); h.position.y = -0.43; g.add(h);
      return g;
    }
    c.armA = arm(0.37); c.armB = arm(-0.37);
    c.props = {};
    var mag = new THREE.Group(); mag.position.set(0, -0.48, 0.08); c.armB.add(mag);
    var mh = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), mat('#4a3a28')); mh.position.y = -0.05; mag.add(mh);
    var mr = mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 20), mat('#6b5236')); mr.position.y = -0.22; mag.add(mr);
    var mg = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshStandardMaterial({ color: '#9ec2ff', transparent: true, opacity: 0.6 })); mg.position.y = -0.22; mag.add(mg);
    c.props.mag = mag;
    var cam = new THREE.Group(); cam.position.set(0, -0.5, 0.1); c.armB.add(cam);
    cam.add(mesh(new THREE.BoxGeometry(0.24, 0.15, 0.12), mat('#2b2f38')));
    var lens = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), mat('#6b7180')); lens.rotation.x = Math.PI / 2; lens.position.z = 0.08; cam.add(lens);
    c.props.cam = cam;
    var cane = new THREE.Group(); cane.position.set(0, -0.45, 0.04); c.armB.add(cane);
    var cs = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), mat('#7a5236')); cs.position.y = -0.2; cane.add(cs);
    var ck = mesh(new THREE.TorusGeometry(0.06, 0.022, 6, 12, Math.PI), mat('#7a5236')); ck.position.set(0.06, 0.05, 0); cane.add(ck);
    c.props.cane = cane;

    c.pos = { x: 0, z: 0 }; c.target = null; c.yaw = Math.PI / 4; c.walkPhase = 0; c.speed = 1.7;
    c.emote = null; c.lastFace = '';
    applyOutfit(c, opt.outfit || 'coat');
    return c;
  }

  function applyOutfit(c, id) {
    var o = OUTFITS[id]; c.outfit = id;
    c.m.coat.color.set(o.coat); c.m.shirt.color.set(o.shirt); c.m.pants.color.set(o.pants); c.m.shoe.color.set(o.shoe);
    c.m.hair.color.set(o.hair || c.fig.hair); c.m.hand.color.set(o.glove || SKIN);
    Object.keys(c.acc).forEach(function (k) { c.acc[k].visible = k === o.acc; });
    var tie = o.tie === null ? c.fig.tie : o.tie;
    c.tie.visible = !!tie; if (tie) c.m.tie.color.set(tie);
    var hat = o.hat === null ? c.fig.hat : o.hat;
    Object.keys(c.hats).forEach(function (k) { c.hats[k].visible = k === hat; });
    // 모자는 안에 든 머리카락을 잘라 낸 벌로 바꾼다. 후드는 머리카락 전체를 감싸서 그대로 둔다
    var cut = !!hat && hat !== 'hood';
    c.hairParts.forEach(function (m) { m.visible = !cut; });
    c.hatHair.forEach(function (m) { m.visible = cut; });
    c.ears.forEach(function (m) { m.visible = hat !== 'hood'; });
    Object.keys(c.badges).forEach(function (k) { c.badges[k].visible = k === o.badge; });
    Object.keys(c.props).forEach(function (k) { c.props[k].visible = k === o.prop; });
  }

  // ---------- 동작 키프레임 ----------
  // 라디안: aAx·aBx 앞으로 들기(-), aAz 왼팔 바깥(+), aBz 오른팔 바깥(-), fA·fB 어깨를 앞으로, lA·lB 다리, hx·hy·hz 머리, y 몸 높이, s 찌그러짐, ry 몸 비틀기
  // 팔이 짧아 손이 머리에 닿지 않는다. 손을 얼굴 쪽으로 올리는 동작은 머리 둘레 밖(턱 앞·볼 아래·머리 옆)에서 멈춘다
  var EMOTES = {
    throat: { label: '목 긋기', seg: 0.32, cycles: 1, hold: 0.5, frames: [
      { aBx: -0.4, aBz: -0.2, face: 'angry' }, { aBx: -1.87, aBz: -0.15, fB: 0.1, hz: 0.12, face: 'angry' },
      { aBx: -1.86, aBz: 0.78, fB: 0.1, hz: -0.15, face: 'sus' }, { aBx: -1.86, aBz: 0.78, fB: 0.1, hz: -0.15, face: 'sus' }] },
    deny: { label: '나 아니야', seg: 0.22, cycles: 3, hold: 0, frames: [
      { aAx: -1.5, aAz: -0.45, aBx: -1.5, aBz: 0.45, hy: 0.35, face: 'surprise' },
      { aAx: -1.5, aAz: 0.15, aBx: -1.5, aBz: -0.15, hy: -0.35, face: 'surprise' }] },
    clap: { label: '박수', seg: 0.16, cycles: 4, hold: 0, frames: [
      { aAx: -1.2, aAz: -0.2, aBx: -1.2, aBz: 0.2, face: 'happy' },
      { aAx: -1.25, aAz: -0.6, aBx: -1.25, aBz: 0.6, face: 'happy', y: 0.03 }] },
    cry: { label: '엉엉', seg: 0.22, cycles: 4, hold: 0, frames: [
      { aAx: -2.07, aAz: -0.34, aBx: -2.07, aBz: 0.34, fA: 0.15, fB: 0.15, face: 'cry', hx: 0.14 },
      { aAx: -1.98, aAz: -0.4, aBx: -1.98, aBz: 0.4, fA: 0.15, fB: 0.15, face: 'cry', hx: 0.2, y: -0.03, s: 0.96 }] },
    handshake: { label: '악수', seg: 0.18, cycles: 3, hold: 0.3, frames: [
      { aBx: -1.3, aBz: -0.15, face: 'happy', hz: -0.08 }, { aBx: -1.6, aBz: -0.15, face: 'happy', hz: -0.08 }] },
    point: { label: '손가락질', seg: 0.3, cycles: 1, hold: 1.1, frames: [
      { aBx: -0.6, aBz: -0.3, face: 'sus' }, { aBx: -1.55, aBz: -0.55, aAz: 0.55, aAx: 0.25, hy: -0.25, hz: 0.1, face: 'sus' }] },
    praise: { label: '최고', seg: 0.18, cycles: 3, hold: 0.2, frames: [
      { aBz: -2.3, face: 'happy', y: 0.06 }, { aBz: -2.1, face: 'happy', y: 0 }] },
    surprise: { label: '깜짝', seg: 0.22, cycles: 1, hold: 0.4, frames: [
      { aAz: 0.3, aBz: -0.3, s: 0.88, face: 'surprise' }, { aAz: 2.25, aBz: -2.25, y: 0.4, face: 'surprise' },
      { aAz: 2.15, aBz: -2.15, y: 0, face: 'surprise' }] },
    dance: { label: '춤', seg: 0.26, cycles: 4, hold: 0, frames: [
      { aAz: 2.35, aBz: -0.4, hz: 0.22, y: 0.07, ry: 0.45, lA: -0.3, face: 'happy' },
      { aAz: 0.4, aBz: -2.35, hz: -0.22, y: 0.07, ry: -0.45, lB: -0.3, face: 'happy' }] }
  };
  var KEYS = ['aAx', 'aAz', 'aBx', 'aBz', 'fA', 'fB', 'lA', 'lB', 'hx', 'hy', 'hz', 'y', 's', 'ry'];
  function idlePose(t, c) {
    return { aAx: 0, aAz: 0.12, aBx: 0, aBz: -0.12, fA: 0, fB: 0, lA: 0, lB: 0, hx: 0, hy: 0, hz: Math.sin(t * 0.7 + c.pos.x) * 0.03, y: Math.sin(t * 2 + c.fig.name.length) * 0.012, s: 1, ry: 0, face: 'base' };
  }
  function walkPose(c) {
    var sw = Math.sin(c.walkPhase);
    return { aAx: sw * 0.5, aAz: 0.12, aBx: -sw * 0.5, aBz: -0.12, fA: 0, fB: 0, lA: -sw * 0.6, lB: sw * 0.6, hx: 0.04, hy: 0, hz: 0, y: Math.abs(Math.cos(c.walkPhase)) * 0.06, s: 1, ry: 0, face: 'base' };
  }
  function emotePose(c, base) {
    var d = EMOTES[c.emote.id], n = d.frames.length, last = n * d.cycles - 1, total = n * d.seg * d.cycles;
    var t = Math.min(c.emote.t, total), idx = Math.min(Math.floor(t / d.seg), last), local = Math.min(1, (t - idx * d.seg) / d.seg);
    var fa = d.frames[idx % n], fb = idx >= last ? fa : d.frames[(idx + 1) % n];
    var k = local * local * (3 - 2 * local), out = {};
    KEYS.forEach(function (key) {
      var a = fa[key] === undefined ? base[key] : fa[key], b = fb[key] === undefined ? base[key] : fb[key];
      out[key] = a + (b - a) * k;
    });
    out.face = (k < 0.5 ? fa.face : fb.face) || 'base';
    return out;
  }
  function emoteDone(c) { var d = EMOTES[c.emote.id]; return c.emote.t > d.frames.length * d.seg * d.cycles + d.hold; }
  function setFace(c, f) {
    if (c.lastFace === f) return;
    Object.keys(c.faces).forEach(function (k) { c.faces[k].visible = k === f; });
    c.lastFace = f;
  }
  function applyPose(c, p) {
    c.armA.rotation.set(p.aAx, 0, p.aAz); c.armB.rotation.set(p.aBx, 0, p.aBz);
    c.armA.position.z = p.fA; c.armB.position.z = p.fB;
    c.legA.rotation.x = p.lA; c.legB.rotation.x = p.lB;
    c.head.rotation.set(p.hx, p.hy, p.hz);
    c.body.position.y = p.y;
    c.body.scale.set(1 + (1 - p.s) * 0.6, p.s, 1 + (1 - p.s) * 0.6);
    c.body.rotation.y = p.ry;
    setFace(c, p.face);
  }
  function playEmote(c, id) { c.emote = { id: id, t: 0 }; }
  // 한 프레임 움직인다. moving 이면 걷기, 아니면 숨쉬기 위에 동작을 얹는다. 돌려준 자세의 y 는 이름표 높이에 쓴다
  function animate(c, dt, t, moving) {
    if (moving) c.walkPhase += dt * 11;
    var base = moving ? walkPose(c) : idlePose(t, c), pose = base;
    if (c.emote && moving) c.emote = null;
    if (c.emote) {
      c.emote.t += dt;
      if (emoteDone(c)) c.emote = null; else pose = emotePose(c, base);
    }
    applyPose(c, pose);
    return pose;
  }


  window.MFChar = { FIGS: FIGS, OUTFITS: OUTFITS, EMOTES: EMOTES, SCALE: 0.83, create: create, applyOutfit: applyOutfit, playEmote: playEmote, animate: animate, setFace: setFace };
})();
