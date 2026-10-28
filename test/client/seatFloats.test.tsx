import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { CHAT_PHASES, EMOJI_MS, FLOAT_PHASES, SPOKE_MS, useDayChat, useSeatFloats } from "../../src/net/seatFloats";
import type { RoomEvent } from "../../src/net/useRoomConnection";

// 낮 토론의 보낸 사람 반전(3초)·이모티콘(2초)·그날 채팅 줄은 chat·emoji 이벤트에서만 만든다(결정 0017-2·0017-7).
// 서버 뷰에는 메시지가 없다. 보고서가 한 줄로 남도록 배열·객체 비교 대신 문자열·숫자로 단언한다.

const NOW = 10_000;

function viewOf(over: Partial<RoomView> = {}, phase: PhaseId = "discussion", n = 1): RoomView {
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [0, 1, 2, 3].map((seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 })),
    me: { seat: 0, isHost: true },
    day: { n, roles: ["mafia", "citizen"], claimLog: [] },
    ...over,
  };
}

const chat = (seq: number, seat: number, over: Record<string, unknown> = {}): RoomEvent =>
  ({ t: "chat", seq, seat, template: "innocent", at: NOW, ...over }) as RoomEvent;

/** onEvent 가짜: 구독 목록을 쥐고 이벤트를 흘려 보낸다 */
function bus() {
  const listeners = new Set<(e: RoomEvent) => void>();
  const unsubscribe = vi.fn();
  const onEvent = (l: (e: RoomEvent) => void) => {
    listeners.add(l);
    return () => {
      unsubscribe();
      listeners.delete(l);
    };
  };
  return { onEvent, unsubscribe, emit: (e: RoomEvent) => act(() => listeners.forEach((l) => l(e))), listeners };
}

function setup(initial: RoomView | null) {
  const b = bus();
  const hook = renderHook(({ view }: { view: RoomView | null }) => useSeatFloats(view, b.onEvent), {
    initialProps: { view: initial },
  });
  return { ...b, hook, update: (view: RoomView | null) => hook.rerender({ view }) };
}

function setupChat(initial: RoomView | null) {
  const b = bus();
  const hook = renderHook(({ view }: { view: RoomView | null }) => useDayChat(view, b.onEvent), {
    initialProps: { view: initial },
  });
  return { ...b, hook, update: (view: RoomView | null) => hook.rerender({ view }) };
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useSeatFloats: 보낸 사람 반전", () => {
  it("상수: 반전 SPOKE_MS 3000, 이모티콘 EMOJI_MS 2000", () => {
    expect(`${SPOKE_MS}:${EMOJI_MS}`).toBe("3000:2000");
  });

  it("discussion 중 chat 이벤트는 그 자리 spoke 를 3000ms 켠다", () => {
    const { hook, emit } = setup(viewOf());
    emit(chat(1, 2));
    expect(hook.result.current.spoke[2] !== undefined).toBe(true);
    advance(2_999);
    expect(hook.result.current.spoke[2] !== undefined).toBe(true);
    advance(1);
    expect(hook.result.current.spoke[2] === undefined).toBe(true);
  });

  it("같은 자리 새 chat 은 key 가 바뀌고 다시 3000ms, 다른 자리는 따로 센다", () => {
    const { hook, emit } = setup(viewOf());
    emit(chat(1, 2));
    const k1 = hook.result.current.spoke[2]?.key;
    advance(2_000);
    emit(chat(2, 2));
    emit(chat(3, 1));
    const k2 = hook.result.current.spoke[2]?.key;
    expect(k1 !== undefined && k2 !== undefined && k1 !== k2).toBe(true);
    advance(2_999);
    expect(hook.result.current.spoke[2] !== undefined).toBe(true);
    advance(1);
    expect(hook.result.current.spoke[2] === undefined).toBe(true);
    expect(hook.result.current.spoke[1] === undefined).toBe(true);
  });

  it("서버 뷰의 messages 키는 읽지 않는다 (재접속 복원 없음)", () => {
    const base = viewOf();
    const legacy = { ...base, day: { ...base.day!, messages: [{ seq: 1, seat: 1, template: "innocent", at: NOW }] } } as unknown as RoomView;
    const { hook } = setup(legacy);
    expect(Object.keys(hook.result.current.spoke).length).toBe(0);
  });

  it("error 이벤트와 view 가 없는 상태는 무시한다", () => {
    const { hook, emit } = setup(null);
    emit({ t: "error", code: "RATE_LIMITED" });
    emit(chat(1, 1));
    expect(Object.keys(hook.result.current.spoke).length + Object.keys(hook.result.current.emoji).length).toBe(0);
  });
});

