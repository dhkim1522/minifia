// 순차 지목 화면 순수 모델 시험 — 결정 0063-1, UI-SPEC A-2·A-3·A-5.
// view 는 리터럴로 만든다(players·me·day.turn·day.points 만). 시각은 인자 serverNow 로만 들어간다.
import { describe, expect, it } from "vitest";
import { PICK_TURN_MS, RUNOFF_VOTE_MS } from "../../shared/game/phases";
import type { PickTurnView, PointLine, PublicPlayer, RoomView, RunoffView } from "../../shared/protocol";
import { TURN_COPY, blockLook, blockModeOf, mapStageTop, turnCompact, turnLook, turnStageOf, turnTopLine } from "../../src/game/pickTurn";

const NAMES = ["서연", "민준", "도윤", "지호", "하윤"];
const pl = (seat: number, alive = true): PublicPlayer => ({
  seat,
  nickname: NAMES[seat]!,
  connected: true,
  isHost: seat === 0,
  ...(alive ? {} : { alive: false }),
});

interface Opts {
  turn?: PickTurnView;
  points?: PointLine[];
  mySeat?: number;
  dead?: number[];
  phase?: RoomView["phase"];
  role?: NonNullable<RoomView["me"]["role"]>;
  spectate?: boolean;
}

function view(o: Opts = {}): RoomView {
  const v: RoomView = {
    code: "0042",
    phase: o.phase ?? "nomination",
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((_, seat) => pl(seat, !(o.dead ?? []).includes(seat))),
    me: { seat: o.mySeat ?? 0, isHost: false, ...(o.role !== undefined ? { role: o.role } : {}) },
    day: { n: 1, roles: [], points: o.points ?? [], ...(o.turn !== undefined ? { turn: o.turn } : {}) },
  };
  if (o.spectate) (v as unknown as { spectate: unknown }).spectate = [];
  return v;
}

const ORDER = [0, 1, 2, 3];
const T0 = 100_000;
const during = (i: number, extra: Partial<PickTurnView> = {}): PickTurnView => ({ order: ORDER, i, endsAt: T0 + PICK_TURN_MS, ...extra });

describe("turnLook — 단계", () => {
  it("지목이 아니거나 day.turn 이 없으면 null", () => {
    expect(turnLook(view({ phase: "discussion", turn: during(0) }), T0)).toBeNull();
    expect(turnLook(view(), T0)).toBeNull();
    expect(turnStageOf(view())).toBeNull();
  });

  it("모이는 중: gather, no 0, total N, seat 없음, 남은 시간 0, 내 차례 아님", () => {
    const look = turnLook(view({ turn: { order: ORDER, i: -1 } }), T0)!;
    expect(look.stage).toBe("gather");
    expect(look.no).toBe(0);
    expect(look.total).toBe(4);
    expect(look.seat).toBeUndefined();
    expect(look.remainingMs).toBe(0);
    expect(look.myTurn).toBe(false);
  });

  it("차례 중: no = i + 1, seat·이름, 남은 시간·올림 초·비율", () => {
    const look = turnLook(view({ turn: during(1) }), T0 + 2_500)!;
    expect(look.stage).toBe("turn");
    expect(look.no).toBe(2);
    expect(look.seat).toBe(1);
    expect(look.name).toBe("민준");
    expect(look.remainingMs).toBe(5_500);
    expect(look.seconds).toBe(6);
    expect(look.ratio).toBeCloseTo(5_500 / 8_000, 6);
  });

  it("마감을 지나면 남은 시간 0 아래로 내려가지 않는다", () => {
    const look = turnLook(view({ turn: during(0) }), T0 + 20_000)!;
    expect(look.remainingMs).toBe(0);
    expect(look.seconds).toBe(0);
    expect(look.ratio).toBe(0);
    expect(look.tone).toBe("calm");
  });

  it("확정(doneAt): done, 멈춘 값 = endsAt − doneAt 이고 serverNow 와 무관", () => {
    const turn = during(1, { doneAt: T0 + 3_000 });
    const a = turnLook(view({ turn }), T0 + 3_100)!;
    const b = turnLook(view({ turn }), T0 + 7_000)!;
    expect(a.stage).toBe("done");
    expect(a.remainingMs).toBe(5_000);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.seconds).toBe(5);
    expect(a.tone).toBe("urgent");
    expect(a.myTurn).toBe(false);
  });

  it("기권(skip)은 0초·calm", () => {
    const look = turnLook(view({ turn: during(1, { doneAt: T0 + 8_000, skip: true }) }), T0 + 8_100)!;
    expect(look.stage).toBe("done");
    expect(look.remainingMs).toBe(0);
    expect(look.seconds).toBe(0);
    expect(look.tone).toBe("calm");
  });

  it("끝 알림: i = order.length → end", () => {
    const look = turnLook(view({ turn: { order: ORDER, i: 4 } }), T0)!;
    expect(look.stage).toBe("end");
    expect(look.total).toBe(4);
    expect(look.myTurn).toBe(false);
  });
});

