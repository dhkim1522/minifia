// 방 연속성(결정 D-17·D-18, CONNX-01·02): 방장 자동 이양과 대기실 끊긴 사람 정리. 순수 함수 — 입력을 바꾸지 않고, 시각은 인자 now 로 받는다.
// disconnectedAt·left 는 서버 전용이다(L43): 이 모듈의 결과는 hostId·players 만 바꾸고 어떤 view·프레임에도 새 키를 만들지 않는다.
import type { Player, RoomState } from "./room";

/** 방장이 끊긴 뒤 다음 방장에게 넘기기까지의 유예(D-17). 요구사항 30~60초의 중간. */
export const HOST_GRACE_MS = 45_000;
/** 테스트 방(state.testMode)의 유예 — 검사용. */
export const HOST_GRACE_TEST_MS = 3_000;
/** 대기실에서 끊긴 사람을 방에서 지우기까지(D-18). 쉬는 사람 정리(11-08)도 같은 상수를 쓴다. */
export const LOBBY_PRUNE_MS = 180_000;
/** 테스트 방의 정리 시간 — 검사용. */
export const LOBBY_PRUNE_TEST_MS = 6_000;

const isHuman = (p: Player): boolean => p.isBot !== true;

export const hostGraceOf = (state: Pick<RoomState, "testMode">): number =>
  state.testMode === true ? HOST_GRACE_TEST_MS : HOST_GRACE_MS;

export const pruneAfterOf = (state: Pick<RoomState, "testMode">): number =>
  state.testMode === true ? LOBBY_PRUNE_TEST_MS : LOBBY_PRUNE_MS;

/**
 * 새 방장 후보: 봇이 아니고 지금 연결돼 있고 나가지 않은 사람 가운데 joinSeq 가 가장 작은 사람.
 * 쉬는 사람은 players 밖이라 저절로 빠진다. excludeId 는 나가는 사람(leaveRoom).
 */
export function hostSuccessor(players: readonly Player[], excludeId?: string): Player | undefined {
  let best: Player | undefined;
  for (const p of players) {
    if (!isHuman(p) || !p.connected || p.left === true || p.id === excludeId) continue;
    if (best === undefined || p.joinSeq < best.joinSeq) best = p;
  }
  return best;
}

/** 이양이 필요한 방장 — 사람이고, 나갔거나 끊겨 있고 끊긴 시각이 있다. 없으면 undefined. */
function absentHost(state: RoomState): Player | undefined {
  const host = state.players.find((p) => p.id === state.hostId);
  if (!host || !isHuman(host)) return undefined;
  if (host.left === true) return host;
  if (host.connected || host.disconnectedAt === undefined) return undefined;
  return host;
}

/**
 * 방장이 유예 넘게 끊겨 있고 연결된 후보가 있으면 hostId 를 후보로 바꾼 새 상태, 아니면 같은 객체(멱등).
 * 이양이 곧 권한 이양이다 — 방장 권한은 모두 hostId 로만 판정한다. 옛 방장은 일반 참가자로 남고 되돌려 주지 않는다.
 * 결과 단계에서 나가(left) 후보가 없어 방장 자리를 못 넘긴 사람은 유예 없이, 후보가 연결되는 순간 넘어간다.
 */
export function resolveHost(state: RoomState, now: number): RoomState {
  const host = absentHost(state);
  if (!host) return state;
  if (host.left !== true && now - (host.disconnectedAt as number) < hostGraceOf(state)) return state;
  const successor = hostSuccessor(state.players, host.id);
  if (!successor) return state;
  return { ...state, hostId: successor.id };
}

/** 대기실 정리 대상 — 방장·봇이 아니고, 끊겨 있고, 끊긴 시각이 있는 사람. */
const prunable = (state: RoomState): Player[] =>
  state.players.filter((p) => p.id !== state.hostId && isHuman(p) && !p.connected && p.disconnectedAt !== undefined);

/**
 * 대기실에서만: 끊긴 지 정리 시간(테스트 방은 6초) 이상인 사람을 players 에서 뺀다. 방장·봇은 지우지 않고, 게임 중·결과 단계는 절대 지우지 않는다.
 * 아무도 없으면 같은 객체(멱등). removedIds 는 월드 정리(despawn)에 쓴다. 이양을 먼저 적용한 상태를 넣으면 옛 방장도 같은 규칙을 받는다.
 */
export function pruneLobby(state: RoomState, now: number): { state: RoomState; removedIds: string[] } {
  if (state.phase !== "lobby") return { state, removedIds: [] };
  const limit = pruneAfterOf(state);
  const removedIds = prunable(state)
    .filter((p) => now - (p.disconnectedAt as number) >= limit)
    .map((p) => p.id);
  if (removedIds.length === 0) return { state, removedIds };
  const drop = new Set(removedIds);
  return { state: { ...state, players: state.players.filter((p) => !drop.has(p.id)) }, removedIds };
}

/**
 * 연속성 마감 중 가장 이른 시각(없으면 Infinity): 방장 이양 마감과 대기실 정리 마감.
 * 방장 이양은 연결된 후보가 없으면 알람을 걸지 않는다 — 지난 시각으로 알람이 돌며 헛도는 것을 막고, 후보가 연결되는 hello 가 그 자리에서 이양한다.
 */
export function nextContinuityAt(state: RoomState): number {
  let at = Number.POSITIVE_INFINITY;
  const host = absentHost(state);
  if (host && host.left !== true && hostSuccessor(state.players, host.id)) {
    at = Math.min(at, (host.disconnectedAt as number) + hostGraceOf(state));
  }
  if (state.phase === "lobby") {
    const limit = pruneAfterOf(state);
    for (const p of prunable(state)) at = Math.min(at, (p.disconnectedAt as number) + limit);
  }
  return at;
}
