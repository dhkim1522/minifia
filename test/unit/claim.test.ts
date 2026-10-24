import { describe, expect, it } from "vitest";
import { claimOptions, currentClaim, enterClaim, enterClaimReveal, selectClaim } from "../../shared/game/claim";
import { CLAIM_MS, CLAIM_REVEAL_MS } from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import type { RoleId } from "../../shared/game/roles";
import type { Claim, PhaseId } from "../../shared/protocol";

type Extra = Partial<Pick<Player, "connected" | "claimChoice" | "claimShown" | "claimLast" | "claimChanged" | "role" | "alive">>;

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

/** n 명이 앉은 방(전원 연결). roles 를 주면 앞에서부터 실제 역할을 넣는다. */
function roomOf(n: number, phase: PhaseId, roles: RoleId[] = []): RoomState {
  const base = stateWith(phase, {}, { others: Array.from({ length: n - 1 }, () => ({})) });
  return { ...base, players: base.players.map((p, i) => (roles[i] ? { ...p, role: roles[i] } : p)) };
}

describe("claimOptions - 이번 판 선택지 (D-07)", () => {
  it("4명판은 마피아·경찰·시민·말 안 함(의사 없음)", () => {
    expect(claimOptions(4).join(",")).toBe("mafia,police,citizen,none");
  });

  it("6명판은 의사까지 넣은 다섯 개", () => {
    expect(claimOptions(6).join(",")).toBe("mafia,police,doctor,citizen,none");
  });

  it("5~8명은 모두 다섯 개이고 지원 밖 인원은 말 안 함 하나뿐이다", () => {
    expect([5, 6, 7, 8].map((n) => claimOptions(n).length).join(",")).toBe("5,5,5,5");
    expect(claimOptions(3).join(",")).toBe("none");
  });
});

