import type { GameMode, MapId } from "../../shared/protocol";
import { MODE_MAPS, PLAYABLE_MAPS } from "../../shared/game/maps";

/** 제품의 판 종류별 고정 맵 표 사본 — 이 모듈을 처음 읽을 때(시험 잠금보다 먼저) 떠 둔다. 잠긴 뒤에도 제품 값을 시험이 확인할 수 있다. */
export const SHIPPED_MODE_MAPS: Readonly<Partial<Record<GameMode, MapId>>> = { ...MODE_MAPS };

/**
 * 시험 동안 허용 맵에 광장이 들어 있게 한다(11-13). 이미 열려 있으면 아무것도 하지 않는다.
 * PLAYABLE_MAPS 가 [bar] 이든 [bar, plaza] 이든 같은 시험이 돌게 하는 도우미다. 돌려준 함수를 부르면 원래대로 되돌린다.
 */
export function openPlaza(): () => void {
  const list = PLAYABLE_MAPS as MapId[];
  const had = list.includes("plaza");
  if (!had) list.push("plaza");
  return () => {
    if (!had) list.splice(list.indexOf("plaza"), 1);
  };
}

/**
 * 시험 동안 허용 맵을 재즈 바 하나로 되돌린다(11-13 이 광장을 연 뒤에도 "bar 만 열린 방" 시험을 하려는 용도).
 * 돌려준 함수를 부르면 원래 목록으로 되돌린다.
 */
export function onlyBar(): () => void {
  const list = PLAYABLE_MAPS as MapId[];
  const saved = [...list];
  list.splice(0, list.length, "bar");
  return () => {
    list.splice(0, list.length, ...saved);
  };
}

/**
 * 판 종류의 고정 맵(20-01, D-02)을 끈다: MODE_MAPS 의 extended 칸을 지워 확장판 판도 방장 선택(decideMap)대로 시작하게 한다.
 * 단위·워커 시험 대부분이 확장판 판을 재즈 바 좌표로 돌리므로 setup 파일(test/unit/setup.ts·test/worker/setup.ts)이 모듈을 읽을 때 부른다.
 * 돌려준 함수를 부르면 원래대로 되돌린다.
 */
export function lockModeMaps(): () => void {
  const table = MODE_MAPS as Partial<Record<GameMode, MapId>>;
  const had = Object.hasOwn(table, "extended");
  const saved = table.extended;
  delete table.extended;
  return () => {
    if (had && saved !== undefined) table.extended = saved;
  };
}

/**
 * 시험 동안 확장판의 고정 맵을 마을(town)로 켠다(20-01) — 잠금(lockModeMaps) 아래에서 마을 판이 필요한 시험만 쓴다.
 * 돌려준 함수를 부르면 부르기 전 상태(잠겨 있었으면 잠긴 채)로 되돌린다.
 */
export function openTown(): () => void {
  const table = MODE_MAPS as Partial<Record<GameMode, MapId>>;
  const had = Object.hasOwn(table, "extended");
  const saved = table.extended;
  table.extended = "town";
  return () => {
    if (had && saved !== undefined) table.extended = saved;
    else delete table.extended;
  };
}
