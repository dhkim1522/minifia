import "../../styles/v2.css";
import { emitSignal } from "../../audio/signals";
import { V2Icon } from "./V2Icon";

// 찬반(VerdictPicker). design/v2.0/design-system/components/bundle.js 의 VerdictPicker 와 bundle.css 158-163 을 React 19 로 옮겼다(승인 2026-10-31).
// 엄지 위(찬성)·아래(반대) 큰 버튼 두 개. 마감 전까지 바꿀 수 있어 고른 쪽을 다시 눌러도 그대로 onChange 를 부른다(판단은 부르는 쪽).
// 찬반 화면은 역할마다 같아야 한다 — 색은 면 대비(night-700 ↔ gray-100)뿐이고 역할 색을 쓰지 않는다(UI Considerations E4).
// 변론자는 투표하지 않는다: 그 화면에서는 이 부품을 두지 않는다(부르는 쪽 분기).
//
// 버튼 mousedown 의 기본 동작을 막아 채팅 입력칸의 포커스를 뺏지 않는다(7페이즈 보내기 버튼과 같은 이유).
// 글자는 React 텍스트 노드로만 그린다(innerHTML 없음, T-08-09).

export type Verdict = "yes" | "no";

export interface VerdictPickerProps {
  /** 고른 쪽. 아직 안 골랐으면 없음 */
  value?: Verdict;
  onChange: (v: Verdict) => void;
  disabled?: boolean;
  /** 빛남(14-04): 아직 안 골랐을 때 두 단추가 함께 빛난다. 부르는 쪽이 쓰면 끈다. data-call 은 값 없는 표식 */
  call?: boolean;
}

const VERDICT_TEXT = { group: "찬반", yes: "찬성", no: "반대" } as const;

export function VerdictPicker({ value, onChange, disabled, call }: VerdictPickerProps) {
  const button = (v: Verdict) => (
    <button
      type="button"
      className={["mv-verdict__btn", value === v && "is-on", call && "is-call"].filter(Boolean).join(" ")}
      data-verdict={v}
      data-call={call ? "" : undefined}
      aria-pressed={value === v}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        emitSignal({ kind: "vote" }); // 값 없는 신호: 찬성·반대가 같은 소리다(LS-7). 소리 id 는 감독이 정한다
        onChange(v);
      }}
    >
      <V2Icon name={v === "yes" ? "thumbUp" : "thumbDown"} size={32} />
      <span>{VERDICT_TEXT[v]}</span>
    </button>
  );
  return (
    <div className="mv-verdict" role="group" aria-label={VERDICT_TEXT.group}>
      {button("yes")}
      {button("no")}
    </div>
  );
}
