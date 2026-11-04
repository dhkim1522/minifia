import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { IME_WAIT_MS } from "../game/chatUi";

// 한글 조합이 끝난 값을 기다려 넘기는 훅(유언·쪽지 시트용). 7페이즈 ChatPanel(src/components/v2/ChatPanel.tsx)의 조합 규칙을
// 시트에 맞게 줄인 사본이다: 조합 중에 저장·닫기를 누르면 compositionend 또는 IME_WAIT_MS 중 먼저 오는 쪽에서
// 그 시각 DOM 값으로 콜백을 한 번 부른다(조합 꼬리 방지, 연구 Pitfall 11). 조합 중이 아니면 즉시 부른다.
// 기다리는 동안 settle 한 콜백은 순서대로 한 번씩 부른다(IN-01: 저장 뒤 닫기가 버려지지 않는다). 같은 키(없으면 같은 함수)로
// 다시 settle 하면 쌓지 않는다(두 번 가지 않는다).
// happy-dom 은 실제 IME 를 재현하지 못하므로 이벤트 순서만 시험한다(실제 조합은 07-19 CDP·07-21 iPhone).

export interface ComposedText {
  composing: () => boolean;
  /** 조합이 끝난 값으로 cb 를 한 번 부른다. 조합 중 대기하는 동안 같은 key(생략하면 같은 cb)는 한 번만 쌓는다 */
  settle: (cb: (text: string) => void, key?: string) => void;
  bind: { onCompositionStart: () => void; onCompositionEnd: () => void; onBlur: () => void };
}

export function useComposedText(ref: RefObject<HTMLTextAreaElement | null>): ComposedText {
  const composingRef = useRef(false);
  const pendingRef = useRef<{ items: Array<{ cb: (text: string) => void; key: unknown }>; timer: ReturnType<typeof setTimeout> } | null>(null);

  const flush = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingRef.current = null;
    const text = ref.current?.value ?? "";
    for (const item of p.items) item.cb(text);
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
    (cb: (text: string) => void, key?: string) => {
      if (!composingRef.current) {
        cb(ref.current?.value ?? "");
        return;
      }
      const id: unknown = key ?? cb;
      const p = pendingRef.current;
      if (p) {
        if (!p.items.some((item) => item.key === id)) p.items.push({ cb, key: id });
        return;
      }
      pendingRef.current = { items: [{ cb, key: id }], timer: setTimeout(flush, IME_WAIT_MS) };
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
