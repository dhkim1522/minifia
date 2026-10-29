import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { RoomView } from "../../shared/protocol";
import { Backdrop } from "../components/Backdrop";
import { PhaseBar } from "../components/PhaseBar";
import { RoleCard } from "../components/RoleCard";
import { Timer } from "../components/Timer";
import { allyNicknames } from "../game/roleText";
import { autoFlipDelayMs, initialCardState, onAutoTimer, onTap, sinceStartMs } from "../net/cardFace";
import type { CardState } from "../net/cardFace";
import "../styles/phase.css";

export interface RoleRevealProps {
  view: RoomView;
  /** 서버 시각 − 로컬 시각 */
  offset: number;
  /** [내 역할] 버튼. 모양은 RoomScreen 이 한 가지로 만들어 넘긴다 */
  myRoleButton: ReactNode;
  /** 카드가 앞면이 된 적이 있음을 알린다. 마운트 때 이미 앞면인 경우(5초 뒤 입장·새로고침)도 첫 effect 에서 한 번 부른다 */
  onSeenFront: () => void;
}

// S-05 역할 확인(15초). 테이블은 그리지 않는다(D-13 개정). 카드 면은 cardFace 가 정하고,
// 타이머는 서버 마감 시각 하나만 본다. 마감이 지나도 화면이 스스로 단계를 넘기지 않는다(서버 view 만 따름, T-01-46).
export function RoleReveal({ view, offset, myRoleButton, onSeenFront }: RoleRevealProps) {
  const role = view.me.role ?? null;
  const hasRole = role !== null;
  const endsAt = view.phaseEndsAt;
  const durationMs = view.phaseDurationMs;

  const initial = (): CardState =>
    initialCardState(endsAt !== null && durationMs !== null ? sinceStartMs(endsAt, durationMs, offset, Date.now()) : 0, hasRole);
  const [card, setCard] = useState<CardState>(initial);

  // 단계가 다시 시작되면(마감 시각이 바뀌면) 카드 상태를 처음부터 다시 정한다.
  const [seenEndsAt, setSeenEndsAt] = useState(endsAt);
  if (seenEndsAt !== endsAt) {
    setSeenEndsAt(endsAt);
    setCard(initial());
  }

  // 시작 5초에 저절로 앞면 — setTimeout 하나뿐이고 간격 타이머는 없다. 이미 잠겼으면 onAutoTimer 가 그대로 돌려준다.
  useEffect(() => {
    if (endsAt === null || durationMs === null || !hasRole) return;
    const delay = autoFlipDelayMs(endsAt, durationMs, offset, Date.now());
    if (delay <= 0) {
      setCard((s) => onAutoTimer(s, true));
      return;
    }
    const id = setTimeout(() => setCard((s) => onAutoTimer(s, true)), delay);
    return () => clearTimeout(id);
  }, [endsAt, durationMs, offset, hasRole]);

  // seenFront 가 참이면 알린다. 처음 참이 되는 전이만이 아니라 마운트 때 이미 참인 경우도 포함한다.
  const onSeenFrontRef = useRef(onSeenFront);
  onSeenFrontRef.current = onSeenFront;
  const seenFront = card.seenFront;
  useEffect(() => {
    if (seenFront) onSeenFrontRef.current();
  }, [seenFront]);

  const front = card.face === "front" && hasRole;
  const allies = allyNicknames(view);

  return (
    <Backdrop layout="game" scene="lobby" className="mf-reveal__backdrop">
      <main className="mf-root mf-reveal">
        <div className="mf-reveal__dim" aria-hidden="true" />
        <PhaseBar
          title="역할 확인"
          instruction={front ? "내 직업이에요" : "카드를 눌러 확인하세요"}
          extra={myRoleButton}
          timer={endsAt !== null && durationMs !== null ? <Timer endsAt={endsAt} durationMs={durationMs} offset={offset} /> : null}
        />
        <section className="mf-reveal__stage">
          <RoleCard role={role} face={card.face} allies={allies} onFlip={() => setCard((s) => onTap(s, hasRole))} />
        </section>
        <div className="mf-reveal__hints">
          <p className="mf-reveal__hint" data-guide="">
            {front ? "확인했으면 그대로 기다리세요" : "카드를 눌러 직업을 확인하세요"}
          </p>
          <p className="mf-reveal__sub">{front ? "카드를 다시 누르면 가려져요" : "다른 사람에게 보이지 않게 가려 주세요"}</p>
        </div>
      </main>
    </Backdrop>
  );
}
