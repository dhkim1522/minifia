import { useLayoutEffect, useRef } from "react";
import { PICK_TURN_MS } from "../../../shared/game/phases";
import { TURN_COPY, type TurnLook } from "../../game/pickTurn";

// 순차 지목의 차례 알약 · 막대 · 위 한 줄(결정 0063-1, UI-SPEC A-1·A-2·A-3·A-5). 시안 design/v2.0/mockups-b/PickSeq.dc.html 54~64행.
// 값은 모두 turnLook 한 곳에서 온다(헤더 시간 링과 같은 입력). 닉네임·문장은 React 텍스트 노드로만 그린다(T-09.1-18).
// 모이는 동안과 끝 알림에는 알약·막대가 없다. 압축형(compact)은 위 한 줄을 만들지 않는다(켜는 조건은 09.1-08).

export interface PickTurnBlockProps {
  /** 지목이 아니거나 day.turn 이 없으면 null — 그때는 부품 자체를 그리지 않는다 */
  look: TurnLook | null;
  /** 위 한 줄 문장(없으면 null). 숨길 때는 마지막 글자를 남겨 페이드 아웃한다 */
  line: string | null;
  compact?: boolean;
  reducedMotion: boolean;
}

const TURN_SEC = PICK_TURN_MS / 1000;
const pct = (ratio: number): string => `${Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10}%`;

/** 막대 채움: 초 경계마다 다음 경계 비율로 가고(선형 1000ms) 확정되면 멈춘다. 턴마다 새로 만들어 이전 차례의 폭에서 자라지 않게 한다 */
function Fill({ look, reducedMotion }: { look: TurnLook; reducedMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const hold = look.stage === "done";
  // 모션 줄이기: 초 단위 계단. 아니면 다음 경계의 비율로 천천히
  const ratio = hold ? look.ratio : reducedMotion ? look.seconds / TURN_SEC : Math.max(0, look.seconds - 1) / TURN_SEC;
  const mountSeconds = useRef(look.seconds);
  // 처음 그려질 때 이번 초의 시작 비율에서 출발하게 한다(바로 다음 경계 폭으로 점프하지 않게)
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null || hold || reducedMotion) return;
    el.style.transition = "none";
    el.style.width = pct(mountSeconds.current / TURN_SEC);
    void el.offsetWidth;
    el.style.transition = "";
    el.style.width = pct(Math.max(0, mountSeconds.current - 1) / TURN_SEC);
    // 마운트 때 한 번(이후 폭은 React 가 정한다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className={hold || reducedMotion ? "mf-turn__fill is-hold" : "mf-turn__fill"} style={{ width: pct(ratio) }} />;
}

export function PickTurnBlock({ look, line, compact = false, reducedMotion }: PickTurnBlockProps) {
  const lastLine = useRef("");
  if (line !== null) lastLine.current = line;
  // 재접속 첫 화면: 처음부터 차례 중이면 등장 모션 없이 바로 보인다(A-6)
  const mountedInTurn = useRef(look !== null && (look.stage === "turn" || look.stage === "done"));
  if (look === null) return null;
  const inTurn = look.stage === "turn" || look.stage === "done";
  const showLine = !compact && line !== null;
  return (
    <div
      className={compact ? "mf-turn is-compact" : "mf-turn"}
      data-turn-block=""
      data-turn-no={look.no}
      {...(look.seat !== undefined ? { "data-turn-seat": look.seat } : {})}
      data-turn-tone={look.tone}
    >
      {inTurn ? (
        <>
          <div className={mountedInTurn.current ? "mf-turn__pill is-still" : "mf-turn__pill"} role="status">
            <span className="mf-turn__count" aria-hidden="true">
              {TURN_COPY.count(look.no, look.total)}
            </span>
            <span className="mf-turn__name">{look.name !== undefined ? TURN_COPY.turnOf(look.name) : ""}</span>
            <span className="mf-turn__sec" aria-hidden="true">
              {TURN_COPY.seconds(look.seconds)}
            </span>
          </div>
          <div className="mf-turn__bar" aria-hidden="true">
            <Fill key={look.no} look={look} reducedMotion={reducedMotion} />
          </div>
        </>
      ) : null}
      {compact ? null : (
        <p className={showLine ? "mf-turn__line is-on" : "mf-turn__line"} aria-hidden={showLine ? undefined : true}>
          {line ?? lastLine.current}
        </p>
      )}
    </div>
  );
}
