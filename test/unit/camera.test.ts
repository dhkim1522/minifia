import { describe, expect, it } from "vitest";
import { HEAD_TOP_Y, WALK_HALF } from "../../shared/game/map";
import {
  CAM_DIST,
  CAM_HEIGHT,
  CAM_YAW,
  cameraBasis,
  clampTarget,
  DEFAULT_TARGET,
  FOLLOW_TAU_MS,
  followStep,
  groundToScreen,
  LOOK_Y,
  NAMETAG_GAP,
  NAMETAG_H,
  NAMETAG_MAX_W,
  PAN_BOX,
  PLATE_FAR,
  PX_PER_UNIT,
  RESIZE_SETTLE_MS,
  screenRay,
  screenToGround,
  STAGE_SIZES,
  stageOffsetY,
  stageRect,
} from "../../src/world/camera";

/** 시드 고정 난수(mulberry32) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;

// Task 1 은 UI-SPEC 표의 6개 폰 크기를 여기서 따로 적는다(STAGE_SIZES 와 같은 값인지는 Task 2 가 대조한다).
const PHONES = [
  { w: 360, h: 640 },
  { w: 390, h: 664 },
  { w: 430, h: 932 },
  { w: 360, h: 560 },
  { w: 390, h: 844 },
  { w: 402, h: 874 },
];

describe("카메라 상수 (UI-SPEC 카메라)", () => {
  it("배율 58.2 px/단위, yaw π/4, 거리 17, 높이 12.5, 주시 높이 0.6, 기본 목표 (−0.4,−0.4)", () => {
    expect(PX_PER_UNIT).toBe(58.2);
    expect(CAM_YAW).toBeCloseTo(Math.PI / 4, 12);
    expect(CAM_DIST).toBe(17);
    expect(CAM_HEIGHT).toBe(12.5);
    expect(LOOK_Y).toBe(0.6);
    expect(DEFAULT_TARGET).toEqual({ x: -0.4, z: -0.4 });
  });

  it("감쇠 시간 상수는 350ms 에 거리의 90% 를 줄이는 값(350/ln10)이고 크기 변화 정착은 180ms", () => {
    expect(FOLLOW_TAU_MS).toBeCloseTo(350 / Math.LN10, 9);
    expect(FOLLOW_TAU_MS).toBeCloseTo(152, 0);
    expect(RESIZE_SETTLE_MS).toBe(180);
  });
});

describe("cameraBasis", () => {
  it("세 벡터는 서로 수직이고 길이가 1이다", () => {
    const { right, up, back } = cameraBasis();
    for (const v of [right, up, back]) expect(Math.sqrt(dot(v, v))).toBeCloseTo(1, 12);
    expect(dot(right, up)).toBeCloseTo(0, 12);
    expect(dot(right, back)).toBeCloseTo(0, 12);
    expect(dot(up, back)).toBeCloseTo(0, 12);
  });

  it("오른쪽은 (√½, 0, −√½), 카메라 쪽은 위치 − 주시점 (12.0208, 11.9, 12.0208) 방향, 위쪽은 하늘을 향한다", () => {
    const { right, up, back } = cameraBasis();
    expect(right.x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(right.y).toBeCloseTo(0, 12);
    expect(right.z).toBeCloseTo(-Math.SQRT1_2, 12);
    const horiz = CAM_DIST * Math.SQRT1_2;
    const len = Math.sqrt(2 * horiz * horiz + (CAM_HEIGHT - LOOK_Y) ** 2);
    expect(back.x).toBeCloseTo(horiz / len, 12);
    expect(back.y).toBeCloseTo((CAM_HEIGHT - LOOK_Y) / len, 12);
    expect(back.z).toBeCloseTo(horiz / len, 12);
    expect(up.y).toBeGreaterThan(0);
  });
});

describe("groundToScreen (정사영, 58.2 px/단위)", () => {
  const target = { x: 1.25, z: -2.5 };

  it("주시점(목표 위 높이 0.6)은 캔버스 가운데로 간다: 390×844 오프셋 0 → (195, 422), 오프셋 13 → sy 409", () => {
    const look = { x: target.x, y: LOOK_Y, z: target.z };
    const a = groundToScreen(look, target, { w: 390, h: 844 }, 0);
    expect(a.sx).toBeCloseTo(195, 9);
    expect(a.sy).toBeCloseTo(422, 9);
    const b = groundToScreen(look, target, { w: 390, h: 844 }, 13);
    expect(b.sx).toBeCloseTo(195, 9);
    expect(b.sy).toBeCloseTo(409, 9);
  });

  it("화면 위쪽 벡터 방향으로 월드 1단위 떨어진 점은 정확히 58.2px 위, 오른쪽 1단위는 58.2px 오른쪽", () => {
    const { right, up } = cameraBasis();
    const c = { w: 390, h: 844 };
    const look = { x: target.x, y: LOOK_Y, z: target.z };
    const base = groundToScreen(look, target, c, 0);
    const above = groundToScreen({ x: look.x + up.x, y: look.y + up.y, z: look.z + up.z }, target, c, 0);
    expect(above.sy).toBeCloseTo(base.sy - 58.2, 9);
    expect(above.sx).toBeCloseTo(base.sx, 9);
    const side = groundToScreen({ x: look.x + right.x, y: look.y + right.y, z: look.z + right.z }, target, c, 0);
    expect(side.sx).toBeCloseTo(base.sx + 58.2, 9);
    expect(side.sy).toBeCloseTo(base.sy, 9);
  });

  it("배율은 폰 크기와 무관하다: 같은 바닥 점 차이는 어느 캔버스에서나 같은 픽셀 차이", () => {
    const p0 = { x: 0, y: 0, z: 0 };
    const p1 = { x: 2, y: 0, z: 1 };
    const diffs = PHONES.map((c) => {
      const a = groundToScreen(p0, target, c, 0);
      const b = groundToScreen(p1, target, c, 0);
      return { dx: b.sx - a.sx, dy: b.sy - a.sy };
    });
    expect(Math.abs(diffs[0].dx)).toBeGreaterThan(1);
    for (const d of diffs) {
      expect(d.dx).toBeCloseTo(diffs[0].dx, 9);
      expect(d.dy).toBeCloseTo(diffs[0].dy, 9);
    }
  });
});

describe("screenToGround", () => {
  it("임의 바닥 점 20개(시드 고정) × 폰 크기 6개: screenToGround(groundToScreen(p)) ≈ p (오차 1e-6 이하)", () => {
    const rand = rng(20261101);
    for (let i = 0; i < 20; i++) {
      const p = { x: (rand() - 0.5) * 12, y: 0, z: (rand() - 0.5) * 12 };
      const target = { x: (rand() - 0.5) * 8, z: (rand() - 0.5) * 8 };
      for (const c of PHONES) {
        const offsetY = stageOffsetY(c.h, 62, c.h - 88);
        const s = groundToScreen(p, target, c, offsetY);
        const g = screenToGround(s.sx, s.sy, target, c, offsetY);
        expect(Math.abs(g.x - p.x)).toBeLessThan(1e-6);
        expect(Math.abs(g.z - p.z)).toBeLessThan(1e-6);
      }
    }
  });

  it("바닥 점이 화면 좌표로 갔다가 같은 바닥 점으로 돌아온다 (정석 한 점: 가운데 화면 점은 목표 앞 바닥으로)", () => {
    const target = { x: 0, z: 0 };
    const c = { w: 390, h: 844 };
    const g = screenToGround(195, 422, target, c, 0);
    // 주시점 (0, 0.6, 0) 을 지나는 광선이 y=0 에 닿는 점: 주시점 − back × (0.6 / back.y)
    const { back } = cameraBasis();
    expect(g.x).toBeCloseTo(-back.x * (LOOK_Y / back.y), 9);
    expect(g.z).toBeCloseTo(-back.z * (LOOK_Y / back.y), 9);
  });

  it("screenRay 의 방향은 −back 이고 광선이 y=0 에 닿는 점이 screenToGround 와 같다", () => {
    const target = { x: -1, z: 2 };
    const c = { w: 402, h: 874 };
    const offsetY = stageOffsetY(c.h, 62, c.h - 88);
    const { back } = cameraBasis();
    const r = screenRay(120, 300, target, c, offsetY);
    expect(r.dir.x).toBeCloseTo(-back.x, 12);
    expect(r.dir.y).toBeCloseTo(-back.y, 12);
    expect(r.dir.z).toBeCloseTo(-back.z, 12);
    expect(r.origin.y).toBeGreaterThan(5);
    const t = r.origin.y / -r.dir.y;
    const hit = { x: r.origin.x + r.dir.x * t, z: r.origin.z + r.dir.z * t };
    const g = screenToGround(120, 300, target, c, offsetY);
    expect(hit.x).toBeCloseTo(g.x, 9);
    expect(hit.z).toBeCloseTo(g.z, 9);
  });
});

describe("스테이지 사각형과 세로 오프셋", () => {
  it("stageOffsetY(844, 62, 844−88) = 422 − (62 + (844−88−62)/2) = 13", () => {
    expect(stageOffsetY(844, 62, 844 - 88)).toBe(13);
  });

  it("stageOffsetY: 스테이지가 캔버스 가운데면 0, 위로 치우치면 음수·아래로 치우치면 양수", () => {
    expect(stageOffsetY(800, 100, 700)).toBe(0);
    expect(stageOffsetY(800, 0, 600)).toBe(100);
    expect(stageOffsetY(800, 200, 800)).toBe(-100);
  });

  it("stageRect: 위 62 ~ 아래 패널 위 끝(높이 − 88), 폭 전체. 패널 높이를 넘기면 따라간다", () => {
    expect(stageRect({ w: 390, h: 844 })).toEqual({ top: 62, bottom: 756, left: 0, right: 390 });
    expect(stageRect({ w: 360, h: 560 })).toEqual({ top: 62, bottom: 472, left: 0, right: 360 });
    expect(stageRect({ w: 390, h: 844 }, 200)).toEqual({ top: 62, bottom: 644, left: 0, right: 390 });
  });

  it("내 캐릭터(목표 위 높이 0.6)는 스테이지 사각형 가운데에 온다 (오프셋 적용 후 sy = 스테이지 가운데)", () => {
    for (const c of PHONES) {
      const r = stageRect(c);
      const offsetY = stageOffsetY(c.h, r.top, r.bottom);
      const s = groundToScreen({ x: 0.3, y: LOOK_Y, z: 0.7 }, { x: 0.3, z: 0.7 }, c, offsetY);
      expect(s.sx).toBeCloseTo(c.w / 2, 9);
      expect(s.sy).toBeCloseTo((r.top + r.bottom) / 2, 9);
    }
  });
});

describe("clampTarget", () => {
  it("상자 밖 점은 상자 모서리로, 상자 안 점은 그대로", () => {
    expect(clampTarget({ x: 9, z: -9 })).toEqual({ x: PAN_BOX.maxX, z: PAN_BOX.minZ });
    expect(clampTarget({ x: -9, z: 9 })).toEqual({ x: PAN_BOX.minX, z: PAN_BOX.maxZ });
    expect(clampTarget({ x: 0.5, z: -0.25 })).toEqual({ x: 0.5, z: -0.25 });
    expect(clampTarget({ x: PAN_BOX.maxX, z: PAN_BOX.minZ })).toEqual({ x: PAN_BOX.maxX, z: PAN_BOX.minZ });
  });

  it("축별로 따로 자른다: 한 축만 넘으면 그 축만 바뀐다", () => {
    expect(clampTarget({ x: 99, z: 0.5 })).toEqual({ x: PAN_BOX.maxX, z: 0.5 });
    expect(clampTarget({ x: 0.5, z: -99 })).toEqual({ x: 0.5, z: PAN_BOX.minZ });
  });

  it("상자를 따로 넘기면 그 상자로 자른다", () => {
    const box = { minX: -1, maxX: 2, minZ: -3, maxZ: 4 };
    expect(clampTarget({ x: 5, z: 5 }, box)).toEqual({ x: 2, z: 4 });
    expect(clampTarget({ x: -5, z: -5 }, box)).toEqual({ x: -1, z: -3 });
  });
});

describe("followStep (프레임 독립 감쇠, UI-SPEC E4)", () => {
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

  it("거리 10 에서 dt 350ms 한 번 → 남은 거리 1.0 ± 0.01 (거리의 90% 를 줄임)", () => {
    const next = followStep({ x: 0, z: 0 }, { x: 6, z: 8 }, 350, false);
    expect(dist(next, { x: 6, z: 8 })).toBeGreaterThan(0.99);
    expect(dist(next, { x: 6, z: 8 })).toBeLessThan(1.01);
  });

  it("방향은 목표 쪽 직선 위에서 줄어든다", () => {
    const next = followStep({ x: 0, z: 0 }, { x: 6, z: 8 }, 350, false);
    expect(next.x / next.z).toBeCloseTo(6 / 8, 9);
    expect(next.x).toBeGreaterThan(0);
  });

  it("dt 16.67ms × 21번 = 350ms 한 번과 남은 거리가 1% 안으로 같다 (프레임 독립)", () => {
    const target = { x: 6, z: 8 };
    let cam = { x: 0, z: 0 };
    for (let i = 0; i < 21; i++) cam = followStep(cam, target, 16.67, false);
    const once = followStep({ x: 0, z: 0 }, target, 350, false);
    const a = dist(cam, target);
    const b = dist(once, target);
    expect(Math.abs(a - b) / b).toBeLessThan(0.01);
  });

  it("모션 줄이기면 즉시 목표에 붙는다", () => {
    expect(followStep({ x: -3, z: 2 }, { x: 6, z: 8 }, 16, true)).toEqual({ x: 6, z: 8 });
  });

  it("이미 도착했으면 그대로 두고, 아주 가까우면 목표에 붙어 멈춘다", () => {
    expect(followStep({ x: 1, z: 1 }, { x: 1, z: 1 }, 16, false)).toEqual({ x: 1, z: 1 });
    expect(followStep({ x: 1, z: 1 }, { x: 1.0001, z: 1 }, 16, false)).toEqual({ x: 1.0001, z: 1 });
  });

  it("dt 가 0 이하이면 움직이지 않는다", () => {
    expect(followStep({ x: 0, z: 0 }, { x: 5, z: 5 }, 0, false)).toEqual({ x: 0, z: 0 });
    expect(followStep({ x: 0, z: 0 }, { x: 5, z: 5 }, -10, false)).toEqual({ x: 0, z: 0 });
  });
});

// ───────────────────────── Task 2: 6개 폰 크기 × 걷는 영역 전 격자점 ─────────────────────────

type Size = { w: number; h: number; label: string };
type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

const symBox = (p: number): Box => ({ minX: -p, maxX: p, minZ: -p, maxZ: p });

/** 걷는 영역 [−5.8, 5.8]² 의 0.25 간격 모든 점(끝점 5.8 포함) */
function walkPoints(): { x: number; z: number }[] {
  const axis: number[] = [];
  for (let k = 0; -WALK_HALF + 0.25 * k < WALK_HALF - 1e-9; k++) axis.push(-WALK_HALF + 0.25 * k);
  axis.push(WALK_HALF);
  const out: { x: number; z: number }[] = [];
  for (const x of axis) for (const z of axis) out.push({ x, z });
  return out;
}

