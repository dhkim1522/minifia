// 21-05 건너뛰기(D-21·D-23, 결정 0088): 확장판 저녁·아침에 산 사람이 누르고 과반이면 그 단계를 곧바로 마감한다. 공개 값은 누른 수뿐이고 누가 눌렀는지는 서버 전용이다.
// 상태는 실제 전이(startGame → tick)와 실제 규칙 함수(pickTarget·toggleSkip)로만 만든다. 잠금(setup 이 원인 흐름을 잠근다) 아래에서는 openCause·openTown 으로 새 흐름을 연다.
// 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표·슬래시로 이은 문자열로 비교한다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { pickTarget } from "../../shared/game/night";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { clearSkip, skipCountOf, skipReached, toggleSkip } from "../../shared/game/skip";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { lockCause, openCause, openTown } from "../helpers/playable";
import { seededRandInt } from "../helpers/seededRandom";
import { lobbyOf, startedAt, startedFrom } from "../helpers/voteState";

const SEED = 11;
const withRole = (s: RoomState, role: RoleId): Player[] => s.players.filter((p) => p.role === role).sort((a, b) => a.seat - b.seat);
const idOf = (s: RoomState, n: number): string => s.players[n]!.id;
const rowOf = (s: RoomState, id: string): Player => s.players.find((p) => p.id === id)!;

/** 누르기(on true)를 사람 n 명이 차례로. 거절이면 던진다. */
function press(s: RoomState, ids: readonly string[], on = true): RoomState {
  return ids.reduce((acc, id) => {
    const r = toggleSkip(acc, id, on);
    if (!r.ok) throw new Error(`toggleSkip rejected ${id}: ${r.error}`);
    return r.state;
  }, s);
}
const voters = (s: RoomState): string => s.players.filter((p) => p.skipVote === true).map((p) => p.seat).join(",");

/** 저녁 → 밤 → (마피아 둘·시민이 시민 한 명을 골라) 아침(피해자 있음, 현장 있음). */
function victimMorning(evening: RoomState): RoomState {
  let s = evening;
  for (let guard = 0; s.phase !== "night"; guard += 1) {
    if (s.phaseEndsAt === null || guard > 20) throw new Error(`cannot reach night (stuck at ${s.phase})`);
    s = tick(s, s.phaseEndsAt, seededRandInt(SEED + 1 + guard));
  }
  const [m1, m2] = withRole(s, "mafia") as [Player, Player];
  const [victim, c2] = withRole(s, "citizen") as [Player, Player];
  for (const actor of [m1, m2, c2]) {
    const r = pickTarget(s, actor.id, victim.seat);
    if (!r.ok) throw new Error(`pickTarget rejected: ${r.error}`);
    s = r.state;
  }
  const morning = tick(s, s.phaseEndsAt!, seededRandInt(SEED + 100));
  if (morning.phase !== "morning") throw new Error(`expected morning, got ${morning.phase}`);
  return morning;
}

