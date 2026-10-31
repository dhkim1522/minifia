/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoomView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DefenseChips } from "../../src/components/DefenseChips";
import { DEFENSE_SENT_MS, VERDICT_TEXT } from "../../src/game/verdict";
import { DEFENSE_TEMPLATE_ORDER, TEMPLATE_CHIP } from "../../src/game/messageText";

// 후보 본인 변론 패널 04-22 (COMM-03, D-13, P-8). 서버와는 view 픽스처와 가짜 연결로만 만난다.

const NOW = 1_700_000_000_000;

function makeView(): RoomView {
  return {
    code: "0042",
    phase: "defense",
    phaseEndsAt: NOW + 10_000,
    phaseDurationMs: 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ],
    me: { seat: 2, isHost: false },
    day: { n: 1, roles: ["mafia", "police", "citizen"], claimLog: [], candidate: 2 },
  };
}

function emitter() {
  const listeners = new Set<(e: RoomEvent, meta: { epoch: number }) => void>();
  return {
    onEvent: (l: (e: RoomEvent, meta: { epoch: number }) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    emit: (e: RoomEvent) =>
      act(() => {
        for (const l of [...listeners]) l(e, { epoch: 1 });
      }),
  };
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

function chips(over: Partial<RoomConnection> = {}) {
  const view = makeView();
  const c = conn(view, over);
  const showToast = vi.fn();
  const utils = render(<DefenseChips view={view} connection={c} showToast={showToast} />);
  return { ...utils, conn: c, showToast, send: c.send as ReturnType<typeof vi.fn> };
}

const chipBtn = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const allChips = () => DEFENSE_TEMPLATE_ORDER.map((id) => chipBtn(TEMPLATE_CHIP[id]));
const guide = (c: HTMLElement) => c.querySelector(".mf-claimpanel__guide")!.textContent;
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const group = (name: string) => within(screen.getByRole("group", { name }));
const sheetSend = () => within(document.querySelector("dialog")!).getByRole("button", { name: "보내기" }) as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DefenseChips: 모양 (UI-SPEC 8.4)", () => {
  it("제목 `변론할 말을 고르세요`, 안내 `한 번에 하나씩 보낼 수 있어요`, 칩 6개가 번호 순으로 있다", () => {
    const { container } = chips();
    expect(container.querySelector("h2")?.textContent).toBe(VERDICT_TEXT.defenseChooseTitle);
    expect(guide(container)).toBe(VERDICT_TEXT.defenseChooseHint);
    const grid = container.querySelector(".mf-defchips")!;
    expect([...grid.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "저 아니에요",
      "저는 시민이에요",
      "[○○] 의심해 주세요",
      "[○○] 믿어 주세요",
      "제가 [직업]입니다",
      "한 번만 믿어 주세요",
    ]);
    expect([...grid.querySelectorAll("button")].every((b) => b.classList.contains("mf-seg__b") && b.classList.contains("mf-defchips__b"))).toBe(true);
  });

  it("자유 입력창이 없다", () => {
    const { container } = chips();
    expect(container.querySelectorAll("input, textarea, [contenteditable]").length).toBe(0);
  });
});

