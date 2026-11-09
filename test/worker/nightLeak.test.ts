// NIGHT-07 누설 증명, 결정 0061-2·3·4, UI-SPEC L1·L5·L9, RESEARCH 메타모픽 설계 (09-09; 09-16 이 구간 A/B 비교를 더한다).
// 밤에 시민 편 소켓은 마피아의 활동에서 한 프레임도 받지 않고, 진입 snap 은 본인 한 칸뿐이다(네트워크로도 가지 않는다 — 화면에서 숨기는 방식이 아니다, 결정 0002).
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 실패 출력은 한 줄이어야 해서(TAP) 프레임은 요약 문자열로 비교한다.
import { evictDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { PHASE_DEFS } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { nominationSpanMs } from "../helpers/voteState";
import { advanceTo, chatSend, chatKeysOf, connect, editRoom, mapPlayers, endAs, lastViewOf, seat, send, skipThrough, flushWorld, homeBySeat, mark, moveAs, nextFrame, observe, pause, pickAs, restoreStorage, segEndsBySeat, settle, snapSeatsOf, snapshotStorage, stable, startedGame, storedRoom, summary, typingSend, withRole, worldFramesOf, worldOf } from "./helpers";
import type { Game } from "./helpers";

/** 마지막 world snap 의 '좌석:x,z' 오름차순 문자열. snap 이 없으면 'none'. */
function snapPoints(msgs: ServerMessage[]): string {
  const snaps = msgs.filter((m): m is Extract<ServerMessage, { t: "world"; k: "snap" }> => m.t === "world" && m.k === "snap");
  const last = snaps.at(-1);
  if (last === undefined) return "none";
  return [...last.ents].sort((a, b) => a.s - b.s).map((e) => `${e.s}:${e.p.join(",")}`).join("|");
}

/** home 문자열('일차|0:x,z|...') 중 이 좌석들만. */
const homeRows = (home: string, seats: number[]): string =>
  home
    .split("|")
    .slice(1)
    .filter((row) => seats.includes(Number(row.split(":")[0])))
    .join("|");

/** 토론 중 두 사람이 걷게 해 home 이 선 자리와 달라지게 하고, 지목까지 넘긴 판. 지목 직후 home 을 함께 돌려준다. */
async function nominationWithWalkers(): Promise<{ g: Game; home: string }> {
  const g = await startedGame("discussion");
  moveAs(withRole(g, "citizen")[0]!, -120, 60);
  moveAs(withRole(g, "mafia")[0]!, 160, -80);
  for (const sock of g.socks) await settle(sock, mark(sock));
  await flushWorld(g.code);
  await advanceTo(g.code, g.socks, "nomination");
  for (const sock of g.socks) await settle(sock, mark(sock));
  return { g, home: await homeBySeat(g.code) };
}

describe("밤 진입 — 트레이서 (NIGHT-07, 결정 0061-3·5)", () => {
  it("지목에서 밤으로 들어가면 시민·경찰·의사 소켓은 본인 한 칸 snap 하나만 받고 그 p 는 본인 home 이다", async () => {
    const { g, home } = await nominationWithWalkers();
    const marks = g.socks.map((s) => mark(s));

    await advanceTo(g.code, g.socks, "night");
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));

    for (const a of g.actors.filter((x) => x.role !== "mafia")) {
      const msgs = got[g.actors.indexOf(a)]!;
      expect(`${a.role}:${worldFramesOf(a.sock, marks[g.actors.indexOf(a)]!).map((m) => m.k).join(",")}`).toBe(`${a.role}:snap`);
      expect(`${a.role}:${snapSeatsOf(msgs)}`).toBe(`${a.role}:${a.seat}`);
      expect(`${a.role}:${snapPoints(msgs)}`).toBe(`${a.role}:${homeRows(home, [a.seat])}`);
    }
  }, 40_000);

  it("같은 밤 진입에서 산 마피아 소켓도 본인 한 칸 snap 하나만 받는다 — 역할과 무관하게 같은 모양이다 (15-03 D-05, T-15-11)", async () => {
    const { g, home } = await nominationWithWalkers();
    const marks = g.socks.map((s) => mark(s));

    await advanceTo(g.code, g.socks, "night");
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));

    for (const a of withRole(g, "mafia")) {
      const msgs = got[g.actors.indexOf(a)]!;
      expect(worldFramesOf(a.sock, marks[g.actors.indexOf(a)]!).map((m) => m.k).join(",")).toBe("snap");
      expect(snapSeatsOf(msgs)).toBe(String(a.seat));
      expect(snapPoints(msgs)).toBe(homeRows(home, [a.seat]));
    }
  }, 40_000);

  it("DO 가 퇴거된 뒤에도 home 은 저장소에 남아 있다 (기록 즉시 저장)", async () => {
    const { g, home } = await nominationWithWalkers();
    await advanceTo(g.code, g.socks, "night");

    await evictDurableObject(env.ROOM.getByName(g.code));

    expect(await homeBySeat(g.code)).toBe(home);
    expect(home).not.toBe("none");
  }, 40_000);
});

