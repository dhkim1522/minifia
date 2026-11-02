// 처형·아침 마감의 종료 분기와 ended 진입 (04-06 Task 2) — END-01, END-02, CONN-02, 결정 0034, D-10, D-28.
// 상태는 실제 투표 주입과 tick 으로 만든다(test/helpers/voteState.ts, Pitfall 12). 실패 출력은 한 줄이어야 해서 비교는 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { ENDED_ROOM_TTL_MS, buildSummary, enterEnded, routeAfterExecution, routeAfterMorning } from "../../shared/game/endgame";
import { pickTarget } from "../../shared/game/night";
import { MORNING_MS, NIGHT_MS } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { nextWakeAt, tick } from "../../shared/game/tick";
import { seededRandInt } from "../helpers/seededRandom";
import { buildView } from "../../shared/game/view";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { startedAt, stateWithVerdict } from "../helpers/voteState";

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

// ---- Task 3: 판 요약과 ended 전용 result view (END-02, D-17, D-27) ----

const NOW = 20_000;
const viewOf = (state: RoomState, playerId: string): RoomView => buildView(state, playerId, NOW);

/** 4명 판: 1일차 시민 처형 → 밤에 마피아가 남은 비마피아 하나를 지목 → 아침 마감에 ended(mafiaWin). */
function endedByMorning(seed: number): { ended: RoomState; candidate: number; victim: number } {
  const exec = executionOf(4, seed, "citizen");
  const candidate = exec.verdict!.candidate!;
  const night = tick(exec, exec.phaseEndsAt!, seededRandInt(seed + 4));
  const mafia = night.players.find((p) => p.role === "mafia" && isAlive(p))!;
  const victim = night.players.filter((p) => p.role !== "mafia" && isAlive(p)).sort((a, b) => a.seat - b.seat)[0]!;
  const picked = pickTarget(night, mafia.id, victim.seat);
  if (!picked.ok) throw new Error(picked.error);
  const morning = tick(picked.state, night.phaseEndsAt!, seededRandInt(seed + 5));
  const ended = tick(morning, morning.phaseEndsAt!, seededRandInt(seed + 6));
  if (ended.phase !== "ended") throw new Error(`expected ended, got ${ended.phase}`);
  return { ended, candidate, victim: victim.seat };
}

/** 4명 판: 1일차 마피아 처형 → execution 마감에 ended(citizenWin). */
function endedByExecution(seed: number): { ended: RoomState; candidate: number } {
  const exec = executionOf(4, seed, "mafia");
  const ended = tick(exec, exec.phaseEndsAt!, seededRandInt(seed + 6));
  if (ended.phase !== "ended") throw new Error(`expected ended, got ${ended.phase}`);
  return { ended, candidate: exec.verdict!.candidate! };
}

/** JSON 을 걸어 내려가며 모든 키 경로를 모은다(배열 칸은 [] 로 접는다). */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}

describe("buildSummary (END-02, D-27, T-04-21)", () => {
  for (const seed of SEEDS) {
    it(`시드 ${seed}: 처형으로 끝난 판의 마지막 날은 exec 만 있다`, () => {
      const { ended, candidate } = endedByExecution(seed);
      expect(JSON.stringify(buildSummary(ended))).toBe(
        JSON.stringify([{ n: 1, exec: { yes: 4, no: 0, passed: true, candidate } }]),
      );
    });
    it(`시드 ${seed}: 아침으로 끝난 판의 마지막 날은 exec 와 night 둘 다 있다`, () => {
      const { ended, candidate, victim } = endedByMorning(seed);
      expect(JSON.stringify(buildSummary(ended))).toBe(
        JSON.stringify([{ n: 1, exec: { yes: 4, no: 0, passed: true, candidate }, night: { target: victim, died: true } }]),
      );
    });
  }

  it("일차 오름차순 한 줄씩, 후보 없는 처형 무효는 candidate 키가 없고, 처형 없는 날은 exec 없음·밤 없는 날은 night 없음", () => {
    const base = endedByExecution(1).ended;
    const state: RoomState = {
      ...base,
      voteLog: [
        { n: 2, exec: { yes: 1, no: 3, passed: false } },
        { n: 1, exec: { yes: 3, no: 1, passed: true }, cand: { votes: [{ seat: 0, target: 1 }], candidate: 1 } },
      ],
      nightLog: [{ n: 3, died: false }, { n: 1, target: 2, died: true }, { n: 2, died: false }],
    };
    expect(JSON.stringify(buildSummary(state))).toBe(
      JSON.stringify([
        { n: 1, exec: { yes: 3, no: 1, passed: true, candidate: 1 }, night: { target: 2, died: true } },
        { n: 2, exec: { yes: 1, no: 3, passed: false }, night: { died: false } },
        { n: 3, night: { died: false } },
      ]),
    );
  });

  it("의사가 지킨 밤(D-27): nightLog {n, target, died:false} → 요약 night {target, died:false}", () => {
    const base = endedByExecution(2).ended;
    const state: RoomState = { ...base, voteLog: [], nightLog: [{ n: 1, target: 3, died: false }] };
    expect(JSON.stringify(buildSummary(state))).toBe(JSON.stringify([{ n: 1, night: { target: 3, died: false } }]));
  });

  it("기록이 없으면 빈 배열이고, 입력 상태를 바꾸지 않으며, 줄은 입력 객체와 같은 참조가 아니다", () => {
    const { ended } = endedByMorning(3);
    const before = JSON.stringify(ended);
    const out = buildSummary(ended);
    expect(JSON.stringify(ended)).toBe(before);
    expect(out[0]!.exec === ended.voteLog![0]!.exec).toBe(false);
    const empty: RoomState = { ...ended, voteLog: undefined, nightLog: undefined };
    expect(buildSummary(empty).length).toBe(0);
  });
});

