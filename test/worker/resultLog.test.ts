// 11-03 Task 2: resultLog 프레임 전송 — ended 진입 한 번·신분별 동일·hello 재전송·판 중 0건 (결정 D-9·D-10, 누설 L35·L36, 위협 T-11-07·T-11-08).
import { describe, expect, it } from "vitest";
import type { ResultLogFrame, ServerMessage } from "../../shared/protocol";
import { RICH_TEXT, connect, framesOf, mark, nextFrame, richEndedGame6, send, settle } from "./helpers";
import type { RichGame6, TestSocket } from "./helpers";

const resultLogsOf = (msgs: ServerMessage[]): ResultLogFrame[] => msgs.filter((m): m is ResultLogFrame => m.t === "resultLog");
const PARTS = ["mafia", "ghost", "whisper", "claim", "ballots"];
const ownLines = (frames: ResultLogFrame[], part: string): unknown[] => frames.filter((f) => f.part === part).flatMap((f) => f.lines);

/** 한 소켓이 받은 ended 구간의 resultLog 열(JSON). */
const columnOf = (sock: TestSocket): string => JSON.stringify(resultLogsOf(framesOf(sock)));

describe("resultLog 전송 (D-10, L36)", () => {
  it("ended 로 들어서는 순간 다섯 신분 모두 resultLog 를 mafia → ghost → whisper → claim → ballots 순으로 받고, 소켓마다 JSON 이 같다", { timeout: 90_000 }, async () => {
    const g: RichGame6 = await richEndedGame6();
    const first = columnOf(g.socks[0]!);
    for (const sock of g.socks) expect(columnOf(sock)).toBe(first);
    const frames = resultLogsOf(framesOf(g.socks[0]!));
    expect(frames.map((f) => f.part).filter((p, i, all) => all.indexOf(p) === i)).toEqual(PARTS);
    // 판 안의 다섯 신분(마피아 둘·경찰·의사·시민)이 모두 들어 있다.
    expect(new Set(g.actors.map((a) => a.role)).size).toBe(4);
    // 부분마다 마지막 프레임만 end 이다.
    for (const part of PARTS) {
      const mine = frames.filter((f) => f.part === part);
      expect(mine.map((f) => f.i)).toEqual(mine.map((_, i) => i));
      expect(mine.map((f) => f.end)).toEqual(mine.map((_, i) => i === mine.length - 1));
    }
  });

  it("줄 내용: 마피아 밤 채팅·유령 채팅·귓속말 본문·직업 주장·찬반 기록이 마스크 없이 전체로 실린다 (D-9)", { timeout: 90_000 }, async () => {
    const g = await richEndedGame6();
    const frames = resultLogsOf(framesOf(g.citizenY.sock));
    expect(ownLines(frames, "mafia").map((l) => `${(l as { seat: number }).seat}/${(l as { n: number }).n}/${(l as { text: string }).text}`)).toEqual([
      `${g.mafiaB.seat}/1/${RICH_TEXT.mafia1}`,
      `${g.mafiaB.seat}/1/${RICH_TEXT.mafia2}`,
    ]);
    expect(ownLines(frames, "ghost").map((l) => `${(l as { seat: number }).seat}/${(l as { text: string }).text}`)).toEqual([
      `${g.mafiaA.seat}/${RICH_TEXT.ghostA}`,
      `${g.police.seat}/${RICH_TEXT.ghostP}`,
    ]);
    expect(ownLines(frames, "whisper").map((l) => `${(l as { seat: number }).seat}>${(l as { to: number }).to}/${(l as { text: string }).text}`)).toEqual([
      `${g.citizenX.seat}>${g.police.seat}/${RICH_TEXT.whisper}`,
    ]);
    const claims = ownLines(frames, "claim") as Array<{ seat: number; n: number; v: string }>;
    expect(claims.map((c) => `${c.seat}/${c.n}/${c.v}`).sort()).toEqual([`${g.police.seat}/1/police`, `${g.citizenX.seat}/1/doctor`].sort());
    const ballots = ownLines(frames, "ballots") as Array<{ n: number; yes: number[]; no: number[] }>;
    expect(ballots).toEqual([{ n: 1, yes: g.actors.filter((a) => a !== g.mafiaA).map((a) => a.seat).sort((a, b) => a - b), no: [] }]);
  });

  it("ended 진입 뒤 새 프레임이 더 오지 않는다 — 같은 열이 한 번만 간다", { timeout: 90_000 }, async () => {
    const g = await richEndedGame6();
    const before = g.socks.map((s) => resultLogsOf(framesOf(s)).length);
    for (const s of g.socks) await settle(s, mark(s));
    expect(g.socks.map((s) => resultLogsOf(framesOf(s)).length)).toEqual(before);
    expect(before.every((n) => n === before[0] && n >= 5)).toBe(true);
  });

  it("재접속(hello)한 소켓은 ended 에서 chatLog 프레임 다음에 같은 열을 다시 받는다", { timeout: 90_000 }, async () => {
    const g = await richEndedGame6();
    const reference = columnOf(g.socks[0]!);
    // 시민 Y 가 다시 들어온다 — 토큰으로 새 소켓을 연다.
    const again = await connect(g.code);
    send(again, { t: "hello", token: g.citizenY.token });
    await nextFrame(again, (m) => m.t === "chatLog");
    const lastPart = (m: ServerMessage): boolean => m.t === "resultLog" && m.part === "ballots" && m.end;
    await nextFrame(again, lastPart);
    const kinds = framesOf(again).map((m) => m.t);
    expect(kinds.indexOf("chatLog")).toBeLessThan(kinds.indexOf("resultLog"));
    expect(JSON.stringify(resultLogsOf(framesOf(again)))).toBe(reference);
  });
});
