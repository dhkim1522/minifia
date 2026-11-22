// 23-08 Task 2: 실제 방 DO 에서 "전원이 끝내면 일찍 넘어간다"(0089-26, D-11·D-12·D-25).
// 1.5초를 실제로 기다리지 않는다(Pitfall 9) — 저장된 phaseEndsAt 을 읽고 forceDue + 알람으로 단계를 넘긴다. 실시간 1.5초는 23-12 E2E 한 곳이다.
// 마감 단축 시각은 서버가 모든 소켓에 같이 싣는 serverNow 와 비교한다(도착 시각이 아니라 서버 시각).
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EARLY_GRACE_MS } from "../../shared/game/early";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { openKeyword } from "../helpers/keyword";
import { actorsOf, advanceTo, alarmOf, closed, editRoom, forceDue, mark, nextFrame, pause, seat, send, settle, storedRoom, verdictAll } from "./helpers";
import type { Seated, TestSocket } from "./helpers";

const socksOf = (room: Seated): TestSocket[] => [room.host, ...room.guests.map((g) => g.sock)];
const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;
type State = Extract<ServerMessage, { t: "state" }>;
/** 그 소켓이 mark 이후 받은 state 프레임의 view 들. */
const viewsAfter = (sock: TestSocket, from: number): RoomView[] =>
  sock.frames.slice(from).map(parse).filter((m): m is State => m.t === "state").map((m) => m.view);

async function flushAll(socks: TestSocket[]): Promise<void> {
  for (const s of socks) await settle(s, mark(s));
}

/** 시작해서 phase 까지 간 방. 소켓 프레임은 모두 flush 되어 있다. */
async function gameAt(guests: number, phase: Parameters<typeof advanceTo>[2], options: { testMode?: boolean; bots?: number } = {}): Promise<{ room: Seated; socks: TestSocket[] }> {
  const room = await seat(guests, 0, options.testMode === true ? { testMode: true } : {});
  const socks = socksOf(room);
  await flushAll(socks);
  if ((options.bots ?? 0) > 0) {
    send(room.host, { t: "testBots", count: options.bots });
    const total = guests + 1 + options.bots!;
    for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "lobby" && m.view.players.length === total);
    // 봇도 있는 상태에서 사람만으로 마감이 줄어드는지 본다. 재현 모드는 봇의 별도 답안 알람을 예약하지 않는다.
    send(room.host, { t: "testBotVote", exec: "no", pick: "random" });
    await nextFrame(room.host, (m) => m.t === "state" && m.view.me.testBotVote?.exec === "no");
    await flushAll(socks);
  }
  send(room.host, { t: "start" });
  for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, phase);
  await flushAll(socks);
  return { room, socks };
}

/** 한 행동을 보내고 모든 소켓을 flush 해, 소켓마다 그 행동이 만든 state view 들을 돌려준다. */
async function actAndSettle(socks: TestSocket[], act: () => void): Promise<RoomView[][]> {
  const marks = socks.map((s) => mark(s));
  act();
  const out: RoomView[][] = [];
  for (let i = 0; i < socks.length; i += 1) {
    await settle(socks[i]!, marks[i]!);
    out.push(viewsAfter(socks[i]!, marks[i]!));
  }
  return out;
}

/** 마감이 줄어든 순간: 모든 소켓이 정확히 state 한 장을 받고, 같은 phaseEndsAt(= 저장값)·단계 길이 그대로이며 serverNow 기준으로 약 1.5초 뒤다. */
function expectShrunk(got: RoomView[][], storedEndsAt: number, origin: number, durationMs: number): void {
  for (const views of got) {
    expect(views.length).toBe(1);
    const v = views[0]!;
    expect(v.phaseEndsAt).toBe(storedEndsAt);
    expect(v.phaseDurationMs).toBe(durationMs);
    expect(v.phaseEndsAt! - v.serverNow).toBeLessThanOrEqual(EARLY_GRACE_MS);
    expect(v.phaseEndsAt! - v.serverNow).toBeGreaterThan(EARLY_GRACE_MS - 800);
  }
  expect(storedEndsAt).toBeLessThan(origin);
}

/** 서버 전용 earlyFrom(원래 마감)은 어느 소켓의 어느 프레임에도 이름이 없다(T-23-31). */
const noEarlyFrom = (socks: TestSocket[]): void => {
  for (const s of socks) expect(s.frames.join("\n").includes("earlyFrom")).toBe(false);
};

const send3 = (socks: TestSocket[], msg: unknown): void => {
  for (const s of socks) send(s, msg);
};

