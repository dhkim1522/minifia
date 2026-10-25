import { describe, expect, it } from "vitest";
import { say } from "../../shared/game/chat";
import type { SayInput } from "../../shared/game/chat";
import { claimOptions, currentClaimSeat, selectClaim } from "../../shared/game/claim";
import { isAlive } from "../../shared/game/alive";
import { pickTarget } from "../../shared/game/night";
import { CLAIM_TURN_MS, PHASE_DEFS } from "../../shared/game/phases";
import { ROOM_TTL_MS, attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { rolesInPlay } from "../../shared/game/roles";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import type { Claim, ClaimLogEntry, PhaseId, RoomView } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const PLAYER_COUNTS = [4, 5, 6, 7, 8] as const;
const SEEDS = [1, 42, 20260101] as const;
const PHASES: readonly PhaseId[] = [
  "lobby",
  "assigning",
  "roleReveal",
  "dayAnnounce",
  "claim",
  "discussion",
  "night",
  "morning",
];
/** 역할 확인 이후 낮 단계들(본인 역할이 실리는 단계). */
const REVEALING_PHASES = ["roleReveal", "dayAnnounce", "claim", "discussion", "night", "morning"] as const;
const START_AT = 10_000;

/** n 명이 모두 연결된 대기실. id·token 은 서로 부분 문자열이 아니도록 길고 고유하게 만든다. */
function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 단계별 상태를 실제 전이(startGame, tick)로 만든다. 그 단계에 처음 들어간 순간이다(claim 은 첫 차례). 밤 판정에는 시드 난수를 넘긴다. */
function stateAt(phase: PhaseId, n: number, seed: number): RoomState {
  const lobby = lobbyOf(n);
  if (phase === "lobby") return lobby;
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  while (state.phase !== phase) {
    if (state.phaseEndsAt === null) throw new Error(`stateAt ${phase} failed at ${state.phase}`);
    state = tick(state, state.phaseEndsAt, seededRandInt(seed));
  }
  return state;
}

/** 뷰를 깊이 훑어 모든 키 경로를 모은다. 배열 원소는 `[]` 로 접는다. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${prefix}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => {
      const path = prefix === "" ? k : `${prefix}.${k}`;
      return [path, ...keyPaths(v, path)];
    });
  }
  return [];
}

const lastKey = (path: string): string => path.slice(path.lastIndexOf(".") + 1).replace(/\[\]$/, "");

/** 뷰의 모든 문자열 잎을 `경로 → 값` 으로 모은다. 배열 원소는 `[]` 로 접는다. */
function stringLeaves(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v) => stringLeaves(v, `${prefix}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => stringLeaves(v, prefix === "" ? k : `${prefix}.${k}`));
  }
  return [];
}

/** 역할·주장 값으로 쓰이는 문자열. 이 값은 허용 경로에만 나올 수 있다(RESEARCH Pitfall 2). */
const ROLE_LIKE_VALUES: ReadonlySet<string> = new Set(["mafia", "police", "doctor", "citizen", "none"]);
/** 허용 경로: 본인 역할·이번 판 구성·공개된 주장 기록. 그 밖의 경로에 이 값이 있으면 누출이다(채팅은 뷰에 없다, 결정 0017-7). */
const ALLOWED_ROLE_VALUE_PATHS: ReadonlySet<string> = new Set([
  "me.role",
  "day.roles[]",
  "day.claimLog[].claim",
]);

/** 탈락한 viewer 에게만 더해지는 허용 경로(결정 0021): 모든 사람의 실제 직업. */
const SPECTATE_ROLE_VALUE_PATH = "spectate.seats[].job";

function roleValueLeaks(view: RoomView, spectator = false): string[] {
  return stringLeaves(view)
    .filter(
      ([path, value]) =>
        ROLE_LIKE_VALUES.has(value) &&
        !ALLOWED_ROLE_VALUE_PATHS.has(path) &&
        !(spectator && path === SPECTATE_ROLE_VALUE_PATH),
    )
    .map(([path, value]) => `${path}=${value}`);
}

/** view 최상위에 올 수 있는 키(허용 목록). */
const TOP_KEYS: ReadonlySet<string> = new Set([
  "code", "phase", "phaseEndsAt", "phaseDurationMs", "serverNow", "minPlayers", "maxPlayers", "players", "me", "day", "spectate",
]);

/** 그 밤에 살아 있는 각 역할이 지금 고른 대상 seat(중복 없음·오름차순). */
function livePicksOf(s: RoomState, role: "mafia" | "police" | "doctor"): number[] {
  return [
    ...new Set(
      s.players.filter((q) => q.role === role && isAlive(q) && q.nightPick !== undefined).map((q) => q.nightPick as number),
    ),
  ].sort((a, b) => a - b);
}

/**
 * 관전(결정 0021) 규칙 한 곳: 탈락한 본인이고 역할을 싣는 단계에서만 spectate 가 있다.
 * seats 는 모든 사람의 실제 직업({seat, job}, seat 오름차순), picks 는 밤에만 {mafia, police, doctor}.
 * 같은 규칙으로 역할 값 누출도 검사해, 살아 있는 viewer 에게는 spectate 경로 허용이 없다.
 */
function spectateViolations(s: RoomState, viewer: Player, view: RoomView, phase: PhaseId, tag: string): string[] {
  const out: string[] = [];
  const want = !isAlive(viewer) && PHASE_DEFS[phase].revealsOwnRole;
  if (("spectate" in view) !== want) return [`${tag}: spectate presence ${"spectate" in view} want ${want}`];
  if (want && view.spectate) {
    const seats = [...s.players].sort((a, b) => a.seat - b.seat).map((q) => ({ seat: q.seat, job: q.role }));
    if (flat(view.spectate.seats) !== flat(seats)) out.push(`${tag}: spectate.seats ${flat(view.spectate.seats)}`);
    for (const e of view.spectate.seats) if (Object.keys(e).sort().join(",") !== "job,seat") out.push(`${tag}: spectate seat keys`);
    const wantKeys = phase === "night" ? "picks,seats" : "seats";
    if (Object.keys(view.spectate).sort().join(",") !== wantKeys) out.push(`${tag}: spectate keys ${Object.keys(view.spectate).join(",")}`);
    if (phase === "night") {
      const picks = { mafia: livePicksOf(s, "mafia"), police: livePicksOf(s, "police"), doctor: livePicksOf(s, "doctor") };
      if (flat(view.spectate.picks) !== flat(picks)) out.push(`${tag}: spectate.picks ${flat(view.spectate.picks)}`);
    }
  }
  for (const leak of roleValueLeaks(view, want)) out.push(`${tag}: role-like value outside allowed paths: ${leak}`);
  return out;
}

/** 따옴표 없는 한 줄 JSON — 실패 보고(TAP)에 이스케이프된 따옴표가 끼지 않게 한다. */
const flat = (value: unknown): string => (JSON.stringify(value) ?? "undefined").replaceAll('"', "");

const seatId = (state: RoomState, seat: number): string => {
  const p = state.players.find((q) => q.seat === seat);
  if (!p) throw new Error(`no player at seat ${seat}`);
  return p.id;
};

/** 지금 차례인 사람이 claim 을 고른다 — 마감만 당겨질 뿐 아직 다음 차례로 넘어가지 않은(tick 전) 상태다. */
function pickNow(state: RoomState, claim: Claim): RoomState {
  const seat = currentClaimSeat(state);
  if (seat === undefined) throw new Error("pickNow: no claim turn");
  const r = selectClaim(state, seatId(state, seat), claim, state.phaseEndsAt! - 1_000);
  if (!r.ok) throw new Error(`selectClaim failed: ${r.error}`);
  return r.state;
}

/** 지금 차례를 끝낸다(고른 값이 있으면 그 값, 없으면 시간 초과 = 말 안 함). 마감 그대로 한 번 tick. */
const endTurn = (state: RoomState): RoomState => tick(state, state.phaseEndsAt!, seededRandInt(1));

/** 실제 전이(pickTarget)로 밤 행동 한 번을 더한다. */
function actAt(state: RoomState, seat: number, target: number): RoomState {
  const r = pickTarget(state, seatId(state, seat), target);
  if (!r.ok) throw new Error(`pickTarget failed: ${r.error}`);
  return r.state;
}

const seatOfRole = (state: RoomState, role: string, nth = 0): number => {
  const p = state.players.filter((q) => q.role === role).sort((a, b) => a.seat - b.seat)[nth];
  if (!p) throw new Error(`no ${role} #${nth}`);
  return p.seat;
};

/** 마감을 연쇄로 넘겨 목표 단계까지 간다(밤 판정에는 시드 난수를 넘긴다). */
function advanceTo(state: RoomState, phase: PhaseId, seed: number): RoomState {
  let s = state;
  for (let guard = 0; s.phase !== phase; guard += 1) {
    if (s.phaseEndsAt === null || guard > 20) throw new Error(`advanceTo ${phase} failed at ${s.phase}`);
    s = tick(s, s.phaseEndsAt, seededRandInt(seed));
  }
  return s;
}

/** 마피아가 아닌 seat 들(오름차순). */
const nonMafiaSeats = (state: RoomState): number[] =>
  state.players.filter((q) => q.role !== "mafia").map((q) => q.seat).sort((a, b) => a - b);

/** 밤 상태에서 살아 있는 마피아·경찰·의사가 각자 행동한다(실제 pickTarget). 지목 대상은 살아 있는 첫 비마피아다. */
function nightActions(state: RoomState): RoomState {
  const living = state.players.filter(isAlive).sort((a, b) => a.seat - b.seat);
  const target = living.find((p) => p.role !== "mafia")!.seat;
  const mafiaSeat = living.find((p) => p.role === "mafia")!.seat;
  let s = state;
  for (const p of living) {
    if (p.role === "mafia") s = actAt(s, p.seat, target);
    else if (p.role === "police") s = actAt(s, p.seat, living[0]!.seat);
    else if (p.role === "doctor") s = actAt(s, p.seat, p.seat !== target ? p.seat : mafiaSeat);
  }
  return s;
}

/** 실제 전이(say)로 메시지 한 줄을 더한다. */
function speak(state: RoomState, seat: number, input: SayInput, now: number): RoomState {
  const r = say(state, seatId(state, seat), input, now);
  if (!r.ok) throw new Error(`say failed: ${r.error}`);
  return r.state;
}

// 낮 1일차 시각(stateAt 의 연쇄와 같다, 전원 생존): dayAnnounce 시작 = 역할 확인 마감, 이후 +2000, 차례 n 개 × 8000 뒤가 토론 시작.
const DAY1_START = START_AT + 3_000 + 15_000;
const discussionStartsAt = (n: number): number => DAY1_START + 2_000 + n * CLAIM_TURN_MS;

/** richStateAt 의 1일차 주장 규칙: seat%3===2 는 말을 안 하고(시간 초과), 나머지는 (seat+seed) 번째 선택지를 일찍 고른다. */
function claimFor(n: number, seed: number, seat: number): Claim | undefined {
  const opts = claimOptions(n);
  return seat % 3 === 2 ? undefined : opts[(seat + seed) % opts.length]!;
}
/** richStateAt 이 만드는 1일차 공개 기록. */
function richClaimLog(n: number, seed: number): ClaimLogEntry[] {
  return Array.from({ length: n }, (_, seat) => ({ n: 1, seat, claim: claimFor(n, seed, seat) ?? "none" }));
}

/**
 * 낮 단계는 서로 다른 선택·메시지가 있는 상태를 실제 전이(selectClaim·tick·say)로 만든다 — 손으로 필드를 채우지 않는다.
 * claim: 차례 세 개(seat 0·1·2)가 끝난 뒤 네 번째 차례(seat 3)가 골랐지만 아직 끝나지 않은 순간 — 끝나지 않은 선택이 상태에 있는 때다.
 * discussion: 모든 차례를 위 규칙으로 마친 뒤, 메시지 3줄(그중 claimed 1줄). 낮이 아닌 단계는 stateAt 그대로다.
 * night·morning: 그 토론 뒤 밤 행동과 아침.
 */
function richStateAt(phase: PhaseId, n: number, seed: number): RoomState {
  if (phase === "night" || phase === "morning") {
    // 밤: 마피아 → 가장 작은 살아 있는 비마피아 seat, 경찰 → 살아 있는 첫 seat, 의사 → 자신(지목된 사람이면 마피아). 아침은 그 밤 뒤(한 명 탈락).
    const d = richStateAt("discussion", n, seed);
    const s = nightActions(tick(d, d.phaseEndsAt!));
    if (phase === "night") return s;
    return tick(s, s.phaseEndsAt!, seededRandInt(seed));
  }
  if (phase !== "claim" && phase !== "discussion") return stateAt(phase, n, seed);
  let s = stateAt("claim", n, seed);
  const playTurn = (): void => {
    const c = claimFor(n, seed, currentClaimSeat(s)!);
    if (c !== undefined) s = pickNow(s, c);
    s = endTurn(s);
  };
  if (phase === "claim") {
    for (let i = 0; i < 3; i += 1) playTurn();
    const pending = claimFor(n, seed, currentClaimSeat(s)!);
    return pending === undefined ? s : pickNow(s, pending);
  }
  while (s.phase === "claim") playTurn();
  const at = discussionStartsAt(n);
  s = speak(s, 0, { template: "suspect", target: 1 }, at + 1_000);
  s = speak(s, 1, { template: "claimed", target: 2, claimedRole: rolesInPlay(n)[0]! }, at + 4_000);
  return speak(s, 2, { template: "trust", target: 0 }, at + 7_000);
}

/** n명 판 1일차 밤: 마피아가 첫 비마피아 X 를 지목해 아침이 된 상태(의사는 보호하지 않는다 — 4명 판은 의사가 없다). */
function morningWithVictim(n: number, seed: number) {
  const s0 = stateAt("night", n, seed);
  const x = nonMafiaSeats(s0)[0]!;
  const picked = actAt(s0, seatOfRole(s0, "mafia"), x);
  return { s: tick(picked, picked.phaseEndsAt!, seededRandInt(seed)), x };
}

function mafiaSeatsOtherThan(state: RoomState, p: Player): number[] {
  return state.players
    .filter((q) => q.role === "mafia" && q.id !== p.id)
    .map((q) => q.seat)
    .sort((a, b) => a - b);
}

describe("buildView 단계 길이 (D-15, 결정 0012)", () => {
  it("phaseDurationMs 는 단계 표 길이를 그대로 보내고, phaseEndsAt·serverNow 는 상태·now 그대로다", () => {
    const got = PHASES.map((phase) => {
      const s = stateAt(phase, 4, 1);
      const v = buildView(s, s.hostId, 77_777);
      return `${phase}:${v.phaseDurationMs}:${v.phaseEndsAt === s.phaseEndsAt}:${v.serverNow}`;
    });
    expect(got.join(" ")).toBe(
      "lobby:null:true:77777 assigning:3000:true:77777 roleReveal:15000:true:77777 dayAnnounce:2000:true:77777 claim:8000:true:77777 discussion:90000:true:77777 night:30000:true:77777 morning:5000:true:77777",
    );
  });

  it("마감은 이전 마감 + 단계 길이로 이어진다: assigning +3000, roleReveal +15000, dayAnnounce +2000, claim 첫 차례 +8000, 차례 4개 뒤 discussion +90000", () => {
    const a = stateAt("assigning", 4, 1);
    const r = stateAt("roleReveal", 4, 1);
    const ends = ["assigning", "roleReveal", "dayAnnounce", "claim", "discussion", "night", "morning"].map(
      (phase) => stateAt(phase as PhaseId, 4, 1).phaseEndsAt,
    );
    // claim 은 첫 차례의 마감(20000 + 8000), discussion 은 네 차례가 끝난 뒤(20000 + 4 × 8000 + 90000)
    expect(ends.join("/")).toBe(
      [START_AT + 3000, START_AT + 18000, START_AT + 20000, START_AT + 28000, START_AT + 142000, START_AT + 172000, START_AT + 177000].join("/"),
    );
    expect(r.phaseEndsAt).toBe(START_AT + 18000);
    expect(a.expiresAt).toBe(START_AT + ROOM_TTL_MS);
  });
});

describe("buildView 내 역할·마피아 동료 (ROLE-02, D-14)", () => {
  it("lobby·assigning 에서는 me.role·me.allies 가 없다", () => {
    const bad: string[] = [];
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of ["lobby", "assigning"] as const) {
          const s = stateAt(phase, n, seed);
          for (const p of s.players) {
            const me = buildView(s, p.id, START_AT).me;
            if ("role" in me || "allies" in me) bad.push(`${phase}/${n}/${seed}/seat${p.seat}`);
          }
        }
      }
    }
    expect(bad.join(",")).toBe("");
  });

  it("역할을 보여 주는 모든 단계(roleReveal·낮 네 단계)에서 me.role 은 본인 역할이다", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of REVEALING_PHASES) {
          const s = stateAt(phase, n, seed);
          for (const p of s.players) {
            checked += 1;
            const role = buildView(s, p.id, START_AT).me.role;
            if (role !== p.role) bad.push(`${phase}/${n}/${seed}/seat${p.seat}:${role}!=${p.role}`);
          }
        }
      }
    }
    expect(checked > 0).toBe(true);
    expect(bad.join(",")).toBe("");
  });

  it("마피아에게만 me.allies(다른 마피아 seat 오름차순)가 가고, 혼자면 빈 배열이다", () => {
    const bad: string[] = [];
    let mafiaChecks = 0;
    let soloChecks = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of REVEALING_PHASES) {
          const s = stateAt(phase, n, seed);
          for (const p of s.players) {
            const me = buildView(s, p.id, START_AT).me;
            if (p.role === "mafia") {
              mafiaChecks += 1;
              const want = mafiaSeatsOtherThan(s, p);
              if (want.length === 0) soloChecks += 1;
              if (JSON.stringify(me.allies) !== JSON.stringify(want)) {
                bad.push(`${phase}/${n}/${seed}/seat${p.seat}:${JSON.stringify(me.allies)}!=${JSON.stringify(want)}`);
              }
            } else if ("allies" in me) {
              bad.push(`${phase}/${n}/${seed}/seat${p.seat}:non-mafia has allies`);
            }
          }
        }
      }
    }
    expect(mafiaChecks > 0).toBe(true);
    expect(soloChecks > 0).toBe(true); // 4·5명(마피아 1명) 조합이 실제로 검사됐다
    expect(bad.join(",")).toBe("");
  });
});

