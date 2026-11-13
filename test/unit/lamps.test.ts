// 가로등 공개 값·심지 자르기 판정·day.lamps view (21-05 Task 1, D-06·D-07·D-08·D-21·D-22, 위협 T-21-10·T-21-11) — 순수 규칙 시험.
// 실패 출력은 한 줄이어야 해서(TAP) 목록·키 구조는 JSON 문자열로 견준다.
import { describe, expect, it } from "vitest";
import { actErrand, enterErrand, placeCenterFx } from "../../shared/game/errand";
import { lampNumberOf, lampsLitOf, lampsShownOf } from "../../shared/game/lamps";
import { markCut } from "../../shared/game/mafiaTouch";
import { mapOf } from "../../shared/game/maps";
import type { Player, RoomState } from "../../shared/game/room";
import { buildView } from "../../shared/game/view";
import { ClientMessageSchema } from "../../shared/schemas";
import type { PlaceId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { startedAt } from "../helpers/voteState";

const NOW = 50_000;
/** 확장판 저녁 6명 판 — 역할은 서버가 뽑은 그대로다. */
const base = (): RoomState => startedAt(6, 7, "errand");
const roleOf = (s: RoomState, role: string): Player[] => s.players.filter((p) => p.role === role);
/** 좌석 seat 의 errandDone 을 정한다. */
const doneOf = (s: RoomState, bySeat: Record<number, PlaceId[]>): RoomState => ({
  ...s,
  players: s.players.map((p) => (bySeat[p.seat] === undefined ? p : { ...p, errandPlaces: bySeat[p.seat]!, errandDone: bySeat[p.seat]! })),
});
const json = (v: unknown): string => JSON.stringify(v);

describe("lamps.ts — 가로등 번호와 공개 값 (D-07·D-08)", () => {
  it("lampNumberOf: lamp3 → 3, 가로등이 아닌 장소 → undefined", () => {
    expect(`${lampNumberOf("lamp3")}:${lampNumberOf("lamp0")}:${lampNumberOf("clock")}:${lampNumberOf("glass")}`).toBe("3:0:undefined:undefined");
  });

  it("두 사람이 lamp1·lamp4 를 처리하고 마피아가 lamp4 를 hold 로 처리했으면 shown [1,4] · lit [1]", () => {
    const s = base();
    const [m] = roleOf(s, "mafia");
    const [c] = roleOf(s, "citizen");
    let st = doneOf(s, { [c!.seat]: ["lamp1"], [m!.seat]: ["lamp4"] });
    st = markCut(st, m!.id, "lamp4", true);
    expect(`${json(lampsShownOf(st))} ${json(lampsLitOf(st))}`).toBe("[1,4] [1]");
  });

  it("시민이 lamp4 를 먼저 켜고 마피아가 나중에 자른 경우와 반대 순서 모두 lit [1] 이다", () => {
    const s = base();
    const [m] = roleOf(s, "mafia");
    const [c] = roleOf(s, "citizen");
    const cFirst = markCut(doneOf(s, { [c!.seat]: ["lamp1", "lamp4"], [m!.seat]: ["lamp4"] }), m!.id, "lamp4", true);
    const mFirst = markCut(doneOf(s, { [m!.seat]: ["lamp4"], [c!.seat]: ["lamp1", "lamp4"] }), m!.id, "lamp4", true);
    expect(`${json(lampsLitOf(cFirst))} ${json(lampsLitOf(mFirst))}`).toBe("[1] [1]");
  });

  it("shown 은 오름차순·중복 없음, 가로등이 아닌 장소(재즈 바)는 빈 배열", () => {
    const s = base();
    const st = doneOf(s, { 0: ["lamp5", "lamp2"], 1: ["lamp2", "lamp0"] });
    expect(json(lampsShownOf(st))).toBe("[0,2,5]");
    expect(json(lampsShownOf(doneOf(s, { 0: ["clock", "glass"] as unknown as PlaceId[] })))).toBe("[]");
  });
});

describe("markCut — 산 마피아의 hold 처리만 lampCut 에 오른다 (D-06, 역할을 읽는 유일한 곳)", () => {
  it("산 마피아 + hold → lampCut 끝에 place, 같은 place 를 또 더하지 않는다, 입력 상태는 그대로", () => {
    const s = base();
    const [m] = roleOf(s, "mafia");
    const frozen = json(s);
    const cut = markCut(s, m!.id, "lamp4", true);
    expect(json(cut.lampCut)).toBe('["lamp4"]');
    expect(markCut(cut, m!.id, "lamp4", true)).toBe(cut);
    expect(json(markCut(cut, m!.id, "lamp6", true).lampCut)).toBe('["lamp4","lamp6"]');
    expect(json(s)).toBe(frozen);
  });

  it("시민의 hold · 마피아의 hold 없음 · 죽은 마피아 · 방에 없는 사람은 입력 그대로(같은 객체)", () => {
    const s = base();
    const [m] = roleOf(s, "mafia");
    const [c] = roleOf(s, "citizen");
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.id === m!.id ? { ...p, alive: false } : p)) };
    const same = [markCut(s, c!.id, "lamp1", true) === s, markCut(s, m!.id, "lamp1", false) === s, markCut(dead, m!.id, "lamp1", true) === dead, markCut(s, "nobody", "lamp1", true) === s];
    expect(json(same)).toBe("[true,true,true,true]");
  });
});

