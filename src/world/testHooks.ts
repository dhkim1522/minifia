// E2E 훅(T-06-27). window.__mfWorld 는 ?e2e=1(세션 저장) 또는 개발 빌드에서만 생긴다 — 일반 사용자 주소(쿼리 없는 배포본)에는 없다.
// 캐릭터가 3D 메시라 DOM 에 위치가 없다: E2E 가 같은 시각의 위치를 읽는 유일한 경로다(낡은 DOM 속성에 기대지 않는다, 리서치 Pitfall 6).
// 노출하는 것은 이미 화면에 그려진 로비 위치·렌더러 통계뿐이다(신원·역할·토큰 없음).
import type { StorageLike } from "../net/session";
import type { RendererStats, WorldRenderer } from "./renderer";
import type { MapStatus, MapStatusState } from "./status";
import type { WorldStore } from "./store";

export const WORLD_TEST_PARAM = "e2e";
export const WORLD_TEST_KEY = "minifia:e2e";

export interface WorldTestHooks {
  /** 서버 시각 t(기본: 지금)의 seat 위치 — 렌더러와 같은 positionAt. 서버 구간 기준(진실) — 화면에 그린 위치는 shown */
  sample(seat: number, t?: number): { x: number; z: number } | null;
  /** 마지막 프레임에 화면에 그린 seat 위치(내 예측·구간 섞기 포함)와 그 프레임의 Date.now(). 없는 자리는 null (결정 0059) */
  shown(seat: number): { x: number; z: number; at: number } | null;
  seats(): number[];
  /** 목적지 링의 목표 지점(없으면 null) */
  ring(): { x: number; z: number } | null;
  status(): MapStatus;
  /** performance.mark("map-interactive") 의 시각(ms, 페이지 시작 기준). 아직 안 열렸으면 null */
  interactiveMs(): number | null;
  /** 월드 바닥 점 → 화면 px (E2E 가 걸을 수 있는 점을 누를 때). 렌더러가 없으면 null */
  screenOf(x: number, z: number): { sx: number; sy: number } | null;
  debug: {
    loseContext(): void;
    restoreContext(): void;
    info(): RendererStats | null;
    recreate(): Promise<void>;
  };
}

declare global {
  interface Window {
    __mfWorld?: WorldTestHooks;
    /** 유령 그림으로 그리고 있는 좌석(오름차순)과 그림 준비 여부(0083-2). 좌석 번호뿐이고 직업·의상은 싣지 않는다(L13, T-18.1-41) */
    __mfGhosts?: { seats: number[]; ready: boolean };
    /** 핀 조명(09.1.1-11): 지금 비추는 좌석(없으면 null)·이동 중 여부·켜짐 수준(0~1)·카메라 줌(09.1.1-13, 소수 셋째 자리). 런타임이 이미 정한 값뿐이다 */
    __mfPin?: { seat: number | null; moving: boolean; strength: number; zoom: number };
    /** 좌석별 고른 의상 표(좌석 → 의상 id, 10-04, L33). 이 화면이 받은 view 의 look 사본이다(결과 화면 직업 의상과 별개). 훅이 켜진 문맥에서만 생기고 DOM 속성으로 싣지 않는다 */
    __mfLooks?: Readonly<Record<number, string>>;
    /** 지금 렌더러에 올린 맵 id(11-13, L33): 로비·시작 전은 "bar". 훅이 켜진 문맥에서만 생기고 DOM 속성으로 싣지 않는다 */
    __mfMap?: "bar" | "plaza";
    /** 동작 훅(10-03, L33): 이 화면이 받은 마지막 emote 프레임의 사본과 지금 사람 동작을 재생 중인 좌석. DOM 속성으로 싣지 않는다 */
    __mfEmotes?: { last: { seat: number; id: string; n: number } | null; playing: readonly number[] };
    /**
     * 결과 화면 훅(11-05): 연출 단계·뒤집힌 칩 수·어두워진 좌석·입은 직업 의상 표. costumes·dimmed 는 런타임이 실제로 적용한 값(onCostumes)이고
     * stage·chips 는 결과 화면의 연출 시계다. 훅이 켜진 문맥에서만 생기고 DOM 속성으로 싣지 않는다
     */
    __mfResult?: ResultHookState;
  }
}

