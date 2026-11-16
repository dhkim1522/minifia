import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { GameMode, MorningView, PhaseId, RoomView } from "../../shared/protocol";
import { HOST_FALLBACK, HOST_HIDDEN_PHASES, HOST_LINES, callTargetsOf, hostBandModeOf, hostChimeOf, hostKeyOf, hostLineOf, hostTimeOf, type HostKey, type HostLocal } from "../../src/game/hostLine";

// 22-06: 심부름·목격 기록·아침 흔적·증거 줄(errand.*·witness·trace·discussion.evidence)과 그 시험을 지웠다.
// 14-01: 사회자 문구 표(UI-SPEC "사회자 문구 표")와 파생 판정. 표가 단일 출처다 — 시험과 표가 어긋나면 표를 따른다.
// 마지막 describe 는 HOST-05(T-14-01): 문장·빛남 대상은 내 view 의 허용 목록 값만 읽는다.

const NAMES = ["지우", "하윤", "민지", "도현"] as const;
const LONG_NAME = "가나다라마바사아";

interface Spec {
  phase: PhaseId;
  /** null 이면 역할 키가 없다 */
  role?: RoleId | null;
  ghost?: boolean;
  host?: boolean;
  /** 내 좌석(기본 0) */
  seat?: number;
  candidate?: number;
  passed?: boolean;
  morning?: MorningView;
  /** 연결된 사람 수(기본 4) */
  connected?: number;
  minPlayers?: number;
  /** 허용 목록 밖 값을 채운다 */
  noise?: boolean;
  /** 죽은 사람 좌석(내 좌석 말고 추가로) */
  dead?: readonly number[];
  endsAt?: number | null;
  durationMs?: number | null;
  /** 이번 판의 맵(view.map) */
  map?: "bar" | "plaza";
  /** 19페이즈: 판 종류(view.mode). 없으면 키 자체가 없다 */
  mode?: GameMode;
}

function makeView(o: Spec): RoomView {
  const seat = o.seat ?? 0;
  const connected = o.connected ?? 4;
  const players = NAMES.map((nickname, i) => ({
    seat: i,
    nickname,
    connected: i < connected,
    isHost: i === 0,
    ...((o.ghost === true && i === seat) || (o.dead ?? []).includes(i) ? { alive: false } : {}),
    ...(o.noise ? { job: "mafia", look: "police" } : {}),
  }));
  const me: Record<string, unknown> = { seat, isHost: o.host ?? seat === 0 };
  if (o.role !== null) me.role = o.role ?? "citizen";
  if (o.noise) {
    Object.assign(me, {
      allies: [1],
      records: [{ n: 1, target: 1, isMafia: true }],
      pick: 2,
      verdictVote: true,
      nightTally: [{ seat: 1, n: 2 }],
    });
  }
  const day: Record<string, unknown> = { n: 1 };
  if (o.candidate !== undefined) day.candidate = o.candidate;
  if (o.passed !== undefined) day.verdict = { yes: 3, no: 1, passed: o.passed };
  if (o.morning !== undefined) day.morning = o.morning;
  if (o.noise) Object.assign(day, { roles: ["mafia", "police", "citizen"], points: [{ seat: 1, target: 2 }], turn: { i: 0 }, voteLog: [{ seat: 1, target: 2 }] });
  const endsAt = o.endsAt === undefined ? 1_700_000_090_000 : o.endsAt;
  const view: Record<string, unknown> = {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: endsAt,
    phaseDurationMs: o.durationMs === undefined ? (endsAt === null ? null : 90_000) : o.durationMs,
    serverNow: 1_700_000_000_000,
    minPlayers: o.minPlayers ?? 4,
    maxPlayers: 8,
    players,
    me,
    day,
  };
  if (o.map !== undefined) view.map = o.map;
  if (o.mode !== undefined) view.mode = o.mode;
  if (o.noise) view.spectate = { seats: [{ seat: 1, job: "mafia" }], picks: { mafia: [1], police: [], doctor: [] } };
  return view as unknown as RoomView;
}

