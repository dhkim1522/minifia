import { useCallback, useEffect, useState } from "react";
import type { KeywordAnswerRow, RoomView } from "../../shared/protocol";
import { SUSPECT_TEXT } from "../game/suspectView";
import { Button } from "./Button";
import { PlayerName } from "./PlayerName";
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
          <span data-answer-speaker=""><PlayerName seat={player?.seat}>{name}</PlayerName>{turn.seat === mySeat ? " (나)" : ""}</span>
          <span className="mf-answer-presentation__order" aria-label={`${turn.total}명 중 ${turn.order}번째`}>{turn.order}/{turn.total}</span>
        </div>
        <p className="mf-answer-presentation__text" data-answer-content="" data-answer-none={turn.text === null ? "" : undefined}>{turn.text ?? "미제출"}</p>
      </div>
      {onSuspect !== undefined ? (
        <AnswerSuspectAction turnKey={`${turn.order}:${turn.seat}`} name={name} canSuspect={canSuspect} marked={marked}
          onSuspect={turn.seat === mySeat ? undefined : onSuspect} />
      ) : null}
    </div>
  );
}

function AnswerSuspectAction({ turnKey, name, canSuspect, marked, onSuspect }: {
  turnKey: string;
  name: string;
  canSuspect: boolean;
  marked: boolean;
  onSuspect: (() => void) | undefined;
}) {
  const [pointer, setPointer] = useState<{ id: number; turnKey: string }>();
  if (pointer !== undefined && pointer.turnKey !== turnKey) setPointer(undefined);
  const release = useCallback((event: { pointerId: number }) => {
    setPointer((held) => held?.id === event.pointerId ? undefined : held);
  }, []);

  useEffect(() => {
    if (pointer === undefined) return;
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    return () => {
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
    };
  }, [pointer, release]);

  return (
    <div className="mf-answer-presentation__action"
      onPointerDown={(event) => {
        // 모바일의 :active가 늦게 켜져도 누르는 순간부터 보인다. 클릭과 스크롤은 브라우저가 처리한다.
        if (!canSuspect || marked || !event.isPrimary || event.button !== 0 ||
          (event.pointerType !== "touch" && event.pointerType !== "pen")) return;
        if (event.target instanceof Element && event.target.closest("[data-answer-suspect]")) {
          setPointer({ id: event.pointerId, turnKey });
        }
      }}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      {onSuspect !== undefined ? (
        <Button variant="secondary" compact className="mf-answer-presentation__suspect" data-answer-suspect="" aria-pressed={marked}
          data-answer-suspect-touch={pointer?.turnKey === turnKey && canSuspect && !marked ? "" : undefined}
          aria-label={SUSPECT_TEXT.target(name, marked)}
          icon={<V2Icon name={marked ? "postitFilled" : "postit"} size={18} />} disabled={!canSuspect} onClick={onSuspect}>
          {marked ? SUSPECT_TEXT.clear : SUSPECT_TEXT.ready}
        </Button>
      ) : null}
    </div>
  );
}
