import "../../styles/v2.css";
import type { ClueChipKind } from "../../game/causalView";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 21페이즈 단서 칩·카드 한 부품 두 크기(P21-13, D-14·D-15): 칩(32 알약 14/400, 의심 보드 21-14)과 카드(44 둥근 14, 14/700 — 아침 카드 줄).
// 글(text)·아이콘(icon)은 causalView.clueChipsOf 가 준다(UI-SPEC 닫힌 글표뿐). 이 부품은 역할·좌석을 모르고 같은 입력이면 같은 DOM 이다.
// 먼저 손댄 흔적·어두워서 못 봤어요·단서 없음은 점선(is-faint) — 받은 단서는 --light-lamp 아이콘.

export interface ClueChipProps {
  kind: ClueChipKind;
  text: string;
  /** 선 아이콘. 없으면(단서 없음) 그리지 않는다 */
  icon?: V2IconName | null;
  size: "chip" | "card";
}

const FAINT: ReadonlySet<ClueChipKind> = new Set(["touched", "dark", "none"]);

export function ClueChip({ kind, text, icon = null, size }: ClueChipProps) {
  const faint = FAINT.has(kind);
  const className = ["mv-clue-chip", `mv-clue-chip--${size}`, faint && "is-faint"].filter(Boolean).join(" ");
  return (
    <span className={className} data-clue-chip={kind}>
      {icon !== null ? <V2Icon name={icon} size={size === "card" ? 22 : 14} /> : null}
      <span className="mv-clue-chip__text">{text}</span>
    </span>
  );
}
