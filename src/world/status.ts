// WebGL 맵 상태기계(순수). 시각은 이벤트의 at·now 로만 받는다 — 내부에서 Date.now() 를 부르지 않는다.
// 효과(타이머·렌더러 재생성·location.reload)는 06-13 런타임이 한다. 이 파일은 판정만.
// RED 뼈대: 리듀서는 아직 상태를 바꾸지 않고, 문구는 비어 있다(같은 작업의 GREEN 에서 구현으로 바뀐다).

export type MapStatus = "loading" | "ready" | "lost" | "recreating" | "failed" | "loadFailed" | "unsupported";
export interface MapStatusState {
  status: MapStatus;
  lostAt: number | null;
}
export type MapStatusEvent =
  | { t: "ready" }
  | { t: "loadError" }
  | { t: "unsupported" }
  | { t: "lost"; at: number }
  | { t: "restored" }
  | { t: "recreated" }
  | { t: "tick"; now: number }
  | { t: "retry" }
  | { t: "visible"; contextLost: boolean; at: number };

export const RECREATE_AFTER_MS = 3000;
export const FAIL_AFTER_MS = 5000;
export const initialMapStatus: MapStatusState = { status: "loading", lostAt: null };

export function mapStatusReducer(s: MapStatusState, _e: MapStatusEvent): MapStatusState {
  return s;
}
export function shouldRecreate(_prev: MapStatusState, _next: MapStatusState): boolean {
  return false;
}
export function inputBlocked(_s: MapStatusState): boolean {
  return false;
}
export function isSoftwareRenderer(_rendererName: string): boolean {
  return false;
}
export const MAP_STATUS_COPY: Readonly<Record<"loading" | "loadFailed" | "unsupported" | "redrawing" | "failed", { title: string; body?: string; action?: string }>> = {
  loading: { title: "" },
  loadFailed: { title: "" },
  unsupported: { title: "" },
  redrawing: { title: "" },
  failed: { title: "" },
};
