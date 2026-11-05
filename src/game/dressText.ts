// 로비 꾸미기(10-07, UI-SPEC B-2·B-3)의 고정 문구와 카드 순서. 사용자 문자열은 없다 — 화면의 읽을 글은 카드 이름 아홉 개뿐이다(결정 0051).
import { OUTFIT_IDS } from "../../shared/protocol";
import type { MapChoice, OutfitId } from "../../shared/protocol";

/** 카드 순서 = shared 의 OUTFIT_IDS 순서(기본 · 경찰 · 의사 · 마피아 · 탐정 · 기자 · 어르신 · 후드 · 누아르) */
export const DRESS_ORDER: readonly OutfitId[] = OUTFIT_IDS;

/** 카드 이름(한 단어). 그림이 안 불러와져도 이름 글자로 고를 수 있다 */
export const OUTFIT_LABEL: Readonly<Record<OutfitId, string>> = {
  coat: "기본",
  police: "경찰",
  doctor: "의사",
  mafia: "마피아",
  detective: "탐정",
  reporter: "기자",
  elder: "어르신",
  hood: "후드",
  noir: "누아르",
};

/** 접근성 이름 조각. 보이는 글이 아니다 */
export const DRESS_TEXT = {
  open: "꾸미기",
  close: "닫기",
  selected: ", 선택됨",
} as const;

/** 카드 이름 + 선택되었으면 ", 선택됨" */
export function outfitCardName(id: OutfitId, selected: boolean): string {
  return OUTFIT_LABEL[id] + (selected ? DRESS_TEXT.selected : "");
}

// 맵 선택(11-13, D-20): 지도 칩 이름과 시트 맵 탭 카드 이름. 사용자 문자열은 없다 — 고정 문구뿐이다.
/** 카드 순서: 재즈 바 · 광장 · 랜덤 */
export const MAP_CARD_ORDER: readonly MapChoice[] = ["bar", "plaza", "random"];

/** 카드에 보이는 이름(한 단어, 14px) */
export const MAP_LABEL: Readonly<Record<MapChoice, string>> = { bar: "재즈 바", plaza: "광장", random: "랜덤" };

/** 카드의 접근성 이름(보이는 글이 아니다) */
export const MAP_ARIA: Readonly<Record<MapChoice, string>> = { bar: "지하 재즈 바", plaza: "시계탑 광장", random: "랜덤" };

/** 지도 칩의 접근성 이름 '맵 {재즈 바|광장|랜덤}' */
export const MAP_CHIP_NAME: Readonly<Record<MapChoice, string>> = { bar: "맵 재즈 바", plaza: "맵 광장", random: "맵 랜덤" };

/** 시트 탭 버튼의 접근성 이름 */
export const DRESS_TAB_NAME = { map: "맵", dress: "의상" } as const;

/** 카드 접근성 이름 + 선택되었으면 ", 선택됨" */
export function mapCardName(id: MapChoice, selected: boolean): string {
  return MAP_ARIA[id] + (selected ? DRESS_TEXT.selected : "");
}
