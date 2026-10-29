import { useEffect, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { EXEC_INTRO_MS, VERDICT_TEXT, introCardGeometry } from "../game/verdict";
import "../styles/verdict.css";

export interface ExecIntroCardProps {
  /** DayTable 의 layer 슬롯이 주는 장면 크기. 위치는 여기서 dayTableGeometry 로만 얻는다(pad 는 cy 에 영향이 없어 선택) */
  layout: { sceneW: number; sceneH: number; pad?: number };
  /** 3초(EXEC_INTRO_MS)가 지나면 부른다. 마운트 때 한 번만 건 타이머가 부른다(부모가 다시 그려도 리셋·연장되지 않는다) */
  onDone: () => void;
}

// 처형 투표 인트로 카드(04-24, UI-SPEC 9.1, D-23·D-30): 앰버 카드가 위에서 떨어져 가운데에 서고, 카드 면이 지워지며 질문이 24px 로 다시 강조되고
// 반투명 아래 화살표(셰브런)가 하단 [찬성][반대]를 가리킨 뒤 3초(EXEC_INTRO_MS, 결정 0039)에 흔적 없이 사라진다. 코드(CSS+SVG)라 그림 요청이 없다.
// 클라이언트 연출일 뿐이라 서버 시간을 깎지 않고, 모든 층이 터치를 통과시키며(pointer-events none) 읽기 도구에는 숨긴다(읽기는 하단·단계 안내가 한다).
// 입력이 없다: 문구는 VERDICT_TEXT 에서만 오고 view 의 역할·표를 읽지 않는다. 시각표는 verdict.css 의 mf-vintro 구역(키프레임 이름 mf-vi-*).
export function ExecIntroCard({ layout, onDone }: ExecIntroCardProps): ReactElement {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => doneRef.current(), EXEC_INTRO_MS);
    return () => clearTimeout(id);
  }, []);
  const { top, chevH } = introCardGeometry(layout.sceneW, layout.sceneH, layout.pad);
  return (
    <div className="mf-vintro mf-vintro--intro" aria-hidden="true">
      <div className="mf-vintro__veil" />
      <div className="mf-vintro__drop" style={{ top: `${top}px` }}>
        <div className="mf-vintro__smear" />
        <div className="mf-vintro__glow" />
        <div className="mf-vintro__face">
          <svg className="mf-vintro__ln" viewBox="0 0 150 10" aria-hidden="true">
            <path className="mf-vintro__ln-line" d="M0 5H62M88 5H150" />
            <path className="mf-vintro__ln-dia" d="M75 0L81 5L75 10L69 5Z" />
          </svg>
        </div>
        <div className="mf-vintro__body">
          <p className="mf-vintro__title">{VERDICT_TEXT.execIntroCardTitle}</p>
          {/* 작은 질문과 큰 질문을 겹쳐 놓고 교차 페이드한다(크기 14 → 24 를 흐리지 않고 선명하게) */}
          <div className="mf-vintro__q">
            <p className="mf-vintro__q-small">{VERDICT_TEXT.execTitle}</p>
            <p className="mf-vintro__q-big">{VERDICT_TEXT.execTitle}</p>
          </div>
        </div>
      </div>
      <div className="mf-vintro__chevs" style={{ height: `${chevH}px` }}>
        <svg viewBox="0 0 120 230" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          {[
            { d: "M20 20L60 56L100 20", o: 0.18 },
            { d: "M20 80L60 116L100 80", o: 0.38 },
            { d: "M20 140L60 176L100 140", o: 0.62 },
          ].map(({ d, o }, i) => (
            <path key={d} className="mf-vintro__chev" d={d} strokeOpacity={o} style={{ "--mf-vi-i": i } as CSSProperties} />
          ))}
        </svg>
      </div>
    </div>
  );
}
