import type { ReactElement } from "react";
import type { Claim, EmojiId } from "../../shared/protocol";

// RED 단계 자리 표시자 — GREEN 에서 실제 부품으로 바꾼다.
export type DayTagRow = { kind: "wait" } | { kind: "done" } | { kind: "claim"; job: Claim; changed: boolean; pop: boolean };

export interface DayTableSeat {
  seat: number;
  nickname: string;
  connected: boolean;
  isHost: boolean;
  isMe: boolean;
  isAlly: boolean;
  row: DayTagRow | null;
  spoke?: boolean;
  emoji?: { key: string; icon: EmojiId; z: number } | null;
}

export interface DayTableProps {
  seats: readonly DayTableSeat[];
  mySeat: number;
  width?: number;
  height?: number;
  label?: string;
}

export function DayTable(_props: DayTableProps): ReactElement | null {
  return null;
}
