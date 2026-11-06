// 낮 처형 화면 연출 순수 모듈 시험 — DAY-04·05·06, 결정 0049·0053·0060, 08-UI-SPEC.
// 서버 view 두 개의 공개 정보 차이에서만 채팅 줄·위 알림·결과 알림·연출 이벤트가 나온다.
// 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 JSON 문자열로 한다.
import { describe, expect, it } from "vitest";
import type { DayView, PhaseId, PickTurnView, PublicPlayer, RoomView, ShowdownView } from "../../shared/protocol";
import { EXECUTION_MS, VERDICT_LEAD_MS } from "../../shared/game/phases";
import {
  ANNOUNCE_DAY_MS,
  ANNOUNCE_EXEC_MS,
  ANNOUNCE_LEAD_MS,
  ANNOUNCE_MORNING_AT,
  ANNOUNCE_MORNING_MS,
  ANNOUNCE_NIGHT_MS,
  ANNOUNCE_NOEXEC_MS,
  ANNOUNCE_POLICE_AT,
  ANNOUNCE_POLICE_MS,
  ANNOUNCE_TALLY_MS,
  ANNOUNCE_VICTIM_AT,
  ANNOUNCE_VICTIM_MS,
  dayEvents,
  GHOST_FADE_END_MS,
  GHOST_RISE_MS,
  headerFor,
  POLICE_CARD_AT,
  pointsTally,
  policeResultOf,
} from "../../src/game/dayView";
import type { DayEvents } from "../../src/game/dayView";

// TAP 의 YAML 진단이 깨지지 않도록 따옴표 없는 한 줄 문자열로 만들어 비교한다.
const flat = (value: unknown): string => JSON.stringify(value).replaceAll('"', "");
const same = (actual: unknown, expected: unknown) => expect(flat(actual)).toBe(flat(expected));

const NAMES = ["서연", "민준", "도윤", "지호", "하윤"];

const pl = (seat: number, nickname: string, alive = true): PublicPlayer => ({
  seat,
  nickname,
  connected: true,
  isHost: seat === 0,
  ...(alive ? {} : { alive: false }),
});

interface ViewOpts {
  players?: PublicPlayer[];
  day?: Partial<DayView>;
  mySeat?: number;
}

/** 다섯 명(서연·민준·도윤·지호·하윤, seat 0~4)이 앉은 낮 view. day 는 n=1 에 덮어쓴다. */
function viewOf(phase: PhaseId, opts: ViewOpts = {}): RoomView {
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players: opts.players ?? NAMES.map((name, seat) => pl(seat, name)),
    me: { seat: opts.mySeat ?? 0, isHost: false },
    day: { n: 1, roles: [], ...opts.day },
  };
}

/** 지목 단계 view — pairs 는 [누가, 누구를]. */
const nominationOf = (pairs: [number, number][], opts: ViewOpts = {}): RoomView =>
  viewOf("nomination", { ...opts, day: { points: pairs.map(([seat, target]) => ({ seat, target })), ...opts.day } });

describe("pointsTally — 지목 집계(공개 정보만)", () => {
  it("3명 표가 2명에게 2:1 이면 많은 쪽이 선두", () => {
    const tally = pointsTally(nominationOf([[1, 2], [3, 2], [4, 0]]));
    same(tally.counts, { 0: 1, 2: 2 });
    expect(tally.leader).toBe(2);
  });

  it("2:2 동점이면 선두가 없다", () => {
    const tally = pointsTally(nominationOf([[1, 2], [3, 2], [4, 0], [2, 0]]));
    same(tally.counts, { 0: 2, 2: 2 });
    expect(tally.leader).toBeUndefined();
  });

  it("0표면 비어 있고 선두가 없다", () => {
    const tally = pointsTally(nominationOf([]));
    same(tally.counts, {});
    expect(tally.leader).toBeUndefined();
  });

  it("지목 단계가 아닌 view 의 points 는 읽지 않는다", () => {
    const stale = viewOf("defense", { day: { points: [{ seat: 1, target: 2 }] } });
    same(pointsTally(stale).counts, {});
  });
});

describe("dayEvents — 지목 차이 (DAY-04)", () => {
  it("새 지목은 vote 줄 '민준 → 도윤' 한 줄만 만든다 (위 알림 재료 없음)", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[1, 2]]));
    same(events.lines, [{ kind: "vote", text: "민준 → 도윤" }]);
    expect("toasts" in events).toBe(false);
    same(events.announces, []);
    same(events.fx, []);
  });

  it("같은 대상을 다시 보낸 것(변화 없음)은 줄이 없다", () => {
    const events = dayEvents(nominationOf([[1, 2]]), nominationOf([[1, 2]]));
    same(events.lines, []);
  });

  it("이전 view 가 없으면(첫 스냅샷·재접속) 이벤트가 없다", () => {
    const events = dayEvents(null, nominationOf([[1, 2]]));
    same(events.lines, []);
    same(events.announces, []);
    same(events.fx, []);
  });

  it("reset 옵션(epoch 가 바뀐 첫 스냅샷)도 이벤트가 없다", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[1, 2], [3, 2]]), { reset: true });
    same(events.lines, []);
  });

  it("닉네임에 HTML 이 있어도 문자열 그대로 둔다", () => {
    const players = [pl(0, "서연"), pl(1, "<b>민준</b>"), pl(2, "도윤"), pl(3, "지호"), pl(4, "하윤")];
    const events = dayEvents(nominationOf([], { players }), nominationOf([[1, 2]], { players }));
    expect(events.lines[0]!.text).toBe("<b>민준</b> → 도윤");
  });

  it("앉은 사람 목록에 없는 seat 의 지목은 vote 줄 없이 건너뛴다(득표 집계에는 남는다)", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[9, 2]]));
    same(events.lines.filter((l) => l.kind === "vote"), []);
  });

  it("지목 줄 순서는 좌석 오름차순(서버 view 순서와 무관)", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[3, 2], [1, 2]]));
    same(events.lines.filter((l) => l.kind === "vote").map((l) => l.text), ["민준 → 도윤", "지호 → 도윤"]);
  });
});

