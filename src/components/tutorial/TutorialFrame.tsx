import type { CSSProperties } from "react";
import { V2Icon } from "../v2/V2Icon";
import "../../styles/tutorial.css";

// 혼자 하기 튜토리얼의 틀(24-07, UI-SPEC P24-23~25·28, 시안 3-A): 아래쪽 묶음(진행 점 줄 + 간격 8 + 한 줄 알약)과 오른쪽 위 [그만두기]뿐이다.
// 사회자 띠·헤더·맵은 실제 게임 부품이 그리고, 이 틀은 그 위에 얹힌다. 새 토큰·색 없음(tutorial.css 는 토큰 변수만).
// 묶음 위치: aboveBottom = 아래 패널(또는 입력줄) 윗변 − 8 (bottomEdge = 화면 아랫변에서 그 윗변까지의 높이),
// bottom = 패널이 없는 장면의 화면 아랫변 − 24(안전 영역 포함), top = 모두의 기록 시트가 아래를 차지하는 장면 3 의 예외(띠 아랫변 B 123 + 8 = 131).

export type TutorialPlace = "aboveBottom" | "bottom" | "top";

/** 진행 점 수 = 장면 수 */
export const TUTORIAL_STEPS = 10;
/** place "top" 에서 묶음 윗변(띠 아랫변 B + 8) */
export const TUTORIAL_STACK_TOP = 131;

export interface TutorialFrameProps {
  /** 장면 번호 1..10 */
  step: number;
  /** 알약 문구. null 이면 알약을 그리지 않는다(장면 10) */
  pill: string | null;
  place: TutorialPlace;
  /** place "aboveBottom" 일 때, 화면 아랫변에서 아래 패널 윗변까지의 높이(px) */
  bottomEdge?: number;
  onExit(): void;
  /** true 면 [그만두기] 를 그리지 않는다(장면 10) */
  hideExit?: boolean;
}

function stackStyle(place: TutorialPlace, bottomEdge: number | undefined): CSSProperties {
  if (place === "top") return { top: TUTORIAL_STACK_TOP };
  if (place === "aboveBottom") return { bottom: (bottomEdge ?? 0) + 8 };
  return { bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" };
}

export function TutorialFrame({ step, pill, place, bottomEdge, onExit, hideExit }: TutorialFrameProps) {
  return (
    <>
      <div className="tut-stack" data-tutorial-stack="" data-place={place} style={stackStyle(place, bottomEdge)}>
        <div
          className="tut-dots"
          data-tutorial-dots=""
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TUTORIAL_STEPS}
          aria-valuenow={step}
          aria-label={`${TUTORIAL_STEPS}단계 중 ${step}단계`}
        >
          {Array.from({ length: TUTORIAL_STEPS }, (_, i) => (
            <i key={i} className={i < step ? "tut-dots__dot is-on" : "tut-dots__dot"} />
          ))}
        </div>
        {pill !== null ? (
          <div className="tut-pill" data-tutorial-pill="" role="status" aria-live="polite">
            <span key={pill} className="tut-pill__text">
              {pill}
            </span>
          </div>
        ) : null}
      </div>
      {hideExit === true ? null : (
        <button type="button" className="tut-exit" data-tutorial-exit="" aria-label="그만두기" onClick={onExit}>
          <V2Icon name="close" size={22} />
        </button>
      )}
    </>
  );
}
