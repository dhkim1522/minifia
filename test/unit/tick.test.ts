import { describe, expect, it } from "vitest";
import {
  ASSIGNING_MS,
  DAY_ANNOUNCE_MS,
  DEFENSE_MS,
  DISCUSSION_MS,
  EXECUTION_MS,
  MORNING_MS,
  NIGHT_MS,
  NOMINATION_GATHER_MS,
  VERDICT_MS,
  PHASE_DEFS,
  ROLE_REVEAL_MS,
  nominationMaxMs,
} from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { enterDayAnnounce, nextWakeAt, tick } from "../../shared/game/tick";
import { seededRandInt } from "../helpers/seededRandom";
import { castPoints, castVerdicts, stateWithVerdict } from "../helpers/voteState";
import type { PhaseId } from "../../shared/protocol";

function player(i: number, connected: boolean): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected,
    connId: connected ? `c${i}` : null,
  };
}

/** 4명이 앉은 방. 기본은 전원 연결. */
function stateIn(
  phase: PhaseId,
  phaseEndsAt: number | null,
  opts: { connected?: boolean; expiresAt?: number } = {},
): RoomState {
  const connected = opts.connected ?? true;
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: opts.expiresAt ?? ROOM_TTL_MS,
    phase,
    phaseEndsAt,
    hostId: "p0",
    nextJoinSeq: 4,
    players: [0, 1, 2, 3].map((i) => player(i, connected)),
  };
}

describe("PHASE_DEFS (단계 표, D-01·D-02·D-19·D-20, NIGHT-05·NIGHT-06)", () => {
  it("단계는 열두 개다 — lobby·assigning·roleReveal, 낮 두 단계(순차 주장·공개 연출 단계 없음, D-07, CHAT-06), 지목·변론·찬반·처형(결정 0060, 옛 처형 여부 투표·후보 선택·공개 단계 없음), 밤·아침, 판 종료", () => {
    const keys = Object.keys(PHASE_DEFS).sort();
    expect(`${keys.length}:${keys.join(",")}`).toBe(
      "12:assigning,dayAnnounce,defense,discussion,ended,execution,lobby,morning,night,nomination,roleReveal,verdict",
    );
  });

  it("길이·다음 단계·역할 노출 여부가 표대로다", () => {
    // 한 줄 문자열로 비교한다 — 보고서가 여러 줄 diff 없이 TAP 으로 읽힌다.
    // 형식: 길이/다음 단계/역할 노출 여부
    const row = (id: PhaseId) => {
      const d = PHASE_DEFS[id];
      return `${d?.durationMs}/${d?.next}/${d?.revealsOwnRole}`;
    };
    expect(row("lobby")).toBe("null/null/false");
    expect(row("assigning")).toBe("3000/roleReveal/false");
    expect(row("roleReveal")).toBe("15000/dayAnnounce/true");
    expect(row("dayAnnounce")).toBe("2000/discussion/true"); // 낮 시작 발표 다음이 바로 토론(CHAT-06)
    expect(row("discussion")).toBe("90000/nomination/true"); // 토론 다음은 지목(DAY-07, 결정 0060-1)
    expect(row("defense")).toBe("20000/verdict/true"); // 변론 다음은 찬반(결정 0060-1)
    expect(row("nomination")).toBe("3000/defense/true"); // 지목 진입 길이 = 모이기(결정 0063-1). 동률·0표면 마감 훅이 night 로 보낸다
    expect(row("verdict")).toBe("10000/execution/true"); // 부결이어도 처형 단계가 결과를 알린다
    expect(row("execution")).toBe("5000/night/true");
    expect(row("night")).toBe("30000/morning/true");
    expect(row("morning")).toBe("5000/dayAnnounce/true");
    expect(row("ended")).toBe("null/null/true"); // 종단 행: 마감 없음
    expect(ASSIGNING_MS).toBe(3000);
    expect(ROLE_REVEAL_MS).toBe(15000);
    expect(DAY_ANNOUNCE_MS).toBe(2000);
    expect(DISCUSSION_MS).toBe(90000);
    expect(NIGHT_MS).toBe(30000);
    expect(MORNING_MS).toBe(5000);
    expect(DEFENSE_MS).toBe(20000);
    expect(NOMINATION_GATHER_MS).toBe(3000);
    expect(VERDICT_MS).toBe(10000);
    expect(EXECUTION_MS).toBe(5000);
  });
});

