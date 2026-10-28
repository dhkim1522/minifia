// 여부 투표 워커 통합 테스트(04-01 트레이서): 실제 소켓으로 전원 방송·익명 차분·마감 분기를 workerd 에서 확인한다.
// VOTE-01·CONN-02, 결정 0034, D-01·D-02·D-04·D-28, 위협 T-04-01~04.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { actorsOf, advanceTo, backdateSends, forceDue, lastViewOf, mark, nextFrame, seat, send, settle, storedRoom, summary, voteCandidate, voteExec } from "./helpers";
import type { Actor, Seated, TestSocket } from "./helpers";

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];

const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;

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

// ---- 후보 선택·공개·변론·처형 (04-07): VOTE-02·VOTE-03·VOTE-04·COMM-03, 결정 0034·0036, D-03·D-09·D-13·D-19·D-20·D-34, 위협 T-04-22~25 ----

const ROLE_WORDS = new Set(["mafia", "police", "doctor", "citizen", "none"]);
/** 살아 있는 사람 프레임에서 역할 단어가 나와도 되는 경로(본인 역할·구성표·공개 주장 기록). */
const ROLE_PATHS_ALIVE = [".view.me.role", ".view.day.roles[]", ".view.day.claimLog[].claim"];

/** 프레임 값 중 역할 단어와 같은 문자열의 경로를 모은다(배열 칸은 [] 로 적는다). */
function roleWordPaths(value: unknown, path = ""): string[] {
  if (typeof value === "string") return ROLE_WORDS.has(value) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item) => roleWordPaths(item, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => roleWordPaths(item, `${path}.${key}`));
  }
  return [];
}

/** 6명 방(방장 + 연결 손님 5)을 execVote 에서 모두 찬성으로 닫아 candidateVote 까지 간다. */
async function atCandidateVote(): Promise<{ r: Seated; actors: Actor[] }> {
  const r = await startedAtExecVote(6);
  const actors = actorsOf(r);
  await voteExec(r.code, actors, Object.fromEntries(actors.map((a) => [a.seat, true])));
  expect((await storedRoom(r.code)).phase).toBe("candidateVote");
  return { r, actors };
}

/** 후보 선택: actors[0,2,3]→actors[1], actors[4]→actors[2], actors[1]→actors[0], actors[5] 는 안 던짐. 후보는 actors[1] (3표). 공개 구간까지 간다. */
async function atReveal(): Promise<{ r: Seated; actors: Actor[]; candidate: Actor; cast: Record<number, number> }> {
  const { r, actors } = await atCandidateVote();
  const s = actors.map((a) => a.seat);
  const cast = { [s[0]!]: s[1]!, [s[2]!]: s[1]!, [s[3]!]: s[1]!, [s[4]!]: s[2]!, [s[1]!]: s[0]! };
  await voteCandidate(r.code, actors, cast);
  expect((await storedRoom(r.code)).phase).toBe("candidateVoteReveal");
  return { r, actors, candidate: actors[1]!, cast };
}

async function atDefense(): Promise<{ r: Seated; actors: Actor[]; candidate: Actor; cast: Record<number, number> }> {
  const out = await atReveal();
  await advanceTo(out.r.code, allSockets(out.r), "defense");
  return out;
}

/** 보낸 사람(from)이 메시지를 보내면 actors 모두가 받은 프레임을 actors 순서대로 돌려준다. */
async function sendAndSettleAll(actors: Actor[], from: Actor, msg: unknown): Promise<ServerMessage[][]> {
  const marks = actors.map((a) => mark(a.sock));
  send(from.sock, msg);
  const out: ServerMessage[][] = [];
  for (let i = 0; i < actors.length; i += 1) out.push(await settle(actors[i]!.sock, marks[i]!));
  return out;
}

const lines = (frames: ServerMessage[][], actors: Actor[]): string => frames.map((f, i) => `${actors[i]!.seat}:${summary(f)}`).join(" ");

