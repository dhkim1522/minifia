import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastItem {
  id: number;
  text: string;
}

const DEFAULT_DURATION_MS = 2000;

// 한 번에 하나: 상태가 한 칸이라 새 show 가 이전 토스트를 바꾸고, id 가 바뀌면 타이머를 다시 시작한다.
export function useToast(durationMs: number = DEFAULT_DURATION_MS): {
  toast: ToastItem | null;
  show(text: string): void;
  dismiss(): void;
} {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const show = useCallback(
    (text: string) => {
      clearTimer();
      nextId.current += 1;
      setToast({ id: nextId.current, text });
      timer.current = setTimeout(() => {
        timer.current = undefined;
        setToast(null);
      }, durationMs);
    },
    [clearTimer, durationMs],
  );

  // 언마운트 때 타이머를 풀어 사라진 화면에 상태를 쓰지 않게 한다.
  useEffect(() => clearTimer, [clearTimer]);

  return { toast, show, dismiss };
}

// 알약 토스트. 대기실 알림은 top, 입장 화면의 네트워크 오류는 bottom.
export function Toast({ toast, placement }: { toast: ToastItem | null; placement: "top" | "bottom" }) {
  if (!toast) return null;
  return (
    <div key={toast.id} role="status" className={`mf-toast mf-toast--${placement}`}>
      {toast.text}
    </div>
  );
}
