import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/letter.css";
import { LETTER_END_AT_MS, LETTER_FOLD_AT_MS, LETTER_FOLD_MS, LETTER_RISE_MS, LETTER_SEAL_AT_MS, LETTER_SEAL_MS, SEAL_GLYPH } from "../../game/willLetter";
import { stationeryArt } from "../../net/assets";
import type { WillLetter as WillLetterState } from "../../net/useWillLetter";

export interface WillLetterProps {
  letter: WillLetterState;
  reducedMotion: boolean;
  onLive?: (live: boolean) => void;
}

const css = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;

// 편지지가 올라오면 줄을 자연스럽게 나눈 본문 전체가 보인다. 접힘과 채팅 카드는 애니메이션 종료가 아닌 같은 T0 시계를 따른다.
export function WillLetter({ letter, reducedMotion, onLive }: WillLetterProps) {
  const { text, name, t0 } = letter;
  const [run, setRun] = useState<{ key: number; elapsed: number } | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const start = () => {
      const elapsed = Date.now() - t0;
      if (elapsed >= LETTER_END_AT_MS) setGone(true);
      else if (elapsed >= 0) setRun({ key: 1, elapsed });
    };
    const remaining = t0 - Date.now();
    const reveal = remaining > 0 ? setTimeout(start, remaining) : undefined;
    if (reveal === undefined) start();
    const dismiss = setTimeout(() => setGone(true), Math.max(0, t0 + LETTER_END_AT_MS - Date.now()));
    const onVisible = () => {
      if (document.visibilityState === "hidden") return;
      const elapsed = Date.now() - t0;
      if (elapsed >= LETTER_END_AT_MS) setGone(true);
      else if (elapsed >= 0) setRun((previous) => ({ key: (previous?.key ?? 0) + 1, elapsed }));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(reveal);
      clearTimeout(dismiss);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [t0]);

  const shown = run !== null && !gone && text.trim() !== "";
  useEffect(() => {
    onLive?.(shown);
    return () => onLive?.(false);
  }, [shown, onLive]);

  if (!shown || run === null) return null;
  const delay = (at: number) => String(at - run.elapsed) + "ms";
  return (
    <div className={reducedMotion ? "mf-letter is-still" : "mf-letter"} data-will-letter="" role="status"
      style={css({
        "--lw-rise-delay": delay(0), "--lw-rise-duration": `${LETTER_RISE_MS}ms`,
        "--lw-fold-delay": delay(LETTER_FOLD_AT_MS), "--lw-fold-duration": `${LETTER_FOLD_MS}ms`, "--lw-read-duration": `${LETTER_FOLD_AT_MS}ms`,
      })}>
      <span className="mf-letter__read" data-will-read="">{name} 님의 유언: {text}</span>
      <div key={run.key} className="mf-letter__fold" aria-hidden="true">
        <div className="mf-letter__rise">
          <div className="mf-letter__paper">
            <div className="mf-letter__heading">
              <p className="mf-letter__head" data-will-head="">
                <span className="mf-letter__author">{name}</span>{" "}<span>님의 유언</span>
              </p>
              <Seal delay={delay(LETTER_SEAL_AT_MS)} />
            </div>
            <div className="mf-letter__text">
              <p className="mf-letter__line" data-will-line="">{text}</p>
            </div>
          </div>
        </div>
        <div className="mf-letter__guide">
          <p className="mf-letter__guide-text" data-will-guide="">채팅에도 남아요</p>
          <div className="mf-letter__bar"><div className="mf-letter__fill" /></div>
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
