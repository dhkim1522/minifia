// RED 뼈대: GREEN 에서 채운다.
import type { RoleId } from "../../shared/game/roles";

export function RoleCard(_p: { role: RoleId | null; face: "back" | "front"; allies: string[] | null; onFlip: () => void }) {
  return <div />;
}
