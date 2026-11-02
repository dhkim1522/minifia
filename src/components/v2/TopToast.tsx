import { useCallback, useEffect, useRef, useState } from "react";
import "../../styles/v2.css";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 화면 위 알림. design/v2.0/design-system/components/bundle.js :107 을 React 19 로 옮겼다.
// 한 줄(nowrap) 알림 하나, role status·aria-live polite. 알림은 쌓지 않는다: 새 알림이 이전 알림을 바꾼다.
// 닉네임이 들어가는 글자는 React 텍스트 노드로만 그린다(T-06-26).

export interface TopToastProps {
  text: string;
  visible: boolean;
  icon?: V2IconName;
}

export function TopToast({ text, visible, icon }: TopToastProps) {
  return (
    <div className={visible ? "mv-toast mv-toast--top is-on" : "mv-toast mv-toast--top"} role="status" aria-live="polite">
      <span className="mv-toast__text">
        {icon ? <V2Icon name={icon} size={18} /> : null}
        {text}
      </span>
    </div>
  );
}

// tokens.css 의 --dur-toast(1500ms) 와 같은 값. 켜진 채로 머무는 시간이다.
export const TOAST_DURATION_MS = 1500;
// .mv-toast 의 opacity 전환(220ms)이 끝난 뒤 글자를 비운다. 빈 알림은 자리를 차지하지 않는다(.mv-toast__text:empty).
const FADE_OUT_MS = 220;

export interface UseTopToast {
  /** `<TopToast {...toast.props} />` */
  props: TopToastProps;
  /** 이전 알림이 있으면 바꾸고 타이머를 다시 시작한다. durationMs 를 주면 그 시간 동안 머문다(기본 TOAST_DURATION_MS) */
  show(text: string, icon?: V2IconName, durationMs?: number): void;
  dismiss(): void;
}

const EMPTY: TopToastProps = { text: "", visible: false };

export function useTopToast(): UseTopToast {
  const [state, setState] = useState<TopToastProps>(EMPTY);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stopTimers = useCallback(() => {
    if (hideTimer.current !== undefined) clearTimeout(hideTimer.current);
    if (clearTimer.current !== undefined) clearTimeout(clearTimer.current);
    hideTimer.current = undefined;
    clearTimer.current = undefined;
  }, []);

  const dismiss = useCallback(() => {
    stopTimers();
    setState((prev) => ({ ...prev, visible: false }));
    clearTimer.current = setTimeout(() => {
      clearTimer.current = undefined;
      setState(EMPTY);
    }, FADE_OUT_MS);
  }, [stopTimers]);

  const show = useCallback(
    (text: string, icon?: V2IconName, durationMs: number = TOAST_DURATION_MS) => {
      stopTimers();
      setState({ text, visible: true, icon });
      hideTimer.current = setTimeout(() => {
        hideTimer.current = undefined;
        dismiss();
      }, durationMs);
    },
    [stopTimers, dismiss],
  );

  // 언마운트 때 타이머를 풀어 사라진 화면에 상태를 쓰지 않게 한다.
  useEffect(() => stopTimers, [stopTimers]);

  return { props: state, show, dismiss };
}
