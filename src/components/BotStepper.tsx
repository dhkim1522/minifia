import type { ReactElement } from "react";
import { MAX_PLAYERS, MAX_TEST_BOTS, MIN_PLAYERS } from "../../shared/protocol";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { Button } from "./Button";
import { Icon } from "./Icon";
import "../styles/testtools.css";

// 테스트 도구 시트와 대기실 봇 시트가 서버의 현재 봇 수와 전체 인원을 공유한다.
const PLAYER_TOTALS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, index) => MIN_PLAYERS + index);

export function BotStepper({ view, canSend, send }: { view: RoomView; canSend: boolean; send: (msg: ClientMessage) => boolean | void }): ReactElement {
  const bots = view.me.testBots ?? 0;
  const total = view.players.length;
  const humans = total - bots;
  const maxBots = Math.max(0, Math.min(MAX_TEST_BOTS, view.maxPlayers - humans));
  const setBots = (count: number) => {
    if (canSend) send({ t: "testBots", count });
  };
  return (
    <section className="mf-tt-sheet__bots">
      <div className="mf-tt-sheet__stepper" role="group" aria-label="봇 수">
        <p className="mf-tt-sheet__label">봇 수</p>
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
      </div>
      <div className="mf-tt-sheet__fill-label">
        <p className="mf-tt-sheet__label">전체 인원</p>
        <span className="mf-tt-sheet__player-total" aria-live="polite">{`${total}/${view.maxPlayers}명`}</span>
      </div>
      <div className="mf-tt-sheet__fill-grid" role="group" aria-label="전체 인원 맞추기">
        {PLAYER_TOTALS.map((target) => {
          const count = target - humans;
          const current = target === total;
          const unavailable = target < view.minPlayers || count < 0 || count > maxBots;
          return (
            <Button
              key={target}
              variant="secondary"
              compact
              className="mf-tt-sheet__fill"
              aria-label={`${target}명 채우기`}
              aria-pressed={current}
              disabled={!canSend || current || unavailable}
              onClick={() => setBots(count)}
            >
              {`${target}명`}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
