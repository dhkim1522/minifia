import type { ReactNode } from "react";
import "../styles/chip.css";
import { Icon } from "./Icon";

export interface ChipProps {
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}

// aria-pressed 토글 버튼. 선택은 색(면 반전)과 앞의 체크 아이콘 둘로 표시한다.
// 선택 해제 동작은 이 부품이 정하지 않는다 — 부모가 이미 선택된 칩의 재누름을 무시한다.
export function Chip({ selected, disabled, onPress, children }: ChipProps) {
  return (
    <button type="button" className="mf-chip" aria-pressed={selected} disabled={disabled} onClick={onPress}>
      {selected ? <Icon name="check" size={18} /> : null}
      <span className="mf-chip__label">{children}</span>
    </button>
  );
}
