// 23-01 트레이서: 실제 방 DO 로 시작 → roleReveal → keyword → dayAnnounce 를 돈다(D-01·D-06).
// 키워드는 시민 편 소켓만 me.keyword 로 받고, 마피아 소켓의 view.me 에는 키 자체가 없다. 장르 라벨은 모두에게 같다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { genreLabelOf } from "../../shared/game/keywords";
import { openKeyword } from "../helpers/keyword";
import { actorsOf, advanceTo, chatSend, chatsOf, editRoom, lastViewOf, mark, nextFrame, pause, seat, send, settle, storedRoom, summary, verdictAll } from "./helpers";
import type { Seated, StoredRoom, TestSocket } from "./helpers";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

type KeywordRoom = StoredRoom & { keyword?: { genre: string; word: string } };

describe("첫날 키워드 단계 (D-01·D-06)", () => {
  it("역할 확인 → 키워드 카드 → 낮 시작: 장르는 모두 같고, 단어는 시민 편만 받는다", async () => {
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
    let mafia = 0;
    let citizenSide = 0;
    for (const a of actors) {
      const view = lastViewOf(a.sock);
      expect(view.phase).toBe("keyword");
      expect(view.phaseDurationMs).toBe(13_000);
      expect(view.day?.keyword).toEqual({ genre: genreLabelOf(stored.keyword!.genre) });
      if (a.role === "mafia") {
        mafia += 1;
        expect(Object.hasOwn(view.me, "keyword")).toBe(false);
      } else {
        citizenSide += 1;
        expect(view.me.keyword).toBe(word);
      }
    }
    expect(mafia).toBeGreaterThan(0);
    expect(citizenSide).toBeGreaterThan(0);

    await advanceTo(room.code, socks, "dayAnnounce");
    for (const sock of socks) {
      const view = lastViewOf(sock);
      expect(view.day?.n).toBe(1);
      expect(Object.hasOwn(view.me, "keyword")).toBe(false);
    }
  });
});

