// 직업 → 3D 의상 한 표. 판 중에는 본인의 직업과 탈락자 전용 관전 표에만 쓴다(결정 0021).
import type { OutfitId } from "./characterData";

/** 직업(RoleId) → 3D 의상 id. 시민은 기본 코트다 */
export const JOB_OUTFIT: Readonly<Record<string, OutfitId>> = {
  mafia: "mafia",
  police: "police",
  doctor: "doctor",
  citizen: "coat",
};

/** 알 수 없는 값·없는 값은 기본 코트. */
export function jobOutfit(job: string | undefined): OutfitId {
  return (job !== undefined && Object.hasOwn(JOB_OUTFIT, job) ? JOB_OUTFIT[job] : undefined) ?? "coat";
}
