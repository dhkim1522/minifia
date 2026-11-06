// 12-03: 'ended' 간헐 실패의 두 경합을 결정적으로 고정한다 (D-26).
// (1) 낡은 메모리 방 덮어쓰기 — editRoom 이 저장소만 고치면 evict 가 끝나기 전에 봇 알람이 메모리 방을 통째로 저장해 고친 표가 사라진다.
// (2) 봇의 남은 계획 — 손으로 정한 표를 봇이 알람에 깨어 무작위 표로 덮는다.
// (3) skipOnce 가 앞 전이의 뒤늦은 state 프레임(같은 단계)에 일찍 풀리는 경합 — 가짜 소켓에 프레임을 시간차로 밀어 넣어 반환 시점을 본다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { awaitTransition, clearBotSteps, connect, createRoom, hello, mapPlayers, nextFrame, seat, send, skipOnce, skipThrough, storedRoom, writeRoomEdit, type TestSocket } from "./helpers";

// ---- 가짜 소켓 ----

/** DO 없이 프레임을 직접 밀어 넣는 소켓. connect 가 하는 일(frames 에 쌓고 기다리는 쪽을 깨움)만 똑같이 한다. */
function fakeSocket(): TestSocket {
  return { ws: { send: () => undefined } as unknown as WebSocket, frames: [], cursor: 0, waiters: [], closedPromise: new Promise(() => undefined) };
}

function push(sock: TestSocket, msg: unknown): void {
  sock.frames.push(JSON.stringify(msg));
  for (const w of sock.waiters.splice(0)) w();
}

const stateOf = (phase: string): ServerMessage => ({ t: "state", view: { phase } }) as unknown as ServerMessage;

/** 옛 skipOnce 의 기다림: 보내기 전 cursor 를 끝으로 옮기고 소켓마다 '아무 state 프레임' 하나를 받으면 끝난다. */
async function legacyWait(socks: TestSocket[], trigger: () => void, limitMs: number): Promise<void> {
  for (const s of socks) s.cursor = s.frames.length;
  trigger();
  for (const s of socks) await nextFrame(s, (m) => m.t === "state", limitMs);
}