describe("사회자 문구 표 (D-03, UI-SPEC)", () => {
  const cases: Array<[string, Spec, string, HostKey, HostLocal?]> = [
    ["대기실 방장·시작 가능", { phase: "lobby", host: true }, "모두 모였습니다. 시작 단추를 눌러 주세요.", "lobby.ready"],
    ["대기실 방장·인원 부족", { phase: "lobby", host: true, connected: 3 }, "대기실입니다. 친구들이 모일 때까지 기다려 주세요.", "lobby.gather"],
    ["대기실 손님", { phase: "lobby", seat: 1, host: false }, "대기실입니다. 방장이 시작할 때까지 기다려 주세요.", "lobby.guest"],
    ["배정", { phase: "assigning" }, "잠시만 기다려 주세요", "assigning"],
    ["역할 확인, 카드 안 봄", { phase: "roleReveal" }, "내 역할 카드를 확인해 주세요", "roleReveal.act", { cardSeen: false }],
    ["역할 확인, 카드 봄", { phase: "roleReveal" }, "그대로 기다려 주세요", "roleReveal.wait", { cardSeen: true }],
    ["낮 시작 산 사람", { phase: "dayAnnounce" }, "모두 모여 주세요", "dayAnnounce.wait"],
    ["낮 시작 유령", { phase: "dayAnnounce", ghost: true }, "지켜봐 주세요", "dayAnnounce.ghost"],
    ["토론 산 사람", { phase: "discussion" }, "의심 가는 사람을 이야기해 주세요", "discussion.act"],
    ["토론 유령", { phase: "discussion", ghost: true }, "유령끼리 이야기할 수 있습니다", "discussion.ghost"],
    ["투표 산 사람", { phase: "nomination" }, "처형할 사람의 이름표를 눌러 주세요", "nomination.act"],
    ["투표 유령", { phase: "nomination", ghost: true }, "지켜봐 주세요", "nomination.ghost"],
    ["변론 본인", { phase: "defense", candidate: 0 }, "마지막 말과 유언을 남겨 주세요", "defense.act"],
    ["변론 남", { phase: "defense", candidate: 1 }, "변론을 들어 주세요", "defense.wait"],
    ["변론 유령", { phase: "defense", candidate: 1, ghost: true }, "변론을 지켜봐 주세요", "defense.ghost"],
    ["찬반 변론자 아닌 산 사람", { phase: "verdict", candidate: 1 }, "찬성 또는 반대를 눌러 주세요", "verdict.act"],
    ["찬반 변론자 본인", { phase: "verdict", candidate: 0 }, "결과를 기다려 주세요", "verdict.wait"],
    ["찬반 유령", { phase: "verdict", candidate: 1, ghost: true }, "지켜봐 주세요", "verdict.ghost"],
    ["처형 통과", { phase: "execution", candidate: 1, passed: true }, "", "execution.passed"],
    ["처형 통과 유령(같은 문장)", { phase: "execution", candidate: 1, passed: true, ghost: true }, "", "execution.passed"],
    ["처형 부결", { phase: "execution", candidate: 1, passed: false }, "", "execution.failed"],
    ["밤 마피아", { phase: "night", role: "mafia" }, "없앨 사람의 얼굴을 눌러 주세요", "night.mafia"],
    ["밤 경찰", { phase: "night", role: "police" }, "조사할 사람의 얼굴을 눌러 주세요", "night.police"],
    ["밤 의사", { phase: "night", role: "doctor" }, "지킬 사람의 얼굴을 눌러 주세요", "night.doctor"],
    ["밤 시민", { phase: "night", role: "citizen" }, "한 명의 얼굴을 눌러 주세요", "night.citizen"],
    ["밤 유령", { phase: "night", role: "police", ghost: true }, "모두의 밤 행동을 지켜봐 주세요", "night.ghost"],
    ["아침 피해자", { phase: "morning", morning: { eliminated: 2 } }, "", "morning"],
    ["아침 구출", { phase: "morning", morning: { saved: true } }, "", "morning"],
    ["아침 무사", { phase: "morning", morning: {} }, "", "morning"],
    ["아침 유령(같은 문장)", { phase: "morning", morning: {}, ghost: true }, "", "morning"],
    ["결과", { phase: "ended", endsAt: null }, "게임이 끝났습니다. 다음 판을 준비해 주세요.", "ended"],
  ];

  it.each(cases)("%s", (_label: string, spec: Spec, line: string, key: HostKey, local?: HostLocal) => {
    const view = makeView(spec);
    expect(hostKeyOf(view, local)).toBe(key);
    expect(hostLineOf(view, local)).toBe(line);
  });

  it("18.1-12: 변론·찬반·처형 줄에 닉네임이 없다 — 이름이 8자여도 같은 문장이고 변론자를 못 찾아도 문장이 나온다 (0083-8)", () => {
    const spec = { phase: "defense" as const, candidate: 1 };
    const named = makeView(spec);
    const longName = makeView(spec);
    longName.players = longName.players.map((p) => (p.seat === 1 ? { ...p, nickname: LONG_NAME } : p));
    expect(hostLineOf(longName)).toBe(hostLineOf(named));
    expect(hostLineOf(named)).toBe("변론을 들어 주세요");
    expect(hostLineOf(makeView({ phase: "defense", ghost: true }))).toBe("변론을 지켜봐 주세요");
    expect(hostLineOf(makeView({ phase: "defense", candidate: 9 }))).toBe("변론을 들어 주세요");
    expect(hostLineOf(makeView({ phase: "verdict", candidate: 9 }))).toBe("찬성 또는 반대를 눌러 주세요");
    expect(hostLineOf(makeView({ phase: "execution", passed: true }))).toBe("");
  });

  it("day.morning 이 없는 아침, 역할 없는 역할 확인, 꺼진 장치 단계(결선·마지막 3인), 모르는 단계는 HOST_FALLBACK", () => {
    expect(hostLineOf(makeView({ phase: "morning" }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "roleReveal", role: null }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "runoff" }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "showdown" }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "viking" as PhaseId }))).toBe(HOST_FALLBACK);
    expect(hostKeyOf(makeView({ phase: "runoff" }))).toBe("fallback");
  });

  it("18.1-12: 표의 문장은 모두 문자열이고, 빈 문자열은 큰 글이 말하는 키(처형·아침)뿐이다 — 빈 줄을 대체 문장으로 바꾸지 않는다", () => {
    const empty = (Object.keys(HOST_LINES) as HostKey[]).filter((key) => HOST_LINES[key] === "").sort();
    expect(empty).toEqual(["execution.failed", "execution.passed", "morning"]);
    for (const key of Object.keys(HOST_LINES) as HostKey[]) expect(typeof HOST_LINES[key], key).toBe("string");
    expect(HOST_LINES["discussion.act"]).toBe("의심 가는 사람을 이야기해 주세요");
    expect(HOST_FALLBACK).toBe("잠시만 기다려 주세요");
    expect(Object.keys(HOST_LINES)).not.toContain("errand");
    expect(new Set(matrixKeys())).toContain("discussion.act");
  });

  it("문구 표 어느 줄에도 역할 이름이 없다", () => {
    for (const text of allLines()) {
      for (const word of ["마피아", "경찰", "의사", "시민"]) expect(text, text).not.toContain(word);
    }
  });

  it("18.1-12: 보이는 띠 줄(대기실·결과 제외, 빈 줄 제외)은 공백 포함 19자 이하·마침표 없음·'입니다.'·'되었습니다.' 없음 — 폭 360 한 줄 (0073-1)", () => {
    const visible = (Object.keys(HOST_LINES) as HostKey[]).filter((key) => !key.startsWith("lobby.") && key !== "ended").map((key) => HOST_LINES[key]).filter((text) => text !== "");
    expect(visible.length).toBeGreaterThan(20);
    for (const text of visible) {
      expect([...text].length, text).toBeLessThanOrEqual(19);
      expect(text.endsWith("."), text).toBe(false);
      expect(text, text).not.toContain("입니다.");
      expect(text, text).not.toContain("되었습니다.");
    }
  });

  it("할 일 없는 산 사람 줄은 역할에 따라 달라지지 않는다 (밤 act 만 역할별)", () => {
    const roles: RoleId[] = ["mafia", "police", "doctor", "citizen"];
    const calm: Array<Spec> = [
      { phase: "assigning" },
      { phase: "dayAnnounce" },
      { phase: "discussion" },
      { phase: "nomination" },
      { phase: "defense", candidate: 1 },
      { phase: "verdict", candidate: 1 },
      { phase: "execution", candidate: 1, passed: true },
      { phase: "morning", morning: { saved: true } },
    ];
    for (const spec of calm) {
      const lines = new Set(roles.map((role) => hostLineOf(makeView({ ...spec, role }))));
      expect(lines.size, spec.phase).toBe(1);
    }
    expect(new Set(roles.map((role) => hostLineOf(makeView({ phase: "night", role })))).size).toBe(4);
  });

  it("18.1-12: 낮 시작은 산 사람 '모두 모여 주세요'·유령 '지켜봐 주세요', 처형·아침은 빈 문장이고 모르는 단계만 대체 문장이다", () => {
    expect(hostLineOf(makeView({ phase: "dayAnnounce" }))).toBe("모두 모여 주세요");
    expect(hostLineOf(makeView({ phase: "dayAnnounce", ghost: true }))).toBe("지켜봐 주세요");
    for (const passed of [true, false]) expect(hostLineOf(makeView({ phase: "execution", candidate: 1, passed }))).toBe("");
    expect(hostLineOf(makeView({ phase: "morning", morning: { eliminated: 2 } }))).toBe("");
    expect(hostLineOf(makeView({ phase: "viking" as PhaseId }))).toBe("잠시만 기다려 주세요");
  });
});

