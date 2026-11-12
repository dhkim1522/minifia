// 판 종류 문구 한 곳(19페이즈 자리 — 값은 다음 커밋이 채운다).
import type { GameMode } from "../../shared/protocol";

export const MODE_ORDER: readonly GameMode[] = [];

export const MODE_TEXT = {
  title: "",
  name: { basic: "", extended: "" } as Readonly<Record<GameMode, string>>,
  desc: { basic: "", extended: "" } as Readonly<Record<GameMode, string>>,
  aria: (_mode: GameMode): string => "",
  changed: (_mode: GameMode): string => "",
  tutorialOn: "",
  tutorialOff: "",
  rail: "",
} as const;
