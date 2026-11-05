// 성능 스파이크(?perf=1)·하단 채팅 배치 시안(?chat-mock=1) 등록 자리. 결정 0055·UI-SPEC "렌더 성능 게이트".
// 이 파일이 운영 번들에 들어가는 몫이다: 쿼리 판정과 지연 로드 한 곳뿐이고 측정 코드·three 는 두지 않는다.
// 측정 본체(perf/perfScene.ts·chatMock.ts)는 아래 initPerfDebug 안의 동적 import 에서만 불러온다 — 쿼리가 없으면 내려받지 않는다.
// ?pose-strip=1(10-06 포즈 스트립)·?sound-lab=1(12-06 소리 시험 페이지)은 개발 빌드·?e2e=1 문맥에서만 열린다(순수 판정만 이 번들에 있다).
// 판정은 쿼리만 본다(저장소 기록 없음): 측정은 매번 명시하고, 일반 사용자 주소에서 우연히 켜지는 일이 없다.

import type { StorageLike } from "../net/session";
import { poseStripEnabled } from "./poseStripData";
import { soundLabEnabled } from "./soundLabData";

export const PERF_PARAM = "perf";
export const CHAT_MOCK_PARAM = "chat-mock";

/** ?perf=1 인가 */
export function perfEnabled(search: string): boolean {
  return new URLSearchParams(search).get(PERF_PARAM) === "1";
}

/** ?chat-mock=1 인가 */
export function chatMockEnabled(search: string): boolean {
  return new URLSearchParams(search).get(CHAT_MOCK_PARAM) === "1";
}

function sessionStore(): StorageLike | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * 앱 시작 때 한 번. 디버그 화면이면 true(동기)를 돌려주고 본체를 지연 로드해 document.body 에 띄운다 —
 * 부르는 쪽(main.tsx)은 true 일 때 App 을 렌더하지 않는다. 둘 다 켜져 있으면 ?perf=1 이 먼저다.
 * 본체를 못 불러오거나 띄우다 실패하면 경고 한 줄 뒤 삼킨다(디버그 화면이 앱 시작을 막지 않는다).
 */
export function initPerfDebug(search?: string, env?: { dev?: boolean; storage?: StorageLike | null }): boolean {
  const s = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const perf = perfEnabled(s);
  const mock = !perf && chatMockEnabled(s);
  const strip = !perf && !mock && poseStripEnabled(s, env && "storage" in env ? (env.storage ?? null) : sessionStore(), env?.dev ?? import.meta.env.DEV);
  const lab = !perf && !mock && !strip && soundLabEnabled(s, env && "storage" in env ? (env.storage ?? null) : sessionStore(), env?.dev ?? import.meta.env.DEV);
  if (!perf && !mock && !strip && !lab) return false;
  const params = new URLSearchParams(s);
  const loaded = perf ? import("./perf/perfScene") : mock ? import("./chatMock") : strip ? import("./poseStrip") : import("./soundLab");
  loaded
    .then((mod) => {
      mod.mount(document.body, params);
    })
    .catch(() => {
      console.warn("perf 디버그 화면 불러오기 실패");
    });
  return true;
}
