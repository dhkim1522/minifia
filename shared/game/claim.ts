// 직업 주장 규칙(DAY-02, 결정 0023): 살아 있는 사람이 한 명씩 차례로 말한다. 한 차례의 마감이 곧 claim 단계의 마감이다.
// 순수 모듈이다 — 현재 시각은 인자 now 로만 받고 난수를 쓰지 않으며, DOM·workerd API 를 쓰지 않는다. 입력 상태는 바꾸지 않는다.
//
// 서버는 주장의 참·거짓을 보지 않는다(D-10, 결정 0007): 이 파일은 플레이어의 실제 역할 필드를 읽지 않는다.
//
// 규칙표
//   순서     살아 있는 seat 오름차순(끝에서 처음으로 이어짐 = 시계 방향)을 시작 seat 부터 한 바퀴. 탈락자는 들지 않는다.
//   시작     1일차는 방장(살아 있으면, 아니면 첫 생존 seat). 이후 낮마다 직전 시작 seat 다음의 살아 있는 seat 로 한 칸 이동한다.
//   차례     한 차례 8000ms(CLAIM_TURN_MS). 차례인 사람이 일찍 고르면 selectClaim 이 마감을 now 로 당기고, 다음 차례로 넘기는 일은
//            tick 의 ON_DEADLINE(resolveClaimTurn)이 정상 마감과 같은 경로로 한다. 이 파일은 tick.ts 를 import 하지 않는다.
//   시간 초과 고르지 않은 차례는 말 안 함(none)으로 기록된다. 어제 주장을 이어받지 않는다(이월 없음). 연결 여부도 보지 않는다.
//   기록     차례가 끝나는 순간 claimLog 에 {n, seat, claim} 한 줄이 쌓인다. 끝나지 않은 차례의 선택(claimPick)은 view 에 실리지 않는다.
import type { Claim } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";
import { rolesInPlay } from "./roles";

/** 이번 판 선택지: 이번 판에 나오는 직업 뒤에 말 안 함. 직업 목록은 rolesInPlay 한 곳에서만 나온다(D-07). */
export function claimOptions(playerCount: number): Claim[] {
  return [...rolesInPlay(playerCount), "none"];
}

/** 지금 주장할 차례인 seat. claim 단계가 아니거나 차례 상태가 없으면 undefined. */
export function currentClaimSeat(state: RoomState): number | undefined {
  if (state.phase !== "claim") return undefined;
  return state.claimOrder?.[state.claimIdx ?? 0];
}

/**
 * claim 진입 훅: 이번 낮의 차례 순서와 시작 자리를 정한다. 지난 낮의 claimPick 은 지운다(키째 뺀다). claimLog 는 그대로 쌓여 있다.
 * 시작 seat: 직전 시작(claimStart)이 없으면(1일차) 방장(살아 있으면) 아니면 첫 생존 seat, 있으면 그보다 큰 첫 생존 seat(없으면 맨 앞) —
 * 시작 후보가 탈락했으면 다음 살아 있는 seat 로 건너뛴다. 생존자가 없으면 차례 키를 만들지 않는다.
 */
export function enterClaim(state: RoomState): RoomState {
  const { claimPick: _pick, claimOrder: _order, claimIdx: _idx, claimStart: _start, ...rest } = state;
  const living = state.players
    .filter(isAlive)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
  const first = living[0];
  if (first === undefined) return rest;
  let start: number;
  if (state.claimStart === undefined) {
    const host = state.players.find((p) => p.id === state.hostId);
    start = host !== undefined && isAlive(host) ? host.seat : first;
  } else {
    start = living.find((seat) => seat > (state.claimStart as number)) ?? first;
  }
  const at = living.indexOf(start);
  return { ...rest, claimOrder: [...living.slice(at), ...living.slice(0, at)], claimIdx: 0, claimStart: start };
}

export type ClaimError = "WRONG_PHASE" | "BAD_MESSAGE";

/**
 * 직업 고르기(일찍 말하기). 검사 순서가 계약이다: 단계(claim 아니면 누구든 WRONG_PHASE) → 방에 있는 사람(없으면 BAD_MESSAGE)
 * → 생존(탈락자 BAD_MESSAGE) → 차례(보낸 사람 seat 가 지금 차례와 다르거나 이미 고른 값이 있으면 WRONG_PHASE) → 값(claimOptions 에 없으면 BAD_MESSAGE).
 * 통과하면 claimPick 을 적고 마감을 now 로 당긴 새 상태를 돌려준다 — 다음 차례로 넘기는 일은 호출하는 쪽이 tick 으로 한다(결정 0022 skipPhase 와 같은 방식).
 * 입력은 서버 상태와 요청자 id 뿐이다(클라이언트가 보낸 seat 를 받지 않는다). 판정은 보낸 사람의 실제 역할과 무관하다(D-10, T-03.1-02).
 */
export function selectClaim(
  state: RoomState,
  actorId: string,
  claim: Claim,
  now: number,
): { ok: true; state: RoomState } | { ok: false; error: ClaimError } {
  if (state.phase !== "claim") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.seat !== currentClaimSeat(state) || state.claimPick !== undefined) return { ok: false, error: "WRONG_PHASE" };
  if (!claimOptions(state.players.length).includes(claim)) return { ok: false, error: "BAD_MESSAGE" };
  return { ok: true, state: { ...state, claimPick: claim, phaseEndsAt: now } };
}

/**
 * ON_DEADLINE.claim: 지금 차례를 닫는다. 값은 고른 값(claimPick), 없으면 말 안 함. claimLog 끝에 {n, seat, claim} 을 더하고
 * claimPick 을 지우고 차례를 한 칸 넘긴다. 남은 차례가 있으면 stay true(같은 단계에서 마감만 한 차례 뒤로).
 * 차례 상태가 없거나 비어 있으면(옛 방·생존자 없음) 아무 줄도 더하지 않고 stay false.
 */
export function resolveClaimTurn(state: RoomState): { state: RoomState; stay: boolean } {
  const order = state.claimOrder;
  const idx = state.claimIdx ?? 0;
  const seat = order?.[idx];
  if (order === undefined || seat === undefined) return { state, stay: false };
  const { claimPick, ...rest } = state;
  return {
    state: {
      ...rest,
      claimIdx: idx + 1,
      claimLog: [...(state.claimLog ?? []), { n: state.day ?? 1, seat, claim: claimPick ?? "none" }],
    },
    stay: idx + 1 < order.length,
  };
}