describe("buildView 전수 누출 검사 (T-01-23)", () => {
  it("4~8명 × 여덟 단계 × 모든 플레이어 × 시드 3개: token·id 가 없고, role·allies 키는 me 아래에만 있으며, 공개 항목은 다섯 키뿐이다", () => {
    const violations: string[] = [];
    let views = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of PHASES) {
          const s = richStateAt(phase, n, seed);
          for (const viewer of s.players) {
            views += 1;
            const tag = `${n}/${seed}/${phase}/seat${viewer.seat}`;
            const view = buildView(s, viewer.id, START_AT);
            const text = JSON.stringify(view);
            for (const q of s.players) {
              if (text.includes(q.token)) violations.push(`${tag}: token of seat${q.seat}`);
              if (text.includes(q.id)) violations.push(`${tag}: id of seat${q.seat}`);
              if (q.connId !== null && text.includes(q.connId)) violations.push(`${tag}: connId of seat${q.seat}`);
            }
            for (const path of keyPaths(view)) {
              const key = lastKey(path);
              if (key === "role" && path !== "me.role") violations.push(`${tag}: role at ${path}`);
              if (key === "allies" && path !== "me.allies") violations.push(`${tag}: allies at ${path}`);
            }
            for (const entry of view.players) {
              const keys = Object.keys(entry).sort().join(",");
              if (keys !== "alive,connected,isHost,nickname,seat") violations.push(`${tag}: players[] keys ${keys}`);
            }
            // 서버 전용 필드 이름은 어느 경로에도 없다
            for (const path of keyPaths(view)) {
              if (
                [
                  "claimLast", "lastSendAt", "claimChoice", "claimShown", "claimChanged", "claimPick", "claimOrder", "claimIdx",
                  "claimStart", "claimDone", "claims", "nightPick", "investigations", "lastPhrase", "nextNightSeq",
                ].includes(lastKey(path))
              ) {
                violations.push(`${tag}: server-only key at ${path}`);
              }
            }
            // 최상위 키는 허용 목록뿐이다
            for (const key of Object.keys(view)) {
              if (!TOP_KEYS.has(key)) violations.push(`${tag}: top-level key ${key}`);
            }
            // 밤 필드는 받을 사람에게만: pick 은 밤·생존 본인, allyPicks 는 밤·생존 마피아, records 는 경찰 본인(역할 공개 단계 전체)
            for (const path of keyPaths(view)) {
              if (["pick", "allyPicks", "records"].includes(lastKey(path)) && !path.startsWith("me.")) {
                violations.push(`${tag}: night field outside me at ${path}`);
              }
            }
            const isNight = phase === "night";
            const wantPick = isNight && isAlive(viewer) && viewer.nightPick !== undefined;
            if ("pick" in view.me !== wantPick) violations.push(`${tag}: me.pick presence ${"pick" in view.me}`);
            else if (wantPick && view.me.pick !== viewer.nightPick) violations.push(`${tag}: me.pick value`);
            const wantAlly = isNight && isAlive(viewer) && viewer.role === "mafia";
            if ("allyPicks" in view.me !== wantAlly) violations.push(`${tag}: me.allyPicks presence ${"allyPicks" in view.me}`);
            else if (wantAlly) {
              const want = [
                ...new Set(
                  s.players
                    .filter((q) => q.role === "mafia" && q.id !== viewer.id && isAlive(q) && q.nightPick !== undefined)
                    .map((q) => q.nightPick as number),
                ),
              ].sort((a, b) => a - b);
              if (flat(view.me.allyPicks) !== flat(want)) violations.push(`${tag}: me.allyPicks value ${flat(view.me.allyPicks)}`);
            }
            const wantRecords = viewer.role === "police" && PHASE_DEFS[phase].revealsOwnRole;
            if ("records" in view.me !== wantRecords) violations.push(`${tag}: me.records presence ${"records" in view.me}`);
            else if (wantRecords) {
              for (const r of view.me.records ?? []) {
                const keys = Object.keys(r).sort().join(",");
                if (keys !== "isMafia,n,target") violations.push(`${tag}: records keys ${keys}`);
              }
            }
            if ("morning" in (view.day ?? {}) !== (phase === "morning")) violations.push(`${tag}: day.morning presence`);
            // me 에는 어느 단계에서도 claim 키가 없다(내 주장 키 폐지). day.turn 은 claim 단계에만 있고 seat 한 키뿐이다.
            if ("claim" in view.me) violations.push(`${tag}: claim key in me`);
            const hasTurn = "turn" in (view.day ?? {});
            if (hasTurn !== (phase === "claim")) violations.push(`${tag}: day.turn presence ${hasTurn}`);
            else if (hasTurn) {
              if (flat(view.day?.turn) !== flat({ seat: currentClaimSeat(s) })) violations.push(`${tag}: day.turn ${flat(view.day?.turn)}`);
            }
            // claimLog 는 공개 기록 그대로이고 줄마다 n,seat,claim 세 키뿐이다
            if (view.day !== undefined) {
              if (flat(view.day.claimLog) !== flat(s.claimLog ?? [])) violations.push(`${tag}: day.claimLog ${flat(view.day.claimLog)}`);
              for (const e of view.day.claimLog) {
                if (Object.keys(e).sort().join(",") !== "claim,n,seat") violations.push(`${tag}: claimLog entry keys`);
              }
            }
            // 역할·주장 값은 허용 경로(me.role, day.roles[], day.claimLog[].claim)에만 있다
            violations.push(...spectateViolations(s, viewer, view, phase, tag));
          }
        }
      }
    }
    expect(views).toBe(3 * 8 * (4 + 5 + 6 + 7 + 8));
    expect(violations.join("; ")).toBe("");
  });
});

