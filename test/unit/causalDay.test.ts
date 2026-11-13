// 21페이즈 원인→결과 하루 흐름의 서버 뼈대 시험(21-01, D-01~D-03·D-11·D-17·D-18).
// 확장판 하루 = roleReveal → errand(저녁) → night → morning(현장이 있을 때만) → discussion → nomination → defense → verdict → execution → errand …
// 기본 마피아 하루는 그대로다(roleReveal → dayAnnounce → discussion → … → execution → night → morning → dayAnnounce).
// 실패 출력은 한 줄이어야 해서(TAP) 단계 사슬은 '>' 로 이은 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { computeAwards } from "../../shared/game/awards";
import { assignSlots, layoutFor, layoutKey, ringSlots } from "../../shared/game/gather";
import { BAR_MAP } from "../../shared/game/map";
import { canMove, canMoveIn } from "../../shared/game/movement";
import { phaseDurationOf, morningMsOf } from "../../shared/game/discussion";
import { noExecutionOf } from "../../shared/game/execution";
import { pickTarget } from "../../shared/game/night";
import { ERRAND_MS, MORNING_SCENE_MS, nextPhaseOf } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { rulesetOf } from "../../shared/game/ruleset";
import { tick } from "../../shared/game/tick";
import { emptyWorld, restSegment, spawnPlayer, teleportTo } from "../../shared/game/world";
import type { PhaseId } from "../../shared/protocol";
import { endedState, execDay } from "../helpers/awardsState";
import { castPoints, castVerdicts, startedAt, stateWithVerdict } from "../helpers/voteState";
import { seededRandInt } from "../helpers/seededRandom";

const EXT = rulesetOf("extended");
const BASIC = rulesetOf("basic");

const PHASES: readonly PhaseId[] = ["roleReveal", "errand", "night", "morning", "discussion", "nomination", "defense", "verdict", "execution", "dayAnnounce"];
/** 단계마다 '단계>다음' 을 이은 한 줄. */
const orderLine = (rules: typeof EXT, phases: readonly PhaseId[]): string => phases.map((p) => `${p}>${nextPhaseOf(p, rules)}`).join(" ");

/** 좌석별 고정 역할: 마피아 0·1, 경찰 2, 의사 3, 시민 4·5. */
const ROLE_OF_SEAT = ["mafia", "mafia", "police", "doctor", "citizen", "citizen"] as const;

/** 6명 판을 역할 확인 첫 순간까지 걷고 역할을 고정한다. mode 가 basic 이면 기본 마피아 판이다. */
function atRoleReveal(mode: "basic" | "extended", seed = 3): RoomState {
  const s = startedAt(6, seed, "roleReveal");
  return { ...s, mode, players: s.players.map((p) => ({ ...p, role: ROLE_OF_SEAT[p.seat]! })) };
}

const idOf = (s: RoomState, seatNo: number): string => s.players.find((p) => p.seat === seatNo)!.id;

/** 마감 시각에 한 걸음. */
const step = (s: RoomState): RoomState => tick(s, s.phaseEndsAt!, seededRandInt(7));

/** 이 단계에 닿을 때까지 마감마다 한 걸음씩. 지나온(들어간) 단계를 순서대로 모은다. 지목·찬반 단계는 6번 좌석 아닌 시민 4번 처형 쪽으로 표를 던진다. */
function walkTo(start: RoomState, stop: (s: RoomState) => boolean): { state: RoomState; trail: PhaseId[] } {
  let s = start;
  const trail: PhaseId[] = [];
  for (let guard = 0; !stop(s); guard += 1) {
    if (guard > 40 || s.phaseEndsAt === null) throw new Error(`walkTo: ${trail.join(">")} 에서 멈추지 못했다`);
    if (s.phase === "nomination") {
      const alive = s.players.filter(isAlive);
      const target: Record<number, number> = {};
      for (const p of alive) target[p.seat] = p.seat === 4 ? 5 : 4;
      s = castPoints(s, target);
    }
    if (s.phase === "verdict") {
      const agree: Record<number, boolean> = {};
      for (const p of s.players) if (isAlive(p) && p.seat !== s.verdict?.candidate) agree[p.seat] = true;
      s = castVerdicts(s, agree);
    }
    s = step(s);
    trail.push(s.phase);
  }
  return { state: s, trail };
}

const line = (trail: readonly PhaseId[]): string => trail.join(">");