describe("키워드 — 사람 전원이 확정하면 일찍 넘어간다 (D-11)", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = openKeyword();
  });
  afterEach(() => restore());

  it("사람 3 + 봇 1: 사람 둘까지는 마감 그대로, 셋째 확정에서 모든 소켓이 같은 새 마감을 받고 알람이 옮겨 가며 봇은 대상이 아니다", async () => {
    const { room, socks } = await gameAt(2, "keyword", { testMode: true, bots: 1 });
    const origin = (await storedRoom(room.code)).phaseEndsAt!;
    const alarm0 = await alarmOf(room.code);

    send(socks[0]!, { t: "answer", text: "친구들", final: true });
    send(socks[1]!, { t: "answer", text: "동료들", final: true });
    await flushAll(socks);
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(origin);
    expect(await alarmOf(room.code)).toBe(alarm0);

    const got = await actAndSettle(socks, () => send(socks[2]!, { t: "answer", text: "가족들", final: true }));
    const after = await storedRoom(room.code);
    expect(after.phase).toBe("keyword");
    expectShrunk(got, after.phaseEndsAt!, origin, 35_000);
    noEarlyFrom(socks);
    expect(await alarmOf(room.code)).toBe(after.phaseEndsAt);
    expect((after as unknown as { earlyFrom?: unknown }).earlyFrom).toEqual({ phase: "keyword", day: 0, endsAt: origin });

    // 새 마감으로 알람이 울리면 다음 단계(낮 시작)로 간다.
    await advanceTo(room.code, socks, "dayAnnounce");
  });

  it("사람 하나가 확정하지 않았으면 마감 그대로 — 끊긴 사람이 있어도 같다(D-12)", async () => {
    const { room, socks } = await gameAt(3, "keyword");
    const origin = (await storedRoom(room.code)).phaseEndsAt!;
    const gone = room.guests[2]!.sock;
    gone.ws.close(1000, "test");
    await closed(gone);
    await flushAll(socks.slice(0, 3));
    await actAndSettle(socks.slice(0, 3), () => {
      send(socks[0]!, { t: "answer", text: "친구들", final: true });
      send(socks[1]!, { t: "answer", text: "동료들", final: true });
      send(socks[2]!, { t: "answer", text: "가족들", final: true });
    });
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(origin);
  });

  it("확정 뒤 답을 바꾸려 해도(첫 확정 불변) 마감은 한 번 줄면 더 건드리지 않는다 — 연장 없음(D-25)", async () => {
    const { room, socks } = await gameAt(3, "keyword");
    await actAndSettle(socks, () => {
      for (const [i, s] of socks.entries()) send(s, { t: "answer", text: `답${i}번`, final: true });
    });
    const shrunk = (await storedRoom(room.code)).phaseEndsAt!;
    await pause(450);
    const got = await actAndSettle(socks, () => send(socks[0]!, { t: "answer", text: "바꾼답", final: true }));
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(shrunk);
    expect(got.every((views) => views.length === 0)).toBe(true);
  });
});

describe("찬반 — 산 사람 전원이 투표하면 일찍 넘어가고 번복은 연장한다 (D-11·D-25)", () => {
  it("전원 투표 → 모든 소켓이 같은 새 마감, 유예 안 번복 → 다시 그 시각 + 1.5초(원래 마감 이내), 알람이 따라간다", async () => {
    const { room, socks } = await gameAt(3, "verdict");
    const origin = (await storedRoom(room.code)).phaseEndsAt!;
    for (const s of socks.slice(0, 3)) send(s, { t: "verdict", agree: true });
    await flushAll(socks);
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(origin);

    const got = await actAndSettle(socks, () => send(socks[3]!, { t: "verdict", agree: true }));
    const first = (await storedRoom(room.code)).phaseEndsAt!;
    expectShrunk(got, first, origin, 10_000);
    noEarlyFrom(socks);
    expect(await alarmOf(room.code)).toBe(first);

    // 번복: 마감이 뒤로 밀린다(늘어난다) — 원래 마감을 넘지 않는다.
    await pause(40);
    const flip = await actAndSettle(socks, () => send(socks[1]!, { t: "verdict", agree: false }));
    const second = (await storedRoom(room.code)).phaseEndsAt!;
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThanOrEqual(origin);
    for (const views of flip) {
      expect(views.length).toBe(1);
      expect(views[0]!.phaseEndsAt).toBe(second);
    }
    expect(await alarmOf(room.code)).toBe(second);

    // 상한: 저장된 원래 마감을 now + 1.5초 바로 아래로 낮춰 두면 번복이 그 값에서 멈춘다.
    const cap = second + 5;
    await editRoom(room.code, (r) => ({ ...r, earlyFrom: { phase: "verdict", day: (r.day as number | undefined) ?? 0, endsAt: cap } }));
    await pause(40);
    await actAndSettle(socks, () => send(socks[1]!, { t: "verdict", agree: true }));
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(cap);

    // 마감이 되면 다음 단계(전원 찬성 → 통과 → 지목)로 간다.
    await forceDue(room.code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(env.ROOM.getByName(room.code))).toBe(true);
    expect((await storedRoom(room.code)).phase).toBe("nomination");
  });

  it("한 사람이 끊겨 던지지 못하면 나머지 전원이 던져도 마감 그대로(D-12)", async () => {
    const { room, socks } = await gameAt(3, "verdict");
    const origin = (await storedRoom(room.code)).phaseEndsAt!;
    const gone = room.guests[2]!.sock;
    gone.ws.close(1000, "test");
    await closed(gone);
    const live = socks.slice(0, 3);
    await flushAll(live);
    await actAndSettle(live, () => send3(live, { t: "verdict", agree: true }));
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(origin);
  });
});

