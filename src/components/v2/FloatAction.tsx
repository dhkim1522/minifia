import type { ReactNode, Ref } from "react";
import "../../styles/v2.css";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 오른쪽 아래 떠 있는 둥근 버튼 묶음 (09.1.1-08, UI-SPEC A-2·B-1). 직업 배지 버튼(위)과 귓속말 버튼(아래, 09.1.1-09)이 같은 묶음·같은 자리를 쓴다.
// 묶음 위치: 오른쪽 16, 아래 = 키보드 올림 + 패널 높이 + 8 (화면 틀이 패널을 재서 --mf-panel-h 를 이 묶음에 쓴다). 버튼 지름 48, 사이 8.
// 버튼은 mousedown 의 기본 동작을 막아 채팅 입력칸의 포커스(키보드)를 뺏지 않는다. 연결이 끊기면 aria-disabled 이고 눌러도 아무 일 없다.
// 사용자 문자열은 받지 않는다 — 이름(label)은 부르는 쪽이 enum 에서 만든 고정 문구다.

export function FloatActions({ children, ref }: { children: ReactNode; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="mf-float" data-float-stack="">
      {children}
    </div>
  );
}

export interface FloatActionProps {
  /** E2E·누설 검사가 읽는 표식 */
  kind: "claim" | "whisper";
  /** 안에 그릴 아이콘 24 */
  icon: V2IconName;
  /** 접근성 이름 */
  label: string;
  /** 시트가 열려 있다(눌림): 안쪽 테두리 2px */
  pressed?: boolean;
  /** 눌러도 아무 일 없음(aria-disabled, 불투명도 0.45) */
  disabled?: boolean;
  /** 상태 점 */
  dot?: boolean;
  /** 남은 횟수 점(귓속말) — data-float-left 로만 싣는다 */
  left?: number;
  onPress(el: HTMLButtonElement): void;
  ref?: Ref<HTMLButtonElement>;
}

export function FloatAction({ kind, icon, label, pressed, disabled, dot, left, onPress, ref }: FloatActionProps) {
  return (
    <button
      ref={ref}
      type="button"
      className="mv-float"
      data-float={kind}
      {...(left !== undefined ? { "data-float-left": String(left) } : {})}
      aria-label={label}
      aria-pressed={pressed === true}
      aria-disabled={disabled ? "true" : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        if (disabled) return;
        onPress(e.currentTarget);
      }}
    >
      <V2Icon name={icon} size={24} />
      {dot ? <span className="mv-float__dot" aria-hidden="true" /> : null}
    </button>
  );
}
