// 투표 단계 상태를 실제 전이(startGame, tick)와 실제 투표 주입(castExecVote, castCandidateVote)으로 만드는 테스트 도우미.
// 테스트에서만 import 한다 — 서버는 쓰지 않는다. 상태를 손으로 짜 맞추지 않는 이유(Pitfall 12): view.test.ts 의 stateAt 처럼
// "다음 단계 표" 만 따라가면 분기 단계(투표 통과 여부에 따라 갈리는 단계)에 닿지 못하고, 손으로 만든 상태는 규칙이 바뀌어도 초록으로 남는다.
// 난수는 seededRandInt 로 주입한다(시드가 같으면 같은 판).
import { isAlive } from "../../shared/game/alive";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { castCandidateVote, castExecVote } from "../../shared/game/vote";
import type { PhaseId } from "../../shared/protocol";
import { seededRandInt } from "./seededRandom";

export const START_AT = 10_000;

/** n 명이 모두 연결된 대기실. id·token 은 서로의 부분 문자열이 아니다(누출 검사가 부분 문자열로 훑는다). */
export function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 표 없이 다음 단계 표만 따라 목표 단계의 첫 순간까지. 분기 단계(후보 선택 이후)에는 닿지 못한다 — 그쪽은 stateWithVerdict. */
export function startedAt(n: number, seed: number, phase: PhaseId): RoomState {
  const lobby = lobbyOf(n);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  for (let guard = 0; state.phase !== phase; guard += 1) {
    if (state.phaseEndsAt === null || guard > 60) throw new Error(`cannot reach ${phase}`);
    state = tick(state, state.phaseEndsAt, seededRandInt(seed + 1));
  }
  return state;
}

const seatToId = (state: RoomState, seat: number): string => {
  const player = state.players.find((p) => p.seat === seat);
  if (!player) throw new Error(`no player at seat ${seat}`);
  return player.id;
};

/** seat → 찬성 여부를 실제 castExecVote 로 주입한다. 거부되면 테스트 준비가 틀린 것이다. */
export function castExecVotes(state: RoomState, agreeBySeat: Record<number, boolean>): RoomState {
  let current = state;
  for (const [seat, agree] of Object.entries(agreeBySeat)) {
    const result = castExecVote(current, seatToId(current, Number(seat)), agree);
    if (!result.ok) throw new Error(`castExecVote rejected seat ${seat}: ${result.error}`);
    current = result.state;
  }
  return current;
}

/** seat → 고른 seat 를 실제 castCandidateVote 로 주입한다. 거부되면 테스트 준비가 틀린 것이다. */
export function castCandidateVotes(state: RoomState, targetBySeat: Record<number, number>): RoomState {
  let current = state;
  for (const [seat, target] of Object.entries(targetBySeat)) {
    const result = castCandidateVote(current, seatToId(current, Number(seat)), target);
    if (!result.ok) throw new Error(`castCandidateVote rejected seat ${seat}: ${result.error}`);
    current = result.state;
  }
  return current;
}

export type CandidateSpec = "citizen" | "mafia" | number | "tie" | "none";

/**
 * 후보 선택 단계 이후의 상태를 실제 투표와 tick 으로 만든다.
 *  - 여부 투표: 생존자 전원 찬성 → 통과 → candidateVote.
 *  - candidate: 'citizen' / 'mafia' 는 그 직업의 가장 낮은 seat, 숫자는 그 seat 가 최다 득표(나머지 생존자가 모두 그 사람을 고르고 그 사람은 다른 사람을 고른다),
 *    'tie' 는 seat 0 과 1 이 서로를 고른 1:1 동률, 'none' 은 아무도 안 고름(0표). 기본값은 'citizen'.
 *  - phase: candidateVote(투표 직후, 마감 전) · candidateVoteReveal · defense · execution 의 첫 순간. 후보가 없으면 defense·execution 에 닿을 수 없다.
 */
export function stateWithVerdict(
  n: number,
  seed: number,
  phase: "candidateVote" | "candidateVoteReveal" | "defense" | "execution",
  opts: { candidate?: CandidateSpec } = {},
): RoomState {
  const spec = opts.candidate ?? "citizen";
  let state = startedAt(n, seed, "execVote");
  const agree: Record<number, boolean> = {};
  for (const p of state.players) if (isAlive(p)) agree[p.seat] = true;
  state = castExecVotes(state, agree);
  state = tick(state, state.phaseEndsAt!, seededRandInt(seed + 2));
  if (state.phase !== "candidateVote") throw new Error(`expected candidateVote, got ${state.phase}`);

  const alive = state.players.filter(isAlive).sort((a, b) => a.seat - b.seat);
  const targetBySeat: Record<number, number> = {};
  if (spec === "tie") {
    targetBySeat[alive[0]!.seat] = alive[1]!.seat;
    targetBySeat[alive[1]!.seat] = alive[0]!.seat;
  } else if (spec !== "none") {
    const candidateSeat =
      typeof spec === "number" ? spec : alive.find((p) => p.role === (spec === "mafia" ? "mafia" : "citizen"))?.seat;
    if (candidateSeat === undefined) throw new Error(`no ${String(spec)} to elect`);
    const other = alive.find((p) => p.seat !== candidateSeat)!;
    for (const p of alive) targetBySeat[p.seat] = p.seat === candidateSeat ? other.seat : candidateSeat;
  }
  state = castCandidateVotes(state, targetBySeat);
  if (phase === "candidateVote") return state;

  const steps: PhaseId[] = ["candidateVoteReveal", "defense", "execution"];
  for (const step of steps) {
    state = tick(state, state.phaseEndsAt!, seededRandInt(seed + 3));
    if (state.phase !== step) throw new Error(`expected ${step}, got ${state.phase}`);
    if (step === phase) return state;
  }
  throw new Error(`unreachable phase ${phase}`);
}
