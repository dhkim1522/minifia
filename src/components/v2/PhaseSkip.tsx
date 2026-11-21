import { useEffect, useRef } from "react";
import type { ClientMessage, RoomView } from "../../../shared/protocol";
import { usePendingServerTime } from "../../net/usePendingServerTime";
import { useViewChoice } from "../../net/useViewChoice";
import { HeadCount } from "./HeadCount";
import { V2Icon } from "./V2Icon";

export interface PhaseSkipControls {
  canSend: boolean;
  send: (msg: ClientMessage) => boolean | void;
  rejected?: number;
  tutorial?: boolean;
}

export function PhaseSkip({ view, offset, canSend, send, rejected = 0, tutorial = false }: PhaseSkipControls & { view: RoomView; offset: number }) {
  const practice = tutorial && view.phase === "discussion" && view.day?.endCount !== undefined;
  const skip = practice
    ? { opensAt: view.serverNow + 3000, canVote: true, count: view.day?.endCount ?? 0, total: view.players.length }
    : view.phaseSkip;
  const pending = usePendingServerTime(skip?.canVote ? skip.opensAt : undefined, offset);
  const confirmed = practice ? view.me.endDiscussion === true : view.me.phaseSkip === true;
  const [pressed, choose] = useViewChoice(view, confirmed);
  const seenRejections = useRef(rejected);
  useEffect(() => {
    if (seenRejections.current === rejected) return;
    seenRejections.current = rejected;
    choose(confirmed);
  }, [choose, confirmed, rejected]);

  if (!skip?.canVote || pending !== undefined) return null;
  const { opensAt, count, total } = skip;
  const onToggle = () => {
    if (!canSend) return;
    const on = pressed !== true;
    const message: ClientMessage = practice ? { t: "endDiscussion", on } : { t: "phaseSkip", opensAt, on };
    if (send(message) !== false) choose(on);
  };

  return (
    <button
      key={opensAt}
      type="button"
      className="mf-phase-skip"
      data-phase-skip=""
      data-end-discussion={view.phase === "discussion" ? "" : undefined}
      aria-label={`스킵, ${total}명 중 ${count}명 동의`}
      aria-pressed={pressed === true}
      aria-disabled={!canSend || undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
    >
      <V2Icon name={pressed ? "check" : "skip"} size={16} />
      <span>스킵</span>
      <HeadCount count={count} total={total} />
    </button>
  );
}
