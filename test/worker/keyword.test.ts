// 23-01 트레이서: 실제 방 DO 로 시작 → roleReveal → keyword → dayAnnounce 를 돈다(D-01·D-06).
// 키워드는 시민 편 소켓만 me.keyword 로 받고, 마피아 소켓의 view.me 에는 키 자체가 없다. 장르 라벨은 모두에게 같다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openKeyword } from "../helpers/keyword";
import { actorsOf, advanceTo, lastViewOf, mark, nextFrame, seat, send, settle, storedRoom } from "./helpers";
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
      expect(view.day?.keyword).toEqual({ genre: "영화" });
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
