import { describe, expect, it } from "vitest";
import { BAR_MAP } from "../../shared/game/map";
import { PLAZA_MAP } from "../../shared/game/mapPlaza";
import { ROOM_MAP_ID, mapOf } from "../../shared/game/maps";
import { assignRoles } from "../../shared/game/roles";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { seededRandInt } from "../helpers/seededRandom";

const HOST = "player-id-0000-aaaa";

function lobby(n = 4): RoomState {
  const created = createRoomState({ code: "0420", hostId: HOST, hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: "이름0", now: 0 });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, HOST, "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

describe("재즈 바 고정 맵", () => {
  it("방의 맵은 재즈 바이며 개발용 광장 데이터도 읽을 수 있다", () => {
    expect(ROOM_MAP_ID).toBe("bar");
    expect(mapOf(ROOM_MAP_ID)).toBe(BAR_MAP);
    expect(mapOf("plaza")).toBe(PLAZA_MAP);
  });

  it.each([undefined, "random", "bar", "plaza"] as const)("저장한 맵 선택 %s와 상관없이 재즈 바에서 시작한다", (mapChoice) => {
    const state: RoomState = { ...lobby(), ...(mapChoice !== undefined ? { mapChoice } : {}) };
    const result = startGame(state, HOST, 1000, seededRandInt(5));
    expect(result.ok && result.state.map).toBe("bar");
  });

  it("재즈 바는 라운드가 시작되면 논리 좌석 사이에 빈 번호가 있어도 물리 의자를 고정한다", () => {
    const state = lobby();
    const seats = [0, 2, 4, 7];
    const result = startGame({ ...state, players: state.players.map((p, i) => ({ ...p, seat: seats[i]! })) }, HOST, 1000, seededRandInt(5));
    expect(result.ok && result.state.barChairs).toEqual({ 0: 0, 2: 2, 4: 4, 7: 5 });
  });
  it("맵 결정은 난수를 쓰지 않으므로 역할 배정에 필요한 난수만 부른다", () => {
    const state = lobby(5);
    const ids = [...state.players].sort((a, b) => a.seat - b.seat).map((p) => p.id);
    const callsOf = (run: (rnd: (n: number) => number) => void): number[] => {
      const calls: number[] = [];
      const base = seededRandInt(9);
      run((n) => (calls.push(n), base(n)));
      return calls;
    };
    const rolesOnly = callsOf((rnd) => void assignRoles(ids, rnd));
    const withStart = callsOf((rnd) => void startGame(state, HOST, 1000, rnd));
    expect(withStart).toEqual(rolesOnly);
  });
});