// 09-09 Task 2·3 가 아래에 아침 진입·직접 불변식 L1·세 경로 동일성·재접속 시험을 더한다.
describe("아침 진입 — 모두 home (결정 0061-4, UI-SPEC A1·L5)", () => {
  /** 밤에 마피아 둘이 시민 V 를 고르고 마피아 A 가 걷게 한 뒤 아침으로 넘긴다. */
  async function morningAfterWalk(): Promise<{ g: Game; victim: Game["actors"][number]; walker: Game["actors"][number]; home: string; got: ServerMessage[][]; marks: number[] }> {
    const g = await startedGame("night");
    const [walker, other] = withRole(g, "mafia") as [Game["actors"][number], Game["actors"][number]];
    const victim = withRole(g, "citizen")[0]!;
    pickAs(walker, victim.seat);
    pickAs(other, victim.seat);
    moveAs(walker, 300, 100);
    await pause(200);
    moveAs(walker, 200, -100);
    for (const sock of g.socks) await settle(sock, mark(sock));
    const home = await homeBySeat(g.code);
    const marks = g.socks.map((s) => mark(s));
    await advanceTo(g.code, g.socks, "morning");
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));
    return { g, victim, walker, home, got, marks };
  }

  it("산 사람 다섯 소켓(마피아 포함)이 받은 아침 world 는 snap 하나로 모두 같고, 걷던 마피아도 자기 home 에 서 있다", async () => {
    const { g, victim, home, got, marks } = await morningAfterWalk();
    const alive = g.actors.filter((a) => a !== victim);
    const aliveSeats = alive.map((a) => a.seat).sort((p, q) => p - q);

    const columns = alive.map((a) => stable(worldFramesOf(a.sock, marks[g.actors.indexOf(a)]!)));
    expect(new Set(columns).size).toBe(1);
    for (const a of alive) {
      expect(worldFramesOf(a.sock, marks[g.actors.indexOf(a)]!).map((m) => m.k).join(",")).toBe("snap");
      expect(snapSeatsOf(got[g.actors.indexOf(a)]!)).toBe(aliveSeats.join(","));
      expect(snapPoints(got[g.actors.indexOf(a)]!)).toBe(homeRows(home, aliveSeats));
    }
  }, 40_000);

  it("탈락한 V 의 소켓은 여섯 모두의 snap 을 정확히 하나 받는다 (같은 snap 을 두 번 받지 않는다)", async () => {
    const { g, victim, home, got, marks } = await morningAfterWalk();

    expect(worldFramesOf(victim.sock, marks[g.actors.indexOf(victim)]!).map((m) => m.k).join(",")).toBe("snap");
    expect(snapSeatsOf(got[g.actors.indexOf(victim)]!)).toBe("0,1,2,3,4,5");
    expect(snapPoints(got[g.actors.indexOf(victim)]!)).toBe(homeRows(home, [0, 1, 2, 3, 4, 5]));
  }, 40_000);

  it("알람이 늦어 토론에서 지목·밤을 지나 아침으로 한 번에 따라잡아도 아침 위치가 토론이 끝난 자리(home)다", async () => {
    const g = await startedGame("discussion");
    moveAs(withRole(g, "citizen")[0]!, -120, 60);
    moveAs(withRole(g, "mafia")[0]!, 160, -80);
    for (const sock of g.socks) await settle(sock, mark(sock));
    await flushWorld(g.code);
    const before = await segEndsBySeat(g.code, 1);
    // 지목 길이는 저장된 토론 상태에서 지목 첫 순간을 만들고 마감 사슬을 따라 계산한다(지목 방식과 무관, 09.1-03).
    const stored = (await storedRoom(g.code)) as unknown as RoomState;
    const nominationFirst = tick(stored, stored.phaseEndsAt!);
    const late = nominationSpanMs(nominationFirst, 1) + PHASE_DEFS.night.durationMs! + 1000;
    await editRoom(g.code, (room) => ({ ...room, phaseEndsAt: Date.now() - late }));
    const marks = g.socks.map((s) => mark(s));

    expect(await runDurableObjectAlarm(env.ROOM.getByName(g.code))).toBe(true);
    for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "morning");
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));

    const everyone = g.actors.map((a) => a.seat).sort((p, q) => p - q);
    expect(await homeBySeat(g.code)).toBe(before);
    for (const a of g.actors) expect(snapPoints(got[g.actors.indexOf(a)]!)).toBe(homeRows(before, everyone));
  }, 40_000);
});

