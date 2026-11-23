import type { ReactNode } from "react";
import type { PublicPlayer } from "../../shared/protocol";
import { SUSPECT_TEXT } from "../game/suspectView";
import { PlayerName } from "./PlayerName";
import { PlayerPortrait } from "./PlayerPortrait";
import { V2Icon } from "./v2/V2Icon";
import type { WorldPick } from "./WorldStage";

export const SUSPECT_HOLD_MS = 700;

export interface TableControlsProps {
  players: readonly PublicPlayer[];
  focus?: number;
  selected?: number;
  readOnly?: boolean;
  pick?: WorldPick;
  notes?: ReadonlyMap<number, readonly number[]>;
  myNoteTarget?: number | undefined;
  suspectHold?: { seats: ReadonlySet<number>; onRelease(seat: number): void };
  holdingSuspect?: number | undefined;
  extra?: ReactNode;
  cards?: boolean;
  night?: { tally: ReadonlyMap<number, number>; sure?: number; callSeats?: ReadonlySet<number> };
  onChoose(seat: number): void;
}

export function TableControls({ players, focus, selected, readOnly = false, pick, notes, myNoteTarget, suspectHold, holdingSuspect, extra, cards = false, night, onChoose }: TableControlsProps) {
  return (
    <div className={`mf-table-controls${cards ? " mf-table-controls--cards" : ""}`} role="group"
      aria-label={pick?.group ?? "테이블 참가자"} data-table-controls="" data-face-list={night ? "" : undefined}>
      {players.map((player) => {
        const seat = player.seat;
        const count = notes?.get(seat)?.length ?? 0;
        const myNote = cards && myNoteTarget === seat;
        const tally = night?.tally.get(seat) ?? 0;
        const sure = night?.sure === seat;
        const call = night?.callSeats?.has(seat) === true;
        const chooseDisabled = readOnly || (pick !== undefined && (pick.disabled === true || !pick.seats.has(seat)));
        const canHold = cards && suspectHold?.seats.has(seat) === true;
        const disabled = chooseDisabled && !canHold;
        const name = chooseDisabled ? player.nickname : pick?.label(player.nickname, player.seat) ?? `${player.nickname} 님 바라보기`;
        const label = count > 0 ? `${name}, ${SUSPECT_TEXT.count(count)}${myNote ? ", 내 딱지 있음" : ""}`
          : sure ? `${name}, 확정` : tally > 0 ? `${name}, ${tally}명 선택` : name;
        const pressed = (pick ? pick.mine : selected ?? focus) === seat;
        return (
          <button key={seat} type="button" className={`mf-table-controls__seat${call ? " is-call" : ""}`}
            data-face={night && pick?.seats.has(seat) ? seat : undefined} data-call={call ? "" : undefined}
            data-suspect-holdable={canHold ? "" : undefined}
            data-table-seat={seat} data-table-readonly={readOnly ? "" : undefined} {...(pick !== undefined && pick.seats.has(seat) ? {
              "data-pick": seat,
              ...(pick.attr ? { [pick.attr]: seat } : {}),
            } : {})}
            aria-label={label} aria-pressed={pressed} disabled={disabled} aria-disabled={disabled || undefined}
            aria-keyshortcuts={canHold ? "Shift+Enter" : undefined}
            onKeyDown={(event) => {
              if (!canHold || !event.shiftKey || event.key !== "Enter" || event.repeat) return;
              event.preventDefault();
              suspectHold?.onRelease(seat);
            }}
            onClick={() => { if (!chooseDisabled) onChoose(seat); }}>
            {cards ? (
              <span className="mf-table-controls__portrait">
                <PlayerPortrait seat={seat} animal={player.animal} variant="participant" look={player.look} />
              </span>
            ) : <PlayerPortrait seat={seat} animal={player.animal} />}
            <PlayerName className="mf-table-controls__name" seat={seat}>{player.nickname}</PlayerName>
            {cards && pressed ? <span className="mv-face__mark" data-mark-icon="check" aria-hidden="true"><V2Icon name="check" size={18} /></span> : null}
            {count > 0 ? <span className="mf-table-controls__count" data-suspect-mine={myNote ? "" : undefined} aria-hidden="true">
              <V2Icon name={myNote ? "postitFilled" : "postit"} size={11} />{count}
            </span> : null}
            {holdingSuspect === seat ? (
              <svg className="mf-table-controls__suspect-progress" data-suspect-hold="" aria-hidden="true">
                <rect x="1.5%" y="1.5%" width="97%" height="97%" rx="8" pathLength="100" style={{ animationDuration: `${SUSPECT_HOLD_MS}ms` }} />
              </svg>
            ) : null}
            {sure ? <span className="mv-face__count" role="img" aria-label="확정"><V2Icon name="check" size={14} /></span>
              : tally > 0 ? <span className="mv-face__count" aria-hidden="true">{tally}</span> : null}
          </button>
        );
      })}
      {extra}
    </div>
  );
}
