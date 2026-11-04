// 투표 단계 상태를 실제 전이(startGame, tick)와 실제 투표 주입(castTurnPoint, castVerdict)으로 만드는 테스트 도우미.
// 8페이즈(08-11) 흐름 전환 뒤 낮은 토론 → 지목 → 변론 → 찬반 → 처형이다. 옛 표 도우미(처형 여부·후보 선택)는 08-21 에 지웠다.
// 테스트에서만 import 한다 — 서버는 쓰지 않는다. 상태를 손으로 짜 맞추지 않는 이유(Pitfall 12): view.test.ts 의 stateAt 처럼
// "다음 단계 표" 만 따라가면 분기 단계(지목 결과에 따라 갈리는 단계)에 닿지 못하고, 손으로 만든 상태는 규칙이 바뀌어도 초록으로 남는다.
// 난수는 seededRandInt 로 주입한다(시드가 같으면 같은 판).
// 09.1-03: 지목 방식과 무관 — pickTurn 이 있으면 차례를 걷는다(결정 0063-1).
import { isAlive } from "../../shared/game/alive";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { castTurnPoint, nominationStepMs, stepNomination } from "../../shared/game/nomination";
import { PICK_TURN_MS, SHOWDOWN_POINT_MS, SHOWDOWN_TURN_MS } from "../../shared/game/phases";
import { castRunoffVote, runoffStepMs, stepRunoff } from "../../shared/game/runoff";
import { acceptLastWord, castShowdownPoint, showdownStepMs, stepShowdown } from "../../shared/game/showdown";
import { castVerdict } from "../../shared/game/verdict";
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

/** 표 없이 다음 단계 표만 따라 목표 단계의 첫 순간까지. 분기 단계(지목 결과에 따라 갈리는 night 등)에는 닿지 못한다 — 그쪽은 stateWithVerdict. */
export function startedAt(n: number, seed: number, phase: PhaseId): RoomState {
  return startedFrom(lobbyOf(n), seed, phase);
}

