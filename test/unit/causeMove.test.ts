// 21-05 위치·가시성 순수 규칙(D-10·D-11·D-18, A5, 결정 0088): 원인 흐름 확장판에서 아침에는 산 사람이 걷고 근처만 보이며(nearPhaseOf·canMoveIn), 밤에는 집 앞에 서고(houseHome),
// 토론이 시작되면 둘레로 모인다(layoutKey 의 board 키). 옛 확장판(잠금)·기본판의 위치 규칙은 그대로다.
// 상태는 실제 전이(startGame → tick)와 실제 규칙 함수(pickTarget)로만 만든다. 실패 출력은 한 줄이어야 해서(TAP) 목록은 문자열로 비교한다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { audience, worldVisibleTo } from "../../shared/game/audience";
import { isAlive } from "../../shared/game/alive";
import { layoutKey } from "../../shared/game/gather";
import { canMove, canMoveIn, nearPhaseOf } from "../../shared/game/movement";
import { pickTarget } from "../../shared/game/night";
import { ERRAND_TICK_MS } from "../../shared/game/phases";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { rulesetOf } from "../../shared/game/ruleset";
import { nextWakeAt, tick } from "../../shared/game/tick";
import { emptyWorld, houseHome, restSegment } from "../../shared/game/world";
import { lockCause, openCause, openTown } from "../helpers/playable";
import { seededRandInt } from "../helpers/seededRandom";
import { lobbyOf, startedAt, startedFrom } from "../helpers/voteState";

const SEED = 13;
const withRole = (s: RoomState, role: RoleId): Player[] => s.players.filter((p) => p.role === role).sort((a, b) => a.seat - b.seat);

/** 저녁 → 밤(night 의 첫 순간) → 마피아 둘과 시민이 시민 한 명을 골라 아침(피해자 있음)까지. */
function nightAndMorning(): { night: RoomState; morning: RoomState } {
  let s = startedAt(6, SEED, "errand");
  for (let guard = 0; s.phase !== "night"; guard += 1) {
    if (s.phaseEndsAt === null || guard > 20) throw new Error(`cannot reach night (stuck at ${s.phase})`);
    s = tick(s, s.phaseEndsAt, seededRandInt(SEED + 1 + guard));
  }
  const night = s;
  const [m1, m2] = withRole(s, "mafia") as [Player, Player];
  const [victim, c2] = withRole(s, "citizen") as [Player, Player];
  for (const actor of [m1, m2, c2]) {
    const r = pickTarget(s, actor.id, victim.seat);
    if (!r.ok) throw new Error(`pickTarget rejected: ${r.error}`);
    s = r.state;
  }
  const morning = tick(s, s.phaseEndsAt!, seededRandInt(SEED + 100));
  if (morning.phase !== "morning") throw new Error(`expected morning, got ${morning.phase}`);
  return { night, morning };
}

const FRONTS = Array.from({ length: 8 }, (_, seat) => ({ x: 100 + seat, z: -200 - seat }));