describe("buildView 낮 뷰 — 한 명씩 주장(claim): 지금 차례와 공개 기록만 (D-01, D-05, D-19, T-03.1-01)", () => {
  const ROLES_5 = ["mafia", "police", "doctor", "citizen"];

  it("5명 claim 단계: 모든 viewer 의 day 키가 정확히 claimLog,n,roles,turn 이고 turn.seat 는 모두 같다; claimLog []; me 에 claim 키 없음; phaseDurationMs 8000", () => {
    const s = stateAt("claim", 5, 1);
    const want = flat({ n: 1, roles: ROLES_5, claimLog: [], turn: { seat: 0 } });
    const got = s.players.map((viewer) => {
      const view = buildView(s, viewer.id, START_AT);
      const keys = Object.keys(view.day ?? {}).sort().join(",");
      return `seat${viewer.seat}:${keys}:${"claim" in view.me}:${view.phaseDurationMs}:${flat(view.day)}`;
    });
    expect(got.join(" ")).toBe(s.players.map((viewer) => `seat${viewer.seat}:claimLog,n,roles,turn:false:8000:${want}`).join(" "));
  });

  it("방장 차례가 끝난 뒤(selectClaim + tick): 모든 viewer 의 claimLog 가 같고 줄은 {n, seat, claim} 세 키뿐이며 turn.seat 가 다음 자리로 바뀐다", () => {
    const s = endTurn(pickNow(stateAt("claim", 5, 1), "police"));
    const views = s.players.map((viewer) => buildView(s, viewer.id, START_AT));
    expect(new Set(views.map((v) => flat(v.day))).size).toBe(1);
    const day = views[0]!.day!;
    expect(flat(day.claimLog)).toBe(flat([{ n: 1, seat: 0, claim: "police" }]));
    expect(Object.keys(day.claimLog[0]!).sort().join(",")).toBe("claim,n,seat");
    expect(flat(day.turn)).toBe(flat({ seat: 1 }));
  });

  it("끝나지 않은 차례의 선택은 어디에도 없다: 고른 직후(tick 전) 상태의 모든 viewer view 는 고르기 전과 마감 시각만 다르고 값 문자열은 허용 경로에만 나온다 (4~8명 × 시드 3)", () => {
    const bad: string[] = [];
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        const before = stateAt("claim", n, seed);
        const after = pickNow(before, "police");
        expect(after.claimPick).toBe("police"); // 선택이 서버 상태에는 있다
        for (const viewer of after.players) {
          const tag = `${n}/${seed}/seat${viewer.seat}`;
          const b = buildView(before, viewer.id, START_AT);
          const a = buildView(after, viewer.id, START_AT);
          if (flat({ ...a, phaseEndsAt: 0 }) !== flat({ ...b, phaseEndsAt: 0 })) bad.push(`${tag}: view changed by pending pick`);
          if (flat(a.day?.turn) !== flat({ seat: 0 })) bad.push(`${tag}: turn ${flat(a.day?.turn)}`);
          if (Object.keys(a.day?.turn ?? {}).join(",") !== "seat") bad.push(`${tag}: turn keys`);
          for (const [path, value] of stringLeaves(a)) {
            if (value === "police" && !["me.role", "day.roles[]"].includes(path)) bad.push(`${tag}: ${path}=${value}`);
          }
          bad.push(...roleValueLeaks(a).map((leak) => `${tag}: ${leak}`));
        }
      }
    }
    expect(bad.join("; ")).toBe("");
  });

  it("lobby·assigning·roleReveal 뷰에는 day 키와 me 의 claim 키가 없다", () => {
    const bad: string[] = [];
    for (const phase of ["lobby", "assigning", "roleReveal"] as const) {
      const s = stateAt(phase, 5, 1);
      for (const p of s.players) {
        const view = buildView(s, p.id, START_AT);
        if ("day" in view || "claim" in view.me) bad.push(`${phase}/seat${p.seat}`);
      }
    }
    expect(bad.join(",")).toBe("");
  });

  it("dayAnnounce·discussion·night·morning 의 day 키는 claimLog,n,roles(morning 은 + morning)이고 turn 키가 없다", () => {
    const got: string[] = [];
    for (const phase of ["dayAnnounce", "discussion", "night", "morning"] as const) {
      const s = richStateAt(phase, 5, 1);
      const keys = new Set(s.players.map((p) => Object.keys(buildView(s, p.id, START_AT).day ?? {}).sort().join(",")));
      got.push(`${phase}:${[...keys].join("|")}`);
    }
    expect(got.join(" ")).toBe("dayAnnounce:claimLog,n,roles discussion:claimLog,n,roles night:claimLog,n,roles morning:claimLog,morning,n,roles");
  });

  it("dayAnnounce 뷰의 day 는 {n, roles, claimLog []} 뿐이다", () => {
    const s = stateAt("dayAnnounce", 5, 1);
    for (const p of s.players) {
      expect(flat(buildView(s, p.id, START_AT).day)).toBe(flat({ n: 1, roles: rolesInPlay(5), claimLog: [] }));
    }
  });

  it("차례가 진행되면 claimLog 가 한 줄씩 쌓이고 모든 viewer 에게 같다 (일부만 끝난 상태)", () => {
    const s = richStateAt("claim", 6, 42);
    const want = richClaimLog(6, 42).slice(0, 3);
    const got = s.players.map((p) => flat(buildView(s, p.id, START_AT).day?.claimLog));
    expect(got.join(" ")).toBe(Array(6).fill(flat(want)).join(" "));
    expect(flat(buildView(s, s.hostId, START_AT).day?.turn)).toBe(flat({ seat: 3 }));
  });
});

