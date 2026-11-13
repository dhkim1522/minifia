// 컷어웨이 판정 순수 모듈 시험(20-05, D-10·D-11, UI-SPEC P20-8): 어느 방을 걷을지는 구역과 roomsOpen 만으로 정해진다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROOM_IDS } from "../../shared/protocol";
import { HEAD_TOP_Y, TO_CAMERA } from "../../shared/game/map";
import { TOWN_HOUSES, TOWN_OBSTACLES, TOWN_ROOMS } from "../../shared/game/mapTown";
import { cutawayOf, headVeiled, sameRooms, tapTarget } from "../../src/world/cutaway";
import { rayHitsAnalytic } from "../helpers/mapRaster";

const sorted = (s: ReadonlySet<string>): string => [...s].sort().join(",");

describe("cutawayOf (D-10·D-11)", () => {
  it("방 안이면 그 방 하나만 열린다", () => {
    for (const id of ROOM_IDS) expect(sorted(cutawayOf(id, false))).toBe(id);
  });

  it("광장·구역을 모르는 상태(내 몸이 아직 없음)는 모두 덮인다(빈 집합)", () => {
    expect(cutawayOf("plaza", false).size).toBe(0);
    expect(cutawayOf(null, false).size).toBe(0);
  });

  it("유령·결과 화면(all)이면 어느 구역이든 네 방 모두 열린다", () => {
    for (const zone of [null, "plaza", "post", "pub", "clinic", "police"] as const) expect(sorted(cutawayOf(zone, true))).toBe(sorted(new Set(ROOM_IDS)));
  });

  it("sameRooms 는 내용으로 같음을 본다", () => {
    expect(sameRooms(cutawayOf("post", false), new Set(["post"] as const))).toBe(true);
    expect(sameRooms(cutawayOf("post", false), cutawayOf("pub", false))).toBe(false);
    expect(sameRooms(new Set(), cutawayOf("plaza", false))).toBe(true);
  });

  it("cutaway.ts 는 three·DOM 을 읽지 않는다(소스 규약)", () => {
    const src = readFileSync(new URL("../../src/world/cutaway.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from\s+["']three["']/);
    expect(src).not.toMatch(/\b(document|window)\b/);
  });

  it("cutaway.ts 는 삼각함수·난수를 쓰지 않는다(주석 제외, 20-06)", () => {
    const src = readFileSync(new URL("../../src/world/cutaway.ts", import.meta.url), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    expect(src).not.toMatch(/Math\.(sin|cos|tan|atan|atan2|random)\b/);
  });
});

const NONE: ReadonlySet<"post" | "pub" | "clinic" | "police"> = new Set();
const only = (id: "post" | "pub" | "clinic" | "police"): ReadonlySet<"post" | "pub" | "clinic" | "police"> => new Set([id]);

describe("headVeiled (20-06, P20-12): 닫힌 방에 머리가 가려지는 칸", () => {
  it("술집 문 칸(서벽 줄의 걷는 가운데 두 칸) 중심은 술집이 닫혀 있으면 가려진다(이마)", () => {
    expect(headVeiled(6.75, -0.25, NONE)).toBe(true);
    expect(headVeiled(6.75, 0.25, NONE)).toBe(true);
  });

  it("광장 가운데 칸과 우체국 front 는 가려지지 않는다", () => {
    expect(headVeiled(0.25, 0.25, NONE)).toBe(false);
    expect(headVeiled(-0.25, -5.75, NONE)).toBe(false);
  });

  it("우체국 안 자리는 닫혀 있으면 가려지고(지붕) 열려 있으면 아니다(지붕·앞벽을 뺀 뒷벽은 광선 반대쪽)", () => {
    expect(headVeiled(-0.25, -8.25, NONE)).toBe(true);
    expect(headVeiled(-0.25, -8.25, only("post"))).toBe(false);
    expect(headVeiled(-0.25, -8.25, only("pub"))).toBe(true);
  });

  it("마스크를 만든 것과 같은 판정이다: 모든 격자 칸 중심·열린 방 다섯 경우에서 rayHitsAnalytic 의 방 장애물 판정과 같다", () => {
    const opens = [NONE, only("post"), only("pub"), only("clinic"), new Set(["post", "pub", "clinic", "police"] as const)];
    let compared = 0;
    for (const open of opens) {
      for (let r = 0; r < 48; r++) {
        for (let c = 0; c < 48; c++) {
          const x = -12 + 0.25 + c * 0.5;
          const z = -12 + 0.25 + r * 0.5;
          const want = TOWN_OBSTACLES.some((o) => o.room !== undefined && !(o.cut === true && open.has(o.room)) && rayHitsAnalytic(o, x, HEAD_TOP_Y, z));
          if (headVeiled(x, z, open) !== want) throw new Error(`${x},${z} open=${[...open].join("+")} want ${want}`);
          compared++;
        }
      }
    }
    expect(compared).toBe(5 * 48 * 48);
  });
});

/** 월드 점 p 를 지나는 카메라 광선(정사영): 원점은 카메라 쪽으로 멀리, 방향은 −TO_CAMERA */
const rayThrough = (p: { x: number; y: number; z: number }) => ({
  origin: { x: p.x + TO_CAMERA.x * 3, y: p.y + TO_CAMERA.y * 3, z: p.z + TO_CAMERA.z * 3 },
  dir: { x: -TO_CAMERA.x, y: -TO_CAMERA.y, z: -TO_CAMERA.z },
});
const room = (id: string) => TOWN_ROOMS.find((r) => r.id === id)!;
const w = (fx: { x: number; z: number }) => ({ x: fx.x / 100, z: fx.z / 100 });
const FAR = { x: 0, z: 0 };

describe("tapTarget (20-06, D-19·P20-11): 지붕·집·열린 방 뒷벽 누르기", () => {
  it("닫힌 우체국 지붕 가운데를 지나면 me 가 광장일 때 우체국 front", () => {
    const got = tapTarget(rayThrough({ x: 0, y: 2.3, z: -8.3 }), FAR, NONE);
    expect(got).toEqual(w(room("post").front));
  });

  it("me 가 front 에서 1.0 안(0.5 떨어짐)이면 방 안 자리 inside", () => {
    const f = w(room("post").front);
    const got = tapTarget(rayThrough({ x: 0, y: 2.3, z: -8.3 }), { x: f.x, z: f.z + 0.5 }, NONE);
    expect(got).toEqual(w(room("post").inside));
  });

  it("me 가 front 에서 1.0 보다 멀면(1.5) 다시 front", () => {
    const f = w(room("post").front);
    expect(tapTarget(rayThrough({ x: 0, y: 2.3, z: -8.3 }), { x: f.x, z: f.z + 1.5 }, NONE)).toEqual(f);
  });

  it("술집·진료소처럼 문이 카메라 반대쪽인 방도 지붕을 누르면 front 다", () => {
    expect(tapTarget(rayThrough({ x: 8.3, y: 2.3, z: 0 }), FAR, NONE)).toEqual(w(room("pub").front));
    expect(tapTarget(rayThrough({ x: 0, y: 2.3, z: 8.3 }), FAR, NONE)).toEqual(w(room("clinic").front));
  });

  it("집 좌석 3 의 몸통을 지나면 그 집 front", () => {
    const h = TOWN_HOUSES.find((x) => x.seat === 3)!;
    expect(tapTarget(rayThrough({ x: h.x, y: 1.0, z: h.z }), FAR, NONE)).toEqual(w(h.front));
  });

  it("열린 우체국의 북쪽 뒷벽을 지나면 우체국 안쪽 사각형을 0.4 줄인 사각형 안", () => {
    const got = tapTarget(rayThrough({ x: 0, y: 1.5, z: -9.85 }), FAR, only("post"))!;
    expect(got).not.toBeNull();
    const i = room("post").inner;
    expect(got.x).toBeGreaterThanOrEqual(i.x0 / 100 + 0.4 - 1e-9);
    expect(got.x).toBeLessThanOrEqual(i.x1 / 100 - 0.4 + 1e-9);
    expect(got.z).toBeGreaterThanOrEqual(i.z0 / 100 + 0.4 - 1e-9);
    expect(got.z).toBeLessThanOrEqual(i.z1 / 100 - 0.4 + 1e-9);
    expect(got.z).toBeCloseTo(i.z0 / 100 + 0.4, 6); // 벽 바로 안쪽
  });

  it("열린 방의 바닥 가운데(지붕·앞벽이 걷힌 곳)나 광장 바닥만 지나는 광선은 null", () => {
    expect(tapTarget(rayThrough({ x: 0, y: 0, z: -8.25 }), FAR, only("post"))).toBeNull();
    expect(tapTarget(rayThrough({ x: 0.25, y: 0, z: 0.25 }), FAR, NONE)).toBeNull();
  });

  it("방과 집이 한 광선에 겹치면 카메라에 가까운(광선 매개변수가 작은) 쪽: 술집 몸통 낮은 곳을 눌러도 앞의 집 3 몸통이 먼저다", () => {
    const h = TOWN_HOUSES.find((x) => x.seat === 3)!;
    expect(tapTarget(rayThrough({ x: 7.6, y: 0.2, z: 2.2 }), FAR, NONE)).toEqual(w(h.front));
  });

  it("반환값은 새 객체다(안에 있는 표를 건네주지 않는다)", () => {
    const a = tapTarget(rayThrough({ x: 0, y: 2.3, z: -8.3 }), FAR, NONE)!;
    a.x = 99;
    expect(tapTarget(rayThrough({ x: 0, y: 2.3, z: -8.3 }), FAR, NONE)!.x).not.toBe(99);
  });
});
