// 저녁·아침 [건너뛰기] 판정과 view (21-05 Task 2, D-23, 위협 T-21-12) — 순수 규칙 시험.
// 실패 출력은 한 줄이어야 해서(TAP) 값은 JSON 문자열로 견준다.
import { describe, expect, it } from "vitest";
import { hooksOf } from "../../shared/game/tick";
import { rulesetOf } from "../../shared/game/ruleset";
import type { RoomState } from "../../shared/game/room";
import { SKIP_PHASES, clearSkip, skipCountOf, skipReached, toggleSkip } from "../../shared/game/skip";
import { buildView } from "../../shared/game/view";
import { ClientMessageSchema } from "../../shared/schemas";
import type { PhaseId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { startedAt } from "../helpers/voteState";

const NOW = 50_000;
const json = (v: unknown): string => JSON.stringify(v);
/** 확장판 저녁 4명 판. */
const evening = (): RoomState => startedAt(4, 5, "errand");
const at = (s: RoomState, phase: PhaseId): RoomState => ({ ...s, phase });
const press = (s: RoomState, seats: number[]): RoomState => ({ ...s, players: s.players.map((p) => (seats.includes(p.seat) ? { ...p, skipVote: true as const } : p)) });
const reject = (r: ReturnType<typeof toggleSkip>): string => (r.ok ? "ok" : r.error);

describe("toggleSkip — 검사 순서는 toggleEnd 와 같다 (D-23)", () => {
  it("SKIP_PHASES 는 errand·morning", () => {
    expect(json([...SKIP_PHASES])).toBe('["errand","morning"]');
  });

  it("errand·morning 밖은 WRONG_PHASE, 기본 마피아 판의 아침도 WRONG_PHASE", () => {
    const s = evening();
    const got = (["night", "discussion", "nomination", "lobby"] as const).map((ph) => reject(toggleSkip(at(s, ph), s.players[0]!.id, true)));
    got.push(reject(toggleSkip({ ...at(s, "morning"), mode: "basic" }, s.players[0]!.id, true)));
    expect(json(got)).toBe(json(Array(5).fill("WRONG_PHASE")));
  });

  it("방에 없는 사람·죽은 사람은 BAD_MESSAGE, 불리언이 아니면 BAD_MESSAGE", () => {
    const s = evening();
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.seat === 1 ? { ...p, alive: false } : p)) };
    const got = [reject(toggleSkip(s, "ghost-id", true)), reject(toggleSkip(dead, dead.players[1]!.id, true)), reject(toggleSkip(s, s.players[0]!.id, "yes" as unknown as boolean))];
    expect(json(got)).toBe('["BAD_MESSAGE","BAD_MESSAGE","BAD_MESSAGE"]');
  });

  it("같은 값이면 같은 객체, on true·false 가 그 사람의 skipVote 만 넣고 뺀다(errand·morning 모두)", () => {
    const s = evening();
    const id = s.players[0]!.id;
    const same = toggleSkip(s, id, false);
    const pushed = toggleSkip(s, id, true);
    const m = at(s, "morning");
    const pushedM = toggleSkip(m, id, true);
    expect(json([same.ok && same.state === s, pushed.ok && pushed.state.players.map((p) => p.skipVote === true), pushedM.ok && skipCountOf(pushedM.state)])).toBe("[true,[true,false,false,false],1]");
    const off = pushed.ok ? toggleSkip(pushed.state, id, false) : null;
    expect(json(off?.ok && off.state.players.map((p) => "skipVote" in p))).toBe("[false,false,false,false]");
  });
});