describe("buildView 낮 뷰 — 토론·이튿날 (D-02, D-05, D-15)", () => {
  it("discussion: claimLog 는 그날 모든 차례의 공개 기록이고 모든 viewer 에게 같다; me 에 claim 키·day 에 turn 키가 없다", () => {
    const bad: string[] = [];
    const s = richStateAt("discussion", 6, 42);
    const want = richClaimLog(6, 42);
    for (const p of s.players) {
      const view = buildView(s, p.id, START_AT);
      if (flat(view.day?.claimLog) !== flat(want)) bad.push(`seat${p.seat}:${flat(view.day?.claimLog)}`);
      if ("claim" in view.me) bad.push(`seat${p.seat}: claim key in me`);
      if ("turn" in (view.day ?? {})) bad.push(`seat${p.seat}: turn`);
    }
    expect(bad.join(" ")).toBe("");
  });

  it("일차 2: claimLog 에 1일차 줄과 2일차 줄이 쌓이고, 2일차 줄은 어제 값이 아니라 그날의 값이다 (이월 없음); 순서는 (일차, 차례 순서)", () => {
    let s = richStateAt("discussion", 5, 1);
    s = advanceTo(s, "claim", 1); // 밤·아침을 지나 2일차 claim
    expect(s.day).toBe(2);
    s = pickNow(s, "citizen"); // 2일차 첫 차례(seat 1)만 고른다
    while (s.phase === "claim") s = endTurn(s);
    const log = buildView(s, s.hostId, START_AT).day!.claimLog;
    expect(log.map((e) => `${e.n}:${e.seat}:${e.claim}`).join(" ")).toBe(
      [
        ...richClaimLog(5, 1).map((e) => `${e.n}:${e.seat}:${e.claim}`),
        "2:1:citizen", "2:2:none", "2:3:none", "2:4:none", "2:0:none",
      ].join(" "),
    );
    // 1일차에 seat 0 이 한 주장은 2일차 seat 0 줄에 새지 않는다
    expect(log.filter((e) => e.seat === 0).map((e) => `${e.n}:${e.claim}`).join(" ")).toBe(`1:${claimFor(5, 1, 0) ?? "none"} 2:none`);
  });

  it("탈락자 X 는 그날(2일차) claimLog 에 줄이 없다 — 차례 순서에 들지 않았으므로", () => {
    const { s: morning, x } = morningWithVictim(5, 1);
    let s = advanceTo(morning, "claim", 1);
    while (s.phase === "claim") s = endTurn(s);
    const day2 = buildView(s, s.hostId, START_AT).day!.claimLog.filter((e) => e.n === 2);
    expect(day2.map((e) => e.seat).join(",")).toBe([1, 2, 3, 4, 0].filter((seat) => seat !== x).join(","));
    expect(day2.some((e) => e.seat === x)).toBe(false);
  });

  it("claimLog 가 없는 옛 방도 claimLog [] 로 뷰가 만들어진다", () => {
    const s = stateAt("discussion", 5, 1);
    const { claimLog: _drop, ...rest } = s;
    const old: RoomState = rest;
    expect(flat(buildView(old, seatId(old, 0), START_AT).day?.claimLog)).toBe("[]");
  });

  it("discussion: 여러 번 say 한 뒤에도 day 의 키는 claimLog,n,roles 이고 messages·extendUsed 키가 없다 (결정 0017-5·0017-7)", () => {
    let s = stateAt("discussion", 5, 1);
    const at = discussionStartsAt(5);
    s = speak(s, 0, { template: "suspect", target: 1 }, at + 1_000);
    s = speak(s, 1, { template: "innocent" }, at + 4_000);
    s = speak(s, 2, { template: "claimed", target: 3, claimedRole: "police" }, at + 7_000);
    for (const viewer of s.players) {
      const view = buildView(s, viewer.id, START_AT);
      expect(Object.keys(view.day ?? {}).sort().join(",")).toBe("claimLog,n,roles");
      expect(roleValueLeaks(view).join(";")).toBe("");
    }
  });

  it("discussion phaseDurationMs 는 90000 이다(옛 상태의 연장 표시와 무관); claim 은 차례 하나의 8000", () => {
    const s = stateAt("discussion", 4, 1);
    const old = { ...s, extendUsed: true } as RoomState; // 옛 저장 방: 키로만 넣는다(타입 선언에 기대지 않는다)
    expect(buildView(s, s.hostId, START_AT).phaseDurationMs).toBe(90_000);
    expect(buildView(old, s.hostId, START_AT).phaseDurationMs).toBe(90_000);
    expect(buildView(stateAt("claim", 4, 1), s.hostId, START_AT).phaseDurationMs).toBe(8000);
  });
});

