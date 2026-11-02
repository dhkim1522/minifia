import "../../styles/v2.css";

// 유력 도장(SureStamp). design/v2.0/design-system/components/bundle.js 의 SureStamp 와 bundle.css 47 을 React 19 로 옮겼다(승인 2026-10-31).
// 과반 표를 받은 사람 머리 위에 "유력" 한 단어를 찍는다(결정 0049). 속성이 없다 — 켜는 판단(과반)은 부르는 쪽이 한다.
// 같은 순간의 실내등·카메라 연출은 장면 쪽 몫이다(이 부품은 도장 하나만).

const SURE_TEXT = "유력";

export function SureStamp() {
  return <span className="mv-stamp">{SURE_TEXT}</span>;
}
