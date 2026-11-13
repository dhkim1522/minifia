// 가로등 공개 값(21페이즈 D-06·D-07·D-08) — 순수 모듈. 이 파일은 역할·연결 상태를 읽지 않는다(D-22):
// 켜기와 자르기를 구별하는 것은 서버 전용 lampCut(mafiaTouch.ts 가 쓴다)뿐이고, 여기서는 그 장소 목록을 번호로 바꿔 뺄 뿐이다.
// 가로등 n 은 좌석 n 의 집 앞 등불이다(mapTown.ts TOWN_LAMPS). 가로등이 없는 맵(재즈 바·광장)의 장소 id 는 번호가 없어 값이 빈 배열이다.
import { LAMP_PLACE_IDS } from "../protocol";
import type { RoomState } from "./room";

/** 장소 id 의 가로등 번호(lamp3 → 3). 가로등이 아니면 undefined. */
export function lampNumberOf(place: string): number | undefined {
  const i = (LAMP_PLACE_IDS as readonly string[]).indexOf(place);
  return i < 0 ? undefined : i;
}

const ascending = (nums: Iterable<number>): number[] => [...new Set(nums)].sort((a, b) => a - b);

function numbersOf(places: readonly string[]): number[] {
  const out: number[] = [];
  for (const place of places) {
    const n = lampNumberOf(place);
    if (n !== undefined) out.push(n);
  }
  return out;
}

/**
 * 저녁 동안 켜진 것으로 보이는 가로등 번호(오름차순, 모두에게 같은 값): 어느 플레이어든 errandDone 에 처리한 가로등 — 자른 것도 포함한다(자른 등불은 저녁 동안 켜진 것처럼 보인다, D-06).
 * 켜기와 자르기가 같은 값을 바꾸므로 이 값의 변화가 방송 여부를 정해도 역할이 새지 않는다(D-21).
 */
export function lampsShownOf(state: RoomState): number[] {
  return ascending(state.players.flatMap((p) => numbersOf(p.errandDone ?? [])));
}

/**
 * 밤·아침에 켜진 가로등 번호(오름차순, 모두에게 같은 값): 처리됐고 잘리지 않은 것. 누가 먼저 켰든 잘린 심지는 밤에 꺼진다(D-06·D-08).
 * 안 켜서 꺼진 등불과 잘려서 꺼진 등불은 이 값에서 구별되지 않는다(D-08).
 */
export function lampsLitOf(state: RoomState): number[] {
  const cut = new Set(numbersOf(state.lampCut ?? []));
  return lampsShownOf(state).filter((n) => !cut.has(n));
}