describe("turnLook — 시간 색 (timerTone 한 호출, 놋쇠 없음)", () => {
  const toneAt = (remaining: number) => turnLook(view({ turn: during(0) }), T0 + PICK_TURN_MS - remaining)!;
  it.each([
    [8_000, "calm"],
    [7_000, "calm"],
    [5_001, "calm"],
    [5_000, "urgent"],
    [4_999, "urgent"],
    [1, "urgent"],
    [0, "calm"],
  ])("남은 %i ms → %s", (remaining, tone) => {
    expect(toneAt(remaining).tone).toBe(tone);
  });

  it("올림한 남은 초 기준: 5001 → 6초 calm, 5000 → 5초 urgent", () => {
    expect(toneAt(5_001).seconds).toBe(6);
    expect(toneAt(5_000).seconds).toBe(5);
  });

  it("어떤 값에서도 warn 이 나오지 않는다", () => {
    for (let r = 0; r <= PICK_TURN_MS; r += 137) expect(toneAt(r).tone).not.toBe("warn");
  });
});

describe("turnLook — 내 차례", () => {
  it("차례 중 order[i] 가 내 좌석이고 산 사람이면 true", () => {
    expect(turnLook(view({ turn: during(2), mySeat: 2 }), T0)!.myTurn).toBe(true);
    expect(turnLook(view({ turn: during(2), mySeat: 1 }), T0)!.myTurn).toBe(false);
  });
  it("확정된 뒤·유령 viewer 는 false", () => {
    expect(turnLook(view({ turn: during(2, { doneAt: T0 + 1_000 }), mySeat: 2 }), T0)!.myTurn).toBe(false);
    expect(turnLook(view({ turn: during(2), mySeat: 2, dead: [2] }), T0)!.myTurn).toBe(false);
    expect(turnLook(view({ turn: during(2), mySeat: 4, dead: [4] }), T0)!.myTurn).toBe(false);
  });
});

describe("turnTopLine — 위 한 줄 (UI-SPEC A-5)", () => {
  it("turn 이 없으면 null, 차례 중에는 문장이 없다", () => {
    expect(turnTopLine(view())).toBeNull();
    expect(turnTopLine(view({ turn: during(0) }))).toBeNull();
  });
  it("모이는 중", () => {
    expect(turnTopLine(view({ turn: { order: ORDER, i: -1 } }))).toBe("가운데로 모여요");
  });
  it("확정된 지목: 그 좌석의 가리킴 줄", () => {
    const v = view({ turn: during(1, { doneAt: T0 + 1_000 }), points: [{ seat: 0, target: 2 }, { seat: 1, target: 3 }] });
    expect(turnTopLine(v)).toBe("민준 님이 지호 님을 가리켜요");
  });
  it("확정된 기권", () => {
    expect(turnTopLine(view({ turn: during(1, { doneAt: T0 + 8_000, skip: true }) }))).toBe("민준 님이 고르지 못했어요");
  });
  it("끝 알림: 단독 최다 → 이름·표 수", () => {
    const points = [{ seat: 0, target: 2 }, { seat: 1, target: 2 }, { seat: 2, target: 0 }];
    expect(turnTopLine(view({ turn: { order: ORDER, i: 4 }, points }))).toBe("모두 골랐어요 · 도윤 님 2표");
  });
  it("끝 알림: 최다가 정확히 둘 동점이면 '동점이에요' (UI-SPEC D-1, 결선이 열린다)", () => {
    expect(turnTopLine(view({ turn: { order: ORDER, i: 4 }, points: [{ seat: 0, target: 2 }, { seat: 1, target: 3 }] }))).toBe("동점이에요");
  });
  it("끝 알림: 셋 이상 동률·0표는 '모두 골랐어요'", () => {
    const three = [{ seat: 0, target: 1 }, { seat: 1, target: 2 }, { seat: 2, target: 3 }];
    expect(turnTopLine(view({ turn: { order: ORDER, i: 4 }, points: three }))).toBe("모두 골랐어요");
    expect(turnTopLine(view({ turn: { order: ORDER, i: 4 }, points: [] }))).toBe("모두 골랐어요");
  });
});