describe("useSeatFloats: 이모티콘", () => {
  it("emoji 이벤트는 그 자리에 2000ms 뜬다", () => {
    const { hook, emit } = setup(viewOf());
    emit({ t: "emoji", seat: 2, icon: "heart", at: 1 });
    expect(hook.result.current.emoji[2]?.icon).toBe("heart");
    advance(1_999);
    expect(hook.result.current.emoji[2] !== undefined).toBe(true);
    advance(1);
    expect(hook.result.current.emoji[2] === undefined).toBe(true);
  });

  it("같은 자리에 spoke 가 있어도 둘 다 남는다; 나중 이모티콘의 z 가 크다", () => {
    const { hook, emit } = setup(viewOf());
    emit(chat(1, 2));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(hook.result.current.spoke[2] !== undefined && hook.result.current.emoji[2] !== undefined).toBe(true);
    const z1 = hook.result.current.emoji[2]!.z;
    emit({ t: "emoji", seat: 2, icon: "grin", at: 2 });
    expect(hook.result.current.emoji[2]!.z > z1).toBe(true);
    expect(hook.result.current.emoji[2]?.icon).toBe("grin");
  });
});

describe("useSeatFloats: 정리", () => {
  it("claim 단계에서 온 emoji 이벤트는 floats.emoji 에 쌓이고 spoke 는 쌓이지 않는다(chat 이벤트가 오지 않는 단계)", () => {
    const { hook, emit } = setup(viewOf({}, "claim"));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(Object.keys(hook.result.current.emoji).join(",")).toBe("2");
    expect(hook.result.current.emoji[2]?.icon).toBe("smile");
    expect(Object.keys(hook.result.current.spoke).length).toBe(0);
    // 이 단계에서는 chat 이벤트가 와도 반전을 켜지 않는다
    emit(chat(1, 1));
    expect(Object.keys(hook.result.current.spoke).length).toBe(0);
  });

  it("lobby·dayAnnounce·morning 에서 온 chat·emoji 는 무시한다", () => {
    for (const phase of ["lobby", "dayAnnounce", "morning"] as const) {
      const { hook, emit } = setup(viewOf({}, phase));
      emit(chat(1, 1));
      emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
      expect(`${phase}:${Object.keys(hook.result.current.spoke).length + Object.keys(hook.result.current.emoji).length}`).toBe(`${phase}:0`);
    }
  });

  it("claim → discussion 전환 때 floats 가 비워진다(열쇠 변경)", () => {
    const { hook, emit, update } = setup(viewOf({}, "claim"));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(Object.keys(hook.result.current.emoji).length).toBe(1);
    update(viewOf({}, "discussion"));
    expect(Object.keys(hook.result.current.emoji).length).toBe(0);
  });

  it("discussion 을 벗어나면 모두 비운다", () => {
    const { hook, emit, update } = setup(viewOf());
    emit(chat(1, 1));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(Object.keys(hook.result.current.spoke).length + Object.keys(hook.result.current.emoji).length).toBe(2);
    update(viewOf({}, "dayAnnounce"));
    expect(Object.keys(hook.result.current.spoke).length + Object.keys(hook.result.current.emoji).length).toBe(0);
  });

  it("언마운트하면 구독을 풀고 타이머가 남지 않는다", () => {
    const { hook, emit, unsubscribe, listeners } = setup(viewOf());
    emit(chat(1, 1));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(vi.getTimerCount() > 0).toBe(true);
    hook.unmount();
    expect(unsubscribe).toHaveBeenCalled();
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useDayChat: 그날 받은 chat 이벤트로만 만드는 줄 (결정 0017-7, T-02-45)", () => {
  const seqs = (lines: readonly { seq: number }[]) => lines.map((l) => l.seq).join(",");

  it("처음에는 빈 목록이다 (재접속 복원 없음)", () => {
    const { hook } = setupChat(viewOf());
    expect(hook.result.current.length).toBe(0);
  });

  it("discussion 중 chat 이벤트를 받은 순서대로 쌓는다", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(1, 1));
    emit(chat(2, 2, { template: "suspect", target: 3 }));
    expect(seqs(hook.result.current)).toBe("1,2");
    expect(hook.result.current[1]?.target).toBe(3);
  });

  it("줄은 seq·seat·template·target?·claimedRole?·at 만 필드별로 복사한다 (text·t 키 없음)", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(1, 2, { template: "claimed", target: 1, claimedRole: "police", text: "<script>x</script>", extra: 1 }));
    const l = hook.result.current[0]!;
    expect(Object.keys(l).sort().join(",")).toBe("at,claimedRole,seat,seq,target,template");
    expect(l.claimedRole).toBe("police");
  });

  it("target·claimedRole 이 없으면 그 키도 없다", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(1, 2));
    expect(Object.keys(hook.result.current[0]!).sort().join(",")).toBe("at,seat,seq,template");
  });

  it("seq 가 이미 본 최대값 이하인 프레임은 버린다", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(5, 1));
    emit(chat(5, 2));
    emit(chat(3, 3));
    emit(chat(6, 2));
    expect(seqs(hook.result.current)).toBe("5,6");
  });

  it("template 이 알려진 것 밖이면 버린다", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(1, 1, { template: "hack" }));
    emit(chat(2, 1));
    expect(seqs(hook.result.current)).toBe("2");
  });

  it("view.day.n 이 바뀌면 비운다", () => {
    const { hook, emit, update } = setupChat(viewOf({}, "discussion", 1));
    emit(chat(1, 1));
    expect(hook.result.current.length).toBe(1);
    update(viewOf({}, "discussion", 2));
    expect(hook.result.current.length).toBe(0);
    emit(chat(1, 2));
    expect(seqs(hook.result.current)).toBe("1");
  });

  it("claim 단계의 chat 은 버린다(수집 단계는 discussion·night 그대로)", () => {
    const { hook, emit } = setupChat(viewOf({}, "claim"));
    emit(chat(1, 1));
    expect(hook.result.current.length).toBe(0);
  });
});

