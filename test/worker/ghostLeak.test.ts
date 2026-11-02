// GHOST-01 누설 증명, 결정 0060-8, RESEARCH 메타모픽 설계 (08-09).
// 유령의 위치·움직임은 유령의 폰으로만 간다 — 산 사람 폰에는 네트워크로도 가지 않는다(화면에서 숨기는 방식이 아니다, 결정 0002·0021).
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 실패 출력은 한 줄이어야 해서(TAP) 프레임은 요약 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { advanceTo, chatSend, chatsOf, connect, ghostsOf, mark, nextFrame, pause, resetChatRates, seat, send, settle, startedGame, summary, toPhase, typingSend, withRole, worldFramesOf } from "./helpers";
import type { Actor, Game } from "./helpers";

/** 행동 직전 모든 소켓의 위치를 적고, 행동하고, 모든 소켓을 flush 해 소켓별 프레임을 돌려준다. 보낸 쪽 flush 가 먼저다(처리를 마쳤다는 증거). */
async function observe(g: Game, first: Actor, act: () => void | Promise<void>): Promise<ServerMessage[][]> {
  const marks = g.socks.map((s) => mark(s));
  await act();
  const order = [first, ...g.actors.filter((a) => a !== first)];
  const out: ServerMessage[][] = g.actors.map(() => []);
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

/** world move 프레임만 'seat' 모양으로. */
const moveSeats = (msgs: ServerMessage[]): string =>
  msgs
    .filter((m): m is Extract<ServerMessage, { t: "world"; k: "move" }> => m.t === "world" && m.k === "move")
    .map((m) => `move:${m.s}`)
    .join(",");

/** 5명 판(방장 + 손님 4)을 토론 단계까지 시작해 마피아가 아닌 두 명을 유령으로 만든다. */
async function fiveWithTwoGhosts(): Promise<{ g: Game; ghosts: Actor[]; living: Actor[] }> {
  const g = await startedGame("discussion", 4);
  const doomed = g.actors.filter((a) => a.role !== "mafia").slice(0, 2);
  expect(doomed.length).toBe(2);
  const { ghosts, living } = await ghostsOf(
    g,
    doomed.map((a) => a.seat),
  );
  return { g, ghosts, living };
}

describe("유령 한 걸음 — 트레이서 (GHOST-01, MAP-04)", () => {
  it("유령 X 의 move 는 다른 유령 Y 소켓에 world.move(s = X)로 가고 산 사람 세 소켓은 한 프레임도 받지 않는다", async () => {
    const { g, ghosts, living } = await fiveWithTwoGhosts();
    const [x, y] = ghosts as [Actor, Actor];
    expect(living.length).toBe(3);

    const marks = new Map(g.socks.map((sock) => [sock, mark(sock)] as const));
    const got = await observe(g, x, () => send(x.sock, { t: "move", x: 200, z: 200 }));

    expect(moveSeats(got[g.actors.indexOf(y)]!)).toBe(`move:${x.seat}`);
    expect(moveSeats(got[g.actors.indexOf(x)]!)).toBe(`move:${x.seat}`); // 자기 걸음도 돌려받는다(예측 보정과 같은 길)
    for (const a of living) expect(summary(got[g.actors.indexOf(a)]!)).toBe("[]");
    // 직접 불변식: 산 사람 소켓이 이 걸음 뒤에 받은 world 프레임은 0개다(로비에서 입장 때 받은 프레임은 걸음 전 위치).
    expect(living.map((a) => worldFramesOf(a.sock, marks.get(a.sock)!).length).join(",")).toBe("0,0,0");
  }, 30_000);

  it("산 사람 A 가 토론에서 move 하면 유령을 포함한 모든 소켓이 world.move(s = A)를 받는다", async () => {
    const { g, living } = await fiveWithTwoGhosts();
    const a = living[0]!;

    const got = await observe(g, a, () => send(a.sock, { t: "move", x: -200, z: 100 }));

    for (const actor of g.actors) expect(moveSeats(got[g.actors.indexOf(actor)]!)).toBe(`move:${a.seat}`);
  }, 30_000);
});

// ---- 접속 스냅샷은 보는 사람별이다 (GHOST-01, T-08-11) ----

/** 새 소켓으로 hello 하고 chatLog 까지 받은 뒤 snap 프레임의 좌석 목록('0,2,3')을 돌려준다. snap 이 없으면 'none'. */
async function reconnectSnapSeats(code: string, token: string): Promise<string> {
  const sock = await connect(code);
  send(sock, { t: "hello", token });
  await nextFrame(sock, (m) => m.t === "chatLog");
  const snap = worldFramesOf(sock).find((m) => m.k === "snap");
  return snap === undefined || snap.k !== "snap" ? "none" : snap.ents.map((e) => e.s).join(",");
}

const seatsOf = (actors: Actor[]): string =>
  actors
    .map((a) => a.seat)
    .sort((a, b) => a - b)
    .join(",");

describe("hello 직후 snap 은 보는 사람별로 거른다 (T-08-11)", () => {
  it("토론 중 산 사람이 재접속하면 snap 에 유령 좌석이 없고, 유령이 재접속하면 모두가 있다", async () => {
    const { g, ghosts, living } = await fiveWithTwoGhosts();
    expect(await reconnectSnapSeats(g.code, living[0]!.token)).toBe(seatsOf(living));
    expect(await reconnectSnapSeats(g.code, ghosts[0]!.token)).toBe(seatsOf(g.actors));
  }, 30_000);

  it("역할 확인 단계에서는 누가 재접속해도 모두가 있고, 끝난 방에서는 snap 이 없다", async () => {
    const room = await seat(4, 0);
    const socks = [room.host, ...room.guests.map((x) => x.sock)];
    send(room.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(room.code, socks, "roleReveal");
    expect(await reconnectSnapSeats(room.code, room.guests[0]!.token)).toBe("0,1,2,3,4");
    await toPhase(room.code, "ended", (r) => ({ ...r, winner: "citizens" }));
    expect(await reconnectSnapSeats(room.code, room.hostToken)).toBe("none");
  }, 30_000);
});

describe("산 사람이 유령이 되는 순간 그 사람 소켓에만 전원 snap 이 간다 (GHOST-01)", () => {
  it("밤에 마피아가 시민 V 를 지목해 아침이 오면 V 의 소켓만 좌석 6개짜리 snap 을 받고 나머지 다섯 소켓에는 world 프레임이 없다", async () => {
    const g = await startedGame("night");
    const [mafiaA, mafiaB] = withRole(g, "mafia") as [Actor, Actor];
    const victim = withRole(g, "citizen")[0]!;
    send(mafiaA.sock, { t: "pick", target: victim.seat });
    send(mafiaB.sock, { t: "pick", target: victim.seat });
    for (const sock of g.socks) await settle(sock, mark(sock));
    const marks = new Map(g.socks.map((sock) => [sock, mark(sock)] as const));

    await advanceTo(g.code, g.socks, "morning");
    for (const sock of g.socks) await settle(sock, mark(sock));

    for (const a of g.actors) {
      const worlds = worldFramesOf(a.sock, marks.get(a.sock)!).map((m) => (m.k === "snap" ? `snap:${m.ents.map((e) => e.s).sort((p, q) => p - q).join(",")}` : `move:${m.s}`));
      expect(worlds.join("|")).toBe(a === victim ? "snap:0,1,2,3,4,5" : "");
    }
  }, 30_000);
});

// ---- 메타모픽: 유령이 무엇을 하든 산 사람 소켓의 프레임 열은 같다 (RESEARCH 메타모픽 설계) ----

const VOLATILE = new Set(["serverNow", "phaseEndsAt", "t0", "at", "c", "seq"]);

/** 휘발 필드(서버 시각·마감·구간 시작·줄 시각·핑 번호·채널별 줄 번호)를 지운 프레임 열 한 줄. 두 구간은 같은 방의 앞뒤라 줄 번호만 다르다. */
function stable(msgs: ServerMessage[]): string {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !VOLATILE.has(k)).map(([k, x]) => [k, strip(x)]));
    }
    return v;
  };
  return msgs.map((m) => JSON.stringify(strip(m))).join("|");
}

