// 저녁·아침 [건너뛰기] 워커 통합 시험 (21-05 Task 2, D-23, 위협 T-21-12·T-21-13).
// 확장판 4명 판 저녁: 산 사람 셋이 누르면 모든 소켓의 day.skipCount 가 3이고 단계는 그대로, 넷째가 누르면 night 로 바뀐다.
// 단계는 마감을 당겨 걷고 실제 시간을 기다리지 않는다. 실패 출력은 한 줄이어야 해서(TAP) 값은 문자열로 견준다.
import { describe, expect, it } from "vitest";
import { advanceTo, editRoom, killSeats, lastViewOf, mark, mapPlayers, send, settle, startedGame } from "./helpers";
import type { Actor, Game } from "./helpers";

const json = (v: unknown): string => JSON.stringify(v);
const skipAs = (a: Actor, on: boolean): void => send(a.sock, { t: "skipPhase", on });
const quiet = async (g: Game): Promise<void> => {
  for (const s of g.socks) await settle(s, mark(s));
};
/** 소켓이 from 이후 받은 프레임 종류 열(settle 의 pong 은 뺀다). */
const typesSince = (g: Game, marks: number[]): string[] => g.socks.map((s, i) => s.frames.slice(marks[i]!).map((raw) => (JSON.parse(raw) as { t: string }).t).filter((t) => t !== "pong").join("+"));
/** 모든 소켓의 마지막 view 의 day.skipCount 열. */
const counts = (g: Game): string => json(g.actors.map((a) => lastViewOf(a.sock).day?.skipCount));

describe("저녁 [건너뛰기] — 모두 누르면 일찍 넘어간다 (D-23)", () => {
  it("산 사람 넷 중 셋이 누르면 모든 소켓의 day.skipCount 가 3이고 단계는 그대로, 넷째가 누르면 night 로 바뀐다(새 마감 = 지금 + 밤 길이)", async () => {
    const g = await startedGame("errand", 3);
    for (const a of g.actors.slice(0, 3)) {
      skipAs(a, true);
      await quiet(g);
    }
    expect(`${counts(g)} ${json(g.actors.map((a) => lastViewOf(a.sock).phase))}`).toBe(`[3,3,3,3] ${json(Array(4).fill("errand"))}`);
    expect(json(g.actors.map((a) => lastViewOf(a.sock).me.skipPhase))).toBe("[true,true,true,null]");
    skipAs(g.actors[3]!, true);
    await quiet(g);
    const v = lastViewOf(g.actors[0]!.sock);
    const left = (v.phaseEndsAt ?? 0) - v.serverNow;
    expect(`${json(g.actors.map((a) => lastViewOf(a.sock).phase))} ${left > (v.phaseDurationMs ?? 0) - 3000 && left <= (v.phaseDurationMs ?? 0)}`).toBe(`${json(Array(4).fill("night"))} true`);
    expect(json(g.actors.map((a) => "skipCount" in (lastViewOf(a.sock).day ?? {})))).toBe(json(Array(4).fill(false)));
  }, 60_000);

  it("취소(on false)하면 수가 줄고, 같은 값을 또 보내면 아무도 프레임을 받지 않는다", async () => {
    const g = await startedGame("errand", 3);
    skipAs(g.actors[0]!, true);
    await quiet(g);
    const marks = g.socks.map((s) => mark(s));
    skipAs(g.actors[0]!, true);
    await quiet(g);
    const noop = typesSince(g, marks);
    skipAs(g.actors[0]!, false);
    await quiet(g);
    expect(`${json(noop)} ${counts(g)} ${json(g.actors.map((a) => lastViewOf(a.sock).me.skipPhase))}`).toBe(`["","","",""] [0,0,0,0] [null,null,null,null]`);
  }, 60_000);

  it("유령의 skipPhase 는 거절 응답이고 수가 바뀌지 않는다 — 산 사람 모두가 눌러야 넘어가며 죽은 사람은 세지 않는다", async () => {
    const g = await startedGame("errand", 3);
    const ghost = g.actors[3]!;
    await killSeats(g, [ghost.seat]);
    const marks = g.socks.map((s) => mark(s));
    skipAs(ghost, true);
    await quiet(g);
    expect(json(typesSince(g, marks))).toBe(json(["", "", "", "error+state"]));
    for (const a of g.actors.slice(0, 3)) {
      skipAs(a, true);
      await quiet(g);
    }
    expect(json(g.actors.slice(0, 3).map((a) => lastViewOf(a.sock).phase))).toBe(json(Array(3).fill("night")));
  }, 60_000);

  it("아침에도 모두 누르면 토론으로 넘어간다", async () => {
    const g = await startedGame("night", 3);
    const victim = g.actors.find((a) => a.role !== "mafia")!;
    for (const m of g.actors.filter((a) => a.role === "mafia")) send(m.sock, { t: "pick", target: victim.seat });
    await quiet(g);
    await advanceTo(g.code, g.socks, "morning");
    const living = g.actors.filter((a) => a !== victim);
    for (const a of living) {
      skipAs(a, true);
      await quiet(g);
    }
    expect(json(living.map((a) => lastViewOf(a.sock).phase))).toBe(json(living.map(() => "discussion")));
  }, 60_000);

  it("봇은 분모에서 빠진다 — 사람 셋이 모두 누르면 봇이 안 눌러도 넘어간다(21-06 이탈 1)", async () => {
    const g = await startedGame("errand", 3);
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === g.actors[3]!.seat ? { ...p, isBot: true } : p)));
    for (const a of g.actors.slice(0, 3)) {
      skipAs(a, true);
      await quiet(g);
    }
    expect(json(g.actors.slice(0, 3).map((a) => lastViewOf(a.sock).phase))).toBe(json(Array(3).fill("night")));
  }, 60_000);

  it("접속이 끊긴 사람은 막지 않는다 — 접속 중인 사람 셋이 누르면 넘어간다, 둘만 눌렀으면 그대로", async () => {
    const g = await startedGame("errand", 3);
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === g.actors[3]!.seat ? { ...p, connected: false } : p)));
    for (const a of g.actors.slice(0, 2)) {
      skipAs(a, true);
      await quiet(g);
    }
    const waiting = json(g.actors.slice(0, 3).map((a) => lastViewOf(a.sock).phase));
    skipAs(g.actors[2]!, true);
    await quiet(g);
    expect(`${waiting} ${json(g.actors.slice(0, 3).map((a) => lastViewOf(a.sock).phase))}`).toBe(`${json(Array(3).fill("errand"))} ${json(Array(3).fill("night"))}`);
  }, 60_000);

  it("21-10: 아직 안 누른 마지막 사람의 연결이 끊기면 서버가 다시 보고 바로 넘어간다 — 누른 사람이 더 누를 일이 없어도 멈추지 않는다", async () => {
    const g = await startedGame("errand", 3);
    for (const a of g.actors.slice(0, 3)) {
      skipAs(a, true);
      await quiet(g);
    }
    const waiting = json(g.actors.slice(0, 3).map((a) => lastViewOf(a.sock).phase));
    g.actors[3]!.sock.ws.close(1000, "bye");
    for (const s of g.socks.slice(0, 3)) await settle(s, mark(s));
    expect(`${waiting} ${json(g.actors.slice(0, 3).map((a) => lastViewOf(a.sock).phase))}`).toBe(`${json(Array(3).fill("errand"))} ${json(Array(3).fill("night"))}`);
  }, 60_000);
});