describe("DefenseChips: 즉시 전송 칩 (대상·직업 없음)", () => {
  it("`저 아니에요` → { t:'say', template:'defNotMe' } 한 번, 안내 줄이 `보냈어요 · 저 아니에요`, 2초 뒤 원래 문구", () => {
    const { container, send } = chips();
    fireEvent.click(chipBtn("저 아니에요"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "say", template: "defNotMe" });
    expect(guide(container)).toBe("보냈어요 · 저 아니에요");
    advance(DEFENSE_SENT_MS - 1);
    expect(guide(container)).toBe("보냈어요 · 저 아니에요");
    advance(1);
    expect(guide(container)).toBe(VERDICT_TEXT.defenseChooseHint);
  });

  it("`저는 시민이에요`·`한 번만 믿어 주세요` 도 템플릿 ID 하나만 보낸다", () => {
    const { send } = chips();
    fireEvent.click(chipBtn("저는 시민이에요"));
    expect(send).toHaveBeenLastCalledWith({ t: "say", template: "defCitizen" });
    advance(2_000);
    fireEvent.click(chipBtn("한 번만 믿어 주세요"));
    expect(send).toHaveBeenLastCalledWith({ t: "say", template: "defPlead" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("보낸 동안 칩 6개가 모두 disabled 이고 쿨다운(2초)이 끝나면 풀린다 — 연타해도 한 번만 나간다", () => {
    const { send } = chips();
    fireEvent.click(chipBtn("저 아니에요"));
    expect(allChips().every((b) => b.disabled)).toBe(true);
    fireEvent.click(chipBtn("저는 시민이에요"));
    expect(send).toHaveBeenCalledTimes(1);
    advance(1_999);
    expect(allChips().every((b) => b.disabled)).toBe(true);
    advance(1);
    expect(allChips().some((b) => b.disabled)).toBe(false);
  });

  it("새로 보내면 보냄 표시가 새 문장으로 바뀌고 2초가 다시 시작된다", () => {
    const { container } = chips();
    fireEvent.click(chipBtn("저 아니에요"));
    advance(2_000);
    fireEvent.click(chipBtn("저는 시민이에요"));
    expect(guide(container)).toBe("보냈어요 · 저는 시민이에요");
    advance(1_500);
    expect(guide(container)).toBe("보냈어요 · 저는 시민이에요");
    advance(500);
    expect(guide(container)).toBe(VERDICT_TEXT.defenseChooseHint);
  });

  it("연결이 끊겨 연결이 보내지 못하면(send false) 보냄 표시도 잠금도 없다", () => {
    const { container } = chips({ send: vi.fn(() => false) });
    fireEvent.click(chipBtn("저 아니에요"));
    expect(guide(container)).toBe(VERDICT_TEXT.defenseChooseHint);
    expect(allChips().some((b) => b.disabled)).toBe(false);
  });
});

describe("DefenseChips: 시트로 고르는 칩 (대상·직업 있음, P-8)", () => {
  it("`[○○] 의심해 주세요` → 빠른 메시지 시트가 문구 칩 그 하나로 열린다 → 대상 고르고 보내기 → { template:'defSuspect', target } 한 번, 시트 닫힘, 보냄 표시", () => {
    const { container, send } = chips();
    fireEvent.click(chipBtn("[○○] 의심해 주세요"));
    expect(document.querySelector("dialog")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    expect(group("문구").getAllByRole("button").map((b) => b.textContent)).toEqual(["[○○] 의심해 주세요"]);
    // 후보 본인(지우 아님, 민지=2)을 뺀 생존자
    expect(group("대상").getAllByRole("button").map((b) => b.textContent)).toEqual(["지우", "하윤", "도현"]);
    expect(sheetSend().disabled).toBe(true);
    fireEvent.click(group("대상").getByRole("button", { name: "하윤" }));
    fireEvent.click(sheetSend());
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "say", template: "defSuspect", target: 1 });
    advance(400); // 시트 닫힘 애니메이션
    expect(document.querySelector("dialog")).toBeNull();
    expect(guide(container)).toBe("보냈어요 · 하윤 의심해 주세요");
    expect(allChips().every((b) => b.disabled)).toBe(true);
    advance(DEFENSE_SENT_MS);
    expect(guide(container)).toBe(VERDICT_TEXT.defenseChooseHint);
    expect(allChips().some((b) => b.disabled)).toBe(false);
  });

  it("`[○○] 믿어 주세요` → { template:'defTrust', target }", () => {
    const { send } = chips();
    fireEvent.click(chipBtn("[○○] 믿어 주세요"));
    fireEvent.click(group("대상").getByRole("button", { name: "도현" }));
    fireEvent.click(sheetSend());
    expect(send).toHaveBeenCalledWith({ t: "say", template: "defTrust", target: 3 });
  });

  it("`제가 [직업]입니다` → 시트 직업 칩은 view.day.roles 그대로, 보내면 { template:'defRole', claimedRole }", () => {
    const { container, send } = chips();
    fireEvent.click(chipBtn("제가 [직업]입니다"));
    expect(group("문구").getAllByRole("button").map((b) => b.textContent)).toEqual(["제가 [직업]입니다"]);
    expect(group("직업").getAllByRole("button").map((b) => b.textContent)).toEqual(["마피아", "경찰", "시민"]);
    expect(screen.queryByRole("group", { name: "대상" })).toBeNull();
    fireEvent.click(group("직업").getByRole("button", { name: "경찰" }));
    fireEvent.click(sheetSend());
    expect(send).toHaveBeenCalledWith({ t: "say", template: "defRole", claimedRole: "police" });
    expect(guide(container)).toBe("보냈어요 · 제가 경찰입니다");
  });

  it("시트를 닫기만 하면 아무것도 보내지 않고 안내 줄도 그대로다", () => {
    const { container, send } = chips();
    fireEvent.click(chipBtn("[○○] 의심해 주세요"));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    advance(400);
    expect(document.querySelector("dialog")).toBeNull();
    expect(send).not.toHaveBeenCalled();
    expect(guide(container)).toBe(VERDICT_TEXT.defenseChooseHint);
    expect(allChips().some((b) => b.disabled)).toBe(false);
  });
});

describe("DefenseChips: 잠금·오류·정리", () => {
  it("canSend 가 false 면 칩 6개 모두 disabled", () => {
    chips({ canSend: false });
    expect(allChips().every((b) => b.disabled)).toBe(true);
  });

  it("서버가 BAD_MESSAGE 로 거부하면 토스트 `보내지 못했어요. 다시 시도해 주세요`", () => {
    const bus = emitter();
    const { showToast } = chips({ onEvent: bus.onEvent });
    bus.emit({ t: "error", code: "BAD_MESSAGE" });
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("보내지 못했어요. 다시 시도해 주세요");
  });

  it("언마운트하면 보냄 표시 타이머가 정리된다(대기 중인 타이머 없음)", () => {
    const { unmount } = chips();
    fireEvent.click(chipBtn("저 아니에요"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("시트가 열린 채 언마운트하면 시트도 사라진다", () => {
    const { unmount } = chips();
    fireEvent.click(chipBtn("[○○] 의심해 주세요"));
    expect(document.querySelector("dialog")).toBeTruthy();
    unmount();
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("COMM-04: 소스에 자유 텍스트 입력이 없고 칩 문구·순서는 DEFENSE_TEMPLATE_ORDER·TEMPLATE_CHIP 에서 온다", () => {
    const src = readFileSync("src/components/DefenseChips.tsx", "utf8");
    expect(src).toContain("DEFENSE_TEMPLATE_ORDER");
    expect(src).toContain("TEMPLATE_CHIP");
    expect(src).toContain("QUICK_TEMPLATES");
    expect(src).not.toMatch(/<input|<textarea/);
  });
});
