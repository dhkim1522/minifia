import { describe, expect, it } from "vitest";
import { enterClaimReveal } from "../../shared/game/claim";
import { CLAIM_MS, CLAIM_REVEAL_MS } from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import type { Claim, PhaseId } from "../../shared/protocol";

type Extra = Partial<Pick<Player, "connected" | "claimChoice" | "claimShown" | "claimLast" | "claimChanged" | "role">>;

function player(i: number, extra: Extra = {}): Player {
  const connected = extra.connected ?? true;
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected,
    connId: connected ? `c${i}` : null,
    ...extra,
  };
}

/** 4명판. 0번만 시험 대상이고 나머지 셋은 기본(연결됨·선택 없음)이다. */
function stateWith(
  phase: PhaseId,
  first: Extra,
  opts: { day?: number; phaseEndsAt?: number | null; others?: Extra[] } = {},
): RoomState {
  const others = opts.others ?? [{}, {}, {}];
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt: opts.phaseEndsAt === undefined ? 1000 : opts.phaseEndsAt,
    day: opts.day ?? 1,
    hostId: "p0",
    nextJoinSeq: 4,
    players: [player(0, first), ...others.map((o, i) => player(i + 1, o))],
  };
}

/** 첫 플레이어가 마감 때 공개한 값·말 바꿈·다음 낮에 물려줄 값을 "공개/바뀜/last" 한 줄로 돌려준다(TAP 보고서가 여러 줄 diff 없이 읽힌다). */
function revealed(first: Extra, day = 1): string {
  const out = enterClaimReveal(stateWith("claimReveal", first, { day })).players[0]!;
  return `${out.claimShown}/${out.claimChanged}/${out.claimLast}`;
}

