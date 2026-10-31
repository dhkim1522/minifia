/* ③ 시계탑 광장 — 가운데 두 단 연단, 둘레 놋쇠 표시 8개, 뒤에 시계탑(바늘 = 게임 시계). 야외라 낮은 흐린 낮빛 */
(function () {
  var k = MFB.kit, M = k.M, box = k.box, cyl = k.cyl, sph = k.sph;
  MFB.CONCEPTS.plaza = {
    label: '③ 시계탑 광장',
    text: {
      talk: '잔뜩 흐린 낮의 광장. 연단 둘레를 돌아다니며 이야기해요.',
      vote: '해가 지고 가로등이 켜져요. 모두 연단 둘레 놋쇠 표시에 서서 차례로 손가락으로 지목해요. 지목받은 사람 머리 위에 표 수가 쌓여요.',
      trial: '가로등이 꺼지고 시계탑 조명이 연단의 변론자만 비춰요. 시계 바늘이 남은 시간을 가리켜요.',
      night: '안개 낀 밤 광장. 가로등만 희미하게 남아요.'
    },
    build: function (ctx, root) {
      var E = function (c, kk, g) { return k.E(ctx, c, kk, g); };
      ctx.outdoor = true;
      // 가로등(room 무리)은 낮에는 끄고 저녁부터 켠다
      ctx.env = {
        talk: { grp: { room: 0, vote: 0, trial: 0, night: 0 }, hemi: 0.75, moon: 0.7, exp: 1.0 },
        vote: { grp: { room: 1, vote: 1, trial: 0, night: 0 }, hemi: 0.34, moon: 0.25 },
        trial: { grp: { room: 0.06, vote: 0.1, trial: 1, night: 0 } },
        night: { grp: { room: 0.7, vote: 0, trial: 0, night: 1 } }
      };
      // 바닥: 자갈 판과 둘레 길
      box(root, 40, 0.1, 40, M('#121a30'), 0, -0.06, 0, false);
      var cob = ['#1c2440', '#202a4a', '#192138'];
      for (var ix = 0; ix < 14; ix++) for (var iz = 0; iz < 14; iz++) box(root, 0.96, 0.08, 0.96, M(cob[(ix * 3 + iz * 5) % 3]), -6.5 + ix, 0.04, -6.5 + iz, false);
      // 연단: 아래 단 r1.4, 위 단 r1.05(높이 0.45)
      cyl(root, 1.4, 1.45, 0.18, 48, M('#b9b09a', { roughness: 0.5 }), 0, 0.17, 0);
      cyl(root, 1.05, 1.08, 0.2, 48, M('#e0d8c4', { roughness: 0.45 }), 0, 0.36, 0);
      // 서는 자리 8개: 놋쇠 표시
      ctx.marks = k.ring(8, 2.6, 0.08);
      var brass = M('#a98559', { metalness: 0.5, roughness: 0.35 });
      ctx.marks.forEach(function (m) { cyl(root, 0.36, 0.36, 0.02, 24, brass, m.x, 0.09, m.z, false); });
      // 시계탑(뒤 구석)
      // 시계가 폰 화면 안에 들어오게 탑을 낮고 굵게, 원판 가까이 둔다
      var tw = new THREE.Group(); tw.position.set(-4.3, 0, -4.3); root.add(tw);
      var stoneL = M('#3a3f55'), stoneD = M('#2a2f45'), cream = M('#b9b09a');
      box(tw, 2.6, 0.8, 2.6, stoneL, 0, 0.4, 0); box(tw, 2.0, 1.6, 2.0, stoneD, 0, 1.6, 0);
      box(tw, 2.4, 1.9, 2.4, stoneL, 0, 3.35, 0); box(tw, 2.6, 0.18, 2.6, cream, 0, 2.4, 0); box(tw, 2.6, 0.18, 2.6, cream, 0, 4.3, 0);
      var roof = add(new THREE.ConeGeometry(1.8, 1.4, 4), M('#151c36'), 0, 5.1, 0); roof.rotation.y = Math.PI / 4;
      function add(geo, m, x, y, z) { return k.add(tw, geo, m, x, y, z); }
      var hands = [];
      [[0, 1.21, 0], [1.21, 0, Math.PI / 2]].forEach(function (f) {
        var fg = new THREE.Group(); fg.position.set(f[0], 3.35, f[1]); fg.rotation.y = f[2]; tw.add(fg);
        var face = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40), E('#e8dfc6', 0.55, 'room')); fg.add(face);
        ctx.em.push({ m: face.material, k: 0.25, grp: 'trial' });
        var hh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.02), M('#14161c')); hh.geometry.translate(0, 0.17, 0); hh.position.z = 0.02; fg.add(hh);
        var mh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.58, 0.02), M('#14161c')); mh.geometry.translate(0, 0.26, 0); mh.position.z = 0.03; fg.add(mh);
        hands.push({ h: hh, m: mh });
      });
      // 시계탑 조명: 변론 때 연단을 비춘다
      var flood = sph(tw, 0.14, E('#ffe6c4', 2.0, 'trial'), 1.25, 4.5, 1.25, false); void flood;
      // 가로등 4개(바깥)
      // 사람 앞을 가리지 않게 화면 양옆과 뒤에만 둔다
      [[3.8, -2.4], [-2.4, 3.8], [-3.6, 1.0], [1.0, -3.6]].forEach(function (p) {
        cyl(root, 0.06, 0.08, 2.6, 8, M('#0b1024'), p[0], 1.3, p[1]);
        cyl(root, 0.16, 0.12, 0.3, 8, M('#0b1024'), p[0], 2.7, p[1]);
        sph(root, 0.13, E('#ffd59a', 1.5, 'room'), p[0], 2.6, p[1], false);
        k.glow(ctx, root, '#ffd59a', 1.4, p[0], 2.6, p[1], 0.7, 'room');
        k.lamp(ctx, root, '#ffcf8a', 1.0, 5, p[0], 2.4, p[1], 'room');
      });
      // 건물 앞면(뒤 두 가장자리)
      function facade(x, z, w, h, ry, body) {
        var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
        box(g, w, h, 1.2, M(body), 0, h / 2, 0);
        box(g, w + 0.1, 0.16, 1.3, M('#151c36'), 0, h, 0);
        for (var fx = 0; fx < Math.floor(w / 0.9); fx++) for (var fy = 0; fy < Math.floor((h - 1) / 1.1); fy++) {
          var lit = (fx * 7 + fy * 3 + Math.round(x)) % 4 === 0;
          var pm = lit ? E('#9fb3e0', 0.5, 'room') : M('#0e1326', { roughness: 0.3 });
          var pane = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), pm);
          pane.position.set(-w / 2 + 0.45 + fx * 0.9, 1.4 + fy * 1.1, 0.61); g.add(pane);
        }
      }
      facade(-1.0, -7.4, 4.2, 4.6, 0, '#1e2847'); facade(3.4, -7.4, 3.6, 3.8, 0, '#24305a');
      facade(-7.4, -0.6, 4.2, 4.2, Math.PI / 2, '#24305a'); facade(-7.4, 3.6, 3.6, 5.0, Math.PI / 2, '#1b2442');
      // 벤치·나무
      [[4.6, -3.4, 0], [-3.4, 4.6, Math.PI / 2]].forEach(function (b) {
        var g = new THREE.Group(); g.position.set(b[0], 0.08, b[1]); g.rotation.y = b[2]; root.add(g);
        box(g, 1.4, 0.08, 0.42, M('#3b2a22'), 0, 0.42, 0); box(g, 1.4, 0.3, 0.06, M('#3b2a22'), 0, 0.66, -0.18);
        [-0.6, 0.6].forEach(function (lx) { box(g, 0.06, 0.42, 0.36, M('#0b1024'), lx, 0.21, 0); });
      });
      [[-4.6, 4.4], [4.4, -4.6]].forEach(function (p) {
        box(root, 0.9, 0.4, 0.9, M('#3a3f4b'), p[0], 0.28, p[1]);
        cyl(root, 0.07, 0.11, 1.9, 7, M('#0b1024'), p[0], 1.4, p[1]);
        [[0.4, 1.9, 0.2, 0.7], [-0.5, 2.1, -0.3, 0.6], [0.2, 2.5, -0.5, 0.5]].forEach(function (bb) {
          var br = cyl(root, 0.025, 0.05, 1.0, 6, M('#0b1024'), p[0] + bb[0] / 2, bb[1], p[1] + bb[2] / 2); br.rotation.set(bb[2], 0, -bb[3]);
        });
      });
      k.lamp(ctx, root, '#9fb3e0', 0.5, 9, 0, 3, 0, 'night');

      ctx.center = { x: 0, y: 0.46, z: 0 };
      ctx.talk = [
        { x: 3.2, z: 1.8 }, { x: 1.8, z: 3.2 }, { x: 4.6, z: -1.6 }, { x: -2.2, z: -2.8 },
        { x: -2.4, z: 2.6 }, { x: 2.8, z: -2.8 }, { x: -1.6, z: 4.4 }, { x: -3.2, z: -1.8 }
      ];
      ctx.talk.forEach(function (t) { t.y = 0.08; });
      ctx.nightSpots = [{ x: -2.8, z: 1.8, y: 0.08 }, { x: -1.8, z: 2.8, y: 0.08 }];
      ctx.view = 15; ctx.target = { x: -1.8, z: -1.8 };

      var HOURS = { talk: 13, vote: 18, trial: 18.75, night: 0 }, shown = 13, want = 13;
      ctx.onPhase = function (ph) { want = HOURS[ph]; };
      ctx.tick.push(function (dt, t, ph) {
        // 변론 때는 분침이 남은 시간을 따라 돌아간다
        var h = ph === 'trial' ? 18.5 + ((t % 30) / 30) * 0.5 : want;
        shown += (h - shown) * Math.min(1, dt * 3);
        hands.forEach(function (p) { p.h.rotation.z = -(shown % 12) / 12 * Math.PI * 2; p.m.rotation.z = -(shown % 1) * Math.PI * 2; });
      });
    }
  };
})();
