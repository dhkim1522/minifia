import { describe, expect, it } from "vitest";
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
  PAN_BOX,
  PX_PER_UNIT,
  RESIZE_SETTLE_MS,
  screenRay,
  screenToGround,
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
