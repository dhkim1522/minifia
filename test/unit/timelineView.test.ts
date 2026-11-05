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
