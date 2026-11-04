// 실제 소켓 프레임과 HTTP 응답 전수 누출 검사(ROLE-02): 6명 한 판(lobby → 두 밤·두 아침)을 실제 행동·자유 채팅(all·mafia·ghost)·입력 중으로 workerd 에서 돌리며 받은 모든 것을 모아 본다.
import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoleId, RoomView, ServerMessage } from "../../shared/protocol";
import {
  actorsOf,
  advanceTo,
  advanceToKeep,
  chatMsg,
  closePhase,
  collect,
  connect,
  forceDue,
  editRoom,
  framesOf,
  ghostsOf,
  hello,
  lastViewOf,
  mapPlayers,
  mark,
  nextFrame,
  phaseKeyOf,
  pause,
  pickAs,
  pointAll,
  resetChatRates,
  runoffAll,
  seat,
  send,
  settle,
  startedGame,
  storedRoom,
  summary,
  verdictAll,
  withRole,
} from "./helpers";
import type { Actor as SeatedActor, Game, TestSocket } from "./helpers";

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
/** 살아 있는 소켓이 역할 값 문자열을 받아도 되는 경로. 탈락 뒤에는 여기에 관전 직업 경로가 더해진다(결정 0021). */
const ROLE_PATHS_ALIVE = [
  ".view.me.role",
  ".view.day.roles[]",
  ".view.me.chat",
  // 결정 0066-1, 공개 주장 값 — 증명은 badge.test.ts L18(실제 역할만 다른 두 판의 열이 같다). 허용 경로는 이 하나뿐이고,
  // 6명 한 판 전수 검사는 이 경로의 값이 항상 방금 보낸 주장 대본의 값(실제 역할이 아니다)임을 단언한다.
  ".view.players[].badge",
];
/**
 * 서버 전용 키: 어떤 프레임의 어떤 경로에도 없어야 한다. 주장 차례(결정 0027-3)와 4페이즈 투표·종료(결정 0036-12)·순차 지목 차례(pickTurn, 결정 0063-1)의 서버 상태.
 * winner·execution 은 같은 이름의 view 키(result.winner·day.execution)가 있어 넣지 않고, 경로·단계로 검사한다.
 */
const SERVER_ONLY_KEYS = ["claimPick", "claimOrder", "claimIdx", "claimStart", "execVote", "candidateVote", "verdict", "nightLog", "lastExecPhrase", "nominate", "verdictVote", "endVote", "nightNote", "pickTurn", "runoffVote"];
/**
 * 서버 전용 이름과 같은 공개 와이어 필드의 경로(08-11, 결정 0060-3·4) — 이 두 경로만 SERVER_ONLY_KEYS 검사에서 빼고 이유를 단다. 목록은 줄이지 않고, 새 경로는 받을 권리 조건이 있을 때만 더한다.
 *  - .view.day.verdict: 처형 단계에서 모두에게 같은 {yes,no,passed} 집계(서버 전용 RoomState.verdict 와 이름만 같다).
 *  - .view.me.verdictVote: 그 소켓 본인이 던진 찬반 값(변론자·유령·던지지 않은 사람에게는 키 자체가 없다). 남의 값은 어떤 경로로도 가지 않는다.
 */
const ALLOWED_WIRE_PATHS: ReadonlySet<string> = new Set([".view.day.verdict", ".view.me.verdictVote"]);
/**
 * 동점 결선(결정 0066-4)의 공개 경로 — SERVER_ONLY_KEYS 의 runoffVote 와 이름이 겹치지 않아 위 허용 목록은 넓히지 않았다. 새로 생기는 경로는 이 둘뿐이고 받을 권리가 단계별로 갈린다:
 *  - .view.day.runoff(.cand/.step/.voted/.tally): runoff 단계에서 모든 소켓에 같다. 마감 전(step 0·1)에는 cand·step·voted(던진 좌석)뿐, 마감 뒤(step 2)에는 cand·step·tally(득표 수)뿐이다.
 *  - .view.me.ballot: 그 소켓 본인이 던진 후보 좌석(runoff step 1·2, 산 유권자 본인만). 남의 선택은 어떤 경로로도 가지 않는다.
 */
const RUNOFF_WIRE_PATHS: ReadonlySet<string> = new Set([".view.day.runoff", ".view.day.runoff.cand", ".view.day.runoff.step", ".view.day.runoff.voted", ".view.day.runoff.tally", ".view.me.ballot"]);
const ROLE_PATHS_DEAD = [...ROLE_PATHS_ALIVE, ".view.spectate.seats[].job"];
/** ended 단계 프레임에서만 더해지는 허용 경로(D-17, Pitfall 10): 결과 화면의 모든 직업. ended 이전 프레임에서는 누출이다. */
const ROLE_PATH_ENDED = ".view.result.seats[].job";

const phaseOf = (phase: string) => (m: ServerMessage) => m.t === "state" && m.view.phase === phase;

// ---- world 프레임(06-08, T-06-16 → 08-09 결정 0060-8): 키·문자열 값은 허용 목록뿐이고, 게임 중 산 사람 소켓에는 산 좌석만 간다 ----
const WORLD_KEY_PATHS = new Set([".t", ".k", ".s", ".p", ".t0", ".v", ".at", ".ents", ".ents[].s", ".ents[].p", ".ents[].t0", ".ents[].v"]);
const WORLD_STRING_VALUES: Record<string, ReadonlySet<string>> = { ".t": new Set(["world"]), ".k": new Set(["move", "snap"]) };

// ---- typing 프레임(07-10, T-07-18): 키는 t·seat·on 뿐, 문자열 값은 .t "typing" 뿐이다 ----
const TYPING_KEY_PATHS = new Set([".t", ".seat", ".on"]);
// ---- chat 프레임(07-11, 누설 검사 (a)(b)(c)): 키는 t·ch·seat·seq·text·at 뿐, .t 는 "chat", .ch 는 all|mafia|ghost 이고 mafia·ghost 는 받을 권리 있는 소켓에서만 나온다 ----
// 결정 0061-11: ".k" 는 서버가 사망 전환에서 만든 카드 표시(will|note)이고 공개 정보다. 사람이 보낸 줄에는 없다. 다른 경로는 넓히지 않는다.
// 결정 0066-2: ".to" 는 귓속말 줄(k whisper·whispered)의 상대 좌석이다 — 누가 누구에게 귓속말을 보냈는지는 공개 사실이고(본문만 비공개) 줄 종류 값은 아래 CHAT_KIND_VALUES 뿐이다.
const CHAT_KEY_PATHS = new Set([".t", ".ch", ".seat", ".seq", ".text", ".at", ".k", ".to"]);
/** chat 줄 종류(.k)의 허용 값 집합: 카드(결정 0061-11)와 귓속말(결정 0066-2). 새 종류는 이 집합에 근거와 함께 더한다. */
const CHAT_KIND_VALUES: ReadonlySet<string> = new Set(["will", "note", "whisper", "whispered", "ballots"]);
// ---- chatLog 프레임(07-14, 누설 검사 (d)): hello 직후 한 번. 키는 t·lines[]·ch·seat·seq·text·at 뿐이고 수신자 마스크(r)·쓰기 순번(g)·일차(n)는 없다 ----
// 결정 0061-11: ".lines[].k" 는 서버가 사망 전환에서 만든 카드 표시, 공개 정보. 다른 경로는 넓히지 않는다.
const CHATLOG_KEY_PATHS = new Set([".t", ".lines", ".lines[].ch", ".lines[].seat", ".lines[].seq", ".lines[].text", ".lines[].at", ".lines[].k", ".lines[].to"]); // ".lines[].to": 귓속말 상대 좌석(결정 0066-2, 공개 사실)
// ---- chatReject 프레임(07-11): 키는 t·why 뿐, 문자열 값은 .t "chatReject" 와 .why(거절 이유 코드)뿐이다. 보낸 사람 소켓에만 간다 ----
const CHAT_REJECT_KEY_PATHS = new Set([".t", ".why"]);

/**
 * 각 소켓의 프레임 목록에서 world 프레임을 본다(08-09, 결정 0060-8). 게임 중에도 지도 단계에서 world 프레임이 나갈 수 있으나
 * 산 사람 소켓이 받은 world 프레임의 좌석은 그 시점(마지막으로 받은 state)의 산 좌석뿐이다 — 유령의 위치가 산 사람 폰에 가지 않는다(GHOST-01).
 * 유령 소켓은 자기가 탈락했다는 state 를 받은 뒤 전원 좌석을 받을 수 있다(새 유령 snap). 허용 목록(키·문자열 값)은 그대로다(토큰·id·역할 없음).
 * 각 소켓이 로비에서 적어도 하나(hello 뒤 snap)는 받았다.
 */
