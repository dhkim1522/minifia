import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { QUICK_TEMPLATES, SEND_COOLDOWN_MS, SERVER_MIN_SEND_GAP_MS, emote, say } from "../../shared/game/chat";
import type { SayInput } from "../../shared/game/chat";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { DISPLAY_ONLY_TEMPLATE_IDS, EMOJI_IDS, TEMPLATE_IDS } from "../../shared/protocol";
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
  it("TEMPLATE_IDS 와 같은 열 키이고 칸·때가 표대로다 (D-17, 결정 0019-2, 0027-7)", () => {
    expect(Object.keys(QUICK_TEMPLATES).sort().join(",")).toBe([...TEMPLATE_IDS].sort().join(","));
    expect(TEMPLATE_IDS.length).toBe(16);
    const rows = TEMPLATE_IDS.map((id) => `${id}:${QUICK_TEMPLATES[id]?.target}/${QUICK_TEMPLATES[id]?.role}/${QUICK_TEMPLATES[id]?.when}`).join(" ");
    expect(rows).toBe(
      "suspect:true/false/day trust:true/false/day claimed:true/true/day innocent:false/false/day vote:true/false/day " +
        "nightTarget:true/false/night nightAgree:false/false/night nightOther:false/false/night " +
        "claimRole:false/true/claim claimNone:false/false/claim " +
        "defNotMe:false/false/defense defCitizen:false/false/defense defSuspect:true/false/defense defTrust:true/false/defense defRole:false/true/defense defPlead:false/false/defense",
    );
  });

  it("표시 전용 템플릿은 claimRole·claimNone 둘뿐이고 TEMPLATE_IDS 에 있으며 때가 claim 이다. 나머지 열넷은 day/night/defense (결정 0027-7, 0036)", () => {
    expect([...DISPLAY_ONLY_TEMPLATE_IDS].join(",")).toBe("claimRole,claimNone");
    for (const id of DISPLAY_ONLY_TEMPLATE_IDS) {
      expect((TEMPLATE_IDS as readonly string[]).includes(id)).toBe(true);
      expect(QUICK_TEMPLATES[id].when).toBe("claim");
    }
    const others = TEMPLATE_IDS.filter((id) => !(DISPLAY_ONLY_TEMPLATE_IDS as readonly string[]).includes(id));
    expect(others.length).toBe(14);
    expect(others.every((id) => ["day", "night", "defense"].includes(QUICK_TEMPLATES[id].when))).toBe(true);
  });

  it("서버 한도 SERVER_MIN_SEND_GAP_MS 는 1800, 클라이언트 잠금 SEND_COOLDOWN_MS 는 2000 이고 서버 한도가 더 짧다 (G-02-2)", () => {
    expect(SERVER_MIN_SEND_GAP_MS).toBe(1_800);
    expect(SEND_COOLDOWN_MS).toBe(2_000);
    expect(SERVER_MIN_SEND_GAP_MS < SEND_COOLDOWN_MS).toBe(true);
  });
});