describe("18.1-12 띠 상태 hostBandModeOf (0083-8)", () => {
  const mode = (spec: Spec, local?: HostLocal) => {
    const view = makeView(spec);
    return hostBandModeOf(view, hostLineOf(view, local));
  };

  it("숨는 단계는 대기실·결과다", () => {
    expect([...HOST_HIDDEN_PHASES].sort()).toEqual(["ended", "lobby"]);
  });

  it("대기실·결과 view 는 off — 방장·손님 모두", () => {
    expect(mode({ phase: "lobby", host: true, endsAt: null })).toBe("off");
    expect(mode({ phase: "lobby", seat: 1, host: false, endsAt: null })).toBe("off");
    expect(mode({ phase: "ended", endsAt: null })).toBe("off");
  });

  it("처형·아침 view 는 blank — 빈 줄이고 시간 행이 있다", () => {
    expect(mode({ phase: "execution", candidate: 1, passed: true })).toBe("blank");
    expect(mode({ phase: "execution", candidate: 1, passed: false })).toBe("blank");
    expect(mode({ phase: "morning", morning: { eliminated: 2 }, durationMs: 5000 })).toBe("blank");
  });

  it("낮 시작(한 구절·시간 행 없음)·토론·투표·밤·역할 배정은 show", () => {
    expect(mode({ phase: "dayAnnounce", durationMs: 2000 })).toBe("show");
    expect(hostTimeOf(makeView({ phase: "dayAnnounce", durationMs: 2000 }))).toBe(false);
    for (const phase of ["assigning", "roleReveal", "discussion", "nomination"] as const) expect(mode({ phase, durationMs: 15_000 }), phase).toBe("show");
    expect(mode({ phase: "defense", candidate: 1 })).toBe("show");
    expect(mode({ phase: "verdict", candidate: 1 })).toBe("show");
    for (const role of ["mafia", "police", "doctor", "citizen"] as const) expect(mode({ phase: "night", role }), role).toBe("show");
  });

  it("빈 줄인데 시간 행도 없는 가짜 입력은 off(빈 상자가 뜨지 않게 하는 안전 규칙)", () => {
    expect(hostBandModeOf(makeView({ phase: "execution", candidate: 1, passed: true, endsAt: null }), "")).toBe("off");
    expect(hostBandModeOf(makeView({ phase: "morning", morning: {}, durationMs: 2000 }), "")).toBe("off");
  });

  it("줄이 있으면 숨는 단계가 아닌 한 show — 시간 행이 없어도", () => {
    expect(hostBandModeOf(makeView({ phase: "discussion", endsAt: null }), "의심 가는 사람을 이야기해 주세요")).toBe("show");
    expect(hostBandModeOf(makeView({ phase: "lobby", host: true, endsAt: null }), HOST_LINES["lobby.ready"])).toBe("off");
  });
});