describe("직접 불변식 L1 — 밤 동안 시민 편 소켓은 마피아 활동에서 한 프레임도 받지 않는다 (NIGHT-07)", () => {
  it("산 마피아 둘이 move ×3·pick·chat·typing 을 보내는 구간에 순수 시민 두 소켓과 경찰·의사 소켓의 settle 결과가 [] 다", async () => {
    const g = await startedGame("night");
    const [a, b] = withRole(g, "mafia") as [Game["actors"][number], Game["actors"][number]];
    const target = withRole(g, "citizen")[0]!;

    const got = await observe(g, a, async () => {
      for (const [px, pz] of [
        [200, 200],
        [-200, 100],
        [100, -250],
      ] as const) {
        moveAs(a, px, pz);
        moveAs(b, pz, px);
        await pause(200);
      }
      pickAs(a, target.seat);
      pickAs(b, target.seat);
      chatSend(a.sock, "오늘 밤은 저 사람");
      typingSend(b.sock, true);
      await pause(300);
      typingSend(b.sock, false);
    });

    const quiet = g.actors.filter((x) => x.role !== "mafia");
    expect(quiet.length).toBe(4);
    expect(quiet.map((x) => summary(got[g.actors.indexOf(x)]!)).join(",")).toBe("[],[],[],[]");
  }, 40_000);
});

/** 새 소켓으로 hello 하고 chatLog 까지 받은 뒤 받은 프레임 전부를 순서대로 돌려준다. */
async function helloFrames(code: string, token: string): Promise<ServerMessage[]> {
  const sock = await connect(code);
  send(sock, { t: "hello", token });
  await nextFrame(sock, (m) => m.t === "chatLog");
  return sock.frames.map((raw) => JSON.parse(raw) as ServerMessage);
}

/** 이 프레임 열 중 state·world·chatLog 의 종류 순서('state,world,chatLog'). */
const kinds = (msgs: ServerMessage[]): string =>
  msgs
    .filter((m) => m.t === "state" || m.t === "world" || m.t === "chatLog")
    .map((m) => m.t)
    .join(",");

