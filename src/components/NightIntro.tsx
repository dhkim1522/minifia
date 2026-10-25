import { useEffect, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { DAY_ANNOUNCE_MS } from "../../shared/game/phases";
import "../styles/night.css";

/** 밤 시작 문구가 떠 있는 시간. 낮 시작 발표(DAY_ANNOUNCE_MS)와 한 곳에서 같다 */
export const NIGHT_INTRO_MS = DAY_ANNOUNCE_MS;

export interface NightIntroProps {
  /** 일차(서버 view.day.n). 문구는 이 값만 읽는다 — 역할·탈락 여부로 달라지지 않는다 */
  n: number;
  /** 시간이 다 되면 부른다. 마운트 때 한 번만 건 타이머가 부른다(부모가 다시 그려도 리셋·연장되지 않는다) */
  onDone: () => void;
}

// 밤 시작 문구(결정 0028): 'N일차 / 밤이 되었습니다'. 낮 시작 발표(S-06a)와 같은 길이·번짐.
// 밤에는 서버 단계가 따로 없어 DayScene 안의 클라이언트 오버레이다. 터치를 막지 않고(pointer-events none) 읽기 도구에도 숨긴다 —
// 장면 제목(h1 '밤')과 겹치지 않도록 제목 요소를 쓰지 않는다.
// 퇴장 페이드는 마지막 300ms: 지연을 인라인 변수로 싣는다(MorningCard 와 같은 방식).
export function NightIntro({ n, onDone }: NightIntroProps): ReactElement {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => doneRef.current(), NIGHT_INTRO_MS);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="mf-nightintro" aria-hidden="true" style={{ "--mf-nightintro-exit-delay": `${NIGHT_INTRO_MS - 300}ms` } as CSSProperties}>
      <div className="mf-nightintro__veil" />
      <div className="mf-nightintro__center">
        <p className="mf-t-heading mf-nightintro__count">{`${n}일차`}</p>
        <p className="mf-t-display mf-nightintro__title">밤이 되었습니다</p>
      </div>
    </div>
  );
}
