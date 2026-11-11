// 결과 시간표 순수 모듈 시험 (11-05, 결정 D-1·D-11·D-25). 시각은 인자라 가짜 타이머가 필요 없다.
import { describe, expect, it } from "vitest";
import { ringSlots } from "../../shared/game/gather";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, PublicPlayer, RoomView } from "../../shared/protocol";
import { mapOf } from "../../shared/game/maps";
import { snapToWalkable } from "../../shared/game/map";
import { positionAt, segmentEndsAt } from "../../shared/game/world";
import * as director from "../../src/game/resultDirector";
import { castOf, CLAP_MAX, finalState, holdSnap, markTimes, RESULT_TIMELINE, resultPanelHeight, SAT_RADIUS_FX, satSlots, slotsFor, stateAt, teamOf, walkSnap } from "../../src/game/resultDirector";
import { jobOutfit } from "../../src/world/ghostOutfit";

const JOBS: RoleId[] = ["citizen", "police", "doctor", "mafia", "citizen", "mafia"];

function viewOf(jobs: RoleId[], dead: number[] = [], winner: GameWinner = "citizenWin"): RoomView & { result: NonNullable<RoomView["result"]> } {
  // 좌석 순서를 일부러 섞어 둔다 — 디렉터가 좌석 오름차순으로 정렬해야 한다
  const seats = jobs.map((job, seat) => ({ seat, job })).reverse();
  const players: PublicPlayer[] = jobs.map((_, seat) => ({ seat, nickname: `손님${seat}`, connected: true, isHost: seat === 0, ...(dead.includes(seat) ? { alive: false } : {}) }));
  return {
    code: "0042",
    phase: "ended",
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: true, chat: "all" },
    result: { winner, seats, summary: [] },
  };
}

describe("RESULT_TIMELINE (A-1, D-1)", () => {
  it("값이 계약과 같다", () => {
    expect(RESULT_TIMELINE).toEqual({ gatherMs: 1200, flipStartMs: 1200, flipGapMs: 400, lightAtMs: 4600, announceEndMs: 5200, finalAtMs: 5600 });
  });

  it("시상식 내보내기가 없다 (18.1-16, 0083-7) — 시간표는 5600 최종 상태에서 끝난다", () => {
    for (const gone of ["CEREMONY", "CEREMONY_CENTER", "CEREMONY_START_MS", "ceremonyAt", "ceremonyEnd", "ceremonySnap", "ceremonyWindowStart", "ceremonyMarks", "skipAward"]) {
      expect(Object.keys(director), gone).not.toContain(gone);
    }
  });
});

describe("castOf · slotsFor", () => {
  it("좌석 오름차순으로 {seat, job, team, alive} 를 만든다 (탈락자 포함)", () => {
    const cast = castOf(viewOf(JOBS, [2, 5]));
    expect(cast.map((c) => c.seat)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(cast.map((c) => c.job)).toEqual(JOBS);
    expect(cast.map((c) => c.alive)).toEqual([true, true, false, true, true, false]);
    expect(cast.map((c) => c.team)).toEqual(["citizen", "citizen", "citizen", "mafia", "citizen", "mafia"]);
  });

  it("마피아 직업만 마피아 편이다", () => {
    expect(teamOf("mafia")).toBe("mafia");
    for (const job of ["citizen", "police", "doctor"] as const) expect(teamOf(job)).toBe("citizen");
  });

  it("i 번째 좌석은 ringSlots(n)[i] 자리다 — 모든 폰이 같은 배치", () => {
    const cast = castOf(viewOf(JOBS));
    const slots = slotsFor(cast);
    const table = ringSlots(JOBS.length);
    cast.forEach((c, i) => expect(slots[c.seat]).toEqual(table[i]));
    expect(slotsFor(castOf(viewOf(JOBS, [1])))).toEqual(slots); // 생사와 무관
  });

  it("참가자 수 2~8 어디서나 자리가 모두 다르다", () => {
    for (let n = 2; n <= 8; n++) {
      const jobs: RoleId[] = Array.from({ length: n }, (_, i) => (i === 0 ? "mafia" : "citizen"));
      const slots = Object.values(slotsFor(castOf(viewOf(jobs))));
      expect(new Set(slots.map((s) => s.join(","))).size).toBe(n);
    }
  });
});

describe("finalState (A-5)", () => {
  it("시민 승: 전원 뒤집힘·직업 의상, 마피아 편 어둠, 조명 켜짐, 승리 알림 없음, 제목 시민 승리", () => {
    const cast = castOf(viewOf(JOBS, [2]));
    const s = finalState(cast, "citizenWin");
    expect(s.stage).toBe("final");
    expect(s.flipped).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.costumes).toEqual({ 0: "coat", 1: "police", 2: "doctor", 3: "mafia", 4: "coat", 5: "mafia" });
    expect(s.dimmed).toEqual([3, 5]);
    expect(s.lit).toBe(true);
    expect(s.announce).toBe(false);
    expect(s.clap).toEqual([]);
    expect(s.title).toBe("citizenWin");
  });

  it("마피아 승: 진 팀은 시민 편 전원이다", () => {
    const cast = castOf(viewOf(JOBS, [], "mafiaWin"));
    const s = finalState(cast, "mafiaWin");
    expect(s.dimmed).toEqual([0, 1, 2, 4]);
    expect(s.title).toBe("mafiaWin");
  });

  it("의상은 ghostOutfit 의 jobOutfit 한 곳과 같다 (새 표 없음)", () => {
    const cast = castOf(viewOf(JOBS));
    const s = finalState(cast, "citizenWin");
    for (const c of cast) expect(s.costumes[c.seat]).toBe(jobOutfit(c.job));
  });
});