describe("하루 순서 표 (D-01·D-02)", () => {
  it("확장판 nextPhaseOf: 저녁이 역할 확인 뒤·처형 뒤에 오고 밤 뒤가 아침, 아침 뒤가 토론이다(낮 시작 발표는 배포 순간 저장 방을 토론으로 이어 준다)", () => {
    expect(orderLine(EXT, PHASES)).toBe(
      "roleReveal>errand errand>night night>morning morning>discussion discussion>nomination nomination>defense defense>verdict verdict>execution execution>errand dayAnnounce>discussion",
    );
  });

  it("기본 마피아 nextPhaseOf 는 그대로다: roleReveal>dayAnnounce dayAnnounce>discussion … execution>night night>morning morning>dayAnnounce", () => {
    const basicPhases: readonly PhaseId[] = ["roleReveal", "dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning"];
    expect(orderLine(BASIC, basicPhases)).toBe(
      "roleReveal>dayAnnounce dayAnnounce>discussion discussion>nomination nomination>defense defense>verdict verdict>execution execution>night night>morning morning>dayAnnounce",
    );
  });
});

describe("확장판 tick 사슬 (D-01·D-02·D-03·D-17)", () => {
  it("역할 확인 마감 → 저녁(일차 1, 40초) — 낮 시작 발표 없이 저녁 진입이 일차를 올린다", () => {
    const start = atRoleReveal("extended");
    const errand = step(start);
    expect(`${errand.phase}/${errand.day}/${errand.phaseEndsAt! - start.phaseEndsAt!}`).toBe(`errand/1/${ERRAND_MS}`);
  });

  it("아무도 안 고른 밤은 아침 없이 토론으로 간다: errand>night>discussion, morning {} 이고 밤 일지는 {n:1, died:false}", () => {
    const { state, trail } = walkTo(atRoleReveal("extended"), (s) => s.phase === "discussion");
    expect(line(trail)).toBe("errand>night>discussion");
    expect(JSON.stringify(state.morning)).toBe("{}");
    expect(JSON.stringify(state.nightLog?.at(-1))).toBe('{"n":1,"died":false}');
    expect(state.day).toBe(1);
  });

  it("마피아가 시민 하나를 고른 밤은 아침(30초 현장)을 거친다: night>morning>discussion, morning.eliminated 가 그 좌석", () => {
    let night = walkTo(atRoleReveal("extended"), (s) => s.phase === "night").state;
    for (const m of [0, 1]) {
      const r = pickTarget(night, idOf(night, m), 4);
      if (!r.ok) throw new Error(r.error);
      night = r.state;
    }
    const deadline = night.phaseEndsAt!;
    const morning = step(night);
    expect(`${morning.phase}/${morning.morning?.eliminated}/${phaseDurationOf(morning)}/${morning.phaseEndsAt! - deadline}`).toBe(`morning/4/${MORNING_SCENE_MS}/${MORNING_SCENE_MS}`);
    expect(MORNING_SCENE_MS).toBe(30_000);
    const next = walkTo(morning, (s) => s.phase !== "morning");
    expect(`${line(next.trail)}/${isAlive(next.state.players.find((p) => p.seat === 4)!)}`).toBe("discussion/false");
  });

  it("의사가 같은 좌석을 고르면 morning.saved true 로 같은 길(아침 30초)을 간다", () => {
    let night = walkTo(atRoleReveal("extended"), (s) => s.phase === "night").state;
    for (const [actor, target] of [[0, 4], [1, 4], [3, 4]] as const) {
      const r = pickTarget(night, idOf(night, actor), target);
      if (!r.ok) throw new Error(r.error);
      night = r.state;
    }
    const morning = step(night);
    expect(`${morning.phase}/${JSON.stringify(morning.morning)}/${phaseDurationOf(morning)}`).toBe(`morning/{"saved":true}/${MORNING_SCENE_MS}`);
    expect(line(walkTo(morning, (s) => s.phase !== "morning").trail)).toBe("discussion");
  });

  it("현장 없는 밤도 판정은 적용된다: 경찰 수사 일지·의사 치료 일지가 쌓인다", () => {
    let night = walkTo(atRoleReveal("extended"), (s) => s.phase === "night").state;
    for (const [actor, target] of [[2, 0], [3, 3]] as const) {
      const r = pickTarget(night, idOf(night, actor), target);
      if (!r.ok) throw new Error(r.error);
      night = r.state;
    }
    const talk = step(night);
    const police = talk.players.find((p) => p.seat === 2)!;
    const doctor = talk.players.find((p) => p.seat === 3)!;
    expect(`${talk.phase}/${JSON.stringify(police.investigations)}/${JSON.stringify(doctor.treatments)}`).toBe(
      'discussion/[{"n":1,"target":0,"isMafia":true}]/[{"n":1,"target":3}]',
    );
  });
});