function assertWorldFrames(socks: TestSocket[]): void {
  for (const sock of socks) {
    let started = false;
    let worlds = 0;
    let mySeat = -1;
    let meAlive = true;
    let aliveSeats = new Set<number>();
    for (const raw of collect(sock)) {
      const msg = JSON.parse(raw) as ServerMessage;
      if (msg.t === "state") {
        if (msg.view.phase !== "lobby") started = true;
        mySeat = msg.view.me.seat;
        aliveSeats = new Set(msg.view.players.filter((p) => p.alive !== false).map((p) => p.seat));
        meAlive = aliveSeats.has(mySeat);
      }
      if (msg.t !== "world") continue;
      worlds += 1;
      for (const path of keyPaths(msg)) expect(WORLD_KEY_PATHS.has(path)).toBe(true);
      for (const [path, value] of stringPaths(msg)) expect(WORLD_STRING_VALUES[path]?.has(value) === true).toBe(true);
      if (!started || !meAlive) continue;
      // 게임 중 산 사람 소켓: 프레임의 좌석은 모두 그 시점 산 좌석이다.
      const seats = msg.k === "snap" ? msg.ents.map((e) => e.s) : [msg.s];
      expect(seats.filter((s) => !aliveSeats.has(s)).join(",")).toBe("");
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

    // 채팅 줄 번호는 채널별로 DO 가 센다(저장·복원은 07-14) — 단계를 넘길 때 DO 를 evict 하지 않는 advanceToKeep 으로 넘겨 라이브 번호가 이어지는지 본다. 복원은 아래 끝에서 따로 본다.
    // 같은 사람의 연속 전송은 600ms 간격·같은 문장 3초 제한(D5)에 걸리므로 줄마다 보낸 사람을 달리한다.

    // 1일차: 토론(살아 있는 시민 Y 가 공개 한 줄 — all 줄 1번) → 밤 (07-08: 순차 주장 단계 없음)
    await advanceToKeep(code, socks, "discussion");
    await probe(true);
    await act(victimY, chatMsg(victimY.sock, "저 아니에요"));
    await advanceToKeep(code, socks, "night");
    await probe(true);

    // 1일차 밤: 마피아 둘이 X 를, 경찰이 마피아 A 를, 의사가 자신을 지목하고, 마피아 A 가 밤 채팅(mafia 줄 1번)을 보낸다.
    await act(mafiaA, { t: "pick", target: victimX.seat });
    await act(mafiaB, { t: "pick", target: victimX.seat });
    await act(police, { t: "pick", target: mafiaA.seat });
    await act(doctor, { t: "pick", target: doctor.seat });
    // 입력 중(07-10): 산 마피아 A 의 켜짐·꺼짐은 산 마피아 B 에게만 간다. 산 시민 Y 의 신호는 아무에게도 가지 않는다(채널이 없다).
    await act(mafiaA, { t: "typing", on: true, pk: phaseKeyOf(mafiaA.sock) });
    await act(mafiaA, { t: "typing", on: false, pk: phaseKeyOf(mafiaA.sock) });
    await act(victimY, { t: "typing", on: true, pk: phaseKeyOf(victimY.sock) });
    // 산 시민 Y 의 밤 전송은 채널이 없어 폐기된다 — Y 소켓에만 chatReject{phase} 가 가고 아무에게도 줄이 가지 않는다(T-07-26).
    await act(victimY, chatMsg(victimY.sock, "저 시민이에요"));
    await act(mafiaA, chatMsg(mafiaA.sock, "그 사람으로 가요"));
    await advanceToKeep(code, socks, "morning"); // X 탈락
    await probe(true);

    // 2일차: 토론(경찰이 공개 한 줄 — all 줄 2번, 탈락자 X 가 탈락자 줄 — ghost 줄 1번) → 밤(마피아 둘이 Y 를, 경찰이 마피아 B 를 지목, 마피아 B 가 채팅 — mafia 줄 2번) → 아침
    await advanceToKeep(code, socks, "discussion");
    await probe(true);
    await act(police, chatMsg(police.sock, "누가 수상해요?"));
    await act(victimX, chatMsg(victimX.sock, "구경 중이에요"));
    await advanceToKeep(code, socks, "night");
    await probe(true);
    await act(mafiaA, { t: "pick", target: victimY.seat });
    await act(mafiaB, { t: "pick", target: victimY.seat });
    await act(police, { t: "pick", target: mafiaB.seat });
    await act(mafiaB, chatMsg(mafiaB.sock, "동의해요"));
    await advanceToKeep(code, socks, "morning"); // Y 탈락
    await probe(true);
    // 아침: 방금 탈락한 Y 가 탈락자 줄(ghost 줄 2번)을 보낸다 — 탈락자 X·Y 만 받는다. 시험이 빨라 Y 의 600ms 간격이 안 지났으므로 전송 기록만 비운다.
    await resetChatRates(code);
    await act(victimY, chatMsg(victimY.sock, "아쉽네요"));
    for (const p of players) await flush(p.sock);

    // ---- 검사 ----
    const allTokens = players.map((p) => p.token);

    // world 프레임은 키·문자열이 허용 목록 안이고 게임 중 산 사람 소켓에는 그 시점 산 좌석만 갔다(06-08, 08-09).
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
        // 8페이즈(08-07): 처형 단계의 .view.day.verdict({yes,no,passed})는 공개 와이어 필드다(서버 전용 verdict 와 이름만 같다). 전체 누설 스캔 개편은 08-09.
        for (const path of paths) expect(path !== ".view.day.verdict" && SERVER_ONLY_KEYS.includes(path.slice(path.lastIndexOf(".") + 1))).toBe(false);
        if (msg.t !== "state") continue;
        // day.turn 은 지목 단계에만 있다(07-08: 순차 주장 제거, 09.1: 순차 지목의 공개 차례 정보 — 결정 0063-1).
        expect(`${msg.view.phase}:${Object.hasOwn(msg.view.day ?? {}, "turn")}`).toBe(`${msg.view.phase}:${msg.view.phase === "nomination"}`);
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
    const allLines = new Map<number, number[]>(); // seat → 받은 ch all 줄 번호(받은 순서)
    const mafiaLines = new Map<number, number[]>(); // seat → 받은 ch mafia 줄 번호
    const ghostLines = new Map<number, number[]>(); // seat → 받은 ch ghost 줄 번호
    const rejects = new Map<number, string[]>(); // seat → 받은 chatReject 의 why
    const liveChats = new Map<number, string[]>(); // seat → 라이브로 받은 chat 줄 'ch/seat/seq/text'(받은 순서) — 복원 chatLog 와 견준다
    const typingCounts = new Map<number, number>(); // seat → 받은 typing 프레임 수
    const sawChatMafia = new Set<number>(); // me.chat 이 "mafia" 인 view 를 받은 seat
    const morningsByDay = new Map<number, Set<string>>(); // 일차 → day.morning JSON 모음
    const morningSeen = new Map<number, Set<number>>(); // 일차 → 아침 state 를 받은 seat
    const saw = { ally: new Set<number>(), records: new Set<number>(), pick: new Set<number>(), tally: new Set<number>(), sure: new Set<number>(), spectatePicksX: false };

    for (const a of actors) {
      let dead = false;
      let phase = "";
      let day = 0;
      const alls: number[] = [];
      const mafias: number[] = [];
      const ghosts: number[] = [];
      const rejected: string[] = [];
      const lived: string[] = [];
      let typings = 0;
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
        // 마피아 집계(결정 0061-7): 밤에 산 마피아 본인 소켓에서만 나온다. 마피아가 아닌 소켓·탈락자·낮·아침에서 이 경로가 나오면 실패한다.
        if (paths.some((pth) => pth.startsWith(".view.me.nightTally") || pth === ".view.me.nightSure")) {
          expect(`${a.role}/${dead}/${phase}`).toBe("mafia/false/night");
          if (paths.includes(".view.me.nightTally")) saw.tally.add(a.seat);
          if (paths.includes(".view.me.nightSure")) saw.sure.add(a.seat);
        }
        if (msg.t === "state" && msg.view.me.pick !== undefined) {
          expect(phase).toBe("night");
          expect(String(msg.view.me.pick)).toBe(String(pickedIn[day]?.get(a.seat)));
          saw.pick.add(a.seat);
        }
        // (4) 역할·주장 값 문자열은 허용 경로에만. chat 의 .ch 값 mafia 는 그 밤의 산 마피아·탈락자 소켓에서만 허용한다(누설 검사 (c)).
        const allowed = dead ? ROLE_PATHS_DEAD : ROLE_PATHS_ALIVE;
        for (const [pth, value] of stringPaths(msg)) {
          if (!ROLE_WORDS.has(value)) continue;
          const chOk = msg.t === "chat" && pth === ".ch" && value === "mafia" && phase === "night" && (dead || a.role === "mafia");
          expect(`${pth}=${value}:${allowed.includes(pth) || chOk}`).toBe(`${pth}=${value}:true`);
        }
        // (7) typing 프레임(07-10): 키·문자열 값은 허용 목록뿐이고, 밤에는 살아 있는 마피아와 탈락자 소켓만 받는다 — 시민 편 소켓은 0건.
        if (msg.t === "typing") {
          for (const pth of paths) expect(TYPING_KEY_PATHS.has(pth)).toBe(true);
          for (const [pth, value] of stringPaths(msg)) expect(`${pth}=${value}`).toBe(".t=typing");
          expect(phase).toBe("night");
          if (!dead) expect(a.role).toBe("mafia");
          typings += 1;
        }
        // (8) me.chat 의 값 mafia 는 그 밤의 산 마피아 소켓에서만 나온다(받을 권리가 있는 소켓 조건으로만 허용).
        if (msg.t === "state" && msg.view.me.chat === "mafia") {
          expect(`${a.role}/${dead}/${msg.view.phase}`).toBe("mafia/false/night");
          sawChatMafia.add(a.seat);
        }
        // (a)(b)(c) chat 프레임: 키·문자열 값은 허용 목록뿐이고, 채널마다 받을 권리가 있는 소켓에만 온다 — 시민 편 소켓은 mafia·ghost 줄을 한 줄도 받지 않는다.
        if (msg.t === "chat") {
          for (const pth of paths) expect(CHAT_KEY_PATHS.has(pth)).toBe(true);
          for (const [pth, value] of stringPaths(msg)) {
            if (pth === ".t") expect(value).toBe("chat");
            if (pth === ".ch") expect(["all", "mafia", "ghost"].includes(value)).toBe(true);
          }
          lived.push(`${msg.ch}/${msg.seat}/${msg.seq}/${msg.text}`);
          if (msg.ch === "all") alls.push(msg.seq);
          else if (msg.ch === "mafia") {
            expect(`${phase}/${dead || a.role === "mafia"}`).toBe("night/true"); // 밤의 산 마피아 또는 탈락자
            mafias.push(msg.seq);
          } else {
            expect(dead).toBe(true); // ghost 줄은 탈락자만
            ghosts.push(msg.seq);
          }
        }
        // chatReject: 보낸 사람(밤의 산 시민 Y) 소켓에만, 키는 t·why 뿐이고 이유는 phase 하나(역할을 말하지 않는다).
        if (msg.t === "chatReject") {
          for (const pth of paths) expect(CHAT_REJECT_KEY_PATHS.has(pth)).toBe(true);
          rejected.push(msg.why);
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
      allLines.set(a.seat, alls);
      mafiaLines.set(a.seat, mafias);
      ghostLines.set(a.seat, ghosts);
      rejects.set(a.seat, rejected);
      liveChats.set(a.seat, lived);
      typingCounts.set(a.seat, typings);
    }

    // (7)(8) 받을 사람은 실제로 받았다: 1일차 밤 마피아 A 의 켜짐·꺼짐 두 프레임은 B 만 받고, 나머지(시민 편·A 자신)는 0건이다. 산 마피아 둘은 me.chat "mafia" 를 봤다.
    for (const a of actors) expect(`${a.seat}:${typingCounts.get(a.seat)}`).toBe(`${a.seat}:${a === mafiaB ? 2 : 0}`);
    expect([...sawChatMafia].sort().join(",")).toBe([mafiaA.seat, mafiaB.seat].sort().join(","));

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
    expect([...saw.tally].sort()).toEqual([mafiaA.seat, mafiaB.seat].sort()); // 집계는 산 마피아 둘만 받았고, 둘 다 같은 대상을 골라 확정도 받았다
    expect([...saw.sure].sort()).toEqual([mafiaA.seat, mafiaB.seat].sort());

    // (5) 두 아침 각각 모든 소켓이 같은 day.morning 이고 각각 {eliminated} 하나뿐이다(문구 번호 없음, 결정 0061-17).
    for (const day of [1, 2]) {
      expect(morningsByDay.get(day)!.size).toBe(1);
      expect(morningSeen.get(day)!.size).toBe(6);
    }
    const morning1 = JSON.parse([...morningsByDay.get(1)!][0]!) as { eliminated?: number };
    const morning2 = JSON.parse([...morningsByDay.get(2)!][0]!) as { eliminated?: number };
    expect(Object.keys(morning1)).toEqual(["eliminated"]);
    expect(morning1.eliminated).toBe(victimX.seat);
    expect(Object.keys(morning2)).toEqual(["eliminated"]);
    expect(morning2.eliminated).toBe(victimY.seat);

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

    // (6) 채널마다 따로 센 줄 번호(리서치 Pitfall 1, 결정 0058-5): 공개 줄(ch all)은 마피아·탈락자 줄 때문에 틈이 생기지 않는다 — 모든 소켓이 1, 2 를 받는다.
    for (const a of actors) expect(`${a.seat}:${allLines.get(a.seat)!.join(",")}`).toBe(`${a.seat}:1,2`);
    // 밤 마피아 줄 번호는 밤마다 1부터가 아니라 판 내내 이어진다(가정 A3): 산 마피아 둘은 1·2, 2일차 밤에 이미 탈락한 X 는 2 만, 나머지는 한 줄도 받지 않는다.
    for (const a of actors) {
      const expected = a.role === "mafia" ? "1,2" : a === victimX ? "2" : "";
      expect(`${a.seat}:${mafiaLines.get(a.seat)!.join(",")}`).toBe(`${a.seat}:${expected}`);
    }
    // 탈락자 줄: X 의 2일차 줄(1번)은 X 만, Y 의 아침 줄(2번)은 X·Y 가 받는다 — 산 사람 소켓은 한 줄도 받지 않는다.
    for (const a of actors) {
      const expected = a === victimX ? "1,2" : a === victimY ? "2" : "";
      expect(`${a.seat}:${ghostLines.get(a.seat)!.join(",")}`).toBe(`${a.seat}:${expected}`);
    }
    // 거절: 밤의 산 시민 Y 의 전송 하나뿐이고 Y 소켓에만 갔다.
    for (const a of actors) expect(`${a.seat}:${rejects.get(a.seat)!.join(",")}`).toBe(`${a.seat}:${a === victimY ? "phase" : ""}`);

    // ---- 재접속 복원 (07-14, 누설 검사 (d), 결정 0058-2): 판이 끝난 자리에서 모두 새 소켓으로 다시 hello 한다 ----
    // 복원 chatLog 는 라이브로 받은 줄과 같고(보낼 때의 마스크로만), 키는 허용 목록뿐이며(r·g·n 없음), mafia·ghost 값은 받을 권리 있는 소켓에서만 나온다.
    for (const a of actors) {
      const again = await connect(code);
      send(again, { t: "hello", token: a.token });
      const logFrame = (await nextFrame(again, (m) => m.t === "chatLog")) as Extract<ServerMessage, { t: "chatLog" }>;
      const raw = collect(again).find((f) => (JSON.parse(f) as ServerMessage).t === "chatLog")!;
      for (const t of allTokens) expect(raw.includes(t)).toBe(false);
      for (const path of keyPaths(logFrame)) {
        expect(`${path}:${CHATLOG_KEY_PATHS.has(path)}`).toBe(`${path}:true`);
        expect(FORBIDDEN_KEYS.includes(path.slice(path.lastIndexOf(".") + 1))).toBe(false);
      }
      for (const [pth, value] of stringPaths(logFrame)) {
        if (pth === ".t") expect(value).toBe("chatLog");
        if (pth !== ".lines[].ch") continue;
        expect(["all", "mafia", "ghost"].includes(value)).toBe(true);
        // mafia 줄: 산 마피아, 또는 그 밤(2일차 밤)에 이미 탈락해 있던 X. ghost 줄: 탈락자 X·Y.
        if (value === "mafia") expect(`${a.seat}:${a.role === "mafia" || a === victimX}`).toBe(`${a.seat}:true`);
        if (value === "ghost") expect(`${a.seat}:${a === victimX || a === victimY}`).toBe(`${a.seat}:true`);
      }
      const restored = logFrame.lines.map((l) => `${l.ch}/${l.seat}/${l.seq}/${l.text}`).join("|");
      expect(`${a.seat}:${restored}`).toBe(`${a.seat}:${liveChats.get(a.seat)!.join("|")}`);
      // 살아 있던 시민 편(경찰·의사)은 mafia·ghost 줄이 0건이고, 산 사람 기록에는 ghost 줄이 0건이다.
      if (a.role !== "mafia" && a !== victimX && a !== victimY) expect(restored.includes("mafia/") || restored.includes("ghost/")).toBe(false);
    }
  });
});

