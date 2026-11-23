import type { ReactNode } from "react";
import { playerNameColor } from "../game/playerIdentity";

export function PlayerName({ seat, className, children }: { seat: number | undefined; className?: string; children: ReactNode }) {
  const color = playerNameColor(seat);
  return <span className={className} data-player-name={color ? seat : undefined} style={color ? { color } : undefined}>{children}</span>;
}
