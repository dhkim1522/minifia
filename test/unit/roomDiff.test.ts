import { describe, expect, it } from "vitest";
import type { GameMode, PublicPlayer, RoomView } from "../../shared/protocol";
import { diffRoomViews, modeToastOf, toastForDiff } from "../../src/net/roomDiff";

const p = (seat: number, nickname: string, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  seat,
  nickname,
  connected: true,
  isHost: false,
  ...extra,
});

// 실패 보고서가 한 줄이 되도록 JSON 문자열로 비교한다.
const same = (actual: unknown, expected: unknown) => expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));

const view = (players: PublicPlayer[], mySeat = 0): RoomView => ({
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players,
  me: { seat: mySeat, isHost: players.find((x) => x.seat === mySeat)?.isHost ?? false },
});

describe("diffRoomViews — 스냅샷 두 개의 차이", () => {
  it("이전 스냅샷이 없으면(첫 화면·재접속 직후) 빈 결과", () => {
    const next = view([p(0, "민수", { isHost: true }), p(1, "서준")]);
    same(diffRoomViews(null, next), { joined: [], left: [], newHost: null });
  });

  it("새로 앉은 사람이 joined 에 들어간다", () => {
    const prev = view([p(0, "민수", { isHost: true }), p(1, "서준")]);
    const next = view([p(0, "민수", { isHost: true }), p(1, "서준"), p(2, "하윤")]);
    same(diffRoomViews(prev, next), { joined: [{ seat: 2, nickname: "하윤" }], left: [], newHost: null });
  });

  it("나(me.seat)가 새로 생긴 경우는 joined 에 없다", () => {
    const prev = view([p(0, "민수", { isHost: true })], 0);
    const next = view([p(0, "민수", { isHost: true }), p(1, "서준")], 1);
    same(diffRoomViews(prev, next).joined, []);
  });

  it("같은 seat 에 다른 사람이 들어오면 나간 사람과 들어온 사람으로 본다(자리 재사용)", () => {
    const prev = view([p(0, "민수", { isHost: true }), p(1, "서준")]);
    const next = view([p(0, "민수", { isHost: true }), p(1, "지아")]);
    same(diffRoomViews(prev, next), { joined: [{ seat: 1, nickname: "지아" }], left: [{ seat: 1, nickname: "서준" }], newHost: null });
  });

  it("나간 사람의 seat 와 이전 view 의 닉네임이 left 에 들어간다", () => {
    const prev = view([p(0, "민수", { isHost: true }), p(1, "서준")]);
    const next = view([p(0, "민수", { isHost: true })]);
    same(diffRoomViews(prev, next), { joined: [], left: [{ seat: 1, nickname: "서준" }], newHost: null });
  });

  it("방장이 바뀌면 newHost", () => {
    const prev = view([p(0, "민수", { isHost: true }), p(1, "서준")]);
    const next = view([p(0, "민수"), p(1, "서준", { isHost: true })]);
    same(diffRoomViews(prev, next), { joined: [], left: [], newHost: { seat: 1, nickname: "서준" } });
  });

  it("connected 변화만 있으면 모두 빈 결과", () => {
    const prev = view([p(0, "민수", { isHost: true }), p(1, "서준")]);
    const next = view([p(0, "민수", { isHost: true }), p(1, "서준", { connected: false })]);
    same(diffRoomViews(prev, next), { joined: [], left: [], newHost: null });
  });
});

