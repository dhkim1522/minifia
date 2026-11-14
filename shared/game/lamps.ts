// 심지 자르기와 밤의 집 창 불(21페이즈 D-06·D-07·D-08·D-21, 결정 0088) — 순수 모듈: 시각·난수를 부르지 않고 입력 상태를 바꾸지 않는다.
// 등불에서 역할을 읽는 유일한 파일이다(errandFake.ts 가 가짜 장소에서 그러듯). errand.ts·night.ts 는 역할을 읽지 않는다 — errand.ts 는 처리를 받아들인 뒤 withCut 을 부를 뿐이고,
// night.ts 는 houseLitOf 로 켜짐만 센다. 마피아의 길게 누르기(hold)는 겉보기 같은 처리(errandDone)와 함께 서버 전용 Player.errandCut 에 남고,
// 시민의 hold 는 그냥 켜기다(P21-7). errandCut 은 어떤 view 에도 싣지 않는다(D-21) — 밤에 공개되는 것은 켜짐 boolean 여덟(day.lamps)뿐이다.
import type { PlaceId } from "../protocol";
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";
import { modeOf, rulesetOf } from "./ruleset";

/**
 * 받아들여진 처리 한 번에 cut 을 더한다: hold 이고 행위자가 산 마피아이고 원인 흐름이면 그 사람의 errandCut 에 id 를 더한 새 상태,
 * 그 밖(hold 아님·시민·경찰·의사·죽은 사람·원인 흐름 아님)은 입력 상태 그대로(같은 객체). 같은 등불을 두 번 자르지 않는다.
 */
export function withCut(state: RoomState, actorId: string, id: PlaceId, hold: boolean): RoomState {
  if (!hold || !rulesetOf(modeOf(state)).cause) return state;
  const actor = state.players.find((p) => p.id === actorId);
  if (actor === undefined || !isAlive(actor) || actor.role !== "mafia") return state;
  const cut = actor.errandCut ?? [];
  if (cut.includes(id)) return state;
  return { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, errandCut: [...cut, id] } : p)) };
}

/**
 * 등불 i 의 켜짐(= 집 i 의 창 불, D-07): 누군가의 errandDone 에 있고 아무의 errandCut 에도 없을 때만 true(자르기가 이긴다, 결정 0088 A3).
 * 아무도 안 켠 등불과 자른 등불은 똑같이 false 라 꺼진 이유를 구별할 수 없다(D-08). 한 줄 규칙이라 바꾸기 쉽다.
 */
export function houseLitOf(players: readonly Pick<Player, "errandDone" | "errandCut">[], lampIds: readonly string[]): boolean[] {
  return lampIds.map((id) => players.some((p) => (p.errandDone ?? []).some((d) => d === id)) && !players.some((p) => (p.errandCut ?? []).some((c) => c === id)));
}