describe("세 경로 동일성 — 테스트 넘기기·토론 끝내기도 단계 마감과 같은 밤·home (결정 0061-19, T-09-20)", () => {
  it("테스트 방에서 testSkip 으로 토론 → 지목 → 밤에 가도 home 이 기록되고 시민 편 소켓의 밤 snap 이 본인 한 칸(home)이다", async () => {
    const r = await seat(3, 0, { testMode: true });
    const socks = [r.host, ...r.guests.map((g) => g.sock)];
    for (const sock of socks) await settle(sock, mark(sock));
    send(r.host, { t: "testRole", role: "mafia" });
    await settle(r.host, mark(r.host));
    send(r.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    await skipThrough(r, "nomination");
    const home = await homeBySeat(r.code);
    expect(home.split("|")[0]).toBe("1");
    for (const sock of socks) await settle(sock, mark(sock));
    const marks = socks.map((sock) => mark(sock));

    await skipThrough(r, "night");
    const got = await Promise.all(socks.map((sock, i) => settle(sock, marks[i]!)));

    const mine = (i: number): number => lastViewOf(socks[i]!).me.seat;
    // 밤 snap 은 마피아(방장)도 본인 한 칸이다(15-03 D-05) — 모든 소켓이 같은 규칙이다.
    for (let i = 0; i < socks.length; i += 1) expect(snapPoints(got[i]!)).toBe(homeRows(home, [mine(i)]));
  }, 40_000);

  it("산 사람 전원이 토론 끝내기를 눌러 과반으로 지목에 들어가도 토론 마지막 자리가 home 으로 기록된다", async () => {
    const g = await startedGame("discussion");
    moveAs(withRole(g, "citizen")[0]!, -120, 60);
    for (const sock of g.socks) await settle(sock, mark(sock));
    await flushWorld(g.code);
    const before = await segEndsBySeat(g.code, 1);

    for (const a of g.actors) endAs(a.sock, true);
    for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "nomination");

    expect(await homeBySeat(g.code)).toBe(before);
  }, 40_000);
});

describe("재접속 첫 snap — 라이브 진입 snap 과 같은 좌석 규칙 (L9, 결정 0061-3·4)", () => {
  it("밤 중간에 시민이 새 소켓으로 hello 하면 첫 프레임 열이 [state, world snap(본인 한 칸, home), chatLog] 이고 마피아도 본인 한 칸이다(15-03 D-05)", async () => {
    const g = await startedGame("night");
    const home = await homeBySeat(g.code);
    const citizen = withRole(g, "citizen")[0]!;
    const mafia = withRole(g, "mafia")[0]!;

    const asCitizen = await helloFrames(g.code, citizen.token);
    expect(kinds(asCitizen)).toBe("state,world,chatLog");
    expect(snapPoints(asCitizen)).toBe(homeRows(home, [citizen.seat]));

    const asMafia = await helloFrames(g.code, mafia.token);
    expect(kinds(asMafia)).toBe("state,world,chatLog");
    expect(snapPoints(asMafia)).toBe(homeRows(home, [mafia.seat]));
  }, 40_000);

  it("아침 중간에 시민이 hello 하면 산 사람 전원의 home 좌표 snap 을 받는다", async () => {
    const g = await startedGame("morning");
    const home = await homeBySeat(g.code);
    const citizen = withRole(g, "citizen")[0]!;

    const frames = await helloFrames(g.code, citizen.token);

    expect(kinds(frames)).toBe("state,world,chatLog");
    expect(snapPoints(frames)).toBe(homeRows(home, g.actors.map((a) => a.seat)));
  }, 40_000);
});

