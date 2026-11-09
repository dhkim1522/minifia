// 로비 의상 규칙(결정 D-6, 10-02). 의상은 꾸미기 값이고 실제 역할의 함수가 아니다 — 이 모듈은 Player.role 을 읽지 않는다(L25, 결정 0015).
// 서버가 정하는 것은 단계·행위자·값의 형식뿐이다. 마피아 의상을 시민이 입어도 거절하지 않고 참·거짓을 판정하지 않는다.
// 순수 모듈이다 — 시각·난수를 읽지 않고 입력 상태를 바꾸지 않는다.
import { OUTFIT_IDS } from "../protocol";
import type { OutfitId } from "../protocol";
import type { VoteError } from "./discussion";
import type { RoomState } from "./room";

/** 고르지 않은 사람의 의상(역할에 따른 기본값·무작위 기본값은 없다). */
export const DEFAULT_LOOK: OutfitId = "coat";

/** 같은 사람의 의상 요청 최소 간격(ms, O-8). 안의 요청은 방 DO 가 오류 없이 버리고 보낸 소켓에 자기 state 만 보낸다. */
export const LOOK_MIN_GAP_MS = 250;

/**
 * 의상 고르기. 검사 순서가 계약이다: 단계(lobby·ended 가 아니면 WRONG_PHASE) → 행위자(방에 있음, 아니면 BAD_MESSAGE)
 * → 값(OUTFIT_IDS 안, 아니면 BAD_MESSAGE) → 같은 값(저장값 ?? 기본 coat 와 같으면 입력 상태 그대로 ok) → 잠금(다른 사람이 직접 고른 옷, D-02 — 거절은 이유 없이 state 한 프레임, L30) → 그 사람의 look 만 바뀐 새 상태.
 */
export function setLook(
  state: RoomState,
  actorId: string,
  look: OutfitId,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "lobby" && state.phase !== "ended") return { ok: false, error: "WRONG_PHASE" }; // 결과 단계에서도 고른다(D-16) — 의상은 다음 판에도 남는다
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor) return { ok: false, error: "BAD_MESSAGE" };
  if (!(OUTFIT_IDS as readonly string[]).includes(look)) return { ok: false, error: "BAD_MESSAGE" };
  if ((actor.look ?? DEFAULT_LOOK) === look) return { ok: true, state };
  if (lockedOutfits(state.players.filter((p) => p.id !== actorId)).has(look)) return { ok: false, error: "BAD_MESSAGE" }; // 남이 직접 고른 옷 — 거절 이유는 드러내지 않는다(D-02, L30)
  return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, look } : p)) } };
}

/**
 * 시작 때 겹친 옷 풀기(결정 0081-1·D-01). 옷은 역할의 함수가 아니다(L25) — seat·look 만 읽고 난수·시각·역할은 받지 않는다.
 * 2패스: 1패스는 (직접 고름 먼저 → 좌석 오름차순)으로 옷마다 지키는 사람을 모두 정하고, 2패스는 진 사람에게 OUTFIT_IDS 순서로 아직 아무도 안 입은 첫 옷을 준다
 * (1패스만 쓰면 진 사람이 뒤 좌석이 직접 고른 옷을 가로채 연쇄 변경이 생긴다). 기본 coat 를 지킨 사람은 look 키가 계속 없고, 바뀐 사람만 look 이 생긴다.
 * 바뀐 사람이 없으면 입력 배열을 그대로(같은 객체) 돌려준다. 입력은 바꾸지 않는다.
 */
export function resolveLookConflicts<P extends { seat: number; look?: OutfitId }>(players: readonly P[]): readonly P[] {
  const ranked = [...players].sort((a, b) => Number(a.look === undefined) - Number(b.look === undefined) || a.seat - b.seat);
  const taken = new Set<OutfitId>();
  const losers: P[] = [];
  for (const p of ranked) {
    const wear = p.look ?? DEFAULT_LOOK;
    if (taken.has(wear)) losers.push(p);
    else taken.add(wear);
  }
  if (losers.length === 0) return players;
  const next = new Map<number, OutfitId>();
  for (const p of losers) {
    const free = OUTFIT_IDS.find((id) => !taken.has(id)); // 옷 9종 > 자리 8 이라 늘 있다
    if (free === undefined) continue;
    taken.add(free);
    next.set(p.seat, free);
  }
  return players.map((p) => {
    const look = next.get(p.seat);
    return look === undefined ? p : { ...p, look };
  });
}

/**
 * 다른 사람이 직접 고른 옷(look 키가 있는 옷)의 집합 — 옷장 잠금(결정 0081-1·D-02). 호출 쪽이 "나"를 뺀 목록을 넘긴다.
 * look 키가 없는 사람의 기본 coat 는 넣지 않는다(고르면 저장되고, 겹침은 시작 때 resolveLookConflicts 가 푼다).
 */
export function lockedOutfits(others: ReadonlyArray<{ look?: OutfitId }>): ReadonlySet<OutfitId> {
  return new Set(others.flatMap((p) => (p.look === undefined ? [] : [p.look])));
}
