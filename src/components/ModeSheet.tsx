import type { GameMode } from "../../shared/protocol";

// 판 종류 시트(19페이즈 자리 — 부품은 다음 커밋이 채운다).
export interface ModeSheetProps {
  mode: GameMode;
  canSend: boolean;
  onPick(mode: GameMode): void;
  onClose(): void;
}

export function ModeSheet(_props: ModeSheetProps) {
  return null;
}