describe("순차 지목 채팅 줄 (0063-1)", () => {
  const ORDER = [0, 1, 2, 3, 4];
  const turnView = (turn: PickTurnView, pairs: [number, number][] = [], opts: ViewOpts = {}): RoomView =>
    nominationOf(pairs, { ...opts, day: { turn, ...opts.day } });
  const running = (i: number, extra: Partial<PickTurnView> = {}): PickTurnView => ({ order: ORDER, i, endsAt: 8_000, ...extra });

  it("선두가 새로 생겨도 '앞서요' 줄이 없다", () => {
    const events = dayEvents(turnView(running(1, { doneAt: 1 }), []), turnView(running(1, { doneAt: 1 }), [[1, 2]]));
    same(events.lines, [{ kind: "vote", text: "민준 → 도윤" }]);
  });

  it("과반에 닿아도 '과반' 줄이 없다", () => {
    const events = dayEvents(turnView(running(4), [[1, 2], [3, 2]]), turnView(running(4, { doneAt: 2 }), [[1, 2], [3, 2], [4, 2]]));
    same(events.lines, [{ kind: "vote", text: "하윤 → 도윤" }]);
    expect(events.lines.some((l) => l.kind === "hot")).toBe(false);
  });

  it("지금 차례가 새로 기권이 되면 vote 줄 '{이름} · 기권'", () => {
    const events = dayEvents(turnView(running(2)), turnView(running(2, { doneAt: 8_000, skip: true })));
    same(events.lines, [{ kind: "vote", text: "도윤 · 기권" }]);
  });

  it("이미 기권인 차례가 다시 와도(같은 차례) 줄을 반복하지 않는다", () => {
    const skipped = running(2, { doneAt: 8_000, skip: true });
    same(dayEvents(turnView(skipped), turnView(skipped)).lines, []);
  });

  it("기권이 아닌 확정(지목)에는 기권 줄이 없다", () => {
    const events = dayEvents(turnView(running(2)), turnView(running(2, { doneAt: 3_000 }), [[2, 3]]));
    same(events.lines, [{ kind: "vote", text: "도윤 → 지호" }]);
  });

  it("모이기 → 첫 차례 같은 단계 안 이동은 줄이 없다", () => {
    same(dayEvents(turnView({ order: ORDER, i: -1 }), turnView(running(0))).lines, []);
  });

  it("토론 → 지목은 시스템 줄 '지목 시작'", () => {
    same(dayEvents(viewOf("discussion"), turnView({ order: ORDER, i: -1 })).lines, [{ kind: "system", text: "지목 시작" }]);
  });

  it("첫 스냅샷·reset 은 기권 줄도 만들지 않는다", () => {
    const skipped = turnView(running(2, { doneAt: 8_000, skip: true }));
    same(dayEvents(null, skipped).lines, []);
    same(dayEvents(turnView(running(2)), skipped, { reset: true }).lines, []);
  });

  it("role·spectate 를 넣어도 줄이 같다", () => {
    const a = turnView(running(2));
    const b = turnView(running(2, { doneAt: 8_000, skip: true }));
    const priv = (v: RoomView) => ({ ...v, me: { ...v.me, role: "mafia" }, spectate: { seats: [] } }) as unknown as RoomView;
    expect(JSON.stringify(dayEvents(priv(a), priv(b)).lines)).toBe(JSON.stringify(dayEvents(a, b).lines));
  });
});

// ---- 단계 진입 이벤트 (DAY-05·06, 결정 0060-5) ----
const ROLE_WORDS = ["마피아", "시민", "경찰", "의사"];
const text = (e: DayEvents): string => JSON.stringify([e.lines, e.announces, e.fx]);

/** 지목 마감 뒤 voteLog 한 줄 — 5명 중 4명이 seat 3 을 가리켰다. */
const VOTE_LOG = [
  {
    n: 1,
    exec: { yes: 0, no: 0, passed: false },
    cand: {
      votes: [
        { seat: 0, target: 3 },
        { seat: 1, target: 3 },
        { seat: 2, target: 3 },
        { seat: 4, target: 3 },
        { seat: 3, target: 0 },
      ],
      candidate: 3,
    },
  },
];
const defenseView = (extra: ViewOpts = {}) =>
  viewOf("defense", { ...extra, day: { candidate: 3, voteLog: VOTE_LOG, ...extra.day } });
const verdictView = (extra: ViewOpts = {}) =>
  viewOf("verdict", { ...extra, day: { candidate: 3, voteLog: VOTE_LOG, ...extra.day } });
const executionView = (yes: number, no: number, passed: boolean, extra: ViewOpts = {}) =>
  viewOf("execution", { ...extra, day: { candidate: 3, voteLog: VOTE_LOG, verdict: { yes, no, passed }, ...extra.day } });

describe("dayEvents — 단계 진입 줄 (DAY-05·06)", () => {
  it("낮 토론 → 지목: system '지목 시작'", () => {
    const events = dayEvents(viewOf("discussion"), nominationOf([]));
    same(events.lines, [{ kind: "system", text: "지목 시작" }]);
    same(events.announces, []);
  });

  it("지목 → 최후 변론: hot '{이름} 님 {N}표 · 최후 변론' 의 N 은 그날 voteLog 에서 변론자를 가리킨 수 (가정 A2)", () => {
    const events = dayEvents(nominationOf([]), defenseView());
    same(events.lines, [{ kind: "hot", text: "지호 님 4표 · 최후 변론" }]);
  });

  it("voteLog 줄이 없으면 이전 지목 집계의 표 수를 쓴다", () => {
    const prev = nominationOf([[0, 3], [1, 3], [2, 3]]);
    const events = dayEvents(prev, viewOf("defense", { day: { candidate: 3 } }));
    same(events.lines, [{ kind: "hot", text: "지호 님 3표 · 최후 변론" }]);
  });

  it("변론자 정보가 없으면 줄을 만들지 않는다", () => {
    same(dayEvents(nominationOf([]), viewOf("defense")).lines, []);
  });

  it("최후 변론 → 찬반: system '찬반 시작'", () => {
    same(dayEvents(defenseView(), verdictView()).lines, [{ kind: "system", text: "찬반 시작" }]);
  });

  it("낮 시작: system '{N}일차' 와 결과 알림 '낮이 되었습니다'", () => {
    const events = dayEvents(viewOf("morning", { day: { n: 1 } }), viewOf("dayAnnounce", { day: { n: 2 } }));
    same(events.lines, [{ kind: "system", text: "2일차" }]);
    same(events.announces, [{ text: "낮이 되었습니다", at: 0, ms: ANNOUNCE_DAY_MS }]);
  });

  it("낮 시작 → 낮 토론, 아침·로비로 갈 때는 줄이 없다", () => {
    same(dayEvents(viewOf("dayAnnounce"), viewOf("discussion")).lines, []);
    same(dayEvents(viewOf("morning"), viewOf("lobby")).lines, []);
  });
});

