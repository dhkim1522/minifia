// 실제 소켓 프레임과 HTTP 응답 전수 누출 검사(ROLE-02): 6명 한 판(lobby → 두 밤·두 아침)을 실제 행동·마피아 채팅으로 workerd 에서 돌리며 받은 모든 것을 모아 본다.
import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { CANDIDATE_VOTE_MS, candidateRevealMs } from "../../shared/game/phases";
import { MORNING_PHRASE_COUNT } from "../../shared/protocol";
import type { RoleId, RoomView, ServerMessage } from "../../shared/protocol";
import {
  actorsOf,
  advanceTo,
  backdateSends,
  closePhase,
  collect,
  connect,
  forceDue,
  hello,
  lastViewOf,
  mark,
  nextFrame,
  seat,
  send,
  settle,
  summary,
} from "./helpers";
import type { Actor as SeatedActor, TestSocket } from "./helpers";

interface Player {
  nickname: string;
  token: string;
  sock: TestSocket;
}

/** 역할 공개 뒤 마지막 view 에서 읽은 seat·역할을 붙인 사람(스크립트는 전지적이다). */
interface Actor extends Player {
  seat: number;
  role: RoleId;
}

interface Recorded {
  /** 이 응답을 받을 권리가 있는 사람의 토큰(없으면 비인증 응답이라 토큰이 하나도 있으면 안 된다). */
  owner: string | null;
  body: string;
}

const FORBIDDEN_KEYS = ["token", "id", "playerId", "connId", "nicknameKey", "joinSeq", "hostId"];

/** JSON 을 걸어 내려가며 (경로, 키) 를 모두 모은다. */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [
      `${path}.${k}`,
      ...keyPaths(v, `${path}.${k}`),
    ]);
  }
  return [];
}

let pingCounter = 0;
/** 그 소켓에 ping 을 보내 pong 이 올 때까지 기다린다 — 소켓마다 보낸 순서대로 전달되므로 앞서 보낸 행동이 처리·전송된 뒤다. */
async function flush(sock: TestSocket): Promise<void> {
  pingCounter += 1;
  const c = pingCounter;
  send(sock, { t: "ping", c });
  await nextFrame(sock, (m) => m.t === "pong" && m.c === c);
}

/** JSON 을 걸어 내려가며 (경로, 문자열 값) 을 모은다. 배열 칸은 [] 로 접는다. */
function stringPaths(value: unknown, path = ""): Array<[string, string]> {
  if (Array.isArray(value)) return value.flatMap((v) => stringPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => stringPaths(v, `${path}.${k}`));
  }
  return typeof value === "string" ? [[path, value]] : [];
}

const ROLE_WORDS = new Set(["mafia", "police", "doctor", "citizen", "none"]);
/** 살아 있는 소켓이 역할·주장 값 문자열을 받아도 되는 경로. 탈락 뒤에는 여기에 관전 직업 경로가 더해진다(결정 0021). */
const ROLE_PATHS_ALIVE = [".view.me.role", ".view.day.roles[]", ".view.day.claimLog[].claim"];
/**
 * 서버 전용 키: 어떤 프레임의 어떤 경로에도 없어야 한다. 주장 차례(결정 0027-3)와 4페이즈 투표·종료(결정 0036-12)의 서버 상태.
 * winner·execution 은 같은 이름의 view 키(result.winner·day.execution)가 있어 넣지 않고, 경로·단계로 검사한다.
 */
const SERVER_ONLY_KEYS = ["claimPick", "claimOrder", "claimIdx", "claimStart", "execVote", "candidateVote", "verdict", "nightLog", "lastExecPhrase"];
const ROLE_PATHS_DEAD = [...ROLE_PATHS_ALIVE, ".view.spectate.seats[].job"];
/** ended 단계 프레임에서만 더해지는 허용 경로(D-17, Pitfall 10): 결과 화면의 모든 직업. ended 이전 프레임에서는 누출이다. */
const ROLE_PATH_ENDED = ".view.result.seats[].job";

const phaseOf = (phase: string) => (m: ServerMessage) => m.t === "state" && m.view.phase === phase;

// ---- world 프레임(06-08, T-06-16): 로비에서만 나가고, 키·문자열 값은 허용 목록뿐이다 ----
const WORLD_KEY_PATHS = new Set([".t", ".k", ".s", ".p", ".t0", ".v", ".at", ".ents", ".ents[].s", ".ents[].p", ".ents[].t0", ".ents[].v"]);
const WORLD_STRING_VALUES: Record<string, ReadonlySet<string>> = { ".t": new Set(["world"]), ".k": new Set(["move", "snap"]) };

/**
 * 각 소켓의 프레임 목록에서 world 프레임을 본다: 첫 "로비가 아닌 단계" state 이후에는 하나도 없고(start 이전에만 있다),
 * 모든 키 경로와 문자열 값이 허용 목록 안이며(토큰·id·역할 없음), 각 소켓이 로비에서 적어도 하나(hello 뒤 snap)는 받았다.
 */
function assertWorldFrames(socks: TestSocket[]): void {
  for (const sock of socks) {
    let started = false;
    let worlds = 0;
    for (const raw of collect(sock)) {
      const msg = JSON.parse(raw) as ServerMessage;
      if (msg.t === "state" && msg.view.phase !== "lobby") started = true;
      if (msg.t !== "world") continue;
      worlds += 1;
      expect(started).toBe(false);
      for (const path of keyPaths(msg)) expect(WORLD_KEY_PATHS.has(path)).toBe(true);
      for (const [path, value] of stringPaths(msg)) expect(WORLD_STRING_VALUES[path]?.has(value) === true).toBe(true);
    }
    expect(worlds).toBeGreaterThan(0);
  }
}

