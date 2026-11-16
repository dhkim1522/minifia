import { KEYWORD_SWITCH } from "../../shared/game/keywords";

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