// ---- 메타모픽 비교 (09-16, NIGHT-07, UI-SPEC L2) ----
// 같은 방·같은 밤 시작 상태(저장소 스냅샷)에서 두 구간을 돌려 시민 편 소켓의 프레임 열이 같음을 보인다.
// 휘발 필드(serverNow·phaseEndsAt·t0·at·c·seq)만 stable() 이 지운다. 목록을 넓히거나 마피아 행동을 대본에서 빼서 초록을 만들지 않는다(L11).

type Actor = Game["actors"][number];

/** 밤 진입 직후 상태에서 script 를 돌리고 아침 → 낮 시작까지 넘긴 뒤, 소켓마다 그 구간의 프레임 열(stable)을 돌려준다. */
async function segment(g: Game, script: () => Promise<void>): Promise<string[]> {
  const marks = g.socks.map((s) => mark(s));
  await script();
  await advanceTo(g.code, g.socks, "morning");
  await advanceTo(g.code, g.socks, "dayAnnounce");
  const cols: string[] = [];
  for (let i = 0; i < g.socks.length; i += 1) cols.push(stable(await settle(g.socks[i]!, marks[i]!)));
  return cols;
}

/** 마피아가 잔뜩 움직이고 말한다: move ×3, chat, typing. 대상 pick 은 호출부가 정한다. */
async function mafiaBusy(mafias: Actor[]): Promise<void> {
  const [a, b] = mafias as [Actor, Actor];
  for (const [px, pz] of [
    [200, 200],
    [-200, 100],
    [100, -250],
  ] as const) {
    moveAs(a, px, pz);
    moveAs(b, pz, px);
    await pause(150);
  }
  chatSend(a.sock, "오늘 밤은 저 사람");
  typingSend(b.sock, true);
  await pause(250);
  typingSend(b.sock, false);
  for (const m of mafias) await settle(m.sock, mark(m.sock));
}

describe("저장소 스냅샷·복원 도우미", () => {
  it("스냅샷 뒤 저장소를 바꿔도 복원하면 room·world·chat 키가 스냅샷 때와 같다", async () => {
    const g = await startedGame("night");
    await flushWorld(g.code);
    const snap = await snapshotStorage(g.code);
    const before = JSON.stringify([await worldOf(g.code), await chatKeysOf(g.code), await homeBySeat(g.code)]);

    const mafia = withRole(g, "mafia")[0]!;
    chatSend(mafia.sock, "복원 확인");
    moveAs(mafia, 250, 250);
    await settle(mafia.sock, mark(mafia.sock));
    await advanceTo(g.code, g.socks, "morning");
    expect(JSON.stringify([await worldOf(g.code), await chatKeysOf(g.code), await homeBySeat(g.code)])).not.toBe(before);

    await restoreStorage(g.code, snap);
    expect(JSON.stringify([await worldOf(g.code), await chatKeysOf(g.code), await homeBySeat(g.code)])).toBe(before);
  }, 40_000);
});

describe("메타모픽 (i) 무사 밤 (L2)", () => {
  it("마피아가 서로 다른 시민을 고르고 움직이고 말해도 가만히 있던 밤과 시민·경찰·의사 소켓의 프레임 열이 같다 (둘 다 무사)", async () => {
    const g = await startedGame("night");
    const mafias = withRole(g, "mafia");
    const citizens = withRole(g, "citizen");
    await flushWorld(g.code);
    const snap = await snapshotStorage(g.code);

    const quiet = await segment(g, async () => {});
    await restoreStorage(g.code, snap);
    const busy = await segment(g, async () => {
      pickAs(mafias[0]!, citizens[0]!.seat);
      pickAs(mafias[1]!, citizens[1]!.seat);
      await mafiaBusy(mafias);
    });

    for (const x of g.actors.filter((a) => a.role !== "mafia")) {
      const i = g.actors.indexOf(x);
      expect(`${x.role}:${busy[i]}`).toBe(`${x.role}:${quiet[i]}`);
      // 열이 비어 있지 않다: 아침 state 와 아침 snap, 낮 시작 state 가 모두 들어 있다.
      expect(quiet[i]!.includes('"phase":"morning"') && quiet[i]!.includes('"k":"snap"') && quiet[i]!.includes('"phase":"dayAnnounce"')).toBe(true);
      expect(quiet[i]!.includes('"morning":{}')).toBe(true);
    }
    // 대조: 마피아의 열은 두 구간이 달라야 한다(시험이 아무것도 안 보는 것이 아님).
    for (const x of mafias) {
      const i = g.actors.indexOf(x);
      expect(busy[i]).not.toBe(quiet[i]);
    }
  }, 90_000);
});

