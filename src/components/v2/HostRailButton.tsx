import type { Ref } from "react";
import type { V2IconName } from "./V2Icon";

// 방장 줄 원형 단추(19페이즈 자리 — 부품은 다음 커밋이 채운다).
export interface HostRailButtonProps {
  id: "mode" | "bots" | "tutorial";
  icon: V2IconName;
  label: string;
  pressed?: boolean;
  switchOn?: boolean;
  disabled?: boolean;
  onPress(el: HTMLButtonElement): void;
  ref?: Ref<HTMLButtonElement>;
}

export function HostRailButton(_props: HostRailButtonProps) {
  return null;
}
