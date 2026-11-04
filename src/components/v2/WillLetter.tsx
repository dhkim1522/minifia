import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/penFont.css";
import "../../styles/letter.css";
import {
  LETTER_END_AT_MS,
  LETTER_FONT_WAIT_MS,
  LETTER_PAPER_MIN_H,
  LETTER_TIERS,
  SEAL_GLYPH,
  chooseTier,
  paperHeight,
  writeSchedule,
} from "../../game/willLetter";
import type { WriteSchedule } from "../../game/willLetter";
import type { WillLetter as WillLetterState } from "../../net/useWillLetter";
import { V2Icon } from "./V2Icon";

/** 글 크기(px)와 줄 높이(px) */
export interface LetterTier {
  font: number;
  line: number;
}

export interface WillLetterProps {
  /** useWillLetter 가 돌려준 편지 한 통 */
  letter: WillLetterState;
  /** 모션 줄이기: 처음부터 완성된 모양, 막대 가득 정지 */
  reducedMotion: boolean;
  /** 본문을 그 단계 글꼴 크기에서 보이는 줄로 나눈다. 기본은 숨은 측정 틀의 글자 사각형(Range)으로 나눈다 */
  splitLines?: (text: string, tier: LetterTier) => string[];
  /** 채팅 입력줄 윗변의 y(편지 틀 기준 px). 모르면(null) 편지지는 340 으로 두고 CSS 기본 자리에 앉는다 */
  getInputTop?: () => number | null;
  /** 편지가 화면에 보이는 동안 true (알림을 위로 올리는 쪽이 읽는다) */
  onLive?: (live: boolean) => void;
}

const css = (vars: Record<string, string | number>): CSSProperties => vars as CSSProperties;

/** 헤더 아래 알림 윗변(72), 알림 아래 간격(20), 입력줄과의 간격(4). 알림이 1줄일 때 높이 43(측정이 안 되는 환경의 추정값) */
const ANNOUNCE_TOP = 72;
const ANNOUNCE_GAP = 20;
const INPUT_GAP = 4;
const ANNOUNCE_H_GUESS = 43;
/** 가용 높이에서 빼는 값: 간격 합 40 + 접힘 안내 30 */
const AVAIL_REST = 40 + 30;
/** 머리글 아래(24 + 14×1.4 ≈ 44, 여유 8)와 인장 윗변 위 간격 */
const HEAD_BOTTOM = 52;
const SEAL_BOX = 84 + 8;
const SEAL_GAP = 4;

/**
 * 글 덩어리 윗변 y(편지지 안). 기본은 편지지 세로 가운데이고(시안), 덩어리 아래끝이 인장 윗변을 침범하면 머리글 아래까지 올려 인장 위에 맞춘다.
 * 인장 위에 아예 못 들어가는 7줄 같은 긴 글은 가운데에 둔다(3단계 줄 높이 32, 마지막 줄이 짧아 대개 인장 왼쪽에 있다).
 */
export function blockTop(paperH: number, lines: number, line: number): number {
  const h = lines * line;
  const centered = (paperH - h) / 2;
  const limit = paperH - SEAL_BOX - SEAL_GAP;
  if (centered + h <= limit) return centered;
  if (limit - HEAD_BOTTOM >= h) return limit - h;
  return Math.max(0, centered);
}

/** 측정 틀의 글 요소에서 Range 글자 사각형의 top 으로 보이는 줄을 나눈다. 사각형을 못 읽는 환경은 한 줄(텍스트 노드는 그대로) */
function splitByRects(el: HTMLElement, text: string, tier: LetterTier): string[] {
  el.style.fontSize = `${tier.font}px`;
  el.style.lineHeight = `${tier.line}px`;
  const node = el.firstChild;
  if (node === null || node.nodeType !== 3 || typeof document.createRange !== "function") return [text];
  const range = document.createRange();
  const out: string[] = [];
  let cur = "";
  let lineTop: number | null = null;
  let offset = 0;
  let seen = false;
  for (const ch of Array.from(text)) {
    range.setStart(node, offset);
    range.setEnd(node, offset + ch.length);
    offset += ch.length;
    const rect = typeof range.getClientRects === "function" ? range.getClientRects()[0] : undefined;
    if (rect !== undefined && rect.width > 0) {
      seen = true;
      if (lineTop !== null && Math.abs(rect.top - lineTop) > tier.line / 2) {
        out.push(cur);
        cur = "";
        lineTop = rect.top;
      } else if (lineTop === null) lineTop = rect.top;
    }
    cur += ch;
  }
  out.push(cur);
  const lines = out.map((l) => l.trim()).filter((l) => l !== "");
  return seen && lines.length > 0 ? lines : [text];
}

interface Plan {
  lines: string[];
  tier: LetterTier;
  paperH: number;
  blockTop: number;
  schedule: WriteSchedule | null;
  /** 입력줄 윗변을 알 때만: 묶음 윗변 y, 묶음 높이 */
  box?: { top: number; h: number };
}

type FontState = "wait" | "ok" | "fallback";

