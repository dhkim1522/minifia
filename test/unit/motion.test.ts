// 결정 0059 의 예측·섞기·방향·응답 판정 순수 계산(src/world/motion.ts). 시각은 모두 인자다.
import { describe, expect, it } from "vitest";
import { BAR_MAP } from "../../shared/game/map";
import { type WorldState, emptyWorld, requestMove, spawnPlayer } from "../../shared/game/world";
import { predictSegment } from "../../src/world/motion";

function oneWalker(now = 1000): WorldState {
  return spawnPlayer(emptyWorld(), "p0", 0, now, BAR_MAP);
}

function must<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
}

describe("predictSegment — 서버가 같은 시각에 같은 목적지를 받았을 때 만드는 구간과 같다 (결정 0059-1)", () => {
  it("서 있다 출발", () => {
    const w = oneWalker(1000);
    const dest = { x: 40, z: 360 };
    expect(predictSegment(w.segs.p0, dest, 2000)).toEqual(must(requestMove(w, "p0", dest, 2000, BAR_MAP)).seg);
  });

  it("걷는 중 새 목적지", () => {
    const walking = must(requestMove(oneWalker(1000), "p0", { x: -420, z: -120 }, 2000, BAR_MAP)).world;
    const dest = { x: 40, z: 360 };
    expect(predictSegment(walking.segs.p0, dest, 3000)).toEqual(must(requestMove(walking, "p0", dest, 3000, BAR_MAP)).seg);
  });

  it("기준 구간이 없으면 null", () => {
    expect(predictSegment(undefined, { x: 40, z: 360 }, 2000)).toBeNull();
  });
});