describe("dayEvents — 찬반 결과·처형·처형 없음 (DAY-06)", () => {
  it("찬반 → 처형(통과): 0.6초에 '찬성 5 · 반대 2', 2.6초에 '{이름} 님 처형' 알림과 유령 떠오름 (판결 앞머리 0.6초, 결정 0066-7)", () => {
    const events = dayEvents(verdictView(), executionView(5, 2, true));
    same(events.lines, [
      { kind: "hot", text: "찬성 5 · 반대 2", at: 600 },
      { kind: "hot", text: "지호 님 처형", at: 2600 },
    ]);
    same(events.announces, [
      { text: "찬성 5 · 반대 2", at: 600, ms: 2000 },
      { text: "지호 님 처형", at: 2600, ms: 3000 },
    ]);
    same(events.fx, [{ kind: "ghostRise", seat: 3, at: 2600 }]);
  });

  it("찬반 → 처형(부결): 0.6초 득표, 2.6초에 system '처형 없음' 과 1.4초 알림, 연출 없음", () => {
    const events = dayEvents(verdictView(), executionView(2, 5, false));
    same(events.lines, [
      { kind: "hot", text: "찬성 2 · 반대 5", at: 600 },
      { kind: "system", text: "처형 없음", at: 2600 },
    ]);
    same(events.announces, [
      { text: "찬성 2 · 반대 5", at: 600, ms: 2000 },
      { text: "처형 없음", at: 2600, ms: 1400 },
    ]);
    same(events.fx, []);
  });

  it("마지막 3인 처형(day.verdict.last): 득표 줄·알림 없이 0초에 '{이름} 님 처형' 3.0초, 유령은 0초 (결정 0066-5)", () => {
    const last = executionView(0, 0, true, { day: { verdict: { yes: 0, no: 0, passed: true, last: true } } });
    const events = dayEvents(verdictView(), last);
    same(events.lines, [{ kind: "hot", text: "지호 님 처형", at: 0 }]);
    same(events.announces, [{ text: "지호 님 처형", at: 0, ms: 3000 }]);
    same(events.fx, [{ kind: "ghostRise", seat: 3, at: 0 }]);
  });

  it("지목 → 밤(동률·0표): 즉시 system '처형 없음' 과 1.4초 알림, 이어 1.4초에 '밤이 되었습니다' 1.6초", () => {
    for (const reason of ["tie", "noVotes"] as const) {
      const events = dayEvents(nominationOf([[0, 1], [1, 0]]), viewOf("night", { day: { noExecution: { reason } } }));
      same(events.lines, [{ kind: "system", text: "처형 없음" }]);
      same(events.announces, [
        { text: "처형 없음", at: 0, ms: 1400 },
        { text: "밤이 되었습니다", at: 1400, ms: 1600 },
      ]);
      same(events.fx, []);
    }
  });

  it("처형 → 밤은 처형이 이미 알렸으므로 줄이 없고, 알림은 0초에 '밤이 되었습니다' 1.6초 하나다", () => {
    const events = dayEvents(executionView(5, 2, true), viewOf("night", { day: { candidate: 3 } }));
    same(events.lines, []);
    same(events.announces, [{ text: "밤이 되었습니다", at: 0, ms: 1600 }]);
    expect(ANNOUNCE_NIGHT_MS).toBe(1600);
  });

  it("부결 처형 → 밤도 '밤이 되었습니다' 알림 하나", () => {
    same(dayEvents(executionView(2, 5, false), viewOf("night")).announces, [{ text: "밤이 되었습니다", at: 0, ms: 1600 }]);
  });

  it("첫 스냅샷·reset 인 밤은 알림이 없다", () => {
    same(dayEvents(null, viewOf("night")).announces, []);
    same(dayEvents(executionView(5, 2, true), viewOf("night"), { reset: true }).announces, []);
  });

  it("첫 스냅샷이 처형 단계면 줄·알림·연출이 없다", () => {
    const events = dayEvents(null, executionView(5, 2, true));
    same([events.lines, events.announces, events.fx], [[], [], []]);
  });

  it("reset 인 처형 스냅샷도 이벤트가 없다", () => {
    const events = dayEvents(verdictView(), executionView(5, 2, true), { reset: true });
    same([events.lines, events.announces, events.fx], [[], [], []]);
  });
});

describe("dayEvents — 공개 정보만 (T-08-22)", () => {
  const withPrivate = (v: RoomView): RoomView =>
    ({
      ...v,
      me: { ...v.me, verdictVote: true, endDiscussion: true, voteAgree: true },
      spectate: { seats: [] },
    }) as unknown as RoomView;

  it("개인 값(me.verdictVote·endDiscussion)과 spectate 를 넣어도 결과가 같다", () => {
    const pairs: [RoomView, RoomView][] = [
      [viewOf("discussion"), nominationOf([[1, 2]])],
      [nominationOf([[1, 2]]), nominationOf([[1, 2], [3, 2], [4, 2]])],
      [nominationOf([]), defenseView()],
      [defenseView(), verdictView()],
      [verdictView(), executionView(5, 2, true)],
      [verdictView(), executionView(2, 5, false)],
    ];
    for (const [a, b] of pairs) {
      const plain = dayEvents(a, b);
      const priv = dayEvents(withPrivate(a), withPrivate(b));
      expect(text(priv)).toBe(text(plain));
    }
  });

  it("줄·알림·연출 어디에도 역할 단어가 없다", () => {
    const pairs: [RoomView | null, RoomView][] = [
      [viewOf("morning"), viewOf("dayAnnounce")],
      [viewOf("dayAnnounce"), viewOf("discussion")],
      [viewOf("discussion"), nominationOf([])],
      [nominationOf([]), nominationOf([[1, 2], [3, 2], [4, 2]])],
      [nominationOf([[1, 2]]), nominationOf([[1, 3]])],
      [nominationOf([]), defenseView()],
      [defenseView(), verdictView()],
      [verdictView(), executionView(5, 2, true)],
      [verdictView(), executionView(2, 5, false)],
      [nominationOf([]), viewOf("night", { day: { noExecution: { reason: "tie" } } })],
    ];
    for (const [a, b] of pairs) {
      const out = text(dayEvents(a, b));
      for (const word of ROLE_WORDS) expect(out.includes(word)).toBe(false);
    }
  });
});

