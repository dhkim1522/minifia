import "../../styles/tutorial.css";
import { TUTORIAL_LINES, TUTORIAL_PICK } from "../../game/tutorialScript";
import { useReducedMotion } from "../../net/useReducedMotion";
import { Diamond } from "../RoleCard";
import { V2Icon } from "./V2Icon";

// 첫 사건 장면 6 의 정체 카드(17-05 의 정체 공개를 21-12 가 바꿨다, 결정 D-20·D-28, UI-SPEC 튜토리얼 표 6행): 처형은 되지만 정체는 판이 끝나야 안다 — 카드는 **뒤집히지 않는다**.
// --scrim 막 위에 카드 뒷면(역할 카드 뒷면 마름모) + lock 아이콘, 카드 오른쪽 위에 도장 "처형"이 찍히고, 아래에 "정체는 판이 끝나야 알아요"(Body 16/700 brass-200) 한 줄이 있다.
// 직업 이름·직업 그림·불꽃 점·"정답"·팡파르가 없다(정체를 미리 보여 주면 실제 판의 규칙과 달라진다). 줄 문구는 대본(TUTORIAL_LINES)의 tutorial.hidden 한 곳에서 읽는다.
// 이름은 접근성 이름에만 쓴다(출연 상수, React 속성 문자열). 실제 방의 view·역할을 읽지 않는다(T-17-12, 정적 가드). 애니메이션은 transform·opacity 뿐(tutorial.css).
// 모션 줄이기면 도장이 제자리에서 바로 보인다. 도장·자물쇠 아이콘은 장식이라 읽히지 않는다(aria-hidden).

export function TutorialReveal({ name }: { name: string }) {
  const reduced = useReducedMotion();
  return (
    <div className="tut-reveal" data-tutorial-reveal="">
      <div className="tut-reveal__stage">
        <div className="tut-reveal__card" role="group" aria-label={`${name} 님의 정체 카드, 뒷면`}>
          <div className="tut-reveal__back" aria-hidden="true">
            <Diamond />
          </div>
          <span className="tut-reveal__lock" data-reveal-lock="" aria-hidden="true">
            <V2Icon name="lock" size={32} />
          </span>
          <span className={reduced ? "tut-reveal__stamp" : "tut-reveal__stamp is-pop"} aria-hidden="true">
            처형
          </span>
        </div>
        <p className={reduced ? "tut-reveal__line" : "tut-reveal__line is-rise"} data-reveal-hidden="">
          {TUTORIAL_LINES[TUTORIAL_PICK.reveal.line]}
        </p>
      </div>
    </div>
  );
}
