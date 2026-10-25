import type { ReactElement } from "react";
import { journalArt } from "../net/assets";
import type { JournalRole } from "../net/assets";
import type { ToastItem } from "./Toast";
import "../styles/rolecard-toast.css";

export interface RoleCardToastProps {
  toast: ToastItem | null;
  /** 아이콘을 고르는 역할. 문구는 호출 쪽이 JOURNAL_TEXT[role].notice 로 만들어 toast.text 에 넣는다 */
  role: JournalRole;
  /** 누르면 알림이 사라지고 역할 카드가 활동 기록 탭으로 열린다 */
  onOpen: () => void;
}

// 밤이 끝나 새 일지가 생겼을 때의 눌리는 알림(결정 0026, UI-SPEC D·R6, 시안 .nb-toast--tap).
// 바깥 div[role=status] 한 줄이 한 번만 읽히고, 안의 button 이 눌린다. 바깥 래퍼는 클릭을 막지 않는다(CSS).
export function RoleCardToast({ toast, role, onOpen }: RoleCardToastProps): ReactElement | null {
  if (!toast) return null;
  return (
    <div key={toast.id} role="status" className="mf-rolecard-toast-wrap">
      <button type="button" className="mf-rolecard-toast" onClick={onOpen}>
        <img className="mf-rolecard-toast__icon" src={journalArt(role, "icon").src} width={16} height={16} alt="" aria-hidden="true" draggable={false} />
        {toast.text}
      </button>
    </div>
  );
}
