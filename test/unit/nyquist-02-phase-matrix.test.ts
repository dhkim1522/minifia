import { describe, expect, it } from "vitest";
import { emote, say } from "../../shared/game/chat";
import { PHASE_DEFS } from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";

const NOW = 50_000;
const mk = (i: number, extra: Partial<Player> = {}): Player => ({
  id: `p${i}`, token: `token-p${i}-0123456789`, seat: i, nickname: `이름${i}`, nicknameKey: `이름${i}`,
  joinSeq: i, connected: true, connId: `c${i}`, role: i === 1 ? "mafia" : "citizen", ...extra,
});
const room = (phase: PhaseId): RoomState => ({
  code: "0420", createdAt: 0, expiresAt: ROOM_TTL_MS, phase, phaseEndsAt: 100_000, day: 1, hostId: "p0", nextJoinSeq: 5,
  players: [mk(0), mk(1), mk(2), mk(3), mk(4)],
  ...(phase === "defense" ? { verdict: { candidate: 2 } as RoomState["verdict"] } : {}),
});

// 이모티콘은 claim·discussion·투표 둘·변론·밤에만, 빠른 메시지는 claim 을 뺀 같은 단계에서만 받는다 (COMM-04).
const EMOTE_OK = new Set<PhaseId>(["claim", "discussion", "execVote", "candidateVote", "defense", "night"]);
const SAY_OK = new Set<PhaseId>(["discussion", "execVote", "candidateVote", "defense", "night"]);
const phases = Object.keys(PHASE_DEFS) as PhaseId[];

describe("COMM-04 단계별 수용 매트릭스 (모든 단계 전수)", () => {
  it.each(phases)("%s: 시민 생존자의 이모티콘은 허용 단계에서만 통과한다 (밤은 마피아만)", (phase) => {
    const r = emote(room(phase), "p3", "smile", NOW);
    const expected = !EMOTE_OK.has(phase) ? "WRONG_PHASE" : phase === "night" ? "WRONG_PHASE" : "ok";
    expect(r.ok ? "ok" : r.error).toBe(expected);
  });

  it.each(phases)("%s: 시민 생존자의 빠른 메시지(innocent/defNotMe)는 낮 토론·투표 단계에서만 통과한다", (phase) => {
    const tpl = phase === "defense" ? "defNotMe" : "innocent";
    // 변론의 후보(seat 2)로 보낸다. 나머지는 시민 seat 3.
    const actor = phase === "defense" ? "p2" : "p3";
    const r = say(room(phase), actor, { template: tpl }, NOW);
    const expected = !SAY_OK.has(phase) || phase === "night" ? "WRONG_PHASE" : "ok";
    expect(r.ok ? "ok" : r.error).toBe(expected);
  });

  it("밤에 살아 있는 마피아만 통과하고 탈락한 마피아는 BAD_MESSAGE 다", () => {
    const s = room("night");
    expect(emote(s, "p1", "smile", NOW).ok).toBe(true);
    const dead = { ...s, players: s.players.map((p) => (p.id === "p1" ? { ...p, alive: false } : p)) };
    const r = emote(dead, "p1", "smile", NOW);
    expect(r.ok ? "ok" : r.error).toBe("BAD_MESSAGE");
  });
});
