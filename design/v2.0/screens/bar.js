/* ① 지하 재즈 바 — 가운데 낮은 원형 무대, 둘레 놋쇠 표시 8개(표시마다 전구 8개). 밤에는 영업이 끝난 바 */
(function () {
  var k = MFB.kit, M = k.M, box = k.box, cyl = k.cyl, sph = k.sph;
  MFB.CONCEPTS.bar = {
    label: '① 지하 재즈 바',
    text: {
      talk: '영업 중인 바. 탁자와 바 사이를 돌아다니며 이야기해요.',
      vote: '모두 무대 둘레 표시에 서서 차례로 손가락으로 지목해요. 지목받은 사람 머리 위에 표 수가 쌓여요.',
      trial: '바 조명이 꺼지고 무대 조명 하나만 변론자를 비춰요.',
      night: '영업이 끝난 바. 의자는 탁자 위에 올라가고, 블라인드 사이로 달빛만 들어와요.'
    },
    build: function (ctx, root) {
      var E = function (c, kk, g) { return k.E(ctx, c, kk, g); };
      // 바닥·벽
      var pa = M('#3a2a22'), pb = M('#33241d');
      for (var i = 0; i < 28; i++) box(root, 0.5, 0.1, 14, i % 2 ? pa : pb, -6.75 + i * 0.5, -0.05, 0, false);
      var wall = M('#211a26'), wains = M('#3b2a22');
      box(root, 0.3, 3.6, 14.3, wall, -7.15, 1.8, 0); box(root, 14.3, 3.6, 0.3, wall, 0, 1.8, -7.15);
      box(root, 0.06, 1.0, 14, wains, -6.98, 0.5, 0); box(root, 14, 1.0, 0.06, wains, 0, 0.5, -6.98);
      // 블라인드 창(뒷벽)
      var win = new THREE.Group(); win.position.set(2.2, 1.9, -6.97); root.add(win);
      var glass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), E('#56648f', 0.5, 'room')); win.add(glass);
      ctx.em.push({ m: glass.material, k: 0.9, grp: 'night' });
      for (var s = 0; s < 9; s++) box(win, 2.4, 0.06, 0.04, M('#16131c'), 0, -0.68 + s * 0.17, 0.03, false);
      box(win, 2.6, 0.1, 0.12, M('#3b2a22'), 0, -0.8, 0.04, false);
      // 바 카운터와 술병 선반(왼쪽 벽)
      box(root, 1.0, 1.05, 6.2, M('#2e2018'), -5.7, 0.525, -2.2);
      box(root, 1.2, 0.08, 6.4, M('#5a3f2f'), -5.7, 1.09, -2.2);
      [0.9, 1.6, 2.3].forEach(function (y) { box(root, 0.35, 0.05, 6.0, M('#3b2a22'), -6.8, y, -2.2, false); });
      var bottleC = ['#d9a050', '#7fb08a', '#c9a0c0', '#a9c0d9'];
      for (var b = 0; b < 33; b++) {
        var bx = -6.8, bz = -5.0 + (b % 11) * 0.55, by = [0.9, 1.6, 2.3][Math.floor(b / 11)];
        cyl(root, 0.06, 0.07, 0.3, 8, E(bottleC[b % 4], 0.35, 'room'), bx, by + 0.18, bz, false);
      }
      for (var st = 0; st < 4; st++) {
        cyl(root, 0.24, 0.24, 0.07, 14, M('#4a2f3a'), -4.8, 0.72, -4.4 + st * 1.4);
        cyl(root, 0.04, 0.06, 0.7, 8, M('#14161c'), -4.8, 0.35, -4.4 + st * 1.4);
      }
      k.lamp(ctx, root, '#ffcf8a', 0.8, 6, -5.6, 2.4, -2.2, 'room');
      // 피아노(뒤 구석)
      var pi = new THREE.Group(); pi.position.set(-4.6, 0, -5.0); pi.rotation.y = 0.6; root.add(pi);
      box(pi, 1.6, 0.35, 1.2, M('#14161c', { roughness: 0.35 }), 0, 0.8, 0);
      var lid = box(pi, 1.6, 0.04, 1.2, M('#14161c', { roughness: 0.35 }), 0, 1.2, -0.3); lid.rotation.x = -0.55;
      box(pi, 1.5, 0.06, 0.25, M('#e6e8ee'), 0, 0.83, 0.62, false);
      [[-0.7, -0.5], [0.7, -0.5], [0, 0.5]].forEach(function (l) { cyl(pi, 0.05, 0.05, 0.62, 8, M('#14161c'), l[0], 0.31, l[1]); });
      // 무대: 지름 2.2, 높이 0.28. 가장자리 전구는 지목·변론 때 켜진다
      cyl(root, 1.12, 1.18, 0.28, 48, M('#2c2234'), 0, 0.14, 0);
      cyl(root, 1.13, 1.13, 0.03, 48, M('#a98559', { metalness: 0.5, roughness: 0.4 }), 0, 0.29, 0, false);
      var rimM = E('#ffd59a', 1.4, 'vote');
      for (var r = 0; r < 20; r++) { var ra = r / 20 * Math.PI * 2; sph(root, 0.04, rimM, Math.sin(ra) * 1.17, 0.2, Math.cos(ra) * 1.17, false); }
      k.glow(ctx, root, '#ffd59a', 3.2, 0, 0.4, 0, 0.35, 'vote');
      var mic = new THREE.Group(); mic.position.set(-0.45, 0.28, -0.45); root.add(mic);
      cyl(mic, 0.015, 0.015, 1.1, 6, M('#a9aebb', { metalness: 0.6, roughness: 0.3 }), 0, 0.55, 0); sph(mic, 0.06, M('#2b2f38'), 0, 1.12, 0);
      cyl(mic, 0.16, 0.16, 0.02, 12, M('#2b2f38'), 0, 0.01, 0);
      // 서는 자리 8개: 반지름 2.4(옆 사람과 2.0 간격). 놋쇠 표시만 둔다(표는 화면 겹침 층이 보여 준다)
      ctx.marks = k.ring(8, 2.4, 0);
      var brass = M('#a98559', { metalness: 0.5, roughness: 0.35 });
      ctx.marks.forEach(function (m) { cyl(root, 0.36, 0.36, 0.02, 24, brass, m.x, 0.011, m.z, false); });
      // 탁자와 의자(토론 때 모이는 곳). 밤에는 의자를 탁자 위로 올린다
      var chairs = [];
      function table(x, z) {
        cyl(root, 0.5, 0.5, 0.05, 20, M('#4a3426'), x, 0.74, z); cyl(root, 0.05, 0.05, 0.72, 8, M('#14161c'), x, 0.36, z); cyl(root, 0.25, 0.25, 0.03, 12, M('#14161c'), x, 0.015, z);
        var cand = E('#ffcf8a', 1.2, 'room'); sph(root, 0.04, cand, x, 0.86, z, false); k.glow(ctx, root, '#ffcf8a', 0.5, x, 0.88, z, 0.6, 'room');
        [0.9, -0.9].forEach(function (off, j) {
          var a = Math.atan2(x, z) + (j ? Math.PI / 2 : -Math.PI / 2), cx = x + Math.sin(a) * 0.8, cz = z + Math.cos(a) * 0.8;
          var ch = new THREE.Group(); root.add(ch);
          box(ch, 0.62, 0.07, 0.6, M('#4a2f3a'), 0, 0.42, 0); box(ch, 0.62, 0.55, 0.06, M('#2e2018'), 0, 0.72, -0.28);
          [[-0.26, -0.24], [0.26, -0.24], [-0.26, 0.24], [0.26, 0.24]].forEach(function (l) { box(ch, 0.05, 0.42, 0.05, M('#2e2018'), l[0], 0.21, l[1]); });
          chairs.push({ g: ch, day: [cx, 0, cz, a + Math.PI, 0], night: [x + Math.sin(a) * 0.3, 1.24, z + Math.cos(a) * 0.3, a + Math.PI, Math.PI] });
        });
      }
      [[4.6, 1.2], [1.2, 4.6], [4.4, -3.2], [-3.2, 4.4], [-2.4, -4.6]].forEach(function (p) { table(p[0], p[1]); });
      // 펜던트 등
      // 뒤쪽 탁자에만 단다(앞쪽은 캐릭터를 가린다)
      [[-2.4, -4.6], [4.4, -3.2]].forEach(function (p) {
        cyl(root, 0.01, 0.01, 1.0, 4, M('#14161c'), p[0], 3.4, p[1], false);
        var sh = add2(new THREE.ConeGeometry(0.3, 0.26, 16, 1, true), M('#2b2f38', { side: THREE.DoubleSide }), p[0], 2.8, p[1]);
        sph(root, 0.07, E('#ffcf8a', 1.6, 'room'), p[0], 2.72, p[1], false);
        k.lamp(ctx, root, '#ffcf8a', 0.9, 5, p[0], 2.6, p[1], 'room');
        void sh;
      });
      function add2(geo, m, x, y, z) { return k.add(root, geo, m, x, y, z, false); }
      // 벽등
      [[-6.95, 3.5], [-6.95, -0.5], [-0.5, -6.95], [4.5, -6.95]].forEach(function (p, j) {
        var onX = j < 2, x = onX ? p[0] + 0.1 : p[0], z = onX ? p[1] : p[1] + 0.1;
        sph(root, 0.09, E('#ffcf8a', 1.2, 'room'), x, 2.2, z, false);
        k.glow(ctx, root, '#ffcf8a', 1.0, x, 2.2, z, 0.5, 'room');
      });
      // 무대 위 조명 장치(지목 때 무대 둘레를 고르게)
      k.lamp(ctx, root, '#ffe0b0', 1.6, 6, 0, 3.0, 0, 'vote');
      k.lamp(ctx, root, '#ffe0b0', 0.2, 4, 0, 2.0, 0, 'trial');
      // 밤: 달빛과 창빛
      k.lamp(ctx, root, '#9fb3e0', 0.8, 7, 2.2, 1.8, -5.6, 'night');

      ctx.center = { x: 0, y: 0.29, z: 0 };
      ctx.talk = [
        { x: 3.6, z: 0.4 }, { x: 0.4, z: 3.6 }, { x: 5.4, z: 2.2 }, { x: -4.2, z: -1.2 },
        { x: 3.4, z: -2.6 }, { x: -2.6, z: 3.4 }, { x: -4.2, z: 0.2 }, { x: 2.2, z: 5.4 }
      ];
      ctx.talk[0].yaw = Math.atan2(1.0, 0.8); ctx.talk[2].yaw = Math.atan2(-1.0, -1.0);
      ctx.talk[3].yaw = -Math.PI / 2; ctx.talk[6].yaw = -Math.PI / 2;
      ctx.nightSpots = [{ x: -4.0, z: -2.6 }, { x: -3.2, z: -3.4 }];
      ctx.view = 14.5; ctx.target = { x: -0.4, z: -0.4 };

      ctx.onPhase = function (ph) {
        chairs.forEach(function (c) {
          var v = ph === 'night' ? c.night : c.day;
          c.g.position.set(v[0], v[1], v[2]); c.g.rotation.set(0, v[3], v[4]);
        });
      };
    }
  };
})();
