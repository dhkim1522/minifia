// 직업 주장 배지의 순수 화면 모델 (09.1.1-08, UI-SPEC A). 서버 view.players[].badge·badgeSwapped 만 읽는다 — 실제 역할(view.me.role·spectate)은 읽지 않는다(L10·L23).
// 시각·난수를 읽지 않고 입력을 바꾸지 않는다. 주장은 공개 값이고 실제 역할의 함수가 아니다(결정 0066-1).
import { isAlive } from "../../shared/game/alive";
import { BADGE_PHASES, badgeChoicesOf } from "../../shared/game/badge";
import { RULESET } from "../../shared/game/ruleset";
import type { BadgeId, RoomView } from "../../shared/protocol";
import { ROLE_TEXT } from "./roleText";

/** 화면 문구 단일 출처 (UI-SPEC Copywriting Contract 원문) */
export const BADGE_TEXT = {
  sheetTitle: "직업 배지",
  none: "말 안 함",
  hint: "바꾸면 말 바꿈이 보여요",
  swapNotice: "말 바꿈",
  /** 마감 직후 누름이 서버에서 거절됐을 때 위 알림 */
  reject: "지금은 바꿀 수 없어요",
  close: "닫기",
} as const;

/** 말 바꿈 알약이 떠 있는 시간(ms). 등장 dur-med 뒤 이만큼 유지하고 dur-fast 로 사라진다 — 모션 줄이기면 즉시 나타나 이 시간 뒤 즉시 사라진다(O-22) */
export const BADGE_NOTICE_MS = 2400;
/** 칩을 누른 뒤 시트가 닫히기까지(ms) — 토큰 dur-fast(180ms)와 같은 값 */
export const BADGE_CLOSE_MS = 180;
/** 알약이 사라지는 페이드(ms) — 토큰 dur-fast 와 같은 값 */
export const BADGE_NOTICE_FADE_MS = 180;

/** 배지 한 개를 그리는 재료 */
export interface ClaimLook {
  claim: BadgeId;
  swapped: boolean;
}

/**
 * 좌석의 배지. 산 사람이고 badge 가 있을 때만 — 죽은 좌석(유령 이름표)과 한 번도 안 건 사람은 null.
 * 말 안 함은 처음부터면 그리지 않는다(말 바꿈 점이 있는 none = 직업을 말했다가 되돌린 사람만 quiet 배지).
 * mine: 내 낙관 값. 내 좌석에만 겹치고, 직전 서버 값이 직업이면서 값이 달라지면 말 바꿈으로 본다(서버가 같은 규칙으로 확인한다, shared/game/badge.ts setBadge).
 */
export function claimLook(view: RoomView, seat: number, mine?: BadgeId): ClaimLook | null {
  const row = view.players.find((p) => p.seat === seat);
  if (row === undefined || !isAlive(row)) return null;
  let claim: BadgeId | undefined = row.badge;
  let swapped = row.badgeSwapped === true;
  if (seat === view.me.seat && mine !== undefined) {
    const server: BadgeId = row.badge ?? "none";
    if (mine !== server && server !== "none") swapped = true;
    claim = mine;
  }
  if (claim === undefined) return null;
  if (claim === "none" && !swapped) return null;
  return { claim, swapped };
}

/** 내 서버 주장 값(한 번도 안 걸었으면 none) */
export function myClaim(view: RoomView): BadgeId {
  return view.players.find((p) => p.seat === view.me.seat)?.badge ?? "none";
}

/** 떠 있는 버튼·시트가 있는 단계인가: 주장 창(낮 시작 발표·토론·지목·마지막 3인의 모이기·한마디)이고 내가 산 사람. 유령·변론 이후는 없다(만들지도 않는다) */
export function floatVisible(view: RoomView): boolean {
  // 기본판(결정 0072)에서 꺼짐 — 떠 있는 버튼도 묶음 컨테이너도 시트도 만들지 않는다(빈 띠·비활성 버튼 없음, U-8). RULESET.badge 를 켜면 아래 단계 표가 다시 쓰인다.
  if (!RULESET.badge) return false;
  if (!BADGE_PHASES.has(view.phase)) return false;
  // 마지막 3인 동시 지목(i 3)·공개(i 4)에는 접는다: 삼각형 아래 오른쪽 이름표 지목 버튼이 작은 폰(390×664 등)에서 이 버튼에 가려져 눌리지 않았다(09.1.1-16, UI-SPEC O-2)
  if (view.phase === "showdown" && (view.day?.showdown?.i ?? -1) >= 3) return false;
  const me = view.players.find((p) => p.seat === view.me.seat);
  return me === undefined || isAlive(me);
}

