// ?perf=1 성능 스파이크 장면(결정 0055, UI-SPEC "스파이크 장면"). 제품 화면이 아니다 — 지연 로드 청크로만 열린다(perfProbe.initPerfDebug).
// 제품과 같은 런타임(world/runtime.ts)·렌더러·3D 캐릭터·이름표 마크업(HeadStack 과 같은 mv-head/mv-tag)으로 지하 재즈 바 + 캐릭터 N명을 띄우고,
// 서버 없이 시드 고정 시나리오(scenario.ts)가 만든 구간을 WorldStore 에 넣어 걷게 한다. 프레임 제한 없음 — rAF 마다 그린다.
// 닉네임은 textContent 로만 넣는다(innerHTML 없음). 결과를 서버로 보내지 않는다(RESEARCH R2.6).
import { UNIT, cellCenterFx, routeFx, walkableCells } from "../../../shared/game/map";
import { mapOf } from "../../../shared/game/maps";
import { REVISION } from "three";
import { MOVE_V } from "../../../shared/game/world";
import { HEADER_BOTTOM, PANEL_HEIGHT } from "../../world/camera";
import { createTapTracker } from "../../world/input";
import { createWorldRuntime, loadWorld } from "../../world/runtime";
import type { WorldModules, WorldRuntime } from "../../world/runtime";
import { WorldStore } from "../../world/store";
import { createHud } from "./hud";
import { SPIKE_NAMES, makeTag } from "./tags";
import { parsePerfParams, createScenario, MIX_OUTFITS } from "./scenario";
import type { PerfParams } from "./scenario";
import type { PerfResult } from "./hud";
import "../../styles/world.css";
import "../../styles/v2.css";

/** 첫 동작 직후 이 시간(ms) 안의 프레임 간격 최댓값을 firstEmoteGapMs 로 남긴다(10-06, O-10) */
const FIRST_EMOTE_WINDOW_MS = 300;
/** 결과 JSON 에 덧붙는 값: 첫 동작 직후 최대 프레임 간격(ms). 동작 이벤트가 없었으면 null */
export type PerfResultWithEmote = PerfResult & { firstEmoteGapMs: number | null };

/** shot=1 은 측정이 시작된 뒤 이 시간(ms)에 시나리오와 HUD 를 멈춘다(스크린샷용) */
const SHOT_FREEZE_MS = 10_000;

export interface PerfScene {
  dispose(): void;
}

/** 걷는 영역 표시(nav=1)를 위한 작은 점 */
function makeDot(): HTMLElement {
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;left:0;top:0;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#7CFC00;opacity:.75;will-change:transform";
  return d;
}

