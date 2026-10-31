// ?perf=1 HUD·결과 카드·하트비트(RESEARCH R2.2). 측정 비용을 지킨다: 텍스트는 1Hz 로만 갱신하고, 접어 둘 수 있고,
// 프레임 델타 기록(FrameRecorder)은 HUD 가 보이든 숨었든 같은 코드다. 결과는 window.__mfPerf.result 와 결과 카드(스크린샷용)로만 남기고
// 서버로 보내지 않는다(T-06-31, RESEARCH R2.6 — 무인증 쓰기 면을 만들지 않는다).
import { APP_VERSION } from "../../../shared/version";
import type { RendererStats, WorldRenderer } from "../../world/renderer";
import { FRAME_CAPACITY, FrameRecorder, heartbeatVerdict, parseHeartbeat, percentile, summarizeFrames } from "./metrics";
import type { FrameSummary, Heartbeat, HeartbeatVerdict } from "./metrics";
import type { PerfParams } from "./scenario";

/** sessionStorage 의 하트비트 키: 5초마다 {state:"running", at}, 끝나면 {state:"finished"} */
export const HEARTBEAT_KEY = "minifia:perf:hb";
export const HEARTBEAT_MS = 5000;
/** 합격선(UI-SPEC "합격 기준"): 5분 평균 55fps 이상, 50ms 넘는 프레임이 5분에 5회 이하 */
export const PASS_AVG_FPS = 55;
export const PASS_JANK_5MIN = 5;
/** 가장 빠른 주사율(144Hz)로 잡은 프레임 기록 여유 — 120Hz 폰의 5분이 19,800칸을 넘기 때문 */
const MAX_HZ_FOR_CAPACITY = 150;

export interface DeviceInfo {
  ua: string;
  kakaotalk: boolean;
  dpr: number;
  screen: string;
  inner: string;
  cores: number | null;
  memoryGB: number | null;
  glRenderer: string | null;
  webdriver: boolean;
}

export interface PerfResult {
  /** 결과 JSON 의 모양 버전 */
  schema: 1;
  at: string;
  build: string;
  three: string;
  query: string;
  params: PerfParams;
  device: DeviceInfo;
  heartbeat: HeartbeatVerdict;
  /** 기록이 가득 차서 측정 시간이 끝나기 전에 멈췄다 */
  truncated: boolean;
  /** 마지막 사다리 단계(스파이크는 자동 강등이 꺼져 있어 처음 값 그대로다) */
  budgetStep: number;
  frames: FrameSummary;
  work: { tagsP95Ms: number; renderP95Ms: number; mapBuildMs: number | null; moduleLoadMs: number | null };
  renderer: (RendererStats & { callsMax: number }) | null;
  heap: { startMB: number | null; endMB: number | null; samplesMB: number[] };
  tapToRingMs: number[];
  /** performance.mark("map-interactive") 시각(페이지 시작 기준, ms) */
  interactiveMs: number | null;
  /** 합격선 대비. 5분(minutes ≥ 5)이 아니면 판정하지 않는다(null) */
  meets: { avgFps: boolean; jank: boolean } | null;
}

declare global {
  interface Window {
    __mfPerf?: { result: PerfResult | null };
  }
}

export interface HudInit {
  root: HTMLElement;
  params: PerfParams;
  /** location.search — 결과에 그대로 적는다 */
  query: string;
  threeRevision: string;
  renderer(): WorldRenderer | null;
  interactiveMs(): number | null;
  /** 측정 시간이 끝났을 때(결과가 나왔을 때) */
  onFinish?(r: PerfResult): void;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
}

export interface Hud {
  /** 맵이 열린 뒤 측정을 시작한다(기록을 비우고 시계·하트비트를 켠다) */
  begin(): void;
  /** rAF 콜백이 받은 시각마다 */
  frame(rafTimeMs: number): void;
  /** 런타임 프레임 훅(render 호출·이름표 투영·쓰기 CPU 시간) */
  work(stats: { renderMs: number; tagsMs: number }): void;
  /** 탭 → 링이 처음 그려진 프레임까지(ms) */
  tapRing(ms: number): void;
  setMapTimes(t: { mapBuildMs?: number; moduleLoadMs?: number }): void;
  /** 측정이 시작되기 전(불러오는 중·실패)에 보일 한 줄 */
  note(line: string): void;
  hide(): void;
  readonly finished: boolean;
  result(): PerfResult | null;
  dispose(): void;
}

