// 처형 투표 규칙. 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 결정 0034·D-02: 여부 투표는 익명이다. 개인 표(Player.execVote)는 서버 전용이고 뷰 허용 목록에 없으며,
// 마감 훅(resolveExecVote)이 집계 직후 키째 지운다 — 익명을 뷰 코드가 아니라 "데이터가 없다" 는 사실로 지킨다(Pitfall 22).
import type { CandidateVoteLine, ExecTally } from "../protocol";
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

/**
 * 후보 선택 표 한 번(고른 seat). 마지막 값이 유효하다(번복 가능).
 * 검사 순서가 계약이다: 단계(candidateVote 아니면 누구든 WRONG_PHASE) → 행위자(방에 있고 생존, 아니면 BAD_MESSAGE)
 * → 취소(target null, 결정 0040): 그 사람의 candidateVote 가 없으면 입력 상태 그대로 ok(무전송), 있으면 그 키만 지운 새 상태
 * → 대상(정수·앉은 생존자, 아니면 BAD_MESSAGE) → 자기 자신이면 BAD_MESSAGE(D-03, 화면이 막아도 서버가 방어선)
 * → 같은 값이면 입력 상태 그대로 ok → 그 사람의 candidateVote 만 바뀐 새 상태.
 * 마감(phaseEndsAt)은 절대 건드리지 않는다: 일찍 던져도 15초를 다 채운다(D-28).
 */
export function castCandidateVote(
  state: RoomState,
  actorId: string,
  target: number | null,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "candidateVote") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (target === null) {
    if (actor.candidateVote === undefined) return { ok: true, state };
    return {
      ok: true,
      state: {
        ...state,
        players: state.players.map((p) => {
          if (p.id !== actorId) return p;
          const { candidateVote: _candidateVote, ...kept } = p;
          return kept;
        }),
      },
    };
  }
  const chosen = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
  if (!chosen || !isAlive(chosen)) return { ok: false, error: "BAD_MESSAGE" };
  if (chosen.seat === actor.seat) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.candidateVote === target) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, candidateVote: target } : p)) },
  };
}

/**
 * 후보 선택 집계와 공개 순서(공개 구간 진입 훅에서 한 번, Pattern 2). 판정 규칙표(후보 행, 결정 0034·D-03·D-04):
 *   던진 표 0                         → votes [] · 후보 없음 → 공개 뒤 night
 *   최다 득표 대상이 한 명            → 그 사람이 후보 → defense
 *   최다 동률                         → 후보 없음 → 공개 뒤 night (밤 지목처럼 무작위로 고르지 않는다 — Pitfall 4, D-03)
 *   탈락한 투표자의 표 · 저장된 대상이 탈락자인 표 → 세지 않는다
 * 못 던진 표(끊김 포함)는 줄이 없다(무효표). 던진 뒤 끊긴 사람의 표는 센다(CONN-02).
 * 취소한 사람은 키가 없어 줄이 없다 = 무효표, 공개 길이(candidateRevealMs)에서도 빠진다(결정 0040·0039).
 * votes 는 던진 표를 seat 오름차순으로 모은 뒤 roles.ts 와 같은 Fisher–Yates 로 섞은 순서이고, 이 배열 순서가 모든 폰의 공개 순서다(D-20).
 * 난수 호출 순서 계약: 던진 표 수 n ≥ 2 이면 i = n-1 … 1 에 randInt(i+1) (즉 인자 n, n-1, …, 2 순서), n ≤ 1 이면 부르지 않는다.
 * 동률·0표 판정에는 난수를 쓰지 않으며 randInt(0)·randInt(1) 은 부르지 않는다. 입력 상태는 바꾸지 않는다(배열은 복사).
 */
export function tallyCandidateVote(
  state: RoomState,
  randInt: (n: number) => number,
): { votes: CandidateVoteLine[]; candidate?: number } {
  const seated = new Map(state.players.map((p) => [p.seat, p]));
  const votes: CandidateVoteLine[] = [];
  for (const p of [...state.players].sort((a, b) => a.seat - b.seat)) {
    if (!isAlive(p) || p.candidateVote === undefined) continue;
    const target = seated.get(p.candidateVote);
    if (!target || !isAlive(target)) continue;
    votes.push({ seat: p.seat, target: target.seat });
  }

  const counts = new Map<number, number>();
  for (const v of votes) counts.set(v.target, (counts.get(v.target) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  const leaders = [...counts].filter(([, count]) => count === top && top > 0).map(([seat]) => seat);

  for (let i = votes.length - 1; i >= 1; i -= 1) {
    const j = randInt(i + 1);
    [votes[i], votes[j]] = [votes[j]!, votes[i]!];
  }
  return leaders.length === 1 ? { votes, candidate: leaders[0]! } : { votes };
}