describe("buildView 밤 — 생존·본인 선택 (ELIM-01, D-06)", () => {
  it("night view: day 의 키는 claimLog,n,roles 이고 players[] 키는 alive,connected,isHost,nickname,seat, 모두 alive true", () => {
    const s = stateAt("night", 5, 1);
    const dayKeys = s.players.map((p) => Object.keys(buildView(s, p.id, START_AT).day ?? {}).sort().join(","));
    expect(`[${dayKeys.join(" ")}]`).toBe("[claimLog,n,roles claimLog,n,roles claimLog,n,roles claimLog,n,roles claimLog,n,roles]");
    const got = s.players.map((p) => {
      const v = buildView(s, p.id, START_AT);
      return v.players.map((e) => `${Object.keys(e).sort().join(",")}:${String(e.alive)}`).join("|");
    });
    const one = Array(5).fill("alive,connected,isHost,nickname,seat:true").join("|");
    expect(got.join(" ")).toBe(Array(5).fill(one).join(" "));
  });

  it("5명 판 경찰이 seat X 를 고른 뒤: 경찰 view 의 me.pick === X, 다른 네 사람 view 의 me 에는 pick 키가 없다", () => {
    let s = stateAt("night", 5, 1);
    const police = seatOfRole(s, "police");
    const x = police === 0 ? 1 : 0;
    s = actAt(s, police, x);
    const got = s.players.map((p) => {
      const me = buildView(s, p.id, START_AT).me;
      return `${p.seat}:${"pick" in me ? String(me.pick) : "-"}`;
    });
    expect(got.join(" ")).toBe(s.players.map((p) => `${p.seat}:${p.seat === police ? x : "-"}`).join(" "));
  });

  it("탈락자(아침 뒤 상태)는 모든 viewer 의 players[] 에서 alive false 다", () => {
    let s = stateAt("night", 5, 1);
    const victim = seatOfRole(s, "citizen");
    s = actAt(s, seatOfRole(s, "mafia"), victim);
    s = tick(s, s.phaseEndsAt!, seededRandInt(1));
    expect(s.phase).toBe("morning");
    const got = s.players.map((p) => {
      const v = buildView(s, p.id, START_AT);
      return v.players.map((e) => `${e.seat}:${String(e.alive)}`).join(",");
    });
    const want = s.players.map((q) => q.seat).map((seat) => `${seat}:${String(seat !== victim)}`).join(",");
    expect(got.join(" ")).toBe(Array(5).fill(want).join(" "));
  });

  it("lobby view 의 players[] 도 alive 키가 있다(true)", () => {
    const s = stateAt("lobby", 4, 1);
    const got = buildView(s, s.hostId, START_AT).players.map((e) => String(e.alive));
    expect(got.join(",")).toBe("true,true,true,true");
  });
});

