// 유언·쪽지 워커 통합 테스트(09-12, WILL-01·NIGHT-12, 결정 0061-9·10): 저장한 소켓에만 state, 다른 소켓은 프레임 0개(L7).
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { chatSend, chatsOf, closePhase, ghostsOf, killSeats, lastViewOf, mark, pause, pickAs, pointAll, send, settle, startedGame, storedRoom, summary, toPhase, withRole } from "./helpers";
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

// ---- 쪽지 (NIGHT-12) ----
/** 밤 6명 판에서 시민 한 명을 유령으로 만들고, 산 마피아 전원이 다른 시민을 골라 확정시킨 뒤 소켓을 비운다. */
async function confirmedNightGame(confirm = true): Promise<{ g: Game; mafias: Game["actors"]; others: Game["actors"]; ghost: Game["actors"][number] }> {
  const g = await startedGame("night");
  const citizens = withRole(g, "citizen");
  const ghostSeat = citizens[0]!.seat;
  const { ghosts } = await ghostsOf(g, [ghostSeat]);
  const mafias = withRole(g, "mafia");
  if (confirm) for (const m of mafias) pickAs(m, citizens[1]!.seat);
  for (const a of g.actors) await settle(a.sock, mark(a.sock));
  return { g, mafias, others: g.actors.filter((a) => !mafias.includes(a) && a !== ghosts[0]), ghost: ghosts[0]! };
}

describe("쪽지 저장 (NIGHT-12)", () => {
  it("확정 뒤 마피아 A 의 note 는 산 마피아 둘에게만 같은 me.note state 로 가고 시민 편 소켓·유령 소켓은 프레임 0개다", async () => {
    const { g, mafias, others, ghost } = await confirmedNightGame();
    const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
    send(mafias[0]!.sock, { t: "note", text: "미안해요" });
    for (const m of mafias) {
      const got = await settle(m.sock, marks.get(m)!);
      expect(summary(got)).toBe("[state:night]");
      expect((got[0] as State).view.me.note).toBe("미안해요");
    }
    for (const o of [...others, ghost]) expect(summary(await settle(o.sock, marks.get(o)!))).toBe("[]");
    const stored = (await storedRoom(g.code)) as unknown as Stored;
    expect(stored.nightNote).toBe("미안해요");
    expect(JSON.stringify(stored.players)).not.toContain("미안해요");
  });

  it("이어서 마피아 B 가 다른 글을 보내면 두 마피아 화면이 B 의 글이다(마지막 저장이 이김)", async () => {
    const { g, mafias } = await confirmedNightGame();
    send(mafias[0]!.sock, { t: "note", text: "첫 글" });
    for (const m of mafias) await settle(m.sock, mark(m.sock));
    // B 의 간격 기록은 따로다 — 같은 사람이 아니므로 바로 받는다.
    const marks = new Map(mafias.map((a) => [a, mark(a.sock)]));
    send(mafias[1]!.sock, { t: "note", text: "둘째 글" });
    for (const m of mafias) {
      await settle(m.sock, marks.get(m)!);
      expect(lastViewOf(m.sock).me.note).toBe("둘째 글");
    }
  });

  it("확정 전 note 는 보낸 소켓에만 error BAD_MESSAGE + state 이고 저장되지 않는다", async () => {
    const { g, mafias, others } = await confirmedNightGame(false);
    const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
    send(mafias[0]!.sock, { t: "note", text: "이른 글" });
    expect(summary(await settle(mafias[0]!.sock, marks.get(mafias[0]!)!))).toBe("[error:BAD_MESSAGE,state:night]");
    expect(summary(await settle(mafias[1]!.sock, marks.get(mafias[1]!)!))).toBe("[]");
    for (const o of others) expect(summary(await settle(o.sock, marks.get(o)!))).toBe("[]");
    expect(((await storedRoom(g.code)) as unknown as Stored).nightNote).toBeUndefined();
  });

  it("시민 편의 note 는 그 소켓에만 error BAD_MESSAGE + state 이고 마피아 소켓은 프레임 0개다", async () => {
    const { g, mafias, others } = await confirmedNightGame();
    const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
    send(others[0]!.sock, { t: "note", text: "가짜 쪽지" });
    expect(summary(await settle(others[0]!.sock, marks.get(others[0]!)!))).toBe("[error:BAD_MESSAGE,state:night]");
    for (const m of mafias) expect(summary(await settle(m.sock, marks.get(m)!))).toBe("[]");
    expect(((await storedRoom(g.code)) as unknown as Stored).nightNote).toBeUndefined();
  });

  it("낮에 note 는 WRONG_PHASE 이다", async () => {
    const g = await startedGame("discussion");
    const m = withRole(g, "mafia")[0]!;
    const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
    send(m.sock, { t: "note", text: "낮 글" });
    expect(summary(await settle(m.sock, marks.get(m)!))).toBe("[error:WRONG_PHASE,state:discussion]");
    for (const a of g.actors) if (a !== m) expect(summary(await settle(a.sock, marks.get(a)!))).toBe("[]");
  });
});

// ---- 유언 단계 (22-11, D-15·D-16·D-23: defense = 처형자의 10초 유언) ----
/** 시민 둘 중 첫 시민이 지목을 모두 받아 처형자가 된 유언 단계. 처형자·다른 산 사람(시민 둘째)·나머지를 돌려준다. */
async function defenseGame(): Promise<{ g: Game; cand: Game["actors"][number]; other: Game["actors"][number]; rest: Game["actors"] }> {
  const g = await startedGame("nomination");
  const [cand, other] = withRole(g, "citizen") as [Game["actors"][number], Game["actors"][number]];
  await pointAll(g.code, g.actors, Object.fromEntries(g.actors.map((a) => [a.seat, a === cand ? other.seat : cand.seat])));
  for (const a of g.actors) await settle(a.sock, mark(a.sock));
  expect((await storedRoom(g.code)).phase).toBe("defense");
  return { g, cand, other, rest: g.actors.filter((a) => a !== cand) };
}