describe("skipOnce 전이 대기 (D-26)", () => {
  it("앞 전이의 뒤늦은 같은 단계 프레임이 먼저 와도 옛 대기는 일찍 풀리고 새 대기는 바뀐 단계의 프레임까지 기다린다", async () => {
    const script = (socks: TestSocket[]) => () => {
      for (const s of socks) {
        setTimeout(() => push(s, stateOf("discussion")), 0); // 앞 전이의 뒤늦은 프레임(같은 단계)
        setTimeout(() => push(s, stateOf("nomination")), 80); // 진짜 전이
      }
    };

    const oldSocks = [fakeSocket(), fakeSocket()];
    const t0 = Date.now();
    await legacyWait(oldSocks, script(oldSocks), 1000);
    // 증명: 옛 대기는 진짜 전이 프레임(80ms)보다 먼저 풀린다 — 이때 소켓이 가진 프레임은 뒤늦은 한 개뿐이다.
    expect(oldSocks.map((s) => s.frames.length).join(",")).toBe("1,1");
    expect(String(Date.now() - t0 < 70)).toBe("true");

    const socks = [fakeSocket(), fakeSocket()];
    const t1 = Date.now();
    const phase = await awaitTransition(socks, script(socks), async () => "discussion", 1000);
    expect(phase).toBe("nomination");
    expect(String(Date.now() - t1 >= 70)).toBe("true");
    expect(socks.map((s) => s.frames.length).join(",")).toBe("2,2");
  });

  it("바뀐 단계의 프레임이 한도 안에 안 오면 어느 단계에서 기다렸는지 담아 던진다", async () => {
    const socks = [fakeSocket(), fakeSocket()];
    const trigger = () => {
      for (const s of socks) setTimeout(() => push(s, stateOf("discussion")), 0);
    };
    let message = "";
    try {
      await awaitTransition(socks, trigger, async () => "discussion", 120);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("discussion");
    expect(message).toContain("120");
  });

  it("소켓마다 따로 기다린다 — 한 소켓에만 진짜 프레임이 늦으면 그 소켓을 기다린다", async () => {
    const socks = [fakeSocket(), fakeSocket(), fakeSocket()];
    const trigger = () => {
      setTimeout(() => push(socks[0]!, stateOf("nomination")), 0);
      setTimeout(() => push(socks[1]!, stateOf("nomination")), 20);
      setTimeout(() => push(socks[2]!, stateOf("nomination")), 90);
    };
    const t0 = Date.now();
    expect(await awaitTransition(socks, trigger, async () => "discussion", 1000)).toBe("nomination");
    expect(String(Date.now() - t0 >= 80)).toBe("true");
  });

  it("보내기 전에 이미 쌓여 있던 낡은 프레임은 읽지 않는다", async () => {
    const socks = [fakeSocket(), fakeSocket()];
    // 앞 전이가 남긴, 바뀐 단계와 같은 모양의 낡은 프레임. cursor 가 끝으로 옮겨져야 읽히지 않는다.
    for (const s of socks) push(s, stateOf("nomination"));
    const trigger = () => {
      for (const s of socks) setTimeout(() => push(s, stateOf("nomination")), 60);
    };
    const t0 = Date.now();
    await awaitTransition(socks, trigger, async () => "discussion", 1000);
    expect(String(Date.now() - t0 >= 50)).toBe("true");
    expect(socks.map((s) => s.cursor).join(",")).toBe("2,2");
  });
});

// ---- editRoom 과 메모리 방 ----

describe("editRoom 은 evict 전에 도는 저장이 고친 값을 덮지 못하게 한다 (D-26)", () => {
  /** 봇 알람(runDueBots)이 하는 저장: 살아 있는 인스턴스의 메모리 방을 통째로 저장소에 쓴다. */
  async function persistMemoryRoom(code: string): Promise<void> {
    await runInDurableObject(env.ROOM.getByName(code), async (instance, state) => {
      await state.storage.put("room", (instance as unknown as { room: unknown }).room);
    });
  }

  async function hasMarker(code: string, value: string): Promise<boolean> {
    return (await storedRoom(code) as unknown as Record<string, unknown>)["marker"] === value;
  }

  it("저장소만 고치면 메모리 방 저장이 덮어쓰고(옛 방식, 간헐 실패의 원인), writeRoomEdit 은 지킨다", async () => {
    const { code, token } = await createRoom("방장", { testMode: true });
    const host = await connect(code);
    await hello(host, token); // 인스턴스가 방을 메모리에 올린다

    // 옛 editRoom: 저장소만 고친다.
    await runInDurableObject(env.ROOM.getByName(code), async (_i, state) => {
      const room = await state.storage.get<Record<string, unknown>>("room");
      await state.storage.put("room", { ...room, marker: "old-way" });
    });
    expect(await hasMarker(code, "old-way")).toBe(true);
    await persistMemoryRoom(code);
    expect(await hasMarker(code, "old-way")).toBe(false); // 고친 값이 사라졌다

    // 새 방식: 메모리 방도 같이 고친다.
    await writeRoomEdit(env.ROOM.getByName(code), (room) => ({ ...room, marker: "kept" }));
    await persistMemoryRoom(code);
    expect(await hasMarker(code, "kept")).toBe(true);
  });
});

// ---- 봇의 남은 계획 ----

describe("손으로 정한 봇 표를 봇의 남은 계획이 덮지 않는다 (D-26)", () => {
  type Raw = Record<string, unknown>;

  /** 방장 + 연결 손님 1 + 봇 3 테스트 방을 찬반(verdict)까지 끌고 간다. 봇 계획(botPlan)에는 봇마다 찬반 행동이 들어 있다. */
  async function verdictRoom() {
    const r = await seat(1, 0, { testMode: true });
    const socks = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, (m) => m.t === "state" && m.view.phase === "lobby" && m.view.players.length === 5);
    send(r.host, { t: "start" });
    for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    await skipThrough(r, "nomination");
    await writeRoomEdit(env.ROOM.getByName(r.code), (room) =>
      mapPlayers(clearBotSteps(room), (p) => (p.isBot === true ? { ...p, nominate: 0 } : p.seat === 0 ? { ...p, nominate: 1 } : p)),
    );
    await skipOnce(r); // 지목 마감 → 변론(봇 셋이 방장을 가리킨다)
    await skipThrough(r, "verdict");
    return r;
  }

  const botVotes = async (code: string): Promise<string> =>
    (await storedRoom(code)).players.filter((p) => (p as Raw).isBot === true).map((p) => String(p.verdictVote)).join(",");

  /** 봇 모두를 찬성으로 정하고, 때가 지난 '반대' 계획 행동을 봇마다 하나씩 남겨 둔다. */
  const yesWithDueNo = (room: Raw): Raw => {
    const plan = room["botPlan"] as { key: string };
    const bots = (room["players"] as Raw[]).filter((p) => p["isBot"] === true);
    const steps = bots.map((b) => ({ at: Date.now() - 1, botId: b["id"], act: { t: "verdict", agree: false } }));
    return mapPlayers({ ...room, botPlan: { key: plan.key, steps } }, (p) => (p.isBot === true ? { ...p, verdictVote: true } : p));
  };

  it("남은 계획이 있으면 알람이 찬성으로 정한 표를 반대로 덮고(옛 방식, 간헐 실패의 원인), clearBotSteps 를 거치면 표가 그대로다", async () => {
    const r = await verdictRoom();
    const stub = env.ROOM.getByName(r.code);
    expect(String((await storedRoom(r.code) as unknown as Raw)["botPlan"] !== undefined)).toBe("true");

    await writeRoomEdit(stub, yesWithDueNo);
    expect(await botVotes(r.code)).toBe("true,true,true");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await botVotes(r.code)).toBe("false,false,false"); // 때가 된 계획 행동이 손으로 정한 표를 덮었다

    await writeRoomEdit(stub, (room) => clearBotSteps(yesWithDueNo(room)));
    expect(await botVotes(r.code)).toBe("true,true,true");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await botVotes(r.code)).toBe("true,true,true");
  }, 30_000);
});
