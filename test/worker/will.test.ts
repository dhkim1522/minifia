// 유언·쪽지 워커 통합 테스트(09-12, WILL-01·NIGHT-12, 결정 0061-9·10): 저장한 소켓에만 state, 다른 소켓은 프레임 0개(L7).
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { lastViewOf, mark, pause, send, settle, startedGame, storedRoom, summary, toPhase, withRole } from "./helpers";
import type { Game } from "./helpers";

type State = Extract<ServerMessage, { t: "state" }>;

interface Stored {
  players: Array<{ seat: number; will?: string; nightNote?: string }>;
  nightNote?: string;
}

const willOf = async (g: Game, seatNo: number): Promise<string | undefined> =>
  ((await storedRoom(g.code)) as unknown as Stored).players.find((p) => p.seat === seatNo)?.will;

/** 보낸 사람 소켓의 프레임과 나머지 소켓들의 프레임 요약. */
async function sendWill(g: Game, from: Game["actors"][number], msg: unknown): Promise<{ mine: ServerMessage[]; others: string[] }> {
  const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
  send(from.sock, msg);
  const mine = await settle(from.sock, marks.get(from)!);
  const others: string[] = [];
  for (const a of g.actors) if (a !== from) others.push(summary(await settle(a.sock, marks.get(a)!)));
  return { mine, others };
}

describe("유언 저장 (WILL-01)", () => {
  it("토론의 시민이 will 을 보내면 그 소켓에만 me.will state 가 가고 나머지 다섯은 프레임 0개이며 방에 저장된다", async () => {
    const g = await startedGame("discussion");
    const me = withRole(g, "citizen")[0]!;
    const r = await sendWill(g, me, { t: "will", text: "범인은 2번" });
    expect(summary(r.mine)).toBe("[state:discussion]");
    expect((r.mine[0] as State).view.me.will).toBe("범인은 2번");
    expect(r.others).toEqual(["[]", "[]", "[]", "[]", "[]"]);
    expect(await willOf(g, me.seat)).toBe("범인은 2번");
  });

  it("같은 값을 다시 보내면 프레임이 0개다", async () => {
    const g = await startedGame("discussion");
    const me = withRole(g, "citizen")[0]!;
    await sendWill(g, me, { t: "will", text: "같은 글" });
    await pause(600);
    const r = await sendWill(g, me, { t: "will", text: "같은 글" });
    expect(summary(r.mine)).toBe("[]");
    expect(r.others).toEqual(["[]", "[]", "[]", "[]", "[]"]);
  });

  it("500ms 안의 다른 값은 오류 없이 버려지고, 600ms 뒤에는 저장된다", async () => {
    const g = await startedGame("discussion");
    const me = withRole(g, "citizen")[0]!;
    await sendWill(g, me, { t: "will", text: "첫 글" });
    await pause(100);
    const fast = await sendWill(g, me, { t: "will", text: "둘째 글" });
    expect(summary(fast.mine)).toBe("[]");
    expect(fast.others).toEqual(["[]", "[]", "[]", "[]", "[]"]);
    expect(await willOf(g, me.seat)).toBe("첫 글");
    await pause(600);
    const slow = await sendWill(g, me, { t: "will", text: "셋째 글" });
    expect(summary(slow.mine)).toBe("[state:discussion]");
    expect(await willOf(g, me.seat)).toBe("셋째 글");
  });

  it("공백뿐인 글은 유언을 지운다(키째)", async () => {
    const g = await startedGame("discussion");
    const me = withRole(g, "citizen")[0]!;
    await sendWill(g, me, { t: "will", text: "지울 글" });
    await pause(600);
    const r = await sendWill(g, me, { t: "will", text: "   " });
    expect(summary(r.mine)).toBe("[state:discussion]");
    expect(lastViewOf(me.sock).me.will).toBeUndefined();
    expect(await willOf(g, me.seat)).toBeUndefined();
  });

  it("로비에서 will 은 보낸 소켓에만 error WRONG_PHASE + state 이고 저장되지 않는다", async () => {
    const g = await startedGame("discussion");
    const me = withRole(g, "citizen")[0]!;
    await toPhase(g.code, "lobby");
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const r = await sendWill(g, me, { t: "will", text: "로비 글" });
    expect(summary(r.mine)).toBe("[error:WRONG_PHASE,state:lobby]");
    expect(r.others).toEqual(["[]", "[]", "[]", "[]", "[]"]);
    expect(await willOf(g, me.seat)).toBeUndefined();
  });

  it("덧붙은 키는 BAD_MESSAGE 이고 저장되지 않는다", async () => {
    const g = await startedGame("discussion");
    const me = withRole(g, "citizen")[0]!;
    const r = await sendWill(g, me, { t: "will", text: "a", seat: 0 });
    expect(summary(r.mine)).toBe("[error:BAD_MESSAGE]");
    expect(await willOf(g, me.seat)).toBeUndefined();
  });
});
