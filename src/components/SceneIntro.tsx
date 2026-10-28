import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { SCENE_INTRO_MS } from "../game/scenes";
import type { SceneIntroDef } from "../game/scenes";
import "../styles/night.css";

export interface SceneIntroProps {
  /** 일차(서버 view.day.n). 문구는 이 값만 읽는다 — 역할·탈락 여부로 달라지지 않는다 */
  n: number;
  /** 단계 시작 문구 한 행(src/game/scenes.ts PHASE_INTRO) */
  intro: SceneIntroDef;
  /** 시간이 다 되면 부른다. 마운트 때 한 번만 건 타이머가 부른다(부모가 다시 그려도 리셋·연장되지 않는다) */
  onDone: () => void;
  /**
   * 마운트 뒤 이 시간(ms)이 지나서야 보이기 시작한다(기본 0 = 지금처럼 즉시). 그 전에는 아무것도 그리지 않는다. 처형 무효 카드(04-24, P-3)가 떠 있는 동안
   * 밤 시작 문구를 미뤄 두 문구가 겹치지 않게 한다. onDone 은 delayMs + SCENE_INTRO_MS 뒤다. 마운트 때 값을 한 번 읽는다(부모가 다시 그려도 타이머가 연장되지 않는다).
   */
  delayMs?: number;
}

// 밤·낮 시작 문구(결정 0028 → 0030): 'N일차 / 밤이 되었습니다', 'N일차 / 낮이 되었습니다 / 토론 전에 먼저 직업을 공개해요'.
// 한 부품이 두 장면에 쓰이고 구조가 같다(방사형 어두운 막 + 가운데 글자). 톤만 다르다.
// 테이블 장면(DayScene) 위의 클라이언트 오버레이라 터치를 막지 않고(pointer-events none) 읽기 도구에도 숨긴다 —
// 장면 제목(h1)과 겹치지 않도록 제목 요소를 쓰지 않는다. 낮 시작 알림은 RoomScreen 의 보이지 않는 live 영역이 읽는다.
// 퇴장 페이드는 마지막 300ms: 지연을 인라인 변수로 싣는다(MorningCard 와 같은 방식).
export function SceneIntro({ n, intro, onDone, delayMs = 0 }: SceneIntroProps): ReactElement | null {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const delayRef = useRef(Math.max(0, delayMs));
  const [shown, setShown] = useState(delayRef.current === 0);
  useEffect(() => {
    const delay = delayRef.current;
    // 지연이 있으면 보이기 시작하는 타이머가 하나 더 있다(지연 0 이면 지금과 같은 타이머 하나)
    const showId = delay > 0 ? setTimeout(() => setShown(true), delay) : undefined;
    const doneId = setTimeout(() => doneRef.current(), delay + SCENE_INTRO_MS);
    return () => {
      if (showId !== undefined) clearTimeout(showId);
      clearTimeout(doneId);
    };
  }, []);
  if (!shown) return null;
  return (
    <div
      className={`mf-sceneintro mf-sceneintro--${intro.tone}`}
      aria-hidden="true"
      style={{ "--mf-sceneintro-exit-delay": `${SCENE_INTRO_MS - 300}ms` } as CSSProperties}
    >
      <div className="mf-sceneintro__veil" />
      <div className="mf-sceneintro__center">
        <p className="mf-t-heading mf-sceneintro__count">{`${n}일차`}</p>
        <p className="mf-t-display mf-sceneintro__title">{intro.title}</p>
        {intro.sub ? <p className="mf-sceneintro__sub">{intro.sub}</p> : null}
      </div>
    </div>
  );
}