describe("TURN_COPY", () => {
  it("알약 문구: 마침표·느낌표 없음", () => {
    expect(TURN_COPY.count(2, 4)).toBe("2 / 4");
    expect(TURN_COPY.turnOf("민준")).toBe("민준 님 차례");
    expect(TURN_COPY.seconds(6)).toBe("6초");
    for (const s of [TURN_COPY.count(1, 2), TURN_COPY.turnOf("x"), TURN_COPY.seconds(1)]) expect(s).not.toMatch(/[.!]/);
  });
});

describe("역할·spectate 를 읽지 않는다 (T-09.1-15)", () => {
  it("role·spectate 만 바꿔도 모든 결과가 같다", () => {
    const turns: PickTurnView[] = [
      { order: ORDER, i: -1 },
      during(1),
      during(1, { doneAt: T0 + 2_000 }),
      during(2, { doneAt: T0 + 8_000, skip: true }),
      { order: ORDER, i: 4 },
    ];
    const points = [{ seat: 0, target: 2 }, { seat: 1, target: 2 }];
    for (const turn of turns) {
      const snap = (o: Opts) => JSON.stringify([turnLook(view({ turn, points, mySeat: 1, ...o }), T0 + 3_000), turnTopLine(view({ turn, points, mySeat: 1, ...o })), turnStageOf(view({ turn, ...o }))]);
      const base = snap({});
      expect(snap({ role: "mafia" })).toBe(base);
      expect(snap({ role: "police" })).toBe(base);
      expect(snap({ spectate: true })).toBe(base);
    }
  });
});

describe("mapStageTop — 지목 스테이지 윗변 (UI-SPEC A-1, 09.1-08)", () => {
  it("알약이 없으면 헤더 아래 그대로", () => {
    expect(mapStageTop(62, null)).toBe(62);
  });
  it("알약·막대 아랫변 + 4: 160 → 164, 압축 124 → 128", () => {
    expect(mapStageTop(62, 160)).toBe(164);
    expect(mapStageTop(62, 124)).toBe(128);
  });
  it("알약이 헤더보다 위에 있어도 헤더 아래보다 올라가지 않는다", () => {
    expect(mapStageTop(62, 40)).toBe(62);
    expect(mapStageTop(62, 58)).toBe(62);
    expect(mapStageTop(62, 59)).toBe(63);
  });
});

describe("turnCompact — 작은 폰은 압축형 (UI-SPEC A-1 표)", () => {
  it("(창 높이 − 패널 − 62) < 360 이면 압축: 360×560(패널 188) 하나", () => {
    expect(turnCompact(560, 188)).toBe(true);
  });
  it("나머지 다섯 폰은 압축이 아니다", () => {
    expect(turnCompact(640, 188)).toBe(false); // 360×640
    expect(turnCompact(664, 188)).toBe(false); // 390×664
    expect(turnCompact(932, 244)).toBe(false); // 430×932
    expect(turnCompact(844, 244)).toBe(false); // 390×844
    expect(turnCompact(874, 244)).toBe(false); // 402×874
  });
  it("경계: 스테이지 높이 360 은 압축 아님, 359 는 압축", () => {
    expect(turnCompact(62 + 188 + 360, 188)).toBe(false);
    expect(turnCompact(62 + 188 + 359, 188)).toBe(true);
  });
});

// ---- 09.1.1-14: 결선(runoff) — 지목과 같은 부품(blockLook)에서 나오는 알약·막대·링·위 한 줄 ----
const RT = 200_000;
function runoffView(step: 0 | 1 | 2, o: { endsIn?: number; cand?: [number, number]; tally?: [number, number]; mySeat?: number; dead?: number[]; voted?: number[] } = {}): RoomView {
  const v = view({ phase: "runoff", mySeat: o.mySeat ?? 0, ...(o.dead !== undefined ? { dead: o.dead } : {}) });
  const runoff: RunoffView = { cand: o.cand ?? [2, 3], step, ...(o.voted !== undefined ? { voted: o.voted } : {}), ...(o.tally !== undefined ? { tally: o.tally } : {}) };
  return { ...v, phaseEndsAt: RT + (o.endsIn ?? RUNOFF_VOTE_MS), phaseDurationMs: step === 1 ? RUNOFF_VOTE_MS : 1000, day: { ...v.day!, runoff } };
}

describe("blockModeOf — 알약 부품이 그릴 모드", () => {
  it("지목 + day.turn → pick, 결선 + day.runoff → runoff, 그 밖은 null", () => {
    expect(blockModeOf(view({ turn: during(0) }))).toBe("pick");
    expect(blockModeOf(view())).toBeNull();
    expect(blockModeOf(runoffView(1))).toBe("runoff");
    const noRunoff = { ...runoffView(1), day: { n: 1, roles: [] } } as RoomView;
    expect(blockModeOf(noRunoff)).toBeNull();
    expect(blockModeOf(view({ phase: "discussion" }))).toBeNull();
  });
});

