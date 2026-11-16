// 10-08 Task 1: 동작(emote) 수신자 표 — 모든 단계 × 신분. UI-SPEC A-6 에서 손으로 옮겨 적은 기대 규칙을 구현(audience.ts)과 독립으로 계산해 맞춘다.
// 이 파일은 shared/game/audience.ts 의 CHAT_PHASES 를 읽지 않는다. 새 PhaseId 가 생기면 KIND 표가 컴파일 시(Record<PhaseId,…>)와 실행 시(PHASE_DEFS 키 비교) 둘 다 먼저 실패한다.
// 알 수 없는 단계는 "없음"이 기본이 아니라 시험 실패다(expectedEmoteRecipients 가 던진다).
import { describe, expect, it } from "vitest";
import { audience, channelOf } from "../../shared/game/audience";
import { canMoveIn, MAP_PHASES } from "../../shared/game/movement";
import { PHASE_DEFS } from "../../shared/game/phases";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId } from "../../shared/protocol";
import { lobbyOf } from "../helpers/voteState";

/** A-6 의 단계 묶음. Record<PhaseId,…> 라 PhaseId 가 늘면 이 줄이 컴파일 오류가 된다. */
type Kind = "lobby" | "day" | "night" | "silent";
const KIND: Record<PhaseId, Kind> = {
  lobby: "lobby",
  assigning: "silent",
  roleReveal: "silent",
  dayAnnounce: "day",
  errand: "silent", // 15페이즈: 심부름 단계는 채팅·동작을 받지 않는다(CHAT_PHASES 밖, 결정 0074) — 걷기와 처리만
  discussion: "day",
  nomination: "day",
  runoff: "day",
  showdown: "day",
  defense: "day",
  verdict: "day",
  execution: "day",
  night: "night",
  morning: "day",
  ended: "silent",
};

/** 6명 판의 역할: 마피아 seat 1·4, 경찰 3, 의사 5, 시민 0·2. */
const ROLES: Record<number, RoleId> = { 0: "citizen", 1: "mafia", 2: "citizen", 3: "police", 4: "mafia", 5: "doctor" };
const idOf = (seat: number): string => `player-id-000${seat}-aaaa`;

function sixAt(phase: PhaseId, deadSeats: readonly number[]): RoomState {
  const base = lobbyOf(6);
  const dead = new Set(deadSeats);
  return {
    ...base,
    phase,
    day: phase === "lobby" ? undefined : 1,
    players: base.players.map((p): Player => ({ ...p, role: ROLES[p.seat], alive: dead.has(p.seat) ? false : undefined })),
  };
}

/** 보낸 사람 신분 여섯: 산 시민·경찰·의사·마피아와 탈락한 시민·탈락한 마피아(둘 다 같은 판 안에서 따로 만든다). */
const SENDERS = [
  { name: "산 시민", seat: 0, dead: [] as number[] },
  { name: "산 경찰", seat: 3, dead: [] as number[] },
  { name: "산 의사", seat: 5, dead: [] as number[] },
  { name: "산 마피아", seat: 1, dead: [] as number[] },
  { name: "탈락한 시민", seat: 2, dead: [2] },
  { name: "탈락한 마피아", seat: 4, dead: [4] },
] as const;

/** A-6 표를 그대로 옮긴 기대 수신자(좌석 오름차순 문자열). 구현을 부르지 않고 단계 이름·신분만 본다. */
function expectedEmoteRecipients(phase: PhaseId, sender: { seat: number }, players: ReadonlyArray<{ seat: number; alive: boolean; role: RoleId }>): string {
  const kind = KIND[phase];
  if (kind === undefined) throw new Error(`알 수 없는 단계 ${String(phase)} — KIND 표에 A-6 규칙을 먼저 적는다`);
  const me = players.find((p) => p.seat === sender.seat)!;
  const pick = (pred: (p: { seat: number; alive: boolean; role: RoleId }) => boolean): string =>
    players.filter(pred).map((p) => p.seat).sort((a, b) => a - b).join(",");
  switch (kind) {
    case "silent":
      return "";
    case "lobby":
      return pick(() => true); // 로비 누구나 → 방 모두
    case "day":
      return me.alive ? pick(() => true) : pick((p) => !p.alive); // 산 사람 → 산 사람 + 탈락자, 탈락자 → 탈락자
    case "night":
      if (!me.alive) return pick((p) => !p.alive); // 탈락자 → 탈락자
      return me.role === "mafia" ? pick((p) => !p.alive || p.role === "mafia") : ""; // 산 마피아 → 산 마피아 + 탈락자, 나머지 → 버림
  }
}