describe("dayEvents — 마피아 확정 hot 줄 (NIGHT-08, E2 #16)", () => {
  const nightOf = (over: { role?: "mafia" | "police"; nightSure?: number } = {}): RoomView => {
    const v = viewOf("night");
    return { ...v, me: { ...v.me, role: over.role ?? "mafia", ...(over.nightSure !== undefined ? { nightSure: over.nightSure } : {}) } };
  };
  const HOT = { kind: "hot", text: "도윤 · 확정", scope: "mafia", icon: "target" };

  it("직전 view 에 확정이 없고 지금 있으면 마피아 채널 hot 줄 한 건", () => {
    expect(dayEvents(nightOf(), nightOf({ nightSure: 2 })).lines).toEqual([HOT]);
  });

  it("확정 대상이 바뀌면 새 대상으로 한 번 더 남는다", () => {
    const lines = dayEvents(nightOf({ nightSure: 2 }), nightOf({ nightSure: 3 })).lines;
    expect(lines).toEqual([{ ...HOT, text: "지호 · 확정" }]);
  });

  it("둘 다 같은 확정이면 줄이 없고, 확정이 깨져도 줄이 없다", () => {
    expect(dayEvents(nightOf({ nightSure: 2 }), nightOf({ nightSure: 2 })).lines).toEqual([]);
    expect(dayEvents(nightOf({ nightSure: 2 }), nightOf()).lines).toEqual([]);
  });

  it("첫 스냅샷(reset·prev 없음)에는 줄이 없다", () => {
    expect(dayEvents(nightOf(), nightOf({ nightSure: 2 }), { reset: true }).lines).toEqual([]);
    expect(dayEvents(null, nightOf({ nightSure: 2 })).lines).toEqual([]);
  });

  it("마피아가 아닌 view 에는 nightSure 가 섞여 와도 줄이 없다", () => {
    expect(dayEvents(nightOf({ role: "police" }), nightOf({ role: "police", nightSure: 2 })).lines).toEqual([]);
  });
});

describe("알림 시간표 (UI-SPEC 남은 위험 8)", () => {
  it("상수 값", () => {
    same(
      [ANNOUNCE_TALLY_MS, ANNOUNCE_EXEC_MS, ANNOUNCE_NOEXEC_MS, ANNOUNCE_DAY_MS, GHOST_RISE_MS, GHOST_FADE_END_MS],
      [2000, 3000, 1400, 2000, 1400, 2400],
    );
  });

  it("찬반 결과 알림 + 처형(또는 처형 없음) 알림이 처형 단계 길이(EXECUTION_MS) 안이다 (판결 앞머리 포함)", () => {
    expect(ANNOUNCE_LEAD_MS).toBe(VERDICT_LEAD_MS);
    expect(ANNOUNCE_LEAD_MS + ANNOUNCE_TALLY_MS + Math.max(ANNOUNCE_EXEC_MS, ANNOUNCE_NOEXEC_MS)).toBeLessThanOrEqual(EXECUTION_MS);
  });

  it("유령 떠오름·사라짐이 처형 알림 시간 안이다", () => {
    expect(GHOST_RISE_MS).toBeLessThanOrEqual(ANNOUNCE_EXEC_MS);
    expect(GHOST_FADE_END_MS).toBeLessThanOrEqual(ANNOUNCE_EXEC_MS);
    expect(GHOST_RISE_MS).toBeLessThan(GHOST_FADE_END_MS);
  });

  it("처형 단계 이벤트의 알림은 모두 EXECUTION_MS 안에서 끝난다", () => {
    for (const passed of [true, false]) {
      const events = dayEvents(verdictView(), executionView(passed ? 5 : 2, passed ? 2 : 5, passed));
      for (const a of events.announces) expect(a.at + a.ms).toBeLessThanOrEqual(EXECUTION_MS);
    }
    const last = executionView(0, 0, true, { day: { verdict: { yes: 0, no: 0, passed: true, last: true } } });
    for (const a of dayEvents(verdictView(), last).announces) expect(a.at + a.ms).toBeLessThanOrEqual(EXECUTION_MS);
  });
});