describe("후보 선택은 투표자에게만 (VOTE-02, D-03, D-19, A7)", () => {
  it("A 가 B 를 고르면 A 소켓만 me.voteTarget 이 든 state 를 받고 나머지 다섯은 아무것도 받지 않는다. 같은 값은 A 도 프레임이 없다", async () => {
    const { actors } = await atCandidateVote();
    const [a, b] = actors as [Actor, Actor];
    const first = await sendAndSettleAll(actors, a, { t: "candidateVote", target: b.seat });
    const mine = viewsOf(first[0]!)[0]!;
    expect(`${summary(first[0]!)} ${mine.me.voteTarget}`).toBe(`[state:candidateVote] ${b.seat}`);
    expect(lines(first.slice(1), actors.slice(1))).toBe(actors.slice(1).map((x) => `${x.seat}:[]`).join(" "));

    const same = await sendAndSettleAll(actors, a, { t: "candidateVote", target: b.seat });
    expect(lines(same, actors)).toBe(actors.map((x) => `${x.seat}:[]`).join(" "));
  });

  it("자기 자신은 보낸 소켓만 BAD_MESSAGE + state, 범위 밖·문자열 대상·덧붙은 키는 BAD_MESSAGE 뿐이고 다른 소켓은 프레임이 없다", async () => {
    const { r, actors } = await atCandidateVote();
    const a = actors[0]!;
    const others = actors.slice(1);
    const own = await sendAndSettleAll(actors, a, { t: "candidateVote", target: a.seat });
    expect(summary(own[0]!)).toBe("[error:BAD_MESSAGE,state:candidateVote]");
    for (const [i, bad] of [{ t: "candidateVote", target: 9 }, { t: "candidateVote", target: "1" }, { t: "candidateVote", target: 1, seat: 2 }].entries()) {
      const frames = await sendAndSettleAll(actors, a, bad);
      expect(`${i} ${summary(frames[0]!)}`).toBe(`${i} [error:BAD_MESSAGE]`);
      expect(frames.slice(1).map(summary).join(" ")).toBe(others.map(() => "[]").join(" "));
    }
    expect(own.slice(1).map(summary).join(" ")).toBe(others.map(() => "[]").join(" "));
    const stored = await storedRoom(r.code);
    expect(stored.players.some((p) => Object.hasOwn(p, "candidateVote"))).toBe(false);
  });

  it("execVote 단계에 보낸 candidateVote 는 보낸 소켓만 WRONG_PHASE + 최신 state 를 받는다", async () => {
    const r = await startedAtExecVote(6);
    const actors = actorsOf(r);
    const frames = await sendAndSettleAll(actors, actors[0]!, { t: "candidateVote", target: actors[1]!.seat });
    expect(summary(frames[0]!)).toBe("[error:WRONG_PHASE,state:execVote]");
    expect(frames.slice(1).map(summary).join(" ")).toBe(actors.slice(1).map(() => "[]").join(" "));
  });
});

describe("선택 공개 (VOTE-02, D-20, D-21)", () => {
  it("여섯 소켓이 같은 순서의 day.voteLog 그날 줄 cand.votes 와 같은 day.candidate 를 받고 phaseDurationMs 는 4000 이다", async () => {
    const { r, candidate, cast } = await atReveal();
    const views = allSockets(r).map((s) => lastViewOf(s));
    const first = JSON.stringify(views[0]!.day?.voteLog?.at(-1)?.cand?.votes);
    for (const v of views) {
      expect(v.phase).toBe("candidateVoteReveal");
      expect(JSON.stringify(v.day?.voteLog?.at(-1)?.cand?.votes)).toBe(first);
      expect(`${v.day?.candidate} ${v.phaseDurationMs}`).toBe(`${candidate.seat} 4000`);
    }
    const votes = views[0]!.day!.voteLog!.at(-1)!.cand!.votes;
    expect(votes.length).toBe(5);
    const shown = [...votes].sort((x, y) => x.seat - y.seat).map((v) => `${v.seat}>${v.target}`);
    const thrown = Object.entries(cast).map(([from, to]) => ({ from: Number(from), to })).sort((x, y) => x.from - y.from).map((v) => `${v.from}>${v.to}`);
    expect(JSON.stringify(shown)).toBe(JSON.stringify(thrown));
  });

  it("공개 중 say 는 보낸 소켓만 WRONG_PHASE + state, 이모티콘은 보낸 소켓만 WRONG_PHASE 이고 다른 소켓은 프레임이 없다", async () => {
    const { actors } = await atReveal();
    const [a] = actors as [Actor];
    const said = await sendAndSettleAll(actors, a, { t: "say", template: "innocent" });
    expect(summary(said[0]!)).toBe("[error:WRONG_PHASE,state:candidateVoteReveal]");
    expect(said.slice(1).map(summary).join(" ")).toBe(actors.slice(1).map(() => "[]").join(" "));
    const emoted = await sendAndSettleAll(actors, a, { t: "emoji", icon: "smile" });
    expect(summary(emoted[0]!)).toBe("[error:WRONG_PHASE]");
    expect(emoted.slice(1).map(summary).join(" ")).toBe(actors.slice(1).map(() => "[]").join(" "));
  });
});