describe("건너뛰기 — 원인 흐름 저녁·아침 (openCause + openTown)", () => {
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

  it("저녁에 누르면 그 사람의 skipVote 가 서고 수가 1 이다. 같은 값을 다시 보내면 입력 상태 그대로이고, 취소하면 키째 지운다", () => {
    const evening = startedAt(6, SEED, "errand");
    const a = idOf(evening, 0);
    const r = toggleSkip(evening, a, true);
    expect(r.ok && `${rowOf(r.state, a).skipVote}/${skipCountOf(r.state)}`).toBe("true/1");
    const again = toggleSkip(r.ok ? r.state : evening, a, true);
    expect(again.ok && r.ok && again.state === r.state).toBe(true);
    const off = toggleSkip(r.ok ? r.state : evening, a, false);
    expect(off.ok && `${Object.hasOwn(rowOf(off.state, a), "skipVote")}/${skipCountOf(off.state)}`).toBe("false/0");
    const offAgain = toggleSkip(evening, a, false);
    expect(offAgain.ok && offAgain.state === evening).toBe(true);
  });

  it("아침에도 같은 규칙이다(피해자가 나온 아침)", () => {
    const morning = victimMorning(startedAt(6, SEED, "errand"));
    const a = morning.players.find((p) => isAlive(p))!.id;
    const r = toggleSkip(morning, a, true);
    expect(r.ok && skipCountOf(r.state)).toBe(1);
  });

  it("토론·밤 단계와 잠긴 옛 확장판·기본판은 WRONG_PHASE 다", () => {
    const evening = startedAt(6, SEED, "errand");
    const id = idOf(evening, 0);
    const night = tick(evening, evening.phaseEndsAt!, seededRandInt(SEED + 1));
    const discussion = victimMorning(evening);
    const wrong = [night, tick(discussion, discussion.phaseEndsAt!, seededRandInt(SEED + 2))].map((s) => `${s.phase}:${JSON.stringify(toggleSkip(s, id, true))}`);
    expect(wrong.map((w) => w.replace(/"state":.*$/, "")).join("|")).toBe('night:{"ok":false,"error":"WRONG_PHASE"}|discussion:{"ok":false,"error":"WRONG_PHASE"}');
    // 잠금 아래(원인 흐름 꺼짐)에서는 같은 저녁도 WRONG_PHASE — 옛 확장판이다.
    const unlock = lockCause();
    try {
      expect(JSON.stringify(toggleSkip(evening, id, true))).toBe('{"ok":false,"error":"WRONG_PHASE"}');
    } finally {
      unlock();
    }
    // 기본 마피아: 토론 단계도 저녁도 없다.
    const basic = startedFrom({ ...lobbyOf(6), mode: "basic" }, SEED, "discussion");
    expect(JSON.stringify(toggleSkip(basic, idOf(basic, 0), true))).toBe('{"ok":false,"error":"WRONG_PHASE"}');
  });

  it("유령·방에 없는 사람·불리언이 아닌 값은 BAD_MESSAGE 다", () => {
    const evening = startedAt(6, SEED, "errand");
    const dead: RoomState = { ...evening, players: evening.players.map((p, i) => (i === 1 ? { ...p, alive: false } : p)) };
    const bad = [toggleSkip(dead, idOf(dead, 1), true), toggleSkip(dead, "nobody", true), toggleSkip(dead, idOf(dead, 0), "yes" as unknown as boolean), toggleSkip(dead, idOf(dead, 0), 1 as unknown as boolean)];
    expect(bad.map((r) => (r.ok ? "ok" : r.error)).join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE,BAD_MESSAGE,BAD_MESSAGE");
  });

  it("산 다섯 중 셋이 누르면 과반이고 둘이면 아니다. 죽은 사람의 남은 표는 세지 않는다", () => {
    const evening = startedAt(6, SEED, "errand");
    const five: RoomState = { ...evening, players: evening.players.map((p, i) => (i === 5 ? { ...p, alive: false, skipVote: true as const } : p)) };
    const ids = five.players.map((p) => p.id);
    const two = press(five, ids.slice(0, 2));
    const three = press(five, ids.slice(0, 3));
    expect(`${skipCountOf(two)}/${skipReached(two)}/${skipCountOf(three)}/${skipReached(three)}`).toBe("2/false/3/true");
  });

  it("clearSkip 은 모든 사람의 skipVote 를 키째 지우고, 지울 것이 없으면 입력 그대로다", () => {
    const evening = startedAt(6, SEED, "errand");
    const marked = press(evening, evening.players.slice(0, 3).map((p) => p.id));
    const cleared = clearSkip(marked);
    expect(`${voters(marked)}|${voters(cleared)}|${cleared.players.some((p) => Object.hasOwn(p, "skipVote"))}|${clearSkip(evening) === evening}`).toBe("0,1,2||false|true");
  });

  it("저녁에 둘이 누른 뒤 밤을 지나 아침에 들어서면 skipVote 가 아무에게도 없다(저녁 표가 아침에 새지 않는다)", () => {
    const evening = startedAt(6, SEED, "errand");
    const marked = press(evening, evening.players.slice(0, 2).map((p) => p.id));
    const morning = victimMorning(marked);
    expect(`${voters(marked)}|${voters(morning)}|${skipCountOf(morning)}`).toBe("0,1||0");
  });

  it("view: 저녁·아침의 day.skipCount 는 모두에게 같은 수이고 me.skip 은 누른 본인 view 에만 있다. 토론 view 에는 두 키가 없다", () => {
    const evening = startedAt(6, SEED, "errand");
    const marked = press(evening, [idOf(evening, 0), idOf(evening, 3)]);
    const counts = marked.players.map((p) => (buildView(marked, p.id, 0).day as { skipCount?: number } | undefined)?.skipCount);
    const mine = marked.players.map((p) => ((buildView(marked, p.id, 0).me as { skip?: true }).skip === true ? p.seat : "-")).join(",");
    expect(`${counts.join(",")}|${mine}`).toBe("2,2,2,2,2,2|0,-,-,3,-,-");
    const morning = victimMorning(marked);
    const pressed = press(morning, [morning.players.find((p) => isAlive(p))!.id]);
    const morningCounts = pressed.players.filter((p) => isAlive(p)).map((p) => (buildView(pressed, p.id, 0).day as { skipCount?: number } | undefined)?.skipCount);
    expect(morningCounts.join(",")).toBe("1,1,1,1,1");
    const discussion = tick(morning, morning.phaseEndsAt!, seededRandInt(SEED + 2));
    const view = buildView(discussion, discussion.players[0]!.id, 0);
    expect(`${discussion.phase}|${Object.hasOwn(view.day ?? {}, "skipCount")}|${Object.hasOwn(view.me ?? {}, "skip")}`).toBe("discussion|false|false");
  });
});
