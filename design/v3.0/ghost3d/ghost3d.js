/* minifia 3D 유령 — three r128 전역 THREE 를 쓴다.
 * 높이 2.45(머리 꼭대기 = 후광 꼭대기), 폭 1.84, 발밑이 y=0, 앞이 +z.
 * 전부 불투명. 앱 사본: src/world/ghost3d.ts (같은 숫자) */
(function () {
  var COLORS = {
    body: '#e4e9f9', bodyGlow: '#7c86b8', halo: '#f3c64a', mark: '#2b2f4a', cheek: '#f2a7b8'
  };
  var H = 2.45;
  // 몸통 단면: [높이, 반지름]
  var PROFILE = [[0.0, 0.9], [0.18, 0.93], [0.6, 0.91], [1.05, 0.86], [1.4, 0.82], [1.68, 0.74], [1.88, 0.55], [2.0, 0.3], [2.06, 0.1], [2.08, 0.0]];

  function radiusAt(y) {
    for (var i = 1; i < PROFILE.length; i++) {
      if (y <= PROFILE[i][0]) {
        var a = PROFILE[i - 1], b = PROFILE[i], k = (y - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return 0;
  }

  function build() {
    var T = THREE;
    var root = new T.Group(); root.name = 'ghost3d';
    var body = new T.Group(); root.add(body);
    var mat = new T.MeshStandardMaterial({ color: COLORS.body, emissive: COLORS.bodyGlow, emissiveIntensity: 0.22, roughness: 0.85, metalness: 0, side: T.DoubleSide });
    var markMat = new T.MeshStandardMaterial({ color: COLORS.mark, roughness: 0.9, metalness: 0 });
    var cheekMat = new T.MeshStandardMaterial({ color: COLORS.cheek, roughness: 0.9, metalness: 0 });
    var haloMat = new T.MeshStandardMaterial({ color: COLORS.halo, emissive: COLORS.halo, emissiveIntensity: 0.55, roughness: 0.5, metalness: 0 });

    // 몸통: 단면을 곡선으로 매끈하게 돌려 만들고 아랫단을 물결(네 갈래)로 늘어뜨린다
    var pts = new T.SplineCurve(PROFILE.map(function (p) { return new T.Vector2(p[1], p[0]); })).getPoints(36);
    var geo = new T.LatheGeometry(pts, 28);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (y < 0.4) {
        var th = Math.atan2(z, x);
        var lobe = 0.5 + 0.5 * Math.cos(4 * th);
        pos.setY(i, y + (1 - lobe) * 0.18 * (1 - Math.max(y, 0) / 0.4)); // 갈래 끝은 바닥, 갈래 사이는 0.18 올라간다
      }
    }
    geo.computeVertexNormals();
    var shell = new T.Mesh(geo, mat); shell.name = 'ghost-body'; body.add(shell);

    // 얼굴(앞 +z): X 눈 둘, 동그란 입, 볼터치 둘
    function onSurface(x, y, lift) { return Math.sqrt(Math.max(radiusAt(y) * radiusAt(y) - x * x, 0.01)) + (lift || 0.01); }
    function xEye(cx, cy) {
      var g = new T.Group();
      for (var s = -1; s <= 1; s += 2) {
        var bar = new T.Mesh(new T.BoxGeometry(0.3, 0.07, 0.04), markMat);
        bar.rotation.z = s * Math.PI / 4; g.add(bar);
      }
      g.position.set(cx, cy, onSurface(cx, cy, 0.015));
      g.rotation.y = Math.asin(Math.max(-0.6, Math.min(0.6, cx / radiusAt(cy))));
      return g;
    }
    body.add(xEye(-0.3, 1.45)); body.add(xEye(0.3, 1.45));
    var mouth = new T.Mesh(new T.SphereGeometry(0.085, 14, 10), markMat);
    mouth.scale.set(0.9, 1.15, 0.35); mouth.position.set(0, 1.22, onSurface(0, 1.22, 0.005)); body.add(mouth);
    [-1, 1].forEach(function (s) {
      var c = new T.Mesh(new T.SphereGeometry(0.11, 14, 10), cheekMat);
      c.scale.set(1.2, 0.8, 0.3);
      c.position.set(s * 0.52, 1.28, onSurface(s * 0.52, 1.28, 0.0));
      c.rotation.y = s * 0.62; body.add(c);
    });

    // 팔: 몸 옆에 붙은 작은 둥근 덩어리 둘
    var arms = [];
    [-1, 1].forEach(function (s) {
      var arm = new T.Mesh(new T.SphereGeometry(0.2, 16, 12), mat);
      arm.scale.set(0.9, 1.7, 0.9);
      arm.position.set(s * 0.86, 0.98, 0.04);
      arm.rotation.z = s * 0.32;
      arm.name = 'ghost-arm'; body.add(arm); arms.push(arm);
    });

    // 후광: 머리 위에 떠 있는 금빛 고리
    var halo = new T.Mesh(new T.TorusGeometry(0.4, 0.05, 10, 36), haloMat);
    halo.name = 'ghost-halo';
    halo.rotation.x = Math.PI / 2 - 0.22;
    halo.position.set(0, 2.3, 0);
    root.add(halo);

    var base = { body: new T.Color(COLORS.body), halo: new T.Color(COLORS.halo) };
    return {
      root: root,
      height: H,
      /** 위아래로 둥실, 팔은 살랑, 후광은 살짝 흔들림 */
      update: function (t) {
        body.position.y = Math.sin(t * 1.7) * 0.06 + 0.06;
        arms[0].rotation.z = -0.32 - Math.sin(t * 2.1) * 0.12;
        arms[1].rotation.z = 0.32 + Math.sin(t * 2.1 + 1.2) * 0.12;
        halo.position.y = 2.3 + Math.sin(t * 1.7 + 0.6) * 0.04 + 0.06;
        halo.rotation.z = Math.sin(t * 1.3) * 0.08;
      },
      /** 밝기 배율(0~1 회색). 어두운 장면에서 낮춘다 */
      setTint: function (k) {
        mat.color.copy(base.body).multiplyScalar(k);
        mat.emissiveIntensity = 0.22 * k;
        haloMat.color.copy(base.halo).multiplyScalar(k);
        haloMat.emissiveIntensity = 0.55 * k;
      },
      dispose: function () { geo.dispose(); mat.dispose(); markMat.dispose(); cheekMat.dispose(); haloMat.dispose(); }
    };
  }

  window.MFGhost = { build: build, COLORS: COLORS, HEIGHT: H };
})();