describe("headerFor — 단계표의 제목·안내 (UI-SPEC)", () => {
  const ghostPlayers = NAMES.map((name, seat) => pl(seat, name, seat !== 0));
  const hdr = (v: RoomView) => headerFor(v);

  it("낮 시작·낮 토론", () => {
    same(hdr(viewOf("dayAnnounce")), { title: "낮 토론" });
    same(hdr(viewOf("discussion")), { title: "낮 토론", hint: "이야기하며 마피아를 찾아요" });
  });

  it("지목: 순차 진행의 안내 (UI-SPEC Copywriting)", () => {
    const withTurn = (turn: PickTurnView, opts: ViewOpts = {}) => nominationOf([], { ...opts, day: { turn } });
    const order = [0, 1, 2, 3, 4];
    // 모이는 중
    same(hdr(withTurn({ order, i: -1 })), { title: "지목", hint: "모이는 중" });
    // 내 차례(seat 0 이 i 0)
    same(hdr(withTurn({ order, i: 0, endsAt: 8_000 })), { title: "지목", hint: "의심되는 사람을 눌러요" });
    // 남의 차례·확정 뒤 사이·끝 알림은 제목만
    same(hdr(withTurn({ order, i: 1, endsAt: 8_000 })), { title: "지목" });
    same(hdr(withTurn({ order, i: 0, endsAt: 8_000, doneAt: 3_000 })), { title: "지목" });
    same(hdr(withTurn({ order, i: 5 })), { title: "지목" });
    // day.turn 이 없으면 제목만
    same(hdr(nominationOf([])), { title: "지목" });
  });

  it("지목 안내는 역할·spectate 를 읽지 않는다", () => {
    const base = nominationOf([], { day: { turn: { order: [0, 1], i: 0, endsAt: 8_000 } } });
    const priv = { ...base, me: { ...base.me, role: "mafia" }, spectate: { seats: [] } } as unknown as RoomView;
    same(hdr(priv), hdr(base));
  });

  it("최후 변론: 남은 '{닉네임} 님의 변론', 변론자 본인 '해명할 시간이에요'", () => {
    same(hdr(defenseView()), { title: "최후 변론", hint: "지호 님의 변론" });
    same(hdr(defenseView({ mySeat: 3 })), { title: "최후 변론", hint: "해명할 시간이에요" });
  });

  it("찬반: 남은 '{닉네임} 님을 처형할까요?', 변론자 본인 '결과를 기다려요'", () => {
    same(hdr(verdictView()), { title: "찬반", hint: "지호 님을 처형할까요?" });
    same(hdr(verdictView({ mySeat: 3 })), { title: "찬반", hint: "결과를 기다려요" });
  });

  it("처형·아침은 제목만, 역할이 없는 산 사람의 밤은 시민 안내", () => {
    same(hdr(executionView(5, 2, true)), { title: "처형" });
    same(hdr(viewOf("morning")), { title: "아침" });
    same(hdr(viewOf("night")), { title: "밤", hint: "날이 밝길 기다려요" });
  });

  it("유령은 같은 제목에 '모두의 직업이 보여요'(밤은 '모두의 직업과 밤 행동이 보여요')", () => {
    const g = { players: ghostPlayers, mySeat: 0 };
    same(hdr(viewOf("discussion", g)), { title: "낮 토론", hint: "모두의 직업이 보여요" });
    same(hdr(nominationOf([], g)), { title: "지목", hint: "모두의 직업이 보여요" });
    same(hdr(defenseView(g)), { title: "최후 변론", hint: "모두의 직업이 보여요" });
    same(hdr(verdictView(g)), { title: "찬반", hint: "모두의 직업이 보여요" });
    same(hdr(executionView(5, 2, true, g)), { title: "처형", hint: "모두의 직업이 보여요" });
    same(hdr(viewOf("morning", g)), { title: "아침", hint: "모두의 직업이 보여요" });
    same(hdr(viewOf("night", g)), { title: "밤", hint: "모두의 직업과 밤 행동이 보여요" });
  });

  it("밤 안내는 역할마다 한 줄: 마피아 '대상에게 다가가요', 경찰 '조사할 사람을 골라요', 의사 '지킬 사람을 골라요', 시민 '날이 밝길 기다려요'", () => {
    const night = (role: "mafia" | "police" | "doctor" | "citizen"): RoomView => ({ ...viewOf("night"), me: { seat: 0, isHost: false, role } });
    same(hdr(night("mafia")), { title: "밤", hint: "대상에게 다가가요" });
    same(hdr(night("police")), { title: "밤", hint: "조사할 사람을 골라요" });
    same(hdr(night("doctor")), { title: "밤", hint: "지킬 사람을 골라요" });
    same(hdr(night("citizen")), { title: "밤", hint: "날이 밝길 기다려요" });
    const ghost = { ...viewOf("night", { players: ghostPlayers, mySeat: 0 }), me: { seat: 0, isHost: false, role: "mafia" as const } };
    same(hdr(ghost), { title: "밤", hint: "모두의 직업과 밤 행동이 보여요" });
  });

  it("변론자 정보가 없으면 안내를 만들지 않는다", () => {
    same(hdr(viewOf("defense")), { title: "최후 변론" });
  });

  it("낮 틀이 아닌 단계는 빈 제목", () => {
    same(hdr(viewOf("lobby")), { title: "" });
  });

  it("모든 제목·안내의 끝에 마침표·느낌표가 없다", () => {
    const g = { players: ghostPlayers, mySeat: 0 };
    const views = [
      viewOf("dayAnnounce"), viewOf("discussion"), nominationOf([]), defenseView(), defenseView({ mySeat: 3 }),
      verdictView(), verdictView({ mySeat: 3 }), executionView(5, 2, true), viewOf("morning"), viewOf("night"),
      viewOf("discussion", g), viewOf("night", g), defenseView(g), verdictView(g),
    ];
    for (const v of views) {
      const h = headerFor(v);
      for (const t of [h.title, h.hint ?? ""]) expect(/[.!]$/.test(t)).toBe(false);
    }
  });
});

