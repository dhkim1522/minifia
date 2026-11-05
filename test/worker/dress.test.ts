// 10-02: 로비 의상(dress) 처리 — 서버가 고른 값을 저장하고 모든 소켓의 players[].look 으로 보낸다 (D-6, L25·L26).
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { advanceTo, connect, hello, lastViewOf, mark, nextFrame, pause, seat, send, settle, startedGame, storedRoom, summary } from "./helpers";
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

type Sock = Seated["host"];

/** 저장된 방의 좌석별 look 한 줄("0:-,1:mafia"). StoredRoom 타입에 look 이 없어 좁혀 읽는다. */
async function storedLooks(code: string): Promise<string> {
  const room = (await storedRoom(code)) as unknown as { players: Array<{ seat: number; look?: string }> };
  return [...room.players].sort((a, b) => a.seat - b.seat).map((p) => `${p.seat}:${p.look ?? "-"}`).join(",");
}

/** 한 소켓의 마지막 view 의 좌석별 look 한 줄. */
const viewLooks = (sock: Sock): string => lastViewOf(sock).players.map((p) => `${p.seat}:${p.look ?? "-"}`).join(",");

describe("의상 — 규칙 완성 (10-02 Task 2, O-8·L26)", () => {
  it("250ms 안의 두 번째 요청은 버려진다: 보낸 소켓은 자기 state 한 프레임(오류 없음), 다른 소켓은 0프레임, 저장은 첫 값뿐", async () => {
    const { s, socks } = await lobby();
    await sendDress(socks, 1, "mafia");
    const frames = await sendDress(socks, 1, "doctor");
    expect(summary(frames[1]!)).toBe("[state:lobby]");
    expect(summary(frames[0]!)).toBe("[]");
    expect(summary(frames[2]!)).toBe("[]");
    expect(viewLooks(socks[1]!)).toBe(`0:-,${s.guests[0]!.seat}:mafia,2:-`);
    expect(await storedLooks(s.code)).toBe("0:-,1:mafia,2:-");
  });

  it("간격이 지나면 다시 받아들여지고 다른 사람은 간격을 공유하지 않는다", async () => {
    const { socks, s } = await lobby();
    await sendDress(socks, 1, "mafia");
    const other = await sendDress(socks, 2, "hood"); // 다른 사람은 바로 받아들여진다
    for (const f of other) expect(summary(f)).toBe("[state:lobby]");
    await pause(300);
    const again = await sendDress(socks, 1, "doctor");
    for (const f of again) expect(summary(f)).toBe("[state:lobby]");
    expect(await storedLooks(s.code)).toBe("0:-,1:doctor,2:hood");
  });

  it("coat 로 돌아가기도 저장·방송된다", async () => {
    const { socks, s } = await lobby();
    await sendDress(socks, 1, "mafia");
    await pause(300);
    const frames = await sendDress(socks, 1, "coat");
    for (const f of frames) expect(summary(f)).toBe("[state:lobby]");
    expect(await storedLooks(s.code)).toBe("0:-,1:coat,2:-");
  });

  it("시작 전에 고른 look 은 게임 단계의 view 에도 그대로 실리고, 게임 중 dress 는 어떤 소켓에도 변화가 없고 보낸 소켓만 자기 state 를 받는다 (L26)", { timeout: 30_000 }, async () => {
    const room = await seat(5, 0);
    const socks = [room.host, ...room.guests.map((g) => g.sock)];
    for (const k of socks) await settle(k, 0);
    send(socks[1]!, { t: "dress", look: "mafia" });
    send(socks[2]!, { t: "dress", look: "noir" });
    for (const k of socks) await settle(k, 0);
    const lobbyLooks = viewLooks(room.host);
    expect(lobbyLooks).toBe(`0:-,${room.guests[0]!.seat}:mafia,${room.guests[1]!.seat}:noir,3:-,4:-,5:-`);
    send(room.host, { t: "start" });
    for (const k of socks) await nextFrame(k, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(room.code, socks, "dayAnnounce");
    await advanceTo(room.code, socks, "discussion");
    for (const k of socks) await settle(k, mark(k));
    for (const k of socks) expect(viewLooks(k)).toBe(lobbyLooks); // 같은 값이 모든 소켓의 게임 view 에 실린다
    // 게임 중 dress: 보낸 소켓만 자기 state 한 프레임
    const before = await storedLooks(room.code);
    const marks = socks.map((k) => mark(k));
    send(socks[3]!, { t: "dress", look: "elder" });
    const got: ServerMessage[][] = socks.map(() => []);
    for (const i of [3, 0, 1, 2, 4, 5]) got[i] = await settle(socks[i]!, marks[i]!);
    expect(summary(got[3]!)).toBe("[state:discussion]");
    for (const i of [0, 1, 2, 4, 5]) expect(summary(got[i]!)).toBe("[]");
    expect(await storedLooks(room.code)).toBe(before);
    expect(viewLooks(socks[3]!)).toBe(lobbyLooks);
  });

  it("재접속(hello)한 소켓의 첫 state 에 모든 사람의 look 이 실려 있다", async () => {
    const { s, socks } = await lobby();
    await sendDress(socks, 1, "mafia");
    await pause(300);
    await sendDress(socks, 2, "hood");
    const fresh = await connect(s.code);
    const first = await hello(fresh, s.guests[0]!.token);
    expect(first.view.players.map((p) => `${p.seat}:${p.look ?? "-"}`).join(",")).toBe("0:-,1:mafia,2:hood");
  });
});

describe("의상 — 시작한 판의 기본값", () => {
  it("아무도 고르지 않고 시작한 판의 모든 view 의 players[] 에는 look 키가 없다(기본 coat 는 키 없음으로 읽는다)", { timeout: 30_000 }, async () => {
    const g = await startedGame("discussion", 5);
    for (const k of g.socks) for (const p of lastViewOf(k).players) expect("look" in p).toBe(false);
  });
});