export function mount(root: HTMLElement, search: URLSearchParams): PerfScene {
  const p: PerfParams = parsePerfParams(search);

  // ?dpr= 은 "이 기기의 장치 배율" 을 바꿔 쓴다(렌더러·이름표 반올림이 모두 devicePixelRatio 를 읽는다). 끝나면 돌려놓는다
  const dprDescriptor = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  if (p.dpr !== null) Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => p.dpr as number });

  const stage = document.createElement("div");
  stage.className = "mf-world is-open";
  stage.style.position = "fixed";
  stage.dataset.perfScene = "";
  const host = document.createElement("div");
  host.className = "mf-world__canvas";
  const input = document.createElement("div");
  input.className = "mf-world__input";
  const tags = document.createElement("div");
  tags.className = "mf-world__tags";
  // outfits=mix 면 좌석 i 가 MIX_OUTFITS[i](0번 탐정)를 입는다. coat 면 look 키 없음(기본 코트)
  const players = Array.from({ length: p.chars }, (_, seat) => ({
    seat,
    nickname: SPIKE_NAMES[seat % SPIKE_NAMES.length]!,
    connected: true,
    ...(p.outfits === "mix" ? { look: MIX_OUTFITS[seat % MIX_OUTFITS.length]! } : {}),
  }));
  for (const pl of players) tags.append(makeTag(pl.seat, pl.nickname, pl.seat === 0));
  const navLayer = document.createElement("div");
  navLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:var(--z-tags)";
  stage.append(host, input, tags, navLayer);
  root.append(stage);

  // ----- 시계와 시나리오: 맵이 열린 뒤부터 흐른다 (그 전의 불러오는 시간은 측정에 들어가지 않는다) -----
  const wall0 = Date.now();
  let running = false;
  let frozen = false;
  let runStartPerf = 0;
  let frozenAt = 0;
  const elapsed = (): number => (frozen ? frozenAt : running ? performance.now() - runStartPerf : 0);
  const serverNow = (): number => wall0 + elapsed();

  const store = new WorldStore();
  // ?map=plaza 면 광장 마스크·입장 지점으로 걷고 런타임이 광장 장면을 올린다(기본 bar)
  const map = mapOf(p.map);
  const scenario = createScenario({ seed: p.seed, chars: p.chars, map, burst: p.burst });
  store.applyFrame({ t: "world", k: "snap", at: wall0, ents: scenario.initial().map((e) => ({ s: e.s, p: e.p, t0: wall0 + e.t0, v: e.v })) }, 1);

  let rafId = 0;
  let disposed = false;
  /** 첫 동작 직후 프레임 간격 측정: 동작을 넣은 프레임 시각 · 직전 프레임 시각 · 지금까지의 최댓값 · 끝났는가 */
  let emoteStartAt: number | null = null;
  let lastFrameAt = 0;
  let firstEmoteGapMs: number | null = null;
  let emoteSeq = 0;
  /** 탭을 받아들인 시각(pointerup 의 timeStamp). 다음 프레임에서 "링이 그려진 시각" 과의 차를 잰다 */
  let tapAt: number | null = null;

  const hud = createHud({
    root: stage,
    params: p,
    query: window.location.search,
    threeRevision: REVISION,
    renderer: () => runtime.renderer(),
    onFinish: (r) => {
      (r as PerfResultWithEmote).firstEmoteGapMs = firstEmoteGapMs === null ? null : Math.round(firstEmoteGapMs * 10) / 10;
    },
    interactiveMs: () => runtime.interactiveMs(),
    storage: (() => {
      try {
        return window.sessionStorage;
      } catch {
        return null;
      }
    })(),
  });

  // 모듈 받기·맵 만들기 시간을 잰다(R2.2 "맵 생성 시간"): 제품과 같은 loadWorld·createThreeRenderer 를 그대로 부르고 시간만 잰다
  const loadModules = async (): Promise<WorldModules> => {
    const t0 = performance.now();
    const mods = await loadWorld();
    hud.setMapTimes({ moduleLoadMs: performance.now() - t0 });
    return {
      ...mods,
      createThreeRenderer: async (o) => {
        const t1 = performance.now();
        const r = await mods.createThreeRenderer(o);
        hud.setMapTimes({ mapBuildMs: performance.now() - t1 });
        return r;
      },
    };
  };

  // 이 장면에서는 처음 방문 손짓 링을 보지 않는다 — 이미 본 기기처럼 저장소가 늘 값을 돌려준다(측정 장면에 장식이 끼지 않게)
  const seenCue = { getItem: () => "1", setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 } as unknown as Storage;

  const runtime: WorldRuntime = createWorldRuntime({
    host,
    tagLayer: tags,
    store,
    serverNow,
    mySeat: () => 0,
    players: () => players,
    reducedMotion: () => false,
    mapId: () => p.map,
    stageRect: () => ({ top: HEADER_BOTTOM, bottom: (host.clientHeight || window.innerHeight) - PANEL_HEIGHT }),
    onStatus: (s) => {
      if (s.status === "ready" && !running && !frozen) {
        running = true;
        runStartPerf = performance.now();
        hud.begin();
      } else if (!running) {
        hud.note(s.status === "loading" ? "불러오는 중…" : `맵 상태: ${s.status}`);
      }
    },
    onNotice: () => {},
    allowSoftware: true,
    budgetStep: p.budget,
    // 측정 중에는 단계를 고정한다(제품의 자동 강등은 꺼 둔다)
    autoDegrade: false,
    onFrame: (stats) => hud.work(stats),
    loadModules,
    lighting: p.scene,
    storage: seenCue,
  });

  // ----- 사람이 누른 곳으로도 걷는다(탭 → 링 → 서버 구간 대신 같은 모양의 구간을 바로 넣는다) -----
  const tracker = createTapTracker();
  input.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    tracker.down(e.pointerId, e.clientX, e.clientY, Date.now());
  });
  input.addEventListener("pointermove", (e) => tracker.move(e.pointerId, e.clientX, e.clientY));
  input.addEventListener("pointercancel", (e) => tracker.cancel(e.pointerId));
  input.addEventListener("pointerup", (e) => {
    const at = tracker.up(e.pointerId, e.clientX, e.clientY, Date.now());
    if (at === null || frozen) return;
    const dest = runtime.tap(at.x, at.y);
    if (dest === null) return;
    tapAt = e.timeStamp;
    const now = serverNow();
    const here = store.positionOf(0, now) ?? { x: 0, z: 0 };
    const path = routeFx(map, { x: Math.round(here.x * UNIT), z: Math.round(here.z * UNIT) }, { x: Math.round(dest.x * UNIT), z: Math.round(dest.z * UNIT) });
    store.applyFrame({ t: "world", k: "move", s: 0, p: path, t0: now, v: MOVE_V }, 1);
    scenario.retarget(0, { p: path, t0: now - wall0, v: MOVE_V });
    runtime.notifyMoveSent(now);
  });

  // ----- 걸을 수 있는 셀 겹쳐 보기(nav=1) -----
  const navDots: { el: HTMLElement; x: number; z: number }[] = [];
  if (p.nav) {
    for (const c of walkableCells(map)) {
      const fx = cellCenterFx(c.c, c.r, map);
      const el = makeDot();
      navLayer.append(el);
      navDots.push({ el, x: fx.x / UNIT, z: fx.z / UNIT });
    }
  }

  // ----- 프레임마다: 시나리오 이벤트를 넣고, 1Hz 로 HUD 한 줄을 갱신한다 -----
  function pump(time: number): void {
    if (disposed) return;
    rafId = requestAnimationFrame(pump);
    hud.frame(time);
    if (emoteStartAt !== null && firstEmoteGapMs !== null && firstEmoteGapMs >= 0 && time - emoteStartAt <= FIRST_EMOTE_WINDOW_MS + 20) {
      // 동작을 넣은 프레임 이후의 프레임 간격(동작 시작 비용이 들어 있는 간격)
      firstEmoteGapMs = Math.max(firstEmoteGapMs, time - lastFrameAt);
    }
    lastFrameAt = time;
    if (tapAt !== null) {
      hud.tapRing(time - tapAt);
      tapAt = null;
    }
    if (running && !frozen) {
      for (const ev of scenario.advance(elapsed())) {
        if (ev.kind === "move") store.applyFrame({ t: "world", k: "move", s: ev.seat, p: ev.p, t0: wall0 + ev.t0, v: ev.v }, 1);
        else {
          // burst 모드는 제품과 같은 경로(store.applyEmote → 동시 재생 상한 4)로 넣는다. 기본 경로는 이전 그대로 직접 재생
          if (p.burst > 1) store.applyEmote({ t: "emote", seat: ev.seat, id: ev.id, n: ++emoteSeq }, 1);
          else runtime.characterOf(ev.seat)?.playEmote?.(ev.id);
          if (emoteStartAt === null) {
            emoteStartAt = time;
            firstEmoteGapMs = 0;
          }
        }
      }
      if (p.shot && elapsed() >= SHOT_FREEZE_MS) {
        frozen = true;
        frozenAt = SHOT_FREEZE_MS;
        hud.hide();
      }
    }
    const r = runtime.renderer();
    if (r !== null && navDots.length > 0) {
      for (const d of navDots) {
        const s = r.project({ x: d.x, y: 0, z: d.z });
        d.el.style.transform = `translate(${s.sx}px, ${s.sy}px)`;
      }
    }
  }
  rafId = requestAnimationFrame(pump);
  void runtime.start();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      hud.dispose();
      runtime.dispose();
      stage.remove();
      if (p.dpr !== null) {
        if (dprDescriptor) Object.defineProperty(window, "devicePixelRatio", dprDescriptor);
        else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
      }
    },
  };
}