function nameOf(claim: BadgeId): string {
  return claim === "none" ? BADGE_TEXT.none : ROLE_TEXT[claim].name;
}

/** 배지의 접근성 이름: "{직업 이름} 주장[, 말 바꿈]" · "말 안 함, 말 바꿈". 직업 이름은 data-claim 쪽 배지에만 싣는다(L10) */
export function claimLabel(claim: BadgeId, swapped: boolean): string {
  const base = claim === "none" ? BADGE_TEXT.none : `${ROLE_TEXT[claim].name} 주장`;
  return swapped ? `${base}, 말 바꿈` : base;
}

/** 떠 있는 버튼의 접근성 이름 */
export function floatLabel(claim: BadgeId): string {
  return `직업 배지 고르기, 지금 ${nameOf(claim)}`;
}

export interface ClaimChip {
  id: BadgeId;
  label: string;
}

/** 시트 칩: 이번 판 구성 순서 그대로(시민·경찰·의사·마피아·말 안 함, 4명판은 의사 없음) */
export function chipsOf(view: RoomView): ClaimChip[] {
  return badgeChoicesOf(view.players.length).map((id) => ({ id, label: nameOf(id) }));
}

/** 두 view 의 차이로 만드는 배지 효과 (Task 2) */
export interface BadgeFx {
  /** 배지가 바뀐(처음 건 것 포함) 좌석 — 팝 */
  pop: number[];
  /** 말 바꿈이 새로 켜진 좌석 — "말 바꿈" 글자 알약 */
  notice: number[];
  /** 스크린리더 live 한 줄을 읽힐 변화(좌석 + 새 값) */
  said: { seat: number; claim: BadgeId }[];
}

const NO_FX: BadgeFx = { pop: [], notice: [], said: [] };

/**
 * 이전 view 와 지금 view 를 비교해 효과를 만든다. prev 가 null(첫 스냅샷·재접속·연결 번호 바뀜)이면 효과 없음.
 * 같은 좌석의 주장이 바뀌면 pop. 말 바꿈은 서버 규칙(setBadge)과 같다: 직전 값이 직업이었고 새 값이 다르면(또는 badgeSwapped 가 새로 켜지면) notice.
 * 처음 거는 순간(없음 → 직업)과 말 안 함으로 되돌린 뒤 다시 직업을 거는 순간은 바꿈이 아니다. 산 사람이 아닌 좌석, 이전에 없던 좌석은 효과 없음.
 */
export function badgeFxOf(prev: RoomView | null, cur: RoomView): BadgeFx {
  if (prev === null) return NO_FX;
  const fx: BadgeFx = { pop: [], notice: [], said: [] };
  for (const row of cur.players) {
    if (!isAlive(row)) continue;
    const before = prev.players.find((p) => p.seat === row.seat);
    if (before === undefined || !isAlive(before)) continue;
    const was: BadgeId = before.badge ?? "none";
    const now: BadgeId = row.badge ?? "none";
    if (was === now) continue;
    fx.pop.push(row.seat);
    fx.said.push({ seat: row.seat, claim: now });
    if (was !== "none" || (before.badgeSwapped !== true && row.badgeSwapped === true)) fx.notice.push(row.seat);
  }
  return fx;
}

/** 받침이 있는 한글 음절로 끝나는가 */
function endsWithBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 스크린리더 live 한 줄: "{이름} 님이 {직업|말 안 함}이라고 말했어요"(받침에 맞는 조사) */
export function sayLine(nickname: string, claim: BadgeId): string {
  const word = nameOf(claim);
  return `${nickname} 님이 ${word}${endsWithBatchim(word) ? "이라고" : "라고"} 말했어요`;
}
