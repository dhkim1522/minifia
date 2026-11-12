// 19-01: 기본 마피아(basic) 판 한 판 전체를 방 DO 로 확인한다(결정 0081-6, D-06·D-08·D-10·D-11·D-12, T-19-03·T-19-04).
// 테스트 방(방장 + 연결 참가자 둘 + 봇 둘)에서 방장이 modePick basic → start → testSkip 으로 결과까지 걷고, 모든 소켓이 받은 프레임을 전수한다:
// 단계 열에 errand 가 없고, 심부름·기록·흔적 키가 어느 프레임에도 없으며(값이 빈 것이 아니라 키가 없다), 산 사람에게 남의 역할이 가지 않고, view.mode 는 모두에게 같다.
// 판의 진행은 손으로 고정한다(끝이 정해지게): 방장은 마피아(testRole), 봇 투표는 찬성·방장 아닌 사람(testBotVote), 사람도 지목·찬반·밤 고르기를 보낸다.
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { clearBotSteps, editRoom, framesOf, lastViewOf, mapPlayers, mark, nextFrame, readyUp, seat, send, settle, skipOnce, storedRoom } from "./helpers";
import type { Seated } from "./helpers";

type State = Extract<ServerMessage, { t: "state" }>;
type Sock = Seated["host"];
type GameMode = "basic" | "extended";

interface Table {
  s: Seated;
  socks: Sock[];
}

interface RawPlayer {
  seat: number;
  role?: string;
  alive?: boolean;
  isBot?: boolean;
}

const raw = async (code: string): Promise<{ phase: string; mode?: string; players: RawPlayer[]; verdict?: { candidate?: number } }> =>
  (await storedRoom(code)) as unknown as { phase: string; mode?: string; players: RawPlayer[]; verdict?: { candidate?: number } };

/**
 * 연결당 1초 20개 한도(RATE_LIMITED)의 창을 비운다. 이 시험은 한 판을 1초 안에 걷어 방장 소켓이 한도를 넘는다 —
 * 넘친 testSkip 은 처리되지 않고 버려져 단계가 실제 마감까지 머문다(한도는 reconnect.test.ts 가 따로 본다). DO 를 evict 하면 비워지는 값이라 판 상태와 무관하다.
 */
async function clearRates(code: string): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    (instance as unknown as { rates: WeakMap<object, unknown> }).rates = new WeakMap();
  });
}

/** JSON 을 걸어 내려가며 (경로, 키) 를 모두 모은다 — leak.test.ts 의 keyPaths 와 같은 모양이다(그 파일을 import 하면 describe 가 두 번 돈다). */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}

const statesOf = (sock: Sock): State[] => framesOf(sock).filter((m): m is State => m.t === "state");
/** 받은 state 프레임의 단계 열(이어진 같은 단계는 하나로). */
const phaseRun = (sock: Sock): string[] => statesOf(sock).map((m) => m.view.phase as string).filter((p, i, all) => i === 0 || all[i - 1] !== p);
/** 이 view 를 받은 사람이 살아 있는가(공개 생사 — 자기 좌석의 alive). */
const viewerAlive = (v: RoomView): boolean => v.players.find((p) => p.seat === v.me.seat)?.alive !== false;

/** 테스트 방: 방장(마피아로 지정) + 연결 참가자 둘 + 봇 둘, 봇 투표는 찬성·방장 아닌 사람. mode 를 주면 방장이 고른다. */
async function table(mode?: GameMode): Promise<Table> {
  const s = await seat(2, 0, { testMode: true });
  const socks = [s.host, ...s.guests.map((g) => g.sock)];
  send(s.host, { t: "testBots", count: 2 });
  for (const k of socks) await nextFrame(k, (m) => m.t === "state" && m.view.players.length === 5);
  const setup: unknown[] = [{ t: "testBotVote", exec: "yes", pick: "other" }, { t: "testRole", role: "mafia" }];
  if (mode !== undefined) setup.push({ t: "modePick", mode });
  for (const msg of setup) {
    send(s.host, msg);
    await settle(s.host, mark(s.host));
  }
  for (const k of socks) await settle(k, mark(k));
  await clearRates(s.code);
  return { s, socks };
}

