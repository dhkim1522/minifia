// 후보 선택의 빈 곳 탭 판정(결정 0040): 장면의 빈 곳 탭 = 선택 취소. 사람(캐릭터·이름표)·버튼·[테스트] 는 빈 곳이 아니다.
// 판정은 이 파일 한 곳이다. DayScene 의 장면 상자(.mf-dayscene__scene) 클릭이 부른다 — 헤더·하단 패널·시트는 그 상자 밖이라 대상이 아니다.

/** 빈 곳이 아닌 요소: 사람 좌석(data-seat), 버튼류, [테스트] 앵커. 이 요소 안(또는 자손)을 탭하면 빈 곳 탭이 아니다. */
export const BLANK_TAP_EXCLUDE = '[data-seat], button, a, input, textarea, select, [role="button"], .mf-tt-anchor';

/**
 * 장면 상자(scene) 안에서 일어난 탭이 빈 곳 탭인가. target 이 Element 가 아니거나 scene 밖(포털·시트에서 React 로 거슬러 온 이벤트)이면 false,
 * 대상 요소가 BLANK_TAP_EXCLUDE 안이면 false, 아니면 true.
 */
export function isBlankSceneTap(target: EventTarget | null, scene: Element): boolean {
  if (!(target instanceof Element)) return false;
  if (!scene.contains(target)) return false;
  if (target.closest(BLANK_TAP_EXCLUDE) !== null) return false;
  return true;
}
