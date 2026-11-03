// 낮 처형 화면 연출 순수 모듈 시험 — DAY-04·05·06, 결정 0049·0053·0060, 08-UI-SPEC.
// 서버 view 두 개의 공개 정보 차이에서만 채팅 줄·위 알림·결과 알림·연출 이벤트가 나온다.
// 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 JSON 문자열로 한다.
import { describe, expect, it } from "vitest";
import type { DayView, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { EXECUTION_MS } from "../../shared/game/phases";
import {
  ANNOUNCE_DAY_MS,
  ANNOUNCE_EXEC_MS,
  ANNOUNCE_NOEXEC_MS,
  ANNOUNCE_TALLY_MS,
  dayEvents,
  GHOST_FADE_END_MS,
  GHOST_RISE_MS,
  headerFor,
  pointsTally,
  TOAST_FAST_MS,
  TOAST_MERGE_MS,
  TOAST_MS,
  TOAST_NAMES_MAX,
  TOAST_QUEUE_MAX,
  ToastQueue,
} from "../../src/game/dayView";
import type { DayEvents, PointToast } from "../../src/game/dayView";

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
    expect(tally.sure).toBeUndefined();
  });

  it("0표면 비어 있고 과반 수는 산 사람 수에서 나온다(5명 → 3)", () => {
    const tally = pointsTally(nominationOf([]));
    same(tally.counts, {});
    expect(tally.leader).toBeUndefined();
    expect(tally.majority).toBe(3);
  });

  it("과반 수는 탈락자를 뺀 산 사람 수로 센다(5명 중 2명 탈락 → 3명 → 2)", () => {
    const players = NAMES.map((name, seat) => pl(seat, name, seat > 1));
    expect(pointsTally(nominationOf([], { players })).majority).toBe(2);
  });

  it("선두의 표가 과반에 닿으면 sure 가 그 사람", () => {
    expect(pointsTally(nominationOf([[1, 2], [3, 2]])).sure).toBeUndefined();
    expect(pointsTally(nominationOf([[1, 2], [3, 2], [4, 2]])).sure).toBe(2);
  });

  it("지목 단계가 아닌 view 의 points 는 읽지 않는다", () => {
    const stale = viewOf("defense", { day: { points: [{ seat: 1, target: 2 }] } });
    same(pointsTally(stale).counts, {});
  });
});

