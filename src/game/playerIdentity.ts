import { ANIMALS, type AnimalId } from "../../shared/game/animals";
import { MAX_PLAYERS } from "../../shared/protocol";
import type { RoomView } from "../../shared/protocol";
import { seatColorVar } from "../net/assets";

export function ownAnimalOf(view: RoomView | null): AnimalId | undefined {
  return view?.players.find((player) => player.seat === view.me.seat)?.animal;
}

export function playerColor(seat: number, animal?: AnimalId): string {
  return animal === undefined ? seatColorVar(seat) : ANIMALS[animal].color;
}

/** 공개 좌석에서 정한다. 동물·역할·선택 상태가 바뀌어도 닉네임은 같은 색이다. */
export function playerNameColor(seat: number | undefined): string | undefined {
  if (seat === undefined || !Number.isInteger(seat) || seat < 0 || seat >= MAX_PLAYERS) return undefined;
  return `var(--player-name-${seat + 1})`;
}