describe("buildView 밤 — 동료 선택 (D-07)", () => {
  /** 6명 판 1일차 밤. 마피아 A<B, 비마피아 X<Y 를 함께 돌려준다. */
  function night6(seed: number) {
    const s = stateAt("night", 6, seed);
    const [a, b] = [seatOfRole(s, "mafia", 0), seatOfRole(s, "mafia", 1)];
    const [x, y] = nonMafiaSeats(s);
    return { s, a, b, x: x!, y: y! };
  }
  const meOf = (s: RoomState, seat: number) => buildView(s, seatId(s, seat), START_AT).me;

  it("마피아 A 가 X 를 고르면 A: pick X·allyPicks [], B: allyPicks [X]·pick 키 없음", () => {
    const { s: s0, a, b, x } = night6(1);
    const s = actAt(s0, a, x);
    const ma = meOf(s, a);
    const mb = meOf(s, b);
    expect(`pick=${ma.pick} ally=${flat(ma.allyPicks)}`).toBe(`pick=${x} ally=[]`);
    expect(`pick=${"pick" in mb ? mb.pick : "-"} ally=${flat(mb.allyPicks)}`).toBe(`pick=- ally=[${x}]`);
  });

  it("둘 다 X 면 서로 allyPicks [X](중복 없음), A 는 X·B 는 Y(X<Y) 면 A 는 [Y], B 는 [X]", () => {
    const { s: s0, a, b, x, y } = night6(1);
    const same = actAt(actAt(s0, a, x), b, x);
    expect(`${flat(meOf(same, a).allyPicks)} ${flat(meOf(same, b).allyPicks)}`).toBe(`[${x}] [${x}]`);
    const split = actAt(actAt(s0, a, x), b, y);
    expect(`${flat(meOf(split, a).allyPicks)} ${flat(meOf(split, b).allyPicks)}`).toBe(`[${y}] [${x}]`);
  });

  it("비마피아 view 의 me 에는 allyPicks 키가 없다(마피아가 골랐어도). 혼자인 마피아(5명 판)는 night 에서 allyPicks [] (키 있음)", () => {
    const { s: s0, a, x } = night6(1);
    const s = actAt(s0, a, x);
    const bad = s.players.filter((p) => p.role !== "mafia").filter((p) => "allyPicks" in meOf(s, p.seat)).map((p) => p.seat);
    expect(`[${bad.join(",")}]`).toBe("[]");
    const solo = stateAt("night", 5, 1);
    const m = meOf(solo, seatOfRole(solo, "mafia"));
    expect(`${"allyPicks" in m} ${flat(m.allyPicks)}`).toBe("true []");
  });

  it("탈락한 마피아 view: allies 는 있고 allyPicks·pick 키는 없다. 살아 있는 동료 allyPicks 에 탈락자의 값은 들지 않는다 (A3)", () => {
    const { s: s0, a, b, x } = night6(1);
    const s: RoomState = {
      ...s0,
      players: s0.players.map((p) => (p.seat === b ? { ...p, alive: false, nightPick: x } : p)),
    };
    const mb = meOf(s, b);
    expect(`allies=${flat(mb.allies)} ally=${"allyPicks" in mb} pick=${"pick" in mb}`).toBe(`allies=[${a}] ally=false pick=false`);
    expect(flat(meOf(s, a).allyPicks)).toBe("[]");
  });

  it("night 가 아닌 단계에는 어떤 viewer 에도 pick·allyPicks 키가 없다(남은 nightPick 이 있어도)", () => {
    const bad: string[] = [];
    for (const phase of ["roleReveal", "dayAnnounce", "claim", "discussion", "morning"] as const) {
      const base = stateAt(phase, 6, 1);
      const s: RoomState = { ...base, players: base.players.map((p) => ({ ...p, nightPick: 0 })) };
      for (const p of s.players) {
        const me = meOf(s, p.seat);
        if ("pick" in me || "allyPicks" in me) bad.push(`${phase}/seat${p.seat}`);
      }
    }
    expect(`[${bad.join(",")}]`).toBe("[]");
  });
});

