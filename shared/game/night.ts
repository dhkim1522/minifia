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
 * → 역할(마피아·경찰·의사) → 대상(정수·앉은 생존자) → 마피아가 고른 대상이 마피아(자신·동료)면 BAD_MESSAGE → 같은 값이면 입력 상태 그대로 ok → 그 사람의 nightPick 만 바꾼 새 상태.
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
  // 마피아는 자신·동료를 고를 수 없다. 화면이 막아 두지만 서버가 방어선이다(D-02).
  if (actor.role === "mafia" && chosen.role === "mafia") return { ok: false, error: "BAD_MESSAGE" };
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

/**
 * 판정 규칙표(결정 0020). 모든 행동은 밤 시작 시점의 생존자 기준으로 동시에 해결한다.
 *   마피아 아무도 안 고름           → 지목 없음, 탈락 없음, morning {} (D-08)
 *   마피아 일부만 고름              → 고른 사람의 표만 센다 (A2)
 *   최다 대상 하나                  → 그 대상
 *   최다 동률                       → seat 오름차순 목록에서 tied[randInt(tied.length)] (D-07)
 *   저장된 지목이 탈락자·마피아     → 집계에서 뺀다(방어적 재검증)
 *   의사 보호 = 최종 지목           → 탈락 없음, morning {} — 지목 없음과 구별되지 않는다 (D-13). 자기 보호 허용
 *   경찰 조사                       → { n: day ?? 1, target, isMafia } 를 그 경찰의 investigations 끝에 (D-09). 자기 조사 = false
 *   그 밤에 지목되는 경찰·의사      → 조사·보호는 그대로 적용 — 동시 해결 (A1)
 *   문구                            → 탈락자가 있을 때만 1..MORNING_PHRASE_COUNT 에서 lastPhrase 를 뺀 오름차순 후보 중 하나 (D-18)
 * 동시 해결(A1)·고른 표만 센다(A2)는 사용자가 바꿀 수 있는 기본값이다 — 바뀌면 이 표와 테스트만 고친다(결정 0020).
 * 난수 호출 순서 계약: 동률일 때 한 번(randInt(동률 수)), 탈락자가 있을 때 한 번(randInt(후보 문구 수)).
 * 필요 없으면 부르지 않는다 — 인자 0 호출은 없다(cryptoRandInt(0) 은 RangeError).
 */
export function resolveNight(
  state: RoomState,
  randInt: RandInt,
): { eliminated?: number; phrase?: number; records: Array<{ playerId: string; record: InvestigationRecord }> } {
  const seated = (seat: number | undefined): Player | undefined =>
    seat === undefined ? undefined : state.players.find((q) => q.seat === seat);
  const living = state.players.filter(isAlive);

  // 마피아 표: 생존 마피아가 고른 앉은 생존 비마피아만 센다(A2).
  const votes = new Map<number, number>();
  for (const p of living) {
    if (p.role !== "mafia") continue;
    const t = seated(p.nightPick);
    if (!t || !isAlive(t) || t.role === "mafia") continue;
    votes.set(t.seat, (votes.get(t.seat) ?? 0) + 1);
  }
  const top = Math.max(0, ...votes.values());
  const tied = [...votes]
    .filter(([, count]) => count === top && top > 0)
    .map(([seat]) => seat)
    .sort((a, b) => a - b);
  const target = tied.length <= 1 ? tied[0] : tied[randInt(tied.length)];

  // 의사 보호: 밤 시작 시점의 생존 의사 중 최종 지목을 고른 사람이 있으면 탈락 없음(A1: 지목되는 의사의 보호도 적용).
  const saved = target !== undefined && living.some((p) => p.role === "doctor" && p.nightPick === target);
  const eliminated = target !== undefined && !saved ? target : undefined;

  // 경찰 조사: 밤 시작 시점의 생존 경찰마다 고른 앉은 생존자의 마피아 여부 한 비트(A1: 지목되는 경찰의 조사도 기록).
  const records: Array<{ playerId: string; record: InvestigationRecord }> = [];
  for (const p of living) {
    if (p.role !== "police") continue;
    const t = seated(p.nightPick);
    if (!t || !isAlive(t)) continue;
    records.push({ playerId: p.id, record: { n: state.day ?? 1, target: t.seat, isMafia: t.role === "mafia" } });
  }

  if (eliminated === undefined) return { records };
  const candidates: number[] = [];
  for (let n = 1; n <= MORNING_PHRASE_COUNT; n += 1) if (n !== state.lastPhrase) candidates.push(n);
  return { eliminated, phrase: candidates[randInt(candidates.length)], records };
}

/**
 * morning 진입 훅: resolveNight 결과를 한 번의 새 상태로 적용한다 — 탈락자 alive false(직업은 싣지 않는다),
 * 경찰 investigations 뒤에 추가, morning 은 탈락자가 있으면 { eliminated, phrase } 없으면 {}, 탈락자가 있으면 lastPhrase 갱신,
 * 모든 nightPick 키 제거(아침 뷰에 선택 흔적이 남지 않는다).
 */
export function enterMorning(state: RoomState, randInt: RandInt): RoomState {
  const result = resolveNight(state, randInt);
  const players: Player[] = state.players.map((p) => {
    const { nightPick: _nightPick, ...kept } = p;
    const added = result.records.filter((r) => r.playerId === p.id).map((r) => r.record);
    const withRecords = added.length > 0 ? { ...kept, investigations: [...(kept.investigations ?? []), ...added] } : kept;
    return result.eliminated === p.seat ? { ...withRecords, alive: false } : withRecords;
  });
  const next: RoomState = {
    ...state,
    players,
    morning: result.eliminated === undefined ? {} : { eliminated: result.eliminated, phrase: result.phrase },
  };
  return result.phrase === undefined ? next : { ...next, lastPhrase: result.phrase };
}

const bySeat = (a: Player, b: Player): number => a.seat - b.seat;

/**
 * 밤 행동 뒤 state 를 받는 사람 — 행위자 쪽과 관전자(탈락자, 결정 0021). 행위자가 마피아면 생존 마피아 전원, 아니면 본인뿐이다.
 * 살아 있는 다른 사람에게 보내면 '누군가 행동했다' 는 프레임 타이밍이 샌다(RESEARCH Pitfall 1). 중복 없이 seat 오름차순.
 */
export function pickRecipientIds(state: RoomState, actorId: string): string[] {
  const actor = state.players.find((p) => p.id === actorId);
  const actorSide =
    actor?.role === "mafia" ? state.players.filter((p) => p.role === "mafia" && isAlive(p)) : actor ? [actor] : [];
  const spectators = state.players.filter((p) => !isAlive(p));
  const seen = new Map<string, Player>();
  for (const p of [...actorSide, ...spectators]) seen.set(p.id, p);
  return [...seen.values()].sort(bySeat).map((p) => p.id);
}

/**
 * 밤 채팅·이모티콘을 받는 소켓 — 살아 있는 마피아와 관전자(결정 0019·0021). 단계 판단은 부르는 쪽(워커)이 한다.
 * 탈락한 마피아는 관전자로 든다(보낼 수는 없다).
 */
export function nightChatRecipientIds(state: RoomState): ReadonlySet<string> {
  return new Set(state.players.filter((p) => !isAlive(p) || p.role === "mafia").map((p) => p.id));
}
