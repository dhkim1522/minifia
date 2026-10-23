// RED 뼈대: GREEN 에서 채운다.
import type { RoleId } from "../../shared/game/roles";

export const ROLE_TEXT: Readonly<Record<RoleId, { name: string; desc: string }>> = {
  mafia: { name: "", desc: "" },
  police: { name: "", desc: "" },
  doctor: { name: "", desc: "" },
  citizen: { name: "", desc: "" },
};

export function alliesText(_names: readonly string[]): string {
  return "";
}