describe("최후 변론 (COMM-03, VOTE-03, D-13)", () => {
  it("후보의 변론은 여섯 소켓 모두에 chat 으로 가고, 후보의 낮 템플릿은 후보 소켓만 BAD_MESSAGE 다", async () => {
    const { actors, candidate } = await atDefense();
    const said = await sendAndSettleAll(actors, candidate, { t: "say", template: "defNotMe" });
    expect(said.map(summary).join(" ")).toBe(actors.map(() => "[chat]").join(" "));
    for (const f of said) {
      const chat = f[0] as Extract<ServerMessage, { t: "chat" }>;
      expect(`${chat.template} ${chat.seat}`).toBe(`defNotMe ${candidate.seat}`);
    }
    const day = await sendAndSettleAll(actors, candidate, { t: "say", template: "innocent" });
    expect(day.map(summary).join(" ")).toBe(actors.map((a) => (a === candidate ? "[error:BAD_MESSAGE]" : "[]")).join(" "));
  });

  it("후보가 아닌 생존자의 say 는 그 소켓만 WRONG_PHASE + state 이고, 이모티콘은 여섯 소켓 모두에 간다", async () => {
    const { r, actors, candidate } = await atDefense();
    const other = actors.find((a) => a !== candidate)!;
    const said = await sendAndSettleAll(actors, other, { t: "say", template: "defNotMe" });
    expect(said.map(summary).join(" ")).toBe(actors.map((a) => (a === other ? "[error:WRONG_PHASE,state:defense]" : "[]")).join(" "));

    await backdateSends(r.code);
    const emoted = await sendAndSettleAll(actors, other, { t: "emoji", icon: "smile" });
    expect(emoted.map(summary).join(" ")).toBe(actors.map(() => "[emoji]").join(" "));
  });
});

describe("처형 발표 (VOTE-04, D-09, D-34)", () => {
  it("여섯 소켓 모두 후보 alive false 와 day.execution {seat, phrase 1..4} 를 받고, 살아 있는 소켓에는 역할 단어가 허용 경로 밖에 없으며 처형된 소켓만 관전을 받는다", async () => {
    const { r, actors, candidate } = await atDefense();
    await advanceTo(r.code, allSockets(r), "execution");
    for (const a of actors) {
      const v = lastViewOf(a.sock);
      expect(v.phase).toBe("execution");
      expect(`${v.players.find((p) => p.seat === candidate.seat)?.alive} ${v.day?.execution?.seat}`).toBe(`false ${candidate.seat}`);
      expect([1, 2, 3, 4].includes(v.day?.execution?.phrase ?? 0)).toBe(true);
      expect(JSON.stringify(v.day?.execution)).toBe(JSON.stringify(lastViewOf(actors[0]!.sock).day?.execution));
    }
    for (const a of actors.filter((x) => x !== candidate)) {
      const bad = a.sock.frames.flatMap((raw) => roleWordPaths(JSON.parse(raw))).filter((p) => !ROLE_PATHS_ALIVE.includes(p));
      expect(`${a.seat} ${JSON.stringify(bad)}`).toBe(`${a.seat} []`);
      expect(Object.hasOwn(lastViewOf(a.sock), "spectate")).toBe(false);
    }
    expect(String(lastViewOf(candidate.sock).spectate?.seats.length)).toBe("6");
  });

  it("처형 중 say·이모티콘은 보낸 소켓에만 WRONG_PHASE 다", async () => {
    const { r, actors, candidate } = await atDefense();
    await advanceTo(r.code, allSockets(r), "execution");
    const other = actors.find((a) => a !== candidate)!;
    const said = await sendAndSettleAll(actors, other, { t: "say", template: "innocent" });
    expect(said.map(summary).join(" ")).toBe(actors.map((a) => (a === other ? "[error:WRONG_PHASE,state:execution]" : "[]")).join(" "));
    const emoted = await sendAndSettleAll(actors, other, { t: "emoji", icon: "smile" });
    expect(emoted.map(summary).join(" ")).toBe(actors.map((a) => (a === other ? "[error:WRONG_PHASE]" : "[]")).join(" "));
  });

  it("처형이 이뤄진 날의 밤 state 에는 day.noExecution 키가 없다", async () => {
    const { r, actors } = await atDefense();
    await advanceTo(r.code, allSockets(r), "night");
    for (const a of actors) expect(Object.hasOwn(lastViewOf(a.sock).day ?? {}, "noExecution")).toBe(false);
  });
});