describe("메타모픽 (ii) 암살 밤 (L2·L5)", () => {
  it("마피아 둘이 같은 시민 V 를 고르고 같은 쪽지를 남긴 두 밤 — 움직이고 말했든 가만히 있었든 시민 편 소켓의 프레임 열이 같고 V 사망·카드 두 장·같은 분필이다", async () => {
    const g = await startedGame("night");
    const mafias = withRole(g, "mafia");
    const v = withRole(g, "citizen")[0]!;
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === v.seat ? { ...p, will: "VWILL" } : p)));
    for (const sock of g.socks) await settle(sock, mark(sock));
    const snap = await snapshotStorage(g.code);

    const assassinate = async (): Promise<void> => {
      pickAs(mafias[0]!, v.seat);
      pickAs(mafias[1]!, v.seat);
      for (const m of mafias) await settle(m.sock, mark(m.sock));
      send(mafias[0]!.sock, { t: "note", text: "조용히" });
      await settle(mafias[0]!.sock, mark(mafias[0]!.sock));
    };
    const quiet = await segment(g, assassinate);
    await restoreStorage(g.code, snap);
    const busy = await segment(g, async () => {
      await assassinate();
      await mafiaBusy(mafias);
    });

    // 흔적 조각은 피해자를 고른 두 마피아 중 한 명의 의상 조각이다(D-06). 시작 때 겹친 옷을 풀면(18페이즈 D-01) 두 마피아의 옷이 서로 달라
    // 서버의 난수 한 번이 조각을 정하므로 구간마다 조각이 다를 수 있다 — 마피아의 행동과 무관한 값이라 비교에서는 조각 이름만 같은 자리표로 접는다.
    const foldTrace = (col: string): string => col.replace(/"trace":"[A-Za-z]+"/g, '"trace":"-"');
    for (const x of g.actors.filter((a) => a.role !== "mafia")) {
      const i = g.actors.indexOf(x);
      expect(`${x.role}:${foldTrace(busy[i]!)}`).toBe(`${x.role}:${foldTrace(quiet[i]!)}`);
      const col = quiet[i]!;
      // 피해자가 나온 아침에는 흔적 조각 id 하나가 함께 실린다(D-06).
      expect(new RegExp(`"morning":\\{"eliminated":${v.seat},"trace":"[A-Za-z]+"\\}`).test(col)).toBe(true);
      expect(col.includes('"k":"will"') && col.includes("VWILL") && col.includes('"k":"note"') && col.includes("조용히")).toBe(true);
      expect(col.includes('"chalk"')).toBe(true);
    }
    for (const x of mafias) expect(busy[g.actors.indexOf(x)]).not.toBe(quiet[g.actors.indexOf(x)]);
  }, 90_000);
});

