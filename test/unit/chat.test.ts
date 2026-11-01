import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { SERVER_MIN_SEND_GAP_MS, emote } from "../../shared/game/chat";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { EMOJI_IDS } from "../../shared/protocol";
import type { EmojiId, PhaseId } from "../../shared/protocol";

type Extra = Partial<Pick<Player, "connected" | "alive" | "lastSendAt" | "role">>;

function player(i: number, extra: Extra = {}): Player {
  const connected = extra.connected ?? true;
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected,
    connId: connected ? `c${i}` : null,
    ...extra,
  };
}

/** n 명이 앉은 방(seat 0~n-1). overrides 로 특정 seat 의 상태를 바꾼다. */
function room(
  phase: PhaseId,
  opts: { n?: number; overrides?: Record<number, Extra>; nextMessageSeq?: number } = {},
): RoomState {
  const n = opts.n ?? 5;
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt: 100_000,
    day: 1,
    hostId: "p0",
    nextJoinSeq: n,
    players: Array.from({ length: n }, (_, i) => player(i, opts.overrides?.[i])),
    ...(opts.nextMessageSeq !== undefined ? { nextMessageSeq: opts.nextMessageSeq } : {}),
  };
}

const NOW = 50_000;
const keys = (o: object): string => Object.keys(o).sort().join(",");
// 객체 toEqual 의 여러 줄 diff 는 TAP 증거를 깨뜨린다(02-02 선례) — 결과는 한 줄 문자열로 비교한다.
const outcome = (r: { ok: true } | { ok: false; error: string }): string => (r.ok ? "ok" : r.error);

describe("isAlive - 생존 판정 한 곳", () => {
  it("alive 가 없으면 생존, false 면 탈락이다", () => {
    expect(isAlive({ seat: 0 })).toBe(true);
    expect(isAlive({ seat: 0, alive: true })).toBe(true);
    expect(isAlive({ seat: 0, alive: false })).toBe(false);
  });
});

