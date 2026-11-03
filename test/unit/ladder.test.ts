// @vitest-environment happy-dom
// 강등 사다리(UI-SPEC "미달 때 줄이는 순서")·자동 강등 판정·예산 적용·재생성·통계를 검사한다.
// WebGLRenderer 는 가짜로 바꾼다(vi.mock): 진짜 WebGL 이 필요한 확인은 06-14·06-18 의 브라우저가 한다 (가정 A2).
import { DirectionalLight, Mesh, Object3D, PointLight, WebGLRenderer } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildBarScene } from "../../src/world/maps/bar";
import { DEFAULT_BUDGET_STEP, DRAW_CALL_BUDGET, LADDER, nextLadderStep, pixelRatioFor, UnsupportedRendererError } from "../../src/world/renderer";
import type { RendererStatusEvent } from "../../src/world/renderer";
import { createThreeRenderer } from "../../src/world/threeRenderer";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class FakeGL {
    static instances: FakeGL[] = [];
    static rendererName = "Mock GPU";
    static withLoseExt = true;
    domElement: HTMLCanvasElement;
    shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    toneMapping = 0;
    outputColorSpace = "";
    toneMappingExposure = 1;
    info = { render: { calls: 7, triangles: 99 }, memory: { geometries: 3, textures: 2 }, programs: [1, 2, 3, 4] };
    pixelRatio = 1;
    size: [number, number] = [0, 0];
    renders = 0;
    disposed = false;
    lossForced = 0;
    loseCalls = 0;
    restoreCalls = 0;
    lost = false;
    constructor(public params: { canvas: HTMLCanvasElement }) {
      this.domElement = params.canvas;
      FakeGL.instances.push(this);
    }
    getContext() {
      return {
        getExtension: (name: string) => {
          if (name === "WEBGL_debug_renderer_info") return { UNMASKED_RENDERER_WEBGL: 1 };
          if (name === "WEBGL_lose_context" && FakeGL.withLoseExt) return { loseContext: () => this.loseCalls++, restoreContext: () => this.restoreCalls++ };
          return null;
        },
        getParameter: () => FakeGL.rendererName,
        isContextLost: () => this.lost,
      };
    }
    setPixelRatio(v: number) {
      this.pixelRatio = v;
    }
    setSize(w: number, h: number) {
      this.size = [w, h];
    }
    render() {
      this.renders++;
    }
    dispose() {
      this.disposed = true;
    }
    forceContextLoss() {
      this.lossForced++;
    }
    forceContextRestore() {}
  }
  return { ...actual, WebGLRenderer: FakeGL };
});

interface FakeGLInstance {
  domElement: HTMLCanvasElement;
  shadowMap: { enabled: boolean; autoUpdate: boolean; needsUpdate: boolean };
  pixelRatio: number;
  size: [number, number];
  renders: number;
  disposed: boolean;
  lossForced: number;
  loseCalls: number;
  restoreCalls: number;
  lost: boolean;
}
interface FakeCtor {
  instances: FakeGLInstance[];
  rendererName: string;
  withLoseExt: boolean;
}
const Fake = WebGLRenderer as unknown as FakeCtor;

/** 보이는 메시(visible 이고 조상도 visible) 수. barScene.test.ts 의 같은 이름 도우미와 같은 뜻 */
function visibleMeshCount(root: Object3D): number {
  let n = 0;
  root.traverseVisible((o) => {
    if ((o as Mesh).isMesh) n++;
  });
  return n;
}
function pointLightsOf(root: Object3D): PointLight[] {
  const out: PointLight[] = [];
  root.traverse((o) => {
    if (o instanceof PointLight) out.push(o);
  });
  return out;
}

