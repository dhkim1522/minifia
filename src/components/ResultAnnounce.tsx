import "../styles/game.css";

export interface ResultAnnounceProps {
  /** 지금 띄울 알림 글자. 없으면(null) 아무것도 그리지 않는다 */
  text: string | null;
}

// 결과 알림(8페이즈, UI-SPEC "결과 알림"): 가운데 위 240 에 36px 한 줄. 뒤 맵을 night-950 62% 로 어둡게 한다. 모든 단계 공용 틀이다.
// 한 번에 하나다 — 새 알림은 이전 것을 바꾼다(부르는 쪽 useDayFx 가 하나의 글자만 넘기고, key 가 글자라 바뀔 때 등장 모션이 다시 돈다).
// 결과가 없으면 요소 자체를 만들지 않는다. 글자는 React 텍스트 노드로만 그린다(닉네임이 들어가므로 HTML 로 읽히지 않는다, T-08-33).
// 알림은 입력을 가로채지 않는다(맵 탭·이름표 버튼이 그대로 눌린다).
export function ResultAnnounce({ text }: ResultAnnounceProps) {
  if (text === null) return null;
  return (
    <div className="mf-announce" data-announce="" role="status">
      <span key={text} className="mf-announce__text">
        {text}
      </span>
    </div>
  );
}
