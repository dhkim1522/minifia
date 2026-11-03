// 07-14: 채팅·입력 중 누설 검사 (a)~(d) (UI-SPEC "검사 가능하게 둘 것", CHAT-02·03, T-07-35·37).
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 6명 판(마피아 둘·경찰·의사·시민 둘)을 실제로 시작해 돌린다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { advanceTo, chatKeysOf, chatSend, chatsOf, connect, editRoom, helloForLog, killSeats, mapPlayers, mark, pause, send, settle, startedGame, summary, typingSend, withRole } from "./helpers";
import type { Actor, Game } from "./helpers";

/** settle 이 돌려준 프레임 가운데 typing 만 한 줄 문자열로. */
const typings = (msgs: ServerMessage[]): string => msgs.filter((m) => m.t === "typing").map((m) => JSON.stringify(m)).join("|");
const rejects = (msgs: ServerMessage[]): string => msgs.filter((m) => m.t === "chatReject").map((m) => JSON.stringify(m)).join("|");

/** 행동 직전 모든 소켓의 위치를 적고, 행동하고, 모든 소켓을 flush 해 소켓별 프레임을 돌려준다. 보낸 쪽이 처리를 마쳤다는 증거(pong)가 먼저다. */
async function observe(g: Game, first: Actor, act: () => void | Promise<void>): Promise<ServerMessage[][]> {
  const marks = g.socks.map((s) => mark(s));
  await act();
  const order = [first, ...g.actors.filter((a) => a !== first)];
  const out: ServerMessage[][] = g.actors.map(() => []);
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

describe("누설 검사 (a) — 밤 마피아의 채팅·입력 중은 시민 편 소켓에 부채널이 없다 (T-07-37)", () => {
  it("마피아가 가만히 있는 구간과 채팅·입력 중을 보내는 구간에서 시민 편 소켓이 받는 프레임 열이 같다", async () => {
    const g = await startedGame("night");
    const [mafiaA, mafiaB] = withRole(g, "mafia") as [Actor, Actor];
    const townIdx = g.actors.map((a, i) => ({ a, i })).filter((x) => x.a.role !== "mafia").map((x) => x.i);
    expect(townIdx.length).toBe(4);

    // 구간 P: 마피아가 가만히 있다.
    const p = await observe(g, mafiaA, () => pause(500));
    // 구간 Q: 같은 길이 동안 마피아 A·B 가 입력 중과 채팅을 보낸다(보낸 사람을 달리해 D5 간격에 걸리지 않게).
    const q = await observe(g, mafiaA, async () => {
      typingSend(mafiaA.sock, true);
      chatSend(mafiaA.sock, "그 사람으로 가요");
      chatSend(mafiaB.sock, "동의해요");
      typingSend(mafiaA.sock, false);
      await pause(500);
    });

    for (const i of townIdx) {
      expect(summary(p[i]!)).toBe("[]");
      expect(summary(q[i]!)).toBe(summary(p[i]!));
    }
    // 구간 Q 가 정말 활동이 있던 구간이다: 마피아 B 는 줄 둘을 받고 입력 중 켜짐·꺼짐 두 프레임을 받았다.
    const bIdx = g.actors.indexOf(mafiaB);
    expect(chatsOf(q[bIdx]!).length).toBe(2);
    expect(typings(q[bIdx]!).split("|").length).toBe(2);
  }, 30_000);
});

describe("누설 검사 (b) — 탈락자의 채팅·입력 중은 산 사람 소켓에 0건 (CHAT-03)", () => {
  it("낮에 탈락자 X 가 입력 중과 채팅을 보내면 탈락자 Z 만 받고 산 사람은 한 프레임도 받지 않는다", async () => {
    const g = await startedGame("discussion");
    const [x, z] = withRole(g, "citizen") as [Actor, Actor];
    await killSeats(g, [x.seat, z.seat]);

    const got = await observe(g, x, () => {
      typingSend(x.sock, true);
      chatSend(x.sock, "구경 중이에요");
    });

    for (const a of g.actors) {
      const msgs = got[g.actors.indexOf(a)]!;
      if (a === z) {
        expect(`${typings(msgs)}/${chatsOf(msgs).map((c) => c.ch).join(",")}`).toBe(`{"t":"typing","seat":${x.seat},"on":true}/ghost`);
      } else if (a === x) {
        expect(`${typings(msgs)}/${chatsOf(msgs).map((c) => c.ch).join(",")}`).toBe("/ghost"); // 자기 줄만 돌려받고 입력 중은 되돌아오지 않는다
      } else {
        expect(summary(msgs)).toBe("[]");
      }
    }
  }, 30_000);
});

describe("누설 검사 (c) — 단계 키가 틀린 줄은 더 넓은 채널로 가지 않고 폐기된다 (T-07-24)", () => {
  it("밤의 단계 키로 아침 뒤에 도착한 마피아 줄·입력 중은 모든 소켓에 0건이고 보낸 소켓만 chatReject phase 를 받으며 저장도 되지 않는다", async () => {
    const g = await startedGame("night");
    const mafiaA = withRole(g, "mafia")[0]!;
    const nightKey = `1:night`;
    await advanceTo(g.code, g.socks, "morning");
    for (const s of g.socks) await settle(s, mark(s));

    const got = await observe(g, mafiaA, () => {
      chatSend(mafiaA.sock, "늦게 도착한 줄", nightKey);
      send(mafiaA.sock, { t: "typing", on: true, pk: nightKey });
    });

    for (const a of g.actors) {
      const msgs = got[g.actors.indexOf(a)]!;
      expect(chatsOf(msgs).length).toBe(0);
      expect(typings(msgs)).toBe("");
      expect(rejects(msgs)).toBe(a === mafiaA ? '{"t":"chatReject","why":"phase"}' : "");
      if (a !== mafiaA) expect(summary(msgs)).toBe("[]");
    }
    expect((await chatKeysOf(g.code)).length).toBe(0);
  }, 30_000);
});

describe("누설 검사 (d) — 재접속 chatLog 도 같은 audience 를 지난다 (T-07-35, T-07-36)", () => {
  // 결정 0061-11: ".lines[].k" 는 서버가 사망 전환에서 만든 카드 표시, 공개 정보. 다른 경로는 넓히지 않는다.
  const CHATLOG_KEY_PATHS = new Set([".t", ".lines", ".lines[].ch", ".lines[].seat", ".lines[].seq", ".lines[].text", ".lines[].at", ".lines[].k"]);
  const keyPaths = (value: unknown, path = ""): string[] => {
    if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
    if (value !== null && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
    }
    return [];
  };

  it("밤에 시민 C 는 mafia·ghost 0건, 막 탈락한 X 는 탈락 전 mafia 줄 없이 탈락 뒤 줄만, 마피아 B 는 mafia 줄만 되돌려 받고 프레임 키는 허용 목록 안이다", async () => {
    const g = await startedGame("night");
    const [mafiaA, mafiaB] = withRole(g, "mafia") as [Actor, Actor];
    const [citizenC, victimX] = withRole(g, "citizen") as [Actor, Actor];

    chatSend(mafiaA.sock, "탈락 전 줄");
    await settle(mafiaA.sock, 0);
    await killSeats(g, [victimX.seat]);
    chatSend(victimX.sock, "방금 탈락했어요");
    await settle(victimX.sock, 0);
    chatSend(mafiaB.sock, "탈락 뒤 줄");
    await settle(mafiaB.sock, 0);

    const replay = async (who: Actor): Promise<{ lines: string; raw: string }> => {
      const sock = await connect(g.code);
      const lines = await helloForLog(sock, who.token);
      const raw = sock.frames.find((f) => (JSON.parse(f) as ServerMessage).t === "chatLog")!;
      return { lines: lines.map((l) => `${l.ch}/${l.seat}/${l.seq}/${l.text}`).join("|"), raw };
    };

    const c = await replay(citizenC);
    expect(c.lines).toBe("");

    const x = await replay(victimX);
    expect(x.lines).toBe(`ghost/${victimX.seat}/1/방금 탈락했어요|mafia/${mafiaB.seat}/2/탈락 뒤 줄`);

    const b = await replay(mafiaB);
    expect(b.lines).toBe(`mafia/${mafiaA.seat}/1/탈락 전 줄|mafia/${mafiaB.seat}/2/탈락 뒤 줄`);

    for (const r of [c, x, b]) {
      const frame = JSON.parse(r.raw) as unknown;
      for (const path of keyPaths(frame)) expect(CHATLOG_KEY_PATHS.has(path)).toBe(true);
    }
  }, 30_000);

  it("아침 카드(k)가 든 재접속 chatLog 의 키는 허용 목록 안이고 k 값은 will·note 뿐이다", async () => {
    const g = await startedGame("night");
    const v = withRole(g, "citizen")[0]!;
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === v.seat ? { ...p, will: "유언" } : p)));
    const mafias = withRole(g, "mafia");
    for (const m of mafias) send(m.sock, { t: "pick", target: v.seat });
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    send(mafias[0]!.sock, { t: "note", text: "쪽지" });
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    const again = await connect(g.code);
    const lines = await helloForLog(again, g.actors.find((a) => a.seat !== v.seat && a.role === "citizen")!.token);
    expect(lines.map((l) => l.k).join(",")).toBe("will,note");
    const raw = again.frames.find((f) => (JSON.parse(f) as ServerMessage).t === "chatLog")!;
    for (const path of keyPaths(JSON.parse(raw))) expect(`${path}:${CHATLOG_KEY_PATHS.has(path)}`).toBe(`${path}:true`);
  }, 40_000);
});
