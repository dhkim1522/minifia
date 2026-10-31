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
  /** 서버 시각 t(기본: 지금)의 seat 위치 — 렌더러와 같은 positionAt */
  sample(seat: number, t?: number): { x: number; z: number } | null;
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
  }
}

/** 런타임 중 훅이 읽는 부분 */
export interface HookRuntime {
  sample(seat: number, t?: number): { x: number; z: number } | null;
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
