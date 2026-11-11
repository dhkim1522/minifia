import { emitSignal } from "../../audio/signals";
import { V2Icon } from "./V2Icon";
import "../../styles/tutorialRoom.css";

// 방장 스위치 줄(17-07, TUT-02, 결정 0078-3·0080-1, 18.1-15 0083-3): 대기실 방장 패널의 기록 칸 위 한 줄, 높이 44.
// 줄 전체가 하나의 button(role="switch")이라 누르는 영역이 높이 44 전체다. 값은 화면 로컬 상태이고 서버에는 [시작] 메시지로만 간다.
// 시안의 페도라·붉은 목도리 실루엣은 새 에셋이 필요해 그리지 않고 play 아이콘 타일을 쓴다. 누르면 주요 버튼 소리(ui.tap) 신호 뒤 onToggle.

export interface TutorialToggleProps {
  on: boolean;
  /** 연결이 끊겨 보낼 수 없을 때 — 스위치도 눌리지 않고 재접속 띠가 덮는다 */
  disabled?: boolean;
  onToggle(): void;
}

export function TutorialToggle({ on, disabled = false, onToggle }: TutorialToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      className="tut-toggle"
      data-tutorial-toggle=""
      aria-checked={on}
      aria-label="튜토리얼 먼저"
      disabled={disabled}
      onClick={() => {
        emitSignal({ kind: "tap" });
        onToggle();
      }}
    >
      <span className="tut-toggle__tile" aria-hidden="true">
        <V2Icon name="play" size={20} />
      </span>
      <span className="tut-toggle__title">튜토리얼 먼저</span>
      <span className="tut-toggle__switch" data-on={on ? "true" : "false"} aria-hidden="true">
        <span className="tut-toggle__knob" />
      </span>
    </button>
  );
}
