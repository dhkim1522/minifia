import { describe, expect, it } from "vitest";
import { createRoomState, joinRoom, kickPlayer, leaveRoom, type RoomState } from "../../shared/game/room";
import { figureSrc } from "../../src/net/assets";
import { daySeatLayout, TAG_BOX_H, FIG_H } from "../../src/game/dayTable";

// 결정적 난수(mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("CHAR-01: 입장·퇴장이 섞여도 한 방의 캐릭터는 서로 다르다", () => {
  it("무작위 입장/나가기/강퇴 500번 후에도 앉은 사람 전원의 figureSrc 가 모두 다르다", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = rng(seed);
      const c = createRoomState({ code: "ABCD", hostId: "h", hostToken: "t", hostNickname: "방장", now: 0 });
      if (!c.ok) throw new Error("create");
      let s: RoomState = c.state;
      let n = 0;
      for (let step = 0; step < 500; step++) {
        const roll = r();
        if (roll < 0.55) {
          const j = joinRoom(s, { playerId: `p${n}`, token: `k${n}`, nickname: `닉${n++}` });
          if (j.ok) s = j.state;
        } else {
          const others = s.players.filter((p) => p.id !== s.hostId);
          if (others.length === 0) continue;
          const t = others[Math.floor(r() * others.length)]!;
          if (roll < 0.8) {
            const l = leaveRoom(s, t.id);
            if (l.ok && l.state) s = l.state;
          } else {
            const k = kickPlayer(s, s.hostId, t.seat);
            if (k.ok) s = k.state;
          }
        }
        const srcs = s.players.map((p) => figureSrc(p.seat).src);
        expect(new Set(srcs).size, `seed${seed} step${step}`).toBe(srcs.length);
        expect(s.players.every((p) => p.seat >= 0 && p.seat < 8)).toBe(true);
      }
    }
  });
});

describe("UX-02: 빈 자리 번호가 있어도 짧은 장면에서 모든 시점이 넘치지 않는다", () => {
  it("띄엄띄엄한 자리 번호 × 모든 내 자리 × 높이 240~298 × 폭 4종", () => {
    const out: string[] = [];
    const sets = [[0, 2, 5, 7], [1, 2, 3, 4, 6], [0, 1, 2, 3, 4, 5, 6, 7], [3, 4, 5, 6, 7, 0]];
    for (const [w, pad] of [[352, 4], [366, 12], [367, 4], [406, 12]] as const) {
      for (let h = 240; h < 299; h++) {
        for (const set of sets) {
          for (const me of set) {
            for (const p of daySeatLayout(set.map((seat) => ({ seat })), me, w, h, pad)) {
              if (p.tagTop + TAG_BOX_H > h + 1e-9) out.push(`tag w${w}h${h}${set}@${me}`);
              if (p.y - FIG_H * p.scale < -1e-9) out.push(`head w${w}h${h}${set}@${me}`);
            }
          }
        }
      }
    }
    expect(out.slice(0, 5).join(",")).toBe("");
  });
});
