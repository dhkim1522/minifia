// 직업 주장 배지 규칙(결정 0066-1, 09.1.1-01). 주장은 공개 값이고 실제 역할의 함수가 아니다 — 이 모듈은 Player.role 을 읽지 않는다(L18, 결정 0015).
// 서버가 정하는 것은 단계·행위자·값의 형식뿐이다. 참·거짓은 판정하지 않고 거절 사유로도 쓰지 않는다.
// 순수 모듈이다 — 시각·난수를 읽지 않고 입력 상태를 바꾸지 않는다.
import type { BadgeId, PhaseId } from "../protocol";
import { isAlive } from "./alive";
import type { VoteError } from "./discussion";
import type { RoomState } from "./room";
import { rolesInPlay } from "./roles";

/** 주장을 걸 수 있는 단계: 낮 시작 발표·토론·지목·마지막 3인 결전(결정 0066-1). 마감(변론부터) 뒤에는 거절한다. */
export const BADGE_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["dayAnnounce", "discussion", "nomination", "showdown"]);

/** 화면 선택지 고정 순서(시민·경찰·의사·마피아·none). */
export const BADGE_ORDER: readonly BadgeId[] = ["citizen", "police", "doctor", "mafia", "none"];

/** 같은 사람의 주장 요청 최소 간격(ms). 안의 요청은 방 DO 가 오류 없이 버린다(T-09.1.1-03). */
export const BADGE_MIN_GAP_MS = 250;

/** 이번 판 구성 직업 + none, BADGE_ORDER 순서. 4명판에는 doctor 가 없다. */
export function badgeChoicesOf(playerCount: number): BadgeId[] {
  const inPlay = rolesInPlay(playerCount);
  return BADGE_ORDER.filter((b) => b === "none" || inPlay.includes(b));
}

/**
 * 주장 걸기·바꾸기. 검사 순서가 계약이다: 단계(BADGE_PHASES 밖이면 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 값(badgeChoicesOf 안, 아니면 BAD_MESSAGE) → 같은 값이면 입력 상태 그대로 ok → 그 사람의 badge 만 바뀐 새 상태.
 * 말 바꿈(O-1, 직전 값 기준): 직전 값(player.badge ?? "none")이 none 이 아니고 새 값과 다르면 badgeSwapped 가 켜지고 판이 끝날 때까지 꺼지지 않는다.
 * 첫 걸기(직전 값 none)는 바뀐 것이 아니다. 확정 변경마다 서버 전용 badgeLog 에 {n: 일차, v: 새 값} 한 줄이 쌓인다(O-20, 11페이즈 입력).
 */
export function setBadge(
  state: RoomState,
  actorId: string,
  badge: BadgeId,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (!BADGE_PHASES.has(state.phase)) return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (!badgeChoicesOf(state.players.length).includes(badge)) return { ok: false, error: "BAD_MESSAGE" };
  if ((actor.badge ?? "none") === badge) return { ok: true, state };
  const previous: BadgeId = actor.badge ?? "none";
  const swapped = actor.badgeSwapped === true || previous !== "none"; // 여기까지 왔으면 새 값은 직전 값과 다르다
  const log = [...(actor.badgeLog ?? []), { n: state.day ?? 1, v: badge }];
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === actorId ? { ...p, badge, badgeLog: log, ...(swapped ? { badgeSwapped: true as const } : {}) } : p,
      ),
    },
  };
}