async function start(t: Table, tutorial = false): Promise<void> {
  send(t.s.host, tutorial ? { t: "start", tutorial: true } : { t: "start" });
  for (const k of t.socks) await nextFrame(k, (m) => m.t === "state" && m.view.phase !== "lobby");
}

/**
 * 시작한 판을 testSkip 으로 결과까지 걷는다(상한 80번). 끝이 정해지게 사람 쪽 행동을 넣는다:
 * 투표 — 방장이 방장 아닌 가장 낮은 산 좌석을 지목(봇의 고정 pick 과 같은 사람), 찬반 — 후보가 아닌 산 사람 소켓이 모두 찬성,
 * 밤 — 방장(마피아)이 방장 아닌 가장 낮은 산 좌석을 고르고, 산 의사 봇이 있으면 그 봇의 고르기를 방장으로 고정해 구출이 나지 않게 한다.
 * 보낸 testSkip 수를 돌려준다.
 */
async function driveToEnded(t: Table): Promise<number> {
  const humans = [{ sock: t.s.host, seat: 0 }, ...t.s.guests.map((g) => ({ sock: g.sock, seat: g.seat }))];
  for (let skips = 0; skips < 80; skips += 1) {
    const room = await raw(t.s.code);
    if (room.phase === "ended") return skips;
    await clearRates(t.s.code);
    const living = room.players.filter((p) => p.alive !== false);
    const target = living.map((p) => p.seat).filter((n) => n !== 0).sort((a, b) => a - b)[0];
    if (room.phase === "nomination" && target !== undefined) {
      send(t.s.host, { t: "point", target });
      await settle(t.s.host, mark(t.s.host));
    } else if (room.phase === "verdict") {
      for (const h of humans) {
        if (h.seat === room.verdict?.candidate || !living.some((p) => p.seat === h.seat)) continue;
        send(h.sock, { t: "verdict", agree: true });
        await settle(h.sock, mark(h.sock));
      }
    } else if (room.phase === "night" && target !== undefined) {
      send(t.s.host, { t: "pick", target });
      await settle(t.s.host, mark(t.s.host));
      await editRoom(t.s.code, (stored) =>
        mapPlayers(clearBotSteps(stored), (p) => (p.isBot === true && p.role === "doctor" && p.alive !== false ? { ...p, nightPick: 0 } : p)),
      );
    }
    await skipOnce(t.s);
  }
  return 80;
}

/** basic 판 한 판 전체: 로비에서 basic 을 고르고 시작해 결과까지. */
async function playBasic(): Promise<Table & { skips: number }> {
  const t = await table("basic");
  await start(t);
  const skips = await driveToEnded(t);
  for (const k of t.socks) await settle(k, mark(k));
  return { ...t, skips };
}

/** basic 판의 어떤 프레임에도 있으면 안 되는 view 키 경로(D-08). */
const BASIC_OFF_PATHS = [".view.me.errand", ".view.me.record", ".view.day.evidence", ".view.day.morning.trace", ".view.day.morning.seen"];

