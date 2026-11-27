// 종료 워커 통합 테스트(04-07): 처형으로 끝나는 판·아침으로 끝나는 판을 실제 방(소켓·알람·저장소)에서 돌려
// 모든 소켓이 같은 결과를 받고, 종료 방이 진입 + 30분 알람으로 정리되는지 확인한다.
// END-01·END-02·CONN-02, 결정 0034·0036, D-10·D-17·D-28, 위협 T-04-26.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { RESULT_DISPLAY_MS } from "../../shared/game/phases";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import {
  actorsOf,
  advanceTo,
  alarmOf,
  chatMsg,
  chatKeysOf,
  closePhase,
  closed,
  connect,
  forceDue,
  hello,
  lastViewOf,
  mark,
  nextFrame,
  seat,
  send,
  settle,
  storedRoom,
  summary,
  pointAll,
} from "./helpers";
import type { Actor, Seated, TestSocket } from "./helpers";

// 08-11: 낮이 토론 → 찬반 → 지목 → 변론 → 처형으로 길어져(단계 넘김 4번 더) 한 판을 끝까지 돌리는 시험이 기본 5초를 넘는다 — 이 파일만 20초로 둔다(긴 대기 없이 forceDue 로 넘기는 것은 그대로).
vi.setConfig({ testTimeout: 20_000 });

/** 종료 진입 + 30분(결정 0034, D-28). 순수 규칙의 ENDED_ROOM_TTL_MS 를 읽지 않고 값을 따로 적어 상수가 바뀌면 이 테스트가 잡는다. */
const ENDED_TTL_MS = 1_800_000;

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];

const isPhase = (phase: string) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;

interface Game4 {
  r: Seated;
  actors: Actor[];
  mafia: Actor;
  police: Actor;
  /** 시민 둘(seat 오름차순). */
  c0: Actor;
  c1: Actor;
}

/** 4명 방(마피아 1·경찰 1·시민 2, 방장 + 연결 손님 3)을 시작해 지목까지 넘긴다(찬반은 advanceTo 가 산 사람 전원 찬성으로 통과시킨다 — 22-09). */
async function atNomination4(): Promise<Game4> {
  const r = await seat(3, 0);
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, isPhase("assigning"));
  await advanceTo(r.code, allSockets(r), "nomination");
  const actors = actorsOf(r);
  const [c0, c1] = actors.filter((a) => a.role === "citizen").sort((a, b) => a.seat - b.seat) as [Actor, Actor];
  return { r, actors, mafia: actors.find((a) => a.role === "mafia")!, police: actors.find((a) => a.role === "police")!, c0, c1 };
}

/** 지목(cast) → 변론 → 처형 발표까지(찬반은 이미 통과했다). 처형 마감은 닫지 않는다. defender 는 읽는 사람을 위한 표시다. */
async function toExecution(g: Game4, socks: TestSocket[], actors: Actor[], cast: Record<number, number>, _defender: Actor): Promise<void> {
  await pointAll(g.r.code, actors, cast);
  await advanceTo(g.r.code, socks, "execution");
}

/** 마피아가 변론자가 되는 지목: 마피아 외 모두가 마피아를, 마피아는 경찰을 가리킨다. */
const castMafia = (g: Game4): Record<number, number> => ({
  [g.police.seat]: g.mafia.seat,
  [g.c0.seat]: g.mafia.seat,
  [g.c1.seat]: g.mafia.seat,
  [g.mafia.seat]: g.police.seat,
});

/** 처형으로 끝나는 판: 마피아가 처형되고 처형 마감 알람 뒤 ended. 처형 마감 시각 E 를 함께 돌려준다. */
async function endedByExecution(): Promise<{ g: Game4; E: number }> {
  const g = await atNomination4();
  const socks = allSockets(g.r);
  await toExecution(g, socks, g.actors, castMafia(g), g.mafia);
  const E = await closePhase(g.r.code);
  for (const s of socks) await nextFrame(s, isPhase("ended"));
  return { g, E };
}

