// 직업 주장 규칙 단위 시험(09.1.1-01, 결정 0066-1·0015). 결과는 한 줄 문자열로 비교한다(TAP 증거 규칙).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BADGE_ORDER, BADGE_PHASES, badgeChoicesOf, setBadge } from "../../shared/game/badge";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { buildView } from "../../shared/game/view";
import type { BadgeId, PhaseId } from "../../shared/protocol";

function player(i: number, extra: Partial<Player> = {}): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
    role: i === 0 ? "mafia" : "citizen",
    ...extra,
  };
}

/** n명 방(방장 p0). 기본 6명(의사 있음). */
function room(phase: PhaseId, n = 6, edit: (p: Player) => Player = (p) => p): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt: 100_000,
    day: 2,
    hostId: "p0",
    nextJoinSeq: n,
    players: Array.from({ length: n }, (_, i) => edit(player(i))),
  } as RoomState;
}

const ok = (state: RoomState, id: string, badge: BadgeId): RoomState => {
  const r = setBadge(state, id, badge);
  if (!r.ok) throw new Error(`setBadge failed: ${r.error}`);
  return r.state;
};
const of = (state: RoomState, id: string): Player => state.players.find((p) => p.id === id)!;
/** 한 줄 요약: badge|swapped|log. */
const line = (p: Player): string => `${p.badge ?? "-"}|${p.badgeSwapped === true ? "swap" : "-"}|${(p.badgeLog ?? []).map((l) => `${l.n}:${l.v}`).join(",") || "-"}`;

describe("setBadge — 말 바꿈 표 (O-1 직전 값 기준)", () => {
  it("none -> doctor: 첫 걸기는 말 바꿈이 아니다", () => {
    expect(line(of(ok(room("discussion"), "p1", "doctor"), "p1"))).toBe("doctor|-|2:doctor");
  });
  it("doctor -> police: 말 바꿈이 켜진다", () => {
    const s = ok(ok(room("discussion"), "p1", "doctor"), "p1", "police");
    expect(line(of(s, "p1"))).toBe("police|swap|2:doctor,2:police");
  });
  it("doctor -> none: 말 바꿈이 켜지고 badge 는 none", () => {
    const s = ok(ok(room("discussion"), "p1", "doctor"), "p1", "none");
    expect(line(of(s, "p1"))).toBe("none|swap|2:doctor,2:none");
  });
  it("이미 none 인 사람의 none 은 같은 객체다", () => {
    const s = ok(ok(room("discussion"), "p1", "doctor"), "p1", "none");
    expect(setBadge(s, "p1", "none")).toEqual({ ok: true, state: s });
    expect((setBadge(s, "p1", "none") as { state: RoomState }).state).toBe(s);
  });
  it("값이 없던 사람의 none 은 같은 객체다", () => {
    const s = room("discussion");
    const r = setBadge(s, "p1", "none");
    expect(r.ok && r.state === s ? "same" : "changed").toBe("same");
  });
  it("같은 직업 재전송은 같은 객체이고 이력 줄이 늘지 않는다", () => {
    const s = ok(room("discussion"), "p1", "police");
    const r = setBadge(s, "p1", "police");
    expect(r.ok && r.state === s ? "same" : "changed").toBe("same");
    expect(line(of(s, "p1"))).toBe("police|-|2:police");
  });
  it("말 바꿈은 꺼지지 않는다: doctor -> none -> doctor 도 켜진 채", () => {
    const s = ok(ok(ok(room("discussion"), "p1", "doctor"), "p1", "none"), "p1", "doctor");
    expect(line(of(s, "p1"))).toBe("doctor|swap|2:doctor,2:none,2:doctor");
  });
  it("none 에서 다시 거는 것은 새 말 바꿈이 아니다(이미 켜진 것만 남는다)", () => {
    const s = ok(ok(room("discussion"), "p1", "none"), "p1", "police");
    // 값이 없던 사람의 none 은 아무 일도 없고, 이어서 police 를 걸면 첫 걸기다
    expect(line(of(s, "p1"))).toBe("police|-|2:police");
  });
  it("입력 상태는 바뀌지 않고 남의 줄도 그대로다", () => {
    const s = room("discussion");
    const before = JSON.stringify(s);
    const next = ok(s, "p1", "police");
    expect(JSON.stringify(s)).toBe(before);
    expect(line(of(next, "p2"))).toBe("-|-|-");
  });
  it("day 가 없으면 이력 일차는 1", () => {
    const { day: _day, ...rest } = room("discussion");
    expect(line(of(ok(rest as RoomState, "p1", "police"), "p1"))).toBe("police|-|1:police");
  });
});

