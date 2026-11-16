// 의심 포스트잇 규칙 단위 시험(24-01, 결정 0089-10, D-01~D-05·D-22·D-25·D-26). 결과는 한 줄 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import {
  NOTE_FIRST_DAY,
  NOTE_MAX_VISIBLE,
  NOTE_PHASES,
  NOTE_REACH_FX,
  NOTE_REACH_ON_PCT,
  SUSPECT_MIN_GAP_MS,
  noteAllowedNow,
  stickNote,
  withinNoteReach,
} from "../../shared/game/postit";
import { restSegment } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";

const T0 = 1_000_000;

function player(i: number, extra: Partial<Player> = {}): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
    role: i === 0 ? "mafia" : "citizen",
    ...extra,
  };
}

function room(phase: PhaseId = "discussion", day = 2, n = 6, notes?: RoomState["notes"]): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt: 100_000,
    day,
    hostId: "p0",
    nextJoinSeq: n,
    players: Array.from({ length: n }, (_, i) => player(i)),
    ...(notes !== undefined ? { notes } : {}),
  } as RoomState;
}

/** 좌석 0 은 (0,0), 1 은 200 fx, 2 는 300 fx 떨어진 곳에 선다. 나머지는 0 근처. */
const world = (xs: Record<string, number> = { p0: 0, p1: 200, p2: 300, p3: 100, p4: 50, p5: 20 }): { segs: Record<string, Segment> } => ({
  segs: Object.fromEntries(Object.entries(xs).map(([id, x]) => [id, restSegment(x, 0, T0)])),
});

const out = (r: ReturnType<typeof stickNote>): string => (r.ok ? `ok|${(r.state.notes ?? []).map((x) => `${x.n}:${x.from}>${x.to}`).join(",")}` : r.error);

describe("postit — 상수 (D-02·D-22·D-25)", () => {
  it("토론 하나 · 둘째 날부터 · 240 fx · 켜는 문턱 92% · 보이는 3장 · 간격 600ms", () => {
    expect(`${[...NOTE_PHASES].join(",")}|${NOTE_FIRST_DAY}|${NOTE_REACH_FX}|${NOTE_REACH_ON_PCT}|${NOTE_MAX_VISIBLE}|${SUSPECT_MIN_GAP_MS}`).toBe("discussion|2|240|92|3|600");
  });
});

describe("noteAllowedNow (D-22)", () => {
  it("토론이고 둘째 날 이후일 때만 참이다", () => {
    expect(noteAllowedNow("discussion", 2)).toBe(true);
    expect(noteAllowedNow("discussion", 5)).toBe(true);
    expect(noteAllowedNow("discussion", 1)).toBe(false);
    expect(noteAllowedNow("discussion", undefined)).toBe(false);
    expect(noteAllowedNow("verdict", 2)).toBe(false);
    expect(noteAllowedNow("dayAnnounce", 2)).toBe(false);
  });
});

describe("withinNoteReach (D-03·D-25, 정수 제곱 비교)", () => {
  const at = (x: number, z = 0): Segment => restSegment(x, z, T0);
  it("240 fx 는 참, 241 fx 는 거짓", () => {
    expect(withinNoteReach(at(0), at(240), T0)).toBe(true);
    expect(withinNoteReach(at(0), at(241), T0)).toBe(false);
  });
  it("대각 거리도 같은 기준이다(144,192 → 240 참 / 145,192 → 거짓)", () => {
    expect(withinNoteReach(at(0, 0), at(144, 192), T0)).toBe(true);
    expect(withinNoteReach(at(0, 0), at(145, 192), T0)).toBe(false);
  });
  it("한쪽 구간이 없으면 거짓이다", () => {
    expect(withinNoteReach(undefined, at(0), T0)).toBe(false);
    expect(withinNoteReach(at(0), undefined, T0)).toBe(false);
  });
  it("pct 92 면 220 참 · 221 거짓", () => {
    expect(withinNoteReach(at(0), at(220), T0, 92)).toBe(true);
    expect(withinNoteReach(at(0), at(221), T0, 92)).toBe(false);
  });
  it("걷는 구간은 시각 now 의 위치로 잰다", () => {
    const walking: Segment = { p: [0, 0, 1000, 0], t0: T0, v: 180 }; // 초당 180 fx
    expect(withinNoteReach(at(300), walking, T0)).toBe(false);
    expect(withinNoteReach(at(300), walking, T0 + 1000)).toBe(true); // 180 fx 지점, 거리 120
  });
});