/** 아침으로 끝나는 판: 1일차에 시민 c0 가 처형되고(1 vs 2), 밤에 마피아가 c1 을 죽여(1 vs 1) 아침 마감 알람 뒤 ended. */
async function endedByMorning(): Promise<{ g: Game4; E: number; morning: RoomView[] }> {
  const g = await atNomination4();
  const socks = allSockets(g.r);
  await toExecution(
    g,
    socks,
    g.actors,
    {
      [g.police.seat]: g.c0.seat,
      [g.mafia.seat]: g.c0.seat,
      [g.c1.seat]: g.c0.seat,
      [g.c0.seat]: g.mafia.seat,
    },
    g.c0,
  );
  await advanceTo(g.r.code, socks, "night"); // 처형 마감: 마피아 1 vs 나머지 2 라 아직 끝나지 않는다
  const picked = mark(g.mafia.sock);
  send(g.mafia.sock, { t: "pick", target: g.c1.seat });
  expect(summary(await settle(g.mafia.sock, picked))).toBe("[state:night]");
  await advanceTo(g.r.code, socks, "morning");
  const morning = g.actors.map((a) => lastViewOf(a.sock));
  const E = await closePhase(g.r.code);
  for (const s of socks) await nextFrame(s, isPhase("ended"));
  return { g, E, morning };
}

