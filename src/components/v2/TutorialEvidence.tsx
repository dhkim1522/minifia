import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/tutorial.css";
import { TUTORIAL_CAST } from "../../game/tutorialScript";
import { TRACE_MARK } from "../../game/traceMark";
import { TraceArt } from "./placeArt";
import { V2Icon } from "./V2Icon";

// 첫 사건의 "재미 포인트" 연출 부품(17-05, 결정 0078-1.2·1.3, UI-SPEC 첫 사건 장면 계약 4·5행): 장면 4 의 눈 표시, 장면 5 의 연결 선 두 개와 "눈 + 흔적 = 의심" 수식 줄.
// 카드·이름표·같은 옷 표시는 실제 부품(RecordCard·EvidenceCard·HeadStack)이 그리고, 여기는 그 위에 얹는 연출만이다. 실제 view·역할·닉네임을 읽지 않는다(출연 상수와 DOM 사각형뿐).
// 위치는 대상의 DOM 사각형을 rAF 로 재서 쓴다(폰 6종·3D 투영 이동에 맞춘다). 직전과 같으면 상태를 바꾸지 않고, 못 쟀으면(0×0·없음) 그리지 않는다(Pitfall 11).
// 눈 표시와 선은 읽히지 않는다(aria-hidden). 애니메이션은 transform·opacity(눈·수식), 선 그리기는 stroke-dashoffset(UI-SPEC 의 draw)이고 모션 줄이기면 모두 즉시 완성된 모습이다(tutorial.css).

/** 눈 표시 원 지름(시안 값)과 이름표와의 간격 */
const EYE_SIZE = 36;
const EYE_GAP = 4;
/** 화면 위 가장자리에서 띄우는 최소 거리 */
const EDGE = 8;

const SCREEN = "[data-tutorial-screen]";

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

// ---- 장면 4: 이름표 위 눈 표시 ----

interface EyePos {
  left: number;
  top: number;
}

const sameEye = (a: EyePos, b: EyePos): boolean => a.left === b.left && a.top === b.top;

/** 목격한 사람(seat)의 이름표 위에 뜨는 36 원 눈 표시. 이름표가 측정될 때까지는 그리지 않는다 */
export function TutorialEyeMark({ seat }: { seat: number }) {
  const pos = useMeasured<EyePos>((scope) => {
    const r = rectOf(scope, `.mf-world__tag[data-seat="${seat}"]`);
    return r === null ? null : { left: Math.round(r.left + r.width / 2 - EYE_SIZE / 2), top: Math.max(EDGE, Math.round(r.top - EYE_SIZE - EYE_GAP)) };
  }, sameEye);
  if (pos === null) return null;
  return (
    <span className="tut-eye" data-tutorial-eye="" aria-hidden="true" style={{ left: pos.left, top: pos.top }}>
      <V2Icon name="eye" size={20} />
    </span>
  );
}

// ---- 장면 5: 연결 선 두 개 ----

interface LineSpec {
  key: "trace" | "seen";
  /** 시작 대상(증거 카드 안) */
  from: string;
  /** 도윤 이름표 위 가장자리에서 선이 닿는 가로 위치(0~1) */
  at: number;
  width: number;
  delayMs: number;
}

/** ① 증거 카드의 조각 타일 → 도윤(redCloth 2.5, 0.4초부터) ② 목격 행의 도윤 이름 → 도윤(brass-200 2, 0.9초부터). 끝은 이름표 위 가장자리의 30%·70% 지점이라 서로 겹치지 않는다 */
const LINES: readonly LineSpec[] = [
  { key: "trace", from: "[data-trace-card] .mv-trace__disc", at: 0.3, width: 2.5, delayMs: 400 },
  { key: "seen", from: "[data-trace-card] [data-lastseen-row] .mv-evidence__witness", at: 0.7, width: 2, delayMs: 900 },
];

interface LineGeom {
  key: LineSpec["key"];
  from: [number, number];
  to: [number, number];
  width: number;
  delayMs: number;
}

function measureLines(scope: ParentNode): LineGeom[] {
  const tag = rectOf(scope, `.mf-world__tag[data-seat="${TUTORIAL_CAST.suspect}"]`);
  if (tag === null) return [];
  const out: LineGeom[] = [];
  for (const spec of LINES) {
    const src = rectOf(scope, spec.from);
    if (src === null) continue;
    out.push({
      key: spec.key,
      from: [round1(src.left + src.width / 2), round1(src.top + src.height / 2)],
      to: [round1(tag.left + tag.width * spec.at), round1(tag.top - 2)],
      width: spec.width,
      delayMs: spec.delayMs,
    });
  }
  return out;
}

const sameLines = (a: LineGeom[], b: LineGeom[]): boolean => a.length === b.length && a.every((l, i) => l.key === b[i]!.key && l.from[0] === b[i]!.from[0] && l.from[1] === b[i]!.from[1] && l.to[0] === b[i]!.to[0] && l.to[1] === b[i]!.to[1]);

/** 세로로 굽은 부드러운 곡선 */
function curve(from: [number, number], to: [number, number]): string {
  const dy = (to[1] - from[1]) / 2;
  return `M${from[0]} ${from[1]} C${from[0]} ${round1(from[1] + dy)} ${to[0]} ${round1(to[1] - dy)} ${to[0]} ${to[1]}`;
}

/** 화면 전체 선 층. 선 색 ① 은 증거 카드가 쓰는 같은 사용자 변수 --trace-mark(닫힌 표의 값, hex 없음) */
export function TutorialLinks() {
  const lines = useMeasured<LineGeom[]>(measureLines, sameLines) ?? [];
  const style = { "--trace-mark": TRACE_MARK[TUTORIAL_CAST.trace] } as CSSProperties;
  return (
    <svg className="tut-links" data-tutorial-links="" aria-hidden="true" focusable="false" style={style}>
      {lines.map((l) => (
        <path
          key={l.key}
          className={l.key === "trace" ? "tut-links__path is-trace" : "tut-links__path is-seen"}
          d={curve(l.from, l.to)}
          data-from={`${l.from[0]},${l.from[1]}`}
          data-to={`${l.to[0]},${l.to[1]}`}
          fill="none"
          strokeLinecap="round"
          strokeWidth={l.width}
          pathLength={1}
          style={{ "--tut-delay": `${l.delayMs}ms` } as CSSProperties}
        />
      ))}
    </svg>
  );
}

// ---- 장면 5: 수식 줄 ----

/** "눈 + 흔적 = 의심" — 아래 가운데, [다음] 윗변보다 12 위. 1.6초 지연으로 떠오른다 */
export function TutorialFormula() {
  return (
    <div className="tut-formula" data-tutorial-formula="" aria-hidden="true" style={{ "--tut-delay": "1600ms" } as CSSProperties}>
      <span className="tut-formula__disc">
        <V2Icon name="eye" size={24} />
      </span>
      <span className="tut-formula__op">+</span>
      <span className="tut-formula__disc">
        <TraceArt piece={TUTORIAL_CAST.trace} size={32} />
      </span>
      <span className="tut-formula__op">=</span>
      <span className="tut-formula__pill">
        <V2Icon name="hand" size={16} />
        의심
      </span>
    </div>
  );
}