// ---- 09-18: 아침 알림 (MORN-03, UI-SPEC 아침) ----
describe("dayEvents — 아침 알림 (MORN-03)", () => {
  const nightView = (): RoomView => viewOf("night", { mySeat: 1 });
  const morningView = (morning: DayView["morning"], opts: ViewOpts = {}): RoomView =>
    viewOf("morning", { mySeat: 1, ...opts, day: { morning, ...opts.day } });

  it("상수 값: 0.4초에 시작해 2.4초", () => {
    same([ANNOUNCE_MORNING_AT, ANNOUNCE_MORNING_MS], [400, 2400]);
  });

  it("밤 → 아침(피해자 3): 0.4초 target 알림 '지호 님이 당했습니다' 2.4초, 같은 문장의 hot 줄(범위 all) 0.4초", () => {
    const events = dayEvents(nightView(), morningView({ eliminated: 3 }));
    same(events.announces, [{ text: "지호 님이 당했습니다", icon: "target", at: 400, ms: 2400 }]);
    same(events.lines, [{ kind: "hot", text: "지호 님이 당했습니다", at: 400 }]);
    expect(events.lines[0]?.scope).toBeUndefined();
  });

  it("밤 → 아침(saved): heal 알림 '누군가 살아났습니다'. 누가 살아났는지 어디에도 없다", () => {
    const events = dayEvents(nightView(), morningView({ saved: true }));
    same(events.announces, [{ text: "누군가 살아났습니다", icon: "heal", at: 400, ms: 2400 }]);
    same(events.lines, [{ kind: "hot", text: "누군가 살아났습니다", at: 400 }]);
    for (const n of NAMES) expect(text(events).includes(n)).toBe(false);
  });

  it("밤 → 아침(아무 일 없음): 아이콘 없는 '아무 일도 없었습니다'", () => {
    const events = dayEvents(nightView(), morningView({}));
    same(events.announces, [{ text: "아무 일도 없었습니다", at: 400, ms: 2400 }]);
    expect("icon" in events.announces[0]!).toBe(false);
    same(events.lines, [{ kind: "hot", text: "아무 일도 없었습니다", at: 400 }]);
  });

  it("첫 스냅샷(prev 없음)·reset 은 알림도 줄도 없다 (MORN-03 재접속)", () => {
    const cur = morningView({ eliminated: 3 });
    same([dayEvents(null, cur).announces, dayEvents(null, cur).lines], [[], []]);
    same([dayEvents(nightView(), cur, { reset: true }).announces, dayEvents(nightView(), cur, { reset: true }).lines], [[], []]);
  });

  it("아침이 아닌 곳에서 아침으로 오는 경우(밤이 아닌 prev)는 아침 알림이 없다", () => {
    same(dayEvents(viewOf("lobby"), morningView({ eliminated: 3 })).announces, []);
  });
});

// ---- 09-18 Task 2: 피해자·경찰 순서 (NIGHT-11, E4 #26, E6 #35) ----
describe("dayEvents — 피해자 본인 '암살당했습니다' (NIGHT-11, 결정 0044-22)", () => {
  // 나(seat 1)가 밤에는 산 사람, 아침에는 탈락. 피해자 목록에서 seat 1 이 alive false.
  const alivePlayers = NAMES.map((n, seat) => pl(seat, n));
  const deadMe = NAMES.map((n, seat) => pl(seat, n, seat !== 1));
  const nightOfMe = (): RoomView => viewOf("night", { mySeat: 1, players: alivePlayers });
  const morningOfMe = (): RoomView => viewOf("morning", { mySeat: 1, players: deadMe, day: { morning: { eliminated: 1 } } });

  it("밤의 산 사람 → 아침의 탈락(같은 연결): 0.7초에 ghost 아이콘 '암살당했습니다' 2초 하나뿐이고 다른 알림이 없다", () => {
    const events = dayEvents(nightOfMe(), morningOfMe());
    same(events.announces, [{ text: "암살당했습니다", icon: "ghost", at: 700, ms: 2000 }]);
    same([ANNOUNCE_VICTIM_AT, ANNOUNCE_VICTIM_MS], [700, 2000]);
  });

  it("채팅 hot 줄은 다른 사람과 같은 '{닉네임} 님이 당했습니다'(0.4초)다", () => {
    const events = dayEvents(nightOfMe(), morningOfMe());
    same(events.lines, [{ kind: "hot", text: "민준 님이 당했습니다", at: 400 }]);
  });

  it("처형으로 이미 탈락한 유령 화면(밤에도 탈락)은 세 문장 중 하나를 받는다 (가정 A3)", () => {
    const ghostNight = viewOf("night", { mySeat: 1, players: deadMe });
    const ghostMorning = viewOf("morning", { mySeat: 1, players: deadMe, day: { morning: { eliminated: 3 } } });
    const events = dayEvents(ghostNight, ghostMorning);
    same(events.announces, [{ text: "지호 님이 당했습니다", icon: "target", at: 400, ms: 2400 }]);
  });

  it("의사가 살린 사람(아침에도 산 사람) 화면은 다른 시민과 같은 '누군가 살아났습니다' 다 (T-09-41)", () => {
    const saved = (mySeat: number) => dayEvents(viewOf("night", { mySeat }), viewOf("morning", { mySeat, day: { morning: { saved: true } } }));
    same(saved(2).announces, saved(3).announces);
    same(saved(2).lines, saved(3).lines);
    same(saved(2).announces, [{ text: "누군가 살아났습니다", icon: "heal", at: 400, ms: 2400 }]);
  });
});

describe("policeResultOf — 경찰 조사 결과 판정 (A1, E6 #35, L8)", () => {
  const withMe = (v: RoomView, me: Partial<RoomView["me"]>): RoomView => ({ ...v, me: { ...v.me, ...me } });
  const police = (phase: PhaseId, records: NonNullable<RoomView["me"]["records"]>, day: Partial<DayView> = {}, mySeat = 1): RoomView =>
    withMe(viewOf(phase, { mySeat, day }), { role: "police", records });

  it("밤 → 아침에 me.records 끝에 그 밤 일차의 줄이 새로 생기면 { seat, isMafia }", () => {
    const prev = police("night", []);
    expect(policeResultOf(prev, police("morning", [{ n: 1, target: 2, isMafia: false }]))).toEqual({ seat: 2, isMafia: false });
    expect(policeResultOf(prev, police("morning", [{ n: 1, target: 4, isMafia: true }]))).toEqual({ seat: 4, isMafia: true });
  });

  it("2일차 밤: 앞선 밤 기록이 있어도 이번 밤 일차의 새 줄만 센다", () => {
    const old = { n: 1, target: 3, isMafia: false };
    const prev = police("night", [old], { n: 2 });
    expect(policeResultOf(prev, police("morning", [old, { n: 2, target: 0, isMafia: true }], { n: 2 }))).toEqual({ seat: 0, isMafia: true });
    expect(policeResultOf(prev, police("morning", [old], { n: 2 }))).toBeNull();
  });

  it("경찰이 그 밤에 안 골랐으면(줄이 안 늘었으면) null", () => {
    expect(policeResultOf(police("night", []), police("morning", []))).toBeNull();
  });

  it("경찰이 아닌 view(시민·마피아 일지 줄 모양 포함)는 null", () => {
    const citizenPrev = withMe(viewOf("night"), { role: "citizen" });
    const citizenCur = withMe(viewOf("morning"), { role: "citizen" });
    expect(policeResultOf(citizenPrev, citizenCur)).toBeNull();
    const mafiaCur = withMe(viewOf("morning"), { role: "mafia", records: [{ n: 1, target: 2, died: true }] });
    expect(policeResultOf(withMe(viewOf("night"), { role: "mafia", records: [] }), mafiaCur)).toBeNull();
  });

  it("첫 스냅샷(prev 없음)·밤이 아닌 prev·아침이 아닌 cur 는 null", () => {
    const cur = police("morning", [{ n: 1, target: 2, isMafia: false }]);
    expect(policeResultOf(null, cur)).toBeNull();
    expect(policeResultOf(police("lobby", []), cur)).toBeNull();
    expect(policeResultOf(police("night", []), police("dayAnnounce", [{ n: 1, target: 2, isMafia: false }]))).toBeNull();
  });
});

