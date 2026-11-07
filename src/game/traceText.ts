// 아침 흔적 조각의 이름 표(15페이즈, D-06·D-09, UI-SPEC "흔적 조각 이름 초안"). 서버는 조각 id 하나만 보낸다 — 이름은 이 닫힌 표에서만 온다.
// 의상은 아무나 입을 수 있어 확정 증거가 아니다. 이름에 역할 연상어(경찰·의사·마피아·시민·가운·정장)와 '범인'·'증거'·'확정' 을 쓰지 않는다(시험이 막는다).
import type { TracePiece } from "../../shared/protocol";

export const TRACE_TEXT: Readonly<Record<TracePiece, string>> = {
  button: "단추 하나",
  pin: "은빛 핀",
  whiteCloth: "흰 천 조각",
  blackCloth: "검은 천 조각",
  brownCloth: "갈색 천 조각",
  pencil: "노란 연필 조각",
  grayThread: "회색 실밥",
  navyThread: "남색 실밥",
  redCloth: "붉은 천 조각",
};

/** 카드의 고정 보조 문구 — 확정 증거가 아님을 글 한 줄로만 말한다(T-15-12) */
export const TRACE_NOTE = "누구의 것인지는 모릅니다";