interface Failure {
  p: { x: number; z: number };
  target: { x: number; z: number };
  overflow: number;
  what: string;
}

/** 크기 하나에서 상자 box 로 카메라를 자를 때 발·이름표 상자가 스테이지 사각형을 넘는 점들 */
function visibilityFailures(size: Size, box: Box): Failure[] {
  const r = stageRect(size);
  const offsetY = stageOffsetY(size.h, r.top, r.bottom);
  const fails: Failure[] = [];
  for (const p of walkPoints()) {
    const target = clampTarget(p, box);
    const foot = groundToScreen({ x: p.x, y: 0, z: p.z }, target, size, offsetY);
    const head = groundToScreen({ x: p.x, y: HEAD_TOP_Y, z: p.z }, target, size, offsetY);
    const tag = { left: head.sx - NAMETAG_MAX_W / 2, right: head.sx + NAMETAG_MAX_W / 2, bottom: head.sy - NAMETAG_GAP, top: head.sy - NAMETAG_GAP - NAMETAG_H };
    const checks: [string, number][] = [
      ["발이 왼쪽 밖", r.left - foot.sx],
      ["발이 오른쪽 밖", foot.sx - r.right],
      ["발이 위 밖", r.top - foot.sy],
      ["발이 아래 밖", foot.sy - r.bottom],
      ["이름표가 왼쪽 밖", r.left - tag.left],
      ["이름표가 오른쪽 밖", tag.right - r.right],
      ["이름표가 위 밖", r.top - tag.top],
      ["이름표가 아래 밖", tag.bottom - r.bottom],
    ];
    let worst: [string, number] = ["", 1e-9];
    for (const c of checks) if (c[1] > worst[1]) worst = c;
    if (worst[0] !== "") fails.push({ p, target, overflow: worst[1], what: worst[0] });
  }
  return fails;
}

