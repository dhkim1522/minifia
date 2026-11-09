import { unlockAudio } from "../../audio/unlock";
import { outfitCardSrc } from "../../net/assets";
import "../../styles/tutorialEntry.css";
import { V2Icon } from "./V2Icon";

// 첫 화면의 튜토리얼 진입(17-06, SC-1, UI-SPEC "첫 화면 진입 계약", 결정 0078-3·9 A).
// 처음 오는 사람에게는 큰 카드(높이 84, 놋쇠 숨 쉬는 번짐), 한 번 본 사람에게는 같은 자리의 작은 단추(높이 44, 번짐 없음).
// 둘 다 접근성 이름은 "튜토리얼 진행" 하나이고 안에 따로 누를 것이 없다. 카드는 흐름 안에 놓여 키보드가 열려도 함께 스크롤된다.

export interface TutorialEntryProps {
  /** 이 브라우저에서 튜토리얼을 시작했거나 방에 들어간 적이 있으면 참 → 작은 단추 */
  seen: boolean;
  onStart(): void;
}

export function TutorialEntry({ seen, onStart }: TutorialEntryProps) {
  // 제스처 처리기 맨 앞에서 동기로 소리를 깨운다(Home 의 다른 단추와 같은 규칙, D-7). 실패해도 튜토리얼은 진행한다(unlockAudio 가 삼킨다).
  function handleClick() {
    unlockAudio();
    onStart();
  }

  if (seen) {
    return (
      <button type="button" className="tut-entry tut-entry--button" data-tutorial-entry="button" aria-label="튜토리얼 진행" onClick={handleClick}>
        <V2Icon name="play" size={16} />
        <span className="tut-entry__small">튜토리얼 진행</span>
      </button>
    );
  }

  return (
    <button type="button" className="tut-entry tut-entry--card" data-tutorial-entry="card" aria-label="튜토리얼 진행" onClick={handleClick}>
      <img className="tut-entry__figure" src={outfitCardSrc("noir")} width={48} height={60} alt="" draggable={false} />
      <span className="tut-entry__text">
        <span className="tut-entry__eyebrow mf-t-label">처음이에요?</span>
        <span className="tut-entry__title mf-t-heading">튜토리얼 진행</span>
      </span>
      <span className="tut-entry__pill mf-t-label">1분</span>
    </button>
  );
}
