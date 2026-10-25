// 실제 소켓 프레임과 HTTP 응답 전수 누출 검사(ROLE-02): 6명 한 판(lobby → 두 밤·두 아침)을 실제 행동·마피아 채팅으로 workerd 에서 돌리며 받은 모든 것을 모아 본다.
import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoleId, RoomView, ServerMessage } from "../../shared/protocol";
import { advanceTo, backdateSends, collect, connect, forceDue, hello, nextFrame, send } from "./helpers";
import type { TestSocket } from "./helpers";

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
/** 서버 전용 주장 차례 키(결정 0027-3): 어떤 프레임의 어떤 경로에도 없어야 한다. */
const SERVER_ONLY_KEYS = ["claimPick", "claimOrder", "claimIdx", "claimStart"];
const ROLE_PATHS_DEAD = [...ROLE_PATHS_ALIVE, ".view.spectate.seats[].job"];

const phaseOf = (phase: string) => (m: ServerMessage) => m.t === "state" && m.view.phase === phase;

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

    /** claim 단계에서 지금 차례인 사람(view.day.turn.seat)이 role 을 주장한다 — 끝나지 않은 차례의 선택이 어디로도 새지 않는지 보려고 실제로 고른다. */
    const claimAsTurn = async (role: RoleId): Promise<void> => {
      await advanceTo(code, socks, "claim");
      const states = collect(players[0]!.sock)
        .map((raw) => JSON.parse(raw) as ServerMessage)
        .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state" && m.view.phase === "claim");
      const turnSeat = states[states.length - 1]!.view.day!.turn!.seat;
      await act(actors.find((a) => a.seat === turnSeat)!, { t: "claim", claim: role });
    };

    // 1일차: 직업 주장(방장 차례에 한 번, 나머지는 시간 초과) → 토론(살아 있는 시민 Y 가 한 줄, 낮 chat seq 기준점) → 밤
    await claimAsTurn("police");
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

    // 2일차: 직업 주장(시작 자리가 한 칸 옮겨진 첫 차례 사람이 한 번) → 토론(살아 있는 시민 Y 가 한 줄) → 밤(마피아 둘이 Y 를, 경찰이 마피아 B 를 지목, 마피아 B 가 채팅) → 아침
    await claimAsTurn("doctor");
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
        // day.turn 은 claim 단계 state 에만 있고, claimLog 줄의 키는 n, seat, claim 뿐이다.
        expect(`${msg.view.phase}:${msg.view.day?.turn !== undefined}`).toBe(`${msg.view.phase}:${msg.view.phase === "claim"}`);
        for (const line of msg.view.day?.claimLog ?? []) expect(Object.keys(line).sort()).toEqual(["claim", "n", "seat"]);
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
        if (paths.includes(".view.me.records")) {
          expect(a.role).toBe("police");
          saw.records.add(a.seat);
        }
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
    expect([...saw.records]).toEqual([police.seat]);
    expect([...saw.ally].sort()).toEqual([mafiaA.seat, mafiaB.seat].sort());
    expect([...saw.pick].sort()).toEqual([mafiaA.seat, mafiaB.seat, police.seat, doctor.seat].sort());

    // (5) 두 아침 각각 모든 소켓이 같은 day.morning 이고 첫 아침은 {eliminated: X, phrase: 1..8}.
    for (const day of [1, 2]) {
      expect(morningsByDay.get(day)!.size).toBe(1);
      expect(morningSeen.get(day)!.size).toBe(6);
    }
    const morning1 = JSON.parse([...morningsByDay.get(1)!][0]!) as { eliminated?: number; phrase?: number };
    const morning2 = JSON.parse([...morningsByDay.get(2)!][0]!) as { eliminated?: number; phrase?: number };
    expect(Object.keys(morning1).sort()).toEqual(["eliminated", "phrase"]);
    expect(morning1.eliminated).toBe(victimX.seat);
    expect(morning1.phrase! >= 1 && morning1.phrase! <= 8).toBe(true);
    expect(morning2.eliminated).toBe(victimY.seat);
    expect(morning2.phrase).not.toBe(morning1.phrase); // 문구 연속 반복 없음

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
