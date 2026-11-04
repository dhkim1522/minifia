import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/penFont.css";
import "../../styles/letter.css";
import { LETTER_END_AT_MS, LETTER_TIERS, SEAL_GLYPH, writeSchedule } from "../../game/willLetter";
import type { WillLetter as WillLetterState } from "../../net/useWillLetter";

export interface WillLetterProps {
  /** useWillLetter 가 돌려준 편지 한 통 */
  letter: WillLetterState;
  /** 모션 줄이기: 처음부터 완성된 모양, 막대 가득 정지 */
  reducedMotion: boolean;
  /** 본문을 보이는 줄로 나눈다. 기본은 한 줄 */
  splitLines?: (text: string, tierIndex: number) => string[];
  /** 편지가 화면에 보이는 동안 true (알림을 위로 올리는 쪽이 읽는다) */
  onLive?: (live: boolean) => void;
}

const css = (vars: Record<string, string | number>): CSSProperties => vars as CSSProperties;

// 유언 편지(결정 0063-3·0063-4, UI-SPEC C-1·C-2·C-5, 시안 WillCenter envelope). 줄 쳐진 편지지가 올라오고(700ms) 0.8초부터 줄이 차례로 써지고
// 쓰기가 끝나면 우측 하단에 실링왁스 인장이 찍히고 5초에 접힌다. 본문·이름은 React 텍스트 노드로만 그린다(사용자 글, T-09.1-29).
// 눈에 보이는 머리글·글 줄·인장·안내는 aria-hidden 이고 스크린리더는 보이지 않는 한 줄만 읽는다. 초점을 받지도 가두지도 않는다.
export function WillLetter({ letter, reducedMotion, splitLines, onLive }: WillLetterProps) {
  const { text, name, t0 } = letter;
  const split = splitLines ?? (() => [text]);
  const lines = split(text, 0);
  const schedule = writeSchedule(lines);
  const [live, setLive] = useState(false);
  const [gone, setGone] = useState(false);

  // T0 에 등장하고 T0 + 5.42초에 걷힌다
  useEffect(() => {
    const start = setTimeout(() => setLive(true), Math.max(0, t0 - Date.now()));
    const end = setTimeout(() => setGone(true), Math.max(0, t0 + LETTER_END_AT_MS - Date.now()));
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [t0]);

  const shown = live && !gone;
  useEffect(() => {
    onLive?.(shown);
    return () => onLive?.(false);
  }, [shown, onLive]);

  if (!shown || schedule === null) return null;
  const tier = LETTER_TIERS[0];
  const rootCls = reducedMotion ? "mf-letter is-still" : "mf-letter";
  return (
    <div className={rootCls} data-will-letter="" role="status">
      <span className="mf-letter__read" data-will-read="">
        {`${name} 님의 유언: ${text}`}
      </span>
      <div className="mf-letter__fold" aria-hidden="true" style={css({ "--lw-fold-delay": `${schedule.foldAt}ms` })}>
        <div className="mf-letter__rise">
          <div className="mf-letter__paper" style={css({ "--lw-font": `${tier.font}px`, "--lw-line": `${tier.line}px` })}>
            <p className="mf-letter__head" data-will-head="">
              {`${name} 님의 유언`}
            </p>
            {lines.map((line, i) => {
              const w = schedule.lines[i];
              if (w === undefined) return null;
              return (
                <p
                  key={i}
                  className="mf-letter__line"
                  data-will-line=""
                  data-write-at={w.at}
                  data-write-steps={w.steps}
                  style={css({ "--lw-delay": `${w.at}ms`, "--lw-ms": `${w.ms}ms`, "--lw-steps": w.steps })}
                >
                  {line}
                </p>
              );
            })}
            <Seal at={schedule.sealAt} />
          </div>
        </div>
        <div className="mf-letter__guide">
          <p className="mf-letter__guide-text" data-will-guide="">
            채팅에도 남아요
          </p>
          <div className="mf-letter__bar">
            <div className="mf-letter__fill" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 실링왁스 인장(시안 SVG 그대로): 불규칙 가장자리 · 안쪽 테두리 원 둘 · 글자 두 겹(1px 어긋남) · 하이라이트 호. 글자는 SEAL_GLYPH 한 곳 */
function Seal({ at }: { at: number }) {
  const gradId = `lw-wax-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      className="mf-letter__seal"
      data-will-seal=""
      data-seal-at={at}
      aria-hidden="true"
      viewBox="0 0 100 100"
      width="84"
      height="84"
      style={css({ "--lw-delay": `${at}ms` })}
    >
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