function describeFailure(size: Size, f: Failure): string {
  return `${size.label} 점 (${f.p.x}, ${f.p.z}) 목표 (${f.target.x}, ${f.target.z}) ${f.what} ${f.overflow.toFixed(1)}px`;
}

/** 이동 한계 상자의 9개 목표(모서리 4 · 변 가운데 4 · 가운데) */
function boxTargets(box: Box): { x: number; z: number }[] {
  const xs = [box.minX, (box.minX + box.maxX) / 2, box.maxX];
  const zs = [box.minZ, (box.minZ + box.maxZ) / 2, box.maxZ];
  const out: { x: number; z: number }[] = [];
  for (const x of xs) for (const z of zs) out.push({ x, z });
  return out;
}

/** 크기 하나에서 스테이지 사각형 7×7 표본점의 광선이 바닥(y=0)에 닿는 점의 최대 |x|·|z| 와 그 자리 */
function farthestGround(size: Size, box: Box): { far: number; at: string } {
  const r = stageRect(size);
  const offsetY = stageOffsetY(size.h, r.top, r.bottom);
  let far = 0;
  let at = "";
  for (const target of boxTargets(box)) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const sx = r.left + ((r.right - r.left) * i) / 6;
        const sy = r.top + ((r.bottom - r.top) * j) / 6;
        const g = screenToGround(sx, sy, target, size, offsetY);
        const m = Math.max(Math.abs(g.x), Math.abs(g.z));
        if (m > far) {
          far = m;
          at = `${size.label} 목표 (${target.x}, ${target.z}) 화면점 (${sx}, ${sy}) → 바닥 (${g.x.toFixed(2)}, ${g.z.toFixed(2)})`;
        }
      }
    }
  }
  return { far, at };
}

