import { describe, expect, it } from "vitest";
import { pickTarget } from "../../shared/game/night";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { isAlive } from "../../shared/game/alive";
import { seededRandInt } from "../helpers/seededRandom";

// Nyquist 03: 밤 → 아침 전체 사슬을 시드 여러 개로 돌려 viewer 간 불변식을 확인한다.
function lobbyOf(n: number): RoomState {
  const c = createRoomState({ code: "0420", hostId: "player-id-0000-aaaa", hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: "이름0", now: 0 });
  if (!c.ok) throw new Error("create");
  let s = attachConnection(c.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const j = joinRoom(s, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!j.ok) throw new Error("join");
    s = attachConnection(j.state, id, `conn-${i}`);
  }
  return s;
}

function nightOf(n: number, seed: number): RoomState {
  const lobby = lobbyOf(n);
  const st = startGame(lobby, lobby.hostId, 10_000, seededRandInt(seed));
  if (!st.ok) throw new Error("start");
  let s = st.state;
  while (s.phase !== "night") s = tick(s, s.phaseEndsAt!, seededRandInt(seed)); // errand 진입(15페이즈)이 난수를 쓴다
  return s;
}

describe("밤 사슬 불변식 (NIGHT-01·06, ELIM-01)", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    it(`${n}명 판 시드 1..40: 모두 무작위로 골라도 마감은 그대로, 아침 day.morning 은 모든 viewer 가 같고 탈락자만 spectate 를 받는다`, () => {
      for (let seed = 1; seed <= 40; seed += 1) {
        let s = nightOf(n, seed);
        const deadline = s.phaseEndsAt;
        const rnd = seededRandInt(seed * 7 + 1);
        for (const actor of s.players.filter((p) => p.role !== "citizen")) {
          const targets = s.players.filter((p) => isAlive(p));
          const t = targets[rnd(targets.length)]!;
          const r = pickTarget(s, actor.id, t.seat);
          if (r.ok) s = r.state;
        }
        expect(s.phase).toBe("night");
        expect(s.phaseEndsAt).toBe(deadline);
        const m = tick(s, deadline!, seededRandInt(seed));
        expect(m.phase).toBe("morning");
        const views = m.players.map((p) => ({ p, v: buildView(m, p.id, 99_000) }));
        const ref = JSON.stringify(views[0]!.v.day?.morning);
        for (const { p, v } of views) {
          expect(JSON.stringify(v.day?.morning)).toBe(ref);
          expect(JSON.stringify(v.day?.morning ?? {})).not.toMatch(/mafia|police|doctor|citizen/);
          expect("spectate" in v).toBe(!isAlive(p));
        }
        // 탈락자가 최대 1명이고, 있다면 morning.eliminated 가 그 사람이다.
        const dead = m.players.filter((p) => !isAlive(p));
        expect(dead.length).toBeLessThanOrEqual(1);
        const elim = (views[0]!.v.day?.morning as { eliminated?: number } | undefined)?.eliminated;
        if (dead.length === 1) expect(elim).toBe(dead[0]!.seat);
        else expect(elim).toBeUndefined();
        // 무작위 선택에서 마피아 전원 일치는 드물다 — 불일치·미선택이면 {} 또는 { saved } 뿐이고, 키는 eliminated·saved 밖에 없다(결정 0061-6·12).
        expect(Object.keys(views[0]!.v.day?.morning ?? {}).every((k) => k === "eliminated" || k === "saved")).toBe(true);
      }
    });
  }
});

describe("밤 사슬 불변식 — 마피아 전원 일치 (NIGHT-08, MORN-03)", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    it(`${n}명 판 시드 1..40: 산 마피아 전원이 같은 비마피아를 고르면 그 사람이 탈락하거나(의사가 지키면 { saved: true }) 아무도 안 죽고, 모든 viewer 의 day.morning 이 같다`, () => {
      for (let seed = 1; seed <= 40; seed += 1) {
        let s = nightOf(n, seed);
        const rnd = seededRandInt(seed * 13 + 5);
        const others = s.players.filter((p) => isAlive(p) && p.role !== "mafia");
        const target = others[rnd(others.length)]!;
        for (const m of s.players.filter((p) => p.role === "mafia")) {
          const r = pickTarget(s, m.id, target.seat);
          if (!r.ok) throw new Error("mafia pick rejected");
          s = r.state;
        }
        const doctor = s.players.find((p) => p.role === "doctor");
        const doctorSaves = doctor !== undefined && rnd(2) === 0;
        if (doctor !== undefined && doctorSaves) {
          const r = pickTarget(s, doctor.id, target.seat);
          if (!r.ok) throw new Error("doctor pick rejected");
          s = r.state;
        }
        const m = tick(s, s.phaseEndsAt!);
        const views = m.players.map((p) => buildView(m, p.id, 99_000));
        const want = doctorSaves ? '{"saved":true}' : JSON.stringify({ eliminated: target.seat });
        for (const v of views) expect(JSON.stringify(v.day?.morning)).toBe(want);
        expect(m.players.filter((p) => !isAlive(p)).length).toBe(doctorSaves ? 0 : 1);
      }
    });
  }
});