describe("처형이 성립하지 않은 밤 (D-34)", () => {
  it("후보 최다 동률이면 공개 구간(후보 없음) 뒤 여섯 소켓의 night state 모두 noExecution {reason:'tie'} 가 같고, 아침 state 에는 키가 없다", async () => {
    const { r, actors } = await atCandidateVote();
    const s = actors.map((a) => a.seat);
    await voteCandidate(r.code, actors, { [s[0]!]: s[1]!, [s[1]!]: s[0]!, [s[2]!]: s[1]!, [s[3]!]: s[0]! });
    for (const a of actors) {
      const v = lastViewOf(a.sock);
      expect(`${v.phase} ${Object.hasOwn(v.day ?? {}, "candidate")} ${v.day?.voteLog?.at(-1)?.cand?.votes.length}`).toBe("candidateVoteReveal false 4");
    }
    await advanceTo(r.code, allSockets(r), "night");
    for (const a of actors) expect(JSON.stringify(lastViewOf(a.sock).day?.noExecution)).toBe(JSON.stringify({ reason: "tie" }));
    await advanceTo(r.code, allSockets(r), "morning");
    for (const a of actors) expect(Object.hasOwn(lastViewOf(a.sock).day ?? {}, "noExecution")).toBe(false);
  });

  it("후보 선택에 아무도 던지지 않으면 night 의 모든 소켓에 noExecution {reason:'noVotes'} 가 간다", async () => {
    const { r, actors } = await atCandidateVote();
    await voteCandidate(r.code, actors, {});
    await advanceTo(r.code, allSockets(r), "night");
    for (const a of actors) expect(JSON.stringify(lastViewOf(a.sock).day?.noExecution)).toBe(JSON.stringify({ reason: "noVotes" }));
  });

  it("여부 투표 미통과(찬성 1 · 반대 2)는 night 의 모든 소켓에 {reason:'notMajority'}, 0표는 {reason:'noVotes'} 다", async () => {
    const a = await startedAtExecVote(6);
    const actorsA = actorsOf(a);
    const s = actorsA.map((x) => x.seat);
    await voteExec(a.code, actorsA, { [s[0]!]: true, [s[1]!]: false, [s[2]!]: false });
    for (const x of actorsA) expect(`${lastViewOf(x.sock).phase} ${JSON.stringify(lastViewOf(x.sock).day?.noExecution)}`).toBe(`night ${JSON.stringify({ reason: "notMajority" })}`);

    const b = await startedAtExecVote(6);
    const actorsB = actorsOf(b);
    await voteExec(b.code, actorsB, {});
    for (const x of actorsB) expect(`${lastViewOf(x.sock).phase} ${JSON.stringify(lastViewOf(x.sock).day?.noExecution)}`).toBe(`night ${JSON.stringify({ reason: "noVotes" })}`);
  });
});
