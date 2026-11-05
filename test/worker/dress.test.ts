// 10-02: 로비 의상(dress) 처리 — 서버가 고른 값을 저장하고 모든 소켓의 players[].look 으로 보낸다 (D-6, L25·L26).
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { mark, pause, seat, send, settle, summary } from "./helpers";
import type { Seated } from "./helpers";

type State = Extract<ServerMessage, { t: "state" }>;

/** 로비의 세 소켓(방장·손님 둘)을 flush 하고 돌려준다. */
async function lobby(): Promise<{ s: Seated; socks: Array<Seated["host"]> }> {
  const s = await seat(2, 0);
  const socks = [s.host, ...s.guests.map((g) => g.sock)];
  for (const k of socks) await settle(k, 0);
  return { s, socks };
}

/** 한 소켓이 dress 를 보내고 모든 소켓의 프레임을 소켓 순서대로 돌려준다(보낸 쪽 flush 가 먼저다). */
async function sendDress(socks: Array<Seated["host"]>, from: number, look: string): Promise<ServerMessage[][]> {
  const marks = socks.map((k) => mark(k));
  send(socks[from]!, { t: "dress", look });
  const out: ServerMessage[][] = socks.map(() => []);
  const order = [from, ...socks.map((_, i) => i).filter((i) => i !== from)];
  for (const i of order) out[i] = await settle(socks[i]!, marks[i]!);
  return out;
}

describe("의상 — 트레이서 (D-6)", () => {
  it("손님이 mafia 를 고르면 세 소켓이 정확히 한 프레임씩 받고 그 좌석의 players[].look 이 mafia 다. 다른 좌석 행에는 look 키가 없다", async () => {
    const { s, socks } = await lobby();
    const frames = await sendDress(socks, 1, "mafia");
    for (const f of frames) expect(summary(f)).toBe("[state:lobby]");
    for (const f of frames) {
      const view = (f[0] as State).view;
      for (const row of view.players) {
        if (row.seat === s.guests[0]!.seat) expect(row.look).toBe("mafia");
        else expect("look" in row).toBe(false);
      }
    }
  });

  it("같은 값을 다시 보내면 저장·전송이 없다(프레임 0)", async () => {
    const { socks } = await lobby();
    await sendDress(socks, 1, "mafia");
    await pause(300);
    const frames = await sendDress(socks, 1, "mafia");
    for (const f of frames) expect(summary(f)).toBe("[]");
  });

  it("알 수 없는 look 은 BAD_MESSAGE 이고 아무도 look 을 받지 않는다", async () => {
    const { socks } = await lobby();
    const frames = await sendDress(socks, 1, "wizard");
    expect(summary(frames[1]!)).toContain("error");
    for (const f of frames) for (const m of f) if (m.t === "state") expect(m.view.players.every((p) => !("look" in p))).toBe(true);
  });
});
