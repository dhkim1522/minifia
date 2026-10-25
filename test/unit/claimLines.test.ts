import { describe, expect, it } from "vitest";
import type { ClaimLogEntry, RoomView } from "../../shared/protocol";
import { claimLinesOf } from "../../src/net/claimLines";

// claimLog(서버가 공개한 주장) → 채팅 줄 변환(D-04, D-05). 문장은 만들지 않는다 — messageText 가 만든다.

function viewOf(claimLog: ClaimLogEntry[], n = 2): RoomView {
  return {
    code: "0042",
    phase: "claim",
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players: [0, 1, 2, 3].map((seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 })),
    me: { seat: 0, isHost: true },
    day: { n, roles: ["mafia", "citizen"], claimLog },
  };
}

const row = (l: { seq: number; seat: number; template: string; claimedRole?: string; at: number }): string =>
  `${l.template}:${l.seat}:${l.claimedRole ?? "-"}:${l.at}`;

describe("claimLinesOf", () => {
  it("오늘 줄만 기록 순서대로: 직업은 claimRole(+claimedRole), none 은 claimNone", () => {
    const lines = claimLinesOf(
      viewOf([
        { n: 1, seat: 3, claim: "mafia" },
        { n: 2, seat: 1, claim: "police" },
        { n: 2, seat: 2, claim: "none" },
        { n: 2, seat: 0, claim: "citizen" },
      ]),
    );
    expect(lines.map(row).join(" | ")).toBe("claimRole:1:police:0 | claimNone:2:-:0 | claimRole:0:citizen:0");
  });

  it("none 줄에는 claimedRole·target 키가 없고 직업 줄에는 target 키가 없다", () => {
    const lines = claimLinesOf(
      viewOf([
        { n: 2, seat: 1, claim: "doctor" },
        { n: 2, seat: 2, claim: "none" },
      ]),
    );
    expect(lines.map((l) => Object.keys(l).sort().join(",")).join(" | ")).toBe("at,claimedRole,seat,seq,template | at,seat,seq,template");
  });

  it("seq 는 모두 음수이고 서로 다르며 오름차순이다", () => {
    const lines = claimLinesOf(
      viewOf([
        { n: 2, seat: 1, claim: "police" },
        { n: 2, seat: 2, claim: "none" },
        { n: 2, seat: 3, claim: "mafia" },
      ]),
    );
    const seqs = lines.map((l) => l.seq);
    expect(seqs.every((q) => q < 0)).toBe(true);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs.join(",")).toBe([...seqs].sort((a, b) => a - b).join(","));
  });

  it("비었거나 day 가 없거나 view 가 null 이면 []", () => {
    expect(claimLinesOf(viewOf([])).length).toBe(0);
    expect(claimLinesOf(viewOf([{ n: 1, seat: 1, claim: "mafia" }])).length).toBe(0);
    const { day: _day, ...noDay } = viewOf([]);
    expect(claimLinesOf(noDay as RoomView).length).toBe(0);
    expect(claimLinesOf(null).length).toBe(0);
  });

  it("입력 view 를 바꾸지 않는다", () => {
    const v = viewOf([{ n: 2, seat: 1, claim: "police" }]);
    const before = JSON.stringify(v);
    claimLinesOf(v);
    expect(JSON.stringify(v)).toBe(before);
  });
});
