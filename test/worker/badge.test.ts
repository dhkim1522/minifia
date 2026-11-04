// 직업 주장 배지 워커 통합 테스트(09.1.1-01, 결정 0066-1): 주장은 공개 값이라 바뀌면 모든 소켓이 각자 view 를 받는다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { lastViewOf, mark, pause, send, settle, startedGame, summary } from "./helpers";
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