describe("say - 통과한 메시지 (D-15)", () => {
  it("suspect 는 target 만 담은 한 줄이 되고 키 집합이 정확하다", () => {
    const r = say(room("discussion"), "p1", { template: "suspect", target: 2 }, NOW);
    expect(outcome(r)).toBe("ok");
    if (!r.ok) return;
    expect(JSON.stringify(r.line)).toBe(JSON.stringify({ seq: 1, seat: 1, template: "suspect", target: 2, at: NOW }));
    expect(keys(r.line)).toBe("at,seat,seq,target,template");
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
  it.each(["lobby", "assigning", "roleReveal", "dayAnnounce", "claim", "morning"] as PhaseId[])(
    "%s 에서는 WRONG_PHASE",
    (phase) => {
      expect(outcome(say(room(phase), "p1", { template: "innocent" }, NOW))).toBe("WRONG_PHASE");
    },
  );

  it("claim 중 빠른 메시지는 탈락자도 WRONG_PHASE 다 (이모티콘만 허용, 결정 0023-2)", () => {
    const dead = room("claim", { overrides: { 1: { alive: false } } });
    expect(outcome(say(dead, "p1", { template: "innocent" }, NOW))).toBe("WRONG_PHASE");
  });
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

describe("say - 전송 간격 경계 (D-14, G-02-2)", () => {
  const cooling = (): RoomState => room("discussion", { overrides: { 1: { lastSendAt: 10_000 } } });

  it("직전 성공 뒤 1799ms 는 RATE_LIMITED", () => {
    expect(outcome(say(cooling(), "p1", { template: "innocent" }, 10_000 + 1_799))).toBe("RATE_LIMITED");
  });

  it("1800ms 는 통과한다", () => {
    expect(outcome(say(cooling(), "p1", { template: "innocent" }, 10_000 + 1_800))).toBe("ok");
  });

  it("클라이언트 잠금 간격(2000ms)으로 보낸 요청은 서버 한도에 걸리지 않는다", () => {
    expect(outcome(say(cooling(), "p1", { template: "innocent" }, 10_000 + SEND_COOLDOWN_MS))).toBe("ok");
  });
});

describe("say - 보관 없음 (결정 0017-7)", () => {
  it("통과해도 결과 상태에 messages 키가 생기지 않고 nextMessageSeq 는 1 늘며 보낸 사람 lastSendAt 만 바뀐다", () => {
    const state = room("discussion");
    const r = say(state, "p1", { template: "innocent" }, NOW);
    expect(outcome(r)).toBe("ok");
    if (!r.ok) return;
    expect(Object.hasOwn(r.state, "messages")).toBe(false);
    expect(r.state.nextMessageSeq).toBe(2);
    expect(r.state.players[1]!.lastSendAt).toBe(NOW);
    const others = r.state.players.filter((p) => p.id !== "p1").map((p) => p.lastSendAt);
    expect(others.every((v) => v === undefined)).toBe(true);
  });

  it("입력 상태에 있던 옛 messages 값은 그대로 넘어간다(정리는 normalizeStoredRoom 이 한다)", () => {
    const old = { ...room("discussion"), messages: [] } as RoomState;
    const r = say(old, "p1", { template: "innocent" }, NOW);
    if (!r.ok) throw new Error("setup");
    const input = old as unknown as Record<string, unknown>;
    const output = r.state as unknown as Record<string, unknown>;
    expect(output["messages"] === input["messages"]).toBe(true); // 한 줄 보고서를 위해 객체 비교를 피한다
  });

  it("25개를 차례로 보내면(1800ms 간격) line.seq 가 1..25 로 1씩 늘어난다", () => {
    let state = room("discussion");
    const before = JSON.stringify(state);
    const first = state;
    const seqs: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const r = say(state, "p1", { template: "innocent" }, NOW + i * 1_800);
      expect(outcome(r)).toBe("ok");
      if (!r.ok) return;
      seqs.push(r.line.seq);
      state = r.state;
    }
    expect(JSON.stringify(first)).toBe(before);
    expect(seqs.join(",")).toBe(Array.from({ length: 25 }, (_, i) => 1 + i).join(","));
    expect(state.nextMessageSeq).toBe(26);
    expect(Object.hasOwn(state, "messages")).toBe(false);
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

  it("claim 중에는 살아 있는 사람이 이모티콘을 보낼 수 있고(차례 여부와 무관) 쿨다운 규칙은 같다 (결정 0023-2)", () => {
    const state = room("claim");
    const sent = emote(state, "p3", "heart", NOW);
    expect(outcome(sent)).toBe("ok");
    if (!sent.ok) return;
    expect(JSON.stringify(sent.event)).toBe(JSON.stringify({ seat: 3, icon: "heart", at: NOW }));
    expect(outcome(emote(sent.state, "p3", "smile", NOW + SERVER_MIN_SEND_GAP_MS - 1))).toBe("RATE_LIMITED");
    expect(outcome(emote(sent.state, "p3", "smile", NOW + SERVER_MIN_SEND_GAP_MS))).toBe("ok");
  });

  it("claim 중 탈락자·방에 없는 사람은 BAD_MESSAGE", () => {
    const dead = room("claim", { overrides: { 1: { alive: false } } });
    expect(outcome(emote(dead, "p1", "smile", NOW))).toBe("BAD_MESSAGE");
    expect(outcome(emote(room("claim"), "ghost", "smile", NOW))).toBe("BAD_MESSAGE");
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

describe("메시지·이모티콘 합산 서버 한도 (D-14, G-02-2)", () => {
  it("say 뒤 1799ms 에 emote 는 RATE_LIMITED, 1800ms 에는 통과", () => {
    const sent = say(room("discussion"), "p1", { template: "innocent" }, 10_000);
    if (!sent.ok) throw new Error("setup");
    expect(outcome(emote(sent.state, "p1", "smile", 10_000 + 1_799))).toBe("RATE_LIMITED");
    expect(outcome(emote(sent.state, "p1", "smile", 10_000 + 1_800))).toBe("ok");
  });

  it("emote 뒤 1799ms 에 say 는 RATE_LIMITED, 1800ms 에는 통과", () => {
    const sent = emote(room("discussion"), "p1", "smile", 10_000);
    if (!sent.ok) throw new Error("setup");
    expect(outcome(say(sent.state, "p1", { template: "innocent" }, 10_000 + 1_799))).toBe("RATE_LIMITED");
    expect(outcome(say(sent.state, "p1", { template: "innocent" }, 10_000 + 1_800))).toBe("ok");
  });

  it("거부된 요청은 lastSendAt 을 바꾸지 않는다: t0 성공, t0+1000 거부, t0+1800 통과", () => {
    const t0 = 10_000;
    const first = emote(room("discussion"), "p1", "smile", t0);
    if (!first.ok) throw new Error("setup");
    const rejected = emote(first.state, "p1", "smile", t0 + 1_000);
    expect(outcome(rejected)).toBe("RATE_LIMITED");
    expect(first.state.players[1]!.lastSendAt).toBe(t0);
    const sayRejected = say(first.state, "p1", { template: "innocent" }, t0 + 1_000);
    expect(outcome(sayRejected)).toBe("RATE_LIMITED");
    expect(first.state.players[1]!.lastSendAt).toBe(t0);
    expect(outcome(emote(first.state, "p1", "smile", t0 + 1_800))).toBe("ok");
  });

  it("다른 사람의 쿨다운은 독립이다: A 가 보낸 직후 B 는 보낼 수 있다", () => {
    const a = say(room("discussion"), "p1", { template: "innocent" }, 10_000);
    if (!a.ok) throw new Error("setup");
    expect(outcome(emote(a.state, "p2", "smile", 10_001))).toBe("ok");
    expect(outcome(say(a.state, "p3", { template: "innocent" }, 10_001))).toBe("ok");
  });
});

describe("밤 빠른 메시지 - 살아 있는 마피아 (D-17, 결정 0019, COMM-04)", () => {
  /** seat 1·2 가 마피아인 5명 밤 방 */
  const night = (overrides: Record<number, Extra> = {}): RoomState =>
    room("night", { overrides: { 1: { role: "mafia" }, 2: { role: "mafia" }, ...overrides } });

  it("마피아(seat 1)의 nightTarget 은 target 만 담은 한 줄이 된다", () => {
    const r = say(night(), "p1", { template: "nightTarget", target: 3 }, NOW);
    expect(outcome(r)).toBe("ok");
    if (!r.ok) return;
    expect(keys(r.line)).toBe("at,seat,seq,target,template");
    expect(r.line.seat).toBe(1);
    expect(r.line.template).toBe("nightTarget");
    expect(r.line.target).toBe(3);
  });

  it("nightAgree·nightOther 는 칸 없이 통과하고 target 을 붙이면 BAD_MESSAGE", () => {
    const rows = (["nightAgree", "nightOther"] as const).map((template) => {
      const plain = outcome(say(night(), "p1", { template }, NOW));
      const withTarget = outcome(say(night(), "p1", { template, target: 3 }, NOW));
      return `${template}:${plain}/${withTarget}`;
    });
    expect(rows.join(" ")).toBe("nightAgree:ok/BAD_MESSAGE nightOther:ok/BAD_MESSAGE");
  });

  it("nightTarget 대상으로 동료 마피아(seat 2)도 된다", () => {
    expect(outcome(say(night(), "p1", { template: "nightTarget", target: 2 }, NOW))).toBe("ok");
  });

  it("밤 emote 는 살아 있는 마피아에게 통과하고 이벤트 seat 는 1 이다", () => {
    const r = emote(night(), "p1", "smile", NOW);
    expect(outcome(r)).toBe("ok");
    expect(r.ok && r.event.seat).toBe(1);
  });
});

describe("거부 코드는 규칙 하나 - 단계 → 보낸 사람 → 템플릿·값 (ELIM-01, COMM-04, 결정 0016)", () => {
  /** seat 1 이 탈락자(role 지정), seat 2 가 살아 있는 마피아인 방 */
  const withDead = (phase: PhaseId, deadRole: RoleId): RoomState =>
    room(phase, { overrides: { 1: { alive: false, role: deadRole }, 2: { role: "mafia" } } });
  /** seat 1 이 살아 있는 비마피아, seat 2 가 마피아인 밤 방 */
  const nightWith = (role: RoleId): RoomState => room("night", { overrides: { 1: { role }, 2: { role: "mafia" } } });

  it("탈락자의 say(innocent): morning·claim → WRONG_PHASE, discussion → BAD_MESSAGE", () => {
    const rows = (["morning", "claim", "discussion"] as PhaseId[]).map(
      (phase) => `${phase}:${outcome(say(withDead(phase, "citizen"), "p1", { template: "innocent" }, NOW))}`,
    );
    expect(rows.join(" ")).toBe("morning:WRONG_PHASE claim:WRONG_PHASE discussion:BAD_MESSAGE");
  });

  it("탈락자의 emoji: morning → WRONG_PHASE, discussion → BAD_MESSAGE", () => {
    const rows = (["morning", "discussion"] as PhaseId[]).map((phase) => `${phase}:${outcome(emote(withDead(phase, "citizen"), "p1", "smile", NOW))}`);
    expect(rows.join(" ")).toBe("morning:WRONG_PHASE discussion:BAD_MESSAGE");
  });

  it("밤에 탈락자는 마피아였든 시민이었든 say(nightAgree)·emoji 모두 BAD_MESSAGE", () => {
    const rows = (["mafia", "citizen"] as RoleId[]).flatMap((role) => [
      `${role}:say:${outcome(say(withDead("night", role), "p1", { template: "nightAgree" }, NOW))}`,
      `${role}:emoji:${outcome(emote(withDead("night", role), "p1", "smile", NOW))}`,
    ]);
    expect(rows.join(" ")).toBe("mafia:say:BAD_MESSAGE mafia:emoji:BAD_MESSAGE citizen:say:BAD_MESSAGE citizen:emoji:BAD_MESSAGE");
  });

  it("밤에 살아 있는 시민·경찰·의사의 say(nightAgree)·emoji 는 WRONG_PHASE", () => {
    const rows = (["citizen", "police", "doctor"] as RoleId[]).flatMap((role) => [
      `${role}:say:${outcome(say(nightWith(role), "p1", { template: "nightAgree" }, NOW))}`,
      `${role}:emoji:${outcome(emote(nightWith(role), "p1", "smile", NOW))}`,
    ]);
    expect(rows.join(" ")).toBe(
      "citizen:say:WRONG_PHASE citizen:emoji:WRONG_PHASE police:say:WRONG_PHASE police:emoji:WRONG_PHASE doctor:say:WRONG_PHASE doctor:emoji:WRONG_PHASE",
    );
  });

  it("밤에 마피아가 낮 문구를 보내면 BAD_MESSAGE", () => {
    const night = nightWith("mafia");
    const rows = [
      outcome(say(night, "p1", { template: "innocent" }, NOW)),
      outcome(say(night, "p1", { template: "suspect", target: 3 }, NOW)),
      outcome(say(night, "p1", { template: "vote", target: 3 }, NOW)),
    ];
    expect(rows.join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE,BAD_MESSAGE");
  });

  it("낮 토론에서 생존자가 밤 문구를 보내면 BAD_MESSAGE", () => {
    const day = room("discussion");
    const rows = [
      outcome(say(day, "p1", { template: "nightAgree" }, NOW)),
      outcome(say(day, "p1", { template: "nightTarget", target: 3 }, NOW)),
      outcome(say(day, "p1", { template: "nightOther" }, NOW)),
    ];
    expect(rows.join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE,BAD_MESSAGE");
  });

  it("밤 nightTarget 대상이 본인·빈 자리·탈락자면 BAD_MESSAGE", () => {
    const night = room("night", { overrides: { 1: { role: "mafia" }, 2: { role: "mafia" }, 3: { alive: false } } });
    const rows = [1, 6, 3].map((target) => outcome(say(night, "p1", { template: "nightTarget", target }, NOW)));
    expect(rows.join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE,BAD_MESSAGE");
  });

  it("낮 토론에서 보낸 직후 같은 사람이 밤에 보내도 lastSendAt 하나를 본다: 1799ms RATE_LIMITED, 1800ms ok", () => {
    const sent = say(room("discussion", { overrides: { 1: { role: "mafia" } } }), "p1", { template: "innocent" }, 10_000);
    if (!sent.ok) throw new Error("setup");
    const nightState: RoomState = { ...sent.state, phase: "night" };
    const early = outcome(say(nightState, "p1", { template: "nightAgree" }, 10_000 + 1_799));
    const onTime = outcome(say(nightState, "p1", { template: "nightAgree" }, 10_000 + 1_800));
    expect(`${early},${onTime}`).toBe("RATE_LIMITED,ok");
    expect(outcome(emote(nightState, "p1", "smile", 10_000 + 1_799))).toBe("RATE_LIMITED");
  });

  it("거부는 상태를 바꾸지 않는다(밤 거부 경로들)", () => {
    const night = room("night", { overrides: { 1: { role: "mafia", lastSendAt: NOW }, 2: { role: "citizen" }, 3: { alive: false, role: "mafia" } } });
    const before = JSON.stringify(night);
    const results = [
      outcome(say(night, "p2", { template: "nightAgree" }, NOW)), // 비마피아
      outcome(say(night, "p3", { template: "nightAgree" }, NOW)), // 탈락자
      outcome(say(night, "p1", { template: "innocent" }, NOW)), // 낮 문구
      outcome(say(night, "p1", { template: "nightTarget" }, NOW + 5_000)), // 칸 없음
      outcome(say(night, "p1", { template: "nightAgree" }, NOW + 1)), // 쿨다운
      outcome(emote(night, "p2", "smile", NOW)),
      outcome(emote(night, "p1", "smile", NOW + 1)),
    ];
    expect(results.join(",")).toBe("WRONG_PHASE,BAD_MESSAGE,BAD_MESSAGE,BAD_MESSAGE,RATE_LIMITED,WRONG_PHASE,RATE_LIMITED");
    expect(JSON.stringify(night)).toBe(before);
  });
});

describe("밤 채팅 번호 (PLAN-CHECK W3, D-17, 결정 0002·0019)", () => {
  const nightRoom = (extra: { nextMessageSeq?: number; nextNightSeq?: number } = {}): RoomState => ({
    ...room("night", { overrides: { 1: { role: "mafia" }, 2: { role: "mafia" } } }),
    ...extra,
  });
  /** 마피아 seat 1 이 밤에 n 줄을 1800ms 간격으로 보낸 뒤의 상태와 줄 번호들 */
  const sendNight = (start: RoomState, n: number): { state: RoomState; seqs: string } => {
    let state = start;
    const seqs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const r = say(state, "p1", { template: "nightAgree" }, NOW + i * 1_800);
      if (!r.ok) throw new Error(`setup: ${r.error}`);
      seqs.push(r.line.seq);
      state = r.state;
    }
    return { state, seqs: seqs.join(",") };
  };

  it("night 의 첫 마피아 say 는 seq 1 이고 결과의 nextNightSeq 는 2, nextMessageSeq 는 입력 그대로다", () => {
    const r = say(nightRoom({ nextMessageSeq: 5 }), "p1", { template: "nightAgree" }, NOW);
    if (!r.ok) throw new Error("setup");
    expect(`${r.line.seq}/${r.state.nextNightSeq}/${r.state.nextMessageSeq}`).toBe("1/2/5");
  });

  it("night 에 마피아가 세 줄을 보내면 seq 1·2·3, nextMessageSeq 는 한 번도 바뀌지 않는다", () => {
    const { state, seqs } = sendNight(nightRoom({ nextMessageSeq: 5 }), 3);
    expect(`${seqs}/${state.nextNightSeq}/${state.nextMessageSeq}`).toBe("1,2,3/4/5");
  });

  it("같은 일차에 낮 nextMessageSeq 가 5 였다면 밤 세 줄 뒤 다음 낮 첫 say 의 seq 도 5 다 — 밤 채팅이 없던 경우와 같다", () => {
    const start = nightRoom({ nextMessageSeq: 5 });
    const nextDaySeq = (state: RoomState): string => {
      const day: RoomState = { ...state, phase: "discussion" };
      const r = say(day, "p3", { template: "innocent" }, NOW + 60_000);
      return r.ok ? String(r.line.seq) : r.error;
    };
    const withChat = nextDaySeq(sendNight(start, 3).state);
    const withoutChat = nextDaySeq(start);
    expect(`${withChat}/${withoutChat}`).toBe("5/5");
  });

  it("discussion 의 say 는 nextNightSeq 를 바꾸지 않는다", () => {
    const day: RoomState = { ...room("discussion", { nextMessageSeq: 5 }), nextNightSeq: 3 };
    const r = say(day, "p1", { template: "innocent" }, NOW);
    if (!r.ok) throw new Error("setup");
    expect(`${r.line.seq}/${r.state.nextMessageSeq}/${r.state.nextNightSeq}`).toBe("5/6/3");
    const plain = say(room("discussion"), "p1", { template: "innocent" }, NOW);
    expect(plain.ok ? String(plain.state.nextNightSeq) : plain.error).toBe("undefined");
  });

  it("nextNightSeq 가 없는 밤 상태의 첫 seq 는 1, 있으면 그 값에서 이어진다", () => {
    const first = say(nightRoom(), "p1", { template: "nightAgree" }, NOW);
    const resumed = say(nightRoom({ nextNightSeq: 7 }), "p1", { template: "nightAgree" }, NOW);
    expect(`${first.ok ? first.line.seq : first.error}/${resumed.ok ? resumed.line.seq : resumed.error}`).toBe("1/7");
  });

  it("밤 emote 는 두 번호 모두 바꾸지 않는다", () => {
    const start = nightRoom({ nextMessageSeq: 5, nextNightSeq: 3 });
    const r = emote(start, "p1", "smile", NOW);
    if (!r.ok) throw new Error("setup");
    expect(`${r.state.nextMessageSeq}/${r.state.nextNightSeq}`).toBe("5/3");
  });
});

describe("say - 표시 전용 템플릿(claimRole·claimNone)은 서버가 받지 않는다 (D-05, 결정 0027-7, T-03.1-25)", () => {
  const inputs: SayInput[] = [{ template: "claimRole", claimedRole: "police" }, { template: "claimNone" }];

  it("토론 중에는 BAD_MESSAGE 이고 상태가 변하지 않는다", () => {
    for (const input of inputs) {
      const state = room("discussion");
      const before = JSON.stringify(state);
      expect(outcome(say(state, "p1", input, NOW))).toBe("BAD_MESSAGE");
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it("claim 단계에서는 누구든 WRONG_PHASE 이고 상태가 변하지 않는다", () => {
    for (const input of inputs) {
      const state = room("claim");
      const before = JSON.stringify(state);
      expect(outcome(say(state, "p1", input, NOW))).toBe("WRONG_PHASE");
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it("밤에 살아 있는 마피아가 보내도 BAD_MESSAGE 이고 상태가 변하지 않는다", () => {
    for (const input of inputs) {
      const state = room("night", { overrides: { 1: { role: "mafia" } } });
      const before = JSON.stringify(state);
      expect(outcome(say(state, "p1", input, NOW))).toBe("BAD_MESSAGE");
      expect(JSON.stringify(state)).toBe(before);
    }
  });
});

describe("투표 두 단계의 메시지 (D-12, 결정 0036)", () => {
  const phases = ["execVote", "candidateVote"] as PhaseId[];

  it.each(phases)("%s: 생존자의 낮 템플릿(대상 포함)은 통과하고 nextMessageSeq 가 늘어난다", (phase) => {
    const a = say(room(phase), "p1", { template: "innocent" }, NOW);
    expect(outcome(a)).toBe("ok");
    expect(a.ok && a.state.nextMessageSeq).toBe(2);
    expect(outcome(say(room(phase), "p1", { template: "suspect", target: 2 }, NOW))).toBe("ok");
  });

  it.each(phases)("%s: 밤 템플릿·변론 템플릿은 BAD_MESSAGE", (phase) => {
    const rows = [
      outcome(say(room(phase), "p1", { template: "nightAgree" }, NOW)),
      outcome(say(room(phase), "p1", { template: "defNotMe" }, NOW)),
      outcome(say(room(phase), "p1", { template: "defSuspect", target: 2 }, NOW)),
    ];
    expect(rows.join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE,BAD_MESSAGE");
  });

  it.each(phases)("%s: 탈락자는 BAD_MESSAGE, 이모티콘은 생존자에게 통과", (phase) => {
    const dead = room(phase, { overrides: { 1: { alive: false } } });
    expect(outcome(say(dead, "p1", { template: "innocent" }, NOW))).toBe("BAD_MESSAGE");
    expect(outcome(emote(dead, "p1", "smile", NOW))).toBe("BAD_MESSAGE");
    expect(outcome(emote(room(phase), "p1", "smile", NOW))).toBe("ok");
  });
});

describe("최후 변론 - 후보만 (COMM-03, VOTE-03, D-13, T-04-14)", () => {
  /** seat 1 이 후보인 변론 방 */
  const defense = (overrides: Record<number, Extra> = {}, candidate: number | null = 1): RoomState => ({
    ...room("defense", { overrides }),
    ...(candidate === null ? {} : { verdict: { passed: true, candidate } }),
  });

  it("후보의 defNotMe·defCitizen·defPlead 는 칸 없이 통과한다", () => {
    const rows = (["defNotMe", "defCitizen", "defPlead"] as const).map((template) => `${template}:${outcome(say(defense(), "p1", { template }, NOW))}`);
    expect(rows.join(" ")).toBe("defNotMe:ok defCitizen:ok defPlead:ok");
  });

  it("후보의 defSuspect·defTrust 는 대상이 필요하고, defRole 은 직업이 필요하다", () => {
    const rows = [
      outcome(say(defense(), "p1", { template: "defSuspect", target: 2 }, NOW)),
      outcome(say(defense(), "p1", { template: "defTrust", target: 3 }, NOW)),
      outcome(say(defense(), "p1", { template: "defRole", claimedRole: "police" }, NOW)),
      outcome(say(defense(), "p1", { template: "defSuspect" }, NOW)),
      outcome(say(defense(), "p1", { template: "defRole" }, NOW)),
    ];
    expect(rows.join(",")).toBe("ok,ok,ok,BAD_MESSAGE,BAD_MESSAGE");
  });

  it("defSuspect 대상이 자기 자신·탈락자면 BAD_MESSAGE, defRole 이 구성 밖 직업이면 BAD_MESSAGE", () => {
    const dead = defense({ 2: { alive: false } });
    const rows = [
      outcome(say(defense(), "p1", { template: "defSuspect", target: 1 }, NOW)),
      outcome(say(dead, "p1", { template: "defSuspect", target: 2 }, NOW)),
      outcome(say({ ...defense(), players: defense().players.slice(0, 4) }, "p1", { template: "defRole", claimedRole: "doctor" }, NOW)),
    ];
    expect(rows.join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE,BAD_MESSAGE");
  });

  it("후보의 낮 템플릿·밤 템플릿은 BAD_MESSAGE", () => {
    const rows = [outcome(say(defense(), "p1", { template: "innocent" }, NOW)), outcome(say(defense(), "p1", { template: "nightAgree" }, NOW))];
    expect(rows.join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE");
  });

  it("후보가 아닌 생존자의 say 는 어떤 템플릿이든 WRONG_PHASE", () => {
    const rows = [
      outcome(say(defense(), "p2", { template: "defNotMe" }, NOW)),
      outcome(say(defense(), "p2", { template: "innocent" }, NOW)),
      outcome(say(defense(), "p2", { template: "defSuspect", target: 3 }, NOW)),
    ];
    expect(rows.join(",")).toBe("WRONG_PHASE,WRONG_PHASE,WRONG_PHASE");
  });

  it("탈락자의 say 는 BAD_MESSAGE, 후보가 아닌 생존자의 이모티콘은 통과", () => {
    const dead = defense({ 3: { alive: false } });
    expect(outcome(say(dead, "p3", { template: "defNotMe" }, NOW))).toBe("BAD_MESSAGE");
    expect(outcome(emote(defense(), "p2", "smile", NOW))).toBe("ok");
    expect(outcome(emote(dead, "p3", "smile", NOW))).toBe("BAD_MESSAGE");
  });

  it("verdict 가 없으면 생존자 say 는 모두 WRONG_PHASE, 이모티콘은 통과", () => {
    const none = defense({}, null);
    expect(outcome(say(none, "p1", { template: "defNotMe" }, NOW))).toBe("WRONG_PHASE");
    expect(outcome(emote(none, "p1", "smile", NOW))).toBe("ok");
  });

  it("후보가 say 한 뒤 1799ms 의 이모티콘은 RATE_LIMITED, 거부는 lastSendAt 을 바꾸지 않는다", () => {
    const sent = say(defense(), "p1", { template: "defPlead" }, 10_000);
    if (!sent.ok) throw new Error("setup");
    expect(sent.state.nextMessageSeq).toBe(2);
    expect(outcome(emote(sent.state, "p1", "smile", 10_000 + 1_799))).toBe("RATE_LIMITED");
    expect(sent.state.players[1]!.lastSendAt).toBe(10_000);
    expect(outcome(emote(sent.state, "p1", "smile", 10_000 + 1_800))).toBe("ok");
  });

  it("단계 검사가 후보 검사보다 먼저다(후보가 아닌 사람이 틀린 단계에서도 WRONG_PHASE, 형식 검사는 후보 검사 뒤)", () => {
    expect(outcome(say({ ...defense(), phase: "execution" }, "p1", { template: "defNotMe" }, NOW))).toBe("WRONG_PHASE");
    expect(outcome(say(defense(), "p2", { template: "hello" as never }, NOW))).toBe("WRONG_PHASE");
  });
});

describe("공개·처형·종료 단계는 전면 거부 (A3, T-04-16)", () => {
  it.each(["candidateVoteReveal", "execution", "ended"] as PhaseId[])("%s: 생존자·탈락자 모두 say·이모티콘 WRONG_PHASE", (phase) => {
    const state = room(phase, { overrides: { 1: { alive: false } } });
    const rows = [
      outcome(say(state, "p2", { template: "innocent" }, NOW)),
      outcome(emote(state, "p2", "smile", NOW)),
      outcome(say(state, "p1", { template: "innocent" }, NOW)),
      outcome(emote(state, "p1", "smile", NOW)),
    ];
    expect(rows.join(",")).toBe("WRONG_PHASE,WRONG_PHASE,WRONG_PHASE,WRONG_PHASE");
  });
});
