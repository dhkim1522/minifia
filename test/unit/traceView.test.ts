import { describe, expect, it } from "vitest";
import { RECORD_MAX, MORNING_TRACE_MS } from "../../shared/game/phases";
import { TRACE_PIECE_IDS, type PhaseId, type PlaceId, type RecordLine, type RoomView, type TracePiece } from "../../shared/protocol";
import { recordRowsOf, traceWindowOf } from "../../src/game/recordView";
import { TRACE_MARK_NOTE, TRACE_TEXT } from "../../src/game/traceText";

// 15-07 Task 1: 흔적 조각 이름 표(D-06·D-09), 기록 줄(D-04), 흔적 구간(D-06). 모두 순수 함수 — 시각·DOM 을 읽지 않는다.

const NAMES = ["지우", "하윤", "민지", "도현", "서연", "예준"] as const;

interface Spec {
  phase?: PhaseId;
  record?: RecordLine[];
  trace?: TracePiece;
  eliminated?: number;
  endsAt?: number | null;
  noMorning?: boolean;
}

function makeView(o: Spec): RoomView {
  const me: Record<string, unknown> = { seat: 0, isHost: true, role: "citizen" };
  if (o.record !== undefined) me.record = o.record;
  const day: Record<string, unknown> = { n: 1 };
  if (!o.noMorning) day.morning = { ...(o.eliminated !== undefined ? { eliminated: o.eliminated } : {}), ...(o.trace !== undefined ? { trace: o.trace } : {}) };
  return {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: o.endsAt === undefined ? 1_700_000_090_000 : o.endsAt,
    phaseDurationMs: 90_000,
    serverNow: 1_700_000_000_000,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 })),
    me,
    day,
  } as unknown as RoomView;
}

const BANNED = ["마피아", "경찰", "의사", "시민", "범인", "증거", "확정", "가운", "정장", "탐정", "기자"];

describe("TRACE_TEXT (D-06, D-09 — 닫힌 표)", () => {
  it("키가 TRACE_PIECE_IDS 와 같은 집합이고 UI-SPEC 표의 이름과 같다", () => {
    expect(Object.keys(TRACE_TEXT).sort()).toEqual([...TRACE_PIECE_IDS].sort());
    expect(TRACE_TEXT).toEqual({
      button: "단추 하나",
      pin: "은빛 핀",
      whiteCloth: "흰 천 조각",
      blackCloth: "검은 천 조각",
      brownCloth: "갈색 천 조각",
      pencil: "노란 연필 조각",
      grayThread: "회색 실밥",
      navyThread: "남색 실밥",
      redCloth: "붉은 천 조각",
    });
  });

  it("이름 9개는 서로 다르다", () => {
    expect(new Set(Object.values(TRACE_TEXT)).size).toBe(TRACE_PIECE_IDS.length);
  });

  it("어느 이름·고정 문구에도 역할 연상어·'범인'·'증거'·'확정' 이 없다", () => {
    for (const text of [...Object.values(TRACE_TEXT), TRACE_MARK_NOTE]) for (const w of BANNED) expect(text).not.toContain(w);
  });

  it("고정 보조 줄은 '같은 옷을 입은 사람에게 표시' 이고 색 이름이 없다", () => {
    expect(TRACE_MARK_NOTE).toBe("같은 옷을 입은 사람에게 표시");
    for (const w of ["빨간", "붉은", "검은", "하얀", "파란", "노란", "테두리"]) expect(TRACE_MARK_NOTE).not.toContain(w);
  });

  it("가장 긴 이름이 8자 이하(카드 폭 328 안 한 줄 확인용)", () => {
    expect(Math.max(...Object.values(TRACE_TEXT).map((t) => t.length))).toBeLessThanOrEqual(8);
  });
});

describe("recordRowsOf (D-04)", () => {
  const line = (seat: number, place: PlaceId): RecordLine => ({ seat, place });

  it("me.record 가 없으면 null", () => {
    expect(recordRowsOf(makeView({}))).toBeNull();
  });

  it("빈 배열이면 빈 배열(카드는 있고 줄은 없다)", () => {
    expect(recordRowsOf(makeView({ record: [] }))).toEqual([]);
  });

  it("순서 번호 n 은 1부터, 닉네임은 players 에서 seat 로 찾는다", () => {
    expect(recordRowsOf(makeView({ record: [line(2, "glass"), line(1, "piano")] }))).toEqual([
      { n: 1, seat: 2, place: "glass", name: "민지" },
      { n: 2, seat: 1, place: "piano", name: "하윤" },
    ]);
  });

  it("players 에 없는 좌석의 닉네임은 빈 문자열", () => {
    expect(recordRowsOf(makeView({ record: [line(7, "sax")] }))?.[0]?.name).toBe("");
  });

  it("일곱 줄이면 앞 RECORD_MAX 줄", () => {
    const seven = Array.from({ length: RECORD_MAX + 1 }, (_, i) => line(i % 6, "door"));
    const rows = recordRowsOf(makeView({ record: seven }));
    expect(rows).toHaveLength(RECORD_MAX);
    expect(rows?.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("traceWindowOf (D-06)", () => {
  const T = 1_700_000_090_000;

  it("morning 이 아니면 null", () => {
    expect(traceWindowOf(makeView({ phase: "discussion", trace: "pin", eliminated: 1, endsAt: T }), T - 1000)).toBeNull();
  });

  it("trace 가 없으면 null(피해자 없음·구출)", () => {
    expect(traceWindowOf(makeView({ phase: "morning", endsAt: T }), T - 1000)).toBeNull();
    expect(traceWindowOf(makeView({ phase: "morning", noMorning: true, endsAt: T }), T - 1000)).toBeNull();
  });

  it("phaseEndsAt 이 없으면 null", () => {
    expect(traceWindowOf(makeView({ phase: "morning", trace: "pin", eliminated: 1, endsAt: null }), T)).toBeNull();
  });

  it("마감 7초 전: 시작까지 2000ms·아직 아님, 5초 전(MORNING_TRACE_MS): 0·구간 안, 1ms 전: 0·구간 안", () => {
    expect(MORNING_TRACE_MS).toBe(5000);
    const view = makeView({ phase: "morning", trace: "pencil", eliminated: 1, endsAt: T });
    expect(traceWindowOf(view, T - 7000)).toEqual({ piece: "pencil", startsInMs: 2000, on: false });
    expect(traceWindowOf(view, T - MORNING_TRACE_MS)).toEqual({ piece: "pencil", startsInMs: 0, on: true });
    expect(traceWindowOf(view, T - 1)).toEqual({ piece: "pencil", startsInMs: 0, on: true });
  });
});
