// 달빛 누아르 유령. 높이·발밑과 탈락 표현은 결정 0084의 규격을 따른다.
import {
  Color,
  DoubleSide,
  EqualDepth,
  Float32BufferAttribute,
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

export const GHOST3D_COLORS = { body: "#9fc6ec", bodyGlow: "#527db8", halo: "#8ebde5", mark: "#23344c", cheek: "#84a9d3" } as const;

/** 깊이 전용 면과 일치하는 겉면만 합성하고, 가장자리의 밝은 색은 더 옅게 남긴다. */
export function animalGhostMaterial(source: MeshStandardMaterial): MeshStandardMaterial {
  const material = source.clone();
  material.transparent = true;
  material.depthWrite = false;
  material.depthFunc = EqualDepth;
  material.customProgramCacheKey = () => `${source.customProgramCacheKey()}|animal-ghost`;
  material.onBeforeCompile = (shader, renderer) => {
    source.onBeforeCompile(shader, renderer);
    shader.uniforms.ghostTint = { value: material.color };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 ghostTint;")
      .replace("#include <opaque_fragment>", `float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
        float rim = 1.0 - smoothstep(0.03, 0.58, facing);
        float luminance = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        outgoingLight = mix(outgoingLight, luminance * vec3(0.75, 0.91, 1.12), 0.35);
        outgoingLight = mix(outgoingLight, vec3(0.45, 0.63, 0.80) * ghostTint, 0.08 + rim * 0.20);
        diffuseColor.a *= mix(0.34, 0.72, smoothstep(0.05, 0.60, facing));
        #include <opaque_fragment>`);
  };
  return material;
}
/** 유령 전체 높이(후광 꼭대기까지, 로컬 단위) */
export const GHOST3D_HEIGHT = 2.45;

const BODY_GLOW = 0.28;
const HALO_GLOW = 0.33;
/** 몸통 단면 [높이, 반지름] */
const PROFILE: readonly (readonly [number, number])[] = [
  [0.0, 0.86],
  [0.18, 0.9],
  [0.6, 0.84],
  [1.05, 0.8],
  [1.4, 0.78],
  [1.68, 0.71],
  [1.88, 0.57],
  [2.0, 0.37],
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
  const bodyMat = new MeshStandardMaterial({ color: GHOST3D_COLORS.body, emissive: GHOST3D_COLORS.bodyGlow, emissiveIntensity: BODY_GLOW, roughness: 0.58, metalness: 0, side: DoubleSide, vertexColors: true });
  // 천의 가장자리만 차갑게 빛나게 한다. 그림자나 투명 메시를 추가하지 않는다.
  bodyMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      float veilRim = 1.0 - abs(dot(normal, normalize(vViewPosition)));
      totalEmissiveRadiance *= 1.0 + 4.0 * veilRim * veilRim;`);
  };
  const markMat = new MeshStandardMaterial({ color: GHOST3D_COLORS.mark, roughness: 0.9, metalness: 0 });
  const cheekMat = new MeshStandardMaterial({ color: GHOST3D_COLORS.cheek, roughness: 0.9, metalness: 0 });
  const haloMat = new MeshStandardMaterial({ color: GHOST3D_COLORS.halo, emissive: GHOST3D_COLORS.halo, emissiveIntensity: HALO_GLOW, roughness: 0.5, metalness: 0 });
  const mats = [bodyMat, markMat, cheekMat, haloMat];
  const geos: { dispose(): void }[] = [];

  // 새 천 모형: 아랫단 여섯 주름과 옅은 청색 그라데이션을 같은 메시로 굽는다.
  const pts = new SplineCurve(PROFILE.map(([y, r]) => new Vector2(r, y))).getPoints(36);
  const shellGeo = new LatheGeometry(pts, 28);
  const pos = shellGeo.attributes.position;
  const shade = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const fold = 0.5 + 0.5 * Math.cos(6 * Math.atan2(z, x));
    const strength = Math.max(0, 1 - Math.max(y, 0) / 0.82);
    const radius = 1 + (fold - 0.5) * strength * 0.18;
    pos.setXYZ(i, x * radius, y + (1 - fold) * 0.22 * strength * strength, z * radius);
    const dark = strength * (1.13 - 0.57 * fold);
    shade.set([1 - 0.33 * dark, 1 - 0.17 * dark, 1 - 0.05 * dark], i * 3);
  }
  shellGeo.setAttribute("color", new Float32BufferAttribute(shade, 3));
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
  armGeo.setAttribute("color", new Float32BufferAttribute(new Float32Array(armGeo.attributes.position.count * 3).fill(1), 3));
  geos.push(armGeo);
  const arms = [-1, 1].map((s) => {
    const arm = new Mesh(armGeo, bodyMat);
    arm.name = "ghost-arm";
    arm.scale.set(0.87, 1.35, 0.86);
    arm.position.set(s * 0.80, 0.67, 0.04);
    arm.rotation.z = s * 0.32;
    body.add(arm);
    return arm;
  });

  // 후광: 머리 위에 떠 있는 옅은 청색 고리
  const haloGeo = new TorusGeometry(0.4, 0.05, 8, 36);
  geos.push(haloGeo);
  const halo = new Mesh(haloGeo, haloMat);
  halo.name = "ghost-halo";
  halo.rotation.x = Math.PI / 2 - 0.22;
  halo.scale.y = 0.84;
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
