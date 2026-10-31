// 06-08: 방 DO 의 로비 이동(MAP-02) — move 한 번이 서버 경로가 되어 연결된 모든 소켓에 같은 world.move 로 간다.
// 입장 위치(MAP-01)·hello 뒤 snap(MAP-05)·조용한 거절(UI-SPEC "서버가 막은 탭에 문구 없음")을 DO 밖에서 소켓으로 본다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { BAR_MAP, lineWalkable } from "../../shared/game/map";
import { connect, createRoom, hello, joinOk, mark, nextFrame, seat, send, settle } from "./helpers";
import type { TestSocket } from "./helpers";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type MoveFrame = Extract<ServerMessage, { t: "world"; k: "move" }>;
type SnapFrame = Extract<ServerMessage, { t: "world"; k: "snap" }>;

const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;
const isSnap = (m: ServerMessage): m is SnapFrame => m.t === "world" && m.k === "snap";
const isMove = (m: ServerMessage): m is MoveFrame => m.t === "world" && m.k === "move";
/** 걷는 구간(두 점 이상)을 가진 move — 입장 때의 한 점 move 와 구별한다. */
const isWalk = (s: number) => (m: ServerMessage): m is MoveFrame => isMove(m) && m.s === s && m.p.length > 2;
/** 어느 소켓이 받은 world 프레임(원문) 가운데 mark 이후 것. */
const worldsSince = (sock: TestSocket, from: number): string[] => sock.frames.slice(from).filter((f) => parse(f).t === "world");
const errorsSince = (sock: TestSocket, from: number): string[] => sock.frames.slice(from).filter((f) => parse(f).t === "error");

describe("로비 이동 — 트레이서 (MAP-02, MAP-01)", () => {
  it("방장 hello 의 프레임 순서는 [state, world.snap] 이고 snap 에 seat 0 이 입장 지점 한 점으로 있다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    const snap = (await nextFrame(host, isSnap)) as SnapFrame;
    const kinds = host.frames.slice(0, 2).map((f) => {
      const m = parse(f);
      return m.t === "world" ? `world.${m.k}` : m.t;
    });
    expect(kinds.join(",")).toBe("state,world.snap");
    expect(snap.ents.map((e) => e.s).join(",")).toBe("0");
    expect(snap.ents[0]!.p.join(",")).toBe("360,40");
  });

  it("손님이 참가하면 방장 소켓이 state(2명) 다음에 그 손님의 한 점 world.move 를 받는다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    await nextFrame(host, isSnap);
    const mk = mark(host);
    await joinOk(code, "손님");
    const state = await nextFrame(host, (m) => m.t === "state" && m.view.players.length === 2);
    expect(state.t).toBe("state");
    const move = (await nextFrame(host, isMove)) as MoveFrame;
    expect(move.s).toBe(1);
    expect(move.p.join(",")).toBe("40,360");
    const order = host.frames.slice(mk).map((f) => parse(f).t);
    expect(order.join(",")).toBe("state,world");
  });

  it("손님 hello 의 프레임 순서도 [state, snap] 이고 snap.ents 는 seat 0·1 둘이다", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "손님");
    const host = await connect(code);
    await hello(host, token);
    const g = await connect(code);
    await hello(g, guest.token);
    const snap = (await nextFrame(g, isSnap)) as SnapFrame;
    expect(g.frames.slice(0, 2).map((f) => parse(f).t).join(",")).toBe("state,world");
    expect(snap.ents.map((e) => e.s).join(",")).toBe("0,1");
  });

  it("손님의 move 한 번은 방장·손님 소켓에 같은 world.move 로 가고 첫 점은 손님 위치, 끝 점은 목적지다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 300, z: 100 });
    const onHost = (await nextFrame(s.host, isWalk(1))) as MoveFrame;
    const onGuest = (await nextFrame(guest.sock, isWalk(1))) as MoveFrame;
    expect(JSON.stringify(onHost)).toBe(JSON.stringify(onGuest));
    expect(onHost.p.slice(0, 2).join(",")).toBe("40,360");
    expect(onHost.p.slice(-2).join(",")).toBe("300,100");
    expect(onHost.v).toBe(180);
  });

  it("걸을 수 없는 무대 중심을 누르면 끝 점이 걸을 수 있는 곳으로 보정된다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 0, z: 0 });
    const f = (await nextFrame(s.host, isWalk(1))) as MoveFrame;
    const end = { x: f.p[f.p.length - 2]!, z: f.p[f.p.length - 1]! };
    expect(lineWalkable(BAR_MAP, end, end)).toBe(true);
  });

  it("같은 손님이 100ms 뒤 다시 보낸 move 는 어느 소켓에도 새 프레임도 오류도 만들지 않는다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(1));
    await nextFrame(guest.sock, isWalk(1));
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    await sleep(100);
    send(guest.sock, { t: "move", x: -300, z: 100 });
    await sleep(500);
    await settle(s.host, mh);
    await settle(guest.sock, mg);
    expect(worldsSince(s.host, mh).length).toBe(0);
    expect(worldsSince(guest.sock, mg).length).toBe(0);
    expect(errorsSince(guest.sock, mg).length).toBe(0);
  });

  it("160ms 뒤의 두 번째 move 는 새 프레임이 된다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(1));
    await sleep(160);
    send(guest.sock, { t: "move", x: -300, z: 100 });
    const second = (await nextFrame(s.host, (m): m is MoveFrame => isWalk(1)(m) && m.p.slice(-2).join(",") === "-300,100")) as MoveFrame;
    expect(second.s).toBe(1);
  });

  it("hello 전 소켓의 move 는 아무 프레임도 만들지 않는다", async () => {
    const s = await seat(0, 0);
    const anon = await connect(s.code);
    await settle(s.host, 0); // hello 뒤 snap 이 아직 오는 중일 수 있어 먼저 비운다
    const mh = mark(s.host);
    const ma = mark(anon);
    send(anon, { t: "move", x: 300, z: 100 });
    const got = await settle(anon, ma);
    await settle(s.host, mh);
    expect(got.length).toBe(0);
    expect(worldsSince(s.host, mh).length).toBe(0);
  });

  it("형식이 틀린 move(소수·덧붙은 seat)는 기존 규칙대로 BAD_MESSAGE 다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    await settle(guest.sock, 0); // hello 뒤 snap 이 아직 오는 중일 수 있어 먼저 비운다
    const mk = mark(guest.sock);
    send(guest.sock, { t: "move", x: 1.5, z: 0 });
    send(guest.sock, { t: "move", x: 0, z: 0, seat: 1 });
    const got = await settle(guest.sock, mk);
    expect(got.map((m) => (m.t === "error" ? m.code : m.t)).join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE");
  });
});
