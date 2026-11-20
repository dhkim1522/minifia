// 의심 포스트잇 워커 통합 시험(24-01, 결정 0089-10, D-01~D-06·D-22·D-25·D-26): 실제 방 DO 로 둘째 날 토론에서 붙이기·옮기기·거절·간격을 돈다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { editRoom, framesOf, killSeats, mapPlayers, mark, send, settle, startedGame, storedRoom, summary, toPhase } from "./helpers";
import type { Actor, Game } from "./helpers";

type StateMsg = Extract<ServerMessage, { t: "state" }>;
const states = (msgs: ServerMessage[]): StateMsg[] => msgs.filter((m): m is StateMsg => m.t === "state");

/** 저장된 방의 notes(서버 전용 보관). */
async function notesOf(code: string): Promise<Array<{ n: number; from: number; to: number }>> {
  return ((await storedRoom(code)) as unknown as { notes?: Array<{ n: number; from: number; to: number }> }).notes ?? [];
}

/** 실제 착석 상태를 유지한 채 원하는 일차와 단계로 옮긴다. */
async function discussionAt(day: number, phase: "discussion" | "verdict" = "discussion"): Promise<Game> {
  const g = await startedGame("discussion");
  await toPhase(g.code, phase, (room) => ({ ...room, day }));
  for (const s of g.socks) await settle(s, mark(s));
  return g;
}

