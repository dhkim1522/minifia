// 여부 투표 워커 통합 테스트(04-01 트레이서): 실제 소켓으로 전원 방송·익명 차분·마감 분기를 workerd 에서 확인한다.
// VOTE-01·CONN-02, 결정 0034, D-01·D-02·D-04·D-28, 위협 T-04-01~04.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { advanceTo, forceDue, nextFrame, seat, send, storedRoom } from "./helpers";
import type { Seated, TestSocket } from "./helpers";

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];

const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;

/** 프레임 목록을 "[state:execVote,error:BAD_MESSAGE]" 같은 한 줄로. 빈 목록도 "[]" 라 비어 있지 않다. */
const summary = (msgs: ServerMessage[]): string =>
  `[${msgs
    .map((m) => (m.t === "state" ? `state:${m.view.phase}` : m.t === "error" ? `error:${m.code}` : m.t))
    .join(",")}]`;

let pingCounter = 0;
/** `from`(행동 전 frames 길이) 이후 ~ pong 직전까지 받은 프레임. 소켓마다 순서대로 전달되므로 ping/pong 사이가 그 행동이 만든 프레임 전부다. */
async function settle(sock: TestSocket, from: number): Promise<ServerMessage[]> {
  pingCounter += 1;
  const c = pingCounter;
  send(sock, { t: "ping", c });
  await nextFrame(sock, (m) => m.t === "pong" && m.c === c);
  return sock.frames.slice(from, sock.cursor - 1).map(parse);
}

const mark = (sock: TestSocket): number => sock.frames.length;

const viewsOf = (msgs: ServerMessage[]): RoomView[] =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").map((m) => m.view);

/** 연결 `players` 명 방을 시작해 execVote 까지 넘긴다. */
async function startedAtExecVote(players: number): Promise<Seated> {
  const r = await seat(players - 1, 0);
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(r.code, allSockets(r), "execVote");
  return r;
}

/** `from` 이 메시지를 보내면 모든 소켓이 받은 프레임을 소켓 순서대로 돌려준다. */
async function castAndSettleAll(r: Seated, from: TestSocket, msg: unknown): Promise<ServerMessage[][]> {
  const socks = allSockets(r);
  const marks = socks.map(mark);
  send(from, msg);
  const out: ServerMessage[][] = [];
  for (let i = 0; i < socks.length; i += 1) out.push(await settle(socks[i]!, marks[i]!));
  return out;
}

/** 마감을 과거로 당기고 알람을 한 번 돌린다. */
async function closeNow(code: string): Promise<void> {
  await forceDue(code, "phaseEndsAt");
  expect(await runDurableObjectAlarm(env.ROOM.getByName(code))).toBe(true);
}

interface StoredVoteRoom {
  phase: string;
  voteLog?: Array<{ n: number; exec: { yes: number; no: number; passed: boolean } }>;
  players: Array<Record<string, unknown>>;
}
const storedVote = async (code: string): Promise<StoredVoteRoom> => (await storedRoom(code)) as unknown as StoredVoteRoom;
const hasPersonalVote = (room: StoredVoteRoom): boolean => room.players.some((p) => Object.hasOwn(p, "execVote"));

describe("여부 투표 방송 (VOTE-01, D-02)", () => {
  it("execVote 단계에 들어가면 네 소켓 모두 phaseDurationMs 10000 과 day.execTally {0,0} 을 받는다", async () => {
    const r = await startedAtExecVote(4);
    for (const s of allSockets(r)) {
      const v = viewsOf(s.frames.map(parse)).filter((x) => x.phase === "execVote").at(-1)!;
      expect(`${v.phaseDurationMs} ${JSON.stringify(v.day?.execTally)}`).toBe(`10000 ${JSON.stringify({ yes: 0, no: 0 })}`);
    }
  });

  it("A 의 찬성은 네 소켓 모두에게 정확히 한 프레임으로 가고 집계가 같다. voteAgree 는 A 의 view 에만 있다", async () => {
    const r = await startedAtExecVote(4);
    const frames = await castAndSettleAll(r, r.host, { t: "execVote", agree: true });
    expect(frames.map(summary).join(" ")).toBe("[state:execVote] [state:execVote] [state:execVote] [state:execVote]");
    const views = frames.map((f) => viewsOf(f)[0]!);
    for (const v of views) expect(JSON.stringify(v.day?.execTally)).toBe(JSON.stringify({ yes: 1, no: 0 }));
    expect(views.map((v) => String(v.me.voteAgree)).join(" ")).toBe("true undefined undefined undefined");
    expect(views.slice(1).some((v) => Object.hasOwn(v.me, "voteAgree"))).toBe(false);
  });

  it("같은 값을 다시 보내면 네 소켓 모두 프레임이 없고, 반대로 바꾸면 모두 {0,1} 을 받는다", async () => {
    const r = await startedAtExecVote(4);
    await castAndSettleAll(r, r.host, { t: "execVote", agree: true });
    const same = await castAndSettleAll(r, r.host, { t: "execVote", agree: true });
    expect(same.map(summary).join(" ")).toBe("[] [] [] []");
    const flip = await castAndSettleAll(r, r.host, { t: "execVote", agree: false });
    expect(flip.map(summary).join(" ")).toBe("[state:execVote] [state:execVote] [state:execVote] [state:execVote]");
    for (const f of flip) expect(JSON.stringify(viewsOf(f)[0]!.day?.execTally)).toBe(JSON.stringify({ yes: 0, no: 1 }));
  });

  it("차분: 관찰자 O 가 A 의 투표 뒤 받은 view 와 B 의 투표 뒤 받은 view 는 serverNow·day.execTally 를 빼면 같다", async () => {
    const r = await startedAtExecVote(4);
    const observer = r.guests[2]!.sock;
    const afterA = (await castAndSettleAll(r, r.host, { t: "execVote", agree: true }))[3]!;
    const afterB = (await castAndSettleAll(r, r.guests[0]!.sock, { t: "execVote", agree: true }))[3]!;
    expect(observer).toBe(allSockets(r)[3]);
    const strip = (v: RoomView): string => {
      const { serverNow: _now, ...rest } = v;
      const { execTally: _tally, ...day } = rest.day!;
      return JSON.stringify({ ...rest, day });
    };
    const a = viewsOf(afterA)[0]!;
    const b = viewsOf(afterB)[0]!;
    expect(JSON.stringify(b.day?.execTally)).toBe(JSON.stringify({ yes: 2, no: 0 }));
    expect(strip(a)).toBe(strip(b));
  });

  it("agree 가 문자열이거나 덧붙은 키가 있으면 보낸 소켓만 BAD_MESSAGE 를 받는다", async () => {
    const r = await startedAtExecVote(4);
    const bad = await castAndSettleAll(r, r.host, { t: "execVote", agree: "true" });
    const extra = await castAndSettleAll(r, r.host, { t: "execVote", agree: true, seat: 1 });
    expect(bad.map(summary).join(" ")).toBe("[error:BAD_MESSAGE] [] [] []");
    expect(extra.map(summary).join(" ")).toBe("[error:BAD_MESSAGE] [] [] []");
    expect(hasPersonalVote(await storedVote(r.code))).toBe(false);
  });

  it("execVote 가 아닌 단계(discussion)에서는 보낸 소켓만 WRONG_PHASE 와 최신 state 를 받는다", async () => {
    const r = await seat(3, 0);
    send(r.host, { t: "start" });
    for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(r.code, allSockets(r), "discussion");
    const frames = await castAndSettleAll(r, r.host, { t: "execVote", agree: true });
    expect(frames.map(summary).join(" ")).toBe("[error:WRONG_PHASE,state:discussion] [] [] []");
  });
});

