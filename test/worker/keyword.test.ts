// 23-01 트레이서: 실제 방 DO 로 시작 → roleReveal → keyword → dayAnnounce 를 돈다(D-01·D-06).
// 키워드는 시민 편 소켓만 me.keyword 로 받고, 마피아 소켓의 view.me 에는 키 자체가 없다. 장르 라벨은 모두에게 같다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { genreLabelOf } from "../../shared/game/keywords";
import { openKeyword } from "../helpers/keyword";
import { actorsOf, advanceTo, editRoom, lastViewOf, mark, nextFrame, seat, send, settle, storedRoom, verdictAll } from "./helpers";
import type { StoredRoom } from "./helpers";

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
