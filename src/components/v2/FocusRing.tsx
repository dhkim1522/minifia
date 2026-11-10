import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/tutorial.css";

// 첫 사건의 포커스 테두리(17-04, 결정 0078-8, UI-SPEC "포커스 테두리 계약"): 지금 눌러야 하는 곳 하나(또는 같은 일을 하는 한 묶음)를
// 램프 빛 4px 로 1초 주기로 깜빡이게 하는 상자. 배경 흐림·어둠·손가락 포인터는 없다.
// 위치는 시안 좌표가 아니라 대상의 DOM 사각형을 rAF 로 재서 쓴다(폰 6종·3D 투영 이동에 맞춘다). 직전과 같으면 상태를 바꾸지 않는다(T-17-11).
// 대상 사각형을 사방 8 키운 상자이고, 화면 안쪽 8 밖이면 안으로 민다. 대상을 못 쟀으면(0×0·없음) 그리지 않는다(Pitfall 11).
// 상자는 눌림을 받지 않고(pointer-events none) 읽히지 않는다(aria-hidden). 깜빡임은 opacity 만이다(tutorial.css).

/** 포커스 상자 하나가 감싸는 곳. selectors 가 가리키는 사각형 전부의 합집합을 감싼다 */
export interface FocusGroup {
  key: string;
  selectors: readonly string[];
  /** 아래로만 더 늘린다(이름표 + 몸) */
  extendDown?: number;
  /** 알약 모서리(radius-pill). 아니면 대상 모서리 + 8 */
  pill?: boolean;
  /** 상자는 그리지 않고 스포트라이트 구멍만 내는 곳(기록 카드·눈 표시처럼 같이 밝아야 하는 요소) */
  lit?: readonly string[];
}

/** 대상 밖을 덮는 night-950 의 불투명도(결정 0081-1-3) */
export const TUTORIAL_DIM_ALPHA = 0.5;

/** 대상 둘레로 키우는 여백과 화면 가장자리에서 띄우는 거리 */
const PAD = 8;
/** 대상 모서리를 못 읽었을 때의 상자 모서리(시안 r18) */
const FALLBACK_RADIUS = 18;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: string;
}

/** 대상 요소 하나의 모서리 반지름 px (읽지 못하면 null) */
function radiusOf(el: Element): number | null {
  const v = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(v) ? v : null;
}

/** 묶음 하나를 잰다. 못 쟀으면 null */
function measure(scope: ParentNode, group: FocusGroup): Box | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let radius: number | null = null;
  for (const selector of group.selectors) {
    const el = scope.querySelector(selector);
    if (el === null) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
    radius ??= radiusOf(el);
  }
  if (!Number.isFinite(left)) return null;
  let width = right - left + PAD * 2;
  let height = bottom - top + PAD * 2 + (group.extendDown ?? 0);
  let x = left - PAD;
  let y = top - PAD;
  // 화면 안쪽 8 밖이면 크기를 그대로 두고 안으로 민다(화면보다 크면 왼쪽·위 8 에 붙인다)
  const maxX = window.innerWidth - PAD - width;
  const maxY = window.innerHeight - PAD - height;
  x = Math.max(PAD, Math.min(x, maxX));
  y = Math.max(PAD, Math.min(y, maxY));
  width = Math.round(width * 10) / 10;
  height = Math.round(height * 10) / 10;
  return {
    left: Math.round(x * 10) / 10,
    top: Math.round(y * 10) / 10,
    width,
    height,
    radius: group.pill === true ? "var(--radius-pill)" : `${(radius ?? FALLBACK_RADIUS - PAD) + PAD}px`,
  };
}

function same(a: Box | null | undefined, b: Box | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height && a.radius === b.radius;
}

export function FocusRing({ groups }: { groups: readonly FocusGroup[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Readonly<Record<string, Box>>>({});
  // 묶음 목록은 렌더마다 새 배열이라 최신 값을 ref 로 읽는다(rAF 루프는 한 번만 건다)
  const live = useRef(groups);
  live.current = groups;
  const hasGroups = groups.length > 0;

  useEffect(() => {
    if (!hasGroups) {
      setBoxes((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    let raf = 0;
    const tick = (): void => {
      const scope: ParentNode = rootRef.current?.closest("[data-tutorial-screen]") ?? document;
      setBoxes((prev) => {
        const next: Record<string, Box> = {};
        let changed = false;
        for (const group of live.current) {
          const box = measure(scope, group);
          if (box === null) continue;
          const before = prev[group.key];
          next[group.key] = same(before, box) && before !== undefined ? before : box;
          if (before !== next[group.key]) changed = true;
        }
        if (!changed && Object.keys(prev).length === Object.keys(next).length) return prev;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasGroups]);

  return (
    <div ref={rootRef} className="tut-focus-layer" aria-hidden="true">
      {groups.map((g) => {
        const box = boxes[g.key];
        if (box === undefined) return null;
        const style: CSSProperties = { left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: box.radius };
        return <div key={g.key} className="tut-focus" data-tutorial-focus={g.key} aria-hidden="true" style={style} />;
      })}
    </div>
  );
}
