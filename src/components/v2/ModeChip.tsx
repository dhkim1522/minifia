import type { GameMode } from "../../../shared/protocol";

// 참가자 판 종류 칩(19페이즈 자리 — 부품은 다음 커밋이 채운다).
export interface ModeChipProps {
  mode: GameMode;
  testShift?: boolean;
}

export function ModeChip(_props: ModeChipProps) {
  return null;
}
