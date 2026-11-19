import { ANIMALS, type AnimalId } from "../../shared/game/animals";
import type { RoomView } from "../../shared/protocol";
import { seatColorVar } from "../net/assets";

export function ownAnimalOf(view: RoomView | null): AnimalId | undefined {
  return view?.players.find((player) => player.seat === view.me.seat)?.animal;
}

export function playerColor(seat: number, animal?: AnimalId): string {
  return animal === undefined ? seatColorVar(seat) : ANIMALS[animal].color;
}
