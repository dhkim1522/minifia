import type { KeywordAnswerRow, RoomView } from "../../shared/protocol";
import { Button } from "./Button";
import { PlayerPortrait } from "./PlayerPortrait";
import { V2Icon } from "./v2/V2Icon";
import "../styles/answer-presentation.css";

interface AnswerPresentationProps {
  turn: KeywordAnswerRow & { total: number };
  player: RoomView["players"][number] | undefined;
  mySeat: number;
  marked: boolean;
  canSuspect: boolean;
  onSuspect?: () => void;
}

export function AnswerPresentation({ turn, player, mySeat, marked, canSuspect, onSuspect }: AnswerPresentationProps) {
  const name = player?.nickname ?? `${turn.seat + 1}번 자리`;
  return (
    <div className="mf-answer-presentation" data-answer-presentation="" data-answer-seat={turn.seat} data-answer-order={turn.order}>
      <div className="mf-answer-presentation__answer" aria-live="polite" aria-atomic="true">
        <div className="mf-answer-presentation__speaker">
          <PlayerPortrait seat={turn.seat} animal={player?.animal} className="mf-answer-presentation__portrait" />
          <span data-answer-speaker="">{name}{turn.seat === mySeat ? " (나)" : ""}</span>
          <span className="mf-answer-presentation__order" aria-label={`${turn.total}명 중 ${turn.order}번째`}>{turn.order}/{turn.total}</span>
        </div>
        <p className="mf-answer-presentation__text" data-answer-content="" data-answer-none={turn.text === null ? "" : undefined}>{turn.text ?? "미제출"}</p>
      </div>
      {onSuspect !== undefined ? (
        <div className="mf-answer-presentation__action">
          {turn.seat !== mySeat ? (
            <Button variant="secondary" compact className="mf-answer-presentation__suspect" data-answer-suspect="" aria-pressed={marked}
              aria-label={marked ? `${name} 님에게 의심딱지를 붙였어요` : `${name} 님에게 의심딱지 붙이기`}
              icon={<V2Icon name={marked ? "check" : "postit"} size={18} />} disabled={!canSuspect || marked} onClick={onSuspect}>
              {marked ? "붙였어요" : "의심 붙이기"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