describe("blockLook — 지목은 값이 그대로, mode·totalMs 만 더한다", () => {
  it("pick: 기존 turnLook 필드 + mode pick + totalMs PICK_TURN_MS", () => {
    const v = view({ turn: during(1) });
    const a = blockLook(v, T0 + 2_500)!;
    expect(a).toMatchObject({ mode: "pick", totalMs: PICK_TURN_MS, stage: "turn", no: 2, seat: 1, seconds: 6 });
    const { mode: _m, totalMs: _t, ...rest } = a;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(turnLook(v, T0 + 2_500)));
  });
  it("지목도 결선도 아니면 null", () => {
    expect(blockLook(view({ phase: "discussion" }), T0)).toBeNull();
  });
});

describe("blockLook — 결선 (UI-SPEC D-1·D-3)", () => {
  it("앞머리(step 0): gather, 알약 없음, 위 한 줄 '동점이에요'", () => {
    const v = runoffView(0, { endsIn: 1000 });
    const look = blockLook(v, RT)!;
    expect(look).toMatchObject({ mode: "runoff", stage: "gather", no: 0, myTurn: false });
    expect(turnTopLine(v)).toBe("동점이에요");
  });
  it("투표(step 1): turn, 서버 endsAt 기준 올림 초·비율, 항상 calm", () => {
    const at = (remaining: number) => blockLook(runoffView(1, { endsIn: RUNOFF_VOTE_MS }), RT + RUNOFF_VOTE_MS - remaining)!;
    expect(at(5_000)).toMatchObject({ mode: "runoff", stage: "turn", seconds: 5, totalMs: RUNOFF_VOTE_MS, tone: "calm" });
    expect(at(5_000).ratio).toBe(1);
    expect(at(2_500)).toMatchObject({ seconds: 3, tone: "calm" });
    expect(at(2_500).ratio).toBeCloseTo(0.5, 6);
    expect(at(1)).toMatchObject({ seconds: 1, tone: "calm" });
    expect(at(0)).toMatchObject({ seconds: 0, tone: "calm", remainingMs: 0 });
    for (let r = 0; r <= RUNOFF_VOTE_MS; r += 111) expect(at(r).tone).toBe("calm");
    expect(turnTopLine(runoffView(1))).toBeNull();
  });
  it("결과(step 2): end, 알약 없음. 많이 받은 사람이 있으면 '{이름} 님 {k}표', 아니면 '또 동점이에요'", () => {
    const win0 = runoffView(2, { tally: [3, 1] });
    expect(blockLook(win0, RT)).toMatchObject({ mode: "runoff", stage: "end" });
    expect(turnTopLine(win0)).toBe("도윤 님 3표");
    expect(turnTopLine(runoffView(2, { tally: [1, 2] }))).toBe("지호 님 2표");
    expect(turnTopLine(runoffView(2, { tally: [2, 2] }))).toBe("또 동점이에요");
    expect(turnTopLine(runoffView(2, { tally: [0, 0] }))).toBe("또 동점이에요");
  });
  it("결과인데 tally 가 아직 없으면 위 한 줄 없음(null)", () => {
    expect(turnTopLine(runoffView(2))).toBeNull();
  });
  it("역할·spectate 를 읽지 않는다", () => {
    const snap = (o: Opts) => JSON.stringify([blockLook({ ...runoffView(1), ...(o.role !== undefined ? { me: { seat: 0, isHost: false, role: o.role } } : {}) } as RoomView, RT + 1_000), turnTopLine(runoffView(2, { tally: [2, 1] }))]);
    expect(snap({ role: "mafia" })).toBe(snap({}));
  });
});

describe("TURN_COPY — 결선 문구 (UI-SPEC Copywriting Contract 원문)", () => {
  it("원문 그대로, 마침표·느낌표 없음", () => {
    expect(TURN_COPY.tie).toBe("동점이에요");
    expect(TURN_COPY.runoffPill).toBe("결선");
    expect(TURN_COPY.runoffWait).toBe("결과를 기다려요");
    expect(TURN_COPY.runoffPick).toBe("둘 중 한 명을 눌러요");
    expect(TURN_COPY.runoffVotes("민준", 3)).toBe("민준 님 3표");
    expect(TURN_COPY.runoffTie).toBe("또 동점이에요");
    for (const s of [TURN_COPY.tie, TURN_COPY.runoffPill, TURN_COPY.runoffWait, TURN_COPY.runoffPick, TURN_COPY.runoffTie]) expect(s).not.toMatch(/[.!]/);
  });
});
