// 11-06: 맵 선택(MAP-06) 서버 — 방장의 mapPick, 시작 때 서버가 정하는 map, 이동 판정이 방의 맵을 읽음 (D-20·D-21·D-22, L40·L42).
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { BAR_MAP, cellCenterFx, isWalkable, walkableCells } from "../../shared/game/map";
import { PLAZA_MAP } from "../../shared/game/mapPlaza";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import { PLAZA_SPAWNS } from "../../shared/game/mapPlaza";
import type { MapId } from "../../shared/protocol";
import { editRoom, endedGame4, lastViewOf, mark, moveAs, pause, seat, send, settle, startedGame, storedRoom, summary, worldFramesOf } from "./helpers";
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

describe("방의 맵을 읽는 이동 판정 (D-22, T-11-20)", () => {
  /** 광장에서는 걸을 수 있고 재즈 바에서는 막힌 칸 중 무대에 가까운 칸 / 반대인 칸의 중심(고정소수점). */
  const centerOf = (cells: Array<{ c: number; r: number }>): { x: number; z: number } => {
    const best = cells
      .map(({ c, r }) => cellCenterFx(c, r))
      .sort((a, b) => a.x * a.x + a.z * a.z - (b.x * b.x + b.z * b.z) || a.x - b.x || a.z - b.z)[0]!;
    return best;
  };
  const onlyPlaza = centerOf(walkableCells(PLAZA_MAP).filter(({ c, r }) => !isWalkable(BAR_MAP, c, r)));
  const onlyBar = centerOf(walkableCells(BAR_MAP).filter(({ c, r }) => !isWalkable(PLAZA_MAP, c, r)));

  it("광장 판(editRoom 으로 map: plaza)에서 광장에서만 걸을 수 있는 점은 그대로 받아들여지고, 광장에서만 막힌 점은 걸을 수 있는 점으로 보정된다", async () => {
    const g = await startedGame("discussion", 4);
    await editRoom(g.code, (room) => ({ ...room, map: "plaza" }));
    const [a, b] = g.actors;
    const marks = g.socks.map((k) => mark(k));
    moveAs(a!, onlyPlaza.x, onlyPlaza.z);
    moveAs(b!, onlyBar.x, onlyBar.z);
    for (const k of g.socks) await settle(k, marks[g.socks.indexOf(k)]!);
    const seen = g.socks[0]!;
    const from = marks[0]!;
    const lastOf = (seatNo: number): { x: number; z: number } => {
      const moves = worldFramesOf(seen, from).filter((m): m is Extract<typeof m, { k: "move" }> => m.k === "move" && m.s === seatNo);
      const p = moves.at(-1)!.p;
      return { x: p[p.length - 2]!, z: p[p.length - 1]! };
    };
    expect(lastOf(a!.seat)).toEqual(onlyPlaza);
    const bEnd = lastOf(b!.seat);
    expect(bEnd).not.toEqual(onlyBar);
    const cell = { c: Math.floor((bEnd.x + 700) / 50), r: Math.floor((bEnd.z + 700) / 50) };
    expect(isWalkable(PLAZA_MAP, cell.c, cell.r)).toBe(true);
  }, 40_000);
});

