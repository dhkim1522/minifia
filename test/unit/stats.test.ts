// 11-01 Task 3: 판 통계 카운터 순수 규칙(결정 D-6, O-16). 판 중 단계에서만 올라가고 입력을 바꾸지 않는다.
import { describe, expect, it } from "vitest";
import { STAT_PHASES, bumpStat } from "../../shared/game/stats";
import type { RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";
import { lobbyOf, startedAt } from "../helpers/voteState";

const IN_GAME: readonly PhaseId[] = ["dayAnnounce", "discussion", "nomination", "runoff", "showdown", "defense", "verdict", "execution", "night", "morning"];
const OUT_OF_GAME: readonly PhaseId[] = ["lobby", "assigning", "roleReveal", "ended"];

const withPhase = (s: RoomState, phase: PhaseId): RoomState => ({ ...s, phase });

describe("bumpStat — 판 중에만 올린다 (D-6, O-16)", () => {
  it("STAT_PHASES 는 판 중 열 단계이고 로비·역할 배정·역할 확인·결과는 들지 않는다", () => {
    expect([...STAT_PHASES].sort()).toEqual([...IN_GAME].sort());
    for (const phase of OUT_OF_GAME) expect(STAT_PHASES.has(phase)).toBe(false);
  });

  it("판 중 단계에서는 그 사람의 say 만 1 오른 새 상태를 돌려주고 입력은 그대로다", () => {
    const base = startedAt(6, 3, "discussion");
    const id = base.players[2]!.id;
    for (const phase of IN_GAME) {
      const s = withPhase(base, phase);
      const before = JSON.stringify(s);
      const next = bumpStat(s, id, "say");
      expect(`${phase}:${next === s}`).toBe(`${phase}:false`);
      expect(`${phase}:${JSON.stringify(next.players[2]!.stats)}`).toBe(`${phase}:{"say":1,"emote":0}`);
      expect(JSON.stringify(s)).toBe(before);
      expect(next.players.filter((p, i) => i !== 2 && p.stats !== undefined).length).toBe(0);
    }
  });

  it("emote 도 같은 규칙이고 두 종류가 따로 쌓인다", () => {
    const base = startedAt(6, 3, "discussion");
    const id = base.players[0]!.id;
    let s = bumpStat(base, id, "emote");
    s = bumpStat(s, id, "say");
    s = bumpStat(s, id, "emote");
    expect(s.players[0]!.stats).toEqual({ say: 1, emote: 2 });
  });

  it("로비·역할 배정·역할 확인·결과 단계에서는 같은 객체를 돌려준다", () => {
    const base = startedAt(6, 3, "discussion");
    for (const phase of OUT_OF_GAME) {
      const s = withPhase(base, phase);
      expect(`${phase}:${bumpStat(s, s.players[0]!.id, "say") === s}`).toBe(`${phase}:true`);
    }
    const lobby = lobbyOf(4);
    expect(bumpStat(lobby, lobby.players[0]!.id, "emote")).toBe(lobby);
  });

  it("방에 없는 사람이면 같은 객체를 돌려준다", () => {
    const s = startedAt(6, 3, "discussion");
    expect(bumpStat(s, "no-such-player", "say")).toBe(s);
  });
});
