// 마피아 가짜 심부름 장소(16페이즈 D-08, A1, 결정 0079 예정) — 순수 모듈: 난수·시각을 부르지 않고 입력 상태를 바꾸지 않는다.
// 심부름 모듈 중 역할을 읽는 유일한 파일이다. errand.ts 는 역할을 읽지 않는다(15페이즈의 증명 장치) — 처리 쪽은 Player.errandFake 키만 본다.
// 산 마피아는 시민과 같은 모양·개수의 목록을 받지만 그중 한 곳은 처리되지 않는다. 마피아는 3곳을 끝내지 못해 목격 기록(me.record)을 받지 못한다.
import { isAlive } from "./alive";
import type { RoomState } from "./room";

/**
 * errand 진입 직후(enterErrand 가 목록을 쓴 뒤) 산 마피아마다 errandFake 를 자기 목록의 (seat + day) % 목록 길이 번째로 정한다.
 * 난수가 없어서 enterErrand 의 난수 호출 순서와 봇 시드 고정 값이 그대로다. 마피아가 아니거나 죽었거나 목록이 없는 사람은 키가 없다(남은 키는 지운다).
 */
export function assignErrandFake(state: RoomState): RoomState {
  const day = state.day ?? 1;
  return {
    ...state,
    players: state.players.map((p) => {
      const { errandFake: _old, ...rest } = p;
      if (p.role !== "mafia" || !isAlive(p) || p.errandPlaces === undefined || p.errandPlaces.length === 0) return rest;
      return { ...rest, errandFake: p.errandPlaces[(p.seat + day) % p.errandPlaces.length] };
    }),
  };
}
