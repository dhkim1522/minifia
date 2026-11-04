// 마지막 3인 화면 순수 모델 시험 — 09.1.1-15, UI-SPEC E-1~E-3, 결정 0066-5. view 는 리터럴로 만든다(공개 값만).
import { describe, expect, it } from "vitest";
import { LAST_WORD_CHIPS } from "../../shared/game/showdown";
import type { PublicPlayer, RoomView, ShowdownView } from "../../shared/protocol";
import { SHOWDOWN_COPY, isMySpeakTurn, myWordDone, quoteOf, showdownStageOf } from "../../src/game/showdownView";

const NAMES = ["서연", "민준", "도윤", "지호"];
const pl = (seat: number, alive = true): PublicPlayer => ({ seat, nickname: NAMES[seat]!, connected: true, isHost: seat === 0, ...(alive ? {} : { alive: false }) });

function view(showdown: ShowdownView | undefined, o: { mySeat?: number; phase?: RoomView["phase"]; dead?: number[] } = {}): RoomView {
  return {
    code: "0042",
    phase: o.phase ?? "showdown",
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players: [0, 1, 2, 3].map((seat) => pl(seat, !(o.dead ?? [1]).includes(seat))),
    me: { seat: o.mySeat ?? 0, isHost: false },
    day: { n: 2, roles: [], ...(showdown !== undefined ? { showdown } : {}) },
  };
}
const ORDER = [0, 2, 3];
const sd = (i: number, extra: Partial<ShowdownView> = {}): ShowdownView => ({ order: ORDER, i, ...extra });

describe("showdownStageOf", () => {
  it("i -1 gather · 0..2 speak · 3 point · 4 reveal", () => {
    expect(showdownStageOf(view(sd(-1)))).toBe("gather");
    for (const i of [0, 1, 2]) expect(showdownStageOf(view(sd(i)))).toBe("speak");
    expect(showdownStageOf(view(sd(3)))).toBe("point");
    expect(showdownStageOf(view(sd(4)))).toBe("reveal");
  });
  it("showdown 단계가 아니거나 day.showdown 이 없으면 null", () => {
    expect(showdownStageOf(view(undefined))).toBeNull();
    expect(showdownStageOf(view(sd(0), { phase: "discussion" }))).toBeNull();
  });
});

describe("isMySpeakTurn / myWordDone", () => {
  it("speak 이고 order[i] 가 내 좌석이고 아직 확정 전이면 true", () => {
    expect(isMySpeakTurn(view(sd(0, { endsAt: 9000 }), { mySeat: 0 }))).toBe(true);
    expect(isMySpeakTurn(view(sd(0, { endsAt: 9000 }), { mySeat: 2 }))).toBe(false);
    expect(isMySpeakTurn(view(sd(1, { endsAt: 9000 }), { mySeat: 2 }))).toBe(true);
  });
  it("확정 뒤(doneAt)·gather·point·reveal 은 false, myWordDone 은 내 차례의 doneAt", () => {
    expect(isMySpeakTurn(view(sd(0, { endsAt: 9000, doneAt: 5000, word: "안녕" }), { mySeat: 0 }))).toBe(false);
    expect(myWordDone(view(sd(0, { endsAt: 9000, doneAt: 5000, word: "안녕" }), { mySeat: 0 }))).toBe(true);
    expect(myWordDone(view(sd(0, { endsAt: 9000, doneAt: 5000, skip: true }), { mySeat: 2 }))).toBe(false);
    expect(isMySpeakTurn(view(sd(-1), { mySeat: 0 }))).toBe(false);
    expect(isMySpeakTurn(view(sd(3, { endsAt: 9000 }), { mySeat: 0 }))).toBe(false);
  });
  it("탈락한 사람은 내 차례가 아니다", () => {
    expect(isMySpeakTurn(view(sd(0, { endsAt: 9000 }), { mySeat: 0, dead: [0, 1] }))).toBe(false);
  });
});

describe("quoteOf", () => {
  it("word 가 있고 skip 이 아니면 {seat, name, text}", () => {
    expect(quoteOf(view(sd(1, { endsAt: 9000, doneAt: 5000, word: "저는 아니에요" })))).toEqual({ seat: 2, name: "도윤", text: "저는 아니에요" });
  });
  it("시간 초과(skip)·word 없음·speak 가 아닌 단계는 null", () => {
    expect(quoteOf(view(sd(1, { endsAt: 9000, doneAt: 5000, skip: true })))).toBeNull();
    expect(quoteOf(view(sd(1, { endsAt: 9000 })))).toBeNull();
    expect(quoteOf(view(sd(3, { endsAt: 9000, word: "남은 글" })))).toBeNull();
    expect(quoteOf(view(undefined))).toBeNull();
  });
});

describe("SHOWDOWN_COPY — UI-SPEC Copywriting Contract 원문", () => {
  it("제목·위 한 줄·알약·안내·채팅 줄", () => {
    expect(SHOWDOWN_COPY.title).toBe("마지막 셋");
    expect(SHOWDOWN_COPY.gatherLine).toBe("마지막 셋이에요");
    expect(SHOWDOWN_COPY.pointPill).toBe("지목");
    expect(SHOWDOWN_COPY.allAtOnce).toBe("모두 동시에");
    expect(SHOWDOWN_COPY.speakHint).toBe("한마디를 골라요");
    expect(SHOWDOWN_COPY.pointHint).toBe("의심되는 사람을 눌러요");
    expect(SHOWDOWN_COPY.chatLine).toBe("마지막 셋");
    expect(SHOWDOWN_COPY.writeTitle).toBe("한마디");
    expect(SHOWDOWN_COPY.write).toBe("직접 쓰기");
  });
  it("칩은 서버 상수 LAST_WORD_CHIPS 네 개를 그대로 쓴다", () => {
    expect(SHOWDOWN_COPY.chips).toEqual(LAST_WORD_CHIPS);
    expect(SHOWDOWN_COPY.chips).toHaveLength(4);
  });
});