// ---- 처형·처형 무효·종료를 지나는 6명 한 판(04-09): 모든 실제 프레임의 받는 사람 규칙 (결정 0036-12) ----

describe("6명 한 판: 낮 처형(토론 끝내기·지목·변론·찬반·처형)·처형 무효·종료 전수 프레임 누출 검사 (DAY-03~07, GHOST-01, 결정 0053·0060, D-09, D-17)", () => {
  it(
    "1일차 토론 끝내기 → 지목 → 변론 → 찬반(한 사람이 값을 바꿈) → 처형(마피아 A) → 의사가 지킨 밤 → 2일차 지목 동률 밤 → 3일차 마지막 마피아 처형 → 종료: 모든 프레임이 받는 사람 규칙을 지킨다",
    { timeout: 90_000 },
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
        // 09.1-03: 지목은 순차(여러 마감)일 수 있어 저장된 단계가 phase 가 될 때까지 마감을 거듭 당긴다(결정 0063-1).
        for (let guard = 0; guard < 40 && (await storedRoom(code)).phase !== phase; guard += 1) await closePhase(code);
        await waitAll(phase);
      };
      const alive = (dead: ReadonlySet<number>): SeatedActor[] => actors.filter((a) => !dead.has(a.seat));
      const dead = new Set<number>();
      const bySeat = [...actors].sort((a, b) => a.seat - b.seat);

      // 누가 그날 무엇을 던졌는지(프레임 검사의 기대값). 일차 → seat → 값. 값을 바꾼 사람은 두 값을 모두 기록한다(그 소켓이 받는 me.verdictVote 는 이 집합 안이다).
      const pressed = new Map<number, Set<number>>(); // 토론 끝내기를 누른 좌석
      const verdictEver = new Map<number, Map<number, Set<boolean>>>(); // 찬반을 던진 좌석 → 보낸 값들
      const verdictFinal = new Map<number, Map<number, boolean>>();
      const byDay = <T,>(map: Map<number, T>, day: number, make: () => T): T => {
        const got = map.get(day) ?? make();
        map.set(day, got);
        return got;
      };

      /** 토론 끝내기: 과반(산 사람 수의 ⌊n/2⌋+1)이 누르면 지목으로 넘어간다. 누를 때마다 모든 소켓의 day.endCount 가 같고 me.endDiscussion 은 누른 본인에게만 있다. */
      const pressEnd = async (who: SeatedActor[]): Promise<void> => {
        const day = dayNow();
        const mine = byDay(pressed, day, () => new Set<number>());
        for (const [i, a] of who.entries()) {
          mine.add(a.seat);
          await act(a, { t: "endDiscussion", on: true });
          for (const sock of socks) await settle(sock, mark(sock));
          if (i === who.length - 1) break; // 마지막 표는 단계를 넘긴다 — 아래에서 확인
          const views = actors.map((x) => lastViewOf(x.sock));
          expect(new Set(views.map((v) => v.day?.endCount)).size).toBe(1);
          expect(views[0]!.day?.endCount).toBe(i + 1);
          for (const [j, v] of views.entries()) expect(Object.hasOwn(v.me, "endDiscussion")).toBe(mine.has(actors[j]!.seat));
        }
        // 마지막 표(과반)가 마감을 당겨 단계를 넘겼다 — settle 이 이미 그 프레임을 읽었으므로 마지막 view 로 본다.
        for (const a of actors) expect(lastViewOf(a.sock).phase).toBe("nomination");
      };

      /**
       * 지목: 모두가 모두에게 공개다 — 던질 때마다 모든 소켓의 day.points 가 같은 목록이다.
       * 09.1-03: day.turn 이 있으면(순차 지목) 차례를 좌석 순으로 걸으며 voters 만 자기 차례에 던지고 나머지는 마감을 당겨 넘긴다(결정 0063-1).
       */
      const castPoints = async (targetOf: (a: SeatedActor) => number, voters: SeatedActor[]): Promise<void> => {
        const throwPoint = async (a: SeatedActor): Promise<void> => {
          await act(a, { t: "point", target: targetOf(a) });
          for (const sock of socks) await settle(sock, mark(sock));
          expect(new Set(actors.map((x) => JSON.stringify(lastViewOf(x.sock).day?.points))).size).toBe(1);
        };
        if (lastViewOf(actors[0]!.sock).day?.turn === undefined) {
          for (const a of voters) await throwPoint(a);
        } else {
          for (let guard = 0; guard < 40; guard += 1) {
            const view = lastViewOf(actors[0]!.sock);
            const turn = view.day?.turn;
            if (view.phase !== "nomination" || turn === undefined || turn.i >= turn.order.length) break;
            const seatNow = turn.i >= 0 && turn.doneAt === undefined ? turn.order[turn.i] : undefined;
            const voter = voters.find((a) => a.seat === seatNow);
            if (voter !== undefined) {
              await throwPoint(voter);
              continue;
            }
            const marks = socks.map((sock) => mark(sock));
            await closePhase(code);
            for (const [i, sock] of socks.entries()) await settle(sock, marks[i]!);
          }
        }
        const points = lastViewOf(actors[0]!.sock).day?.points ?? [];
        expect(points.map((l) => `${l.seat}>${l.target}`).sort().join(",")).toBe(voters.map((a) => `${a.seat}>${targetOf(a)}`).sort().join(","));
      };

      /**
       * 찬반: 처음 던지면 모두의 day.voted 가 같고 값은 없다. 첫 투표자는 한 번 값을 바꾼다 — 그 소켓만 새 값을 받고 나머지 모든 소켓(유령 포함)은 프레임이 없다.
       * 던지지 않은 소켓의 me 에는 verdictVote 키가 없다.
       */
      const castVerdicts = async (voters: SeatedActor[], agreeOf: (a: SeatedActor) => boolean, flipFirst: boolean): Promise<void> => {
        const day = dayNow();
        const ever = byDay(verdictEver, day, () => new Map<number, Set<boolean>>());
        const fin = byDay(verdictFinal, day, () => new Map<number, boolean>());
        const remember = (a: SeatedActor, value: boolean): void => {
          const set = ever.get(a.seat) ?? new Set<boolean>();
          set.add(value);
          ever.set(a.seat, set);
          fin.set(a.seat, value);
        };
        const [first, ...rest] = voters as [SeatedActor, ...SeatedActor[]];
        remember(first, agreeOf(first));
        expect(summary(await act(first, { t: "verdict", agree: agreeOf(first) }))).toBe("[state:verdict]");
        for (const sock of socks) await settle(sock, mark(sock));
        if (flipFirst) {
          const others = actors.filter((a) => a !== first);
          const marks = others.map((a) => mark(a.sock));
          remember(first, !agreeOf(first));
          const own = await act(first, { t: "verdict", agree: !agreeOf(first) });
          expect(summary(own)).toBe("[state:verdict]");
          expect((own[0] as Extract<ServerMessage, { t: "state" }>).view.me.verdictVote).toBe(!agreeOf(first));
          for (let i = 0; i < others.length; i += 1) expect(summary(await settle(others[i]!.sock, marks[i]!))).toBe("[]");
          remember(first, agreeOf(first)); // 원래 값으로 되돌려 최종 값은 agreeOf 와 같다
          await act(first, { t: "verdict", agree: agreeOf(first) });
          for (const sock of socks) await settle(sock, mark(sock));
        }
        for (const a of rest) {
          remember(a, agreeOf(a));
          expect(summary(await act(a, { t: "verdict", agree: agreeOf(a) }))).toBe("[state:verdict]");
        }
        for (const sock of socks) await settle(sock, mark(sock));
        const views = actors.map((x) => lastViewOf(x.sock));
        // 모든 소켓의 day.voted 가 같고, 던진 좌석만 오름차순으로 있다
        expect(new Set(views.map((v) => JSON.stringify(v.day?.voted))).size).toBe(1);
        expect(JSON.stringify(views[0]!.day?.voted)).toBe(JSON.stringify(voters.map((a) => a.seat).sort((a, b) => a - b)));
        // 던진 본인에게만 값이 있고(최종 값), 던지지 않은 소켓(변론자·유령 포함)에는 키가 없다
        for (const [j, v] of views.entries()) {
          const a = actors[j]!;
          expect(Object.hasOwn(v.me, "verdictVote")).toBe(fin.has(a.seat));
          if (fin.has(a.seat)) expect(v.me.verdictVote).toBe(fin.get(a.seat));
        }
      };

      // ---------- 1일차: 낮 → 토론 끝내기 과반 → 지목 → 변론 → 찬반 → 처형 ----------
      await advanceTo(code, socks, "discussion");
      // 직업 주장 대본(결정 0066-1): 마피아 A 가 citizen 을 걸었다가 police 로 바꾸고(말 바꿈), 시민 X 가 mafia 를 건다. 프레임 검사는 players[].badge 값이 이 대본의 값뿐임을 본다.
      const badgeScript = new Map<number, ReadonlySet<string>>([
        [mafiaA.seat, new Set(["citizen", "police"])],
        [victimX.seat, new Set(["mafia"])],
      ]);
      await act(mafiaA, { t: "badge", role: "citizen" });
      await act(victimX, { t: "badge", role: "mafia" });
      await pause(300); // 같은 사람의 주장 간격(250ms) 밖
      await act(mafiaA, { t: "badge", role: "police" });
      for (const sock of socks) await settle(sock, mark(sock));
      expect(lastViewOf(actors[0]!.sock).players.find((pl) => pl.seat === mafiaA.seat)?.badge).toBe("police");
      await pressEnd(bySeat.slice(0, 4)); // 6명 판의 과반 4
      await castPoints((a) => (a === mafiaA ? police.seat : mafiaA.seat), alive(dead));
      await closeInto("defense");
      expect(new Set(actors.map((a) => lastViewOf(a.sock).day?.candidate)).size).toBe(1);
      expect(lastViewOf(actors[0]!.sock).day?.candidate).toBe(mafiaA.seat);
      await act(mafiaA, chatMsg(mafiaA.sock, "저 아니에요"));
      await closeInto("verdict");
      const voters1 = alive(dead).filter((a) => a !== mafiaA);
      await castVerdicts(voters1, (a) => a.seat !== voters1[1]!.seat, true); // 찬성 4 · 반대 1 → 통과
      await closeInto("execution");
      dead.add(mafiaA.seat);
      for (const a of actors) {
        const view = lastViewOf(a.sock);
        expect(`${view.day?.execution?.seat} ${Object.keys(view.day?.execution ?? {}).sort().join(",")}`).toBe(`${mafiaA.seat} seat`);
        expect(JSON.stringify(view.day?.verdict)).toBe(JSON.stringify({ yes: 4, no: 1, passed: true }));
        expect(view.players.find((p) => p.seat === mafiaA.seat)?.alive).toBe(false);
        expect(Object.hasOwn(view.me, "verdictVote")).toBe(false); // 처형 단계에서는 개인 값이 없다
      }

      // 1일차 밤: 마피아 B 가 X 를, 의사가 같은 X 를 지켜 아무도 죽지 않는다(마피아 1 vs 4 라 판은 이어진다)
      await advanceTo(code, socks, "night");
      await act(mafiaB, { t: "pick", target: victimX.seat });
      await act(doctor, { t: "pick", target: victimX.seat });
      await act(police, { t: "pick", target: mafiaB.seat });
      await advanceTo(code, socks, "morning");
      // 마피아 B 혼자 산 마피아라 B 의 선택이 곧 확정이고, 의사가 지켜 { saved: true } 만 공개된다(보호받은 사람은 싣지 않는다, 결정 0061-12).
      for (const a of actors) expect(JSON.stringify(lastViewOf(a.sock).day?.morning)).toBe('{"saved":true}');

      // ---------- 2일차: 지목 최다 동률(처형 무효 밤) — 둘째 날 토론은 전날 끝내기 표 없이 시작한다 ----------
      await advanceTo(code, socks, "discussion");
      expect(dayNow()).toBe(2);
      for (const a of actors) expect(lastViewOf(a.sock).day?.endCount).toBe(0);
      for (const a of actors) expect(Object.hasOwn(lastViewOf(a.sock).me, "endDiscussion")).toBe(false);
      await advanceTo(code, socks, "nomination");
      const living2 = alive(dead).sort((a, b) => a.seat - b.seat);
      await castPoints((a) => living2[(living2.indexOf(a) + 1) % living2.length]!.seat, living2); // 모두 한 표씩 → 동률
      await closeInto("night");
      for (const a of actors) {
        const view = lastViewOf(a.sock);
        expect(JSON.stringify(view.day?.noExecution)).toBe(JSON.stringify({ reason: "tie" }));
      }
      await act(police, { t: "pick", target: mafiaB.seat }); // 마피아 B 는 고르지 않는다
      await advanceTo(code, socks, "morning");

      // ---------- 3일차: 지목 → 변론 → 찬반 → 후보 B(마지막 마피아) 처형 → 종료 ----------
      await advanceTo(code, socks, "nomination");
      expect(dayNow()).toBe(3);
      await castPoints((a) => (a === mafiaB ? police.seat : mafiaB.seat), alive(dead));
      await closeInto("defense");
      await act(mafiaB, chatMsg(mafiaB.sock, "한 번만 믿어 주세요"));
      await closeInto("verdict");
      await castVerdicts(alive(dead).filter((a) => a !== mafiaB), () => true, false);
      await closeInto("execution");
      dead.add(mafiaB.seat);
      await advanceTo(code, socks, "ended");
      for (const sock of socks) await settle(sock, mark(sock));

      // ---------- 검사 ----------
      // 처형·종료까지 간 한 판에서도 world 프레임의 키·문자열이 허용 목록 안이고 산 사람 소켓에는 산 좌석만 갔다(06-08, 08-09).
      assertWorldFrames(socks);
      const preview = await exports.default.fetch(`http://x/api/rooms/${code}`);
      const previewText = await preview.text();
      for (const t of allTokens) expect(previewText.includes(t)).toBe(false);
      expect(previewText.includes("result")).toBe(false);

      const seen = {
        endMine: new Set<number>(),
        verdictMine: new Set<number>(),
        points: new Set<number>(),
        voted: new Set<number>(),
        verdict: new Set<number>(),
        noExec: new Set<number>(),
        result: new Set<number>(),
        execution: new Set<number>(),
      };
      let flipFrames = 0; // 값을 바꾼 사람 소켓이 받은 반대 값 프레임(찬반 마감 전 그 사람 소켓에만 간다)
      for (const a of actors) {
        let isDead = false;
        for (const raw of collect(a.sock)) {
          // 남의 토큰은 어떤 프레임에도 없다
          for (const t of allTokens) expect(raw.includes(t)).toBe(false);
          const msg = JSON.parse(raw) as ServerMessage;
          expect(msg.t === "error").toBe(false); // 시나리오의 모든 행동은 받아들여졌다
          const paths = keyPaths(msg);
          for (const path of paths) {
            const key = path.slice(path.lastIndexOf(".") + 1);
            expect(FORBIDDEN_KEYS.includes(key)).toBe(false);
            if (key === "role" || key === "allies") expect(path).toBe(`.view.me.${key}`);
            // 서버 전용 키는 어디에도 없다. 같은 이름의 공개 와이어 필드 경로만 이유와 함께 허용한다 — 허용 목록은 받을 권리 조건으로만 넓힌다(결정 0060-3·4).
            expect(!ALLOWED_WIRE_PATHS.has(path) && SERVER_ONLY_KEYS.includes(key)).toBe(false);
            // 개인 값은 본인 경로 밖에 없다
            if (key === "verdictVote") expect(path).toBe(".view.me.verdictVote");
            if (key === "endDiscussion") expect(path).toBe(".view.me.endDiscussion");
          }
          if (msg.t !== "state") continue;
          const v = msg.view;
          const day = v.day?.n ?? 0;
          if (v.players.find((pl) => pl.seat === a.seat)?.alive === false) isDead = true;
          for (const pl of v.players) {
            // 공개 주장(결정 0066-1): badge·badgeSwapped 는 대본에 있는 산 사람 줄에만, 값은 항상 대본의 값이다(실제 역할이 아니다).
            const scripted = badgeScript.get(pl.seat);
            const base = ["alive", "connected", "isHost", "nickname", "seat"];
            if (pl.badge === undefined) {
              expect(Object.keys(pl).sort()).toEqual(base);
              continue;
            }
            expect(pl.alive).toBe(true); // 탈락한 사람의 줄에는 주장이 없다
            expect(`${pl.seat}:${scripted !== undefined && scripted.has(pl.badge)}`).toBe(`${pl.seat}:true`);
            const swapKeys = pl.badgeSwapped === true ? ["badgeSwapped"] : [];
            expect(Object.keys(pl).sort()).toEqual([...base, "badge", ...swapKeys].sort());
            if (pl.badgeSwapped === true) expect(`${pl.seat}:${pl.badge}`).toBe(`${mafiaA.seat}:police`);
          }
          const has = (prefix: string): boolean => paths.some((pth) => pth === prefix || pth.startsWith(`${prefix}.`) || pth.startsWith(`${prefix}[]`));

          // 역할 값 문자열은 허용 경로에만 — 처형자 A 의 직업도 ended 전에는 살아 있는 소켓에 오지 않는다. ended 에서만 결과 경로가 더해진다.
          const allowed = [...(isDead ? ROLE_PATHS_DEAD : ROLE_PATHS_ALIVE), ...(v.phase === "ended" ? [ROLE_PATH_ENDED] : [])];
          for (const [pth, value] of stringPaths(msg)) if (ROLE_WORDS.has(value)) expect(`${v.phase} ${pth} ${allowed.includes(pth)}`).toBe(`${v.phase} ${pth} true`);
          // 관전은 탈락한 뒤에만(결정 0021)
          expect(has(".view.spectate")).toBe(isDead);

          // result 는 ended 프레임에만
          expect(has(".view.result")).toBe(v.phase === "ended");
          if (v.phase === "ended") seen.result.add(a.seat);
          // 새 공개 키는 그 단계에만, 그리고 모두에게 같은 값일 때만 허용한다(위 라이브 검사가 같은 시점 모든 소켓의 값이 같음을 본다)
          expect(has(".view.day.endCount")).toBe(v.phase === "discussion"); // 개수만 — 누가 눌렀는지는 없다
          expect(has(".view.day.points")).toBe(v.phase === "nomination"); // 지목은 중에도 모두에게 공개(결정 0060-3)
          expect(has(".view.day.voted")).toBe(v.phase === "verdict"); // 던진 좌석만, 값 없음(결정 0053)
          expect(has(".view.day.verdict")).toBe(v.phase === "execution"); // 집계는 처형 단계에서 한꺼번에(결정 0053)
          expect(has(".view.day.candidate")).toBe(["defense", "verdict", "execution"].includes(v.phase));
          expect(has(".view.day.execution")).toBe(v.phase === "execution");
          // 찬반 기록(결정 0066-3, L19): day.ballots 는 처형 단계에서만 — 찬반 진행 중 프레임에는 키 자체가 없다(던진 좌석 day.voted 뿐). 목록은 그날 최종 값과 같고 값은 좌석 정수뿐이다.
          expect(has(".view.day.ballots")).toBe(v.phase === "execution");
          if (v.phase === "execution") {
            const fin = [...(verdictFinal.get(day) ?? new Map<number, boolean>())].sort((x, y) => x[0] - y[0]);
            expect(Object.keys(v.day!.ballots!).sort()).toEqual(["no", "yes"]);
            expect(JSON.stringify(v.day!.ballots)).toBe(JSON.stringify({ yes: fin.filter(([, x]) => x).map(([sn]) => sn), no: fin.filter(([, x]) => !x).map(([sn]) => sn) }));
            for (const sn of [...v.day!.ballots!.yes, ...v.day!.ballots!.no]) expect(Number.isInteger(sn)).toBe(true);
            expect(v.day!.ballots!.yes.includes(v.day!.candidate!) || v.day!.ballots!.no.includes(v.day!.candidate!)).toBe(false); // 변론자는 어느 목록에도 없다
          }
          if (v.phase === "nomination" && (v.day?.points?.length ?? 0) > 0) seen.points.add(a.seat);
          if (v.phase === "verdict" && (v.day?.voted?.length ?? 0) > 0) {
            seen.voted.add(a.seat);
            for (const s of v.day!.voted!) expect(Number.isInteger(s)).toBe(true); // 좌석 번호뿐, 값이 아니다
          }
          if (v.phase === "execution") {
            seen.execution.add(a.seat);
            seen.verdict.add(a.seat);
          }
          // 처형 무효 이유는 처형 무효로 온 밤(2일차)에만, 키는 reason 하나. 찬반 부결은 처형 단계가 알리므로 이 키가 아니다.
          const wantNoExecution = v.phase === "night" && day === 2;
          expect(has(".view.day.noExecution")).toBe(wantNoExecution);
          if (wantNoExecution) {
            expect(Object.keys(v.day!.noExecution!)).toEqual(["reason"]);
            seen.noExec.add(a.seat);
          }
          // 줄 키: exec 는 no·passed·yes, cand 는 votes(+candidate)
          for (const line of v.day?.voteLog ?? []) {
            expect(Object.keys(line.exec).sort()).toEqual(["no", "passed", "yes"]);
            if (line.cand !== undefined) {
              expect(Object.keys(line.cand).sort()).toEqual(line.cand.candidate === undefined ? ["votes"] : ["candidate", "votes"]);
              for (const vote of line.cand.votes) expect(Object.keys(vote).sort()).toEqual(["seat", "target"]);
            }
          }
          // 본인 값: 본인이 던진 값만, 그 단계에서만, 생존 중에만 — 남의 값은 어떤 키로도 없다
          if (v.me.verdictVote !== undefined) {
            expect(v.phase).toBe("verdict");
            expect(isDead).toBe(false);
            expect(verdictEver.get(day)?.get(a.seat)?.has(v.me.verdictVote)).toBe(true);
            seen.verdictMine.add(a.seat);
            if (v.me.verdictVote !== verdictFinal.get(day)?.get(a.seat)) flipFrames += 1;
          }
          if (v.me.endDiscussion !== undefined) {
            expect(v.phase).toBe("discussion");
            expect(isDead).toBe(false);
            expect(v.me.endDiscussion).toBe(true);
            expect(pressed.get(day)?.has(a.seat)).toBe(true);
            seen.endMine.add(a.seat);
          }
        }
      }

      // 받을 사람은 실제로 받았다 — 아무도 못 받는 검사가 되지 않게.
      const everyone = bySeat.map((a) => a.seat);
      // 누른 사람만 본인 표시를 받는다. 네 번째 표는 과반이라 곧장 지목으로 넘어가 토론 프레임을 더 받지 않는다.
      expect([...seen.endMine].sort()).toEqual(bySeat.slice(0, 3).map((a) => a.seat));
      expect([...seen.points].sort()).toEqual(everyone);
      expect([...seen.voted].sort()).toEqual(everyone);
      expect([...seen.verdict].sort()).toEqual(everyone);
      expect([...seen.noExec].sort()).toEqual(everyone);
      expect([...seen.result].sort()).toEqual(everyone);
      expect([...seen.execution].sort()).toEqual(everyone);
      expect(seen.verdictMine.size).toBeGreaterThanOrEqual(5); // 1일차 투표자 5명 중 다섯이 자기 값을 받았다
      expect(flipFrames).toBeGreaterThanOrEqual(1); // 값을 바꾼 프레임을 실제로 하나 이상 봤다(그 소켓만)

      // 종료: 모든 소켓의 result 가 같고, 요약에 1일차 의사가 지킨 밤과 2일차 동률이 있다.
      const results = actors.map((a) => lastViewOf(a.sock).result);
      expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
      const result = results[0]!;
      expect(result.winner).toBe("citizenWin");
      expect(result.seats).toEqual(bySeat.map((a) => ({ seat: a.seat, job: a.role })));
      const row = (n: number) => result.summary.find((r) => r.n === n);
      expect(row(1)?.exec).toEqual({ yes: 4, no: 1, passed: true, candidate: mafiaA.seat });
      expect(row(1)?.night).toEqual({ target: victimX.seat, died: false });
      expect(row(2)?.exec).toEqual({ yes: 0, no: 0, passed: false });
      expect(row(3)?.exec).toEqual({ yes: 4, no: 0, passed: true, candidate: mafiaB.seat });
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
    await advanceTo(r.code, [r.host, guest], "nomination");
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

describe("아침 카드 프레임은 허용 키 목록 안이다 (09-14, MORN-02, 결정 0061-11)", () => {
  it("유언·쪽지 카드를 받은 모든 소켓의 chat 프레임 키는 CHAT_KEY_PATHS, 재접속 chatLog 줄 키는 CHATLOG_KEY_PATHS 안이고 k 값은 will·note 뿐이다", async () => {
    const g = await startedGame("night");
    const v = withRole(g, "citizen")[0]!;
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === v.seat ? { ...p, will: "유언" } : p)));
    const mafias = withRole(g, "mafia");
    for (const m of mafias) pickAs(m, v.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    send(mafias[0]!.sock, { t: "note", text: "쪽지" });
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const marks = g.socks.map((s) => mark(s));
    await advanceTo(g.code, g.socks, "morning");
    let cards = 0;
    for (let i = 0; i < g.socks.length; i += 1) {
      for (const msg of await settle(g.socks[i]!, marks[i]!)) {
        if (msg.t !== "chat") continue;
        cards += 1;
        for (const pth of keyPaths(msg)) expect(`${pth}:${CHAT_KEY_PATHS.has(pth)}`).toBe(`${pth}:true`);
        // 이 시나리오에는 귓속말이 없다 — 카드 두 종류만 나온다. 허용 값 집합 선언은 CHAT_KIND_VALUES 가 한다.
        expect(["will", "note"].includes(String(msg.k)) && CHAT_KIND_VALUES.has(String(msg.k))).toBe(true);
      }
    }
    expect(cards).toBe(g.socks.length * 2);
    const again = await connect(g.code);
    send(again, { t: "hello", token: g.actors[0]!.token });
    const logFrame = (await nextFrame(again, (m) => m.t === "chatLog")) as Extract<ServerMessage, { t: "chatLog" }>;
    for (const pth of keyPaths(logFrame)) expect(`${pth}:${CHATLOG_KEY_PATHS.has(pth)}`).toBe(`${pth}:true`);
  }, 40_000);
});

