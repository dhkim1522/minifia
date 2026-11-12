// 19-01 트레이서: 판 종류 고르기(결정 0081-6, D-01·D-05·D-06·D-08) — 방장의 modePick 이 서버에 저장·방송되고, basic 으로 고른 판은 낮 시작 발표 뒤 심부름 없이 토론으로 간다.
// 거절 응답은 맵 선택과 같은 모양이다(L40): 오류 프레임 없이 보낸 소켓의 최신 state 한 프레임, 같은 값은 0프레임.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { closePhase, lastViewOf, mark, nextFrame, seat, send, settle, storedRoom, summary } from "./helpers";
import type { Seated } from "./helpers";

type State = Extract<ServerMessage, { t: "state" }>;
type Sock = Seated["host"];

/** 로비의 소켓(방장 + 참가자 guests 명)을 flush 하고 돌려준다. */
async function lobby(guests = 2): Promise<{ s: Seated; socks: Sock[] }> {
  const s = await seat(guests, 0);
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
const storedMode = async (code: string): Promise<string | undefined> => ((await storedRoom(code)) as unknown as { mode?: string }).mode;

describe("판 종류 고르기 서버 (D-01, D-05, L40)", () => {
  it("새 방의 대기실 view.mode 는 모든 소켓에 extended 이고 저장된 방에는 mode 키가 없다 (D-01·D-04)", async () => {
    const { s, socks } = await lobby();
    expect(socks.map((k) => String(lastViewOf(k).mode)).join(",")).toBe("extended,extended,extended");
    expect(String(await storedMode(s.code))).toBe("undefined");
  });

  it("방장이 basic 을 고르면 모든 소켓이 정확히 한 state 를 받고 view.mode 가 basic 이며 저장된다", async () => {
    const { s, socks } = await lobby();
    const frames = await sendAll(socks, 0, { t: "modePick", mode: "basic" });
    expect(frames.map((f) => summary(f)).join(" ")).toBe("[state:lobby] [state:lobby] [state:lobby]");
    expect(frames.map((f) => String(stateOf(f).view.mode)).join(",")).toBe("basic,basic,basic");
    expect(String(await storedMode(s.code))).toBe("basic");
  });

  it("같은 값을 다시 보내면 변화가 없다 — 모든 소켓 0프레임 (기본 extended 도 같다)", async () => {
    const { socks } = await lobby();
    const first = await sendAll(socks, 0, { t: "modePick", mode: "extended" });
    expect(first.map((f) => summary(f)).join(" ")).toBe("[] [] []");
    await sendAll(socks, 0, { t: "modePick", mode: "basic" });
    const again = await sendAll(socks, 0, { t: "modePick", mode: "basic" });
    expect(again.map((f) => summary(f)).join(" ")).toBe("[] [] []");
    expect(String(lastViewOf(socks[0]!).mode)).toBe("basic");
  });

  it("방장이 extended 로 되돌리면 모든 소켓이 한 state 를 받고 저장된 값이 extended 다", async () => {
    const { s, socks } = await lobby();
    await sendAll(socks, 0, { t: "modePick", mode: "basic" });
    const frames = await sendAll(socks, 0, { t: "modePick", mode: "extended" });
    expect(frames.map((f) => summary(f)).join(" ")).toBe("[state:lobby] [state:lobby] [state:lobby]");
    expect(frames.map((f) => String(stateOf(f).view.mode)).join(",")).toBe("extended,extended,extended");
    expect(String(await storedMode(s.code))).toBe("extended");
  });

  it("참가자가 보내면 다른 소켓은 0프레임이고 보낸 소켓은 state 한 프레임뿐(오류 없음)이며 저장은 그대로다 (T-19-01·T-19-02)", async () => {
    const { s, socks } = await lobby();
    const frames = await sendAll(socks, 1, { t: "modePick", mode: "basic" });
    expect(frames.map((f) => summary(f)).join(" ")).toBe("[] [state:lobby] []");
    expect(String(stateOf(frames[1]!).view.mode)).toBe("extended");
    expect(String(await storedMode(s.code))).toBe("undefined");
  });

  it("알 수 없는 값·덧붙은 키·값 없음은 스키마에서 BAD_MESSAGE 이고 아무것도 바뀌지 않는다", async () => {
    const { s, socks } = await lobby();
    for (const bad of [{ t: "modePick", mode: "fast" }, { t: "modePick", mode: "basic", seat: 1 }, { t: "modePick" }]) {
      const frames = await sendAll(socks, 0, bad);
      expect(frames.map((f) => summary(f)).join(" ")).toBe("[error:BAD_MESSAGE] [] []");
    }
    expect(String(await storedMode(s.code))).toBe("undefined");
  });
});

describe("트레이서 — basic 으로 고른 판은 심부름을 건너뛴다 (D-06, D-08)", () => {
  /** 방장이 mode 를 고른 뒤(없으면 고르지 않고) 시작해 토론 또는 심부름에 닿을 때까지 한 단계씩 넘기며 지난 단계를 모은다. */
  async function walk(mode?: "basic" | "extended"): Promise<{ s: Seated; socks: Sock[]; phases: string[] }> {
    const { s, socks } = await lobby(3);
    if (mode !== undefined) await sendAll(socks, 0, { t: "modePick", mode });
    send(s.host, { t: "start" });
    for (const k of socks) await nextFrame(k, (m) => m.t === "state" && m.view.phase === "assigning");
    const phases: string[] = ["assigning"];
    for (let i = 0; i < 6 && phases.at(-1) !== "discussion" && phases.at(-1) !== "errand"; i += 1) {
      await closePhase(s.code);
      phases.push((await storedRoom(s.code)).phase);
    }
    for (const k of socks) await settle(k, mark(k));
    return { s, socks, phases };
  }

  it("basic 판은 낮 시작 발표 다음이 토론이고 지난 단계에 errand 가 없다", async () => {
    const { socks, phases } = await walk("basic");
    expect(phases.join(">")).toBe("assigning>roleReveal>dayAnnounce>discussion");
    // 소켓이 받은 state 프레임의 단계 열에도 errand 가 없고 view.mode 는 판 내내 basic 이다
    for (const k of socks) {
      const views = k.frames.map((raw) => JSON.parse(raw) as ServerMessage).filter((m): m is State => m.t === "state").map((m) => m.view);
      expect(views.some((v) => v.phase === "errand")).toBe(false);
      expect([...new Set(views.filter((v) => v.phase !== "lobby").map((v) => String(v.mode)))].join(",")).toBe("basic");
    }
  });

  it("고르지 않은 판(= extended)은 낮 시작 발표 다음이 심부름이다 (지금 흐름 그대로, D-04)", async () => {
    const { phases } = await walk();
    expect(phases.join(">")).toBe("assigning>roleReveal>dayAnnounce>errand");
  });

  it("판이 진행 중이면 방장의 modePick 은 거절 모양이다 — 보낸 소켓 state 한 프레임, 다른 소켓 0프레임, 저장 그대로 (D-06)", async () => {
    const { s, socks } = await walk("basic");
    const frames = await sendAll(socks, 0, { t: "modePick", mode: "extended" });
    expect(frames.map((f) => summary(f)).join(" ")).toBe("[state:discussion] [] [] []");
    expect(String(stateOf(frames[0]!).view.mode)).toBe("basic");
    expect(String(await storedMode(s.code))).toBe("basic");
  });
});
