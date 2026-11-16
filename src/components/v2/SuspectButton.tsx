import type { Ref } from "react";
import { V2Icon } from "./V2Icon";

// [의심] 단추 (24-03, UI-SPEC P24-2·P24-3·P24-9): 낮 토론 입력줄 맨 오른쪽 끝(ChatPanel trailing 슬롯)의 48 원 아이콘 단추. 글 없음, 이모지 없음.
// 쉼 = 이름 "의심 붙이기" · 모드 = 눌림(안쪽 테두리 2px, .mv-tool 규칙) · 오늘 붙였음 = 이름 "의심 옮기기" + 점(.mv-chat__will-dot 재사용, data-suspect-stuck).
// 비활성(aria-disabled): 근처 0명(noTargets)이면 눌러도 모드가 켜지지 않고 onDeny 가 불린다(알림은 부르는 쪽). 연결 끊김·열린 시트로 비활성이면 아무 일도 없다.
// 다른 입력줄 단추와 달리 onMouseDown 의 기본 동작을 막지 않는다 — 누르면 입력칸 포커스를 놓아 키보드를 닫고 모드에 들어간다(P24-4: 키보드가 열리면 이름표가 안 보인다).
export interface SuspectButtonProps {
  /** 의심 모드가 켜져 있다(aria-pressed) */
  mode: boolean;
  /** 오늘 이미 붙였다(서버 값) — "옮기기" 이름과 점 */
  used: boolean;
  /** aria-disabled */
  disabled: boolean;
  /** 비활성인 이유가 "근처 산 사람 0명" 이다 — 눌리면 onDeny */
  noTargets: boolean;
  onToggle(): void;
  onDeny(): void;
  buttonRef?: Ref<HTMLButtonElement>;
}

export const SUSPECT_BTN_LABEL = { ready: "의심 붙이기", moved: "의심 옮기기" } as const;

export function SuspectButton({ mode, used, disabled, noTargets, onToggle, onDeny, buttonRef }: SuspectButtonProps) {
  return (
    <button
      type="button"
      ref={buttonRef}
      className="mv-tool mv-chat__suspect"
      data-suspect-btn=""
      data-suspect-stuck={used ? "" : undefined}
      aria-label={used ? SUSPECT_BTN_LABEL.moved : SUSPECT_BTN_LABEL.ready}
      aria-pressed={mode ? "true" : "false"}
      aria-disabled={disabled ? "true" : undefined}
      onClick={(e) => {
        if (disabled) {
          if (noTargets) onDeny();
          return;
        }
        // 키보드가 열려 있으면 닫는다(입력 중이던 글은 그대로 남는다 — 값은 부모가 쥔다)
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== e.currentTarget && active.matches("input,textarea")) active.blur();
        onToggle();
      }}
    >
      <span className="mv-tool__face">
        <V2Icon name="postit" size={22} />
        {used ? <i className="mv-chat__will-dot" /> : null}
      </span>
    </button>
  );
}