interface Rounds {
  g: Game;
  ghosts: Actor[];
  living: Actor[];
  quiet: ServerMessage[][];
  busy: ServerMessage[][];
  /** 두 구간을 시작하기 직전 각 소켓의 프레임 위치. */
  from: Map<Game["socks"][number], number>;
}

/**
 * 같은 방에서 같은 산 사람 대본(L1 이 한 줄 보내고 L2 가 한 줄 보낸다)을 두 구간으로 돌린다.
 * 구간 A(quiet): 유령이 가만히 있다. 구간 B(busy): 유령 X 가 세 번 걷고 입력 중을 켜고 유령 채팅 한 줄을 보내고 끈다.
 */
async function twoRounds(): Promise<Rounds> {
  const { g, ghosts, living } = await fiveWithTwoGhosts();
  const [x] = ghosts as [Actor, Actor];
  const [l1, l2] = living as [Actor, Actor, Actor];
  const livingScript = (): void => {
    chatSend(l1.sock, "누가 수상해요?");
    chatSend(l2.sock, "저는 아니에요");
  };

  const from = new Map(g.socks.map((sock) => [sock, mark(sock)] as const));
  const quiet = await observe(g, l1, async () => {
    livingScript();
    await pause(400);
  });

  await resetChatRates(g.code);
  const busy = await observe(g, l1, async () => {
    livingScript();
    for (const [px, pz] of [
      [200, 200],
      [-200, 100],
      [100, -250],
    ] as const) {
      send(x.sock, { t: "move", x: px, z: pz });
      await pause(200);
    }
    typingSend(x.sock, true);
    chatSend(x.sock, "구경 중이에요");
    typingSend(x.sock, false);
    await pause(400);
  });
  return { g, ghosts, living, quiet, busy, from };
}

