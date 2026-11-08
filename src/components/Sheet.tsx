import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { getSheetProbe } from "../debug/sheetProbe";
import type { SheetTrace } from "../debug/sheetProbe";
import "../styles/sheet.css";
import "../styles/v2.css";

// 하단 시트 틀(C-01 내 역할 · C-03 공유 · 확인 시트 공통). 네이티브 <dialog>.showModal() 위에 올린다:
// 포커스 가두기·Esc·뒤 화면 비활성은 브라우저 기본 동작이다(리서치 Pattern 9, Pitfall 19).
// 열림 상태는 부모가 쥔다 — 마운트 = 열림, onClose 가 불리면 부모가 언마운트한다.

// 닫는 애니메이션(240ms)은 animationend 에 기대지 않는다. 숨겨진 탭에서는 이벤트가 오지 않으므로 시간 폴백(+여유)으로 끝낸다.
const CLOSE_MS = 260;
// 진입(열림 클래스)도 같은 이유로 프레임에만 기대지 않는다. 숨겨진 탭·절전에서 requestAnimationFrame 이 멈춰도
// 60ms(60Hz 기준 세 프레임 안팎) 안에 열림 상태가 되어 시트가 화면 밖에 영영 남지 않게 한다(T-01-58).
const ENTER_FALLBACK_MS = 60;
// 이 높이(px)보다 작게 줄어든 뷰포트는 키패드로 보지 않는다(주소창·하단 툴바 변화).
const KEYBOARD_MIN_PX = 120;
const DRAG_CLOSE_PX = 96;
const DRAG_CLOSE_SPEED = 0.5; // px/ms

export interface SheetProps {
  label: string;
  onClose: () => void;
  /** 열린 뒤 포커스를 줄 요소. 없으면 [닫기], 그것도 없으면 시트 첫 포커스 가능 요소 */
  initialFocusRef?: RefObject<HTMLElement | null>;
  showClose?: boolean;
  /** 시트 본체(.mf-sheet)에 덧붙일 클래스. 시트별 높이 같은 모양 차이에 쓴다 */
  className?: string;
  /** 함수면 requestClose 와 닫히는 중 여부를 받는다 */
  children: ReactNode | ((requestClose: () => void, closing: boolean) => ReactNode);
}

interface Drag {
  pointerId: number;
  startY: number;
  startAt: number;
  dy: number;
}

const isTextInput = (el: HTMLElement) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

