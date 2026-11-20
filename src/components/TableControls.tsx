import type { PublicPlayer } from "../../shared/protocol";
import { PlayerPortrait } from "./PlayerPortrait";
import { V2Icon } from "./v2/V2Icon";
import type { WorldPick } from "./WorldStage";

interface TableControlsProps {
  players: readonly PublicPlayer[];
  mode: "eye" | "wide";
  focus?: number;
  pick?: WorldPick;
  notes: ReadonlyMap<number, readonly number[]>;
  onChoose(seat: number): void;
  onToggle(): void;
}

export function TableControls({ players, mode, focus, pick, notes, onChoose, onToggle }: TableControlsProps) {
  return (
    <div className="mf-table-controls" role="group" aria-label={pick?.group ?? "테이블 시점과 참가자"} data-table-controls="">
      <button type="button" className="mf-table-controls__view" data-table-view={mode} onClick={onToggle}
        aria-label={mode === "eye" ? "테이블 전체 보기" : "내 자리 눈높이"} aria-pressed={mode === "wide"}>
        {mode === "eye" ? "전체" : "눈높이"}
      </button>
      {players.map((player) => {
        const seat = player.seat;
        const count = notes.get(seat)?.length ?? 0;
        const disabled = pick !== undefined && (pick.disabled === true || !pick.seats.has(seat));
        const name = pick?.label(player.nickname) ?? `${player.nickname} 님 바라보기`;
        return (
          <button key={seat} type="button" className="mf-table-controls__seat"
            data-table-seat={seat} {...(pick !== undefined && pick.seats.has(seat) ? {
              "data-pick": seat,
              ...(pick.attr ? { [pick.attr]: seat } : {}),
            } : {})}
            aria-label={count > 0 ? `${name}, 의심딱지 ${count}장` : name}
            aria-pressed={pick ? pick.mine === seat : focus === seat} disabled={disabled} onClick={() => onChoose(seat)}>
            <PlayerPortrait seat={seat} animal={player.animal} />
            <span className="mf-table-controls__name">{player.nickname}</span>
            {count > 0 ? <span className="mf-table-controls__count" aria-hidden="true"><V2Icon name="postit" size={11} />{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
