import { describe, expect, it } from "vitest";
import { say } from "../../shared/game/chat";
import type { SayInput } from "../../shared/game/chat";
import { claimOptions, currentClaim, selectClaim } from "../../shared/game/claim";
import { isAlive } from "../../shared/game/alive";
import { pickTarget } from "../../shared/game/night";
import { MORNING_MS, NIGHT_MS, PHASE_DEFS } from "../../shared/game/phases";
import { ROOM_TTL_MS, attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { rolesInPlay } from "../../shared/game/roles";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import type { Claim, PhaseId, RoomView } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const PLAYER_COUNTS = [4, 5, 6, 7, 8] as const;
const SEEDS = [1, 42, 20260101] as const;
const PHASES: readonly PhaseId[] = [
  "lobby",
  "assigning",
  "roleReveal",
  "dayAnnounce",
  "claim",
  "claimReveal",
  "discussion",
  "night",
  "morning",
];
/** 역할 확인 이후 낮 단계들(본인 역할이 실리는 단계). */
const REVEALING_PHASES = ["roleReveal", "dayAnnounce", "claim", "claimReveal", "discussion", "night", "morning"] as const;
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

/** 단계별 상태를 실제 전이(startGame, tick)로 만든다. */
function stateAt(phase: PhaseId, n: number, seed: number): RoomState {
  const lobby = lobbyOf(n);
  if (phase === "lobby") return lobby;
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  if (phase === "assigning") return started.state;
  const revealAt = START_AT + 3_000;
  const reveal = tick(started.state, revealAt);
  if (phase === "roleReveal") return reveal;
  // 이후 단계는 마감을 연쇄로 넘긴다: dayAnnounce = 역할 확인 마감, claim = +2000, claimReveal = +15000, discussion = +2000.
  const dayAnnounce = tick(reveal, revealAt + 15_000);
  if (phase === "dayAnnounce") return dayAnnounce;
  const claim = tick(dayAnnounce, revealAt + 15_000 + 2_000);
  if (phase === "claim") return claim;
  const claimReveal = tick(claim, revealAt + 15_000 + 2_000 + 15_000);
  if (phase === "claimReveal") return claimReveal;
  const discussion = tick(claimReveal, revealAt + 15_000 + 2_000 + 15_000 + 2_000);
  if (phase === "discussion") return discussion;
  // 밤은 토론 마감, 아침은 밤 마감(판정에 난수가 필요할 수 있어 시드 난수를 넘긴다).
  const discussionEndsAt = revealAt + 15_000 + 2_000 + 15_000 + 2_000 + 90_000;
  const night = tick(discussion, discussionEndsAt);
  if (phase === "night") return night;
  return tick(night, discussionEndsAt + NIGHT_MS, seededRandInt(seed));
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
/** 허용 경로: 본인 역할·본인 주장·이번 판 구성·공개된 주장. 그 밖의 경로에 이 값이 있으면 누출이다(채팅은 뷰에 없다, 결정 0017-7). */
const ALLOWED_ROLE_VALUE_PATHS: ReadonlySet<string> = new Set([
  "me.role",
  "me.claim",
  "day.roles[]",
  "day.claims[].claim",
]);

function roleValueLeaks(view: RoomView): string[] {
  return stringLeaves(view)
    .filter(([path, value]) => ROLE_LIKE_VALUES.has(value) && !ALLOWED_ROLE_VALUE_PATHS.has(path))
    .map(([path, value]) => `${path}=${value}`);
}

/** view 최상위에 올 수 있는 키(허용 목록). */
const TOP_KEYS: ReadonlySet<string> = new Set([
  "code", "phase", "phaseEndsAt", "phaseDurationMs", "serverNow", "minPlayers", "maxPlayers", "players", "me", "day",
]);

/** 따옴표 없는 한 줄 JSON — 실패 보고(TAP)에 이스케이프된 따옴표가 끼지 않게 한다. */
const flat = (value: unknown): string => (JSON.stringify(value) ?? "undefined").replaceAll('"', "");

const seatId = (state: RoomState, seat: number): string => {
  const p = state.players.find((q) => q.seat === seat);
  if (!p) throw new Error(`no player at seat ${seat}`);
  return p.id;
};

/** 실제 전이(selectClaim)로 그 자리의 직업 선택을 더한다. */
function pick(state: RoomState, seat: number, claim: Claim): RoomState {
  const r = selectClaim(state, seatId(state, seat), claim);
  if (!r.ok) throw new Error(`selectClaim failed: ${r.error}`);
  return r.state;
}

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

/** 실제 전이(say)로 메시지 한 줄을 더한다. */
function speak(state: RoomState, seat: number, input: SayInput, now: number): RoomState {
  const r = say(state, seatId(state, seat), input, now);
  if (!r.ok) throw new Error(`say failed: ${r.error}`);
  return r.state;
}

// 낮 1일차 마감 시각(stateAt 의 연쇄와 같다): dayAnnounce 시작 = 역할 확인 마감, 이후 +2000 / +15000 / +2000 / +90000.
const DAY1_START = START_AT + 3_000 + 15_000;
const CLAIM_ENDS_AT = DAY1_START + 2_000 + 15_000;
const REVEAL_ENDS_AT = CLAIM_ENDS_AT + 2_000;
const DISCUSSION_ENDS_AT = REVEAL_ENDS_AT + 90_000;

/**
 * 낮 단계는 서로 다른 선택·메시지가 있는 상태를 실제 전이(selectClaim·tick·say)로 만든다 — 손으로 필드를 채우지 않는다.
 * claim: seat%3===2 는 고르지 않고 나머지는 (seat+seed) 로 고른 서로 다른 값. claimReveal·discussion: 그 선택이 공개된 뒤.
 * discussion: 메시지 3줄(그중 claimed 1줄). 낮이 아닌 단계는 stateAt 그대로다.
 */
function richStateAt(phase: PhaseId, n: number, seed: number): RoomState {
  if (phase === "night" || phase === "morning") {
    // 밤: 마피아 → 가장 작은 비마피아 seat, 경찰 → seat 0, 의사 → 자신. 아침은 그 밤 뒤.
    let s = tick(richStateAt("discussion", n, seed), DISCUSSION_ENDS_AT);
    const target = nonMafiaSeats(s)[0]!;
    for (const p of s.players) {
      if (p.role === "mafia") s = actAt(s, p.seat, target);
      else if (p.role === "police") s = actAt(s, p.seat, 0);
      else if (p.role === "doctor") s = actAt(s, p.seat, p.seat);
    }
    if (phase === "night") return s;
    return tick(s, DISCUSSION_ENDS_AT + NIGHT_MS, seededRandInt(seed));
  }
  if (phase !== "claim" && phase !== "claimReveal" && phase !== "discussion") return stateAt(phase, n, seed);
  const opts = claimOptions(n);
  let s = stateAt("claim", n, seed);
  for (const p of s.players) if (p.seat % 3 !== 2) s = pick(s, p.seat, opts[(p.seat + seed) % opts.length]!);
  if (phase === "claim") return s;
  s = tick(s, CLAIM_ENDS_AT);
  if (phase === "claimReveal") return s;
  s = tick(s, REVEAL_ENDS_AT);
  s = speak(s, 0, { template: "suspect", target: 1 }, REVEAL_ENDS_AT + 1_000);
  s = speak(s, 1, { template: "claimed", target: 2, claimedRole: rolesInPlay(n)[0]! }, REVEAL_ENDS_AT + 4_000);
  return speak(s, 2, { template: "trust", target: 0 }, REVEAL_ENDS_AT + 7_000);
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
      "lobby:null:true:77777 assigning:3000:true:77777 roleReveal:15000:true:77777 dayAnnounce:2000:true:77777 claim:15000:true:77777 claimReveal:2000:true:77777 discussion:90000:true:77777 night:30000:true:77777 morning:5000:true:77777",
    );
  });

  it("마감은 이전 마감 + 단계 길이로 이어진다: assigning +3000, roleReveal +15000, dayAnnounce +2000, claim +15000, claimReveal +2000, discussion +90000", () => {
    const a = stateAt("assigning", 4, 1);
    const r = stateAt("roleReveal", 4, 1);
    const ends = ["assigning", "roleReveal", "dayAnnounce", "claim", "claimReveal", "discussion", "night", "morning"].map(
      (phase) => stateAt(phase as PhaseId, 4, 1).phaseEndsAt,
    );
    expect(ends.join("/")).toBe(
      [START_AT + 3000, START_AT + 18000, START_AT + 20000, START_AT + 35000, START_AT + 37000, START_AT + 127000, START_AT + 157000, START_AT + 162000].join("/"),
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
  it("4~8명 × 아홉 단계 × 모든 플레이어 × 시드 3개: token·id 가 없고, role·allies 키는 me 아래에만 있으며, 공개 항목은 다섯 키뿐이다", () => {
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
                  "claimLast", "lastSendAt", "claimChoice", "claimShown", "claimChanged",
                  "nightPick", "investigations", "lastPhrase", "nextNightSeq",
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
            // me.claim 은 claim 단계의 본인 currentClaim 과 같고, 그 밖의 단계에는 없다
            if (phase === "claim") {
              if (view.me.claim !== currentClaim(viewer)) violations.push(`${tag}: me.claim ${view.me.claim} != own currentClaim`);
            } else if ("claim" in view.me) {
              violations.push(`${tag}: me.claim outside claim phase`);
            }
            // 역할·주장 값은 허용 경로(me.role, me.claim, day.roles[], day.claims[].claim)에만 있다
            for (const leak of roleValueLeaks(view)) violations.push(`${tag}: role-like value outside allowed paths: ${leak}`);
          }
        }
      }
    }
    expect(views).toBe(3 * 9 * (4 + 5 + 6 + 7 + 8));
    expect(violations.join("; ")).toBe("");
  });
});

