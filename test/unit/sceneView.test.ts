// 21-10 아침 현장 순수 파생(D-13~D-16·D-26, UI-SPEC P21-10·P21-12·P21-16): spotsOf·actableSpotOf·clueCardsOf 는 순수 함수이고 역할을 읽지 않는다.
// 읽는 값은 판 규칙·단계·맵 id·day.scene.house(공개)·내가 살핀 줄(me.scene)뿐이다. 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표로 이은 문자열로 비교한다.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UNIT } from "../../shared/game/map";
import { TOWN_CLUE_SPOTS } from "../../shared/game/mapTown";
import type { ClueLine, PhaseId, PublicPlayer, RoleId, RoomView } from "../../shared/protocol";
import { actableSpotOf, clueCardsOf, spotsOf } from "../../src/game/sceneView";
import { openCause } from "../helpers/playable";

function viewOf(o: { phase?: PhaseId; role?: RoleId; house?: number | null; scene?: ClueLine[]; mode?: "basic" | "extended" } = {}): RoomView {
  const players: PublicPlayer[] = [0, 1, 2, 3, 4].map((seat) => ({ seat, nickname: `닉${seat}`, connected: true, isHost: seat === 0 }));
  const house = o.house === undefined ? 3 : o.house;
  const me: Record<string, unknown> = { seat: 0, isHost: true, ...(o.role === undefined ? {} : { role: o.role }), ...(o.scene === undefined ? {} : { scene: o.scene }) };
  const day: Record<string, unknown> = { n: 1, roles: [], ...(house === null ? {} : { scene: { house } }) };
  return { code: "0042", phase: o.phase ?? "morning", phaseEndsAt: null, phaseDurationMs: null, serverNow: 0, minPlayers: 4, maxPlayers: 8, players, me, day, map: "town", mode: o.mode ?? "extended" } as unknown as RoomView;
}

const states = (v: RoomView): string => spotsOf(v).map((s) => `${s.id}:${s.state}`).join(",");

describe("spotsOf (원인 흐름 아침 지점)", () => {
  let restore: () => void = () => {};
  beforeAll(() => {
    restore = openCause();
  });
  afterAll(() => restore());

  it("현장 집 3 의 지점 셋(발자국·옷 조각·창문)을 맵 표(TOWN_CLUE_SPOTS[3])의 좌표(월드 단위)로 돌려주고 모두 new 이다", () => {
    const spots = spotsOf(viewOf());
    expect(spots.map((s) => s.id).join(",")).toBe("footprint,cloth,window");
    expect(spots.map((s) => `${s.x},${s.z}`).join("|")).toBe(TOWN_CLUE_SPOTS[3]!.map((c) => `${c.x / UNIT},${c.z / UNIT}`).join("|"));
    expect(states(viewOf())).toBe("footprint:new,cloth:new,window:new");
  });

  it("내가 살핀 줄이 없는 지점은 new, 단서를 받았거나 아무것도 없으면 done(내가 살핌)", () => {
    expect(states(viewOf({ scene: [{ spot: "cloth", r: "clue", piece: "blackCloth" }] }))).toBe("footprint:new,cloth:done,window:new");
    expect(states(viewOf({ scene: [{ spot: "footprint", r: "none" }] }))).toBe("footprint:done,cloth:new,window:new");
    expect(states(viewOf({ scene: [{ spot: "footprint", r: "clue", n: 2 }, { spot: "cloth", r: "clue", piece: "pin" }, { spot: "window", r: "none" }] }))).toBe("footprint:done,cloth:done,window:done");
  });

  it("먼저 손댄 흔적(touched)과 어두워서 못 봄(dark)은 둘 다 dim — 사유는 why 로만 다르다", () => {
    const v = viewOf({ scene: [{ spot: "window", r: "dark" }, { spot: "footprint", r: "touched" }] });
    expect(states(v)).toBe("footprint:dim,cloth:new,window:dim");
    expect(spotsOf(v).map((s) => s.why ?? "-").join(",")).toBe("touched,-,dark");
  });

  it("아침이 아니거나 현장이 없거나 기본판이면 빈 배열", () => {
    expect(spotsOf(viewOf({ phase: "discussion" }))).toEqual([]);
    expect(spotsOf(viewOf({ phase: "night" }))).toEqual([]);
    expect(spotsOf(viewOf({ house: null }))).toEqual([]);
    expect(spotsOf(viewOf({ mode: "basic" }))).toEqual([]);
  });

  it("마피아·경찰·의사·시민 view(같은 me.scene)의 결과가 같다", () => {
    const scene: ClueLine[] = [{ spot: "cloth", r: "clue", piece: "navyThread" }, { spot: "window", r: "dark" }];
    const base = JSON.stringify(spotsOf(viewOf({ scene })));
    for (const role of ["mafia", "police", "doctor", "citizen"] as const) {
      expect(JSON.stringify(spotsOf(viewOf({ scene, role })))).toBe(base);
      expect(JSON.stringify(clueCardsOf(viewOf({ scene, role })))).toBe(JSON.stringify(clueCardsOf(viewOf({ scene }))));
    }
  });
});

