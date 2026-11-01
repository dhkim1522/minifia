// RED 뼈대: 시험이 먼저 실패하도록 빈 동작만 둔다. 구현은 GREEN 에서 채운다.
import type { RefObject } from "react";
import { logHeightFor } from "../game/chatUi";

export function useKeyboardLift(_opts: {
  inputRef: RefObject<HTMLInputElement | null>;
  target: RefObject<HTMLElement | null>;
  enabled?: boolean;
}): { open: boolean; lift: () => number } {
  return { open: false, lift: () => 0 };
}

export function useChatLogHeight(_rootRef: RefObject<HTMLElement | null>, _inputRef: RefObject<HTMLInputElement | null>): number {
  return logHeightFor(0);
}
