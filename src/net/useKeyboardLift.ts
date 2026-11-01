// 채팅 패널의 키보드 배치 훅 (07-UI-SPEC "패널과 키보드" 배치 규칙, 리서치 Pattern 6·Pitfall 8·9).
// - useKeyboardLift: 입력칸에 포커스가 있을 때만 visualViewport 로 키보드 높이(lift)를 읽어 CSS 변수로 쓴다.
// - useChatLogHeight: 기록 칸 높이 LOG_H 를 처음과 화면 방향이 바뀔 때만 정한다(키보드·주소창으로는 다시 정하지 않는다).
//
// UI-SPEC "검사 실패 때 내리는 순서" 1단계(visualViewport 대신 innerHeight 변화로 대체)를 쓸 자리가 이 파일이다.
// 쓰지 않는 것: window.scrollTo 로 억지 복구, 캔버스 크기를 키보드에 맞춰 바꾸기(UI-SPEC "쓰지 않을 것").
// iOS 26.0 의 visualViewport 높이 불일치(Pitfall 8)는 포커스 게이트 + 블러 즉시 0 으로 막는다. 실기기 확인은 07-21 몫이다(가정 A3).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { KB_OPEN_MIN_LIFT, logHeightFor } from "../game/chatUi";

/** 포커스·블러 뒤에 값을 한 번씩 더 읽는 시각(WebKit 은 이벤트 직후 값이 틀리고 지연 뒤 맞는 경우가 있다) */
const REREAD_MS = [100, 300, 1000] as const;

export function useKeyboardLift(opts: {
  inputRef: RefObject<HTMLInputElement | null>;
  target: RefObject<HTMLElement | null>;
  enabled?: boolean;
}): { open: boolean; lift: () => number } {
  const { inputRef, target, enabled = true } = opts;
  const [open, setOpen] = useState(false);
  const liftRef = useRef(0);
  const openRef = useRef(false);
  const lift = useRef(() => liftRef.current).current;

  useEffect(() => {
    if (!enabled) return;
    let focused = document.activeElement !== null && document.activeElement === inputRef.current;
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
      const vv = window.visualViewport;
      if (!focused || !vv) {
        write(0, 0);
        return;
      }
      write(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)), vv.offsetTop);
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

    const isInput = (e: Event) => e.target !== null && e.target === inputRef.current;
    const onFocus = (e: Event) => {
      if (!isInput(e)) return;
      focused = true;
      schedule();
      rereadLater();
    };
    const onBlur = (e: Event) => {
      if (!isInput(e)) return;
      focused = false;
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
    // focus·blur 는 거품이 없으므로 캡처로 듣는다(입력칸이 나중에 그려져도 잡는다)
    document.addEventListener("focus", onFocus, true);
    document.addEventListener("blur", onBlur, true);
    read();
    if (focused) rereadLater();

    return () => {
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      document.removeEventListener("focus", onFocus, true);
      document.removeEventListener("blur", onBlur, true);
      if (raf) cancelAnimationFrame(raf);
      clearTimers();
      focused = false;
      write(0, 0);
    };
  }, [enabled, inputRef, target]);

  return { open, lift };
}

/**
 * 기록 칸 높이 LOG_H. 처음 그릴 때와 화면 방향이 바뀔 때(입력칸 포커스가 없을 때)만 방 높이로 정한다.
 * 키보드·주소창으로 높이가 바뀌어도 다시 정하지 않는다.
 */
export function useChatLogHeight(rootRef: RefObject<HTMLElement | null>, inputRef: RefObject<HTMLInputElement | null>): number {
  const [logH, setLogH] = useState(() => logHeightFor(window.innerHeight));

  useLayoutEffect(() => {
    const measure = () => logHeightFor(rootRef.current?.clientHeight || window.innerHeight);
    setLogH(measure());

    let raf = 0;
    const typing = () => document.activeElement !== null && document.activeElement === inputRef.current;
    const onTurn = () => {
      if (typing()) return;
      setLogH(measure());
      // 방향 이벤트 직후에는 높이가 아직 옛 값일 수 있어 한 프레임 뒤에 한 번 더 읽는다
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!typing()) setLogH(measure());
      });
    };

    const orientation = window.screen?.orientation;
    window.addEventListener("orientationchange", onTurn);
    orientation?.addEventListener?.("change", onTurn);
    return () => {
      window.removeEventListener("orientationchange", onTurn);
      orientation?.removeEventListener?.("change", onTurn);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef, inputRef]);

  return logH;
}
