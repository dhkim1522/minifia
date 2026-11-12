import type { Ref } from "react";
import "../../styles/v2.css";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 방장 줄의 원형 단추 (19-03, D-13·D-14, UI-SPEC A-3·A-4, 시안 A design/v3.0/host-rail/Main.dc.html).
// 지름 52 원(P19-1) · 테두리 1.5px 램프 금빛 · 금빛 아이콘 24 · 바탕 night-700. 보이는 글은 없고 이름은 aria-label 이 맡는다(D-15).
// 이 단추는 깜빡이지 않는다 — 정지한 금빛 테두리 = 방장 전용, 깜빡이는 금빛 테두리(.is-call) = 지금 누를 것. 둘을 가르는 것은 움직임이다.
// 상태: 눌림(시트 열림) = aria-pressed + 안쪽 2px 금빛 링 · 켜진 토글 = role=switch·aria-checked + 금빛 채움 · 사용 불가 = aria-disabled(눌러도 아무 일 없음).
// mousedown 의 기본 동작을 막아 채팅 입력칸의 포커스(키보드)를 뺏지 않는다(FloatAction 과 같다).
// 사용자 문자열은 받지 않는다 — label 은 부르는 쪽이 고정 문구(modeText 등)에서 만든다. 표식 값은 고정 낱말뿐이다(역할·좌석 없음).
// 방장 판정은 서버가 한다 — 이 부품은 화면 조작일 뿐이다(결정 0002).

export interface HostRailButtonProps {
  /** 표식 data-host-rail-btn 의 값. [맵] 은 MapChip 의 줄 변형이 "map" 을 단다 */
  id: "mode" | "bots" | "tutorial";
  /** 안에 그릴 아이콘 24 */
  icon: V2IconName;
  /** 접근성 이름(aria-label) */
  label: string;
  /** 시트가 열려 있다(눌림) */
  pressed?: boolean;
  /** 주면 토글이다: role=switch·aria-checked. 이때 aria-pressed 는 달지 않는다 */
  switchOn?: boolean;
  /** 눌러도 아무 일 없음(aria-disabled, 불투명도 0.45) */
  disabled?: boolean;
  onPress(el: HTMLButtonElement): void;
  ref?: Ref<HTMLButtonElement>;
}

export function HostRailButton({ id, icon, label, pressed, switchOn, disabled, onPress, ref }: HostRailButtonProps) {
  const isSwitch = switchOn !== undefined;
  return (
    <button
      ref={ref}
      type="button"
      className="mv-hostrail-btn"
      data-host-rail-btn={id}
      // 기존 E2E·시험 선택자를 잇는다: 봇 단추는 data-float="bots", 튜토리얼 토글은 data-tutorial-toggle
      {...(id === "bots" ? { "data-float": "bots" } : {})}
      {...(id === "tutorial" ? { "data-tutorial-toggle": "" } : {})}
      {...(isSwitch ? { role: "switch", "aria-checked": switchOn } : { "aria-pressed": pressed === true })}
      aria-label={label}
      aria-disabled={disabled ? "true" : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        if (disabled) return;
        onPress(e.currentTarget);
      }}
    >
      <V2Icon name={icon} size={24} />
    </button>
  );
}
