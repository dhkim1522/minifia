import { useEffect, useState } from "react";
import { isAlive } from "../../shared/game/alive";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { Figure } from "../components/Figure";
import { useReducedMotion } from "../net/useReducedMotion";
import { sceneOfPhase } from "../game/scenes";
import type { SceneId } from "../game/scenes";
import { ROLE_TEXT } from "../game/roleText";
import { RESULT_FLIP_AT_MS, RESULT_SUMMARY_AT_MS, UNKNOWN_NAME, VERDICT_TEXT, endedSubtitle, summaryLines, winnerText } from "../game/verdict";
import "../styles/result.css";

export interface ResultScreenProps {
  /** result 가 있는 ended view. RoomScreen 이 result 없는 프레임은 이 화면으로 보내지 않는다 */
  view: RoomView & { result: NonNullable<RoomView["result"]> };
  /** [처음으로]: 방을 떠나 입장 정보를 지우고 처음 화면으로 간다(D-18) */
  onExit: () => void;
  /**
   * 같은 접속에서 이 화면으로 오기 직전 단계(RoomScreen 의 usePhaseArrival). 있으면 배경이 그 단계의 장면(dusk·morning)에서 night 로
   * 크로스페이드한다. 재접속·처음 마운트는 null/없음이라 night 한 장이 바로 보인다 — 장면이 마운트 뒤에 바뀌지 않으므로 instant 는 필요 없다.
   */
  arrivedFrom?: PhaseId | null | undefined;
}

// 결과 화면의 최종 상태(UI-SPEC 11, D-17·D-18): 헤더 바·타이머·하단 패널이 없는 세로 스크롤 본문 하나.
// 모든 사람의 직업은 view.result.seats 에서만 읽는다 — 이 파일이 직업 이름·그림을 만드는 유일한 곳이다(T-04-64, 다른 부품 props 에 결과·직업이 없다).
// 닉네임·탈락 여부는 모두에게 공개된 view.players 에서 자리 번호로 찾는다. 모든 문자열은 React 텍스트다(T-04-65).
// 모든 viewer(살아 있던 사람·탈락자·끊겼다 돌아온 사람)가 같은 화면이라 me 는 내 이름표 표시에만 쓴다. 연결 상태는 표시하지 않는다(끝난 판).
// 공개 연출 단계(04-26, UI-SPEC 11.2): neutral(0~300ms 중립 인물·이름표만) → flip(300~900ms 모든 카드가 한꺼번에 직업으로) → done(최종 상태).
// 같은 접속에서 execution·morning 으로부터 넘어온 마운트에서만 neutral 로 시작한다. 재접속·처음 마운트·모션 줄이기는 곧바로 done 이다.
type Stage = "neutral" | "flip" | "done";

