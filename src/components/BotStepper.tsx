import type { ReactElement } from "react";
import { MAX_TEST_BOTS } from "../../shared/protocol";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { Button } from "./Button";
import { Icon } from "./Icon";
import "../styles/testtools.css";

// 봇 수 조절 줄(결정 0024·0075): [−] N명 [+] [5명 채우기]. 테스트 도구 시트와 일반 방 [봇] 시트가 같이 쓴다.
// 숫자는 서버 view 의 me.testBots 를 따른다(낙관적 값 없음 — count 가 절대값이라 연타해도 같은 요청이다). 판단은 서버가 한다(결정 0002).

/** 채우기 버튼이 맞추는 총 인원 — 5명이면 네 직업이 모두 나온다(rolesInPlay). */
export const FILL_TO_PLAYERS = 5;

export function BotStepper({ view, canSend, send }: { view: RoomView; canSend: boolean; send: (msg: ClientMessage) => boolean | void }): ReactElement {
  const bots = view.me.testBots ?? 0;
  const humans = view.players.length - bots;
  const maxBots = Math.min(MAX_TEST_BOTS, view.maxPlayers - humans);
  const setBots = (count: number) => {
    if (canSend) send({ t: "testBots", count });
  };
  return (
    <section className="mf-tt-sheet__bots">
      <p className="mf-tt-sheet__label">봇</p>
      <div className="mf-tt-sheet__stepper">
        <Button
          variant="secondary"
          compact
          className="mf-tt-sheet__step"
          aria-label="봇 줄이기"
          icon={<Icon name="minus" size={18} />}
          disabled={!canSend || bots <= 0}
          onClick={() => setBots(bots - 1)}
        />
        <span className="mf-tt-sheet__count" aria-live="polite">{`${bots}명`}</span>
        <Button
          variant="secondary"
          compact
          className="mf-tt-sheet__step"
          aria-label="봇 늘리기"
          icon={<Icon name="plus" size={18} />}
          disabled={!canSend || bots >= maxBots}
          onClick={() => setBots(bots + 1)}
        />
        <Button variant="secondary" compact disabled={!canSend || view.players.length >= FILL_TO_PLAYERS} onClick={() => setBots(FILL_TO_PLAYERS - humans)}>
          5명 채우기
        </Button>
      </div>
    </section>
  );
}
