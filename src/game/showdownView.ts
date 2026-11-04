// 마지막 3인 결전 화면 순수 모델(09.1.1-15, 결정 0066-5, UI-SPEC E). 서버가 모두에게 같게 보낸 공개 값(day.showdown)만 읽는다.
// 역할·개인 선택은 읽지 않는다 — 단계·순서·한마디·던진 좌석은 모든 viewer 가 같다(L21, T-09.1.1-43).
// 이 계획의 새 문구는 모두 이 파일 한 곳(SHOWDOWN_COPY)에 둔다. UI-SPEC Copywriting Contract 원문 — 해요체, 마침표·느낌표 없음.
import { isAlive } from "../../shared/game/alive";
import { LAST_WORD_CHIPS, LAST_WORD_MAX_GRAPHEMES } from "../../shared/game/showdown";
import type { PointLine, RoomView, ShowdownView } from "../../shared/protocol";

export const SHOWDOWN_COPY = {
  /** 헤더 제목 */
  title: "마지막 셋",
  /** 모이는 동안 위 한 줄(라이브 진입 때만) */
  gatherLine: "마지막 셋이에요",
  /** 동시 지목 알약의 단계 이름과 이름 자리 글 */
  pointPill: "지목",
  allAtOnce: "모두 동시에",
  /** 헤더 안내: 내 한마디 차례 시작 / 동시 지목 */
  speakHint: "한마디를 골라요",
  pointHint: "의심되는 사람을 눌러요",
  /** 채팅 시스템 줄: 단계에 들어올 때 */
  chatLine: "마지막 셋",
  /** 한마디 시트: 빠른 문구(서버 LAST_WORD_CHIPS 와 같은 상수) · 직접 쓰기 · 직접 쓰기 시트 제목 */
  chips: LAST_WORD_CHIPS,
  write: "직접 쓰기",
  writeTitle: "한마디",
  /** 한 줄 시트 글자 수 상한(자소) */
  max: LAST_WORD_MAX_GRAPHEMES,
  /** 동시 지목 이름표 버튼 묶음 이름과 접근성 이름 */
  pointGroup: "지목",
  pointLabel: (name: string): string => `${name} 님 가리키기`,
} as const;

/** gather 모이는 중(i −1) · speak 한마디 차례(0..2, 확정 뒤 사이 포함) · point 동시 지목(3) · reveal 공개(4) */
export type ShowdownStage = "gather" | "speak" | "point" | "reveal";

/** 이 view 의 결전 정보. showdown 단계가 아니거나 day.showdown 이 없으면 undefined */
export function showdownOf(view: RoomView): ShowdownView | undefined {
  return view.phase === "showdown" ? view.day?.showdown : undefined;
}

/** 지금 결전의 단계. 시각이 필요 없다. 이상한 i 값은 null */
export function showdownStageOf(view: RoomView): ShowdownStage | null {
  const sd = showdownOf(view);
  if (sd === undefined) return null;
  if (sd.i === -1) return "gather";
  if (sd.i >= 0 && sd.i <= 2) return "speak";
  if (sd.i === 3) return "point";
  if (sd.i === 4) return "reveal";
  return null;
}

const nameOf = (view: RoomView, seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;

/** 내가 산 사람인가(탈락해 유령이면 false) */
function meAlive(view: RoomView): boolean {
  const me = view.players.find((p) => p.seat === view.me.seat);
  return me !== undefined && isAlive(me);
}

/** 한마디 차례의 주인 좌석(speak 단계에서만) */
export function speakerOf(view: RoomView): number | undefined {
  const sd = showdownOf(view);
  return showdownStageOf(view) === "speak" && sd !== undefined ? sd.order[sd.i] : undefined;
}

/** 지금 내 한마디 차례인가: speak 이고 order[i] 가 나이고 내가 산 사람이고 아직 확정 전(doneAt 없음) */
export function isMySpeakTurn(view: RoomView): boolean {
  const sd = showdownOf(view);
  if (sd === undefined || sd.doneAt !== undefined || !meAlive(view)) return false;
  return speakerOf(view) === view.me.seat;
}

/** 내 한마디 차례에 이미 확정(또는 시간 초과)이 났는가 */
export function myWordDone(view: RoomView): boolean {
  const sd = showdownOf(view);
  return sd !== undefined && sd.doneAt !== undefined && speakerOf(view) === view.me.seat;
}

/** 지금 보일 인용: 한마디(word)가 있고 시간 초과(skip)가 아닐 때, 말한 사람의 좌석·이름·글. 없으면 null */
export function quoteOf(view: RoomView): { seat: number; name: string; text: string } | null {
  const sd = showdownOf(view);
  const seat = speakerOf(view);
  if (sd === undefined || seat === undefined || sd.skip === true || sd.word === undefined || sd.word === "") return null;
  return { seat, name: nameOf(view, seat) ?? "", text: sd.word };
}

/** 동시 지목에서 내가 가리킬 수 있는 좌석(나를 뺀 산 사람). 지목 창이 아니거나 내가 유령이면 빈 배열 */
export function pointSeatsOf(view: RoomView): number[] {
  const sd = showdownOf(view);
  if (sd === undefined || showdownStageOf(view) !== "point" || !meAlive(view) || !sd.order.includes(view.me.seat)) return [];
  const alive = new Set(view.players.filter(isAlive).map((p) => p.seat));
  return sd.order.filter((seat) => seat !== view.me.seat && alive.has(seat));
}

/** 공개 단계(i 4)의 득표: 대상 좌석 → 표 수(0표 없음) */
export function revealCounts(view: RoomView): Record<number, number> {
  const out: Record<number, number> = {};
  if (showdownStageOf(view) !== "reveal") return out;
  for (const line of showdownOf(view)?.points ?? []) out[line.target] = (out[line.target] ?? 0) + 1;
  return out;
}

/** 공개 단계에서 모두가 같은 순간 가리키는 줄(좌석 → 대상). 공개 단계가 아니면 빈 배열 */
export function revealPoints(view: RoomView): readonly PointLine[] {
  return showdownStageOf(view) === "reveal" ? (showdownOf(view)?.points ?? []) : [];
}
