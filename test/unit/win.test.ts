// 승패 판정 경계표 (04-06 Task 1) — END-01, D-05, Pitfall 19.
// 상태는 실제 배정(startGame)으로 만든 뒤 alive·connected 만 바꾼다. 실패 출력은 한 줄이어야 해서 비교는 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import { checkWinner } from "../../shared/game/win";
import type { RoomState } from "../../shared/game/room";
import { lobbyOf, startedAt } from "../helpers/voteState";

const SEEDS = [1, 2, 3] as const;

/** 해당 직업 조건의 사람들 중 앞에서 count 명을 alive false 로 한다. */
function eliminate(state: RoomState, pick: "mafia" | "other", count: number): RoomState {
  let left = count;
  return {
    ...state,
    players: [...state.players]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => {
        const match = pick === "mafia" ? p.role === "mafia" : p.role !== "mafia";
        if (match && left > 0) {
          left -= 1;
          return { ...p, alive: false };
        }
        return p;
      }),
  };
}

const outcome = (state: RoomState): string => String(checkWinner(state));

describe("checkWinner — 역할이 없으면 판정하지 않는다 (T-04-19)", () => {
  it("대기실과 역할 없는 상태는 null", () => {
    expect(outcome(lobbyOf(4))).toBe("null");
    expect(outcome(lobbyOf(8))).toBe("null");
  });
  it("역할 없는 상태에서 전원 탈락시켜도 null", () => {
    const lobby = lobbyOf(5);
    const dead = { ...lobby, players: lobby.players.map((p) => ({ ...p, alive: false })) };
    expect(outcome(dead)).toBe("null");
  });
});

describe("checkWinner — 인원별 경계표 (END-01, D-05)", () => {
  for (const seed of SEEDS) {
    it(`4명(마피아 1) 시드 ${seed}: 시민 1 탈락 null, 둘 탈락 mafia, 마피아 탈락 citizen`, () => {
      const s = startedAt(4, seed, "dayAnnounce");
      expect(outcome(s)).toBe("null");
      expect(outcome(eliminate(s, "other", 1))).toBe("null"); // 1 vs 2
      expect(outcome(eliminate(s, "other", 2))).toBe("mafia"); // 1 vs 1
      expect(outcome(eliminate(s, "mafia", 1))).toBe("citizen");
    });
    it(`6명(마피아 2) 시드 ${seed}: 2 vs 4 null, 2 vs 3 null, 2 vs 2 mafia, 마피아 하나 null, 둘 citizen`, () => {
      const s = startedAt(6, seed, "dayAnnounce");
      expect(outcome(s)).toBe("null");
      expect(outcome(eliminate(s, "other", 1))).toBe("null"); // 2 vs 3
      expect(outcome(eliminate(s, "other", 2))).toBe("mafia"); // 2 vs 2
      expect(outcome(eliminate(s, "mafia", 1))).toBe("null");
      expect(outcome(eliminate(s, "mafia", 2))).toBe("citizen");
    });
    it(`7·8명(마피아 2) 시드 ${seed}: 경계`, () => {
      const seven = startedAt(7, seed, "dayAnnounce");
      expect(outcome(seven)).toBe("null"); // 2 vs 5
      expect(outcome(eliminate(seven, "other", 2))).toBe("null"); // 2 vs 3
      expect(outcome(eliminate(seven, "other", 3))).toBe("mafia"); // 2 vs 2
      const eight = startedAt(8, seed, "dayAnnounce");
      expect(outcome(eliminate(eight, "other", 3))).toBe("null"); // 2 vs 3
      expect(outcome(eliminate(eight, "other", 4))).toBe("mafia"); // 2 vs 2
    });
    it(`5명(마피아 1) 시드 ${seed}: 시민 팀 셋 탈락이면 mafia`, () => {
      const s = startedAt(5, seed, "dayAnnounce");
      expect(outcome(eliminate(s, "other", 2))).toBe("null"); // 1 vs 2
      expect(outcome(eliminate(s, "other", 3))).toBe("mafia"); // 1 vs 1
    });
  }
});

describe("checkWinner — 연결 여부는 보지 않는다 (D-05, CONN-02)", () => {
  it("4명에서 시민 1 탈락·나머지 시민 1 connected false 여도 여전히 null(1 vs 2)", () => {
    const s = eliminate(startedAt(4, 1, "dayAnnounce"), "other", 1);
    const cut = {
      ...s,
      players: s.players.map((p) => (p.alive !== false && p.role !== "mafia" ? { ...p, connected: false } : p)),
    };
    expect(outcome(cut)).toBe("null");
  });
  it("전원 connected false 여도 같은 판정", () => {
    const s = eliminate(startedAt(4, 2, "dayAnnounce"), "mafia", 1);
    const cut = { ...s, players: s.players.map((p) => ({ ...p, connected: false })) };
    expect(outcome(cut)).toBe("citizen");
  });
});

describe("checkWinner — 실제 배정에서 시작 직후는 null, 마피아 전멸은 citizen", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    for (const seed of SEEDS) {
      it(`${n}명 시드 ${seed}`, () => {
        const s = startedAt(n, seed, "roleReveal");
        expect(outcome(s)).toBe("null");
        const noMafia = { ...s, players: s.players.map((p) => (p.role === "mafia" ? { ...p, alive: false } : p)) };
        expect(outcome(noMafia)).toBe("citizen");
      });
    }
  }
});

describe("checkWinner — 순수성", () => {
  it("입력을 바꾸지 않고 반환은 문자열 하나 또는 null", () => {
    const s = eliminate(startedAt(4, 3, "dayAnnounce"), "other", 2);
    const before = JSON.stringify(s);
    const result = checkWinner(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(result === "citizen" || result === "mafia" || result === null).toBe(true);
    expect(typeof result).toBe("string");
  });
});
