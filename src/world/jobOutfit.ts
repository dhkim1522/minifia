// 직업 → 결과 화면 의상 한 표(산 사람만 입는다, 0083-2). 직업은 판이 끝난 뒤 result 에서만 읽는다.
// 탈락자는 직업과 무관하게 같은 유령 그림이라 이 표를 타지 않는다 — 판 중 장면 표에 '탈락자 → 직업 → 의상' 경로가 없다(결정 0021·0037, L13).
import type { OutfitId } from "./characterData";

/** 직업(RoleId) → 3D 의상 id. 시민은 기본 코트다 */
export const JOB_OUTFIT: Readonly<Record<string, OutfitId>> = {
  mafia: "mafia",
  police: "police",
  doctor: "doctor",
  citizen: "coat",
};

/** 알 수 없는 값·없는 값은 coat(직업은 이름표의 RoleChip 이 알린다) */
export function jobOutfit(job: string | undefined): OutfitId {
  return (job !== undefined && Object.hasOwn(JOB_OUTFIT, job) ? JOB_OUTFIT[job] : undefined) ?? "coat";
}