// 23-05: 실제 방에서 첫날 찬반 부결 → answerReveal(4.4초, 정답 공개) → 밤. 둘째 날 부결은 곧장 밤(D-02·D-22·D-03).
describe("첫날 정답 공개 단계 (D-02·D-22)", () => {
  const rejectAll = (room: Awaited<ReturnType<typeof seat>>): Record<number, boolean> =>
    Object.fromEntries(actorsOf(room).map((a) => [a.seat, false]));

  it("첫날 찬반 부결 → answerReveal: phaseDurationMs 4400, 모든 소켓의 day.keyword.answer 가 저장된 단어와 같고, 마감 뒤 night", async () => {
    const room = await seat(3, 0);
    const socks = [room.host, ...room.guests.map((g) => g.sock)];
    send(room.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(room.code, socks, "verdict");
    for (const sock of socks) await settle(sock, mark(sock));
    const before = (await storedRoom(room.code)) as KeywordRoom;
    const word = before.keyword!.word;
    const label = genreLabelOf(before.keyword!.genre);
    // 정답 공개 전 프레임에는 어느 소켓의 view 에도 answer 가 없다
    for (const sock of socks) expect((lastViewOf(sock).day?.keyword as { answer?: string } | undefined)?.answer).toBeUndefined();

    const actors = actorsOf(room);
    await verdictAll(room.code, actors, rejectAll(room));
    for (const sock of socks) await settle(sock, mark(sock));
    expect((await storedRoom(room.code)).phase).toBe("answerReveal");
    for (const a of actors) {
      const view = lastViewOf(a.sock);
      expect(view.phase).toBe("answerReveal");
      expect(view.phaseDurationMs).toBe(4400);
      expect(view.day?.keyword).toEqual({ genre: label, answer: word });
      expect(view.day?.noExecution).toEqual({ reason: "rejected" });
    }

    await advanceTo(room.code, socks, "night");
    for (const a of actors) expect(lastViewOf(a.sock).day?.keyword).toEqual({ genre: label, answer: word });
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

/** 사람 4명 판을 keyword 단계 첫 순간까지 돌린다(마감 13초 앞). 모든 소켓의 프레임을 flush 해 둔다. */
async function inKeyword(options: { bots?: number } = {}): Promise<{ room: Seated; socks: TestSocket[]; word: string }> {
  const room = await seat(3, 0, options.bots ? { testMode: true } : {});
  const socks = socksOf(room);
  for (const sock of socks) await settle(sock, mark(sock));
  if (options.bots) {
    send(room.host, { t: "testBots", count: options.bots });
    await settle(room.host, mark(room.host));
  }
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
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

  it("시민이 키워드로 확정하면 [error:BAD_MESSAGE, state:keyword], 마피아가 같은 글로 확정해도 같은 두 프레임이고 그 뒤에야 keywordProbed 가 켜진다. 거절 뒤 다른 글은 받아진다", async () => {
    const { room, socks, word } = await inKeyword();
    const actors = actorsOf(room);
    const citizen = actors.find((x) => x.role !== "mafia")!;
    const mafia = actors.find((x) => x.role === "mafia")!;
    const others = (me: TestSocket): TestSocket[] => socks.filter((s) => s !== me);

    const m1 = socks.map((s) => mark(s));
    answerOf(citizen.sock, word, true);
    expect(summary(await settle(citizen.sock, m1[socks.indexOf(citizen.sock)]!))).toBe("[error:BAD_MESSAGE,state:keyword]");
    for (const o of others(citizen.sock)) expect(summary(await settle(o, m1[socks.indexOf(o)]!))).toBe("[]");
    expect(((await storedRoom(room.code)) as AnswerRoom).keywordProbed).toBeUndefined();

    const m2 = socks.map((s) => mark(s));
    answerOf(mafia.sock, word, true);
    expect(summary(await settle(mafia.sock, m2[socks.indexOf(mafia.sock)]!))).toBe("[error:BAD_MESSAGE,state:keyword]");
    for (const o of others(mafia.sock)) expect(summary(await settle(o, m2[socks.indexOf(o)]!))).toBe("[]");
    expect(((await storedRoom(room.code)) as AnswerRoom).keywordProbed).toBe(true);

    await pause(450);
    const m3 = mark(mafia.sock);
    answerOf(mafia.sock, "안경", true);
    expect(summary(await settle(mafia.sock, m3))).toBe("[state:keyword]");
  }, 40_000);

  it("마감(forceDue+알람)에 dayAnnounce 의 day.keyword.answers 가 모든 소켓에 같다: 낸 순서 → 쓰던 글 → 답 없음, 봇 좌석은 text null 맨 끝 묶음", async () => {
    const { room, socks } = await inKeyword({ bots: 1 });
    const actors = actorsOf(room);
    const [a, b, c, d] = actors as [typeof actors[0], typeof actors[0], typeof actors[0], typeof actors[0]];
    answerOf(c.sock, "마법", true);
    await settle(c.sock, mark(c.sock));
    answerOf(b.sock, "쓰던글", false);
    await settle(b.sock, mark(b.sock));
    await advanceTo(room.code, socks, "dayAnnounce");
    for (const sock of socks) await settle(sock, mark(sock));

    const views = socks.map((s) => lastViewOf(s));
    const answers = views.map((v) => JSON.stringify(v.day?.keyword?.answers));
    expect(new Set(answers).size).toBe(1);
    const rows = views[0]!.day!.keyword!.answers!;
    const botSeat = 4;
    const none = [a.seat, d.seat, botSeat].sort((x, y) => x - y);
    expect(rows).toEqual([
      { order: 1, seat: c.seat, text: "마법" },
      { order: 2, seat: b.seat, text: "쓰던글" },
      ...none.map((seatNo, i) => ({ order: 3 + i, seat: seatNo, text: null })),
    ]);
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