describe("빛남 대상 callTargetsOf (HOST-03·04)", () => {
  const tool = (t: string) => ({ kind: "tool", tool: t });
  const tag = (...seats: number[]) => ({ kind: "tag", seats });

  it("대기실: 방장·시작 가능 → start, 인원 부족·손님 → null", () => {
    expect(callTargetsOf(makeView({ phase: "lobby", host: true }))).toEqual(tool("start"));
    expect(callTargetsOf(makeView({ phase: "lobby", host: true, connected: 3 }))).toBeNull();
    expect(callTargetsOf(makeView({ phase: "lobby", seat: 1, host: false }))).toBeNull();
  });

  it("역할 확인: 역할 있음·카드 안 봄 → card, 본 뒤·역할 없음 → null", () => {
    expect(callTargetsOf(makeView({ phase: "roleReveal" }), { cardSeen: false })).toEqual(tool("card"));
    expect(callTargetsOf(makeView({ phase: "roleReveal" }), { cardSeen: true })).toBeNull();
    expect(callTargetsOf(makeView({ phase: "roleReveal", role: null }))).toBeNull();
  });

  it("토론: 산 사람 → chat, 유령 → null", () => {
    expect(callTargetsOf(makeView({ phase: "discussion" }))).toEqual(tool("chat"));
    expect(callTargetsOf(makeView({ phase: "discussion", ghost: true }))).toBeNull();
  });

  it("투표: 나와 죽은 사람을 뺀 산 사람 좌석 오름차순, 유령 → null", () => {
    expect(callTargetsOf(makeView({ phase: "nomination" }))).toEqual(tag(1, 2, 3));
    expect(callTargetsOf(makeView({ phase: "nomination", seat: 3, dead: [1] }))).toEqual(tag(0, 2));
    expect(callTargetsOf(makeView({ phase: "nomination", ghost: true }))).toBeNull();
  });

  it("최후 변론: 변론자 본인 → will, 남·유령 → null", () => {
    expect(callTargetsOf(makeView({ phase: "defense", candidate: 0 }))).toEqual(tool("will"));
    expect(callTargetsOf(makeView({ phase: "defense", candidate: 1 }))).toBeNull();
    expect(callTargetsOf(makeView({ phase: "defense", candidate: 1, ghost: true }))).toBeNull();
  });

  it("찬반: 변론자 아닌 산 사람 → verdict, 변론자 본인·유령 → null", () => {
    expect(callTargetsOf(makeView({ phase: "verdict", candidate: 1 }))).toEqual(tool("verdict"));
    expect(callTargetsOf(makeView({ phase: "verdict", candidate: 0 }))).toBeNull();
    expect(callTargetsOf(makeView({ phase: "verdict", candidate: 1, ghost: true }))).toBeNull();
  });

  it("밤: 산 마피아·경찰·의사·시민 모두 나를 포함한 산 사람 전원(네 시점 같음), 유령 → null (D-05)", () => {
    const roles: RoleId[] = ["mafia", "police", "doctor", "citizen"];
    for (const role of roles) {
      expect(callTargetsOf(makeView({ phase: "night", role, seat: 1 })), role).toEqual(tag(0, 1, 2, 3));
      expect(callTargetsOf(makeView({ phase: "night", role, seat: 1, dead: [3] })), `${role} 한 명 탈락`).toEqual(tag(0, 1, 2));
    }
    expect(callTargetsOf(makeView({ phase: "night", role: "police", ghost: true }))).toBeNull();
    expect(callTargetsOf(makeView({ phase: "night", role: "mafia", ghost: true }))).toBeNull();
  });

  it("밤 문구: 대기 키는 없고 night.mafia·night.citizen 은 36자 이하·역할 낱말 없음", () => {
    expect(Object.keys(HOST_LINES)).not.toContain(["night", "wait"].join("."));
    for (const k of ["night.mafia", "night.citizen"] as const) {
      const t = HOST_LINES[k] as string;
      expect(t.length, k).toBeLessThanOrEqual(36);
      expect(/마피아|경찰|의사|시민/.test(t), k).toBe(false);
    }
  });

  it("배정·낮 시작·처형·아침·결과·꺼진 장치 단계 → null", () => {
    for (const phase of ["assigning", "dayAnnounce", "execution", "morning", "ended", "runoff", "showdown"] as PhaseId[]) {
      expect(callTargetsOf(makeView({ phase, candidate: 1, passed: true, morning: {} })), phase).toBeNull();
    }
  });
});

