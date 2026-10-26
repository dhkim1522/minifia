// 처형 투표 규칙. 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 결정 0034·D-02: 여부 투표는 익명이다. 개인 표(Player.execVote)는 서버 전용이고 뷰 허용 목록에 없으며,
// 마감 훅(resolveExecVote)이 집계 직후 키째 지운다 — 익명을 뷰 코드가 아니라 "데이터가 없다" 는 사실로 지킨다(Pitfall 22).
import type { ExecTally } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";
import type { DeadlineResult } from "./tick";

export type VoteError = "WRONG_PHASE" | "BAD_MESSAGE";

/**
 * 처형 여부 표 한 번(찬성 true / 반대 false). 마지막 값이 유효하다(번복 가능).
 * 검사 순서가 계약이다: 단계(execVote 아니면 누구든 WRONG_PHASE) → 행위자(방에 있고 생존, 아니면 BAD_MESSAGE)
 * → 값(불리언, 아니면 BAD_MESSAGE) → 같은 값이면 입력 상태 그대로 ok → 그 사람의 execVote 만 바뀐 새 상태.
 * 마감(phaseEndsAt)은 절대 건드리지 않는다: 모두가 일찍 던져도 10초를 다 채우고(D-28), 마감 이동은 투표 타이밍을 흘린다.
 */
export function castExecVote(
  state: RoomState,
  actorId: string,
  agree: boolean,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "execVote") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (typeof agree !== "boolean") return { ok: false, error: "BAD_MESSAGE" };
  if (actor.execVote === agree) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, execVote: agree } : p)) },
  };
}

/**
 * 실시간 집계와 마감 집계가 같은 함수다(보이던 수와 결과가 어긋나지 않게, Pitfall 2). 생존자의 true/false 만 센다 —
 * 안 던진 사람(undefined)과 탈락자의 값은 어느 쪽에도 세지 않는다.
 */
export function execTallyOf(state: RoomState): ExecTally {
  let yes = 0;
  let no = 0;
  for (const p of state.players) {
    if (!isAlive(p)) continue;
    if (p.execVote === true) yes += 1;
    else if (p.execVote === false) no += 1;
  }
  return { yes, no };
}

/**
 * execVote 마감 훅. 판정 규칙표(RESEARCH 투표 규칙표, 결정 0034·D-02·D-04):
 *   던진 표 0                       → 통과 아님 → night
 *   찬성 × 2 > 던진 표              → 통과 → 후보 선택(표의 기본 다음 단계)
 *   찬성 = 반대 / 찬성 < 반대       → 통과 아님 → night
 *   던진 표 1 (찬성)                → 통과 (1 × 2 > 1)
 *   생존 5 · 던진 2 · 찬성 2        → 통과 (분모는 던진 표, 생존자 수가 아니다)
 *   생존 5 · 던진 4 · 찬성 2        → 통과 아님
 * 못 던진 표(끊김 포함)는 분모에도 들지 않는다 — 기권 버튼이 없다(D-04, D-05). 던진 뒤 끊긴 사람의 표는 센다.
 * 정족수 없음(1표 통과)은 잠금 결정의 귀결이다. 바뀌면 이 함수와 위 표만 고친다(Pitfall 3).
 * 집계 직후 모든 플레이어에서 execVote 키를 구조 분해로 빼고, 공개 기록(voteLog)에는 집계 수와 통과 여부만 쌓는다(D-08).
 */
export function resolveExecVote(state: RoomState): DeadlineResult {
  const { yes, no } = execTallyOf(state);
  const thrown = yes + no;
  const passed = thrown > 0 && yes * 2 > thrown;
  const players = state.players.map((p) => {
    const { execVote: _execVote, ...kept } = p;
    return kept;
  });
  const next: RoomState = {
    ...state,
    players,
    voteLog: [...(state.voteLog ?? []), { n: state.day ?? 1, exec: { yes, no, passed } }],
    verdict: { passed },
  };
  return passed ? { state: next, stay: false } : { state: next, stay: false, next: "night" };
}

/**
 * execVote 진입 훅: 지난 투표의 남은 흔적(verdict·execution 과 모든 플레이어의 execVote·candidateVote)을 키째 지운다.
 * 날짜별 기록(voteLog)과 처형 문구 기억(lastExecPhrase)은 판 내내 남긴다.
 */
export function enterExecVote(state: RoomState): RoomState {
  const { verdict: _verdict, execution: _execution, ...rest } = state;
  return {
    ...rest,
    players: state.players.map((p) => {
      const { execVote: _execVote, candidateVote: _candidateVote, ...kept } = p;
      return kept;
    }),
  };
}
