// RED 자리표시자(21-11 Task 2) — GREEN 커밋이 실제 부품으로 바꾼다.
import type { ReactElement } from "react";
import type { BoardModel } from "../../game/boardView";

export interface SuspectBoardProps {
  model: BoardModel;
  faceOf: (seat: number) => string;
  colorOf: (seat: number) => string;
  onClose: () => void;
}

export function SuspectBoard(_props: SuspectBoardProps): ReactElement | null {
  return null;
}
