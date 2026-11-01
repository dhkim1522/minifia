import type { Ref } from "react";
import type { V2IconName } from "./V2Icon";

// 뼈대(RED 커밋용): 타입 계약만 있고 아무것도 그리지 않는다. 구현은 GREEN 커밋에서 채운다.

export interface ChatPanelMessage {
  key: string;
  kind: "player" | "system";
  text: string;
  seat?: number;
  name?: string;
  me?: boolean;
  ch?: "all" | "mafia" | "ghost";
  icon?: V2IconName;
}

export interface ChatPanelProps {
  messages: ChatPanelMessage[];
  value: string;
  onChange(v: string): void;
  onSend?(text: string): void;
  channel?: "all" | "mafia" | "ghost";
  logHeight: number;
  compact?: boolean;
  sendDisabled?: boolean;
  sendDim?: boolean;
  notice?: string | null;
  quiet?: boolean;
  inputId?: string;
  inputRef?: Ref<HTMLInputElement>;
  onInputFocus?(): void;
  onInputBlur?(): void;
  onComposingChange?(composing: boolean): void;
}

export function ChatPanel(_props: ChatPanelProps) {
  return null;
}
