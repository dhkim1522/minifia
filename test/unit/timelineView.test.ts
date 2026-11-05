import { describe, expect, it } from "vitest";
import { dayLinesOf, timelineOf } from "../../src/game/timelineView";
import { tlLog, tlView, TL_RESULT, TL_VOTE_LOG } from "../helpers/timelineState";

// 기록 타임라인 순수 모듈 (11-11, 결정 D-8·D-9, 0066-1). 입력은 끝난 뒤 공개된 값(result·voteLog)과 resultLog 부분뿐이다(T-11-36).

describe("timelineOf — 일차 카드 (D-8)", () => {
  const cards = timelineOf(tlView(), tlLog());

  it("summary 행 순서대로 일차 카드가 하나씩 나온다", () => {
    expect(cards.map((c) => c.n)).toEqual([1, 2, 3]);
  });

  it("낮 칸: 찬반을 통과한 처형은 처형된 사람과 그 사람의 진짜 직업, 부결은 none", () => {
    expect(cards[0]!.day).toEqual({ kind: "executed", seat: 4, job: "citizen" });
    expect(cards[1]!.day).toEqual({ kind: "none" });
  });

  it("마지막 3인 결전(찬반 0·0 이고 후보가 있음)도 처형으로 읽는다", () => {
    expect(cards[2]!.day).toEqual({ kind: "executed", seat: 0, job: "mafia" });
  });

  it("밤 칸: 의사가 지킨 밤은 saved, 죽은 밤은 died, 마지막 일차가 낮에 끝났으면 null", () => {
    expect(cards[0]!.night).toEqual({ kind: "saved", seat: 2 });
    expect(cards[1]!.night).toEqual({ kind: "died", seat: 3 });
    expect(cards[2]!.night).toBeNull();
  });

  it("밤 행은 있으나 지목이 없으면 none, 처형이 없는 날은 day none", () => {
    const result = { ...TL_RESULT, summary: [{ n: 1, night: { died: false } }] };
    expect(timelineOf({ result, day: { voteLog: [] } }, tlLog())).toEqual([{ n: 1, day: { kind: "none" }, night: { kind: "none" } }]);
  });

  it("처형 후보가 있어도 찬반이 부결됐고 결전도 아니면 처형이 아니다", () => {
    const result = { ...TL_RESULT, summary: [{ n: 1, exec: { yes: 1, no: 2, passed: false, candidate: 4 } }] };
    expect(timelineOf({ result, day: { voteLog: [] } }, tlLog())[0]!.day).toEqual({ kind: "none" });
  });
});

describe("dayLinesOf — 지목 줄 (D-8)", () => {
  it("1일차: voteLog 순서대로 [{from,to}] 와 받은 사람별 득표 수(많은 순)", () => {
    const { pointing } = dayLinesOf(tlView(), tlLog(), 1);
    expect(pointing.arrows).toEqual([
      { from: 2, to: 4 },
      { from: 3, to: 4 },
      { from: 0, to: 4 },
      { from: 5, to: 4 },
      { from: 1, to: 2 },
      { from: 4, to: 2 },
    ]);
    expect(pointing.counts).toEqual([
      { seat: 4, count: 4 },
      { seat: 2, count: 2 },
    ]);
  });

  it("지목 기록이 없는 일차는 빈 줄이다", () => {
    const { pointing } = dayLinesOf(tlView({ day: { voteLog: [] } }), tlLog(), 1);
    expect(pointing).toEqual({ arrows: [], counts: [] });
  });

  it("동률은 좌석 순", () => {
    const view = tlView({ day: { voteLog: [{ n: 1, exec: { yes: 0, no: 0, passed: false }, cand: { votes: [{ seat: 3, target: 5 }, { seat: 4, target: 1 }] } }] } });
    expect(dayLinesOf(view, tlLog(), 1).pointing.counts).toEqual([
      { seat: 1, count: 1 },
      { seat: 5, count: 1 },
    ]);
  });
});