describe("시간 행 hostTimeOf (TOOL-02, U-3)", () => {
  const timed = (phase: PhaseId, durationMs: number | null, endsAt: number | null = 1_700_000_090_000) => hostTimeOf(makeView({ phase, durationMs, endsAt }));

  it("대기실·배정·결과는 마감이 있어도 false", () => {
    expect(timed("lobby", 90_000)).toBe(false);
    expect(timed("assigning", 90_000)).toBe(false);
    expect(timed("ended", 90_000)).toBe(false);
  });

  it("낮 시작(2초)은 false, 3초 미만은 모두 false", () => {
    expect(timed("dayAnnounce", 2000)).toBe(false);
    expect(timed("morning", 2999)).toBe(false);
    expect(timed("morning", 3000)).toBe(true);
  });

  it("토론 90초·투표 15초·찬반 10초·처형 5.6초·밤 30초는 true", () => {
    expect(timed("discussion", 90_000)).toBe(true);
    expect(timed("nomination", 15_000)).toBe(true);
    expect(timed("verdict", 10_000)).toBe(true);
    expect(timed("execution", 5600)).toBe(true);
    expect(timed("night", 30_000)).toBe(true);
  });

  it("마감 또는 길이가 없으면 false", () => {
    expect(timed("discussion", 90_000, null)).toBe(false);
    expect(timed("discussion", null)).toBe(false);
  });
});