describe("처형으로 끝나는 판 (END-01, END-02, D-10, D-28)", () => {
  it("처형 마감 알람 뒤 네 소켓이 같은 결과·같은 공개 마감을 받는다", async () => {
    const { g, E } = await endedByExecution();
    const views = g.actors.map((a) => lastViewOf(a.sock));
    const first = JSON.stringify(views[0]!.result);
    for (const v of views) {
      expect(v).toMatchObject({ phase: "ended", phaseEndsAt: views[0]!.phaseEndsAt, phaseDurationMs: RESULT_DISPLAY_MS });
      expect(JSON.stringify(v.result)).toBe(first);
    }
    const result = views[0]!.result!;
    expect(result.winner).toBe("citizenWin");
    expect(result.seats.length).toBe(4);
    for (const s of result.seats) expect(Object.keys(s).sort().join(",")).toBe("job,seat");
    expect(JSON.stringify(result.summary)).toBe(
      JSON.stringify([{ n: 1, exec: { yes: 4, no: 0, passed: true, candidate: g.mafia.seat } }]), // 산 사람 4명이 모두 찬성(22-09 D-11 후보 없는 찬반)
    );
    const stored = await storedRoom(g.r.code);
    expect(stored).toMatchObject({ phase: "ended", winner: "citizenWin", phaseEndsAt: views[0]!.phaseEndsAt });
    expect(stored.phaseEndsAt!).toBeGreaterThanOrEqual(E + RESULT_DISPLAY_MS);
    expect(stored.expiresAt).toBe(stored.phaseEndsAt! - RESULT_DISPLAY_MS + ENDED_TTL_MS);
    expect(await alarmOf(g.r.code)).toBe(stored.phaseEndsAt);
  });

  it("결과 중 옛 다시 하기 입력은 막고 마감에 같은 소켓과 토큰으로 대기실·새 판에 간다", async () => {
    const { g } = await endedByExecution();
    const host = g.r.host;
    const guest = g.r.guests[0]!;
    const sockets = allSockets(g.r);
    send(host, chatMsg(host, "이번 결과 채팅"));
    await nextFrame(host, (m) => m.t === "chat" && m.text === "이번 결과 채팅");
    send(guest.sock, { t: "ready", on: true, round: 1 });
    send(host, { t: "rematch", round: 1 });
    await Promise.all(sockets.map((sock) => settle(sock, mark(sock))));
    expect(lastViewOf(host).phase).toBe("ended");
    expect(lastViewOf(guest.sock).players.find((p) => p.seat === guest.seat)?.ready).toBeUndefined();

    const lobbyFrames = sockets.map((sock) => nextFrame(sock, isPhase("lobby")));
    await closePhase(g.r.code);
    await Promise.all(lobbyFrames);
    for (const sock of sockets) {
      const lobby = lastViewOf(sock);
      expect(lobby).toMatchObject({ phase: "lobby", code: g.r.code, round: 2, phaseEndsAt: null });
      expect(lobby.result).toBeUndefined();
      expect(lobby.me.role).toBeUndefined();
      expect(lobby.players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
    }
    expect(await chatKeysOf(g.r.code)).toEqual([]);
    const rejoined = await connect(g.r.code);
    await hello(rejoined, guest.token);
    expect(lastViewOf(rejoined)).toMatchObject({ phase: "lobby", round: 2, me: { seat: guest.seat } });
    send(host, { t: "start" });
    await nextFrame(rejoined, isPhase("assigning"));
    expect(lastViewOf(rejoined).round).toBe(2);
  });
});

describe("아침으로 끝나는 판 (END-01, D-10)", () => {
  it("밤 마감 뒤 네 소켓이 먼저 같은 morning(eliminated 있음)을 받고, 아침 마감 알람 뒤 mafiaWin 으로 끝나며 요약에 처형과 밤이 함께 있다", async () => {
    const { g, E, morning } = await endedByMorning();
    for (const v of morning) expect(`${v.phase} ${v.day?.morning?.eliminated}`).toBe(`morning ${g.c1.seat}`);
    expect(new Set(morning.map((v) => JSON.stringify(v.day?.morning))).size).toBe(1);

    const views = g.actors.map((a) => lastViewOf(a.sock));
    const first = JSON.stringify(views[0]!.result);
    for (const v of views) expect(JSON.stringify(v.result)).toBe(first);
    expect(views[0]!.result!.winner).toBe("mafiaWin");
    expect(views[0]!.result!.seats.length).toBe(4);
    expect(JSON.stringify(views[0]!.result!.summary)).toBe(
      JSON.stringify([
        { n: 1, exec: { yes: 4, no: 0, passed: true, candidate: g.c0.seat }, night: { target: g.c1.seat, died: true } },
      ]),
    );
    const stored = await storedRoom(g.r.code);
    expect(stored.phaseEndsAt!).toBeGreaterThanOrEqual(E + RESULT_DISPLAY_MS);
    expect(stored.expiresAt).toBe(stored.phaseEndsAt! - RESULT_DISPLAY_MS + ENDED_TTL_MS);
    expect(await alarmOf(g.r.code)).toBe(stored.phaseEndsAt);
  });
});

describe("종료 중 (D-28)", () => {
  // 11-03(D-11): 결과 단계의 chat 은 거절이 아니라 all 한 줄이다 — 보낸 사람 포함 네 소켓이 한 줄씩 받는다. 나머지 거절 규칙은 그대로다.
  it("chat 은 네 소켓 모두에게 한 줄이고, verdict 는 보낸 소켓에만 거절이며 다른 소켓은 프레임이 없고, say 와 테스트 방이 아닌 방의 testSkip 은 BAD_MESSAGE 뿐이다", async () => {
    const { g } = await endedByExecution();
    const actors = g.actors;
    const sender = g.police;
    const send4 = async (from: Actor, msg: unknown): Promise<string> => {
      const marks = actors.map((a) => mark(a.sock));
      send(from.sock, msg);
      const out: string[] = [];
      for (let i = 0; i < actors.length; i += 1) out.push(summary(await settle(actors[i]!.sock, marks[i]!)));
      return out.map((line, i) => (actors[i] === from ? line : line === "[]" ? "-" : line)).join(" ");
    };
    const quietOthers = (own: string): string => actors.map((a) => (a === sender ? own : "-")).join(" ");

    // ended 진입 때 가는 결과 공개 프레임(11-03)이 모두 도착한 뒤에 시작한다.
    for (const a of actors) await settle(a.sock, mark(a.sock));
    expect(await send4(sender, chatMsg(sender.sock, "수고했어요"))).toBe(actors.map(() => "[chat]").join(" "));
    expect(await send4(sender, { t: "say", template: "innocent" })).toBe(quietOthers("[error:BAD_MESSAGE]"));
    expect(await send4(sender, { t: "verdict", agree: true })).toBe(quietOthers("[error:WRONG_PHASE,state:ended]"));
    expect(await send4(sender, { t: "testSkip" })).toBe(quietOthers("[error:BAD_MESSAGE]"));
    expect((await storedRoom(g.r.code)).phase).toBe("ended");
  });

  it("종료 중 새 소켓으로 같은 토큰 hello 를 하면 ended state 와 같은 result 를 받는다", async () => {
    const { g } = await endedByExecution();
    const before = JSON.stringify(lastViewOf(g.mafia.sock).result);
    const fresh = await connect(g.r.code);
    const first = await hello(fresh, g.mafia.token);
    expect(first.view.phase).toBe("ended");
    expect(JSON.stringify(first.view.result)).toBe(before);
  });

  it("만료 알람이 오면 모든 소켓이 4003 room_closed 로 닫히고 미리보기가 404 다", async () => {
    const { g } = await endedByExecution();
    await forceDue(g.r.code, "expiresAt");
    expect(await runDurableObjectAlarm(env.ROOM.getByName(g.r.code))).toBe(true);
    for (const a of g.actors) expect(await closed(a.sock)).toBe("4003 room_closed");
    const res = await exports.default.fetch(`http://x/api/rooms/${g.r.code}`);
    expect(res.status).toBe(404);
  });
});

describe("끊긴 생존자도 센다 (CONN-02, D-05)", () => {
  /** 지목이 열린 순간 actor 의 소켓을 닫고, 남은 소켓이 그 자리 connected false 를 받을 때까지 기다린다. */
  async function disconnect(g: Game4, gone: Actor): Promise<{ socks: TestSocket[]; actors: Actor[] }> {
    const actors = g.actors.filter((a) => a !== gone);
    gone.sock.ws.close();
    for (const a of actors) {
      await nextFrame(a.sock, (m) => m.t === "state" && m.view.players.some((p) => p.seat === gone.seat && !p.connected));
    }
    return { socks: actors.map((a) => a.sock), actors };
  }

  it("시민 한 명이 끊긴 채로도 처형으로 끝나는 판은 같은 winner citizenWin 으로 끝난다", async () => {
    const g = await atNomination4();
    const { socks, actors } = await disconnect(g, g.c1);
    const cast = { [g.police.seat]: g.mafia.seat, [g.c0.seat]: g.mafia.seat, [g.mafia.seat]: g.police.seat };
    await toExecution(g, socks, actors, cast, g.mafia);
    await closePhase(g.r.code);
    for (const s of socks) await nextFrame(s, isPhase("ended"));
    for (const a of actors) {
      const v = lastViewOf(a.sock);
      expect(`${v.phase} ${v.result?.winner} ${v.players.find((p) => p.seat === g.c1.seat)?.connected}`).toBe("ended citizenWin false");
    }
  });

  it("경찰이 끊겨 있어도 그 경찰을 센다: 시민 처형 뒤 마피아 1 vs 둘(끊긴 경찰·시민)이라 끝나지 않고 밤으로 간다", async () => {
    const g = await atNomination4();
    const { socks, actors } = await disconnect(g, g.police);
    const cast = { [g.mafia.seat]: g.c0.seat, [g.c1.seat]: g.c0.seat, [g.c0.seat]: g.mafia.seat };
    await toExecution(g, socks, actors, cast, g.c0);
    await closePhase(g.r.code);
    for (const s of socks) await nextFrame(s, isPhase("night"));
    const stored = await storedRoom(g.r.code);
    expect(`${stored.phase} ${stored.winner}`).toBe("night undefined");
  });
});
