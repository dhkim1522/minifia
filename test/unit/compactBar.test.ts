import { describe, expect, it } from "vitest";
import { BAR_RUNOFF_SPOTS, layoutFor } from "../../shared/game/gather";
import { BAR_MAP, BAR_ROOM_HALF, BAR_SEATS_FX, BAR_SPAWNS, STAGE_SPOT, UNIT, cellCenterFx, lineWalkable, routeFx, snapToWalkable, walkableCells } from "../../shared/game/map";
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

  it("4·8인 모두 같은 좌석을 쓰고 죽은 사람의 자리는 비워 둔다", () => {
    const players = BAR_SEATS_FX.map((_, seat) => ({ id: `p${seat}`, seat, alive: seat !== 3 }));
    const world = players.reduce((state, pl) => spawnPlayer(state, pl.id, pl.seat, 0, BAR_MAP), emptyWorld());
    const state = { phase: "discussion", day: 2, map: "bar", players } as RoomState;
    const four = layoutFor({ ...state, players: state.players.slice(0, 4) }, world, 0)!;
    const eight = layoutFor(state, world, 0)!;
    expect(four.key).toBe("2:bar-table");
    expect(Object.values(four.slots)).toEqual(BAR_SEATS_FX.slice(0, 3));
    expect(eight.slots.p3).toBeUndefined();
    for (const id of Object.keys(four.slots)) expect(four.slots[id]).toEqual(eight.slots[id]);
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