describe("buildView 낮 뷰 — 직업 공개 중(claim) 은 완료한 자리와 내 선택만 (D-01, D-03, D-07, D-09)", () => {
  const ROLES_5 = ["mafia", "police", "doctor", "citizen"];

  it("5명 claim 단계: 모든 viewer 의 day 는 {n 1, roles, claimDone [1,2]} 뿐이고 claims·messages·extendUsed 키가 없다(키 목록 claimDone,n,roles)", () => {
    const s = pick(pick(stateAt("claim", 5, 1), 1, "police"), 2, "doctor");
    expect(Object.keys(buildView(s, s.hostId, START_AT).day ?? {}).sort().join(",")).toBe("claimDone,n,roles");
    const want = flat({ n: 1, roles: ROLES_5, claimDone: [1, 2] });
    const got = s.players.map((viewer) => `seat${viewer.seat}:${flat(buildView(s, viewer.id, START_AT).day)}`);
    expect(got.join(" ")).toBe(s.players.map((viewer) => `seat${viewer.seat}:${want}`).join(" "));
  });

  it("me.claim 은 본인이 고른 값만이고, 1일차에 안 고른 사람 me 에는 claim 키가 없다", () => {
    const s = pick(pick(stateAt("claim", 5, 1), 1, "police"), 2, "doctor");
    const got = s.players.map((p) => {
      const me = buildView(s, p.id, START_AT).me;
      return `${p.seat}:${"claim" in me ? me.claim : "-"}`;
    });
    expect(got.join(" ")).toBe("0:- 1:police 2:doctor 3:- 4:-");
  });

  it("2일차 미리 선택: 어제 공개한 값이 내 me.claim 이고, 그 사람은 claimDone 에 들지 않는다", () => {
    const day1 = pick(stateAt("claim", 5, 1), 3, "citizen");
    // claim → claimReveal → discussion → night → morning → (다음 낮) dayAnnounce → claim 을 실제 tick 으로 넘긴다
    const day2 = tick(day1, DISCUSSION_ENDS_AT + NIGHT_MS + MORNING_MS + 2_000);
    expect(day2.phase).toBe("claim");
    const v3 = buildView(day2, seatId(day2, 3), START_AT);
    expect(v3.day?.n).toBe(2);
    expect(v3.me.claim).toBe("citizen");
    expect(flat(v3.day?.claimDone)).toBe("[]");
    // 남의 어제 값은 me.claim 으로도 day 로도 실리지 않는다 — 다른 사람이 본 seat3 의 뷰에는 citizen 이 day.roles 에서만 나온다
    const v0 = buildView(day2, seatId(day2, 0), START_AT);
    expect(flat(v0.day)).toBe(flat({ n: 2, roles: ROLES_5, claimDone: [] }));
  });

  it("claim 단계 뷰에서 역할·주장 값 문자열은 me.role · me.claim · day.roles[] 에만 나온다", () => {
    const bad: string[] = [];
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        const opts = claimOptions(n);
        let s = stateAt("claim", n, seed);
        for (const p of s.players) if (p.seat % 3 !== 2) s = pick(s, p.seat, opts[(p.seat + seed) % opts.length]!);
        for (const viewer of s.players) {
          const view = buildView(s, viewer.id, START_AT);
          for (const [path] of stringLeaves(view).filter(([, v]) => ROLE_LIKE_VALUES.has(v))) {
            if (!["me.role", "me.claim", "day.roles[]"].includes(path)) bad.push(`${n}/${seed}/seat${viewer.seat}:${path}`);
          }
        }
      }
    }
    expect(bad.join(" ")).toBe("");
  });

  it("lobby·assigning·roleReveal 뷰에는 day 키와 me.claim 키가 없다", () => {
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

  it("dayAnnounce 뷰의 day 는 {n, roles} 뿐이다", () => {
    const s = stateAt("dayAnnounce", 5, 1);
    for (const p of s.players) {
      expect(flat(buildView(s, p.id, START_AT).day)).toBe(flat({ n: 1, roles: rolesInPlay(5) }));
    }
  });

  it("일부만 고른 상태: claimDone 에는 고른 사람 seat 만, 오름차순으로 들어 있다", () => {
    const s = pick(pick(stateAt("claim", 6, 42), 4, "none"), 1, "mafia");
    expect(flat(buildView(s, seatId(s, 0), START_AT).day?.claimDone)).toBe("[1,4]");
  });
});

