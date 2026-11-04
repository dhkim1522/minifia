// 찬반 기록 공개의 서버 층 DO 시험(09.1.1-03, POL-03, 결정 0066-3·0066-7, L19).
// 찬반 마감 훅이 편든 좌석 목록을 남기고, 처형 단계 view 가 모든 소켓에 같은 목록을 싣는다. 찬반 진행 중에는 던진 좌석(voted)뿐이다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { EXECUTION_MS, VERDICT_LEAD_MS } from "../../shared/game/phases";
import { closePhase, framesOf, lastViewOf, nextFrame, pointAll, startedGame, storedRoom, verdictAll } from "./helpers";
import type { Game } from "./helpers";

const viewsOf = (msgs: ServerMessage[]): RoomView[] =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").map((m) => m.view);

/** 지목 -> 변론 -> 찬반까지 끌고 간 판: 시민 한 명이 변론자, 나머지(5명)는 좌석 오름차순 유권자다. */
async function toVerdict(): Promise<{ g: Game; defender: Game["actors"][number]; voters: Game["actors"] }> {
  const g = await startedGame("nomination");
  const defender = g.actors.find((a) => a.role === "citizen")!;
  const voters = g.actors.filter((a) => a.seat !== defender.seat).sort((a, b) => a.seat - b.seat);
  const bySeat: Record<number, number> = { [defender.seat]: voters[0]!.seat };
  for (const o of voters) bySeat[o.seat] = defender.seat;
  await pointAll(g.code, g.actors, bySeat);
  await closePhase(g.code); // 변론 -> 찬반
  for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "verdict");
  return { g, defender, voters };
}

describe("찬반 기록 공개 (결정 0066-3, L19)", () => {
  it("3:1:미투표 로 마감하면 처형 단계의 모든 소켓이 같은 day.ballots 를 받고 변론자·미투표 좌석은 어느 목록에도 없다; 단계는 5600ms", async () => {
    const { g, defender, voters } = await toVerdict();
    const deadline = await verdictAll(g.code, g.actors, {
      [voters[0]!.seat]: true,
      [voters[1]!.seat]: true,
      [voters[2]!.seat]: true,
      [voters[3]!.seat]: false,
    });
    const want = JSON.stringify({ yes: [voters[0]!.seat, voters[1]!.seat, voters[2]!.seat], no: [voters[3]!.seat] });
    const views = g.socks.map(lastViewOf);
    expect(views.map((v) => v.phase).join(",")).toBe(g.socks.map(() => "execution").join(","));
    expect(views.map((v) => JSON.stringify(v.day?.ballots)).join("|")).toBe(g.socks.map(() => want).join("|"));
    const listed = views.flatMap((v) => [...(v.day?.ballots?.yes ?? []), ...(v.day?.ballots?.no ?? [])]);
    expect(listed.includes(defender.seat)).toBe(false);
    expect(listed.includes(voters[4]!.seat)).toBe(false);
    // 유령이 된 변론자 소켓도 같은 목록을 받는다
    const defIdx = g.actors.findIndex((a) => a.seat === defender.seat);
    expect(JSON.stringify(views[defIdx]!.day?.ballots)).toBe(want);
    // 처형 단계 길이: 공개 값만의 함수(5000 + 판결 앞머리 600)
    expect(EXECUTION_MS).toBe(5000 + VERDICT_LEAD_MS);
    expect(views.map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => "5600").join(","));
    expect((await storedRoom(g.code)).phaseEndsAt).toBe(deadline + 5600);
  }, 60_000);

  it("찬반(verdict) 진행 중의 모든 프레임에는 어떤 소켓도 day.ballots 키를 받지 않고, 처형이 끝나 밤으로 가면 다시 없다", async () => {
    const { g, voters } = await toVerdict();
    await verdictAll(g.code, g.actors, { [voters[0]!.seat]: true, [voters[1]!.seat]: false, [voters[2]!.seat]: true });
    await closePhase(g.code); // 처형 -> 밤
    for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "night");
    for (const [i, sock] of g.socks.entries()) {
      const phases = viewsOf(framesOf(sock)).map((v) => `${v.phase}:${Object.hasOwn(v.day ?? {}, "ballots")}`);
      expect(`${i}/${phases.filter((p) => p.startsWith("verdict:")).join(",")}`).toBe(
        `${i}/${phases.filter((p) => p.startsWith("verdict:")).map(() => "verdict:false").join(",")}`,
      );
      expect(phases.filter((p) => p.startsWith("verdict:")).length > 0).toBe(true);
      expect(phases.filter((p) => p.startsWith("execution:")).every((p) => p === "execution:true")).toBe(true);
      expect(phases.filter((p) => p.startsWith("night:")).every((p) => p === "night:false")).toBe(true);
    }
  }, 60_000);

  it("부결(찬성 2 / 반대 2)이어도 day.ballots 가 실린다", async () => {
    const { g, voters } = await toVerdict();
    await verdictAll(g.code, g.actors, {
      [voters[0]!.seat]: true,
      [voters[1]!.seat]: true,
      [voters[2]!.seat]: false,
      [voters[3]!.seat]: false,
    });
    const want = JSON.stringify({ yes: [voters[0]!.seat, voters[1]!.seat], no: [voters[2]!.seat, voters[3]!.seat] });
    expect(g.socks.map((s) => JSON.stringify(lastViewOf(s).day?.ballots)).join("|")).toBe(g.socks.map(() => want).join("|"));
    expect(g.socks.map((s) => String(lastViewOf(s).day?.verdict?.passed)).join(",")).toBe(g.socks.map(() => "false").join(","));
  }, 60_000);
});
