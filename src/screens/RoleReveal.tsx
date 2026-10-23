import type { ReactNode } from "react";
import type { RoomView } from "../../shared/protocol";

export interface RoleRevealProps {
  view: RoomView;
  offset: number;
  myRoleButton: ReactNode;
  onSeenFront: () => void;
}

// RED 단계 껍데기: 테스트가 불러올 수 있게 모양만 둔다. 구현은 GREEN 커밋에서 채운다.
export function RoleReveal(_props: RoleRevealProps) {
  return null;
}
