// 아침 공개의 서버 층 DO 시험(09-14, MORN-01·MORN-02, WILL-01, NIGHT-12, 결정 0061-11·14).
// 사망 전환(처형·암살)에서 서버가 유언·쪽지 카드를 한 번만 만든다. 카드는 all 채널 줄이고 k 가 will/note 다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { chatRecordsOf, chatsOf, closePhase, editRoom, mapPlayers, mark, nextFrame, pointAll, settle, startedGame, verdictAll, withRole } from "./helpers";
import type { Game } from "./helpers";

type Card = Extract<ServerMessage, { t: "chat" }>;

/** 소켓마다 mark 이후의 chat 프레임을 모은다. */
async function chatsSince(g: Game, marks: number[]): Promise<Card[][]> {
  const out: Card[][] = [];
  for (let i = 0; i < g.socks.length; i += 1) out.push(chatsOf(await settle(g.socks[i]!, marks[i]!)));
  return out;
}

const cardText = (c: Card): string => `${c.ch}/${c.k ?? "-"}/${c.seat}/${c.text}`;

/** 처형으로 끝나는 낮: defender 에게 will(있으면)을 저장해 두고 지목 → 변론 → 찬반 통과 → 처형 진입까지 끌고 간다. 처형 진입 전 mark 를 돌려준다. */
async function execute(will: string | undefined): Promise<{ g: Game; defender: Game["actors"][number]; marks: number[] }> {
  const g = await startedGame("nomination");
  const defender = withRole(g, "citizen")[0]!;
  if (will !== undefined) {
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === defender.seat ? { ...p, will } : p)));
  }
  const others = g.actors.filter((a) => a.seat !== defender.seat);
  const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
  for (const o of others) bySeat[o.seat] = defender.seat;
  await pointAll(g.code, g.actors, bySeat);
  await closePhase(g.code);
  for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "verdict");
  const marks = g.socks.map((s) => mark(s));
  await verdictAll(g.code, g.actors, Object.fromEntries(others.map((o) => [o.seat, true])));
  return { g, defender, marks };
}

describe("처형된 사람의 유언 카드 (WILL-01, MORN-02)", () => {
  it("유언 '억울해요' 를 남긴 사람이 처형되면 여섯 소켓 모두 all 채널 will 카드 한 장을 받고 저장소에도 k will 줄이 있다", async () => {
    const { g, defender, marks } = await execute("억울해요");
    const got = await chatsSince(g, marks);
    expect(got.map((c) => c.map(cardText).join("|")).join(" ; ")).toBe(g.socks.map(() => `all/will/${defender.seat}/억울해요`).join(" ; "));
    const stored = Object.values(await chatRecordsOf(g.code)).filter((r) => r.k === "will");
    expect(stored.map((r) => `${r.ch}/${r.seat}/${r.text}`).join("|")).toBe(`all/${defender.seat}/억울해요`);
  }, 40_000);

  it("유언이 없는 사람이 처형되면 chat 프레임이 0개다", async () => {
    const { g, marks } = await execute(undefined);
    const got = await chatsSince(g, marks);
    expect(got.map((c) => c.length).join(",")).toBe(g.socks.map(() => 0).join(","));
    expect(Object.values(await chatRecordsOf(g.code)).filter((r) => r.k !== undefined).length).toBe(0);
  }, 40_000);

  it("처형에는 분필이 없다: 처형 직후 모든 소켓의 day.chalk 가 없다", async () => {
    const { g } = await execute("억울해요");
    for (const sock of g.socks) {
      const last = sock.frames.map((f) => JSON.parse(f) as ServerMessage).filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").at(-1)!;
      expect(last.view.day?.chalk === undefined).toBe(true);
    }
  }, 40_000);
});
