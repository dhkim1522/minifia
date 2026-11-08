// 마피아 가짜 장소(16페이즈 D-08, A1, 결정 0079 예정): 산 마피아는 겉모양·개수가 같은 목록을 받지만 그중 한 곳은 처리되지 않는다.
// 배정은 난수 없이 (seat + day) % 3 이고, 역할을 읽는 심부름 파일은 errandFake.ts 하나뿐이다. 모듈이 아직 없을 때도 시험이 단언으로 실패하도록
// 동적으로 불러온다(import 오류가 RED 가 되지 않게).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { enterErrand } from "../../shared/game/errand";
import type { Player, RoomState } from "../../shared/game/room";
import { enterNight } from "../../shared/game/night";
import { tick } from "../../shared/game/tick";
import { seededRandInt } from "../helpers/seededRandom";
import { startedAt } from "../helpers/voteState";

type AssignFn = (state: RoomState) => RoomState;
async function loadAssign(): Promise<AssignFn | undefined> {
  const path = "../../shared/game/errandFake";
  try {
    const mod = (await import(/* @vite-ignore */ path)) as { assignErrandFake?: AssignFn };
    return mod.assignErrandFake;
  } catch {
    return undefined;
  }
}

/** 재즈 바로 고정한 낮 시작 방(맵은 시드로 정해지므로 시험이 고정한다). */
function barDay(seed: number, n = 6): RoomState {
  return { ...startedAt(n, seed, "dayAnnounce"), map: "bar" as const };
}
const fakeOf = (p: Player): unknown => (p as unknown as { errandFake?: unknown }).errandFake;
const hasFake = (p: Player): boolean => "errandFake" in p;

describe("assignErrandFake — 산 마피아마다 가짜 장소 한 곳 (D-08, A1)", () => {
  it("모듈이 있고 함수를 내보낸다", async () => {
    expect(typeof (await loadAssign())).toBe("function");
  });

  it("errand 진입(tick 의 ON_ENTER)이 끝나면 산 마피아만 errandFake 를 갖고 값은 자기 목록의 (seat + day) % 3 번째다", () => {
    for (const seed of [3, 5, 8]) {
      const day = barDay(seed);
      const s = tick(day, day.phaseEndsAt!, seededRandInt(seed + 1));
      expect(s.phase).toBe("errand");
      const mafias = s.players.filter((p) => p.role === "mafia" && isAlive(p));
      expect(mafias.length).toBeGreaterThan(0);
      for (const p of s.players) {
        if (p.role === "mafia" && isAlive(p)) {
          const want = p.errandPlaces![(p.seat + (s.day ?? 1)) % p.errandPlaces!.length];
          expect(`${p.seat}:${String(fakeOf(p))}`).toBe(`${p.seat}:${String(want)}`);
          expect(p.errandPlaces).toContain(fakeOf(p));
        } else {
          expect(`${p.seat}:${hasFake(p)}`).toBe(`${p.seat}:false`);
        }
      }
    }
  });

  it("죽은 마피아·시민·의사·경찰에게는 키가 없고, 남아 있던 키는 지워진다", async () => {
    const assign = await loadAssign();
    expect(typeof assign).toBe("function");
    const day = barDay(5);
    const base = enterErrand(day, seededRandInt(7), 0);
    const deadMafia = base.players.find((p) => p.role === "mafia")!;
    const killed: RoomState = {
      ...base,
      players: base.players.map((p) => (p.id === deadMafia.id ? { ...p, alive: false } : { ...p, errandFake: p.errandPlaces?.[0] })),
    };
    const out = assign!(killed);
    for (const p of out.players) {
      if (p.role === "mafia" && isAlive(p)) expect(hasFake(p)).toBe(true);
      else expect(`${p.seat}:${hasFake(p)}`).toBe(`${p.seat}:false`);
    }
  });

  it("난수를 부르지 않는다: enterErrand 만 돌린 결과와 errandPlaces·errandDone 이 같고 randInt 호출 수·값이 같다", async () => {
    const assign = await loadAssign();
    expect(typeof assign).toBe("function");
    const day = barDay(5);
    let plainCalls = 0;
    const plainRand = seededRandInt(11);
    const plain = enterErrand(day, (n) => (plainCalls++, plainRand(n)), 0);
    let wrapCalls = 0;
    const wrapRand = seededRandInt(11);
    const wrapped = assign!(enterErrand(day, (n) => (wrapCalls++, wrapRand(n)), 0));
    expect(wrapCalls).toBe(plainCalls);
    expect(JSON.stringify(wrapped.players.map((p) => [p.errandPlaces, p.errandDone]))).toBe(JSON.stringify(plain.players.map((p) => [p.errandPlaces, p.errandDone])));
    // 같은 입력이면 같은 결과이고 입력은 바뀌지 않는다
    const frozen = JSON.stringify(plain);
    expect(JSON.stringify(assign!(plain))).toBe(JSON.stringify(assign!(plain)));
    expect(JSON.stringify(plain)).toBe(frozen);
    // 호출이 tick 을 거쳐도 같은 수다(ON_ENTER 가 난수를 더 부르지 않는다)
    let tickCalls = 0;
    const tickRand = seededRandInt(11);
    tick(day, day.phaseEndsAt!, (n) => (tickCalls++, tickRand(n)));
    expect(tickCalls).toBe(plainCalls);
  });

  it("수명: enterNight 가 errandFake 를 키째 지우고, 다음 enterErrand 직후(배정 전)에도 키가 없다", () => {
    const day = barDay(5);
    const s = tick(day, day.phaseEndsAt!, seededRandInt(6));
    expect(s.players.some(hasFake)).toBe(true);
    expect(enterNight(s).players.some(hasFake)).toBe(false);
    expect(enterErrand(s, seededRandInt(9), 0).players.some(hasFake)).toBe(false);
  });
});

describe("역할을 읽는 심부름 파일은 errandFake.ts 하나뿐이다 (D-08, 15 의 증명 장치 유지)", () => {
  const body = (path: string): string =>
    (existsSync(path) ? readFileSync(path, "utf8") : "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");

  it("errand.ts 의 주석을 뺀 본문에 .role 이 없고 errandFake.ts 에는 있다", () => {
    expect((body("shared/game/errand.ts").match(/\.role\b/g) ?? []).length).toBe(0);
    expect((body("shared/game/errandFake.ts").match(/\.role\b/g) ?? []).length).toBeGreaterThan(0);
  });
});