/** startedAt 과 같되 대기실을 직접 준다(봇이 낀 테스트 방처럼 lobbyOf 와 다른 방). */
export function startedFrom(lobby: RoomState, seed: number, phase: PhaseId): RoomState {
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

/**
 * seat → 지목 대상 seat 를 실제 규칙 함수로 주입한다(지목 단계여야 한다). 거부되면 테스트 준비가 틀린 것이다.
 *  - 지목은 순차 하나뿐이다(09.1-05가 차례 없는 옛 동시 지목을 지웠다). pickTurn 이 없으면 준비가 틀린 것이라 Error.
 *  - 차례를 좌석 순으로 끝 알림까지 걷는다: 대상이 정해진 사람만 자기 차례에 castTurnPoint,
 *    나머지는 기권으로 한 걸음 넘긴다. 돌려주는 상태는 끝 알림 자리(i = order.length)다 — 다음 tick(phaseEndsAt) 이 집계한다.
 */
export function castPoints(state: RoomState, targetBySeat: Record<number, number>): RoomState {
  if (state.pickTurn === undefined) throw new Error("castPoints: pickTurn 이 없는 지목 상태다 — 차례 지목만 있다(enterNomination 을 지난 상태가 필요하다)");
  let s = state;
  const order = state.pickTurn.order;
  for (const seat of Object.keys(targetBySeat)) {
    if (!order.includes(Number(seat))) throw new Error(`seat ${seat} has no pick turn`);
  }
  /** 마감 시각에 한 걸음: 새 마감은 지난 마감 + 새 단계 길이(tick 의 사슬 규약). */
  const advance = (): void => {
    const at = s.phaseEndsAt;
    if (at === null) throw new Error("pick turn has no deadline");
    const r = stepNomination(s, at);
    if (!r.stay) throw new Error("nomination resolved before the end notice");
    s = { ...r.state, phaseEndsAt: at + nominationStepMs(r.state) };
  };
  for (let guard = 0; s.pickTurn !== undefined && s.pickTurn.i < s.pickTurn.order.length; guard += 1) {
    if (guard > 400) throw new Error("pick turn walk did not finish");
    const turn = s.pickTurn;
    const seat = turn.order[turn.i];
    const target = seat === undefined ? undefined : targetBySeat[seat];
    if (turn.i < 0 || turn.doneAt !== undefined || seat === undefined || target === undefined) {
      advance();
      continue;
    }
    const result = castTurnPoint(s, seatToId(s, seat), target, (turn.endsAt ?? 0) - PICK_TURN_MS);
    if (!result.ok) throw new Error(`castTurnPoint rejected seat ${seat}: ${result.error}`);
    s = result.state;
  }
  return s;
}

/**
 * 지목 단계 첫 순간 상태에서 phase 가 바뀔 때까지 마감 사슬을 따라가 지목 전체 길이(ms)를 돌려준다(아무도 안 던진 경우).
 * 시작 시각은 첫 마감 − 첫 단계 길이다. 지금은 단계 표의 15000, 순차 지목이면 모이기부터 끝 알림까지의 합이다.
 * 지목 단계가 아닌 상태를 받으면 Error.
 */
export function nominationSpanMs(state: RoomState, seed: number): number {
  if (state.phase !== "nomination" || state.phaseEndsAt === null) throw new Error(`expected nomination, got ${state.phase}`);
  const start = state.phaseEndsAt - nominationStepMs(state);
  let s = state;
  let last = state.phaseEndsAt;
  for (let guard = 0; s.phase === "nomination"; guard += 1) {
    if (s.phaseEndsAt === null || guard > 400) throw new Error("nomination chain did not end");
    last = s.phaseEndsAt;
    s = tick(s, last, seededRandInt(seed));
  }
  return last - start;
}

/** seat → 찬성 여부를 실제 castVerdict 로 주입한다(찬반 단계여야 한다). 거부되면 테스트 준비가 틀린 것이다. */
export function castVerdicts(state: RoomState, agreeBySeat: Record<number, boolean>): RoomState {
  let current = state;
  for (const [seat, agree] of Object.entries(agreeBySeat)) {
    const result = castVerdict(current, seatToId(current, Number(seat)), agree);
    if (!result.ok) throw new Error(`castVerdict rejected seat ${seat}: ${result.error}`);
    current = result.state;
  }
  return current;
}

export type CandidateSpec = "citizen" | "mafia" | number | "tie" | "none";

/** 산 사람 가운데 spec 이 가리키는 후보 좌석. 'tie'·'none' 은 후보가 없어 undefined. */
function candidateSeatOf(state: RoomState, spec: CandidateSpec): number | undefined {
  if (spec === "tie" || spec === "none") return undefined;
  if (typeof spec === "number") return spec;
  const seat = state.players.filter(isAlive).sort((a, b) => a.seat - b.seat).find((p) => p.role === (spec === "mafia" ? "mafia" : "citizen"))?.seat;
  if (seat === undefined) throw new Error(`no ${spec} to point at`);
  return seat;
}

/**
 * 변론 이후의 상태를 실제 지목·찬반 주입과 tick 으로 만든다(A4: 옛 시그니처와 후보 지정 뜻을 유지한다).
 *  - 지목: candidate 'citizen' / 'mafia' 는 그 직업의 가장 낮은 seat, 숫자는 그 seat 를 최다 득표시킨다(나머지 산 사람이 모두 그 사람을 가리키고 그 사람은 다른 사람을 가리킨다).
 *    'tie' 는 seat 0 과 1 이 서로를 가리킨 1:1 동률, 'none' 은 아무도 안 가리킨 0표. 기본값은 'citizen'.
 *  - 찬반: 변론자를 뺀 산 사람 전원 찬성 → 통과 → execution.
 *  - phase: defense(지목 마감 직후) · verdict(변론 마감 직후) · execution(찬반 마감 직후, 변론자 탈락) 의 첫 순간. 후보가 없으면(tie·none) 지목 마감이 night 로 가서 닿을 수 없다.
 */
export function stateWithVerdict(
  n: number,
  seed: number,
  phase: "defense" | "verdict" | "execution",
  opts: { candidate?: CandidateSpec; lobby?: RoomState } = {},
): RoomState {
  const spec = opts.candidate ?? "citizen";
  let state = opts.lobby === undefined ? startedAt(n, seed, "nomination") : startedFrom(opts.lobby, seed, "nomination");
  const alive = state.players.filter(isAlive).sort((a, b) => a.seat - b.seat);
  const targetBySeat: Record<number, number> = {};
  if (spec === "tie") {
    targetBySeat[alive[0]!.seat] = alive[1]!.seat;
    targetBySeat[alive[1]!.seat] = alive[0]!.seat;
  } else if (spec !== "none") {
    const candidateSeat = candidateSeatOf(state, spec)!;
    const other = alive.find((p) => p.seat !== candidateSeat)!;
    for (const p of alive) targetBySeat[p.seat] = p.seat === candidateSeat ? other.seat : candidateSeat;
  }
  state = castPoints(state, targetBySeat);

  const steps: PhaseId[] = ["defense", "verdict", "execution"];
  for (const step of steps) {
    if (step === "verdict") {
      const defender = state.verdict?.candidate;
      const agree: Record<number, boolean> = {};
      for (const p of state.players) if (isAlive(p) && p.seat !== defender) agree[p.seat] = true;
      // 변론 마감 → verdict 진입. 찬반은 verdict 에서 던진다.
      state = tick(state, state.phaseEndsAt!, seededRandInt(seed + 3));
      if (state.phase !== "verdict") throw new Error(`expected verdict, got ${state.phase}`);
      if (phase === "verdict") return state;
      state = castVerdicts(state, agree);
      continue;
    }
    if (step === "defense") {
      state = tick(state, state.phaseEndsAt!, seededRandInt(seed + 3));
      if (state.phase !== "defense") throw new Error(`expected defense, got ${state.phase}`);
      if (phase === "defense") return state;
      continue;
    }
    state = tick(state, state.phaseEndsAt!, seededRandInt(seed + 3));
    if (state.phase !== "execution") throw new Error(`expected execution, got ${state.phase}`);
    return state;
  }
  throw new Error(`unreachable phase ${phase}`);
}

/**
 * 동점 결선(결정 0066-4) 앞머리 상태(step 0)를 실제 지목 주입과 tick 으로 만든다: 좌석 0 과 1 이 서로를 가리킨 1:1 최다 동점이라 후보는 [0, 1].
 * extraPoints 로 다른 사람의 지목을 더할 수 있다(최다가 정확히 둘로 남도록 호출한 쪽이 맞춘다).
 */
export function runoffStateOf(n: number, seed: number, extraPoints: Record<number, number> = {}): RoomState {
  const nominated = castPoints(startedAt(n, seed, "nomination"), { 0: 1, 1: 0, ...extraPoints });
  const state = tick(nominated, nominated.phaseEndsAt!, seededRandInt(seed + 5));
  if (state.phase !== "runoff") throw new Error(`expected runoff, got ${state.phase}`);
  return state;
}

/**
 * 결선을 실제 stepRunoff·castRunoffVote 로 걷는다(순수 도우미): 앞머리 → 투표 창에서 seat → 후보 좌석 표를 주입 → 결과(step 2)까지.
 * 돌려주는 상태는 결과 자리(step 2, tally 확정)다 — 다음 tick(phaseEndsAt) 이 집계한다. 거부되면 테스트 준비가 틀린 것이다.
 */
export function castRunoff(state: RoomState, voteBySeat: Record<number, number>): RoomState {
  if (state.phase !== "runoff" || state.runoff === undefined) throw new Error(`castRunoff: runoff 단계가 아니다(${state.phase})`);
  let s = state;
  /** 마감 시각에 한 걸음: 새 마감은 지난 마감 + 새 단계 길이(tick 의 사슬 규약). */
  const advance = (): void => {
    const at = s.phaseEndsAt;
    if (at === null) throw new Error("runoff has no deadline");
    const r = stepRunoff(s, at);
    if (!r.stay) throw new Error("runoff resolved before the result step");
    s = { ...r.state, phaseEndsAt: at + runoffStepMs(r.state) };
  };
  if (s.runoff!.step === 0) advance();
  for (const [seat, target] of Object.entries(voteBySeat)) {
    const result = castRunoffVote(s, seatToId(s, Number(seat)), target, s.phaseEndsAt! - 100);
    if (!result.ok) throw new Error(`castRunoffVote rejected seat ${seat}: ${result.error}`);
    s = result.state;
  }
  if (s.runoff!.step === 1) advance();
  return s;
}

/**
 * 마지막 3인 결전(09.1.1-06, 결정 0066-5)을 실제 stepShowdown·acceptLastWord·castShowdownPoint 로 걷는다(순수 도우미): 모이기 → 한마디 차례 셋 →
 * 동시 지목 창에서 seat → 대상 좌석을 주입 → 공개(i 4)까지. words[seat] 가 있으면 그 차례에 한마디를 확정하고, 없으면 시간 초과로 넘어간다.
 * 돌려주는 상태는 공개 자리(i 4, points 확정)다 — 다음 tick(phaseEndsAt) 이 집계한다(2표 이상이면 execution, 아니면 night). 거부되면 테스트 준비가 틀린 것이다.
 */
export function castShowdown(
  state: RoomState,
  script: { words?: Record<number, string>; points?: Record<number, number> } = {},
): RoomState {
  if (state.phase !== "showdown" || state.showdown === undefined) throw new Error(`castShowdown: showdown 단계가 아니다(${state.phase})`);
  let s = state;
  /** 마감 시각에 한 걸음: 새 마감은 지난 마감 + 새 단계 길이(tick 의 사슬 규약). */
  const advance = (): void => {
    const at = s.phaseEndsAt;
    if (at === null) throw new Error("showdown has no deadline");
    const r = stepShowdown(s, at);
    if (!r.stay) throw new Error("showdown resolved before the reveal");
    s = { ...r.state, phaseEndsAt: at + showdownStepMs(r.state) };
  };
  for (let guard = 0; s.showdown!.i < 4; guard += 1) {
    if (guard > 40) throw new Error("castShowdown: walk did not finish");
    const sd = s.showdown!;
    if (sd.i >= 0 && sd.i <= 2 && sd.doneAt === undefined) {
      const seat = sd.order[sd.i]!;
      const word = script.words?.[seat];
      if (word !== undefined) {
        const r = acceptLastWord(s, seatToId(s, seat), word, (sd.endsAt ?? 0) - SHOWDOWN_TURN_MS + 100);
        if (r.kind !== "ok") throw new Error(`acceptLastWord rejected seat ${seat}: ${r.kind}`);
        s = r.state;
        continue;
      }
    }
    if (sd.i === 3) {
      for (const [seat, target] of Object.entries(script.points ?? {})) {
        const r = castShowdownPoint(s, seatToId(s, Number(seat)), target, (sd.endsAt ?? 0) - SHOWDOWN_POINT_MS + 100);
        if (!r.ok) throw new Error(`castShowdownPoint rejected seat ${seat}: ${r.error}`);
        s = r.state;
      }
    }
    advance();
  }
  return s;
}

/** n 명 판에서 좌석 deadSeat 들이 죽은 마지막 3인 낮 시작 발표(산 사람이 정확히 셋이어야 한다). 실제 전이로 만든다. */
export function threeAliveAt(n: number, seed: number, deadSeats: number[]): RoomState {
  const s = startedAt(n, seed, "dayAnnounce");
  const dead: RoomState = { ...s, players: s.players.map((p) => (deadSeats.includes(p.seat) ? { ...p, alive: false } : p)) };
  if (dead.players.filter((p) => p.alive !== false).length !== 3) throw new Error("threeAliveAt: 산 사람이 셋이 아니다");
  return dead;
}