describe("ended 전용 result view (END-02, D-17)", () => {
  for (const seed of SEEDS) {
    it(`시드 ${seed}: 모든 viewer(생존·탈락·방장) 의 result 가 JSON 으로 같고 winner·seats·summary 모양이 맞다`, () => {
      const { ended } = endedByMorning(seed);
      const results = ended.players.map((p) => JSON.stringify(viewOf(ended, p.id).result));
      expect(new Set(results).size).toBe(1);
      expect(results[0]).not.toBe(undefined);
      const view = viewOf(ended, ended.hostId);
      const result = view.result!;
      expect(result.winner).toBe("mafiaWin");
      expect(result.seats.map((s) => `${s.seat}:${s.job}`).join(",")).toBe(
        [...ended.players].sort((a, b) => a.seat - b.seat).map((p) => `${p.seat}:${String(p.role)}`).join(","),
      );
      expect(result.seats.every((s) => Object.keys(s).sort().join(",") === "job,seat")).toBe(true);
      expect(JSON.stringify(result.summary)).toBe(JSON.stringify(buildSummary(ended)));
      expect(Object.keys(result).sort().join(",")).toBe("seats,summary,winner");
    });
  }

  it("처형으로 끝난 판도 citizenWin 이 모두에게 같다", () => {
    const { ended } = endedByExecution(1);
    const results = ended.players.map((p) => JSON.stringify(viewOf(ended, p.id).result));
    expect(new Set(results).size).toBe(1);
    expect(viewOf(ended, ended.hostId).result?.winner).toBe("citizenWin");
  });

  it("ended view 에는 day 가 있고 phaseEndsAt·phaseDurationMs 가 null 이다", () => {
    const { ended } = endedByMorning(1);
    const view = viewOf(ended, ended.hostId);
    expect(`${view.phase}:${String(view.phaseEndsAt)}:${String(view.phaseDurationMs)}:${view.day !== undefined}`).toBe("ended:null:null:true");
  });

  it("ended 의 어떤 view 에도 nightLog·verdict·lastExecPhrase 키가 없고 winner 키는 result 아래에만 있다", () => {
    const { ended } = endedByMorning(2);
    const bad: string[] = [];
    for (const p of ended.players) {
      for (const path of keyPaths(viewOf(ended, p.id))) {
        const key = path.slice(path.lastIndexOf(".") + 1);
        if (["nightLog", "verdict", "lastExecPhrase"].includes(key)) bad.push(path);
        if (key === "winner" && path !== ".result.winner") bad.push(path);
      }
    }
    expect(bad.join(",")).toBe("");
  });
});

describe("ended 전에는 결과·밤 기록이 어떤 view 에도 없다 (T-04-18)", () => {
  /** 실제 전이로 만든 ended 이전 상태들: 로비부터 처형까지, 밤 기록이 쌓인 아침·다음 날 낮 시작 포함. */
  function preEndedStates(seed: number): Array<[string, RoomState]> {
    const out: Array<[string, RoomState]> = [];
    const phases: PhaseId[] = ["roleReveal", "dayAnnounce", "discussion", "execVote"];
    for (const ph of phases) out.push([ph, startedAt(6, seed, ph)]);
    for (const ph of ["candidateVote", "candidateVoteReveal", "defense", "execution"] as const) {
      out.push([ph, stateWithVerdict(6, seed, ph)]);
    }
    const exec = stateWithVerdict(6, seed, "execution");
    const night = tick(exec, exec.phaseEndsAt!, seededRandInt(seed + 4));
    out.push(["night", night]);
    const mafia = night.players.find((p) => p.role === "mafia" && isAlive(p))!;
    const victim = night.players.filter((p) => p.role !== "mafia" && isAlive(p))[0]!;
    const picked = pickTarget(night, mafia.id, victim.seat);
    if (!picked.ok) throw new Error(picked.error);
    const morning = tick(picked.state, night.phaseEndsAt!, seededRandInt(seed + 5));
    out.push(["morning", morning]);
    const quietNight = tick(night, night.phaseEndsAt!, seededRandInt(seed + 5));
    const quietMorning = tick(quietNight, quietNight.phaseEndsAt!, seededRandInt(seed + 6));
    out.push(["dayAnnounce(2일차, 밤 기록 있음)", quietMorning]);
    return out;
  }

  for (const seed of SEEDS) {
    it(`시드 ${seed}: result 키가 없고 nightLog·verdict·lastExecPhrase·winner 키가 없다`, () => {
      const bad: string[] = [];
      for (const [name, state] of preEndedStates(seed)) {
        if (state.phase === "ended") bad.push(`${name}: unexpectedly ended`);
        if (name === "morning" && (state.nightLog ?? []).length === 0) bad.push("morning: nightLog fixture empty");
        for (const p of state.players) {
          const view = viewOf(state, p.id);
          if ("result" in view) bad.push(`${name}/seat${p.seat}: result`);
          for (const path of keyPaths(view)) {
            const key = path.slice(path.lastIndexOf(".") + 1);
            // 8페이즈: 처형 단계의 day.verdict({yes,no,passed})는 서버 전용 RoomState.verdict 와 이름만 같은 공개 와이어 필드다(08-07).
            if (["nightLog", "verdict", "lastExecPhrase", "winner"].includes(key) && path !== ".day.verdict") bad.push(`${name}/seat${p.seat}: ${path}`);
          }
        }
      }
      expect(bad.join(",")).toBe("");
    });
  }

  it("로비 view 에도 result 키가 없다", () => {
    const lobby = startedAt(4, 1, "roleReveal");
    expect("result" in viewOf({ ...lobby, phase: "lobby", phaseEndsAt: null }, lobby.hostId)).toBe(false);
  });
});
