// 심부름 장소의 낱말(15페이즈, UI-SPEC "장소 아이콘 규격"). 그림은 컬러 에셋 PlaceArt 가 그린다. 화면에는 장소 이름 글자가 없다 —
// 이 낱말은 접근성 이름(aria-label)과 시험에서만 쓴다. 장소 id 는 닫힌 집합(PlaceId) 24개: 재즈 바 8 + 광장 8 + 마을 가로등 8.
import type { PlaceId } from "../../shared/protocol";

/** 장소 id → 낱말. 재즈 바(glass·piano·sax·stool·door·poster·record·candle) · 광장(clock·fountain·bench·lamp·mail·tree·flower·stand)
 *  · 마을 가로등(lamp0~lamp7, 21페이즈 D-05 — 번호 = 집 좌석, 이름은 모두 "가로등") */
export const PLACE_NAME: Readonly<Record<PlaceId, string>> = {
  glass: "술잔",
  piano: "피아노",
  sax: "색소폰",
  stool: "의자",
  door: "문",
  poster: "포스터",
  record: "전축",
  candle: "촛불",
  clock: "시계탑",
  fountain: "분수",
  bench: "벤치",
  lamp: "가로등",
  mail: "우체통",
  tree: "나무",
  flower: "꽃",
  stand: "가판",
  lamp0: "가로등",
  lamp1: "가로등",
  lamp2: "가로등",
  lamp3: "가로등",
  lamp4: "가로등",
  lamp5: "가로등",
  lamp6: "가로등",
  lamp7: "가로등",
};

/** 접근성 이름: "{낱말} 장소" / "{낱말} 장소, 처리함" */
export function placeLabel(id: PlaceId, done: boolean): string {
  return done ? `${PLACE_NAME[id]} 장소, 처리함` : `${PLACE_NAME[id]} 장소`;
}
