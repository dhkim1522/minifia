import { useRef } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

export interface ConfirmSheetProps {
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 시트가 열린 뒤 연결이 끊기는 것처럼 확인을 받을 수 없는 동안 확인 버튼을 끈다 */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// 파괴 동작 확인 시트(UI-SPEC "확인 시트"): 제목 아래 버튼 둘을 세로로.
// 위 [취소] 가 주 버튼(--gray-100), 아래 파괴 동작은 보조 면(--gray-800). 진홍은 처형·탈락 발표에 남긴다.
// 열리면 포커스는 [취소]. 누른 뒤 닫히는 동안(Esc·막 누르기 포함) 두 버튼이 꺼진다.
export function ConfirmSheet({ title, confirmLabel, cancelLabel = "취소", confirmDisabled = false, onConfirm, onClose }: ConfirmSheetProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Sheet label={title} onClose={onClose} initialFocusRef={cancelRef}>
      {(requestClose, closing) => (
        <>
          <h2 className="mf-t-heading mf-sheet__title">{title}</h2>
          <div className="mf-sheet__actions">
            <Button ref={cancelRef} variant="primary" block disabled={closing} onClick={requestClose}>
              {cancelLabel}
            </Button>
            <Button
              variant="secondary"
              block
              disabled={closing || confirmDisabled}
              onClick={() => {
                onConfirm();
                requestClose();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
