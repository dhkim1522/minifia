import type { Ref } from "react";
import { LOG_H } from "../../game/chatUi";
import type { ChatPanelMessage } from "./ChatPanel";

// 21페이즈 저녁·아침 독(자리만 — 구현은 다음 커밋).
export const HOLD_MS = 600;
export const DOCK_ROW_H = 56;
export const DOCK_H = 14 + LOG_H + 10 + DOCK_ROW_H + 22;

export interface SceneDockProps {
  log: { messages: ChatPanelMessage[]; channel?: "all" | "mafia" | "ghost" };
  primary: { kind: "lamp" | "scene"; disabled: boolean; call: boolean; done: boolean; onPress(hold: boolean): void };
  skip: { count: number; total: number; pressed: boolean; disabled?: boolean; onToggle(next: boolean): void } | null;
  panelRef?: Ref<HTMLElement>;
}

export function SceneDock(_props: SceneDockProps) {
  return null;
}
