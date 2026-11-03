import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { IME_WAIT_MS } from "../game/chatUi";

// 한글 조합이 끝난 값을 기다려 넘기는 훅(유언·쪽지 시트용). 7페이즈 ChatPanel(src/components/v2/ChatPanel.tsx)의 조합 규칙을
// 시트에 맞게 줄인 사본이다: 조합 중에 저장·닫기를 누르면 compositionend 또는 IME_WAIT_MS 중 먼저 오는 쪽에서
// 그 시각 DOM 값으로 콜백을 한 번 부른다(조합 꼬리 방지, 연구 Pitfall 11). 조합 중이 아니면 즉시 부른다.
// 기다리는 동안 다시 settle 해도 처음 콜백 하나만 부른다(두 번 가지 않는다).
// happy-dom 은 실제 IME 를 재현하지 못하므로 이벤트 순서만 시험한다(실제 조합은 07-19 CDP·07-21 iPhone).

export interface ComposedText {
  composing: () => boolean;
  /** 조합이 끝난 값으로 cb 를 한 번 부른다 */
  settle: (cb: (text: string) => void) => void;
  bind: { onCompositionStart: () => void; onCompositionEnd: () => void; onBlur: () => void };
}

export function useComposedText(ref: RefObject<HTMLTextAreaElement | null>): ComposedText {
  const composingRef = useRef(false);
  const pendingRef = useRef<{ cb: (text: string) => void; timer: ReturnType<typeof setTimeout> } | null>(null);

  const flush = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingRef.current = null;
    p.cb(ref.current?.value ?? "");
  }, [ref]);

  useEffect(
    () => () => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    },
    [],
  );

  const composing = useCallback(() => composingRef.current, []);

  const settle = useCallback(
    (cb: (text: string) => void) => {
      if (!composingRef.current) {
        cb(ref.current?.value ?? "");
        return;
      }
      if (pendingRef.current) return;
      pendingRef.current = { cb, timer: setTimeout(flush, IME_WAIT_MS) };
    },
    [ref, flush],
  );

  const bind = useMemo(
    () => ({
      onCompositionStart: () => {
        composingRef.current = true;
      },
      onCompositionEnd: () => {
        composingRef.current = false;
        flush();
      },
      // 조합 중 포커스를 잃으면 compositionend 가 오지 않을 수 있다: 조합을 끝난 것으로 본다
      onBlur: () => {
        composingRef.current = false;
      },
    }),
    [flush],
  );

  return { composing, settle, bind };
}
