// @vitest-environment happy-dom
// three 정사영 카메라가 camera.ts 의 순수 수학과 같은 화면 좌표·바닥 교점을 낸다 (MAP-03).
// happy-dom 은 canvas.getContext 가 null 이라 "WebGL 을 만들 수 없는 기기" 경로를 그대로 재현한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { groundToScreen, PX_PER_UNIT, screenToGround, STAGE_SIZES, stageOffsetY, stageRect } from "../../src/world/camera";
import { nextLadderStep, UnsupportedRendererError } from "../../src/world/renderer";
import { configureCamera, createCamera } from "../../src/world/threeCamera";
import { createThreeRenderer } from "../../src/world/threeRenderer";

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

/** STAGE_SIZES 반복 도우미: 폰 크기마다 (크기, 목표, offsetY 0 과 stageOffsetY) 조합을 돌린다. Task 2 가 재사용하지 않아도 되지만 이름을 넘긴다 */
function forEachPhone(fn: (size: { w: number; h: number; label: string }, offsetY: number, target: { x: number; z: number }) => void): void {
  const targets = [
    { x: -0.4, z: -0.4 },
    { x: 3.2, z: -4.1 },
  ];
  for (const size of STAGE_SIZES) {
    const r = stageRect({ w: size.w, h: size.h });
    for (const offsetY of [0, stageOffsetY(size.h, r.top, r.bottom)]) for (const target of targets) fn(size, offsetY, target);
  }
}

describe("three 정사영 카메라 = camera.ts 순수 수학", () => {
  it("임의 점 50개 × 폰 6개: Vector3.project 결과와 groundToScreen 의 차이가 0.01px 이하", () => {
    const rand = rng(1010);
    const cam = createCamera();
    let checked = 0;
    forEachPhone((size, offsetY, target) => {
      configureCamera(cam, target, size, offsetY);
      for (let i = 0; i < 50; i++) {
        const p = { x: (rand() - 0.5) * 20, y: rand() * 3, z: (rand() - 0.5) * 20 };
        const ndc = new Vector3(p.x, p.y, p.z).project(cam);
        const sx = ((ndc.x + 1) / 2) * size.w;
        const sy = ((1 - ndc.y) / 2) * size.h;
        const ref = groundToScreen(p, target, size, offsetY);
        expect(Math.abs(sx - ref.sx)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(sy - ref.sy)).toBeLessThanOrEqual(0.01);
        checked++;
      }
    });
    expect(checked).toBe(6 * 2 * 2 * 50);
  });

  it("Raycaster 와 바닥 평면의 교점이 screenToGround 와 1e-4 단위 이하로 같다", () => {
    const rand = rng(2020);
    const cam = createCamera();
    const floor = new Plane(new Vector3(0, 1, 0), 0);
    const ray = new Raycaster();
    forEachPhone((size, offsetY, target) => {
      configureCamera(cam, target, size, offsetY);
      for (let i = 0; i < 20; i++) {
        const sx = rand() * size.w;
        const sy = rand() * size.h;
        ray.setFromCamera(new Vector2((sx / size.w) * 2 - 1, -((sy / size.h) * 2 - 1)), cam);
        const hit = ray.ray.intersectPlane(floor, new Vector3());
        expect(hit).not.toBeNull();
        const ref = screenToGround(sx, sy, target, size, offsetY);
        expect(Math.abs(hit!.x - ref.x)).toBeLessThanOrEqual(1e-4);
        expect(Math.abs(hit!.z - ref.z)).toBeLessThanOrEqual(1e-4);
      }
    });
  });

  it("프러스텀 높이 = 캔버스 높이 ÷ PX_PER_UNIT, 폭도 같은 배율(폰 크기와 무관한 고정 배율)", () => {
    const cam = createCamera();
    for (const size of STAGE_SIZES) {
      configureCamera(cam, { x: 0, z: 0 }, size, 0);
      expect(cam.top - cam.bottom).toBeCloseTo(size.h / PX_PER_UNIT, 9);
      expect(cam.right - cam.left).toBeCloseTo(size.w / PX_PER_UNIT, 9);
    }
  });

  it("offsetY 는 setViewOffset 으로 장면을 위로 올린다: 같은 점의 sy 가 offsetY 만큼 줄어든다", () => {
    const cam = createCamera();
    const size = { w: 390, h: 844 };
    const target = { x: 0, z: 0 };
    const at = (off: number) => {
      configureCamera(cam, target, size, off);
      const ndc = new Vector3(1, 0, 1).project(cam);
      return ((1 - ndc.y) / 2) * size.h;
    };
    expect(at(0) - at(70)).toBeCloseTo(70, 6);
  });
});

