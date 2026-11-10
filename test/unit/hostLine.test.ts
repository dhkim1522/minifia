import { describe, expect, it } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { EvidenceView, MorningView, PhaseId, PlaceId, RecordLine, RoomView } from "../../shared/protocol";
import { HOST_FALLBACK, HOST_LINES, callTargetsOf, hostChimeOf, hostKeyOf, hostLineOf, hostTimeOf, type HostKey, type HostLocal } from "../../src/game/hostLine";

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
  /** 15-04: 내 심부름 목록·진행(me.errand). 없으면 키 자체가 없다 */
  errand?: { places: PlaceId[]; done: PlaceId[] };
  /** 이번 판의 맵(view.map) */
  map?: "bar" | "plaza";
  /** 15-07: 내 목격 기록(me.record). 없으면 키 자체가 없다(못 마친 사람) */
  record?: RecordLine[];
  /** 16-09: 낮의 증거(day.evidence). 없으면 키 자체가 없다 */
  evidence?: EvidenceView;
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
  if (o.record !== undefined) me.record = o.record.map((r) => ({ ...r }));
  if (o.errand !== undefined) me.errand = { places: [...o.errand.places], done: [...o.errand.done] };
  if (o.passed !== undefined) day.verdict = { yes: 3, no: 1, passed: o.passed };
  if (o.morning !== undefined) day.morning = o.morning;
  if (o.evidence !== undefined) day.evidence = { ...o.evidence, ...(o.noise ? { seen: { seat: 1, place: "glass" } } : {}) };
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
  if (o.noise) view.spectate = { seats: [{ seat: 1, job: "mafia" }], picks: { mafia: [1], police: [], doctor: [] } };
  return view as unknown as RoomView;
}

const REC_SOME: RecordLine[] = [
  { seat: 1, place: "glass" },
  { seat: 2, place: "piano" },
];
const ERR_PART = { places: ["glass", "piano", "sax"] as PlaceId[], done: ["piano"] as PlaceId[] };
const ERR_DONE = { places: ["glass", "piano", "sax"] as PlaceId[], done: ["glass", "piano", "sax"] as PlaceId[] };

