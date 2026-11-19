import { describe, expect, it } from "vitest";
import { ANIMAL_IDS } from "../../shared/game/animals";
import { normalizeAnimalRoster, setAnimal } from "../../shared/game/animalRoster";
import { createRoomState, joinRoom } from "../../shared/game/room";
import { setBotCount } from "../../shared/game/testTools";
import { buildView } from "../../shared/game/view";
import type { Player, RoomState } from "../../shared/game/room";

function lobby(): RoomState {
  const created = createRoomState(
    { code: "0123", hostId: "host", hostToken: "host-token", hostNickname: "방장", now: 0 },
    (n) => n - 1,
  );
  if (!created.ok) throw new Error(created.error);
  return created.state;
}

describe("방의 동물 선택", () => {
  it("방장·손님·봇에게 서로 다른 빈 동물을 배정한다", () => {
    const initial = lobby();
    const joined = joinRoom(initial, { playerId: "guest", token: "guest-token", nickname: "손님" }, (n) => n - 1);
    if (!joined.ok) throw new Error(joined.error);
    let botId = 0;
    const full = setBotCount(joined.state, "host", 6, () => `bot${botId++}`, () => 0, (n) => n - 1);
    if (!full.ok) throw new Error(full.error);
    expect(full.state.players.map((p) => p.animal)).toEqual([...ANIMAL_IDS].reverse().slice(0, 8));
  });

  it("예전 방을 채울 때 이미 배정된 동물을 우선 보존하고 같은 저장값을 다시 바꾸지 않는다", () => {
    const initial = lobby();
    const host = initial.players[0]!;
    const { animal: _removed, ...legacyHost } = host;
    const guest = { ...host, id: "guest", seat: 1, animal: "rabbit" as const };
    const duplicate = { ...guest, id: "other", seat: 2 };
    const old = { ...initial, players: [legacyHost, guest, duplicate], phase: "night" as const };
    const normalized = normalizeAnimalRoster(old);
    expect(normalized.phase).toBe("night");
    expect(normalized.players.map((p) => p.animal)).toEqual(["elephant", "rabbit", "crocodile"]);
    expect(normalized.players[1]).toBe(guest);
    expect(normalizeAnimalRoster(normalized)).toBe(normalized);
  });

  it("대기실에서만 고를 수 있고 벤치 예약은 종 이름만 공개한다", () => {
    const initial = lobby();
    const bench: Player = { ...initial.players[0]!, id: "rest", seat: 1, animal: "elephant" };
    const reserved = { ...initial, bench: [bench] };
    expect(buildView(reserved, "host", 0).reservedAnimals).toEqual(["elephant"]);
    expect(buildView(reserved, "host", 0).players.map((p) => p.seat)).toEqual([0]);
    expect(setAnimal(reserved, "host", "elephant")).toBeNull();
    const picked = setAnimal(reserved, "host", "rabbit");
    expect(picked?.players[0]?.animal).toBe("rabbit");
    expect(picked?.bench).toBe(reserved.bench);
    expect(setAnimal({ ...reserved, phase: "discussion" }, "host", "rabbit")).toBeNull();
    expect(buildView({ ...reserved, phase: "discussion" }, "host", 0).reservedAnimals).toBeUndefined();
  });

  it("벤치 자리도 총원과 동물 예약에 포함한다", () => {
    const initial = lobby();
    const bench = ANIMAL_IDS.slice(0, 4).map((animal, seat) => ({
      ...initial.players[0]!,
      id: `bench${seat}`,
      seat: seat + 4,
      animal,
    }));
    let botId = 0;
    const full = setBotCount({ ...initial, bench }, "host", 7, () => `bot${botId++}`, () => 0, (n) => n - 1);
    if (!full.ok) throw new Error(full.error);
    expect(full.state.players).toHaveLength(4);
    expect(new Set([...full.state.players, ...bench].map((p) => p.animal)).size).toBe(8);
    expect(joinRoom(full.state, { playerId: "guest", token: "guest-token", nickname: "손님" }))
      .toEqual({ ok: false, error: "ROOM_FULL" });
  });
});
