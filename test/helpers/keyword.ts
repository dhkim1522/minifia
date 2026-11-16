import { KEYWORD_SWITCH, pickKeyword } from "../../shared/game/keywords";
import type { KeywordPicker } from "../../shared/game/room";

/**
 * 시험 동안 첫날 키워드 기능을 켠다(23-01, D-29 "옛 시험 보호").
 * test/unit/setup.ts·test/worker/setup.ts 가 모든 시험에서 스위치를 꺼 두므로 옛 흐름(roleReveal → dayAnnounce)이 그대로 초록이다.
 * 키워드 흐름을 시험하는 파일만 이 도우미를 beforeEach 에서 부르고 돌려준 함수를 afterEach 에서 부른다(openPlaza 와 같은 모양).
 */
export function openKeyword(): () => void {
  const before = KEYWORD_SWITCH.on;
  KEYWORD_SWITCH.on = true;
  return () => {
    KEYWORD_SWITCH.on = before;
  };
}

/**
 * startGame·beginGame·rematch 의 키워드 선택 인자(WR-03). 방 DO 와 같이 스위치를 호출 시점에 읽는다: 켜져 있으면 pickKeyword, 꺼져 있으면 없음(옛 흐름).
 * shared/game/room.ts 는 키워드 목록을 import 하지 않으므로 시험이 시작 함수를 부를 때 이것을 마지막 인자로 넘긴다.
 */
export function keywordPickerNow(): KeywordPicker | undefined {
  return KEYWORD_SWITCH.on ? pickKeyword : undefined;
}