/** 구현의 결과: channelOf 가 정한 채널의 emote 수신자(좌석 오름차순 문자열). 채널이 없으면 버림("") 이다. */
function actualRecipients(state: RoomState, senderId: string): string {
  const ch = channelOf(state, senderId);
  if (ch === null) return "";
  const ids = audience(state, { k: "emote", ch });
  return state.players
    .filter((p) => ids.has(p.id))
    .map((p) => p.seat)
    .sort((a, b) => a - b)
    .join(",");
}

const view = (s: RoomState): Array<{ seat: number; alive: boolean; role: RoleId }> =>
  s.players.map((p) => ({ seat: p.seat, alive: p.alive !== false, role: p.role as RoleId }));

describe("동작 수신자 표 — 단계 × 신분 (UI-SPEC A-6, D-12·D-14)", () => {
  it("KIND 표는 PHASE_DEFS 의 모든 단계를 빠짐없이 갖는다(새 단계가 생기면 이 시험이 먼저 실패한다)", () => {
    expect(Object.keys(KIND).sort().join(",")).toBe(Object.keys(PHASE_DEFS).sort().join(","));
  });

  it("A-6 의 낮 단계는 정확히 아홉이다(dayAnnounce discussion nomination runoff showdown defense verdict execution morning)", () => {
    const day = (Object.keys(KIND) as PhaseId[]).filter((k) => KIND[k] === "day");
    expect(day.sort().join(",")).toBe(["dayAnnounce", "defense", "discussion", "execution", "morning", "nomination", "runoff", "showdown", "verdict"].join(","));
  });

  const phases = Object.keys(KIND) as PhaseId[];
  for (const phase of phases) {
    for (const s of SENDERS) {
      // 로비에는 탈락자가 없다.
      if (phase === "lobby" && s.dead.length > 0) continue;
      it(`${phase} · ${s.name}: 구현의 수신자가 A-6 기대표와 같다`, () => {
        const state = sixAt(phase, s.dead);
        const want = expectedEmoteRecipients(phase, { seat: s.seat }, view(state));
        expect(actualRecipients(state, idOf(s.seat))).toBe(want);
      });
    }
  }

  it("기대표는 구현의 CHAT_PHASES 를 읽지 않고도 아홉 낮 단계의 산 사람 → 방 모두(탈락자 포함)로 계산된다", () => {
    const s = sixAt("nomination", [2]);
    expect(expectedEmoteRecipients("nomination", { seat: 0 }, view(s))).toBe("0,1,2,3,4,5");
    expect(expectedEmoteRecipients("nomination", { seat: 2 }, view(s))).toBe("2");
    const n = sixAt("night", [2]);
    expect(expectedEmoteRecipients("night", { seat: 1 }, view(n))).toBe("1,2,4");
    expect(expectedEmoteRecipients("night", { seat: 0 }, view(n))).toBe("");
  });

  it("알 수 없는 단계는 기대표가 던진다(없음이 기본값이 아니다)", () => {
    const s = sixAt("discussion", []);
    expect(() => expectedEmoteRecipients("brandNew" as PhaseId, { seat: 0 }, view(s))).toThrow(/알 수 없는 단계/);
  });
});

describe("동작은 이동 차단과 무관하다 (AVTR-05, movement.ts 머리 주석)", () => {
  const blockedDay = [...MAP_PHASES].filter((p) => p !== "night" && !canMoveIn(p, true));

  it("이동이 막힌 낮 지도 단계가 지목·결선·마지막 3인·변론·찬반·처형·아침을 포함한다", () => {
    expect(blockedDay.sort().join(",")).toBe(["defense", "execution", "morning", "nomination", "runoff", "showdown", "verdict"].join(","));
  });

  it.each([...new Set(blockedDay)])("%s: canMoveIn 이 산 사람에게 거짓이어도 산 사람의 동작 수신자는 비어 있지 않고 보낸 사람 자신이 든다", (phase) => {
    const state = sixAt(phase, [2]);
    for (const s of SENDERS.filter((x) => x.dead.length === 0)) {
      const got = actualRecipients(state, idOf(s.seat));
      expect(got).not.toBe("");
      expect(got.split(",").map(Number)).toContain(s.seat);
    }
  });

  it("밤 시민 편은 이동도 동작도 막히고, 산 마피아는 이동이 막혀도(15페이즈 D-05 — 누구도 밤에 걷지 않는다) 동작은 된다", () => {
    const night = sixAt("night", [2]);
    expect(canMoveIn("night", true)).toBe(false);
    expect(actualRecipients(night, idOf(0))).toBe("");
    expect(canMoveIn("night", true)).toBe(false);
    expect(actualRecipients(night, idOf(1))).not.toBe("");
  });
});