describe("dayLinesOf — 찬반 (D-8)", () => {
  it("ballots 부분에 그날 줄이 있으면 찬성·반대 좌석 두 묶음", () => {
    expect(dayLinesOf(tlView(), tlLog(), 1).ballots).toEqual({ yes: [2, 3, 0, 5], no: [1] });
    expect(dayLinesOf(tlView(), tlLog(), 2).ballots).toEqual({ yes: [1], no: [0, 5, 2] });
  });
  it("그날 줄이 없으면(마지막 3인 결전 날 등) null — 줄 생략", () => {
    expect(dayLinesOf(tlView(), tlLog(), 3).ballots).toBeNull();
  });
});

describe("dayLinesOf — 주장·말 바꿈 (D-8, D-9)", () => {
  it("그날 산 사람의 유효 주장(그 일차 이하 최신, none 제외)을 좌석 순으로", () => {
    expect(dayLinesOf(tlView(), tlLog(), 1).claims.map((c) => [c.seat, c.claimed])).toEqual([[0, "citizen"], [2, "police"], [4, "police"]]);
    // 2일차: 4 는 1일차에 처형돼 빠지고, 0 은 경찰로 바꿨으며 3 이 새로 의사를 주장
    expect(dayLinesOf(tlView(), tlLog(), 2).claims.map((c) => [c.seat, c.claimed])).toEqual([[0, "police"], [2, "police"], [3, "doctor"]]);
    // 3일차: 3 은 2일차 밤에 죽어 빠지고, 0 은 그날 처형돼도 그날은 산 채다
    expect(dayLinesOf(tlView(), tlLog(), 3).claims.map((c) => [c.seat, c.claimed])).toEqual([[0, "police"], [2, "police"]]);
  });

  it("거짓(lie) = 주장이 진짜 직업과 다르고 그 사람이 마피아일 때만. 마피아가 아닌 사람의 틀린 주장은 lie 가 아니다", () => {
    const claims = dayLinesOf(tlView(), tlLog(), 1).claims;
    expect(claims.find((c) => c.seat === 0)).toEqual({ seat: 0, claimed: "citizen", job: "mafia", lie: true });
    expect(claims.find((c) => c.seat === 2)).toEqual({ seat: 2, claimed: "police", job: "police", lie: false });
    expect(claims.find((c) => c.seat === 4)).toEqual({ seat: 4, claimed: "police", job: "citizen", lie: false }); // 시민이 경찰을 주장 — 점선 없음
  });

  it("마피아가 마피아를 주장하면 진짜라 lie 가 아니다", () => {
    const log = tlLog({ claim: { lines: [{ seat: 1, n: 1, v: "mafia" }], complete: true } });
    expect(dayLinesOf(tlView(), log, 1).claims).toEqual([{ seat: 1, claimed: "mafia", job: "mafia", lie: false }]);
  });

  it("주장을 none 으로 되돌린 사람은 그날 빠진다", () => {
    const log = tlLog({ claim: { lines: [{ seat: 2, n: 1, v: "police" }, { seat: 2, n: 2, v: "none" }], complete: true } });
    expect(dayLinesOf(tlView(), log, 1).claims.map((c) => c.seat)).toEqual([2]);
    expect(dayLinesOf(tlView(), log, 2).claims).toEqual([]);
  });

  it("말 바꿈: 그날 claim 이 직전 값(none 아님)과 달라진 사람 — 첫 주장은 바꿈이 아니다", () => {
    expect(dayLinesOf(tlView(), tlLog(), 1).swaps).toEqual([]);
    expect(dayLinesOf(tlView(), tlLog(), 2).swaps).toEqual([0]);
    expect(dayLinesOf(tlView(), tlLog(), 3).swaps).toEqual([]);
  });

  it("none 에서 시작한 새 주장은 바꿈이 아니고, 같은 값을 다시 고르면 줄이 없다", () => {
    const log = tlLog({ claim: { lines: [{ seat: 2, n: 1, v: "none" }, { seat: 2, n: 1, v: "police" }, { seat: 3, n: 1, v: "doctor" }, { seat: 3, n: 2, v: "citizen" }], complete: true } });
    expect(dayLinesOf(tlView(), log, 1).swaps).toEqual([]);
    expect(dayLinesOf(tlView(), log, 2).swaps).toEqual([3]);
  });

  it("같은 날 두 번 바꾸면 한 번만 나온다", () => {
    const log = tlLog({ claim: { lines: [{ seat: 2, n: 1, v: "police" }, { seat: 2, n: 2, v: "doctor" }, { seat: 2, n: 2, v: "citizen" }], complete: true } });
    expect(dayLinesOf(tlView(), log, 2).swaps).toEqual([2]);
  });
});