describe("dayEvents — 지목 차이 (DAY-04)", () => {
  it("새 지목은 vote 줄 '민준 → 도윤' 과 위 알림 재료 한 건을 만든다", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[1, 2]]));
    same(events.lines[0], { kind: "vote", text: "민준 → 도윤" });
    same(events.toasts, [{ to: 2, from: [1], toName: "도윤", fromNames: ["민준"] }]);
    same(events.announces, []);
    same(events.fx, []);
  });

  it("대상을 바꾸면 '민준 → 지호 (바꿈)' 줄과 changed 알림", () => {
    const events = dayEvents(nominationOf([[1, 2]]), nominationOf([[1, 3]]));
    same(events.lines[0], { kind: "vote", text: "민준 → 지호 (바꿈)" });
    same(events.toasts, [{ to: 3, from: [1], toName: "지호", fromNames: ["민준"], changed: true }]);
  });

  it("같은 대상을 다시 보낸 것(변화 없음)은 줄도 알림도 없다", () => {
    const events = dayEvents(nominationOf([[1, 2]]), nominationOf([[1, 2]]));
    same(events.lines, []);
    same(events.toasts, []);
  });

  it("이전 view 가 없으면(첫 스냅샷·재접속) 이벤트 없이 정상 상태만 준다", () => {
    const events = dayEvents(null, nominationOf([[1, 2]]));
    same(events.lines, []);
    same(events.toasts, []);
    same(events.announces, []);
    same(events.fx, []);
    same(events.state.counts, { 2: 1 });
    expect(events.state.leader).toBe(2);
  });

  it("reset 옵션(epoch 가 바뀐 첫 스냅샷)도 이벤트 없이 상태만 준다", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[1, 2], [3, 2]]), { reset: true });
    same(events.lines, []);
    same(events.toasts, []);
    same(events.state.counts, { 2: 2 });
  });

  it("선두가 새로 생기면 hot '{이름} 님이 앞서요' 가 vote 줄 뒤에 온다", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[1, 2]]));
    same(events.lines, [
      { kind: "vote", text: "민준 → 도윤" },
      { kind: "hot", text: "도윤 님이 앞서요" },
    ]);
  });

  it("선두가 다른 사람으로 바뀌면 새 선두에게 hot 줄", () => {
    const events = dayEvents(nominationOf([[1, 2], [4, 3]]), nominationOf([[1, 2], [4, 3], [0, 3]]));
    same(events.lines, [
      { kind: "vote", text: "서연 → 지호" },
      { kind: "hot", text: "지호 님이 앞서요" },
    ]);
  });

  it("선두가 그대로면 hot 줄이 없다", () => {
    const events = dayEvents(nominationOf([[1, 2], [3, 2]]), nominationOf([[1, 2], [3, 2], [0, 4]]));
    same(events.lines, [{ kind: "vote", text: "서연 → 하윤" }]);
  });

  it("동점이 되어 선두가 사라지면 hot 줄을 만들지 않는다", () => {
    const events = dayEvents(nominationOf([[1, 2], [3, 2], [4, 0]]), nominationOf([[1, 2], [3, 2], [4, 0], [2, 0]]));
    same(events.lines, [{ kind: "vote", text: "도윤 → 서연" }]);
    expect(events.state.leader).toBeUndefined();
  });

  it("산 사람 5명 → 과반 3, 표가 3으로 처음 모이면 hot '도윤 님 과반'", () => {
    const events = dayEvents(nominationOf([[1, 2], [3, 2]]), nominationOf([[1, 2], [3, 2], [4, 2]]));
    same(events.lines, [
      { kind: "vote", text: "하윤 → 도윤" },
      { kind: "hot", text: "도윤 님 과반" },
    ]);
    expect(events.state.sure).toBe(2);
  });

  it("과반이 풀렸다가 다시 닿으면 줄을 다시 만든다 (가정 A1)", () => {
    const hold = nominationOf([[1, 2], [3, 2], [4, 2]]);
    const released = nominationOf([[1, 2], [3, 2], [4, 0]]);
    same(dayEvents(hold, released).lines.filter((l) => l.kind === "hot"), []);
    const again = dayEvents(released, nominationOf([[1, 2], [3, 2], [4, 2]]));
    same(again.lines.filter((l) => l.kind === "hot"), [{ kind: "hot", text: "도윤 님 과반" }]);
  });

  it("이미 과반인 채 다른 사람이 바꾼 표는 과반 줄을 반복하지 않는다", () => {
    const events = dayEvents(nominationOf([[1, 2], [3, 2], [4, 2]]), nominationOf([[1, 2], [3, 2], [4, 2], [0, 3]]));
    same(events.lines, [{ kind: "vote", text: "서연 → 지호" }]);
  });

  it("닉네임에 HTML 이 있어도 문자열 그대로 둔다", () => {
    const players = [pl(0, "서연"), pl(1, "<b>민준</b>"), pl(2, "도윤"), pl(3, "지호"), pl(4, "하윤")];
    const events = dayEvents(nominationOf([], { players }), nominationOf([[1, 2]], { players }));
    expect(events.lines[0]!.text).toBe("<b>민준</b> → 도윤");
  });

  it("앉은 사람 목록에 없는 seat 의 지목은 vote 줄·알림 없이 건너뛴다(득표 집계에는 남는다)", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[9, 2]]));
    same(events.lines.filter((l) => l.kind === "vote"), []);
    same(events.toasts, []);
  });

  it("지목 줄 순서는 좌석 오름차순(서버 view 순서와 무관)", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[3, 2], [1, 2]]));
    same(events.lines.filter((l) => l.kind === "vote").map((l) => l.text), ["민준 → 도윤", "지호 → 도윤"]);
  });
});

