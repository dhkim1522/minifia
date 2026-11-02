// 낮 처형 화면 연출 순수 모듈 시험 — DAY-04·05·06, 결정 0049·0053·0060, 08-UI-SPEC.
// 서버 view 두 개의 공개 정보 차이에서만 채팅 줄·위 알림·결과 알림·연출 이벤트가 나온다.
// 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 JSON 문자열로 한다.
import { describe, expect, it } from "vitest";
import type { DayView, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { dayEvents, pointsTally } from "../../src/game/dayView";

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

  it("앉은 사람 목록에 없는 seat 의 지목은 줄 없이 건너뛴다", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[9, 2]]));
    same(events.lines, []);
    same(events.toasts, []);
  });

  it("지목 줄 순서는 좌석 오름차순(서버 view 순서와 무관)", () => {
    const events = dayEvents(nominationOf([]), nominationOf([[3, 2], [1, 2]]));
    same(events.lines.filter((l) => l.kind === "vote").map((l) => l.text), ["민준 → 도윤", "지호 → 도윤"]);
  });
});
