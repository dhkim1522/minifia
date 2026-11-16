// 19-01: 판 종류(결정 0081-6, D-01·D-02·D-05·D-06·D-08) — 규칙 표·판별·고르기·다음 단계. 순수 규칙만 본다(방 DO 는 test/worker/modePick·modeBasic).
import { describe, expect, it } from "vitest";
import { pickMode } from "../../shared/game/mode";
import { enterNomination, enterVote, resolveNomination, stepNomination } from "../../shared/game/nomination";
import { PHASE_DEFS, nextPhaseOf } from "../../shared/game/phases";
import { rematch } from "../../shared/game/rematch";
import { attachConnection, createRoomState, joinRoom, normalizeStoredRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { modeOf, politicsOn, rulesetOf } from "../../shared/game/ruleset";
import type { Ruleset } from "../../shared/game/ruleset";
import { routeAfterDayAnnounce } from "../../shared/game/showdown";
import { resetToLobby } from "../../shared/game/testTools";
import { hooksOf, tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { DEFAULT_MODE, GAME_MODES } from "../../shared/protocol";
import type { GameMode, PhaseId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const HOST = "player-id-0000-aaaa";
const GUEST = "player-id-0001-aaaa";

function lobby(n = 4): RoomState {
  const created = createRoomState({ code: "0420", hostId: HOST, hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: "이름0", now: 0 });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, HOST, "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 시작한 판(역할 배정 끝, assigning). */
function started(n = 4): RoomState {
  const r = startGame(lobby(n), HOST, 1000, seededRandInt(1));
  if (!r.ok) throw new Error("start failed");
  return r.state;
}

const POLITICS = ["badge", "whisper", "pickTurn", "runoff", "showdown"] as const;
const flags = (mode: GameMode, keys: readonly string[]): string => {
  const rules = rulesetOf(mode) as unknown as Record<string, unknown>;
  return keys.map((k) => `${k}:${String(rules[k])}`).join(" ");
};

describe("판 종류 값 (D-01)", () => {
  it("GAME_MODES 는 basic·extended 두 값이고 기본값은 extended 다", () => {
    expect([...GAME_MODES].join(",")).toBe("basic,extended");
    expect(DEFAULT_MODE).toBe("extended");
  });
});

describe("rulesetOf (D-02)", () => {
  it("규칙 필드는 정치 장치 다섯뿐이다(22페이즈에서 errand·witness·trace 가 지워졌다)", () => {
    expect(Object.keys(rulesetOf("basic")).sort().join(",")).toBe("badge,pickTurn,runoff,showdown,whisper");
    expect(Object.keys(rulesetOf("extended")).sort().join(",")).toBe("badge,pickTurn,runoff,showdown,whisper");
  });
  it("정치 장치 다섯은 두 판 모두 꺼짐이다", () => {
    const off = "badge:false whisper:false pickTurn:false runoff:false showdown:false";
    expect(`${flags("basic", POLITICS)} / ${flags("extended", POLITICS)}`).toBe(`${off} / ${off}`);
  });
  it("두 규칙 객체는 얼려 있고 서로 다른 객체이며 같은 판은 같은 객체를 돌려준다", () => {
    const basic = rulesetOf("basic");
    const extended = rulesetOf("extended");
    expect(`${Object.isFrozen(basic)}/${Object.isFrozen(extended)}/${basic !== extended}/${rulesetOf("basic") === basic}/${rulesetOf("extended") === extended}`).toBe("true/true/true/true/true");
  });
  it("politicsOn 은 두 판 모두 거짓이고 정치 장치 하나라도 켜면 참이다", () => {
    expect(`${politicsOn(rulesetOf("basic"))}/${politicsOn(rulesetOf("extended"))}/${politicsOn({ ...rulesetOf("extended"), runoff: true })}`).toBe("false/false/true");
  });
});

describe("modeOf (D-01·D-04)", () => {
  it("mode 가 없으면 extended 다", () => {
    expect(modeOf({})).toBe("extended");
  });
  it("mode 가 basic 이면 basic 이다", () => {
    expect(modeOf({ mode: "basic" })).toBe("basic");
  });
  it("허용 밖 값(foo·숫자·null)은 extended 로 읽는다", () => {
    expect([modeOf({ mode: "foo" }), modeOf({ mode: 1 }), modeOf({ mode: null }), modeOf({ mode: "toString" })].join(",")).toBe("extended,extended,extended,extended");
  });
});

describe("pickMode (D-05·D-06, L40)", () => {
  const outcome = (r: { ok: boolean }): string => (r.ok ? "ok" : "no");
  it("방장이 대기실에서 basic 을 고르면 받아들이고 state.mode 가 basic 이다", () => {
    const r = pickMode(lobby(), HOST, "basic");
    expect(r.ok && r.state.mode).toBe("basic");
  });
  it("같은 값(기본 extended 포함)이면 입력 객체 그대로다", () => {
    const s = lobby();
    const a = pickMode(s, HOST, "extended");
    expect(a.ok && a.state === s).toBe(true);
    const picked: RoomState = { ...s, mode: "basic" };
    const b = pickMode(picked, HOST, "basic");
    expect(b.ok && b.state === picked).toBe(true);
  });
  it("값이 바뀌어도 입력 상태는 건드리지 않는다", () => {
    const s = lobby();
    const before = JSON.stringify(s);
    const r = pickMode(s, HOST, "basic");
    expect(`${r.ok}/${JSON.stringify(s) === before}/${"mode" in s}`).toBe("true/true/false");
  });
  it("방장이 아니면 거절", () => {
    expect(outcome(pickMode(lobby(), GUEST, "basic"))).toBe("no");
  });
  it("대기실·ended 가 아닌 단계는 거절이고 ended 에서는 받아들인다 (D-06)", () => {
    const s = started();
    const phases = ["assigning", "roleReveal", "dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning"] as const;
    expect(phases.map((phase) => `${phase}:${outcome(pickMode({ ...s, phase }, HOST, "basic"))}`).join(" ")).toBe(phases.map((phase) => `${phase}:no`).join(" "));
    const ended = pickMode({ ...s, phase: "ended" }, HOST, "basic");
    expect(ended.ok && ended.state.mode).toBe("basic");
  });
  it("허용 밖 값은 거절", () => {
    expect(outcome(pickMode(lobby(), HOST, "fast" as GameMode))).toBe("no");
  });
});

describe("nextPhaseOf (22페이즈: 두 판 모두 단계 표의 next 그대로)", () => {
  it("낮 시작 발표 다음은 두 판 모두 토론이다", () => {
    expect(nextPhaseOf("dayAnnounce")).toBe("discussion");
  });
  it("모든 단계가 단계 표의 next 와 같다", () => {
    const all = Object.keys(PHASE_DEFS) as PhaseId[];
    const want = all.map((p) => `${p}>${PHASE_DEFS[p].next}`).join(" ");
    expect(all.map((p) => `${p}>${nextPhaseOf(p)}`).join(" ")).toBe(want);
  });
});

describe("tick — 낮 흐름 (22페이즈: 두 판 모두 낮 시작 발표 다음이 토론)", () => {
  const atDayAnnounce = (extra: Partial<RoomState>): RoomState => ({ ...started(), phase: "dayAnnounce", day: 1, phaseEndsAt: 5000, ...extra });
  it("mode basic·extended·없음(옛 저장 방 포함) 모두 낮 시작 발표 마감 뒤 토론으로 간다", () => {
    const phases = [{ mode: "basic" as const }, { mode: "extended" as const }, {}].map((extra) => tick(atDayAnnounce(extra), 5000, seededRandInt(1)).phase);
    expect(phases.join(",")).toBe("discussion,discussion,discussion");
  });
});

describe("다시 하기·대기실 복귀 뒤에도 mode 가 남는다 (D-06)", () => {
  /** 끝난 판(전원 준비). */
  const ended = (extra: Partial<RoomState>): RoomState => {
    const s = started(4);
    return { ...s, phase: "ended", phaseEndsAt: null, winner: "citizenWin", ...extra, players: s.players.map((p) => ({ ...p, ready: true })) };
  };
  it("mode basic 인 ended 방의 다시 하기 결과는 mode basic 이다", () => {
    const r = rematch(ended({ mode: "basic" }), HOST, 1, 500_000, seededRandInt(2));
    expect(r.ok && `${r.state.phase}:${String(r.state.mode)}`).toBe("assigning:basic");
  });
  it("mode 없는 방의 다시 하기 결과에는 mode 키가 없다", () => {
    const r = rematch(ended({}), HOST, 1, 500_000, seededRandInt(2));
    expect(r.ok && `${r.state.phase}:${"mode" in r.state}`).toBe("assigning:false");
  });
  it("테스트 방 대기실 복귀(resetToLobby)는 mode basic 을 남긴다", () => {
    const r = resetToLobby({ ...started(4), testMode: true, mode: "basic" }, HOST);
    expect(r.ok && `${r.state.phase}:${String(r.state.mode)}`).toBe("lobby:basic");
  });
  it("mode 없는 테스트 방의 대기실 복귀 결과에는 mode 키가 없다", () => {
    const r = resetToLobby({ ...started(4), testMode: true }, HOST);
    expect(r.ok && `${r.state.phase}:${"mode" in r.state}`).toBe("lobby:false");
  });
});

describe("normalizeStoredRoom — 저장 방의 mode (D-04, T-19-05)", () => {
  it("mode 없는 저장 방은 같은 객체이고 view.mode 는 extended 다", () => {
    const stored = lobby(4);
    const out = normalizeStoredRoom(stored, 1000);
    expect(`${out === stored}/${String(buildView(out, HOST, 1000).mode)}`).toBe("true/extended");
  });
  it("올바른 값(basic·extended)이 저장된 방은 같은 객체다", () => {
    const a: RoomState = { ...lobby(4), mode: "basic" };
    const b: RoomState = { ...lobby(4), mode: "extended" };
    expect(`${normalizeStoredRoom(a, 1000) === a}/${normalizeStoredRoom(b, 1000) === b}`).toBe("true/true");
  });
  it("허용 밖 값(turbo)이 저장된 방은 mode 키가 빠진 새 객체이고 두 번째 정규화는 같은 객체다", () => {
    const stored = { ...lobby(4), mode: "turbo" } as unknown as RoomState;
    const once = normalizeStoredRoom(stored, 1000);
    const twice = normalizeStoredRoom(once, 1000);
    expect(`${once !== stored}/${"mode" in once}/${twice === once}/${String(buildView(once, HOST, 1000).mode)}`).toBe("true/false/true/extended");
  });
  it("허용 밖 값을 뺀 방은 나머지 키가 그대로다 (판 상태를 건드리지 않는다)", () => {
    const base = lobby(4);
    const once = normalizeStoredRoom({ ...base, mode: "turbo" } as unknown as RoomState, 1000);
    expect(JSON.stringify(once)).toBe(JSON.stringify(base));
  });
});

// ---- 19-02 Task 1: 서버 흐름이 방 상태의 판 규칙을 읽는다 (D-03) ----

/** 정치 장치를 켠 가짜 규칙 — 실제 두 판에는 없는 값이다. 규칙이 전역 값이 아니라 인자로 들어간다는 것만 보인다. */
const rulesWith = (on: Partial<Ruleset>): Ruleset => ({ ...rulesetOf("extended"), ...on });

/** 투표(nomination) 단계 상태. 표는 좌석 순번(0 부터) → 대상 순번으로 싣는다. */
function atVote(mode: GameMode | undefined, votes: Record<number, number>): RoomState {
  const base = started(4);
  const seats = base.players.map((p) => p.seat).sort((a, b) => a - b);
  return {
    ...base,
    ...(mode === undefined ? {} : { mode }),
    phase: "nomination",
    day: 1,
    phaseEndsAt: 9000,
    players: base.players.map((p) => {
      const to = votes[seats.indexOf(p.seat)];
      return to === undefined ? p : { ...p, nominate: seats[to]! };
    }),
  };
}
const TIE_OF_TWO = { 0: 1, 1: 0 }; // 한 표씩 둘 — 최다 득표자가 정확히 둘
const ONE_LEADER = { 0: 1, 2: 1 }; // 두 표 한 명

describe("hooksOf — 판마다 진입·마감 훅 표 (D-03)", () => {
  it("두 판 모두 투표 진입은 동시 투표(enterVote)이고 낮 시작 발표 마감 훅(결전 분기)이 없다", () => {
    const seen = GAME_MODES.map((mode) => {
      const hooks = hooksOf(rulesetOf(mode));
      return `${mode}:${hooks.enter.nomination === enterVote}/${hooks.deadline.dayAnnounce === undefined}`;
    });
    expect(seen.join(" ")).toBe("basic:true/true extended:true/true");
  });
  it("순차 지목을 켠 규칙의 표는 진입 enterNomination·마감 stepNomination 이고, 결전을 켠 규칙의 표는 낮 시작 발표 마감이 routeAfterDayAnnounce 다", () => {
    const turn = hooksOf(rulesWith({ pickTurn: true }));
    const duel = hooksOf(rulesWith({ showdown: true }));
    expect(`${turn.enter.nomination === enterNomination}/${turn.deadline.nomination === stepNomination}/${duel.deadline.dayAnnounce === routeAfterDayAnnounce}`).toBe("true/true/true");
  });
  it("두 판 모두 투표 마감 훅은 동시 투표 집계다 — 동점 둘이어도 결선 없이 두 판 모두 night, 최다 한 명이면 표의 기본 다음 단계(defense)", () => {
    const seen = GAME_MODES.map((mode) => {
      const close = hooksOf(rulesetOf(mode)).deadline.nomination!;
      const tie = close(atVote(mode, TIE_OF_TWO), 9000);
      const one = close(atVote(mode, ONE_LEADER), 9000);
      return `${mode}:${tie.stay}/${String(tie.next)}/${tie.state.runoff === undefined}|${one.stay}/${String(one.next)}`;
    });
    expect(seen.join(" ")).toBe("basic:false/night/true|false/undefined extended:false/night/true|false/undefined");
  });
  it("결선을 켠 규칙의 표는 같은 동점을 결선(runoff)으로 보낸다", () => {
    const close = hooksOf(rulesWith({ runoff: true })).deadline.nomination!;
    expect(String(close(atVote("extended", TIE_OF_TWO), 9000).next)).toBe("runoff");
  });
  it("같은 투표 상태를 지목 마감까지 tick 하면 최다 한 명은 세 방 모두 defense, 동점은 세 방 모두 night 이다", () => {
    const after = (mode: GameMode | undefined, votes: Record<number, number>): PhaseId => tick(atVote(mode, votes), 9000, seededRandInt(1)).phase;
    expect([after("basic", ONE_LEADER), after("extended", ONE_LEADER), after(undefined, ONE_LEADER)].join(",")).toBe("defense,defense,defense");
    expect([after("basic", TIE_OF_TWO), after("extended", TIE_OF_TWO), after(undefined, TIE_OF_TWO)].join(",")).toBe("night,night,night");
  });
});

describe("resolveNomination — 규칙은 두 번째 인자다 (D-03)", () => {
  it("결선을 켠 규칙을 넘기면 동점 둘은 runoff 로 가고 결선 상태(후보 둘)가 선다", () => {
    const r = resolveNomination(atVote("basic", TIE_OF_TWO), rulesWith({ runoff: true }));
    expect(`${String(r.next)}/${r.state.runoff?.cand.length ?? 0}`).toBe("runoff/2");
  });
  it("인자를 안 주면 방 mode 의 규칙(결선 꺼짐)이라 동점은 두 판 모두 night 이다", () => {
    const seen = GAME_MODES.map((mode) => String(resolveNomination(atVote(mode, TIE_OF_TWO)).next));
    expect(seen.join(",")).toBe("night,night");
  });
  it("결선을 켠 규칙이어도 최다 한 명이면 결선 없이 기본 다음 단계다", () => {
    const r = resolveNomination(atVote("extended", ONE_LEADER), rulesWith({ runoff: true }));
    expect(`${String(r.next)}/${r.state.verdict?.candidate !== undefined}`).toBe("undefined/true");
  });
});