// ---- ToastQueue — 위 알림 합치기·줄 세우기 (UI Considerations E2 #9) ----
// 시계는 메서드 인자 now 로만 받는다(가짜 시계 없이도 결정적). 알림은 합치기 창(400ms)이 닫힌 뒤에 나온다.

const toast = (to: number, toName: string, from: number, fromName: string, changed = false): PointToast => ({
  to,
  from: [from],
  toName,
  fromNames: [fromName],
  ...(changed ? { changed: true } : {}),
});
const DOYUN = (from: number, fromName: string, changed = false) => toast(2, "도윤", from, fromName, changed);

describe("ToastQueue — 상수", () => {
  it("합치기 400ms · 1.5초 · 0.8초 · 대기 4건 · 이름 3명 (시작값)", () => {
    same([TOAST_MERGE_MS, TOAST_MS, TOAST_FAST_MS, TOAST_QUEUE_MAX, TOAST_NAMES_MAX], [400, 1500, 800, 4, 3]);
  });
});

describe("ToastQueue — 같은 대상 합치기", () => {
  it("한 건은 합치기 창이 닫힌 뒤 1.5초짜리 point 알림으로 나온다", () => {
    const q = new ToastQueue();
    q.push(DOYUN(1, "민준"), 0);
    expect(q.next(399)).toBeNull();
    same(q.next(400), { text: "민준 → 도윤", icon: "point", durationMs: 1500 });
  });

  it("399ms 안의 같은 대상은 '지호·민준 → 도윤' 한 건으로 합친다", () => {
    const q = new ToastQueue();
    q.push(DOYUN(3, "지호"), 0);
    q.push(DOYUN(1, "민준"), 399);
    same(q.next(400), { text: "지호·민준 → 도윤", icon: "point", durationMs: 1500 });
    expect(q.next(5000)).toBeNull();
  });

  it("400ms 에 온 같은 대상은 합치지 않고 따로 줄 선다", () => {
    const q = new ToastQueue();
    q.push(DOYUN(3, "지호"), 0);
    q.push(DOYUN(1, "민준"), 400);
    expect(q.next(400)!.text).toBe("지호 → 도윤");
    expect(q.next(1200)!.text).toBe("민준 → 도윤");
  });

  it("이름은 3명까지 쓰고 4명째부터 '…' 로 줄인다", () => {
    const three = new ToastQueue();
    [["지호", 3], ["민준", 1], ["서연", 0]].forEach(([name, seat], i) => three.push(DOYUN(seat as number, name as string), i));
    expect(three.next(400)!.text).toBe("지호·민준·서연 → 도윤");
    const four = new ToastQueue();
    [["지호", 3], ["민준", 1], ["서연", 0], ["하윤", 4]].forEach(([name, seat], i) => four.push(DOYUN(seat as number, name as string), i));
    expect(four.next(400)!.text).toBe("지호·민준·서연… → 도윤");
  });

  it("같은 사람의 중복 알림은 이름을 두 번 쓰지 않는다", () => {
    const q = new ToastQueue();
    q.push(DOYUN(1, "민준"), 0);
    q.push(DOYUN(1, "민준"), 100);
    expect(q.next(400)!.text).toBe("민준 → 도윤");
  });

  it("(바꿈) 은 단독 알림에만 붙는다", () => {
    const solo = new ToastQueue();
    solo.push(toast(3, "지호", 1, "민준", true), 0);
    expect(solo.next(400)!.text).toBe("민준 → 지호 (바꿈)");
    const merged = new ToastQueue();
    merged.push(toast(3, "지호", 1, "민준", true), 0);
    merged.push(toast(3, "지호", 0, "서연"), 10);
    expect(merged.next(400)!.text).toBe("민준·서연 → 지호");
  });
});

