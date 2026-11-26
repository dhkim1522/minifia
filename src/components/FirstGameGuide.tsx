import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { FirstGameGuideSession } from "../net/useFirstGameGuide";
import "../styles/first-game-guide.css";

export interface FirstGameGuideStep {
  id: string;
  title: string;
  text: string;
  target: string;
  completed?: string;
  cardBoundary?: string;
  group?: boolean;
  hold?: boolean;
  preferBelow?: boolean;
  inlineWhenShort?: string;
  pointFromSide?: boolean;
}

interface Placement {
  step: FirstGameGuideStep;
  left: number;
  top: number;
  width: number;
  height: number;
  cardLeft: number;
  cardAnchor: number;
  pointerLeft: number;
  below: boolean;
  fit: "full" | "text" | "ring";
  inlineHost: HTMLElement | null;
}

function visibleTarget(root: HTMLElement, selector: string): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).find((element) => {
    if (element.closest(":disabled, [aria-disabled='true'], [hidden], [inert]")) return false;
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    return rect.width > 0 && rect.height > 0 && rect.top >= top && rect.bottom <= bottom;
  });
}

function locate(root: HTMLElement, target: HTMLElement, step: FirstGameGuideStep, cardHeight: number): Placement {
  const frame = root.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const boundaryElement = step.cardBoundary === undefined ? null : target.closest(step.cardBoundary);
  const boundary = boundaryElement?.getBoundingClientRect() ?? rect;
  const viewport = window.visualViewport;
  const safeTop = Math.max(0, (viewport?.offsetTop ?? 0) - frame.top) + 64;
  const visibleBottom = Math.min(frame.height, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - frame.top);
  const left = rect.left - frame.left - 2;
  const top = rect.top - frame.top - 2;
  const width = rect.width + 4;
  const height = rect.height + 4;
  const center = left + width / 2;
  const [first, second] = step.group ? target.querySelectorAll<HTMLElement>("button:enabled") : [];
  // 후보가 여럿이면 가운데 인물을 추천하는 것처럼 보이지 않게 카드 사이를 가리킨다.
  const pointer = first && second ? (first.getBoundingClientRect().right + second.getBoundingClientRect().left) / 2 - frame.left : center;
  const cardWidth = Math.min(frame.width - 20, 306);
  const cardLeft = Math.min(Math.max(10, center - cardWidth / 2), frame.width - 10 - cardWidth);
  const aboveAnchor = boundary.top - frame.top - 2;
  const belowAnchor = boundary.bottom - frame.top + 2;
  const above = aboveAnchor - safeTop;
  const belowSpace = visibleBottom - belowAnchor;
  const inlineHost = step.inlineWhenShort !== undefined && above < 180
    ? boundaryElement?.querySelector<HTMLElement>(step.inlineWhenShort) ?? null
    : null;
  const fullGap = step.cardBoundary === undefined ? 32 : 8;
  const fullSize = cardHeight + fullGap + 4;
  const below = (step.preferBelow === true && belowSpace >= fullSize) || (above < fullSize && belowSpace > above);
  const space = below ? belowSpace : above;
  const fit = inlineHost !== null || space >= fullSize ? "full" : space >= cardHeight + 8 ? "text" : "ring";
  const gap = fit === "full" ? fullGap : 4;
  const cardAnchor = below ? belowAnchor + gap : aboveAnchor - gap;
  return { step, left, top, width, height, cardLeft, cardAnchor, pointerLeft: Math.min(Math.max(16, pointer), frame.width - 16), below, fit, inlineHost };
}