describe("selectClaim - 선택 검증 (D-03, D-10, T-02-05)", () => {
  it("claim 단계가 아니면 WRONG_PHASE (공개 연출·토론·발표·대기실 포함)", () => {
    const phases: PhaseId[] = ["lobby", "assigning", "roleReveal", "dayAnnounce", "claimReveal", "discussion", "night", "morning"];
    const got = phases.map((phase) => {
      const r = selectClaim(roomOf(4, phase), "p0", "police");
      return r.ok ? "ok" : r.error;
    });
    expect(got.join(",")).toBe(phases.map(() => "WRONG_PHASE").join(","));
  });

  it("방에 없는 id 는 BAD_MESSAGE", () => {
    const r = selectClaim(roomOf(4, "claim"), "ghost", "police");
    expect(r.ok ? "ok" : r.error).toBe("BAD_MESSAGE");
  });

  it("4명판에서 doctor 는 BAD_MESSAGE, 알 수 없는 값(king)도 BAD_MESSAGE", () => {
    const s = roomOf(4, "claim");
    const a = selectClaim(s, "p0", "doctor");
    const b = selectClaim(s, "p0", "king" as unknown as Claim);
    expect(`${a.ok ? "ok" : a.error},${b.ok ? "ok" : b.error}`).toBe("BAD_MESSAGE,BAD_MESSAGE");
  });

  it("검사 순서: 단계 → 방 소속 → 값. 단계가 틀리면 다른 검사에 앞서 WRONG_PHASE", () => {
    const r = selectClaim(roomOf(4, "discussion"), "ghost", "king" as unknown as Claim);
    expect(r.ok ? "ok" : r.error).toBe("WRONG_PHASE");
  });

  /** p0 가 탈락자인 4명판 */
  const withDeadP0 = (phase: PhaseId): RoomState => {
    const base = roomOf(4, phase);
    return { ...base, players: base.players.map((p) => (p.id === "p0" ? { ...p, alive: false } : p)) };
  };
  const result = (r: { ok: true } | { ok: false; error: string }): string => (r.ok ? "ok" : r.error);

  it("claim 단계에서 탈락자(alive false)의 selectClaim 은 BAD_MESSAGE 이고 상태는 그대로다 (ELIM-01)", () => {
    const s = withDeadP0("claim");
    const frozen = JSON.stringify(s);
    expect(result(selectClaim(s, "p0", "police"))).toBe("BAD_MESSAGE");
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it("검사 순서: 단계가 틀리면 탈락자여도 WRONG_PHASE, 방에 없는 id 는 BAD_MESSAGE, 탈락자는 선택지 밖 값이어도 BAD_MESSAGE (단계 → 방 소속 → 생존 → 값)", () => {
    const wrongPhases = (["discussion", "night", "morning"] as PhaseId[]).map((phase) => `${phase}:${result(selectClaim(withDeadP0(phase), "p0", "police"))}`);
    expect(wrongPhases.join(" ")).toBe("discussion:WRONG_PHASE night:WRONG_PHASE morning:WRONG_PHASE");
    expect(result(selectClaim(withDeadP0("claim"), "ghost", "police"))).toBe("BAD_MESSAGE");
    expect(result(selectClaim(withDeadP0("claim"), "p0", "king" as unknown as Claim))).toBe("BAD_MESSAGE");
  });

  it("살아 있는 사람의 선택은 탈락자가 있어도 그대로 통과한다", () => {
    expect(result(selectClaim(withDeadP0("claim"), "p1", "police"))).toBe("ok");
  });

  it("통과하면 그 사람의 claimChoice 만 바뀌고 입력은 그대로다", () => {
    const s = roomOf(4, "claim");
    const frozen = JSON.stringify(s);
    const r = selectClaim(s, "p1", "police");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(s)).toBe(frozen);
    expect(r.state.players.map((p) => String(p.claimChoice)).join(",")).toBe("undefined,police,undefined,undefined");
    // claimChoice 외 필드와 방 필드는 그대로
    const strip = (x: RoomState) => JSON.stringify({ ...x, players: x.players.map(({ claimChoice: _c, ...rest }) => rest) });
    expect(strip(r.state)).toBe(strip(s));
    expect(r.state.players[0] === s.players[0]).toBe(true);
  });

  it("마감 전까지 다시 골라 바꿀 수 있고 마지막 값이 남는다", () => {
    const s = roomOf(5, "claim");
    const first = selectClaim(s, "p2", "police");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = selectClaim(first.state, "p2", "doctor");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.players[2]!.claimChoice).toBe("doctor");
  });

  it("같은 값을 다시 고르면 같은 상태 객체를 돌려준다", () => {
    const s = roomOf(4, "claim");
    const first = selectClaim(s, "p0", "none");
    if (!first.ok) throw new Error("first select failed");
    const again = selectClaim(first.state, "p0", "none");
    expect(again.ok && again.state === first.state).toBe(true);
  });

  it("서버는 참·거짓을 보지 않는다: 네 역할 모두가 다섯 선택지를 전부 고를 수 있다 (D-10, T-02-06)", () => {
    const roles: RoleId[] = ["mafia", "police", "doctor", "citizen", "citizen"];
    const s = roomOf(5, "claim", roles);
    const options = claimOptions(5);
    const rows: string[] = [];
    for (const [i, role] of roles.slice(0, 4).entries()) {
      for (const claim of options) {
        const r = selectClaim(s, `p${i}`, claim);
        rows.push(`${role}:${claim}:${r.ok ? "ok" : r.error}`);
      }
    }
    expect(rows.length).toBe(20);
    expect(rows.filter((x) => !x.endsWith(":ok")).join("|")).toBe("");
  });
});

describe("currentClaim - 내 화면 초기 선택 (D-09)", () => {
  it("직접 고른 값이 먼저, 없으면 어제 공개 값, 둘 다 없으면 undefined", () => {
    const a = currentClaim(player(0, { claimChoice: "citizen", claimLast: "police" }));
    const b = currentClaim(player(0, { claimLast: "police" }));
    const c = currentClaim(player(0));
    expect(`${a},${b},${c}`).toBe("citizen,police,undefined");
  });
});

describe("enterClaim - 이번 낮 선택 초기화 (D-03, D-09)", () => {
  it("모든 플레이어에서 claimChoice 키가 사라지고 claimLast·claimShown 은 남는다", () => {
    const s = stateWith(
      "claim",
      { claimChoice: "police", claimLast: "mafia", claimShown: "mafia" },
      { others: [{ claimChoice: "none" }, { claimLast: "doctor" }, {}] },
    );
    const out = enterClaim(s);
    expect(out.players.map((p) => "claimChoice" in p).join(",")).toBe("false,false,false,false");
    expect(`${out.players[0]!.claimLast}/${out.players[0]!.claimShown}/${out.players[2]!.claimLast}`).toBe(
      "mafia/mafia/doctor",
    );
    expect(s.players[0]!.claimChoice).toBe("police");
  });
});