describe("ToastQueue — 줄 세우기·속도·대기 상한", () => {
  it("서로 다른 대상 둘이 대기하면 하나씩, 앞은 0.8초 뒤는 대기가 1건이라 1.5초", () => {
    const q = new ToastQueue();
    q.push(DOYUN(1, "민준"), 0);
    q.push(toast(3, "지호", 4, "하윤"), 0);
    same(q.next(400), { text: "민준 → 도윤", icon: "point", durationMs: 800 });
    expect(q.next(1199)).toBeNull();
    same(q.next(1200), { text: "하윤 → 지호", icon: "point", durationMs: 1500 });
  });

  it("보이는 동안에는 다음 알림을 내지 않는다", () => {
    const q = new ToastQueue();
    q.push(DOYUN(1, "민준"), 0);
    expect(q.next(400)).not.toBeNull();
    q.push(toast(3, "지호", 4, "하윤"), 500);
    expect(q.next(1000)).toBeNull();
    expect(q.next(1900)!.text).toBe("하윤 → 지호");
  });

  it("대기 5번째는 토스트에서 버려지고 버린 수를 센다", () => {
    const q = new ToastQueue();
    const targets: [number, string][] = [[0, "서연"], [1, "민준"], [2, "도윤"], [3, "지호"], [4, "하윤"]];
    targets.forEach(([to, name]) => q.push(toast(to, name, 9, "손님"), 0));
    expect(q.dropped()).toBe(1);
    const shown: string[] = [];
    for (let now = 400; now < 20_000; now += 100) {
      const t = q.next(now);
      if (t) shown.push(t.text);
    }
    same(shown, ["손님 → 서연", "손님 → 민준", "손님 → 도윤", "손님 → 지호"]);
  });

  it("대기가 가득 차도 창 안의 같은 대상은 합쳐지며 버려지지 않는다", () => {
    const q = new ToastQueue();
    [0, 1, 2, 3].forEach((to) => q.push(toast(to, `대상${to}`, 9, "손님"), 0));
    q.push(toast(3, "대상3", 8, "민준"), 100);
    expect(q.dropped()).toBe(0);
  });

  it("버려진 수는 계속 누적된다", () => {
    const q = new ToastQueue();
    for (let to = 0; to < 7; to += 1) q.push(toast(to, `대상${to}`, 9, "손님"), 0);
    expect(q.dropped()).toBe(3);
  });
});

// ---- 단계 진입 이벤트 (DAY-05·06, 결정 0060-5) ----
const ROLE_WORDS = ["마피아", "시민", "경찰", "의사"];
const text = (e: DayEvents): string => JSON.stringify([e.lines, e.announces, e.fx, e.toasts]);

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
    same(dayEvents(viewOf("night"), viewOf("morning")).lines, []);
    same(dayEvents(viewOf("morning"), viewOf("lobby")).lines, []);
  });
});