describe("원인 흐름 위치·가시성 순수 규칙 (openCause + openTown)", () => {
  let restoreCause: () => void = () => {};
  let restoreTown: () => void = () => {};
  beforeAll(() => {
    restoreCause = openCause();
    restoreTown = openTown();
  });
  afterAll(() => {
    restoreTown();
    restoreCause();
  });

  it("canMoveIn: 원인 흐름 규칙이면 산 사람이 아침에도 걷는다. 규칙이 없거나 밤이면 지금 그대로다", () => {
    const cause = rulesetOf("extended");
    const rows = [
      canMoveIn("morning", true, cause),
      canMoveIn("morning", true),
      canMoveIn("night", true, cause),
      canMoveIn("morning", false, cause),
      canMoveIn("night", false),
      canMoveIn("errand", true, cause),
      canMoveIn("discussion", true, cause),
      canMoveIn("nomination", true, cause),
    ];
    expect(rows.join(",")).toBe("true,false,false,true,true,true,true,false");
  });

  it("canMove: 아침 산 사람은 원인 흐름 판에서만 걷고(잠금 아래 옛 확장판은 못 걷는다) 밤에는 누구도 못 걷는다", () => {
    const { night, morning } = nightAndMorning();
    const alive = morning.players.find((p) => isAlive(p))!;
    const here = `${canMove(morning, alive)}/${canMove(night, night.players[0]!)}`;
    const unlock = lockCause();
    try {
      expect(`${here}/${canMove(morning, alive)}`).toBe("true/false/false");
    } finally {
      unlock();
    }
  });

  it("nearPhaseOf: 저녁은 언제나, 아침은 원인 흐름 판에서만 근처 단계다. 옛 확장판·기본판 아침은 아니다", () => {
    const { night, morning } = nightAndMorning();
    const evening = startedAt(6, SEED, "errand");
    const discussion = tick(morning, morning.phaseEndsAt!, seededRandInt(SEED + 2));
    const basic = startedFrom({ ...lobbyOf(6), mode: "basic" }, SEED, "discussion");
    const here = [evening, night, morning, discussion].map((s) => `${s.phase}:${nearPhaseOf(s)}`).join(",");
    const unlock = lockCause();
    let old: string;
    try {
      old = `${nearPhaseOf(morning)}/${nearPhaseOf({ ...basic, phase: "morning" })}`;
    } finally {
      unlock();
    }
    expect(`${here}|${old}`).toBe("errand:true,night:false,morning:true,discussion:false|false/false");
  });

  it("houseHome: 좌석마다 집 앞 좌표를 기억하고, 같은 일차면 입력 객체 그대로다", () => {
    const players = [
      { id: "a", seat: 0 },
      { id: "b", seat: 3 },
      { id: "c", seat: 7 },
    ];
    const w = { ...emptyWorld(), segs: Object.fromEntries(players.map((p, i) => [p.id, restSegment(i * 50, i * 50, 0)])) };
    const home = houseHome(w, players, FRONTS, 2);
    const pos = Object.entries(home.home?.pos ?? {}).map(([id, p]) => `${id}=${p[0]},${p[1]}`).join(" ");
    expect(`${home.home?.day}|${pos}|${houseHome(home, players, FRONTS, 2) === home}|${houseHome(home, players, FRONTS, 3).home?.day}`).toBe("2|a=100,-200 b=103,-203 c=107,-207|true|3");
  });

  it("layoutKey: 원인 흐름 토론은 '{일차}:board', 지목은 '{일차}:ring' 이다. 옛 확장판·기본판 토론은 null 이다", () => {
    const { morning } = nightAndMorning();
    const discussion = tick(morning, morning.phaseEndsAt!, seededRandInt(SEED + 2));
    const day = discussion.day ?? 0;
    const here = `${discussion.phase}:${layoutKey(discussion)}|${layoutKey({ ...discussion, phase: "nomination" })}`;
    const unlock = lockCause();
    let old: string | null;
    try {
      old = layoutKey(discussion);
    } finally {
      unlock();
    }
    const basic = startedFrom({ ...lobbyOf(6), mode: "basic" }, SEED, "discussion");
    expect(`${here}|${old}|${layoutKey(basic)}`).toBe(`discussion:${day}:board|${day}:ring|null|null`);
  });

  it("audience·worldVisibleTo: 원인 흐름 아침의 산 mover 걸음은 본인 + 유령만 받고, 산 viewer 는 본인 한 칸만 본다. 유령 viewer 는 모두를 본다", () => {
    const { morning } = nightAndMorning();
    const alive = morning.players.filter((p) => isAlive(p));
    const ghosts = morning.players.filter((p) => !isAlive(p));
    const mover = alive[0]!;
    const got = [...audience(morning, { k: "world", mover: mover.id })].sort().join(",");
    const want = [mover.id, ...ghosts.map((g) => g.id)].sort().join(",");
    const seen = [...worldVisibleTo(morning, alive[1]!.id)].join(",");
    const ghostSees = worldVisibleTo(morning, ghosts[0]!.id).size;
    expect(`${got === want}|${seen === alive[1]!.id}|${ghostSees}`).toBe(`true|true|${morning.players.length}`);
  });

  it("아침 진입이 근처 표본 시각을 정하고(진입 마감 + 한 간격) nextWakeAt 이 그 시각을 따른다. 옛 확장판 아침·밤은 따르지 않는다", () => {
    let s = startedAt(6, SEED, "errand");
    for (let guard = 0; s.phase !== "night"; guard += 1) s = tick(s, s.phaseEndsAt!, seededRandInt(SEED + 1 + guard));
    const [m1, m2] = withRole(s, "mafia") as [Player, Player];
    const [victim, c2] = withRole(s, "citizen") as [Player, Player];
    for (const actor of [m1, m2, c2]) {
      const r = pickTarget(s, actor.id, victim.seat);
      if (!r.ok) throw new Error(`pickTarget rejected: ${r.error}`);
      s = r.state;
    }
    const closedAt = s.phaseEndsAt!;
    const morning = tick(s, closedAt, seededRandInt(SEED + 100));
    const early: RoomState = { ...morning, errandTickAt: 5 };
    const asNight: RoomState = { ...early, phase: "night" };
    const unlock = lockCause();
    let old: number;
    try {
      old = nextWakeAt(early);
    } finally {
      unlock();
    }
    expect(`${morning.errandTickAt === closedAt + ERRAND_TICK_MS}|${nextWakeAt(early)}|${nextWakeAt(asNight) === 5}|${old === 5}`).toBe("true|5|false|false");
  });
});