describe("재접속 L9 — 밤 중간 hello 의 첫 프레임 열이 구간과 무관하다", () => {
  it("마피아가 움직이고 말한 밤과 가만히 있던 밤 모두 시민의 새 소켓이 받는 [state, world snap(본인 한 칸), chatLog] 가 같다", async () => {
    const g = await startedGame("night");
    const mafias = withRole(g, "mafia");
    const [c0, c1] = withRole(g, "citizen") as [Actor, Actor];
    const snap = await snapshotStorage(g.code);
    const home = await homeBySeat(g.code);

    const quiet = await helloFrames(g.code, c0.token);
    await restoreStorage(g.code, snap);
    pickAs(mafias[0]!, c0.seat);
    pickAs(mafias[1]!, c1.seat);
    await mafiaBusy(mafias);
    const busy = await helloFrames(g.code, c0.token);

    expect(kinds(quiet)).toBe("state,world,chatLog");
    expect(stable(busy)).toBe(stable(quiet));
    expect(snapSeatsOf(busy)).toBe(String(c0.seat));
    expect(snapPoints(busy)).toBe(homeRows(home, [c0.seat]));
  }, 90_000);
});

/** 값의 모든 키 경로(배열은 [] 로 합친다)를 정렬해 한 줄로. 값은 보지 않는다. */
function keyPaths(v: unknown, prefix = ""): string[] {
  if (Array.isArray(v)) return v.flatMap((x) => keyPaths(x, `${prefix}[]`));
  if (v !== null && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => [`${prefix}.${k}`, ...keyPaths(x, `${prefix}.${k}`)]);
  }
  return [];
}

describe("아침 길이·구출 개별 알림 없음 (L6, MORN-03·MORN-04)", () => {
  /** 구출 / 마피아 미선택 / 마피아 불일치 중 하나의 밤을 아침으로 넘기고 순수 시민 한 명의 아침 view 와 구출 대상·타 시민의 아침 진입 프레임 요약을 돌려준다. */
  async function morningOf(kind: "saved" | "none" | "split"): Promise<{ g: Game; view: ReturnType<typeof lastViewOf>; savedFrames: string; otherFrames: string }> {
    const g = await startedGame("night");
    const mafias = withRole(g, "mafia");
    const [v, other] = withRole(g, "citizen") as [Actor, Actor];
    const doctor = withRole(g, "doctor")[0]!;
    if (kind === "saved") {
      pickAs(mafias[0]!, v.seat);
      pickAs(mafias[1]!, v.seat);
      pickAs(doctor, v.seat);
    } else if (kind === "split") {
      pickAs(mafias[0]!, v.seat);
      pickAs(mafias[1]!, other.seat);
    }
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const marks = g.socks.map((s) => mark(s));
    await advanceTo(g.code, g.socks, "morning");
    const vi = g.actors.indexOf(v);
    const oi = g.actors.indexOf(other);
    const vf = await settle(v.sock, marks[vi]!);
    const of = await settle(other.sock, marks[oi]!);
    return { g, view: lastViewOf(other.sock), savedFrames: summary(vf), otherFrames: summary(of) };
  }

  it("의사 구출·마피아 미선택·마피아 불일치 세 밤 모두 아침 길이가 5000 이고 morning.saved 를 빼면 시민 소켓의 아침 state 모양이 같다", async () => {
    const runs = [await morningOf("saved"), await morningOf("none"), await morningOf("split")];

    expect(runs.map((r) => r.view.phaseDurationMs).join(",")).toBe("5000,5000,5000");
    expect(JSON.stringify(runs[0]!.view.day?.morning)).toBe(JSON.stringify({ saved: true }));
    const shapes = runs.map((r) => {
      const day = r.view.day === undefined ? undefined : { ...r.view.day, morning: Object.fromEntries(Object.entries(r.view.day.morning ?? {}).filter(([k]) => k !== "saved")) };
      return keyPaths({ ...r.view, day }).join("|");
    });
    expect(shapes[1]).toBe(shapes[0]);
    expect(shapes[2]).toBe(shapes[0]);
  }, 120_000);

  it("구출된 시민의 소켓이 받은 아침 진입 프레임의 수·종류가 다른 시민 소켓과 같다 (개별 알림 없음)", async () => {
    const r = await morningOf("saved");
    expect(r.otherFrames.includes("state:morning")).toBe(true);
    expect(r.savedFrames).toBe(r.otherFrames);
  }, 60_000);
});
