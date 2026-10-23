import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { MESSAGE_KEEP, QUICK_TEMPLATES, SEND_COOLDOWN_MS, emote, say } from "../../shared/game/chat";
import type { SayInput } from "../../shared/game/chat";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { EMOJI_IDS, TEMPLATE_IDS } from "../../shared/protocol";
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

describe("QUICK_TEMPLATES - 템플릿 표 (D-11, COMM-01)", () => {
  it("TEMPLATE_IDS 와 같은 다섯 키이고 칸 요구가 표대로다", () => {
    expect(Object.keys(QUICK_TEMPLATES).sort().join(",")).toBe([...TEMPLATE_IDS].sort().join(","));
    const rows = TEMPLATE_IDS.map((id) => `${id}:${QUICK_TEMPLATES[id]?.target}/${QUICK_TEMPLATES[id]?.role}`).join(" ");
    expect(rows).toBe("suspect:true/false trust:true/false claimed:true/true innocent:false/false vote:true/false");
  });

  it("보관 상수는 20개, 쿨다운은 2초다", () => {
    expect(MESSAGE_KEEP).toBe(20);
    expect(SEND_COOLDOWN_MS).toBe(2_000);
  });
});

describe("say - 통과한 메시지 (D-15)", () => {
  it("suspect 는 target 만 담은 한 줄이 되고 키 집합이 정확하다", () => {
    const r = say(room("discussion"), "p1", { template: "suspect", target: 2 }, NOW);
    expect(outcome(r)).toBe("ok");
    if (!r.ok) return;
    expect(JSON.stringify(r.line)).toBe(JSON.stringify({ seq: 1, seat: 1, template: "suspect", target: 2, at: NOW }));
    expect(keys(r.line)).toBe("at,seat,seq,target,template");
    expect(JSON.stringify(r.state.messages)).toBe(JSON.stringify([r.line]));
    expect(r.state.nextMessageSeq).toBe(2);
    expect(r.state.players[1]!.lastSendAt).toBe(NOW);
  });

  it("claimed 는 claimedRole 까지 담고, innocent 는 칸이 없다", () => {
    const c = say(room("discussion"), "p1", { template: "claimed", target: 2, claimedRole: "police" }, NOW);
    expect(c.ok && keys(c.line)).toBe("at,claimedRole,seat,seq,target,template");
    const i = say(room("discussion"), "p1", { template: "innocent" }, NOW);
    expect(i.ok && keys(i.line)).toBe("at,seat,seq,template");
  });

  it("보낸 사람 seat 는 actorId 로 서버 상태에서 찾는다 (T-02-08)", () => {
    const r = say(room("discussion"), "p3", { template: "innocent" }, NOW);
    expect(r.ok && r.line.seat).toBe(3);
  });

  it("거짓 주장도 그대로 받는다 — 실제 역할을 보지 않는다 (D-10)", () => {
    const state = room("discussion");
    state.players[1] = { ...state.players[1]!, role: "citizen" };
    const r = say(state, "p1", { template: "claimed", target: 1 + 1, claimedRole: "police" }, NOW);
    expect(outcome(r)).toBe("ok");
  });

  it("끊긴 사람을 대상으로 한 메시지는 허용한다", () => {
    const r = say(room("discussion", { overrides: { 2: { connected: false } } }), "p1", { template: "suspect", target: 2 }, NOW);
    expect(outcome(r)).toBe("ok");
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const state = room("discussion");
    const before = JSON.stringify(state);
    say(state, "p1", { template: "vote", target: 2 }, NOW);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("자유 문자열 키가 끼어도 줄에는 들어가지 않는다 (T-02-07)", () => {
    const sneaky = { template: "suspect", target: 2, text: "안녕", seat: 4 } as unknown as SayInput;
    const r = say(room("discussion"), "p1", sneaky, NOW);
    expect(outcome(r)).toBe("ok");
    if (!r.ok) return;
    expect(keys(r.line)).toBe("at,seat,seq,target,template");
    expect(r.line.seat).toBe(1);
  });
});

describe("say - 단계 (D-13, 성공 기준 5)", () => {
  it.each(["lobby", "assigning", "roleReveal", "dayAnnounce", "claim", "claimReveal"] as PhaseId[])(
    "%s 에서는 WRONG_PHASE",
    (phase) => {
      expect(outcome(say(room(phase), "p1", { template: "innocent" }, NOW))).toBe("WRONG_PHASE");
    },
  );
});

describe("say - 형식·대상 위반은 BAD_MESSAGE (D-12, D-13, COMM-04)", () => {
  const bad = (input: unknown, state: RoomState = room("discussion"), actor = "p1") =>
    say(state, actor, input as SayInput, NOW);

  it.each<[string, unknown]>([
    ["suspect 에 target 없음", { template: "suspect" }],
    ["innocent 에 target 있음", { template: "innocent", target: 2 }],
    ["suspect 에 claimedRole 있음", { template: "suspect", target: 2, claimedRole: "police" }],
    ["claimed 에 claimedRole 없음", { template: "claimed", target: 2 }],
    ["innocent 에 claimedRole 있음", { template: "innocent", claimedRole: "police" }],
    ["알 수 없는 템플릿 constructor", { template: "constructor", target: 2 }],
    ["알 수 없는 템플릿 hello", { template: "hello" }],
    ["프로토타입 키 toString", { template: "toString" }],
    ["target = 본인 seat", { template: "suspect", target: 1 }],
    ["target = 빈 자리", { template: "suspect", target: 6 }],
    ["target 음수", { template: "suspect", target: -1 }],
    ["target 범위 밖 8", { template: "suspect", target: 8 }],
    ["target 소수", { template: "suspect", target: 1.5 }],
    ["claimedRole none", { template: "claimed", target: 2, claimedRole: "none" }],
    ["claimedRole 알 수 없는 값", { template: "claimed", target: 2, claimedRole: "king" }],
  ])("%s", (_name, input) => {
    expect(outcome(bad(input))).toBe("BAD_MESSAGE");
  });

  it("4명판 claimed 에 doctor 는 구성 밖이라 거부한다", () => {
    const four = room("discussion", { n: 4 });
    expect(outcome(bad({ template: "claimed", target: 2, claimedRole: "doctor" }, four))).toBe("BAD_MESSAGE");
    expect(outcome(bad({ template: "claimed", target: 2, claimedRole: "police" }, four))).toBe("ok");
  });

  it("방에 없는 actorId 는 거부한다", () => {
    expect(outcome(bad({ template: "innocent" }, room("discussion"), "ghost"))).toBe("BAD_MESSAGE");
  });

  it("보낸 사람이 탈락자면 거부한다", () => {
    const state = room("discussion", { overrides: { 1: { alive: false } } });
    expect(outcome(bad({ template: "innocent" }, state))).toBe("BAD_MESSAGE");
  });

  it("대상이 탈락자면 거부한다", () => {
    const state = room("discussion", { overrides: { 2: { alive: false } } });
    expect(outcome(bad({ template: "suspect", target: 2 }, state))).toBe("BAD_MESSAGE");
  });

  it("단계 검사가 형식 검사보다 먼저다", () => {
    expect(outcome(bad({ template: "hello" }, room("claim")))).toBe("WRONG_PHASE");
  });

  it("형식 위반이 쿨다운보다 먼저다", () => {
    const state = room("discussion", { overrides: { 1: { lastSendAt: NOW } } });
    expect(outcome(bad({ template: "suspect" }, state))).toBe("BAD_MESSAGE");
  });
});

describe("say - 쿨다운 경계 (D-14)", () => {
  const cooling = (): RoomState => room("discussion", { overrides: { 1: { lastSendAt: 10_000 } } });

  it("직전 성공 뒤 1999ms 는 RATE_LIMITED", () => {
    expect(outcome(say(cooling(), "p1", { template: "innocent" }, 10_000 + SEND_COOLDOWN_MS - 1))).toBe("RATE_LIMITED");
  });

  it("2000ms 는 통과한다", () => {
    expect(outcome(say(cooling(), "p1", { template: "innocent" }, 10_000 + SEND_COOLDOWN_MS))).toBe("ok");
  });
});

describe("say - 보관 (D-15, overflow)", () => {
  it("25개를 차례로 보내면 최근 20개만 남고 seq 는 1씩 증가한다", () => {
    let state = room("discussion");
    const before = JSON.stringify(state);
    const first = state;
    for (let i = 0; i < 25; i += 1) {
      const r = say(state, "p1", { template: "innocent" }, NOW + i * SEND_COOLDOWN_MS);
      expect(outcome(r)).toBe("ok");
      if (!r.ok) return;
      state = r.state;
    }
    expect(JSON.stringify(first)).toBe(before);
    expect(state.messages).toHaveLength(MESSAGE_KEEP);
    expect(state.messages![0]!.seq).toBe(6);
    const seqs = state.messages!.map((m) => m.seq);
    expect(seqs.join(",")).toBe(Array.from({ length: 20 }, (_, i) => 6 + i).join(","));
    expect(state.nextMessageSeq).toBe(26);
  });

  it("nextMessageSeq 가 없는 상태의 첫 seq 는 1, 있으면 그 값에서 이어진다", () => {
    const a = say(room("discussion"), "p1", { template: "innocent" }, NOW);
    expect(a.ok && a.line.seq).toBe(1);
    const b = say(room("discussion", { nextMessageSeq: 41 }), "p1", { template: "innocent" }, NOW);
    expect(b.ok && b.line.seq).toBe(41);
  });

  it("역할 필드를 읽지 않는 실제 역할과 무관한 결과를 낸다 (D-10)", () => {
    const roles: RoleId[] = ["mafia", "police", "doctor", "citizen"];
    for (const role of roles) {
      const state = room("discussion");
      state.players[1] = { ...state.players[1]!, role };
      const r = say(state, "p1", { template: "claimed", target: 2, claimedRole: "doctor" }, NOW);
      expect(outcome(r)).toBe("ok");
    }
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
    expect(r.state.messages).toBe(state.messages);
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

  it.each(["lobby", "dayAnnounce", "claim", "claimReveal"] as PhaseId[])("%s 에서는 WRONG_PHASE", (phase) => {
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

describe("메시지·이모티콘 합산 쿨다운 (D-14)", () => {
  it("say 뒤 1999ms 에 emote 는 RATE_LIMITED, 2000ms 에는 통과", () => {
    const sent = say(room("discussion"), "p1", { template: "innocent" }, 10_000);
    if (!sent.ok) throw new Error("setup");
    expect(outcome(emote(sent.state, "p1", "smile", 10_000 + SEND_COOLDOWN_MS - 1))).toBe("RATE_LIMITED");
    expect(outcome(emote(sent.state, "p1", "smile", 10_000 + SEND_COOLDOWN_MS))).toBe("ok");
  });

  it("emote 뒤 1999ms 에 say 는 RATE_LIMITED, 2000ms 에는 통과", () => {
    const sent = emote(room("discussion"), "p1", "smile", 10_000);
    if (!sent.ok) throw new Error("setup");
    expect(outcome(say(sent.state, "p1", { template: "innocent" }, 10_000 + SEND_COOLDOWN_MS - 1))).toBe("RATE_LIMITED");
    expect(outcome(say(sent.state, "p1", { template: "innocent" }, 10_000 + SEND_COOLDOWN_MS))).toBe("ok");
  });

  it("거부된 요청은 lastSendAt 을 바꾸지 않는다: t0 성공, t0+1000 거부, t0+2000 통과", () => {
    const t0 = 10_000;
    const first = emote(room("discussion"), "p1", "smile", t0);
    if (!first.ok) throw new Error("setup");
    const rejected = emote(first.state, "p1", "smile", t0 + 1_000);
    expect(outcome(rejected)).toBe("RATE_LIMITED");
    expect(first.state.players[1]!.lastSendAt).toBe(t0);
    const sayRejected = say(first.state, "p1", { template: "innocent" }, t0 + 1_000);
    expect(outcome(sayRejected)).toBe("RATE_LIMITED");
    expect(first.state.players[1]!.lastSendAt).toBe(t0);
    expect(outcome(emote(first.state, "p1", "smile", t0 + 2_000))).toBe("ok");
  });

  it("다른 사람의 쿨다운은 독립이다: A 가 보낸 직후 B 는 보낼 수 있다", () => {
    const a = say(room("discussion"), "p1", { template: "innocent" }, 10_000);
    if (!a.ok) throw new Error("setup");
    expect(outcome(emote(a.state, "p2", "smile", 10_001))).toBe("ok");
    expect(outcome(say(a.state, "p3", { template: "innocent" }, 10_001))).toBe("ok");
  });
});