/** 가시성을 통과하는 가장 좁은 대칭 상자 반폭(0.1 단위) */
function minPanFor(size: Size): number {
  for (let k = 0; k <= 58; k++) if (visibilityFailures(size, symBox(k / 10)).length === 0) return k / 10;
  return Number.POSITIVE_INFINITY;
}

describe("STAGE_SIZES (UI-SPEC 폰 크기 표)", () => {
  it("정확히 6개이고 label 은 폭x높이", () => {
    expect(STAGE_SIZES.map((s) => s.label)).toEqual(["360x640", "390x664", "430x932", "360x560", "390x844", "402x874"]);
    for (const s of STAGE_SIZES) expect(s.label).toBe(`${s.w}x${s.h}`);
  });

  it("스테이지 사각형 높이는 UI-SPEC 표와 같다 (490·514·782·410·694·724)", () => {
    const heights = STAGE_SIZES.map((s) => {
      const r = stageRect(s);
      return r.bottom - r.top;
    });
    expect(heights).toEqual([490, 514, 782, 410, 694, 724]);
  });
});

describe("가시성: 걷는 영역 전 격자점 × 6개 폰 크기 (UI-SPEC E1 overflow)", () => {
  it("격자점은 0.25 간격 [−5.8, 5.8]² 이다 (축마다 −5.8…5.7 의 47개에 끝점 5.8 을 더한 48개, 모두 2304점)", () => {
    const pts = walkPoints();
    expect(pts.length).toBe(48 * 48);
    expect(pts[0]).toEqual({ x: -WALK_HALF, z: -WALK_HALF });
    expect(pts[pts.length - 1]).toEqual({ x: WALK_HALF, z: WALK_HALF });
  });

  for (const size of STAGE_SIZES) {
    it(`visible ${size.label}: 모든 격자점에서 발과 이름표(180×24)가 스테이지 사각형 안에 있다 (PAN_BOX 로 자른 카메라)`, () => {
      const fails = visibilityFailures(size, PAN_BOX);
      const worst = fails.sort((a, b) => b.overflow - a.overflow)[0];
      expect(fails.length, worst ? `${fails.length}점 실패, 최악: ${describeFailure(size, worst)}` : "").toBe(0);
    });
  }

  it("PAN_BOX 는 축마다 대칭이고 걷는 영역(±5.8)을 넘지 않는다", () => {
    expect(PAN_BOX.minX).toBe(-PAN_BOX.maxX);
    expect(PAN_BOX.minZ).toBe(-PAN_BOX.maxZ);
    expect(PAN_BOX.maxX).toBe(PAN_BOX.maxZ);
    expect(PAN_BOX.maxX).toBeLessThanOrEqual(WALK_HALF);
    expect(PAN_BOX.maxX).toBeGreaterThan(0);
  });

  it("PAN_BOX 는 가시성을 통과하는 가장 좁은 0.1 단위 값이다 (0.1 더 좁히면 어느 한 크기가 넘친다)", () => {
    const needed = Math.max(...STAGE_SIZES.map(minPanFor));
    expect(PAN_BOX.maxX).toBeCloseTo(needed, 9);
    const narrower = symBox(Math.round((PAN_BOX.maxX - 0.1) * 10) / 10);
    expect(STAGE_SIZES.some((s) => visibilityFailures(s, narrower).length > 0)).toBe(true);
  });

  it("카메라가 한계에 걸리지 않는 안쪽 점(|x|,|z| ≤ PAN)에서는 캐릭터가 스테이지 사각형 가운데에 온다", () => {
    for (const size of STAGE_SIZES) {
      const r = stageRect(size);
      const offsetY = stageOffsetY(size.h, r.top, r.bottom);
      const p = { x: 1.5, z: -2 };
      const s = groundToScreen({ x: p.x, y: LOOK_Y, z: p.z }, clampTarget(p), size, offsetY);
      expect(s.sx).toBeCloseTo(size.w / 2, 9);
      expect(s.sy).toBeCloseTo((r.top + r.bottom) / 2, 9);
    }
  });
});

