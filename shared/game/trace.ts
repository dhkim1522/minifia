// 아침 흔적 조각(15페이즈 D-06, 결정 0074). 피해자가 나온 아침에 서버가 "그 밤 피해자를 고른 사람" 중 한 명의 의상에서 조각 하나를 정한다.
// 조각은 의상의 함수이고 역할의 함수가 아니다 — 확정 증거가 아닌 단서다(마피아일 수도, 우연히 같은 사람을 고른 다른 사람일 수도 있다).
// 이 모듈은 Player.role 을 읽지 않는다(D-08). 싣는 값은 닫힌 집합의 조각 id 하나뿐이고 좌석·의상 id·고른 사람 풀은 어디에도 내보내지 않는다.
// 순수 모듈이다 — 시각·전역 난수를 읽지 않고(난수는 인자), 입력 상태를 바꾸지 않는다.
import type { OutfitId, TracePiece } from "../protocol";
import { isAlive } from "./alive";
import { DEFAULT_LOOK } from "./look";
import type { Player, RoomState } from "./room";

type RandInt = (n: number) => number;

/**
 * 의상 → 조각 id. 모든 OUTFIT_IDS 가 키이고 값은 서로 다르며 의상 id 와 이름이 겹치지 않는다(의상 id 를 싣지 않는다).
 * 서버는 id 만 보내고 이름·아이콘은 클라이언트 표가 정한다(15-07).
 */
export const TRACE_OF_OUTFIT: Readonly<Record<OutfitId, TracePiece>> = Object.freeze({
  coat: "button",
  police: "pin",
  doctor: "whiteCloth",
  mafia: "blackCloth",
  detective: "brownCloth",
  reporter: "pencil",
  elder: "grayThread",
  hood: "navyThread",
  noir: "redCloth",
});

/**
 * 흔적을 낼 수 있는 사람들: 밤 시작 때 산 사람 중 nightPick 이 피해자 seat 인 사람(피해자 본인 제외), seat 오름차순.
 * 역할을 읽지 않는다. enterMorning 이 nightPick 을 지우기 전의 상태를 넘긴다.
 */
export function traceCandidates(state: RoomState, victimSeat: number): Player[] {
  return state.players
    .filter((p) => isAlive(p) && p.seat !== victimSeat && p.nightPick === victimSeat)
    .sort((a, b) => a.seat - b.seat);
}

/**
 * 흔적 조각 하나. 풀이 비면 undefined(난수를 부르지 않는다), 아니면 randInt(풀 크기) 한 번으로 한 명을 뽑아 그 사람 의상(없으면 coat)의 조각.
 */
export function pickTracePiece(state: RoomState, victimSeat: number, randInt: RandInt): TracePiece | undefined {
  const pool = traceCandidates(state, victimSeat);
  if (pool.length === 0) return undefined;
  const picker = pool[randInt(pool.length)]!;
  return TRACE_OF_OUTFIT[picker.look ?? DEFAULT_LOOK];
}
