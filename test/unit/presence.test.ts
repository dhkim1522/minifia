// 장면 상태 순수 모듈 시험 — GHOST-01·MAP-04·DAY-04·05, 08-UI-SPEC 카메라·조명.
// 서버 view 하나에서 그 viewer 의 보이는 좌석·카메라·조명·긴장이 정해진다. 산 사람 화면 상태에는 유령 좌석이 없다.
// 실패 출력은 한 줄이어야 해서(TAP) 비교는 JSON 문자열로 한다.
import { describe, expect, it } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { DayView, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { GHOST_FADE_END_MS, GHOST_RISE_MS } from "../../src/game/dayView";
import { GATHER_CENTER, ZOOM_MAJORITY, ZOOM_MIN_STAGE_H } from "../../src/world/camera";
import { GHOST_MIST, jobOutfit } from "../../src/world/ghostOutfit";
import {
  cameraModeOf,
  executionFade,
  ghostFloatY,
  leaderShift,
  lightingFor,
  lightingOf,
  pointingOf,
  sceneLook,
  STAGE_TOP_R,
  stageLiftY,
  tensionOf,
  visibleSeats,
} from "../../src/world/presence";
import type { SeatLook } from "../../src/world/presence";

const flat = (value: unknown): string => JSON.stringify(value).replaceAll('"', "");
const same = (actual: unknown, expected: unknown) => expect(flat(actual)).toBe(flat(expected));

interface ViewOpts {
  /** 산 사람으로 둘 좌석 수(0부터). 기본 5 */
  count?: number;
  /** 탈락(alive:false)으로 둘 좌석 */
  dead?: number[];
  day?: Partial<DayView>;
  mySeat?: number;
  /** 유령 viewer 의 서버 view 처럼 spectate 를 싣는다 */
  spectate?: boolean;
}

function viewOf(phase: PhaseId, opts: ViewOpts = {}): RoomView {
  const count = opts.count ?? 5;
  const dead = new Set(opts.dead ?? []);
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(dead.has(seat) ? { alive: false } : {}),
  }));
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: opts.mySeat ?? 0, isHost: false },
    day: { n: 1, roles: [], ...opts.day },
    ...(opts.spectate ? { spectate: { seats: [] } } : {}),
  };
}

const points = (...pairs: [number, number][]) => pairs.map(([seat, target]) => ({ seat, target }));

describe("visibleSeats (GHOST-01, T-08-25)", () => {
  it("산 사람 viewer: 탈락한 좌석 3 은 없고 산 좌석은 ghost false 로만 있다", () => {
    const seats = visibleSeats(viewOf("discussion", { dead: [3], mySeat: 0 }));
    same(Object.keys(seats).map(Number), [0, 1, 2, 4]);
    same(Object.values(seats).map((s) => s.ghost), [false, false, false, false]);
  });

  it("산 사람 viewer 의 상태에는 유령 좌석이 '숨김' 표시로도 없다 (키 자체가 없다)", () => {
    const seats = visibleSeats(viewOf("discussion", { dead: [3] }));
    expect(3 in seats).toBe(false);
    same(Object.values(seats).filter((s) => s.ghost).length, 0);
  });

  it("유령 viewer(내 좌석 3 이 탈락): 모든 좌석이 보이고 3 은 ghost true, 산 좌석은 ghost false", () => {
    const seats = visibleSeats(viewOf("discussion", { dead: [3], mySeat: 3 }));
    same(Object.keys(seats).map(Number), [0, 1, 2, 3, 4]);
    same(seats[3]?.ghost, true);
    same([0, 1, 2, 4].map((n) => seats[n]?.ghost), [false, false, false, false]);
  });

  it("spectate 가 실린 view 도 유령 viewer 로 본다", () => {
    const seats = visibleSeats(viewOf("discussion", { dead: [1, 3], mySeat: 1, spectate: true }));
    same(Object.keys(seats).map(Number), [0, 1, 2, 3, 4]);
    same([seats[1]?.ghost, seats[3]?.ghost], [true, true]);
  });

  it("방에 없는 viewer(내 좌석이 players 에 없음)는 산 사람 규칙을 따른다", () => {
    const seats = visibleSeats(viewOf("discussion", { dead: [3], mySeat: 9 }));
    expect(3 in seats).toBe(false);
  });

  it("처형 연출 표시 {3: 시작 시각}: 산 사람 viewer 도 3 을 연출 끝(2400ms) 직전까지 본다", () => {
    const view = viewOf("execution", { dead: [3], mySeat: 0 });
    const fading = new Map([[3, 1000]]);
    expect(3 in visibleSeats(view, fading, 1000)).toBe(true);
    expect(3 in visibleSeats(view, fading, 1000 + GHOST_FADE_END_MS - 1)).toBe(true);
    expect(3 in visibleSeats(view, fading, 1000 + GHOST_FADE_END_MS)).toBe(false);
  });

  it("연출 중인 좌석은 fadeAt 으로 시작 시각이 실린다", () => {
    const seats = visibleSeats(viewOf("execution", { dead: [3] }), new Map([[3, 1000]]), 1500);
    same(seats[3]?.fadeAt, 1000);
    expect(seats[0]?.fadeAt).toBeUndefined();
  });

  it("연출 표시에 산 좌석이 섞여 있어도 산 좌석 상태는 바뀌지 않는다", () => {
    const seats = visibleSeats(viewOf("execution", { dead: [3] }), new Map([[1, 0]]), 100);
    same(Object.keys(seats).map(Number), [0, 1, 2, 4]);
  });
});