describe("빈 배경 없음: 이동 한계 상자 9개 목표 × 스테이지 사각형 7×7 표본 (연장 판 PLATE_FAR)", () => {
  for (const size of STAGE_SIZES) {
    it(`blank ${size.label}: 모든 표본 광선이 연장 판(|x|,|z| ≤ PLATE_FAR) 위 바닥에 닿는다`, () => {
      const { far, at } = farthestGround(size, PAN_BOX);
      expect(far, `${at} (PLATE_FAR ${PLATE_FAR})`).toBeLessThanOrEqual(PLATE_FAR);
    });
  }

  it("PLATE_FAR 는 빈 배경 검사가 통과하는 가장 작은 0.5 단위 값에 여유 2 를 더한 값이다", () => {
    const needed = Math.max(...STAGE_SIZES.map((s) => farthestGround(s, PAN_BOX).far));
    const minimal = Math.ceil(needed * 2) / 2;
    expect(PLATE_FAR).toBe(minimal + 2);
    expect(needed).toBeLessThanOrEqual(PLATE_FAR - 2);
    expect(needed).toBeGreaterThan(PLATE_FAR - 2.5);
  });

  it("스테이지 사각형 밖(헤더 가림막 위)까지 보이는 윗부분도 판 안이다: 캔버스 맨 위 줄에서도 PLATE_FAR 안", () => {
    for (const size of STAGE_SIZES) {
      const r = stageRect(size);
      const offsetY = stageOffsetY(size.h, r.top, r.bottom);
      for (const target of boxTargets(PAN_BOX)) {
        for (const sx of [0, size.w / 2, size.w]) {
          const g = screenToGround(sx, 0, target, size, offsetY);
          expect(Math.max(Math.abs(g.x), Math.abs(g.z)), `${size.label} (${target.x}, ${target.z}) 위 줄`).toBeLessThanOrEqual(PLATE_FAR);
        }
      }
    }
  });
});

// CAMERA_PRINT=1 일 때만 크기별 근거 표를 출력한다(SUMMARY 용).
describe.runIf(process.env.CAMERA_PRINT === "1")("근거 표 출력", () => {
  it("크기별 필요 pan·가장 먼 바닥 점", () => {
    const rows = STAGE_SIZES.map((s) => `${s.label}\t최소 pan ${minPanFor(s)}\t가장 먼 바닥 ${farthestGround(s, PAN_BOX).at}`);
    console.log(rows.join("\n"));
  });
});