describe("처형 없는 날은 저녁으로 (D-01)", () => {
  /** 토론 마감 뒤 지목 단계 첫 순간. */
  const nominationOf = (): RoomState => walkTo(atRoleReveal("extended"), (s) => s.phase === "nomination").state;

  it("확장판 지목에 표가 0이면 execution 없이 errand(일차 2) 로 가고 저녁의 처형 없는 이유가 noVotes", () => {
    const evening = step(nominationOf());
    expect(`${evening.phase}/${evening.day}/${JSON.stringify(noExecutionOf(evening))}`).toBe('errand/2/{"reason":"noVotes"}');
    // 같은 상태를 밤으로 바꾸면 이유는 없다(저녁에만 보인다).
    expect(noExecutionOf({ ...evening, phase: "night" })).toBeUndefined();
  });

  it("동률이면 tie", () => {
    const tie = castPoints(nominationOf(), { 0: 2, 2: 0 });
    const evening = step(tie);
    expect(`${evening.phase}/${evening.day}/${JSON.stringify(noExecutionOf(evening))}`).toBe('errand/2/{"reason":"tie"}');
  });

  it("첫 저녁에는 전날 줄이 없어 처형 없는 이유가 없다", () => {
    const first = step(atRoleReveal("extended"));
    expect(noExecutionOf(first)).toBeUndefined();
  });

  it("기본 마피아는 지금처럼 night 에서 이유를 준다", () => {
    const nomination = walkTo(atRoleReveal("basic"), (s) => s.phase === "nomination").state;
    const night = step(nomination);
    expect(`${night.phase}/${JSON.stringify(noExecutionOf(night))}`).toBe('night/{"reason":"noVotes"}');
  });

  it("확장판 execution 마감(승패 없음) → errand(일차 + 1), 승패가 나면 ended", () => {
    const execution = stateWithVerdict(6, 3, "execution", { candidate: "citizen" });
    const evening = step({ ...execution, mode: "extended" });
    expect(`${evening.phase}/${evening.day}`).toBe(`errand/${(execution.day ?? 0) + 1}`);
    const winning = stateWithVerdict(4, 3, "execution", { candidate: "mafia" });
    expect(step(winning).phase).toBe("ended");
  });
});

describe("두 판의 하루 사슬", () => {
  it("확장판: 역할 확인부터 처형 → 저녁 → 밤 → 토론까지 dayAnnounce 가 한 번도 없다", () => {
    let seenExecution = false;
    const { trail } = walkTo(atRoleReveal("extended"), (s) => {
      if (s.phase === "execution") seenExecution = true;
      return seenExecution && s.phase === "discussion";
    });
    expect(line(trail)).toBe("errand>night>discussion>nomination>defense>verdict>execution>errand>night>discussion");
  });

  it("기본 마피아: 역할 확인부터 한 바퀴 돌고 다음 날 토론까지, 아침 길이는 morningMsOf 그대로", () => {
    let seenExecution = false;
    const { state, trail } = walkTo(atRoleReveal("basic"), (s) => {
      if (s.phase === "execution") seenExecution = true;
      return seenExecution && s.phase === "discussion";
    });
    expect(line(trail)).toBe("dayAnnounce>discussion>nomination>defense>verdict>execution>night>morning>dayAnnounce>discussion");
    // 아침 길이: 탈락도 흔적도 없는 아침은 5초(MORNING_MS), 길이 함수가 바로 그 값이다.
    const night = walkTo(atRoleReveal("basic"), (s) => s.phase === "night").state;
    const morning = step(night);
    expect(`${morning.phase}/${phaseDurationOf(morning)}/${morningMsOf(morning)}`).toBe("morning/5000/5000");
    expect(state.phase).toBe("discussion");
  });
});

describe("이동 권한 (D-11, UI-SPEC P21-12)", () => {
  const row = (phase: PhaseId, alive: boolean, rules?: typeof EXT): string => `${phase}/${alive}/${rules === undefined ? "-" : rules === EXT ? "ext" : "basic"}:${canMoveIn(phase, alive, rules)}`;

  it("확장판 아침은 산 사람도 걷는다 — 기본 마피아·규칙 인자 없음은 못 걷고, 밤은 두 판 모두 산 사람 못 걷고 유령은 걷는다", () => {
    expect([
      row("morning", true, EXT),
      row("morning", true, BASIC),
      row("morning", true),
      row("night", true, EXT),
      row("night", true, BASIC),
      row("night", false, EXT),
      row("night", false, BASIC),
    ].join(" ")).toBe("morning/true/ext:true morning/true/basic:false morning/true/-:false night/true/ext:false night/true/basic:false night/false/ext:true night/false/basic:true");
  });

  it("canMove 는 방 상태의 판 종류로 규칙을 고른다", () => {
    const night = walkTo(atRoleReveal("extended"), (s) => s.phase === "night").state;
    const alive = night.players.find((p) => p.seat === 4)!;
    const asMorning = (mode: "basic" | "extended"): boolean => canMove({ ...night, mode, phase: "morning" }, alive);
    expect(`${asMorning("extended")}/${asMorning("basic")}/${canMove(night, alive)}`).toBe("true/false/false");
  });
});

