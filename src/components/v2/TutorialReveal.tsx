import "../../styles/tutorial.css";
import { faceSrc } from "../../net/assets";
import { V2Icon } from "./V2Icon";

// 첫 사건 장면 6 의 처형 결과(17-05 → 21-15, 결정 0078-1.4·0081-5, UI-SPEC 튜토리얼 화면 변경 표 6행): --scrim 막 위에 처형된 사람의 얼굴 카드가 나타난다.
// 정체 카드는 뒤집지 않는다 — 처형된 사람의 정체는 판이 끝날 때까지 비공개(D-20)라 직업 그림·"마피아"·정답 도장·불꽃이 없고, 얼굴 + "{이름} 님" + "처형" + 잠금 아이콘뿐이다.
// "정체는 판이 끝나야 알아요" 는 이 카드가 아니라 사회자 띠(자막)가 말한다. 이름·좌석은 호출한 쪽이 준 출연 상수이고 실제 방의 view·역할을 읽지 않는다(T-17-12, 정적 가드).
// 진홍은 이 부품의 "처형" 글자(.tut-reveal 선택자)에만 쓴다(T-18). 잠금 아이콘·얼굴 그림은 장식이라 읽히지 않는다. 이름은 React 텍스트 노드로만 그린다.
export function TutorialReveal({ name, seat }: { name: string; seat: number }) {
  return (
    <div className="tut-reveal" data-tutorial-reveal="">
      <div className="tut-reveal__stage">
        <div className="tut-reveal__card">
          <img className="tut-reveal__art" src={faceSrc(seat)} alt="" width={144} height={144} />
          <span className="tut-reveal__lock" aria-hidden="true">
            <V2Icon name="lock" size={22} />
          </span>
          <p className="tut-reveal__who">{`${name} 님`}</p>
          <p className="tut-reveal__title">처형</p>
        </div>
      </div>
    </div>
  );
}