describe("holdSnap — 한 점 구간", () => {
  it("자리마다 한 점 구간(p 두 값, 정수)이고 모두 같은 t0 다", () => {
    const cast = castOf(viewOf(JOBS));
    const ents = holdSnap(slotsFor(cast), 123_456);
    expect(ents.map((e) => e.s)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const e of ents) {
      expect(e.p).toHaveLength(2);
      expect(e.p.every(Number.isInteger)).toBe(true);
      expect(e.t0).toBe(123_456);
    }
  });
});

// ---- Task 2: 시간표 표 (A-1, D-1) ----
describe("stateAt — 시간표 표", () => {
  // 좌석 0 시민 · 1 경찰 · 2 의사 · 3 마피아 · 4 시민 · 5 마피아, 시민 승
  const cast = castOf(viewOf(JOBS, [2]));
  const at = (t: number, winner: GameWinner = "citizenWin") => stateAt(t, cast, winner);

  it("t=0: 모임 — 아무도 안 뒤집힘, 조명·알림 없음, 제목 결과", () => {
    const s = at(0);
    expect(s).toEqual({ stage: "gather", flipped: [], costumes: {}, dimmed: [], lit: false, clap: [], announce: false, tabsVisible: false, title: "result" });
    expect(at(-50)).toEqual(s); // 음수는 0 으로 본다
  });

  it("t=1199 는 아직 모임, t=1200 에 flip — 0번째 사람만 뒤집히고 그 사람만 직업 의상", () => {
    expect(at(1199).stage).toBe("gather");
    expect(at(1199).flipped).toEqual([]);
    const s = at(1200);
    expect(s.stage).toBe("flip");
    expect(s.flipped).toEqual([0]);
    expect(s.costumes).toEqual({ 0: "coat" });
  });

  it("t=1200+400i 에 i+1 명이 뒤집힌다 (좌석 오름차순, 의상도 같은 사람들)", () => {
    for (let i = 0; i < 6; i++) {
      const s = at(RESULT_TIMELINE.flipStartMs + RESULT_TIMELINE.flipGapMs * i);
      expect(s.flipped).toEqual([0, 1, 2, 3, 4, 5].slice(0, i + 1));
      expect(Object.keys(s.costumes).map(Number)).toEqual(s.flipped);
      expect(at(RESULT_TIMELINE.flipStartMs + RESULT_TIMELINE.flipGapMs * i - 1).flipped.length).toBe(i);
    }
    expect(at(3999).stage).toBe("flip"); // 마지막 사람이 뒤집힌 뒤 4600 전까지
    expect(at(3999).dimmed).toEqual([]);
    expect(at(3999).lit).toBe(false);
  });

  it("t=4600 light — 전원 뒤집힘, 진 팀 어둠, 조명, 박수 대상(이긴 팀 오름차순), 승리 알림 켜짐, 제목은 아직 결과", () => {
    const s = at(4600);
    expect(s.stage).toBe("light");
    expect(s.flipped).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.dimmed).toEqual([3, 5]);
    expect(s.lit).toBe(true);
    expect(s.clap).toEqual([0, 1, 2, 4]);
    expect(s.announce).toBe(true);
    expect(s.title).toBe("result");
    expect(at(5199).announce).toBe(true);
    expect(at(5199).stage).toBe("light");
  });

  it("박수는 최대 4명, 이긴 팀이 적으면 그만큼", () => {
    const eight = castOf(viewOf(["citizen", "citizen", "citizen", "citizen", "citizen", "citizen", "mafia", "mafia"]));
    expect(stateAt(4600, eight, "citizenWin").clap).toHaveLength(CLAP_MAX);
    expect(stateAt(4600, eight, "citizenWin").clap).toEqual([0, 1, 2, 3]);
    expect(stateAt(4600, eight, "mafiaWin").clap).toEqual([6, 7]);
    expect(stateAt(4600, eight, "mafiaWin").dimmed).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("t=5200 승리 알림이 꺼지고(announce 단계), t=5600 부터 final — 제목이 승리 한 줄, 박수 큐 없음", () => {
    const a = at(5200);
    expect(a).toMatchObject({ stage: "announce", announce: false, lit: true, clap: [], title: "result" });
    expect(at(5599).title).toBe("result");
    const f = at(RESULT_TIMELINE.finalAtMs);
    expect(f).toEqual(finalState(cast, "citizenWin"));
    expect(at(60_000)).toEqual(f);
    expect(at(5600, "mafiaWin").title).toBe("mafiaWin");
  });

  it("markTimes — 상태가 바뀌는 시각 목록(오름차순·중복 없음)", () => {
    expect(markTimes(3)).toEqual([0, 1200, 1600, 2000, 4600, 5200, 5600]);
    expect(markTimes(8)).toEqual([0, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000, 4600, 5200, 5600]);
    expect(markTimes(0)).toEqual([0, 4600, 5200, 5600]);
    expect(markTimes.length).toBe(1); // 참가자 수만 받는다
    // 마크 사이에서는 상태가 바뀌지 않는다
    const times = markTimes(6);
    for (let i = 0; i + 1 < times.length; i++) expect(at(times[i]! + 1)).toEqual(at(times[i + 1]! - 1));
  });
});

describe("walkSnap — 모임 걷기 구간", () => {
  const cast = castOf(viewOf(JOBS));
  const slots = slotsFor(cast);
  const T0 = 1_000_000;

  it("출발 위치가 없거나 자리와 같으면 한 점 구간(자리 그대로)", () => {
    const ents = walkSnap(slots, { 1: { x: slots[1]![0] / 100, z: slots[1]![1] / 100 } }, T0);
    expect(ents.find((e) => e.s === 0)!.p).toEqual([slots[0]![0], slots[0]![1]]); // 위치 없음
    expect(ents.find((e) => e.s === 1)!.p).toEqual([slots[1]![0], slots[1]![1]]); // 이미 자리
  });

  it("출발이 다르면 [출발, 자리] 구간이고 1200ms 안에 정확히 도착한다", () => {
    const starts = { 0: { x: 5.5, z: -4.25 }, 3: { x: -3, z: 2 } };
    const ents = walkSnap(slots, starts, T0);
    for (const seat of [0, 3] as const) {
      const e = ents.find((x) => x.s === seat)!;
      expect(e.p).toHaveLength(4);
      expect(e.p.every(Number.isInteger)).toBe(true);
      expect(e.t0).toBe(T0);
      const seg = { p: e.p, t0: e.t0, v: e.v };
      expect(positionAt(seg, T0)).toEqual({ x: starts[seat].x, z: starts[seat].z });
      expect(segmentEndsAt(seg) - T0).toBeLessThanOrEqual(RESULT_TIMELINE.gatherMs);
      const end = positionAt(seg, T0 + RESULT_TIMELINE.gatherMs);
      expect(end.x).toBeCloseTo(slots[seat]![0] / 100, 6);
      expect(end.z).toBeCloseTo(slots[seat]![1] / 100, 6);
      expect(e.v).toBeGreaterThan(0);
    }
  });
});

// 11-07: 탭 행은 첫 뒤집기 시각(1200ms)까지 전체 하나뿐이고 그 시각에 나머지 넷이 나타난다 (D-2)
describe("tabsVisible (11-07, A-3)", () => {
  const cast = castOf(viewOf(JOBS));
  it("t < 1200 은 거짓, t = 1200 부터 참이다", () => {
    expect(stateAt(0, cast, "citizenWin").tabsVisible).toBe(false);
    expect(stateAt(1199, cast, "citizenWin").tabsVisible).toBe(false);
    expect(stateAt(1200, cast, "citizenWin").tabsVisible).toBe(true);
    expect(stateAt(4600, cast, "mafiaWin").tabsVisible).toBe(true);
  });
  it("최종 상태(재접속)는 처음부터 참이다", () => {
    expect(finalState(cast, "citizenWin").tabsVisible).toBe(true);
    expect(stateAt(RESULT_TIMELINE.finalAtMs, cast, "citizenWin").tabsVisible).toBe(true);
  });
});

describe("resultPanelHeight (11-07, D-3)", () => {
  it("min(round(0.7 × 방 높이), 520), 방 높이를 모르면 undefined", () => {
    expect(resultPanelHeight(560)).toBe(392);
    expect(resultPanelHeight(640)).toBe(448);
    expect(resultPanelHeight(664)).toBe(465);
    expect(resultPanelHeight(844)).toBe(520);
    expect(resultPanelHeight(932)).toBe(520);
    expect(resultPanelHeight(0)).toBeUndefined();
  });
});

// ---------- 11-12: 쉬었던 사람(sat) — 참가자에서 빠지고 무대 바깥에 따로 선다 (D-13, UI-SPEC A-5) ----------
describe("castOf: sat 는 참가자가 아니다 (11-12)", () => {
  it("players[].sat 인 좌석은 result.seats 에 있어도 출연자 표에서 뺀다 (링 자리·칩·시상 대상이 아니다)", () => {
    const v = viewOf(JOBS);
    v.players = v.players.map((p) => (p.seat === 5 ? { ...p, sat: true as const } : p));
    expect(castOf(v).map((c) => c.seat)).toEqual([0, 1, 2, 3, 4]);
    // 빠진 만큼 링 자리가 줄어든다
    expect(Object.keys(slotsFor(castOf(v)))).toHaveLength(5);
  });

  it("sat 가 없으면 그대로", () => {
    expect(castOf(viewOf(JOBS)).map((c) => c.seat)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("satSlots (11-12)", () => {
  const bar = mapOf("bar");
  const dist = (p: readonly [number, number]) => Math.hypot(p[0], p[1]);

  it("좌석 오름차순으로 바깥 반지름(3.6) 근처 자리를 하나씩 준다 — 모든 폰이 같다", () => {
    expect(SAT_RADIUS_FX).toBe(360);
    const a = satSlots([6, 5], "bar");
    const b = satSlots([5, 6], "bar");
    expect(a).toEqual(b);
    expect(Object.keys(a).map(Number).sort((x, y) => x - y)).toEqual([5, 6]);
  });

  it("모든 자리는 걸을 수 있는 칸이다 (snapToWalkable 로 보정)", () => {
    for (const mapId of ["bar", "plaza"] as const) {
      const slots = satSlots([3, 4, 6, 7], mapId);
      for (const seat of Object.keys(slots).map(Number)) {
        const [x, z] = slots[seat]!;
        const snapped = snapToWalkable(mapOf(mapId), { x, z });
        expect(snapped.snapped, `${mapId} 좌석 ${seat}`).toBe(false);
      }
    }
  });

  it("링 자리(반지름 2.65)보다 바깥이다", () => {
    const slots = satSlots([5], "bar");
    expect(dist(slots[5]!)).toBeGreaterThan(300);
  });

  it("서로 다른 자리에 선다 (겹치지 않는다)", () => {
    const slots = satSlots([2, 3, 6], "bar");
    const pts = Object.values(slots);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![1] - pts[j]![1])).toBeGreaterThan(100);
  });

  it("sat 가 없으면 빈 표", () => {
    expect(satSlots([], "bar")).toEqual({});
    void bar;
  });
});