describe("buildView 수사 기록 (D-09·D-11)", () => {
  const recordsOf = (s: RoomState, seat: number) => buildView(s, seatId(s, seat), START_AT).me.records;

  it("경찰 view 는 roleReveal 부터 records 가 있고 첫 밤 동안은 [], 아침부터 [{n:1, target, isMafia}](키 정확히 isMafia,n,target)", () => {
    const early = stateAt("roleReveal", 5, 1);
    expect(flat(recordsOf(early, seatOfRole(early, "police")))).toBe("[]");
    let s = stateAt("night", 5, 1);
    const police = seatOfRole(s, "police");
    const mafia = seatOfRole(s, "mafia");
    s = actAt(s, police, mafia);
    expect(flat(recordsOf(s, police))).toBe("[]");
    s = tick(s, s.phaseEndsAt!, seededRandInt(1));
    const got = recordsOf(s, police) ?? [];
    expect(flat(got)).toBe(flat([{ n: 1, target: mafia, isMafia: true }]));
    expect(Object.keys(got[0] ?? {}).sort().join(",")).toBe("isMafia,n,target");
  });

  it("2일차 밤 뒤에는 두 개(n 1, 2 순서)다", () => {
    let s = stateAt("night", 5, 1);
    const police = seatOfRole(s, "police");
    const citizen = seatOfRole(s, "citizen");
    const mafia = seatOfRole(s, "mafia");
    s = actAt(s, police, citizen);
    s = advanceTo(advanceTo(s, "morning", 1), "dayAnnounce", 1); // 1일차 아침을 지나 2일차 낮
    s = advanceTo(s, "night", 1); // 2일차 밤
    s = actAt(s, police, mafia);
    s = advanceTo(s, "morning", 1);
    expect(flat(recordsOf(s, police))).toBe(
      flat([{ n: 1, target: citizen, isMafia: false }, { n: 2, target: mafia, isMafia: true }]),
    );
  });

  it("탈락한 경찰도 records 를 받는다", () => {
    let s = stateAt("night", 5, 1);
    const police = seatOfRole(s, "police");
    const mafia = seatOfRole(s, "mafia");
    s = actAt(actAt(s, police, mafia), mafia, police); // 동시 해결: 조사는 적용되고 경찰은 탈락
    s = tick(s, s.phaseEndsAt!, seededRandInt(1));
    const v = buildView(s, seatId(s, police), START_AT);
    expect(`${String(v.players.find((p) => p.seat === police)?.alive)} ${flat(v.me.records)}`).toBe(
      `false ${flat([{ n: 1, target: mafia, isMafia: true }])}`,
    );
  });

  it("경찰이 아닌 view 에는 어떤 단계에서도 records 키가 없다", () => {
    const bad: string[] = [];
    for (const phase of PHASES) {
      const s = richStateAt(phase, 6, 42);
      for (const p of s.players) {
        if (p.role !== "police" && "records" in buildView(s, p.id, START_AT).me) bad.push(`${phase}/seat${p.seat}`);
      }
    }
    expect(`[${bad.join(",")}]`).toBe("[]");
  });
});

describe("buildView 아침 결과 (NIGHT-06·D-13)", () => {
  const morningsOf = (s: RoomState): string[] => s.players.map((p) => flat(buildView(s, p.id, START_AT).day?.morning));
  const toMorning = (s: RoomState): RoomState => tick(s, s.phaseEndsAt!, seededRandInt(1));

  it("마피아가 시민 X 지목 → 모든 viewer 의 day.morning 이 같은 {eliminated: X, phrase: 1..8}", () => {
    const s0 = stateAt("night", 5, 1);
    const x = seatOfRole(s0, "citizen");
    const s = toMorning(actAt(s0, seatOfRole(s0, "mafia"), x));
    const got = morningsOf(s);
    expect(new Set(got).size).toBe(1);
    const m = buildView(s, s.hostId, START_AT).day?.morning ?? {};
    expect(`${Object.keys(m).sort().join(",")} ${m.eliminated} ${(m.phrase ?? 0) >= 1 && (m.phrase ?? 0) <= 8}`).toBe(`eliminated,phrase ${x} true`);
  });

  it("의사가 X 를 지킴 → {}, 아무도 안 고름 → {}", () => {
    const s0 = stateAt("night", 5, 1);
    const x = seatOfRole(s0, "citizen");
    const saved = toMorning(actAt(actAt(s0, seatOfRole(s0, "mafia"), x), seatOfRole(s0, "doctor"), x));
    expect(`${morningsOf(saved).join(" ")}`).toBe(Array(5).fill("{}").join(" "));
    const quiet = toMorning(s0);
    expect(`${morningsOf(quiet).join(" ")}`).toBe(Array(5).fill("{}").join(" "));
  });

  it("morning 이 아닌 단계(다음 dayAnnounce 포함)에는 day.morning 키가 없다", () => {
    let s = stateAt("night", 5, 1);
    const bad: string[] = [];
    const check = (tag: string) => {
      for (const p of s.players) if ("morning" in (buildView(s, p.id, START_AT).day ?? {})) bad.push(`${tag}/seat${p.seat}`);
    };
    check("night");
    s = advanceTo(s, "morning", 1);
    s = advanceTo(s, "dayAnnounce", 1);
    check("dayAnnounce");
    s = advanceTo(s, "discussion", 1);
    check("discussion");
    expect(`[${bad.join(",")}]`).toBe("[]");
  });
});

describe("buildView 밤·아침 주장 줄 (C6)", () => {
  it("night·morning 의 day.claimLog 는 그날 discussion 의 claimLog 와 같고, dayAnnounce 에는 빈 기록, claim 은 지금까지 끝난 차례만 실린다", () => {
    const disc = richStateAt("discussion", 6, 42);
    const want = flat(buildView(disc, disc.hostId, START_AT).day?.claimLog);
    const night = tick(disc, disc.phaseEndsAt!);
    const morning = tick(night, night.phaseEndsAt!, seededRandInt(1));
    expect(`${flat(buildView(night, night.hostId, START_AT).day?.claimLog) === want} ${flat(buildView(morning, morning.hostId, START_AT).day?.claimLog) === want} ${want.length > 10}`).toBe(
      "true true true",
    );
    const announce = richStateAt("dayAnnounce", 6, 42);
    const claim = richStateAt("claim", 6, 42);
    expect(announce.players.map((p) => flat(buildView(announce, p.id, START_AT).day?.claimLog)).join(" ")).toBe(Array(6).fill("[]").join(" "));
    expect(claim.players.map((p) => flat(buildView(claim, p.id, START_AT).day?.claimLog)).join(" ")).toBe(
      Array(6).fill(flat(richClaimLog(6, 42).slice(0, 3))).join(" "),
    );
  });
});

