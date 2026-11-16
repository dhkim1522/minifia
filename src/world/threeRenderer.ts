// three 구현(WebGLRenderer). 이 파일은 three 를 값으로 import 하는 몇 안 되는 모듈이다 — 정적 import 경로(메인 번들)에
// 두지 않는다. 06-13 런타임이 `import()` 로만 열어 별도 청크로 나눈다. 렌더러 인터페이스는 renderer.ts(three 값 import 없음).
import { ACESFilmicToneMapping, Group, MeshBasicMaterial, PCFShadowMap, Plane, PointLight, Raycaster, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from "three";
import type { MapId } from "../../shared/protocol";
import { DEFAULT_TARGET } from "./camera";
import { buildBarScene } from "./maps/bar";
import { buildPlazaScene } from "./maps/plaza";
import type { MapScene } from "./maps/types";
import { DEFAULT_BUDGET_STEP, LADDER, pixelRatioFor, UnsupportedRendererError } from "./renderer";
import type { CharacterHandle, LightingPhase, MarkerKind, RendererStatusEvent, RendererStats, WorldRenderer } from "./renderer";
import { isSoftwareRenderer } from "./status";
import { configureCamera, createCamera } from "./threeCamera";

interface Opts {
  host: HTMLElement;
  width: number;
  height: number;
  budgetStep: number;
  allowSoftware: boolean;
  /** 장면을 고르는 방의 맵 id(없으면 bar). 렌더러 생성 시점에 한 번 정해진다 — 한 렌더러 안에서 맵을 갈아 끼우지 않는다(D-22) */
  mapId?: MapId;
}

function makeCanvas(host: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);
  return canvas;
}

/**
 * 렌더러 자원을 해제한다. 이미 잃은 컨텍스트에는 forceContextLoss 를 부르지 않는다 — 잃은 컨텍스트는 WEBGL_lose_context 확장을 주지 않아
 * three 가 "extension not supported" 경고를 남긴다(소실 후 방치의 재생성에서 잡힘, 06-18). 잃은 컨텍스트는 이미 놓인 것이라 부를 이유도 없다.
 */
