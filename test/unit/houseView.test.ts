// 21-09 밤 집 문패 파생(D-10·D-25, UI-SPEC P21-3~P21-5): houseTagsOf 는 순수 함수이고 역할을 읽지 않는다.
// 문패 8개(좌석 0~7)마다 { 주인 있음·산 사람의 집만 단추·창 점 켜짐(houseLitOf 와 같은 값)·고름·빛남 }을 돌려준다.
// 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표로 이은 문자열로 비교한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PhaseId, PublicPlayer, RoleId, RoomView } from "../../shared/protocol";
import { houseTagsOf } from "../../src/game/houseView";
import { houseLitOf } from "../../src/game/lampView";
import { openCause } from "../helpers/playable";

const LAMPS = [true, false, true, true, false, false, true, false];

function viewOf(o: { phase?: PhaseId; role?: RoleId; seat?: number; pick?: number; dead?: number[]; seats?: number[]; mode?: "basic" | "extended"; lamps?: boolean[] | null } = {}): RoomView {
  const seats = o.seats ?? [0, 1, 2, 3, 4, 5];
  const dead = new Set(o.dead ?? [5]);
  const players: PublicPlayer[] = seats.map((seat) => ({ seat, nickname: `닉${seat}`, connected: true, isHost: seat === 0, ...(dead.has(seat) ? { alive: false } : {}) }));
  const me: Record<string, unknown> = { seat: o.seat ?? 0, isHost: false, ...(o.role === undefined ? {} : { role: o.role }), ...(o.pick === undefined ? {} : { pick: o.pick }) };
  const day: Record<string, unknown> = { n: 1, roles: [], ...(o.lamps === null ? {} : { lamps: o.lamps ?? LAMPS }) };
  return { code: "0042", phase: o.phase ?? "night", phaseEndsAt: null, phaseDurationMs: null, serverNow: 0, minPlayers: 4, maxPlayers: 8, players, me, day, map: "town", mode: o.mode ?? "extended" } as unknown as RoomView;
}

const key = (v: RoomView, local?: { pick?: number }): string => houseTagsOf(v, local).map((t) => `${t.seat}:${t.button ? "B" : "-"}${t.lit ? "L" : "-"}${t.picked ? "P" : "-"}${t.call ? "C" : "-"}`).join(",");

describe("houseTagsOf (원인 흐름 밤)", () => {
  let restore: () => void = () => {};
  beforeAll(() => {
    restore = openCause();
  });
  afterAll(() => restore());

  it("산 사람 다섯(좌석 0~4)·탈락자 하나(5)·빈 좌석(6·7): 문패는 8개이고 0~4 만 단추, 5·6·7 은 단추 아님", () => {
    const tags = houseTagsOf(viewOf());
    expect(tags.map((t) => t.seat).join(",")).toBe("0,1,2,3,4,5,6,7");
    expect(tags.map((t) => (t.button ? "1" : "0")).join("")).toBe("11111000");
    // 주인 있음(탈락자 포함)은 얼굴·이름이 있고 빈 좌석은 없다
    expect(tags.map((t) => (t.owner ? "1" : "0")).join("")).toBe("11111100");
    expect(tags[2]!.nickname).toBe("닉2");
    expect(tags[6]!.nickname).toBeNull();
  });

  it("창 점은 houseLitOf 와 같은 값이다(3D 창과 한 값)", () => {
    const v = viewOf();
    expect(houseTagsOf(v).map((t) => t.lit)).toEqual(houseLitOf(v));
    // 서버가 불 상태를 주지 않았으면(houseLitOf null) 모두 꺼짐
    expect(houseTagsOf(viewOf({ lamps: null })).every((t) => !t.lit)).toBe(true);
  });

  it("아직 안 골랐으면 단추인 문패 전부가 빛난다(call), 고른 집이 없다", () => {
    expect(key(viewOf())).toBe("0:BL-C,1:B--C,2:BL-C,3:BL-C,4:B--C,5:----,6:-L--,7:----");
  });

  it("me.pick = 3: 3 만 picked 이고 빛남(call)은 모두 꺼진다", () => {
    const tags = houseTagsOf(viewOf({ pick: 3 }));
    expect(tags.filter((t) => t.picked).map((t) => t.seat)).toEqual([3]);
    expect(tags.some((t) => t.call)).toBe(false);
    expect(tags[3]!.button).toBe(true);
  });

  it("local.pick(내가 누른 즉시의 낙관적 선택)이 서버 값보다 먼저다 — 바꿔 고르면 새 집만 picked", () => {
    const tags = houseTagsOf(viewOf({ pick: 3 }), { pick: 1 });
    expect(tags.filter((t) => t.picked).map((t) => t.seat)).toEqual([1]);
  });

  it("내가 유령이면 단추인 문패가 없고 빛남도 없다(개관은 같다)", () => {
    const v = viewOf({ seat: 5 });
    const tags = houseTagsOf(v);
    expect(tags.length).toBe(8);
    expect(tags.some((t) => t.button || t.call)).toBe(false);
  });

  it("내 집도 단추다(눌러도 응답 모양이 같다, D-10)", () => {
    expect(houseTagsOf(viewOf({ seat: 2 }))[2]!.button).toBe(true);
  });

  it("마피아·경찰·의사·시민 view 의 결과가 완전히 같다", () => {
    const roles: RoleId[] = ["mafia", "police", "doctor", "citizen"];
    const base = JSON.stringify(houseTagsOf(viewOf({ role: "citizen" })));
    for (const role of roles) expect(JSON.stringify(houseTagsOf(viewOf({ role }))), role).toBe(base);
    const picked = JSON.stringify(houseTagsOf(viewOf({ role: "citizen", pick: 2 })));
    for (const role of roles) expect(JSON.stringify(houseTagsOf(viewOf({ role, pick: 2 }))), `${role}/pick`).toBe(picked);
  });

  it("밤이 아니거나 기본판이면 빈 목록", () => {
    expect(houseTagsOf(viewOf({ phase: "morning" }))).toEqual([]);
    expect(houseTagsOf(viewOf({ phase: "errand" }))).toEqual([]);
    expect(houseTagsOf(viewOf({ mode: "basic" }))).toEqual([]);
  });

  it("산 사람이 한 명뿐이어도 문패는 8개 그대로이고 그 한 명만 단추다", () => {
    const tags = houseTagsOf(viewOf({ seats: [4], dead: [], seat: 4 }));
    expect(tags.length).toBe(8);
    expect(tags.filter((t) => t.button).map((t) => t.seat)).toEqual([4]);
  });

  it("함수 소스(주석 아닌 줄)에 역할 필드 읽기가 없다", () => {
    const src = readFileSync(resolve(process.cwd(), "src/game/houseView.ts"), "utf8");
    const code = src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    expect(code.match(/\.role\b/g)?.length ?? 0).toBe(0);
    expect(code.match(/\bmafia\b/g)?.length ?? 0).toBe(0);
  });
});