describe("알림음 판정 hostChimeOf (HOST-02)", () => {
  it("처음·같은 단계·처음 마운트는 false, 단계가 바뀐 프레임은 true", () => {
    expect(hostChimeOf(null, "discussion", false)).toBe(false);
    expect(hostChimeOf("discussion", "nomination", false)).toBe(true);
    expect(hostChimeOf("discussion", "nomination", true)).toBe(false);
    expect(hostChimeOf("nomination", "nomination", false)).toBe(false);
  });

  it("낮 시작 → 토론은 이미 울렸으므로 false, 그 밖 전환은 true", () => {
    expect(hostChimeOf("dayAnnounce", "discussion", false)).toBe(false);
    expect(hostChimeOf("execution", "night", false)).toBe(true);
    expect(hostChimeOf("morning", "dayAnnounce", false)).toBe(true);
  });

  it("대기실 → 배정·배정 → 역할 확인은 울린다", () => {
    expect(hostChimeOf("lobby", "assigning", false)).toBe(true);
    expect(hostChimeOf("assigning", "roleReveal", false)).toBe(true);
  });
});

// ---- HOST-05: 허용 목록만 읽는다 ----

/** 허용 목록(UI-SPEC HOST-05). 배열 첨자는 [] 로 적는다. 중간 경로(me·players·day)도 읽기이므로 포함한다. */
const ALLOWED_EXACT: ReadonlySet<string> = new Set([
  "phase",
  "phaseEndsAt",
  "phaseDurationMs",
  "minPlayers",
  "me",
  "me.seat",
  "me.role",
  "me.isHost",
  "players",
  "players[]",
  "players[].seat",
  "players[].alive",
  "players[].connected",
  "day",
  "day.candidate",
  "day.verdict",
  "day.verdict.passed",
  "day.morning",
]);
/** 18.1-12: 하위 값 허용 접두사는 없다 — 닉네임·아침 결과 문장은 더는 읽지 않는다 */
const ALLOWED_PREFIX: readonly string[] = [];

