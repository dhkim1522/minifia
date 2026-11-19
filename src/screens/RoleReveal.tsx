import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { Button } from "../components/Button";
import { RoleCard } from "../components/RoleCard";
import { GamePhaseHeader } from "../components/v2/GamePhaseHeader";
import { V2Icon } from "../components/v2/V2Icon";
import { callTargetsOf } from "../game/hostLine";
import { allyNicknames } from "../game/roleText";
import { ownAnimalOf } from "../game/playerIdentity";
import { autoFlipDelayMs, initialCardState, onAutoTimer, onTap, sinceStartMs } from "../net/cardFace";
import type { CardState } from "../net/cardFace";
import "../styles/phase.css";

export interface RoleRevealProps {
  view: RoomView;
  /** 서버 시각 − 로컬 시각 */
  offset: number;
  /** 연결 번호. 재연결 뒤 조기 진행 표시를 초기화한다 */
  epoch?: number;
  /** [내 역할] 버튼. 모양은 RoomScreen 이 한 가지로 만들어 넘긴다 */
  myRoleButton: ReactNode;
  /** 카드가 앞면이 된 적이 있음을 알린다. 마운트 때 이미 앞면인 경우(5초 뒤 입장·새로고침)도 첫 effect 에서 한 번 부른다 */
  onSeenFront: () => void;
  send?: (msg: ClientMessage) => boolean | void;
  canSend?: boolean;
}

// S-05 역할 확인(15초). 테이블은 그리지 않는다(D-13 개정). 뒤 3D 무대는 PreGame 이 깐다. 카드 면은 cardFace 가 정하고,
// 마감이 지나도 화면이 스스로 단계를 넘기지 않는다(서버 view 만 따름, T-01-46).
// 제목과 역할 버튼 사이에 공용 시간 막대를 표시한다.
// 카드 빛남(HOST-03): callTargetsOf 가 "카드"를 부르면 카드가 빛나고, 처음 앞면을 보면 꺼진다(되살아나지 않는다).
export function RoleReveal(props: RoleRevealProps) {
  return props.view.playtest === true ? <PlaytestRoleReveal {...props} /> : <FlippingRoleReveal {...props} />;
}

function PlaytestRoleReveal({ view, offset, epoch = 0, myRoleButton, onSeenFront, send, canSend }: RoleRevealProps) {
  const role = view.me.role ?? null;
  const ready = view.me.roleReady === true;
  useEffect(() => {
    if (role !== null) onSeenFront();
  }, [role, onSeenFront]);
  return (
    <main className="mf-root mf-reveal" data-playtest-role="">
      <div className="mf-reveal__dim" aria-hidden="true" />
      <header className="mf-reveal__header">
        <GamePhaseHeader title="내 역할" view={view} offset={offset} epoch={epoch} extra={myRoleButton} />
      </header>
      <section className="mf-reveal__stage">
        <RoleCard
          role={role}
          animal={ownAnimalOf(view)}
          face={role === null ? "back" : "front"}
          allies={allyNicknames(view)}
          action={role === null ? null : ready ? (
            <span className="mf-playtest__ready-status" role="status">
              <V2Icon name="check" size={20} /> 확인했어요
            </span>
          ) : (
            <Button variant="secondary" compact block disabled={!canSend} data-role-ready="" onClick={() => send?.({ t: "roleReady" })}>
              확인
            </Button>
          )}
        />
      </section>
    </main>
  );
}

function FlippingRoleReveal({ view, offset, epoch = 0, myRoleButton, onSeenFront }: RoleRevealProps) {
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

  // 18페이즈(D-09): 공개 예고 줄 삭제 — 빈 칸은 레이아웃을 지킨다

  const allies = allyNicknames(view);
  // 빛남 조건은 me.role 유무와 카드를 봤는가(내 클라이언트 상태)뿐이다 — 모든 역할이 같은 모양(T-14-15)
  const callTarget = callTargetsOf(view, { cardSeen: card.seenFront });
  const callCard = callTarget?.kind === "tool" && callTarget.tool === "card";

  return (
    <main className="mf-root mf-reveal">
      <div className="mf-reveal__dim" aria-hidden="true" />
      <header className="mf-reveal__header">
        <GamePhaseHeader title="역할 확인" view={view} offset={offset} epoch={epoch} extra={myRoleButton} />
      </header>
      <section className="mf-reveal__stage">
        <RoleCard role={role} animal={ownAnimalOf(view)} face={card.face} allies={allies} call={callCard} onFlip={() => setCard((s) => onTap(s, hasRole))} />
      </section>
      <div className="mf-reveal__hints" />
    </main>
  );
}
