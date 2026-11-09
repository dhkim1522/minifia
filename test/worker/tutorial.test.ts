// 함께 진행 서버 게이트 트레이서(17페이즈, 결정 0078·0080). 방장이 start 에 tutorial: true 를 실으면 방이 tutorial 단계로 가고,
// 앉은 사람 모두가 tutorialDone 을 보내면 assigning → roleReveal 로 이어진다. 공개 값(view.tutorial·me.tutorialDone)·경계·끊김 시험은 17-12 가 이 파일에 더한다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { advanceTo, lastViewOf, mark, nextFrame, seat, send, settle, storedRoom, type StoredRoom, type TestSocket } from "./helpers";

type Stored = StoredRoom & { tutorialPassed?: string[]; players: Array<{ id: string; seat: number }> };

const inPhase = (phase: string) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;

async function viewIn(sock: TestSocket, phase: string): Promise<RoomView> {
  const m = await nextFrame(sock, inPhase(phase));
  if (m.t !== "state") throw new Error("state 프레임이 아니다");
  return m.view;
}

describe("함께 진행 게이트 (TUT-02)", () => {
  it("방장이 tutorial: true 로 시작하면 모두 tutorial 단계(마감 150초)이고 어떤 view 에도 role·allies 가 없다", async () => {
    const r = await seat(3, 0);
    send(r.host, { t: "start", tutorial: true });
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    for (const s of sockets) {
      const view = await viewIn(s, "tutorial");
      expect(view.phaseEndsAt! - view.serverNow).toBeGreaterThan(148_000);
      expect(view.phaseEndsAt! - view.serverNow).toBeLessThanOrEqual(150_000 + 2_000);
      expect("role" in view.me).toBe(false);
      expect("allies" in view.me).toBe(false);
    }
    expect((await storedRoom(r.code)).phase).toBe("tutorial");
  });

  it("전원이 tutorialDone 을 보내면 assigning 으로 넘어가 tutorialPassed 가 지워지고, 이어서 roleReveal 에서 각자 역할이 보인다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await viewIn(s, "tutorial");

    // 손님 둘이 먼저 — 두 사람만 표시되고 단계는 그대로다
    for (const g of r.guests.slice(0, 2)) {
      const from = mark(g.sock);
      send(g.sock, { t: "tutorialDone" });
      await settle(g.sock, from);
    }
    const partial = (await storedRoom(r.code)) as Stored;
    expect(partial.phase).toBe("tutorial");
    const idOfSeat = (seatNo: number): string => partial.players.find((p) => p.seat === seatNo)!.id;
    expect([...(partial.tutorialPassed ?? [])].sort()).toEqual(r.guests.slice(0, 2).map((g) => idOfSeat(g.seat)).sort());

    // 나머지 둘(손님 하나와 방장)이 보내면 넘어간다
    send(r.guests[2]!.sock, { t: "tutorialDone" });
    send(r.host, { t: "tutorialDone" });
    for (const s of sockets) await viewIn(s, "assigning");
    const after = (await storedRoom(r.code)) as Stored;
    expect(after.phase).toBe("assigning");
    expect("tutorialPassed" in after).toBe(false);

    await advanceTo(r.code, sockets, "roleReveal");
    for (const s of sockets) expect(lastViewOf(s).me.role).toBeDefined();
  });

  it("tutorial 키가 없는 start 는 지금처럼 곧장 assigning 이다 (서버 기본 꺼짐)", async () => {
    const r = await seat(3, 0);
    send(r.host, { t: "start" });
    await viewIn(r.host, "assigning");
    expect((await storedRoom(r.code)).phase).toBe("assigning");
  });
});
