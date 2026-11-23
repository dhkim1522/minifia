// 채팅 패널의 키보드 배치 훅 (07-UI-SPEC "패널과 키보드" 배치 규칙, 리서치 Pattern 6·Pitfall 8·9).
// - useKeyboardLift: 입력칸에 포커스가 있을 때만 visualViewport 로 키보드 높이(lift)를 읽어 CSS 변수로 쓴다.
//
// 쓰지 않는 것: window.scrollTo 로 억지 복구, 캔버스 크기를 키보드에 맞춰 바꾸기(UI-SPEC "쓰지 않을 것").
// 입력 초점이 끝나면 WebKit 이 이전 visualViewport 값을 보내더라도 즉시 원위치로 돌린다.
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { KB_OPEN_MIN_LIFT } from "../game/chatUi";

/** 유언·쪽지·한마디 시트의 글 입력칸도 채팅과 같은 키보드 위치를 쓴다. */
const SHEET_LAYER = ".mf-will-layer";
const inSheetLayer = (t: EventTarget | null): boolean =>
  (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && t.closest(SHEET_LAYER) !== null;

/** 포커스·블러 뒤에 값을 한 번씩 더 읽는 시각(WebKit 은 이벤트 직후 값이 틀리고 지연 뒤 맞는 경우가 있다) */
const REREAD_MS = [100, 300, 1000] as const;

export function useKeyboardLift(opts: {
  inputRef: RefObject<HTMLInputElement | null>;
  target: RefObject<HTMLElement | null>;
  enabled?: boolean;
}): { open: boolean; lift: () => number; /** 키보드 초점이 입력칸이 아니라 시트 층의 textarea 에 있다 */ inSheet: boolean } {
  const { inputRef, target, enabled = true } = opts;
  const [open, setOpen] = useState(false);
  const liftRef = useRef(0);
  const openRef = useRef(false);
  const [inSheet, setInSheet] = useState(false);
  const inSheetRef = useRef(false);
  const lift = useRef(() => liftRef.current).current;

  useEffect(() => {
    if (!enabled) return;
    const isInput = (el: EventTarget | null) => el !== null && (el === inputRef.current || inSheetLayer(el));
    let focused = isInput(document.activeElement);
    let raf = 0;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const write = (kb: number, top: number) => {
      const el = target.current;
      el?.style.setProperty("--mf-kb-lift", `${kb}px`);
      el?.style.setProperty("--mf-vv-top", `${top}px`);
      liftRef.current = kb;
      const nextOpen = focused && kb > KB_OPEN_MIN_LIFT;
      if (nextOpen !== openRef.current) {
        openRef.current = nextOpen;
        setOpen(nextOpen);
      }
    };

    const read = () => {
      if (!focused || !isInput(document.activeElement)) {
        focused = false;
        markSheet(false);
        write(0, 0);
        return;
      }
      const viewport = window.visualViewport;
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
      const room = target.current?.getBoundingClientRect();
      // 레이아웃 높이도 줄이는 키보드에서는 innerHeight와 visualViewport.height가 같아질 수 있다.
      // 방은 키보드가 열려도 높이를 고정하므로 패널을 배치한 실제 방의 가장자리를 기준으로 잰다.
      const roomBottom = room && room.height > 0 ? room.bottom : window.innerHeight;
      const roomTop = room && room.height > 0 ? room.top : 0;
      markSheet(inSheetLayer(document.activeElement));
      write(Math.max(0, roomBottom - visibleBottom), Math.max(0, visibleTop - roomTop));
    };

    // 한 프레임에 한 번만 계산한다
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        read();
      });
    };

    const clearTimers = () => {
      for (const t of timers) clearTimeout(t);
      timers = [];
    };
    const rereadLater = () => {
      clearTimers();
      timers = REREAD_MS.map((ms) => setTimeout(read, ms));
    };

    const markSheet = (on: boolean) => {
      if (inSheetRef.current === on) return;
      inSheetRef.current = on;
      setInSheet(on);
    };
    const onFocus = (e: Event) => {
      if (!isInput(e.target)) {
        // 시트가 닫히며 초점이 다른 요소(시트를 연 버튼)로 옮겨 가면 입력칸 blur 가 오지 않을 수 있다 — 입력 초점이 끝난 것으로 본다
        if (focused) {
          focused = false;
          markSheet(false);
          write(0, 0);
        }
        return;
      }
      focused = true;
      markSheet(inSheetLayer(e.target));
      schedule();
      rereadLater();
    };
    const onBlur = (e: Event) => {
      if (!isInput(e.target)) return;
      focused = false;
      markSheet(false);
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      write(0, 0);
      rereadLater();
    };

    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule);
    // focus·blur 는 거품이 없으므로 캡처로 듣는다(입력칸이 나중에 그려져도 잡는다)
    document.addEventListener("focus", onFocus, true);
    document.addEventListener("blur", onBlur, true);
    read();
    if (focused) rereadLater();

    return () => {
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      document.removeEventListener("focus", onFocus, true);
      document.removeEventListener("blur", onBlur, true);
      if (raf) cancelAnimationFrame(raf);
      clearTimers();
      focused = false;
      write(0, 0);
    };
  }, [enabled, inputRef, target]);

  return { open, lift, inSheet };
}

/**
 * 보이는 화면(visualViewport) 높이. 시트가 열려 있는 동안(enabled)만 크기 변화를 듣는다 — 키보드가 올라오면 줄어든다.
 * 시트가 패널을 숨길지(패널 + 시트 > 높이 − 헤더)와 textarea 를 2줄로 줄일지(높이 < 300)를 정하는 재료다.
 */
export function useVisualViewportHeight(enabled: boolean): number {
  const read = () => window.visualViewport?.height ?? window.innerHeight;
  const [height, setHeight] = useState(read);
  useEffect(() => {
    if (!enabled) return;
    const on = () => setHeight(read());
    on();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", on);
    window.addEventListener("resize", on);
    return () => {
      vv?.removeEventListener("resize", on);
      window.removeEventListener("resize", on);
    };
  }, [enabled]);
  return height;
}
