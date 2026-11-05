// 10-02: 로비 의상(dress) 처리 — 서버가 고른 값을 저장하고 모든 소켓의 players[].look 으로 보낸다 (D-6, L25·L26).
import { describe, expect, it } from "vitest";
import type { RoleId, ServerMessage } from "../../shared/protocol";
import { advanceTo, connect, editRoom, ghostsOf, hello, lastViewOf, mapPlayers, mark, nextFrame, pause, seat, send, settle, stable, startedGame, storedRoom, summary, withRole } from "./helpers";
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

// ---- L25·L26: 의상은 공개 값이고 역할의 함수가 아니다 (결정 D-6, 0015) ----

/** 6명 판의 좌석별 역할 배정. B 는 A 에서 마피아와 시민을 맞바꾼 배정이다(경찰·의사 자리는 그대로). */
const ROLES_A: readonly RoleId[] = ["mafia", "citizen", "police", "doctor", "mafia", "citizen"];
const ROLES_B: readonly RoleId[] = ["citizen", "mafia", "police", "doctor", "citizen", "mafia"];

/** 의상 대본: 좌석 1 이 mafia, 좌석 2 가 doctor(뒤에 noir 로 바꿈), 좌석 3 은 아무것도 안 고른다. 좌석 0 은 마피아(A)/시민(B)인데 기본 coat 를 입은 채다. */
const DRESS_SCRIPT: ReadonlyArray<{ seat: number; look: string; gapBefore?: number }> = [
  { seat: 1, look: "mafia" },
  { seat: 2, look: "doctor" },
  { seat: 4, look: "police" },
  { seat: 2, look: "noir", gapBefore: 300 },
];
const EXPECTED_LOOKS = "0:-,1:mafia,2:noir,3:-,4:police,5:-";

/** 프레임에서 공개 의상 열만 남긴다: state 의 players[] 좌석·look. */
const lookColumn = (msgs: ServerMessage[]): string =>
  stable(
    msgs.map((m) =>
      m.t === "state" ? ({ t: "state", players: m.view.players.map((p) => ({ seat: p.seat, look: p.look })) } as unknown as ServerMessage) : m,
    ),
  );

/** 대기실에서 역할을 저장소에 미리 써 두고(assign) 같은 대본을 보낸 뒤 판을 시작해 토론까지 간다. 좌석별 로비 프레임 열과 시작 뒤 마지막 view 의 look 열을 돌려준다. */
async function playDress(assign: readonly RoleId[]): Promise<{ code: string; lobbyBySeat: ServerMessage[][]; finalLooks: string[]; errors: number }> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  for (const k of socks) await settle(k, 0);
  // 역할이 대기실 저장 상태에 있어도(서버가 비교할 수 있게 해 둔다) 수락 결과는 같아야 한다.
  await editRoom(room.code, (r) => mapPlayers(r, (p) => ({ ...p, role: assign[p.seat as number] })));
  for (const k of socks) await settle(k, mark(k));
  const marks = socks.map((k) => mark(k));
  for (const step of DRESS_SCRIPT) {
    if (step.gapBefore !== undefined) await pause(step.gapBefore);
    send(socks[step.seat]!, { t: "dress", look: step.look });
    for (const k of socks) await settle(k, mark(k));
  }
  const lobbyBySeat: ServerMessage[][] = [];
  for (const [i, k] of socks.entries()) lobbyBySeat.push(await settle(k, marks[i]!));
  send(room.host, { t: "start" });
  for (const k of socks) await nextFrame(k, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "dayAnnounce");
  await advanceTo(room.code, socks, "discussion");
  for (const k of socks) await settle(k, mark(k));
  await editRoom(room.code, (r) => mapPlayers(r, (p) => ({ ...p, role: assign[p.seat as number] })));
  for (const k of socks) await settle(k, mark(k));
  return {
    code: room.code,
    lobbyBySeat,
    finalLooks: socks.map((k) => lastViewOf(k).players.map((p) => `${p.seat}:${p.look ?? "-"}`).join(",")),
    errors: socks.flatMap((k) => k.frames).filter((raw) => (JSON.parse(raw) as ServerMessage).t === "error").length,
  };
}