function recorder(root: object, log: Set<string>): object {
  const wrap = (target: object, path: string): object =>
    new Proxy(target, {
      get(t, key, receiver) {
        const value: unknown = Reflect.get(t, key, receiver);
        if (typeof key === "symbol") return value;
        let next: string;
        if (Array.isArray(t)) {
          if (key === "length" || typeof value === "function") return value;
          next = `${path}[]`;
        } else {
          next = path === "" ? key : `${path}.${key}`;
        }
        log.add(next);
        return typeof value === "object" && value !== null ? wrap(value, next) : value;
      },
    });
  return wrap(root, "");
}

const isAllowed = (path: string): boolean => ALLOWED_EXACT.has(path) || ALLOWED_PREFIX.some((p) => path.startsWith(p));

const MATRIX_PHASES: readonly PhaseId[] = ["lobby", "assigning", "roleReveal", "dayAnnounce", "discussion", "nomination", "runoff", "showdown", "defense", "verdict", "execution", "night", "morning", "ended"];

/** 단계 14개 × 시점(마피아·경찰·의사·시민 산 사람, 유령, 방장/손님, 변론자 본인) */
function matrixSpecs(): Spec[] {
  const out: Spec[] = [];
  for (const phase of MATRIX_PHASES) {
    const base: Spec = { phase, candidate: 1, passed: true, morning: { eliminated: 2 } };
    for (const role of ["mafia", "police", "doctor", "citizen"] as RoleId[]) out.push({ ...base, role });
    out.push({ ...base, ghost: true });
    out.push({ ...base, host: true });
    out.push({ ...base, seat: 1, host: false, candidate: 1 });
    out.push({ ...base, seat: 1, candidate: 1 }); // 변론자 본인
  }
  return out;
}

function matrixKeys(): HostKey[] {
  return matrixSpecs().flatMap((s) => [hostKeyOf(makeView(s), { cardSeen: false }), hostKeyOf(makeView(s), { cardSeen: true })]);
}

function allLines(): string[] {
  return (Object.keys(HOST_LINES) as HostKey[]).map((key) => HOST_LINES[key]);
}

