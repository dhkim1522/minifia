import { describe, expect, it, vi } from "vitest";
import { ChatStore } from "../../src/net/chatStore";
import type { ChatLineFrame } from "../../shared/protocol";

const chat = (ch: ChatLineFrame["ch"], seat: number, seq: number, text: string, at: number): ChatLineFrame => ({
  t: "chat",
  ch,
  seat,
  seq,
  text,
  at,
});

function ready(): ChatStore {
  const store = new ChatStore();
  store.setContext({ pk: "0:lobby", channel: "all", epoch: 1 });
  return store;
}

describe("ChatStore: chat 프레임 한 줄 (CHAT-01 트레이서)", () => {
  it("chat 프레임을 적용하면 구독자가 한 번 알림을 받고 줄이 표시 흐름에 나온다", () => {
    const store = ready();
    const cb = vi.fn();
    store.subscribe(cb);
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1000);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(store.lines()).toHaveLength(1);
    const [line] = store.visibleLines("all");
    expect(line).toMatchObject({ kind: "player", seat: 2, text: "안녕", key: "all:1:1000", ch: "all", scope: "all" });
  });

  it("같은 프레임을 다시 받으면 한 줄 그대로이고 구독자도 다시 부르지 않는다", () => {
    const store = ready();
    const cb = vi.fn();
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1000);
    store.subscribe(cb);
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1001);
    expect(store.lines()).toHaveLength(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it("낡은 epoch 의 프레임은 버린다", () => {
    const store = ready();
    const cb = vi.fn();
    store.subscribe(cb);
    store.apply(chat("all", 2, 1, "낡음", 1000), 0, 1000);
    expect(store.lines()).toHaveLength(0);
    expect(cb).not.toHaveBeenCalled();
  });

  it("revision 은 줄이 바뀔 때만 늘어난다", () => {
    const store = ready();
    const r0 = store.revision();
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1000);
    const r1 = store.revision();
    expect(r1).toBeGreaterThan(r0);
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1000);
    expect(store.revision()).toBe(r1);
  });

  it("사람 줄은 서버 프레임이 와야만 생긴다(낙관적 표시 없음)", () => {
    const store = ready();
    expect(store.lines()).toHaveLength(0);
    expect(store.visibleLines("all")).toHaveLength(0);
  });
});