describe("LADDER (UI-SPEC 단계 1~5 누적)", () => {
  it("길이 6(0~5), 0 이 기본: dpr 상한 2 · 그림자 1024 · 점광원 full · 소품 full · 안개·빛 무리 켬", () => {
    expect(LADDER).toHaveLength(6);
    expect(DEFAULT_BUDGET_STEP).toBe(0);
    expect(LADDER[0]).toEqual({ dpr: 2, shadowMap: 1024, lights: "full", props: "full", fog: true, glows: true });
  });

  it("1 = dpr 1.5, 2 = dpr 1.25 + 그림자 512, 3 = 점광원 core, 4 = 소품 reduced, 5 = 안개·빛 무리 끔(누적)", () => {
    expect(LADDER[1]).toEqual({ dpr: 1.5, shadowMap: 1024, lights: "full", props: "full", fog: true, glows: true });
    expect(LADDER[2]).toEqual({ dpr: 1.25, shadowMap: 512, lights: "full", props: "full", fog: true, glows: true });
    expect(LADDER[3]).toEqual({ dpr: 1.25, shadowMap: 512, lights: "core", props: "full", fog: true, glows: true });
    expect(LADDER[4]).toEqual({ dpr: 1.25, shadowMap: 512, lights: "core", props: "reduced", fog: true, glows: true });
    expect(LADDER[5]).toEqual({ dpr: 1.25, shadowMap: 512, lights: "core", props: "reduced", fog: false, glows: false });
  });

  it("그림자 끔(shadowMap 0)은 사다리 어느 단계에도 없다 — 사람 결정으로만", () => {
    for (const b of LADDER) expect(b.shadowMap).not.toBe(0);
  });

  it("화면 배율은 장치 배율과 단계 상한 중 작은 쪽이다", () => {
    expect(pixelRatioFor(LADDER[0]!, 3)).toBe(2);
    expect(pixelRatioFor(LADDER[0]!, 1)).toBe(1);
    expect(pixelRatioFor(LADDER[1]!, 3)).toBe(1.5);
    expect(pixelRatioFor(LADDER[2]!, 2)).toBe(1.25);
  });

  it("그리기 호출 상한은 120", () => {
    expect(DRAW_CALL_BUDGET).toBe(120);
  });
});

describe("nextLadderStep (자동 강등)", () => {
  it("45fps 미만이면 0→1→2→3 까지만 한 단계씩", () => {
    expect(nextLadderStep(0, 44.9)).toBe(1);
    expect(nextLadderStep(1, 20)).toBe(2);
    expect(nextLadderStep(2, 30)).toBe(3);
    let s = 0;
    for (let i = 0; i < 10; i++) s = nextLadderStep(s, 30);
    expect(s).toBe(3);
  });
  it("4 이상은 사람 결정이라 올리지 않고, 45fps 이상이면 그대로, 되돌리지도 않는다", () => {
    expect(nextLadderStep(3, 10)).toBe(3);
    expect(nextLadderStep(4, 10)).toBe(4);
    expect(nextLadderStep(5, 10)).toBe(5);
    expect(nextLadderStep(1, 45)).toBe(1);
    expect(nextLadderStep(1, 60)).toBe(1);
  });
});

describe("BarScene 에 예산 반영 (재생성 없이)", () => {
  it("소품 reduced(4단계): 보이는 메시가 줄고 먼 소품만 빠진다 — 서는 자리·무대·바 카운터·탁자는 남는다", () => {
    const full = buildBarScene(LADDER[0]!);
    const red = buildBarScene(LADDER[4]!);
    expect(visibleMeshCount(red.root)).toBeLessThan(visibleMeshCount(full.root));
    for (const n of ["shell", "furniture", "brass", "emissiveRoom", "plate"]) expect(red.meshes[n]!.visible, n).toBe(true);
    for (const n of ["furnitureFar", "emissiveRoomFar", "pendants"]) {
      expect(red.meshes[n]!.visible, n).toBe(false);
      expect(full.meshes[n]!.visible, n).toBe(true);
    }
    full.dispose();
    red.dispose();
  });

  it("5단계: 빛 무리 메시가 모두 숨고 장면 안개가 null — 조명 단계를 바꿔도 그대로", () => {
    const bar = buildBarScene(LADDER[5]!);
    for (const phase of ["talk", "vote", "talk"] as const) {
      bar.setLighting(phase);
      expect(bar.meshes.glowRoom!.visible).toBe(false);
      expect(bar.meshes.glowVote!.visible).toBe(false);
      expect(bar.root.fog).toBeNull();
    }
    bar.dispose();
  });

  it("점광원 core(3단계): 펜던트 두 점광원은 꺼지고(세기 0·장면에서 빠짐) 무대 점광원은 vote 에서 유지", () => {
    const bar = buildBarScene(LADDER[3]!);
    bar.setLighting("talk");
    expect(bar.lights.pendantA.intensity).toBe(0);
    expect(bar.lights.pendantB.intensity).toBe(0);
    expect(bar.lights.pendantA.visible).toBe(false);
    bar.setLighting("vote");
    expect(bar.lights.pendantA.intensity).toBe(0);
    expect(bar.lights.stage.intensity).toBeGreaterThan(0);
    expect(bar.lights.stage.visible).toBe(true);
    expect(pointLightsOf(bar.root).filter((l) => l.visible)).toHaveLength(2); // 무대 + 내 캐릭터 빛(09-10, 광원 수 불변)
    bar.dispose();
  });

  it("applyBudget 은 되돌릴 수 있다: 5단계로 내렸다가 0단계로 올리면 처음과 같다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    const before = visibleMeshCount(bar.root);
    const pendant = bar.lights.pendantA.intensity;
    bar.applyBudget(LADDER[5]!);
    expect(visibleMeshCount(bar.root)).toBeLessThan(before);
    bar.applyBudget(LADDER[0]!);
    expect(visibleMeshCount(bar.root)).toBe(before);
    expect(bar.lights.pendantA.intensity).toBeCloseTo(pendant, 9);
    expect(bar.root.fog).not.toBeNull();
    bar.dispose();
  });

  it("그림자 맵 크기가 바뀌면 옛 그림자 맵을 버리고 새 크기를 쓴다(2단계 512)", () => {
    const bar = buildBarScene(LADDER[0]!);
    const moon = bar.root.children.find((o) => o instanceof DirectionalLight) as DirectionalLight;
    const disposed = vi.fn();
    moon.shadow.map = { dispose: disposed } as unknown as NonNullable<typeof moon.shadow.map>;
    bar.applyBudget(LADDER[2]!);
    expect(moon.shadow.mapSize.x).toBe(512);
    expect(moon.shadow.mapSize.y).toBe(512);
    expect(disposed).toHaveBeenCalled();
    expect(moon.shadow.map).toBeNull();
    bar.dispose();
  });
});

