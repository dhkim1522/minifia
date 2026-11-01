import { describe, expect, it } from "vitest";
import type { PublicPlayer, RoomView } from "../../shared/protocol";
import { diffRoomViews, toastForDiff } from "../../src/net/roomDiff";

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