describe("emote - 이모티콘 (D-14, D-16, COMM-02)", () => {
  it("통과하면 이벤트를 돌려주고 바뀐 것은 보낸 사람 lastSendAt 뿐이다", () => {
    const state = room("discussion");
    const r = emote(state, "p1", "smile", NOW);
    expect(outcome(r)).toBe("ok");
    if (!r.ok) return;
    expect(JSON.stringify(r.event)).toBe(JSON.stringify({ seat: 1, icon: "smile", at: NOW }));
    expect(r.state.players[1]!.lastSendAt).toBe(NOW);
    expect(Object.hasOwn(r.state, "messages")).toBe(false);
    expect(r.state.nextMessageSeq).toBe(state.nextMessageSeq);
    const others = r.state.players.filter((p) => p.id !== "p1").map((p) => p.lastSendAt);
    expect(others.every((v) => v === undefined)).toBe(true);
  });

  it("여덟 아이콘이 모두 통과한다", () => {
    const results = EMOJI_IDS.map((icon, i) => outcome(emote(room("discussion"), "p1", icon, NOW + i)));
    expect(results.join(",")).toBe(EMOJI_IDS.map(() => "ok").join(","));
  });

  it("알 수 없는 아이콘은 BAD_MESSAGE", () => {
    expect(outcome(emote(room("discussion"), "p1", "fire" as EmojiId, NOW))).toBe("BAD_MESSAGE");
    expect(outcome(emote(room("discussion"), "p1", "constructor" as EmojiId, NOW))).toBe("BAD_MESSAGE");
  });

  it.each(["lobby", "assigning", "roleReveal", "dayAnnounce", "morning"] as PhaseId[])("%s 에서는 WRONG_PHASE", (phase) => {
    expect(outcome(emote(room(phase), "p1", "smile", NOW))).toBe("WRONG_PHASE");
  });

  it("탈락자·방에 없는 사람은 BAD_MESSAGE", () => {
    const dead = room("discussion", { overrides: { 1: { alive: false } } });
    expect(outcome(emote(dead, "p1", "smile", NOW))).toBe("BAD_MESSAGE");
    expect(outcome(emote(room("discussion"), "ghost", "smile", NOW))).toBe("BAD_MESSAGE");
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const state = room("discussion");
    const before = JSON.stringify(state);
    emote(state, "p1", "heart", NOW);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("이모티콘 서버 한도 (D-14, G-02-2)", () => {
  it("emote 뒤 1799ms 에 emote 는 RATE_LIMITED, 1800ms 에는 통과 (SERVER_MIN_SEND_GAP_MS)", () => {
    expect(SERVER_MIN_SEND_GAP_MS).toBe(1_800);
    const sent = emote(room("discussion"), "p1", "smile", 10_000);
    if (!sent.ok) throw new Error("setup");
    expect(outcome(emote(sent.state, "p1", "smile", 10_000 + 1_799))).toBe("RATE_LIMITED");
    expect(outcome(emote(sent.state, "p1", "smile", 10_000 + 1_800))).toBe("ok");
  });

  it("거부된 요청은 lastSendAt 을 바꾸지 않는다: t0 성공, t0+1000 거부, t0+1800 통과", () => {
    const t0 = 10_000;
    const first = emote(room("discussion"), "p1", "smile", t0);
    if (!first.ok) throw new Error("setup");
    const rejected = emote(first.state, "p1", "smile", t0 + 1_000);
    expect(outcome(rejected)).toBe("RATE_LIMITED");
    expect(first.state.players[1]!.lastSendAt).toBe(t0);
    expect(outcome(emote(first.state, "p1", "smile", t0 + 1_800))).toBe("ok");
  });

  it("다른 사람의 쿨다운은 독립이다: A 가 보낸 직후 B 는 보낼 수 있다", () => {
    const a = emote(room("discussion"), "p1", "smile", 10_000);
    if (!a.ok) throw new Error("setup");
    expect(outcome(emote(a.state, "p2", "smile", 10_001))).toBe("ok");
  });
});

describe("밤 이모티콘 - 살아 있는 마피아 (D-17, 결정 0019, COMM-04)", () => {
  /** seat 1·2 가 마피아인 5명 밤 방 */
  const night = (overrides: Record<number, Extra> = {}): RoomState =>
    room("night", { overrides: { 1: { role: "mafia" }, 2: { role: "mafia" }, ...overrides } });

  it("밤 emote 는 살아 있는 마피아에게 통과하고 이벤트 seat 는 1 이다", () => {
    const r = emote(night(), "p1", "smile", NOW);
    expect(outcome(r)).toBe("ok");
    expect(r.ok && r.event.seat).toBe(1);
  });

  it("밤 emote 는 두 번호(nextMessageSeq·nextNightSeq)를 바꾸지 않는다", () => {
    const start: RoomState = { ...night(), nextMessageSeq: 5, nextNightSeq: 3 };
    const r = emote(start, "p1", "smile", NOW);
    if (!r.ok) throw new Error("setup");
    expect(`${r.state.nextMessageSeq}/${r.state.nextNightSeq}`).toBe("5/3");
  });
});

describe("거부 코드는 규칙 하나 - 단계 → 보낸 사람 (ELIM-01, COMM-04, 결정 0016)", () => {
  /** seat 1 이 탈락자(role 지정), seat 2 가 살아 있는 마피아인 방 */
  const withDead = (phase: PhaseId, deadRole: RoleId): RoomState =>
    room(phase, { overrides: { 1: { alive: false, role: deadRole }, 2: { role: "mafia" } } });
  /** seat 1 이 살아 있는 비마피아, seat 2 가 마피아인 밤 방 */
  const nightWith = (role: RoleId): RoomState => room("night", { overrides: { 1: { role }, 2: { role: "mafia" } } });

  it("탈락자의 emoji: morning → WRONG_PHASE, discussion → BAD_MESSAGE", () => {
    const rows = (["morning", "discussion"] as PhaseId[]).map((phase) => `${phase}:${outcome(emote(withDead(phase, "citizen"), "p1", "smile", NOW))}`);
    expect(rows.join(" ")).toBe("morning:WRONG_PHASE discussion:BAD_MESSAGE");
  });

  it("밤에 탈락자는 마피아였든 시민이었든 emoji 가 BAD_MESSAGE", () => {
    const rows = (["mafia", "citizen"] as RoleId[]).map((role) => `${role}:${outcome(emote(withDead("night", role), "p1", "smile", NOW))}`);
    expect(rows.join(" ")).toBe("mafia:BAD_MESSAGE citizen:BAD_MESSAGE");
  });

  it("밤에 살아 있는 시민·경찰·의사의 emoji 는 WRONG_PHASE", () => {
    const rows = (["citizen", "police", "doctor"] as RoleId[]).map((role) => `${role}:${outcome(emote(nightWith(role), "p1", "smile", NOW))}`);
    expect(rows.join(" ")).toBe("citizen:WRONG_PHASE police:WRONG_PHASE doctor:WRONG_PHASE");
  });

  it("밤 거부 경로들은 상태를 바꾸지 않는다", () => {
    const night = room("night", { overrides: { 1: { role: "mafia", lastSendAt: NOW }, 2: { role: "citizen" }, 3: { alive: false, role: "mafia" } } });
    const before = JSON.stringify(night);
    const results = [
      outcome(emote(night, "p2", "smile", NOW)), // 비마피아
      outcome(emote(night, "p3", "smile", NOW)), // 탈락자
      outcome(emote(night, "p1", "smile", NOW + 1)), // 쿨다운
    ];
    expect(results.join(",")).toBe("WRONG_PHASE,BAD_MESSAGE,RATE_LIMITED");
    expect(JSON.stringify(night)).toBe(before);
  });
});

describe("투표 두 단계의 이모티콘 (D-12, 결정 0036)", () => {
  const phases = ["execVote", "candidateVote"] as PhaseId[];

  it.each(phases)("%s: 이모티콘은 생존자에게 통과하고 탈락자는 BAD_MESSAGE", (phase) => {
    const dead = room(phase, { overrides: { 1: { alive: false } } });
    expect(outcome(emote(dead, "p1", "smile", NOW))).toBe("BAD_MESSAGE");
    expect(outcome(emote(room(phase), "p1", "smile", NOW))).toBe("ok");
  });
});

describe("최후 변론의 이모티콘 (COMM-03, VOTE-03, D-13)", () => {
  /** seat 1 이 후보인 변론 방 */
  const defense = (overrides: Record<number, Extra> = {}, candidate: number | null = 1): RoomState => ({
    ...room("defense", { overrides }),
    ...(candidate === null ? {} : { verdict: { passed: true, candidate } }),
  });

  it("후보가 아닌 생존자의 이모티콘은 통과하고 탈락자는 BAD_MESSAGE", () => {
    const dead = defense({ 3: { alive: false } });
    expect(outcome(emote(defense(), "p2", "smile", NOW))).toBe("ok");
    expect(outcome(emote(dead, "p3", "smile", NOW))).toBe("BAD_MESSAGE");
  });

  it("verdict 가 없어도 생존자의 이모티콘은 통과한다", () => {
    expect(outcome(emote(defense({}, null), "p1", "smile", NOW))).toBe("ok");
  });
});

describe("공개·처형·종료 단계는 이모티콘 전면 거부 (A3, T-04-16)", () => {
  it.each(["candidateVoteReveal", "execution", "ended"] as PhaseId[])("%s: 생존자·탈락자 모두 이모티콘 WRONG_PHASE", (phase) => {
    const state = room(phase, { overrides: { 1: { alive: false } } });
    const rows = [outcome(emote(state, "p2", "smile", NOW)), outcome(emote(state, "p1", "smile", NOW))];
    expect(rows.join(",")).toBe("WRONG_PHASE,WRONG_PHASE");
  });
});