/** window.__mfResult 의 모양(11-05) */
export interface ResultHookState {
  stage: string;
  chips: number;
  dimmed: number[];
  costumes: Record<number, string>;
  /** 결과 패널의 현재 탭(11-07): all·mafia·ghost·whisper·log. 판 중에는 훅 자체가 없다 */
  tab: string;
  /** 쉬었다가 결과에 합류한 사람(sat)의 좌석 오름차순 (11-12). 없으면 빈 배열 */
  sat: number[];
}

/** 런타임 중 훅이 읽는 부분 */
export interface HookRuntime {
  sample(seat: number, t?: number): { x: number; z: number } | null;
  shown(seat: number): { x: number; z: number; at: number } | null;
  ring(): { x: number; z: number } | null;
  status(): MapStatusState;
  interactiveMs(): number | null;
  renderer(): WorldRenderer | null;
}

/**
 * 쿼리 e2e=1 이면 저장소에 "1" 을 쓰고 켠다. =0 이면 지우고 끈다.
 * 그 밖에는 저장소 값이 "1" 인지로 정하고(방 만들기·참가로 주소가 바뀌거나 새로고침해도 유지), 없으면 dev(개발 빌드)를 따른다.
 * 저장소 접근은 예외가 날 수 있어(사파리 개인 모드 등) 예외면 쿼리·dev 값만으로 판정한다. src/debug/sheetProbe.ts 와 같은 규칙이다.
 */
export function worldTestHooksEnabled(search: string, storage: StorageLike | null, dev = false): boolean {
  const param = new URLSearchParams(search).get(WORLD_TEST_PARAM);
  if (param === "1") {
    try {
      storage?.setItem(WORLD_TEST_KEY, "1");
    } catch {
      // 저장소를 못 쓰는 환경: 이 로드에서만 켠다
    }
    return true;
  }
  if (param === "0") {
    try {
      storage?.removeItem(WORLD_TEST_KEY);
    } catch {
      // 무시
    }
    return false;
  }
  try {
    if (storage?.getItem(WORLD_TEST_KEY) === "1") return true;
  } catch {
    // 저장소를 읽지 못하면 dev 만으로 판정한다
  }
  return dev;
}

/** window.__mfWorld 를 설치하고, 지우는 함수를 돌려준다(언마운트 때 부른다). 다른 설치가 덮어썼으면 지우지 않는다. */
export function installWorldTestHooks(runtime: HookRuntime, store: WorldStore): () => void {
  const hooks: WorldTestHooks = {
    sample: (seat, t) => runtime.sample(seat, t),
    shown: (seat) => runtime.shown(seat),
    seats: () => store.seats(),
    ring: () => runtime.ring(),
    status: () => runtime.status().status,
    interactiveMs: () => runtime.interactiveMs(),
    screenOf: (x, z) => runtime.renderer()?.project({ x, y: 0, z }) ?? null,
    debug: {
      loseContext: () => runtime.renderer()?.debugLoseContext(),
      restoreContext: () => runtime.renderer()?.debugRestoreContext(),
      info: () => runtime.renderer()?.info() ?? null,
      recreate: () => runtime.renderer()?.recreate() ?? Promise.resolve(),
    },
  };
  window.__mfWorld = hooks;
  return () => {
    if (window.__mfWorld === hooks) delete window.__mfWorld;
  };
}

/**
 * window.__mfGhosts 를 설치하고(처음엔 좌석 없음·준비 안 됨) 갱신·해제 함수를 돌려준다. 테스트 훅이 켜진 문맥에서만 부른다(T-18.1-41).
 * 해제는 다른 설치가 덮어썼으면 지우지 않는다(__mfWorld 와 같은 규칙). 좌석 번호와 준비 여부뿐이다(L13).
 */
export function installGhostsHook(): { set(state: { seats: number[]; ready: boolean }): void; off(): void } {
  let mine: { seats: number[]; ready: boolean } = { seats: [], ready: false };
  window.__mfGhosts = mine;
  return {
    set(state) {
      mine = { seats: [...state.seats], ready: state.ready };
      window.__mfGhosts = mine;
    },
    off() {
      if (window.__mfGhosts === mine) delete window.__mfGhosts;
    },
  };
}

