// 처형·아침 마감의 종료 분기와 ended 진입 (04-06 Task 2) — END-01, END-02, CONN-02, 결정 0034, D-10, D-28.
// 상태는 실제 투표 주입과 tick 으로 만든다(test/helpers/voteState.ts, Pitfall 12). 실패 출력은 한 줄이어야 해서 비교는 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { ENDED_ROOM_TTL_MS, enterEnded, routeAfterExecution, routeAfterMorning } from "../../shared/game/endgame";
import { pickTarget } from "../../shared/game/night";
import { MORNING_MS, NIGHT_MS } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { nextWakeAt, tick } from "../../shared/game/tick";
import { seededRandInt } from "../helpers/seededRandom";
import { stateWithVerdict } from "../helpers/voteState";

const SEEDS = [1, 2, 3] as const;
const THROWING_RAND = (): number => {
  throw new Error("randInt must not be called");
};

/** 후보가 처형된 execution 단계(첫 순간). */
const executionOf = (n: number, seed: number, candidate: "citizen" | "mafia"): RoomState =>
  stateWithVerdict(n, seed, "execution", { candidate });

/** 처형 마감을 넘겨 밤에 닿은 상태. */
function nightAfterExecution(n: number, seed: number): RoomState {
  const s = tick(executionOf(n, seed, "citizen"), executionOf(n, seed, "citizen").phaseEndsAt!, seededRandInt(seed + 4));
  if (s.phase !== "night") throw new Error(`expected night, got ${s.phase}`);
  return s;
}

describe("ENDED_ROOM_TTL_MS (D-28)", () => {
  it("30분", () => {
    expect(ENDED_ROOM_TTL_MS).toBe(1_800_000);
  });
});

describe("routeAfterExecution · routeAfterMorning (END-01, D-10)", () => {
  for (const seed of SEEDS) {
    it(`시드 ${seed}: 마피아가 처형되면 승패 → next ended, stay false, 상태는 입력 그대로`, () => {
      const s = executionOf(4, seed, "mafia");
      const r = routeAfterExecution(s);
      expect(`${r.next}:${r.stay}:${r.state === s}`).toBe("ended:false:true");
      const m = routeAfterMorning(s);
      expect(`${m.next}:${m.stay}:${m.state === s}`).toBe("ended:false:true");
    });
    it(`시드 ${seed}: 승패가 아니면 next 없음(표의 기본 단계로)`, () => {
      const s = executionOf(6, seed, "citizen");
      const r = routeAfterExecution(s);
      expect(`${String(r.next)}:${r.stay}:${r.state === s}`).toBe("undefined:false:true");
      const m = routeAfterMorning(s);
      expect(`${String(m.next)}:${m.stay}:${m.state === s}`).toBe("undefined:false:true");
    });
  }
});

describe("enterEnded (END-02, D-28)", () => {
  it("winner 는 와이어 값(citizen → citizenWin), 만료는 min(기존, at + 30분), 다른 필드 불변, 난수를 부르지 않는다", () => {
    const s = executionOf(4, 1, "mafia");
    const at = 500_000;
    const entered = enterEnded({ ...s, phase: "ended", phaseEndsAt: null }, THROWING_RAND, at);
    expect(`${String(entered.winner)}:${entered.expiresAt}`).toBe(`citizenWin:${at + ENDED_ROOM_TTL_MS}`);
    const { winner: _w, expiresAt: _e, ...rest } = entered;
    const { expiresAt: _e0, ...rest0 } = { ...s, phase: "ended" as const, phaseEndsAt: null };
    expect(JSON.stringify(rest)).toBe(JSON.stringify(rest0));
  });

  it("mafia 승리는 mafiaWin", () => {
    const s = executionOf(4, 2, "citizen");
    // 마피아 1 vs 시민 팀 1: 마피아가 아닌 사람 중 한 명만 살린다.
    const keep = s.players.filter((p) => p.role !== "mafia")[0]!;
    const onePair = {
      ...s,
      players: s.players.map((p) => (p.role === "mafia" || p.id === keep.id ? { ...p, alive: true } : { ...p, alive: false })),
    };
    expect(String(enterEnded({ ...onePair, phase: "ended", phaseEndsAt: null }, THROWING_RAND, 1_000).winner)).toBe("mafiaWin");
  });

  it("기존 만료가 더 이르면 그대로", () => {
    const s = { ...executionOf(4, 1, "mafia"), expiresAt: 600_000 };
    const entered = enterEnded({ ...s, phase: "ended", phaseEndsAt: null }, THROWING_RAND, 500_000);
    expect(entered.expiresAt).toBe(600_000);
  });

  it("승패가 없는 상태(도달 불가)에서는 winner 키를 만들지 않는다", () => {
    const s = executionOf(6, 1, "citizen");
    const entered = enterEnded({ ...s, phase: "ended", phaseEndsAt: null }, THROWING_RAND, 500_000);
    expect("winner" in entered).toBe(false);
  });
});

