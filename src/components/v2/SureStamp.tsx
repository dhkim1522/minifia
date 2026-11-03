import "../../styles/v2.css";

// 유력 도장(SureStamp). design/v2.0/design-system/components/bundle.js 의 SureStamp 와 bundle.css 47 을 React 19 로 옮겼다(승인 2026-10-31).
// 과반 표를 받은 사람 머리 위에 "유력" 한 단어를 찍는다(결정 0049). 속성이 없다 — 켜는 판단(과반)은 부르는 쪽이 한다.
// 같은 순간의 실내등·카메라 연출은 장면 쪽 몫이다(이 부품은 도장 하나만).
// label 로 글자를 바꿀 수 있다 — 밤 마피아 화면은 전원 일치를 "확정" 으로 찍는다(9페이즈, 결정 0061-7). 없으면 "유력".

const SURE_TEXT = "유력";

export interface SureStampProps {
  /** 도장 글자. 없으면 "유력" */
  label?: string;
}

export function SureStamp({ label = SURE_TEXT }: SureStampProps) {
  return <span className="mv-stamp">{label}</span>;
}