describe("setBadge — 거절 (단계 -> 행위자 -> 값)", () => {
  it("낮 시작 발표·토론·지목은 받는다", () => {
    const got = (["dayAnnounce", "discussion", "nomination"] as const).map((ph) => `${ph}:${setBadge(room(ph), "p1", "police").ok}`).join(" ");
    expect(got).toBe("dayAnnounce:true discussion:true nomination:true");
  });
  it("마감 뒤와 대기실은 WRONG_PHASE", () => {
    const phases: PhaseId[] = ["lobby", "assigning", "defense", "verdict", "execution", "night", "morning", "ended"];
    const got = phases.map((ph) => {
      const r = setBadge(room(ph), "p1", "police");
      return `${ph}:${r.ok ? "ok" : r.error}`;
    });
    expect(got.join(" ")).toBe(phases.map((ph) => `${ph}:WRONG_PHASE`).join(" "));
    expect([...BADGE_PHASES].sort().join(",")).toBe("dayAnnounce,discussion,nomination");
  });
  it("단계 검사가 행위자 검사보다 먼저다(창 밖의 유령도 WRONG_PHASE)", () => {
    const s = room("defense", 6, (p) => (p.id === "p1" ? { ...p, alive: false } : p));
    const r = setBadge(s, "p1", "police");
    expect(r.ok ? "ok" : r.error).toBe("WRONG_PHASE");
  });
  it("유령·방에 없는 id 는 BAD_MESSAGE", () => {
    const s = room("discussion", 6, (p) => (p.id === "p1" ? { ...p, alive: false } : p));
    const a = setBadge(s, "p1", "police");
    const b = setBadge(s, "nobody", "police");
    expect(`${a.ok ? "ok" : a.error} ${b.ok ? "ok" : b.error}`).toBe("BAD_MESSAGE BAD_MESSAGE");
  });
  it("4명판에서 doctor 는 BAD_MESSAGE, 6명판에서는 받는다", () => {
    const four = setBadge(room("discussion", 4), "p1", "doctor");
    const six = setBadge(room("discussion", 6), "p1", "doctor");
    expect(`${four.ok ? "ok" : four.error} ${six.ok}`).toBe("BAD_MESSAGE true");
  });
  it("모르는 값은 BAD_MESSAGE", () => {
    const r = setBadge(room("discussion"), "p1", "ghost" as unknown as BadgeId);
    expect(r.ok ? "ok" : r.error).toBe("BAD_MESSAGE");
  });
  it("거절은 상태를 만들지 않는다(JSON 비교)", () => {
    const s = room("defense");
    const before = JSON.stringify(s);
    setBadge(s, "p1", "police");
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("badgeChoicesOf", () => {
  it("고정 순서(시민·경찰·의사·마피아·none)이고 4명판에는 의사가 없다", () => {
    expect(BADGE_ORDER.join(",")).toBe("citizen,police,doctor,mafia,none");
    expect(badgeChoicesOf(4).join(",")).toBe("citizen,police,mafia,none");
    expect(badgeChoicesOf(6).join(",")).toBe("citizen,police,doctor,mafia,none");
  });
});

describe("view — 공개 주장 노출 (결정 0066-1)", () => {
  const claimed = (phase: PhaseId): RoomState => {
    let s = room(phase);
    s = ok(s, "p1", "doctor");
    s = ok(s, "p1", "police");
    return s;
  };
  it("산 사람의 badge·badgeSwapped 는 모든 시점의 view 에 같은 값이고 값이 없는 좌석에는 키가 없다", () => {
    const s = claimed("discussion");
    const got = s.players.map((v) => {
      const rows = buildView(s, v.id, 10_000).players;
      return rows.map((r) => `${r.seat}:${Object.keys(r).sort().join(",")}:${String(r.badge)}`).join("|");
    });
    expect(new Set(got).size).toBe(1);
    expect(got[0]).toContain("1:alive,badge,badgeSwapped,connected,isHost,nickname,seat:police");
    expect(got[0]).toContain("2:alive,connected,isHost,nickname,seat:undefined");
  });
  it("badgeSwapped 는 말 바꿈이 있을 때만 키가 생긴다", () => {
    const s = ok(room("discussion"), "p1", "police");
    const row = buildView(s, "p0", 10_000).players.find((r) => r.seat === 1)!;
    expect(Object.keys(row).sort().join(",")).toBe("alive,badge,connected,isHost,nickname,seat");
  });
  it("탈락한 사람의 view 행에는 badge·badgeSwapped 가 없다", () => {
    const s = claimed("discussion");
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.id === "p1" ? { ...p, alive: false } : p)) };
    const row = buildView(dead, "p0", 10_000).players.find((r) => r.seat === 1)!;
    expect(Object.keys(row).sort().join(",")).toBe("alive,connected,isHost,nickname,seat");
  });
  it("badgeLog 와 이전 값은 어느 단계의 어느 view 에도 없다(키 이름·문자열 전수)", () => {
    // 직업 두 번 바꿈: doctor -> mafia -> citizen. 이전 값(doctor, mafia)은 마지막 값 citizen 의 view 어디에도 없어야 한다.
    let s = room("discussion");
    s = ok(ok(ok(s, "p1", "doctor"), "p1", "mafia"), "p1", "citizen");
    const phases: PhaseId[] = ["dayAnnounce", "discussion", "nomination"];
    const bad: string[] = [];
    for (const phase of phases) {
      const t = { ...s, phase };
      for (const v of t.players) {
        const text = JSON.stringify(buildView(t, v.id, 10_000));
        if (text.includes("badgeLog")) bad.push(`${phase}/${v.seat}: badgeLog`);
        const row = buildView(t, v.id, 10_000).players.find((r) => r.seat === 1)!;
        if (row.badge !== "citizen") bad.push(`${phase}/${v.seat}: badge ${String(row.badge)}`);
      }
    }
    expect(bad.join(" | ")).toBe("");
  });
});

describe("badge.ts 구조 — 실제 역할을 읽지 않는다 (L18)", () => {
  it("소스에 .role 속성 접근이 없다(주석 제외)", () => {
    const src = readFileSync(new URL("../../shared/game/badge.ts", import.meta.url), "utf8");
    const code = src
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(code.match(/\.\s*role\b/g) ?? []).toEqual([]);
    expect(code.match(/\bplayer\.role\b|\bactor\.role\b/g) ?? []).toEqual([]);
  });
});
