// 10-08 Task 1: 이동이 막힌 실제 단계에서 동작이 도착한다 (D-12·D-14, AVTR-05). 채팅과 같이 이동 차단과 무관하게 서버가 받는다.
// 워커로 본 단계: nomination · defense · verdict · execution · morning(한 판을 이어서) / runoff(앞머리) / showdown(모이기) / night(마피아→시민 0프레임).
// 걷는 중에는 서버가 버리므로(D-10) 보내기 전에 모든 구간이 끝나길 기다린다. 간격 기록은 resetEmoteRates 로 비운다.
import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { segmentEndsAt } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import {
  advanceTo,
  closePhase,
  emoteSend,
  emotesOf,
  killSeats,
  mark,
  observe,
  pause,
  pointAll,
  resetEmoteRates,
  settle,
  startedGame,
  storedRoom,
  threeAliveGame,
  verdictAll,
  withRole,
} from "./helpers";
import type { Actor, Game } from "./helpers";

/** 모든 위치 구간이 끝날 때까지 기다린다(모이기 걷기 뒤). */
async function standStill(code: string): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    const endsAt = await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
      const segs = (instance["world"] as { segs: Record<string, Segment> }).segs;
      return Math.max(0, ...Object.values(segs).map((s) => segmentEndsAt(s)));
    });
    if (endsAt <= Date.now()) return;
    await pause(Math.min(500, endsAt - Date.now() + 20));
  }
  throw new Error("standStill: 구간이 끝나지 않았다");
}

/** sender 가 한 번 보내고 모든 소켓이 받은 동작 프레임 수를 좌석 순 "seat:count" 열로 돌려준다. */
async function sendAndCount(g: Game, sender: Actor, id: "clap" | "dance" | "cry" | "throat"): Promise<Map<number, number>> {
  await standStill(g.code);
  await resetEmoteRates(g.code);
  const got = await observe(g, sender, () => emoteSend(sender.sock, id));
  const out = new Map<number, number>();
  g.actors.forEach((a, i) => {
    const frames = emotesOf(got[i]!);
    for (const f of frames) expect(f.seat).toBe(sender.seat);
    out.set(a.seat, frames.length);
  });
  return out;
}

/** 지금 저장된 단계가 기대한 단계인지 확인한다(엉뚱한 단계에서 통과하는 것을 막는다). */
const at = async (g: Game, phase: string): Promise<void> => {
  expect((await storedRoom(g.code)).phase).toBe(phase);
};

const row = (m: Map<number, number>): string => [...m.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => `${s}:${n}`).join(",");
/** 좌석 집합 seats 만 1프레임, 나머지는 0프레임인 기대 행(여섯 좌석). */
const want = (g: Game, seats: number[]): string => g.actors.map((a) => a.seat).sort((a, b) => a - b).map((s) => `${s}:${seats.includes(s) ? 1 : 0}`).join(",");

describe("동작 — 이동이 막힌 단계에서도 도착한다 (10-08, AVTR-05)", () => {
  it("지목 → 변론 → 찬반 → 처형 → 밤 → 아침: 산 사람의 동작은 산 사람 모두와 탈락자에게, 탈락자의 동작은 탈락자에게만 간다", async () => {
    const g = await startedGame("nomination");
    const citizens = withRole(g, "citizen");
    const target = citizens[0]!; // 처형될 시민
    const lively = g.actors.filter((a) => a !== target);
    const allSeats = g.actors.map((a) => a.seat);
    const sender = lively.find((a) => a.role === "police")!;

    // 지목(이동 막힘): 산 사람(탈락자 없음) 보냄 → 여섯 모두
    await at(g, "nomination");
    expect(row(await sendAndCount(g, sender, "clap"))).toBe(want(g, allSeats));

    // 지목으로 target 을 몰아 변론으로
    const points: Record<number, number> = {};
    for (const a of lively) points[a.seat] = target.seat;
    await pointAll(g.code, g.actors, points);
    await at(g, "defense");
    expect(row(await sendAndCount(g, lively[0]!, "dance"))).toBe(want(g, allSeats)); // 변론(변론자 포함 모두 동작 가능)
    expect(row(await sendAndCount(g, target, "cry"))).toBe(want(g, allSeats)); // 변론자도 동작 가능

    // 찬반
    await closePhase(g.code);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await at(g, "verdict");
    expect(row(await sendAndCount(g, lively[1]!, "clap"))).toBe(want(g, allSeats));

    // 처형: 모두 찬성(변론자는 던질 수 없다)
    const agree: Record<number, boolean> = {};
    for (const a of lively) agree[a.seat] = true;
    await verdictAll(g.code, g.actors, agree);
    await at(g, "execution");
    expect(row(await sendAndCount(g, lively[2]!, "dance"))).toBe(want(g, allSeats)); // 처형 단계(target 은 아직 탈락 직전/직후 상관없이 산 사람 채널)
  }, 120_000);

  it("밤: 마피아의 동작은 산 시민·경찰·의사 0프레임, 마피아 둘과 탈락자만 받는다 / 탈락자의 동작은 탈락자만 받는다 / 아침: 산 사람 → 모두", async () => {
    const g = await startedGame("night");
    await at(g, "night");
    const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
    const dead = withRole(g, "citizen")[0]!;
    await killSeats(g, [dead.seat]);
    for (const s of g.socks) await settle(s, mark(s));

    expect(row(await sendAndCount(g, m1, "throat"))).toBe(want(g, [m1.seat, m2.seat, dead.seat]));
    // 같은 밤, 탈락자의 동작은 탈락자 자신에게만(산 마피아에게도 가지 않는다)
    expect(row(await sendAndCount(g, dead, "cry"))).toBe(want(g, [dead.seat]));

    // 아침: 산 사람 → 산 사람 + 탈락자, 탈락자 → 탈락자
    await advanceTo(g.code, g.socks, "morning");
    await at(g, "morning");
    for (const s of g.socks) await settle(s, mark(s));
    const lively = g.actors.filter((a) => a !== dead);
    expect(row(await sendAndCount(g, lively[0]!, "clap"))).toBe(want(g, g.actors.map((a) => a.seat)));
    expect(row(await sendAndCount(g, dead, "cry"))).toBe(want(g, [dead.seat]));
  }, 120_000);

  it("동점 결선 앞머리(runoff): 산 사람의 동작이 여섯 모두에게 간다", async () => {
    const g = await startedGame("nomination");
    // 좌석 0·1 이 각각 2표로 동점(최다 정확히 둘): runoff.test.ts 와 같은 표
    await pointAll(g.code, g.actors, { 0: 1, 1: 0, 2: 0, 3: 1, 4: 2 });
    await at(g, "runoff");
    const stored = g.actors.map((a) => a.seat);
    const sender = g.actors.find((a) => a.seat === 5)!;
    expect(row(await sendAndCount(g, sender, "clap"))).toBe(want(g, stored));
  }, 120_000);

  it("마지막 3인(showdown) 모이기: 산 사람의 동작이 산 사람 셋과 탈락자에게 간다", async () => {
    const g = await threeAliveGame();
    await closePhase(g.code);
    for (const s of g.socks) await settle(s, mark(s));
    await at(g, "showdown");
    const sender = g.actors.find((a) => a.seat === 0)!;
    expect(row(await sendAndCount(g, sender, "clap"))).toBe(want(g, g.actors.map((a) => a.seat)));
  }, 120_000);
});