describe("카메라 zoom = camera.ts zoom (08-10, 가정 A1: 과반 연출 확대 1.08)", () => {
  const ZOOM = 1.08;
  /** 화면 안의 표본 월드 점 9개(목표 둘레 3×3) */
  const samples = (target: { x: number; z: number }) => {
    const out: { x: number; y: number; z: number }[] = [];
    for (const dx of [-3, 0, 3]) for (const dz of [-2.5, 0, 2.5]) out.push({ x: target.x + dx, y: dz === 0 ? 0 : 1.2, z: target.z + dz });
    return out;
  };

  it("표본 점 9개 × 폰 6개: Vector3.project 화면 좌표가 groundToScreen(…, 1.08) 과 1e-4 이하로 같다", () => {
    const cam = createCamera();
    let checked = 0;
    forEachPhone((size, offsetY, target) => {
      configureCamera(cam, target, size, offsetY, ZOOM);
      for (const p of samples(target)) {
        const ndc = new Vector3(p.x, p.y, p.z).project(cam);
        const sx = ((ndc.x + 1) / 2) * size.w;
        const sy = ((1 - ndc.y) / 2) * size.h;
        const ref = groundToScreen(p, target, size, offsetY, ZOOM);
        expect(Math.abs(sx - ref.sx)).toBeLessThanOrEqual(1e-4);
        expect(Math.abs(sy - ref.sy)).toBeLessThanOrEqual(1e-4);
        checked++;
      }
    });
    expect(checked).toBe(6 * 2 * 2 * 9);
  });

  it("바닥 Raycaster 교점이 screenToGround(…, 1.08) 과 1e-4 단위 이하로 같다", () => {
    const rand = rng(3030);
    const cam = createCamera();
    const floor = new Plane(new Vector3(0, 1, 0), 0);
    const ray = new Raycaster();
    forEachPhone((size, offsetY, target) => {
      configureCamera(cam, target, size, offsetY, ZOOM);
      for (let i = 0; i < 20; i++) {
        const sx = rand() * size.w;
        const sy = rand() * size.h;
        ray.setFromCamera(new Vector2((sx / size.w) * 2 - 1, -((sy / size.h) * 2 - 1)), cam);
        const hit = ray.ray.intersectPlane(floor, new Vector3());
        expect(hit).not.toBeNull();
        const ref = screenToGround(sx, sy, target, size, offsetY, ZOOM);
        expect(Math.abs(hit!.x - ref.x)).toBeLessThanOrEqual(1e-4);
        expect(Math.abs(hit!.z - ref.z)).toBeLessThanOrEqual(1e-4);
      }
    });
  });

  it("프러스텀 크기는 캔버스 ÷ (PX_PER_UNIT × zoom) 이고, zoom 을 생략하면 1 과 같다", () => {
    const cam = createCamera();
    const size = { w: 390, h: 844 };
    configureCamera(cam, { x: 0, z: 0 }, size, 0, ZOOM);
    expect(cam.top - cam.bottom).toBeCloseTo(size.h / (PX_PER_UNIT * ZOOM), 9);
    expect(cam.right - cam.left).toBeCloseTo(size.w / (PX_PER_UNIT * ZOOM), 9);
    configureCamera(cam, { x: 0, z: 0 }, size, 0);
    const omitted = cam.top - cam.bottom;
    configureCamera(cam, { x: 0, z: 0 }, size, 0, 1);
    expect(cam.top - cam.bottom).toBe(omitted);
    expect(omitted).toBeCloseTo(size.h / PX_PER_UNIT, 9);
  });

  it("zoom 1.08 에서도 offsetY 는 화면 픽셀 그대로 장면을 올린다(확대되지 않는다)", () => {
    const cam = createCamera();
    const size = { w: 390, h: 844 };
    const at = (off: number) => {
      configureCamera(cam, { x: 0, z: 0 }, size, off, ZOOM);
      const ndc = new Vector3(1, 0, 1).project(cam);
      return ((1 - ndc.y) / 2) * size.h;
    };
    expect(at(0) - at(70)).toBeCloseTo(70, 6);
  });
});

describe("renderer.ts (three 값 import 없음)", () => {
  it("`from \"three\"` 가 있는 줄은 모두 import type 이다", () => {
    const src = readFileSync(resolve(process.cwd(), "src/world/renderer.ts"), "utf8");
    const lines = src.split("\n").filter((l) => /from\s+["']three["']/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).toMatch(/^\s*import\s+type\b/);
    expect(src).not.toMatch(/from\s+["']three\/examples/);
  });
});

describe("nextLadderStep 기본 (확장은 ladder.test.ts)", () => {
  it("45fps 미만이고 step < 3 이면 한 단계 내린다", () => {
    expect(nextLadderStep(0, 44.9)).toBe(1);
    expect(nextLadderStep(2, 30)).toBe(3);
  });
  it("3단계 이상·45fps 이상이면 그대로(되돌리지 않음)", () => {
    expect(nextLadderStep(3, 10)).toBe(3);
    expect(nextLadderStep(1, 50)).toBe(1);
    expect(nextLadderStep(0, 45)).toBe(0);
  });
});

describe("createThreeRenderer 실패 경로", () => {
  it("WebGL 컨텍스트를 만들 수 없으면 UnsupportedRendererError 로 실패하고 캔버스를 남기지 않는다", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await expect(createThreeRenderer({ host, width: 390, height: 664, budgetStep: 0, allowSoftware: false })).rejects.toBeInstanceOf(UnsupportedRendererError);
    expect(host.querySelector("canvas")).toBeNull();
    host.remove();
  });
});
