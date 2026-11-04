import "../../styles/v2.css";

// 인용 카드(09.1.1-15, UI-SPEC E-2): 확정된 한마디를 모두에게 알약 아래에 보인다. 누르는 대상이 아니다(pointer-events: none).
// 글은 서버가 정리해 공개한 값이고 React 텍스트 노드로만 그린다(HTML 주입 없음, T-09.1.1-44). 알약 role="status" 가 차례를 읽으므로 카드는 읽기 영역이 아니다.
// 보이는 동안만 `data-last-word` 표식이 있다. 사라질 때는 마지막 글을 남겨 dur-med 로 페이드 아웃한다(부르는 쪽 PickTurnBlock 이 글을 붙잡는다).

export interface QuoteCardProps {
  /** 화면에 그릴 글(사라지는 동안은 마지막 글) */
  text: string;
  /** 지금 보이는가. false 면 페이드 아웃 상태(표식 없음, 스크린리더 숨김) */
  visible: boolean;
  /** 처음부터 보이던 카드(재접속 첫 화면)는 등장 모션 없이 바로 보인다 */
  still?: boolean;
}

export function QuoteCard({ text, visible, still = false }: QuoteCardProps) {
  return (
    <p className={visible ? (still ? "mv-quote is-on is-still" : "mv-quote is-on") : "mv-quote"} {...(visible ? { "data-last-word": "" } : { "aria-hidden": true })}>
      {text}
    </p>
  );
}
