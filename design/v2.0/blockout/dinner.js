/* ④ 패밀리 만찬 긴 식탁 — 화면 세로로 놓인 긴 식탁, 양쪽 4명씩 앉는다. 변론자는 식탁 머리(먼 쪽)에 선다 */
(function () {
  var k = MFB.kit, M = k.M, box = k.box, cyl = k.cyl, sph = k.sph;
  MFB.CONCEPTS.dinner = {
    label: '④ 패밀리 만찬 식탁',
    text: {
      talk: '만찬 전 식당. 벽난로와 찬장 사이를 돌아다니며 이야기해요.',
      vote: '모두 식탁에 앉아 차례로 손가락으로 지목해요. 지목받은 사람 머리 위에 표 수가 쌓여요.',
      trial: '샹들리에가 꺼지고, 식탁 머리에 선 변론자 위 등 하나만 남아요.',
      night: '만찬이 끝난 식당. 촛불은 꺼지고 벽난로 불씨만 남아요.'
    },
    build: function (ctx, root) {
      var E = function (c, kk, g) { return k.E(ctx, c, kk, g); };
      // 바닥(대리석 격자)·벽
      var ta = M('#2a2630'), tb = M('#211e28');
      for (var ix = 0; ix < 14; ix++) for (var iz = 0; iz < 14; iz++) box(root, 1, 0.1, 1, (ix + iz) % 2 ? ta : tb, -6.5 + ix, -0.05, -6.5 + iz, false);
      var wall = M('#2a1f2a'), wains = M('#3b2a22');
      box(root, 0.3, 3.8, 14.3, wall, -7.15, 1.9, 0); box(root, 14.3, 3.8, 0.3, wall, 0, 1.9, -7.15);
      box(root, 0.06, 1.1, 14, wains, -6.98, 0.55, 0); box(root, 14, 1.1, 0.06, wains, 0, 0.55, -6.98);
      // 벽난로(왼쪽 벽)
      var fp = new THREE.Group(); fp.position.set(-6.7, 0, 0.5); root.add(fp);
      box(fp, 0.6, 1.5, 2.2, M('#3a3f4b'), 0, 0.75, 0); box(fp, 0.8, 0.12, 2.5, M('#4a4f5c'), 0.1, 1.55, 0);
      box(fp, 0.1, 0.8, 1.2, M('#0b0a10'), 0.31, 0.45, 0, false);
      var ember = sph(fp, 0.22, E('#ff9a4a', 1.4, 'room'), 0.3, 0.2, 0, false); ember.scale.set(1, 0.4, 2);
      ctx.em.push({ m: ember.material, k: 0.5, grp: 'night' });
      k.lamp(ctx, fp, '#ff9a5a', 1.0, 5, 0.9, 0.6, 0, 'room'); k.lamp(ctx, fp, '#ff8a4a', 0.35, 3.5, 0.9, 0.5, 0, 'night');
      // 초상화 2점, 찬장, 창
      [[-6.97, -3.2, Math.PI / 2], [-2.6, -6.97, 0]].forEach(function (p) {
        var f = new THREE.Group(); f.position.set(p[0], 2.3, p[1]); f.rotation.y = p[2]; root.add(f);
        box(f, 1.0, 1.3, 0.06, M('#a98559', { metalness: 0.4, roughness: 0.5 }), 0, 0, 0.03, false);
        box(f, 0.84, 1.14, 0.04, M('#1e2033'), 0, 0, 0.06, false);
      });
      box(root, 2.4, 1.0, 0.6, M('#2e2018'), 2.2, 0.5, -6.7);
      var win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), E('#56648f', 0.45, 'room')); win.position.set(5.0, 2.1, -6.97); root.add(win);
      ctx.em.push({ m: win.material, k: 0.9, grp: 'night' });
      k.lamp(ctx, root, '#9fb3e0', 0.8, 7, 5.0, 1.8, -5.8, 'night');
      // 긴 식탁: 화면 세로 방향(+x+z 대각선)으로 놓는다
      var tbl = new THREE.Group(); tbl.rotation.y = Math.PI / 4; root.add(tbl);
      box(tbl, 1.7, 0.08, 6.6, M('#4a3426'), 0, 0.62, 0);
      box(tbl, 1.5, 0.04, 6.4, M('#e0d8c4'), 0, 0.665, 0, false);
      [[-0.7, -3.0], [0.7, -3.0], [-0.7, 3.0], [0.7, 3.0], [-0.7, 0], [0.7, 0]].forEach(function (l) { box(tbl, 0.1, 0.6, 0.1, M('#2e2018'), l[0], 0.3, l[1]); });
      // 의자 8개: 폭 0.8, 앉는 높이 0.4, 등받이 낮게(캐릭터를 가리지 않게)
      ctx.marks = [];
      var lz = [-2.25, -0.75, 0.75, 2.25], ax = new THREE.Vector3();
      [-1, 1].forEach(function (side) {
        lz.forEach(function (z) {
          var ch = new THREE.Group(); ch.position.set(side * 1.25, 0, z); ch.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; tbl.add(ch);
          box(ch, 0.8, 0.08, 0.7, M('#4a2f3a'), 0, 0.36, 0); box(ch, 0.8, 0.5, 0.07, M('#2e2018'), 0, 0.62, -0.34);
          [[-0.34, -0.3], [0.34, -0.3], [-0.34, 0.3], [0.34, 0.3]].forEach(function (l) { box(ch, 0.06, 0.34, 0.06, M('#2e2018'), l[0], 0.17, l[1]); });
          ax.set(side * 1.25, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
          var yaw = Math.PI / 4 + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
          ctx.marks.push({ x: ax.x, y: 0, z: ax.z, yaw: yaw, sit: 0.4 });
        });
      });
      // 식탁 머리(먼 쪽): 변론자가 서는 곳. 위에 등 하나
      ax.set(0, 0, -3.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
      ctx.center = { x: ax.x, y: 0, z: ax.z };
      cyl(root, 0.01, 0.01, 1.2, 4, M('#14161c'), ax.x, 3.4, ax.z, false);
      k.add(root, new THREE.ConeGeometry(0.32, 0.26, 16, 1, true), M('#2b2f38', { side: THREE.DoubleSide }), ax.x, 2.75, ax.z, false);
      sph(root, 0.07, E('#ffe6c4', 1.8, 'trial'), ax.x, 2.67, ax.z, false);
      // 샹들리에: 식탁 가운데 위, 높게(사람을 가리지 않게)
      var ch2 = new THREE.Group(); ch2.position.set(-0.6, 3.3, -0.6); root.add(ch2);
      var rg = k.add(ch2, new THREE.TorusGeometry(0.55, 0.03, 8, 32), M('#a98559', { metalness: 0.5, roughness: 0.4 }), 0, 0, 0, false); rg.rotation.x = Math.PI / 2;
      for (var b = 0; b < 6; b++) { var ba = b / 6 * Math.PI * 2; sph(ch2, 0.05, E('#ffe2b8', 1.6, 'room'), Math.cos(ba) * 0.55, 0.08, Math.sin(ba) * 0.55, false); }
      k.glow(ctx, ch2, '#ffd9a8', 1.6, 0, 0.05, 0, 0.5, 'room');
      k.lamp(ctx, ch2, '#ffe0b8', 1.1, 8, 0, -0.2, 0, 'room');
      k.lamp(ctx, root, '#ffe0b0', 0.9, 6, 0, 2.4, 0, 'vote');

      ctx.talk = [
        { x: 3.0, z: -0.6 }, { x: -0.6, z: 3.0 }, { x: 3.9, z: 0.8 }, { x: 0.8, z: 3.9 },
        { x: -1.6, z: -4.2 }, { x: -4.2, z: -1.6 }, { x: 4.5, z: 2.4 }, { x: 2.4, z: 4.5 }
      ];
      ctx.nightSpots = [{ x: -3.4, z: -1.6 }, { x: -2.6, z: -2.9 }];
      ctx.view = 15; ctx.target = { x: -0.8, z: -0.8 };

    }
  };
})();