describe("tick (순수 단계 진행)", () => {
  it("마감 전에는 같은 객체를 돌려준다", () => {
    const s = stateIn("assigning", 4000);
    expect(tick(s, 3999)).toBe(s);
  });

  it("마감과 정확히 같은 순간에 다음 단계로 넘어가고 새 마감은 이전 마감 + 다음 단계 길이다", () => {
    const s = stateIn("assigning", 4000);
    const next = tick(s, 4000);
    expect(next.phase).toBe("roleReveal");
    expect(next.phaseEndsAt).toBe(19000);
  });

  it("알람이 늦게 와도 마감은 now 가 아니라 이전 마감 기준이다", () => {
    const s = stateIn("assigning", 4000);
    const next = tick(s, 4500);
    expect(next.phase).toBe("roleReveal");
    expect(next.phaseEndsAt).toBe(19000);
  });

  it("역할 확인 마감에 낮 시작 발표로 넘어가고 일차 1 이 된다 — 진입 훅은 day 말고 새 키를 더하지 않는다(결과 키 목록에 messages·extendUsed 가 없다) (결정 0017-5·0017-7)", () => {
    const s = stateIn("roleReveal", 19000);
    const next = tick(s, 19000);
    expect(next.phase).toBe("dayAnnounce");
    expect(next.phaseEndsAt).toBe(21000);
    expect(next.day).toBe(1);
    expect(Object.keys(next).includes("messages")).toBe(false);
    expect(Object.keys(next).includes("extendUsed")).toBe(false);
  });

  it("토론 마감(T)에 지목으로 넘어가 마감 T+3000(모이기), 일차는 그대로다 (토론 → 지목, DAY-07, 결정 0063-1)", () => {
    const T = 100_000;
    const s: RoomState = {
      ...stateIn("discussion", T),
      day: 1,
    };
    const next = tick(s, T);
    expect(next.phase).toBe("nomination");
    expect(next.day).toBe(1); // 지목은 일차를 올리지 않는다
    expect(Object.keys(next).includes("messages") || Object.keys(next).includes("extendUsed")).toBe(false);
    expect(next.phaseEndsAt).toBe(T + NOMINATION_GATHER_MS);
    expect(JSON.stringify(next.pickTurn)).toBe(JSON.stringify({ order: [0, 1, 2, 3], i: -1 }));
  });

  it("표가 없는 지목을 한 번에 따라잡으면(T + nominationMaxMs(4)) 표의 기본 다음 단계(변론)가 아니라 밤으로 간다 — 훅의 next 가 표보다 앞선다 (결정 0060-1, 0063-1)", () => {
    const T = 100_000;
    const s: RoomState = { ...stateIn("discussion", T), day: 1 };
    const nomination = tick(s, T);
    expect(`${nomination.phase}/${nomination.phaseEndsAt}`).toBe(`nomination/${T + NOMINATION_GATHER_MS}`);
    expect(PHASE_DEFS.nomination?.next).toBe("defense"); // 표는 데이터만 — 기본 next 는 그대로
    const end = T + nominationMaxMs(4);
    const night = tick(nomination, end);
    expect(`${night.phase}/${night.day}/${night.phaseEndsAt}`).toBe(`night/1/${end + NIGHT_MS}`);
    expect(night.pickTurn).toBeUndefined();
    expect(night.voteLog).toEqual([{ n: 1, exec: { yes: 0, no: 0, passed: false }, cand: { votes: [] } }]);
    // 마지막 마감 직전에는 아직 지목이다(끝 알림 중).
    expect(tick(nomination, end - 1).phase).toBe("nomination");
  });

  it("차례를 한 걸음씩 따라가면 마감이 이전 마감 + 그 단계 길이로 이어진다: 모이기 → 차례 8000 → (기권) 사이 900 → 다음 차례 8000 …", () => {
    const T = 100_000;
    let s = tick({ ...stateIn("discussion", T), day: 1 }, T);
    const chain: string[] = [];
    for (let guard = 0; guard < 20 && s.phase === "nomination"; guard += 1) {
      chain.push(`${s.pickTurn?.i}@${s.phaseEndsAt! - T}`);
      s = tick(s, s.phaseEndsAt!);
    }
    expect(chain.join(" ")).toBe("-1@3000 0@11000 0@11900 1@19900 1@20800 2@28800 2@29700 3@37700 3@38600 4@40600");
    expect(s.phase).toBe("night");
  });

  it("지목 마감에 최다 한 명이면 변론(마감 +20000)으로, 동률이면 밤으로 간다", () => {
    const T = 100_000;
    const nomination = tick({ ...stateIn("discussion", T), day: 1 }, T);
    const oneEnd = castPoints(nomination, { 0: 2, 1: 2, 2: 3 });
    const one = tick(oneEnd, oneEnd.phaseEndsAt!);
    expect(`${one.phase}/${one.phaseEndsAt}/${JSON.stringify(one.verdict)}`).toBe(`defense/${oneEnd.phaseEndsAt! + DEFENSE_MS}/{"passed":false,"candidate":2}`);
    const tieEnd = castPoints(nomination, { 0: 2, 1: 2, 2: 0, 3: 0 });
    const tie = tick(tieEnd, tieEnd.phaseEndsAt!);
    expect(`${tie.phase}/${tie.phaseEndsAt}`).toBe(`night/${tieEnd.phaseEndsAt! + NIGHT_MS}`);
    expect(tie.voteLog?.[0]?.cand?.candidate).toBeUndefined();
    expect(tie.voteLog?.[0]?.cand?.votes.length).toBe(4);
  });

  it("찬반 마감은 부결이어도 처형으로 간다: 마감 +5000, 아무도 탈락하지 않고 voteLog 의 exec 가 채워진다", () => {
    const verdict = stateWithVerdict(6, 1, "verdict");
    const defender = verdict.verdict!.candidate!;
    const out = tick(verdict, verdict.phaseEndsAt!, seededRandInt(2));
    expect(`${out.phase}/${out.phaseEndsAt}`).toBe(`execution/${verdict.phaseEndsAt! + EXECUTION_MS}`);
    expect(out.players.every((p) => p.alive !== false)).toBe(true);
    expect(JSON.stringify(out.voteLog?.[0]?.exec)).toBe('{"yes":0,"no":0,"passed":false}');
    expect(out.verdict).toEqual({ passed: false, candidate: defender });
    expect(out.execution).toBeUndefined();
  });

  it("찬성 과반이면 처형 진입에서 변론자만 탈락한다", () => {
    const verdict = stateWithVerdict(6, 1, "verdict");
    const defender = verdict.verdict!.candidate!;
    const agreeAll = Object.fromEntries(verdict.players.filter((p) => p.seat !== defender).map((p) => [p.seat, true]));
    const out = tick(castVerdicts(verdict, agreeAll), verdict.phaseEndsAt!, seededRandInt(2));
    expect(out.phase).toBe("execution");
    expect(out.players.filter((p) => p.alive === false).map((p) => p.seat).join(",")).toBe(String(defender));
    expect(out.execution?.seat).toBe(defender);
  });

  it("늦은 알람이 지목에서 처형까지 한 번에 따라잡아도 지목 훅 → 찬반 훅 순서로 돈다 (voteLog 줄이 지목에서 생기고 찬반이 채운다)", () => {
    const T = 100_000;
    const nomination = tick({ ...stateIn("discussion", T), day: 1 }, T);
    const pointed = castPoints(nomination, { 0: 2, 1: 2, 3: 2, 2: 0 });
    const nominationEnd = pointed.phaseEndsAt!;
    const late = nominationEnd + DEFENSE_MS + VERDICT_MS + 1;
    const out = tick(pointed, late, seededRandInt(4));
    expect(`${out.phase}/${out.phaseEndsAt}`).toBe(`execution/${nominationEnd + DEFENSE_MS + VERDICT_MS + EXECUTION_MS}`);
    expect(out.voteLog?.length).toBe(1);
    expect(JSON.stringify(out.voteLog?.[0]?.exec)).toBe('{"yes":0,"no":0,"passed":false}');
    expect(out.voteLog?.[0]?.cand?.candidate).toBe(2);
  });

  it("판 종료(ended)는 마감이 없어 아무리 늦게 불러도 입력 그대로다", () => {
    const s = stateIn("ended", null);
    for (const now of [0, 1_000_000, Number.MAX_SAFE_INTEGER]) expect(tick(s, now)).toBe(s);
  });

  it("밤 마감 T+30000 에 아침(마감 T+35000), 아침 마감 T+35000 에 dayAnnounce(마감 T+37000)이고 일차가 1 오른다 (NIGHT-05, NIGHT-06)", () => {
    const T = 100_000;
    const night: RoomState = { ...stateIn("night", T + NIGHT_MS), day: 1 };
    const morning = tick(night, T + NIGHT_MS);
    expect(`${morning.phase}/${morning.day}/${morning.phaseEndsAt}`).toBe(`morning/1/${T + NIGHT_MS + MORNING_MS}`);
    const dayAnnounce = tick(morning, T + NIGHT_MS + MORNING_MS);
    expect(`${dayAnnounce.phase}/${dayAnnounce.day}/${dayAnnounce.phaseEndsAt}`).toBe(
      `dayAnnounce/2/${T + NIGHT_MS + MORNING_MS + DAY_ANNOUNCE_MS}`,
    );
  });

  it("늦은 알람: 토론 마감 뒤 한참 지나 불려도 밤·아침·다음 낮 마감이 이전 마감 연쇄로 계산된다", () => {
    const T = 100_000;
    const s: RoomState = { ...stateIn("discussion", T), day: 1 };
    // 마감: nomination +nominationMaxMs(4)(전원 기권) → (0표) night +NIGHT_MS → morning +MORNING_MS → dayAnnounce +DAY_ANNOUNCE_MS → discussion +DISCUSSION_MS.
    const toDiscussion = nominationMaxMs(4) + NIGHT_MS + MORNING_MS + DAY_ANNOUNCE_MS;
    const out = tick(s, T + toDiscussion + 3_000);
    expect(`${out.phase}/${out.day}/${out.phaseEndsAt}`).toBe(`discussion/2/${T + toDiscussion + DISCUSSION_MS}`);
  });

  it("늦은 알람이 여러 낮 단계를 따라잡아도 중간 단계의 진입 훅이 루프 안에서 돈다 (RESEARCH Pattern 1)", () => {
    const s = stateIn("roleReveal", 19000);
    // 마감: dayAnnounce 21000 → discussion 61000. 37000 이면 토론이 한창이다.
    const next = tick(s, 37000);
    expect(next.phase).toBe("discussion");
    expect(next.day).toBe(1); // dayAnnounce 훅이 한 번 돌았다
    expect(next.phaseEndsAt).toBe(21000 + DISCUSSION_MS);
  });

  it("한 바퀴를 한 번에 따라잡아도 일차가 정확히 한 번만 늘어난다 (밤·아침은 일차를 올리지 않는다)", () => {
    const T = 100_000;
    const s: RoomState = { ...stateIn("discussion", T), day: 1 };
    // 마감: nomination → (0표) night → morning → dayAnnounce → discussion (각 단계 길이를 이어 붙인다).
    const round = nominationMaxMs(4) + NIGHT_MS + MORNING_MS + DAY_ANNOUNCE_MS + DISCUSSION_MS;
    const next = tick(s, T + round - 5_000);
    expect(next.phase).toBe("discussion");
    expect(next.day).toBe(2);
    expect(next.phaseEndsAt).toBe(T + round);
    // 한 바퀴가 정확히 끝나는 순간에는 지목이 시작되고 일차는 그대로다.
    const vote = tick(s, T + round);
    expect(vote.phase).toBe("nomination");
    expect(vote.day).toBe(2);
    expect(vote.phaseEndsAt).toBe(T + round + NOMINATION_GATHER_MS);
    // 표가 없으면 그 마감에 밤이 시작되고 일차는 그대로다.
    const night = tick(s, T + round + nominationMaxMs(4));
    expect(night.phase).toBe("night");
    expect(night.day).toBe(2);
    expect(night.phaseEndsAt).toBe(T + round + nominationMaxMs(4) + NIGHT_MS);
  });

  it("아주 늦게 불리면 여러 단계를 한 번에 따라잡는다", () => {
    const s = stateIn("assigning", 4000);
    const next = tick(s, 30000);
    expect(next.phase).toBe("discussion"); // roleReveal 19000 → dayAnnounce 21000 → discussion 61000
    expect(next.phaseEndsAt).toBe(21000 + DISCUSSION_MS);
    expect(next.day).toBe(1);
  });

  it("lobby 는 어떤 now 에도 같은 객체다", () => {
    const lobby = stateIn("lobby", null);
    for (const now of [0, 1, 1_000_000, Number.MAX_SAFE_INTEGER]) {
      expect(tick(lobby, now)).toBe(lobby);
    }
  });

  it("같은 now 로 두 번 불러도 결과가 같다 (알람 at-least-once)", () => {
    const s = stateIn("assigning", 4000);
    for (const now of [4000, 4500, 19000, 30000, 50000, 200000]) {
      const once = tick(s, now);
      expect(JSON.stringify(tick(once, now))).toBe(JSON.stringify(once));
    }
    const T = 100_000;
    const discussion: RoomState = { ...stateIn("discussion", T), day: 1 };
    const nightStart = T + nominationMaxMs(4);
    for (const now of [
      T,
      nightStart,
      nightStart + NIGHT_MS,
      nightStart + NIGHT_MS + MORNING_MS,
      nightStart + NIGHT_MS + MORNING_MS + DAY_ANNOUNCE_MS,
    ]) {
      const once = tick(discussion, now);
      expect(JSON.stringify(tick(once, now))).toBe(JSON.stringify(once));
    }
  });

  it("세 번째 인자(난수 함수)를 넘겨도 지금 단계 표만으로는 한 번도 부르지 않는다 — 03-03 이 아침 훅을 더하기 전의 계약", () => {
    const T = 100_000;
    let calls = 0;
    const randInt = (n: number): number => {
      calls += 1;
      return n - 1;
    };
    tick({ ...stateIn("discussion", T), day: 1 }, T + 200_000, randInt);
    tick(stateIn("assigning", 4000), 30_000, randInt);
    expect(calls).toBe(0);
  });

  it("연결 여부를 보지 않는다 — 전원 끊겨도 같은 결과다 (D-05, D-18)", () => {
    const online = tick(stateIn("assigning", 4000), 30000);
    const offline = tick(stateIn("assigning", 4000, { connected: false }), 30000);
    expect(offline.phase).toBe("discussion");
    expect(offline.phase).toBe(online.phase);
    expect(offline.phaseEndsAt).toBe(online.phaseEndsAt);
    expect(offline.day).toBe(online.day);
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const s = stateIn("assigning", 4000);
    const before = JSON.stringify(s);
    tick(s, 30000);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("enterDayAnnounce (낮 진입 훅)", () => {
  it("enterDayAnnounce: 일차가 없으면 1, 있으면 +1, 다른 필드는 같은 참조, 결과에 messages·extendUsed 키가 없다", () => {
    const base = stateIn("dayAnnounce", 21000);
    const first = enterDayAnnounce(base);
    expect(first.day).toBe(1);
    expect(Object.keys(first).includes("messages") || Object.keys(first).includes("extendUsed")).toBe(false);
    const fourth = enterDayAnnounce({ ...base, day: 4 });
    expect(fourth.day).toBe(5);
    expect(fourth.players).toBe(base.players);
    expect(fourth.phase).toBe("dayAnnounce");
    expect(fourth.phaseEndsAt).toBe(21000);
  });
});

describe("tick - 늦은 알람의 따라잡기 훅 순서 (밤·아침을 건너 dayAnnounce → discussion)", () => {
  it("discussion 에서 한 번에 다음 낮 discussion 까지 따라잡아도 낮 시작 훅이 한 번 돌고 claim 계열 키가 생기지 않는다", () => {
    const T = 100_000;
    const s: RoomState = { ...stateIn("discussion", T), day: 1 };
    const dayAnnounceEnd = T + nominationMaxMs(4) + NIGHT_MS + MORNING_MS + DAY_ANNOUNCE_MS;
    const out = tick(s, dayAnnounceEnd);
    expect(`${out.phase}/${out.day}/${out.phaseEndsAt}`).toBe(`discussion/2/${dayAnnounceEnd + DISCUSSION_MS}`);
    for (const key of ["claimOrder", "claimIdx", "claimStart", "claimPick", "claimLog"]) expect(Object.hasOwn(out, key)).toBe(false);
  });
});

describe("nextWakeAt (알람 하나로 단계 마감과 방 만료)", () => {
  it("lobby 는 방 만료 시각이다", () => {
    expect(nextWakeAt(stateIn("lobby", null))).toBe(ROOM_TTL_MS);
  });

  it("단계 마감이 만료보다 이르면 단계 마감이다", () => {
    expect(nextWakeAt(stateIn("assigning", 4000))).toBe(4000);
  });

  it("방 만료가 더 이르면 방 만료다", () => {
    expect(nextWakeAt(stateIn("roleReveal", 19000, { expiresAt: 10000 }))).toBe(10000);
  });

  it("discussion 은 단계 마감이 만료보다 이르면 단계 마감이다", () => {
    expect(nextWakeAt(stateIn("discussion", 100_000))).toBe(100_000);
  });
});

describe("낮 처형 구간 길이 (결정 0060-1, 0063-1)", () => {
  it("지목 마감부터 처형 마감까지는 인원과 무관하게 고정 35초다: 변론 20 + 찬반 10 + 처형 5. 지목 구간은 산 사람 수에 따라 최대 모이기 3 + 인원 × 8.9 + 끝 알림 2초다", () => {
    expect(DEFENSE_MS + VERDICT_MS + EXECUTION_MS).toBe(35_000);
    expect(`${nominationMaxMs(4)}/${nominationMaxMs(8)}`).toBe("40600/76200");
  });
});

// 07-08: 순차 주장 단계 제거 — 낮 시작 발표 다음이 바로 토론이다(CHAT-06).
describe("tick - 낮 흐름에 순차 주장 단계가 없다 (07-08, CHAT-06)", () => {
  it("07-08 dayAnnounce 마감 다음이 바로 discussion 이고 마감은 이전 마감 + DISCUSSION_MS 다", () => {
    const T = 50_000;
    const out = tick({ ...stateIn("dayAnnounce", T), day: 1 }, T);
    expect(`${out.phase}/${out.phaseEndsAt}`).toBe(`discussion/${T + DISCUSSION_MS}`);
  });

  it("07-08 늦은 알람으로 roleReveal 에서 한 번에 따라잡아도 roleReveal → dayAnnounce → discussion 순서이고 일차는 1이다", () => {
    const out = tick(stateIn("roleReveal", 19_000), 19_000 + DAY_ANNOUNCE_MS + 500);
    expect(`${out.phase}/${out.day}/${out.phaseEndsAt}`).toBe(`discussion/1/${19_000 + DAY_ANNOUNCE_MS + DISCUSSION_MS}`);
  });
});

// ---- 09-07 Task 2: 아침 마감은 진입 훅 뒤 상태의 길이로 정해진다 (MORN-04, L6) ----
describe("tick: 아침 마감 = 진입 + morningMsOf (MORN-04, 결정 0061-13)", () => {
  const T = 100_000;
  /** 5명, p0 마피아·p1~p4 시민. 마피아가 p1 을 고른 밤이고 p1 은 유언을 남겼다. */
  function nightWith(extra: Partial<RoomState> = {}, doctorSaves = false): RoomState {
    const base = stateIn("night", T + NIGHT_MS);
    const players = [0, 1, 2, 3].map((i): Player => {
      const p = player(i, true);
      if (i === 0) return { ...p, role: "mafia", nightPick: 1 };
      if (i === 2 && doctorSaves) return { ...p, role: "doctor", nightPick: 1 };
      return { ...p, role: "citizen", ...(i === 1 ? { will: "유언" } : {}) };
    });
    return { ...base, day: 1, players, ...extra };
  }

  it("확정·탈락(피해자 유언 있음)이면 마감이 진입 + 9000 이다", () => {
    const morning = tick(nightWith(), T + NIGHT_MS);
    expect(`${morning.phase}/${morning.morning?.eliminated}/${morning.phaseEndsAt}`).toBe(`morning/1/${T + NIGHT_MS + 9000}`);
  });

  it("쪽지까지 있으면 진입 + 11000, 구출이면 쪽지가 지워져 진입 + 5000 이다", () => {
    const withNote = tick(nightWith({ nightNote: "쪽지" }), T + NIGHT_MS);
    expect(withNote.phaseEndsAt).toBe(T + NIGHT_MS + 11000);
    const saved = tick(nightWith({ nightNote: "쪽지" }, true), T + NIGHT_MS);
    expect(JSON.stringify(saved.morning)).toBe('{"saved":true}');
    expect("nightNote" in saved).toBe(false);
    expect(saved.phaseEndsAt).toBe(T + NIGHT_MS + 5000);
  });

  it("확정이 없는 밤(마피아 미선택)도 진입 + 5000 이다", () => {
    const s = nightWith({ nightNote: "쪽지" });
    const none: RoomState = { ...s, players: s.players.map(({ nightPick: _n, ...p }) => p) };
    expect(tick(none, T + NIGHT_MS).phaseEndsAt).toBe(T + NIGHT_MS + 5000);
  });

  it("난수 인자 없이 night → morning 을 넘겨도 예외가 없다", () => {
    expect(() => tick(nightWith(), T + NIGHT_MS)).not.toThrow();
  });

  it("따라잡기: 늦게 불려도 아침 마감은 밤 마감 + 아침 길이에서 이어진다", () => {
    const caught = tick(nightWith(), T + NIGHT_MS + 9000 + 1);
    expect(`${caught.phase}/${caught.phaseEndsAt}`).toBe(`dayAnnounce/${T + NIGHT_MS + 9000 + DAY_ANNOUNCE_MS}`);
  });
});
