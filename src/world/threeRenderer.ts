// three 구현(WebGLRenderer). 이 파일은 three 를 값으로 import 하는 몇 안 되는 모듈이다 — 정적 import 경로(메인 번들)에
// 두지 않는다. 06-13 런타임이 `import()` 로만 열어 별도 청크로 나눈다. 렌더러 인터페이스는 renderer.ts(three 값 import 없음).
import { ACESFilmicToneMapping, Group, MeshBasicMaterial, PCFShadowMap, Plane, Raycaster, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from "three";
import { DEFAULT_TARGET } from "./camera";
import { buildBarScene } from "./maps/bar";
import { DEFAULT_BUDGET_STEP, LADDER, UnsupportedRendererError } from "./renderer";
import type { CharacterHandle, LightingPhase, MarkerKind, RendererStatusEvent, RendererStats, WorldRenderer } from "./renderer";
import { isSoftwareRenderer } from "./status";
import { configureCamera, createCamera } from "./threeCamera";

interface Opts {
  host: HTMLElement;
  width: number;
  height: number;
  budgetStep: number;
  allowSoftware: boolean;
}

function makeCanvas(host: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);
  return canvas;
}

/** 렌더러를 만든다. 컨텍스트를 못 만들면 캔버스를 치우고 UnsupportedRendererError */
function makeGl(canvas: HTMLCanvasElement, allowSoftware: boolean): WebGLRenderer {
  let gl: WebGLRenderer;
  try {
    gl = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  } catch (e) {
    canvas.remove();
    throw new UnsupportedRendererError(e instanceof Error ? e.message : "WebGL 을 만들 수 없다");
  }
  const ctx = gl.getContext();
  const info = ctx.getExtension("WEBGL_debug_renderer_info");
  const name = info ? String(ctx.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  if (!allowSoftware && isSoftwareRenderer(name)) {
    gl.dispose();
    gl.forceContextLoss();
    canvas.remove();
    throw new UnsupportedRendererError(`소프트웨어 렌더러: ${name}`);
  }
  gl.outputColorSpace = SRGBColorSpace;
  gl.toneMapping = ACESFilmicToneMapping;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = PCFShadowMap; // 0.186.1 에서 PCFSoftShadowMap 은 제거됐다
  gl.shadowMap.autoUpdate = false; // 맵 그림자는 한 번만 굽는다: 조명 단계 변경·컨텍스트 복구·재생성 때만 needsUpdate
  return gl;
}

async function build(opts: Opts): Promise<WorldRenderer> {
  const step = Math.min(Math.max(opts.budgetStep, DEFAULT_BUDGET_STEP), LADDER.length - 1);
  let canvas: HTMLCanvasElement;
  try {
    canvas = makeCanvas(opts.host);
  } catch (e) {
    throw new UnsupportedRendererError(e instanceof Error ? e.message : "캔버스를 만들 수 없다");
  }
  let gl = makeGl(canvas, opts.allowSoftware);

  const budget = LADDER[step]!;
  const bar = buildBarScene(budget);
  const scene = bar.root;
  const characters = new Group();
  scene.add(characters);
  const seats = new Map<number, CharacterHandle>();
  const camera = createCamera();

  let size = { w: opts.width, h: opts.height };
  let target = { x: DEFAULT_TARGET.x, z: DEFAULT_TARGET.z };
  let offsetY = 0;
  let disposed = false;
  const listeners = new Set<(e: RendererStatusEvent) => void>();
  const emit = (e: RendererStatusEvent): void => {
    for (const cb of [...listeners]) cb(e);
  };

  const applySize = (): void => {
    gl.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, budget.dpr));
    gl.setSize(size.w, size.h, false);
    configureCamera(camera, target, size, offsetY);
  };
  applySize();
  gl.toneMappingExposure = bar.exposure;
  gl.shadowMap.needsUpdate = true; // 맵 그림자는 첫 그리기에서 한 번 굽는다

  // three 가 자기 리스너로 preventDefault 하고 render 를 건너뛴다(WebGLRenderer.js onContextLost). 우리는 알리기만 한다.
  const onLost = (): void => emit({ t: "lost" });
  const onRestored = (): void => {
    gl.shadowMap.needsUpdate = true;
    emit({ t: "restored" });
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const ray = new Raycaster();
  const floor = new Plane(new Vector3(0, 1, 0), 0);

  return {
    get canvas(): HTMLCanvasElement {
      return canvas;
    },
    resize(w: number, h: number): void {
      size = { w, h };
      applySize();
    },
    setView(t: { x: number; z: number }, off: number): void {
      target = { x: t.x, z: t.z };
      offsetY = off;
      configureCamera(camera, target, size, offsetY);
    },
    setLighting(phase: LightingPhase): void {
      bar.setLighting(phase);
      gl.toneMappingExposure = bar.exposure;
      gl.shadowMap.needsUpdate = true; // 조명 단계가 바뀌면 그림자를 다시 굽는다
    },
    addCharacter(seat: number, c: CharacterHandle): void {
      const prev = seats.get(seat);
      if (prev) characters.remove(prev.root);
      seats.set(seat, c);
      characters.add(c.root);
    },
    removeCharacter(seat: number): void {
      const c = seats.get(seat);
      if (!c) return;
      characters.remove(c.root);
      seats.delete(seat);
    },
    setMarker(kind: MarkerKind, at: { x: number; z: number } | null, scale: number, opacity: number): void {
      const mk = bar.markers[kind];
      if (at === null) {
        mk.group.visible = false;
        return;
      }
      mk.group.visible = true;
      mk.group.position.x = at.x;
      mk.group.position.z = at.z;
      mk.group.scale.setScalar(scale);
      (mk.ring.material as MeshBasicMaterial).opacity = opacity;
      (mk.outline.material as MeshBasicMaterial).opacity = 0.6 * opacity;
    },
    project(p: { x: number; y: number; z: number }): { sx: number; sy: number } {
      const v = new Vector3(p.x, p.y, p.z).project(camera);
      return { sx: ((v.x + 1) / 2) * size.w, sy: ((1 - v.y) / 2) * size.h };
    },
    groundAt(sx: number, sy: number): { x: number; z: number } {
      ray.setFromCamera(new Vector2((sx / size.w) * 2 - 1, -((sy / size.h) * 2 - 1)), camera);
      const hit = ray.ray.intersectPlane(floor, new Vector3());
      return hit ? { x: hit.x, z: hit.z } : { x: target.x, z: target.z };
    },
    render(): void {
      if (disposed) return;
      gl.render(scene, camera);
    },
    setBudget(_step: number): void {
      // Task 3
    },
    onStatus(cb: (e: RendererStatusEvent) => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    recreate(): Promise<void> {
      return Promise.reject(new Error("Task 3 에서 구현"));
    },
    isContextLost(): boolean {
      return gl.getContext().isContextLost();
    },
    info(): RendererStats {
      const r = gl.info;
      return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures, programs: r.programs?.length ?? 0, pointLights: 3 };
    },
    debugLoseContext(): void {
      gl.forceContextLoss();
    },
    debugRestoreContext(): void {
      gl.forceContextRestore();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      listeners.clear();
      // 캐릭터 자원은 만든 쪽(handle.dispose)이 정리한다. 여기서는 장면에서 떼기만 한다.
      for (const c of seats.values()) characters.remove(c.root);
      seats.clear();
      bar.dispose();
      gl.dispose();
      gl.forceContextLoss();
      canvas.remove();
    },
  };
}

/** 렌더러를 만든다. 실패는 모두 거부(reject)로 알린다: 컨텍스트·소프트웨어 렌더러는 UnsupportedRendererError */
export function createThreeRenderer(opts: Opts): Promise<WorldRenderer> {
  return build(opts);
}
