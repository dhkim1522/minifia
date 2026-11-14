// 21-03 심지 자르기·밤 등불 켜짐(D-06·D-07·D-08·D-22, 결정 0088): 마피아의 길게 누르기는 서버 전용 errandCut 이 되고, 밤이 시작되면 등불 8개의 켜짐이 "켠 사람 있음 + 자른 사람 없음" 으로 정해진다.
// 상태는 실제 전이(startGame → tick)와 실제 규칙 함수(actErrand·tick)로만 만든다. 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표로 이은 문자열로 비교한다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { actErrand, enterErrand, placeCenterFx } from "../../shared/game/errand";
import { houseLitOf, withCut } from "../../shared/game/lamps";
import { mapOf, roomMapId } from "../../shared/game/maps";
import { enterNight } from "../../shared/game/night";
import { startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { openCause, openTown } from "../helpers/playable";
import { seededRandInt } from "../helpers/seededRandom";
import { START_AT, lobbyOf } from "../helpers/voteState";

const LAMP_IDS: readonly string[] = ["lamp0", "lamp1", "lamp2", "lamp3", "lamp4", "lamp5", "lamp6", "lamp7"];

type Row = { errandDone?: string[]; errandCut?: string[] };
const lit = (rows: Row[], ids: readonly string[] = ["a", "b", "c"]): string => houseLitOf(rows as unknown as Player[], ids).join(",");

/** 대기실에서 시작해 errand 단계의 첫 순간까지 실제 전이로 걷는다. */
function errandOf(n: number, seed: number): RoomState {
  const lobby = lobbyOf(n);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let s = started.state;
  for (let guard = 0; s.phase !== "errand"; guard += 1) {
    if (s.phaseEndsAt === null || guard > 20) throw new Error(`cannot reach errand (stuck at ${s.phase})`);
    s = tick(s, s.phaseEndsAt, seededRandInt(seed + 1 + guard));
  }
  return s;
}

const byRole = (s: RoomState, role: string): Player => s.players.filter((p) => isAlive(p) && p.role === role).sort((a, b) => a.seat - b.seat)[0]!;
const centerOf = (s: RoomState, id: string): { x: number; z: number } => placeCenterFx(mapOf(roomMapId(s)), id)!;
const rowOf = (s: RoomState, id: string): Player => s.players.find((p) => p.id === id)!;

/** 행위자가 자기 배정 등불 중 index 번째 중심에서 hold 로 처리한다. 성공하면 새 상태. */
function act(s: RoomState, p: Player, index: number, hold: boolean): RoomState {
  const lampId = (p.errandPlaces ?? [])[index]!;
  const r = actErrand(s, p.id, centerOf(s, lampId), hold);
  if (!r.ok) throw new Error(`actErrand rejected ${p.id} ${lampId}`);
  return r.state;
}

describe("houseLitOf — 켜짐은 cut 이 이긴다 (A3)", () => {
  it("켠 사람이 있고 자른 사람이 없으면 true, 아무도 안 켜면 false", () => {
    expect(lit([{ errandDone: ["a"] }, { errandDone: ["b"] }])).toBe("true,true,false");
    expect(lit([{}, { errandDone: [] }])).toBe("false,false,false");
  });

  it("켠 사람과 자른 사람이 같은 등불이면 false 이고, 자른 사람만 있어도 false 다", () => {
    expect(lit([{ errandDone: ["a", "b"], errandCut: ["a"] }, { errandDone: ["a"] }])).toBe("false,true,false");
    expect(lit([{ errandCut: ["c"] }])).toBe("false,false,false");
  });

  it("결과 길이는 lampIds 길이이고 입력은 바뀌지 않는다", () => {
    const rows: Row[] = [{ errandDone: ["a"], errandCut: ["b"] }];
    const frozen = JSON.stringify(rows);
    expect(houseLitOf(rows as unknown as Player[], LAMP_IDS)).toHaveLength(8);
    expect(JSON.stringify(rows)).toBe(frozen);
  });
});

describe("원인 흐름 마을 저녁 — 마피아 hold 는 cut, 시민 hold 는 그냥 켜기 (openCause + openTown)", () => {
  let restoreCause: () => void = () => {};
  let restoreTown: () => void = () => {};
  beforeAll(() => {
    restoreCause = openCause();
    restoreTown = openTown();
  });
  afterAll(() => {
    restoreTown();
    restoreCause();
  });

  it("산 마피아의 actErrand(hold=true)는 errandDone 과 errandCut 에 그 등불 id 를 더한다", () => {
    const s = errandOf(6, 5);
    const m = byRole(s, "mafia");
    const first = (m.errandPlaces ?? [])[0]!;
    const next = rowOf(act(s, m, 0, true), m.id);
    expect(`${(next.errandDone ?? []).join("+")}/${(next.errandCut ?? []).join("+")}`).toBe(`${first}/${first}`);
  });

  it("마피아의 hold=false 처리는 errandCut 키를 만들지 않는다(그냥 켜기)", () => {
    const s = errandOf(6, 5);
    const m = byRole(s, "mafia");
    const next = rowOf(act(s, m, 0, false), m.id);
    expect(`${(next.errandDone ?? []).length}/${Object.hasOwn(next, "errandCut")}`).toBe("1/false");
  });

  it("산 시민의 actErrand(hold=true)는 errandDone 만 늘고 errandCut 키가 없다(P21-7)", () => {
    const s = errandOf(6, 5);
    const c = byRole(s, "citizen");
    const next = rowOf(act(s, c, 0, true), c.id);
    expect(`${(next.errandDone ?? []).length}/${Object.hasOwn(next, "errandCut")}`).toBe("1/false");
  });

  it("마피아·시민의 결과 행은 키 집합 차이가 errandCut 하나뿐이다", () => {
    const s = errandOf(6, 5);
    const m = byRole(s, "mafia");
    const c = byRole(s, "citizen");
    const mKeys = Object.keys(rowOf(act(s, m, 0, true), m.id)).sort();
    const cKeys = Object.keys(rowOf(act(s, c, 0, true), c.id)).sort();
    expect(mKeys.filter((k) => !cKeys.includes(k)).join(",") + "|" + cKeys.filter((k) => !mKeys.includes(k)).join(",")).toBe("errandCut|");
  });

  it("withCut: hold=false·시민은 입력 상태 그대로(같은 객체)", () => {
    const s = errandOf(6, 5);
    const m = byRole(s, "mafia");
    const c = byRole(s, "citizen");
    const lamp = (m.errandPlaces ?? [])[0]!;
    expect(`${withCut(s, m.id, lamp, false) === s}/${withCut(s, c.id, lamp, true) === s}`).toBe("true/true");
  });

  it("저녁 마감 → 밤 진입 상태의 lamps 는 boolean 8개이고 houseLitOf 와 같다(자른 등불은 꺼짐, 시민이 켠 등불은 켜짐, 안 켠 등불은 꺼짐)", () => {
    let s = errandOf(6, 5);
    const m = byRole(s, "mafia");
    const c = byRole(s, "citizen");
    s = act(s, m, 0, true);
    s = act(s, c, 0, true);
    const cutId = (m.errandPlaces ?? [])[0]!;
    const litId = (c.errandPlaces ?? [])[0]!;
    const night = tick(s, s.phaseEndsAt!, seededRandInt(99));
    expect(night.phase).toBe("night");
    const lamps = night.lamps ?? [];
    const expected = houseLitOf(night.players, LAMP_IDS);
    expect(`${lamps.length}/${lamps.every((v) => typeof v === "boolean")}/${lamps.join(",")}`).toBe(`8/true/${expected.join(",")}`);
    const idle = LAMP_IDS.map((id, i) => (night.players.some((p) => (p.errandDone ?? []).includes(id as never)) ? -1 : i)).filter((i) => i >= 0);
    expect(`${cutId === litId ? "same" : lamps[LAMP_IDS.indexOf(litId)]}/${lamps[LAMP_IDS.indexOf(cutId)]}/${idle.every((i) => lamps[i] === false)}`).toBe(`${cutId === litId ? "same" : "true"}/false/true`);
  });

  it("같은 등불을 마피아가 자르고 시민이 켜도 밤에는 꺼진다(cut 이 이긴다)", () => {
    let s = errandOf(6, 5);
    const m = byRole(s, "mafia");
    const c = byRole(s, "citizen");
    const shared = (m.errandPlaces ?? []).find((id) => (c.errandPlaces ?? []).includes(id));
    // 시드 5 에서 겹치는 등불이 없으면, 시민 목록 첫 칸을 마피아 등불로 고쳐 쓴다(규칙 함수 입력만 바꾼다).
    const id = shared ?? (m.errandPlaces ?? [])[0]!;
    if (shared === undefined) s = { ...s, players: s.players.map((p) => (p.id === c.id ? { ...p, errandPlaces: [id as never, ...(p.errandPlaces ?? []).slice(1)] } : p)) };
    const mm = rowOf(s, m.id);
    const cc = rowOf(s, c.id);
    s = act(s, mm, (mm.errandPlaces ?? []).indexOf(id as never), true);
    s = act(s, cc, (cc.errandPlaces ?? []).indexOf(id as never), false);
    const night = tick(s, s.phaseEndsAt!, seededRandInt(99));
    expect(`${id}:${(night.lamps ?? [])[LAMP_IDS.indexOf(id)]}`).toBe(`${id}:false`);
  });

  it("다음 날 errand 진입에서 lamps 키와 모든 사람의 errandCut 키가 없다", () => {
    let s = errandOf(6, 5);
    const m = byRole(s, "mafia");
    s = act(s, m, 0, true);
    const night = tick(s, s.phaseEndsAt!, seededRandInt(99));
    expect(Object.hasOwn(night, "lamps")).toBe(true);
    const again = enterErrand(night, seededRandInt(7), 0);
    expect(`${Object.hasOwn(again, "lamps")}/${again.players.some((p) => Object.hasOwn(p, "errandCut"))}`).toBe("false/false");
  });
});

describe("잠금(옛 확장판 순서) 아래 — 밤 진입 상태에는 lamps 키가 없다", () => {
  let restoreTown: () => void = () => {};
  beforeAll(() => {
    restoreTown = openTown();
  });
  afterAll(() => restoreTown());

  it("원인 흐름이 아니면 enterNight 가 lamps 를 만들지 않는다", () => {
    const s = errandOf(6, 5);
    expect(Object.hasOwn(enterNight(s), "lamps")).toBe(false);
  });
});

describe("소스 규약 — 등불에서 역할을 읽는 파일은 lamps.ts 하나뿐이다 (errandFake.ts 는 기존)", () => {
  const body = (path: string): string =>
    (existsSync(path) ? readFileSync(path, "utf8") : "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
  const roleReads = (text: string): number => (text.match(/\.role\b/g) ?? []).length;

  it("errand.ts 의 주석 아닌 줄에 .role 이 없고 lamps.ts 에는 있다", () => {
    expect(roleReads(body("shared/game/errand.ts"))).toBe(0);
    expect(roleReads(body("shared/game/lamps.ts"))).toBeGreaterThan(0);
  });

  it("night.ts 의 enterNight 함수 본문(밤 진입 등불 켜짐 확정)에 .role 이 없다", () => {
    const text = body("shared/game/night.ts");
    const start = text.indexOf("export function enterNight");
    const end = text.indexOf("\n}\n", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(roleReads(text.slice(start, end))).toBe(0);
  });

  it("errand·lamps 로 시작하는 shared/game 파일 중 역할을 읽는 것은 errandFake.ts 와 lamps.ts 뿐이다", () => {
    const names = readdirSync("shared/game").filter((f) => /^(errand|lamps)/.test(f) && f.endsWith(".ts"));
    const readers = names.filter((f) => roleReads(body(`shared/game/${f}`)) > 0).sort();
    expect(readers.join(",")).toBe("errandFake.ts,lamps.ts");
  });
});