describe("밤 — 산 사람 전원이 고르면 일찍 넘어가고 연장은 없다 (D-11·D-25)", () => {
  /** 전원이 같은 좌석(0)을 고른다. 마지막은 방장(좌석 0) 소켓. */
  async function nightGame(): Promise<{ room: Seated; socks: TestSocket[]; origin: number }> {
    const { room, socks } = await gameAt(3, "night");
    return { room, socks, origin: (await storedRoom(room.code)).phaseEndsAt! };
  }

  it("셋까지는 본인에게만 응답하고 마감 그대로, 마지막 pick 에서 모든 소켓이 같은 새 마감을 받는다. 그 뒤 pick 변경은 마감 그대로이고 본인에게만 간다", async () => {
    const { room, socks, origin } = await nightGame();
    const actors = actorsOf(room);
    const order = [...actors].sort((a, b) => b.seat - a.seat); // 좌석 큰 쪽부터, 좌석 0 이 마지막
    for (const a of order.slice(0, 3)) send(a.sock, { t: "pick", target: 0 });
    await flushAll(socks);
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(origin);

    const got = await actAndSettle(socks, () => send(order[3]!.sock, { t: "pick", target: 0 }));
    const shrunk = (await storedRoom(room.code)).phaseEndsAt!;
    expectShrunk(got, shrunk, origin, 30_000);
    noEarlyFrom(socks);
    expect(await alarmOf(room.code)).toBe(shrunk);

    // 줄어든 뒤의 변경: 받아들여지지만 마감 그대로, 시민 편(마피아가 아닌) 본인에게만 프레임이 간다(연장 방송 없음).
    const changer = actors.find((a) => a.role !== "mafia")!;
    await pause(40);
    const change = await actAndSettle(socks, () => send(changer.sock, { t: "pick", target: 1 }));
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(shrunk);
    change.forEach((views, i) => {
      if (socks[i] === changer.sock) {
        expect(views.length).toBe(1);
        expect(views[0]!.phaseEndsAt).toBe(shrunk);
      } else {
        expect(views.length).toBe(0);
      }
    });

    await advanceTo(room.code, socks, "morning");
  });

  it("한 사람이 끊겨 고르지 못하면 나머지 전원이 골라도 마감 그대로(D-12)", async () => {
    const { room, socks, origin } = await nightGame();
    const gone = room.guests[2]!.sock;
    gone.ws.close(1000, "test");
    await closed(gone);
    const live = socks.slice(0, 3);
    await flushAll(live);
    await actAndSettle(live, () => send3(live, { t: "pick", target: 0 }));
    expect((await storedRoom(room.code)).phaseEndsAt).toBe(origin);
  });
});

describe("연출 단계·낮 시작은 어떤 메시지로도 못 넘긴다 (D-12, 0089-26)", () => {
  /** 모든 소켓이 세 종류의 개인 행동 메시지를 다 보내 본다. */
  const spam = (socks: TestSocket[]): void => {
    send3(socks, { t: "verdict", agree: true });
    send3(socks, { t: "pick", target: 0 });
    send3(socks, { t: "answer", text: "아무말", final: true });
  };

  it("낮 시작(dayAnnounce)·아침(morning) 마감은 줄지 않는다", async () => {
    const day = await gameAt(3, "dayAnnounce");
    const dayOrigin = (await storedRoom(day.room.code)).phaseEndsAt!;
    await actAndSettle(day.socks, () => spam(day.socks));
    expect((await storedRoom(day.room.code)).phaseEndsAt).toBe(dayOrigin);

    const night = await gameAt(3, "morning");
    const morningOrigin = (await storedRoom(night.room.code)).phaseEndsAt!;
    await actAndSettle(night.socks, () => spam(night.socks));
    expect((await storedRoom(night.room.code)).phaseEndsAt).toBe(morningOrigin);
  });

  describe("정답 공개(answerReveal)", () => {
    let restore: () => void = () => {};
    beforeEach(() => {
      restore = openKeyword();
    });
    afterEach(() => restore());

    it("첫날 부결 뒤 정답 공개 마감은 줄지 않는다", async () => {
      const { room, socks } = await gameAt(3, "verdict");
      const actors = actorsOf(room);
      await verdictAll(room.code, actors, Object.fromEntries(actors.map((a) => [a.seat, false])));
      await flushAll(socks);
      expect((await storedRoom(room.code)).phase).toBe("answerReveal");
      const origin = (await storedRoom(room.code)).phaseEndsAt!;
      await actAndSettle(socks, () => spam(socks));
      expect((await storedRoom(room.code)).phaseEndsAt).toBe(origin);
    });
  });
});