describe("threeRenderer: 예산·재생성·통계·해제 (가짜 WebGLRenderer)", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    Fake.instances.length = 0;
    Fake.rendererName = "Mock GPU";
    Fake.withLoseExt = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true });
  });
  afterEach(() => {
    host.remove();
  });
  const make = (budgetStep = 0, allowSoftware = false) => createThreeRenderer({ host, width: 390, height: 664, budgetStep, allowSoftware });

  it("만들면 캔버스가 host 에 붙고 장치 배율 3 은 단계 상한 2 로 잘리며, 맵 그림자는 한 번만 굽는 설정이다", async () => {
    const r = await make();
    const gl = Fake.instances[0]!;
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    expect(r.canvas).toBe(host.querySelector("canvas"));
    expect(gl.pixelRatio).toBe(2);
    expect(gl.size).toEqual([390, 664]);
    expect(gl.shadowMap.enabled).toBe(true);
    expect(gl.shadowMap.autoUpdate).toBe(false);
    expect(gl.shadowMap.needsUpdate).toBe(true);
    r.dispose();
  });

  it("setBudget: 배율·그림자·안개가 재생성 없이 바뀐다 (1단계 1.5, 2단계 1.25 + 그림자 다시 굽기)", async () => {
    const r = await make();
    const gl = Fake.instances[0]!;
    r.setBudget(1);
    expect(gl.pixelRatio).toBe(1.5);
    gl.shadowMap.needsUpdate = false;
    r.setBudget(2);
    expect(gl.pixelRatio).toBe(1.25);
    expect(gl.shadowMap.needsUpdate).toBe(true);
    expect(Fake.instances).toHaveLength(1);
    r.setBudget(99); // 범위 밖은 끝 단계로 자른다
    expect(gl.pixelRatio).toBe(1.25);
    r.dispose();
  });

  it("info(): 그리기 호출·삼각형·지오메트리·텍스처·프로그램·보이는 점광원 수. core 단계에서 점광원이 줄어든다", async () => {
    const r = await make();
    expect(r.info()).toEqual({ calls: 7, triangles: 99, geometries: 3, textures: 2, programs: 4, pointLights: 4 });
    r.setBudget(3);
    expect(r.info().pointLights).toBe(2);
    r.dispose();
  });

  it("render 는 현재 렌더러로 그리고, 소실·복구 이벤트는 구독자에게 알린다(복구 때 그림자를 다시 굽는다)", async () => {
    const r = await make();
    const gl = Fake.instances[0]!;
    const events: RendererStatusEvent[] = [];
    const off = r.onStatus((e) => events.push(e));
    r.render();
    expect(gl.renders).toBe(1);
    r.canvas.dispatchEvent(new Event("webglcontextlost"));
    gl.shadowMap.needsUpdate = false;
    r.canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(events).toEqual([{ t: "lost" }, { t: "restored" }]);
    expect(gl.shadowMap.needsUpdate).toBe(true);
    off();
    r.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(events).toHaveLength(2);
    r.dispose();
  });

  it("recreate: 옛 렌더러 dispose·forceContextLoss·캔버스 제거 → 새 캔버스·새 렌더러(같은 예산)로 한 번 그리고 'recreated' 를 알린다", async () => {
    const r = await make(2);
    const events: RendererStatusEvent[] = [];
    r.onStatus((e) => events.push(e));
    const oldCanvas = r.canvas;
    const oldGl = Fake.instances[0]!;
    await r.recreate();
    const newGl = Fake.instances[1]!;
    expect(Fake.instances).toHaveLength(2);
    expect(oldGl.disposed).toBe(true);
    expect(oldGl.lossForced).toBeGreaterThan(0);
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    expect(r.canvas).not.toBe(oldCanvas);
    expect(oldCanvas.isConnected).toBe(false);
    expect(newGl.pixelRatio).toBe(1.25); // 같은 예산(2단계)
    expect(newGl.size).toEqual([390, 664]);
    expect(newGl.renders).toBeGreaterThanOrEqual(1);
    expect(newGl.shadowMap.needsUpdate).toBe(true);
    expect(events).toEqual([{ t: "recreated" }]);
    // 새 캔버스의 소실은 알려지고 옛 캔버스는 더는 알리지 않는다
    oldCanvas.dispatchEvent(new Event("webglcontextlost"));
    expect(events).toHaveLength(1);
    r.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(events).toEqual([{ t: "recreated" }, { t: "lost" }]);
    r.render();
    expect(newGl.renders).toBeGreaterThanOrEqual(2);
    r.dispose();
  });

  it("recreate: 이미 잃은 컨텍스트에는 forceContextLoss 를 부르지 않는다 (three 가 WEBGL_lose_context 를 못 얻어 콘솔 경고를 남긴다, 06-18)", async () => {
    const r = await make(2);
    const oldGl = Fake.instances[0]!;
    oldGl.lost = true; // 소실 후 방치: 3초 뒤 재생성은 잃은 컨텍스트 위에서 일어난다
    await r.recreate();
    expect(oldGl.disposed).toBe(true);
    expect(oldGl.lossForced).toBe(0);
    expect(Fake.instances).toHaveLength(2);
    r.dispose();
  });

  it("recreate 뒤에도 캐릭터 그룹·시점·예산이 이어진다(같은 씬 재사용)", async () => {
    const r = await make();
    r.setView({ x: 1, z: 2 }, 30);
    const before = r.project({ x: 0, y: 0, z: 0 });
    r.setBudget(4);
    await r.recreate();
    const after = r.project({ x: 0, y: 0, z: 0 });
    expect(after.sx).toBeCloseTo(before.sx, 9);
    expect(after.sy).toBeCloseTo(before.sy, 9);
    expect(r.info().pointLights).toBe(2);
    r.dispose();
  });

  it("debugLoseContext/debugRestoreContext 는 WEBGL_lose_context 확장을 부르고, 확장이 없으면 아무것도 하지 않는다", async () => {
    const r = await make();
    const gl = Fake.instances[0]!;
    r.debugLoseContext();
    r.debugRestoreContext();
    expect(gl.loseCalls).toBe(1);
    expect(gl.restoreCalls).toBe(1);
    r.dispose();
    Fake.withLoseExt = false;
    const r2 = await make();
    expect(() => {
      r2.debugLoseContext();
      r2.debugRestoreContext();
    }).not.toThrow();
    r2.dispose();
  });

  it("dispose: 렌더러 dispose·forceContextLoss·캔버스 제거, 여러 번 불러도 안전하고 이후 이벤트·그리기는 없다", async () => {
    const r = await make();
    const gl = Fake.instances[0]!;
    const canvas = r.canvas;
    const events: RendererStatusEvent[] = [];
    r.onStatus((e) => events.push(e));
    r.dispose();
    r.dispose();
    expect(gl.disposed).toBe(true);
    expect(gl.lossForced).toBeGreaterThan(0);
    expect(canvas.isConnected).toBe(false);
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(events).toEqual([]);
    r.render();
    expect(gl.renders).toBe(0);
    await expect(r.recreate()).rejects.toBeInstanceOf(Error);
  });

  it("dispose: 이미 잃은 컨텍스트에는 forceContextLoss 를 부르지 않는다, 잃지 않은 컨텍스트에는 부른다", async () => {
    const lostR = await make();
    const lostGl = Fake.instances[0]!;
    lostGl.lost = true;
    lostR.dispose();
    expect(lostGl.disposed).toBe(true);
    expect(lostGl.lossForced).toBe(0);
    const liveR = await make();
    const liveGl = Fake.instances[1]!;
    liveR.dispose();
    expect(liveGl.lossForced).toBeGreaterThan(0);
  });

  it("소프트웨어 렌더러(SwiftShader·llvmpipe·Software)는 UnsupportedRendererError — allowSoftware 일 때만 예외", async () => {
    for (const name of ["Google SwiftShader", "llvmpipe (LLVM 15)", "Microsoft Basic Render Driver Software"]) {
      Fake.rendererName = name;
      Fake.instances.length = 0;
      await expect(make()).rejects.toBeInstanceOf(UnsupportedRendererError);
      expect(host.querySelector("canvas")).toBeNull();
      expect(Fake.instances[0]!.disposed).toBe(true);
    }
    Fake.rendererName = "Google SwiftShader";
    const r = await make(0, true);
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    r.dispose();
  });
});
