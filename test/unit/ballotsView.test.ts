// 찬반 목록 모델 시험 — UI-SPEC C-2. 입력은 day.ballots 와 players 뿐이다(역할을 읽지 않는다, T-09.1.1-33).
import { describe, expect, it } from "vitest";
import type { PublicPlayer, RoomView } from "../../shared/protocol";
import { ballotRowsNeed, ballotsOf, ballotsSummary } from "../../src/game/ballotsView";

const NAMES = ["서연", "민준", "도윤", "지호", "하윤", "태오", "하은", "지우"];
const players: PublicPlayer[] = NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 }));

const view = (ballots: { yes: number[]; no: number[] } | undefined, mySeat = 1, list: PublicPlayer[] = players): RoomView =>
  ({
    phase: "execution",
    players: list,
    me: { seat: mySeat, isHost: false },
    ...(ballots ? { day: { n: 1, roles: [], ballots } } : { day: { n: 1, roles: [] } }),
  }) as unknown as RoomView;

describe("ballotsOf", () => {
  it("day.ballots 가 없으면 null", () => {
    expect(ballotsOf(view(undefined))).toBeNull();
    expect(ballotsOf({ phase: "execution", players, me: { seat: 0, isHost: false } } as unknown as RoomView)).toBeNull();
  });

  it("좌석 오름차순으로 이름·구분색·나 표시를 붙인다", () => {
    const b = ballotsOf(view({ yes: [4, 2, 0], no: [3, 1] }, 1))!;
    expect(b.yes.map((v) => v.seat)).toEqual([0, 2, 4]);
    expect(b.yes.map((v) => v.name)).toEqual(["서연", "도윤", "하윤"]);
    expect(b.no.map((v) => v.seat)).toEqual([1, 3]);
    expect(b.yes[0]!.color).toBe("var(--seat-1)");
    expect(b.no[0]).toMatchObject({ seat: 1, me: true });
    expect(b.yes.some((v) => v.me)).toBe(false);
  });

  it("방에 없는 좌석 번호는 건너뛴다", () => {
    const b = ballotsOf(view({ yes: [0, 7], no: [] }, 0, players.slice(0, 3)))!;
    expect(b.yes.map((v) => v.seat)).toEqual([0]);
    expect(b.no).toEqual([]);
  });

  it("변론자·미투표자가 목록에 없으면 그대로 없다(입력 그대로)", () => {
    const b = ballotsOf(view({ yes: [0], no: [1] }))!;
    expect([...b.yes, ...b.no].map((v) => v.seat)).toEqual([0, 1]);
  });
});

describe("ballotsSummary", () => {
  it("스크린리더 한 줄", () => {
    const b = ballotsOf(view({ yes: [0, 3, 1], no: [4, 5] }))!;
    expect(ballotsSummary(b)).toBe("찬성 3명: 서연, 민준, 지호. 반대 2명: 하윤, 태오.");
  });

  it("0명이면 이름 목록 없이 '찬성 0명.'", () => {
    const b = ballotsOf(view({ yes: [], no: [2] }))!;
    expect(ballotsSummary(b)).toBe("찬성 0명. 반대 1명: 도윤.");
    expect(ballotsSummary({ yes: [], no: [] })).toBe("찬성 0명. 반대 0명.");
  });
});

describe("ballotRowsNeed", () => {
  it("72 + 40·R (UI-SPEC 필요 높이 식)", () => {
    expect(ballotRowsNeed(4)).toBe(232);
    expect(ballotRowsNeed(2)).toBe(152);
    expect(ballotRowsNeed(0)).toBe(72);
  });
});
