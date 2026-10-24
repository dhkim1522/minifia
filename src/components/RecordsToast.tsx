import type { ReactElement } from "react";
import { Icon } from "./Icon";
import type { ToastItem } from "./Toast";
import "../styles/records.css";

// 밤이 끝나 새 수사 기록이 생겼을 때의 짧은 알림(시안 N5 .nb-toast). 화면을 막지 않고 포커스도 옮기지 않는다.
// 한 번만 읽히도록 role="status" 한 줄이다(아침 카드·단계 안내와 겹쳐 읽히지 않는다, UI-SPEC N-5).
export function RecordsToast({ toast }: { toast: ToastItem | null }): ReactElement | null {
  if (!toast) return null;
  return (
    <div key={toast.id} role="status" className="mf-records-toast">
      <Icon name="notebook" size={16} />
      {toast.text}
    </div>
  );
}
