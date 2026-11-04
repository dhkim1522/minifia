import { describe, expect, it } from "vitest";
import type { BadgeId, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { BADGE_TEXT, badgeFxOf, chipsOf, claimLabel, claimLook, floatLabel, floatVisible, myClaim, sayLine } from "../../src/game/badgeView";

// 09.1.1-08: 직업 주장 배지의 순수 모델(UI-SPEC A). 서버 view.players[].badge 만 읽고 시각·난수가 없다.
const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은"];

interface Opt {
  phase?: PhaseId;
  count?: number;
  mySeat?: number;
  dead?: number[];
  badges?: Record<number, BadgeId>;
  swapped?: number[];
}

function makeView(o: Opt = {}): RoomView {
  const count = o.count ?? 6;
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: NAMES[seat] ?? `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead?.includes(seat) ? { alive: false } : {}),
    ...(o.badges?.[seat] !== undefined ? { badge: o.badges[seat] } : {}),
    ...(o.swapped?.includes(seat) ? { badgeSwapped: true as const } : {}),
  }));
  return {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: 1_700_000_090_000,
    phaseDurationMs: 90_000,
    serverNow: 1_700_000_000_000,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: o.mySeat ?? 0, isHost: true },
    day: { n: 1, roles: [] },
  } as RoomView;
}

describe("claimLook — 이름표 모서리 배지의 재료 (UI-SPEC A-1)", () => {
  it("산 사람의 badge 가 있으면 {claim, swapped}", () => {
    const v = makeView({ badges: { 1: "police", 2: "mafia" }, swapped: [2] });
    expect(claimLook(v, 1)).toEqual({ claim: "police", swapped: false });
    expect(claimLook(v, 2)).toEqual({ claim: "mafia", swapped: true });
  });

  it("한 번도 안 건 사람은 null", () => {
    expect(claimLook(makeView(), 3)).toBeNull();
  });

  it("죽은 좌석은 null — 유령 이름표에는 배지가 없다", () => {
    const v = makeView({ badges: { 1: "police" }, dead: [1] });
    expect(claimLook(v, 1)).toBeNull();
  });

  it("말 안 함은 처음부터면 그리지 않고, 직업을 말했다가 되돌렸으면(말 바꿈) quiet 배지", () => {
    expect(claimLook(makeView({ badges: { 1: "none" } }), 1)).toBeNull();
    expect(claimLook(makeView({ badges: { 1: "none" }, swapped: [1] }), 1)).toEqual({ claim: "none", swapped: true });
  });

  it("낙관 값(mine)은 내 좌석에만 겹치고, 직업을 걸었다가 바꾸면 말 바꿈으로 본다", () => {
    const v = makeView({ mySeat: 0, badges: { 0: "citizen", 1: "police" } });
    expect(claimLook(v, 0, "doctor")).toEqual({ claim: "doctor", swapped: true });
    expect(claimLook(v, 1, "doctor")).toEqual({ claim: "police", swapped: false });
    const first = makeView({ mySeat: 0 });
    expect(claimLook(first, 0, "mafia")).toEqual({ claim: "mafia", swapped: false });
    expect(claimLook(first, 0, "none")).toBeNull();
  });
});

describe("floatVisible — 떠 있는 버튼이 보이는 단계 (UI-SPEC A-2)", () => {
  it.each(["dayAnnounce", "discussion", "nomination", "showdown"] as PhaseId[])("%s 에서 산 사람에게 보인다", (phase) => {
    expect(floatVisible(makeView({ phase }))).toBe(true);
  });

  it.each(["defense", "verdict", "runoff", "execution", "night", "morning", "ended", "lobby", "roleReveal"] as PhaseId[])("%s 에서는 없다", (phase) => {
    expect(floatVisible(makeView({ phase }))).toBe(false);
  });

  it("유령(탈락한 나)에게는 없다", () => {
    expect(floatVisible(makeView({ phase: "discussion", dead: [0] }))).toBe(false);
  });
});

describe("라벨", () => {
  it("claimLabel — 직업 이름 + 주장, 말 바꿈이면 덧붙인다", () => {
    expect(claimLabel("police", false)).toBe("경찰 주장");
    expect(claimLabel("mafia", true)).toBe("마피아 주장, 말 바꿈");
    expect(claimLabel("none", true)).toBe("말 안 함, 말 바꿈");
  });

  it("floatLabel — 떠 있는 버튼 접근성 이름", () => {
    expect(floatLabel("none")).toBe("직업 배지 고르기, 지금 말 안 함");
    expect(floatLabel("doctor")).toBe("직업 배지 고르기, 지금 의사");
  });

  it("myClaim — 서버 값(없으면 none)", () => {
    expect(myClaim(makeView({ mySeat: 2, badges: { 2: "citizen" } }))).toBe("citizen");
    expect(myClaim(makeView({ mySeat: 2 }))).toBe("none");
  });
});

describe("chipsOf — 칩 순서와 4명판", () => {
  it("6명판은 시민·경찰·의사·마피아·말 안 함 5개", () => {
    expect(chipsOf(makeView({ count: 6 })).map((c) => c.id)).toEqual(["citizen", "police", "doctor", "mafia", "none"]);
  });

  it("4명판은 의사 칩이 없다", () => {
    const chips = chipsOf(makeView({ count: 4 }));
    expect(chips.map((c) => c.id)).toEqual(["citizen", "police", "mafia", "none"]);
    expect(chips.map((c) => c.label)).toEqual(["시민", "경찰", "마피아", "말 안 함"]);
  });
});

describe("badgeFxOf — 두 view 의 차이로 만드는 효과 (UI-SPEC A-1)", () => {
  it("prev 가 null(첫 스냅샷·재접속·연결 번호 바뀜)이면 효과 없음", () => {
    expect(badgeFxOf(null, makeView({ badges: { 1: "police" }, swapped: [1] }))).toEqual({ pop: [], notice: [], said: [] });
  });

  it("바뀐 게 없으면 효과 없음", () => {
    const v = makeView({ badges: { 1: "police" } });
    expect(badgeFxOf(v, makeView({ badges: { 1: "police" } }))).toEqual({ pop: [], notice: [], said: [] });
  });

  it("처음 거는 순간(없음 → 직업)은 팝만 — 글자 알약은 없다", () => {
    const fx = badgeFxOf(makeView(), makeView({ badges: { 1: "police" } }));
    expect(fx.pop).toEqual([1]);
    expect(fx.notice).toEqual([]);
    expect(fx.said).toEqual([{ seat: 1, claim: "police" }]);
  });

  it("말 바꿈이 새로 켜진 좌석은 팝 + 알약", () => {
    const fx = badgeFxOf(makeView({ badges: { 1: "police" } }), makeView({ badges: { 1: "mafia" }, swapped: [1] }));
    expect(fx.pop).toEqual([1]);
    expect(fx.notice).toEqual([1]);
    expect(fx.said).toEqual([{ seat: 1, claim: "mafia" }]);
  });

  it("직업 → 말 안 함 도 말 바꿈이고, 두 번째 바꿈(이미 swapped)도 알약이 뜬다", () => {
    const a = badgeFxOf(makeView({ badges: { 2: "doctor" } }), makeView({ badges: { 2: "none" }, swapped: [2] }));
    expect(a.notice).toEqual([2]);
    expect(a.said).toEqual([{ seat: 2, claim: "none" }]);
    const b = badgeFxOf(makeView({ badges: { 2: "mafia" }, swapped: [2] }), makeView({ badges: { 2: "citizen" }, swapped: [2] }));
    expect(b.pop).toEqual([2]);
    expect(b.notice).toEqual([2]);
  });

  it("말 안 함으로 되돌린 뒤 다시 직업을 걸면 바꿈이 아니다 — 팝만", () => {
    const fx = badgeFxOf(makeView({ badges: { 2: "none" }, swapped: [2] }), makeView({ badges: { 2: "police" }, swapped: [2] }));
    expect(fx.pop).toEqual([2]);
    expect(fx.notice).toEqual([]);
  });

  it("산 사람이 아닌 좌석·새로 생긴 좌석은 효과 없음", () => {
    const prev = makeView({ badges: { 1: "police" } });
    expect(badgeFxOf(prev, makeView({ badges: { 1: "mafia" }, swapped: [1], dead: [1] }))).toEqual({ pop: [], notice: [], said: [] });
    expect(badgeFxOf(makeView({ count: 4 }), makeView({ count: 6, badges: { 5: "police" } }))).toEqual({ pop: [], notice: [], said: [] });
  });

  it("바뀌지 않은 다른 좌석의 배지는 그대로 둔다", () => {
    const fx = badgeFxOf(makeView({ badges: { 1: "police", 2: "doctor" } }), makeView({ badges: { 1: "police", 2: "mafia" }, swapped: [2] }));
    expect(fx.pop).toEqual([2]);
  });
});

describe("문구", () => {
  it("sayLine — 받침에 맞는 조사(이라고/라고), 말 안 함도 같은 줄", () => {
    expect(sayLine("민수", "citizen")).toBe("민수 님이 시민이라고 말했어요");
    expect(sayLine("민수", "police")).toBe("민수 님이 경찰이라고 말했어요");
    expect(sayLine("민수", "doctor")).toBe("민수 님이 의사라고 말했어요");
    expect(sayLine("민수", "mafia")).toBe("민수 님이 마피아라고 말했어요");
    expect(sayLine("민수", "none")).toBe("민수 님이 말 안 함이라고 말했어요");
  });

  it("UI-SPEC Copywriting Contract 원문", () => {
    expect(BADGE_TEXT.reject).toBe("지금은 바꿀 수 없어요");
    expect(BADGE_TEXT.swapNotice).toBe("말 바꿈");
    expect(BADGE_TEXT.hint).toBe("바꾸면 말 바꿈이 보여요");
    expect(BADGE_TEXT.sheetTitle).toBe("직업 배지");
  });
});
