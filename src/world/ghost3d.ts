// 3D 유령(탈락자) — 원본 design/v2.0/ghost3d/ghost3d.js (3D 유령 에셋 캔버스, 결정 0084)를 three ES 모듈로 옮겼다. 숫자·색은 원문과 같다.
// 높이 2.45(머리 꼭대기 = 후광 꼭대기), 폭 약 1.86, 발밑이 y=0, 앞이 +z. 전부 불투명이고 직업 단서가 없다.
import {
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SplineCurve,
  TorusGeometry,
  BoxGeometry,
  Vector2,
} from "three";

export const GHOST3D_COLORS = { body: "#e4e9f9", bodyGlow: "#7c86b8", halo: "#f3c64a", mark: "#2b2f4a", cheek: "#f2a7b8" } as const;
/** 유령 전체 높이(후광 꼭대기까지, 로컬 단위) */
export const GHOST3D_HEIGHT = 2.45;

const BODY_GLOW = 0.22;
const HALO_GLOW = 0.55;
/** 몸통 단면 [높이, 반지름] */
const PROFILE: readonly (readonly [number, number])[] = [
  [0.0, 0.9],
  [0.18, 0.93],
  [0.6, 0.91],
  [1.05, 0.86],
  [1.4, 0.82],
  [1.68, 0.74],
  [1.88, 0.55],
  [2.0, 0.3],
  [2.06, 0.1],
  [2.08, 0.0],
];

function radiusAt(y: number): number {
  for (let i = 1; i < PROFILE.length; i++) {
    if (y <= PROFILE[i][0]) {
      const a = PROFILE[i - 1];
      const b = PROFILE[i];
      return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
    }
  }
  return 0;
}

export interface Ghost3d {
  /** 캐릭터 뿌리에 붙이는 묶음(발밑 = 원점, 앞 = +z) */
  readonly root: Group;
  /** 둥실·팔 살랑·후광 흔들림(t = 초) */
  update(t: number): void;
  /** 밝기 배율(0~1) — 어두운 장면에서 낮춘다 */
  setTint(k: number): void;
  /** 불투명도(1 = 완전 불투명, 처형 연출·등장에서만 1 미만) */
  setOpacity(alpha: number): void;
  dispose(): void;
}

