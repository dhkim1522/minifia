import { emitSignal } from "../../audio/signals";
import { useTutorialWarm } from "../../net/useTutorialWarm";
import "../../styles/tutorialEntry.css";

// 혼자 하기 마무리 카드(17-06, 장면 8, T-1, UI-SPEC "첫 화면 진입 계약"): 끝까지 본 사람이 첫 화면으로 돌아오면 큰 카드 자리에 뜬다.
// 글은 두 줄(고정 문구)과 [다시 보기] 하나. 마운트 때 따뜻한 조명 소리(tut.warm)가 한 번 난다(호출은 useTutorialWarm 훅, 컴포넌트는 엔진 play 를 직접 부르지 않는 규칙). [다시 보기]는 주요 버튼 소리(ui.tap) 뒤 onReplay.

export function TutorialEndCard({ onReplay }: { onReplay(): void }) {
  useTutorialWarm();

  return (
    <div className="tut-end" data-tutorial-end="">
      <div className="tut-end__text">
        <p className="tut-end__title">이제 진짜 사건으로</p>
        <p className="tut-end__sub mf-t-label">목격과 흔적으로 거짓말을 잡아요</p>
      </div>
      <button
        type="button"
        className="tut-end__replay"
        data-tutorial-replay=""
        aria-label="다시 보기"
        onClick={() => {
          emitSignal({ kind: "tap" });
          onReplay();
        }}
      >
        다시 보기
      </button>
    </div>
  );
}
