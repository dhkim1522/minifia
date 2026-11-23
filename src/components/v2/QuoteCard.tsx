import { useEffect, useRef, useState } from "react";
import "../../styles/v2.css";

// 인용 카드(09.1.1-15, UI-SPEC E-2): 확정된 한마디를 모두에게 알약 아래에 보인다. 누르는 대상이 아니다(pointer-events: none).
// 글은 서버가 정리해 공개한 값이고 React 텍스트 노드로만 그린다(HTML 주입 없음, T-09.1.1-44, T-22-28). 알약 role="status" 가 차례를 읽으므로 카드는 읽기 영역이 아니다.
// 보이는 동안만 `data-last-word` 표식이 있다. 사라질 때는 마지막 글을 남겨 dur-med 로 페이드 아웃한다(부르는 쪽 PickTurnBlock 이 글을 붙잡는다).
// 유언 공개 카드(22-12 P22-11, will): 규격 높이 안에서 긴 본문만 스크롤한다(처형 알림 앞 3.0초).

export interface QuoteCardProps {
  /** 화면에 그릴 글(사라지는 동안은 마지막 글) */
  text: string;
  /** 지금 보이는가. false 면 페이드 아웃 상태(표식 없음, 스크린리더 숨김) */
  visible: boolean;
  /** 처음부터 보이던 카드(재접속 첫 화면)는 등장 모션 없이 바로 보인다 */
  still?: boolean;
  /** 유언 공개 카드(처형 단계 0~3.0초), 표식 data-will-reveal */
  will?: boolean;
  announce?: boolean;
}

export function QuoteCard({ text, visible, still = false, will = false, announce = true }: QuoteCardProps) {
  const body = useRef<HTMLSpanElement>(null);
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const region = body.current;
    if (!visible || region === null) return;
    const measure = () => setScrollable(region.scrollHeight > region.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    if (region.firstElementChild) observer.observe(region.firstElementChild);
    return () => observer.disconnect();
  }, [text, visible, will]);

  const base = will ? "mv-quote mv-quote--will" : "mv-quote";
  const className = visible ? (still ? `${base} is-on is-still` : `${base} is-on`) : base;
  const mark = will ? { "data-will-reveal": "", role: announce ? "status" : undefined } : { "data-last-word": "" };
  return (
    <p className={className} {...(visible ? mark : { "aria-hidden": true })}>
      {will ? (
        <span ref={body} className="mv-quote__will-text" data-will-scroll={visible && scrollable ? "" : undefined}
          tabIndex={visible && scrollable ? 0 : undefined} role={visible && scrollable ? "region" : undefined}
          aria-label={visible && scrollable ? "유언 본문" : undefined}>
          <span data-will-quote-text="">{text}</span>
        </span>
      ) : text}
    </p>
  );
}