describe("toastForDiff — 한 번에 하나, v2 말투 (결정 0051 · UI-SPEC Copywriting)", () => {
  it("방장 변경과 입장이 함께면 방장 변경을 왕관 아이콘과 함께 보인다", () => {
    same(
      toastForDiff({ joined: [{ seat: 2, nickname: "하윤" }], left: [], newHost: { seat: 1, nickname: "서준" } }),
      { text: "방장 · 서준", icon: "crown" },
    );
  });

  it("방장 변경과 퇴장이 함께여도 방장 변경이 우선이다", () => {
    same(
      toastForDiff({ joined: [], left: [{ seat: 0, nickname: "민수" }], newHost: { seat: 1, nickname: "서준" } }),
      { text: "방장 · 서준", icon: "crown" },
    );
  });

  it("입장만이면 마지막 사람 '{닉네임} 님 입장' (아이콘 없음)", () => {
    same(
      toastForDiff({
        joined: [
          { seat: 2, nickname: "하윤" },
          { seat: 3, nickname: "지아" },
        ],
        left: [],
        newHost: null,
      }),
      { text: "지아 님 입장" },
    );
    same(toastForDiff({ joined: [{ seat: 2, nickname: "하윤" }], left: [], newHost: null }), { text: "하윤 님 입장" });
  });

  it("입장과 퇴장이 함께면 입장이 우선이다", () => {
    same(
      toastForDiff({ joined: [{ seat: 1, nickname: "지아" }], left: [{ seat: 1, nickname: "서준" }], newHost: null }),
      { text: "지아 님 입장" },
    );
  });

  it("퇴장만이면 마지막 사람 '{닉네임} 님 퇴장'", () => {
    same(toastForDiff({ joined: [], left: [{ seat: 1, nickname: "영희" }], newHost: null }), { text: "영희 님 퇴장" });
    same(
      toastForDiff({
        joined: [],
        left: [
          { seat: 1, nickname: "영희" },
          { seat: 2, nickname: "철수" },
        ],
        newHost: null,
      }),
      { text: "철수 님 퇴장" },
    );
  });

  it("바뀐 것이 없으면 null", () => {
    expect(toastForDiff({ joined: [], left: [], newHost: null })).toBeNull();
  });

  it("8자 닉네임의 입장·퇴장 글은 13자 이하라 한 줄에 들어간다 (UI-SPEC E7)", () => {
    const nick = "가나다라마바사아";
    expect(nick.length).toBe(8);
    const join = toastForDiff({ joined: [{ seat: 1, nickname: nick }], left: [], newHost: null });
    const leave = toastForDiff({ joined: [], left: [{ seat: 1, nickname: nick }], newHost: null });
    expect(join?.text.length).toBeLessThanOrEqual(13);
    expect(leave?.text.length).toBeLessThanOrEqual(13);
  });
});

// 19-03 (P19-9): 판 종류가 바뀌었다는 한 줄은 서버 view 두 개의 차이로만 만든다. 방장 본인·처음 열 때·재연결 직후에는 만들지 않는다.
describe("modeToastOf — 판 종류 바뀜 알림 (19-03, P19-9)", () => {
  const players = [p(0, "민수", { isHost: true }), p(1, "서준")];
  // mode 를 안 주면 키가 없는 view(옛 방·시험 리터럴) — 읽는 쪽 기본값은 확장판이다
  const as = (mySeat: number, mode?: GameMode): RoomView => (mode === undefined ? view(players, mySeat) : { ...view(players, mySeat), mode });
  const text = (prev: RoomView | null, next: RoomView) => String(modeToastOf(prev, next));

  it("이전 스냅샷이 없으면(처음 열 때·재연결 직후) 알리지 않는다", () => {
    expect(text(null, as(1, "basic"))).toBe("null");
    expect(text(null, as(1, "extended"))).toBe("null");
  });

  it("참가자는 바뀐 판 이름 한 줄을 받는다: 확장판 → 기본 마피아", () => {
    expect(text(as(1, "extended"), as(1, "basic"))).toBe("판 종류: 기본 마피아");
  });

  it("참가자는 바뀐 판 이름 한 줄을 받는다: 기본 마피아 → 확장판", () => {
    expect(text(as(1, "basic"), as(1, "extended"))).toBe("판 종류: 확장판");
  });

  it("방장 본인에게는 띄우지 않는다(시트에서 봤다)", () => {
    expect(as(0, "basic").me.isHost).toBe(true);
    expect(text(as(0, "extended"), as(0, "basic"))).toBe("null");
    expect(text(as(0, "basic"), as(0, "extended"))).toBe("null");
  });

  it("판 종류가 그대로면 알리지 않는다", () => {
    expect(text(as(1, "basic"), as(1, "basic"))).toBe("null");
    expect(text(as(1, "extended"), as(1, "extended"))).toBe("null");
  });

  it("mode 키가 없으면 확장판으로 읽는다: 둘 다 없으면 그대로, 한쪽만 basic 이면 바뀐 것이다", () => {
    expect(text(as(1), as(1))).toBe("null");
    expect(text(as(1), as(1, "extended"))).toBe("null");
    expect(text(as(1), as(1, "basic"))).toBe("판 종류: 기본 마피아");
    expect(text(as(1, "basic"), as(1))).toBe("판 종류: 확장판");
  });

  it("판 종류와 함께 사람이 드나들어도 판 종류 한 줄은 그대로 나온다(기존 차이 계산은 건드리지 않는다)", () => {
    const next: RoomView = { ...view([...players, p(2, "하윤")], 1), mode: "basic" };
    expect(text(as(1, "extended"), next)).toBe("판 종류: 기본 마피아");
    same(diffRoomViews(as(1, "extended"), next).joined, [{ seat: 2, nickname: "하윤" }]);
  });
});