describe("거절 응답은 사람·사유와 무관하게 같다 (L40, T-11-18·T-11-19)", () => {
  /** 보낸 소켓은 state 정확히 한 프레임(오류 없음), 나머지는 0프레임. */
  const expectQuietReject = (frames: ServerMessage[][], sender: number, phase: string): void => {
    frames.forEach((f, i) => {
      if (i !== sender) expect(summary(f)).toBe("[]");
      else {
        expect(summary(f)).toBe(`[state:${phase}]`);
        expect(f.some((m) => m.t === "error")).toBe(false);
      }
    });
  };

  it("대기실: 손님의 유효한 값 · 방장의 허용 밖 값(plaza) · 손님의 허용 밖 값이 모두 같은 응답이고 mapChoice 는 그대로 random 이다", async () => {
    const { s, socks } = await lobby();
    for (const [from, map] of [[1, "bar"], [0, "plaza"], [2, "plaza"]] as const) {
      const frames = await sendAll(socks, from, { t: "mapPick", map });
      expectQuietReject(frames, from, "lobby");
      expect(stateOf(frames[from]!).view.mapChoice).toBe("random");
    }
    expect(((await storedRoom(s.code)) as unknown as { mapChoice?: string }).mapChoice).toBeUndefined();
  });

  it("판 중(토론): 방장이 보내도 같은 응답 — 보낸 소켓 state 한 프레임, 다른 소켓 0프레임, 저장은 그대로", async () => {
    const g = await startedGame("discussion", 3);
    const before = JSON.stringify(((await storedRoom(g.code)) as unknown as { mapChoice?: string; map?: string }));
    for (const [from, map] of [[0, "bar"], [1, "bar"], [0, "plaza"]] as const) {
      const marks = g.socks.map((k) => mark(k));
      send(g.socks[from]!, { t: "mapPick", map });
      const frames: ServerMessage[][] = g.socks.map(() => []);
      for (const i of [from, ...g.socks.map((_, k) => k).filter((k) => k !== from)]) frames[i] = await settle(g.socks[i]!, marks[i]!);
      expectQuietReject(frames, from, "discussion");
    }
    expect(JSON.stringify(((await storedRoom(g.code)) as unknown as { mapChoice?: string; map?: string }))).toBe(before);
  }, 40_000);

  it("결과 단계(ended): 방장의 선택은 받아들여져 모든 소켓이 state 한 프레임을 받고, 손님의 선택은 조용히 버려진다", async () => {
    const g = await endedGame4();
    for (const a of g.actors) await settle(a.sock, 0); // 결과 기록(resultLog) 흐름이 가라앉은 뒤부터 센다
    await pause(300);
    for (const a of g.actors) await settle(a.sock, 0);
    const host = g.actors.find((a) => a.seat === 0)!;
    const guestIdx = g.actors.findIndex((a) => a.seat !== 0);
    const socks = g.actors.map((a) => a.sock);
    const hostIdx = g.actors.indexOf(host);
    // 결과 기록 흐름(resultLog)은 이 시험의 관심사가 아니다 — 남은 조각이 섞여도 보지 않는다.
    const noLog = (rows: ServerMessage[][]): ServerMessage[][] => rows.map((f) => f.filter((m) => m.t !== "resultLog"));
    const rejected = noLog(await sendAll(socks, guestIdx, { t: "mapPick", map: "bar" }));
    expectQuietReject(rejected, guestIdx, "ended");
    const accepted = noLog(await sendAll(socks, hostIdx, { t: "mapPick", map: "bar" }));
    for (const f of accepted) {
      expect(summary(f)).toBe("[state:ended]");
      expect(stateOf(f).view.mapChoice).toBe("bar");
    }
  }, 40_000);
});

describe("시작이 정한 map 은 모두에게 같다 (L42, D-21)", () => {
  it("허용 맵에 광장을 열고(PLAYABLE_MAPS 우회) mapChoice plaza 로 시작하면 모든 소켓이 광장 입장 지점 8곳 안의 좌표로 snap 을 받고 view.map 이 plaza 다", async () => {
    const mutable = PLAYABLE_MAPS as MapId[];
    const s = await seat(3, 0);
    const socks = [s.host, ...s.guests.map((g) => g.sock)];
    for (const k of socks) await settle(k, 0);
    await editRoom(s.code, (room) => ({ ...room, mapChoice: "plaza" }));
    const marks = socks.map((k) => mark(k));
    mutable.push("plaza");
    try {
      send(s.host, { t: "start" });
      const out: ServerMessage[][] = [];
      for (let i = 0; i < socks.length; i += 1) out.push(await settle(socks[i]!, marks[i]!));
      const spots = new Set(PLAZA_SPAWNS.map((p) => `${Math.round(p.x * 100)},${Math.round(p.z * 100)}`));
      for (const f of out) {
        const states = f.filter((m): m is State => m.t === "state");
        expect(states.length).toBeGreaterThan(0);
        expect(states.every((m) => m.view.map === "plaza")).toBe(true);
        const snaps = f.filter((m): m is Extract<ServerMessage, { t: "world"; k: "snap" }> => m.t === "world" && m.k === "snap");
        expect(snaps.length).toBe(1);
        const snap = snaps[0]!;
        expect(snap.ents.length).toBe(socks.length);
        for (const e of snap.ents) {
          const x = e.p[e.p.length - 2]!;
          const z = e.p[e.p.length - 1]!;
          expect(spots.has(`${x},${z}`), `seat ${e.s} at ${x},${z}`).toBe(true);
        }
        // state 다음에 snap 이 온다(handleTestReset 과 같은 순서)
        expect(f.findIndex((m) => m.t === "state")).toBeLessThan(f.findIndex((m) => m.t === "world" && m.k === "snap"));
      }
      expect(((await storedRoom(s.code)) as unknown as { map?: string }).map).toBe("plaza");
    } finally {
      mutable.splice(mutable.indexOf("plaza"), 1);
    }
    expect([...PLAYABLE_MAPS]).toEqual(["bar"]);
  });
});
