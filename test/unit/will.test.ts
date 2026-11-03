// 유언·쪽지 규칙(09-12, WILL-01·NIGHT-12, 결정 0061-9·10): 검사 순서, 같은 값 = 같은 객체, 입력 불변, view 의 받는 사람.
import { describe, expect, it } from "vitest";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { pickTarget } from "../../shared/game/night";
import { noteRecipientIds, saveNote, saveWill } from "../../shared/game/will";
import { seededRandInt } from "../helpers/seededRandom";

const START_AT = 10_000;

function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 실제 전이로 phase 에 닿은 6명 판. */
function stateAt(phase: string, seed = 7): RoomState {
  const lobby = lobbyOf(6);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  while (state.phase !== phase) {
    if (state.phaseEndsAt === null) throw new Error("phase has no deadline");
    state = tick(state, state.phaseEndsAt, seededRandInt(seed));
  }
  return state;
}

const citizenOf = (s: RoomState): Player => s.players.find((p) => p.role === "citizen")!;

describe("saveWill (WILL-01, 결정 0061-10)", () => {
  it("토론의 산 사람은 유언을 저장하고 그 사람의 will 만 바뀐다", () => {
    const s = stateAt("discussion");
    const me = citizenOf(s);
    const r = saveWill(s, me.id, "범인은 2번");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.find((p) => p.id === me.id)!.will).toBe("범인은 2번");
    expect(r.state.players.filter((p) => p.id !== me.id).every((p) => p.will === undefined)).toBe(true);
    expect(s.players.find((p) => p.id === me.id)!.will).toBeUndefined(); // 입력 불변
  });

  it("같은 값은 입력 객체 그대로 돌려준다", () => {
    const s = stateAt("discussion");
    const me = citizenOf(s);
    const first = saveWill(s, me.id, "범인은 2번");
    if (!first.ok) throw new Error("setup");
    const again = saveWill(first.state, me.id, "범인은 2번");
    expect(again.ok && again.state === first.state).toBe(true);
  });

  it("공백뿐이면 지움: will 키가 없어지고, 이미 없으면 입력 그대로", () => {
    const s = stateAt("discussion");
    const me = citizenOf(s);
    const first = saveWill(s, me.id, "범인은 2번");
    if (!first.ok) throw new Error("setup");
    const erased = saveWill(first.state, me.id, "   ");
    expect(erased.ok).toBe(true);
    if (!erased.ok) return;
    expect(Object.hasOwn(erased.state.players.find((p) => p.id === me.id)!, "will")).toBe(false);
    const nothing = saveWill(s, me.id, "   ");
    expect(nothing.ok && nothing.state === s).toBe(true);
  });

  it("지도 단계가 아니면 WRONG_PHASE (로비·역할 확인·종료)", () => {
    const lobby = lobbyOf(6);
    expect(saveWill(lobby, lobby.hostId, "a")).toEqual({ ok: false, error: "WRONG_PHASE" });
    const reveal = stateAt("roleReveal");
    expect(saveWill(reveal, citizenOf(reveal).id, "a")).toEqual({ ok: false, error: "WRONG_PHASE" });
    const ended: RoomState = { ...stateAt("discussion"), phase: "ended" };
    expect(saveWill(ended, citizenOf(ended).id, "a")).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("죽은 사람·방에 없는 사람은 BAD_MESSAGE", () => {
    const s = stateAt("discussion");
    const me = citizenOf(s);
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.id === me.id ? { ...p, alive: false } : p)) };
    expect(saveWill(dead, me.id, "a")).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(saveWill(s, "nobody", "a")).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });

  it("101 자소는 BAD_MESSAGE, 제어 문자는 정리된 값으로 저장된다", () => {
    const s = stateAt("discussion");
    const me = citizenOf(s);
    expect(saveWill(s, me.id, "가".repeat(101))).toEqual({ ok: false, error: "BAD_MESSAGE" });
    const r = saveWill(s, me.id, "a\u0000b‮c");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.find((p) => p.id === me.id)!.will).toBe("a b c");
  });

  it("단계 검사가 행위자 검사보다 먼저다", () => {
    const lobby = lobbyOf(6);
    expect(saveWill(lobby, "nobody", "a")).toEqual({ ok: false, error: "WRONG_PHASE" });
  });
});

describe("view.me.will (A4, L7)", () => {
  it("저장한 본인 view 에만 me.will 이 있고 다른 view 어디에도 본문이 없다", () => {
    const s = stateAt("discussion");
    const me = citizenOf(s);
    const saved = saveWill(s, me.id, "비밀유언문장");
    if (!saved.ok) throw new Error("setup");
    expect(buildView(saved.state, me.id, 1).me.will).toBe("비밀유언문장");
    for (const p of saved.state.players.filter((q) => q.id !== me.id)) {
      const v = buildView(saved.state, p.id, 1);
      expect(v.me.will).toBeUndefined();
      expect(JSON.stringify(v)).not.toContain("비밀유언문장");
    }
  });

  it("저장된 유언이 없으면 키가 없고, 지도 단계 밖이면 싣지 않는다", () => {
    const s = stateAt("discussion");
    const me = citizenOf(s);
    expect(Object.hasOwn(buildView(s, me.id, 1).me, "will")).toBe(false);
    const withWill: RoomState = { ...s, phase: "ended", players: s.players.map((p) => (p.id === me.id ? { ...p, will: "x" } : p)) };
    expect(buildView(withWill, me.id, 1).me.will).toBeUndefined();
  });

  it("죽은 본인에게는 싣지 않는다", () => {
    const s = stateAt("discussion");
    const me = citizenOf(s);
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.id === me.id ? { ...p, alive: false, will: "x" } : p)) };
    expect(buildView(dead, me.id, 1).me.will).toBeUndefined();
  });
});

