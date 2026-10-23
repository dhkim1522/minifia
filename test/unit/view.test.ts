import { describe, expect, it } from "vitest";
import { ROOM_TTL_MS, attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import type { PhaseId } from "../../shared/protocol";
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
];
/** 역할 확인 이후 낮 단계들(본인 역할이 실리는 단계). */
const REVEALING_PHASES = ["roleReveal", "dayAnnounce", "claim", "claimReveal", "discussion"] as const;
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
  return tick(claimReveal, revealAt + 15_000 + 2_000 + 15_000 + 2_000);
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
      "lobby:null:true:77777 assigning:3000:true:77777 roleReveal:15000:true:77777 dayAnnounce:2000:true:77777 claim:15000:true:77777 claimReveal:2000:true:77777 discussion:90000:true:77777",
    );
  });

  it("마감은 이전 마감 + 단계 길이로 이어진다: assigning +3000, roleReveal +15000, dayAnnounce +2000, claim +15000, claimReveal +2000, discussion +90000", () => {
    const a = stateAt("assigning", 4, 1);
    const r = stateAt("roleReveal", 4, 1);
    const ends = ["assigning", "roleReveal", "dayAnnounce", "claim", "claimReveal", "discussion"].map(
      (phase) => stateAt(phase as PhaseId, 4, 1).phaseEndsAt,
    );
    expect(ends.join("/")).toBe(
      [START_AT + 3000, START_AT + 18000, START_AT + 20000, START_AT + 35000, START_AT + 37000, START_AT + 127000].join("/"),
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
  it("4~8명 × 일곱 단계 × 모든 플레이어 × 시드 3개: token·id 가 없고, role·allies 키는 me 아래에만 있으며, 공개 항목은 네 키뿐이다", () => {
    const violations: string[] = [];
    let views = 0;
    for (const n of PLAYER_COUNTS) {
      for (const seed of SEEDS) {
        for (const phase of PHASES) {
          const s = stateAt(phase, n, seed);
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
              if (keys !== "connected,isHost,nickname,seat") violations.push(`${tag}: players[] keys ${keys}`);
            }
            // 다른 사람의 역할은 어떤 경로로도 실리지 않는다: 뷰에 든 역할 값은 본인 것(me.role) 하나뿐이다
            const roleValues = /"(mafia|police|doctor|citizen)"/g;
            const found = text.match(roleValues) ?? [];
            const allowed = view.me.role === undefined ? 0 : 1;
            if (found.length !== allowed) violations.push(`${tag}: ${found.length} role values, allowed ${allowed}`);
          }
        }
      }
    }
    expect(views).toBe(3 * 7 * (4 + 5 + 6 + 7 + 8));
    expect(violations.join("; ")).toBe("");
  });
});
