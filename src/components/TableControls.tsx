import type { ReactNode } from "react";
import type { PublicPlayer } from "../../shared/protocol";
import { SUSPECT_TEXT } from "../game/suspectView";
import { PlayerPortrait } from "./PlayerPortrait";
import { V2Icon } from "./v2/V2Icon";
import type { WorldPick } from "./WorldStage";

interface TableControlsProps {
  players: readonly PublicPlayer[];
  focus?: number;
  selected?: number;
  readOnly?: boolean;
  pick?: WorldPick;
  notes: ReadonlyMap<number, readonly number[]>;
  extra?: ReactNode;
  onChoose(seat: number): void;
}

export function TableControls({ players, focus, selected, readOnly = false, pick, notes, extra, onChoose }: TableControlsProps) {
  return (
    <div className="mf-table-controls" role="group" aria-label={pick?.group ?? "테이블 참가자"} data-table-controls="">
      {players.map((player) => {
        const seat = player.seat;
        const count = notes.get(seat)?.length ?? 0;
        const disabled = readOnly || (pick !== undefined && (pick.disabled === true || !pick.seats.has(seat)));
        const name = pick?.label(player.nickname, player.seat) ?? (readOnly ? player.nickname : `${player.nickname} 님 바라보기`);
        return (
          <button key={seat} type="button" className="mf-table-controls__seat"
            data-table-seat={seat} data-table-readonly={readOnly ? "" : undefined} {...(pick !== undefined && pick.seats.has(seat) ? {
              "data-pick": seat,
              ...(pick.attr ? { [pick.attr]: seat } : {}),
            } : {})}
            aria-label={count > 0 ? `${name}, ${SUSPECT_TEXT.count(count)}` : name}
            aria-pressed={(pick ? pick.mine : selected ?? focus) === seat} disabled={disabled} onClick={() => onChoose(seat)}>
            <PlayerPortrait seat={seat} animal={player.animal} />
            <span className="mf-table-controls__name">{player.nickname}</span>
            {count > 0 ? <span className="mf-table-controls__count" aria-hidden="true"><V2Icon name="postit" size={11} />{count}</span> : null}
          </button>
        );
      })}
      {extra}
    </div>
  );
}