describe("buildView 낮 뷰 — 공개 뒤·토론 (D-04, D-06, D-08, D-15, D-18)", () => {
  it("claimReveal·discussion: day.claims 는 seat 오름차순 {seat, claim, changed} 이고 me 에 claim 키가 없다", () => {
    const bad: string[] = [];
    for (const phase of ["claimReveal", "discussion"] as const) {
      const s = richStateAt(phase, 6, 42);
      // 1일차 선택: seat%3===2 는 안 골라 none, 나머지는 (seat+42) 번째 선택지
      const opts = claimOptions(6);
      const want = [0, 1, 2, 3, 4, 5].map((seat) => ({
        seat,
        claim: seat % 3 === 2 ? "none" : opts[(seat + 42) % opts.length]!,
        changed: false,
      }));
      for (const p of s.players) {
        const view = buildView(s, p.id, START_AT);
        if (flat(view.day?.claims) !== flat(want)) bad.push(`${phase}/seat${p.seat}:${flat(view.day?.claims)}`);
        if ("claim" in view.me) bad.push(`${phase}/seat${p.seat}: me.claim`);
        if ("claimDone" in (view.day ?? {})) bad.push(`${phase}/seat${p.seat}: claimDone`);
      }
    }
    expect(bad.join(" ")).toBe("");
  });

  it("말 바꿈: 2일차에 어제와 다른 직업을 공개한 사람만 changed true 다", () => {
    let s = pick(pick(stateAt("claim", 5, 1), 1, "police"), 2, "doctor");
    s = tick(s, DISCUSSION_ENDS_AT + NIGHT_MS + MORNING_MS + 2_000); // 2일차 claim
    s = pick(s, 1, "doctor"); // police → doctor : 바꿈
    s = pick(s, 2, "doctor"); // 같은 값 : 바꿈 아님
    s = tick(s, DISCUSSION_ENDS_AT + NIGHT_MS + MORNING_MS + 4_000 + 13_000 + 2_000); // 2일차 claimReveal 지나 discussion
    expect(s.phase).toBe("discussion");
    const claims = buildView(s, seatId(s, 0), START_AT).day?.claims ?? [];
    expect(claims.map((c) => `${c.seat}:${c.claim}:${c.changed}`).join(" ")).toBe(
      "0:none:false 1:doctor:true 2:doctor:false 3:none:false 4:none:false",
    );
  });

  it("공개 필드가 없는 옛 플레이어는 {claim none, changed false} 로 실린다", () => {
    const s = stateAt("claimReveal", 5, 1);
    const old: RoomState = {
      ...s,
      players: s.players.map((p) => {
        const { claimShown: _a, claimChanged: _b, claimLast: _c, claimChoice: _d, ...rest } = p;
        return rest;
      }),
    };
    const claims = buildView(old, seatId(old, 0), START_AT).day?.claims ?? [];
    expect(claims.map((c) => `${c.seat}:${c.claim}:${c.changed}`).join(" ")).toBe(
      "0:none:false 1:none:false 2:none:false 3:none:false 4:none:false",
    );
  });

  it("claimReveal 에는 messages·extendUsed 키가 없다", () => {
    const s = richStateAt("claimReveal", 5, 1);
    const day = buildView(s, s.hostId, START_AT).day;
    expect(Object.keys(day ?? {}).sort().join(",")).toBe("claims,n,roles");
  });

  it("discussion: 여러 번 say 한 뒤에도 day 의 키는 claims,n,roles 이고 messages·extendUsed 키가 없다 (결정 0017-5·0017-7)", () => {
    let s = stateAt("discussion", 5, 1);
    s = speak(s, 0, { template: "suspect", target: 1 }, REVEAL_ENDS_AT + 1_000);
    s = speak(s, 1, { template: "innocent" }, REVEAL_ENDS_AT + 4_000);
    s = speak(s, 2, { template: "claimed", target: 3, claimedRole: "police" }, REVEAL_ENDS_AT + 7_000);
    for (const viewer of s.players) {
      const view = buildView(s, viewer.id, START_AT);
      expect(Object.keys(view.day ?? {}).sort().join(",")).toBe("claims,n,roles");
      expect(roleValueLeaks(view).join(";")).toBe("");
    }
  });

  it("discussion phaseDurationMs 는 90000 이다(옛 상태의 연장 표시와 무관); claim 은 15000", () => {
    const s = stateAt("discussion", 4, 1);
    const old = { ...s, extendUsed: true } as RoomState; // 옛 저장 방: 키로만 넣는다(타입 선언에 기대지 않는다)
    expect(buildView(s, s.hostId, START_AT).phaseDurationMs).toBe(90_000);
    expect(buildView(old, s.hostId, START_AT).phaseDurationMs).toBe(90_000);
    expect(buildView(stateAt("claim", 4, 1), s.hostId, START_AT).phaseDurationMs).toBe(15000);
  });
});

