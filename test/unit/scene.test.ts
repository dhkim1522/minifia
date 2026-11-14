// 21-04 아침 현장 조사(D-12~D-17·D-22, 결정 0088): 피해자·미수 집 앞 단서 지점 셋, 살피기(1회·반경·흐려짐), 아침 진입 연결, 다음 저녁 청소.
// 상태는 실제 전이(startGame → tick)와 실제 규칙 함수(pickTarget·tick·inspectSpot)로만 만든다(짝집 등불 켜짐만 밤 상태에 직접 얹는다).
// 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표·슬래시로 이은 문자열로 비교한다.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enterErrand } from "../../shared/game/errand";
import { TOWN_CLUE_SPOTS, neighborOf } from "../../shared/game/mapTown";
import { enterMorning, pickTarget } from "../../shared/game/night";
import { startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { buildScene, inspectSpot } from "../../shared/game/scene";
import { tick } from "../../shared/game/tick";
import { TRACE_OF_OUTFIT } from "../../shared/game/trace";
import type { ClueLine, OutfitId } from "../../shared/protocol";
import { openCause, openTown } from "../helpers/playable";
import { seededRandInt } from "../helpers/seededRandom";
import { START_AT, lobbyOf } from "../helpers/voteState";

/** 대기실에서 시작해 원인 흐름 1일차 밤의 첫 순간까지 실제 전이로 걷는다(6명: 마피아 둘·시민 둘·경찰·의사). */
function nightOf(seed: number): RoomState {
  const lobby = lobbyOf(6);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let s = started.state;
  for (let guard = 0; s.phase !== "night"; guard += 1) {
    if (s.phaseEndsAt === null || guard > 20) throw new Error(`cannot reach night (stuck at ${s.phase})`);
    s = tick(s, s.phaseEndsAt, seededRandInt(seed + 1 + guard));
  }
  return s;
}

const withRole = (s: RoomState, role: RoleId): Player[] => s.players.filter((p) => p.role === role).sort((a, b) => a.seat - b.seat);
function pickAs(s: RoomState, actor: Player, target: Player): RoomState {
  const r = pickTarget(s, actor.id, target.seat);
  if (!r.ok) throw new Error(`pickTarget rejected: ${r.error}`);
  return r.state;
}
const picks = (s: RoomState, ...pairs: Array<[Player, Player]>): RoomState => pairs.reduce((acc, [a, t]) => pickAs(acc, a, t), s);
const withLook = (s: RoomState, p: Player, look: OutfitId): RoomState => ({ ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, look } : q)) });
const withLamps = (s: RoomState, lit: readonly number[]): RoomState => ({ ...s, lamps: Array.from({ length: 8 }, (_, i) => lit.includes(i)) });
const rowOf = (s: RoomState, id: string): Player => s.players.find((p) => p.id === id)!;
const closeNight = (s: RoomState, seed: number): RoomState => tick(s, s.phaseEndsAt!, seededRandInt(seed));
const lineOf = (l: ClueLine): string => `${l.spot}/${l.r}/${l.n ?? ""}/${l.piece ?? ""}`;
const seenOf = (s: RoomState, id: string): string => (rowOf(s, id).sceneSeen ?? []).map(lineOf).join(",");

/** 행위자가 지점 k 의 중심에서 살핀다. 거절이면 던진다. */
function look(s: RoomState, actor: Player, k: number): RoomState {
  const house = s.scene!.house;
  const r = inspectSpot(s, actor.id, TOWN_CLUE_SPOTS[house]![k]!);
  if (!r.ok) throw new Error(`inspectSpot rejected ${actor.id} spot ${k}`);
  return r.state;
}

interface Cast {
  night: RoomState;
  m1: Player;
  m2: Player;
  c1: Player;
  c2: Player;
  police: Player;
  doctor: Player;
}
function cast(seed: number): Cast {
  const night = nightOf(seed);
  const [m1, m2] = withRole(night, "mafia") as [Player, Player];
  const [c1, c2] = withRole(night, "citizen") as [Player, Player];
  return { night, m1, m2, c1, c2, police: withRole(night, "police")[0]!, doctor: withRole(night, "doctor")[0]! };
}