export function Sheet({ label, onClose, initialFocusRef, showClose, className, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  // 열림 클래스(mf-dialog--open) 여부. 처음엔 false 라 첫 프레임은 CSS 의 시작 상태(화면 아래)로 그려진다.
  const [entered, setEntered] = useState(false);
  const closingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const drag = useRef<Drag | null>(null);
  // 계측기(?sheetdebug=1)가 있을 때만 기록한다. 없으면 아무 일도 하지 않는다(G-01-9 진단).
  const traceRef = useRef<SheetTrace | null>(null);

  // 닫히는 중에는 몇 번을 눌러도 onClose 는 한 번이다.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    traceRef.current?.mark("close");
    timer.current = setTimeout(() => {
      timer.current = undefined;
      onCloseRef.current();
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    // StrictMode 는 effect 를 두 번 돌린다: 이미 열려 있으면 showModal 을 다시 부르지 않는다(부르면 예외).
    let trace: SheetTrace | null = null;
    if (!dlg.open) {
      trace = getSheetProbe()?.start({ label, dialog: dlg, sheet: sheetRef.current }) ?? null;
      dlg.showModal();
      trace?.mark("shown");
    }
    traceRef.current = trace;
    // React autoFocus 는 대화상자가 열리기 전에 일어나므로 열린 직후 직접 준다.
    const first = initialFocusRef?.current ?? closeBtnRef.current ?? dlg.querySelector<HTMLElement>("button, [href], input, [tabindex]");
    // 시트가 화면 밖(translateY 100%)에 있는 순간의 포커스가 대화상자를 스크롤하지 않게 한다(G-01-9 후보 원인).
    first?.focus({ preventScroll: true });
    trace?.mark("focused");
    // 첫 프레임을 시작 상태로 그린 뒤 열림 — iOS Safari 에서 첫 프레임이 최종 위치로 그려지는 문제(G-01-9).
    // requestAnimationFrame 콜백은 그 프레임이 그려지기 전에 실행되므로 한 번 더 요청해 시작 상태가 최소 한 번 그려지게 한다.
    // 프레임이 오지 않는 환경은 시간 폴백이 대신한다. 먼저 불린 쪽이 나머지 예약을 취소하고 한 번만 일한다.
    let frame1: number | undefined;
    let frame2: number | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const cancelEnter = () => {
      if (frame1 !== undefined) cancelAnimationFrame(frame1);
      if (frame2 !== undefined) cancelAnimationFrame(frame2);
      if (fallback !== undefined) clearTimeout(fallback);
      frame1 = frame2 = fallback = undefined;
    };
    const enter = () => {
      cancelEnter();
      if (!closingRef.current) {
        setEntered(true);
        // 열림 클래스 "요청" 시점이다. 클래스는 이 뒤 렌더에 붙는다.
        traceRef.current?.mark("entered");
      }
    };
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(enter);
    });
    fallback = setTimeout(enter, ENTER_FALLBACK_MS);
    return () => {
      traceRef.current?.end();
      traceRef.current = null;
      cancelEnter();
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = undefined;
      if (dlg.open) dlg.close();
    };
    // 열릴 때 한 번만. initialFocusRef 객체가 렌더마다 바뀌어도 다시 열지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 입력칸에 포커스가 있으면(폰 키패드가 떠 있는 동안) 배경 누르기는 키패드만 내린다. 시트까지 닫으면 입력하던 것을 잃는다.
  const onScrimClick = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && dialogRef.current?.contains(active) && isTextInput(active)) {
      active.blur();
      return;
    }
    requestClose();
  };

  // 폰 키패드가 올라와도 시트가 가려지지 않게 대화상자 아래 여백(--mf-kb)을 키패드 높이만큼 준다.
  // iOS Safari 는 키패드가 떠도 레이아웃 뷰포트를 줄이지 않고 visualViewport 만 줄인다.
  // 입력칸에 포커스가 있을 때만 적용한다. 주소창이 접히는 것으로 시트가 떠오르지 않게(G-01-9).
  useEffect(() => {
    const dlg = dialogRef.current;
    const vv = window.visualViewport;
    if (!dlg || !vv) return;
    const update = () => {
      const active = document.activeElement;
      const typing = active instanceof HTMLElement && dlg.contains(active) && isTextInput(active);
      const raw = typing ? Math.round(dlg.clientHeight - vv.height - vv.offsetTop) : 0;
      // iOS 26 은 키패드가 뜨는 순간 visualViewport 높이를 틀리게(작게) 줄 때가 있다(Pitfall 8). 그 값이 그대로 들어가면 시트가
      // 남은 높이에 맞춰 눌려 제목만 보이고 입력칸이 잘린다(2026-11-08 실기기). 시트는 제 내용 높이(scrollHeight)보다 작게 눌리지 않게 막는다.
      const room = dlg.clientHeight - (sheetRef.current?.scrollHeight ?? 0);
      const kb = raw > KEYBOARD_MIN_PX ? Math.max(0, Math.min(raw, room)) : 0;
      dlg.style.setProperty("--mf-kb", `${kb}px`);
    };
    // 포커스 직후 값이 틀리고 조금 뒤 맞는 경우가 있어 몇 번 더 읽는다(useKeyboardLift 와 같은 시각).
    let timers: ReturnType<typeof setTimeout>[] = [];
    const updateSoon = () => {
      update();
      for (const t of timers) clearTimeout(t);
      timers = [100, 300, 1000].map((ms) => setTimeout(update, ms));
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    dlg.addEventListener("focusin", updateSoon);
    dlg.addEventListener("focusout", updateSoon);
    // 열리자마자 입력칸에 포커스가 가는 시트(빈 닉네임)는 focusin 이 리스너보다 먼저 지나가므로 여기서도 다시 읽기를 건다.
    updateSoon();
    return () => {
      for (const t of timers) clearTimeout(t);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      dlg.removeEventListener("focusin", updateSoon);
      dlg.removeEventListener("focusout", updateSoon);
    };
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
      className={closing ? "mf-dialog mf-dialog--closing" : entered ? "mf-dialog mf-dialog--open" : "mf-dialog"}
      aria-label={label}
      onCancel={(e) => {
        // Esc 의 기본 동작은 즉시 닫아 종료 애니메이션이 사라진다. 막고 직접 닫는다.
        e.preventDefault();
        requestClose();
      }}
    >
      <div className="mf-sheet-scrim" onClick={onScrimClick} />
      <div
        ref={sheetRef}
        className={[closing ? "mf-sheet mf-sheet--closing" : "mf-sheet", className].filter(Boolean).join(" ")}
      >
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
            className="mf-sheet__close mv-closepill"
            aria-label="닫기"
            onClick={requestClose}
          >
            <Icon name="close" size={20} />
          </Button>
        ) : null}
        {typeof children === "function" ? children(requestClose, closing) : children}
      </div>
    </dialog>
  );
}
