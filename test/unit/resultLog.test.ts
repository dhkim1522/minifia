// 11-03 Task 2: buildResultLog 순수 함수 — 부분 나누기·청크 40줄·순서·줄 키 집합 (결정 D-9·D-10, 미결 O-14).
import { describe, expect, it } from "vitest";
import { appendLine, emptyChatLog } from "../../shared/game/chatLog";
import type { ChatLog } from "../../shared/game/chatLog";
import { ballotsCardText } from "../../shared/game/ballots";
import { RESULT_LOG_CHUNK, buildResultLog } from "../../shared/game/resultLog";
import type { ResultLogInput } from "../../shared/game/resultLog";
import type { ResultLogFrame } from "../../shared/protocol";

type Line = { ch: "all" | "mafia" | "ghost"; seat: number; text: string; n?: number; k?: "will" | "note" | "ballots"; r?: number };

/** appendLine 으로 줄을 쌓는다(마스크 r 는 기본 0 — 마스크는 resultLog 와 무관해야 한다). */
function logOf(lines: Line[]): ChatLog {
  let log = emptyChatLog();
  lines.forEach((l, i) => {
    log = appendLine(log, { ch: l.ch, seat: l.seat, text: l.text, at: 1000 + i, n: l.n ?? 1, r: l.r ?? 0, ...(l.k === undefined ? {} : { k: l.k }) }).log;
  });
  return log;
}
const players = (logs: Array<Array<{ n: number; v: "citizen" | "police" | "doctor" | "mafia" | "none" }>>): ResultLogInput["players"] =>
  logs.map((badgeLog, seat) => ({ seat, ...(badgeLog.length === 0 ? {} : { badgeLog }) }));
const input = (over: Partial<ResultLogInput> = {}): ResultLogInput => ({ players: players([[], [], [], []]), ...over });
const partOf = (frames: ResultLogFrame[], part: string): ResultLogFrame[] => frames.filter((f) => f.part === part);
const keys = (o: object): string => Object.keys(o).sort().join(",");

describe("buildResultLog — 부분과 순서", () => {
  it("아무 기록이 없어도 다섯 부분마다 { i:0, end:true, lines:[] } 한 프레임을 mafia → ghost → whisper → claim → ballots 순으로 낸다", () => {
    const frames = buildResultLog(input(), emptyChatLog());
    expect(frames.map((f) => `${f.part}:${f.i}:${f.end}:${f.lines.length}`)).toEqual([
      "mafia:0:true:0",
      "ghost:0:true:0",
      "whisper:0:true:0",
      "claim:0:true:0",
      "ballots:0:true:0",
    ]);
  });

  it("프레임 키는 t·part·i·end·lines 뿐이다", () => {
    for (const f of buildResultLog(input(), emptyChatLog())) expect(keys(f)).toBe("end,i,lines,part,t");
    expect(buildResultLog(input(), emptyChatLog()).every((f) => f.t === "resultLog")).toBe(true);
  });
});

describe("buildResultLog — 청크 40줄", () => {
  it("RESULT_LOG_CHUNK 는 40 이다", () => {
    expect(RESULT_LOG_CHUNK).toBe(40);
  });

  it("마피아 줄이 85개면 40·40·5 세 프레임에 i 0·1·2 이고 end 는 마지막만 true 이며 다른 부분은 빈 한 프레임이다", () => {
    const lines: Line[] = Array.from({ length: 85 }, (_, i) => ({ ch: "mafia", seat: i % 3, text: `줄${i}`, n: 1 + Math.floor(i / 40) }));
    const frames = buildResultLog(input(), logOf(lines));
    const m = partOf(frames, "mafia");
    expect(m.map((f) => `${f.i}:${f.end}:${f.lines.length}`)).toEqual(["0:false:40", "1:false:40", "2:true:5"]);
    expect(m.flatMap((f) => f.lines.map((l) => (l as { text: string }).text))).toEqual(lines.map((l) => l.text));
    for (const part of ["ghost", "whisper", "claim", "ballots"]) expect(partOf(frames, part)).toHaveLength(1);
    expect(frames.map((f) => f.part)).toEqual(["mafia", "mafia", "mafia", "ghost", "whisper", "claim", "ballots"]);
  });

  it("정확히 40줄이면 한 프레임이고 end 가 true 이다 (빈 프레임을 덧붙이지 않는다)", () => {
    const lines: Line[] = Array.from({ length: 40 }, (_, i) => ({ ch: "ghost", seat: 1, text: `g${i}` }));
    const g = partOf(buildResultLog(input(), logOf(lines)), "ghost");
    expect(g.map((f) => `${f.i}:${f.end}:${f.lines.length}`)).toEqual(["0:true:40"]);
  });

  it("어떤 프레임도 40줄을 넘지 않는다", () => {
    const lines: Line[] = Array.from({ length: 300 }, (_, i) => ({ ch: "mafia", seat: 0, text: `m${i}` }));
    for (const f of buildResultLog(input(), logOf(lines))) expect(f.lines.length).toBeLessThanOrEqual(40);
  });
});