describe("여부 투표 마감 분기 (D-04, T-04-02)", () => {
  it("찬성 2 · 반대 1 이면 네 소켓 모두 candidateVote 를 받고 voteLog 에 집계만 남으며 저장소에 개인 표가 없다", async () => {
    const r = await startedAtExecVote(4);
    await castAndSettleAll(r, r.host, { t: "execVote", agree: true });
    await castAndSettleAll(r, r.guests[0]!.sock, { t: "execVote", agree: true });
    await castAndSettleAll(r, r.guests[1]!.sock, { t: "execVote", agree: false });
    expect(hasPersonalVote(await storedVote(r.code))).toBe(true);

    await closeNow(r.code);
    for (const s of allSockets(r)) {
      const v = viewsOf((await nextFrame(s, (m) => m.t === "state" && m.view.phase === "candidateVote").then((m) => [m])))[0]!;
      const line = v.day!.voteLog!.at(-1)!;
      expect(JSON.stringify(line)).toBe(JSON.stringify({ n: 1, exec: { yes: 2, no: 1, passed: true } }));
    }
    const stored = await storedVote(r.code);
    expect(`${stored.phase} ${hasPersonalVote(stored)}`).toBe("candidateVote false");
  });

  it("다른 방: 찬성 1 · 반대 1 이면 night 로 간다", async () => {
    const r = await startedAtExecVote(4);
    await castAndSettleAll(r, r.host, { t: "execVote", agree: true });
    await castAndSettleAll(r, r.guests[0]!.sock, { t: "execVote", agree: false });
    await closeNow(r.code);
    for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "night");
    const stored = await storedVote(r.code);
    expect(`${stored.phase} ${JSON.stringify(stored.voteLog?.at(-1)?.exec)} ${hasPersonalVote(stored)}`).toBe(
      `night ${JSON.stringify({ yes: 1, no: 1, passed: false })} false`,
    );
  });

  it("또 다른 방: 0표면 night 로 간다", async () => {
    const r = await startedAtExecVote(4);
    await closeNow(r.code);
    for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "night");
    const stored = await storedVote(r.code);
    expect(`${stored.phase} ${JSON.stringify(stored.voteLog?.at(-1)?.exec)}`).toBe(
      `night ${JSON.stringify({ yes: 0, no: 0, passed: false })}`,
    );
  });

  it("마감 뒤 도착한 투표는 그 소켓에만 WRONG_PHASE 와 넘어간 단계의 state 가 가고 저장된 집계는 직전 값 그대로다", async () => {
    const r = await startedAtExecVote(4);
    await castAndSettleAll(r, r.host, { t: "execVote", agree: true });
    await castAndSettleAll(r, r.guests[0]!.sock, { t: "execVote", agree: false });
    await forceDue(r.code, "phaseEndsAt"); // 알람은 아직 안 돌렸다 — 도착한 메시지가 먼저 tick 을 일으킨다
    const late = r.guests[1]!.sock;
    const from = mark(late);
    send(late, { t: "execVote", agree: true });
    const frames = await settle(late, from);
    const codes = frames.filter((m) => m.t === "error").map((m) => (m.t === "error" ? m.code : ""));
    const last = viewsOf(frames).at(-1)!;
    expect(`${codes.join(",")} ${last.phase}`).toBe("WRONG_PHASE night");
    const stored = await storedVote(r.code);
    expect(JSON.stringify(stored.voteLog?.at(-1)?.exec)).toBe(JSON.stringify({ yes: 1, no: 1, passed: false }));
    expect(hasPersonalVote(stored)).toBe(false);
  });
});
