import { describe, expect, it } from "vitest";
import {
  ASSIGNING_MS,
  CLAIM_TURN_MS,
  DAY_ANNOUNCE_MS,
  DISCUSSION_MS,
  MORNING_MS,
  NIGHT_MS,
  PHASE_DEFS,
  ROLE_REVEAL_MS,
} from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { enterDayAnnounce, nextWakeAt, tick } from "../../shared/game/tick";
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
  it("단계는 여덟 개다 — lobby·assigning·roleReveal, 낮 세 단계(공개 연출 단계 없음, D-07), 밤·아침", () => {
    const keys = Object.keys(PHASE_DEFS).sort();
    expect(`${keys.length}:${keys.join(",")}`).toBe(
      "8:assigning,claim,dayAnnounce,discussion,lobby,morning,night,roleReveal",
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
    expect(row("dayAnnounce")).toBe("2000/claim/true");
    expect(row("claim")).toBe("8000/discussion/true"); // 차례 하나의 길이 — 남은 차례가 있으면 tick 의 ON_DEADLINE 이 머문다
    expect(row("discussion")).toBe("90000/night/true"); // 임시 낮 루프(D-19)가 밤으로 바뀌었다
    expect(row("night")).toBe("30000/morning/true");
    expect(row("morning")).toBe("5000/dayAnnounce/true");
    expect(ASSIGNING_MS).toBe(3000);
    expect(ROLE_REVEAL_MS).toBe(15000);
    expect(DAY_ANNOUNCE_MS).toBe(2000);
    expect(CLAIM_TURN_MS).toBe(8000);
    expect(DISCUSSION_MS).toBe(90000);
    expect(NIGHT_MS).toBe(30000);
    expect(MORNING_MS).toBe(5000);
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

  it("토론 마감(T)에 밤으로 넘어가 마감 T+30000, 일차·nextMessageSeq 는 그대로다 (임시 루프 → 밤, 결정 0016-2)", () => {
    const T = 100_000;
    const s: RoomState = {
      ...stateIn("discussion", T),
      day: 1,
      nextMessageSeq: 4,
    };
    const next = tick(s, T);
    expect(next.phase).toBe("night");
    expect(next.day).toBe(1); // 밤은 일차를 올리지 않는다
    expect(Object.keys(next).includes("messages") || Object.keys(next).includes("extendUsed")).toBe(false);
    expect(next.phaseEndsAt).toBe(T + NIGHT_MS);
    expect(next.nextMessageSeq).toBe(4); // 메시지 번호는 날이 바뀌어도 줄지 않는다
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
    // 마감: night T+30000 → morning T+35000 → dayAnnounce T+37000 → claim 첫 차례 T+45000 → 둘째 차례 T+53000.
    const out = tick(s, T + 37_000 + 11_000);
    expect(`${out.phase}/${out.day}/${out.claimIdx}/${out.phaseEndsAt}`).toBe(`claim/2/1/${T + 53_000}`);
  });

  it("늦은 알람이 여러 낮 단계를 따라잡아도 중간 단계의 진입 훅이 루프 안에서 돈다 (RESEARCH Pattern 1)", () => {
    const s = stateIn("roleReveal", 19000);
    // 마감: dayAnnounce 21000 → 첫 차례 29000 → 둘째 차례 37000 → 셋째 차례 45000. 37000 이면 셋째 차례가 막 시작됐다.
    const next = tick(s, 37000);
    expect(next.phase).toBe("claim");
    expect(next.day).toBe(1); // dayAnnounce 훅이 한 번 돌았다
    expect(next.claimIdx).toBe(2); // claim 진입 훅이 돌았고 차례 두 개가 지났다
    expect(next.claimLog).toHaveLength(2);
    expect(next.phaseEndsAt).toBe(45000);
  });

  it("한 바퀴를 한 번에 따라잡아도 일차가 정확히 한 번만 늘어난다 (밤·아침은 일차를 올리지 않는다)", () => {
    const T = 100_000;
    const s: RoomState = { ...stateIn("discussion", T), day: 1 };
    // 마감: night T+30000 → morning T+35000 → dayAnnounce T+37000 → claim 네 차례 T+45000..T+69000 → discussion T+159000.
    const next = tick(s, T + 100_000);
    expect(next.phase).toBe("discussion");
    expect(next.day).toBe(2);
    expect(next.phaseEndsAt).toBe(T + 159_000);
    // 한 바퀴가 정확히 끝나는 순간에는 밤이 시작되고 일차는 그대로다.
    const night = tick(s, T + 159_000);
    expect(night.phase).toBe("night");
    expect(night.day).toBe(2);
    expect(night.phaseEndsAt).toBe(T + 189_000);
  });

  it("아주 늦게 불리면 여러 단계를 한 번에 따라잡는다", () => {
    const s = stateIn("assigning", 4000);
    const next = tick(s, 30000);
    expect(next.phase).toBe("claim"); // roleReveal 19000 → dayAnnounce 21000 → 첫 차례 29000 → 둘째 차례 37000
    expect(next.claimIdx).toBe(1);
    expect(next.phaseEndsAt).toBe(37000);
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
    for (const now of [T, T + NIGHT_MS, T + NIGHT_MS + MORNING_MS, T + NIGHT_MS + MORNING_MS + DAY_ANNOUNCE_MS]) {
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
    expect(offline.phase).toBe("claim");
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

describe("tick - 늦은 알람의 따라잡기 훅 순서 (밤·아침을 건너 dayAnnounce → claim)", () => {
  it("discussion 에서 한 번에 다음 낮 claim 까지 따라잡아도 낮 훅이 순서대로 돌고 시작 자리가 한 칸 이동한다", () => {
    const T = 100_000;
    const base = stateIn("discussion", T);
    const s: RoomState = {
      ...base,
      day: 1,
      claimStart: 0,
      claimOrder: [0, 1, 2, 3],
      claimIdx: 4,
      claimPick: "police", // 남아 있어서는 안 되는 값 — claim 진입 훅이 지운다
      claimLog: [
        { n: 1, seat: 0, claim: "police" },
        { n: 1, seat: 1, claim: "none" },
        { n: 1, seat: 2, claim: "none" },
        { n: 1, seat: 3, claim: "none" },
      ],
    };
    const dayAnnounceEnd = T + NIGHT_MS + MORNING_MS + DAY_ANNOUNCE_MS;
    const out = tick(s, dayAnnounceEnd);
    expect(`${out.phase}/${out.day}/${out.phaseEndsAt}`).toBe(`claim/2/${dayAnnounceEnd + CLAIM_TURN_MS}`);
    expect(out.claimOrder).toEqual([1, 2, 3, 0]);
    expect(out.claimIdx).toBe(0);
    expect(out.claimStart).toBe(1);
    expect(Object.hasOwn(out, "claimPick")).toBe(false);
    expect(out.claimLog).toEqual(s.claimLog); // 어제 기록은 그대로 쌓여 있다
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