describe("밤 수집 (D-17, 결정 0019, RESEARCH Pitfall 4)", () => {
  const seqs = (lines: readonly { seq: number }[]) => lines.map((l) => l.seq).join(",");
  const count = (f: { spoke: object; emoji: object }) => Object.keys(f.spoke).length + Object.keys(f.emoji).length;

  it("CHAT_PHASES 는 discussion·night·defense(04-21) 세 개다", () => {
    expect([...(CHAT_PHASES ?? [])].sort().join(",")).toBe("defense,discussion,night");
  });

  it("night 중 chat 이벤트는 useDayChat 줄이 된다", () => {
    const { hook, emit } = setupChat(viewOf({}, "night"));
    emit(chat(1, 1, { template: "nightAgree" }));
    expect(seqs(hook.result.current)).toBe("1");
  });

  it("night 중 emoji 이벤트는 useSeatFloats 이모티콘이 되고 chat 은 반전이 된다", () => {
    const { hook, emit } = setup(viewOf({}, "night"));
    emit({ t: "emoji", seat: 2, icon: "heart", at: 1 });
    emit(chat(1, 1, { template: "nightAgree" }));
    expect(`${hook.result.current.emoji[2]?.icon}:${hook.result.current.spoke[1] !== undefined}`).toBe("heart:true");
  });

  it("discussion 에서 받은 줄은 같은 일차의 night 로 바뀌면 보이지 않는다", () => {
    const { hook, emit, update } = setupChat(viewOf({}, "discussion", 1));
    emit(chat(1, 1));
    emit(chat(2, 2));
    expect(seqs(hook.result.current)).toBe("1,2");
    update(viewOf({}, "night", 1));
    expect(seqs(hook.result.current)).toBe("");
    emit(chat(1, 1, { template: "nightAgree" }));
    expect(seqs(hook.result.current)).toBe("1");
  });

  it("discussion 의 반전·이모티콘도 같은 일차의 night 로 바뀌면 비운다", () => {
    const { hook, emit, update } = setup(viewOf({}, "discussion", 1));
    emit(chat(1, 1));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(count(hook.result.current)).toBe(2);
    update(viewOf({}, "night", 1));
    expect(count(hook.result.current)).toBe(0);
  });

  it("night → morning 으로 바뀌면 줄이 비워진다", () => {
    const { hook, emit, update } = setupChat(viewOf({}, "night", 1));
    emit(chat(1, 1, { template: "nightAgree" }));
    expect(seqs(hook.result.current)).toBe("1");
    update(viewOf({}, "morning", 1));
    expect(seqs(hook.result.current)).toBe("");
  });

  it("night → morning 으로 바뀌면 반전·이모티콘이 모두 비워진다", () => {
    const { hook, emit, update } = setup(viewOf({}, "night", 1));
    emit(chat(1, 1, { template: "nightAgree" }));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(count(hook.result.current)).toBe(2);
    update(viewOf({}, "morning", 1));
    expect(count(hook.result.current)).toBe(0);
  });

  it("FLOAT_PHASES 는 claim·discussion·night·defense(04-21) 네 개다(반전·이모티콘은 claim 부터, 결정 0023-2)", () => {
    expect([...(FLOAT_PHASES ?? [])].sort().join(",")).toBe("claim,defense,discussion,night");
  });

  it("morning 중 온 chat·emoji 는 버리고, claim 중에는 chat 줄은 버리되 emoji 는 받는다", () => {
    for (const phase of ["morning", "claim"] as const) {
      const c = setupChat(viewOf({}, phase));
      c.emit(chat(1, 1));
      const f = setup(viewOf({}, phase));
      f.emit(chat(1, 1));
      f.emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
      expect(`${phase}:${c.hook.result.current.length}:${count(f.hook.result.current)}`).toBe(phase === "claim" ? "claim:0:1" : "morning:0:0");
    }
  });

  it("밤 줄 번호는 낮과 따로 1부터 다시 센다 — 낮 seq 7 뒤에도 night seq 1·2 를 받는다", () => {
    const { hook, emit, update } = setupChat(viewOf({}, "discussion", 1));
    emit(chat(7, 1));
    update(viewOf({}, "night", 1));
    emit(chat(1, 1, { template: "nightAgree" }));
    emit(chat(2, 2, { template: "nightOther" }));
    expect(seqs(hook.result.current)).toBe("1,2");
  });
});

