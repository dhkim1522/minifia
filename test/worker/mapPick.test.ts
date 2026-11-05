// 11-06: 맵 선택(MAP-06) 서버 — 방장의 mapPick, 시작 때 서버가 정하는 map, 이동 판정이 방의 맵을 읽음 (D-20·D-21·D-22, L40·L42).
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { seat, send, settle, mark, summary, storedRoom, lastViewOf } from "./helpers";
import type { Seated } from "./helpers";

type State = Extract<ServerMessage, { t: "state" }>;
type Sock = Seated["host"];

/** 로비의 세 소켓(방장·손님 둘)을 flush 하고 돌려준다. */
async function lobby(): Promise<{ s: Seated; socks: Sock[] }> {
  const s = await seat(2, 0);
  const socks = [s.host, ...s.guests.map((g) => g.sock)];
  for (const k of socks) await settle(k, 0);
  return { s, socks };
}

/** from 소켓이 msg 를 보내고 모든 소켓의 프레임을 소켓 순서대로 돌려준다(보낸 쪽 flush 가 먼저다). */
async function sendAll(socks: Sock[], from: number, msg: unknown): Promise<ServerMessage[][]> {
  const marks = socks.map((k) => mark(k));
  send(socks[from]!, msg);
  const out: ServerMessage[][] = socks.map(() => []);
  const order = [from, ...socks.map((_, i) => i).filter((i) => i !== from)];
  for (const i of order) out[i] = await settle(socks[i]!, marks[i]!);
  return out;
}

const stateOf = (msgs: ServerMessage[]): State => msgs.find((m): m is State => m.t === "state")!;

describe("맵 선택 서버 (D-20, D-21, L40)", () => {
  it("대기실 view 는 mapChoice 가 random 이고 map 키가 없다 (L42)", async () => {
    const { socks } = await lobby();
    for (const k of socks) {
      const v = lastViewOf(k);
      expect(v.mapChoice).toBe("random");
      expect("map" in v).toBe(false);
    }
  });

  it("방장이 같은 값(random)을 보내면 변화가 없다 — 모든 소켓 0프레임", async () => {
    const { socks } = await lobby();
    const frames = await sendAll(socks, 0, { t: "mapPick", map: "random" });
    for (const f of frames) expect(summary(f)).toBe("[]");
  });

  it("방장이 bar 를 고르면 모든 소켓이 정확히 한 state 를 받고 mapChoice 가 bar 이며 저장된다", async () => {
    const { s, socks } = await lobby();
    const frames = await sendAll(socks, 0, { t: "mapPick", map: "bar" });
    for (const f of frames) expect(summary(f)).toBe("[state:lobby]");
    for (const f of frames) expect(stateOf(f).view.mapChoice).toBe("bar");
    expect(((await storedRoom(s.code)) as unknown as { mapChoice?: string }).mapChoice).toBe("bar");
  });

  it("손님이 보내면 방장·다른 손님은 0프레임이고 그 손님 소켓은 state 한 프레임뿐(오류 없음)이며 저장은 그대로다", async () => {
    const { s, socks } = await lobby();
    const frames = await sendAll(socks, 1, { t: "mapPick", map: "bar" });
    expect(summary(frames[1]!)).toBe("[state:lobby]");
    expect(summary(frames[0]!)).toBe("[]");
    expect(summary(frames[2]!)).toBe("[]");
    expect(stateOf(frames[1]!).view.mapChoice).toBe("random");
    expect(((await storedRoom(s.code)) as unknown as { mapChoice?: string }).mapChoice).toBeUndefined();
  });

  it("알 수 없는 값·덧붙은 키는 스키마에서 BAD_MESSAGE 이고 아무것도 바뀌지 않는다", async () => {
    const { socks } = await lobby();
    for (const bad of [{ t: "mapPick", map: "forest" }, { t: "mapPick", map: "bar", seat: 1 }, { t: "mapPick" }]) {
      const frames = await sendAll(socks, 0, bad);
      expect(summary(frames[0]!)).toBe("[error:BAD_MESSAGE]");
      expect(summary(frames[1]!)).toBe("[]");
      expect(summary(frames[2]!)).toBe("[]");
    }
  });

  it("시작하면 서버가 map 을 정하고(PLAYABLE_MAPS=[bar] 라 bar) 모든 참가자의 view.map 이 같다 (L42)", async () => {
    const s = await seat(3, 0);
    const socks = [s.host, ...s.guests.map((g) => g.sock)];
    for (const k of socks) await settle(k, 0);
    const marks = socks.map((k) => mark(k));
    send(s.host, { t: "start" });
    const out: ServerMessage[][] = [];
    for (let i = 0; i < socks.length; i += 1) out.push(await settle(socks[i]!, marks[i]!));
    for (const f of out) {
      const st = f.filter((m): m is State => m.t === "state");
      expect(st.length).toBeGreaterThan(0);
      expect(st.every((m) => m.view.phase === "assigning" && m.view.map === "bar")).toBe(true);
    }
    expect(((await storedRoom(s.code)) as unknown as { map?: string }).map).toBe("bar");
  });
});
