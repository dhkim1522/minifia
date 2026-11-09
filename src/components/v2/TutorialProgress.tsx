import { emitSignal } from "../../audio/signals";
import { TUTORIAL_DOT_COUNT } from "../../game/tutorialScript";
import "../../styles/tutorial.css";

// 첫 사건 화면의 위 줄(17-04, T-16·T-23, 시안 Main.dc.html "튜토리얼 위 줄"): 진행 점 7개 + [건너뛰기]. 화면 위 12, 가운데, 높이 32 알약.
// 점은 장면 1~7 을 센다(끝낸 brass-400 · 현재 light-lamp 20×8 · 남은 gray-500). 점 줄은 누를 수 없고 role="img" 하나로 읽힌다.
// [건너뛰기] 의 누르는 영역은 알약 밖으로 투명하게 44×44 이상 늘린다(.tut-skip::before). 확인 문구는 없다.
// 장면 8(마무리 카드)에는 점 줄이 없다 — 이 부품도 그리지 않는다.

export interface TutorialProgressProps {
  /** 지금 장면 번호(1~8) */
  scene: number;
  onSkip(): void;
}

export function TutorialProgress({ scene, onSkip }: TutorialProgressProps) {
  if (scene > TUTORIAL_DOT_COUNT) return null;
  return (
    <div className="tut-progress" data-tutorial-progress="">
      <div className="tut-dots" role="img" aria-label={`${TUTORIAL_DOT_COUNT}단계 중 ${scene}단계`}>
        {Array.from({ length: TUTORIAL_DOT_COUNT }, (_, i) => (
          <span key={i} className="tut-dot" data-state={i + 1 < scene ? "done" : i + 1 === scene ? "now" : "todo"} />
        ))}
      </div>
      <button
        type="button"
        className="tut-skip"
        data-tutorial-skip=""
        aria-label="건너뛰기"
        onClick={() => {
          emitSignal({ kind: "tap" });
          onSkip();
        }}
      >
        건너뛰기
      </button>
    </div>
  );
}
