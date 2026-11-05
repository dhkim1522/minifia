import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, OutfitId, PublicPlayer, RoomView } from "../../shared/protocol";
import { DRESS_REVERT_MS, DRESS_SEND_GAP_MS, useDress } from "../../src/net/useDress";

// 10-07 Task 2: 미리 보기(즉시 갈아입음) · 서버 값으로 맞춤 · 거절·지연이면 되돌림(1200ms) · 클라이언트 260ms 간격(마지막 선택만). 가짜 타이머.
// 거절 알림·문구는 없다(L30) — 훅은 화면에 아무 글도 만들지 않는다.

const T0 = 1_000_000;
const player = (seat: number, look?: OutfitId): PublicPlayer => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0, ...(look ? { look } : {}) });
const viewOf = (myLook?: OutfitId): RoomView => ({
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players: [player(0), player(1, myLook), player(2, "noir")],
  me: { seat: 1, isHost: false },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(initial: RoomView = viewOf(), canSend = true) {
  const send = vi.fn((_m: ClientMessage) => true);
  const hook = renderHook((p: { view: RoomView; canSend: boolean }) => useDress({ view: p.view, send, canSend: p.canSend }), { initialProps: { view: initial, canSend } });
  return { send, hook, view: initial, sent: () => send.mock.calls.map((c) => c[0]) };
}
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useDress — 상수", () => {
  it("전송 간격은 서버 간격(250)보다 조금 길고 되돌림은 그 몇 배다", () => {
    expect(DRESS_SEND_GAP_MS).toBe(260);
    expect(DRESS_REVERT_MS).toBe(1200);
  });
});

describe("useDress — 미리 보기", () => {
  it("처음엔 서버 값(없으면 coat)이고 stageView 는 view 와 같은 참조다", () => {
    const a = setup();
    expect(a.hook.result.current.look).toBe("coat");
    expect(a.hook.result.current.stageView).toBe(a.view);
    a.hook.unmount();
    const b = setup(viewOf("doctor"));
    expect(b.hook.result.current.look).toBe("doctor");
    expect(b.hook.result.current.stageView).toBe(b.view);
  });

  it("pick 은 즉시 미리 보기를 켜고 {t:dress} 를 보낸다 — 내 좌석 look 만 바뀐 사본", () => {
    const { hook, sent } = setup();
    const before = hook.result.current.stageView;
    act(() => hook.result.current.pick("mafia"));
    expect(hook.result.current.look).toBe("mafia");
    expect(sent()).toEqual([{ t: "dress", look: "mafia" }]);
    const after = hook.result.current.stageView;
    expect(after).not.toBe(before);
    expect(after.players.map((p) => p.look)).toEqual([undefined, "mafia", "noir"]);
    expect(after.players[0]).toBe(before.players[0]);
  });

  it("서버 view 의 내 look 이 미리 보기 값과 같아지면 미리 보기가 끝나 view 와 같은 참조로 돌아온다", () => {
    const { hook } = setup();
    act(() => hook.result.current.pick("mafia"));
    const server = viewOf("mafia");
    hook.rerender({ view: server, canSend: true });
    expect(hook.result.current.look).toBe("mafia");
    expect(hook.result.current.stageView).toBe(server);
  });

  it("1200ms 안에 서버가 같은 값을 주지 않으면(거절·지연) 서버 값으로 조용히 되돌아간다", () => {
    const { hook } = setup(viewOf("doctor"));
    act(() => hook.result.current.pick("mafia"));
    tick(DRESS_REVERT_MS - 1);
    expect(hook.result.current.look).toBe("mafia");
    tick(1);
    expect(hook.result.current.look).toBe("doctor");
    expect(hook.result.current.stageView.players[1]!.look).toBe("doctor");
  });

  it("거절 뒤 서버가 옛 값 state 를 다시 보내도 미리 보기는 1200ms 까지 남았다가 되돌아간다", () => {
    const { hook } = setup(viewOf("doctor"));
    act(() => hook.result.current.pick("mafia"));
    hook.rerender({ view: viewOf("doctor"), canSend: true });
    expect(hook.result.current.look).toBe("mafia");
    tick(DRESS_REVERT_MS);
    expect(hook.result.current.look).toBe("doctor");
  });
});

describe("useDress — 260ms 간격 (T-10-23)", () => {
  it("간격 안의 선택은 마지막 것만 그 시각에 보낸다(중간 선택은 버려진다)", () => {
    const { hook, sent } = setup();
    act(() => hook.result.current.pick("police")); // 즉시
    tick(100);
    act(() => hook.result.current.pick("doctor"));
    tick(50);
    act(() => hook.result.current.pick("hood"));
    expect(sent()).toEqual([{ t: "dress", look: "police" }]);
    tick(DRESS_SEND_GAP_MS - 150 - 1);
    expect(sent()).toHaveLength(1);
    tick(1);
    expect(sent()).toEqual([
      { t: "dress", look: "police" },
      { t: "dress", look: "hood" },
    ]);
    expect(hook.result.current.look).toBe("hood");
  });

  it("간격이 지난 뒤의 선택은 바로 나간다", () => {
    const { hook, sent } = setup();
    act(() => hook.result.current.pick("police"));
    tick(DRESS_SEND_GAP_MS);
    act(() => hook.result.current.pick("elder"));
    expect(sent()).toHaveLength(2);
  });

  it("같은 값을 연달아 눌러도 한 번만 보낸다", () => {
    const { hook, sent } = setup();
    act(() => hook.result.current.pick("police"));
    tick(DRESS_SEND_GAP_MS);
    act(() => hook.result.current.pick("police"));
    tick(DRESS_SEND_GAP_MS);
    expect(sent()).toHaveLength(1);
  });

  it("지금 서버 값과 같은 카드를 누르면 보내지 않는다", () => {
    const { hook, sent } = setup(viewOf("doctor"));
    act(() => hook.result.current.pick("doctor"));
    expect(sent()).toEqual([]);
    expect(hook.result.current.look).toBe("doctor");
  });
});

describe("useDress — 연결이 끊김", () => {
  it("canSend 가 거짓이면 pick 은 아무 일도 없다(미리 보기·전송 없음)", () => {
    const { hook, sent } = setup(viewOf(), false);
    act(() => hook.result.current.pick("mafia"));
    expect(sent()).toEqual([]);
    expect(hook.result.current.look).toBe("coat");
  });

  it("미리 보기 중에 연결이 끊기면 대기 중인 전송을 접고 서버 값으로 돌아간다", () => {
    const { hook, sent } = setup();
    act(() => hook.result.current.pick("police"));
    act(() => hook.result.current.pick("doctor")); // 간격 안: 대기
    hook.rerender({ view: viewOf(), canSend: false });
    tick(2000);
    expect(sent()).toEqual([{ t: "dress", look: "police" }]);
    expect(hook.result.current.look).toBe("coat");
  });

  it("언마운트하면 대기 중인 타이머가 정리된다", () => {
    const { hook, sent } = setup();
    act(() => hook.result.current.pick("police"));
    act(() => hook.result.current.pick("doctor"));
    hook.unmount();
    tick(2000);
    expect(sent()).toHaveLength(1);
  });
});
