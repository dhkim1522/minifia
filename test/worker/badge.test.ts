// 직업 주장 배지 워커 통합 테스트(09.1.1-01, 결정 0066-1): 주장은 공개 값이라 바뀌면 모든 소켓이 각자 view 를 받는다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { connect, editRoom, hello, lastViewOf, mapPlayers, mark, pause, send, settle, startedGame, storedRoom, summary, toPhase } from "./helpers";
import type { Game } from "./helpers";

type State = Extract<ServerMessage, { t: "state" }>;

/** 한 사람이 badge 를 보내고 모든 소켓의 프레임을 소켓 순서대로 돌려준다(보낸 쪽 flush 가 먼저다). */
async function sendBadge(g: Game, from: Game["actors"][number], role: string): Promise<ServerMessage[][]> {
  const marks = g.actors.map((a) => mark(a.sock));
  send(from.sock, { t: "badge", role });
  const out: ServerMessage[][] = g.actors.map(() => []);
  const order = [from, ...g.actors.filter((a) => a !== from)];
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

describe("직업 주장 — 트레이서 (결정 0066-1)", () => {
  it("토론에서 손님이 citizen 을 걸면 네 소켓이 정확히 한 프레임씩 받고 그 좌석의 players[].badge 가 citizen 이며 badgeSwapped 키는 없다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    const frames = await sendBadge(g, claimer, "citizen");
    for (const f of frames) expect(summary(f)).toBe("[state:discussion]");
    for (const f of frames) {
      const row = (f[0] as State).view.players.find((p) => p.seat === claimer.seat)!;
      expect(row.badge).toBe("citizen");
      expect("badgeSwapped" in row).toBe(false);
    }
  });

  it("아무도 안 건 좌석의 players[] 에는 badge 키가 없다(undefined 로도 남기지 않는다)", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    await sendBadge(g, claimer, "citizen");
    const view = lastViewOf(g.actors[0]!.sock);
    for (const row of view.players) {
      if (row.seat === claimer.seat) continue;
      expect("badge" in row).toBe(false);
    }
  });

  it("같은 값을 다시 보내면 저장·전송이 없다(프레임 0)", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    await sendBadge(g, claimer, "citizen");
    await pause(300);
    const frames = await sendBadge(g, claimer, "citizen");
    for (const f of frames) expect(summary(f)).toBe("[]");
  });
});

describe("직업 주장 — 규칙 완성 (결정 0066-1)", () => {
  it("말 바꿈: police 를 걸었다가 mafia 로 바꾸면 모든 소켓이 mafia + badgeSwapped 를 받고 이전 값(police)은 프레임 어디에도 없다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    await sendBadge(g, claimer, "police");
    await pause(300);
    const frames = await sendBadge(g, claimer, "mafia");
    for (const f of frames) {
      expect(summary(f)).toBe("[state:discussion]");
      const row = (f[0] as State).view.players.find((p) => p.seat === claimer.seat)!;
      expect(row.badge).toBe("mafia");
      expect(row.badgeSwapped).toBe(true);
      expect(JSON.stringify((f[0] as State).view.players)).not.toContain("police"); // 이전 값 — day.roles(구성표)에는 직업 이름이 원래 있다
      expect(JSON.stringify(f)).not.toContain("badgeLog");
    }
  });

  it("값을 none 으로 되돌려도 badgeSwapped 는 남고 badge 는 none 이다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[2]!;
    await sendBadge(g, claimer, "citizen");
    await pause(300);
    const frames = await sendBadge(g, claimer, "none");
    const row = (frames[0]![0] as State).view.players.find((p) => p.seat === claimer.seat)!;
    expect(`${row.badge}|${row.badgeSwapped}`).toBe("none|true");
  });

  it("마감 뒤(defense·night·lobby)의 badge 는 보낸 소켓에만 [error:WRONG_PHASE,state] 가 가고 다른 소켓은 0프레임이며 저장은 그대로다", async () => {
    for (const phase of ["defense", "night", "lobby"] as const) {
      const g = await startedGame("discussion", 3);
      const claimer = g.actors[1]!;
      await toPhase(g.code, phase);
      for (const a of g.actors) await settle(a.sock, mark(a.sock));
      const before = JSON.stringify((await storedRoom(g.code)).players);
      const frames = await sendBadge(g, claimer, "police");
      const mine = frames[g.actors.indexOf(claimer)]!;
      expect(`${phase} ${summary(mine)}`).toBe(`${phase} [error:WRONG_PHASE,state:${phase}]`);
      const others = g.actors.filter((a) => a !== claimer).map((a) => summary(frames[g.actors.indexOf(a)]!));
      expect(`${phase} ${others.join("")}`).toBe(`${phase} ${"[]".repeat(others.length)}`);
      expect(JSON.stringify((await storedRoom(g.code)).players)).toBe(before);
    }
  });

  it("4명판에서 doctor 주장은 보낸 소켓에만 BAD_MESSAGE 이고 저장되지 않는다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    const frames = await sendBadge(g, claimer, "doctor");
    expect(summary(frames[g.actors.indexOf(claimer)]!)).toBe("[error:BAD_MESSAGE,state:discussion]");
    const others = g.actors.filter((a) => a !== claimer).map((a) => summary(frames[g.actors.indexOf(a)]!));
    expect(others.join("")).toBe("[][][]");
    expect(lastViewOf(claimer.sock).players.find((p) => p.seat === claimer.seat)).not.toHaveProperty("badge");
  });

  it("유령의 badge 는 보낸 소켓에만 BAD_MESSAGE 가 가고 다른 소켓은 0프레임이다", async () => {
    const g = await startedGame("discussion", 5);
    const ghost = g.actors[1]!;
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === ghost.seat ? { ...p, alive: false } : p)));
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const frames = await sendBadge(g, ghost, "citizen");
    expect(summary(frames[g.actors.indexOf(ghost)]!)).toBe("[error:BAD_MESSAGE,state:discussion]");
    expect(frames.filter((_, i) => g.actors[i] !== ghost).map(summary).join("")).toBe("[][][][][]");
  });

  it("재접속(hello)한 소켓의 첫 state 에 현재 모든 산 사람의 badge·badgeSwapped 가 실린다", async () => {
    const g = await startedGame("discussion", 3);
    const [, a, b] = g.actors as [Game["actors"][number], Game["actors"][number], Game["actors"][number]];
    await sendBadge(g, a, "police");
    await pause(300);
    await sendBadge(g, a, "citizen");
    await sendBadge(g, b, "mafia");
    const fresh = await connect(g.code);
    const first = await hello(fresh, g.actors[3]!.token);
    const rows = first.view.players.map((p) => `${p.seat}:${p.badge ?? "-"}:${p.badgeSwapped === true ? "swap" : "-"}`).join(",");
    const want = g.actors
      .map((x) => x.seat)
      .sort((x, y) => x - y)
      .map((seat) => (seat === a.seat ? `${seat}:citizen:swap` : seat === b.seat ? `${seat}:mafia:-` : `${seat}:-:-`))
      .join(",");
    expect(rows).toBe(want);
  });

  it("250ms 안의 두 번째 다른 값은 오류 없이 버려지고 300ms 뒤에는 받아들여진다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    await sendBadge(g, claimer, "citizen");
    const fast = await sendBadge(g, claimer, "police");
    for (const f of fast) expect(summary(f)).toBe("[]");
    await pause(300);
    const slow = await sendBadge(g, claimer, "police");
    for (const f of slow) expect(summary(f)).toBe("[state:discussion]");
  });
});