describe("tick 연쇄 — 처형으로 끝 (END-01, END-02, D-28)", () => {
  for (const seed of SEEDS) {
    it(`시드 ${seed}: 4명 판 마피아 처형 → execution 마감에 ended, 마감 없음, winner citizenWin, 만료 = E + 30분`, () => {
      const s = executionOf(4, seed, "mafia");
      const e = s.phaseEndsAt!;
      const ended = tick(s, e, seededRandInt(seed + 9));
      expect(`${ended.phase}:${String(ended.phaseEndsAt)}:${String(ended.winner)}:${ended.expiresAt === e + ENDED_ROOM_TTL_MS}`).toBe(
        "ended:null:citizenWin:true",
      );
      expect(tick(ended, e + 10 * 60 * 60 * 1000, seededRandInt(1)) === ended).toBe(true);
      expect(nextWakeAt(ended)).toBe(ended.expiresAt);
    });
  }
});

describe("tick 연쇄 — 아침으로 끝 (END-01, D-10)", () => {
  for (const seed of SEEDS) {
    it(`시드 ${seed}: 4명 판 시민 처형(1 vs 2) → 밤 → 지목 → 아침은 끝나지 않고, 아침 마감에 ended mafiaWin`, () => {
      const night = nightAfterExecution(4, seed);
      const mafia = night.players.find((p) => p.role === "mafia" && isAlive(p))!;
      const victim = night.players.filter((p) => p.role !== "mafia" && isAlive(p)).sort((a, b) => a.seat - b.seat)[0]!;
      const picked = pickTarget(night, mafia.id, victim.seat);
      if (!picked.ok) throw new Error(picked.error);
      const morning = tick(picked.state, night.phaseEndsAt!, seededRandInt(seed + 5));
      expect(`${morning.phase}:${String(morning.morning?.eliminated)}:${String(morning.winner)}`).toBe(`morning:${victim.seat}:undefined`);
      const ended = tick(morning, morning.phaseEndsAt!, seededRandInt(seed + 6));
      expect(`${ended.phase}:${String(ended.phaseEndsAt)}:${String(ended.winner)}`).toBe("ended:null:mafiaWin");
      expect(ended.expiresAt).toBe(morning.phaseEndsAt! + ENDED_ROOM_TTL_MS);
    });
  }
});

describe("승패가 아니면 그대로 (END-01)", () => {
  for (const seed of SEEDS) {
    it(`시드 ${seed}: 6명 판 시민 처형 → night(+30000), 아침 뒤 dayAnnounce`, () => {
      const s = executionOf(6, seed, "citizen");
      const e = s.phaseEndsAt!;
      const night = tick(s, e, seededRandInt(seed + 4));
      expect(`${night.phase}:${night.phaseEndsAt === e + NIGHT_MS}`).toBe("night:true");
      const morning = tick(night, night.phaseEndsAt!, seededRandInt(seed + 5));
      expect(`${morning.phase}:${morning.phaseEndsAt === night.phaseEndsAt! + MORNING_MS}`).toBe("morning:true");
      const next = tick(morning, morning.phaseEndsAt!, seededRandInt(seed + 6));
      expect(`${next.phase}:${String(next.winner)}`).toBe("dayAnnounce:undefined");
    });
  }
});

describe("CONN-02 — 연결과 무관", () => {
  it("전원 connected false 여도 execution 마감 → ended 판정이 같다", () => {
    const s = executionOf(4, 1, "mafia");
    const cut = { ...s, players: s.players.map((p) => ({ ...p, connected: false, connId: null })) };
    const e = cut.phaseEndsAt!;
    const ended = tick(cut, e, seededRandInt(3));
    expect(`${ended.phase}:${String(ended.winner)}:${ended.expiresAt === e + ENDED_ROOM_TTL_MS}`).toBe("ended:citizenWin:true");
    expect(nextWakeAt(ended)).toBe(ended.expiresAt);
  });
});