// ---- 신분 행렬·유언 canary (09-16, WILL-01, NIGHT-12, 결정 0061-7·9·10·12·14, L7·L8·L11) ----
// 허용 경로는 새로 더하지 않았다: me.will(본인·산 사람), me.note·nightTally·nightSure(밤의 산 마피아)는 아래에서 받을 권리 조건과 함께 단언한다(0061-7·9·10·12).
// 아침 카드 경로는 앞 describe 의 CHAT_KEY_PATHS·CHATLOG_KEY_PATHS 가 이미 가진 ".k" 뿐이다(0061-11·14).
describe("신분 여섯 × 유언·쪽지 canary 행렬 (WILL-01, NIGHT-12, L7·L8·L11)", () => {
  const NOTE = "NOTE-CANARY";
  type Seated6 = SeatedActor;

  it("유언은 본인 프레임에만, 쪽지·집계는 밤의 산 마피아에게만, 죽은 뒤 유언·쪽지는 카드 줄로만 나온다", async () => {
    const g = await startedGame("discussion");
    const [v, ghostC] = withRole(g, "citizen") as [Seated6, Seated6];
    const mafias = withRole(g, "mafia");
    const bySeat = new Map(g.actors.map((a) => [a.seat, a]));

    // 판 시작(낮)에 여섯 명이 각자 유언을 남긴다.
    for (const a of g.actors) send(a.sock, { t: "will", text: `CANARY-${a.seat}` });
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    // 시민 하나는 밤 전에 이미 유령이다(유령 소켓의 쪽지 누설 검사). 저장 편집이라 카드는 없다.
    await ghostsOf(g, [ghostC.seat]);
    await advanceTo(g.code, g.socks, "night");
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    // 마피아 전원이 V 를 고르면 확정, 이어서 쪽지.
    for (const m of mafias) pickAs(m, v.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    send(mafias[0]!.sock, { t: "note", text: NOTE });
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    // 쪽지 뒤에 경찰·의사가 고르면 그들 소켓이 새 state 를 받는다 — 쪽지가 그 view 에 섞이면 여기서 드러난다(의사는 V 가 아닌 사람을 지킨다).
    pickAs(withRole(g, "police")[0]!, mafias[1]!.seat);
    pickAs(withRole(g, "doctor")[0]!, mafias[0]!.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const beforeMorning = g.socks.map((sock) => mark(sock));

    /** 이 소켓 주인(a)이 받을 권리 없는 유언·쪽지 글이 프레임에 있으면 설명 한 줄씩. cards 가 true 면 V 의 유언·쪽지 카드 줄은 허용한다. */
    const violations = (a: Seated6, msgs: ServerMessage[], cards: boolean): string[] => {
      const out: string[] = [];
      const isCard = (m: { k?: string; seat: number; text: string }): boolean =>
        cards && m.seat === v.seat && ((m.k === "will" && m.text === `CANARY-${v.seat}`) || (m.k === "note" && m.text === NOTE));
      for (const msg of msgs) {
        const units: Array<{ k?: string; seat: number; text: string } | ServerMessage> = msg.t === "chatLog" ? msg.lines : [msg];
        for (const unit of units) {
          const json = JSON.stringify(unit);
          const hasForeign = [...bySeat.keys()].some((sn) => sn !== a.seat && json.includes(`CANARY-${sn}`));
          const hasNote = json.includes(NOTE);
          if (!hasForeign && !hasNote) continue;
          const asLine = unit as { t?: string; k?: string; seat: number; text: string };
          const card = (asLine.t === undefined || asLine.t === "chat") && isCard(asLine);
          const ownNote = msg.t === "state" && msg.view.phase === "night" && msg.view.me.note === NOTE && a.role === "mafia" && !hasForeign;
          if (!card && !ownNote) out.push(`${a.role}#${a.seat} ${msg.t}: ${json.slice(0, 120)}`);
        }
      }
      return out;
    };

    // ---- 밤(아침 전) ----
    for (const a of g.actors) {
      const i = g.actors.indexOf(a);
      const msgs = framesOf(a.sock).slice(0, beforeMorning[i]!);
      expect(violations(a, msgs, false).join("\n")).toBe("");
    }
    for (const m of mafias) {
      const i = g.actors.indexOf(m);
      expect(framesOf(m.sock).slice(0, beforeMorning[i]!).some((x) => x.t === "state" && x.view.me.note === NOTE)).toBe(true);
    }

    // ---- 아침 ----
    await advanceTo(g.code, g.socks, "morning");
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    // 새 소켓 재접속(chatLog 의 카드 줄도 같은 규칙).
    const again = await connect(g.code);
    const citizenAgain = g.actors.find((a) => a.role === "doctor")!;
    send(again, { t: "hello", token: citizenAgain.token });
    await nextFrame(again, (m) => m.t === "chatLog");
    await settle(again, 0);
    expect(violations(citizenAgain, framesOf(again), true).join("\n")).toBe("");

    const allFrames = g.actors.map((a) => framesOf(a.sock));
    for (const a of g.actors) {
      const i = g.actors.indexOf(a);
      expect(violations(a, allFrames[i]!, true).join("\n")).toBe("");
      const post = allFrames[i]!.slice(beforeMorning[i]!);
      const cards = post.filter((x): x is Extract<ServerMessage, { t: "chat" }> => x.t === "chat" && x.k !== undefined);
      expect(cards.map((c) => `${c.ch}/${c.k}/${c.seat}/${c.text}`).join("|")).toBe(`all/will/${v.seat}/CANARY-${v.seat}|all/note/${v.seat}/${NOTE}`);
    }

    // ---- 모든 실제 프레임의 경로: 받을 권리 조건 ----
    const sawWill = new Set<number>();
    for (const a of g.actors) {
      let phase = "";
      let alive = true;
      for (const msg of allFrames[g.actors.indexOf(a)]!) {
        for (const pth of keyPaths(msg)) {
          // 서버 전용 키(nightNote 포함)는 어떤 프레임에도 없다. 공개 와이어와 이름이 겹치는 경로는 허용 목록(ALLOWED_WIRE_PATHS)에서만 뺀다.
          if (!ALLOWED_WIRE_PATHS.has(pth)) expect(SERVER_ONLY_KEYS.includes(pth.slice(pth.lastIndexOf(".") + 1))).toBe(false);
        }
        if (msg.t !== "state") continue;
        phase = msg.view.phase;
        alive = msg.view.players.find((p) => p.seat === a.seat)?.alive !== false;
        const me = msg.view.me;
        if (me.will !== undefined) {
          // me.will: 그 소켓 본인 유언, 산 본인에게만(0061-10).
          expect(`${a.seat}:${alive}:${String(me.will)}`).toBe(`${a.seat}:true:CANARY-${a.seat}`);
          sawWill.add(a.seat);
        }
        if (me.note !== undefined) {
          // me.note: 밤의 산 마피아 본인(0061-9·12).
          expect(`${a.role}/${alive}/${phase}`).toBe("mafia/true/night");
          expect(me.note).toBe(NOTE);
        }
        if (me.nightTally !== undefined || me.nightSure !== undefined) {
          // me.nightTally·nightSure: 밤의 산 마피아 본인(0061-7).
          expect(`${a.role}/${alive}/${phase}`).toBe("mafia/true/night");
        }
        if (msg.view.day?.chalk !== undefined) expect(phase === "night").toBe(false);
      }
    }
    // ---- L16 (09.1-05, UI-SPEC): V 의 유언 본문은 죽기 전에 V 본인의 me.will 밖 어느 프레임에도 없고, 죽을 때 all 채널 k:"will" 카드로만 나간다 ----
    const willBody = `CANARY-${v.seat}`;
    const l16: string[] = [];
    for (const a of g.actors) {
      const i = g.actors.indexOf(a);
      let cardCount = 0;
      for (const [idx, m] of allFrames[i]!.entries()) {
        if (!JSON.stringify(m).includes(willBody)) continue;
        const dead = idx >= beforeMorning[i]!;
        const isCard = m.t === "chat" && m.ch === "all" && m.k === "will" && m.seat === v.seat && m.text === willBody;
        const paths = m.t === "state" ? stringPaths(m).filter(([, value]) => value.includes(willBody)).map(([pth]) => pth) : [];
        const ownBeforeDeath = !dead && a === v && m.t === "state" && paths.length === 1 && paths[0] === ".view.me.will";
        if (isCard && dead) cardCount += 1;
        else if (!ownBeforeDeath) l16.push(`${a.role}#${a.seat} frame#${idx} dead=${dead} ${m.t}`);
      }
      if (cardCount !== 1) l16.push(`${a.role}#${a.seat} cards=${cardCount}`);
    }
    expect(l16.join("\n")).toBe("");

    // 여섯이 모두 저장 직후 자기 유언을 본인 view 로 받았다(죽기 전) — 시험이 아무것도 안 보는 것이 아님.
    expect([...sawWill].sort((p, q) => p - q).join(",")).toBe(g.actors.map((a) => a.seat).sort((p, q) => p - q).join(","));

    // 아침 state 의 day.chalk 와 day.morning 은 모든 소켓에서 같다.
    const morningViews = g.socks.map((sock) => lastViewOf(sock));
    expect(new Set(morningViews.map((x) => JSON.stringify([x.day?.chalk, x.day?.morning]))).size).toBe(1);
    expect(JSON.stringify(morningViews[0]!.day?.morning)).toBe(JSON.stringify({ eliminated: v.seat }));
  }, 120_000);
});

// ---- 순차 지목·탈락 직후 누설 (09.1-05, 결정 0063-1·0021·0037, UI-SPEC L12·L14·L15) ----
// 허용 목록(ALLOWED_WIRE_PATHS·ROLE_PATHS_*)은 초록을 만들려고 넓히지 않았다. day.turn 은 좌석·시각만 싣는 공개 정보이고, pickTurn 은 SERVER_ONLY_KEYS 에 있다.

/** 모든 소켓이 차례를 걸을 수 있도록 지목 상태에서 지금 차례 주인의 좌석(없으면 undefined). */
const turnOwnerOf = (turn: { order: number[]; i: number; doneAt?: number }): number | undefined =>
  turn.i >= 0 && turn.i < turn.order.length && turn.doneAt === undefined ? turn.order[turn.i] : undefined;

/** 지목 단계 state 프레임 열. 시각은 방마다 절대값이 달라 그 프레임의 마감(view.phaseEndsAt) 기준 상대값으로만 싣는다(차례 중 endsAt 은 마감과 같다, 확정 뒤 endsAt 은 값이 있다는 사실만). */
function nominationColumn(sock: TestSocket): string[] {
  const out: string[] = [];
  for (const m of framesOf(sock)) {
    if (m.t !== "state" || m.view.phase !== "nomination") continue;
    const turn = m.view.day!.turn!;
    const end = m.view.phaseEndsAt!;
    out.push(
      JSON.stringify({
        turn: {
          order: turn.order,
          i: turn.i,
          skip: turn.skip ?? null,
          endsAt: turn.endsAt === undefined ? null : turn.doneAt === undefined ? turn.endsAt - end : "set",
          doneAt: turn.doneAt === undefined ? null : turn.doneAt - end,
        },
        points: m.view.day!.points,
      }),
    );
  }
  return out;
}

/** 지목 단계를 걷는다: order 의 pickIdx 번째 차례 주인은 다음 사람을 지목하고 나머지 차례는 마감으로 기권시킨다. 끝나면 모든 소켓을 flush 한다. */
async function walkNomination(g: Game, pickIdx: ReadonlySet<number>): Promise<void> {
  for (let guard = 0; guard < 60; guard += 1) {
    const room = await storedRoom(g.code);
    const turn = room.pickTurn;
    if (room.phase !== "nomination" || turn === undefined) break;
    const owner = turnOwnerOf(turn);
    if (owner !== undefined && pickIdx.has(turn.i)) {
      const who = g.actors.find((a) => a.seat === owner)!;
      const marks = g.actors.map((a) => mark(a.sock));
      send(who.sock, { t: "point", target: turn.order[(turn.i + 1) % turn.order.length] });
      for (const [i, a] of g.actors.entries()) await settle(a.sock, marks[i]!);
      continue;
    }
    await closePhase(g.code);
  }
  for (const sock of g.socks) await settle(sock, mark(sock));
}

describe("지목 차례는 역할의 함수가 아니다 (L14, 결정 0063-1)", () => {
  const TABLES: Record<"a" | "b", RoleId[]> = {
    a: ["mafia", "mafia", "police", "doctor", "citizen", "citizen"],
    b: ["citizen", "police", "mafia", "citizen", "mafia", "doctor"],
  };

  /** 6명 판을 지목 모이기에서 시작해 역할만 table 로 고치고 같은 행동으로 걷는다. 소켓마다 지목 단계 열과 저장된 역할 배정을 돌려준다. */
  async function play(table: RoleId[]): Promise<{ columns: string[][]; roles: string }> {
    const g = await startedGame("nomination");
    await editRoom(g.code, (room) => {
      const seats = (room.players as Array<{ seat: number }>).map((p) => p.seat).sort((p, q) => p - q);
      return mapPlayers(room, (p) => ({ ...p, role: table[seats.indexOf(p.seat as number)] }));
    });
    const roles = (await storedRoom(g.code)).players.map((p) => p.role).join(",");
    await walkNomination(g, new Set([0, 2, 3]));
    return { columns: g.socks.map((sock) => nominationColumn(sock)), roles };
  }

  it("역할 배정만 다른 두 판을 같은 행동으로 진행하면 소켓마다 지목 차례 프레임 열이 같고, 한 판 안의 모든 소켓이 같은 열을 받는다", { timeout: 60_000 }, async () => {
    const a = await play(TABLES.a);
    const b = await play(TABLES.b);
    expect(a.roles).not.toBe(b.roles);
    // 시험이 아무것도 안 보는 것이 아님: 모이기·차례·기권·확정·끝 알림을 지나며 열이 길다.
    expect(a.columns[0]!.length).toBeGreaterThan(10);
    expect(a.columns[0]!.some((f) => f.includes('"skip":true'))).toBe(true);
    expect(a.columns[0]!.some((f) => /"seat":\d+,"target":\d+/.test(f))).toBe(true);
    for (const col of a.columns) expect(col.join("\n")).toBe(a.columns[0]!.join("\n"));
    for (const col of b.columns) expect(col.join("\n")).toBe(b.columns[0]!.join("\n"));
    for (const [k, col] of a.columns.entries()) expect(`${k}:${col.join("\n")}`).toBe(`${k}:${b.columns[k]!.join("\n")}`);
  });
});

describe("차례 아닌 지목은 보낸 사람에게만 (L15, 결정 0063-1)", () => {
  it("지목 단계 내내(모이기·차례·확정 뒤·끝 알림) 차례 아닌 산 사람·유령의 point 는 보낸 소켓에만 오류+state 가 가고 다른 소켓은 프레임 0, 저장 상태는 그대로다", { timeout: 90_000 }, async () => {
    const g = await startedGame("discussion");
    const ghost = withRole(g, "citizen")[0]!;
    await ghostsOf(g, [ghost.seat]);
    await advanceTo(g.code, g.socks, "nomination");
    for (const sock of g.socks) await settle(sock, mark(sock));
    const living = g.actors.filter((a) => a !== ghost);

    let sent = 0;
    /** 이 순간 차례 주인이 아닌 모두가 차례로 point 를 보낸다. */
    const probe = async (): Promise<void> => {
      const room = await storedRoom(g.code);
      const owner = turnOwnerOf(room.pickTurn!);
      const snapshot = JSON.stringify([room.players, room.pickTurn, room.phaseEndsAt]);
      for (const a of g.actors) {
        if (a.seat === owner) continue;
        const marks = g.actors.map((x) => mark(x.sock));
        send(a.sock, { t: "point", target: living.find((x) => x.seat !== a.seat)!.seat });
        sent += 1;
        for (const [i, x] of g.actors.entries()) {
          const frames = summary(await settle(x.sock, marks[i]!));
          if (x === a) expect(`${a.seat}:${frames}`).toMatch(/^\d+:\[error:(WRONG_PHASE|BAD_MESSAGE),state:nomination\]$/);
          else expect(`${x.seat}:${frames}`).toBe(`${x.seat}:[]`);
        }
      }
      const after = await storedRoom(g.code);
      expect(JSON.stringify([after.players, after.pickTurn, after.phaseEndsAt])).toBe(snapshot);
    };

    await probe(); // 모이기
    for (let guard = 0; guard < 40; guard += 1) {
      const room = await storedRoom(g.code);
      const turn = room.pickTurn;
      if (room.phase !== "nomination" || turn === undefined) break;
      const owner = turnOwnerOf(turn);
      if (owner !== undefined && turn.i % 2 === 0) {
        const who = g.actors.find((a) => a.seat === owner)!;
        const marks = g.actors.map((a) => mark(a.sock));
        send(who.sock, { t: "point", target: living.find((x) => x.seat !== owner)!.seat });
        for (const [i, a] of g.actors.entries()) await settle(a.sock, marks[i]!);
        await probe(); // 확정 뒤 사이 구간 — 방금 지목한 사람의 재전송도 차례 아님이다
        continue;
      }
      await closePhase(g.code);
      for (const sock of g.socks) await settle(sock, mark(sock));
      if ((await storedRoom(g.code)).phase === "nomination") await probe();
    }
    expect(sent).toBeGreaterThanOrEqual(30);
    // 서버 전용 차례 키 pickTurn 은 어떤 프레임의 어떤 경로에도 없다.
    for (const sock of g.socks) {
      for (const m of framesOf(sock)) for (const pth of keyPaths(m)) expect(`${pth}:${pth.endsWith(".pickTurn")}`).toBe(`${pth}:false`);
    }
  });
});

describe("탈락 직후 산 사람 (L12, 결정 0021·0037)", () => {
  /** 산 사람 소켓 프레임에서 역할 값 문자열이 ROLE_PATHS_ALIVE 밖에 있거나 `.job` 키 경로가 있으면 설명 한 줄씩. */
  const jobLeaks = (msgs: ServerMessage[]): string[] => {
    const out: string[] = [];
    for (const m of msgs) {
      for (const [pth, value] of stringPaths(m)) if (ROLE_WORDS.has(value) && !ROLE_PATHS_ALIVE.includes(pth)) out.push(`${m.t} ${pth}=${value}`);
      for (const pth of keyPaths(m)) if (pth.endsWith(".job")) out.push(`${m.t} ${pth}`);
    }
    return out;
  };

  /** 한 산 사람이 새 소켓으로 다시 붙은 첫 state·chatLog. */
  const reconnectFrames = async (code: string, who: SeatedActor): Promise<ServerMessage[]> => {
    const again = await connect(code);
    send(again, { t: "hello", token: who.token });
    await nextFrame(again, (m) => m.t === "chatLog");
    await settle(again, mark(again));
    return framesOf(again);
  };

  it("처형 전환(지목 → 변론 → 찬반 → 처형) 때 산 사람 소켓 프레임과 직후 재접속 스냅샷에 탈락자의 직업이 없다", { timeout: 90_000 }, async () => {
    const g = await startedGame("nomination");
    const victim = withRole(g, "citizen")[0]!;
    const living = g.actors.filter((a) => a !== victim);
    const from = g.actors.map((a) => mark(a.sock));
    await pointAll(g.code, g.actors, Object.fromEntries(living.map((a) => [a.seat, victim.seat])));
    for (let guard = 0; guard < 40 && (await storedRoom(g.code)).phase !== "verdict"; guard += 1) await closePhase(g.code);
    for (const a of g.actors) await nextFrame(a.sock, phaseOf("verdict"));
    await verdictAll(g.code, g.actors, Object.fromEntries(living.map((a) => [a.seat, true])));
    for (const a of g.actors) await settle(a.sock, mark(a.sock));

    expect((await storedRoom(g.code)).players.find((p) => (p as unknown as { seat: number }).seat === victim.seat)!.alive).toBe(false);
    for (const a of living) {
      const frames = framesOf(a.sock).slice(from[g.actors.indexOf(a)]!);
      expect(frames.some((m) => m.t === "state" && m.view.phase === "execution")).toBe(true);
      expect(jobLeaks(frames).join("\n")).toBe("");
    }
    const again = await reconnectFrames(g.code, living[0]!);
    expect(again.some((m) => m.t === "state" && m.view.phase === "execution")).toBe(true);
    expect(jobLeaks(again).join("\n")).toBe("");
  });

  it("암살 아침 전환 때 산 사람 소켓 프레임과 직후 재접속 스냅샷에 탈락자의 직업이 없다", { timeout: 60_000 }, async () => {
    const g = await startedGame("night");
    const victim = withRole(g, "citizen")[0]!;
    for (const m of withRole(g, "mafia")) pickAs(m, victim.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    for (const a of g.actors) await settle(a.sock, mark(a.sock));

    expect((await storedRoom(g.code)).players.find((p) => (p as unknown as { seat: number }).seat === victim.seat)!.alive).toBe(false);
    const living = g.actors.filter((a) => a !== victim);
    for (const a of living) {
      const frames = framesOf(a.sock);
      expect(frames.some((m) => m.t === "state" && m.view.phase === "morning")).toBe(true);
      expect(jobLeaks(frames).join("\n")).toBe("");
    }
    const again = await reconnectFrames(g.code, living.find((a) => a.role !== "mafia")!);
    expect(again.some((m) => m.t === "state" && m.view.phase === "morning")).toBe(true);
    expect(jobLeaks(again).join("\n")).toBe("");
  });
});

describe("동점 결선 프레임 전수 (결정 0066-4, L20·L24)", () => {
  it("결선 전 과정의 모든 소켓 프레임: 서버 전용 이름은 없고 새 경로는 RUNOFF_WIRE_PATHS 뿐이며 개인 선택은 본인 me.ballot 에만 있다", { timeout: 90_000 }, async () => {
    const g = await startedGame("nomination");
    const starts = g.socks.map((sock) => mark(sock));
    await pointAll(g.code, g.actors, { 0: 1, 1: 0, 2: 0, 3: 1, 4: 2 });
    const bySeat = Object.fromEntries(g.actors.map((a) => [a.seat, a]));
    await runoffAll(g.code, g.actors, { 2: 0, 3: 1, 4: 0 });
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const wantBallot: Record<number, number | undefined> = { 2: 0, 3: 1, 4: 0 };
    g.actors.forEach((a, i) => {
      const frames = framesOf(a.sock).slice(starts[i]!);
      expect(bySeat[a.seat]).toBe(a);
      for (const msg of frames) {
        for (const path of keyPaths(msg)) {
          const key = path.slice(path.lastIndexOf(".") + 1);
          expect(SERVER_ONLY_KEYS.includes(key) && !ALLOWED_WIRE_PATHS.has(path)).toBe(false);
          if (path.startsWith(".view.day.runoff")) expect(RUNOFF_WIRE_PATHS.has(path)).toBe(true);
          if (key === "ballot") expect(path).toBe(".view.me.ballot");
        }
        if (msg.t !== "state") continue;
        const v = msg.view;
        expect(Object.hasOwn(v.day ?? {}, "runoff")).toBe(v.phase === "runoff");
        if (v.me.ballot !== undefined) {
          expect(v.phase).toBe("runoff");
          expect(v.me.ballot).toBe(wantBallot[a.seat]); // 남의 값이 아니라 본인이 던진 값
        }
        if (v.phase === "runoff") {
          const r = v.day!.runoff!;
          expect(Object.keys(r).sort().join(",")).toBe(r.step === 0 ? "cand,step" : r.step === 1 ? "cand,step,voted" : "cand,step,tally");
        }
      }
      // 던지지 않은 사람(후보·좌석 5)은 어느 프레임에도 me.ballot 이 없다
      if (wantBallot[a.seat] === undefined) {
        expect(frames.some((m) => m.t === "state" && m.view.me.ballot !== undefined)).toBe(false);
      }
    });
  });
});
