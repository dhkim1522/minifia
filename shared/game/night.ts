// 밤 규칙. 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 난수는 인자 randInt 로만 받는다(방 DO 는 cryptoRandInt, 테스트는 seededRandInt).
//
// 이 파일이 플레이어의 role 을 읽는 이유는 행동 종류(지목·조사·보호)·마피아 표·조사 결과가 서버 판정이기 때문이다.
// 읽은 역할 값은 어디에도 내보내지 않는다(결정 0002): 반환값에는 isMafia 불리언 하나와 seat 뿐이다.
import { MORNING_PHRASE_COUNT } from "../protocol";
import type { InvestigationRecord } from "../protocol";
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";
import type { RandInt } from "./tick";

export type NightError = "WRONG_PHASE" | "BAD_MESSAGE";

/**
 * 밤 행동(지목·조사·보호) 한 번. 행동 종류는 메시지가 아니라 보낸 사람의 서버 저장 역할이 정한다.
 * 검사 순서가 계약이다: 단계(night 아니면 WRONG_PHASE) → 행위자(방에 있고 생존, 아니면 BAD_MESSAGE)
 * → 역할(마피아·경찰·의사) → 대상(정수·앉은 생존자) → 같은 값이면 입력 상태 그대로 ok → 그 사람의 nightPick 만 바꾼 새 상태.
 */
export function pickTarget(
  state: RoomState,
  actorId: string,
  target: number,
): { ok: true; state: RoomState } | { ok: false; error: NightError } {
  if (state.phase !== "night") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.role !== "mafia" && actor.role !== "police" && actor.role !== "doctor") {
    return { ok: false, error: "BAD_MESSAGE" };
  }
  const chosen = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
  if (!chosen || !isAlive(chosen)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.nightPick === target) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, nightPick: target } : p)) },
  };
}

/** 밤 진입 훅: 남은 선택(nightPick)·지난 아침 결과(morning)·밤 채팅 번호(nextNightSeq)를 키째 지운다. 낮 채팅 번호는 건드리지 않는다. */
export function enterNight(state: RoomState): RoomState {
  const { morning: _morning, nextNightSeq: _nextNightSeq, ...rest } = state;
  return {
    ...rest,
    players: state.players.map((p) => {
      const { nightPick: _nightPick, ...kept } = p;
      return kept;
    }),
  };
}

/** 마피아 표 집계: 생존 마피아가 고른 앉은 생존 비마피아만 센다. 최다가 하나일 때만 그 seat. */
function mafiaTarget(state: RoomState): number | undefined {
  const votes = new Map<number, number>();
  for (const p of state.players) {
    if (p.role !== "mafia" || !isAlive(p) || p.nightPick === undefined) continue;
    const t = state.players.find((q) => q.seat === p.nightPick);
    if (!t || !isAlive(t) || t.role === "mafia") continue;
    votes.set(t.seat, (votes.get(t.seat) ?? 0) + 1);
  }
  const top = Math.max(0, ...votes.values());
  const tied = [...votes].filter(([, c]) => c === top && top > 0).map(([seat]) => seat);
  return tied.length === 1 ? tied[0] : undefined;
}

/** 그 밤의 판정. 상태는 바꾸지 않고 결과만 돌려준다. */
export function resolveNight(
  state: RoomState,
  randInt: RandInt,
): { eliminated?: number; phrase?: number; records: Array<{ playerId: string; record: InvestigationRecord }> } {
  const eliminated = mafiaTarget(state);
  if (eliminated === undefined) return { records: [] };
  return { eliminated, phrase: 1 + randInt(MORNING_PHRASE_COUNT), records: [] };
}

/** morning 진입 훅: resolveNight 결과를 한 번의 새 상태로 적용한다. 모든 nightPick 키를 지운다. */
export function enterMorning(state: RoomState, randInt: RandInt): RoomState {
  const result = resolveNight(state, randInt);
  const players: Player[] = state.players.map((p) => {
    const { nightPick: _nightPick, ...kept } = p;
    return result.eliminated === p.seat ? { ...kept, alive: false } : kept;
  });
  const next: RoomState = {
    ...state,
    players,
    morning: result.eliminated === undefined ? {} : { eliminated: result.eliminated, phrase: result.phrase },
  };
  return result.phrase === undefined ? next : { ...next, lastPhrase: result.phrase };
}