describe("최후 변론 수집 (04-21, COMM-03, D-13)", () => {
  const count = (f: { spoke: object; emoji: object }) => Object.keys(f.spoke).length + Object.keys(f.emoji).length;

  it("defense 중 emoji 는 머리 위 이모티콘, chat 은 보낸 사람 반전과 채팅 줄이 된다", () => {
    const f = setup(viewOf({}, "defense", 1));
    f.emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    f.emit(chat(1, 1, { template: "defNotMe" }));
    expect(f.hook.result.current.emoji[2]?.icon).toBe("smile");
    expect(f.hook.result.current.spoke[1] !== undefined).toBe(true);
    const c = setupChat(viewOf({}, "defense", 1));
    c.emit(chat(1, 1, { template: "defNotMe" }));
    expect(c.hook.result.current.map((l) => `${l.seq}:${l.seat}:${l.template}`).join(",")).toBe("1:1:defNotMe");
  });

  it("열쇠가 `${일차}:defense` 라 discussion 의 줄·반전은 defense 로 바뀌면 비워진다", () => {
    const c = setupChat(viewOf({}, "discussion", 1));
    c.emit(chat(1, 1));
    expect(c.hook.result.current.length).toBe(1);
    c.update(viewOf({}, "defense", 1));
    expect(c.hook.result.current.length).toBe(0);
    const f = setup(viewOf({}, "discussion", 1));
    f.emit(chat(1, 1));
    f.emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    f.update(viewOf({}, "defense", 1));
    expect(count(f.hook.result.current)).toBe(0);
  });

  it("공개(candidateVoteReveal)·처형(execution)·종료(ended)·투표 단계에서는 수집하지 않는다(이벤트를 버린다)", () => {
    for (const phase of ["execVote", "candidateVote", "candidateVoteReveal", "execution", "ended"] as const) {
      const c = setupChat(viewOf({}, phase, 1));
      c.emit(chat(1, 1));
      const f = setup(viewOf({}, phase, 1));
      f.emit(chat(1, 1));
      f.emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
      expect(`${phase}:${c.hook.result.current.length}:${count(f.hook.result.current)}`).toBe(`${phase}:0:0`);
    }
  });

  it("defense → execution 으로 바뀌면 이모티콘·반전이 비워진다", () => {
    const f = setup(viewOf({}, "defense", 1));
    f.emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    f.update(viewOf({}, "execution", 1));
    expect(count(f.hook.result.current)).toBe(0);
  });
});
