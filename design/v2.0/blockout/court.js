/* ② 마을 법정 — 말발굽 배심원석 8자리(카메라 쪽이 트임), 가운데 피고석, 뒤에 판사석 */
(function () {
  var k = MFB.kit, M = k.M, box = k.box, cyl = k.cyl, sph = k.sph;
  MFB.CONCEPTS.court = {
    label: '② 마을 법정',
    text: {
      talk: '재판 전 법정. 방청석과 통로를 돌아다니며 이야기해요.',
      vote: '모두 배심원석에 서서 차례로 손가락으로 지목해요. 지목받은 사람 머리 위에 표 수가 쌓여요.',
      trial: '피고석이 한 단 올라오고, 천장 등 하나만 변론자를 비춰요.',
      night: '불 꺼진 법정. 높은 창으로 달빛만 들어와요.'
    },
    build: function (ctx, root) {
      var E = function (c, kk, g) { return k.E(ctx, c, kk, g); };
      // 바닥·벽(나무 판벽)
      var pa = M('#3b2f28'), pb = M('#352a24');
      for (var i = 0; i < 28; i++) box(root, 0.5, 0.1, 14, i % 2 ? pa : pb, -6.75 + i * 0.5, -0.05, 0, false);
      var wall = M('#1c2030'), panel = M('#3b2a22');
      box(root, 0.3, 4.2, 14.3, wall, -7.15, 2.1, 0); box(root, 14.3, 4.2, 0.3, wall, 0, 2.1, -7.15);
      box(root, 0.06, 1.4, 14, panel, -6.98, 0.7, 0); box(root, 14, 1.4, 0.06, panel, 0, 0.7, -6.98);
      // 높은 창 3개(뒷벽)
      [-4.6, 0.6, 4.6].forEach(function (x) {
        var g = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0), E('#56648f', 0.45, 'room')); g.position.set(x, 2.6, -6.97); root.add(g);
        ctx.em.push({ m: g.material, k: 0.9, grp: 'night' });
        box(root, 0.06, 2.0, 0.06, M('#16131c'), x, 2.6, -6.94, false); box(root, 1.1, 0.06, 0.06, M('#16131c'), x, 2.6, -6.94, false);
      });
      k.lamp(ctx, root, '#9fb3e0', 0.9, 8, 0.6, 2.4, -5.8, 'night');
      // 판사석(뒤, 카메라를 본다)
      var jb = new THREE.Group(); jb.position.set(-4.3, 0, -4.3); jb.rotation.y = Math.PI / 4; root.add(jb);
      box(jb, 3.6, 0.4, 1.8, M('#2e2018'), 0, 0.2, 0);
      box(jb, 3.2, 1.0, 0.5, M('#4a3426'), 0, 0.9, 0.5);
      box(jb, 3.3, 0.08, 0.7, M('#5a3f2f'), 0, 1.44, 0.45);
      box(jb, 0.8, 1.6, 0.15, M('#2e2018'), 0, 1.2, -0.55);
      var gav = new THREE.Group(); gav.position.set(0.7, 1.52, 0.45); jb.add(gav);
      var gh = cyl(gav, 0.06, 0.06, 0.24, 10, M('#2e2018'), 0, 0.05, 0); gh.rotation.z = Math.PI / 2;
      var gs = cyl(gav, 0.015, 0.015, 0.3, 6, M('#2e2018'), 0.05, 0.05, 0.12); gs.rotation.x = Math.PI / 2;
      // 녹색 갓 등
      cyl(jb, 0.02, 0.02, 0.25, 6, M('#a98559'), -0.9, 1.6, 0.45, false);
      var sh = cyl(jb, 0.1, 0.14, 0.1, 12, E('#2f6a4a', 0.6, 'room'), -0.9, 1.74, 0.45, false); void sh;
      k.lamp(ctx, jb, '#ffe0b0', 0.6, 4, -0.9, 1.65, 0.6, 'room');
      // 저울 문양(벽)
      var em = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), M('#a98559', { metalness: 0.5, roughness: 0.4 })); em.position.set(-6.97, 3.0, -6.97 + 0.01); root.add(em);
      em.position.set(-4.3 - 1.4, 2.3, -4.3 - 1.4); em.scale.setScalar(0.7); em.lookAt(0, 2.3, 0);
      // 피고석: 난간 상자. 변론 때 바닥판이 올라온다
      var dock = new THREE.Group(); root.add(dock);
      box(dock, 1.4, 0.2, 1.4, M('#2e2018'), 0, 0.1, 0);
      var rail = M('#4a3426');
      [[0, 0.68], [0, -0.68], [0.68, 0], [-0.68, 0]].forEach(function (r, j) {
        var b = box(dock, j < 2 ? 1.4 : 0.06, 0.06, j < 2 ? 0.06 : 1.4, rail, r[0], 0.95, r[1], false); void b;
      });
      [[0.68, 0.68], [-0.68, 0.68], [0.68, -0.68], [-0.68, -0.68]].forEach(function (p) { box(dock, 0.07, 0.95, 0.07, rail, p[0], 0.5, p[1]); });
      // 배심원석: 말발굽(240°), 반지름 2.8. 사람은 자리 뒤에 서고 앞에 낮은 단상과 명패
      ctx.marks = [];
      for (var s = 0; s < 8; s++) {
        var a = Math.PI / 4 + Math.PI / 3 + s / 7 * (Math.PI * 4 / 3), R = 2.9;
        var x = Math.sin(a) * R, z = Math.cos(a) * R, yaw = Math.atan2(-x, -z);
        ctx.marks.push({ x: x, y: 0, z: z, yaw: yaw });
        var pd = new THREE.Group(); pd.position.set(Math.sin(a) * (R - 0.55), 0, Math.cos(a) * (R - 0.55)); pd.rotation.y = yaw + Math.PI; root.add(pd);
        box(pd, 0.9, 0.62, 0.3, M('#4a3426'), 0, 0.31, 0);
        box(pd, 0.98, 0.05, 0.38, M('#5a3f2f'), 0, 0.645, 0);
        box(pd, 0.46, 0.1, 0.04, M('#e0d8c4'), 0, 0.7, 0.08, false);
      }
      // 방청석(앞쪽 낮은 긴 의자)
      [[4.8, 1.6], [1.6, 4.8]].forEach(function (p, j) {
        var g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = j ? 0 : Math.PI / 2; root.add(g);
        box(g, 2.4, 0.08, 0.5, M('#4a3426'), 0, 0.42, 0); box(g, 2.4, 0.4, 0.06, M('#3b2a22'), 0, 0.64, 0.24);
        [-1.0, 1.0].forEach(function (lx) { box(g, 0.06, 0.42, 0.44, M('#2e2018'), lx, 0.21, 0); });
      });
      // 벽등과 지목 등, 변론 천장 등
      [[-6.95, 2.0], [-6.95, -2.6], [-2.6, -6.95], [2.6, -6.95]].forEach(function (p, j) {
        var x = j < 2 ? p[0] + 0.1 : p[0], z = j < 2 ? p[1] : p[1] + 0.1;
        sph(root, 0.09, E('#ffcf8a', 1.2, 'room'), x, 2.3, z, false); k.glow(ctx, root, '#ffcf8a', 1.0, x, 2.3, z, 0.5, 'room');
      });
      k.lamp(ctx, root, '#ffe0b0', 1.4, 7, 0, 3.2, 0, 'vote');
      k.lamp(ctx, root, '#ffe0b0', 0.7, 9, 3.0, 3.0, 3.0, 'room');

      ctx.center = { x: 0, y: 0.45, z: 0 };
      ctx.talk = [
        { x: 4.2, z: 0.4 }, { x: 0.4, z: 4.2 }, { x: 5.6, z: 3.4 }, { x: -2.2, z: -2.0 },
        { x: 3.4, z: 5.6 }, { x: 2.6, z: 2.4 }, { x: -1.4, z: -2.8 }, { x: 3.4, z: -2.6 }
      ];
      ctx.talk[3].yaw = Math.atan2(0.8, -0.8); ctx.talk[6].yaw = Math.atan2(-0.8, 0.8);
      ctx.nightSpots = [{ x: -2.6, z: -1.6 }, { x: -1.6, z: -2.6 }];
      ctx.view = 15; ctx.target = { x: -0.6, z: -0.6 };

      ctx.onPhase = function (ph) { dock.position.y = ph === 'trial' ? 0.25 : 0; };
    }
  };
})();