describe("사회자 문구 표 (D-03, UI-SPEC)", () => {
  const cases: Array<[string, Spec, string, HostKey, HostLocal?]> = [
    ["대기실 방장·시작 가능", { phase: "lobby", host: true }, "모두 모였습니다. 시작 단추를 눌러 주세요.", "lobby.ready"],
    ["대기실 방장·인원 부족", { phase: "lobby", host: true, connected: 3 }, "대기실입니다. 친구들이 모일 때까지 기다려 주세요.", "lobby.gather"],
    ["대기실 손님", { phase: "lobby", seat: 1, host: false }, "대기실입니다. 방장이 시작할 때까지 기다려 주세요.", "lobby.guest"],
    ["배정", { phase: "assigning" }, "역할을 나누고 있습니다. 잠시만 기다려 주세요.", "assigning"],
    ["역할 확인, 카드 안 봄", { phase: "roleReveal" }, "역할이 정해졌습니다. 내 역할 카드를 확인해 주세요.", "roleReveal.act", { cardSeen: false }],
    ["역할 확인, 카드 봄", { phase: "roleReveal" }, "확인하셨으면 그대로 기다려 주세요.", "roleReveal.wait", { cardSeen: true }],
    ["낮 시작 산 사람", { phase: "dayAnnounce" }, "낮이 되었습니다. 모두 모여 주세요.", "dayAnnounce.wait"],
    ["낮 시작 유령", { phase: "dayAnnounce", ghost: true }, "낮이 되었습니다. 유령은 지켜봐 주세요.", "dayAnnounce.ghost"],
    ["심부름 산 사람(시민)", { phase: "errand", role: "citizen", map: "bar", errand: ERR_PART }, "심부름 시간입니다. 빛나는 곳을 찾아 처리해 주세요.", "errand.act"],
    ["심부름 산 사람(마피아, 같은 문장)", { phase: "errand", role: "mafia", map: "bar", errand: ERR_PART }, "심부름 시간입니다. 빛나는 곳을 찾아 처리해 주세요.", "errand.act"],
    ["심부름 3곳 완료(경찰)", { phase: "errand", role: "police", map: "bar", errand: ERR_DONE }, "심부름을 마쳤습니다. 곧 토론이 시작됩니다.", "errand.done"],
    ["심부름 3곳 완료(마피아, 같은 문장)", { phase: "errand", role: "mafia", map: "bar", errand: ERR_DONE }, "심부름을 마쳤습니다. 곧 토론이 시작됩니다.", "errand.done"],
    ["심부름 유령", { phase: "errand", ghost: true }, "심부름 시간입니다. 유령은 지켜봐 주세요.", "errand.ghost"],
    ["심부름 목록 없는 산 사람", { phase: "errand", map: "bar" }, "심부름 시간입니다. 빛나는 곳을 찾아 처리해 주세요.", "errand.act"],
    ["토론 산 사람", { phase: "discussion" }, "토론 시간입니다. 의심 가는 사람을 이야기해 주세요.", "discussion.act"],
    ["토론 흔적이 있는 날, 기록 없음", { phase: "discussion", evidence: { trace: "pin" } }, "토론입니다. 같은 옷과 엇갈린 목격을 살펴보세요.", "discussion.evidence"],
    ["토론 흔적이 있는 날, 기록 있고 안 열었음 — witness 가 먼저", { phase: "discussion", evidence: { trace: "pin" }, record: REC_SOME }, "토론 시간입니다. 기록 단추로 본 것을 확인해 주세요.", "witness"],
    ["토론 흔적이 있는 날, 기록 열었음", { phase: "discussion", evidence: { trace: "pin" }, record: REC_SOME }, "토론입니다. 같은 옷과 엇갈린 목격을 살펴보세요.", "discussion.evidence", { recordOpened: true }],
    ["토론 흔적이 있는 날(마피아, 같은 문장)", { phase: "discussion", role: "mafia", evidence: { trace: "redCloth" } }, "토론입니다. 같은 옷과 엇갈린 목격을 살펴보세요.", "discussion.evidence"],
    ["토론 흔적 없고 목격만 있는 날은 discussion.act", { phase: "discussion", evidence: { seen: { seat: 1, place: "glass" } } }, "토론 시간입니다. 의심 가는 사람을 이야기해 주세요.", "discussion.act"],
    ["토론 흔적이 있는 날 유령", { phase: "discussion", ghost: true, evidence: { trace: "pin" } }, "유령은 지켜보며 유령끼리 이야기할 수 있습니다.", "discussion.ghost"],
    ["토론 유령", { phase: "discussion", ghost: true }, "유령은 지켜보며 유령끼리 이야기할 수 있습니다.", "discussion.ghost"],
    ["토론 기록 있는 산 사람(안 열었음 — 시민 시점)", { phase: "discussion", role: "citizen", record: REC_SOME }, "토론 시간입니다. 기록 단추로 본 것을 확인해 주세요.", "witness"],
    ["토론 기록 있는 산 사람(마피아, 같은 문장)", { phase: "discussion", role: "mafia", record: REC_SOME }, "토론 시간입니다. 기록 단추로 본 것을 확인해 주세요.", "witness"],
    ["토론 기록 줄 0개(빈 배열도 기록이 있다)", { phase: "discussion", record: [] }, "토론 시간입니다. 기록 단추로 본 것을 확인해 주세요.", "witness"],
    ["토론 기록 열었음", { phase: "discussion", record: REC_SOME }, "토론 시간입니다. 의심 가는 사람을 이야기해 주세요.", "discussion.act", { recordOpened: true }],
    ["토론 기록 없음(못 마친 사람)", { phase: "discussion" }, "토론 시간입니다. 의심 가는 사람을 이야기해 주세요.", "discussion.act"],
    ["토론 유령은 기록이 있어도 ghost", { phase: "discussion", ghost: true, record: REC_SOME }, "유령은 지켜보며 유령끼리 이야기할 수 있습니다.", "discussion.ghost"],
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
    ["밤 마피아", { phase: "night", role: "mafia" }, "밤이 되었습니다. 없앨 사람의 얼굴을 눌러 주세요.", "night.mafia"],
    ["밤 경찰", { phase: "night", role: "police" }, "밤이 되었습니다. 조사할 사람의 얼굴을 눌러 주세요.", "night.police"],
    ["밤 의사", { phase: "night", role: "doctor" }, "밤이 되었습니다. 지킬 사람의 얼굴을 눌러 주세요.", "night.doctor"],
    ["밤 시민", { phase: "night", role: "citizen" }, "밤이 되었습니다. 한 명의 얼굴을 눌러 주세요.", "night.citizen"],
    ["밤 유령", { phase: "night", role: "police", ghost: true }, "밤이 되었습니다. 모두의 밤 행동을 지켜봐 주세요.", "night.ghost"],
    ["아침 피해자", { phase: "morning", morning: { eliminated: 2 } }, "아침이 밝았습니다. 민지 님이 당했습니다.", "morning"],
    ["아침 구출", { phase: "morning", morning: { saved: true } }, "아침이 밝았습니다. 누군가 살아났습니다.", "morning"],
    ["아침 무사", { phase: "morning", morning: {} }, "아침이 밝았습니다. 아무 일도 없었습니다.", "morning"],
    ["아침 유령(같은 문장)", { phase: "morning", morning: {}, ghost: true }, "아침이 밝았습니다. 아무 일도 없었습니다.", "morning"],
    ["아침 흔적 구간(모두에게 같은 문장)", { phase: "morning", morning: { eliminated: 2, trace: "pin" } }, "흔적이 남았습니다. 같은 옷을 입은 사람을 표시했습니다.", "trace", { traceOn: true }],
    ["아침 흔적 구간 유령(같은 문장)", { phase: "morning", morning: { eliminated: 2, trace: "pin" }, ghost: true }, "흔적이 남았습니다. 같은 옷을 입은 사람을 표시했습니다.", "trace", { traceOn: true }],
    ["아침 흔적 구간 전(피해자 문장)", { phase: "morning", morning: { eliminated: 2, trace: "pin" } }, "아침이 밝았습니다. 민지 님이 당했습니다.", "morning", { traceOn: false }],
    ["아침 흔적 없는 아침은 traceOn 이어도 morning", { phase: "morning", morning: { eliminated: 2 } }, "아침이 밝았습니다. 민지 님이 당했습니다.", "morning", { traceOn: true }],
    ["아침 구출은 traceOn 이어도 morning", { phase: "morning", morning: { saved: true } }, "아침이 밝았습니다. 누군가 살아났습니다.", "morning", { traceOn: true }],
    ["결과", { phase: "ended", endsAt: null }, "게임이 끝났습니다. 다음 판을 준비해 주세요.", "ended"],
  ];

  it.each(cases)("%s", (_label: string, spec: Spec, line: string, key: HostKey, local?: HostLocal) => {
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

  it("예약 키는 이제 없다: errand·witness·trace·discussion.evidence 모두 채워졌고 UI-SPEC 원문이다 (15-07·16-09)", () => {
    expect(HOST_LINES.witness).toBe("토론 시간입니다. 기록 단추로 본 것을 확인해 주세요.");
    expect(HOST_LINES.trace).toBe("흔적이 남았습니다. 같은 옷을 입은 사람을 표시했습니다.");
    expect(HOST_LINES["discussion.evidence"]).toBe("토론입니다. 같은 옷과 엇갈린 목격을 살펴보세요.");
    expect(Object.keys(HOST_LINES)).not.toContain("errand");
    for (const key of Object.keys(HOST_LINES) as HostKey[]) expect(HOST_LINES[key]).not.toBe("");
    expect(new Set(matrixKeys())).toContain("witness");
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
      { phase: "errand", map: "bar", errand: { places: ["glass", "piano", "sax"], done: ["piano"] } },
      { phase: "errand", map: "bar", errand: { places: ["glass", "piano", "sax"], done: ["glass", "piano", "sax"] } },
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

  it("심부름: 반경 안이면 tool errand, 반경 밖이면 가장 가까운 미완료 place, 위치를 모르면 첫 미완료 place", () => {
    const v = makeView({ phase: "errand", map: "bar", errand: { places: ["glass", "piano", "sax"], done: [] } });
    // glass (-3.9,-2.2) · piano (-2.6,-5.6) · sax (-0.2,-5.2)
    expect(callTargetsOf(v, { pos: { x: -3.9, z: -2.2 } })).toEqual({ kind: "tool", tool: "errand" });
    expect(callTargetsOf(v, { pos: { x: -3.9, z: -1.5 } })).toEqual({ kind: "tool", tool: "errand" });
    expect(callTargetsOf(v, { pos: { x: -5, z: 3 } })).toEqual({ kind: "place", id: "glass" });
    expect(callTargetsOf(v, { pos: { x: 3, z: 0 } })).toEqual({ kind: "place", id: "sax" });
    expect(callTargetsOf(v, { pos: { x: 0, z: -5 } })).toEqual({ kind: "tool", tool: "errand" }); // sax 반경 안
    expect(callTargetsOf(v, { pos: { x: 1.5, z: -3 } })).toEqual({ kind: "place", id: "sax" });
    expect(callTargetsOf(v, { pos: null })).toEqual({ kind: "place", id: "glass" });
    expect(callTargetsOf(v, {})).toEqual({ kind: "place", id: "glass" });
  });

  it("심부름: 처리한 곳 곁이면 빛은 다른 미완료 place 로 간다", () => {
    const v = makeView({ phase: "errand", map: "bar", errand: { places: ["glass", "piano", "sax"], done: ["glass"] } });
    expect(callTargetsOf(v, { pos: { x: -3.9, z: -2.2 } })).toEqual({ kind: "place", id: "piano" });
    expect(callTargetsOf(v, { pos: null })).toEqual({ kind: "place", id: "piano" });
  });

  it("심부름: view.map 없음·목록 없음 → null, 3곳 완료·유령 → null", () => {
    expect(callTargetsOf(makeView({ phase: "errand", errand: ERR_PART }), { pos: { x: 0, z: 0 } })).toBeNull();
    expect(callTargetsOf(makeView({ phase: "errand", map: "bar" }), { pos: { x: 0, z: 0 } })).toBeNull();
    expect(callTargetsOf(makeView({ phase: "errand", map: "bar", errand: { places: [], done: [] } }), { pos: null })).toBeNull();
    expect(callTargetsOf(makeView({ phase: "errand", map: "bar", errand: ERR_DONE }), { pos: { x: -3.9, z: -2.2 } })).toBeNull();
    expect(callTargetsOf(makeView({ phase: "errand", ghost: true, map: "bar" }), { pos: { x: -3.9, z: -2.2 } })).toBeNull();
  });

  it("심부름 빛남 대상은 역할과 무관하다(마피아·시민이 같은 대상)", () => {
    for (const pos of [null, { x: -3.9, z: -2.2 }, { x: 3, z: 0 }]) {
      const targets = (["mafia", "police", "doctor", "citizen"] as RoleId[]).map((role) => JSON.stringify(callTargetsOf(makeView({ phase: "errand", role, map: "bar", errand: ERR_PART }), { pos })));
      expect(new Set(targets).size).toBe(1);
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
    expect(timed("errand", 40_000)).toBe(true); // 15-04: 심부름은 TIMELESS 가 아니라 막대·숫자 행이 있다(U-15)
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

  it("15-04: 낮 시작 → 심부름은 울리지 않고, 심부름 → 토론은 울린다(fresh 면 아님), 낮 시작 → 토론은 그대로 무음", () => {
    expect(hostChimeOf("dayAnnounce", "errand", false)).toBe(false);
    expect(hostChimeOf("errand", "discussion", false)).toBe(true);
    expect(hostChimeOf("errand", "discussion", true)).toBe(false);
    expect(hostChimeOf("dayAnnounce", "discussion", false)).toBe(false);
    expect(hostChimeOf("discussion", "nomination", false)).toBe(true);
  });

  it("17-07(0080-14): tutorial 로 들어가는 전환·tutorial 에서 나가는 전환은 울리지 않는다(띠가 둘이 되지 않게), 기존 기대는 그대로", () => {
    expect(hostChimeOf("lobby", "tutorial", false)).toBe(false);
    expect(hostChimeOf("tutorial", "assigning", false)).toBe(false);
    expect(hostChimeOf("tutorial", "roleReveal", false)).toBe(false);
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
  // 15-07: 내 목격 기록은 있는지(불리언)만 본다. 줄 내용(me.record[].seat·place)은 읽지 않는다 — 아래 시험이 고정한다
  "me.record",
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
  // 15-04: 내 심부름 목록·진행과 이번 판의 맵 id(공개) — 내 view 의 값뿐이다
  "map",
  "me.errand",
  "me.errand.places",
  "me.errand.places[]",
  "me.errand.done",
  "me.errand.done[]",
  // 16-09: 흔적이 있는 날 토론 문구 — day.evidence.trace 의 유무(모두에게 같은 공개 값)만 본다. seen·조각 값은 읽지 않는다(아래 시험)
  "day.evidence",
  "day.evidence.trace",
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

const MATRIX_PHASES: readonly PhaseId[] = ["lobby", "assigning", "roleReveal", "dayAnnounce", "errand", "discussion", "nomination", "runoff", "showdown", "defense", "verdict", "execution", "night", "morning", "ended"];

/** 단계 14개 × 시점(마피아·경찰·의사·시민 산 사람, 유령, 방장/손님, 변론자 본인) */
function matrixSpecs(): Spec[] {
  const out: Spec[] = [];
  for (const phase of MATRIX_PHASES) {
    const base: Spec = { phase, candidate: 1, passed: true, morning: { eliminated: 2, trace: "pin" }, evidence: { trace: "pin" }, map: "bar", errand: ERR_PART };
    for (const role of ["mafia", "police", "doctor", "citizen"] as RoleId[]) out.push({ ...base, role }, { ...base, role, record: REC_SOME });
    out.push({ ...base, ghost: true, record: REC_SOME }, { ...base, record: [] });
    out.push({ ...base, ghost: true });
    out.push({ ...base, host: true });
    out.push({ ...base, seat: 1, host: false, candidate: 1 });
    out.push({ ...base, seat: 1, candidate: 1 }); // 변론자 본인
    if (phase === "errand") out.push({ ...base, role: "mafia", errand: ERR_DONE }, { ...base, role: "citizen", errand: ERR_DONE }, { ...base, ghost: true, errand: undefined });
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

/** 15-07: 클라이언트 상태 recordOpened·traceOn 의 모든 조합 */
const FLAGS: ReadonlyArray<Pick<HostLocal, "recordOpened" | "traceOn">> = [{}, { recordOpened: false, traceOn: false }, { recordOpened: true }, { traceOn: true }, { recordOpened: true, traceOn: true }];

/** 내 월드 좌표(클라이언트 상태)의 시점: 모름·장소 위·장소 밖 */
const POSES: ReadonlyArray<HostLocal["pos"]> = [undefined, null, { x: -3.9, z: -2.2 }, { x: 5, z: 5 }];

describe("HOST-05 허용 목록만 읽는다 (T-14-01)", () => {
  it("단계 15개 × 시점마다 hostLineOf·hostKeyOf·callTargetsOf 가 읽은 경로가 모두 허용 목록 안이다", () => {
    const outside = new Set<string>();
    for (const spec of matrixSpecs()) {
      for (const cardSeen of [false, true]) {
        for (const pos of POSES) {
          for (const flags of FLAGS) {
            const log = new Set<string>();
            const view = recorder(makeView({ ...spec, noise: true }), log) as RoomView;
            hostLineOf(view, { cardSeen, pos, ...flags });
            hostKeyOf(view, { cardSeen, pos, ...flags });
            callTargetsOf(view, { cardSeen, pos, ...flags });
            hostTimeOf(view);
            for (const path of log) if (!isAllowed(path)) outside.add(path);
          }
        }
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
        for (const pos of POSES) {
          for (const flags of FLAGS) {
            const plain = makeView(spec);
            const noisy = makeView({ ...spec, noise: true });
            const local = { cardSeen, pos, ...flags };
            expect(hostLineOf(noisy, local)).toBe(hostLineOf(plain, local));
            expect(hostKeyOf(noisy, local)).toBe(hostKeyOf(plain, local));
            expect(callTargetsOf(noisy, local)).toEqual(callTargetsOf(plain, local));
            expect(hostTimeOf(noisy)).toBe(hostTimeOf(plain));
          }
        }
      }
    }
  });

  it("심부름 단계의 키·문장·대상은 역할(me.role)을 읽지 않는다: 역할을 지운 view 와 같다", () => {
    for (const errand of [ERR_PART, ERR_DONE]) {
      for (const pos of POSES) {
        const roles = (["mafia", "police", "doctor", "citizen"] as RoleId[]).map((role) => makeView({ phase: "errand", role, map: "bar", errand }));
        const noRole = makeView({ phase: "errand", role: null, map: "bar", errand });
        for (const v of roles) {
          expect(hostKeyOf(v, { pos })).toBe(hostKeyOf(noRole, { pos }));
          expect(hostLineOf(v, { pos })).toBe(hostLineOf(noRole, { pos }));
          expect(callTargetsOf(v, { pos })).toEqual(callTargetsOf(noRole, { pos }));
        }
      }
    }
  });

  it("심부름 단계가 읽은 경로: 허용 목록 중 me.errand.*·map 과 기본 값뿐이고 me.role 은 읽지 않는다", () => {
    const log = new Set<string>();
    const view = recorder(makeView({ phase: "errand", role: "mafia", map: "bar", errand: ERR_PART, noise: true }), log) as RoomView;
    hostLineOf(view, { pos: { x: 0, z: 0 } });
    hostKeyOf(view, { pos: { x: 0, z: 0 } });
    callTargetsOf(view, { pos: { x: 0, z: 0 } });
    expect([...log].filter((p) => !isAllowed(p))).toEqual([]);
    expect(log.has("me.role")).toBe(false);
    expect(log.has("me.errand.places[]")).toBe(true);
    expect(log.has("map")).toBe(true);
  });
});

describe("15-07 목격 기록·흔적 분기 (D-04, D-06, T-15-27)", () => {
  const DISCUSS = { phase: "discussion" as const, record: REC_SOME };

  it("witness 는 기록이 있다는 사실만 본다: 줄 내용(seat·place)·줄 수가 달라도 같은 키·문장·대상", () => {
    const a = makeView({ ...DISCUSS });
    const b = makeView({ phase: "discussion", record: [{ seat: 3, place: "door" }] });
    const c = makeView({ phase: "discussion", record: [] });
    for (const v of [b, c]) {
      expect(hostKeyOf(v)).toBe(hostKeyOf(a));
      expect(hostLineOf(v)).toBe(hostLineOf(a));
      expect(callTargetsOf(v)).toEqual(callTargetsOf(a));
    }
  });

  it("기록의 내용(me.record[]·seat·place)은 읽지 않고 me.record 의 유무와 day.morning.trace 의 유무만 읽는다", () => {
    for (const spec of [{ ...DISCUSS, role: "mafia" as RoleId }, { ...DISCUSS, role: "citizen" as RoleId }, { phase: "morning" as const, morning: { eliminated: 2, trace: "pin" as const } }]) {
      const log = new Set<string>();
      const view = recorder(makeView(spec), log) as RoomView;
      hostLineOf(view, { traceOn: true });
      hostKeyOf(view, { traceOn: true });
      callTargetsOf(view, { traceOn: true });
      expect([...log].filter((p) => p.startsWith("me.record") && p !== "me.record")).toEqual([]);
      expect(log.has("me.role")).toBe(false);
    }
    const log = new Set<string>();
    hostKeyOf(recorder(makeView(DISCUSS), log) as RoomView);
    expect(log.has("me.record")).toBe(true);
    const log2 = new Set<string>();
    hostKeyOf(recorder(makeView({ phase: "morning", morning: { eliminated: 2, trace: "pin" } }), log2) as RoomView, { traceOn: true });
    expect(log2.has("day.morning.trace")).toBe(true);
  });

  it("역할을 지운 view 와 같다(토론 witness·아침 trace 는 me.role 을 읽지 않는다)", () => {
    for (const role of ["mafia", "police", "doctor", "citizen"] as RoleId[]) {
      const withRole = makeView({ ...DISCUSS, role });
      const noRole = makeView({ ...DISCUSS, role: null });
      expect(hostKeyOf(withRole)).toBe(hostKeyOf(noRole));
      const m = { phase: "morning" as const, morning: { eliminated: 2, trace: "pin" as const } };
      expect(hostKeyOf(makeView({ ...m, role }), { traceOn: true })).toBe(hostKeyOf(makeView({ ...m, role: null }), { traceOn: true }));
    }
  });

  it("빛남 대상: witness → tool record, 연 뒤 discussion.act → tool chat, trace·morning → null", () => {
    expect(callTargetsOf(makeView(DISCUSS))).toEqual({ kind: "tool", tool: "record" });
    expect(callTargetsOf(makeView(DISCUSS), { recordOpened: true })).toEqual({ kind: "tool", tool: "chat" });
    expect(callTargetsOf(makeView({ phase: "discussion" }))).toEqual({ kind: "tool", tool: "chat" });
    expect(callTargetsOf(makeView({ phase: "discussion", ghost: true, record: REC_SOME }))).toBeNull();
    const m = { phase: "morning" as const, morning: { eliminated: 2, trace: "pin" as const } };
    expect(callTargetsOf(makeView(m), { traceOn: true })).toBeNull();
    expect(callTargetsOf(makeView(m), { traceOn: false })).toBeNull();
  });

  it("기록은 토론 밖 단계의 키를 바꾸지 않는다(errand·nomination·night 에서 record 가 있어도 같다)", () => {
    for (const phase of ["errand", "nomination", "night", "dayAnnounce"] as PhaseId[]) {
      const base = { phase, role: "citizen" as RoleId, map: "bar" as const, errand: ERR_PART };
      expect(hostKeyOf(makeView({ ...base, record: REC_SOME }))).toBe(hostKeyOf(makeView(base)));
    }
  });

  it("같은 단계 안 문장 변화(witness → discussion.act, morning → trace)는 알림음이 없다", () => {
    expect(hostChimeOf("discussion", "discussion", false)).toBe(false);
    expect(hostChimeOf("morning", "morning", false)).toBe(false);
  });

  it("witness·trace·discussion.evidence 문구는 36자 이하이고 역할 단어가 없다", () => {
    for (const k of ["witness", "trace", "discussion.evidence"] as const) {
      const t = HOST_LINES[k] as string;
      expect(t.length).toBeLessThanOrEqual(36);
      for (const w of ["마피아", "경찰", "의사", "시민", "범인", "증거", "확정"]) expect(t).not.toContain(w);
    }
  });
});

describe("16-09 discussion.evidence (D-11, EVID-03, T-16-21)", () => {
  const EV = { phase: "discussion" as const, evidence: { trace: "pin" as const, seen: { seat: 2, place: "piano" as const } } };

  it("day.evidence.trace 의 유무만 읽고 조각 값·seen·look·me.role·me.records 는 읽지 않는다", () => {
    for (const role of ["mafia", "citizen"] as RoleId[]) {
      for (const local of [{}, { recordOpened: true }]) {
        const log = new Set<string>();
        const view = recorder(makeView({ ...EV, role, noise: true }), log) as RoomView;
        hostKeyOf(view, local);
        hostLineOf(view, local);
        callTargetsOf(view, local);
        expect(log.has("day.evidence.trace")).toBe(true);
        expect([...log].filter((p) => p.startsWith("day.evidence") && p !== "day.evidence" && p !== "day.evidence.trace")).toEqual([]);
        expect([...log].filter((p) => p.includes("look") || p.includes("records"))).toEqual([]);
        expect(log.has("me.role")).toBe(false);
      }
    }
  });

  it("조각 값·목격자가 달라도 같은 키·문장이고, 마피아·시민·역할 없음이 같다", () => {
    const a = makeView({ ...EV, role: "mafia" });
    for (const v of [makeView({ ...EV, role: "citizen" }), makeView({ ...EV, role: null }), makeView({ phase: "discussion", evidence: { trace: "redCloth" } })]) {
      expect(hostKeyOf(v)).toBe("discussion.evidence");
      expect(hostLineOf(v)).toBe(hostLineOf(a));
    }
  });

  it("빛남 대상은 discussion.act 와 같다: 채팅 단추", () => {
    expect(callTargetsOf(makeView(EV))).toEqual({ kind: "tool", tool: "chat" });
    expect(callTargetsOf(makeView({ ...EV, ghost: true }))).toBeNull();
  });

  it("흔적이 있는 날이어도 토론 밖 단계 키는 바뀌지 않는다", () => {
    for (const phase of ["nomination", "defense", "verdict", "dayAnnounce"] as PhaseId[]) {
      const base = { phase, role: "citizen" as RoleId, candidate: 1 };
      expect(hostKeyOf(makeView({ ...base, evidence: { trace: "pin" } }))).toBe(hostKeyOf(makeView(base)));
    }
  });

  it("문구에 '범인'·'증거'·'확정'·색 이름이 없다", () => {
    for (const k of ["trace", "discussion.evidence"] as const) for (const w of ["범인", "증거", "확정", "빨간", "붉은", "검은"]) expect(HOST_LINES[k] as string).not.toContain(w);
  });
});