describe("dayLinesOf — 귓속말 (D-8)", () => {
  it("그날 오간 건수만큼 [{from,to}] (n 이 같은 줄, 기록 순서)", () => {
    expect(dayLinesOf(tlView(), tlLog(), 1).whispers).toEqual([{ from: 2, to: 3 }, { from: 0, to: 1 }]);
    expect(dayLinesOf(tlView(), tlLog(), 2).whispers).toEqual([{ from: 1, to: 0 }]);
    expect(dayLinesOf(tlView(), tlLog(), 3).whispers).toEqual([]);
  });
});

describe("dayLinesOf — 밤 (D-8)", () => {
  it("그 밤 산 마피아 얼굴들 → 대상, 결과 saved·died", () => {
    expect(dayLinesOf(tlView(), tlLog(), 1).night).toEqual({ mafias: [0, 1], target: 2, result: "saved" });
    expect(dayLinesOf(tlView(), tlLog(), 2).night).toEqual({ mafias: [0, 1], target: 3, result: "died" });
  });
  it("밤 행이 없는 마지막 일차는 null", () => {
    expect(dayLinesOf(tlView(), tlLog(), 3).night).toBeNull();
  });
  it("대상이 없으면 result none (대상 없음)", () => {
    const result = { ...TL_RESULT, summary: [{ n: 1, night: { died: false } }] };
    expect(dayLinesOf({ result, day: { voteLog: [] } }, tlLog(), 1).night).toEqual({ mafias: [0, 1], result: "none" });
  });
  it("처형된 마피아는 처형된 그 밤부터 빠지고, 밤에 죽은 사람은 그 밤까지 산 채다", () => {
    const result = {
      ...TL_RESULT,
      summary: [
        { n: 1, exec: { yes: 4, no: 1, passed: true, candidate: 1 }, night: { target: 3, died: true } },
        { n: 2, exec: { yes: 0, no: 3, passed: false, candidate: 2 }, night: { target: 5, died: false } },
      ],
    };
    const view = { result, day: { voteLog: [] } };
    expect(dayLinesOf(view, tlLog(), 1).night).toEqual({ mafias: [0], target: 3, result: "died" });
    expect(dayLinesOf(view, tlLog(), 2).night).toEqual({ mafias: [0], target: 5, result: "saved" });
    // 밤에 죽은 3 은 2일차 낮 주장·지목에서 빠진다(1일차 밤에 탈락)
    const log = tlLog({ claim: { lines: [{ seat: 3, n: 1, v: "doctor" }], complete: true } });
    expect(dayLinesOf(view, log, 1).claims.map((c) => c.seat)).toEqual([3]);
    expect(dayLinesOf(view, log, 2).claims).toEqual([]);
  });
});

describe("입력 고정 (T-11-36)", () => {
  it("timelineOf·dayLinesOf 는 view.result(seats·summary)·view.day.voteLog 와 resultLog 부분(claim·ballots·whisper)만 읽는다", () => {
    const read: string[] = [];
    const spy = <T extends object>(path: string, o: T): T =>
      new Proxy(o, {
        get(t, k, r) {
          if (typeof k === "string") read.push(`${path}.${k}`);
          return Reflect.get(t, k, r) as unknown;
        },
      });
    const view = spy("view", {
      result: spy("result", TL_RESULT),
      day: spy("day", { voteLog: TL_VOTE_LOG }),
    });
    const log = spy("log", tlLog());
    timelineOf(view, log);
    dayLinesOf(view, log, 1);
    const allowed = new Set(["view.result", "view.day", "result.seats", "result.summary", "day.voteLog", "log.claim", "log.ballots", "log.whisper"]);
    const outside = [...new Set(read)].filter((p) => !allowed.has(p) && !/^(then|constructor|toJSON|length|\d+)$/.test(p.split(".").pop() ?? ""));
    expect(outside).toEqual([]);
  });
});