describe("enterClaimReveal - 마감 확정 규칙표 (D-05, D-08, D-09)", () => {
  it("1일차, 직접 선택 없음 → none, 말 바꿈 아님, 다음 낮 last 는 none (empty)", () => {
    expect(revealed({})).toBe("none/false/none");
  });

  it("1일차, 직접 선택 R → R, 말 바꿈 아님(어제 없음)", () => {
    expect(revealed({ claimChoice: "police" })).toBe("police/false/police");
  });

  it("2일차+, 어제 R, 직접 선택 없음, 연결됨 → R 유지, 말 바꿈 아님", () => {
    expect(revealed({ claimLast: "police" }, 2)).toBe("police/false/police");
  });

  it("2일차+, 어제 R, 직접 선택 없음, 끊김 → none, 말 바꿈 아님(R→none 은 표시 없음)", () => {
    expect(revealed({ claimLast: "police", connected: false }, 2)).toBe("none/false/none");
  });

  it("어제 R, 오늘 R' (≠ R) → R' 이고 말 바꿈", () => {
    expect(revealed({ claimLast: "police", claimChoice: "citizen" }, 2)).toBe("citizen/true/citizen");
  });

  it("어제 R, 오늘 R 을 다시 골라도 → R, 말 바꿈 아님", () => {
    expect(revealed({ claimLast: "police", claimChoice: "police" }, 2)).toBe("police/false/police");
  });

  it("어제 R, 오늘 none → none, 말 바꿈 아님(말 안 함만 보인다)", () => {
    expect(revealed({ claimLast: "police", claimChoice: "none" }, 2)).toBe("none/false/none");
  });

  it("어제 none, 오늘 R → R, 말 바꿈 아님(처음 주장으로 본다)", () => {
    expect(revealed({ claimLast: "none", claimChoice: "police" }, 2)).toBe("police/false/police");
  });

  it("어제 none, 직접 선택 없음, 연결됨 → none, 말 바꿈 아님", () => {
    expect(revealed({ claimLast: "none" }, 2)).toBe("none/false/none");
  });

  it("끊긴 사람이라도 직접 고른 값이 있으면 그 값이 공개된다", () => {
    expect(revealed({ connected: false, claimChoice: "mafia" })).toBe("mafia/false/mafia");
    expect(revealed({ connected: false, claimLast: "police", claimChoice: "citizen" }, 2)).toBe("citizen/true/citizen");
  });

  it("하루 걸러 규칙(A3): 어제 R → 오늘 none → 다음 날 R' 는 말 바꿈이 아니다 (직전 낮이 말 안 함이면 처음 주장)", () => {
    let s = stateWith("claim", { claimLast: "police" }, { day: 2 });
    // 오늘 none 을 직접 고름
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, claimChoice: "none" as Claim } : p)) };
    s = enterClaimReveal({ ...s, phase: "claimReveal" });
    expect(s.players[0]!.claimShown).toBe("none");
    expect(s.players[0]!.claimLast).toBe("none");
    // 다음 낮: 선택을 지우고 R' 를 고른다
    const nextDay: RoomState = {
      ...s,
      day: 3,
      players: s.players.map((p, i) => {
        const { claimChoice: _drop, ...rest } = p;
        return i === 0 ? { ...rest, claimChoice: "citizen" as Claim } : rest;
      }),
    };
    const out = enterClaimReveal(nextDay).players[0]!;
    expect(out.claimShown).toBe("citizen");
    expect(out.claimChanged).toBe(false);
  });

  it("입력을 바꾸지 않고 players 밖 필드(phase·phaseEndsAt·day)는 그대로다", () => {
    const s = stateWith("claimReveal", { claimLast: "police", claimChoice: "citizen" }, { day: 2, phaseEndsAt: 5000 });
    const frozen = JSON.stringify(s);
    const out = enterClaimReveal(s);
    expect(JSON.stringify(s)).toBe(frozen);
    expect(out === s).toBe(false);
    expect(out.phase).toBe("claimReveal");
    expect(out.phaseEndsAt).toBe(5000);
    expect(out.day).toBe(2);
    expect(out.players[1] === s.players[1]).toBe(false);
  });

  it("claimChoice 는 이 훅에서 지우지 않는다(다음 낮 enterClaim 이 지운다)", () => {
    const out = enterClaimReveal(stateWith("claimReveal", { claimChoice: "police" }));
    expect(out.players[0]!.claimChoice).toBe("police");
  });

  it("공개 전에는 claimShown 이 이전 값 그대로이고, 훅을 부른 뒤에야 다른 사람의 이번 낮 선택이 claimShown 으로 옮겨진다 (T-02-04)", () => {
    const before = stateWith("claim", { claimShown: "citizen", claimChoice: "police" });
    expect(before.players[0]!.claimShown).toBe("citizen");
    const after = enterClaimReveal(before);
    expect(after.players[0]!.claimShown).toBe("police");
    expect(before.players[0]!.claimShown).toBe("citizen");
  });
});

describe("tick - claim 마감에서 claimReveal 훅이 돈다", () => {
  it("claim(phaseEndsAt T) 에서 tick(s, T) → claimReveal 이고 규칙대로 claimShown 이 채워져 있다", () => {
    const T = 36000;
    const s = stateWith(
      "claim",
      { claimLast: "police", claimChoice: "citizen" },
      { day: 2, phaseEndsAt: T, others: [{ claimLast: "doctor" }, { claimLast: "doctor", connected: false }, {}] },
    );
    const out = tick(s, T);
    expect(out.phase).toBe("claimReveal");
    expect(out.phaseEndsAt).toBe(T + CLAIM_REVEAL_MS);
    expect(out.players.map((p) => `${p.claimShown}/${p.claimChanged}`).join(",")).toBe(
      "citizen/true,doctor/false,none/false,none/false",
    );
  });

  it("마감 전에는 훅이 돌지 않는다", () => {
    const s = stateWith("claim", { claimChoice: "police" }, { phaseEndsAt: 36000 });
    const out = tick(s, 36000 - 1);
    expect(out === s).toBe(true);
    expect(String(out.players[0]!.claimShown)).toBe("undefined");
  });

  it("CLAIM_MS 는 직업 공개 단계 길이다", () => {
    expect(CLAIM_MS).toBeGreaterThan(0);
  });
});