describe("buildView 밤 — 생존·본인 선택 (ELIM-01, D-06)", () => {
  it("night view: day 의 키는 claims,n,roles 이고 players[] 키는 alive,connected,isHost,nickname,seat, 모두 alive true", () => {
    const s = stateAt("night", 5, 1);
    const dayKeys = s.players.map((p) => Object.keys(buildView(s, p.id, START_AT).day ?? {}).sort().join(","));
    expect(`[${dayKeys.join(" ")}]`).toBe("[claims,n,roles claims,n,roles claims,n,roles claims,n,roles claims,n,roles]");
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
    s = tick(s, DISCUSSION_ENDS_AT + NIGHT_MS, seededRandInt(1));
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
    for (const phase of ["roleReveal", "dayAnnounce", "claim", "claimReveal", "discussion", "morning"] as const) {
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
    s = tick(s, DISCUSSION_ENDS_AT + NIGHT_MS, seededRandInt(1));
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
    s = tick(s, DISCUSSION_ENDS_AT + NIGHT_MS, seededRandInt(1));
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
  const toMorning = (s: RoomState): RoomState => tick(s, DISCUSSION_ENDS_AT + NIGHT_MS, seededRandInt(1));

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
  it("night·morning 의 day.claims 는 그날 discussion 의 claims 와 같고, dayAnnounce·claim 에는 claims 키가 없다", () => {
    const disc = richStateAt("discussion", 6, 42);
    const want = flat(buildView(disc, disc.hostId, START_AT).day?.claims);
    const night = tick(disc, DISCUSSION_ENDS_AT);
    const morning = tick(night, DISCUSSION_ENDS_AT + NIGHT_MS, seededRandInt(1));
    expect(`${flat(buildView(night, night.hostId, START_AT).day?.claims) === want} ${flat(buildView(morning, morning.hostId, START_AT).day?.claims) === want} ${want.length > 10}`).toBe(
      "true true true",
    );
    const bad: string[] = [];
    for (const phase of ["dayAnnounce", "claim"] as const) {
      const s = richStateAt(phase, 6, 42);
      for (const p of s.players) if ("claims" in (buildView(s, p.id, START_AT).day ?? {})) bad.push(`${phase}/seat${p.seat}`);
    }
    expect(`[${bad.join(",")}]`).toBe("[]");
  });
});
