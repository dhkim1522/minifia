import "../../styles/v2.css";
import { READY_TEXT } from "../../game/resultText";
import { V2Icon } from "./V2Icon";

// 다시 하기 알약 (11-12, 결정 D-11·D-12, UI-SPEC D-1·G): 입력줄 오른쪽 끝 96×48 한 개. 순수 표시다 — 상태·잠금·시작 확인은 useReady 가 쥔다.
// 손님 = check 20 + '준비' 14px 700. 켜지면 '준비됨'·눌린 상태(안쪽 테두리 2px gray-100)·aria-pressed true, 접근성 '준비됨, 눌러서 취소'.
// 방장 = 두 줄(위 '시작', 아래 'n / m' 14px, 줄 높이 20 × 2 = 40 ≤ 48). n 이 최소 인원 미만이면 흐림(dim) — aria-disabled 이지만 탭은 토스트를 부르러 onPress 로 간다.
// 승리 조명 전(inactive)은 흐림이고 눌러도 아무 일 없다. 사용자 문자열은 받지 않는다(숫자뿐).
// 버튼은 mousedown 의 기본 동작을 막아 입력칸의 포커스(키보드)를 뺏지 않는다.

export interface ReadyPillProps {
  /** 방장 모양(두 줄 [시작] + n / m) */
  host: boolean;
  /** 손님: 내가 준비했다 */
  on?: boolean;
  /** 방장: 준비한 연결된 사람 수 */
  n?: number;
  /** 방장: 연결된 사람 수 */
  m?: number;
  /** 방장: n 이 최소 인원 미만이라 흐림. 탭은 여전히 onPress 를 부른다(토스트) */
  dim?: boolean;
  /** 승리 조명 전이라 비활성. 눌러도 아무 일 없다 */
  inactive?: boolean;
  onPress(): void;
}

export function ReadyPill({ host, on, n = 0, m = 0, dim, inactive, onPress }: ReadyPillProps) {
  const off = inactive === true;
  const disabled = off || (host && dim === true);
  const cls = ["mv-ready", host ? "is-host" : "is-guest", !host && on && "is-on", disabled && "is-dim"].filter(Boolean).join(" ");
  const common = {
    type: "button" as const,
    className: cls,
    "data-ready-pill": "",
    "aria-disabled": disabled ? ("true" as const) : undefined,
    // 승리 조명 전 비활성만 따로 표시한다 — 방장 흐림(n < 최소)도 aria-disabled 라 E2E 가 둘을 가르는 데 쓴다
    ...(off ? { "data-inactive": "true" } : {}),
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (off) return;
      onPress();
    },
  };
  if (host) {
    return (
      <button {...common} data-ready-count={`${n}/${m}`} {...(dim ? { "data-dim": "true" } : {})} aria-label={READY_TEXT.startLabel(n)}>
        <span className="mv-ready__label">{READY_TEXT.start}</span>
        <span className="mv-ready__count">{`${n} / ${m}`}</span>
      </button>
    );
  }
  return (
    <button {...common} data-ready={on ? "true" : "false"} aria-pressed={on ? "true" : "false"} {...(on ? { "aria-label": READY_TEXT.readyOnLabel } : {})}>
      <V2Icon name="check" size={20} />
      <span className="mv-ready__label">{on ? READY_TEXT.readyOn : READY_TEXT.ready}</span>
    </button>
  );
}