describe("메타모픽 — 유령이 가만히 있을 때(A)와 걷고 입력하고 말할 때(B)의 산 사람 프레임 열이 같다 (GHOST-01)", () => {
  it("산 사람 세 소켓이 받은 프레임 열(휘발 필드 제거)이 두 구간에서 같고, 비어 있지 않다", async () => {
    const r = await twoRounds();
    for (const a of r.living) {
      const i = r.g.actors.indexOf(a);
      expect(stable(r.busy[i]!)).toBe(stable(r.quiet[i]!));
      expect(chatsOf(r.busy[i]!).length).toBe(2); // 산 사람 둘의 줄 — 대본이 실제로 돌았다
    }
    // 구간 B 가 정말 활동이 있던 구간이다: 다른 유령 Y 는 X 의 걸음 셋·유령 채팅 한 줄·입력 중 켜짐을 받았다.
    const y = r.ghosts[1]!;
    const got = r.busy[r.g.actors.indexOf(y)]!;
    expect(got.filter((m) => m.t === "world" && m.k === "move").length).toBe(3);
    expect(chatsOf(got).filter((c) => c.ch === "ghost").length).toBe(1);
    expect(got.filter((m) => m.t === "typing").length).toBeGreaterThan(0);
  }, 40_000);

  it("직접 불변식 — 산 사람 소켓의 world 프레임 좌석은 산 좌석뿐이고, typing·chat 프레임에 유령 좌석과 ghost 채널이 없다", async () => {
    const r = await twoRounds();
    const ghostSeats = new Set(r.ghosts.map((a) => a.seat));
    for (const a of r.living) {
      const i = r.g.actors.indexOf(a);
      const worldSeats = worldFramesOf(a.sock, r.from.get(a.sock)!).flatMap((m) => (m.k === "snap" ? m.ents.map((e) => e.s) : [m.s]));
      expect(worldSeats.filter((s) => ghostSeats.has(s)).join(",")).toBe("");
      for (const m of [...r.quiet[i]!, ...r.busy[i]!]) {
        if (m.t === "typing") expect(ghostSeats.has(m.seat)).toBe(false);
        if (m.t === "chat") {
          expect(m.ch).not.toBe("ghost");
          expect(ghostSeats.has(m.seat)).toBe(false);
        }
      }
    }
  }, 40_000);
});