/**
 * window.__mfPin 을 설치하고(처음엔 꺼짐 상태) 갱신·해제 함수를 돌려준다. 테스트 훅이 켜진 문맥에서만 부른다(T-09.1.1-31).
 * 해제는 다른 설치가 덮어썼으면 지우지 않는다.
 */
export function installPinHook(): { set(pin: { seat: number | null; moving: boolean; strength: number }): void; setZoom(zoom: number): void; off(): void } {
  let mine = { seat: null as number | null, moving: false, strength: 0, zoom: 1 };
  window.__mfPin = mine;
  return {
    set(pin) {
      mine = { seat: pin.seat, moving: pin.moving, strength: pin.strength, zoom: mine.zoom };
      window.__mfPin = mine;
    },
    setZoom(zoom) {
      mine = { ...mine, zoom };
      window.__mfPin = mine;
    },
    off() {
      if (window.__mfPin === mine) delete window.__mfPin;
    },
  };
}

/**
 * window.__mfEmotes 를 설치하고(처음엔 비어 있음) 갱신·해제 함수를 돌려준다. 테스트 훅이 켜진 문맥에서만 부른다(T-10-12).
 * 값은 이 화면이 받은 프레임의 사본뿐이다(L33). 해제는 다른 설치가 덮어썼으면 지우지 않는다.
 */
export function installEmotesHook(): { set(state: { last: { seat: number; id: string; n: number } | null; playing: readonly number[] }): void; off(): void } {
  let mine: NonNullable<Window["__mfEmotes"]> = { last: null, playing: [] };
  window.__mfEmotes = mine;
  return {
    set(state) {
      mine = { last: state.last === null ? null : { seat: state.last.seat, id: state.last.id, n: state.last.n }, playing: [...state.playing] };
      window.__mfEmotes = mine;
    },
    off() {
      if (window.__mfEmotes === mine) delete window.__mfEmotes;
    },
  };
}

/**
 * window.__mfLooks 를 설치하고(처음엔 빈 표) 갱신·해제 함수를 돌려준다. 테스트 훅이 켜진 문맥에서만 부른다(L33).
 * 해제는 다른 설치가 덮어썼으면 지우지 않는다(__mfGhosts 와 같은 규칙). 의상은 DOM 속성으로 싣지 않는다.
 */
export function installLooksHook(): { set(looks: Readonly<Record<number, string>>): void; off(): void } {
  let mine: Readonly<Record<number, string>> = {};
  window.__mfLooks = mine;
  return {
    set(looks) {
      mine = { ...looks };
      window.__mfLooks = mine;
    },
    off() {
      if (window.__mfLooks === mine) delete window.__mfLooks;
    },
  };
}

/**
 * window.__mfMap 을 설치한다(11-13): 이 런타임이 올린 맵 id. 맵이 바뀌면 새 런타임이 다시 설치한다. 테스트 훅이 켜진 문맥에서만 부른다(L33).
 * 해제는 다른 설치가 덮어썼으면 지우지 않는다(다른 값이면 그대로 둔다). 값은 DOM 속성이 아니다.
 */
export function installMapHook(mapId: "bar" | "plaza"): { off(): void } {
  window.__mfMap = mapId;
  return {
    off() {
      if (window.__mfMap === mapId) delete window.__mfMap;
    },
  };
}

/**
 * window.__mfResult 를 설치하고(처음엔 빈 상태) 일부만 갱신하는 patch 와 해제 함수를 돌려준다. 훅이 켜진 문맥에서만 부른다(L33).
 * 해제는 다른 설치가 덮어썼으면 지우지 않는다. 값은 DOM 속성이 아니다 — 직업·의상을 마크업에 싣지 않는다.
 */
export function installResultHook(): { patch(next: Partial<ResultHookState>): void; off(): void } {
  let mine: ResultHookState = { stage: "gather", chips: 0, dimmed: [], costumes: {}, tab: "all", sat: [] };
  window.__mfResult = mine;
  return {
    patch(next) {
      mine = { ...mine, ...next };
      window.__mfResult = mine;
    },
    off() {
      if (window.__mfResult === mine) delete window.__mfResult;
    },
  };
}
