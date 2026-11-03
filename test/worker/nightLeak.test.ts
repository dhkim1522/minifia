// NIGHT-07 누설 증명, 결정 0061-2·3·4, UI-SPEC L1·L5·L9, RESEARCH 메타모픽 설계 (09-09; 09-16 이 구간 A/B 비교를 더한다).
// 밤에 시민 편 소켓은 마피아의 활동에서 한 프레임도 받지 않고, 진입 snap 은 본인 한 칸뿐이다(네트워크로도 가지 않는다 — 화면에서 숨기는 방식이 아니다, 결정 0002).
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 실패 출력은 한 줄이어야 해서(TAP) 프레임은 요약 문자열로 비교한다.
import { evictDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { PHASE_DEFS } from "../../shared/game/phases";
import { advanceTo, chatSend, editRoom, flushWorld, homeBySeat, mark, moveAs, nextFrame, observe, pause, pickAs, segEndsBySeat, settle, snapSeatsOf, stable, startedGame, summary, typingSend, withRole, worldFramesOf } from "./helpers";
import type { Game } from "./helpers";

/** 마지막 world snap 의 '좌석:x,z' 오름차순 문자열. snap 이 없으면 'none'. */
function snapPoints(msgs: ServerMessage[]): string {
  const snaps = msgs.filter((m): m is Extract<ServerMessage, { t: "world"; k: "snap" }> => m.t === "world" && m.k === "snap");
  const last = snaps.at(-1);
  if (last === undefined) return "none";
  return [...last.ents].sort((a, b) => a.s - b.s).map((e) => `${e.s}:${e.p.join(",")}`).join("|");
}

/** home 문자열('일차|0:x,z|...') 중 이 좌석들만. */
const homeRows = (home: string, seats: number[]): string =>
  home
    .split("|")
    .slice(1)
    .filter((row) => seats.includes(Number(row.split(":")[0])))
    .join("|");

/** 토론 중 두 사람이 걷게 해 home 이 선 자리와 달라지게 하고, 지목까지 넘긴 판. 지목 직후 home 을 함께 돌려준다. */
async function nominationWithWalkers(): Promise<{ g: Game; home: string }> {
  const g = await startedGame("discussion");
  moveAs(withRole(g, "citizen")[0]!, -120, 60);
  moveAs(withRole(g, "mafia")[0]!, 160, -80);
  for (const sock of g.socks) await settle(sock, mark(sock));
  await flushWorld(g.code);
  await advanceTo(g.code, g.socks, "nomination");
  for (const sock of g.socks) await settle(sock, mark(sock));
  return { g, home: await homeBySeat(g.code) };
}

describe("밤 진입 — 트레이서 (NIGHT-07, 결정 0061-3·5)", () => {
  it("지목에서 밤으로 들어가면 시민·경찰·의사 소켓은 본인 한 칸 snap 하나만 받고 그 p 는 본인 home 이다", async () => {
    const { g, home } = await nominationWithWalkers();
    const marks = g.socks.map((s) => mark(s));

    await advanceTo(g.code, g.socks, "night");
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));

    for (const a of g.actors.filter((x) => x.role !== "mafia")) {
      const msgs = got[g.actors.indexOf(a)]!;
      expect(`${a.role}:${worldFramesOf(a.sock, marks[g.actors.indexOf(a)]!).map((m) => m.k).join(",")}`).toBe(`${a.role}:snap`);
      expect(`${a.role}:${snapSeatsOf(msgs)}`).toBe(`${a.role}:${a.seat}`);
      expect(`${a.role}:${snapPoints(msgs)}`).toBe(`${a.role}:${homeRows(home, [a.seat])}`);
    }
  }, 40_000);

  it("같은 밤 진입에서 산 마피아 소켓은 산 사람 여섯 모두가 home 에 선 snap 하나를 받는다 (걷던 사람도 한 점)", async () => {
    const { g, home } = await nominationWithWalkers();
    const marks = g.socks.map((s) => mark(s));

    await advanceTo(g.code, g.socks, "night");
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));

    const everyone = g.actors.map((a) => a.seat).sort((p, q) => p - q);
    for (const a of withRole(g, "mafia")) {
      const msgs = got[g.actors.indexOf(a)]!;
      expect(worldFramesOf(a.sock, marks[g.actors.indexOf(a)]!).map((m) => m.k).join(",")).toBe("snap");
      expect(snapSeatsOf(msgs)).toBe(everyone.join(","));
      expect(snapPoints(msgs)).toBe(homeRows(home, everyone));
    }
  }, 40_000);

  it("DO 가 퇴거된 뒤에도 home 은 저장소에 남아 있다 (기록 즉시 저장)", async () => {
    const { g, home } = await nominationWithWalkers();
    await advanceTo(g.code, g.socks, "night");

    await evictDurableObject(env.ROOM.getByName(g.code));

    expect(await homeBySeat(g.code)).toBe(home);
    expect(home).not.toBe("none");
  }, 40_000);
});

