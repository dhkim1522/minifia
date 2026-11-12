// 19-01: 판 종류(결정 0081-6, D-01·D-02·D-05·D-06·D-08) — 규칙 표·판별·고르기·다음 단계. 순수 규칙만 본다(방 DO 는 test/worker/modePick·modeBasic).
import { describe, expect, it } from "vitest";
import { pickMode } from "../../shared/game/mode";
import { PHASE_DEFS, nextPhaseOf } from "../../shared/game/phases";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { modeOf, politicsOn, rulesetOf } from "../../shared/game/ruleset";
import { tick } from "../../shared/game/tick";
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
const EXTRAS = ["errand", "witness", "trace"] as const;
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
  it("basic 은 errand·witness·trace 가 모두 꺼짐이다", () => {
    expect(flags("basic", EXTRAS)).toBe("errand:false witness:false trace:false");
  });
  it("extended 는 errand·witness·trace 가 모두 켜짐이다", () => {
    expect(flags("extended", EXTRAS)).toBe("errand:true witness:true trace:true");
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
    const phases = ["tutorial", "assigning", "roleReveal", "dayAnnounce", "errand", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning"] as const;
    expect(phases.map((phase) => `${phase}:${outcome(pickMode({ ...s, phase }, HOST, "basic"))}`).join(" ")).toBe(phases.map((phase) => `${phase}:no`).join(" "));
    const ended = pickMode({ ...s, phase: "ended" }, HOST, "basic");
    expect(ended.ok && ended.state.mode).toBe("basic");
  });
  it("허용 밖 값은 거절", () => {
    expect(outcome(pickMode(lobby(), HOST, "fast" as GameMode))).toBe("no");
  });
});

describe("nextPhaseOf (D-08)", () => {
  it("basic 판은 낮 시작 발표 다음이 토론이다", () => {
    expect(nextPhaseOf("dayAnnounce", rulesetOf("basic"))).toBe("discussion");
  });
  it("extended 판은 낮 시작 발표 다음이 심부름이다", () => {
    expect(nextPhaseOf("dayAnnounce", rulesetOf("extended"))).toBe("errand");
  });
  it("그 밖의 단계는 두 판 모두 단계 표의 next 와 같다", () => {
    const others = (Object.keys(PHASE_DEFS) as PhaseId[]).filter((p) => p !== "dayAnnounce");
    const want = others.map((p) => `${p}>${PHASE_DEFS[p].next}`).join(" ");
    expect(others.map((p) => `${p}>${nextPhaseOf(p, rulesetOf("basic"))}`).join(" ")).toBe(want);
    expect(others.map((p) => `${p}>${nextPhaseOf(p, rulesetOf("extended"))}`).join(" ")).toBe(want);
  });
});

describe("tick — 판 종류에 따른 낮 흐름 (D-04·D-08)", () => {
  const atDayAnnounce = (extra: Partial<RoomState>): RoomState => ({ ...started(), phase: "dayAnnounce", day: 1, phaseEndsAt: 5000, ...extra });
  it("mode basic 인 낮 시작 발표는 마감 뒤 토론으로 간다", () => {
    expect(tick(atDayAnnounce({ mode: "basic" }), 5000, seededRandInt(1)).phase).toBe("discussion");
  });
  it("mode 없는 방(옛 저장 방 포함)은 마감 뒤 심부름으로 간다", () => {
    expect(tick(atDayAnnounce({}), 5000, seededRandInt(1)).phase).toBe("errand");
  });
  it("mode extended 는 마감 뒤 심부름으로 간다", () => {
    expect(tick(atDayAnnounce({ mode: "extended" }), 5000, seededRandInt(1)).phase).toBe("errand");
  });
  it("basic 판의 토론은 심부름 배정 없이 시작한다 — errandPlaces 를 가진 사람이 없다", () => {
    const s = tick(atDayAnnounce({ mode: "basic" }), 5000, seededRandInt(1));
    expect(s.players.filter((p) => p.errandPlaces !== undefined).length).toBe(0);
  });
});
