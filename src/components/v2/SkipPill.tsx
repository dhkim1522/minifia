import "../../styles/v2.css";
import { V2Icon } from "./V2Icon";

// [건너뛰기] 알약(21페이즈 D-23, UI-SPEC P21-13): 원인 흐름 저녁·아침의 산 사람에게만 아래 패널 오른쪽 끝에 놓인다. 폭 104·높이 48·테두리 1 gray-300·투명 면 — 금빛이 아니다(할 일을 알리는 빛이 아니라 "다 했음" 을 누르는 단추).
// 안 눌렀을 때 = 아이콘 skip 16 + "건너뛰기". 누르면 check + 누른 수 "n/N"(tabular-nums)·aria-pressed true, 한 번 더 누르면 취소(토론 끝내기 단추와 같은 토글).
// 공개 값은 누른 수 n 과 산 사람 수 N 뿐이다 — 누가 눌렀는지는 view 에 없다(D-21). 순수 표시이고 전송·낙관 눌림은 쓰는 쪽(GamePanel 의 SkipSlot)이 한다.
// 마피아도 시민과 같은 마크업이다: 역할·좌석 prop 이 없다. 버튼은 mousedown 의 기본 동작을 막아 입력칸의 포커스(키보드)를 뺏지 않는다.

export interface SkipPillProps {
  /** 건너뛰기를 누른 산 사람 수(day.skipCount) */
  count: number;
  /** 산 사람 수 */
  total: number;
  /** 내가 눌러 둔 상태 */
  pressed: boolean;
  /** 눌렀다: 새 상태(눌렀으면 true, 취소면 false) */
  onToggle: (on: boolean) => void;
  /** 연결이 끊겨 보낼 수 없다: aria-disabled 이고 눌러도 부르지 않는다 */
  disabled?: boolean;
}

export function SkipPill({ count, total, pressed, onToggle, disabled }: SkipPillProps) {
  const n = `${count}/${total}`;
  return (
    <button
      type="button"
      className="mv-skip"
      data-skip=""
      data-skip-count={n}
      aria-pressed={pressed}
      aria-label={`건너뛰기, 누른 사람 ${count}명 중 ${total}명`}
      aria-disabled={disabled === true ? "true" : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (disabled === true) return;
        onToggle(!pressed);
      }}
    >
      {pressed ? (
        <>
          <V2Icon name="check" size={16} />
          <span className="mv-skip__count">{n}</span>
        </>
      ) : (
        <>
          <V2Icon name="skip" size={16} />
          <span className="mv-skip__label">건너뛰기</span>
        </>
      )}
    </button>
  );
}
