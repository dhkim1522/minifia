import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";

// 측정 본체를 가짜로 바꿔 "언제 import 되는가" 를 본다. 공장 함수는 모듈이 처음 평가될 때 한 번 돈다.
const spy = vi.hoisted(() => ({ loaded: 0, mounted: [] as { root: unknown; q: string }[], chatLoaded: 0, chatMounted: [] as string[] }));
vi.mock("../../src/debug/perf/perfScene", () => {
  spy.loaded += 1;
  return {
    mount: (root: unknown, params: URLSearchParams) => {
      spy.mounted.push({ root, q: params.toString() });
      return { dispose() {} };
    },
  };
});
vi.mock("../../src/debug/chatMock", () => {
  spy.chatLoaded += 1;
  return {
    mount: (_root: unknown, params: URLSearchParams) => {
      spy.chatMounted.push(params.toString());
      return { dispose() {} };
    },
  };
});

import { CHAT_MOCK_PARAM, PERF_PARAM, chatMockEnabled, initPerfDebug, perfEnabled } from "../../src/debug/perfProbe";

beforeEach(() => {
  spy.loaded = 0;
  spy.chatLoaded = 0;
  spy.mounted.length = 0;
  spy.chatMounted.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("perfEnabled·chatMockEnabled", () => {
  it("상수 이름", () => {
    expect(PERF_PARAM).toBe("perf");
    expect(CHAT_MOCK_PARAM).toBe("chat-mock");
  });
  it("?perf=1 만 켠다", () => {
    expect(perfEnabled("?perf=1")).toBe(true);
    expect(perfEnabled("?x=2&perf=1&scene=vote")).toBe(true);
    expect(perfEnabled("")).toBe(false);
    expect(perfEnabled("?perf=0")).toBe(false);
    expect(perfEnabled("?perf=2")).toBe(false);
    expect(perfEnabled("?chat-mock=1")).toBe(false);
  });
  it("?chat-mock=1 만 켠다", () => {
    expect(chatMockEnabled("?chat-mock=1")).toBe(true);
    expect(chatMockEnabled("")).toBe(false);
    expect(chatMockEnabled("?perf=1")).toBe(false);
  });
  it("저장소에 아무것도 쓰지 않는다 (측정은 매번 명시)", () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    perfEnabled("?perf=1");
    chatMockEnabled("?chat-mock=1");
    expect(set).not.toHaveBeenCalled();
  });
});

describe("initPerfDebug: 지연 로드", () => {
  it("쿼리가 없으면 false 를 돌려주고 측정 본체를 import 하지 않는다", async () => {
    expect(initPerfDebug("")).toBe(false);
    expect(initPerfDebug("?sheetdebug=1&room=ABCD")).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(spy.loaded).toBe(0);
    expect(spy.chatLoaded).toBe(0);
  });
  it("?perf=1 이면 true 를 동기로 돌려주고 perfScene 만 불러 mount(body, params) 한다", async () => {
    expect(initPerfDebug("?perf=1&scene=vote&seed=3")).toBe(true);
    await vi.waitFor(() => expect(spy.mounted.length).toBe(1));
    expect(spy.loaded).toBe(1);
    expect(spy.chatLoaded).toBe(0);
    expect(spy.mounted[0]!.root).toBe(document.body);
    expect(spy.mounted[0]!.q).toBe("perf=1&scene=vote&seed=3");
  });
  it("?chat-mock=1 이면 chatMock 만 불러 mount 한다", async () => {
    expect(initPerfDebug("?chat-mock=1")).toBe(true);
    await vi.waitFor(() => expect(spy.chatMounted.length).toBe(1));
    expect(spy.chatLoaded).toBe(1);
    expect(spy.loaded).toBe(0);
  });
  it("본체를 못 불러오면 경고 한 줄 뒤 삼킨다 (앱을 막지 않는다)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const real = spy.mounted.push.bind(spy.mounted);
    spy.mounted.push = () => {
      throw new Error("boom");
    };
    expect(initPerfDebug("?perf=1")).toBe(true);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    spy.mounted.push = real;
  });
});