export function buildGhost3d(): Ghost3d {
  const root = new Group();
  root.name = "ghost-3d";
  const body = new Group();
  root.add(body);

  const bodyBase = new Color(GHOST3D_COLORS.body);
  const haloBase = new Color(GHOST3D_COLORS.halo);
  const bodyMat = new MeshStandardMaterial({ color: GHOST3D_COLORS.body, emissive: GHOST3D_COLORS.bodyGlow, emissiveIntensity: BODY_GLOW, roughness: 0.85, metalness: 0, side: DoubleSide });
  const markMat = new MeshStandardMaterial({ color: GHOST3D_COLORS.mark, roughness: 0.9, metalness: 0 });
  const cheekMat = new MeshStandardMaterial({ color: GHOST3D_COLORS.cheek, roughness: 0.9, metalness: 0 });
  const haloMat = new MeshStandardMaterial({ color: GHOST3D_COLORS.halo, emissive: GHOST3D_COLORS.halo, emissiveIntensity: HALO_GLOW, roughness: 0.5, metalness: 0 });
  const mats = [bodyMat, markMat, cheekMat, haloMat];
  const geos: { dispose(): void }[] = [];

  // 몸통: 단면을 곡선으로 매끈하게 돌리고 아랫단을 네 갈래 물결로 늘어뜨린다(갈래 끝은 바닥, 갈래 사이는 0.18 위)
  const pts = new SplineCurve(PROFILE.map(([y, r]) => new Vector2(r, y))).getPoints(36);
  const shellGeo = new LatheGeometry(pts, 28);
  const pos = shellGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < 0.4) {
      const lobe = 0.5 + 0.5 * Math.cos(4 * Math.atan2(z, x));
      pos.setY(i, y + (1 - lobe) * 0.18 * (1 - Math.max(y, 0) / 0.4));
    }
  }
  shellGeo.computeVertexNormals();
  geos.push(shellGeo);
  const shell = new Mesh(shellGeo, bodyMat);
  shell.name = "ghost-body";
  body.add(shell);

  // 얼굴(앞 +z): X 눈 둘, 동그란 입, 볼터치 둘
  const onSurface = (x: number, y: number, lift: number): number => Math.sqrt(Math.max(radiusAt(y) ** 2 - x * x, 0.01)) + lift;
  const barGeo = new BoxGeometry(0.3, 0.07, 0.04);
  geos.push(barGeo);
  const xEye = (cx: number, cy: number): Group => {
    const g = new Group();
    for (const s of [-1, 1]) {
      const bar = new Mesh(barGeo, markMat);
      bar.rotation.z = (s * Math.PI) / 4;
      g.add(bar);
    }
    g.position.set(cx, cy, onSurface(cx, cy, 0.015));
    g.rotation.y = Math.asin(Math.max(-0.6, Math.min(0.6, cx / radiusAt(cy))));
    return g;
  };
  body.add(xEye(-0.3, 1.45), xEye(0.3, 1.45));
  const mouthGeo = new SphereGeometry(0.085, 14, 10);
  geos.push(mouthGeo);
  const mouth = new Mesh(mouthGeo, markMat);
  mouth.scale.set(0.9, 1.15, 0.35);
  mouth.position.set(0, 1.22, onSurface(0, 1.22, 0.005));
  body.add(mouth);
  const cheekGeo = new SphereGeometry(0.11, 14, 10);
  geos.push(cheekGeo);
  for (const s of [-1, 1]) {
    const c = new Mesh(cheekGeo, cheekMat);
    c.scale.set(1.2, 0.8, 0.3);
    c.position.set(s * 0.52, 1.28, onSurface(s * 0.52, 1.28, 0));
    c.rotation.y = s * 0.62;
    body.add(c);
  }

  // 팔: 몸 옆에 붙은 둥근 덩어리 둘
  const armGeo = new SphereGeometry(0.2, 16, 12);
  geos.push(armGeo);
  const arms = [-1, 1].map((s) => {
    const arm = new Mesh(armGeo, bodyMat);
    arm.name = "ghost-arm";
    arm.scale.set(0.9, 1.7, 0.9);
    arm.position.set(s * 0.86, 0.98, 0.04);
    arm.rotation.z = s * 0.32;
    body.add(arm);
    return arm;
  });

  // 후광: 머리 위에 떠 있는 금빛 고리
  const haloGeo = new TorusGeometry(0.4, 0.05, 10, 36);
  geos.push(haloGeo);
  const halo = new Mesh(haloGeo, haloMat);
  halo.name = "ghost-halo";
  halo.rotation.x = Math.PI / 2 - 0.22;
  halo.position.set(0, 2.3, 0);
  root.add(halo);

  let disposed = false;
  return {
    root,
    update(t) {
      body.position.y = Math.sin(t * 1.7) * 0.06 + 0.06;
      arms[0].rotation.z = -0.32 - Math.sin(t * 2.1) * 0.12;
      arms[1].rotation.z = 0.32 + Math.sin(t * 2.1 + 1.2) * 0.12;
      halo.position.y = 2.3 + Math.sin(t * 1.7 + 0.6) * 0.04 + 0.06;
      halo.rotation.z = Math.sin(t * 1.3) * 0.08;
    },
    setTint(k) {
      bodyMat.color.copy(bodyBase).multiplyScalar(k);
      bodyMat.emissiveIntensity = BODY_GLOW * k;
      haloMat.color.copy(haloBase).multiplyScalar(k);
      haloMat.emissiveIntensity = HALO_GLOW * k;
    },
    setOpacity(alpha) {
      const a = Math.max(0, Math.min(1, alpha));
      const clear = a >= 0.999;
      for (const m of mats) {
        m.transparent = !clear;
        m.opacity = a;
        m.depthWrite = clear;
        m.needsUpdate = true;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