describe("토론 모이기 (D-18)", () => {
  const discussionOf = (mode: "basic" | "extended"): RoomState => ({ ...atRoleReveal(mode), phase: "discussion", day: 1 });
  /** 입장 지점에 선 월드. */
  const worldOf = (s: RoomState) => s.players.reduce((w, p) => spawnPlayer(w, p.id, p.seat, 0, BAR_MAP), emptyWorld());

  it("layoutKey: 확장판 discussion 은 '{일차}:talk', 기본 마피아는 null", () => {
    expect(`${layoutKey(discussionOf("extended"))}/${layoutKey(discussionOf("basic"))}`).toBe("1:talk/null");
  });

  it("layoutFor: 산 사람만 ringSlots(산 사람 수) 자리를 받는다(지목과 같은 자리표), 유령은 없다", () => {
    const s = discussionOf("extended");
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.seat === 5 ? { ...p, alive: false } : p)) };
    const lay = layoutFor(dead, worldOf(dead), 1000)!;
    const dests = lay.moves.map((m) => `${m.dest.x},${m.dest.z}`).sort().join(" ");
    const table = ringSlots(5).map((p) => `${p[0]},${p[1]}`).sort().join(" ");
    expect(`${lay.key}/${dests === table}/${lay.moves.some((m) => m.playerId === idOf(dead, 5))}`).toBe("1:talk/true/false");
  });

  it("layoutFor: 기본 마피아 discussion 은 배치가 없다(null)", () => {
    const s = discussionOf("basic");
    expect(layoutFor(s, worldOf(s), 1000)).toBeNull();
    // assignSlots 는 그대로 쓴다 — 자리표와 사람 수가 같으면 모두 받는다.
    expect(Object.keys(assignSlots(s.players.map((p) => ({ id: p.id, x: 0, z: 0 })), ringSlots(6))).length).toBe(6);
  });
});

describe("teleportTo (D-11)", () => {
  it("spots 에 있는 id 의 구간만 한 점(t0 = now)으로 바꾸고, 다른 사람·구간 없는 id·입력 객체·lastMoveAt 은 그대로다", () => {
    const base = ["a", "b", "c"].reduce((w, id, i) => spawnPlayer(w, id, i, 5, BAR_MAP), emptyWorld());
    const w = { ...base, lastMoveAt: { a: 9 } };
    const before = JSON.stringify(w);
    const out = teleportTo(w, { a: { x: -375, z: -675 }, ghost: { x: 1, z: 2 } }, 777);
    expect(JSON.stringify(out.segs.a)).toBe(JSON.stringify(restSegment(-375, -675, 777)));
    expect(`${out.segs.b === w.segs.b}/${out.segs.c === w.segs.c}/${Object.keys(out.segs).join(",")}/${JSON.stringify(out.lastMoveAt)}/${JSON.stringify(w) === before}`).toBe("true/true/a,b,c/{\"a\":9}/true");
  });
});

describe("탈락 순서 (awards survivalKey)", () => {
  /** 1일차에 처형된 0번과 밤 피해자 1번이 모두 3표를 받은 판의 '지목받은 사람' 칭호 주인. */
  const targetWinner = (mode: "basic" | "extended"): number | undefined => {
    const base = endedState({
      roles: ["citizen", "citizen", "mafia", "mafia", "citizen", "citizen", "police", "doctor"],
      dead: [0, 1],
      voteLog: [execDay(1, [[2, 0], [3, 0], [4, 0], [5, 1], [6, 1], [7, 1]], 0)],
      nightLog: [{ n: 1, target: 1, died: true }],
    });
    return computeAwards({ ...base, mode }).find((l) => l.award === "target")?.seat;
  };

  it("같은 일차에서 기본 마피아는 처형이 먼저(밤 피해자가 늦게 탈락), 확장판은 밤이 먼저(처형자가 늦게 탈락) — 점수 같은 둘 중 늦게 탈락한 쪽이 칭호를 받는다", () => {
    expect(`${targetWinner("basic")}/${targetWinner("extended")}`).toBe("1/0");
  });
});
