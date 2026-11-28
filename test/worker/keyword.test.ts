// 23-01 트레이서: 실제 방 DO 로 시작 → roleReveal → keyword → dayAnnounce 를 돈다(D-01·D-06).
// 제시어는 아는 사람의 소켓만 me.keyword 로 받는다. 장르 라벨은 모두에게 같다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { genreLabelOf } from "../../shared/game/keywords";
import { FIRST_ANSWER_TURN_MS } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { openKeyword } from "../helpers/keyword";
import { actorsOf, advanceTo, chatSend, chatsOf, connect, editRoom, hello, lastViewOf, mark, nextFrame, pause, seat, send, settle, storedRoom, summary, verdictAll } from "./helpers";
import type { Seated, StoredRoom, TestSocket } from "./helpers";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

type KeywordRoom = StoredRoom & Pick<RoomState, "keyword">;

describe("첫날 키워드 단계 (D-01·D-06)", () => {
  it("역할 확인 → 키워드 카드 → 낮 시작: 가려진 시민은 재접속 후에도 제시어를 받지 않는다", async () => {
    const room = await seat(3, 0); // 4명 판
    const socks = [room.host, ...room.guests.map((g) => g.sock)];
    send(room.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");

    await advanceTo(room.code, socks, "keyword");
    for (const sock of socks) await settle(sock, mark(sock));

    const stored = (await storedRoom(room.code)) as KeywordRoom;
    expect(stored.phase).toBe("keyword");
    expect(stored.day).toBeUndefined();
    expect(stored.keyword).toBeDefined();
    const word = stored.keyword!.word;

    const actors = actorsOf(room);
    const hiddenSeats = stored.keyword!.hiddenCitizenSeats!;
    expect(hiddenSeats).toHaveLength(1);
    const hidden = actors.find((a) => a.seat === hiddenSeats[0])!;
    expect(hidden.role).not.toBe("mafia");
    let knowers = 0;
    for (const a of actors) {
      const view = lastViewOf(a.sock);
      expect(view.phase).toBe("keyword");
      expect(view.phaseDurationMs).toBe(35_000);
      expect(view.day?.keyword).toEqual({ genre: genreLabelOf(stored.keyword!.genre) });
      if (a.role === "mafia" || a === hidden) {
        expect(Object.hasOwn(view.me, "keyword")).toBe(false);
      } else {
        knowers += 1;
        expect(view.me.keyword).toBe(word);
      }
    }
    expect(knowers).toBe(2);

    const replacement = await connect(room.code);
    await hello(replacement, hidden.token);
    const rejoined = lastViewOf(replacement);
    expect(rejoined.phase).toBe("keyword");
    expect(rejoined.me).toMatchObject({ seat: hidden.seat, role: hidden.role });
    expect(Object.hasOwn(rejoined.me, "keyword")).toBe(false);
    expect(((await storedRoom(room.code)) as KeywordRoom).keyword?.hiddenCitizenSeats).toEqual(hiddenSeats);
    socks[socks.indexOf(hidden.sock)] = replacement;

    await advanceTo(room.code, socks, "dayAnnounce");
    for (const sock of socks) {
      const view = lastViewOf(sock);
      expect(view.day?.n).toBe(1);
      expect(Object.hasOwn(view.me, "keyword")).toBe(false);
    }
  });
});

describe("첫날 제시어 공개 단계", () => {
  const rejectAll = (room: Awaited<ReturnType<typeof seat>>): Record<number, boolean> =>
    Object.fromEntries(actorsOf(room).map((a) => [a.seat, false]));

  it("마지막 답 발표 → 12초 제시어 공개 → 토론, 첫날 부결 뒤는 다시 공개 없이 밤", async () => {
    const room = await seat(3, 0);
    const socks = [room.host, ...room.guests.map((g) => g.sock)];
    send(room.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(room.code, socks, "dayAnnounce");
    for (const sock of socks) await settle(sock, mark(sock));
    const before = (await storedRoom(room.code)) as KeywordRoom;
    const word = before.keyword!.word;
    const label = genreLabelOf(before.keyword!.genre);
    // 정답 공개 전 프레임에는 어느 소켓의 view 에도 answer 가 없다
    for (const sock of socks) expect((lastViewOf(sock).day?.keyword as { answer?: string } | undefined)?.answer).toBeUndefined();

    await advanceTo(room.code, socks, "answerReveal");
    for (const sock of socks) {
      const view = lastViewOf(sock);
      expect(view.phase).toBe("answerReveal");
      expect(view.phaseDurationMs).toBe(12000);
      expect(view.day?.keyword).toEqual({ genre: label, answer: word, answers: expect.any(Array) });
      expect(view.day?.noExecution).toBeUndefined();
    }
    await advanceTo(room.code, socks, "discussion");
    for (const sock of socks) expect(lastViewOf(sock).day?.keyword?.answer).toBe(word);
    await advanceTo(room.code, socks, "verdict");
    const actors = actorsOf(room);
    await verdictAll(room.code, actors, rejectAll(room));
    expect((await storedRoom(room.code)).phase).toBe("night");
    for (const sock of socks) {
      expect(lastViewOf(sock).day?.keyword?.answer).toBe(word);
      expect(lastViewOf(sock).day?.noExecution).toEqual({ reason: "rejected" });
    }
  }, 60_000);

  it("둘째 날 찬반 부결은 곧장 night 이다(answerReveal 없음)", async () => {
    const room = await seat(3, 0);
    const socks = [room.host, ...room.guests.map((g) => g.sock)];
    send(room.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(room.code, socks, "verdict");
    await editRoom(room.code, (r) => ({ ...r, day: 2 }));
    for (const sock of socks) await settle(sock, mark(sock));
    await verdictAll(room.code, actorsOf(room), rejectAll(room));
    expect((await storedRoom(room.code)).phase).toBe("night");
  }, 60_000);
});

// 23-06: 키워드 답 — 초안·확정(보낸 소켓에만 state), 금지어 거절(시민·마피아 같은 두 프레임), 마감 공개 목록, 자유 채팅 무필터(D-07·D-10·D-24·D-26).
type AnswerRoom = StoredRoom & { keywordProbed?: true; answerSubmits?: unknown };
const answerOf = (sock: TestSocket, text: string, final: boolean): void => send(sock, { t: "answer", text, final });
const socksOf = (room: Seated): TestSocket[] => [room.host, ...room.guests.map((g) => g.sock)];

/** 방을 keyword 단계 첫 순간까지 돌리고 모든 소켓의 프레임을 flush 한다. */
async function inKeyword(options: { bots?: number; hiddenRole?: "citizen" | "police" | "doctor" } = {}): Promise<{ room: Seated; socks: TestSocket[]; word: string }> {
  const room = await seat(options.hiddenRole === "doctor" ? 4 : 3, 0, options.bots ? { testMode: true } : {});
  const socks = socksOf(room);
  for (const sock of socks) await settle(sock, mark(sock));
  if (options.bots) {
    send(room.host, { t: "testBots", count: options.bots });
    await settle(room.host, mark(room.host));
    // 답 없음 정렬 재현에는 기존 고정 봇 모드를 쓴다.
    send(room.host, { t: "testBotVote", exec: "no", pick: "random" });
    await nextFrame(room.host, (m) => m.t === "state" && m.view.me.testBotVote?.exec === "no");
  }
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  // 답안 예시인 '안경'도 단어 목록에 있으므로, 답안 흐름은 같은 제시어로 검증한다.
  await editRoom(room.code, (r) => {
    const keyword = { ...(r.keyword as KeywordRoom["keyword"]), genre: "movie", word: "해리포터" };
    if (options.hiddenRole !== undefined) {
      const hidden = (r.players as RoomState["players"]).find((p) => p.role === options.hiddenRole)!;
      keyword.hiddenCitizenSeats = [hidden.seat];
    }
    return { ...r, keyword };
  });
  await advanceTo(room.code, socks, "keyword");
  for (const sock of socks) await settle(sock, mark(sock));
  const stored = (await storedRoom(room.code)) as KeywordRoom;
  return { room, socks, word: stored.keyword!.word };
}

describe("키워드 답 접수 (D-07·D-10)", () => {
  it("초안·확정은 보낸 소켓에만 state 한 프레임이고 다른 소켓은 0프레임이다. 간격 안의 같은 종류 요청은 프레임 없이 버려지고, 초안 직후 확정은 받아진다", async () => {
    const { room, socks } = await inKeyword();
    const actors = actorsOf(room);
    const [a, b] = [actors[1]!, actors[2]!];
    const others = (me: TestSocket): TestSocket[] => socks.filter((s) => s !== me);

    const marks = socks.map((s) => mark(s));
    answerOf(a.sock, "안경", false);
    expect(summary(await settle(a.sock, marks[socks.indexOf(a.sock)]!))).toBe("[state:keyword]");
    for (const o of others(a.sock)) expect(summary(await settle(o, marks[socks.indexOf(o)]!))).toBe("[]");

    const m2 = socks.map((s) => mark(s));
    answerOf(a.sock, "안경 쓴 사람", true);
    expect(summary(await settle(a.sock, m2[socks.indexOf(a.sock)]!))).toBe("[state:keyword]");
    for (const o of others(a.sock)) expect(summary(await settle(o, m2[socks.indexOf(o)]!))).toBe("[]");
    expect(lastViewOf(a.sock).me.answer).toEqual({ text: "안경 쓴 사람", final: true });

    // b: 초안 → (간격 안) 초안 → 확정. 두 번째 초안은 프레임이 없고 확정은 키가 달라 받아진다.
    const m3 = mark(b.sock);
    answerOf(b.sock, "가", false);
    expect(summary(await settle(b.sock, m3))).toBe("[state:keyword]");
    const m4 = mark(b.sock);
    answerOf(b.sock, "나", false);
    expect(summary(await settle(b.sock, m4))).toBe("[]");
    const m5 = mark(b.sock);
    answerOf(b.sock, "가", true);
    expect(summary(await settle(b.sock, m5))).toBe("[state:keyword]");
    const stored = (await storedRoom(room.code)) as AnswerRoom;
    expect(stored.answerSubmits).toEqual([
      { seat: a.seat, text: "안경 쓴 사람" },
      { seat: b.seat, text: "가" },
    ]);
  }, 40_000);

  it.each(["citizen", "police", "doctor"] as const)("제시어 보유자만 금지 초안 안내를 받고, 가려진 %s는 마피아와 같은 접수 응답을 받는다", async (hiddenRole) => {
    const { room, socks, word } = await inKeyword({ hiddenRole });
    const actors = actorsOf(room);
    const citizen = actors.find((x) => x.role === "citizen" && Object.hasOwn(lastViewOf(x.sock).me, "keyword"))!;
    const mafia = actors.find((x) => x.role === "mafia")!;
    const hidden = actors.find((x) => x.role === hiddenRole && !Object.hasOwn(lastViewOf(x.sock).me, "keyword"))!;
    expect(lastViewOf(hidden.sock).me.role).toBe(hiddenRole);
    const others = (me: TestSocket): TestSocket[] => socks.filter((s) => s !== me);

    const drafts = socks.map((s) => mark(s));
    answerOf(citizen.sock, word, false);
    expect(summary(await settle(citizen.sock, drafts[socks.indexOf(citizen.sock)]!))).toBe("[state:keyword]");
    expect(lastViewOf(citizen.sock).me.answer).toEqual({ text: word, final: false, keywordBlocked: true });
    for (const o of others(citizen.sock)) expect(summary(await settle(o, drafts[socks.indexOf(o)]!))).toBe("[]");

    const m1 = socks.map((s) => mark(s));
    answerOf(citizen.sock, word, true);
    expect(summary(await settle(citizen.sock, m1[socks.indexOf(citizen.sock)]!))).toBe("[error:BAD_MESSAGE,state:keyword]");
    for (const o of others(citizen.sock)) expect(summary(await settle(o, m1[socks.indexOf(o)]!))).toBe("[]");
    expect(((await storedRoom(room.code)) as AnswerRoom).keywordProbed).toBeUndefined();

    for (const actor of [mafia, hidden]) {
      for (const final of [false, true]) {
        const marks = socks.map(mark);
        answerOf(actor.sock, word, final);
        expect(summary(await settle(actor.sock, marks[socks.indexOf(actor.sock)]!))).toBe("[state:keyword]");
        expect(lastViewOf(actor.sock).me.answer).toEqual({ text: word, final });
        for (const other of others(actor.sock)) expect(summary(await settle(other, marks[socks.indexOf(other)]!))).toBe("[]");
      }
    }
    expect(((await storedRoom(room.code)) as AnswerRoom).keywordProbed).toBeUndefined();

    await pause(450);
    const m3 = mark(citizen.sock);
    answerOf(citizen.sock, "안경", true);
    expect(summary(await settle(citizen.sock, m3))).toBe("[state:keyword]");
    await advanceTo(room.code, socks, "answerReveal");
    for (const sock of socks) {
      const rows = lastViewOf(sock).day?.keyword?.answers;
      expect(rows?.[0]).toEqual({ order: 1, seat: citizen.seat, text: "안경" });
      expect(rows?.find((row) => row.seat === hidden.seat)?.text).toBeNull();
      expect(rows?.find((row) => row.seat === mafia.seat)?.text).toBeNull();
    }
  }, 40_000);

  it("첫 제출자의 의자부터 한 답씩 보내고, 발표자와 다른 상대에게 붙인 딱지를 토론까지 유지한다", async () => {
    const { room, socks } = await inKeyword({ bots: 1 });
    const actors = actorsOf(room);
    const [a, b, c, d] = actors as [typeof actors[0], typeof actors[0], typeof actors[0], typeof actors[0]];
    answerOf(c.sock, "마법", true);
    await nextFrame(c.sock, (m) => m.t === "state" && m.view.me.answer?.final === true);
    answerOf(b.sock, "쓰던글", false);
    await nextFrame(b.sock, (m) => m.t === "state" && m.view.me.answer?.final === false);
    await advanceTo(room.code, socks, "dayAnnounce");
    const rows = [
      { seat: c.seat, text: "마법" }, { seat: 4, text: null }, { seat: a.seat, text: null },
      { seat: b.seat, text: "쓰던글" }, { seat: d.seat, text: null },
    ];
    const assertCurrent = (index: number): void => {
      for (const sock of socks) {
        const view = lastViewOf(sock);
        expect(view.phaseDurationMs).toBe(FIRST_ANSWER_TURN_MS);
        expect(view.day?.keyword).toEqual({ genre: expect.any(String), presentation: { order: index + 1, total: 5, ...rows[index] } });
        expect(view.me.keyword).toBeUndefined();
        expect(view.me.answer).toBeUndefined();
      }
    };
    assertCurrent(0);

    send(d.sock, { t: "suspect", target: b.seat });
    for (const sock of socks) {
      await nextFrame(sock, (m) => m.t === "state" && m.view.day?.suspects?.some((s) => s.from === d.seat && s.to === b.seat) === true);
    }
    send(a.sock, { t: "suspect", target: c.seat });
    for (const sock of socks) {
      const marked = await nextFrame(sock, (m) => m.t === "state" && m.view.day?.suspects?.some((s) => s.from === a.seat && s.to === c.seat) === true);
      if (marked.t !== "state") throw new Error("expected state");
      expect(marked.view.me.suspectTo).toBe(sock === a.sock ? c.seat : sock === d.sock ? b.seat : undefined);
    }
    for (let i = 1; i < rows.length; i += 1) {
      send(room.host, { t: "testSkip" });
      for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.day?.keyword?.presentation?.order === i + 1);
      assertCurrent(i);
    }
    send(room.host, { t: "testSkip" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "answerReveal");
    send(room.host, { t: "testSkip" });
    for (const sock of socks) {
      await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "discussion");
      expect(lastViewOf(sock).day?.keyword?.answers).toEqual(rows.map((row, index) => ({ ...row, order: index + 1 })));
      expect(lastViewOf(sock).day?.suspects).toEqual([{ from: d.seat, to: b.seat }, { from: a.seat, to: c.seat }]);
    }
    const stored = (await storedRoom(room.code)) as AnswerRoom;
    expect(stored.answerSubmits).toBeUndefined();
  }, 40_000);

  it("낮 토론 채팅에는 금지어를 걸지 않는다 — 키워드가 든 줄도 받아져 다른 소켓에 채팅 줄이 간다 (D-26)", async () => {
    const { room, socks, word } = await inKeyword();
    await advanceTo(room.code, socks, "discussion");
    for (const sock of socks) await settle(sock, mark(sock));
    const [sender, ...rest] = socks as [TestSocket, ...TestSocket[]];
    const marks = socks.map((s) => mark(s));
    chatSend(sender, `${word} 아닌가요`);
    const got = await Promise.all(rest.map((s) => settle(s, marks[socks.indexOf(s)]!)));
    for (const msgs of got) expect(chatsOf(msgs).some((m) => JSON.stringify(m).includes(word))).toBe(true);
  }, 40_000);
});