describe("유언 단계 — 처형자만 쓴다 (D-16)", () => {
  it("처형자의 will 은 저장되고 그 소켓에만 state 가 간다. 다른 산 사람의 will 은 WRONG_PHASE 이고 저장되지 않는다", async () => {
    const { g, cand, other } = await defenseGame();
    const mine = await sendWill(g, cand, { t: "will", text: "잘 있어" });
    expect(summary(mine.mine)).toBe("[state:defense]");
    expect(mine.others).toEqual(["[]", "[]", "[]", "[]", "[]"]);
    expect(await willOf(g, cand.seat)).toBe("잘 있어");
    const theirs = await sendWill(g, other, { t: "will", text: "내 글" });
    expect(summary(theirs.mine)).toBe("[error:WRONG_PHASE,state:defense]");
    expect(await willOf(g, other.seat)).toBeUndefined();
  });
});

describe("유언 단계 — [남기기] final (D-15, T-22-21)", () => {
  it("처형자의 final 은 직전 자동 저장 직후여도(500ms 안) 받아들여져 곧바로 처형 단계가 되고 유언 카드가 나온다", async () => {
    const { g, cand } = await defenseGame();
    await sendWill(g, cand, { t: "will", text: "쓰던 글" });
    const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
    send(cand.sock, { t: "will", text: "잘 있어", final: true });
    const got = await settle(cand.sock, marks.get(cand)!);
    const states = got.filter((m): m is State => m.t === "state");
    expect(states.at(-1)?.view.phase).toBe("execution");
    expect((await storedRoom(g.code)).phase).toBe("execution");
    expect(await willOf(g, cand.seat)).toBe("잘 있어");
    const cards = chatsOf(got).filter((m) => m.k === "will");
    expect(cards.map((m) => `${m.seat}/${m.text}`).join(",")).toBe(`${cand.seat}/잘 있어`);
    const stored = (await storedRoom(g.code)) as unknown as { players: Array<{ seat: number; alive?: boolean }> };
    expect(stored.players.find((p) => p.seat === cand.seat)?.alive).toBe(false);
  });

  it("처형자가 아닌 사람의 final 은 단계를 당기지 못하고 일반 저장 거절과 같은 응답이다", async () => {
    const { g, other } = await defenseGame();
    const r = await sendWill(g, other, { t: "will", text: "내 글", final: true });
    expect(summary(r.mine)).toBe("[error:WRONG_PHASE,state:defense]");
    expect(r.others).toEqual(["[]", "[]", "[]", "[]", "[]"]);
    expect((await storedRoom(g.code)).phase).toBe("defense");
    expect(await willOf(g, other.seat)).toBeUndefined();
  });

  it("처형자가 아닌 사람의 final 은 다른 단계(토론)에서도 단계를 당기지 못한다", async () => {
    const g = await startedGame("discussion");
    const me = withRole(g, "citizen")[0]!;
    await sendWill(g, me, { t: "will", text: "a", final: true });
    expect((await storedRoom(g.code)).phase).toBe("discussion");
    expect(await willOf(g, me.seat)).toBe("a");
  });

  it("final 없이 10초 마감이 되면 마지막 저장 글이 유언 카드로 나온다", async () => {
    const { g, cand } = await defenseGame();
    await sendWill(g, cand, { t: "will", text: "마지막 저장" });
    const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
    await closePhase(g.code);
    const got = await settle(g.actors[0]!.sock, marks.get(g.actors[0]!)!);
    const cards = chatsOf(got).filter((m) => m.k === "will");
    expect(cards.map((m) => `${m.seat}/${m.text}`).join(",")).toBe(`${cand.seat}/마지막 저장`);
  });

  it("글 없이 마감이 되면 유언 카드가 없다", async () => {
    const { g } = await defenseGame();
    const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
    await closePhase(g.code);
    const got = await settle(g.actors[0]!.sock, marks.get(g.actors[0]!)!);
    expect(chatsOf(got).filter((m) => m.k === "will").length).toBe(0);
  });

  it("스키마: final 은 true 뿐이다 — false·덧붙은 키는 BAD_MESSAGE", async () => {
    const { g, cand } = await defenseGame();
    const a = await sendWill(g, cand, { t: "will", text: "a", final: false });
    expect(summary(a.mine)).toBe("[error:BAD_MESSAGE]");
    const b = await sendWill(g, cand, { t: "will", text: "a", final: true, seat: 1 });
    expect(summary(b.mine)).toBe("[error:BAD_MESSAGE]");
    expect((await storedRoom(g.code)).phase).toBe("defense");
  });
});

describe("유언 단계 — 채팅 잠금 (D-16, P22-9, T-22-23)", () => {
  it("산 사람·유령의 채팅은 거절되고 어느 소켓에도 채팅 줄이 가지 않는다", async () => {
    const { g, cand, other, rest } = await defenseGame();
    const ghost = rest.find((a) => a !== other && a.role !== "mafia")!;
    await killSeats(g, [ghost.seat]);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const marks = new Map(g.actors.map((a) => [a, mark(a.sock)]));
    for (const sender of [cand, other, ghost]) chatSend(sender.sock, "한마디");
    const all: ServerMessage[] = [];
    for (const a of g.actors) all.push(...(await settle(a.sock, marks.get(a)!)));
    expect(chatsOf(all).length).toBe(0);
    expect(summary(all.filter((m) => m.t === "chatReject"))).toBe("[chatReject,chatReject,chatReject]");
  });
});
