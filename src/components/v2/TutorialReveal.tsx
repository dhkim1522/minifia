import type { CSSProperties } from "react";
import "../../styles/tutorial.css";
import { roleArtSrc } from "../../net/assets";
import { useReducedMotion } from "../../net/useReducedMotion";
import { V2Icon } from "./V2Icon";

// 첫 사건 장면 6 의 정체 공개(17-05, 결정 0078-1.4, UI-SPEC "정체 공개"): --scrim 막 위에서 카드가 뒤집히고(마피아 그림·"{이름} 님은"·"마피아"),
// 도장 "정답"이 찍히고, 놋쇠 불꽃 점 14개가 카드 중심에서 퍼지고, 아래에 "눈 + 흔적 로 찾아냈어요" 한 줄이 떠오른다. 애니메이션은 transform·opacity 뿐이다(tutorial.css).
// 이름·그림은 호출한 쪽이 준 출연 상수와 고정 그림(roleArtSrc("mafia"))이다 — 실제 방의 view·역할을 읽지 않는다(T-17-12, 정적 가드).
// 진홍은 이 부품의 "마피아" 이름·후광(.tut-reveal 선택자)에만 쓴다(T-18). 모션 줄이기면 뒤집기·불꽃·도장 흔들림 없이 완성된 모습이 바로 보인다.
// 불꽃·도장·선 아이콘 줄은 장식이라 읽히지 않는다(aria-hidden). 이름은 React 텍스트 노드로만 그린다.

/** 불꽃 점 수와 반지름 순환(120/150/180) */
const SPARKS = 14;
const SPARK_RADII = [120, 150, 180] as const;

/** 불꽃 i 가 퍼지는 끝점(px) — 카드 중심에서 14등분한 방향, 반지름은 세 값을 돈다 */
function sparkStyle(i: number): CSSProperties {
  const angle = (i / SPARKS) * Math.PI * 2;
  const r = SPARK_RADII[i % SPARK_RADII.length]!;
  return { "--tut-spark-x": `${Math.round(Math.cos(angle) * r)}px`, "--tut-spark-y": `${Math.round(Math.sin(angle) * r)}px` } as CSSProperties;
}

export function TutorialReveal({ name }: { name: string }) {
  const reduced = useReducedMotion();
  const art = roleArtSrc("mafia");
  return (
    <div className="tut-reveal" data-tutorial-reveal="">
      <div className="tut-reveal__stage">
        <div className={reduced ? "tut-reveal__card" : "tut-reveal__card is-flip"}>
          <img className="tut-reveal__art" src={art.src} srcSet={art.srcSet} alt="" width={144} height={192} />
          <p className="tut-reveal__who">{`${name} 님은`}</p>
          <p className="tut-reveal__title">마피아</p>
          <span className={reduced ? "tut-reveal__stamp" : "tut-reveal__stamp is-pop"} aria-hidden="true">
            정답
          </span>
          {reduced ? null : (
            <span className="tut-reveal__sparks" aria-hidden="true">
              {Array.from({ length: SPARKS }, (_, i) => (
                <i key={i} className={i % 2 === 0 ? "tut-reveal__spark" : "tut-reveal__spark is-lamp"} style={sparkStyle(i)} />
              ))}
            </span>
          )}
        </div>
        <p className={reduced ? "tut-reveal__line" : "tut-reveal__line is-rise"}>
          <span className="tut-reveal__icons" aria-hidden="true">
            <V2Icon name="eye" size={24} />
            <b>+</b>
            <V2Icon name="thread" size={24} />
          </span>
          <span>로 찾아냈어요</span>
        </p>
      </div>
    </div>
  );
}