describe("dayEvents — 찬반 결과·처형·처형 없음 (DAY-06)", () => {
  it("찬반 → 처형(통과): 즉시 '찬성 5 · 반대 2', 2.0초에 '{이름} 님 처형' 알림과 유령 떠오름", () => {
    const events = dayEvents(verdictView(), executionView(5, 2, true));
    same(events.lines, [
      { kind: "hot", text: "찬성 5 · 반대 2" },
      { kind: "hot", text: "지호 님 처형", at: 2000 },
    ]);
    same(events.announces, [
      { text: "찬성 5 · 반대 2", at: 0, ms: 2000 },
      { text: "지호 님 처형", at: 2000, ms: 3000 },
    ]);
    same(events.fx, [{ kind: "ghostRise", seat: 3, at: 2000 }]);
  });

  it("찬반 → 처형(부결): 2.0초에 system '처형 없음' 과 1.4초 알림, 연출 없음", () => {
    const events = dayEvents(verdictView(), executionView(2, 5, false));
    same(events.lines, [
      { kind: "hot", text: "찬성 2 · 반대 5" },
      { kind: "system", text: "처형 없음", at: 2000 },
    ]);
    same(events.announces, [
      { text: "찬성 2 · 반대 5", at: 0, ms: 2000 },
      { text: "처형 없음", at: 2000, ms: 1400 },
    ]);
    same(events.fx, []);
  });

  it("지목 → 밤(동률·0표): 즉시 system '처형 없음' 과 1.4초 알림", () => {
    for (const reason of ["tie", "noVotes"] as const) {
      const events = dayEvents(nominationOf([[0, 1], [1, 0]]), viewOf("night", { day: { noExecution: { reason } } }));
      same(events.lines, [{ kind: "system", text: "처형 없음" }]);
      same(events.announces, [{ text: "처형 없음", at: 0, ms: 1400 }]);
      same(events.fx, []);
    }
  });

  it("처형 → 밤은 이미 알렸으므로 줄이 없다", () => {
    const events = dayEvents(executionView(5, 2, true), viewOf("night", { day: { candidate: 3 } }));
    same(events.lines, []);
    same(events.announces, []);
  });

  it("첫 스냅샷이 처형 단계면 줄·알림·연출 없이 상태만 준다 (변론자 유령 상태는 state)", () => {
    const events = dayEvents(null, executionView(5, 2, true));
    same([events.lines, events.announces, events.fx, events.toasts], [[], [], [], []]);
    expect(events.state.executed).toBe(3);
    expect(events.state.candidate).toBe(3);
  });

  it("부결이면 첫 스냅샷에도 executed 가 없다", () => {
    expect(dayEvents(null, executionView(2, 5, false)).state.executed).toBeUndefined();
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
      expect(JSON.stringify(priv.state)).toBe(JSON.stringify(plain.state));
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

  it("찬반 결과 알림 + 처형(또는 처형 없음) 알림이 처형 단계 길이(EXECUTION_MS) 안이다", () => {
    expect(ANNOUNCE_TALLY_MS + Math.max(ANNOUNCE_EXEC_MS, ANNOUNCE_NOEXEC_MS)).toBeLessThanOrEqual(EXECUTION_MS);
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
  });
});

describe("headerFor — 단계표의 제목·안내 (UI-SPEC)", () => {
  const ghostPlayers = NAMES.map((name, seat) => pl(seat, name, seat !== 0));
  const hdr = (v: RoomView) => headerFor(v);

  it("낮 시작·낮 토론", () => {
    same(hdr(viewOf("dayAnnounce")), { title: "낮 토론" });
    same(hdr(viewOf("discussion")), { title: "낮 토론", hint: "이야기하며 마피아를 찾아요" });
  });

  it("지목", () => {
    same(hdr(nominationOf([])), { title: "지목", hint: "의심되는 사람을 눌러요" });
  });

  it("최후 변론: 남은 '{닉네임} 님의 변론', 변론자 본인 '해명할 시간이에요'", () => {
    same(hdr(defenseView()), { title: "최후 변론", hint: "지호 님의 변론" });
    same(hdr(defenseView({ mySeat: 3 })), { title: "최후 변론", hint: "해명할 시간이에요" });
  });

  it("찬반: 남은 '{닉네임} 님을 처형할까요?', 변론자 본인 '결과를 기다려요'", () => {
    same(hdr(verdictView()), { title: "찬반", hint: "지호 님을 처형할까요?" });
    same(hdr(verdictView({ mySeat: 3 })), { title: "찬반", hint: "결과를 기다려요" });
  });

  it("처형·아침·밤은 제목만", () => {
    same(hdr(executionView(5, 2, true)), { title: "처형" });
    same(hdr(viewOf("morning")), { title: "아침" });
    same(hdr(viewOf("night")), { title: "밤" });
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

  it("밤 산 마피아는 '대상에게 다가가요', 마피아가 아닌 산 사람은 제목만이다", () => {
    const night = (role: "mafia" | "police" | "doctor" | "citizen"): RoomView => ({ ...viewOf("night"), me: { seat: 0, isHost: false, role } });
    same(hdr(night("mafia")), { title: "밤", hint: "대상에게 다가가요" });
    for (const role of ["police", "doctor", "citizen"] as const) same(hdr(night(role)), { title: "밤" });
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