describe("buildResultLog — 줄 모양과 재료", () => {
  it("마피아·유령 줄은 채널 전체를 마스크와 무관하게 보관 순서로, 키는 seat·n·text·at 뿐이다", () => {
    const log = logOf([
      { ch: "mafia", seat: 1, text: "첫 밤", n: 1, r: 0 },
      { ch: "all", seat: 0, text: "공개 줄", n: 1 },
      { ch: "ghost", seat: 2, text: "유령 한마디", n: 2, r: 0b0100 },
      { ch: "mafia", seat: 3, text: "둘째 밤", n: 2, r: 0b1000 },
    ]);
    const frames = buildResultLog(input(), log);
    const m = partOf(frames, "mafia")[0]!;
    expect(m.lines).toEqual([
      { seat: 1, n: 1, text: "첫 밤", at: 1000 },
      { seat: 3, n: 2, text: "둘째 밤", at: 1003 },
    ]);
    expect(partOf(frames, "ghost")[0]!.lines).toEqual([{ seat: 2, n: 2, text: "유령 한마디", at: 1002 }]);
    for (const line of [...m.lines, ...partOf(frames, "ghost")[0]!.lines]) expect(keys(line)).toBe("at,n,seat,text");
  });

  it("귓속말은 채팅 보관과 무관하게 RoomState.whispers 원본에서 보낸 순서로, 키는 seat·to·n·text·at 뿐이다", () => {
    const whispers = [
      { n: 1, from: 0, to: 2, text: "비밀 하나", at: 50 },
      { n: 2, from: 3, to: 1, text: "비밀 둘", at: 60 },
    ];
    const w = partOf(buildResultLog(input({ whispers }), emptyChatLog()), "whisper")[0]!;
    expect(w.lines).toEqual([
      { seat: 0, to: 2, n: 1, text: "비밀 하나", at: 50 },
      { seat: 3, to: 1, n: 2, text: "비밀 둘", at: 60 },
    ]);
    for (const line of w.lines) expect(keys(line)).toBe("at,n,seat,text,to");
  });

  it("all 채널 보관 줄(귓속말 본문·사실 줄 포함)은 마피아·유령·찬반 어느 부분에도 섞이지 않는다", () => {
    const log = logOf([{ ch: "all", seat: 0, text: "공개", n: 1 }]);
    const frames = buildResultLog(input({ whispers: [{ n: 1, from: 0, to: 1, text: "속삭임", at: 5 }] }), log);
    expect(partOf(frames, "mafia")[0]!.lines).toEqual([]);
    expect(partOf(frames, "ghost")[0]!.lines).toEqual([]);
    expect(partOf(frames, "ballots")[0]!.lines).toEqual([]);
  });

  it("직업 주장은 모든 사람의 badgeLog 를 일차 오름차순 → 좌석 오름차순 → 원래 순서로 내고 키는 seat·n·v 뿐이다", () => {
    const ps = players([
      [{ n: 2, v: "police" }],
      [
        { n: 1, v: "doctor" },
        { n: 1, v: "citizen" },
        { n: 3, v: "none" },
      ],
      [],
      [{ n: 1, v: "mafia" }],
    ]);
    const c = partOf(buildResultLog({ players: ps }, emptyChatLog()), "claim")[0]!;
    expect(c.lines).toEqual([
      { seat: 1, n: 1, v: "doctor" },
      { seat: 1, n: 1, v: "citizen" },
      { seat: 3, n: 1, v: "mafia" },
      { seat: 0, n: 2, v: "police" },
      { seat: 1, n: 3, v: "none" },
    ]);
    for (const line of c.lines) expect(keys(line)).toBe("n,seat,v");
  });

  it("찬반 기록은 ballots 카드를 풀어 일차별로 { n, yes, no } 를 내고 모양이 틀린 카드는 건너뛴다", () => {
    const log = logOf([
      { ch: "all", seat: 2, text: ballotsCardText({ yes: [0, 1, 3], no: [] }), n: 1, k: "ballots" },
      { ch: "all", seat: 1, text: "깨진|카드|본문", n: 2, k: "ballots" },
      { ch: "all", seat: 1, text: "9|0", n: 2, k: "ballots" },
      { ch: "all", seat: 3, text: ballotsCardText({ yes: [0], no: [1, 2] }), n: 3, k: "ballots" },
      { ch: "all", seat: 0, text: "1|2", n: 3 }, // 카드 표시가 없는 공개 줄은 건너뛴다
    ]);
    const b = partOf(buildResultLog(input(), log), "ballots")[0]!;
    expect(b.lines).toEqual([
      { n: 1, yes: [0, 1, 3], no: [] },
      { n: 3, yes: [0], no: [1, 2] },
    ]);
    for (const line of b.lines) expect(keys(line)).toBe("n,no,yes");
  });

  it("유언·쪽지 카드(k will·note)는 어느 부분에도 들지 않는다", () => {
    const log = logOf([
      { ch: "all", seat: 1, text: "유언", n: 1, k: "will" },
      { ch: "all", seat: 1, text: "쪽지", n: 1, k: "note" },
    ]);
    for (const f of buildResultLog(input(), log)) expect(f.lines).toEqual([]);
  });
});

describe("buildResultLog — 순수성", () => {
  it("입력을 바꾸지 않고 같은 입력이면 같은 프레임 열을 낸다", () => {
    const log = logOf([
      { ch: "mafia", seat: 1, text: "밤", n: 1 },
      { ch: "all", seat: 2, text: "1,2|0", n: 1, k: "ballots" },
    ]);
    const inp = input({ whispers: [{ n: 1, from: 0, to: 1, text: "x", at: 1 }], players: players([[{ n: 1, v: "police" }], [], [], []]) });
    const before = JSON.stringify([inp, log]);
    const a = buildResultLog(inp, log);
    const b = buildResultLog(inp, log);
    expect(JSON.stringify([inp, log])).toBe(before);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
