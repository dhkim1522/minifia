import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { TutorialTargetId } from "../../game/tutorialScript";
import "../../styles/tutorial.css";

// 혼자 하기 튜토리얼의 포커스 링(24-07, UI-SPEC P24-26). 17페이즈 구현(00829164^ 의 FocusRing)의 측정 논리를 되살리고 CSS 와 표식은 새로 썼다.
// 지금 눌러야 하는 곳 하나를 사방 8 키운 상자로 감싸 4px light-lamp 테두리를 1Hz 로 깜빡이고, 상자 구멍 밖은 --scrim 으로 어둡게 한다(흐림·손가락 포인터 없음).
// 위치는 시안 좌표가 아니라 대상의 DOM 사각형을 rAF 로 재서 쓴다(폰 6종·3D 투영으로 움직이는 이름표를 따라간다). 직전과 같으면 상태를 바꾸지 않는다(T-17-11).
// 화면 안쪽 8 밖이면 안으로 민다. 대상을 못 쟀으면(0×0·없음) 링도 어둡게도 그리지 않는다(Pitfall 11).
// 링·어둡게는 눌림을 받지 않고(pointer-events none) 읽히지 않는다(aria-hidden). 깜빡임은 링 하나뿐이다 — 이름표 깜빡임·호출 맥박은 tutorial.css 가 끈다(0080-6).
// 값 import 는 css 뿐이다 — 정적 가드가 이 파일의 폐포를 지킨다(네트워크 모듈 없음).

/** 링 대상. selectors 가 가리키는 사각형 전부의 합집합을 감싼다(튜토리얼 화면 루트 안에서 찾는다) */
export interface FocusTarget {
  /** data-tutorial-target 값(E2E 안정 id) */
  id: TutorialTargetId;
  selectors: readonly string[];
  /** 알약 모서리(radius-pill). 아니면 대상 모서리 + 8 */
  pill?: boolean;
}

/** 대상 둘레로 키우는 여백과 화면 가장자리에서 띄우는 거리 */
const PAD = 8;
/** 대상 모서리를 못 읽었을 때의 상자 모서리 */
const FALLBACK_RADIUS = 18;
/** 화면에 하나뿐이라 고정 id 를 쓴다(useId 의 콜론이 url(#…) 참조를 흔든다) */
const MASK_ID = "tut-dim-mask";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: string;
  /** 어둡게 구멍의 숫자 반지름(pill 은 height / 2) */
  rx: number;
}

/** 대상 요소 하나의 모서리 반지름 px (읽지 못하면 null) */
function radiusOf(el: Element): number | null {
  const v = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(v) ? v : null;
}

/** 대상을 잰다. 못 쟀으면 null */
function measure(scope: ParentNode, target: FocusTarget): Box | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let radius: number | null = null;
  for (const selector of target.selectors) {
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
  const width = right - left + PAD * 2;
  const height = bottom - top + PAD * 2;
  // 화면 안쪽 8 밖이면 크기를 그대로 두고 안으로 민다(화면보다 크면 왼쪽·위 8 에 붙인다)
  const x = Math.max(PAD, Math.min(left - PAD, window.innerWidth - PAD - width));
  const y = Math.max(PAD, Math.min(top - PAD, window.innerHeight - PAD - height));
  const round = (n: number): number => Math.round(n * 10) / 10;
  const radiusPx = (radius ?? FALLBACK_RADIUS - PAD) + PAD;
  return {
    left: round(x),
    top: round(y),
    width: round(width),
    height: round(height),
    radius: target.pill === true ? "var(--radius-pill)" : `${radiusPx}px`,
    rx: target.pill === true ? round(height / 2) : radiusPx,
  };
}

function same(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height && a.radius === b.radius && a.rx === b.rx;
}

export function FocusRing({ target }: { target: FocusTarget | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  // 대상은 렌더마다 새 객체일 수 있어 최신 값을 ref 로 읽는다(rAF 루프는 대상 유무가 바뀔 때만 다시 건다)
  const live = useRef(target);
  live.current = target;
  const hasTarget = target !== null;

  useEffect(() => {
    if (!hasTarget) {
      setBox(null);
      return;
    }
    let raf = 0;
    const tick = (): void => {
      const scope: ParentNode = rootRef.current?.closest("[data-tutorial-screen]") ?? document;
      const t = live.current;
      const next = t === null ? null : measure(scope, t);
      setBox((prev) => (same(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasTarget]);

  // 대상이 바뀌면(다른 id) 이전 상자를 바로 지운다 — 다음 프레임이 새 대상을 잰다
  const shown = hasTarget ? box : null;
  const style: CSSProperties | undefined = shown === null ? undefined : { left: shown.left, top: shown.top, width: shown.width, height: shown.height, borderRadius: shown.radius };

  return (
    <div ref={rootRef} className="tut-focus-layer" aria-hidden="true">
      {shown !== null ? (
        <svg className="tut-dim" data-tutorial-dim="" aria-hidden="true" focusable="false">
          <defs>
            <mask id={MASK_ID} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect data-tutorial-hole="" x={shown.left} y={shown.top} width={shown.width} height={shown.height} rx={shown.rx} fill="black" />
            </mask>
          </defs>
          <rect className="tut-dim__fill" x="0" y="0" width="100%" height="100%" mask={`url(#${MASK_ID})`} />
        </svg>
      ) : null}
      {shown !== null && target !== null ? <div className="tut-ring" data-tutorial-ring="" data-tutorial-target={target.id} aria-hidden="true" style={style} /> : null}
    </div>
  );
}
