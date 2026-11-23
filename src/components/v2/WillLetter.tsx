import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, Ref } from "react";
import "../../styles/letter.css";
import "../../styles/penFont.css";
import { emitSignal } from "../../audio/signals";
import { LETTER_FOLD_MS, LETTER_READ_MS, LETTER_RISE_MS, LETTER_SEAL_AT_MS, LETTER_SEAL_MS, SEAL_GLYPH } from "../../game/willLetter";
import { stationeryArt } from "../../net/assets";
import type { WillLetter as WillLetterState } from "../../net/useWillLetter";
import { Button } from "../Button";

export interface WillLetterProps {
  letter: WillLetterState;
  reducedMotion: boolean;
  withAnnounce?: boolean;
  ref?: Ref<HTMLDivElement>;
  onLive?: (live: boolean) => void;
}

const css = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;

// 편지지가 올라오면 본문 전체가 보인다. 읽기 시간 또는 이 화면의 닫기 버튼이 편지를 접는다.
export function WillLetter({ letter, reducedMotion, withAnnounce, ref, onLive }: WillLetterProps) {
  const { text, name, t0 } = letter;
  const [run, setRun] = useState<{ key: number; elapsed: number } | null>(null);
  const closing = useRef(false);
  const [folding, setFolding] = useState(false);
  const [gone, setGone] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const foldTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fold = useCallback((animate: boolean) => {
    if (closing.current) return;
    closing.current = true;
    if (!animate) {
      setGone(true);
      return;
    }
    emitSignal({ kind: "willClose" });
    if (reducedMotion) {
      setGone(true);
      return;
    }
    setFolding(true);
    foldTimer.current = setTimeout(() => setGone(true), LETTER_FOLD_MS);
  }, [reducedMotion]);
  useEffect(() => () => clearTimeout(foldTimer.current), []);

  useEffect(() => {
    const start = () => {
      const elapsed = Date.now() - t0;
      if (elapsed >= LETTER_READ_MS) fold(false);
      else if (elapsed >= 0) setRun({ key: 1, elapsed });
    };
    const remaining = t0 - Date.now();
    const reveal = remaining > 0 ? setTimeout(start, remaining) : undefined;
    if (reveal === undefined) start();
    const expire = setTimeout(() => fold(document.visibilityState !== "hidden"), Math.max(0, remaining + LETTER_READ_MS));
    const onVisible = () => {
      if (document.visibilityState === "hidden" || closing.current) return;
      const elapsed = Date.now() - t0;
      if (elapsed >= LETTER_READ_MS) fold(false);
      else if (elapsed >= 0) setRun((previous) => ({ key: (previous?.key ?? 0) + 1, elapsed }));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(reveal);
      clearTimeout(expire);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [t0, fold]);

  const shown = run !== null && !gone && text.trim() !== "";
  const runKey = run?.key;
  useEffect(() => {
    const body = bodyRef.current;
    if (body === null) return;
    const measure = () => setScrollable(body.scrollHeight > body.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    if (body.firstElementChild !== null) observer.observe(body.firstElementChild);
    return () => observer.disconnect();
  }, [shown, runKey]);
  useEffect(() => {
    onLive?.(shown && !folding);
    return () => onLive?.(false);
  }, [shown, folding, onLive]);

  if (!shown || run === null) return null;
  const delay = (at: number) => String(at - run.elapsed) + "ms";
  return (
    <div className={["mf-letter", reducedMotion ? "is-still" : "", folding ? "is-folding" : "", withAnnounce ? "is-morning" : ""].filter(Boolean).join(" ")} data-will-letter="" ref={ref}
      style={css({
        "--lw-rise-delay": delay(0), "--lw-rise-duration": `${LETTER_RISE_MS}ms`,
        "--lw-fold-duration": `${LETTER_FOLD_MS}ms`, "--lw-read-duration": `${LETTER_READ_MS}ms`,
      })}>
      <span className="mf-letter__read" data-will-read="" role="status">{name} 님의 유언: {text}</span>
      <div key={run.key} className="mf-letter__fold">
        <div className="mf-letter__rise">
          <div className="mf-letter__paper">
            <p className="mf-letter__head" data-will-head="" aria-hidden="true">
              <span className="mf-letter__author">{name}</span>{" "}<span>님의 유언</span>
            </p>
            <div ref={bodyRef} className="mf-letter__text" aria-hidden={scrollable ? undefined : true}
              data-will-scroll={scrollable ? "" : undefined} tabIndex={scrollable ? 0 : undefined}
              role={scrollable ? "region" : undefined} aria-label={scrollable ? "유언 본문" : undefined}>
              <p className="mf-letter__line" data-will-line="">{text}</p>
            </div>
            <Seal delay={delay(LETTER_SEAL_AT_MS)} />
          </div>
        </div>
        <div className="mf-letter__guide">
          <div className="mf-letter__reading" aria-hidden="true">
            <p className="mf-letter__guide-text" data-will-guide="">채팅에도 남아요</p>
            <div className="mf-letter__bar"><div className="mf-letter__fill" /></div>
          </div>
          <Button variant="secondary" className="mf-letter__close" data-will-close="" disabled={folding} onClick={() => fold(true)}>닫기</Button>
        </div>
      </div>
    </div>
  );
}

function Seal({ delay }: { delay: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="mf-letter__seal" data-will-seal="" data-seal-at={LETTER_SEAL_AT_MS} aria-hidden="true"
      style={css({ "--lw-delay": delay, "--lw-seal-duration": `${LETTER_SEAL_MS}ms` })}>
      {failed ? <VectorSeal /> : (
        <img src={stationeryArt("seal")} alt="" width={84} height={84} draggable={false} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function VectorSeal() {
  const gradId = `lw-wax-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 100 100" width="84" height="84">
      <defs>
        <radialGradient id={gradId} cx="38%" cy="30%" r="75%">
          <stop offset="0" className="mf-letter__wax-1" />
          <stop offset="0.55" className="mf-letter__wax-2" />
          <stop offset="1" className="mf-letter__wax-3" />
        </radialGradient>
      </defs>
      <path
        d="M50 4c10 0 14 6 22 7 9 1 18 6 18 16 0 7 4 10 4 20 0 8-5 12-4 20 1 10-8 17-17 18-8 1-12 8-23 8s-14-7-22-8C19 84 9 77 10 66c1-8-4-12-4-20 0-9 5-12 5-20C11 16 22 11 30 10 38 9 41 4 50 4z"
        fill={`url(#${gradId})`}
      />
      <circle className="mf-letter__seal-ring" cx="50" cy="50" r="30" />
      <circle className="mf-letter__seal-ring-hi" cx="50" cy="50" r="30" transform="translate(-1.5 -1.5)" />
      <text className="mf-letter__seal-glyph is-dark" x="50" y="63">
        {SEAL_GLYPH}
      </text>
      <text className="mf-letter__seal-glyph is-light" x="49" y="62">
        {SEAL_GLYPH}
      </text>
      <path className="mf-letter__seal-gloss" d="M22 28c4-8 12-12 22-12" />
    </svg>
  );
}
