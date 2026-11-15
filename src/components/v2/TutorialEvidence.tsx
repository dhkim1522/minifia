import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/tutorial.css";
import { TUTORIAL_CAST } from "../../game/tutorialScript";
import { TRACE_MARK } from "../../game/traceMark";

// 첫 사건 장면 5(의심 보드)의 연결 선(17-05 의 선 부품을 21-12 가 줄였다, 결정 D-28, UI-SPEC 튜토리얼 표 5행): 실제 의심 보드(SuspectBoard, GameMap 이 가짜 view 의 boardOf 결과로 그린다)의
// 단서 칩 → 같은 옷 표시가 붙은 도윤 얼굴 사이에 선 하나가 1초 동안 그려진다. 17 의 눈 표시·두 번째 선·"눈 + 흔적 = 의심" 수식 줄·증거 카드 위의 선은 쓰지 않는다(P21-15).
// 카드·얼굴·칩·같은 옷 표시는 실제 부품이 그린다. 여기는 그 위에 얹는 연출뿐이고 실제 view·역할·닉네임을 읽지 않는다(출연 상수와 DOM 사각형뿐).
// 위치는 대상의 DOM 사각형을 rAF 로 재서 쓴다(폰 6종·보드 안쪽 스크롤에 맞춘다). 직전과 같으면 상태를 바꾸지 않고, 못 쟀으면(0×0·없음) 그리지 않는다(Pitfall 11).
// 선은 읽히지 않는다(aria-hidden). 그리기는 stroke-dashoffset(UI-SPEC 의 draw)이고 모션 줄이기면 완성된 모습이 바로 보인다(tutorial.css).

const SCREEN = "[data-tutorial-screen]";

/** 선 굵기와 시작 지연(ms) — 지연은 장면 표의 tut.link 큐(400ms)와 같은 시각이다 */
const LINE_WIDTH = 2.5;
const LINE_DELAY_MS = 400;

/** 화면 루트 안에서 측정한다(루트가 없으면 문서 전체) */
function scopeOf(): ParentNode {
  return document.querySelector(SCREEN) ?? document;
}

/** 측정 함수를 마운트 때 한 번 바로, 그 뒤 매 프레임 불러 값이 바뀔 때만 상태를 바꾼다. 못 쟀으면(null) 비운다 */
function useMeasured<T>(measure: (scope: ParentNode) => T | null, same: (a: T, b: T) => boolean): T | null {
  const [value, setValue] = useState<T | null>(null);
  const live = useRef(measure);
  live.current = measure;
  useLayoutEffect(() => {
    const tick = (): void => {
      const next = live.current(scopeOf());
      setValue((prev) => {
        if (next === null) return null;
        return prev !== null && same(prev, next) ? prev : next;
      });
    };
    tick();
    let raf = 0;
    const loop = (): void => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // same 은 모듈 상수 함수라 한 번만 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

/** 요소의 사각형 (없거나 0×0 이면 null) */
function rectOf(scope: ParentNode, selector: string): DOMRect | null {
  const el = scope.querySelector(selector);
  if (el === null) return null;
  const r = el.getBoundingClientRect();
  return r.width === 0 && r.height === 0 ? null : r;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 점을 화면 안쪽 inset([inset, 폭−inset]×[inset, 높이−inset])으로 고정한다(18-06, D-07). 곡선 제어점은 두 끝점의 x 와 그 사이 y 라서 끝점이 안이면 곡선도 안이다 */
export function clampPoint(p: readonly [number, number], w: number, h: number, inset = 8): [number, number] {
  return [round1(Math.min(Math.max(p[0], inset), w - inset)), round1(Math.min(Math.max(p[1], inset), h - inset))];
}

/** 세로로 굽은 부드러운 곡선 */
function curve(from: [number, number], to: [number, number]): string {
  const dy = (to[1] - from[1]) / 2;
  return `M${from[0]} ${from[1]} C${from[0]} ${round1(from[1] + dy)} ${to[0]} ${round1(to[1] - dy)} ${to[0]} ${to[1]}`;
}

interface LineGeom {
  from: [number, number];
  to: [number, number];
}

/** 보드의 옷 조각 칩 아래 가운데 → 같은 옷 표시가 붙은 도윤 얼굴 위 가운데(2 위). 둘 중 하나라도 못 쟀으면 null */
function measureLine(scope: ParentNode): LineGeom | null {
  const chip = rectOf(scope, `[data-board-chip="${TUTORIAL_CAST.clue.spot}"]`);
  const face = rectOf(scope, `[data-board-face="${TUTORIAL_CAST.suspect}"]`);
  if (chip === null || face === null) return null;
  return {
    from: clampPoint([chip.left + chip.width / 2, chip.bottom], window.innerWidth, window.innerHeight),
    to: clampPoint([face.left + face.width / 2, face.top - 2], window.innerWidth, window.innerHeight),
  };
}

const sameLine = (a: LineGeom, b: LineGeom): boolean => a.from[0] === b.from[0] && a.from[1] === b.from[1] && a.to[0] === b.to[0] && a.to[1] === b.to[1];

/** 화면 전체 선 층. 선 색은 증거 표식이 쓰는 같은 사용자 변수 --trace-mark(닫힌 표의 값, hex 없음) */
export function TutorialLinks() {
  const line = useMeasured<LineGeom>(measureLine, sameLine);
  const style = { "--trace-mark": TRACE_MARK[TUTORIAL_CAST.clue.piece] } as CSSProperties;
  return (
    <svg className="tut-links" data-tutorial-links="" aria-hidden="true" focusable="false" style={style}>
      {line === null ? null : (
        <path
          className="tut-links__path is-trace"
          d={curve(line.from, line.to)}
          data-from={`${line.from[0]},${line.from[1]}`}
          data-to={`${line.to[0]},${line.to[1]}`}
          fill="none"
          strokeLinecap="round"
          strokeWidth={LINE_WIDTH}
          pathLength={1}
          style={{ "--tut-delay": `${LINE_DELAY_MS}ms` } as CSSProperties}
        />
      )}
    </svg>
  );
}
