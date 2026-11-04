import { useEffect, useRef } from "react";
import "../../styles/v2.css";
import type { BadgeId } from "../../../shared/protocol";
import { BADGE_TEXT } from "../../game/badgeView";
import type { ClaimChip } from "../../game/badgeView";
import { CLAIM_ICON } from "./ClaimBadge";
import { V2Icon } from "./V2Icon";

// 직업 배지 칩 시트 (09.1.1-08, UI-SPEC A-2). 틀은 유언 시트(.mv-will)와 같은 계열(폭 부모 − 20, 안쪽 12, radius-lg, night-800, 테두리 night-600).
// 머리(제목 "직업 배지" 16px 700 + 닫기 44×44) → 칩 줄(높이 44, pill) → 안내 한 줄(주장 중일 때만, 14px). 칩 한 번에 확정은 부르는 쪽(useBadge)이 한다.
// 열리면 첫 칩으로 초점(preventScroll), Esc 로 닫힌다. 닫은 뒤 초점은 부르는 쪽이 떠 있는 버튼으로 돌려준다.
// 시트에는 입력칸이 없고 서버로 가는 길도 없다 — 콜백은 onPick·onClose 뿐이다. 위치(아래 패널 위 8, 키보드 위)는 부르는 쪽(.mf-will-layer)이 정한다.

export interface ClaimSheetProps {
  chips: readonly ClaimChip[];
  /** 내 지금 주장(낙관 값) */
  value: BadgeId;
  onPick(id: BadgeId): void;
  onClose(): void;
  /** 연결 끊김: 칩이 aria-disabled 이고 눌러도 아무 일 없다 */
  disabled?: boolean;
}

export function ClaimSheet({ chips, value, onPick, onClose, disabled }: ClaimSheetProps) {
  const firstRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      className="mv-claim-sheet"
      role="group"
      aria-label={BADGE_TEXT.sheetTitle}
      data-claim-sheet=""
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="mv-claim-sheet__head">
        <span className="mv-claim-sheet__title">{BADGE_TEXT.sheetTitle}</span>
        <button type="button" className="mv-claim-sheet__close" aria-label={BADGE_TEXT.close} onMouseDown={(e) => e.preventDefault()} onClick={onClose}>
          <V2Icon name="close" />
        </button>
      </div>
      <div className="mv-claim-sheet__chips">
        {chips.map((c, i) => (
          <button
            key={c.id}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            className="mv-claim-chip"
            data-claim-chip={c.id}
            aria-pressed={value === c.id}
            aria-disabled={disabled ? "true" : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (disabled) return;
              onPick(c.id);
            }}
          >
            <V2Icon name={CLAIM_ICON[c.id]} size={18} />
            {c.label}
          </button>
        ))}
      </div>
      {value !== "none" ? <p className="mv-claim-sheet__hint">{BADGE_TEXT.hint}</p> : null}
    </div>
  );
}