describe("actableSpotOf (살펴볼 수 있는 지점)", () => {
  let restore: () => void = () => {};
  beforeAll(() => {
    restore = openCause();
  });
  afterAll(() => restore());

  // 집 1: 발자국 (3.75, -5.75) · 옷 조각 (4.75, -5.75) · 창문 (5.75, -5.75) — 서로 1.0 간격
  const v1 = (scene?: ClueLine[]) => viewOf({ house: 1, ...(scene === undefined ? {} : { scene }) });

  it("반경 1.2 안 new 중 가장 가까운 지점의 id, 반경 밖이면 null, 위치를 모르면 null", () => {
    const spots = spotsOf(v1());
    expect(actableSpotOf({ x: 4.75, z: -5.75 }, spots)).toBe("cloth");
    expect(actableSpotOf({ x: 5.6, z: -5.75 }, spots)).toBe("window");
    expect(actableSpotOf({ x: 9, z: 9 }, spots)).toBeNull();
    expect(actableSpotOf(null, spots)).toBeNull();
    expect(actableSpotOf(undefined, spots)).toBeNull();
  });

  it("경계(거리 정확히 1.2)는 안이고 그보다 멀면 밖이다(서버 inspectSpot 과 같은 정수 거리)", () => {
    const spots = spotsOf(v1());
    expect(actableSpotOf({ x: 3.75 - 1.2, z: -5.75 }, spots)).toBe("footprint");
    expect(actableSpotOf({ x: 3.75 - 1.21, z: -5.75 }, spots)).toBeNull();
  });

  it("거리가 같으면 발자국 → 옷 조각 → 창문 순(서버와 같은 순서)", () => {
    expect(actableSpotOf({ x: 4.25, z: -5.75 }, spotsOf(v1()))).toBe("footprint");
    expect(actableSpotOf({ x: 5.25, z: -5.75 }, spotsOf(v1()))).toBe("cloth");
  });

  it("이미 살핀 지점(done)·손댄 흔적·어두워서 못 본 지점(dim)은 후보가 아니다 — 그 밖의 가장 가까운 new 가 이긴다", () => {
    expect(actableSpotOf({ x: 4.75, z: -5.75 }, spotsOf(v1([{ spot: "cloth", r: "clue", piece: "pin" }])))).toBe("footprint");
    expect(actableSpotOf({ x: 4.75, z: -5.75 }, spotsOf(v1([{ spot: "cloth", r: "touched" }, { spot: "footprint", r: "none" }])))).toBe("window");
    expect(actableSpotOf({ x: 4.75, z: -5.75 }, spotsOf(v1([{ spot: "cloth", r: "none" }, { spot: "footprint", r: "none" }, { spot: "window", r: "dark" }])))).toBeNull();
  });
});

describe("clueCardsOf (내가 받은 단서 카드)", () => {
  let restore: () => void = () => {};
  beforeAll(() => {
    restore = openCause();
  });
  afterAll(() => restore());

  it("me.scene 순서대로 카드 값을 돌려준다 — 발자국 수는 내가 살핀 경우만", () => {
    const v = viewOf({
      scene: [
        { spot: "window", r: "dark" },
        { spot: "footprint", r: "clue", n: 2 },
        { spot: "cloth", r: "clue", piece: "grayThread" },
      ],
    });
    expect(clueCardsOf(v)).toEqual([{ spot: "window", kind: "dark" }, { spot: "footprint", kind: "clue", n: 2 }, { spot: "cloth", kind: "clue", piece: "grayThread" }]);
  });

  it("touched·none 도 카드가 된다(단서 값 없이)", () => {
    expect(clueCardsOf(viewOf({ scene: [{ spot: "footprint", r: "touched" }, { spot: "cloth", r: "none" }] }))).toEqual([{ spot: "footprint", kind: "touched" }, { spot: "cloth", kind: "none" }]);
  });

  it("살핀 줄이 없거나 기본판 view 면 빈 배열", () => {
    expect(clueCardsOf(viewOf())).toEqual([]);
    expect(clueCardsOf(viewOf({ mode: "basic", scene: [{ spot: "cloth", r: "clue", piece: "pin" }] }))).toEqual([]);
  });
});

describe("역할을 읽지 않는다 (T-21-36)", () => {
  it("sceneView.ts 의 코드(주석 제외)에 .role 읽기가 없다", () => {
    const code = readFileSync("src/game/sceneView.ts", "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    expect(code).not.toMatch(/\.role\b/);
    expect(code).not.toMatch(/\bmafia\b/);
  });
});
