// 튜토리얼 함께 진행 순수 규칙 단위 시험(17페이즈, TUT-02·TUT-05, 결정 0080-10). 서버 봇은 total 에 들지 않고, 끊긴 사람은 끝낸 것으로 센다.
import { describe, expect, it } from "vitest";
import { PHASE_DEFS } from "../../shared/game/phases";
import { attachConnection, beginGame, createRoomState, detachConnection, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { allTutorialDone, clearTutorial, markTutorialDone, tutorialProgress } from "../../shared/game/tutorial";
import { seededRandInt } from "../helpers/seededRandom";

const idOf = (seat: number): string => `player-id-000${seat}-aaaa`;

/** n 명이 모두 연결된 대기실(seat 0~n-1). */
function lobbyOf(n: number): RoomState {
  const created = createRoomState({ code: "0420", hostId: idOf(0), hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: "이름0", now: 0 });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, idOf(0), "conn-0");
  for (let i = 1; i < n; i += 1) {
    const joined = joinRoom(state, { playerId: idOf(i), token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, idOf(i), `conn-${i}`);
  }
  return state;
}

/** 사람 n 명이 켜고 시작한 tutorial 단계 방. */
function tutorialOf(n: number): RoomState {
  const started = startGame(lobbyOf(n), idOf(0), 1_000, seededRandInt(7), { tutorial: true });
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  return started.state;
}

const asBots = (state: RoomState, seats: number[]): RoomState => ({
  ...state,
  players: state.players.map((p): Player => (seats.includes(p.seat) ? { ...p, isBot: true } : p)),
});

describe("tutorialProgress", () => {
  it("방금 시작한 방은 done 0, total 은 앉은 사람 수다", () => {
    expect(tutorialProgress(tutorialOf(4))).toEqual({ done: 0, total: 4 });
  });

  it("서버 봇은 total 에 들지 않는다", () => {
    const s = asBots(tutorialOf(4), [2, 3]);
    expect(tutorialProgress(s)).toEqual({ done: 0, total: 2 });
  });

  it("끊긴 사람은 done 에 든다 (끊김 = 끝낸 것)", () => {
    const s = detachConnection(tutorialOf(4), idOf(3), "conn-3", 2_000);
    expect(tutorialProgress(s)).toEqual({ done: 1, total: 4 });
  });

  it("끝났음을 보낸 사람과 끊긴 사람이 같으면 한 번만 센다", () => {
    const marked = markTutorialDone(tutorialOf(4), idOf(3));
    if (!marked.ok) throw new Error("markTutorialDone failed");
    const s = detachConnection(marked.state, idOf(3), "conn-3", 2_000);
    expect(tutorialProgress(s)).toEqual({ done: 1, total: 4 });
  });
});

describe("markTutorialDone", () => {
  it("lobby·assigning 단계면 WRONG_PHASE", () => {
    expect(markTutorialDone(lobbyOf(4), idOf(1))).toEqual({ ok: false, error: "WRONG_PHASE" });
    const assigning = beginGame(lobbyOf(4), 1_000, seededRandInt(7));
    expect(assigning.phase).toBe("assigning");
    expect(markTutorialDone(assigning, idOf(1))).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("방에 없는 id 면 BAD_MESSAGE", () => {
    expect(markTutorialDone(tutorialOf(4), "player-id-9999-zzzz")).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });

  it("처음 보내면 tutorialPassed 에 한 줄 더한 새 상태를 돌려주고 입력은 바뀌지 않는다", () => {
    const s = tutorialOf(4);
    const r = markTutorialDone(s, idOf(2));
    if (!r.ok) throw new Error("markTutorialDone failed");
    expect(r.state).not.toBe(s);
    expect(r.state.tutorialPassed).toEqual([idOf(2)]);
    expect("tutorialPassed" in s).toBe(false);
  });

  it("이미 표시된 사람이면 입력과 같은 객체(===)를 돌려주고 입력을 바꾸지 않는다", () => {
    const first = markTutorialDone(tutorialOf(4), idOf(2));
    if (!first.ok) throw new Error("markTutorialDone failed");
    const before = JSON.stringify(first.state);
    const again = markTutorialDone(first.state, idOf(2));
    if (!again.ok) throw new Error("markTutorialDone failed");
    expect(again.state).toBe(first.state);
    expect(JSON.stringify(first.state)).toBe(before);
  });
});

describe("allTutorialDone", () => {
  it("한 명이라도 남았으면 거짓, 모두 보내면 참", () => {
    let s = tutorialOf(4);
    expect(allTutorialDone(s)).toBe(false);
    for (let seat = 0; seat < 4; seat += 1) {
      const r = markTutorialDone(s, idOf(seat));
      if (!r.ok) throw new Error("markTutorialDone failed");
      s = r.state;
      expect(allTutorialDone(s)).toBe(seat === 3);
    }
  });

  it("연결된 사람이 0명이어도 참이다 (기다릴 이유가 없다)", () => {
    let s = tutorialOf(4);
    for (let seat = 0; seat < 4; seat += 1) s = detachConnection(s, idOf(seat), `conn-${seat}`, 2_000);
    expect(allTutorialDone(s)).toBe(true);
  });

  it("사람이 둘이고 봇이 둘이면 사람 둘이 끝내야 참이다", () => {
    let s = asBots(tutorialOf(4), [2, 3]);
    expect(allTutorialDone(s)).toBe(false);
    for (const seat of [0, 1]) {
      const r = markTutorialDone(s, idOf(seat));
      if (!r.ok) throw new Error("markTutorialDone failed");
      s = r.state;
    }
    expect(allTutorialDone(s)).toBe(true);
  });
});

describe("clearTutorial", () => {
  it("키가 없으면 같은 객체", () => {
    const s = tutorialOf(4);
    expect(clearTutorial(s)).toBe(s);
  });

  it("키가 있으면 키째 지운다", () => {
    const r = markTutorialDone(tutorialOf(4), idOf(1));
    if (!r.ok) throw new Error("markTutorialDone failed");
    const cleared = clearTutorial(r.state);
    expect("tutorialPassed" in cleared).toBe(false);
  });
});

describe("PHASE_DEFS.tutorial · beginGame 난수 순서", () => {
  it("tutorial 단계 표는 150초·다음 assigning·역할을 싣지 않는다", () => {
    expect(PHASE_DEFS.tutorial).toEqual({ durationMs: 150000, next: "assigning", revealsOwnRole: false });
  });

  it("같은 시드로 opts 있이/없이 beginGame 을 부르면 역할·맵이 같다 (난수 순서 보존)", () => {
    const base = lobbyOf(6);
    const plain = beginGame(base, 1_000, seededRandInt(42));
    const withTutorial = beginGame(base, 1_000, seededRandInt(42), { tutorial: true });
    expect(plain.phase).toBe("assigning");
    expect(withTutorial.phase).toBe("tutorial");
    expect(withTutorial.players.map((p) => p.role)).toEqual(plain.players.map((p) => p.role));
    expect(withTutorial.map).toBe(plain.map);
  });
});
