// 직업 → 의상 한 표(UI-SPEC B-2). 직업은 유령에게만 오는 spectate(판 종료 뒤에는 result — 11페이즈)에서만 읽는다.
// 산 사람 번들·장면 표에 '탈락자 → 직업 → 의상' 을 미리 계산하는 경로를 두지 않는다(결정 0021·0037, L13).
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

/** 안개 유령 재질(시안 GhostCostume 'mist'): 몸 불투명도 0.26, 발광 #d8e4ff 세기 0.85, 색은 의상 원래 색 */
export const GHOST_MIST = { opacity: 0.26, emissive: "#d8e4ff", intensity: 0.85 } as const;
