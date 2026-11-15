// 21-01 원인 흐름 분기(결정 0081-2·3, 21페이즈 D-01·D-02·D-03·D-09·D-17, P21-15): 확장판(openCause) 하루가 저녁 → 밤 → 아침 → 토론이고 처형(없음) 뒤에는 저녁이다.
// 상태는 실제 전이(startGame → tick)와 실제 규칙 함수(pickTarget·castPoint·castVerdict·actErrand·sampleErrand)로만 만든다 — 수작업 상태 조립 없음.
// 잠금 아래(setup 이 원인 흐름을 잠근다)에서는 옛 확장판 경로를, 기본 마피아(basic)는 어느 쪽이든 옛 사슬을 그대로 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 단계 수열은 쉼표로 이은 문자열로 비교한다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { phaseDurationOf } from "../../shared/game/discussion";
import { actErrand, placeCenterFx, sampleErrand } from "../../shared/game/errand";
import { noExecutionOf } from "../../shared/game/execution";
import { mapOf, roomMapId } from "../../shared/game/maps";
import { pickTarget } from "../../shared/game/night";
import { DISCUSSION_MS, MORNING_MS, MORNING_SCENE_MS, MORNING_VICTIM_MS } from "../../shared/game/phases";
import { startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import type { PhaseId } from "../../shared/protocol";
import { lockCause, openCause, openTown } from "../helpers/playable";
import { seededRandInt } from "../helpers/seededRandom";
import { castPoints, lobbyOf, START_AT, startedAt, stateWithVerdict } from "../helpers/voteState";

const SEED = 7;

/** 대기실에서 시작한 판(assigning). mode 를 주면 판 종류를 고른 방이다. */
function started(n: number, seed: number, mode?: "basic"): RoomState {
  const lobby = lobbyOf(n);
  const result = startGame(mode === undefined ? lobby : { ...lobby, mode }, lobby.hostId, START_AT, seededRandInt(seed));
  if (!result.ok) throw new Error(`startGame failed: ${result.error}`);
  return result.state;
}

/** stop 이 참이 될 때까지 마감마다 tick 한 번씩 걷고, 각 단계(시작 포함)를 기록한다. before 는 그 단계에 머무는 동안 일어날 행동(밤 선택 등)을 상태에 먼저 더한다. 마감 없는 단계(ended)에서는 멈춘다 — 단언이 사슬을 보고 실패한다. */
function walk(start: RoomState, seed: number, stop: (s: RoomState) => boolean, before?: (s: RoomState) => RoomState): { state: RoomState; phases: PhaseId[] } {
  let s = start;
  const phases: PhaseId[] = [s.phase];
  for (let guard = 0; !stop(s); guard += 1) {
    if (s.phaseEndsAt === null) break;
    if (guard > 80) throw new Error(`walk: did not stop, stuck at ${s.phase}`);
    const acted = before === undefined ? s : before(s);
    s = tick(acted, acted.phaseEndsAt!, seededRandInt(seed + guard));
    phases.push(s.phase);
  }
  return { state: s, phases };
}

const alive = (s: RoomState, role: string): Player[] => s.players.filter((p) => isAlive(p) && p.role === role).sort((a, b) => a.seat - b.seat);

/** 산 마피아 전원이 가장 낮은 좌석의 산 시민을 고른다 — 밤 판정에서 그 시민이 탈락한다. 시민을 고를 수 없으면 입력 그대로. */
function killCitizen(s: RoomState, who?: { skip?: Player }): RoomState {
  if (s.phase !== "night") return s;
  const target = alive(s, "citizen").find((p) => p.id !== who?.skip?.id);
  if (target === undefined) return s;
  let next = s;
  for (const m of alive(s, "mafia")) {
    const r = pickTarget(next, m.id, target.seat);
    if (!r.ok) throw new Error(`pickTarget rejected: ${r.error}`);
    next = r.state;
  }
  return next;
}

/** 첫 아침 상태(피해자가 있는 밤을 지난 morning). 실제 전이로 만든다. */
function victimMorning(seed = SEED): RoomState {
  return walk(started(6, seed), seed, (s) => s.phase === "morning", (s) => killCitizen(s)).state;
}

const keysOf = (value: unknown): string[] => (value !== null && typeof value === "object" ? Object.keys(value) : []);

describe("확장판 원인 흐름 — 하루 사슬 (openCause)", () => {
  let restore: () => void = () => {};
  beforeAll(() => {
    restore = openCause();
  });
  afterAll(() => restore());

  it("첫날: 역할 확인 → 저녁 → 밤 → 아침 → 토론 → 지목이고, 지목이 0표면 다음 날 저녁이며 그 저녁이 2일차다", () => {
    const { phases, state } = walk(started(6, SEED), SEED, (s) => s.phase === "errand" && s.day === 2, (s) => killCitizen(s));
    expect(phases.join(",")).toBe("assigning,roleReveal,errand,night,morning,discussion,nomination,errand");
    expect(state.day).toBe(2);
  });

  it("저녁이 1일차의 시작이다: 첫 저녁·첫 밤·첫 아침·첫 토론이 모두 day 1", () => {
    const days: string[] = [];
    walk(started(6, SEED), SEED, (s) => {
      if (["errand", "night", "morning", "discussion"].includes(s.phase)) days.push(`${s.phase}:${s.day}`);
      return s.phase === "nomination";
    }, (s) => killCitizen(s));
    expect(days.join(",")).toBe("errand:1,night:1,morning:1,discussion:1");
  });

  it("처형이 성립하면 execution → 저녁(errand)이고, 승패가 나면 ended 다", () => {
    const executed = stateWithVerdict(6, SEED, "execution");
    expect(executed.execution?.seat).toBeDefined();
    const next = tick(executed, executed.phaseEndsAt!, seededRandInt(SEED));
    expect(`${next.phase}:${next.day}`).toBe("errand:2");
    const winning = stateWithVerdict(4, SEED, "execution", { candidate: "mafia" });
    expect(tick(winning, winning.phaseEndsAt!, seededRandInt(SEED)).phase).toBe("ended");
  });

  it("지목 동률·0표처럼 처형이 없으면 다음 단계는 night 가 아니라 errand 다", () => {
    const zero = startedAt(6, SEED, "nomination");
    expect(tick(zero, zero.phaseEndsAt!, seededRandInt(SEED)).phase).toBe("errand");
    const tie = castPoints(startedAt(6, SEED, "nomination"), { 0: 1, 1: 0 });
    expect(tick(tie, tie.phaseEndsAt!, seededRandInt(SEED)).phase).toBe("errand");
  });

  it("처형 없는 낮 다음 저녁의 view.day.noExecution 이 있고 사유가 낱낱이 같다: 0표 noVotes · 동률 tie (저녁이 아니면 없다)", () => {
    const zero = startedAt(6, SEED, "nomination");
    const eveningZero = tick(zero, zero.phaseEndsAt!, seededRandInt(SEED));
    expect(JSON.stringify(noExecutionOf(eveningZero))).toBe(JSON.stringify({ reason: "noVotes" }));
    expect(JSON.stringify(buildView(eveningZero, eveningZero.players[0]!.id, 0).day?.noExecution)).toBe(JSON.stringify({ reason: "noVotes" }));
    const tie = castPoints(startedAt(6, SEED, "nomination"), { 0: 1, 1: 0 });
    const eveningTie = tick(tie, tie.phaseEndsAt!, seededRandInt(SEED));
    expect(JSON.stringify(noExecutionOf(eveningTie))).toBe(JSON.stringify({ reason: "tie" }));
    const night = tick(eveningTie, eveningTie.phaseEndsAt!, seededRandInt(SEED));
    expect(`${night.phase}:${noExecutionOf(night)}`).toBe("night:undefined");
    // 첫 저녁(역할 확인 다음)과 처형이 있던 날의 저녁에는 없다.
    expect(noExecutionOf(walk(started(6, SEED), SEED, (s) => s.phase === "errand").state)).toBeUndefined();
    const executed = stateWithVerdict(6, SEED, "execution");
    expect(noExecutionOf(tick(executed, executed.phaseEndsAt!, seededRandInt(SEED)))).toBeUndefined();
  });

  it("일차가 하루에 한 번씩 오른다: voteLog 의 n 이 1·2, nightLog 의 일차가 같은 날 밤과 같다", () => {
    // 첫날 밤에만 시민 하나를 탈락시킨다(둘째 날에도 죽이면 마피아가 이겨 판이 끝난다).
    const { state } = walk(started(6, SEED), SEED, (s) => s.phase === "errand" && s.day === 3, (s) => (s.day === 1 ? killCitizen(s) : s));
    expect((state.voteLog ?? []).map((e) => e.n).join(",")).toBe("1,2");
    expect((state.nightLog ?? []).map((e) => e.n).join(",")).toBe("1,2");
  });

  it("아무도 안 고른 밤은 현장이 없다: morning 길이 0 이라 같은 tick 안에서 토론까지 가고 토론 마감은 밤 마감 + 토론 시간이다", () => {
    const night = walk(started(6, SEED), SEED, (s) => s.phase === "night").state;
    const deadline = night.phaseEndsAt!;
    const next = tick(night, deadline, seededRandInt(SEED));
    expect(`${next.phase}:${next.day}`).toBe("discussion:1");
    expect(next.phaseEndsAt).toBe(deadline + DISCUSSION_MS);
    expect(JSON.stringify(next.morning)).toBe("{}");
  });

  it("피해자가 있는 밤 뒤의 morning 은 발표 길이 + 현장 30초, 의사가 막은 밤 뒤는 기본 길이 + 현장 30초다 (집이 있는 마을 판 — 집 없는 맵은 현장이 없어 30초도 없다, 21-13)", () => {
    const closeTown = openTown();
    try {
    const killed = victimMorning();
    expect(phaseDurationOf(killed)).toBe(MORNING_MS + MORNING_VICTIM_MS + MORNING_SCENE_MS);
    // 의사가 마피아 대상과 같은 사람을 지킨다.
    const saved = walk(started(6, SEED), SEED, (s) => s.phase === "morning", (s) => {
      const killedNight = killCitizen(s);
      if (killedNight.phase !== "night") return killedNight;
      const target = alive(s, "citizen")[0]!;
      const doctor = alive(s, "doctor")[0]!;
      const r = pickTarget(killedNight, doctor.id, target.seat);
      if (!r.ok) throw new Error(`doctor pick rejected: ${r.error}`);
      return r.state;
    }).state;
    expect(JSON.stringify(saved.morning)).toBe(JSON.stringify({ saved: true }));
    expect(phaseDurationOf(saved)).toBe(MORNING_MS + MORNING_SCENE_MS);
    } finally {
      closeTown();
    }
  });

  it("집이 없는 맵(재즈 바)의 원인 흐름 morning 에는 현장이 없어 현장 30초가 붙지 않는다 — 피해자가 있어도 발표 길이뿐이다 (21-13)", () => {
    const killed = victimMorning();
    expect(killed.scene).toBeUndefined();
    expect(phaseDurationOf(killed)).toBe(MORNING_MS + MORNING_VICTIM_MS);
  });

  it("morning 은 공개 흔적·마지막 목격을 만들지 않는다: morning.trace·morning.seen 키가 없고 view.day.evidence 키가 없다 (P21-15)", () => {
    const morning = victimMorning();
    expect(morning.morning?.eliminated).toBeDefined();
    expect(keysOf(morning.morning).join(",")).toBe("eliminated");
    const viewer = morning.players.find((p) => isAlive(p))!;
    const day = buildView(morning, viewer.id, 0).day;
    expect(`${day?.morning !== undefined}/${keysOf(day).includes("evidence")}/${keysOf(day?.morning).join(",")}`).toBe("true/false/eliminated");
  });

  it("심부름 목록·진행·목격 표본이 밤을 지나 토론까지 남아 3곳을 끝낸 산 사람의 view.me.record 가 토론에 있고, 밤·아침 view 에는 심부름 키가 없다 (D-09·D-19, T-21-01)", () => {
    let s = walk(started(6, SEED), SEED, (x) => x.phase === "errand").state;
    const mafia = alive(s, "mafia")[0]!;
    // 모두 한자리에 모여 서로 근처가 된다 — 목격 표본(errandSeen)이 쌓인다.
    s = sampleErrand(s, () => ({ x: 0, z: 0 }), s.phaseEndsAt! - 30_000);
    const map = mapOf(roomMapId(s));
    for (const place of [...(s.players.find((p) => p.id === mafia.id)!.errandPlaces ?? [])]) {
      const r = actErrand(s, mafia.id, placeCenterFx(map, place)!);
      if (!r.ok) throw new Error(`actErrand rejected ${place}`);
      s = r.state;
    }
    const mine = (x: RoomState): Player => x.players.find((p) => p.id === mafia.id)!;
    expect(`${mine(s).errandDone?.length}/${(mine(s).errandSeen?.length ?? 0) > 0}`).toBe("3/true");
    expect(s.players.some((p) => "errandFake" in p)).toBe(false);
    // 저녁 → 밤: nightPick·errandNear·errandFake 는 지우지만 목록·진행·표본은 남는다.
    const night = tick(s, s.phaseEndsAt!, seededRandInt(SEED));
    expect(night.phase).toBe("night");
    expect(`${mine(night).errandPlaces?.length}/${mine(night).errandDone?.length}/${(mine(night).errandSeen?.length ?? 0) > 0}/${"errandNear" in mine(night)}`).toBe("3/3/true/false");
    const nightMe = buildView(night, mafia.id, 0).me;
    expect(`${"record" in nightMe}/${"errand" in nightMe}`).toBe("false/false");
    // 현장이 있는 아침(다른 시민이 탈락)에도 두 키는 view 에 없다.
    const killedNight = killCitizen(night);
    const morning = tick(killedNight, killedNight.phaseEndsAt!, seededRandInt(SEED));
    expect(morning.phase).toBe("morning");
    const morningMe = buildView(morning, mafia.id, 0).me;
    expect(`${"record" in morningMe}/${"errand" in morningMe}`).toBe("false/false");
    // 토론: 키가 남아 있어 산 사람의 기록이 있다(줄이 하나 이상).
    const discussion = tick(morning, morning.phaseEndsAt!, seededRandInt(SEED));
    expect(discussion.phase).toBe("discussion");
    const record = buildView(discussion, mafia.id, 0).me.record;
    expect(`${record !== undefined}/${(record?.length ?? 0) > 0}`).toBe("true/true");
    // 다음 저녁 진입이 목록을 새로 배정하고 진행·표본은 비운다.
    const nominated = walk(discussion, SEED, (x) => x.phase === "errand").state;
    expect(`${mine(nominated).errandPlaces?.length}/${mine(nominated).errandDone?.length}/${"errandSeen" in mine(nominated)}`).toBe("3/0/false");
  });

  it("마피아 가짜 장소가 없다: 저녁 상태의 어떤 사람에게도 errandFake 키가 없고, 저녁 표본이 마지막 목격 줄(errandLast)을 쌓지 않는다", () => {
    const errand = walk(started(6, SEED), SEED, (x) => x.phase === "errand").state;
    expect(errand.players.some((p) => "errandFake" in p)).toBe(false);
    const sampled = sampleErrand(errand, () => ({ x: 0, z: 0 }), errand.phaseEndsAt! - 30_000);
    expect("errandLast" in sampled).toBe(false);
  });
});

describe("원인 흐름 잠금 아래 — 옛 확장판 순서 보호 (21-01)", () => {
  // 꺼진 옛 확장판 경로 — 코드는 끄기만 한다(REQUIREMENTS Out of Scope '기능 코드 삭제'). 21-13: setup 이 더는 잠그지 않으므로 이 구역이 직접 잠근다(갈래 B).
  let restoreLock: () => void = () => {};
  beforeAll(() => {
    restoreLock = lockCause();
  });
  afterAll(() => restoreLock());

  it("역할 확인 → 낮 시작 발표 → 심부름 → 토론 → 지목이고 0표면 night 다", () => {
    const { phases } = walk(started(6, SEED), SEED, (s) => s.phase === "night");
    expect(phases.join(",")).toBe("assigning,roleReveal,dayAnnounce,errand,discussion,nomination,night");
  });

  it("옛 확장판 morning 은 흔적이 있다(trace 키) — 공개 증거 끄기는 원인 흐름만의 일이다", () => {
    const morning = walk(started(6, SEED), SEED, (s) => s.phase === "morning", (s) => killCitizen(s)).state;
    expect(keysOf(morning.morning).join(",")).toContain("trace");
  });
});

describe("기본 마피아 — 어느 잠금에서도 옛 사슬 (21-01)", () => {
  for (const [label, open] of [["잠금", false], ["openCause", true]] as const) {
    it(`${label}: 역할 확인 → 낮 시작 발표 → 토론 → 지목 → (0표) 밤 → 아침 → 낮 시작 발표 이고 0표 밤의 처형 없음 이유가 있다`, () => {
      const close = open ? openCause() : () => {};
      try {
        const { phases, state } = walk(started(6, SEED, "basic"), SEED, (s) => s.phase === "dayAnnounce" && s.day === 2);
        expect(phases.join(",")).toBe("assigning,roleReveal,dayAnnounce,discussion,nomination,night,morning,dayAnnounce");
        expect(state.day).toBe(2);
        const night = walk(started(6, SEED, "basic"), SEED, (s) => s.phase === "night").state;
        expect(JSON.stringify(noExecutionOf(night))).toBe(JSON.stringify({ reason: "noVotes" }));
      } finally {
        close();
      }
    });
  }
});