export function ResultScreen({ view, onExit, arrivedFrom }: ResultScreenProps) {
  const { result } = view;
  const banner = winnerText(result.winner);
  const playerOf = (seat: number) => view.players.find((p) => p.seat === seat);
  const cardSeats = [...result.seats].sort((a, b) => a.seat - b.seat);
  const nicknameOf = (seat: number): string | undefined => playerOf(seat)?.nickname;
  const subtitle = endedSubtitle(result.summary);
  const rows = summaryLines(result.summary, view.day?.voteLog ?? [], nicknameOf);
  // 마운트 때 한 번 정한 '처음에 보이던 장면'(직전 단계의 장면). 배경이 night 로 크로스페이드한다.
  const [fromScene] = useState<SceneId | undefined>(() => (arrivedFrom ? sceneOfPhase(arrivedFrom) : undefined));
  // 마운트 때 한 번 정한 연출 여부. 모션 줄이기는 시간표를 돌리지 않고 처음부터 최종 상태다(UI-SPEC 13.4). 이후 view 가 다시 와도 되돌아가지 않는다.
  const reduced = useReducedMotion();
  const [reveal] = useState<boolean>(() => !reduced && (arrivedFrom === "execution" || arrivedFrom === "morning"));
  const [stage, setStage] = useState<Stage>(reveal ? "neutral" : "done");
  useEffect(() => {
    if (!reveal) return;
    const flip = setTimeout(() => setStage("flip"), RESULT_FLIP_AT_MS);
    const done = setTimeout(() => setStage("done"), RESULT_SUMMARY_AT_MS);
    return () => {
      clearTimeout(flip);
      clearTimeout(done);
    };
  }, [reveal]);
  const hidden = stage === "neutral" ? ("true" as const) : undefined; // 직업 이름·탈락: 뒤집히기 전엔 읽기 도구에도 숨긴다
  const pending = stage !== "done" ? ("true" as const) : undefined; // 요약·[처음으로]: 900ms 전엔 숨김, 눌리지 않는다

  return (
    <Backdrop layout="game" scene={sceneOfPhase("ended")} {...(fromScene !== undefined ? { fromScene } : {})} className="mf-result__backdrop">
      {result.winner === "mafiaWin" ? <div className="mf-result__glow" data-reveal={String(reveal)} aria-hidden="true" /> : null}
      <main className="mf-root mf-result" data-winner={result.winner} data-stage={stage} data-reveal={String(reveal)}>
        <div className="mf-result__inner">
          <header className="mf-result__head">
            <h1 className="mf-t-heading">{VERDICT_TEXT.endedTitle}</h1>
            {subtitle ? <p className="mf-result__sub">{subtitle}</p> : null}
          </header>

          <section className="mf-result__banner" data-winner={result.winner} aria-label={banner.title}>
            <div className="mf-result__band" aria-hidden="true" />
            <p className="mf-result__banner-title">{banner.title}</p>
            <p className="mf-result__banner-sub">{banner.sub}</p>
          </section>

          <ul className="mf-result__grid" aria-label="모든 사람의 직업">
            {cardSeats.map(({ seat, job }) => {
              const player = playerOf(seat);
              const dead = player !== undefined && !isAlive(player);
              const isMe = seat === view.me.seat;
              return (
                <li key={seat} className={`mf-result__card${dead ? " mf-result__card--dead" : ""}`} data-seat={seat}>
                  <div className="mf-result__figs">
                    <Figure seat={seat} roleArt={job} className={`mf-result__art${dead ? " mf-result__art--dead" : ""}`} />
                    {stage !== "done" ? <Figure seat={seat} className="mf-result__neutral" /> : null}
                  </div>
                  <span className={`mf-result__tag${isMe ? " mf-result__tag--me" : ""}`}>
                    <i className="mf-result__dot" style={{ background: `var(--seat-${(seat % 8) + 1})` }} />
                    <span>{player?.nickname ?? UNKNOWN_NAME}</span>
                  </span>
                  <span className={`mf-result__role${job === "mafia" ? " mf-result__role--mafia" : ""}`} aria-hidden={hidden}>
                    {ROLE_TEXT[job].name}
                  </span>
                  {dead ? (
                    <span className="mf-result__out" aria-hidden={hidden}>
                      탈락
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {rows.length > 0 ? (
            <section className="mf-result__sm mf-result__rise" aria-hidden={pending} aria-labelledby="mf-result-sm-title">
              <h2 id="mf-result-sm-title" className="mf-result__sm-title">
                {VERDICT_TEXT.summaryTitle}
              </h2>
              {rows.map((row) => (
                <div key={`${row.n}-${row.kind}`} className="mf-result__sm-row">
                  <span className="mf-result__sm-label">{row.label}</span>
                  <span className="mf-result__sm-text">{row.text}</span>
                </div>
              ))}
            </section>
          ) : null}

          <footer className="mf-result__foot mf-result__rise" aria-hidden={pending}>
            <Button variant="primary" block disabled={stage !== "done"} onClick={onExit}>
              {VERDICT_TEXT.homeButton}
            </Button>
            <p className="mf-result__note">{VERDICT_TEXT.roomCloseNote}</p>
          </footer>
        </div>
      </main>
    </Backdrop>
  );
}