// 유언 편지(결정 0063-3·0063-4, UI-SPEC C-1~C-3·C-5, 시안 WillCenter envelope). 줄 쳐진 편지지가 올라오고(700ms) 0.8초부터 줄이 차례로 써지고
// 쓰기가 끝나면 우측 하단에 실링왁스 인장이 찍히고 5초에 접힌다. 본문·이름은 React 텍스트 노드로만 그린다(사용자 글, T-09.1-29).
// 눈에 보이는 머리글·글 줄·인장·안내는 aria-hidden 이고 스크린리더는 보이지 않는 한 줄만 읽는다. 초점을 받지도 가두지도 않는다(T-09.1-30).
// 순서: ① 글꼴 로드를 최대 LETTER_FONT_WAIT_MS 기다린다(넘으면 대체 글꼴) ② 숨은 틀에서 글 단계(chooseTier)·줄·편지지 높이를 정한다
// ③ T0 까지 기다렸다 나타난다. 모든 지연은 T0 기준 시각에서 지난 시간 e 를 뺀 값이라 늦게 준비되거나 탭을 가렸다 돌아와도 시간표대로 끝난다
// (animationend 에 기대지 않고, 접힘·제거도 T0 기준 타이머와 visibilitychange 시계로 정한다).
export function WillLetter({ letter, reducedMotion, splitLines, getInputTop, onLive }: WillLetterProps) {
  const { text, name, t0 } = letter;
  const shellRef = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState<FontState>("wait");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [run, setRun] = useState<{ key: number; e: number } | null>(null);
  const [kick, setKick] = useState(0);
  const [gone, setGone] = useState(false);

  // ① 글꼴: 편지 상태가 생기면 부르고 1초까지만 기다린다. 실패·1초 초과·글꼴 API 없음은 대체 글꼴
  useEffect(() => {
    const fonts = typeof document === "undefined" ? undefined : (document as Document & { fonts?: { load?: (font: string, text: string) => Promise<unknown[]> } }).fonts;
    if (fonts === undefined || fonts === null || typeof fonts.load !== "function") {
      setFont("fallback");
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = new Promise<FontState>((resolve) => {
      timer = setTimeout(() => resolve("fallback"), LETTER_FONT_WAIT_MS);
    });
    const load = fonts.load(`${LETTER_TIERS[0].font}px "Nanum Pen Script"`, text).then(
      (list): FontState => (list.length > 0 ? "ok" : "fallback"),
      (): FontState => "fallback",
    );
    void Promise.race([load, wait]).then((state) => {
      if (alive) setFont(state);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [text]);

  // ② 글꼴이 정해진 뒤(측정 틀에 대체 글꼴 클래스가 반영된 커밋) 글 단계·줄·편지지 높이를 정한다
  useLayoutEffect(() => {
    if (font === "wait") return;
    const shell = shellRef.current;
    const textEl = shell?.querySelector<HTMLElement>("[data-measure-text]") ?? null;
    const split = (tier: LetterTier): string[] => (splitLines !== undefined ? splitLines(text, tier) : textEl !== null ? splitByRects(textEl, text, tier) : [text]);
    const announceH = shell?.querySelector("[data-measure-announce]")?.getBoundingClientRect().height ?? 0;
    const ah = announceH > 0 ? announceH : ANNOUNCE_H_GUESS;
    const rawInputTop = getInputTop?.() ?? null;
    const inputTop = rawInputTop !== null && rawInputTop > 0 ? rawInputTop : null;
    const avail = inputTop === null ? paperHeight(Number.POSITIVE_INFINITY) : inputTop - ANNOUNCE_TOP - ah - AVAIL_REST;
    let paperH = paperHeight(avail);
    const choice = chooseTier((tier) => split(tier).length, paperH - 56);
    // 3단계로도 넘으면 편지지를 가용 높이까지 키운다(하한 220 유지)
    if (choice.overflow) paperH = Math.max(LETTER_PAPER_MIN_H, avail === Number.POSITIVE_INFINITY ? paperH : avail);
    const tier = { font: choice.font, line: choice.line };
    const lines = split(tier);
    const top = ANNOUNCE_TOP + ah + ANNOUNCE_GAP;
    setPlan({
      lines,
      tier,
      paperH,
      blockTop: blockTop(paperH, lines.length, tier.line),
      schedule: writeSchedule(lines),
      ...(inputTop !== null && inputTop - INPUT_GAP - top > 0 ? { box: { top, h: inputTop - INPUT_GAP - top } } : {}),
    });
    // 한 번만 정한다 — 이후 화면 크기가 바뀌어도 줄을 다시 나누지 않는다(5초짜리 장면)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [font]);

  // ③ 쓸 것이 없으면 걷고, T0 전이면 T0 까지 기다렸다 켠다. 이미 지난 만큼 e 가 들어간다(글꼴이 늦게 준비된 경우)
  useEffect(() => {
    if (plan === null) return;
    if (plan.schedule === null) {
      setGone(true);
      return;
    }
    const e = Date.now() - t0;
    if (e >= LETTER_END_AT_MS) {
      setGone(true);
      return;
    }
    if (e < 0) {
      const id = setTimeout(() => setKick((k) => k + 1), -e);
      return () => clearTimeout(id);
    }
    setRun((r) => r ?? { key: 1, e });
  }, [plan, kick, t0]);

  // 제거는 T0 기준 시각(탭이 가려져 타이머가 밀려도 돌아오면 아래 visibilitychange 가 정리한다)
  useEffect(() => {
    const id = setTimeout(() => setGone(true), Math.max(0, t0 + LETTER_END_AT_MS - Date.now()));
    return () => clearTimeout(id);
  }, [t0]);

  // 탭을 가렸다 돌아오면 지난 구간을 건너뛴다: 지난 시간 e 를 다시 구해 지연을 새로 준다(요소를 새로 만들어 애니메이션을 e 부터)
  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === "hidden") return;
      const e = Date.now() - t0;
      if (e >= LETTER_END_AT_MS) setGone(true);
      else if (e >= 0) setRun((r) => (r === null ? r : { key: r.key + 1, e }));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [t0]);

  const shown = run !== null && !gone;
  useEffect(() => {
    onLive?.(shown);
    return () => onLive?.(false);
  }, [shown, onLive]);

  // 측정 틀: 계획이 서기 전에만 둔다. 편지지와 같은 좌우 폭에서 본문을 나눠 보고, 아침 알림 글자의 높이도 같은 모양으로 잰다
  const shell =
    plan === null ? (
      <div ref={shellRef} className={font === "fallback" ? "mf-letter-measure is-fallback" : "mf-letter-measure"} aria-hidden="true" data-letter-measure="">
        <p className="mf-letter-measure__text" data-measure-text="">
          {text}
        </p>
        <div className="mf-letter-measure__announce" data-measure-announce="">
          <div className="mf-announce__body">
            {letter.announce.icon !== undefined && <V2Icon name={letter.announce.icon} size={56} />}
            <span className="mf-announce__text">{letter.announce.text}</span>
          </div>
        </div>
      </div>
    ) : null;

  if (run === null || !shown || plan === null || plan.schedule === null) return shell;
  const { schedule } = plan;
  const e = run.e;
  const ms = (n: number): string => `${n - e}ms`;
  const rootCls = ["mf-letter", reducedMotion ? "is-still" : "", font === "fallback" ? "is-fallback" : ""].filter((c) => c !== "").join(" ");
  const rootVars: Record<string, string> = {};
  if (plan.box !== undefined) {
    rootVars["--lw-top"] = `${plan.box.top}px`;
    rootVars["--lw-h"] = `${plan.box.h}px`;
  }
  return (
    <>
      {shell}
      <div className={rootCls} data-will-letter="" role="status" style={css(rootVars)}>
        <span className="mf-letter__read" data-will-read="">
          {`${name} 님의 유언: ${text}`}
        </span>
        <div key={run.key} className="mf-letter__fold" aria-hidden="true" style={css({ "--lw-fold-delay": ms(schedule.foldAt) })}>
          <div className="mf-letter__rise" style={css({ "--lw-rise-delay": ms(0) })}>
            <div
              className="mf-letter__paper"
              style={css({ "--lw-font": `${plan.tier.font}px`, "--lw-line": `${plan.tier.line}px`, "--lw-paper-h": `${plan.paperH}px`, "--lw-pos": `${plan.blockTop}px` })}
            >
              <p className="mf-letter__head" data-will-head="">
                {`${name} 님의 유언`}
              </p>
              <div className="mf-letter__text" style={{ top: plan.blockTop, height: plan.lines.length * plan.tier.line }}>
                {plan.lines.map((line, i) => {
                  const w = schedule.lines[i];
                  if (w === undefined) return null;
                  return (
                    <p
                      key={i}
                      className="mf-letter__line"
                      data-will-line=""
                      data-write-at={w.at}
                      data-write-steps={w.steps}
                      style={css({ "--lw-delay": ms(w.at), "--lw-ms": `${w.ms}ms`, "--lw-steps": w.steps })}
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
              <Seal at={schedule.sealAt} delay={ms(schedule.sealAt)} />
            </div>
          </div>
          <div className="mf-letter__guide">
            <p className="mf-letter__guide-text" data-will-guide="">
              채팅에도 남아요
            </p>
            <div className="mf-letter__bar">
              <div className="mf-letter__fill" style={css({ "--lw-delay": ms(0) })} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** 실링왁스 인장(시안 SVG 그대로): 불규칙 가장자리 · 안쪽 테두리 원 둘 · 글자 두 겹(1px 어긋남) · 하이라이트 호. 글자는 SEAL_GLYPH 한 곳 */
function Seal({ at, delay }: { at: number; delay: string }) {
  const gradId = `lw-wax-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg className="mf-letter__seal" data-will-seal="" data-seal-at={at} aria-hidden="true" viewBox="0 0 100 100" width="84" height="84" style={css({ "--lw-delay": delay })}>
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