/** 정보만 덧그린다. 버튼의 입력, 포커스, 카메라와 서버 단계·시간은 기존 화면이 관리한다. */
export function FirstGameGuide({ rootRef, session, scope, steps }: {
  rootRef: RefObject<HTMLElement | null>;
  session: FirstGameGuideSession;
  scope: string;
  steps: readonly FirstGameGuideStep[];
}) {
  const descriptionId = useId();
  const [placement, setPlacement] = useState<(Placement & { scope: string }) | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const presented = useRef<{ id: string; scope: string } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null || steps.length === 0) return;
    let frame = 0;
    let watched: HTMLElement | undefined;
    let described: { element: HTMLElement; previous: string | null } | undefined;
    const clearDescription = () => {
      if (described === undefined) return;
      const { element, previous } = described;
      if (previous === null) element.removeAttribute("aria-describedby");
      else element.setAttribute("aria-describedby", previous);
      described = undefined;
    };
    const measure = () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      for (const step of steps) {
        if (step.completed === undefined || root.querySelector(step.completed) === null) continue;
        session.markSeen(step.id);
        if (presented.current?.id === step.id) presented.current = null;
      }
      const active = presented.current?.scope === scope ? presented.current.id : undefined;
      const eligible = steps.filter((step) => active === step.id || !session.seen(step.id));
      for (const step of eligible) {
        const target = visibleTarget(root, step.target);
        if (target === undefined) continue;
        if (watched !== target) {
          if (watched !== undefined) resize?.unobserve(watched);
          watched = target;
          resize?.observe(target);
        }
        if (cardRef.current !== null) resize?.observe(cardRef.current);
        if (described?.element !== target) {
          clearDescription();
          const previous = target.getAttribute("aria-describedby");
          target.setAttribute("aria-describedby", previous === null ? descriptionId : `${previous} ${descriptionId}`);
          described = { element: target, previous };
        }
        const next = locate(root, target, step, cardRef.current?.offsetHeight || 60);
        presented.current = { id: step.id, scope };
        if (next.fit !== "ring") session.markSeen(step.id);
        setPlacement((old) => old?.scope === scope && old.step === step && old.left === next.left && old.top === next.top &&
          old.width === next.width && old.height === next.height && old.cardLeft === next.cardLeft && old.cardAnchor === next.cardAnchor &&
          old.pointerLeft === next.pointerLeft && old.below === next.below && old.fit === next.fit &&
          old.inlineHost === next.inlineHost ? old : { ...next, scope });
        return;
      }
      if (watched !== undefined) resize?.unobserve(watched);
      watched = undefined;
      clearDescription();
      setPlacement(null);
    };
    const schedule = () => { if (frame === 0) frame = requestAnimationFrame(measure); };
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    const changes = new MutationObserver((records) => {
      if (records.some(({ target }) => target instanceof Element && !target.closest("[data-world-stage], [data-first-game-guide]"))) schedule();
    });
    changes.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "readonly", "disabled", "hidden", "inert", "aria-disabled", "aria-expanded", "aria-pressed"] });
    resize?.observe(root);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    root.addEventListener("focusin", schedule);
    root.addEventListener("animationend", schedule);
    root.addEventListener("transitionend", schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      clearDescription();
      changes.disconnect();
      resize?.disconnect();
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.removeEventListener("focusin", schedule);
      root.removeEventListener("animationend", schedule);
      root.removeEventListener("transitionend", schedule);
    };
  }, [rootRef, session, scope, steps, descriptionId]);

  if (placement === null || placement.scope !== scope || !steps.includes(placement.step)) return null;
  const { step, left, top, width, height, cardLeft, cardAnchor, pointerLeft, below, fit, inlineHost } = placement;
  return (
    <div className="mf-first-guide" data-first-game-guide={step.id} data-guide-placement={below ? "below" : "above"} data-guide-fit={fit}>
      <div className="mf-first-guide__ring" aria-hidden="true" style={{ left, top, width, height }} />
      {inlineHost === null ? <span key={`${step.id}:${step.target}`} className="mf-first-guide__hand" data-guide-hold={step.hold ? "" : undefined}
        data-guide-side={step.pointFromSide ? "" : undefined} aria-hidden="true"
        style={step.pointFromSide ? { left: left + width + 3, top: top + height / 2 } : { left: pointerLeft, top: below ? top + height + 1 : top - 1 }}>
        {step.pointFromSide ? "👈" : below ? "👆" : "👇"}
      </span> : null}
      {inlineHost === null ? <div ref={cardRef} id={descriptionId} className="mf-first-guide__info" role="status" style={{ left: cardLeft, top: cardAnchor }}>
        <span className="mf-first-guide__icon" aria-hidden="true">i</span>
        <div><strong>{step.title}</strong><p>{step.text}</p></div>
      </div> : createPortal(<span id={descriptionId} className="mf-first-guide__inline" role="status">{step.text}</span>, inlineHost)}
    </div>
  );
}