describe("6명 한 판(두 밤·두 아침, 행동·마피아 채팅·탈락·관전 포함) 전수 누출 검사", () => {
  it("모든 프레임·HTTP 응답에 남의 토큰·역할·동료가 없고 역할 수는 구성표와 같다", { timeout: 60_000 }, async () => {
    const http: Recorded[] = [];
    const record = async (res: Response, owner: string | null): Promise<string> => {
      const text = await res.text();
      http.push({ owner, body: text });
      return text;
    };

    // 방 만들기와 5명 참가 — 응답은 본인 토큰만 담는다.
    const created = await exports.default.fetch("http://x/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: "방장" }),
    });
    const createdBody = (await created.json()) as { code: string; token: string };
    http.push({ owner: createdBody.token, body: JSON.stringify(createdBody) });
    const code = createdBody.code;

    const players: Player[] = [{ nickname: "방장", token: createdBody.token, sock: await connect(code) }];
    await hello(players[0]!.sock, createdBody.token);
    for (let i = 1; i < 6; i += 1) {
      const res = await exports.default.fetch(`http://x/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: `손님${i}` }),
      });
      const joined = (await res.json()) as { token: string };
      http.push({ owner: joined.token, body: JSON.stringify(joined) });
      const sock = await connect(code);
      await hello(sock, joined.token);
      players.push({ nickname: `손님${i}`, token: joined.token, sock });
    }

    // 비인증 미리보기와 오류 응답을 단계마다 모은다.
    const probe = async (withJoin: boolean): Promise<void> => {
      await record(await exports.default.fetch(`http://x/api/rooms/${code}`), null);
      // 대기실에서는 참가가 성공해 자리가 늘어나므로, 시작 뒤(409 GAME_STARTED)에만 참가 응답을 모은다.
      if (!withJoin) return;
      await record(
        await exports.default.fetch(`http://x/api/rooms/${code}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nickname: "늦은손님" }),
        }),
        null,
      );
    };
    await probe(false); // lobby

    const waitAll = async (phase: string): Promise<void> => {
      for (const p of players) await nextFrame(p.sock, phaseOf(phase));
    };
    send(players[0]!.sock, { t: "start" });
    await waitAll("assigning");
    await probe(true);

    const stub = env.ROOM.getByName(code);
    await forceDue(code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await waitAll("roleReveal");
    await probe(true);

    await forceDue(code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await waitAll("dayAnnounce");
    await probe(true);

    // ---- 두 밤·두 아침을 실제 행동과 마피아 채팅으로 돌린다 ----
    for (const p of players) await flush(p.sock);
    const socks = players.map((p) => p.sock);
    const actors: Actor[] = players.map((p) => {
      const states = collect(p.sock)
        .map((raw) => JSON.parse(raw) as ServerMessage)
        .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");
      const me = states[states.length - 1]!.view.me;
      return { ...p, seat: me.seat, role: me.role! };
    });
    const withRole = (role: RoleId): Actor[] => actors.filter((a) => a.role === role).sort((a, b) => a.seat - b.seat);
    const [mafiaA, mafiaB] = withRole("mafia") as [Actor, Actor];
    const police = withRole("police")[0]!;
    const doctor = withRole("doctor")[0]!;
    const [victimX, victimY] = withRole("citizen") as [Actor, Actor]; // X 는 1일차 밤, Y 는 2일차 밤에 탈락한다
    /** 행동을 보내고, 서버가 처리·전송을 마칠 때까지(pong) 기다린다 — 곧바로 마감을 당겨도 행동이 뒤늦게 도착하지 않는다. */
    const act = async (who: Actor, msg: unknown): Promise<void> => {
      send(who.sock, msg);
      await flush(who.sock);
    };

    // 1일차: 토론(살아 있는 시민 Y 가 한 줄, 낮 chat seq 기준점) → 밤 (07-08: 순차 주장 단계 없음)
    await advanceTo(code, socks, "discussion");
    await probe(true);
    await backdateSends(code);
    await act(victimY, { t: "say", template: "innocent" });
    await advanceTo(code, socks, "night");
    await probe(true);

    // 1일차 밤: 마피아 둘이 X 를, 경찰이 마피아 A 를, 의사가 자신을 지목하고, 마피아 A 가 밤 채팅과 이모티콘을 보낸다.
    await act(mafiaA, { t: "pick", target: victimX.seat });
    await act(mafiaB, { t: "pick", target: victimX.seat });
    await act(police, { t: "pick", target: mafiaA.seat });
    await act(doctor, { t: "pick", target: doctor.seat });
    await backdateSends(code);
    await act(mafiaA, { t: "say", template: "nightTarget", target: victimX.seat });
    await backdateSends(code);
    await act(mafiaA, { t: "emoji", icon: "smile" });
    await advanceTo(code, socks, "morning"); // X 탈락
    await probe(true);

    // 2일차: 토론(살아 있는 시민 Y 가 한 줄) → 밤(마피아 둘이 Y 를, 경찰이 마피아 B 를 지목, 마피아 B 가 채팅) → 아침
    await advanceTo(code, socks, "discussion");
    await probe(true);
    await backdateSends(code);
    await act(victimY, { t: "say", template: "innocent" });
    await advanceTo(code, socks, "night");
    await probe(true);
    await act(mafiaA, { t: "pick", target: victimY.seat });
    await act(mafiaB, { t: "pick", target: victimY.seat });
    await act(police, { t: "pick", target: mafiaB.seat });
    await backdateSends(code);
    await act(mafiaB, { t: "say", template: "nightAgree" });
    await advanceTo(code, socks, "morning"); // Y 탈락
    await probe(true);
    for (const p of players) await flush(p.sock);

    // ---- 검사 ----
    const allTokens = players.map((p) => p.token);

    // world 프레임은 첫 start 이전 로비에서만 나왔고 키·문자열이 허용 목록 안이다(06-08).
    assertWorldFrames(players.map((p) => p.sock));

    // HTTP 응답: 비인증 응답에는 토큰이 하나도 없고, 본인 응답에는 남의 토큰이 없다.
    for (const r of http) {
      for (const t of allTokens) {
        if (t !== r.owner) expect(r.body.includes(t)).toBe(false);
      }
    }
    // 비인증 응답: lobby 1 + assigning·roleReveal·dayAnnounce 각 2 + (1일차 토론·밤·아침, 2일차 토론·밤·아침) 각 2.
    expect(http.filter((r) => r.owner === null).length).toBe(19);

    const finalViews: RoomView[] = [];
    for (const p of players) {
      const raws = collect(p.sock);
      expect(raws.length).toBeGreaterThan(0);
      const roles = new Set<string>();
      for (const raw of raws) {
        // 남의 토큰은 어떤 프레임에도 없다(본인 토큰도 서버는 보내지 않는다).
        for (const t of allTokens) expect(raw.includes(t)).toBe(false);
        const msg = JSON.parse(raw) as ServerMessage;
        const paths = keyPaths(msg);
        for (const path of paths) {
          const key = path.slice(path.lastIndexOf(".") + 1);
          expect(FORBIDDEN_KEYS.includes(key)).toBe(false);
          // role·allies 는 오직 view.me 안에만 있다.
          if (key === "role" || key === "allies") expect(path).toBe(`.view.me.${key}`);
        }
        // 서버 전용 차례 키는 어떤 프레임의 어떤 경로에도 없다(T-03.1-06).
        for (const path of paths) expect(SERVER_ONLY_KEYS.includes(path.slice(path.lastIndexOf(".") + 1))).toBe(false);
        if (msg.t !== "state") continue;
        // day.turn 은 어느 단계에도 없고, claimLog 는 언제나 빈 배열이다(07-08: 순차 주장 제거, 키는 07-09 가 지운다).
        expect(`${msg.view.phase}:${Object.hasOwn(msg.view.day ?? {}, "turn")}`).toBe(`${msg.view.phase}:false`);
        expect(msg.view.day?.claimLog ?? []).toEqual([]);
        for (const pl of msg.view.players) {
          expect(Object.keys(pl).sort()).toEqual(["alive", "connected", "isHost", "nickname", "seat"]);
        }
        if (msg.view.phase === "lobby" || msg.view.phase === "assigning") {
          expect(msg.view.me.role).toBeUndefined();
          expect(msg.view.me.allies).toBeUndefined();
        }
        if (msg.view.me.role !== undefined) roles.add(msg.view.me.role);
        if (msg.view.phase === "morning") finalViews.push(msg.view);
      }
      expect(roles.size).toBeLessThanOrEqual(1);
    }

    // 구성표(6명: 마피아 2·경찰 1·의사 1·시민 2)와 동료 정보의 교차 일치.
    const lastViews = players.map((p) => {
      const states = collect(p.sock)
        .map((raw) => JSON.parse(raw) as ServerMessage)
        .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");
      return states[states.length - 1]!.view;
    });
    const counts: Record<string, number> = {};
    for (const v of lastViews) counts[v.me.role!] = (counts[v.me.role!] ?? 0) + 1;
    expect(counts).toEqual({ mafia: 2, police: 1, doctor: 1, citizen: 2 });
    const mafiaSeats = lastViews.filter((v) => v.me.role === "mafia").map((v) => v.me.seat);
    for (const v of lastViews) {
      if (v.me.role === "mafia") {
        expect(v.me.allies).toEqual(mafiaSeats.filter((s) => s !== v.me.seat));
      } else {
        expect(v.me.allies).toBeUndefined();
      }
    }
    expect(finalViews.length).toBeGreaterThan(0);

    // ---- 밤·관전 불변식 (결정 0021, D-07, D-17, NIGHT-02, COMM-04) ----
    // 이 시나리오에서 누가 어느 밤에 무엇을 골랐는지(일차 → seat → 대상).
    const pickedIn: Record<number, Map<number, number>> = {
      1: new Map([
        [mafiaA.seat, victimX.seat],
        [mafiaB.seat, victimX.seat],
        [police.seat, mafiaA.seat],
        [doctor.seat, doctor.seat],
      ]),
      2: new Map([
        [mafiaA.seat, victimY.seat],
        [mafiaB.seat, victimY.seat],
        [police.seat, mafiaB.seat],
      ]),
    };
    const allSeats = [...actors].sort((x, y) => x.seat - y.seat).map((x) => ({ seat: x.seat, job: x.role }));
    const diedAt = new Map<number, string>(); // seat → 탈락 state 의 "단계 일차"
    const dayLines = new Map<number, number[]>(); // seat → 살아 있는 동안 받은 낮 chat seq
    const nightLines = new Map<number, string>(); // seat → "일차:seq,…" 밤 chat
    const nightEmojis = new Map<number, number>(); // seat → 밤 emoji 프레임 수
    const morningsByDay = new Map<number, Set<string>>(); // 일차 → day.morning JSON 모음
    const morningSeen = new Map<number, Set<number>>(); // 일차 → 아침 state 를 받은 seat
    const saw = { ally: new Set<number>(), records: new Set<number>(), pick: new Set<number>(), spectatePicksX: false };

    for (const a of actors) {
      let dead = false;
      let phase = "";
      let day = 0;
      const lines: number[] = [];
      const nights: string[] = [];
      let emojis = 0;
      for (const raw of collect(a.sock)) {
        const msg = JSON.parse(raw) as ServerMessage;
        // 서버가 거부한 행동이 없다 — 시나리오의 모든 행동은 받아들여졌다.
        expect(msg.t === "error").toBe(false);
        const paths = keyPaths(msg);
        if (msg.t === "state") {
          const v = msg.view;
          phase = v.phase;
          if (v.day) day = v.day.n;
          if (v.players.find((pl) => pl.seat === a.seat)?.alive === false && !dead) {
            dead = true;
            diedAt.set(a.seat, `${phase} ${day}`);
          }
        }
        // (1)(2) spectate: 살아 있는 동안은 경로 어디에도 없고, 탈락한 뒤에는 모든 state 에 있다.
        const hasSpectate = paths.some((pth) => pth === ".view.spectate" || pth.startsWith(".view.spectate."));
        expect(hasSpectate).toBe(dead && msg.t === "state");
        if (msg.t === "state" && dead) {
          const spectate = msg.view.spectate!;
          expect(JSON.stringify(spectate.seats)).toBe(JSON.stringify(allSeats));
          // 지난 밤 정보 없음: picks 는 밤 state 에만 있다.
          expect(spectate.picks !== undefined).toBe(phase === "night");
          if (phase === "night" && a.seat === victimX.seat && day === 2 && spectate.picks!.mafia.includes(victimY.seat)) {
            saw.spectatePicksX = true;
          }
        }
        // (3) 비공개 키는 받을 사람에게만.
        // 일지(D-10): 경찰·마피아·의사 본인만, 역할마다 줄 키가 다르다. 시민(탈락한 시민 관전 소켓 포함)에게는 어떤 프레임에도 없다.
        if (paths.includes(".view.me.records")) {
          expect(["police", "mafia", "doctor"].includes(a.role)).toBe(true);
          saw.records.add(a.seat);
        }
        const lineKeys = paths.filter((pth) => pth.startsWith(".view.me.records[].")).map((pth) => pth.slice(".view.me.records[].".length));
        for (const key of lineKeys) {
          expect(["n", "target", "isMafia", "died"].includes(key)).toBe(true);
          if (key === "isMafia") expect(a.role).toBe("police"); // 수사일지의 키는 경찰 프레임에만
          if (key === "died") expect(a.role).toBe("mafia"); // 암살일지의 키는 마피아 프레임에만
        }
        if (a.role === "doctor") expect(lineKeys.every((key) => key === "n" || key === "target")).toBe(true); // 치료일지에는 n,target 뿐
        if (a.role === "citizen") expect(paths.some((pth) => pth.startsWith(".view.me.records"))).toBe(false);
        // 일지 줄 안에는 문자열이 없다 — 숫자·불리언뿐이다.
        if (msg.t === "state") for (const r of msg.view.me.records ?? []) for (const v of Object.values(r)) expect(typeof v === "string").toBe(false);
        if (paths.includes(".view.me.allyPicks")) {
          expect(a.role).toBe("mafia");
          expect(dead).toBe(false);
          saw.ally.add(a.seat);
        }
        if (msg.t === "state" && msg.view.me.pick !== undefined) {
          expect(phase).toBe("night");
          expect(String(msg.view.me.pick)).toBe(String(pickedIn[day]?.get(a.seat)));
          saw.pick.add(a.seat);
        }
        // (4) 역할·주장 값 문자열은 허용 경로에만.
        const allowed = dead ? ROLE_PATHS_DEAD : ROLE_PATHS_ALIVE;
        for (const [pth, value] of stringPaths(msg)) {
          if (ROLE_WORDS.has(value)) expect(allowed.includes(pth)).toBe(true);
        }
        // (1)(6) 밤 chat·emoji 는 살아 있는 마피아와 탈락자에게만. 낮 chat 은 살아 있는 동안 받은 번호를 센다.
        if (msg.t === "chat" || msg.t === "emoji") {
          if (phase === "night") {
            if (!dead) expect(a.role).toBe("mafia");
            if (msg.t === "chat") nights.push(`${day}:${msg.seq}`);
            else emojis += 1;
          } else if (msg.t === "chat" && !dead) {
            lines.push(msg.seq);
          }
        }
        // (5) 아침 결과.
        if (msg.t === "state" && msg.view.phase === "morning") {
          const set = morningsByDay.get(day) ?? new Set<string>();
          set.add(JSON.stringify(msg.view.day?.morning));
          morningsByDay.set(day, set);
          const seen = morningSeen.get(day) ?? new Set<number>();
          seen.add(a.seat);
          morningSeen.set(day, seen);
        }
      }
      dayLines.set(a.seat, lines);
      nightLines.set(a.seat, nights.join(","));
      nightEmojis.set(a.seat, emojis);
    }

    // 누가 어느 아침에 탈락했는가: X 는 1일차 아침, Y 는 2일차 아침에 처음 탈락 state 를 받는다. 나머지는 끝까지 살아 있다.
    expect([...diedAt.entries()].sort((x, y) => x[0] - y[0])).toEqual(
      [[victimX.seat, "morning 1"], [victimY.seat, "morning 2"]].sort((x, y) => (x[0] as number) - (y[0] as number)),
    );
    // (2) 관전자 X 는 2일차 밤에 마피아 선택(spectate.picks.mafia ∋ Y)을 봤다.
    expect(saw.spectatePicksX).toBe(true);
    // (3) 받을 사람은 실제로 받았다 — 아무도 못 받는 검사가 되지 않게.
    expect([...saw.records].sort()).toEqual([police.seat, mafiaA.seat, mafiaB.seat, doctor.seat].sort());
    expect([...saw.ally].sort()).toEqual([mafiaA.seat, mafiaB.seat].sort());
    expect([...saw.pick].sort()).toEqual([mafiaA.seat, mafiaB.seat, police.seat, doctor.seat].sort());

    // (5) 두 아침 각각 모든 소켓이 같은 day.morning 이고 첫 아침은 {eliminated: X, phrase: 1..MORNING_PHRASE_COUNT}.
    for (const day of [1, 2]) {
      expect(morningsByDay.get(day)!.size).toBe(1);
      expect(morningSeen.get(day)!.size).toBe(6);
    }
    const morning1 = JSON.parse([...morningsByDay.get(1)!][0]!) as { eliminated?: number; phrase?: number };
    const morning2 = JSON.parse([...morningsByDay.get(2)!][0]!) as { eliminated?: number; phrase?: number };
    expect(Object.keys(morning1).sort()).toEqual(["eliminated", "phrase"]);
    expect(morning1.eliminated).toBe(victimX.seat);
    expect(morning1.phrase! >= 1 && morning1.phrase! <= MORNING_PHRASE_COUNT).toBe(true);
    expect(morning2.eliminated).toBe(victimY.seat);
    expect(morning2.phrase).not.toBe(morning1.phrase); // 문구 연속 반복 없음

    // 일지는 본인 역할의 것만: 마피아 둘은 같은 암살일지(두 밤 모두 died true), 의사는 자기 치료일지, 시민은 키 없음.
    const lastOf = (a: Actor) => lastViews[actors.findIndex((x) => x === a)]!;
    const assassination = JSON.stringify([
      { n: 1, target: victimX.seat, died: true },
      { n: 2, target: victimY.seat, died: true },
    ]);
    expect(JSON.stringify(lastOf(mafiaA).me.records)).toBe(assassination);
    expect(JSON.stringify(lastOf(mafiaB).me.records)).toBe(assassination);
    expect(JSON.stringify(lastOf(doctor).me.records)).toBe(JSON.stringify([{ n: 1, target: doctor.seat }]));
    // 탈락한 시민 X·Y 는 관전자가 되어도 일지가 없다(spectate 는 직업·지목만, 일지는 역할의 몫).
    for (const a of [victimX, victimY]) expect("records" in lastOf(a).me).toBe(false);

    // 경찰만 수사 기록을 받는다: 두 밤의 기록이 쌓여 있다.
    const policeLast = lastViews[actors.findIndex((x) => x === police)]!;
    expect(JSON.stringify(policeLast.me.records)).toBe(
      JSON.stringify([
        { n: 1, target: mafiaA.seat, isMafia: true },
        { n: 2, target: mafiaB.seat, isMafia: true },
      ]),
    );

    // (6) 낮 chat 번호는 밤 마피아 채팅 수와 무관하게 이어진다(PLAN-CHECK W3, 결정 0020).
    const day1Seq = dayLines.get(police.seat)![0]!;
    expect(dayLines.get(police.seat)).toEqual([day1Seq, day1Seq + 1]); // 1일차 밤 마피아 채팅이 끼어도 +1
    for (const a of actors) {
      if (a === victimX) expect(dayLines.get(a.seat)).toEqual([day1Seq]); // 1일차 아침에 탈락 — 2일차 줄은 관전자로 받는다
      else expect(dayLines.get(a.seat)).toEqual([day1Seq, day1Seq + 1]);
    }
    // 밤 chat 번호는 밤마다 1부터다: 마피아 둘은 두 밤 모두, 관전자 X 는 자기가 탈락한 뒤의 2일차 밤만, 나머지는 0줄.
    for (const a of actors) {
      const expected = a.role === "mafia" ? "1:1,2:1" : a === victimX ? "2:1" : "";
      expect(nightLines.get(a.seat)).toBe(expected);
      // 밤 emoji 는 1일차 밤 마피아 A 의 한 번: 살아 있던 마피아 둘만 받는다.
      expect(nightEmojis.get(a.seat)).toBe(a.role === "mafia" ? 1 : 0);
    }
  });
});

// ---- 처형·처형 무효·종료를 지나는 6명 한 판(04-09): 모든 실제 프레임의 받는 사람 규칙 (결정 0036-12) ----

describe("6명 한 판: 처형·처형 무효·종료 전수 프레임 누출 검사 (VOTE-01, VOTE-02, VOTE-04, END-02, D-02, D-09, D-17, D-34)", () => {
  it(
    "1일차 여부 통과 → 후보 → 공개 → 변론 → 처형(마피아 A) → 의사가 지킨 밤 → 2일차 처형 무효 밤 → 3일차 마지막 마피아 처형 → 종료: 모든 프레임이 받는 사람 규칙을 지킨다",
    { timeout: 60_000 },
    async () => {
      const room = await seat(5, 0);
      const code = room.code;
      const socks = [room.host, ...room.guests.map((g) => g.sock)];
      const allTokens = [room.hostToken, ...room.guests.map((g) => g.token)];

      send(room.host, { t: "start" });
      for (const sock of socks) await nextFrame(sock, phaseOf("assigning"));
      await advanceTo(code, socks, "dayAnnounce");
      for (const sock of socks) await settle(sock, mark(sock));
      const actors: SeatedActor[] = actorsOf(room);
      const withRole = (role: RoleId): SeatedActor[] => actors.filter((a) => a.role === role).sort((a, b) => a.seat - b.seat);
      const [mafiaA, mafiaB] = withRole("mafia") as [SeatedActor, SeatedActor];
      const police = withRole("police")[0]!;
      const doctor = withRole("doctor")[0]!;
      const victimX = withRole("citizen")[0]!;

      /** 서버가 이 행동을 처리·전송할 때까지(pong) 기다린다 — 곧바로 마감을 당겨도 행동이 뒤늦게 도착하지 않는다. */
      const act = async (who: SeatedActor, msg: unknown): Promise<ServerMessage[]> => {
        const from = mark(who.sock);
        send(who.sock, msg);
        return settle(who.sock, from);
      };
      const dayNow = (): number => lastViewOf(actors[0]!.sock).day?.n ?? 0;
      const waitAll = async (phase: string): Promise<void> => {
        for (const sock of socks) await nextFrame(sock, phaseOf(phase));
      };
      /** 다음 마감을 닫고 모든 소켓이 그 단계 state 를 받을 때까지. */
      const closeInto = async (phase: string): Promise<void> => {
        await closePhase(code);
        await waitAll(phase);
      };
      const alive = (dead: ReadonlySet<number>): SeatedActor[] => actors.filter((a) => !dead.has(a.seat));

      // 누가 어느 날 무엇을 던졌는지(프레임 검사의 기대값). 일차 → seat → 값.
      const execVotes = new Map<number, Map<number, boolean>>();
      const candidateVotes = new Map<number, Map<number, number>>();
      // 그날 그 투표자가 (취소 전후 포함) 실제로 고른 값들. 프레임 검사의 voteTarget 기대는 이 집합이다(결정 0040).
      const candidateEver = new Map<number, Map<number, Set<number>>>();
      const everPicked = (day: number, seatNo: number): Set<number> => {
        const byDay = candidateEver.get(day) ?? new Map<number, Set<number>>();
        candidateEver.set(day, byDay);
        const set = byDay.get(seatNo) ?? new Set<number>();
        byDay.set(seatNo, set);
        return set;
      };
      const dead = new Set<number>();

      /** 여부 표를 던진다. 던진 직후 모든 소켓의 집계가 같은 값이고, 아직 안 던진 소켓의 me 에는 voteAgree 가 없다. */
      const castExec = async (who: SeatedActor[], agreeOf: (a: SeatedActor) => boolean, waiting: SeatedActor[]): Promise<void> => {
        const day = dayNow();
        const mine = execVotes.get(day) ?? new Map<number, boolean>();
        execVotes.set(day, mine);
        for (const a of who) {
          mine.set(a.seat, agreeOf(a));
          await act(a, { t: "execVote", agree: agreeOf(a) });
        }
        for (const sock of socks) await settle(sock, mark(sock));
        const want = { yes: [...mine.values()].filter((v) => v).length, no: [...mine.values()].filter((v) => !v).length };
        // (2) 같은 순간 모든 소켓(생존자·탈락 관전자)의 집계가 같다
        for (const a of actors) expect(JSON.stringify(lastViewOf(a.sock).day?.execTally)).toBe(JSON.stringify(want));
        // (1) 아직 안 던진 소켓에는 voteAgree 가 없다
        for (const a of waiting) expect("voteAgree" in lastViewOf(a.sock).me).toBe(false);
      };

      /** 후보 선택을 던진다. 첫 투표 직후 투표자가 아닌 소켓(탈락 관전자 포함)은 어떤 프레임도 받지 않는다. */
      const castCandidates = async (targetOf: (a: SeatedActor) => number, voters: SeatedActor[]): Promise<void> => {
        const day = dayNow();
        const mine = candidateVotes.get(day) ?? new Map<number, number>();
        candidateVotes.set(day, mine);
        const [first, ...rest] = voters as [SeatedActor, ...SeatedActor[]];
        mine.set(first.seat, targetOf(first));
        everPicked(day, first.seat).add(targetOf(first));
        const others = actors.filter((a) => a !== first);
        const marks = others.map((a) => mark(a.sock));
        const own = await act(first, { t: "candidateVote", target: targetOf(first) });
        expect(summary(own)).toBe("[state:candidateVote]"); // 본인에게만 state(me.voteTarget)
        for (let i = 0; i < others.length; i += 1) expect(summary(await settle(others[i]!.sock, marks[i]!))).toBe("[]"); // (3)
        // (3b) 결정 0040: 첫 투표자가 취소하면 그 소켓만 voteTarget 키 없는 state 를 받고, 다른 모든 소켓(탈락 관전자 포함)은 아무것도 받지 않는다. 다시 고르기도 같다.
        const cancelMarks = others.map((a) => mark(a.sock));
        const cancelOwn = await act(first, { t: "candidateVote", target: null });
        expect(summary(cancelOwn)).toBe("[state:candidateVote]");
        const cancelView = (cancelOwn[0] as Extract<ServerMessage, { t: "state" }>).view;
        expect(Object.hasOwn(cancelView.me, "voteTarget")).toBe(false);
        for (let i = 0; i < others.length; i += 1) expect(summary(await settle(others[i]!.sock, cancelMarks[i]!))).toBe("[]");
        const repickMarks = others.map((a) => mark(a.sock));
        expect(summary(await act(first, { t: "candidateVote", target: targetOf(first) }))).toBe("[state:candidateVote]");
        for (let i = 0; i < others.length; i += 1) expect(summary(await settle(others[i]!.sock, repickMarks[i]!))).toBe("[]");
        for (const a of rest) {
          mine.set(a.seat, targetOf(a));
          everPicked(day, a.seat).add(targetOf(a));
          expect(summary(await act(a, { t: "candidateVote", target: targetOf(a) }))).toBe("[state:candidateVote]");
        }
      };

      // 인원 순서(seat 오름차순)로 읽는다.
      const bySeat = [...actors].sort((a, b) => a.seat - b.seat);

      // ---------- 1일차: 낮 → 여부 통과 → 후보 A → 공개 → 변론 → 처형 ----------
      await advanceTo(code, socks, "execVote");
      await castExec(bySeat.slice(0, 4), (a) => a.seat % 3 !== 0, bySeat.slice(4)); // 찬성 다수가 되는 섞인 표
      await castExec(bySeat.slice(4), (a) => a.seat % 3 !== 0, []);
      await closeInto("candidateVote");
      await castCandidates((a) => (a === mafiaA ? police.seat : mafiaA.seat), alive(dead));
      await closeInto("candidateVoteReveal");
      {
        const reveals = actors.map((a) => lastViewOf(a.sock).day?.voteLog?.at(-1)?.cand);
        // (4) 공개 구간부터 모든 소켓의 votes 가 같다(서버가 정한 한 순서)
        expect(new Set(reveals.map((c) => JSON.stringify(c))).size).toBe(1);
        expect(reveals[0]?.candidate).toBe(mafiaA.seat);
        expect(reveals[0]?.votes.length).toBe(6);
      }
      await advanceTo(code, socks, "defense");
      await act(mafiaA, { t: "say", template: "defNotMe" });
      await advanceTo(code, socks, "execution");
      dead.add(mafiaA.seat);
      for (const a of actors) {
        const view = lastViewOf(a.sock);
        expect(`${view.day?.execution?.seat} ${Object.keys(view.day?.execution ?? {}).sort().join(",")}`).toBe(`${mafiaA.seat} phrase,seat`);
        expect(view.players.find((p) => p.seat === mafiaA.seat)?.alive).toBe(false);
      }

      // 1일차 밤: 마피아 B 가 X 를, 의사가 같은 X 를 지켜 아무도 죽지 않는다(마피아 1 vs 4 라 판은 이어진다)
      await advanceTo(code, socks, "night");
      await act(mafiaB, { t: "pick", target: victimX.seat });
      await act(doctor, { t: "pick", target: victimX.seat });
      await act(police, { t: "pick", target: mafiaB.seat });
      await advanceTo(code, socks, "morning");
      for (const a of actors) expect(JSON.stringify(lastViewOf(a.sock).day?.morning)).toBe("{}");

      // ---------- 2일차: 여부 미통과(처형 무효 밤) ----------
      await advanceTo(code, socks, "execVote");
      expect(dayNow()).toBe(2);
      await castExec(
        alive(dead),
        (a) => a === mafiaB || a === victimX, // 찬성 2 · 반대 3 → 불통과
        [],
      );
      await closeInto("night");
      for (const a of actors) {
        const view = lastViewOf(a.sock);
        expect(JSON.stringify(view.day?.noExecution)).toBe(JSON.stringify({ reason: "notMajority" }));
      }
      await act(police, { t: "pick", target: mafiaB.seat }); // 마피아 B 는 고르지 않는다
      await advanceTo(code, socks, "morning");

      // ---------- 3일차: 여부 통과 → 후보 B(마지막 마피아) → 처형 → 종료 ----------
      await advanceTo(code, socks, "execVote");
      expect(dayNow()).toBe(3);
      await castExec(alive(dead), () => true, []);
      await closeInto("candidateVote");
      await castCandidates((a) => (a === mafiaB ? police.seat : mafiaB.seat), alive(dead));
      await closeInto("candidateVoteReveal");
      await advanceTo(code, socks, "defense");
      await backdateSends(code);
      await act(mafiaB, { t: "say", template: "defPlead" });
      await advanceTo(code, socks, "execution");
      dead.add(mafiaB.seat);
      await advanceTo(code, socks, "ended");
      for (const sock of socks) await settle(sock, mark(sock));

      // ---------- 검사 ----------
      // 처형·종료까지 간 한 판에서도 world 프레임은 start 이전 로비에서만 나왔다(06-08).
      assertWorldFrames(socks);
      const preview = await exports.default.fetch(`http://x/api/rooms/${code}`);
      const previewText = await preview.text();
      for (const t of allTokens) expect(previewText.includes(t)).toBe(false);
      expect(previewText.includes("result")).toBe(false);

      const seen = { agree: new Set<number>(), target: new Set<number>(), noExec: new Set<number>(), result: new Set<number>(), execution: new Set<number>() };
      let cancelFrames = 0; // 취소 프레임: 그날 candidateVote 에서 voteTarget 이 있던 투표자의 voteTarget 없는 state (결정 0040)
      const hadTarget = new Set<string>();
      for (const a of actors) {
        let isDead = false;
        for (const raw of collect(a.sock)) {
          // (9) 남의 토큰은 어떤 프레임에도 없다
          for (const t of allTokens) expect(raw.includes(t)).toBe(false);
          const msg = JSON.parse(raw) as ServerMessage;
          expect(msg.t === "error").toBe(false); // 시나리오의 모든 행동은 받아들여졌다
          const paths = keyPaths(msg);
          for (const path of paths) {
            const key = path.slice(path.lastIndexOf(".") + 1);
            expect(FORBIDDEN_KEYS.includes(key)).toBe(false);
            if (key === "role" || key === "allies") expect(path).toBe(`.view.me.${key}`);
            // (7) 서버 전용 키는 어디에도 없다
            expect(SERVER_ONLY_KEYS.includes(key)).toBe(false);
            // (1) 투표 개인 정보는 본인 경로 밖에 없다
            if (key === "voteAgree") expect(path).toBe(".view.me.voteAgree");
            if (key === "voteTarget") expect(path).toBe(".view.me.voteTarget");
          }
          if (msg.t !== "state") continue;
          const v = msg.view;
          const day = v.day?.n ?? 0;
          if (v.players.find((pl) => pl.seat === a.seat)?.alive === false) isDead = true;
          for (const pl of v.players) expect(Object.keys(pl).sort()).toEqual(["alive", "connected", "isHost", "nickname", "seat"]); // (9)
          const has = (prefix: string): boolean => paths.some((pth) => pth === prefix || pth.startsWith(`${prefix}.`) || pth.startsWith(`${prefix}[]`));

          // (4)(5) 역할·주장 값 문자열은 허용 경로에만 — 처형자 X 의 직업도 ended 전에는 살아 있는 소켓에 오지 않는다. ended 에서만 결과 경로가 더해진다.
          const allowed = [...(isDead ? ROLE_PATHS_DEAD : ROLE_PATHS_ALIVE), ...(v.phase === "ended" ? [ROLE_PATH_ENDED] : [])];
          for (const [pth, value] of stringPaths(msg)) if (ROLE_WORDS.has(value)) expect(`${v.phase} ${pth} ${allowed.includes(pth)}`).toBe(`${v.phase} ${pth} true`);
          // 관전은 탈락한 뒤에만(결정 0021)
          expect(has(".view.spectate")).toBe(isDead);

          // (6) result 는 ended 프레임에만
          expect(has(".view.result")).toBe(v.phase === "ended");
          if (v.phase === "ended") seen.result.add(a.seat);
          // 집계·후보·처형 발표는 그 단계에만
          expect(has(".view.day.execTally")).toBe(v.phase === "execVote");
          expect(has(".view.day.candidate")).toBe(["candidateVoteReveal", "defense", "execution"].includes(v.phase));
          expect(has(".view.day.execution")).toBe(v.phase === "execution");
          if (v.phase === "execution") seen.execution.add(a.seat);
          // 단계 길이는 공개 정보에서만 파생된다: 공개 단계는 그날 공개된 표 수, 진행 중 후보 선택은 표 수와 무관한 고정 길이(결정 0039, T-t40-01)
          if (v.phase === "candidateVote") expect(v.phaseDurationMs).toBe(CANDIDATE_VOTE_MS);
          if (v.phase === "candidateVoteReveal") {
            const todays = v.day?.voteLog?.filter((line) => line.n === day).at(-1);
            expect(v.phaseDurationMs).toBe(candidateRevealMs(todays?.cand?.votes.length ?? 0));
          }
          // (8) 처형 무효 이유는 처형 무효로 온 밤(2일차)에만, 키는 reason 하나
          const wantNoExecution = v.phase === "night" && day === 2;
          expect(has(".view.day.noExecution")).toBe(wantNoExecution);
          if (wantNoExecution) {
            expect(Object.keys(v.day!.noExecution!)).toEqual(["reason"]);
            seen.noExec.add(a.seat);
          }
          // 여부 줄은 no·passed·yes 세 키뿐이고, 그날 후보 선택은 공개 구간 전에 voteLog 에 없다
          for (const line of v.day?.voteLog ?? []) {
            expect(Object.keys(line.exec).sort()).toEqual(["no", "passed", "yes"]);
            if (line.cand !== undefined) {
              expect(Object.keys(line.cand).sort()).toEqual(line.cand.candidate === undefined ? ["votes"] : ["candidate", "votes"]);
              expect(line.n === day && (v.phase === "execVote" || v.phase === "candidateVote")).toBe(false);
              for (const vote of line.cand.votes) expect(Object.keys(vote).sort()).toEqual(["seat", "target"]);
            }
          }
          // (1) 본인 표: 본인이 던진 값만, 그 단계에서만, 생존 중에만
          if (v.me.voteAgree !== undefined) {
            expect(v.phase).toBe("execVote");
            expect(isDead).toBe(false);
            expect(v.me.voteAgree).toBe(execVotes.get(day)?.get(a.seat));
            seen.agree.add(a.seat);
          }
          if (v.me.voteTarget !== undefined) {
            expect(v.phase).toBe("candidateVote");
            expect(isDead).toBe(false);
            expect(everPicked(day, a.seat).has(v.me.voteTarget)).toBe(true);
            expect(v.me.voteTarget).toBe(candidateVotes.get(day)?.get(a.seat)); // 이 시나리오의 취소는 같은 값으로 다시 고르므로 프레임 값은 최종 값과 같다
            seen.target.add(a.seat);
            hadTarget.add(`${day}:${a.seat}`);
          } else if (v.phase === "candidateVote" && hadTarget.has(`${day}:${a.seat}`)) {
            cancelFrames += 1;
          }
        }
      }

      // 받을 사람은 실제로 받았다 — 아무도 못 받는 검사가 되지 않게.
      const everyone = bySeat.map((a) => a.seat);
      expect([...seen.agree].sort()).toEqual(everyone);
      expect([...seen.target].sort()).toEqual(everyone);
      expect([...seen.noExec].sort()).toEqual(everyone);
      expect([...seen.result].sort()).toEqual(everyone);
      expect([...seen.execution].sort()).toEqual(everyone);
      expect(cancelFrames).toBeGreaterThanOrEqual(1); // 취소 프레임을 실제로 하나 이상 봤다(결정 0040)

      // (10) 종료: 모든 소켓의 result 가 같고, 요약에 1일차 의사가 지킨 밤과 2일차 불통과가 있다.
      const results = actors.map((a) => lastViewOf(a.sock).result);
      expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
      const result = results[0]!;
      expect(result.winner).toBe("citizenWin");
      expect(result.seats).toEqual(bySeat.map((a) => ({ seat: a.seat, job: a.role })));
      const row = (n: number) => result.summary.find((r) => r.n === n);
      expect(row(1)?.exec).toEqual({ yes: 4, no: 2, passed: true, candidate: mafiaA.seat });
      expect(row(1)?.night).toEqual({ target: victimX.seat, died: false });
      expect(row(2)?.exec).toEqual({ yes: 2, no: 3, passed: false });
      expect(row(3)?.exec).toEqual({ yes: 5, no: 0, passed: true, candidate: mafiaB.seat });
    },
  );
});

describe("테스트 방 봇 투표 설정은 손님·게임 중 프레임에 새지 않는다 (P-13, T-04-45)", () => {
  it("방장이 설정을 바꾸고 판을 시작해 투표 단계까지 가는 동안 손님이 받은 모든 프레임에 testBotVote 키가 없다", { timeout: 30_000 }, async () => {
    const r = await seat(1, 0, { testMode: true });
    const guest = r.guests[0]!.sock;
    // 시작 최소 인원(4명)을 봇 둘로 채운다.
    send(r.host, { t: "testBots", count: 2 });
    for (const sock of [r.host, guest]) await nextFrame(sock, (m) => m.t === "state" && m.view.players.length === 4);
    for (const sock of [r.host, guest]) await flush(sock);
    const guestFrom = mark(guest);
    send(r.host, { t: "testBotVote", exec: "no", pick: "host" });
    const own = await nextFrame(r.host, (m) => m.t === "state");
    // 방장은 대기실 view 에서만 받는다
    expect(own.t === "state" && JSON.stringify(own.view.me.testBotVote)).toBe('{"exec":"no","pick":"host"}');
    expect(summary(await settle(guest, guestFrom))).toBe("[]");
    send(r.host, { t: "start" });
    for (const sock of [r.host, guest]) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(r.code, [r.host, guest], "execVote");
    for (const sock of [r.host, guest]) await flush(sock);
    // 손님이 받은 모든 프레임의 모든 경로 키 이름에 testBotVote 가 없다(허용 경로 목록은 넓히지 않는다)
    for (const raw of collect(guest)) {
      expect(keyPaths(JSON.parse(raw)).some((path) => path.endsWith(".testBotVote"))).toBe(false);
    }
    // 방장도 게임 중 프레임에는 키가 없다(대기실 view 에서만)
    const hostViews = collect(r.host).map((raw) => JSON.parse(raw) as ServerMessage);
    for (const m of hostViews) {
      if (m.t === "state" && m.view.phase !== "lobby") expect(Object.hasOwn(m.view.me, "testBotVote")).toBe(false);
    }
  });
});
