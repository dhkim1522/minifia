import { emitSignal } from "../../audio/signals";
import "../../styles/tutorial.css";
import { V2Icon } from "./V2Icon";

// 첫 사건 화면의 [다음](17-04 T-5, 18-06 P18-6): 아래 가운데 알약 240×56(좁으면 화면 − 48), 글 '다음' + chevron 20, 면 night-700.
// 모양 강조는 포커스 테두리와 같은 4px 램프 빛 깜빡임 한 규칙이다(.tut-next 의 애니메이션, 시안의 그림자 맥박은 쓰지 않는다).
// 누르면 주요 버튼 소리(ui.tap)가 한 번 나고 콜백이 불린다.

export function TutorialNext({ onNext }: { onNext(): void }) {
  return (
    <button
      type="button"
      className="tut-next"
      data-tutorial-next=""
      aria-label="다음"
      onClick={() => {
        emitSignal({ kind: "tap" });
        onNext();
      }}
    >
      <span className="tut-next__label">다음</span>
      <V2Icon name="chevronRight" size={20} className="tut-next__ico" />
    </button>
  );
}
