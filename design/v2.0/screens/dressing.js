/* 로비 — 백스테이지 분장실(결정 0055). 카메라가 보는 뒤 모서리 둘레에 모은다: 왼벽 조명 거울 화장대, 뒷벽 무대로 나가는 문과 맵 포스터 2장, 옷걸이 랙과 모자 선반 */
(function () {
  var k = MFB.kit, M = k.M, box = k.box, cyl = k.cyl, sph = k.sph;
  // 포스터 그림: 글자 없이 맵을 떠올리게 한다
  function poster(kind) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 176;
    var g = c.getContext('2d');
    if (kind === 'bar') {
      g.fillStyle = '#5a1420'; g.fillRect(0, 0, 128, 176);
      g.fillStyle = '#d9a050'; g.beginPath(); g.ellipse(64, 128, 46, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2c2234'; g.beginPath(); g.ellipse(64, 124, 40, 10, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd59a'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(74, 34); g.lineTo(74, 86); g.stroke();
      g.fillStyle = '#ffd59a'; g.beginPath(); g.ellipse(64, 88, 13, 9, -0.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(74, 34); g.quadraticCurveTo(96, 40, 92, 60); g.stroke();
    } else {
      g.fillStyle = '#1e2850'; g.fillRect(0, 0, 128, 176);
      g.fillStyle = '#3a3646'; g.fillRect(44, 60, 40, 116);
      g.fillStyle = '#e8e6dc'; g.beginPath(); g.arc(64, 54, 26, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1e2850'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(64, 54); g.lineTo(64, 38); g.moveTo(64, 54); g.lineTo(76, 60); g.stroke();
      g.fillStyle = '#c9d4ff'; g.beginPath(); g.arc(104, 22, 9, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#a98559'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 170);
    return new THREE.CanvasTexture(c);
  }
  MFB.CONCEPTS.dressing = {
    label: '로비 · 백스테이지 분장실',
    text: { talk: '무대 뒤 분장실. 옷걸이에서 의상을 갈아입고, 문 위 포스터로 오늘 무대를 봐요.' },
    build: function (ctx, root) {
      var E = function (c, kk, g) { return k.E(ctx, c, kk, g); };
      // 바닥(낡은 나무)·벽(어두운 자주 벽지 + 아래 판자)
      var pa = M('#3b2c24'), pb = M('#34271f');
      for (var i = 0; i < 20; i++) box(root, 0.5, 0.1, 10, i % 2 ? pa : pb, -4.75 + i * 0.5, -0.05, 0, false);
      var wall = M('#2a1f2c'), wains = M('#3b2a22');
      box(root, 0.3, 3.4, 10.3, wall, -5.15, 1.7, 0); box(root, 10.3, 3.4, 0.3, wall, 0, 1.7, -5.15);
      box(root, 0.06, 0.9, 10, wains, -4.98, 0.45, 0); box(root, 10, 0.9, 0.06, wains, 0, 0.45, -4.98);
      // 화장대: 왼벽(카메라가 보는 뒤 모서리 쪽), 거울 3개 둘레에 전구
      box(root, 0.7, 0.08, 4.4, M('#5a3f2f'), -4.6, 0.82, -2.0);
      box(root, 0.6, 0.78, 4.3, M('#2e2018'), -4.65, 0.4, -2.0);
      var bulb = E('#ffe6b8', 1.5, 'room');
      [-3.4, -2.0, -0.6].forEach(function (mz, mi) {
        var mir = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.95), new THREE.MeshStandardMaterial({ color: '#6e7a96', roughness: 0.15, metalness: 0.6 }));
        mir.rotation.y = Math.PI / 2; mir.position.set(-4.96, 1.72, mz); root.add(mir);
        box(root, 0.04, 1.1, 1.16, M('#a98559', { metalness: 0.5, roughness: 0.4 }), -4.98, 1.72, mz, false);
        for (var b = 0; b < 5; b++) {
          sph(root, 0.045, bulb, -4.93, 2.3, mz - 0.56 + b * 0.28, false);
          if (b > 0 && b < 4) { sph(root, 0.045, bulb, -4.93, 1.22 + b * 0.25, mz - 0.62); sph(root, 0.045, bulb, -4.93, 1.22 + b * 0.25, mz + 0.62); }
        }
        k.glow(ctx, root, '#ffe6b8', 1.5, -4.8, 1.75, mz, 0.35, 'room');
        cyl(root, 0.24, 0.24, 0.07, 14, M('#4a2f3a'), -3.85, 0.5, mz); cyl(root, 0.04, 0.06, 0.48, 8, M('#14161c'), -3.85, 0.24, mz);
        cyl(root, 0.06, 0.06, 0.16, 8, E(['#c9a0c0', '#7fb08a', '#d9a050'][mi], 0.3, 'room'), -4.55, 0.94, mz + 0.35, false);
        cyl(root, 0.1, 0.1, 0.03, 12, M('#e6d6c4'), -4.5, 0.88, mz - 0.3, false);
      });
      k.lamp(ctx, root, '#ffe0b0', 1.4, 5.5, -3.8, 2.0, -2.0, 'room');
      // 무대로 나가는 문(뒷벽, 모서리 가까이)과 문 위 맵 포스터 2장
      var door = new THREE.Group(); door.position.set(-2.4, 0, -4.97); root.add(door);
      box(door, 1.3, 2.3, 0.06, M('#4a3426'), 0, 1.15, 0);
      box(door, 1.46, 2.4, 0.04, M('#2e2018'), 0, 1.2, -0.02, false);
      sph(door, 0.05, M('#a98559', { metalness: 0.6, roughness: 0.3 }), 0.48, 1.1, 0.06, false);
      var star = E('#ffd59a', 1.2, 'room'); box(door, 0.18, 0.18, 0.02, star, 0, 1.8, 0.04, false).rotation.z = Math.PI / 4;
      var frames = {};
      [['bar', -0.42], ['plaza', 0.42]].forEach(function (p) {
        var tex = poster(p[0]), m = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0, roughness: 0.7 });
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.9), m); pl.position.set(p[1], 2.85, 0.06); door.add(pl);
        var lt = new THREE.PointLight('#ffe0b0', 0, 1.8, 2); lt.position.set(p[1], 2.85, 0.6); door.add(lt);
        frames[p[0]] = { m: m, l: lt };
      });
      // 옷걸이 랙(뒷벽 오른쪽): 의상 색 코트 9벌. 누르면 꾸미기 창(앱)
      var rack = new THREE.Group(); rack.position.set(-0.3, 0, -4.3); root.add(rack);
      var pole = M('#a9aebb', { metalness: 0.6, roughness: 0.35 });
      cyl(rack, 0.025, 0.025, 1.9, 8, pole, -1.15, 0.95, 0); cyl(rack, 0.025, 0.025, 1.9, 8, pole, 1.15, 0.95, 0);
      var bar = cyl(rack, 0.025, 0.025, 2.3, 8, pole, 0, 1.85, 0, false); bar.rotation.z = Math.PI / 2;
      [-1.15, 1.15].forEach(function (x) { box(rack, 0.06, 0.04, 0.6, pole, x, 0.02, 0, false); });
      ['#8a6a4a', '#1c1d24', '#3a2a3a', '#2b3a66', '#e6e8ee', '#5a4a3a'].forEach(function (col, j) {
        var coat = new THREE.Group(); coat.position.set(-0.9 + j * 0.36, 1.83, 0); rack.add(coat);
        cyl(coat, 0.012, 0.012, 0.12, 6, pole, 0, -0.04, 0, false);
        box(coat, 0.42, 0.04, 0.05, M('#5a3f2f'), 0, -0.1, 0, false);
        var body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.95, 10), M(col)); body.position.y = -0.6; body.scale.z = 0.35; body.castShadow = true; coat.add(body);
        coat.rotation.y = j % 2 ? 0.25 : -0.25;
      });
      // 랙 앞 바닥 고리가 천천히 빛난다(누를 수 있는 곳)
      var hint = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshBasicMaterial({ color: '#ffe0b0', transparent: true, opacity: 0.12, depthWrite: false }));
      hint.rotation.x = -Math.PI / 2; hint.scale.set(1.4, 0.6, 1); hint.position.set(-0.3, 0.012, -3.7); root.add(hint);
      ctx.tick.push(function (dt, t) { hint.material.opacity = 0.06 + (Math.sin(t * 2.2) + 1) * 0.05; });
      // 모자 선반(랙 위 뒷벽)
      box(root, 2.4, 0.05, 0.4, M('#5a3f2f'), -0.3, 2.6, -4.85, false);
      [['#1c1d24', 'fedora'], ['#2b3a66', 'cap'], ['#7a6448', 'deer'], ['#6a5a50', 'news']].forEach(function (h, j) {
        var x = -1.2 + j * 0.6, hm = M(h[0]);
        cyl(root, 0.16, 0.18, 0.18, 14, hm, x, 2.72, -4.82, false);
        cyl(root, h[1] === 'cap' ? 0.2 : 0.27, h[1] === 'cap' ? 0.2 : 0.27, 0.02, 16, hm, x, 2.635, -4.82, false);
      });
      // 칸막이 병풍(뒷벽 오른쪽 끝)과 트렁크
      var scr = new THREE.Group(); scr.position.set(2.2, 0, -4.4); scr.rotation.y = -0.3; root.add(scr);
      [-0.55, 0, 0.55].forEach(function (x, j) {
        var pn = box(scr, 0.56, 1.7, 0.04, M(j === 1 ? '#5a2a34' : '#4a2230'), x, 0.95, 0); pn.rotation.y = j === 1 ? 0 : (j ? -0.35 : 0.35);
        box(scr, 0.56, 0.05, 0.06, M('#a98559', { metalness: 0.5 }), x, 1.82, 0, false);
      });
      box(root, 0.55, 0.5, 0.9, M('#5a3a2a'), -4.5, 0.25, 1.4); box(root, 0.57, 0.05, 0.92, M('#a98559', { metalness: 0.5 }), -4.5, 0.48, 1.4, false);
      // 방장이 고른 맵의 포스터에 불이 켜진다. 랜덤이면 번갈아 깜빡인다
      ctx.poster = 'random';
      ctx.setPoster = function (id) { ctx.poster = id; };
      ctx.tick.push(function (dt, t) {
        ['bar', 'plaza'].forEach(function (id, j) {
          var on = ctx.poster === id ? 1 : ctx.poster === 'random' ? (Math.floor(t * 1.5) % 2 === j ? 0.8 : 0.1) : 0.08;
          frames[id].m.emissiveIntensity = on * 0.75; frames[id].l.intensity = on * 1.2;
          frames[id].m.color.setScalar(0.3 + on * 0.4);
        });
      });
      // 천장 맨전구 2개(뒤쪽)
      [[-2.2, -1.8], [0.8, -2.6]].forEach(function (p) {
        cyl(root, 0.008, 0.008, 0.8, 4, M('#14161c'), p[0], 3.0, p[1], false);
        sph(root, 0.08, E('#ffcf8a', 1.6, 'room'), p[0], 2.56, p[1], false);
        k.glow(ctx, root, '#ffcf8a', 0.9, p[0], 2.56, p[1], 0.5, 'room');
        k.lamp(ctx, root, '#ffcf8a', 0.9, 5.5, p[0], 2.4, p[1], 'room');
      });

      ctx.center = { x: 0, y: 0, z: 0 };
      ctx.marks = k.ring(8, 2.0, 0);
      ctx.talk = [
        { x: 0.8, z: 0.4 }, { x: -1.0, z: 1.4 }, { x: -2.6, z: -2.8 }, { x: -2.6, z: 0.2 },
        { x: 2.2, z: -2.6 }, { x: 0.2, z: -1.8 }, { x: -1.4, z: -0.9 }, { x: 2.0, z: 1.2 }
      ];
      ctx.talk[2].yaw = Math.PI * 0.9; ctx.talk[3].yaw = -Math.PI / 2; ctx.talk[4].yaw = Math.PI;
      ctx.view = 14.5; ctx.target = { x: -1.2, z: -1.4 };
    }
  };
})();
