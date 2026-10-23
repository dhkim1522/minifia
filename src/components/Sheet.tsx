import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import "../styles/sheet.css";

// 하단 시트 틀(C-01 내 역할 · C-03 공유 · 확인 시트 공통). 네이티브 <dialog>.showModal() 위에 올린다:
// 포커스 가두기·Esc·뒤 화면 비활성은 브라우저 기본 동작이다(리서치 Pattern 9, Pitfall 19).
// 열림 상태는 부모가 쥔다 — 마운트 = 열림, onClose 가 불리면 부모가 언마운트한다.

// 닫는 애니메이션(240ms)은 animationend 에 기대지 않는다. 숨겨진 탭에서는 이벤트가 오지 않으므로 시간 폴백(+여유)으로 끝낸다.
const CLOSE_MS = 260;
const DRAG_CLOSE_PX = 96;
const DRAG_CLOSE_SPEED = 0.5; // px/ms

export interface SheetProps {
  label: string;
  onClose: () => void;
  /** 열린 뒤 포커스를 줄 요소. 없으면 [닫기], 그것도 없으면 시트 첫 포커스 가능 요소 */
  initialFocusRef?: RefObject<HTMLElement | null>;
  showClose?: boolean;
  /** 함수면 requestClose 와 닫히는 중 여부를 받는다 */
  children: ReactNode | ((requestClose: () => void, closing: boolean) => ReactNode);
}

interface Drag {
  pointerId: number;
  startY: number;
  startAt: number;
  dy: number;
}

export function Sheet({ label, onClose, initialFocusRef, showClose, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const drag = useRef<Drag | null>(null);

  // 닫히는 중에는 몇 번을 눌러도 onClose 는 한 번이다.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      onCloseRef.current();
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    // StrictMode 는 effect 를 두 번 돌린다: 이미 열려 있으면 showModal 을 다시 부르지 않는다(부르면 예외).
    if (!dlg.open) dlg.showModal();
    // React autoFocus 는 대화상자가 열리기 전에 일어나므로 열린 직후 직접 준다.
    const first = initialFocusRef?.current ?? closeBtnRef.current ?? dlg.querySelector<HTMLElement>("button, [href], input, [tabindex]");
    first?.focus();
    return () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = undefined;
      if (dlg.open) dlg.close();
    };
    // 열릴 때 한 번만. initialFocusRef 객체가 렌더마다 바뀌어도 다시 열지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 손잡이 막대에만 끌기를 건다(본문은 스크롤된다). 놓을 때 96px 넘게 끌었거나 0.5px/ms 보다 빨랐으면 닫는다.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (closingRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startAt: Date.now(), dy: 0 };
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${d.dy}px)`;
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const speed = d.dy / Math.max(1, Date.now() - d.startAt);
    const el = sheetRef.current;
    // 인라인 값을 비우면 원위치로 돌아가거나(전환 복구), 닫는 중 클래스의 translateY(100%) 로 이어진다.
    if (el) {
      el.style.transition = "";
      el.style.transform = "";
    }
    if (d.dy > DRAG_CLOSE_PX || speed > DRAG_CLOSE_SPEED) requestClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={closing ? "mf-dialog mf-dialog--closing" : "mf-dialog"}
      aria-label={label}
      onCancel={(e) => {
        // Esc 의 기본 동작은 즉시 닫아 종료 애니메이션이 사라진다. 막고 직접 닫는다.
        e.preventDefault();
        requestClose();
      }}
    >
      <div className="mf-sheet-scrim" onClick={requestClose} />
      <div ref={sheetRef} className={closing ? "mf-sheet mf-sheet--closing" : "mf-sheet"}>
        <div
          className="mf-sheet__handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        {showClose ? (
          <Button
            ref={closeBtnRef}
            variant="secondary"
            compact
            className="mf-iconbtn mf-sheet__close"
            aria-label="닫기"
            icon={<Icon name="close" />}
            onClick={requestClose}
          />
        ) : null}
        {typeof children === "function" ? children(requestClose, closing) : children}
      </div>
    </dialog>
  );
}
