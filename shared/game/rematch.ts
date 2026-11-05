// 다시 하기(결정 D-12·D-13·D-15, 11-08, REMATCH-01). 같은 방에서 결과 단계(ended)를 지나 새 판으로 가는 순수 규칙이다.
// 시각(now)·난수(randInt)는 인자로만 받고 입력 상태를 바꾸지 않는다. 신원(actorId)은 호출하는 쪽(방 Durable Object)이 소켓 첨부에서 얻은 값이다.
//
// 이전 판의 비공개 정보(역할·밤 선택·수사/치료/암살 기록·유언·주장·귓속말·통계 등)가 새 판에 남지 않는 이유는 규칙이 아니라 구조다:
// 새 방·새 사람 행을 "허용 목록 키 배열"에서 키 하나씩 복사해 만든다 — 펼쳐 복사(...state, ...player)를 하지 않으므로 앞으로 늘어나는 게임 필드도 자동으로 빠진다(L39, T-11-26).
import { MIN_PLAYERS } from "../protocol";
import { ROOM_TTL_MS, beginGame, roundOf } from "./room";
import type { Player, RoomState } from "./room";

/** 방 생성 시각 기준 최대 수명 — 다시 하기를 거듭해도 방이 이 시간 넘게 살지 않는다(D-19). */
export const REMATCH_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** 끊긴 지 이 시간(ms) 이상이면 다시 하기가 그 사람을 걷어 간다(D-12). 그보다 짧게 끊긴 사람은 쉬는 사람으로 남긴다. */
export const REMATCH_STALE_MS = 60_000;

/** 새 방으로 이어지는 방 키(허용 목록). 있는 키만 복사한다. 판마다 새로 정하는 키(expiresAt·round·phase·phaseEndsAt·map·players·bench)는 rematch 가 따로 쓴다. */
export const REMATCH_ROOM_KEYS = ["code", "createdAt", "everConnected", "hostId", "nextJoinSeq", "mapChoice", "testMode", "testRole", "testBotVote"] as const;
/** 새 판으로 이어지는 사람 행 키(허용 목록). 역할·생사·밤 선택·기록·유언·주장·통계·준비·앉음은 여기에 없다. */
export const REMATCH_PLAYER_KEYS = ["id", "token", "seat", "nickname", "nicknameKey", "joinSeq", "connected", "connId", "isBot", "look"] as const;

/** src 에서 keys 에 든 키만(값이 undefined 가 아닐 때) 하나씩 복사한 새 객체. 펼쳐 복사가 아니다. */
function copyKeys<T extends object, K extends keyof T>(src: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.hasOwn(src, key) && src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

const playerRow = (p: Player): Player => copyKeys(p, REMATCH_PLAYER_KEYS);

/** 방장·서버 봇은 늘 준비로 센다. 손님은 ready 가 true 일 때만. */
export function isReady(p: Pick<Player, "id" | "isBot" | "ready">, hostId: string): boolean {
  return p.id === hostId || p.isBot === true || p.ready === true;
}

export type ReadyResult = { ok: true; state: RoomState } | { ok: false };

/**
 * 준비 토글. 결과 단계(ended)에서, 방장·봇이 아닌 참가자(players 안, 나가지 않음)가, 지금 판 번호(round)를 맞게 보냈을 때만 ok.
 * 같은 값이면 입력 상태 그대로(저장·전송을 건너뛰는 근거), off 는 ready 키째 지운다. 거절 사유는 돌려주지 않는다 — 어떤 거절이든 같은 응답이 나가야 한다(L40).
 */
export function setReady(state: RoomState, actorId: string, on: boolean, round: number): ReadyResult {
  if (state.phase !== "ended" || round !== roundOf(state)) return { ok: false };
  const actor = state.players.find((p) => p.id === actorId);
  if (actor === undefined || actor.left === true || actor.isBot === true || actor.id === state.hostId) return { ok: false };
  if ((actor.ready === true) === on) return { ok: true, state };
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) => {
        if (p.id !== actorId) return p;
        if (on) return { ...p, ready: true as const };
        const { ready: _off, ...rest } = p;
        return rest;
      }),
    },
  };
}

export type RematchResult = { ok: true; state: RoomState; removedIds: string[] } | { ok: false };

/**
 * 다시 하기. 게이트(결과 단계, 방장, 판 번호 일치, 참가자 4명 이상) 중 하나라도 어긋나면 { ok: false } 한 가지뿐이다(L40).
 * 참가자 = 나가지 않았고 연결돼 있고 준비한(방장·봇 포함) 사람. 새 방은 허용 목록 리터럴로 만든다(round + 1, 만료 min(방 생성 + 12시간, now + 3시간)).
 * 이어서 startGame 과 같은 본체 beginGame 으로 역할 배정 → 맵 결정 → assigning 으로 간다. removedIds 는 월드·소켓 정리에 쓰는 걷어 간 사람 id.
 */
export function rematch(state: RoomState, actorId: string, round: number, now: number, randInt: (n: number) => number): RematchResult {
  if (state.phase !== "ended" || actorId !== state.hostId || round !== roundOf(state)) return { ok: false };
  const host = state.players.find((p) => p.id === state.hostId);
  if (host === undefined || host.left === true) return { ok: false };
  const takes = (p: Player): boolean => p.left !== true && (p.id === state.hostId || p.connected) && isReady(p, state.hostId);
  const participants = state.players.filter(takes);
  if (participants.length < MIN_PLAYERS) return { ok: false };
  const kept = new Set(participants.map((p) => p.id));
  const fresh: RoomState = {
    ...copyKeys(state, REMATCH_ROOM_KEYS),
    expiresAt: Math.min(state.createdAt + REMATCH_MAX_AGE_MS, now + ROOM_TTL_MS),
    round: roundOf(state) + 1,
    phase: "ended",
    phaseEndsAt: null,
    players: participants.map(playerRow),
  };
  return {
    ok: true,
    state: beginGame(fresh, now, randInt),
    removedIds: state.players.filter((p) => !kept.has(p.id)).map((p) => p.id),
  };
}