describe("skipCountOf·skipReached·clearSkip", () => {
  it("skipCountOf 는 산 사람만 센다(죽은 사람의 남은 눌림은 세지 않는다)", () => {
    const s = press(evening(), [0, 1, 2]);
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.seat === 2 ? { ...p, alive: false } : p)) };
    expect(`${skipCountOf(s)}:${skipCountOf(dead)}`).toBe("3:2");
  });

  it("skipReached 는 산 사람 모두가 눌렀을 때만 true(넷 중 셋은 false), 산 사람이 0이면 false", () => {
    const s = evening();
    const none: RoomState = { ...s, players: s.players.map((p) => ({ ...p, alive: false })) };
    expect(json([skipReached(press(s, [0, 1, 2])), skipReached(press(s, [0, 1, 2, 3])), skipReached(none)])).toBe("[false,true,false]");
    const dead: RoomState = { ...press(s, [0, 1, 2]), players: press(s, [0, 1, 2]).players.map((p) => (p.seat === 3 ? { ...p, alive: false } : p)) };
    expect(skipReached(dead)).toBe(true); // 산 사람 셋이 모두 눌렀다
  });

  it("clearSkip 은 모든 skipVote 키를 지우고, 없으면 같은 객체다", () => {
    const s = evening();
    const cleared = clearSkip(press(s, [0, 2]));
    expect(json([cleared.players.some((p) => "skipVote" in p), clearSkip(s) === s])).toBe("[false,true]");
  });

  it("errand·morning 진입 훅 뒤 상태에는 skipVote 키가 없다(전 단계의 눌림이 남지 않는다)", () => {
    const hooks = hooksOf(rulesetOf("extended"));
    const dirty = press(evening(), [0, 1, 2, 3]);
    const viaErrand = hooks.enter.errand!(dirty, seededRandInt(9), NOW);
    const viaMorning = hooks.enter.morning!(at(dirty, "night"), seededRandInt(9), NOW);
    expect(json([viaErrand.players.some((p) => "skipVote" in p), viaMorning.players.some((p) => "skipVote" in p)])).toBe("[false,false]");
  });
});

describe("buildView — day.skipCount·me.skipPhase (D-23)", () => {
  const viewsOf = (s: RoomState): Array<ReturnType<typeof buildView>> => s.players.map((p) => buildView(s, p.id, NOW));

  it("errand·morning 의 모든 view 에 day.skipCount(숫자), 누른 산 본인에게만 me.skipPhase true", () => {
    for (const phase of ["errand", "morning"] as const) {
      const vs = viewsOf(at(press(evening(), [0, 2]), phase));
      expect(`${phase} ${json(vs.map((v) => v.day?.skipCount))} ${json(vs.map((v) => v.me.skipPhase))}`).toBe(`${phase} [2,2,2,2] [true,null,true,null]`);
    }
  });

  it("다른 단계(night·discussion)와 기본 마피아에는 두 키가 없다", () => {
    const base = press(evening(), [0, 2]);
    const keys = (s: RoomState): string => json(viewsOf(s).map((v) => `${"skipCount" in (v.day ?? {})}/${"skipPhase" in v.me}`));
    const off = [keys(at(base, "night")), keys(at(base, "discussion")), keys({ ...at(base, "errand"), mode: "basic" }), keys({ ...at(base, "morning"), mode: "basic" })];
    expect(json(off)).toBe(json(Array(4).fill(json(Array(4).fill("false/false")))));
  });

  it("어떤 단계·어떤 view JSON 에도 skipVote 가 없다", () => {
    const hits = (["errand", "morning", "night", "discussion"] as const).map((phase) => viewsOf(at(press(evening(), [0, 1, 2, 3]), phase)).some((v) => json(v).includes("skipVote")));
    expect(json(hits)).toBe("[false,false,false,false]");
  });
});

describe("스키마 — skipPhase", () => {
  const ok = (m: unknown): boolean => ClientMessageSchema.safeParse(m).success;
  it("{t:skipPhase,on:true} 는 받고 on 없음·문자열·덧붙은 키는 거절", () => {
    expect(json([ok({ t: "skipPhase", on: true }), ok({ t: "skipPhase", on: false }), ok({ t: "skipPhase" }), ok({ t: "skipPhase", on: "true" }), ok({ t: "skipPhase", on: true, seat: 1 })])).toBe("[true,true,false,false,false]");
  });
});
