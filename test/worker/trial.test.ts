// DAY-03~06 DO 시험, 결정 0060. 08-11 이 실제 흐름으로 넓힌다.
// 아직 흐름은 v1.0 그대로라 시험은 저장 상태를 지목·찬반 단계로 옮겨(toPhase) 들어간다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { mark, pause, pointAs, send, settle, startedGame, storedRoom, summary, toPhase } from "./helpers";
import type { Game } from "./helpers";

const viewsOf = (msgs: ServerMessage[]): RoomView[] =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").map((m) => m.view);

/** act 가 메시지를 보내면 모든 소켓이 받은 프레임을 소켓 순서대로 돌려준다(보내기 전 mark → ping/pong 사이에 낀 프레임). */
async function castAll(g: Game, act: () => void): Promise<ServerMessage[][]> {
  const marks = g.socks.map(mark);
  act();
  const out: ServerMessage[][] = [];
  for (let i = 0; i < g.socks.length; i += 1) out.push(await settle(g.socks[i]!, marks[i]!));
  return out;
}

/** 소켓 순서대로 프레임 요약을 공백으로 이은 한 줄. */
const lines = (frames: ServerMessage[][]): string => frames.map(summary).join(" ");

/** 저장된 방에서 좌석별 지목 값(서버 전용 nominate). */
async function storedNominates(code: string): Promise<string> {
  const room = (await storedRoom(code)) as unknown as { players: Array<{ seat: number; nominate?: number }> };
  return [...room.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => `${p.seat}:${p.nominate ?? "-"}`)
    .join(" ");
}

const pointsOf = (v: RoomView | undefined): string => JSON.stringify(v?.day?.points);

/** 방장 + 손님 3 = 4명 판을 시작해 지목 단계로 옮긴다. actors[0] 은 방장이다. */
async function nominationRoom(): Promise<Game> {
  const g = await startedGame("discussion", 3);
  await toPhase(g.code, "nomination");
  return g;
}

describe("지목 (DAY-04, 결정 0060-3)", () => {
  it("손님 A 의 지목은 네 소켓 모두에게 정확히 한 프레임으로 가고 모든 view 의 day.points 가 같은 공개 목록이다", async () => {
    const g = await nominationRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    const frames = await castAll(g, () => pointAs(a.sock, b.seat));
    expect(lines(frames)).toBe("[state:nomination] [state:nomination] [state:nomination] [state:nomination]");
    const want = JSON.stringify([{ seat: a.seat, target: b.seat }]);
    expect(frames.map((f) => pointsOf(viewsOf(f)[0])).join("|")).toBe([want, want, want, want].join("|"));
  });

  it("같은 사람의 250ms 안 두 번째 지목은 상태를 바꾸지 않고 그 사람 소켓에만 서버 값 view 를 보낸다(오류 프레임 없음)", async () => {
    const g = await nominationRoom();
    const [a, b, c] = [g.actors[1]!, g.actors[2]!, g.actors[3]!];
    await castAll(g, () => pointAs(a.sock, b.seat));
    const before = await storedNominates(g.code);
    const second = await castAll(g, () => pointAs(a.sock, c.seat));
    // a 는 actors[1] 이라 소켓 순서 두 번째다. 다른 소켓은 500ms 급 관찰(ping/pong 사이)에서 프레임이 없다.
    expect(lines(second)).toBe("[] [state:nomination] [] []");
    expect(pointsOf(viewsOf(second[1]!)[0])).toBe(JSON.stringify([{ seat: a.seat, target: b.seat }]));
    expect(await storedNominates(g.code)).toBe(before);
  });

  it("250ms 가 지난 뒤의 다른 대상은 받아들여져 모두 새 목록을 받는다", async () => {
    const g = await nominationRoom();
    const [a, b, c] = [g.actors[1]!, g.actors[2]!, g.actors[3]!];
    await castAll(g, () => pointAs(a.sock, b.seat));
    await pause(300);
    const frames = await castAll(g, () => pointAs(a.sock, c.seat));
    expect(lines(frames)).toBe("[state:nomination] [state:nomination] [state:nomination] [state:nomination]");
    const want = JSON.stringify([{ seat: a.seat, target: c.seat }]);
    expect(frames.map((f) => pointsOf(viewsOf(f)[0])).join("|")).toBe([want, want, want, want].join("|"));
  });

  it("같은 값을 다시 보내면 모든 소켓이 프레임을 받지 않는다", async () => {
    const g = await nominationRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    await castAll(g, () => pointAs(a.sock, b.seat));
    await pause(300);
    expect(lines(await castAll(g, () => pointAs(a.sock, b.seat)))).toBe("[] [] [] []");
  });

  it("자기 자신을 가리키면 보낸 소켓만 BAD_MESSAGE 와 최신 state 를 받는다", async () => {
    const g = await nominationRoom();
    const a = g.actors[1]!;
    expect(lines(await castAll(g, () => pointAs(a.sock, a.seat)))).toBe("[] [error:BAD_MESSAGE,state:nomination] [] []");
  });

  it("지목 단계가 아니면(discussion) 보낸 소켓만 WRONG_PHASE 와 최신 state 를 받는다", async () => {
    const g = await startedGame("discussion", 3);
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    expect(lines(await castAll(g, () => pointAs(a.sock, b.seat)))).toBe("[] [error:WRONG_PHASE,state:discussion] [] []");
  });

  it("스키마: 덧붙은 키(seat)와 범위 밖 target(8)은 보낸 소켓만 BAD_MESSAGE 를 받고 저장은 그대로다", async () => {
    const g = await nominationRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    const extra = await castAll(g, () => send(a.sock, { t: "point", target: b.seat, seat: 1 }));
    const range = await castAll(g, () => send(a.sock, { t: "point", target: 8 }));
    expect(`${lines(extra)} ${lines(range)}`).toBe("[] [error:BAD_MESSAGE] [] [] [] [error:BAD_MESSAGE] [] []");
    expect(await storedNominates(g.code)).toBe(
      [...(await storedRoomSeats(g.code))].map((s) => `${s}:-`).join(" "),
    );
  });
});

/** 저장된 방의 좌석(오름차순). */
async function storedRoomSeats(code: string): Promise<number[]> {
  const room = (await storedRoom(code)) as unknown as { players: Array<{ seat: number }> };
  return room.players.map((p) => p.seat).sort((x, y) => x - y);
}
