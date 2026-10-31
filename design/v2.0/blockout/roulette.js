/* ⑤ 카지노 룰렛 바닥 — 바닥 전체가 8칸 룰렛판, 칸마다 한 사람. 지목된 칸은 기둥처럼 솟는다 */
(function () {
  var k = MFB.kit, M = k.M, box = k.box, cyl = k.cyl, sph = k.sph;
  MFB.CONCEPTS.roulette = {
    label: '⑤ 카지노 룰렛 바닥',
    text: {
      talk: '영업 중인 지하 카지노. 카드 탁자와 슬롯머신 사이를 돌아다녀요.',
      vote: '모두 룰렛 칸에 서서 차례로 손가락으로 지목해요. 지목받은 사람 머리 위에 표 수가 쌓여요.',
      trial: '지목된 칸이 기둥처럼 솟고, 그 위만 조명이 남아요.',
      night: '문 닫은 카지노. 슬롯머신 화면도 꺼지고 비상등만 남아요.'
    },
    build: function (ctx, root) {
      var E = function (c, kk, g) { return k.E(ctx, c, kk, g); };
      // 카펫·벽
      box(root, 14, 0.1, 14, M('#1a1f3a'), 0, -0.05, 0, false);
      var wall = M('#1c1a2a');
      box(root, 0.3, 3.8, 14.3, wall, -7.15, 1.9, 0); box(root, 14.3, 3.8, 0.3, wall, 0, 1.9, -7.15);
      box(root, 0.06, 0.12, 14, M('#a98559'), -6.98, 1.2, 0, false); box(root, 14, 0.12, 0.06, M('#a98559'), 0, 1.2, -6.98, false);
      // 룰렛판: 반지름 3.4, 8칸(검정·짙은 초록 번갈아), 금색 칸막이
      var R0 = 3.4;
      cyl(root, R0 + 0.25, R0 + 0.3, 0.12, 64, M('#3b2a22'), 0, 0.06, 0);
      var gold = M('#a98559', { metalness: 0.5, roughness: 0.35 });
      var rim = k.add(root, new THREE.TorusGeometry(R0 + 0.12, 0.07, 8, 64), gold, 0, 0.13, 0); rim.rotation.x = Math.PI / 2;
      var pockets = [];
      for (var s = 0; s < 8; s++) {
        var a0 = Math.PI / 4 - Math.PI / 8 + s / 8 * Math.PI * 2;
        var geo = new THREE.CylinderGeometry(R0, R0, 0.06, 16, 1, false, a0, Math.PI / 4);
        var pm = M(s % 2 ? '#1f3d32' : '#14161c', { roughness: 0.6 });
        var pk = k.add(root, geo, pm, 0, 0.14, 0, false);
        // 칸 아래 기둥(변론 때 그 칸만 솟는다): 칸 가운데 원기둥
        var mid = a0 + Math.PI / 8, px = Math.sin(mid) * 2.4, pz = Math.cos(mid) * 2.4;
        var pil = new THREE.Group(); pil.position.set(px, 0, pz); root.add(pil);
        cyl(pil, 0.62, 0.66, 1, 24, M(s % 2 ? '#1f3d32' : '#14161c'), 0, -0.5, 0);
        cyl(pil, 0.66, 0.66, 0.04, 24, gold, 0, 0.0, 0, false);
        pil.visible = false;
        pockets.push({ pk: pk, pil: pil });
        var dv = box(root, 0.06, 0.06, R0 - 0.7, gold, Math.sin(a0) * (R0 / 2 + 0.35), 0.19, Math.cos(a0) * (R0 / 2 + 0.35), false); dv.rotation.y = a0;
      }
      // 가운데 축
      cyl(root, 0.7, 0.9, 0.3, 32, M('#3b2a22'), 0, 0.3, 0);
      cyl(root, 0.18, 0.3, 0.7, 16, gold, 0, 0.8, 0);
      for (var h = 0; h < 4; h++) { var arm = box(root, 1.3, 0.06, 0.06, gold, 0, 1.12, 0, false); arm.rotation.y = h * Math.PI / 4; }
      ctx.marks = k.ring(8, 2.4, 0.17);
      // 카드 탁자(초록 천)
      [[-5.4, -1.2], [-1.2, -5.4], [-4.6, -4.6]].forEach(function (p) {
        var g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = Math.atan2(p[0], p[1]); root.add(g);
        box(g, 1.8, 0.1, 1.0, M('#1f4a3a'), 0, 0.72, 0); box(g, 1.9, 0.06, 1.1, M('#3b2a22'), 0, 0.66, 0);
        box(g, 0.2, 0.66, 0.2, M('#2e2018'), 0, 0.33, 0);
        sph(g, 0.06, E('#ffcf8a', 1.0, 'room'), 0, 1.6, 0, false);
        k.lamp(ctx, g, '#ffcf8a', 0.7, 4, 0, 1.5, 0, 'room');
      });
      // 슬롯머신(왼쪽 벽)
      for (var m = 0; m < 5; m++) {
        var g2 = new THREE.Group(); g2.position.set(-6.5, 0, -3.6 + m * 1.2); g2.rotation.y = Math.PI / 2; root.add(g2);
        box(g2, 0.9, 1.6, 0.7, M('#2a2f45'), 0, 0.8, 0);
        var scrn = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), E(m % 2 ? '#9fb3e0' : '#d9b25c', 0.9, 'room')); scrn.position.set(0, 1.15, 0.36); g2.add(scrn);
        box(g2, 0.95, 0.2, 0.75, M('#a98559', { metalness: 0.4, roughness: 0.45 }), 0, 1.7, 0, false);
      }
      // 판 위 조명과 비상등
      k.lamp(ctx, root, '#ffe0b0', 1.0, 9, 0, 3.4, 0, 'room');
      k.lamp(ctx, root, '#ffe0b0', 1.4, 7, 0, 3.0, 0, 'vote');
      [[-6.95, 4.0], [4.0, -6.95]].forEach(function (p, j) {
        var x = j ? p[0] : p[0] + 0.1, z = j ? p[1] + 0.1 : p[1];
        sph(root, 0.08, E('#9fe0b0', 1.2, 'night'), x, 2.9, z, false); k.lamp(ctx, root, '#9fe0b0', 0.4, 6, x, 2.7, z, 'night');
      });

      var acc = ctx.marks[ctx.accused];
      ctx.center = { x: acc.x, y: 1.1, z: acc.z };
      ctx.talk = [
        { x: 3.4, z: 2.4 }, { x: 2.4, z: 3.4 }, { x: 4.2, z: 1.0 }, { x: -3.9, z: -0.4 },
        { x: 1.0, z: 4.2 }, { x: -0.4, z: -3.9 }, { x: -1.4, z: 1.2 }, { x: 1.2, z: -1.4 }
      ];
      ctx.talk.forEach(function (t) { t.y = 0.17; });
      ctx.nightSpots = [{ x: -4.6, z: -2.4 }, { x: -3.6, z: -3.2 }];
      ctx.view = 15; ctx.target = { x: -0.4, z: -0.4 };

      ctx.onPhase = function (ph) {
        pockets.forEach(function (p, i) {
          var up = ph === 'trial' && i === ctx.accused;
          p.pil.visible = up; p.pil.position.y = up ? 1.1 : 0;
        });
      };
    }
  };
})();
