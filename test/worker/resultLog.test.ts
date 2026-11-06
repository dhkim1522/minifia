// 11-03 Task 2: resultLog 프레임 전송 — ended 진입 한 번·신분별 동일·hello 재전송·판 중 0건 (결정 D-9·D-10, 누설 L35·L36, 위협 T-11-07·T-11-08).
import { env } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { RULESET } from "../../shared/game/ruleset";
import type { ResultLogFrame, ServerMessage } from "../../shared/protocol";
import { RICH_TEXT, advanceTo, connect, framesOf, mark, nextFrame, richEndedGame6, send, settle, startedGame } from "./helpers";
import type { RichGame6, TestSocket } from "./helpers";

const resultLogsOf = (msgs: ServerMessage[]): ResultLogFrame[] => msgs.filter((m): m is ResultLogFrame => m.t === "resultLog");
const PARTS = ["mafia", "ghost", "whisper", "claim", "ballots"];
const ownLines = (frames: ResultLogFrame[], part: string): unknown[] => frames.filter((f) => f.part === part).flatMap((f) => f.lines as unknown[]);

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
    // 기본판(결정 0072)에서는 귓속말·직업 주장이 꺼져 있어 두 부분은 빈 줄이다 — 켜지면(RULESET.whisper·badge) 기존 기대 그대로다.
    expect(ownLines(frames, "whisper").map((l) => `${(l as { seat: number }).seat}>${(l as { to: number }).to}/${(l as { text: string }).text}`)).toEqual(
      RULESET.whisper ? [`${g.citizenX.seat}>${g.police.seat}/${RICH_TEXT.whisper}`] : [],
    );
    const claims = ownLines(frames, "claim") as Array<{ seat: number; n: number; v: string }>;
    expect(claims.map((c) => `${c.seat}/${c.n}/${c.v}`).sort()).toEqual(RULESET.badge ? [`${g.police.seat}/1/police`, `${g.citizenX.seat}/1/doctor`].sort() : []);
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
    await evictDurableObject(env.ROOM.getByName(g.code)); // 메모리 사본을 비운다 — 보관 줄은 저장소에서 복원된다.
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

describe("resultLog 누설 — 판 중 0건, ended 뒤 모두 같게 (L35·L36, 위협 T-11-07·T-11-08)", () => {
  it("6명 판 시작부터 ended 직전까지 여섯 소켓이 받은 어떤 프레임에도 resultLog 가 없다", { timeout: 90_000 }, async () => {
    const g = await richEndedGame6();
    for (const [i, sock] of g.socks.entries()) {
      expect(g.endedAt[i]).toBeGreaterThan(0);
      const before = sock.frames.slice(0, g.endedAt[i]);
      expect(`${i}:${before.filter((raw) => raw.includes("resultLog")).length}`).toBe(`${i}:0`);
      // ended 구간에는 다섯 부분이 모두 있다.
      const after = framesOf(sock).slice(g.endedAt[i]);
      expect(new Set(resultLogsOf(after).map((f) => f.part)).size).toBe(5);
    }
  });

  it("숨은 기록의 본문은 판 중에는 받을 권리가 있는 소켓에만 가고, 끝나면 모든 소켓에 같게 열린다", { timeout: 90_000 }, async () => {
    const g = await richEndedGame6();
    const everyone = [g.mafiaA, g.mafiaB, g.police, g.doctor, g.citizenX, g.citizenY];
    const live = (a: (typeof everyone)[number]): string => g.socks[g.actors.indexOf(a)]!.frames.slice(0, g.endedAt[g.actors.indexOf(a)]).join("\n");
    const whole = (a: (typeof everyone)[number]): string => g.socks[g.actors.indexOf(a)]!.frames.join("\n");
    // 살아 있는 시민 둘은 판 중에 마피아·유령 줄을 한 줄도 받지 않았다(마스크 규칙 불변, d)
    for (const citizen of [g.citizenX, g.citizenY]) {
      for (const text of [RICH_TEXT.mafia1, RICH_TEXT.mafia2, RICH_TEXT.ghostA, RICH_TEXT.ghostP]) expect(`${citizen.seat}:${live(citizen).includes(text)}`).toBe(`${citizen.seat}:false`);
    }
    // 귓속말 본문은 당사자(시민 X·경찰) 밖에는 판 중에 가지 않았다
    for (const a of everyone.filter((x) => x !== g.citizenX && x !== g.police)) expect(`${a.seat}:${live(a).includes(RICH_TEXT.whisper)}`).toBe(`${a.seat}:false`);
    // 끝난 뒤에는 여섯 소켓 모두에게 모든 본문이 있다
    // (기본판, 결정 0072: 귓속말은 꺼져 있어 본문이 애초에 없다 — 어느 소켓에도 한 번도 가지 않는다)
    for (const a of everyone) {
      for (const text of Object.values(RICH_TEXT)) {
        const want = text === RICH_TEXT.whisper ? RULESET.whisper : true;
        expect(`${a.seat}:${text}:${whole(a).includes(text)}`).toBe(`${a.seat}:${text}:${want}`);
      }
    }
    // 시민 Y: 마피아 채널 chat 프레임은 판 중 0건
    const citizenFrames = framesOf(g.citizenY.sock).slice(0, g.endedAt[g.actors.indexOf(g.citizenY)]);
    expect(citizenFrames.filter((m) => m.t === "chat" && m.ch === "mafia")).toEqual([]);
  });

  it("판 중 어느 순간의 hello(재접속)도 resultLog 를 받지 않는다", { timeout: 60_000 }, async () => {
    const g = await startedGame("discussion", 5);
    const reconnect = async (token: string): Promise<string[]> => {
      const sock = await connect(g.code);
      send(sock, { t: "hello", token });
      await nextFrame(sock, (m) => m.t === "chatLog");
      await settle(sock, mark(sock));
      return sock.frames;
    };
    for (const a of [g.actors[0]!, g.actors[3]!]) expect((await reconnect(a.token)).filter((raw) => raw.includes("resultLog"))).toEqual([]);
    // 앞서 재접속으로 대체된 소켓(0·3번)을 빼고 기다린다.
    await advanceTo(g.code, [1, 2, 4, 5].map((i) => g.socks[i]!), "night");
    for (const a of [g.actors[1]!, g.actors[4]!]) expect((await reconnect(a.token)).filter((raw) => raw.includes("resultLog"))).toEqual([]);
  });

  it("ended 의 모든 resultLog 프레임은 키 집합이 정해져 있고 id·token·역할 이름 키가 없다", { timeout: 90_000 }, async () => {
    const g = await richEndedGame6();
    const lineKeys: Record<string, string> = { mafia: "at,n,seat,text", ghost: "at,n,seat,text", whisper: "at,n,seat,text,to", claim: "n,seat,v", ballots: "n,no,yes" };
    for (const sock of g.socks) {
      for (const f of resultLogsOf(framesOf(sock))) {
        expect(Object.keys(f).sort().join(",")).toBe("end,i,lines,part,t");
        for (const line of f.lines) expect(Object.keys(line).sort().join(",")).toBe(lineKeys[f.part]);
      }
      for (const raw of sock.frames.filter((r) => r.includes("resultLog"))) for (const key of ["token", "playerId", "badgeLog", "whispers", "nicknameKey"]) expect(raw.includes(`"${key}"`)).toBe(false);
    }
  });
});
