// 후보 선택의 빈 곳 탭 판정(결정 0040): 장면의 빈 곳 탭 = 선택 취소. 사람(캐릭터·이름표)·버튼·[테스트] 는 빈 곳이 아니다.
// 판정은 이 파일 한 곳이다. DayScene 의 장면 상자(.mf-dayscene__scene) 클릭이 부른다 — 헤더·하단 패널·시트는 그 상자 밖이라 대상이 아니다.

/** 캐릭터·이름표 상자를 이만큼 넓힌 범위의 탭은 사람 탭이다 — 손가락 오차로 사람 근처를 눌러 취소되지 않게(결정 0040). */
export const BLANK_TAP_SLOP_PX = 8;

/** 빈 곳이 아닌 요소: 사람 좌석(data-seat), 버튼류, [테스트] 앵커. 이 요소 안(또는 자손)을 탭하면 빈 곳 탭이 아니다. */
export const BLANK_TAP_EXCLUDE = '[data-seat], button, a, input, textarea, select, [role="button"], .mf-tt-anchor';

/**
 * 장면 상자(scene) 안에서 일어난 탭이 빈 곳 탭인가. target 이 Element 가 아니거나 scene 밖(포털·시트에서 React 로 거슬러 온 이벤트)이면 false,
 * 대상 요소가 BLANK_TAP_EXCLUDE 안이면 false 다. 그다음 scene 안 모든 [data-seat] 상자를 BLANK_TAP_SLOP_PX 넓힌 범위 안 점이어도 false 다:
 * 이름표(.mf-dt__tag)는 pointer-events none 이라 이름표를 탭하면 대상이 그 아래 요소(테이블 면 등)가 되므로 대상만으로는 막지 못하고 이 좌표 판정이 막는다.
 * 너비·높이가 0 인 상자(숨은 요소·테스트 DOM)는 건너뛴다.
 */
export function isBlankSceneTap(target: EventTarget | null, point: { x: number; y: number }, scene: Element): boolean {
  if (!(target instanceof Element)) return false;
  if (!scene.contains(target)) return false;
  if (target.closest(BLANK_TAP_EXCLUDE) !== null) return false;
  for (const seat of scene.querySelectorAll("[data-seat]")) {
    const box = seat.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    if (
      point.x >= box.left - BLANK_TAP_SLOP_PX &&
      point.x <= box.right + BLANK_TAP_SLOP_PX &&
      point.y >= box.top - BLANK_TAP_SLOP_PX &&
      point.y <= box.bottom + BLANK_TAP_SLOP_PX
    ) {
      return false;
    }
  }
  return true;
}