describe("buildView 관전 (결정 0021)", () => {
  const viewOf = (s: RoomState, seat: number) => buildView(s, seatId(s, seat), START_AT);

  it("1일차 밤 뒤 X 가 탈락한 morning: X 의 spectate.seats 는 모든 사람의 {seat, job}(키 job,seat; seat 오름차순; 실제 역할)이고 picks 키는 없다", () => {
    const { s, x } = morningWithVictim(5, 1);
    expect(isAlive(s.players.find((p) => p.seat === x)!)).toBe(false);
    const sp = viewOf(s, x).spectate;
    const want = [...s.players].sort((a, b) => a.seat - b.seat).map((p) => ({ seat: p.seat, job: p.role }));
    expect(flat(sp?.seats)).toBe(flat(want));
    expect(Object.keys(sp?.seats[0] ?? {}).sort().join(",")).toBe("job,seat");
    expect(Object.keys(sp ?? {}).join(",")).toBe("seats");
  });

  it("같은 morning 의 살아 있는 viewer 전원 view 에는 spectate 키가 없다", () => {
    const { s, x } = morningWithVictim(5, 1);
    const bad = s.players.filter((p) => p.seat !== x && "spectate" in viewOf(s, p.seat)).map((p) => p.seat);
    expect(`[${bad.join(",")}]`).toBe("[]");
  });

  it("탈락하기 전(같은 판의 1일차 night) X 의 view 에는 spectate 키가 없다", () => {
    const s0 = stateAt("night", 5, 1);
    const x = nonMafiaSeats(s0)[0]!;
    expect(String("spectate" in viewOf(actAt(s0, seatOfRole(s0, "mafia"), x), x))).toBe("false");
  });

  it("2일차 night: 마피아 → Y, 경찰 → Z, 의사 → 자신(W) 일 때 X 의 spectate.picks 는 {mafia:[Y], police:[Z], doctor:[W]}; 아무도 안 고른 역할은 빈 배열", () => {
    const { s: m, x } = morningWithVictim(5, 1);
    const night = advanceTo(advanceTo(m, "dayAnnounce", 1), "night", 1);
    const y = nonMafiaSeats(night).find((q) => q !== x && q !== seatOfRole(night, "police") && q !== seatOfRole(night, "doctor"))!;
    const z = seatOfRole(night, "mafia");
    const w = seatOfRole(night, "doctor");
    const none = viewOf(night, x).spectate?.picks;
    expect(flat(none)).toBe(flat({ mafia: [], police: [], doctor: [] }));
    let s = actAt(night, seatOfRole(night, "mafia"), y);
    s = actAt(s, seatOfRole(night, "police"), z);
    s = actAt(s, w, w);
    expect(flat(viewOf(s, x).spectate?.picks)).toBe(flat({ mafia: [y], police: [z], doctor: [w] }));
    expect(`${viewOf(s, x).spectate?.picks ? Object.keys(viewOf(s, x).spectate!).sort().join(",") : "-"}`).toBe("picks,seats");
  });

  it("6명 판 마피아 둘이 Y·V 를 고르면 picks.mafia 는 [작은 seat, 큰 seat] 중복 없음(같은 대상이면 하나)", () => {
    const { s: m, x } = morningWithVictim(6, 1);
    const night = advanceTo(advanceTo(m, "dayAnnounce", 1), "night", 1);
    const [a, b] = [seatOfRole(night, "mafia", 0), seatOfRole(night, "mafia", 1)];
    const open = nonMafiaSeats(night).filter((q) => q !== x);
    const [y, v] = [open[open.length - 1]!, open[0]!];
    const two = actAt(actAt(night, a, y), b, v);
    expect(flat(viewOf(two, x).spectate?.picks?.mafia)).toBe(flat([v, y].sort((p, q) => p - q)));
    const one = actAt(actAt(night, a, y), b, y);
    expect(flat(viewOf(one, x).spectate?.picks?.mafia)).toBe(flat([y]));
  });

  it("탈락한 마피아가 고른 값은 picks 에 들지 않는다(살아 있는 사람의 현재 선택만) — 상태를 직접 만들어 확인", () => {
    const s0 = stateAt("night", 6, 1);
    const [a, b] = [seatOfRole(s0, "mafia", 0), seatOfRole(s0, "mafia", 1)];
    const [x, y] = nonMafiaSeats(s0);
    const s: RoomState = {
      ...actAt(s0, a, y!),
      players: actAt(s0, a, y!).players.map((p) =>
        p.seat === b ? { ...p, alive: false, nightPick: y! } : p.seat === x ? { ...p, alive: false } : p,
      ),
    };
    expect(flat(viewOf(s, x!).spectate?.picks)).toBe(flat({ mafia: [y], police: [], doctor: [] }));
    const s2: RoomState = { ...s, players: s.players.map((p) => (p.seat === a ? { ...p, nightPick: undefined } : p)) };
    expect(flat(viewOf(s2, x!).spectate?.picks?.mafia)).toBe("[]");
  });

  it("탈락한 경찰의 view: records 와 spectate 가 함께 있고, spectate 의 키는 seats·picks 뿐이다(지난 정보 없음)", () => {
    const s0 = stateAt("night", 5, 1);
    const police = seatOfRole(s0, "police");
    const mafia = seatOfRole(s0, "mafia");
    const picked = actAt(actAt(s0, police, mafia), mafia, police);
    const dead = tick(picked, picked.phaseEndsAt!, seededRandInt(1));
    const v = viewOf(dead, police);
    expect(`${flat(v.me.records)} ${Object.keys(v.spectate ?? {}).join(",")}`).toBe(`${flat([{ n: 1, target: mafia, isMafia: true }])} seats`);
    const night2 = advanceTo(advanceTo(dead, "dayAnnounce", 1), "night", 1);
    expect(Object.keys(viewOf(night2, police).spectate ?? {}).sort().join(",")).toBe("picks,seats");
  });

  it("탈락자 view 의 me 에는 pick·allyPicks 가 없다(관전자는 행동하지 않는다) — 남은 nightPick 이 있어도", () => {
    const s0 = stateAt("night", 6, 1);
    const [a, b] = [seatOfRole(s0, "mafia", 0), seatOfRole(s0, "mafia", 1)];
    const police = seatOfRole(s0, "police");
    const y = nonMafiaSeats(s0)[0]!;
    const s: RoomState = {
      ...s0,
      players: s0.players.map((p) => (p.seat === b || p.seat === police ? { ...p, alive: false, nightPick: y } : p)),
    };
    const bad = [b, police].filter((seat) => "pick" in viewOf(s, seat).me || "allyPicks" in viewOf(s, seat).me);
    expect(`[${bad.join(",")}] ${a}`).toBe(`[] ${a}`);
    expect(Object.keys(viewOf(s, b).spectate ?? {}).sort().join(",")).toBe("picks,seats");
  });

  it("2일차 night(1일차 밤에 한 명 탈락): 4~8명 × 시드 3개 × 모든 viewer — 살아 있으면 spectate 경로가 없고 탈락했으면 직업 허용 경로가 더해진다", () => {
    const violations: string[] = [];
    let views = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        const { s: m } = morningWithVictim(n, seed);
        const s = nightActions(advanceTo(advanceTo(m, "dayAnnounce", seed), "night", seed));
        for (const viewer of s.players) {
          views += 1;
          const view = buildView(s, viewer.id, START_AT);
          violations.push(...spectateViolations(s, viewer, view, "night", `${n}/${seed}/seat${viewer.seat}`));
          for (const path of keyPaths(view)) {
            if (lastKey(path) === "role" && path !== "me.role") violations.push(`${n}/${seed}/seat${viewer.seat}: role at ${path}`);
          }
        }
      }
    }
    expect(views).toBe(3 * (4 + 5 + 6 + 7 + 8));
    expect(violations.join("; ")).toBe("");
  });
});