describe("dayEvents — 경찰 화면 순서 (UI-SPEC 245·266행, E6 #35)", () => {
  const police = (phase: PhaseId, records: NonNullable<RoomView["me"]["records"]>, players?: PublicPlayer[], day: Partial<DayView> = {}): RoomView => {
    const v = viewOf(phase, { mySeat: 1, day, ...(players ? { players } : {}) });
    return { ...v, me: { ...v.me, role: "police", records } };
  };

  it("경찰 화면: 알림 2.6초 2.2초, 채팅 hot 줄도 2.6초, 2.4초에 로컬 카드 { 대상 닉네임, '마피아 아님' }", () => {
    const events = dayEvents(police("night", []), police("morning", [{ n: 1, target: 2, isMafia: false }], undefined, { morning: {} }));
    same(events.announces, [{ text: "아무 일도 없었습니다", at: 2600, ms: 2200 }]);
    same(events.lines, [{ kind: "hot", text: "아무 일도 없었습니다", at: 2600 }]);
    same(events.localCards, [{ at: 2400, title: "도윤", text: "마피아 아님" }]);
    same([ANNOUNCE_POLICE_AT, ANNOUNCE_POLICE_MS, POLICE_CARD_AT], [2600, 2200, 2400]);
  });

  it("대상이 마피아면 본문 '마피아', 피해자 문장도 2.6초", () => {
    const events = dayEvents(police("night", []), police("morning", [{ n: 1, target: 4, isMafia: true }], undefined, { morning: { eliminated: 3 } }));
    same(events.announces, [{ text: "지호 님이 당했습니다", icon: "target", at: 2600, ms: 2200 }]);
    same(events.localCards, [{ at: 2400, title: "하윤", text: "마피아" }]);
  });

  it("경찰이 그 밤에 고르지 않았으면 0.4초 보통 순서이고 카드가 없다", () => {
    const events = dayEvents(police("night", []), police("morning", [], undefined, { morning: {} }));
    same(events.announces, [{ text: "아무 일도 없었습니다", at: 400, ms: 2400 }]);
    expect(events.localCards ?? []).toEqual([]);
  });

  it("경찰이 그 밤에 암살당했어도 카드는 받고(A1) 알림은 피해자 문장 0.7초가 이긴다(A2)", () => {
    const alive = NAMES.map((n, seat) => pl(seat, n));
    const dead = NAMES.map((n, seat) => pl(seat, n, seat !== 1));
    const events = dayEvents(police("night", [], alive), police("morning", [{ n: 1, target: 2, isMafia: false }], dead, { morning: { eliminated: 1 } }));
    same(events.announces, [{ text: "암살당했습니다", icon: "ghost", at: 700, ms: 2000 }]);
    same(events.localCards, [{ at: 2400, title: "도윤", text: "마피아 아님" }]);
  });

  it("시민 화면에는 로컬 카드가 없고 결과 문구가 어디에도 없다 (L8, T-09-40)", () => {
    const events = dayEvents(viewOf("night", { mySeat: 3 }), viewOf("morning", { mySeat: 3, day: { morning: {} } }));
    expect(events.localCards ?? []).toEqual([]);
    expect(text(events).includes("마피아")).toBe(false);
  });

  it("재접속 첫 스냅샷·reset 은 카드가 없다", () => {
    const cur = police("morning", [{ n: 1, target: 2, isMafia: false }], undefined, { morning: {} });
    expect(dayEvents(null, cur).localCards ?? []).toEqual([]);
    expect(dayEvents(police("night", []), cur, { reset: true }).localCards ?? []).toEqual([]);
  });
});

// ---- 09.1.1-14: 결선(runoff) 채팅 줄·알림·헤더 (UI-SPEC D, Copywriting Contract) ----
const runoffOf = (step: 0 | 1 | 2, opts: ViewOpts & { tally?: [number, number]; cand?: [number, number] } = {}): RoomView =>
  viewOf("runoff", { ...opts, day: { runoff: { cand: opts.cand ?? [2, 3], step, ...(opts.tally !== undefined ? { tally: opts.tally } : {}) }, ...opts.day } });