describe("L25·L26 — 의상은 공개 값이고 역할의 함수가 아니다", () => {
  it("L25: 역할 배정만 다른 두 판 A·B 에서 같은 대본을 보내고 시작하면 모든 좌석 소켓의 players[].look 열이 같다", { timeout: 30_000 }, async () => {
    const a = await playDress(ROLES_A);
    const b = await playDress(ROLES_B);
    expect(a.lobbyBySeat.length).toBe(6);
    const diffs: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const colA = lookColumn(a.lobbyBySeat[i]!);
      const colB = lookColumn(b.lobbyBySeat[i]!);
      expect(colA.length).toBeGreaterThan(0); // 비어 있는 비교가 아니다
      if (colA !== colB) diffs.push(`seat${i}`);
    }
    expect(diffs.join(",")).toBe("");
    // 게임 단계 view 의 열도 같고 대본의 결과다
    expect(a.finalLooks).toEqual(Array(6).fill(EXPECTED_LOOKS));
    expect(b.finalLooks).toEqual(Array(6).fill(EXPECTED_LOOKS));
  });

  it("L25: 실제 시민의 mafia 의상도, 실제 마피아의 기본 coat·police 의상도 모두 수락된다(오류·거절 프레임 없음)", { timeout: 30_000 }, async () => {
    for (const assign of [ROLES_A, ROLES_B]) {
      const run = await playDress(assign);
      expect(run.errors).toBe(0);
      const stored = (await storedRoom(run.code)).players as unknown as Array<{ seat: number; role: string; look?: string }>;
      for (const p of stored) expect(`${p.seat}:${p.role}`).toBe(`${p.seat}:${assign[p.seat]}`);
      expect(stored.sort((x, y) => x.seat - y.seat).map((p) => `${p.seat}:${p.look ?? "-"}`).join(",")).toBe(EXPECTED_LOOKS);
    }
    // 두 배정에서 좌석 1 은 서로 시민·마피아로 뒤바뀐다 — 그래도 둘 다 mafia 의상을 입었다
    expect(`${ROLES_A[1]} ${ROLES_B[1]}`).toBe("citizen mafia");
  });

  it("전수: 의상을 고르는 동안 모든 소켓이 받은 프레임의 look 값은 대본이 보낸 값(또는 키 없음)이고, 역할 단어와 같은 값은 players[].look 경로에서만 나온다", { timeout: 30_000 }, async () => {
    const a = await playDress(ROLES_A);
    const scripted = new Map<number, Set<string>>();
    for (const step of DRESS_SCRIPT) scripted.set(step.seat, (scripted.get(step.seat) ?? new Set<string>()).add(step.look));
    let withLook = 0;
    for (const msgs of a.lobbyBySeat) {
      for (const m of msgs) {
        if (m.t !== "state") continue;
        for (const p of m.view.players) {
          if (p.look === undefined) {
            expect("look" in p).toBe(false);
            continue;
          }
          expect(`${p.seat}:${scripted.get(p.seat)?.has(p.look) === true}`).toBe(`${p.seat}:true`);
          withLook += 1;
        }
        // 역할 단어는 players[].look 밖의 어디에도 없다(대기실 view 에는 me.role·day.roles 가 없다)
        const outside = JSON.stringify({ ...m.view, players: m.view.players.map((p) => ({ ...p, look: undefined })) });
        for (const word of ["mafia", "police", "doctor"]) expect(`${word}:${outside.includes(`"${word}"`)}`).toBe(`${word}:false`);
      }
    }
    expect(withLook).toBeGreaterThan(0);
  });

  it("L26: 게임 단계에서 시민·경찰·의사·마피아·탈락자가 dress 를 보내면 모두 같은 응답(자기 state 한 프레임)이고 다른 소켓은 0프레임, 저장된 방은 그대로다", { timeout: 60_000 }, async () => {
    const g = await startedGame("discussion", 5);
    const victim = withRole(g, "citizen")[0]!;
    const picks = [withRole(g, "citizen")[1]!, withRole(g, "police")[0]!, withRole(g, "doctor")[0]!, withRole(g, "mafia")[0]!];
    const { ghosts } = await ghostsOf(g, [victim.seat]);
    const senders = [...picks, ghosts[0]!];
    const before = JSON.stringify((await storedRoom(g.code)).players);
    const shapes: string[] = [];
    for (const [i, who] of senders.entries()) {
      const marks = g.actors.map((a) => mark(a.sock));
      send(who.sock, { t: "dress", look: i % 2 === 0 ? "hood" : "elder" });
      const got = new Map<number, ServerMessage[]>();
      for (const a of [who, ...g.actors.filter((x) => x !== who)]) {
        got.set(a.seat, (await settle(a.sock, marks[g.actors.indexOf(a)]!)).filter((m) => m.t !== "world"));
      }
      const own = got.get(who.seat)!;
      shapes.push(`${summary(own)}|${own.filter((m) => m.t === "state").map((m) => (m as State).view.players.map((p) => ("look" in p ? "L" : "-")).join("")).join(",")}`);
      for (const a of g.actors) if (a !== who) expect(`${a.seat}:${summary(got.get(a.seat)!)}`).toBe(`${a.seat}:[]`);
    }
    expect(new Set(shapes).size).toBe(1);
    expect(shapes[0]).toBe("[state:discussion]|------");
    expect(JSON.stringify((await storedRoom(g.code)).players)).toBe(before);
  });
});
