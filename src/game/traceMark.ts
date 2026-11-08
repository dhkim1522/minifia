// 아침 흔적 조각의 표시 색과 "같은 옷" 판정(16-09, D-09·D-10, V-29). 서버가 새로 계산하는 값은 없다 —
// 이미 공개된 players[].look 과 공개된 조각 id 의 함수다(R-3). 역할·고른 사람 풀은 어디에도 쓰지 않는다.
// 색은 조각마다 달라 마피아 색으로 읽히지 않는다. 화면 CSS 는 이 값을 사용자 변수 --trace-mark 로만 받는다(닫힌 표 — 사용자 문자열이 섞이지 않는다).
import { OUTFIT_IDS } from "../../shared/protocol";
import type { PublicPlayer, TracePiece } from "../../shared/protocol";
import { TRACE_OF_OUTFIT } from "../../shared/game/trace";
import { DEFAULT_LOOK } from "../../shared/game/look";

/** 조각 → 표시 색(UI-SPEC 흔적 표시 색). 모두 night-900 위 3:1 이상 — 단위 시험이 같은 계산으로 고정한다. */
export const TRACE_MARK: Readonly<Record<TracePiece, string>> = {
  button: "#b9864f",
  pin: "#d9dde6",
  whiteCloth: "#f4f1ea",
  blackCloth: "#6b7180",
  brownCloth: "#9a6238",
  pencil: "#ffc83d",
  grayThread: "#a9aebb",
  navyThread: "#5b7fd1",
  redCloth: "#d23c4e",
};

/**
 * 조각과 같은 옷을 입은 산 사람(나 포함)의 좌석, 오름차순. 의상이 없는 사람은 기본 의상(coat)으로 본다.
 * alive 가 없으면 생존으로 본다(PublicPlayer 규칙).
 */
export function sameOutfitSeats(players: ReadonlyArray<Pick<PublicPlayer, "seat" | "alive" | "look">>, piece: TracePiece): number[] {
  const outfits = OUTFIT_IDS.filter((o) => TRACE_OF_OUTFIT[o] === piece);
  return players
    .filter((p) => p.alive !== false && outfits.includes(p.look ?? DEFAULT_LOOK))
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}