describe("HOST-05 허용 목록만 읽는다 (T-14-01)", () => {
  it("단계 15개 × 시점마다 hostLineOf·hostKeyOf·callTargetsOf 가 읽은 경로가 모두 허용 목록 안이다", () => {
    const outside = new Set<string>();
    for (const spec of matrixSpecs()) {
      for (const cardSeen of [false, true]) {
        const log = new Set<string>();
        const view = recorder(makeView({ ...spec, noise: true }), log) as RoomView;
        hostLineOf(view, { cardSeen });
        hostKeyOf(view, { cardSeen });
        callTargetsOf(view, { cardSeen });
        hostTimeOf(view);
        for (const path of log) if (!isAllowed(path)) outside.add(path);
      }
    }
    expect([...outside]).toEqual([]);
  });

  it("전제: 기록 Proxy 는 허용 목록 밖 읽기를 실제로 잡아낸다", () => {
    const log = new Set<string>();
    const view = recorder(makeView({ phase: "night", noise: true }), log) as RoomView;
    void view.me.allies;
    void view.spectate;
    void (view.players[0] as unknown as { job: unknown }).job;
    expect([...log].filter((p) => !isAllowed(p)).sort()).toEqual(["me.allies", "players[].job", "spectate"]);
  });

  it("18.1-12: hostLineOf 는 players[].nickname 과 day.morning 의 하위 값(eliminated·saved)을 읽지 않는다 — 문장이 닉네임·아침 결과를 싣지 않는다", () => {
    for (const spec of matrixSpecs()) {
      for (const local of [{}, { cardSeen: true }]) {
        const log = new Set<string>();
        hostLineOf(recorder(makeView({ ...spec, noise: true }), log) as RoomView, local);
        expect([...log].filter((p) => p === "players[].nickname" || p === "day.morning.eliminated" || p === "day.morning.saved"), spec.phase).toEqual([]);
      }
    }
  });

  it("18.1-12: 밤 역할 줄은 그 역할 분기에서만 나온다 — 다른 역할의 줄과 겹치지 않는다(누설 방지, HOST-05)", () => {
    const own = { mafia: "없앨 사람의 얼굴을 눌러 주세요", police: "조사할 사람의 얼굴을 눌러 주세요", doctor: "지킬 사람의 얼굴을 눌러 주세요" } as const;
    for (const role of ["mafia", "police", "doctor"] as const) {
      expect(hostLineOf(makeView({ phase: "night", role }))).toBe(own[role]);
    }
    for (const role of ["citizen", undefined] as const) {
      expect(Object.values(own)).not.toContain(hostLineOf(makeView({ phase: "night", ...(role ? { role } : {}) })));
    }
    expect(Object.values(own)).not.toContain(hostLineOf(makeView({ phase: "night", role: "mafia", ghost: true })));
  });

  it("허용 목록 밖 값(allies·records·pick·verdictVote·nightTally·spectate·job·points·turn·voteLog·roles)을 채운 view 와 지운 view 의 결과가 같다", () => {
    for (const spec of matrixSpecs()) {
      for (const cardSeen of [false, true]) {
        const plain = makeView(spec);
        const noisy = makeView({ ...spec, noise: true });
        const local = { cardSeen };
        expect(hostLineOf(noisy, local)).toBe(hostLineOf(plain, local));
        expect(hostKeyOf(noisy, local)).toBe(hostKeyOf(plain, local));
        expect(callTargetsOf(noisy, local)).toEqual(callTargetsOf(plain, local));
        expect(hostTimeOf(noisy)).toBe(hostTimeOf(plain));
      }
    }
  });

});

// 19-02(UI-SPEC E-3·P19-17): 사회자 줄은 판 종류를 읽지 않는다. 22-06: 심부름·기록·증거 키는 표에서 없어졌다.
describe("사회자 줄은 판 종류를 읽지 않는다 (19-02, E-3)", () => {
  it("낮 시작 발표는 dayAnnounce.wait, 토론은 discussion.act 다 — 어느 판 종류에서도 같다", () => {
    for (const mode of [undefined, "basic", "extended"] as const) {
      const view = (phase: PhaseId): RoomView => makeView({ phase, ...(mode === undefined ? {} : { mode }) });
      expect(`${hostKeyOf(view("dayAnnounce"))}/${hostKeyOf(view("discussion"))}`).toBe("dayAnnounce.wait/discussion.act");
      expect(`${hostLineOf(view("dayAnnounce"))}/${hostLineOf(view("discussion"))}`).toBe("모두 모여 주세요/의심 가는 사람을 이야기해 주세요");
    }
  });

  it("hostLine.ts 는 판 종류를 읽지 않는다 — view.mode 도 rulesetOf 도 없다 (P19-17, 22-04: 원인 흐름 분기를 지웠다)", () => {
    const src = readFileSync(fileURLToPath(new URL("../../src/game/hostLine.ts", import.meta.url)), "utf8");
    const code = src.split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n");
    expect(/\bview\.mode\b/.test(code)).toBe(false);
    expect(code.match(/rulesetOf\(modeOf\(/g)?.length ?? 0).toBe(0);
  });
});