/** 피해자 c1: 마피아 둘과 시민 c2 가 c1 을 고르고 의상이 서로 다르다(후보 셋). lit 는 켜진 집 창 좌석. morning 상태를 돌려준다. */
function victimMorning(seed: number, lit: readonly number[] = []): { c: Cast; morning: RoomState } {
  const c = cast(seed);
  let s = withLook(withLook(withLook(c.night, c.m1, "mafia"), c.m2, "noir"), c.c2, "coat");
  s = withLamps(s, lit);
  s = picks(s, [c.m1, c.c1], [c.m2, c.c1], [c.c2, c.c1], [c.police, c.doctor], [c.doctor, c.doctor]);
  const morning = closeNight(s, seed + 100);
  return { c, morning };
}

describe("현장 만들기 — 원인 흐름 마을 아침 (openCause + openTown)", () => {
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

  it("피해자가 나온 밤: morning 에서 scene.house = 피해자 좌석, footprints = 그 집을 고른 산 사람 수(주인 제외), cloth 는 그 사람들 중 한 명의 조각", () => {
    const { c, morning } = victimMorning(11);
    const pieces = [TRACE_OF_OUTFIT.mafia, TRACE_OF_OUTFIT.noir, TRACE_OF_OUTFIT.coat];
    expect(`${morning.phase}/${morning.morning?.eliminated === c.c1.seat}/${morning.scene?.house === c.c1.seat}/${morning.scene?.footprints}/${pieces.includes(morning.scene?.cloth as never)}`).toBe("morning/true/true/3/true");
  });

  it("같은 시드는 같은 현장이다", () => {
    const a = victimMorning(11).morning.scene;
    const b = victimMorning(11).morning.scene;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("의사가 지킨 밤(미수): morning.saved 이고 scene.house = 노린 집 좌석", () => {
    const c = cast(21);
    const s = picks(withLamps(c.night, []), [c.m1, c.c1], [c.m2, c.c1], [c.doctor, c.c1]);
    const morning = closeNight(s, 121);
    expect(`${morning.phase}/${morning.morning?.saved === true}/${morning.scene?.house === c.c1.seat}/${morning.scene?.footprints}`).toBe("morning/true/true/3");
  });

  it("마피아가 갈린 밤: scene 키가 없고 같은 tick 에 토론까지 간다(D-17)", () => {
    const c = cast(31);
    const s = picks(c.night, [c.m1, c.c1], [c.m2, c.c2]);
    const after = closeNight(s, 131);
    expect(`${after.phase}/${"scene" in after}`).toBe("discussion/false");
  });

  it("창문: 짝집 창이 켜졌으면 의상 조각이 나오고 꺼졌으면 어두워서 못 본다(지점 ③)", () => {
    const pair = neighborOf(victimMorning(41).morning.scene!.house)!;
    const windowLine = (lit: readonly number[]): string => {
      const { c, morning } = victimMorning(41, lit);
      return seenOf(look(morning, c.doctor, 2), c.doctor.id);
    };
    const on = windowLine([pair]);
    const pieces = [TRACE_OF_OUTFIT.mafia, TRACE_OF_OUTFIT.noir, TRACE_OF_OUTFIT.coat] as string[];
    expect(`${on.startsWith("window/clue//")}/${pieces.includes(on.split("/")[3]!)}/${windowLine([])}`).toBe("true/true/window/dark//");
  });

  it("후보가 둘 이상이면 창문 조각의 사람이 옷 조각의 사람과 다르다 — 의상이 서로 달라 조각도 다르다(여러 시드)", () => {
    const same: number[] = [];
    for (let seed = 50; seed < 80; seed += 1) {
      const { c, morning } = victimMorning(seed, [0, 1, 2, 3, 4, 5, 6, 7]);
      const sc = morning.scene!;
      if (sc.cloth === sc.window || sc.cloth === undefined || sc.window === undefined) same.push(seed);
      expect(c.c1.seat).toBe(sc.house);
    }
    expect(same.join(",")).toBe("");
  });

  it("난수 호출 수: 후보 셋이면 둘, 후보 하나면 하나, 후보 없으면 없다(원인 분기 안에서만 늘어난다)", () => {
    const c = cast(61);
    const count = (s: RoomState, house: number): number => {
      let calls = 0;
      buildScene(s, house, (n) => {
        calls += 1;
        return n - 1;
      });
      return calls;
    };
    const three = picks(c.night, [c.m1, c.c1], [c.m2, c.c1], [c.c2, c.c1]);
    const one = picks(c.night, [c.m1, c.c1]);
    expect(`${count(three, c.c1.seat)}/${count(one, c.c1.seat)}/${count(c.night, c.c1.seat)}`).toBe("2/1/0");
  });

  it("후보가 하나면 창문 조각은 옷 조각과 같고, 후보가 없으면 발자국 0·조각 없음이다", () => {
    const c = cast(62);
    const one = buildScene(withLamps(picks(c.night, [c.m1, c.c1]), [neighborOf(c.c1.seat) ?? 0]), c.c1.seat, () => 0);
    const none = buildScene(withLamps(c.night, []), c.c1.seat, () => 0);
    expect(`${one?.footprints}/${one?.cloth !== undefined && one.cloth === one.window}/${none?.footprints}/${none?.cloth}/${none?.window}`).toBe("1/true/0/undefined/undefined");
  });

  it("집이 없는 맵(맵에 clueSpots 가 없음)이거나 집이 없으면 buildScene 은 undefined 다", () => {
    const c = cast(63);
    expect(buildScene(c.night, undefined, () => 0)).toBeUndefined();
  });
});

describe("살피기 — 1회·반경·거절 (D-13·D-21)", () => {
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

  it("지점 중심에서 inspectSpot → ok, 본인 sceneSeen 에 그 지점 한 줄. 같은 자리에서 거듭 살피면 같은 지점을 두 번 받지 않고 결국 { ok:false } 다", () => {
    const { c, morning } = victimMorning(11);
    const spot = TOWN_CLUE_SPOTS[morning.scene!.house]![1]!;
    let s = morning;
    const results: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = inspectSpot(s, c.c2.id, spot);
      results.push(r.ok ? "ok" : "no");
      if (r.ok) s = r.state;
    }
    const spots = (rowOf(s, c.c2.id).sceneSeen ?? []).map((l) => l.spot);
    expect(`${spots[0]}/${new Set(spots).size === spots.length}/${results[0]}/${results[4]}`).toBe("cloth/true/ok/no");
    expect(JSON.stringify(inspectSpot(s, c.c2.id, spot))).toBe(JSON.stringify({ ok: false }));
  });

  it("가장 가까운 안 살핀 지점 하나만 살핀다 — 옷 조각 곁에 서면 옷 조각이 먼저이고 같은 지점은 다시 받지 않는다", () => {
    const { c, morning } = victimMorning(11);
    const p = TOWN_CLUE_SPOTS[morning.scene!.house]!;
    const spot = { x: p[1]!.x + 5, z: p[1]!.z };
    const first = inspectSpot(morning, c.c2.id, spot) as { ok: true; state: RoomState };
    const second = inspectSpot(first.state, c.c2.id, spot);
    const spots = (st: RoomState): string => (rowOf(st, c.c2.id).sceneSeen ?? []).map((l) => l.spot).join(",");
    expect(`${spots(first.state)}/${second.ok ? spots((second as { ok: true; state: RoomState }).state).startsWith("cloth,cloth") : false}`).toBe("cloth/false");
  });

  it("반경 밖(1.3 떨어진 자리)·유령·morning 아님·scene 없음은 모두 같은 { ok:false } 다", () => {
    const { c, morning } = victimMorning(11);
    const house = morning.scene!.house;
    const spot = TOWN_CLUE_SPOTS[house]![1]!;
    const far = { x: 0, z: 0 };
    const results = [
      inspectSpot(morning, c.c2.id, far),
      inspectSpot(morning, c.c1.id, spot), // 피해자 유령
      inspectSpot(closeNight(morning, 5), c.c2.id, spot), // 토론
      inspectSpot({ ...morning, scene: undefined } as RoomState, c.c2.id, spot),
      inspectSpot(morning, "nobody", spot),
    ];
    expect(results.map((r) => JSON.stringify(r)).join("|")).toBe(Array.from({ length: 5 }, () => JSON.stringify({ ok: false })).join("|"));
  });

  it("지점은 반경 1.2 안에서만 닿는다 — 1.3 떨어진 자리는 거절, 1.1 떨어진 자리는 받는다", () => {
    const { c, morning } = victimMorning(11);
    // 좌석 2 의 집: 지점 셋이 z 줄 위(−625·−525·−425)라 지점 ① 에서 −z 쪽은 다른 지점에서 더 멀어진다.
    const s = { ...morning, scene: { ...morning.scene!, house: 2 } };
    const spot = TOWN_CLUE_SPOTS[2]![0]!;
    const far = inspectSpot(s, c.c2.id, { x: spot.x, z: spot.z - 130 });
    const near = inspectSpot(s, c.c2.id, { x: spot.x, z: spot.z - 110 });
    expect(`${far.ok}/${near.ok}`).toBe("false/true");
  });
});

describe("흐려짐 — 산 마피아가 먼저 살핀 지점 (D-15, 결정 0088-11)", () => {
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

  it("시민 A → 마피아 M → 시민 B 가 옷 조각 지점을 살피면 clue, clue, touched", () => {
    const { c, morning } = victimMorning(11);
    let s = look(morning, c.c2, 1);
    s = look(s, c.m1, 1);
    s = look(s, c.police, 1);
    expect([c.c2, c.m1, c.police].map((p) => seenOf(s, p.id).split("/")[1]).join(",")).toBe("clue,clue,touched");
  });

  it("마피아가 먼저 살핀 발자국 지점: 마피아는 clue(수 포함), 뒤의 시민은 touched(수 없음)", () => {
    const { c, morning } = victimMorning(11);
    let s = look(morning, c.m1, 0);
    s = look(s, c.c2, 0);
    expect(`${seenOf(s, c.m1.id)}|${seenOf(s, c.c2.id)}`).toBe("footprint/clue/3/|footprint/touched//");
  });

  it("마피아는 다른 지점은 흐리지 않는다 — M 이 ① 을 살펴도 ② 는 시민이 평소 단서를 받는다", () => {
    const { c, morning } = victimMorning(11);
    let s = look(morning, c.m1, 0);
    s = look(s, c.c2, 1);
    expect(seenOf(s, c.c2.id).split("/")[1]).toBe("clue");
  });

  it("마피아가 아닌 사람(경찰·의사·시민)의 살피기는 지점을 흐리지 않는다", () => {
    const { c, morning } = victimMorning(11);
    let s = look(morning, c.police, 1);
    s = look(s, c.doctor, 1);
    s = look(s, c.c2, 1);
    expect([c.police, c.doctor, c.c2].map((p) => seenOf(s, p.id).split("/")[1]).join(",")).toBe("clue,clue,clue");
  });

  it("입력 상태는 바뀌지 않는다", () => {
    const { c, morning } = victimMorning(11);
    const frozen = JSON.stringify(morning);
    look(morning, c.m1, 0);
    expect(JSON.stringify(morning)).toBe(frozen);
  });
});

describe("청소와 소스 규약 (D-21·D-22)", () => {
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

  it("다음 저녁(enterErrand)에는 scene 키·모든 sceneSeen 키가 없다", () => {
    const { c, morning } = victimMorning(11);
    const s = look(look(morning, c.c2, 0), c.m1, 1);
    expect(`${s.scene !== undefined}/${s.players.filter((p) => p.sceneSeen !== undefined).length}`).toBe("true/2");
    const next = enterErrand(s, seededRandInt(3), 99_999);
    expect(`${"scene" in next}/${next.players.filter((p) => "sceneSeen" in p).length}`).toBe("false/0");
  });

  it("새 현장을 만드는 아침 진입은 지난 sceneSeen 을 지운다", () => {
    const c = cast(71);
    const stale = { ...c.night, players: c.night.players.map((p) => ({ ...p, sceneSeen: [{ spot: "cloth", r: "none" }] satisfies ClueLine[] })) };
    const s = picks(stale, [c.m1, c.c1], [c.m2, c.c1]);
    const morning = enterMorning(s, seededRandInt(1), undefined);
    expect(`${morning.scene?.house === c.c1.seat}/${morning.players.filter((p) => "sceneSeen" in p).length}`).toBe("true/0");
  });

  it("night.ts 의 enterMorning 본문에는 역할을 읽는 줄이 없고, 현장 파일 중 역할을 읽는 것은 scene.ts 뿐이다", () => {
    const night = readFileSync(new URL("../../shared/game/night.ts", import.meta.url), "utf8");
    const start = night.indexOf("export function enterMorning");
    const body = night.slice(start, night.indexOf("const bySeat", start));
    const code = (text: string): string => text.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
    expect(code(body).includes(".role")).toBe(false);
    const scene = readFileSync(new URL("../../shared/game/scene.ts", import.meta.url), "utf8");
    expect(code(scene).includes(".role")).toBe(true);
  });
});
