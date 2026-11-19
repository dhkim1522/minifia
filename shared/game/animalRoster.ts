import { ANIMAL_IDS, animalForSeat, isAnimalId } from "./animals";
import type { AnimalId } from "./animals";
import type { Player, RoomState } from "./room";

/** 반영된 요청 사이의 최소 간격(ms). */
export const ANIMAL_PICK_MIN_GAP_MS = 250;

/** 방의 최대 인원보다 동물 종류가 많아서 새 입장에 빈 종이 하나 이상 있다. */
export function pickFreeAnimal(
  players: readonly Pick<Player, "animal">[],
  randInt: (n: number) => number,
): AnimalId {
  const taken = new Set(players.map((p) => p.animal));
  const available = ANIMAL_IDS.filter((animal) => !taken.has(animal));
  return available[randInt(available.length)]!;
}

/** 이미 받은 동물은 유지한다. 옛 방에서 비어 있거나 중복된 외형만 저장된 순서대로 채운다. */
export function normalizeAnimalRoster(state: RoomState): RoomState {
  const taken = new Set<AnimalId>();
  const kept = new Set<string>();
  for (const p of [...state.players, ...(state.bench ?? [])]) {
    if (!isAnimalId(p.animal) || taken.has(p.animal)) continue;
    taken.add(p.animal);
    kept.add(p.id);
  }

  if (kept.size === state.players.length + (state.bench?.length ?? 0)) return state;

  const fill = (p: Player): Player => {
    if (kept.has(p.id)) return p;
    const preferred = animalForSeat(p.seat);
    const animal = taken.has(preferred) ? ANIMAL_IDS.find((id) => !taken.has(id))! : preferred;
    taken.add(animal);
    return { ...p, animal };
  };
  return {
    ...state,
    players: state.players.map(fill),
    ...(state.bench === undefined ? {} : { bench: state.bench.map(fill) }),
  };
}

/** 공개 외형은 대기실의 참가자만 바꿀 수 있고 다른 참가자의 동물은 선점할 수 없다. */
export function setAnimal(state: RoomState, actorId: string, animal: AnimalId): RoomState | null {
  if (state.phase !== "lobby" || !isAnimalId(animal)) return null;
  const actor = state.players.find((p) => p.id === actorId);
  if (actor === undefined || actor.isBot === true) return null;
  if (actor.animal === animal) return state;
  if ([...state.players, ...(state.bench ?? [])].some((p) => p.animal === animal)) return null;
  return {
    ...state,
    players: state.players.map((p) => (p.id === actorId ? { ...p, animal } : p)),
  };
}