function heapMB(): number | null {
  const m = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
  return typeof m?.usedJSHeapSize === "number" ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : null;
}

function glRendererOf(r: WorldRenderer | null): string | null {
  if (r === null) return null;
  try {
    const gl = (r.canvas.getContext("webgl2") ?? r.canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl === null) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "(가려짐)";
  } catch {
    return null;
  }
}

export function deviceInfo(r: WorldRenderer | null): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    ua: nav.userAgent,
    kakaotalk: /KAKAOTALK/i.test(nav.userAgent),
    dpr: window.devicePixelRatio || 1,
    screen: `${screen.width}x${screen.height}`,
    inner: `${window.innerWidth}x${window.innerHeight}`,
    cores: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
    memoryGB: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    glRenderer: glRendererOf(r),
    webdriver: nav.webdriver === true,
  };
}

const f1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

export function createHud(init: HudInit): Hud {
  const { params } = init;
  const durationMs = params.minutes * 60_000;
  const recorder = new FrameRecorder(Math.max(FRAME_CAPACITY, Math.ceil(params.minutes * 60 * MAX_HZ_FOR_CAPACITY)));
  const tagsRec = new FrameRecorder(recorder.capacity);
  const renderRec = new FrameRecorder(recorder.capacity);
  const tapMs: number[] = [];
  const heapSamples: number[] = [];
  let heapStart: number | null = null;
  let mapBuildMs: number | null = null;
  let moduleLoadMs: number | null = null;
  // 스파이크는 자동 강등이 꺼져 있어 단계가 처음 값 그대로다
  const budgetStep = params.budget;
  let callsMax = 0;
  let lastStats: RendererStats | null = null;
  let verdict: HeartbeatVerdict = "first";
  let startedAt = 0;
  let began = false;
  let finished = false;
  let truncated = false;
  let result: PerfResult | null = null;
  let hbTimer: ReturnType<typeof setInterval> | null = null;
  let hudTimer: ReturnType<typeof setInterval> | null = null;
  let lastHeapAt = 0;
  let collapsed = false;

  // ----- 요소: 텍스트 한 덩어리 + 접기 버튼 -----
  const box = document.createElement("div");
  box.dataset.perfHud = "";
  box.style.cssText =
    "position:absolute;left:6px;top:6px;z-index:var(--z-modal);display:flex;gap:6px;align-items:flex-start;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font:12px/1.4 ui-monospace,Menlo,monospace;white-space:pre";
  const text = document.createElement("div");
  text.textContent = "불러오는 중…";
  const fold = document.createElement("button");
  fold.type = "button";
  fold.textContent = "접기";
  fold.style.cssText = "pointer-events:auto;font:inherit;color:inherit;background:rgba(255,255,255,.18);border:0;border-radius:4px;padding:0 6px;cursor:pointer";
  box.append(text, fold);
  init.root.append(box);
  fold.addEventListener("click", () => {
    collapsed = !collapsed;
    fold.textContent = collapsed ? "펼치기" : "접기";
    paint();
  });

  const writeHeartbeat = (state: Heartbeat["state"]): void => {
    try {
      init.storage?.setItem(HEARTBEAT_KEY, JSON.stringify({ state, at: Date.now() } satisfies Heartbeat));
    } catch {
      // 저장소를 못 쓰는 환경(개인 모드): 하트비트 없이 잰다
    }
  };

  function paint(): void {
    if (!began) return;
    const d = recorder.values();
    const s = summarizeFrames(d);
    const secs = Math.round((performance.now() - startedAt) / 1000);
    const st = init.renderer()?.info() ?? null;
    if (st !== null) {
      lastStats = st;
      callsMax = Math.max(callsMax, st.calls);
    }
    // 1초 구간의 fps 는 마지막 1초 분량의 프레임으로 센다
    let lastSec = 0;
    let c = 0;
    for (let i = d.length - 1; i >= 0 && lastSec < 1000; i--) {
      lastSec += d[i]!;
      c += 1;
    }
    const now1s = lastSec > 0 ? c / (lastSec / 1000) : 0;
    const head = `fps ${f1(now1s)}  평균 ${f1(s.avgFps)}  ${secs}s/${Math.round(durationMs / 1000)}s`;
    text.textContent = collapsed
      ? head
      : `${head}\n끊김 ${s.jank}  p95 ${f1(s.p95)}ms  최장 ${f1(s.max)}ms\nrAF ${s.rafHz}Hz${s.lowPowerSuspect ? " (저전력 의심)" : ""}  calls ${st?.calls ?? "-"}  단계 ${budgetStep}`;
    if (heapStart !== null && performance.now() - lastHeapAt >= 60_000) {
      lastHeapAt = performance.now();
      const h = heapMB();
      if (h !== null) heapSamples.push(h);
    }
  }

  function finish(): void {
    if (finished || !began) return;
    finished = true;
    const frames = summarizeFrames(recorder.values());
    const sortedTags = Float64Array.from(tagsRec.values()).sort();
    const sortedRender = Float64Array.from(renderRec.values()).sort();
    const r = init.renderer();
    const st = r?.info() ?? lastStats;
    const heapEnd = heapMB();
    const five = params.minutes >= 5;
    result = {
      schema: 1,
      at: new Date().toISOString(),
      build: APP_VERSION,
      three: init.threeRevision,
      query: init.query,
      params,
      device: deviceInfo(r),
      heartbeat: verdict,
      truncated,
      budgetStep,
      frames,
      work: {
        tagsP95Ms: Math.round(percentile(sortedTags, 0.95) * 1000) / 1000,
        renderP95Ms: Math.round(percentile(sortedRender, 0.95) * 1000) / 1000,
        mapBuildMs: mapBuildMs === null ? null : Math.round(mapBuildMs),
        moduleLoadMs: moduleLoadMs === null ? null : Math.round(moduleLoadMs),
      },
      renderer: st === null ? null : { ...st, callsMax: Math.max(callsMax, st.calls) },
      heap: { startMB: heapStart, endMB: heapEnd, samplesMB: heapSamples },
      tapToRingMs: tapMs.map((v) => Math.round(v * 10) / 10),
      interactiveMs: init.interactiveMs() === null ? null : Math.round(init.interactiveMs() as number),
      meets: five ? { avgFps: frames.avgFps >= PASS_AVG_FPS, jank: frames.jank <= PASS_JANK_5MIN } : null,
    };
    if (hbTimer !== null) clearInterval(hbTimer);
    hbTimer = null;
    writeHeartbeat("finished");
    window.__mfPerf = { result };
    if (!params.shot) showCard(result);
    init.onFinish?.(result);
  }

  function showCard(r: PerfResult): void {
    box.style.display = "none"; // 카드가 뜨면 HUD 는 가린다(스크린샷에 글자가 겹치지 않게)
    const card = document.createElement("div");
    card.dataset.perfResult = "";
    card.style.cssText =
      "position:absolute;inset:8px;z-index:calc(var(--z-modal) + 1);overflow:auto;padding:10px 12px;border-radius:10px;background:rgba(10,10,18,.97);color:#fff;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all";
    const h = r.heap;
    const lines = [
      `측정 결과  ${r.params.scene}  ${r.params.minutes}분  단계 ${r.budgetStep}  seed ${r.params.seed}`,
      `${r.at}`,
      `빌드 ${r.build}  three r${r.three}`,
      `평균 fps ${f1(r.frames.avgFps)}   끊김(>50ms) ${r.frames.jank}   프레임 ${r.frames.count}`,
      `프레임 ms  p50 ${f1(r.frames.p50)}  p95 ${f1(r.frames.p95)}  p99 ${f1(r.frames.p99)}  최장 ${f1(r.frames.max)}`,
      `rAF ${r.frames.rafHz}Hz${r.frames.lowPowerSuspect ? "  [저전력 모드 의심]" : ""}`,
      r.frames.thermalRatio === null
        ? "열: 2분 미만이라 첫/마지막 1분 비교 없음"
        : `열: 첫 1분 ${f1(r.frames.firstMinuteFps ?? 0)} → 마지막 1분 ${f1(r.frames.lastMinuteFps ?? 0)}  비율 ${r.frames.thermalRatio.toFixed(3)}${r.frames.thermalSuspect ? "  [열 스로틀 의심]" : ""}`,
      `이름표 투영·쓰기 p95 ${r.work.tagsP95Ms}ms   render 호출 CPU p95 ${r.work.renderP95Ms}ms`,
      `맵 생성 ${r.work.mapBuildMs ?? "-"}ms   모듈 받기 ${r.work.moduleLoadMs ?? "-"}ms   조작 가능 ${r.interactiveMs ?? "-"}ms(페이지 시작 기준)`,
      r.renderer
        ? `calls ${r.renderer.calls}(최대 ${r.renderer.callsMax})  triangles ${r.renderer.triangles}  geometries ${r.renderer.geometries}  textures ${r.renderer.textures}  programs ${r.renderer.programs}  pointLights ${r.renderer.pointLights}`
        : "렌더러 통계 없음",
      `JS 힙 ${h.startMB ?? "-"} → ${h.endMB ?? "-"} MB${h.samplesMB.length ? `  (1분마다 ${h.samplesMB.join(", ")})` : ""}`,
      `탭 → 링 ${r.tapToRingMs.length ? r.tapToRingMs.join(", ") + " ms" : "누른 적 없음"}`,
      `이전 실행: ${{ first: "처음", clean: "깨끗하게 끝남", crashed: "도중에 끝남(탭 폐기·새로 고침 포함)" }[r.heartbeat]}${r.truncated ? "   [기록 가득 참 — 시간 전에 멈춤]" : ""}`,
      r.meets ? `합격선(5분): 평균 ≥ ${PASS_AVG_FPS} ${r.meets.avgFps ? "통과" : "미달"} · 끊김 ≤ ${PASS_JANK_5MIN} ${r.meets.jank ? "통과" : "미달"}` : "합격선은 5분 측정에서만 본다",
      `기기 ${r.device.screen}  창 ${r.device.inner}  DPR ${r.device.dpr}  코어 ${r.device.cores ?? "-"}  메모리 ${r.device.memoryGB ?? "-"}GB${r.device.kakaotalk ? "  카카오톡" : ""}${r.device.webdriver ? "  자동화" : ""}`,
      `GL ${r.device.glRenderer ?? "-"}`,
      `UA ${r.device.ua}`,
      `쿼리 ${r.query || "(없음)"}`,
    ];
    card.textContent = lines.join("\n");
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:8px;margin-top:8px;white-space:normal";
    const mk = (label: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = "pointer-events:auto;font:inherit;color:#fff;background:rgba(255,255,255,.2);border:0;border-radius:6px;padding:6px 12px;cursor:pointer";
      b.addEventListener("click", onClick);
      return b;
    };
    bar.append(
      mk("복사", () => {
        // 인앱 브라우저는 클립보드가 막힐 수 있다 — 보조 수단일 뿐이고 기본은 이 카드의 스크린샷이다
        void navigator.clipboard?.writeText(JSON.stringify(r, null, 2)).catch(() => {});
      }),
      mk("닫기", () => card.remove()),
    );
    card.append(bar);
    init.root.append(card);
  }

  return {
    begin() {
      if (began) return;
      began = true;
      recorder.clear();
      tagsRec.clear();
      renderRec.clear();
      startedAt = performance.now();
      lastHeapAt = startedAt;
      heapStart = heapMB();
      let prev: Heartbeat | null = null;
      try {
        prev = parseHeartbeat(init.storage?.getItem(HEARTBEAT_KEY) ?? null);
      } catch {
        prev = null;
      }
      verdict = heartbeatVerdict(prev);
      writeHeartbeat("running");
      hbTimer = setInterval(() => writeHeartbeat("running"), HEARTBEAT_MS);
      // 텍스트는 1Hz 로만 갱신한다(HUD 자체 비용)
      hudTimer = setInterval(paint, 1000);
    },
    frame(rafTimeMs) {
      if (!began || finished) return;
      recorder.frame(rafTimeMs);
      if (recorder.full) {
        truncated = true;
        if (!params.shot) finish();
      } else if (!params.shot && performance.now() - startedAt >= durationMs) finish();
    },
    work(stats) {
      if (!began || finished) return;
      tagsRec.push(stats.tagsMs);
      renderRec.push(stats.renderMs);
    },
    tapRing(ms) {
      if (began && !finished) tapMs.push(ms);
    },
    setMapTimes(t) {
      if (t.mapBuildMs !== undefined) mapBuildMs = t.mapBuildMs;
      if (t.moduleLoadMs !== undefined) moduleLoadMs = t.moduleLoadMs;
    },
    note(line) {
      if (!began) text.textContent = line;
    },
    hide() {
      box.style.display = "none";
    },
    get finished() {
      return finished;
    },
    result() {
      return result;
    },
    dispose() {
      if (hbTimer !== null) clearInterval(hbTimer);
      if (hudTimer !== null) clearInterval(hudTimer);
      hbTimer = null;
      hudTimer = null;
      box.remove();
    },
  };
}