describe("errand.ts — actErrand 가 place 를 돌려주고 enterErrand 가 lampCut 을 지운다", () => {
  it("마을 가로등 앞에서 처리하면 ok 에 처리한 장소 id 가 실린다", () => {
    const town: RoomState = { ...base(), map: "town" };
    const p = town.players[0]!;
    const st: RoomState = { ...town, players: town.players.map((q) => (q.id === p.id ? { ...q, errandPlaces: ["lamp2", "lamp3", "lamp5"], errandDone: [] } : q)) };
    const r = actErrand(st, p.id, placeCenterFx(mapOf("town"), "lamp2")!);
    expect(r.ok ? (r as { place?: string }).place : "거절").toBe("lamp2");
  });

  it("enterErrand 다음 상태에는 lampCut 키가 없다(새 저녁)", () => {
    const s: RoomState = { ...base(), lampCut: ["lamp4"] };
    const next = enterErrand(s, seededRandInt(3), NOW);
    expect(`${"lampCut" in next}`).toBe("false");
  });
});

describe("buildView — day.lamps (D-06·D-07·D-08·D-21)", () => {
  const viewsOf = (s: RoomState): Array<ReturnType<typeof buildView>> => s.players.map((p) => buildView(s, p.id, NOW));
  const withCut = (): RoomState => {
    const s = base();
    const [m] = roleOf(s, "mafia");
    const [c] = roleOf(s, "citizen");
    return markCut(doneOf(s, { [c!.seat]: ["lamp1"], [m!.seat]: ["lamp4"] }), m!.id, "lamp4", true);
  };

  it("확장판 errand: 모든 view 의 day.lamps 는 자른 것을 포함한 shown [1,4] 로 같다", () => {
    expect(json(viewsOf(withCut()).map((v) => v.day?.lamps))).toBe(json(Array(6).fill([1, 4])));
  });

  it("night·morning: 모든 view 의 day.lamps 는 lit [1] 로 같다(자른 등불은 꺼진다)", () => {
    const night = viewsOf({ ...withCut(), phase: "night" });
    const morning = viewsOf({ ...withCut(), phase: "morning" });
    expect(`${json(night.map((v) => v.day?.lamps))} ${json(morning.map((v) => v.day?.lamps))}`).toBe(`${json(Array(6).fill([1]))} ${json(Array(6).fill([1]))}`);
  });

  it("discussion 에는 키가 없고, 기본 마피아에는 어느 단계에도 키가 없다", () => {
    const disc = viewsOf({ ...withCut(), phase: "discussion" });
    const keys = (vs: typeof disc): string => json(vs.map((v) => "lamps" in (v.day ?? {})));
    const basic = (["errand", "night", "morning", "discussion"] as const).map((phase) => keys(viewsOf({ ...withCut(), phase, mode: "basic" })));
    expect(`${keys(disc)} ${json(basic)}`).toBe(`${json(Array(6).fill(false))} ${json(Array(4).fill(json(Array(6).fill(false))))}`);
  });

  it("어떤 단계·어떤 view JSON 에도 lampCut 이 없다", () => {
    const hits = (["errand", "night", "morning", "discussion"] as const).map((phase) => viewsOf({ ...withCut(), phase }).some((v) => json(v).includes("lampCut")));
    expect(json(hits)).toBe("[false,false,false,false]");
  });
});

describe("스키마 — errand 의 선택 필드 hold (P21-8)", () => {
  const ok = (m: unknown): boolean => ClientMessageSchema.safeParse(m).success;
  it("{t:errand}·{t:errand,hold:true} 는 받고 hold false·hold 1·다른 키는 거절", () => {
    expect(json([ok({ t: "errand" }), ok({ t: "errand", hold: true }), ok({ t: "errand", hold: false }), ok({ t: "errand", hold: 1 }), ok({ t: "errand", cut: true })])).toBe("[true,true,false,false,false]");
  });
});
