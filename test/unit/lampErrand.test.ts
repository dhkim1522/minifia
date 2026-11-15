// 21-02 저녁 등불 당번(D-05·D-07·D-09, 결정 0088): 원인 흐름 마을 판의 저녁에서 산 사람마다 가로등 8곳 중 3곳을 받고, 반경 1.2 안에서 처리하며, 목격 줄의 장소는 가장 가까운 가로등이다.
// 상태는 실제 전이(startGame → tick)와 실제 규칙 함수(actErrand·sampleErrand)로만 만든다. 잠금(setup 이 원인 흐름을 잠근다) 아래의 옛 확장판 마을 심부름은 그대로 장소(TOWN_PLACES)다.
// 모든 역할이 같은 목록 모양·같은 개수·같은 처리 규칙이다(T-21-04) — 이 파일의 시험은 역할을 읽지 않는 규칙을 마피아·시민 둘 모두로 돌려 본다.
// 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표로 이은 문자열로 비교한다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { actErrand, enterErrand, errandSpotsOf, nearestPlaceId, placeCenterFx, sampleErrand } from "../../shared/game/errand";
import { BAR_MAP } from "../../shared/game/map";
import { TOWN_LAMPS, TOWN_MAP, TOWN_PLACES } from "../../shared/game/mapTown";
import { mapOf, roomMapId } from "../../shared/game/maps";
import { ERRAND_COUNT } from "../../shared/game/phases";
import { rulesetOf } from "../../shared/game/ruleset";
import { startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { lockCause, openCause, openTown } from "../helpers/playable";
import { seededRandInt } from "../helpers/seededRandom";
import { START_AT, lobbyOf } from "../helpers/voteState";

const LAMP_IDS: readonly string[] = ["lamp0", "lamp1", "lamp2", "lamp3", "lamp4", "lamp5", "lamp6", "lamp7"];
const TOWN_PLACE_IDS = TOWN_PLACES.map((p) => p.id);

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

describe("원인 흐름 마을 저녁 — 가로등 배정 (openCause + openTown)", () => {
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

  it("errandSpotsOf: 원인 규칙 + lamps 가 있는 맵은 가로등, lamps 가 없는 맵(재즈 바)은 장소 그대로", () => {
    const rules = rulesetOf("extended");
    expect(`${rules.cause}/${errandSpotsOf(TOWN_MAP, rules) === TOWN_LAMPS}/${errandSpotsOf(BAR_MAP, rules) === BAR_MAP.places}`).toBe("true/true/true");
  });

  it("errandSpotsOf: 원인 흐름이 아닌 규칙(기본 마피아)은 마을에서도 장소 그대로다", () => {
    expect(errandSpotsOf(TOWN_MAP, rulesetOf("basic")) === TOWN_MAP.places).toBe(true);
  });

  it("저녁의 모든 산 사람이 lamp0~lamp7 안의 서로 다른 3곳을 받고 목록 길이가 같다", () => {
    for (const seed of [3, 7, 11]) {
      const s = errandOf(6, seed);
      expect(roomMapId(s)).toBe("town");
      const lists = s.players.filter(isAlive).map((p) => p.errandPlaces ?? []);
      const ok = lists.every((l) => l.length === ERRAND_COUNT && new Set(l).size === ERRAND_COUNT && l.every((id) => LAMP_IDS.includes(id)));
      expect(`${seed}:${lists.length}/${ok}/${new Set(lists.map((l) => l.length)).size}/${s.players.every((p) => p.errandFake === undefined)}`).toBe(`${seed}:6/true/1/true`);
    }
  });

  it("역할이 달라도(마피아·시민) 같은 시드의 배정 키·개수가 같다 — 역할을 읽지 않는다", () => {
    const s = errandOf(6, 5);
    const mafia = byRole(s, "mafia");
    const citizen = byRole(s, "citizen");
    const shape = (p: Player): string => `${Object.keys(p).filter((k) => k.startsWith("errand")).sort().join(",")}/${(p.errandPlaces ?? []).length}/${(p.errandDone ?? []).length}`;
    expect(shape(mafia)).toBe(shape(citizen));
  });

  it("배정된 가로등 중심에서 처리하면 ok·errandDone 에 그 id, 1.3 떨어진 자리·배정 안 된 가로등 위는 { ok: false } 다. 결과 모양은 역할과 무관하다", () => {
    const s = errandOf(6, 5);
    const results: string[] = [];
    for (const role of ["mafia", "citizen"]) {
      const actor = byRole(s, role);
      const mine: readonly string[] = actor.errandPlaces!;
      const first = mine[0]!;
      const at = centerOf(s, first);
      const near = { x: at.x + 130, z: at.z };
      const unassigned = LAMP_IDS.find((id) => !mine.includes(id))!;
      const hit = actErrand(s, actor.id, at);
      const far = actErrand(s, actor.id, near);
      const other = actErrand(s, actor.id, centerOf(s, unassigned));
      const done = hit.ok ? (hit.state.players.find((p) => p.id === actor.id)!.errandDone ?? []) : [];
      const keys = hit.ok ? Object.keys(hit.state.players.find((p) => p.id === actor.id)!).filter((k) => k.startsWith("errand")).sort().join("|") : "";
      results.push(`${hit.ok}/${done.join("+") === first}/${JSON.stringify(far)}/${JSON.stringify(other)}/${keys}`);
    }
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toBe('true/true/{"ok":false}/{"ok":false}/errandDone|errandPlaces');
  });

  it("sampleErrand: 근처에 새로 들어온 사람의 목격 줄 장소는 그 사람에게 가장 가까운 가로등 id 다", () => {
    const s = errandOf(6, 5);
    const [a, b] = s.players.filter(isAlive).sort((x, y) => x.seat - y.seat);
    const lamp = TOWN_LAMPS[3]!;
    const aAt = { x: Math.round(lamp.x * 100), z: Math.round(lamp.z * 100) };
    const bAt = { x: aAt.x + 50, z: aAt.z };
    const far = { x: -900, z: 900 };
    const posOf = (id: string): { x: number; z: number } | undefined => (id === a!.id ? aAt : id === b!.id ? bAt : { x: far.x - (s.players.findIndex((p) => p.id === id) * 400), z: far.z });
    const sampled = sampleErrand(s, posOf, START_AT);
    const seen = sampled.players.find((p) => p.id === a!.id)!.errandSeen ?? [];
    expect(JSON.stringify(seen)).toBe(JSON.stringify([{ seat: b!.seat, place: "lamp3" }]));
    expect(nearestPlaceId(TOWN_MAP, bAt, TOWN_LAMPS)).toBe("lamp3");
  });

  it("enterErrand 는 이 맵·규칙의 후보 8곳에서 난수를 같은 순서로 쓴다(사람마다 randInt(n − k), n = 8)", () => {
    const s = errandOf(5, 9);
    const calls: number[] = [];
    enterErrand(s, (n) => { calls.push(n); return 0; }, START_AT);
    const alive = s.players.filter(isAlive).length;
    expect(calls.join(",")).toBe(Array.from({ length: alive }, () => "8,7,6").join(","));
  });
});

describe("잠금(옛 확장판 순서) 아래 — 마을 심부름은 지금 장소(TOWN_PLACES) 그대로다", () => {
  // 꺼진 옛 확장판 경로 — 코드는 끄기만 한다(REQUIREMENTS Out of Scope '기능 코드 삭제'). 21-13: setup 이 더는 잠그지 않으므로 이 구역이 직접 잠근다(갈래 B).
  let restoreTown: () => void = () => {};
  let restoreLock: () => void = () => {};
  beforeAll(() => {
    restoreLock = lockCause();
    restoreTown = openTown();
  });
  afterAll(() => {
    restoreTown();
    restoreLock();
  });

  it("같은 시드의 저녁 아닌 심부름 단계는 마을 장소 3곳이고 가로등 id 가 없다", () => {
    const s = errandOf(6, 5);
    expect(roomMapId(s)).toBe("town");
    const lists = s.players.filter(isAlive).map((p) => p.errandPlaces ?? []);
    expect(lists.every((l) => l.length === ERRAND_COUNT && l.every((id) => TOWN_PLACE_IDS.includes(id)))).toBe(true);
  });
});
