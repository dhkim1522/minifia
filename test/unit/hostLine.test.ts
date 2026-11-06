import { describe, expect, it } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { MorningView, PhaseId, RoomView } from "../../shared/protocol";
import { HOST_FALLBACK, HOST_LINES, callTargetsOf, hostChimeOf, hostKeyOf, hostLineOf, hostTimeOf, type HostKey } from "../../src/game/hostLine";

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
    ...(o.noise ? { job: "mafia" } : {}),
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
  if (o.noise) view.spectate = { seats: [{ seat: 1, job: "mafia" }], picks: { mafia: [1], police: [], doctor: [] } };
  return view as unknown as RoomView;
}

describe("사회자 문구 표 (D-03, UI-SPEC)", () => {
  const cases: Array<[string, Spec, string, HostKey, { cardSeen?: boolean }?]> = [
    ["대기실 방장·시작 가능", { phase: "lobby", host: true }, "모두 모였습니다. 시작 단추를 눌러 주세요.", "lobby.ready"],
    ["대기실 방장·인원 부족", { phase: "lobby", host: true, connected: 3 }, "대기실입니다. 친구들이 모일 때까지 기다려 주세요.", "lobby.gather"],
    ["대기실 손님", { phase: "lobby", seat: 1, host: false }, "대기실입니다. 방장이 시작할 때까지 기다려 주세요.", "lobby.guest"],
    ["배정", { phase: "assigning" }, "역할을 나누고 있습니다. 잠시만 기다려 주세요.", "assigning"],
    ["역할 확인, 카드 안 봄", { phase: "roleReveal" }, "역할이 정해졌습니다. 내 역할 카드를 확인해 주세요.", "roleReveal.act", { cardSeen: false }],
    ["역할 확인, 카드 봄", { phase: "roleReveal" }, "확인하셨으면 그대로 기다려 주세요.", "roleReveal.wait", { cardSeen: true }],
    ["낮 시작 산 사람", { phase: "dayAnnounce" }, "낮이 되었습니다. 모두 모여 주세요.", "dayAnnounce.wait"],
    ["낮 시작 유령", { phase: "dayAnnounce", ghost: true }, "낮이 되었습니다. 유령은 지켜봐 주세요.", "dayAnnounce.ghost"],
    ["토론 산 사람", { phase: "discussion" }, "토론 시간입니다. 의심 가는 사람을 이야기해 주세요.", "discussion.act"],
    ["토론 유령", { phase: "discussion", ghost: true }, "유령은 지켜보며 유령끼리 이야기할 수 있습니다.", "discussion.ghost"],
    ["투표 산 사람", { phase: "nomination" }, "투표 시간입니다. 처형할 사람의 이름표를 눌러 주세요.", "nomination.act"],
    ["투표 유령", { phase: "nomination", ghost: true }, "투표가 진행 중입니다. 지켜봐 주세요.", "nomination.ghost"],
    ["변론 본인", { phase: "defense", candidate: 0 }, "지목되셨습니다. 마지막으로 하실 말씀과 유언을 남겨 주세요.", "defense.act"],
    ["변론 남", { phase: "defense", candidate: 1 }, "하윤 님의 최후 변론 시간입니다.", "defense.wait"],
    ["변론 유령", { phase: "defense", candidate: 1, ghost: true }, "하윤 님의 최후 변론 시간입니다.", "defense.ghost"],
    ["찬반 변론자 아닌 산 사람", { phase: "verdict", candidate: 1 }, "하윤 님을 처형할지 찬성 또는 반대를 눌러 주세요.", "verdict.act"],
    ["찬반 변론자 본인", { phase: "verdict", candidate: 0 }, "다른 분들이 찬반을 정하고 있습니다.", "verdict.wait"],
    ["찬반 유령", { phase: "verdict", candidate: 1, ghost: true }, "하윤 님의 처형 찬반 투표 중입니다.", "verdict.ghost"],
    ["처형 통과", { phase: "execution", candidate: 1, passed: true }, "찬성이 많아 하윤 님이 처형됩니다.", "execution.passed"],
    ["처형 통과 유령(같은 문장)", { phase: "execution", candidate: 1, passed: true, ghost: true }, "찬성이 많아 하윤 님이 처형됩니다.", "execution.passed"],
    ["처형 부결", { phase: "execution", candidate: 1, passed: false }, "반대가 많아 처형은 없습니다.", "execution.failed"],
    ["밤 마피아", { phase: "night", role: "mafia" }, "밤이 되었습니다. 없앨 사람에게 다가가 주세요.", "night.mafia"],
    ["밤 경찰", { phase: "night", role: "police" }, "밤이 되었습니다. 조사할 사람의 이름표를 눌러 주세요.", "night.police"],
    ["밤 의사", { phase: "night", role: "doctor" }, "밤이 되었습니다. 지킬 사람의 이름표를 눌러 주세요.", "night.doctor"],
    ["밤 시민", { phase: "night", role: "citizen" }, "밤이 되었습니다. 눈을 감고 기다려 주세요.", "night.wait"],
    ["밤 유령", { phase: "night", role: "police", ghost: true }, "밤이 되었습니다. 모두의 밤 행동을 지켜봐 주세요.", "night.ghost"],
    ["아침 피해자", { phase: "morning", morning: { eliminated: 2 } }, "아침이 밝았습니다. 민지 님이 당했습니다.", "morning"],
    ["아침 구출", { phase: "morning", morning: { saved: true } }, "아침이 밝았습니다. 누군가 살아났습니다.", "morning"],
    ["아침 무사", { phase: "morning", morning: {} }, "아침이 밝았습니다. 아무 일도 없었습니다.", "morning"],
    ["아침 유령(같은 문장)", { phase: "morning", morning: {}, ghost: true }, "아침이 밝았습니다. 아무 일도 없었습니다.", "morning"],
    ["결과", { phase: "ended", endsAt: null }, "게임이 끝났습니다. 다음 판을 준비해 주세요.", "ended"],
  ];

  it.each(cases)("%s", (_label: string, spec: Spec, line: string, key: HostKey, local?: { cardSeen?: boolean }) => {
    const view = makeView(spec);
    expect(hostKeyOf(view, local)).toBe(key);
    expect(hostLineOf(view, local)).toBe(line);
  });

  it("아침 문장은 마침표 하나로 끝난다", () => {
    for (const morning of [{ eliminated: 2 }, { saved: true as const }, {}]) {
      const line = hostLineOf(makeView({ phase: "morning", morning }));
      expect(line.endsWith(".")).toBe(true);
      expect(line.endsWith("..")).toBe(false);
    }
  });

  it("이름이 필요한 키에서 변론자 닉네임을 못 찾으면 HOST_FALLBACK", () => {
    expect(hostLineOf(makeView({ phase: "defense", ghost: true }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "defense", candidate: 9 }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "verdict", candidate: 9 }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "execution", passed: true }))).toBe(HOST_FALLBACK);
  });

  it("day.morning 이 없는 아침, 역할 없는 역할 확인, 꺼진 장치 단계(결선·마지막 3인), 모르는 단계는 HOST_FALLBACK", () => {
    expect(hostLineOf(makeView({ phase: "morning" }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "roleReveal", role: null }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "runoff" }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "showdown" }))).toBe(HOST_FALLBACK);
    expect(hostLineOf(makeView({ phase: "viking" as PhaseId }))).toBe(HOST_FALLBACK);
    expect(hostKeyOf(makeView({ phase: "runoff" }))).toBe("fallback");
  });

  it("예약 키 errand·witness·trace 는 빈 문자열이고 hostKeyOf 가 돌려주지 않는다 (15페이즈 행)", () => {
    expect(HOST_LINES.errand).toBe("");
    expect(HOST_LINES.witness).toBe("");
    expect(HOST_LINES.trace).toBe("");
    for (const key of matrixKeys()) expect(["errand", "witness", "trace"]).not.toContain(key);
  });

  it("문구 표 어느 줄에도 역할 이름이 없다", () => {
    for (const text of allLines()) {
      for (const word of ["마피아", "경찰", "의사", "시민"]) expect(text, text).not.toContain(word);
    }
  });

  it("모든 줄은 8자 닉네임을 넣어도 36자 이하이다 (UI#2 — 실제 줄 수는 14-08 E2E 가 잰다)", () => {
    for (const text of allLines()) expect(text.length, text).toBeLessThanOrEqual(36);
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

  it("빈 줄(키 줄이 빈 문자열)은 HOST_FALLBACK 을 돌려준다 — 빈 띠는 없다 (UI#1)", () => {
    for (const spec of matrixSpecs()) expect(hostLineOf(makeView(spec)).length).toBeGreaterThan(0);
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

  it("밤: 경찰은 나 제외, 의사는 나 포함, 마피아·시민·유령 → null", () => {
    expect(callTargetsOf(makeView({ phase: "night", role: "police", seat: 1 }))).toEqual(tag(0, 2, 3));
    expect(callTargetsOf(makeView({ phase: "night", role: "doctor", seat: 1 }))).toEqual(tag(0, 1, 2, 3));
    expect(callTargetsOf(makeView({ phase: "night", role: "doctor", seat: 1, dead: [3] }))).toEqual(tag(0, 1, 2));
    expect(callTargetsOf(makeView({ phase: "night", role: "mafia" }))).toBeNull();
    expect(callTargetsOf(makeView({ phase: "night", role: "citizen" }))).toBeNull();
    expect(callTargetsOf(makeView({ phase: "night", role: "police", ghost: true }))).toBeNull();
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
  "players[].nickname",
  "players[].alive",
  "players[].connected",
  "day",
  "day.candidate",
  "day.verdict",
  "day.verdict.passed",
  "day.morning",
]);
/** morningText 가 읽는 하위 값 */
const ALLOWED_PREFIX = ["day.morning."];

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
  return (Object.keys(HOST_LINES) as HostKey[]).flatMap((key) => {
    const line = HOST_LINES[key];
    if (typeof line === "string") return [line];
    return [line(LONG_NAME)];
  });
}

describe("HOST-05 허용 목록만 읽는다 (T-14-01)", () => {
  it("단계 14개 × 시점마다 hostLineOf·hostKeyOf·callTargetsOf 가 읽은 경로가 모두 허용 목록 안이다", () => {
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

  it("허용 목록 밖 값(allies·records·pick·verdictVote·nightTally·spectate·job·points·turn·voteLog·roles)을 채운 view 와 지운 view 의 결과가 같다", () => {
    for (const spec of matrixSpecs()) {
      for (const cardSeen of [false, true]) {
        const plain = makeView(spec);
        const noisy = makeView({ ...spec, noise: true });
        expect(hostLineOf(noisy, { cardSeen })).toBe(hostLineOf(plain, { cardSeen }));
        expect(hostKeyOf(noisy, { cardSeen })).toBe(hostKeyOf(plain, { cardSeen }));
        expect(callTargetsOf(noisy, { cardSeen })).toEqual(callTargetsOf(plain, { cardSeen }));
        expect(hostTimeOf(noisy)).toBe(hostTimeOf(plain));
      }
    }
  });
});
