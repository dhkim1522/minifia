import { useLayoutEffect, useRef } from "react";
import { TURN_COPY, type BlockLook } from "../../game/pickTurn";
import { SHOWDOWN_COPY } from "../../game/showdownView";
import "../../styles/v2.css";
import { QuoteCard } from "./QuoteCard";

// 순차 지목의 차례 알약 · 막대 · 위 한 줄(결정 0063-1, UI-SPEC A-1·A-2·A-3·A-5). 시안 design/v2.0/mockups-b/PickSeq.dc.html 54~64행.
// 동점 결선(09.1.1-14, UI-SPEC D)도 같은 부품이다: 알약은 `결선` · `{초}초` 두 조각, 막대 길이는 look.totalMs(결선 투표 5초).
// 마지막 3인(09.1.1-15, UI-SPEC E)도 같은 부품이다: 한마디 차례 `n / 3` · `{이름} 님 차례` · `{초}초`, 동시 지목 `지목` · `모두 동시에` · `{초}초`. 확정된 한마디는 알약 아래 인용 카드(quote)로 뜬다.
// 값은 모두 blockLook(turnLook) 한 곳에서 온다(헤더 시간 링과 같은 입력). 닉네임·문장은 React 텍스트 노드로만 그린다(T-09.1-18).
// 모이는 동안과 끝 알림에는 알약·막대가 없다. 압축형(compact)은 위 한 줄을 만들지 않는다(켜는 조건은 09.1-08).

export interface PickTurnBlockProps {
  /** 지목(day.turn)도 결선(day.runoff)도 아니면 null — 그때는 부품 자체를 그리지 않는다 */
  look: BlockLook | null;
  /** 위 한 줄 문장(없으면 null). 숨길 때는 마지막 글자를 남겨 페이드 아웃한다 */
  line: string | null;
  /** 마지막 3인의 확정된 한마디(알약 아래 인용 카드). 없으면 null — 사라질 때는 마지막 글을 남겨 페이드 아웃한다 */
  quote?: { text: string } | null;
  compact?: boolean;
  reducedMotion: boolean;
}

const pct = (ratio: number): string => `${Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10}%`;

/** 막대 채움: 초 경계마다 다음 경계 비율로 가고(선형 1000ms) 확정되면 멈춘다. 턴마다 새로 만들어 이전 차례의 폭에서 자라지 않게 한다 */
function Fill({ look, reducedMotion }: { look: BlockLook; reducedMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const hold = look.stage === "done";
  const totalSec = look.totalMs / 1000;
  // 모션 줄이기: 초 단위 계단. 아니면 다음 경계의 비율로 천천히
  const ratio = hold ? look.ratio : reducedMotion ? look.seconds / totalSec : Math.max(0, look.seconds - 1) / totalSec;
  const mountSeconds = useRef(look.seconds);
  // 처음 그려질 때 이번 초의 시작 비율에서 출발하게 한다(바로 다음 경계 폭으로 점프하지 않게)
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null || hold || reducedMotion) return;
    el.style.transition = "none";
    el.style.width = pct(mountSeconds.current / totalSec);
    void el.offsetWidth;
    el.style.transition = "";
    el.style.width = pct(Math.max(0, mountSeconds.current - 1) / totalSec);
    // 마운트 때 한 번(이후 폭은 React 가 정한다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className={hold || reducedMotion ? "mf-turn__fill is-hold" : "mf-turn__fill"} style={{ width: pct(ratio) }} />;
}

/** 마지막 3인 단계 표식 값(UI-SPEC "검사 가능하게 둘 것"): 모이기·한마디·동시 지목·공개 */
function showdownStep(look: BlockLook): string | undefined {
  if (look.mode === "speak") return look.stage === "gather" ? "gather" : "speak";
  if (look.mode === "point") return look.stage === "end" ? "reveal" : "point";
  return undefined;
}

export function PickTurnBlock({ look, line, quote = null, compact = false, reducedMotion }: PickTurnBlockProps) {
  const lastLine = useRef("");
  if (line !== null) lastLine.current = line;
  const lastQuote = useRef("");
  if (quote !== null) lastQuote.current = quote.text;
  // 재접속 첫 화면: 처음부터 보이던 인용 카드는 등장 모션 없이 바로 보인다(E-2)
  const mountedWithQuote = useRef(quote !== null);
  if (quote === null && lastQuote.current !== "") mountedWithQuote.current = false;
  // 재접속 첫 화면: 처음부터 차례 중이면 등장 모션 없이 바로 보인다(A-6)
  const mountedInTurn = useRef(look !== null && (look.stage === "turn" || look.stage === "done"));
  if (look === null) return null;
  const inTurn = look.stage === "turn" || look.stage === "done";
  const showLine = !compact && line !== null;
  return (
    <div
      className={compact ? "mf-turn is-compact" : "mf-turn"}
      data-turn-block=""
      data-turn-mode={look.mode}
      data-turn-no={look.no}
      {...(look.seat !== undefined ? { "data-turn-seat": look.seat } : {})}
      data-turn-tone={look.tone}
      {...(showdownStep(look) !== undefined ? { "data-showdown-step": showdownStep(look) } : {})}
    >
      {inTurn ? (
        <>
          <div className={mountedInTurn.current ? "mf-turn__pill is-still" : "mf-turn__pill"} role="status">
            {look.mode === "runoff" ? (
              <span className="mf-turn__count">{TURN_COPY.runoffPill}</span>
            ) : look.mode === "point" ? (
              <>
                <span className="mf-turn__count">{SHOWDOWN_COPY.pointPill}</span>
                <span className="mf-turn__name">{SHOWDOWN_COPY.allAtOnce}</span>
              </>
            ) : (
              <>
                <span className="mf-turn__count" aria-hidden="true">
                  {TURN_COPY.count(look.no, look.total)}
                </span>
                <span className="mf-turn__name">{look.name !== undefined ? TURN_COPY.turnOf(look.name) : ""}</span>
              </>
            )}
            <span className="mf-turn__sec" aria-hidden="true">
              {TURN_COPY.seconds(look.seconds)}
            </span>
          </div>
          <div className="mf-turn__bar" aria-hidden="true">
            <Fill key={`${look.mode}${look.no}`} look={look} reducedMotion={reducedMotion} />
          </div>
        </>
      ) : null}
      {quote !== null || lastQuote.current !== "" ? <QuoteCard text={quote?.text ?? lastQuote.current} visible={quote !== null} still={mountedWithQuote.current} /> : null}
      {compact ? null : (
        <p className={showLine ? "mf-turn__line is-on" : "mf-turn__line"} aria-hidden={showLine ? undefined : true}>
          {line ?? lastLine.current}
        </p>
      )}
    </div>
  );
}
