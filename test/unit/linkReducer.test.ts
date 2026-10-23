import { describe, expect, it } from "vitest";
import type { LinkEvent, LinkState } from "../../src/net/linkReducer";
import { FAIL_AFTER_MS, initialLinkState, linkReducer, RESTORED_MS, retryDelayMs } from "../../src/net/linkReducer";

function run(events: LinkEvent[], from: LinkState = initialLinkState(0, true)): LinkState {
  return events.reduce(linkReducer, from);
}

// 첫 state 까지 받은 연결 상태
const connected = () => run([{ type: "open", now: 0 }, { type: "state", now: 0 }]);

describe("linkReducer: 기본 전이", () => {
  it("처음에는 connecting, 띠 없음, epoch 0", () => {
    const s = initialLinkState(0, true);
    expect(s.status).toBe("connecting");
    expect(s.banner).toBe("hidden");
    expect(s.epoch).toBe(0);
    expect(s.hasView).toBe(false);
  });

  it("open 은 open·attempts 0·epoch 1, state 는 hasView 를 참으로 한다", () => {
    const opened = run([{ type: "open", now: 0 }]);
    expect(opened.status).toBe("open");
    expect(opened.attempts).toBe(0);
    expect(opened.epoch).toBe(1);
    expect(opened.hasView).toBe(false);
    expect(linkReducer(opened, { type: "state", now: 10 }).hasView).toBe(true);
  });

  it("view 가 있는 채 close 1006 이면 reconnecting 띠, attempts 1, failingSince 는 그 시각", () => {
    const s = linkReducer(connected(), { type: "close", code: 1006, reason: "", now: 500 });
    expect(s.status).toBe("reconnecting");
    expect(s.banner).toBe("reconnecting");
    expect(s.attempts).toBe(1);
    expect(s.failingSince).toBe(500);
  });

  it("다시 open 하면 epoch 2, 첫 state 가 오면 restored 띠가 2초 뒤 사라진다", () => {
    const dropped = linkReducer(connected(), { type: "close", code: 1006, reason: "", now: 500 });
    const reopened = linkReducer(dropped, { type: "open", now: 900 });
    expect(reopened.epoch).toBe(2);
    expect(reopened.banner).toBe("reconnecting");
    const restored = linkReducer(reopened, { type: "state", now: 1000 });
    expect(restored.banner).toBe("restored");
    expect(restored.restoredUntil).toBe(1000 + RESTORED_MS);
    expect(linkReducer(restored, { type: "tick", now: 2999 }).banner).toBe("restored");
    expect(linkReducer(restored, { type: "tick", now: 3000 }).banner).toBe("hidden");
  });

  it("view 없이 끊기면 띠 없이 reconnecting(화면은 전체 '연결 중…')", () => {
    const s = run([{ type: "open", now: 0 }, { type: "close", code: 1006, reason: "", now: 100 }]);
    expect(s.status).toBe("reconnecting");
    expect(s.banner).toBe("hidden");
  });

  it("close 4001 은 replaced", () => {
    expect(linkReducer(connected(), { type: "close", code: 4001, reason: "replaced", now: 5 }).status).toBe("replaced");
  });

  it("close 4003 은 removed 와 사유, 알 수 없는 사유는 room_closed", () => {
    const kicked = linkReducer(connected(), { type: "close", code: 4003, reason: "kicked", now: 5 });
    expect(kicked.status).toBe("removed");
    expect(kicked.removedReason).toBe("kicked");
    const unknown = linkReducer(connected(), { type: "close", code: 4003, reason: "???", now: 5 });
    expect(unknown.removedReason).toBe("room_closed");
  });
});

describe("retryDelayMs: 지수 백오프(상한 5초) + 지터", () => {
  it("500 에서 시작해 두 배씩, 5000 이 상한", () => {
    expect([1, 2, 3, 4, 5, 9].map((n) => retryDelayMs(n, 0))).toEqual([500, 1000, 2000, 4000, 5000, 5000]);
  });

  it("지터는 0~249 를 더한다", () => {
    expect(retryDelayMs(1, 0.99)).toBe(500 + 247);
  });
});

describe("linkReducer: 보이는 시간만 세는 30초 포기", () => {
  // 보이는 상태에서 now 0 에 끊김
  const failing = () => linkReducer(connected(), { type: "close", code: 1006, reason: "", now: 0 });

  it("보이는 상태에서 29_999 는 그대로, 30_000 이면 failed 이고 띠는 사라진다", () => {
    expect(FAIL_AFTER_MS).toBe(30_000);
    expect(linkReducer(failing(), { type: "tick", now: 29_999 }).status).toBe("reconnecting");
    const failed = linkReducer(failing(), { type: "tick", now: 30_000 });
    expect(failed.status).toBe("failed");
    expect(failed.banner).toBe("hidden");
  });

  it("화면이 꺼진 시간은 세지 않는다: 숨기면 failingSince 가 비고, 다시 보이면 그 시각부터 센다", () => {
    const hidden = linkReducer(failing(), { type: "visibility", visible: false, now: 1_000 });
    expect(hidden.failingSince).toBeNull();
    expect(linkReducer(hidden, { type: "tick", now: 200_000 }).status).not.toBe("failed");
    const shown = linkReducer(hidden, { type: "visibility", visible: true, now: 200_000 });
    expect(shown.failingSince).toBe(200_000);
    expect(linkReducer(shown, { type: "tick", now: 229_999 }).status).toBe("reconnecting");
    expect(linkReducer(shown, { type: "tick", now: 230_000 }).status).toBe("failed");
  });

  it("숨겨진 채 닫히면 failingSince 를 시작하지 않는다", () => {
    const hidden = linkReducer(connected(), { type: "visibility", visible: false, now: 10 });
    const closed = linkReducer(hidden, { type: "close", code: 1006, reason: "", now: 20 });
    expect(closed.status).toBe("reconnecting");
    expect(closed.failingSince).toBeNull();
  });

  it("failed 에서 retry 하면 connecting, attempts 0, failingSince 는 그 시각", () => {
    const failed = linkReducer(failing(), { type: "tick", now: 30_000 });
    const again = linkReducer(failed, { type: "retry", now: 31_000 });
    expect(again.status).toBe("connecting");
    expect(again.attempts).toBe(0);
    expect(again.failingSince).toBe(31_000);
  });

  it("roomGone 이면 removed 와 room_closed", () => {
    const s = linkReducer(failing(), { type: "roomGone", now: 5 });
    expect(s.status).toBe("removed");
    expect(s.removedReason).toBe("room_closed");
  });
});