function releaseGl(gl: WebGLRenderer): void {
  gl.dispose();
  if (!gl.getContext().isContextLost()) gl.forceContextLoss();
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
  const clampStep = (n: number): number => Math.min(Math.max(Math.round(n) || 0, DEFAULT_BUDGET_STEP), LADDER.length - 1);
  let budget = LADDER[clampStep(opts.budgetStep)]!;
  let canvas: HTMLCanvasElement;
  try {
    canvas = makeCanvas(opts.host);
  } catch (e) {
    throw new UnsupportedRendererError(e instanceof Error ? e.message : "캔버스를 만들 수 없다");
  }
  let gl = makeGl(canvas, opts.allowSoftware);

  // 씬 그래프(맵·캐릭터)는 렌더러보다 오래 산다: recreate 가 새 렌더러에 같은 씬·카메라를 다시 물린다(가정 A2)
  // 맵 id 별 장면 빌더(결정 0050-2: 맵은 목록에 등록하면 늘어난다). 이름 bar 는 두 맵 공통의 "맵 장면"이다
  const bar: MapScene = opts.mapId === "plaza" ? buildPlazaScene(budget) : buildBarScene(budget);
  const scene = bar.root;
  const characters = new Group();
  scene.add(characters);
  const seats = new Map<number, CharacterHandle>();
  const camera = createCamera();

  let size = { w: opts.width, h: opts.height };
  let target = { x: DEFAULT_TARGET.x, z: DEFAULT_TARGET.z };
  let offsetY = 0;
  let zoom = 1;
  let disposed = false;
  let lastTick = performance.now() / 1000;
  const listeners = new Set<(e: RendererStatusEvent) => void>();
  const emit = (e: RendererStatusEvent): void => {
    for (const cb of [...listeners]) cb(e);
  };

  const applySize = (): void => {
    gl.setPixelRatio(pixelRatioFor(budget, globalThis.devicePixelRatio || 1));
    gl.setSize(size.w, size.h, false);
    configureCamera(camera, target, size, offsetY, zoom);
  };
  /** 새 렌더러를 현재 상태(크기·시점·노출)에 맞추고 그림자를 다시 굽게 한다 */
  const configureGl = (): void => {
    applySize();
    gl.toneMappingExposure = bar.exposure;
    gl.shadowMap.needsUpdate = true;
  };
  configureGl();

  // three 가 자기 리스너로 preventDefault 하고 render 를 건너뛴다(WebGLRenderer.js onContextLost). 우리는 알리기만 한다.
  const onLost = (): void => emit({ t: "lost" });
  const onRestored = (): void => {
    gl.shadowMap.needsUpdate = true; // 복구 뒤 맵 그림자를 다시 굽는다
    emit({ t: "restored" });
  };
  const attach = (c: HTMLCanvasElement): void => {
    c.addEventListener("webglcontextlost", onLost);
    c.addEventListener("webglcontextrestored", onRestored);
  };
  const detach = (c: HTMLCanvasElement): void => {
    c.removeEventListener("webglcontextlost", onLost);
    c.removeEventListener("webglcontextrestored", onRestored);
  };
  attach(canvas);

  const ray = new Raycaster();
  const floor = new Plane(new Vector3(0, 1, 0), 0);
  const loseExt = (): { loseContext(): void; restoreContext(): void } | null => {
    try {
      return gl.getContext().getExtension("WEBGL_lose_context");
    } catch {
      return null;
    }
  };

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
      configureCamera(camera, target, size, offsetY, zoom);
    },
    setZoom(z: number): void {
      zoom = Number.isFinite(z) && z > 0 ? z : 1;
      configureCamera(camera, target, size, offsetY, zoom);
    },
    setSelfLight(at: { x: number; z: number } | null): void {
      bar.setSelfLight(at);
    },
    setChalk(at: { x: number; z: number } | null, opacity: number): void {
      bar.setChalk(at, opacity);
    },
    setTension(level: 0 | 1 | 2, focus?: { x: number; z: number }): void {
      bar.setTension(level, focus);
    },
    setPin(pin: { x: number; z: number; strength: number } | null, dim: number): void {
      bar.setPin(pin, dim);
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
      if (bar.update) {
        // 맵이 프레임마다 움직이는 것(광장 시계 바늘)이 있을 때만 시간을 잰다
        const now = performance.now() / 1000;
        bar.update(Math.min(0.25, Math.max(0, now - lastTick)), now);
        lastTick = now;
      }
      gl.render(scene, camera);
    },
    setBudget(next: number): void {
      if (disposed) return;
      budget = LADDER[clampStep(next)]!;
      bar.applyBudget(budget); // 점광원·소품·안개·빛 무리·그림자 맵 크기(재생성 없이)
      applySize();
      gl.shadowMap.needsUpdate = true; // 그림자 맵 크기·소품이 바뀌면 다시 굽는다
    },
    onStatus(cb: (e: RendererStatusEvent) => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    async recreate(): Promise<void> {
      if (disposed) throw new Error("이미 해제된 렌더러");
      // 옛 렌더러를 먼저 치운다(씬은 dispose 하지 않는다). 리스너를 먼저 떼어 forceContextLoss 의 소실 이벤트가 새어 나가지 않게 한다.
      detach(canvas);
      releaseGl(gl);
      canvas.remove();
      canvas = makeCanvas(opts.host);
      gl = makeGl(canvas, opts.allowSoftware);
      attach(canvas);
      configureGl();
      gl.render(scene, camera); // 같은 씬·카메라로 한 번 그려 자원을 다시 올린다
      gl.shadowMap.needsUpdate = true;
      emit({ t: "recreated" });
    },
    isContextLost(): boolean {
      return gl.getContext().isContextLost();
    },
    info(): RendererStats {
      const r = gl.info;
      let pointLights = 0;
      scene.traverseVisible((o) => {
        if ((o as PointLight).isPointLight) pointLights++;
      });
      return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures, programs: r.programs?.length ?? 0, pointLights };
    },
    debugLoseContext(): void {
      loseExt()?.loseContext();
    },
    debugRestoreContext(): void {
      loseExt()?.restoreContext();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      detach(canvas);
      listeners.clear();
      // 캐릭터 자원은 만든 쪽(handle.dispose)이 정리한다. 여기서는 장면에서 떼기만 한다.
      for (const c of seats.values()) characters.remove(c.root);
      seats.clear();
      bar.dispose();
      releaseGl(gl);
      canvas.remove();
    },
  };
}

/** 렌더러를 만든다. 실패는 모두 거부(reject)로 알린다: 컨텍스트·소프트웨어 렌더러는 UnsupportedRendererError */
export function createThreeRenderer(opts: Opts): Promise<WorldRenderer> {
  return build(opts);
}
