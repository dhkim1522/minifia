// RED 단계용 임시 뼈대 — GREEN 에서 실제 단계 표로 바뀐다.
import type { PhaseId } from "../protocol";

export interface PhaseDef {
  durationMs: number | null;
  next: PhaseId | null;
  revealsOwnRole: boolean;
}

export const ASSIGNING_MS = 3_000;
export const ROLE_REVEAL_MS = 15_000;
export const PHASE_DEFS = {} as Readonly<Record<PhaseId, PhaseDef>>;
