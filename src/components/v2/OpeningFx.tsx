import { useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/tutorial.css";
import { OPENING_LAMPS, TUTORIAL_CAST } from "../../game/tutorialScript";
import { useReducedMotion } from "../../net/useReducedMotion";

// 첫 사건 장면 1 오프닝 연출 층(17-08, 결정 0078-1.1·0080-9, UI-SPEC 첫 사건 장면 계약 1행): 실제 3D 광장(WorldStage) 위에 얹는다.
// 램프 번짐 어둠 둘이 0.8·1.3초에 켜지고, 전체 어둠(night-950)이 0.4초부터 2.2초 동안 0 → .9, 2.6초에 진홍 번쩍임(1회 1.4초, 정점 .6 이하)과 소리 링 셋(0.25초 간격)이
// 서연 자리에서 퍼지며 서연이 사라지고(그 시각의 무대 모양은 화면이 tutorialStageLook 으로 바꾼다), 3.3초에 밤 조명 장면이 dur-slow 로 드러난다. 제목 "밤이 되었습니다"가 0.3초부터 떠오른다.
// 시각은 모두 장면 시계(무대 준비 뒤)에서 잰다 — 이 층은 무대가 준비된 뒤에 마운트되므로 CSS 시간표와 대본 시계가 같은 때 시작한다.
// 모두 장식이다(aria-hidden, 눌림을 가로채지 않음). 진홍은 .tut-opening 선택자(번쩍임·링)에만 있다(T-18). 새 글은 제목 한 줄뿐이고 장면 이름은 진행 점이 알린다.
// 모션 줄이기: 번쩍임·소리 링·램프 번짐 없이 어둠이 정지한 채 있다가 3.3초에 바로 걷힌다(밤 조명으로 바로 바뀐다). 애니메이션은 transform·opacity 뿐이다(tutorial.css).
// 실제 방의 view·역할을 읽지 않는다 — 서연 자리는 출연 상수(TUTORIAL_CAST.victim)의 이름표 DOM 사각형으로만 잰다.

/** 번쩍임·링 중심(오버레이 안 px). 못 쟀으면 시안 비율(15%·70%)을 쓴다 */
export interface VictimAt {
  x: number;
  y: number;
}

/** 램프 번짐 시각(ms): 0.8초부터 0.5초 간격 — tutorialScript 의 LAMP_BEATS(tut.lampOff)와 같은 값이다 */
const LAMP_FIRST_MS = 800;
const LAMP_GAP_MS = 500;
/** 번쩍임 시작과 소리 링 간격(ms) */
const FLASH_AT_MS = 2600;
const RING_GAP_MS = 250;
const RINGS = 3;

const SCREEN = "[data-tutorial-screen]";

/** 서연 이름표 중심(화면 루트 안 px)을 매 프레임 재서 바뀔 때만 상태를 바꾼다. 한 번 쟀으면 이름표가 사라져도 마지막 값을 쓴다 */
export function useVictimAt(): VictimAt | null {
  const [at, setAt] = useState<VictimAt | null>(null);
  useLayoutEffect(() => {
    const tick = (): void => {
      const root = document.querySelector(SCREEN);
      const tag = root?.querySelector(`.mf-world__tag[data-seat="${TUTORIAL_CAST.victim}"]`);
      if (root === null || root === undefined || tag === null || tag === undefined) return;
      const r = tag.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const o = root.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2 - o.left);
      const y = Math.round(r.top + r.height / 2 - o.top);
      setAt((prev) => (prev !== null && prev.x === x && prev.y === y ? prev : { x, y }));
    };
    tick();
    let raf = 0;
    const loop = (): void => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return at;
}

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

export function OpeningFx({ victimAt }: { victimAt: VictimAt | null }) {
  const reduced = useReducedMotion();
  const center = { "--tut-victim-x": victimAt === null ? "15%" : `${victimAt.x}px`, "--tut-victim-y": victimAt === null ? "70%" : `${victimAt.y}px` } as CSSProperties;
  return (
    <div className="tut-opening" data-tutorial-opening="" aria-hidden="true">
      {reduced
        ? null
        : Array.from({ length: OPENING_LAMPS }, (_, i) => (
            <span key={i} className={i % 2 === 0 ? "tut-opening__lamp is-left" : "tut-opening__lamp is-right"} data-opening-lamp="" style={delay(LAMP_FIRST_MS + LAMP_GAP_MS * i)} />
          ))}
      <div className={reduced ? "tut-opening__dark is-still" : "tut-opening__dark"} data-opening-dark="" />
      {reduced ? null : <div className="tut-opening__flash" data-opening-flash="" style={{ ...center, ...delay(FLASH_AT_MS) }} />}
      {reduced ? null : (
        <div className="tut-opening__rings" style={center}>
          {Array.from({ length: RINGS }, (_, i) => (
            <i key={i} className="tut-opening__ring" data-opening-ring="" style={delay(FLASH_AT_MS + RING_GAP_MS * i)} />
          ))}
        </div>
      )}
      <p className="tut-opening__title" data-opening-title="">
        밤이 되었습니다
      </p>
    </div>
  );
}

/** 서연 이름표를 재서 OpeningFx 에 주는 얇은 껍질 — 화면이 쓴다 */
export function MeasuredOpeningFx() {
  const at = useVictimAt();
  return <OpeningFx victimAt={at} />;
}