describe("기본 마피아 판 한 판 전체 (D-08, D-11, D-12)", () => {
  it("방장이 basic 을 고르고 시작하면 testSkip 80번 안에 결과에 닿고, 모든 소켓의 단계 열에 errand 가 없으며 낮 시작 발표 다음은 토론(또는 결과)이다", { timeout: 90_000 }, async () => {
    const g = await playBasic();
    expect(`${(await raw(g.s.code)).phase}:${g.skips < 80}`).toBe("ended:true");
    for (const [i, k] of g.socks.entries()) {
      const run = phaseRun(k);
      expect(`${i}:${run.at(-1)}:${run.includes("errand")}`).toBe(`${i}:ended:false`);
      const afterAnnounce = run.flatMap((p, at) => (p === "dayAnnounce" ? [run[at + 1] ?? "(끝)"] : []));
      expect(afterAnnounce.length).toBeGreaterThan(0);
      expect(`${i}:${afterAnnounce.filter((p) => p !== "discussion" && p !== "ended").join(",")}`).toBe(`${i}:`);
      // 역할 → 낮 토론·투표·처형 → 밤 → 아침(결정 0081-6): 이 판은 밤과 아침을 실제로 지났다
      expect(`${i}:${["roleReveal", "discussion", "nomination", "execution", "night", "morning"].filter((p) => !run.includes(p)).join(",")}`).toBe(`${i}:`);
    }
  });

  it("그 판의 모든 state 프레임에 심부름·기록·흔적·마지막 목격 키가 하나도 없다 — 피해자가 나온 아침도 eliminated 뿐이다 (T-19-03)", { timeout: 90_000 }, async () => {
    const g = await playBasic();
    const found = new Set<string>();
    let killedMornings = 0;
    for (const k of g.socks) {
      for (const m of statesOf(k)) {
        const paths = keyPaths(m);
        for (const off of BASIC_OFF_PATHS) if (paths.includes(off)) found.add(`${m.view.phase}${off}`);
        // 접두로도 본다 — 하위 키만 실리는 경우까지
        for (const path of paths) if (BASIC_OFF_PATHS.some((off) => path.startsWith(`${off}.`) || path.startsWith(`${off}[]`))) found.add(`${m.view.phase}${path}`);
        if (m.view.phase === "morning" && m.view.day?.morning?.eliminated !== undefined) {
          killedMornings += 1;
          expect(Object.keys(m.view.day.morning).sort().join(",")).toBe("eliminated");
        }
      }
    }
    expect([...found].sort().join(" ")).toBe("");
    // 빈 검사가 아니다: 흔적이 생길 조건(피해자가 나온 아침)이 실제로 있었다
    expect(killedMornings).toBeGreaterThan(0);
    // 서버 상태에도 흔적·마지막 목격·심부름 배정이 만들어지지 않았다
    const stored = JSON.stringify(await raw(g.s.code));
    expect(["errandPlaces", "errandSeen", "errandLast", '"trace"', '"seen"'].filter((key) => stored.includes(key)).join(",")).toBe("");
  });

  it("그 판의 산 사람 프레임에는 관전 키·직업 키가 없고 role·allies 는 본인 칸에만 있으며, view.mode 는 모든 소켓에 basic 으로 같다 (D-12, T-19-04)", { timeout: 90_000 }, async () => {
    const g = await playBasic();
    const leaks = new Set<string>();
    const modes = new Set<string>();
    let aliveFrames = 0;
    for (const [i, k] of g.socks.entries()) {
      for (const m of framesOf(k)) {
        const paths = keyPaths(m);
        if (m.t !== "state") {
          // state 가 아닌 프레임(채팅·월드·동작)은 어떤 신분에게도 역할·관전 키를 싣지 않는다
          for (const path of paths) if (/\.(role|allies|job|spectate)$/.test(path)) leaks.add(`${i}:${m.t}${path}`);
          continue;
        }
        const v = m.view;
        if (v.phase !== "lobby") modes.add(String(v.mode));
        if (v.phase === "ended") continue;
        // 결과 전에는 생사와 무관하게: role·allies 는 본인 칸에만, 결과 키는 없다
        for (const path of paths) {
          const key = path.slice(path.lastIndexOf(".") + 1);
          if ((key === "role" || key === "allies") && path !== `.view.me.${key}`) leaks.add(`${i}:${v.phase}${path}`);
          if (path === ".view.result") leaks.add(`${i}:${v.phase}${path}`);
        }
        if (!viewerAlive(v)) continue;
        aliveFrames += 1;
        // 산 사람: 관전 키가 없고 `.job` 으로 끝나는 경로가 없으며 players[] 행에 role 키가 없다
        for (const path of paths) {
          if (path === ".view.spectate" || path.startsWith(".view.spectate.") || path.endsWith(".job") || path === ".view.players[].role") leaks.add(`${i}:${v.phase}${path}`);
        }
      }
    }
    expect([...leaks].sort().join(" ")).toBe("");
    expect(aliveFrames).toBeGreaterThan(20);
    expect([...modes].join(",")).toBe("basic");
    // 방장만 마피아다: 참가자 소켓이 결과 전에 받은 본인 역할은 마피아가 아니고, 마피아 동료 칸(allies)은 방장에게만 있다
    const guestRoles = g.socks.slice(1).flatMap((k) => statesOf(k).filter((m) => m.view.phase !== "ended").map((m) => m.view.me.role ?? "(없음)"));
    expect(guestRoles.includes("mafia")).toBe(false);
    expect(g.socks.map((k) => statesOf(k).some((m) => m.view.phase !== "ended" && m.view.me.allies !== undefined)).join(",")).toBe("true,false,false");
  });
});

