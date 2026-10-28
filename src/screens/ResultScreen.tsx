import { isAlive } from "../../shared/game/alive";
import type { RoomView } from "../../shared/protocol";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { Figure } from "../components/Figure";
import { sceneOfPhase } from "../game/scenes";
import { ROLE_TEXT } from "../game/roleText";
import { UNKNOWN_NAME, VERDICT_TEXT, winnerText } from "../game/verdict";
import "../styles/result.css";

export interface ResultScreenProps {
  /** result 가 있는 ended view. RoomScreen 이 result 없는 프레임은 이 화면으로 보내지 않는다 */
  view: RoomView & { result: NonNullable<RoomView["result"]> };
  /** [처음으로]: 방을 떠나 입장 정보를 지우고 처음 화면으로 간다(D-18) */
  onExit: () => void;
}

// 결과 화면의 최종 상태(UI-SPEC 11, D-17·D-18): 헤더 바·타이머·하단 패널이 없는 세로 스크롤 본문 하나.
// 모든 사람의 직업은 view.result.seats 에서만 읽는다 — 이 파일이 직업 이름·그림을 만드는 유일한 곳이다(T-04-64, 다른 부품 props 에 결과·직업이 없다).
// 닉네임·탈락 여부는 모두에게 공개된 view.players 에서 자리 번호로 찾는다. 모든 문자열은 React 텍스트다(T-04-65).
// 모든 viewer(살아 있던 사람·탈락자·끊겼다 돌아온 사람)가 같은 화면이라 me 는 내 이름표 표시에만 쓴다. 연결 상태는 표시하지 않는다(끝난 판).
export function ResultScreen({ view, onExit }: ResultScreenProps) {
  const { result } = view;
  const banner = winnerText(result.winner);
  const playerOf = (seat: number) => view.players.find((p) => p.seat === seat);
  const cardSeats = [...result.seats].sort((a, b) => a.seat - b.seat);

  return (
    <Backdrop layout="game" scene={sceneOfPhase("ended")} className="mf-result__backdrop">
      {result.winner === "mafiaWin" ? <div className="mf-result__glow" aria-hidden="true" /> : null}
      <main className="mf-root mf-result" data-winner={result.winner}>
        <div className="mf-result__inner">
          <header className="mf-result__head">
            <h1 className="mf-t-heading">{VERDICT_TEXT.endedTitle}</h1>
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
                  <Figure seat={seat} roleArt={job} className={`mf-result__art${dead ? " mf-result__art--dead" : ""}`} />
                  <span className={`mf-result__tag${isMe ? " mf-result__tag--me" : ""}`}>
                    <i className="mf-result__dot" style={{ background: `var(--seat-${(seat % 8) + 1})` }} />
                    <span>{player?.nickname ?? UNKNOWN_NAME}</span>
                  </span>
                  <span className={`mf-result__role${job === "mafia" ? " mf-result__role--mafia" : ""}`}>{ROLE_TEXT[job].name}</span>
                  {dead ? <span className="mf-result__out">탈락</span> : null}
                </li>
              );
            })}
          </ul>

          <footer className="mf-result__foot">
            <Button variant="primary" block onClick={onExit}>
              {VERDICT_TEXT.homeButton}
            </Button>
            <p className="mf-result__note">{VERDICT_TEXT.roomCloseNote}</p>
          </footer>
        </div>
      </main>
    </Backdrop>
  );
}