// 09-09 Task 2·3 가 아래에 아침 진입·직접 불변식 L1·세 경로 동일성·재접속 시험을 더한다.
describe("아침 진입 — 모두 home (결정 0061-4, UI-SPEC A1·L5)", () => {
  /** 밤에 마피아 둘이 시민 V 를 고르고 마피아 A 가 걷게 한 뒤 아침으로 넘긴다. */
  async function morningAfterWalk(): Promise<{ g: Game; victim: Game["actors"][number]; walker: Game["actors"][number]; home: string; got: ServerMessage[][]; marks: number[] }> {
    const g = await startedGame("night");
    const [walker, other] = withRole(g, "mafia") as [Game["actors"][number], Game["actors"][number]];
    const victim = withRole(g, "citizen")[0]!;
    pickAs(walker, victim.seat);
    pickAs(other, victim.seat);
    moveAs(walker, 300, 100);
    await pause(200);
    moveAs(walker, 200, -100);
    for (const sock of g.socks) await settle(sock, mark(sock));
    const home = await homeBySeat(g.code);
    const marks = g.socks.map((s) => mark(s));
    await advanceTo(g.code, g.socks, "morning");
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));
    return { g, victim, walker, home, got, marks };
  }

  it("산 사람 다섯 소켓(마피아 포함)이 받은 아침 world 는 snap 하나로 모두 같고, 걷던 마피아도 자기 home 에 서 있다", async () => {
    const { g, victim, home, got, marks } = await morningAfterWalk();
    const alive = g.actors.filter((a) => a !== victim);
    const aliveSeats = alive.map((a) => a.seat).sort((p, q) => p - q);

    const columns = alive.map((a) => stable(worldFramesOf(a.sock, marks[g.actors.indexOf(a)]!)));
    expect(new Set(columns).size).toBe(1);
    for (const a of alive) {
      expect(worldFramesOf(a.sock, marks[g.actors.indexOf(a)]!).map((m) => m.k).join(",")).toBe("snap");
      expect(snapSeatsOf(got[g.actors.indexOf(a)]!)).toBe(aliveSeats.join(","));
      expect(snapPoints(got[g.actors.indexOf(a)]!)).toBe(homeRows(home, aliveSeats));
    }
  }, 40_000);

  it("탈락한 V 의 소켓은 여섯 모두의 snap 을 정확히 하나 받는다 (같은 snap 을 두 번 받지 않는다)", async () => {
    const { g, victim, home, got, marks } = await morningAfterWalk();

    expect(worldFramesOf(victim.sock, marks[g.actors.indexOf(victim)]!).map((m) => m.k).join(",")).toBe("snap");
    expect(snapSeatsOf(got[g.actors.indexOf(victim)]!)).toBe("0,1,2,3,4,5");
    expect(snapPoints(got[g.actors.indexOf(victim)]!)).toBe(homeRows(home, [0, 1, 2, 3, 4, 5]));
  }, 40_000);

  it("알람이 늦어 토론에서 지목·밤을 지나 아침으로 한 번에 따라잡아도 아침 위치가 토론이 끝난 자리(home)다", async () => {
    const g = await startedGame("discussion");
    moveAs(withRole(g, "citizen")[0]!, -120, 60);
    moveAs(withRole(g, "mafia")[0]!, 160, -80);
    for (const sock of g.socks) await settle(sock, mark(sock));
    await flushWorld(g.code);
    const before = await segEndsBySeat(g.code, 1);
    const late = PHASE_DEFS.nomination.durationMs! + PHASE_DEFS.night.durationMs! + 1000;
    await editRoom(g.code, (room) => ({ ...room, phaseEndsAt: Date.now() - late }));
    const marks = g.socks.map((s) => mark(s));

    expect(await runDurableObjectAlarm(env.ROOM.getByName(g.code))).toBe(true);
    for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "morning");
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));

    const everyone = g.actors.map((a) => a.seat).sort((p, q) => p - q);
    expect(await homeBySeat(g.code)).toBe(before);
    for (const a of g.actors) expect(snapPoints(got[g.actors.indexOf(a)]!)).toBe(homeRows(before, everyone));
  }, 40_000);
});

describe("직접 불변식 L1 — 밤 동안 시민 편 소켓은 마피아 활동에서 한 프레임도 받지 않는다 (NIGHT-07)", () => {
  it("산 마피아 둘이 move ×3·pick·chat·typing 을 보내는 구간에 순수 시민 두 소켓과 경찰·의사 소켓의 settle 결과가 [] 다", async () => {
    const g = await startedGame("night");
    const [a, b] = withRole(g, "mafia") as [Game["actors"][number], Game["actors"][number]];
    const target = withRole(g, "citizen")[0]!;

    const got = await observe(g, a, async () => {
      for (const [px, pz] of [
        [200, 200],
        [-200, 100],
        [100, -250],
      ] as const) {
        moveAs(a, px, pz);
        moveAs(b, pz, px);
        await pause(200);
      }
      pickAs(a, target.seat);
      pickAs(b, target.seat);
      chatSend(a.sock, "오늘 밤은 저 사람");
      typingSend(b.sock, true);
      await pause(300);
      typingSend(b.sock, false);
    });

    const quiet = g.actors.filter((x) => x.role !== "mafia");
    expect(quiet.length).toBe(4);
    expect(quiet.map((x) => summary(got[g.actors.indexOf(x)]!)).join(",")).toBe("[],[],[],[]");
  }, 40_000);
});
