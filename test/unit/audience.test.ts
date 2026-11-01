import { describe, expect, it } from "vitest";
import { CHAT_PHASES, audience, channelOf, phaseKey } from "../../shared/game/audience";
import type { AudienceEvent } from "../../shared/game/audience";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import type { ChatChannel, PhaseId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const START_AT = 10_000;

/** n 명이 모두 연결된 대기실(seat 0~n-1, id 는 player-id-000i-aaaa). */
function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

const idOf = (seat: number): string => `player-id-000${seat}-aaaa`;

/** 6명 판의 역할: 마피아 seat 1·4, 경찰 3, 의사 5, 시민 0·2. */
const ROLES: Record<number, RoleId> = { 0: "citizen", 1: "mafia", 2: "citizen", 3: "police", 4: "mafia", 5: "doctor" };

/** 6명 판. 단계·일차·탈락(seat 2)을 직접 정한 순수 객체. */
function sixAt(phase: PhaseId, opts: { day?: number; dead?: number[] } = {}): RoomState {
  const base = lobbyOf(6);
  const dead = new Set(opts.dead ?? [2]);
  const state: RoomState = {
    ...base,
    phase,
    day: opts.day,
    players: base.players.map((p): Player => ({ ...p, role: ROLES[p.seat], alive: dead.has(p.seat) ? false : undefined })),
  };
  return state;
}

// 비교는 정렬해 쉼표로 이은 한 줄 문자열로 한다 — Set·배열의 여러 줄 diff 는 TAP 보고서를 깨뜨린다.
const ids = (...seats: number[]): string => seats.map(idOf).sort().join(",");
const sorted = (set: ReadonlySet<string>): string => [...set].sort().join(",");
const chat = (ch: ChatChannel): AudienceEvent => ({ k: "chat", ch });

const DAY_CHAT_PHASES: PhaseId[] = [
  "dayAnnounce",
  "discussion",
  "execVote",
  "candidateVote",
  "candidateVoteReveal",
  "defense",
  "execution",
  "morning",
];
const SILENT_PHASES: PhaseId[] = ["assigning", "roleReveal", "ended"];

describe("channelOf — 보낸 사람의 서버 상태로만 채널을 정한다", () => {
  it("밤: 산 마피아 = mafia, 산 시민·경찰·의사 = null, 탈락자 = ghost", () => {
    const night = sixAt("night", { day: 1 });
    expect(channelOf(night, idOf(1))).toBe("mafia");
    expect(channelOf(night, idOf(4))).toBe("mafia");
    expect(channelOf(night, idOf(0))).toBeNull();
    expect(channelOf(night, idOf(3))).toBeNull();
    expect(channelOf(night, idOf(5))).toBeNull();
    expect(channelOf(night, idOf(2))).toBe("ghost");
  });

  it("밤에는 누구에게도 all 을 내지 않는다", () => {
    const night = sixAt("night", { day: 1 });
    for (const p of night.players) expect(channelOf(night, p.id)).not.toBe("all");
  });

  it("로비: 누구나 all", () => {
    const lobby = lobbyOf(6);
    for (const p of lobby.players) expect(channelOf(lobby, p.id)).toBe("all");
  });

  it.each(DAY_CHAT_PHASES)("%s: 산 사람 all, 탈락자 ghost (마피아도 낮에는 all)", (phase) => {
    const s = sixAt(phase, { day: 1 });
    for (const seat of [0, 1, 3, 4, 5]) expect(channelOf(s, idOf(seat))).toBe("all");
    expect(channelOf(s, idOf(2))).toBe("ghost");
  });

  it.each(SILENT_PHASES)("%s: CHAT_PHASES 밖이라 모두 null", (phase) => {
    const s = sixAt(phase, { day: 1 });
    for (const p of s.players) expect(channelOf(s, p.id)).toBeNull();
  });

  it("방에 없는 senderId 는 null", () => {
    expect(channelOf(sixAt("discussion", { day: 1 }), "nobody-in-this-room")).toBeNull();
    expect(channelOf(lobbyOf(4), "nobody-in-this-room")).toBeNull();
  });

  it("alive 필드가 없는 옛 상태는 생존으로 본다", () => {
    const s = sixAt("discussion", { day: 1, dead: [] });
    expect(channelOf(s, idOf(2))).toBe("all");
  });
});

describe("audience — 받는 사람 집합", () => {
  it("밤 mafia: 산 마피아 + 탈락자뿐, 시민·경찰·의사는 없다", () => {
    const night = sixAt("night", { day: 1 });
    const got = audience(night, chat("mafia"));
    expect(sorted(got)).toEqual(ids(1, 4, 2));
    for (const seat of [0, 3, 5]) expect(got.has(idOf(seat))).toBe(false);
  });

  it("밤 ghost: 탈락자들만", () => {
    expect(sorted(audience(sixAt("night", { day: 1 }), chat("ghost")))).toEqual(ids(2));
    expect(sorted(audience(sixAt("night", { day: 1, dead: [2, 5] }), chat("ghost")))).toEqual(ids(2, 5));
  });

  it("탈락자가 없으면 ghost 는 빈 집합", () => {
    expect(audience(sixAt("discussion", { day: 1, dead: [] }), chat("ghost")).size).toBe(0);
  });

  it("로비 all = world = 방의 모든 사람", () => {
    const lobby = lobbyOf(6);
    const everyone = ids(0, 1, 2, 3, 4, 5);
    expect(sorted(audience(lobby, chat("all")))).toEqual(everyone);
    expect(sorted(audience(lobby, { k: "world" }))).toEqual(everyone);
  });

  it("6페이즈 world 수신자(로비의 방 사람 전원)와 같다: 로비 밖은 빈 집합", () => {
    const lobby = lobbyOf(5);
    expect(sorted(audience(lobby, { k: "world" }))).toEqual(lobby.players.map((p) => p.id).sort().join(","));
    for (const phase of ["assigning", "roleReveal", "dayAnnounce", "discussion", "night", "morning", "ended"] as PhaseId[]) {
      expect(audience(sixAt(phase, { day: 1 }), { k: "world" }).size).toBe(0);
    }
  });

  it.each(DAY_CHAT_PHASES)("%s: all = 산 사람 + 탈락자 모두", (phase) => {
    expect(sorted(audience(sixAt(phase, { day: 1 }), chat("all")))).toEqual(ids(0, 1, 2, 3, 4, 5));
  });

  it.each(SILENT_PHASES)("%s: 채팅·입력 중·동작 어떤 채널이든 빈 집합, world 도 빈 집합", (phase) => {
    const s = sixAt(phase, { day: 1 });
    for (const k of ["chat", "typing", "emote"] as const) {
      for (const ch of ["all", "mafia", "ghost"] as const) expect(audience(s, { k, ch }).size).toBe(0);
    }
    expect(audience(s, { k: "world" }).size).toBe(0);
  });

  it("방어 장치: 밤이 아닌 단계의 mafia 는 빈 집합", () => {
    for (const phase of ["lobby", ...DAY_CHAT_PHASES] as PhaseId[]) {
      expect(audience(sixAt(phase, { day: 1 }), chat("mafia")).size).toBe(0);
    }
  });

  it("typing·emote 는 같은 ch 의 chat 과 같은 집합", () => {
    for (const phase of ["lobby", "discussion", "night", "morning"] as PhaseId[]) {
      const s = phase === "lobby" ? lobbyOf(6) : sixAt(phase, { day: 1 });
      for (const ch of ["all", "mafia", "ghost"] as const) {
        expect(sorted(audience(s, { k: "typing", ch }))).toEqual(sorted(audience(s, chat(ch))));
        expect(sorted(audience(s, { k: "emote", ch }))).toEqual(sorted(audience(s, chat(ch))));
      }
    }
  });

  it("channelOf 가 정한 채널의 수신자에 보낸 사람 자신이 들어 있다", () => {
    for (const phase of ["lobby", "dayAnnounce", "discussion", "defense", "night", "morning"] as PhaseId[]) {
      const s = phase === "lobby" ? lobbyOf(6) : sixAt(phase, { day: 1 });
      for (const p of s.players) {
        const ch = channelOf(s, p.id);
        if (ch !== null) expect(audience(s, chat(ch)).has(p.id)).toBe(true);
      }
    }
  });

  it("산 시민은 mafia·ghost 어느 채널의 수신자도 아니다 (모든 단계)", () => {
    for (const phase of ["lobby", ...DAY_CHAT_PHASES, "night"] as PhaseId[]) {
      const s = phase === "lobby" ? lobbyOf(6) : sixAt(phase, { day: 1 });
      const citizen = idOf(0);
      expect(audience(s, chat("mafia")).has(citizen)).toBe(false);
      expect(audience(s, chat("ghost")).has(citizen)).toBe(false);
    }
  });
});

describe("CHAT_PHASES", () => {
  it("로비·낮 단계·밤·아침이 들고, assigning·roleReveal·ended·claim 은 들지 않는다", () => {
    expect([...CHAT_PHASES].sort().join(",")).toBe(
      ["lobby", "dayAnnounce", "discussion", "execVote", "candidateVote", "candidateVoteReveal", "defense", "execution", "night", "morning"].sort().join(","),
    );
    for (const phase of SILENT_PHASES) expect(CHAT_PHASES.has(phase)).toBe(false);
  });
});

describe("phaseKey — 단계 한 번(instance)마다 유일한 키", () => {
  it("'일차:단계' 이고 일차가 없으면 0", () => {
    expect(phaseKey({ phase: "night", day: 2 })).toBe("2:night");
    expect(phaseKey({ phase: "lobby" })).toBe("0:lobby");
  });

  it("같은 일차의 night·morning, 다음 일차 dayAnnounce 가 모두 다르다", () => {
    const keys = [
      phaseKey({ phase: "night", day: 2 }),
      phaseKey({ phase: "morning", day: 2 }),
      phaseKey({ phase: "dayAnnounce", day: 3 }),
      phaseKey({ phase: "dayAnnounce", day: 2 }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("서버 상태 키와 buildView(day.n) 로 만든 클라이언트 키가 같다 — 로비·dayAnnounce·discussion·night·morning", () => {
    const lobby = lobbyOf(6);
    const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(7));
    if (!started.ok) throw new Error("startGame failed");
    let state = started.state;
    const seen = new Set<PhaseId>();
    const check = (s: RoomState): void => {
      const view = buildView(s, s.players[0]!.id, 0);
      const client = phaseKey({ phase: view.phase, day: view.day?.n });
      expect(client).toBe(phaseKey({ phase: s.phase, day: s.day }));
      seen.add(s.phase);
    };
    check(lobby);
    // 실제 전이로 1일차 밤·아침과 2일차 낮 시작까지 따라간다.
    for (let guard = 0; guard < 60 && !(state.day === 2 && state.phase === "discussion"); guard += 1) {
      if (state.phaseEndsAt === null) break;
      state = tick(state, state.phaseEndsAt);
      if (state.phase === "ended") break;
      check(state);
    }
    for (const phase of ["dayAnnounce", "discussion", "night", "morning"] as PhaseId[]) expect(seen.has(phase)).toBe(true);
  });
});