describe("기본 마피아 판의 시작·유지 (D-06, D-10)", () => {
  it("basic 방은 tutorial: true 로 시작해도 모든 소켓의 첫 단계 프레임이 assigning 이고 tutorial 단계 프레임이 없다 (D-10)", async () => {
    const t = await table("basic");
    await start(t, true);
    for (const k of t.socks) await settle(k, mark(k));
    expect(t.socks.map((k) => phaseRun(k).filter((p) => p !== "lobby")[0]).join(",")).toBe("assigning,assigning,assigning");
    expect(t.socks.some((k) => phaseRun(k).includes("tutorial"))).toBe(false);
    expect(`${(await raw(t.s.code)).phase}:${String((await raw(t.s.code)).mode)}`).toBe("assigning:basic");
  });

  it("테스트 대기실 복귀(testReset) 뒤에도 view.mode 와 저장된 mode 가 basic 이다 (D-06)", async () => {
    const t = await table("basic");
    await start(t);
    send(t.s.host, { t: "testReset" });
    for (const k of t.socks) await nextFrame(k, (m) => m.t === "state" && m.view.phase === "lobby");
    expect(t.socks.map((k) => String(lastViewOf(k).mode)).join(",")).toBe("basic,basic,basic");
    expect(String((await raw(t.s.code)).mode)).toBe("basic");
  });

  it("결과에서 다시 하기를 시작하면 새 판(round 2)의 view.mode 가 여전히 basic 이고 그 판도 낮 시작 발표 다음이 토론이다 (D-06)", { timeout: 90_000 }, async () => {
    const g = await playBasic();
    await readyUp(g.s.guests.map((x) => x.sock), g.socks, 5);
    send(g.s.host, { t: "rematch", round: 1 });
    const firsts: string[] = [];
    for (const k of g.socks) {
      const frame = (await nextFrame(k, (m) => m.t === "state" && m.view.phase === "assigning")) as State;
      firsts.push(`${frame.view.round}:${String(frame.view.mode)}`);
    }
    expect(firsts.join(",")).toBe("2:basic,2:basic,2:basic");
    expect(String((await raw(g.s.code)).mode)).toBe("basic");
    const walked: string[] = ["assigning"];
    await clearRates(g.s.code);
    for (let i = 0; i < 4 && walked.at(-1) !== "discussion" && walked.at(-1) !== "errand"; i += 1) {
      await skipOnce(g.s);
      walked.push((await raw(g.s.code)).phase);
    }
    expect(walked.join(">")).toBe("assigning>roleReveal>dayAnnounce>discussion");
  });
});

describe("대조 — 판 종류를 고르지 않은 같은 구성의 판 (D-04, 성공 기준 4)", () => {
  it("mode 를 고르지 않으면 view.mode 는 extended 이고 낮 시작 발표 다음이 심부름이며, 산 사람은 심부름 단계에서 me.errand 를 받는다", { timeout: 60_000 }, async () => {
    const t = await table();
    await start(t);
    const walked: string[] = ["assigning"];
    for (let i = 0; i < 4 && walked.at(-1) !== "discussion" && walked.at(-1) !== "errand"; i += 1) {
      await skipOnce(t.s);
      walked.push((await raw(t.s.code)).phase);
    }
    for (const k of t.socks) await settle(k, mark(k));
    expect(walked.join(">")).toBe("assigning>roleReveal>dayAnnounce>errand");
    expect(t.socks.map((k) => String(lastViewOf(k).mode)).join(",")).toBe("extended,extended,extended");
    // 같은 전수 방식이 확장판의 키는 본다 — basic 판의 "키 없음" 검사가 빈 검사가 아니다
    expect(t.socks.map((k) => statesOf(k).some((m) => keyPaths(m).includes(".view.me.errand"))).join(",")).toBe("true,true,true");
  });
});
