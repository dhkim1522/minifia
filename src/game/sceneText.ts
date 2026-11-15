// 아침 현장 화면의 글 표 한 곳(21페이즈 D-14·D-15, UI-SPEC P21-10·P21-12·P21-16, Copywriting Contract). 지점 이름은 화면 글자가 아니라 접근성 이름에만 쓴다(지점 표지에 장소 이름 글자 없음).
// 단서 카드의 글은 조각 이름(TRACE_TEXT) + 아래 세 줄 + 발자국 숫자뿐이다. '범인'·'증거'·'확정'·역할 단어를 쓰지 않는다(시험이 막는다).
import type { SpotId } from "../../shared/protocol";

/** 지점 이름(접근성 이름 전용 — 화면에는 글로 쓰지 않는다) */
export const SPOT_NAME: Readonly<Record<SpotId, string>> = {
  footprint: "발자국",
  cloth: "옷 조각",
  window: "창문",
};

/** 단서 카드의 고정 문장 셋(받은 단서가 아닌 카드) */
export const CARD_TEXT = {
  touched: "먼저 손댄 흔적",
  dark: "어두워서 못 봤어요",
  none: "아무것도 없어요",
} as const;

/** 지점 표지 접근성 이름의 상태 덧말(살핌·어두워서 못 봄·먼저 손댄 흔적) */
export const SPOT_STATE_TEXT = {
  done: "살핌",
  dark: "어두워서 못 봄",
  touched: "먼저 손댄 흔적",
} as const;

/** 지점 표지 접근성 이름: "{지점} 지점" + (상태가 있으면) ", {상태}" */
export function spotLabel(id: SpotId, state: "new" | "done" | "dim", why?: "dark" | "touched"): string {
  const base = `${SPOT_NAME[id]} 지점`;
  if (state === "done") return `${base}, ${SPOT_STATE_TEXT.done}`;
  if (state === "dim") return `${base}, ${SPOT_STATE_TEXT[why ?? "touched"]}`;
  return base;
}

/** [살펴보기] 알약의 접근성 이름: "{지점} 살펴보기" */
export function inspectLabel(id: SpotId): string {
  return `${SPOT_NAME[id]} 살펴보기`;
}

/** 발자국 카드의 접근성 이름: "발자국 n개" */
export function footprintLabel(n: number): string {
  return `발자국 ${n}개`;
}

/** [살펴보기] 알약의 글·아이콘(P21-11 — 저녁 [켜기]의 LAMP_ACT_LOOK 과 같은 모양) */
export const INSPECT_ACT_LOOK = { label: "살펴보기", icon: "lens" } as const;
