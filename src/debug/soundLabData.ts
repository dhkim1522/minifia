// 소리 시험 페이지(?sound-lab=1) 게이트 — 순수 모듈 (12-06, D-19, T-12-19).
// 운영 번들의 perfProbe 가 게이트 판정을 위해 가져온다: 이 파일에 진입 번들로 들어가는 몫은 게이트뿐이다.
// 묶음·한글 이름·합격 문턱 표는 soundLabTable.ts 에 둔다(시험 페이지 본체와 같은 지연 청크에만 들어간다: 둘 다 가져오는 모듈은 진입 청크로 올라가기 때문).
// 시험 페이지 본체(soundLab.ts)는 여기서 가져오지 않는다.
import type { StorageLike } from "../net/session";
import { worldTestHooksEnabled } from "../world/testHooks";

export const SOUND_LAB_PARAM = "sound-lab";

/** ?sound-lab=1 이고 개발 빌드이거나 ?e2e=1(세션 저장 포함) 문맥일 때만 참 (T-12-19) */
export function soundLabEnabled(search: string, storage: StorageLike | null, dev = false): boolean {
  if (new URLSearchParams(search).get(SOUND_LAB_PARAM) !== "1") return false;
  return worldTestHooksEnabled(search, storage, dev);
}
