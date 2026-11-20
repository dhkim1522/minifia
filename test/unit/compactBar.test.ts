import { describe, expect, it } from "vitest";
import { BAR_RUNOFF_SPOTS, layoutFor } from "../../shared/game/gather";
import { BAR_MAP, BAR_ROOM_HALF, BAR_SEATS_FX, BAR_SPAWNS, STAGE_SPOT, UNIT, barChairAssignment, cellCenterFx, lineWalkable, routeFx, snapToWalkable, walkableCells } from "../../shared/game/map";
import { canMoveIn } from "../../shared/game/movement";
import { stickNote } from "../../shared/game/postit";
import type { RoomState } from "../../shared/game/room";
import { emptyWorld, restSegment, restoreWorld, spawnPlayer } from "../../shared/game/world";

const p = ([x, z]: readonly [number, number]) => ({ x, z });
const seats = BAR_SEATS_FX.map(p);
const spawns = BAR_SPAWNS.map(({ x, z }) => p([Math.round(x * UNIT), Math.round(z * UNIT)]));
const points = [...seats, ...spawns, STAGE_SPOT, ...BAR_RUNOFF_SPOTS.map(p)];

describe("작은 재즈 바", () => {
  it("폭 9.4 내의 통로는 이어지고 중앙 무대·의자는 정확한 끝점으로만 진입한다", () => {
    expect(BAR_ROOM_HALF * 2).toBe(9.4);
    expect(snapToWalkable(BAR_MAP, { x: 581, z: 400 }).x).toBe(435);
    expect(lineWalkable(BAR_MAP, seats[0]!, seats[1]!)).toBe(false);
    const allFloors = walkableCells(BAR_MAP).map(({ c, r }) => cellCenterFx(c, r, BAR_MAP));
    for (const end of allFloors) expect(routeFx(BAR_MAP, spawns[0]!, end).slice(-2)).toEqual([end.x, end.z]);
    for (const start of points) {
      for (const end of points) {
        const route = routeFx(BAR_MAP, start, end);
        expect(route.slice(0, 2)).toEqual([start.x, start.z]);
        expect(route.slice(-2)).toEqual([end.x, end.z]);
        for (let i = 0; i < route.length - 2; i += 2) {
          expect(lineWalkable(BAR_MAP, p([route[i]!, route[i + 1]!]), p([route[i + 2]!, route[i + 3]!]))).toBe(true);
        }
      }
    }
  });

  it("4~8인 모두 정면 자리를 포함해 한 바퀴에 분산한다", () => {
    const patterns = [[0, 2, 4, 5], [0, 1, 2, 4, 5], [0, 1, 2, 3, 6, 7], [0, 1, 2, 3, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]];
    for (const pattern of patterns) {
      const roster = Array.from({ length: pattern.length }, (_, seat) => seat).reverse();
      expect(Object.values(barChairAssignment(roster))).toEqual(pattern);
    }
  });

  it("논리 좌석에 빈 번호가 있고 탈락·재접속을 거쳐도 판의 물리 의자를 유지한다", () => {
    const players = [0, 2, 5, 7].map((seat) => ({ id: `p${seat}`, seat, connected: seat !== 5, alive: seat !== 2 }));
    const barChairs = barChairAssignment(players.map((p) => p.seat));
    const world = players.reduce((state, pl) => spawnPlayer(state, pl.id, pl.seat, 0, BAR_MAP), emptyWorld());
    const state = { phase: "discussion", day: 2, map: "bar", players } as RoomState;
    const four = layoutFor(state, world, 0)!; // 기존 저장에는 barChairs가 없다
    expect(four.key).toBe("2:bar-table");
    expect(four.slots).toEqual({ p0: BAR_SEATS_FX[0], p5: BAR_SEATS_FX[4], p7: BAR_SEATS_FX[5] });
    const restored = JSON.parse(JSON.stringify({
      ...state, barChairs, day: 3, players: players.map((p) => ({ ...p, connected: true })),
    })) as RoomState;
    expect(layoutFor(restored, world, 0)?.slots).toEqual(four.slots);
  });

  it("유언자는 자기 의자에서 중앙 무대로 이동하고 처형 때 이미 도착했으면 다시 옮기지 않는다", () => {
    const players = [0, 1, 2, 3].map((seat) => ({ id: `p${seat}`, seat }));
    const barChairs = barChairAssignment(players.map((p) => p.seat));
    const state = { phase: "defense", day: 2, map: "bar", players, barChairs, verdict: { passed: true, candidate: 1 } } as RoomState;
    const own = BAR_SEATS_FX[2];
    const world = { ...emptyWorld(), segs: { p1: restSegment(...own, 0) } };
    expect(layoutFor(state, world, 0)?.moves).toEqual([{ playerId: "p1", dest: STAGE_SPOT }]);
    expect(routeFx(BAR_MAP, p(own), STAGE_SPOT)).toEqual([...own, 0, 0]);
    const executed = { ...state, phase: "execution", players: state.players.map((player) => ({ ...player, alive: player.seat !== 1 })) } as RoomState;
    expect(layoutFor(executed, { ...world, segs: { p1: restSegment(0, 0, 0) } }, 0)?.moves).toEqual([]);
  });

  it("좌석에 고정된 바 토론은 원거리 산 상대 선택을 허용하고, 광장과 유령의 이동은 기존대로다", () => {
    const players = [{ id: "a", seat: 0 }, { id: "b", seat: 1 }, { id: "c", seat: 2, alive: false }];
    const state = { phase: "discussion", day: 2, map: "bar", players } as RoomState;
    const world = { segs: { a: restSegment(-200, 0, 0), b: restSegment(200, 0, 0), c: restSegment(199, 0, 0) } };
    expect(canMoveIn("discussion", true, "bar")).toBe(false);
    expect(canMoveIn("discussion", false, "bar")).toBe(true);
    expect(canMoveIn("discussion", true, "plaza")).toBe(true);
    expect(stickNote(state, world, "a", 1, 0).ok).toBe(true);
    expect(stickNote(state, world, "a", 2, 0).ok).toBe(false);
    expect(stickNote({ ...state, map: "plaza" }, world, "a", 1, 0).ok).toBe(false);
  });

  it("옛 방 경계 밖 좌표를 복원할 때 안전한 입장 지점과 바닥으로 맞춘다", () => {
    const saved = { v: 1, segs: { a: restSegment(540, 490, 0) }, home: { day: 2, pos: { a: [540, 490] } } };
    const restored = restoreWorld(saved, [{ id: "a", seat: 0 }], 500, BAR_MAP);
    expect(restored.segs.a).toEqual(restSegment(spawns[0]!.x, spawns[0]!.z, 500));
    expect(restored.home?.pos.a).toEqual([435, 435]);
  });
});