/** 한 사람이 suspect 를 보내고 모든 소켓의 프레임을 g.actors 순서로 돌려준다(보낸 쪽 flush 가 먼저다). */
async function suspectFrom(g: Game, from: Actor, target: number): Promise<ServerMessage[][]> {
  const marks = g.actors.map((a) => mark(a.sock));
  send(from.sock, { t: "suspect", target });
  const out: ServerMessage[][] = g.actors.map(() => []);
  const order = [from, ...g.actors.filter((a) => a !== from)];
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

describe("의심 포스트잇 — 트레이서 (D-01·D-03·D-04·D-06)", () => {
  it("둘째 날 토론에서 다른 참가자에게 붙이면 모든 소켓의 view 에 day.suspects 가, 보낸 사람 view 에만 me.suspectTo 가 생기고 저장된 notes 가 한 줄이다", async () => {
    const g = await discussionAt(2);
    const a = g.actors[1]!;
    const b = g.actors[2]!;
    const frames = await suspectFrom(g, a, b.seat);
    g.actors.forEach((actor, i) => {
      const st = states(frames[i]!);
      expect(st.length).toBe(1);
      expect(st[0]!.view.day?.suspects).toEqual([{ to: b.seat, from: a.seat }]);
      if (actor === a) expect(st[0]!.view.me.suspectTo).toBe(b.seat);
      else expect("suspectTo" in st[0]!.view.me).toBe(false);
    });
    expect(await notesOf(g.code)).toEqual([{ n: 2, from: a.seat, to: b.seat }]);
    // 서버 전용 이름 notes 는 어느 프레임에도 키로 없다.
    for (const actor of g.actors) expect(JSON.stringify(framesOf(actor.sock)).includes('"notes"')).toBe(false);
  });

  it("재즈 바 가운데 좌석에서는 반대편 산 사람도 대상으로 고른다", async () => {
    const g = await startedGame("discussion", 7);
    await toPhase(g.code, "discussion", (room) => ({ ...room, day: 2 }));
    const from = g.actors[1]!;
    const to = g.actors[7]!;
    await suspectFrom(g, from, to.seat);
    expect(await notesOf(g.code)).toEqual([{ n: 2, from: from.seat, to: to.seat }]);
  });
});

// ---- 거절 균일성 · 연타 간격 · 같은 대상 무변화 · 봇 (24-01 Task 2: D-02·D-05·D-25·D-26) ----

const sleep = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** 간격(SUSPECT_MIN_GAP_MS=600)을 넘기려 기다린다. */
const pastGap = (): Promise<void> => sleep(700);

describe("의심 포스트잇 — 거절 균일성 (D-26, T-24-02)", () => {
  /** 한 사람이 보내 거절될 때 모든 소켓이 받는 프레임 요약. 보낸 사람은 [error BAD_MESSAGE, state] 두 프레임이고 나머지는 0개다. */
  const expectRejected = (g: Game, from: Actor, frames: ServerMessage[][], phase: string): void => {
    g.actors.forEach((a, i) => {
      expect(summary(frames[i]!)).toBe(a === from ? `[error:BAD_MESSAGE,state:${phase}]` : "[]");
    });
  };

  it("첫날 방은 거절된다", async () => {
    const g = await discussionAt(1);
    expectRejected(g, g.actors[1]!, await suspectFrom(g, g.actors[1]!, g.actors[2]!.seat), "discussion");
    expect(await notesOf(g.code)).toEqual([]);
  });

  it("찬반 단계는 거절된다", async () => {
    const g = await discussionAt(2, "verdict");
    expectRejected(g, g.actors[1]!, await suspectFrom(g, g.actors[1]!, g.actors[2]!.seat), "verdict");
    expect(await notesOf(g.code)).toEqual([]);
  });

  it("죽은 대상은 거절된다", async () => {
    const g = await discussionAt(2);
    await killSeats(g, [g.actors[2]!.seat]);
    expectRejected(g, g.actors[1]!, await suspectFrom(g, g.actors[1]!, g.actors[2]!.seat), "discussion");
  });

  it("자기 자신은 거절된다", async () => {
    const g = await discussionAt(2);
    expectRejected(g, g.actors[1]!, await suspectFrom(g, g.actors[1]!, g.actors[1]!.seat), "discussion");
  });

  it("빈 좌석은 거절된다(5명 손님 + 방장 = 6석, 좌석 7 은 비어 있다)", async () => {
    const g = await discussionAt(2);
    expectRejected(g, g.actors[1]!, await suspectFrom(g, g.actors[1]!, 7), "discussion");
  });
});

describe("의심 포스트잇 — 연타 간격과 같은 대상 (D-01·D-25, T-24-03)", () => {
  it("받아들인 직후 600ms 안의 다른 대상 요청은 오류도 방송도 없이 버려지고 notes 는 그대로다. 간격이 지나면 옮기기가 받아들여진다", async () => {
    const g = await discussionAt(2);
    const a = g.actors[1]!;
    await suspectFrom(g, a, g.actors[2]!.seat);
    const quick = await suspectFrom(g, a, g.actors[3]!.seat);
    g.actors.forEach((_, i) => expect(summary(quick[i]!)).toBe("[]"));
    expect(await notesOf(g.code)).toEqual([{ n: 2, from: a.seat, to: g.actors[2]!.seat }]);
    await pastGap();
    const moved = await suspectFrom(g, a, g.actors[3]!.seat);
    g.actors.forEach((_, i) => expect(states(moved[i]!).length).toBe(1));
    expect(await notesOf(g.code)).toEqual([{ n: 2, from: a.seat, to: g.actors[3]!.seat }]);
  });

  it("같은 대상을 다시 보내면(간격 밖) 어떤 소켓에도 프레임이 없고 저장된 방이 그대로다", async () => {
    const g = await discussionAt(2);
    const a = g.actors[1]!;
    await suspectFrom(g, a, g.actors[2]!.seat);
    const before = JSON.stringify(await storedRoom(g.code));
    await pastGap();
    const again = await suspectFrom(g, a, g.actors[2]!.seat);
    g.actors.forEach((_, i) => expect(summary(again[i]!)).toBe("[]"));
    expect(JSON.stringify(await storedRoom(g.code))).toBe(before);
  });

  it("옮기기는 줄 수를 늘리지 않고, 다른 사람의 종이는 그대로다(받은 사람은 뗄 수 없다 — 메시지가 없다)", async () => {
    const g = await discussionAt(2);
    const a = g.actors[1]!;
    const b = g.actors[2]!;
    await suspectFrom(g, a, b.seat);
    await suspectFrom(g, b, a.seat); // b 가 a 에게 붙인다 — a 가 받은 종이를 떼는 길은 없다
    await pastGap();
    await suspectFrom(g, a, g.actors[3]!.seat);
    expect(await notesOf(g.code)).toEqual([
      { n: 2, from: b.seat, to: a.seat },
      { n: 2, from: a.seat, to: g.actors[3]!.seat },
    ]);
  });
});

describe("의심 포스트잇 — 봇 (D-05)", () => {
  it("사람이 봇 좌석에 붙이는 요청은 받아들여진다", async () => {
    const g = await discussionAt(2);
    const target = g.actors[2]!;
    await editRoomPlayer(g.code, target.seat, { isBot: true });
    const frames = await suspectFrom(g, g.actors[1]!, target.seat);
    g.actors.forEach((_, i) => expect(states(frames[i]!).length).toBe(1));
    expect(await notesOf(g.code)).toEqual([{ n: 2, from: g.actors[1]!.seat, to: target.seat }]);
  });
});

/** 저장 방의 한 좌석 플레이어에 값을 덧붙인다. */
async function editRoomPlayer(code: string, seat: number, patch: Record<string, unknown>): Promise<void> {
  await editRoom(code, (room) => mapPlayers(room, (p) => (p.seat === seat ? { ...p, ...patch } : p)));
}
