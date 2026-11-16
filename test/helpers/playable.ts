import type { MapId } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";

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

// 22-05: 마을 삭제 — 아래 둘은 내용 없는 껍데기다. 22-08 이 호출부(20개 안팎 시험 파일의 import 와 호출)와 함께 지운다.
/** 판 종류의 고정 맵 잠금(껍데기): 고정 맵이 없어졌으니 아무것도 하지 않는 되돌림 함수를 돌려준다. */
export const lockModeMaps = (): (() => void) => () => {};

/** 마을 켜기(껍데기): 마을이 없어졌으니 아무것도 하지 않는다. 호출하던 시험은 재즈 바에서 돈다. */
export const openTown = (): (() => void) => () => {};

// 22-04: 원인 흐름 삭제 — 아래 넷은 내용 없는 껍데기다. 22-08 이 호출부(107개 시험 파일의 import 와 호출)와 함께 지운다.
/** 원인 흐름 잠금(껍데기): 아무것도 바꾸지 않고 아무것도 하지 않는 되돌림 함수를 돌려준다. */
export const lockCause = (): (() => void) => () => {};

/** 원인 흐름 켜기(껍데기): lockCause 와 같다. */
export const openCause = (): (() => void) => () => {};

/** 파일 머리용 원인 흐름 잠금(껍데기): 아무것도 하지 않는다. */
export const lockCauseInFile = (): void => {};

/** 시험 한 개를 원인 흐름 잠금 아래에서 돌린다(껍데기): 본문을 그대로 돌려준다. */
export const underCauseLock = <T>(body: () => T): (() => T) => body;