// ---- 쪽지 (NIGHT-12, 결정 0061-9) ----
const mafiasOf = (s: RoomState): Player[] => s.players.filter((p) => p.role === "mafia").sort((a, b) => a.seat - b.seat);

/** 산 마피아 전원이 같은 시민을 골라 확정된 밤. */
function confirmedNight(): { state: RoomState; target: Player } {
  let state = stateAt("night");
  const target = state.players.find((p) => p.role === "citizen")!;
  for (const m of mafiasOf(state)) {
    const r = pickTarget(state, m.id, target.seat);
    if (!r.ok) throw new Error(`pickTarget rejected: ${r.error}`);
    state = r.state;
  }
  return { state, target };
}

describe("saveNote (NIGHT-12, 결정 0061-9)", () => {
  it("밤·산 마피아·확정이면 nightNote 가 저장되고 작성자 흔적이 상태 어디에도 없다", () => {
    const { state } = confirmedNight();
    const [a, b] = mafiasOf(state);
    const r = saveNote(state, a!.id, "미안해요");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.nightNote).toBe("미안해요");
    const diff = JSON.stringify({ ...r.state, nightNote: undefined });
    expect(diff).toBe(JSON.stringify({ ...state, nightNote: undefined }));
    // 마지막 저장이 이긴다
    const r2 = saveNote(r.state, b!.id, "두 번째");
    expect(r2.ok && r2.state.nightNote).toBe("두 번째");
  });

  it("확정이 아니면 BAD_MESSAGE", () => {
    const s = stateAt("night");
    expect(saveNote(s, mafiasOf(s)[0]!.id, "a")).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });

  it("시민·경찰·의사·유령은 BAD_MESSAGE", () => {
    const { state } = confirmedNight();
    for (const role of ["citizen", "police", "doctor"] as const) {
      const p = state.players.find((q) => q.role === role)!;
      expect(saveNote(state, p.id, "a")).toEqual({ ok: false, error: "BAD_MESSAGE" });
    }
    const m = mafiasOf(state)[0]!;
    const ghosted: RoomState = { ...state, players: state.players.map((p) => (p.id === m.id ? { ...p, alive: false } : p)) };
    expect(saveNote(ghosted, m.id, "a")).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });

  it("낮이면 WRONG_PHASE (단계 검사가 먼저)", () => {
    const s = stateAt("discussion");
    expect(saveNote(s, mafiasOf(s)[0]!.id, "a")).toEqual({ ok: false, error: "WRONG_PHASE" });
    expect(saveNote(s, "nobody", "a")).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("공백뿐이면 지움(키 없음), 같은 값은 입력 그대로", () => {
    const { state } = confirmedNight();
    const m = mafiasOf(state)[0]!;
    const first = saveNote(state, m.id, "글");
    if (!first.ok) throw new Error("setup");
    const same = saveNote(first.state, m.id, "글");
    expect(same.ok && same.state === first.state).toBe(true);
    const erased = saveNote(first.state, m.id, "   ");
    expect(erased.ok).toBe(true);
    if (!erased.ok) return;
    expect(Object.hasOwn(erased.state, "nightNote")).toBe(false);
    const none = saveNote(state, m.id, "  ");
    expect(none.ok && none.state === state).toBe(true);
  });

  it("101 자소는 BAD_MESSAGE", () => {
    const { state } = confirmedNight();
    expect(saveNote(state, mafiasOf(state)[0]!.id, "가".repeat(101))).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });
});

describe("noteRecipientIds", () => {
  it("산 마피아 id 만 seat 오름차순이고 유령은 없다", () => {
    const { state } = confirmedNight();
    const ms = mafiasOf(state);
    expect(noteRecipientIds(state)).toEqual(ms.map((m) => m.id));
    const ghosted: RoomState = { ...state, players: state.players.map((p) => (p.id === ms[0]!.id ? { ...p, alive: false } : p)) };
    expect(noteRecipientIds(ghosted)).toEqual([ms[1]!.id]);
  });
});

describe("view.me.note (결정 0061-9)", () => {
  it("밤 산 마피아 둘에게 같은 me.note, 그 밖에는 없다", () => {
    const { state } = confirmedNight();
    const m = mafiasOf(state)[0]!;
    const saved = saveNote(state, m.id, "쪽지본문");
    if (!saved.ok) throw new Error("setup");
    const s = saved.state;
    for (const p of s.players) {
      const v = buildView(s, p.id, 1);
      if (p.role === "mafia") expect(v.me.note).toBe("쪽지본문");
      else {
        expect(v.me.note).toBeUndefined();
        expect(JSON.stringify(v)).not.toContain("쪽지본문");
      }
    }
  });

  it("죽은 마피아와 아침 view 에는 없다", () => {
    const { state } = confirmedNight();
    const ms = mafiasOf(state);
    const saved = saveNote(state, ms[0]!.id, "쪽지본문");
    if (!saved.ok) throw new Error("setup");
    const ghosted: RoomState = { ...saved.state, players: saved.state.players.map((p) => (p.id === ms[0]!.id ? { ...p, alive: false } : p)) };
    expect(buildView(ghosted, ms[0]!.id, 1).me.note).toBeUndefined();
    const morning: RoomState = { ...saved.state, phase: "morning" };
    expect(buildView(morning, ms[1]!.id, 1).me.note).toBeUndefined();
  });
});