describe("stickNote — 붙이기 (D-01·D-03)", () => {
  it("가까운 산 사람에게 붙이면 notes 에 {n, from, to} 한 줄이 남는다", () => {
    expect(out(stickNote(room(), world(), "p0", 1, T0))).toBe("ok|2:0>1");
  });
  it("멀면 BAD_MESSAGE", () => {
    expect(out(stickNote(room(), world(), "p0", 2, T0))).toBe("BAD_MESSAGE");
  });
  it("봇이든 사람이든 산 사람이면 붙는다(봇 구별 없음, D-05)", () => {
    const state = room();
    state.players[1] = { ...state.players[1]!, isBot: true } as Player;
    expect(out(stickNote(state, world(), "p0", 1, T0))).toBe("ok|2:0>1");
  });
});

describe("stickNote — 거절은 사유를 드러내지 않는다 (D-02·D-22·D-26)", () => {
  const dead = (state: RoomState, i: number): RoomState => {
    state.players[i] = { ...state.players[i]!, alive: false };
    return state;
  };
  const cases: Array<[string, () => ReturnType<typeof stickNote>]> = [
    ["첫날", () => stickNote(room("discussion", 1), world(), "p0", 1, T0)],
    ["day 없음", () => stickNote({ ...room(), day: undefined }, world(), "p0", 1, T0)],
    ["찬반 단계", () => stickNote(room("verdict"), world(), "p0", 1, T0)],
    ["낮 시작 발표", () => stickNote(room("dayAnnounce"), world(), "p0", 1, T0)],
    ["죽은 행위자", () => stickNote(dead(room(), 0), world(), "p0", 1, T0)],
    ["죽은 대상", () => stickNote(dead(room(), 1), world(), "p0", 1, T0)],
    ["자기 자신", () => stickNote(room(), world(), "p0", 0, T0)],
    ["빈 좌석 7", () => stickNote(room(), world(), "p0", 7, T0)],
    ["정수가 아닌 1.5", () => stickNote(room(), world(), "p0", 1.5, T0)],
    ["범위 밖 8", () => stickNote(room(), world(), "p0", 8, T0)],
    ["방에 없는 행위자", () => stickNote(room(), world(), "zz", 1, T0)],
    ["내 구간 없음", () => stickNote(room(), { segs: {} }, "p0", 1, T0)],
  ];
  it.each(cases)("%s → 같은 결과 { ok:false, BAD_MESSAGE }", (_name, run) => {
    expect(run()).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });
});

describe("stickNote — 옮기기와 같은 대상 (D-01·D-27)", () => {
  it("붙인 뒤 다른 가까운 사람에게 붙이면 줄 수는 1 이고 받는 좌석만 바뀐다", () => {
    const first = stickNote(room(), world(), "p0", 1, T0);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(out(stickNote(first.state, world(), "p0", 3, T0))).toBe("ok|2:0>3");
  });
  it("옮긴 줄은 맨 끝(쌓기 맨 위)으로 간다", () => {
    const state = room("discussion", 2, 6, [
      { n: 2, from: 0, to: 1 },
      { n: 2, from: 1, to: 0 },
    ]);
    // 좌석 1 → 좌석 3 으로 옮기면 좌석 0 의 줄이 앞, 1 의 줄이 맨 끝
    expect(out(stickNote(state, world(), "p1", 3, T0))).toBe("ok|2:0>1,2:1>3");
    // 좌석 0 → 좌석 4 로 옮기면 0 의 줄이 맨 끝
    expect(out(stickNote(state, world(), "p0", 4, T0))).toBe("ok|2:1>0,2:0>4");
  });
  it("다른 일차의 줄은 건드리지 않는다(어제 줄은 남고 오늘 줄이 따로 생긴다)", () => {
    const state = room("discussion", 3, 6, [{ n: 2, from: 0, to: 1 }]);
    expect(out(stickNote(state, world(), "p0", 3, T0))).toBe("ok|2:0>1,3:0>3");
  });
  it("같은 대상을 다시 붙이면 들어온 state 와 같은 객체다(저장·방송 없음의 근거)", () => {
    const state = room("discussion", 2, 6, [{ n: 2, from: 0, to: 1 }]);
    const r = stickNote(state, world(), "p0", 1, T0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toBe(state);
  });
  it("notes 키가 없는 상태에서도 동작한다", () => {
    const state = room();
    expect("notes" in state).toBe(false);
    expect(out(stickNote(state, world(), "p0", 1, T0))).toBe("ok|2:0>1");
  });
  it("notes 외의 키는 들어온 state 와 같은 값이고 입력은 바뀌지 않는다(판정·투표·마감 무영향)", () => {
    const state = room();
    const snapshot = JSON.stringify(state);
    const r = stickNote(state, world(), "p0", 1, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { notes: _n, ...rest } = r.state;
    expect(rest).toEqual(state);
    expect(r.state.players).toBe(state.players);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