describe("dayEvents — 결선 (09.1.1-14)", () => {
  it("지목 → 결선: system 줄 '결선 시작', 알림 없음", () => {
    const events = dayEvents(nominationOf([[0, 2], [1, 3], [2, 3], [3, 2]]), runoffOf(0));
    same(events.lines, [{ kind: "system", text: "결선 시작" }]);
    same(events.announces, []);
  });

  it("결선 → 최후 변론: hot '{이름} 님 결선 {k}표 · 최후 변론' (k 는 직전 view 의 tally 에서 승자 칸)", () => {
    const toDefense = (candidate: number) => viewOf("defense", { day: { candidate, voteLog: VOTE_LOG } });
    same(dayEvents(runoffOf(2, { tally: [3, 1] }), toDefense(2)).lines, [{ kind: "hot", text: "도윤 님 결선 3표 · 최후 변론" }]);
    same(dayEvents(runoffOf(2, { tally: [1, 2] }), toDefense(3)).lines, [{ kind: "hot", text: "지호 님 결선 2표 · 최후 변론" }]);
  });

  it("결선 → 변론인데 직전 view 에 tally 가 없으면 기존 변론 줄로 돌아간다", () => {
    const events = dayEvents(runoffOf(1), viewOf("defense", { day: { candidate: 3, voteLog: VOTE_LOG } }));
    same(events.lines, [{ kind: "hot", text: "지호 님 4표 · 최후 변론" }]);
  });

  it("결선 → 밤(또 동점): '처형 없음' 줄과 알림, 이어 '밤이 되었습니다'", () => {
    const events = dayEvents(runoffOf(2, { tally: [2, 2] }), viewOf("night", { day: { noExecution: { reason: "tie" } } }));
    same(events.lines, [{ kind: "system", text: "처형 없음" }]);
    same(events.announces, [
      { text: "처형 없음", at: 0, ms: 1400 },
      { text: "밤이 되었습니다", at: 1400, ms: 1600 },
    ]);
  });

  it("지목 → 밤은 여전히 같다", () => {
    const events = dayEvents(nominationOf([[0, 1], [1, 0]]), viewOf("night", { day: { noExecution: { reason: "tie" } } }));
    same(events.lines, [{ kind: "system", text: "처형 없음" }]);
  });

  it("결선 줄에 역할 단어가 없다", () => {
    for (const [a, b] of [[nominationOf([]), runoffOf(0)], [runoffOf(2, { tally: [3, 1] }), defenseView()]] as [RoomView, RoomView][]) {
      const out = text(dayEvents(a, b));
      for (const word of ROLE_WORDS) expect(out.includes(word)).toBe(false);
    }
  });
});

describe("headerFor — 결선 (UI-SPEC D-2)", () => {
  it("제목 '결선'. 후보 아닌 산 사람은 투표 중에만 '둘 중 한 명을 눌러요', 앞머리·결과는 제목만", () => {
    same(headerFor(runoffOf(1)), { title: "결선", hint: "둘 중 한 명을 눌러요" });
    same(headerFor(runoffOf(0)), { title: "결선" });
    same(headerFor(runoffOf(2, { tally: [1, 1] })), { title: "결선" });
  });
  it("후보 본인은 '결과를 기다려요'", () => {
    same(headerFor(runoffOf(1, { mySeat: 2 })), { title: "결선", hint: "결과를 기다려요" });
    same(headerFor(runoffOf(1, { mySeat: 3 })), { title: "결선", hint: "결과를 기다려요" });
  });
  it("유령은 기존 '모두의 직업이 보여요'", () => {
    const players = NAMES.map((name, seat) => pl(seat, name, seat !== 0));
    same(headerFor(runoffOf(1, { players })), { title: "결선", hint: "모두의 직업이 보여요" });
  });
});

// ---- 09.1.1-15: 마지막 3인(showdown) 제목·안내·채팅 줄 (UI-SPEC E-1·E-2·E-3) ----
const showdownOf = (showdown: ShowdownView, opts: ViewOpts = {}): RoomView =>
  viewOf("showdown", { ...opts, players: opts.players ?? NAMES.map((name, seat) => pl(seat, name, seat < 3)), day: { showdown, ...opts.day } });

describe("headerFor — 마지막 3인 (UI-SPEC E-1·E-2·E-3)", () => {
  it("제목 '마지막 셋'. 모이는 중·남의 한마디 차례·공개는 제목만", () => {
    same(headerFor(showdownOf({ order: [0, 1, 2], i: -1 })), { title: "마지막 셋" });
    same(headerFor(showdownOf({ order: [0, 1, 2], i: 1, endsAt: 9000 })), { title: "마지막 셋" });
    same(headerFor(showdownOf({ order: [0, 1, 2], i: 4, points: [] })), { title: "마지막 셋" });
  });
  it("내 한마디 차례에는 '한마디를 골라요'(확정 뒤에는 제목만)", () => {
    same(headerFor(showdownOf({ order: [0, 1, 2], i: 0, endsAt: 9000 })), { title: "마지막 셋", hint: "한마디를 골라요" });
    same(headerFor(showdownOf({ order: [0, 1, 2], i: 0, endsAt: 9000, doneAt: 5000, word: "안녕" })), { title: "마지막 셋" });
  });
  it("동시 지목에서 산 세 사람은 '의심되는 사람을 눌러요'", () => {
    same(headerFor(showdownOf({ order: [0, 1, 2], i: 3, endsAt: 9000, voted: [] })), { title: "마지막 셋", hint: "의심되는 사람을 눌러요" });
  });
  it("유령은 기존 '모두의 직업이 보여요'", () => {
    same(headerFor(showdownOf({ order: [0, 1, 2], i: 3, endsAt: 9000, voted: [] }, { mySeat: 3 })), { title: "마지막 셋", hint: "모두의 직업이 보여요" });
  });
});

describe("dayEvents — 마지막 3인 진입 (09.1.1-15)", () => {
  it("낮 시작 → showdown: system 줄 '마지막 셋', 알림 없음", () => {
    const events = dayEvents(viewOf("dayAnnounce"), showdownOf({ order: [0, 1, 2], i: -1 }));
    same(events.lines, [{ kind: "system", text: "마지막 셋" }]);
    same(events.announces, []);
  });

  it("마지막 3인 1-1-1 → 밤(09.1.1-16): '처형 없음' 줄과 알림 1.4초, 이어 '밤이 되었습니다'", () => {
    const events = dayEvents(showdownOf({ order: [0, 1, 2], i: 4, points: [{ seat: 0, target: 1 }, { seat: 1, target: 2 }, { seat: 2, target: 0 }] }), viewOf("night", { day: { noExecution: { reason: "tie" } } }));
    same(events.lines, [{ kind: "system", text: "처형 없음" }]);
    same(events.announces, [
      { text: "처형 없음", at: 0, ms: 1400 },
      { text: "밤이 되었습니다", at: 1400, ms: 1600 },
    ]);
  });

  it("마지막 3인 → 밤인데 처형 없음 이유가 없으면(다른 경로) '밤이 되었습니다' 만", () => {
    const events = dayEvents(showdownOf({ order: [0, 1, 2], i: 4, points: [] }), viewOf("night"));
    same(events.announces, [{ text: "밤이 되었습니다", at: 0, ms: 1600 }]);
  });
});
