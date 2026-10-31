// WebGL 맵 상태기계(순수). 시각은 이벤트의 at·now 로만 받는다 — 내부에서 Date.now() 를 부르지 않는다.
// 효과(타이머·렌더러 재생성·location.reload)는 06-13 런타임이 한다. 이 파일은 판정만.
//
// 흐름(RESEARCH R3): loading → ready ⇄ lost → (restored → ready | 3초 뒤 recreating → recreated → ready | 5초 뒤 failed)
//   loading → loadFailed → [다시 시도](retry) → loading,   loading → unsupported(끝: 몰래 다른 화면으로 대체하지 않는다)

export type MapStatus = "loading" | "ready" | "lost" | "recreating" | "failed" | "loadFailed" | "unsupported";
export interface MapStatusState {
  status: MapStatus;
  /** lost·recreating·failed 일 때 소실이 시작된 시각. 그 밖에는 null */
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

/** 소실 뒤 이 시간 안에 복구 이벤트가 없으면 렌더러를 한 번 다시 만든다 */
export const RECREATE_AFTER_MS = 3000;
/** 소실 뒤 이 시간이 지나면 포기하고 [새로 고침] 카드로 끝낸다 */
export const FAIL_AFTER_MS = 5000;

export const initialMapStatus: MapStatusState = { status: "loading", lostAt: null };

/** 같은 상태가 되면 같은 객체를 돌려준다(불필요한 리렌더 방지) */
export function mapStatusReducer(s: MapStatusState, e: MapStatusEvent): MapStatusState {
  // 끝난 상태: unsupported(이 기기에서는 열 수 없음)와 failed(새로 고침만 남음)는 어떤 이벤트에도 그대로다.
  if (s.status === "unsupported" || s.status === "failed") return s;

  switch (e.t) {
    case "ready":
      return s.status === "loading" ? { status: "ready", lostAt: null } : s;

    case "loadError":
      return s.status === "loading" ? { status: "loadFailed", lostAt: null } : s;

    case "unsupported":
      return s.status === "loading" ? { status: "unsupported", lostAt: null } : s;

    case "retry":
      return s.status === "loadFailed" ? { status: "loading", lostAt: null } : s;

    // 컨텍스트 소실: ready 에서만 시작한다. 이미 소실 중이면 처음 시각을 지킨다(시계를 늘리지 않는다).
    // loading 중 소실은 무시한다 — 불러오기 실패는 loadError 로 알린다.
    case "lost":
      return s.status === "ready" ? { status: "lost", lostAt: e.at } : s;

    case "restored":
      return s.status === "lost" || s.status === "recreating" ? { status: "ready", lostAt: null } : s;

    case "recreated":
      return s.status === "recreating" ? { status: "ready", lostAt: null } : s;

    case "tick": {
      if ((s.status !== "lost" && s.status !== "recreating") || s.lostAt === null) return s;
      const elapsed = e.now - s.lostAt;
      if (elapsed >= FAIL_AFTER_MS) return { status: "failed", lostAt: s.lostAt };
      if (s.status === "lost" && elapsed >= RECREATE_AFTER_MS) return { status: "recreating", lostAt: s.lostAt };
      return s;
    }

    // 다시 보일 때 조용히 소실된 컨텍스트를 발견한 경우. 숨겨 둔 시간은 세지 않는다.
    // 복구는 restored 이벤트로만 알리므로 contextLost 가 false 면 어느 상태에서도 그대로다.
    case "visible": {
      if (!e.contextLost) return s;
      if (s.status === "ready") return { status: "lost", lostAt: e.at };
      if (s.status === "lost" && s.lostAt !== null && e.at > s.lostAt) return { status: "lost", lostAt: e.at };
      return s;
    }
  }
}

/** lost → recreating 전이일 때만 참. 재생성은 소실 한 번에 한 번이다(T-06-06) */
export function shouldRecreate(prev: MapStatusState, next: MapStatusState): boolean {
  return prev.status === "lost" && next.status === "recreating";
}

/** ready 가 아니면 탭 이동 입력을 받지 않는다 */
export function inputBlocked(s: MapStatusState): boolean {
  return s.status !== "ready";
}

/** WEBGL_debug_renderer_info 렌더러 문자열이 소프트웨어 렌더러(SwiftShader·llvmpipe·Software)인지. 대소문자 무시 */
export function isSoftwareRenderer(rendererName: string): boolean {
  return /swiftshader|llvmpipe|software/i.test(rendererName);
}

/** 상태 카드 문구(UI-SPEC Copywriting Contract). action 은 버튼 글자이고 대괄호는 붙이지 않는다 */
export const MAP_STATUS_COPY: Readonly<Record<"loading" | "loadFailed" | "unsupported" | "redrawing" | "failed", { title: string; body?: string; action?: string }>> = {
  loading: { title: "맵을 불러오는 중…" },
  loadFailed: { title: "맵을 불러오지 못했어요", body: "네트워크를 확인해 주세요", action: "다시 시도" },
  unsupported: { title: "이 기기에서는 맵을 열 수 없어요", body: "다른 브라우저로 열어 주세요", action: "나가기" },
  redrawing: { title: "화면을 다시 그리는 중…" },
  failed: { title: "화면을 다시 그리지 못했어요", action: "새로 고침" },
};
