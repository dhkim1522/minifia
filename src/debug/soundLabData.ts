// 소리 시험 페이지(?sound-lab=1) 게이트·합격 문턱 — 순수 모듈 (12-06, D-19, T-12-19).
// 운영 번들의 perfProbe 가 게이트 판정을 위해 가져온다: 시험 페이지 본체(soundLab.ts)는 여기서 가져오지 않는다.
// 이 파일은 audio 폴더와 world/testHooks 의 게이트만 안다.
import type { StorageLike } from "../net/session";
import { worldTestHooksEnabled } from "../world/testHooks";

export const SOUND_LAB_PARAM = "sound-lab";

/** ?sound-lab=1 이고 개발 빌드이거나 ?e2e=1(세션 저장 포함) 문맥일 때만 참 (T-12-19) */
export function soundLabEnabled(search: string, storage: StorageLike | null, dev = false): boolean {
  if (new URLSearchParams(search).get(SOUND_LAB_PARAM) !== "1") return false;
  return worldTestHooksEnabled(search, storage, dev);
}

/**
 * 오프라인 렌더 합격 문턱 (D-18, T-12-22). 낮추지 않는다: 실패하면 레시피를 고친다.
 * E2E 쪽 문턱(scripts/e2e/lib.mjs SOUND_RENDER_LIMITS)과 같아야 하고 e2eContract 시험이 대조한다.
 */
export const SOUND_LIMITS = Object.freeze({
  /** 소리 id 수: 침대 7 + 효과음 49 */
  count: 56,
  peakMaxDb: -3,
  rmsMinDb: -60,
  /** 효과음 측정 길이와 선언 길이의 허용 차이(ms) */
  lengthTolMs: 50,
});