describe("cameraModeOf (UI-SPEC 카메라 표)", () => {
  const follow = ["lobby", "assigning", "roleReveal", "dayAnnounce", "discussion", "night", "morning", "ended"] as const;
  for (const phase of follow) {
    it(`${phase} → 따라가기`, () => {
      same(cameraModeOf(viewOf(phase), 500), { mode: "follow" });
    });
  }

  for (const phase of ["nomination", "runoff", "showdown", "defense", "verdict", "execution"] as const) {
    it(`${phase} → 모이는 자리 가운데 고정, 확대 1`, () => {
      same(cameraModeOf(viewOf(phase), 500), { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
    });
  }

  it("고정 목표는 {0,0}", () => {
    same(GATHER_CENTER, { x: 0, z: 0 });
  });

  // 09.1(M-4): 지목은 득표 배지 숫자만 — 과반이어도 카메라 확대가 없다. 확대 상수(ZOOM_MAJORITY)와 camera.ts 는 그대로다
  const majority = viewOf("nomination", { day: { points: points([0, 2], [1, 2], [3, 2]) } });
  it("지목 과반이어도 스테이지가 커도 확대 1 (고정·가운데)", () => {
    same(cameraModeOf(majority, 400), { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
    same(cameraModeOf(majority, ZOOM_MIN_STAGE_H), { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
    same(cameraModeOf(majority, 900), { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
  });
  it("확대 상수는 그대로 남아 있다(다른 곳에서 쓸 수 있다)", () => {
    expect(ZOOM_MAJORITY).toBeGreaterThan(1);
  });
  // 09.1.1-13(O-15): 판결 순간 느린 확대는 처형 단계에서 호출 쪽이 배율을 줄 때만, 스테이지 높이 360 이상에서만
  describe("판결 순간 확대 (verdictZoom)", () => {
    const exec = viewOf("execution", { day: { candidate: 2 } });
    it("처형 단계 + 높이 360 이상: zoom 과 zoomMs 600", () => {
      same(cameraModeOf(exec, ZOOM_MIN_STAGE_H, { verdictZoom: 1.1 }), { mode: "fixed", target: GATHER_CENTER, zoom: 1.1, zoomMs: 600 });
      same(cameraModeOf(exec, 900, { verdictZoom: 1 }), { mode: "fixed", target: GATHER_CENTER, zoom: 1, zoomMs: 600 });
    });
    it("높이 360 미만은 줌 없이 지금과 같다(핀 조명과 막만)", () => {
      same(cameraModeOf(exec, ZOOM_MIN_STAGE_H - 1, { verdictZoom: 1.1 }), { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
    });
    it("배율을 주지 않으면 지금과 같고, 처형이 아닌 단계는 배율을 줘도 무시한다", () => {
      same(cameraModeOf(exec, 800), { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
      same(cameraModeOf(viewOf("verdict"), 800, { verdictZoom: 1.1 }), { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
      same(cameraModeOf(viewOf("night"), 800, { verdictZoom: 1.1 }), { mode: "follow" });
    });
    it("역할에 따라 달라지지 않는다(유령·변론자·시민 같은 값)", () => {
      const base = cameraModeOf(exec, 800, { verdictZoom: 1.1 });
      same(cameraModeOf(viewOf("execution", { day: { candidate: 2 }, mySeat: 2 }), 800, { verdictZoom: 1.1 }), base);
      same(cameraModeOf(viewOf("execution", { day: { candidate: 2 }, spectate: true }), 800, { verdictZoom: 1.1 }), base);
    });
    it("sceneLook 이 배율을 카메라로 넘긴다", () => {
      same(sceneLook(exec, { stageH: 500, verdictZoom: 1.1 }).camera, { mode: "fixed", target: GATHER_CENTER, zoom: 1.1, zoomMs: 600 });
      same(sceneLook(exec, { stageH: 500 }).camera, { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
    });
  });
  it("과반이어도 지목 단계가 아니면 확대 1 (찬반)", () => {
    const verdict = viewOf("verdict", { day: { points: points([0, 2], [1, 2], [3, 2]), candidate: 2 } });
    same((cameraModeOf(verdict, 600) as { zoom: number }).zoom, 1);
  });
});

describe("lightingOf (UI-SPEC 단계 조명)", () => {
  const table: [PhaseId, string][] = [
    ["dayAnnounce", "talk"],
    ["discussion", "talk"],
    ["nomination", "vote"],
    ["runoff", "vote"],
    ["showdown", "vote"],
    ["verdict", "vote"],
    ["defense", "trial"],
    ["execution", "trial"],
    ["night", "night"],
    ["morning", "morning"],
    ["lobby", "talk"],
  ];
  for (const [phase, lighting] of table) {
    it(`${phase} → ${lighting}`, () => {
      same(lightingOf(phase), lighting);
    });
  }
});

describe("tensionOf (UI-SPEC 단계 조명: 선두·과반·찬반)", () => {
  // 09.1(M-4): 지목은 득표 배지 숫자만 — 선두·과반이어도 긴장 조명이 없다
  it("지목 3:1 (산 8명) 선두가 있어도 긴장 0·초점 없음", () => {
    const v = viewOf("nomination", { count: 8, day: { points: points([0, 2], [1, 2], [3, 2], [4, 5]) } });
    same(tensionOf(v), { level: 0 });
  });
  it("지목 과반(산 5명 중 3표)이어도 긴장 0·초점 없음", () => {
    const v = viewOf("nomination", { day: { points: points([0, 2], [1, 2], [3, 2]) } });
    same(tensionOf(v), { level: 0 });
  });
  it("지목 동점·줄 없음 → 긴장 0", () => {
    same(tensionOf(viewOf("nomination", { day: { points: points([0, 2], [1, 3]) } })), { level: 0 });
    same(tensionOf(viewOf("nomination", { day: { points: [] } })), { level: 0 });
  });
  it("찬반 → 긴장 1·초점은 변론자", () => {
    same(tensionOf(viewOf("verdict", { day: { candidate: 4 } })), { level: 1, focus: 4 });
  });
  it("찬반인데 변론자가 없으면 긴장 0", () => {
    same(tensionOf(viewOf("verdict")), { level: 0 });
  });
  for (const phase of ["discussion", "defense", "execution", "night", "morning", "dayAnnounce"] as const) {
    it(`${phase} → 긴장 0`, () => {
      same(tensionOf(viewOf(phase, { day: { candidate: 2 } })), { level: 0 });
    });
  }
});

describe("sceneLook (위를 묶는다)", () => {
  it("지목 과반 + 스테이지 400: 고정·확대 없음·vote 조명·긴장 0·초점 없음, 산 사람 viewer 에는 유령 좌석이 없다", () => {
    const view = viewOf("nomination", { dead: [4], day: { points: points([0, 2], [1, 2], [3, 2]) } });
    const look = sceneLook(view, { stageH: 400 });
    same(look.camera, { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
    same([look.lighting, look.tension, look.focusSeat], ["vote", 0, undefined]);
    same(Object.keys(look.seats).map(Number), [0, 1, 2, 3]);
  });
  it("토론: 따라가기·talk·긴장 0·초점 없음", () => {
    const look = sceneLook(viewOf("discussion"), { stageH: 400 });
    same(look.camera, { mode: "follow" });
    same([look.lighting, look.tension, look.focusSeat], ["talk", 0, undefined]);
  });
  it("유령 viewer 의 처형 장면: 모든 좌석, 탈락 좌석 ghost", () => {
    const view = viewOf("execution", { dead: [3], mySeat: 3, day: { execution: { seat: 3 } } });
    const look = sceneLook(view, { stageH: 300 });
    same(Object.keys(look.seats).map(Number), [0, 1, 2, 3, 4]);
    same(look.seats[3]?.ghost, true);
  });
});

describe("executionFade (DAY-05, UI-SPEC 처형: 1.4초 떠오름 → 2.4초 사라짐)", () => {
  const at = (ms: number, reduced = false) => executionFade(ms, reduced);
  it("시간 상수는 dayView 와 같은 출처다", () => {
    same([GHOST_RISE_MS, GHOST_FADE_END_MS], [1400, 2400]);
  });
  it("0ms: 불투명도 1·높이 0·보임", () => {
    same(at(0), { opacity: 1, rise: 0, hidden: false });
  });
  it("700ms: 불투명도 0.8·높이 0.6", () => {
    const f = at(700);
    expect(f.opacity).toBeCloseTo(0.8, 9);
    expect(f.rise).toBeCloseTo(0.6, 9);
    expect(f.hidden).toBe(false);
  });
  it("1399ms 는 아직 떠오르는 중, 1400ms: 불투명도 0.6·높이 1.2", () => {
    expect(at(1399).opacity).toBeGreaterThan(0.6);
    expect(at(1399).rise).toBeLessThan(1.2);
    expect(at(1400).opacity).toBeCloseTo(0.6, 9);
    expect(at(1400).rise).toBeCloseTo(1.2, 9);
  });
  it("1900ms: 불투명도 0.3·높이 1.2 그대로", () => {
    expect(at(1900).opacity).toBeCloseTo(0.3, 9);
    expect(at(1900).rise).toBeCloseTo(1.2, 9);
    expect(at(1900).hidden).toBe(false);
  });
  it("2399ms 는 아직 보이고 2400ms 부터 숨김(불투명도 0)", () => {
    expect(at(2399).hidden).toBe(false);
    expect(at(2399).opacity).toBeGreaterThan(0);
    same(at(2400), { opacity: 0, rise: 1.2, hidden: true });
    same(at(9999).hidden, true);
  });
  it("음수 경과는 0 과 같다", () => {
    same(at(-50), at(0));
  });
  it("모션 줄이기: 0.6 으로 즉시, 떠오름 없이 2399ms 까지 유지, 2400ms 에 숨김", () => {
    same(at(0, true), { opacity: 0.6, rise: 0, hidden: false });
    same(at(2399, true), { opacity: 0.6, rise: 0, hidden: false });
    same(at(2400, true), { opacity: 0, rise: 0, hidden: true });
  });
});

describe("ghostFloatY (UI-SPEC 유령 모양: +0.35, 흔들림 ±0.08, 주기 π초)", () => {
  it("t=0 이면 0.35, t=π/4 초면 0.35+0.08", () => {
    expect(ghostFloatY(0, false)).toBeCloseTo(0.35, 12);
    expect(ghostFloatY(Math.PI / 4, false)).toBeCloseTo(0.43, 12);
    expect(ghostFloatY((3 * Math.PI) / 4, false)).toBeCloseTo(0.27, 12);
  });
  it("주기 π초", () => {
    expect(ghostFloatY(0.3 + Math.PI, false)).toBeCloseTo(ghostFloatY(0.3, false), 9);
  });
  it("모션 줄이기면 언제나 0.35", () => {
    for (const t of [0, 0.4, Math.PI / 4, 3.3, 100]) expect(ghostFloatY(t, true)).toBe(0.35);
  });
});

describe("stageLiftY (변론자가 서는 무대 위 높이 0.29)", () => {
  it("반경 상수 1.18", () => {
    expect(STAGE_TOP_R).toBe(1.18);
  });
  it("무대 가운데·반경 안(1.17)이면 0.29", () => {
    expect(stageLiftY({ x: 0, z: 0 })).toBe(0.29);
    expect(stageLiftY({ x: 1.17, z: 0 })).toBe(0.29);
    expect(stageLiftY({ x: 0, z: -1.17 })).toBe(0.29);
  });
  it("반경 밖(1.19)·둘레 자리(2.65)면 0", () => {
    expect(stageLiftY({ x: 1.19, z: 0 })).toBe(0);
    expect(stageLiftY({ x: 2.65, z: 0 })).toBe(0);
    expect(stageLiftY({ x: 0.9, z: 0.9 })).toBe(0);
  });
});

describe("pointingOf (T-08-26: 남의 지목은 서버 값만)", () => {
  const nom = (pairs: [number, number][], mySeat = 0) => viewOf("nomination", { count: 6, mySeat, day: { points: points(...pairs) } });
  it("공개 day.points 의 좌석 → 대상 표", () => {
    same(pointingOf(nom([[1, 2], [3, 2]])), { 1: 2, 3: 2 });
  });
  it("내가 좌석 1 이고 mine 4 → 내 것만 덮는다", () => {
    same(pointingOf(nom([[1, 2], [3, 2]], 1), 4), { 1: 4, 3: 2 });
  });
  it("서버 줄에 내 지목이 아직 없어도 mine 이 더해진다(남의 것은 늘지 않는다)", () => {
    same(pointingOf(nom([[3, 2]], 1), 4), { 1: 4, 3: 2 });
  });
  it("mine 이 없으면 서버 값 그대로", () => {
    same(pointingOf(nom([[1, 2]], 1)), { 1: 2 });
  });
  it("내 자신을 가리키는 낙관적 선택, 유령인 내 선택은 무시한다", () => {
    same(pointingOf(nom([[3, 2]], 1), 1), { 3: 2 });
    const ghost = viewOf("nomination", { count: 6, mySeat: 1, dead: [1], day: { points: points([3, 2]) } });
    same(pointingOf(ghost, 4), { 3: 2 });
  });
  it("지목 단계가 아니면 {}", () => {
    same(pointingOf(viewOf("discussion", { day: { points: points([1, 2]) } }), 4), {});
    same(pointingOf(viewOf("verdict", { day: { points: points([1, 2]) } })), {});
  });
  it("points 가 없는 지목 view 는 서버 값 없이 mine 만 있다", () => {
    same(pointingOf(viewOf("nomination", { mySeat: 1 }), 4), { 1: 4 });
  });
});

describe("leaderShift (결정 0049: 선두가 새 사람으로 바뀌면 손사래 한 번)", () => {
  const nom = (pairs: [number, number][]) => viewOf("nomination", { count: 8, day: { points: points(...pairs) } });
  it("첫 스냅샷(prev 없음)이면 null", () => {
    expect(leaderShift(null, nom([[0, 2]]))).toBeNull();
  });
  it("선두 없음 → 2 이면 2", () => {
    expect(leaderShift(nom([]), nom([[0, 2]]))).toBe(2);
  });
  it("낮 토론 → 지목 첫 표로 선두가 생기면 그 좌석", () => {
    expect(leaderShift(viewOf("discussion", { count: 8 }), nom([[0, 2]]))).toBe(2);
  });
  it("2 → 2 는 null", () => {
    expect(leaderShift(nom([[0, 2]]), nom([[0, 2], [1, 2]]))).toBeNull();
  });
  it("2 → 동점 은 null", () => {
    expect(leaderShift(nom([[0, 2]]), nom([[0, 2], [1, 3]]))).toBeNull();
  });
  it("2 → 3 으로 바뀌면 3", () => {
    expect(leaderShift(nom([[0, 2]]), nom([[0, 3], [1, 3]]))).toBe(3);
  });
  it("지목이 아닌 view 로 가면 null", () => {
    expect(leaderShift(nom([[0, 2]]), viewOf("defense", { count: 8, day: { candidate: 2 } }))).toBeNull();
  });
});

describe("sceneLook 의 pointAt (지목 방향)", () => {
  const view = viewOf("nomination", { count: 6, mySeat: 1, day: { points: points([1, 2], [3, 2]) } });
  it("좌석별 가리키는 대상이 실린다", () => {
    const look = sceneLook(view, { stageH: 400 });
    same([look.seats[1]?.pointAt, look.seats[3]?.pointAt], [2, 2]);
    expect(look.seats[0]?.pointAt).toBeUndefined();
  });
  it("내 낙관적 선택(mine)이 내 좌석만 덮는다", () => {
    const look = sceneLook(view, { stageH: 400, mine: 4 });
    same([look.seats[1]?.pointAt, look.seats[3]?.pointAt], [4, 2]);
  });
  it("그리지 않는 좌석(탈락한 산 사람 화면 밖)에는 pointAt 이 생기지 않는다", () => {
    const v = viewOf("nomination", { count: 6, mySeat: 1, dead: [3], day: { points: points([1, 2], [3, 2]) } });
    const look = sceneLook(v, { stageH: 400 });
    expect(3 in look.seats).toBe(false);
  });
});

describe("sceneLook 의 pin (결정 0066-6, 09.1.1-11)", () => {
  const turn = (i: number, extra: Record<string, unknown> = {}) => ({ order: [0, 1, 2, 3], i, ...extra });
  it("지목 차례 중이면 차례 주인에게 turn 핀", () => {
    const look = sceneLook(viewOf("nomination", { day: { turn: turn(1, { endsAt: 9000 }) } }), { stageH: 400 });
    same(look.pin, { mode: "turn", seat: 1 });
  });
  it("확정 뒤 사이면 지목받은 사람으로 slide 핀(시작 시각은 서버 doneAt)", () => {
    const look = sceneLook(viewOf("nomination", { day: { turn: turn(0, { doneAt: 4000 }), points: points([0, 2]) } }), { stageH: 400 });
    same(look.pin, { mode: "slide", from: 0, to: 2, startAt: 4000, durationMs: 900 });
  });
  it("모이는 중·끝 알림·다른 단계는 null, 선두·과반이어도 비추지 않는다", () => {
    same(sceneLook(viewOf("nomination", { day: { turn: turn(-1) } }), { stageH: 400 }).pin, null);
    same(sceneLook(viewOf("nomination", { day: { turn: turn(4), points: points([0, 2], [1, 2], [3, 2]) } }), { stageH: 400 }).pin, null);
    same(sceneLook(viewOf("discussion"), { stageH: 400 }).pin, null);
  });
  it("시각을 받지 않아 같은 view 면 같은 값이다 (타이머 틱으로 달라지지 않는다)", () => {
    const v = viewOf("nomination", { day: { turn: turn(1, { endsAt: 9000 }) } });
    same(sceneLook(v, { stageH: 400, now: 1 }).pin, sceneLook(v, { stageH: 400, now: 99999 }).pin);
  });
});

describe("sceneLook 의 chalk (MORN-01, 결정 0061-14)", () => {
  it("day.chalk 고정소수점 {120, -340} 은 월드 단위 {1.2, -3.4} 로 look.chalk 에 실린다", () => {
    const look = sceneLook(viewOf("morning", { day: { chalk: { x: 120, z: -340 } } }), { stageH: 400 });
    expect(look.chalk).toEqual({ x: 1.2, z: -3.4 });
  });

  it("day.chalk 가 없으면 look 에 chalk 키 자체가 없다", () => {
    const look = sceneLook(viewOf("morning"), { stageH: 400 });
    expect("chalk" in look).toBe(false);
  });

  it("유령 viewer 도 산 사람 viewer 도 같은 자리를 본다", () => {
    const day = { chalk: { x: -50, z: 75 } };
    const alive = sceneLook(viewOf("discussion", { day }), { stageH: 400 });
    const ghost = sceneLook(viewOf("discussion", { day, dead: [0], spectate: true }), { stageH: 400 });
    expect(alive.chalk).toEqual({ x: -0.5, z: 0.75 });
    expect(ghost.chalk).toEqual({ x: -0.5, z: 0.75 });
  });
});

// ---- 09-10 Task 2: 밤 조명·좌석 표 (NIGHT-07, NIGHT-10, E3 #20) ----
const asRole = (view: RoomView, role: RoleId): RoomView => ({ ...view, me: { ...view.me, role } });

describe("lightingFor (UI-SPEC 단계 조명: 밤은 보는 사람마다 다르다)", () => {
  it("밤·산 시민·경찰·의사 → nightCitizen", () => {
    for (const role of ["citizen", "police", "doctor"] as const) expect(lightingFor(asRole(viewOf("night", { mySeat: 1 }), role)), role).toBe("nightCitizen");
  });
  it("밤·산 마피아 → night, 밤·유령 → nightGhost", () => {
    expect(lightingFor(asRole(viewOf("night", { mySeat: 1 }), "mafia"))).toBe("night");
    expect(lightingFor(asRole(viewOf("night", { mySeat: 1, dead: [1] }), "citizen"))).toBe("nightGhost");
    expect(lightingFor(asRole(viewOf("night", { mySeat: 1, dead: [1], spectate: true }), "mafia"))).toBe("nightGhost");
  });
  it("아침은 누구나 morning, 낮 단계는 lightingOf 와 같다", () => {
    for (const role of ["citizen", "mafia"] as const) expect(lightingFor(asRole(viewOf("morning"), role))).toBe("morning");
    expect(lightingFor(viewOf("discussion"))).toBe("talk");
    expect(lightingFor(viewOf("nomination"))).toBe("vote");
    expect(lightingFor(viewOf("defense"))).toBe("trial");
    expect(lightingFor(viewOf("verdict"))).toBe("vote");
  });
});

describe("visibleSeats — 밤 시민 편 좌석 표 (T-09-21, 결정 0002·0021)", () => {
  it("밤·산 시민·경찰·의사 viewer 는 내 좌석 하나뿐이다(서버가 남의 위치를 보내지 않는다)", () => {
    for (const role of ["citizen", "police", "doctor"] as const) {
      const seats = visibleSeats(asRole(viewOf("night", { mySeat: 2 }), role));
      same(Object.keys(seats).map(Number), [2]);
      same(seats[2], { show: true, ghost: false });
    }
  });
  it("밤·산 마피아는 산 좌석 전부, 밤·유령은 모두(탈락 좌석 ghost), 아침·산 사람은 산 좌석 전부", () => {
    same(Object.keys(visibleSeats(asRole(viewOf("night", { mySeat: 1, dead: [4] }), "mafia"))).map(Number), [0, 1, 2, 3]);
    const ghost = visibleSeats(asRole(viewOf("night", { mySeat: 4, dead: [4] }), "citizen"));
    same(Object.keys(ghost).map(Number), [0, 1, 2, 3, 4]);
    expect(ghost[4]?.ghost).toBe(true);
    same(Object.keys(visibleSeats(asRole(viewOf("morning", { mySeat: 1, dead: [4] }), "citizen"))).map(Number), [0, 1, 2, 3]);
  });
  it("낮 단계의 시민은 산 좌석 전부를 본다(밤에만 줄어든다)", () => {
    same(Object.keys(visibleSeats(asRole(viewOf("discussion", { mySeat: 1 }), "citizen"))).map(Number), [0, 1, 2, 3, 4]);
  });
});

describe("sceneLook — 시민·경찰·의사의 밤 장면 값이 같다 (NIGHT-07, NIGHT-10, E3 #20)", () => {
  it("seats·lighting·camera·tension 이 역할과 무관하게 같고 lighting 은 nightCitizen 이다", () => {
    const looks = (["citizen", "police", "doctor"] as const).map((role) => sceneLook(asRole(viewOf("night", { mySeat: 3 }), role), { stageH: 400 }));
    expect(flat(looks[1])).toBe(flat(looks[0]));
    expect(flat(looks[2])).toBe(flat(looks[0]));
    expect(looks[0]!.lighting).toBe("nightCitizen");
    same(Object.keys(looks[0]!.seats).map(Number), [3]);
    same(looks[0]!.camera, { mode: "follow" });
  });
});

// ---- 09.1-09: 유령 직업 의상 (결정 0063-2, UI-SPEC B-2·L13) ----
describe("유령 직업 의상 (결정 0063-2, L13)", () => {
  const JOBS_BY_SEAT: RoleId[] = ["mafia", "police", "doctor", "citizen", "citizen"];
  const ghostView = (phase: PhaseId = "discussion"): RoomView => {
    const v = viewOf(phase, { dead: [1, 3], mySeat: 3 });
    return { ...v, spectate: { seats: JOBS_BY_SEAT.map((job, seat) => ({ seat, job })) } };
  };

  it("jobOutfit: 직업 한 표, 없거나 알 수 없는 값은 coat", () => {
    same(["mafia", "police", "doctor", "citizen"].map(jobOutfit), ["mafia", "police", "doctor", "coat"]);
    same([jobOutfit(undefined), jobOutfit("unknown")], ["coat", "coat"]);
  });

  it("GHOST_MIST 는 시안 mist 값(0.26·#d8e4ff·0.85)", () => {
    same(GHOST_MIST, { opacity: 0.26, emissive: "#d8e4ff", intensity: 0.85 });
  });

  it("유령 viewer: 탈락 좌석마다 그 직업의 의상, 산 좌석에는 outfit 키가 없다", () => {
    const seats = visibleSeats(ghostView());
    same([seats[1]?.outfit, seats[3]?.outfit], ["police", "coat"]);
    for (const n of [0, 2, 4]) expect("outfit" in (seats[n] as object)).toBe(false);
  });

  it("직업 표가 마피아·의사인 탈락자도 같은 표로 입는다", () => {
    const v = viewOf("discussion", { dead: [0, 2, 3], mySeat: 3 });
    const seats = visibleSeats({ ...v, spectate: { seats: JOBS_BY_SEAT.map((job, seat) => ({ seat, job })) } });
    same([seats[0]?.outfit, seats[2]?.outfit, seats[3]?.outfit], ["mafia", "doctor", "coat"]);
  });

  it("spectate 없이 내 alive 만 false 면 탈락 좌석에도 outfit 키가 없다(재료가 없으면 만들지 않는다)", () => {
    const seats = visibleSeats(viewOf("discussion", { dead: [3], mySeat: 3 }));
    same(seats[3]?.ghost, true);
    expect("outfit" in (seats[3] as object)).toBe(false);
  });

  it("산 사람 viewer: 어떤 좌석에도 outfit 키가 없다 — 처형 연출 중인 좌석도", () => {
    const view = viewOf("execution", { dead: [3], mySeat: 0 });
    for (const seats of [visibleSeats(view), visibleSeats(view, new Map([[3, 1000]]), 1500)]) {
      for (const look of Object.values(seats)) expect("outfit" in look).toBe(false);
    }
    expect(3 in visibleSeats(view, new Map([[3, 1000]]), 1500)).toBe(true);
  });
});

describe("pointingOf — 결선 (09.1.1-14, T-09.1.1-39: 남의 선택은 서버가 주지 않으므로 그리지 않는다)", () => {
  const runoffView = (mySeat = 0, extra: Partial<DayView> = {}, dead: number[] = []) =>
    viewOf("runoff", { count: 6, mySeat, dead, day: { runoff: { cand: [2, 3], step: 1 }, ...extra } });
  it("낙관 선택(mine)이 후보 중 하나면 내 좌석 한 줄만 그 후보를 가리키고 남은 아무도 그리지 않는다", () => {
    same(pointingOf(runoffView(0), 3), { 0: 3 });
    same(pointingOf(runoffView(1, { voted: [0, 1] } as Partial<DayView>), 2), { 1: 2 });
  });
  it("mine 이 없으면 아무도 가리키지 않는다(voted 는 던졌다는 사실뿐)", () => {
    same(pointingOf(runoffView(0, { runoff: { cand: [2, 3], step: 1, voted: [0, 1, 4] } })), {});
  });
  it("후보 본인·유령·후보 밖 대상·자기 자신은 덮지 않는다", () => {
    same(pointingOf(runoffView(2), 3), {});
    same(pointingOf(runoffView(0, {}, [0]), 3), {});
    same(pointingOf(runoffView(0), 4), {});
    same(pointingOf(runoffView(0), 0), {});
  });
});

describe("sceneLook — 결선 (09.1.1-14)", () => {
  it("조명 vote, 카메라 고정, 핀은 점 한 개, 내 좌석 pointAt = mine", () => {
    const v = viewOf("runoff", { count: 6, mySeat: 0, day: { runoff: { cand: [2, 3], step: 1 } } });
    const look = sceneLook(v, { stageH: 400, mine: 2 });
    same([look.lighting, look.tension], ["vote", 0]);
    same(look.camera, { mode: "fixed", target: GATHER_CENTER, zoom: 1 });
    expect(look.pin).toMatchObject({ mode: "point" });
    expect(look.seats[0]?.pointAt).toBe(2);
    expect(look.seats[1]?.pointAt).toBeUndefined();
  });
});

describe("pointingOf — 마지막 3인 동시 지목 (09.1.1-15, T-09.1.1-42: 마감 전 남의 선택은 그리지 않는다)", () => {
  const sdView = (i: number, extra: Partial<NonNullable<DayView["showdown"]>> = {}, mySeat = 0, dead: number[] = [1, 4]) =>
    viewOf("showdown", { count: 5, mySeat, dead, day: { showdown: { order: [0, 2, 3], i, ...extra } } });
  it("지목 창(i 3)에는 내 낙관 선택 한 줄만 그린다(내가 가리킨 사람이 산 다른 두 사람일 때)", () => {
    same(pointingOf(sdView(3, { endsAt: 9000, voted: [0, 2] }), 3), { 0: 3 });
    same(pointingOf(sdView(3, { endsAt: 9000, voted: [0, 2] })), {});
  });
  it("나를 가리키는 값·세 사람 밖의 대상·유령의 선택은 그리지 않는다", () => {
    same(pointingOf(sdView(3, { endsAt: 9000, voted: [] }), 0), {});
    same(pointingOf(sdView(3, { endsAt: 9000, voted: [] }), 4), {});
    same(pointingOf(sdView(3, { endsAt: 9000, voted: [] }, 1, [1, 4]), 2), {});
  });
  it("공개(i 4)에는 day.showdown.points 의 모든 줄을 같은 순간에 그린다(내 낙관 값은 쓰지 않는다)", () => {
    const points = [{ seat: 0, target: 2 }, { seat: 2, target: 3 }, { seat: 3, target: 2 }];
    same(pointingOf(sdView(4, { points }), 3), { 0: 2, 2: 3, 3: 2 });
  });
  it("한마디 차례·모이는 중에는 아무도 가리키지 않는다", () => {
    same(pointingOf(sdView(0, { endsAt: 9000 }), 2), {});
    same(pointingOf(sdView(-1)), {});
  });
});

// 11-05: SeatLook 의 결과 화면 전용 필드(costume·dim). 판 중 장면 표(visibleSeats)에는 키 자체가 없다 — 직업 의상이 판 중 경로로 번지지 않는다(T-11-15, L13).
describe("SeatLook costume·dim (11-05)", () => {
  it("결과 화면용 좌석 표가 이 필드를 담을 수 있다 (costume 은 OutfitId, dim 은 true)", () => {
    const seat: SeatLook = { show: true, ghost: false, costume: jobOutfit("police"), dim: true };
    same(seat, { show: true, ghost: false, costume: "police", dim: true });
  });

  it("판 중 장면 표(산 사람·유령 viewer 모두)에는 costume·dim 키가 없다", () => {
    for (const phase of ["discussion", "night", "morning", "execution"] as const) {
      for (const view of [viewOf(phase, { dead: [3] }), viewOf(phase, { dead: [3], mySeat: 3, spectate: true })]) {
        for (const look of Object.values(visibleSeats(view))) {
          expect("costume" in look).toBe(false);
          expect("dim" in look).toBe(false);
        }
      }
    }
  });
});
