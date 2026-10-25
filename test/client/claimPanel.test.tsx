/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { ClaimPanel } from "../../src/components/ClaimPanel";

// 내 차례 하단 패널(03.1 UI-SPEC B, K1) 단위 테스트. view 픽스처만 쓴다(서버와는 와이어 계약으로만 만난다).

const NOW = 1_700_000_000_000;

interface ViewOpts {
  n?: number;
  roles?: RoleId[];
  role?: RoleId;
  allies?: number[];
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  return {
    code: "0042",
    phase: "claim",
    phaseEndsAt: NOW + 8_000,
    phaseDurationMs: 8_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: false },
      { seat: 1, nickname: "하윤", connected: true, isHost: true },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ],
    me,
    day: {
      n: o.n ?? 1,
      roles: o.roles ?? ["mafia", "police", "citizen"],
      turn: { seat: 0 },
      claimLog: [],
    },
  };
}

function panel(view: RoomView, canSend = true) {
  const send = vi.fn<(msg: ClientMessage) => boolean>(() => true);
  const utils = render(<ClaimPanel view={view} canSend={canSend} send={send} />);
  const rerender = (v: RoomView, can = canSend) => utils.rerender(<ClaimPanel view={v} canSend={can} send={send} />);
  return { ...utils, send, rerender };
}

function chipRow(): HTMLElement {
  const el = screen.queryByRole("group", { name: "주장할 직업" });
  expect(el, "칩 줄(group 주장할 직업)").not.toBeNull();
  return el!;
}

function chips(): HTMLButtonElement[] {
  return within(chipRow()).queryAllByRole("button") as HTMLButtonElement[];
}

function chip(name: string): HTMLButtonElement {
  const el = chips().find((c) => c.textContent === name);
  expect(el, `칩 ${name}`).toBeTruthy();
  return el!;
}

afterEach(cleanup);

describe("ClaimPanel 내 차례 하단 (D-03)", () => {
  it("제목 `내 차례예요`, 안내 `직업을 골라 주장하세요 · 안 고르면 말 안 함`, 옛 문구는 없다", () => {
    panel(makeView());
    expect(screen.queryByText("내 차례예요")).not.toBeNull();
    expect(screen.queryByText("직업을 골라 주장하세요 · 안 고르면 말 안 함")).not.toBeNull();
    expect(screen.queryByText("주장할 직업을 고르세요")).toBeNull();
    expect(screen.queryByText("주장이 공개됐어요")).toBeNull();
    expect(screen.queryByText(/거짓말도 괜찮아요/)).toBeNull();
  });

  it("4명판: 칩 글자 순서 마피아·경찰·시민·말 안 함, 모두 선택 안 됨, .mf-seg 한 줄에 .mf-seg__b 만 있고 체크 배지가 없다 (결정 0017-6)", () => {
    const { container } = panel(makeView());
    expect(chips().map((c) => c.textContent)).toEqual(["마피아", "경찰", "시민", "말 안 함"]);
    expect(chips().every((c) => c.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(chipRow().classList.contains("mf-seg")).toBe(true);
    expect(chips().map((c) => (c.classList.contains("mf-seg__b") ? "1" : "0")).join("")).toBe("1111");
    expect(container.querySelectorAll(".mf-seg__ok").length).toBe(0);
    expect(container.querySelectorAll(".mf-chip, .mf-chips").length).toBe(0);
  });

  it("칩 = day.roles(서버 순서) + 말 안 함: 5명판은 마피아·경찰·의사·시민·말 안 함, 의사가 없는 판은 의사 칩이 없다", () => {
    panel(makeView({ roles: ["mafia", "police", "doctor", "citizen"] }));
    expect(chips().map((c) => c.textContent)).toEqual(["마피아", "경찰", "의사", "시민", "말 안 함"]);
    cleanup();
    panel(makeView({ roles: ["mafia", "police", "citizen"] }));
    expect(chips().map((c) => c.textContent)).toEqual(["마피아", "경찰", "시민", "말 안 함"]);
    expect(chips().some((c) => c.textContent === "의사")).toBe(false);
  });

  it("칩을 누르면 send 가 { t:'claim', claim } 로 정확히 한 번 불리고, 그 칩이 aria-pressed true + 체크 배지, 모든 칩이 disabled", () => {
    const { send } = panel(makeView());
    fireEvent.click(chip("경찰"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ t: "claim", claim: "police" });
    expect(chips().map((c) => c.getAttribute("aria-pressed")).join("|")).toBe("false|true|false|false");
    expect(chips().map((c) => c.querySelectorAll(".mf-seg__ok").length).join("")).toBe("0100");
    expect(chips().every((c) => c.disabled)).toBe(true);
    // 잠긴 뒤에는 다른 칩도 같은 칩도 눌러도 보내지 않는다
    fireEvent.click(chip("시민"));
    fireEvent.click(chip("경찰"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("말 안 함 칩을 눌러도 같은 방식으로 claim 'none' 을 보낸다", () => {
    const { send } = panel(makeView());
    fireEvent.click(chip("말 안 함"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ t: "claim", claim: "none" });
    expect(chip("말 안 함").getAttribute("aria-pressed")).toBe("true");
    expect(chips().every((c) => c.disabled)).toBe(true);
  });

  it("서버가 새 view 객체를 보내면(같은 내용이어도) 낙관 선택이 사라지고 칩이 다시 켜진다", () => {
    const r = panel(makeView());
    fireEvent.click(chip("마피아"));
    expect(chips().every((c) => c.disabled)).toBe(true);
    r.rerender(makeView());
    expect(chips().every((c) => c.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(chips().every((c) => !c.disabled)).toBe(true);
  });

  it("canSend 가 거짓이면 모든 칩이 disabled 이고 눌러도 send 가 불리지 않는다", () => {
    const { send } = panel(makeView(), false);
    expect(chips().every((c) => c.disabled)).toBe(true);
    fireEvent.click(chip("경찰"));
    expect(send).not.toHaveBeenCalled();
  });

  it("마피아(allies [2])와 시민 화면의 패널 HTML 이 같다 — 칩 목록은 이번 판 구성이라 모두 같다 (T-02-25)", () => {
    const mafia = panel(makeView({ role: "mafia", allies: [2] })).container.innerHTML;
    cleanup();
    const citizen = panel(makeView({ role: "citizen" })).container.innerHTML;
    expect(mafia).toBe(citizen);
    expect(mafia.length).toBeGreaterThan(0);
  });
});

describe("직업 칩 한 줄 CSS (시안 f4.css .seg, 결정 0017-6)", () => {
  const css = readFileSync("src/styles/day.css", "utf8");
  const rule = (sel: string): string => {
    const esc = sel.replace(/[.\[\]"=:()]/g, "\\$&");
    return new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
  };

  it(".mf-seg__b 는 flex 1·높이 44(--tap-min)·알약, .mf-seg 는 간격 var(--space-xs) 한 줄", () => {
    expect(/flex:\s*1[;\s]/.test(rule(".mf-seg__b"))).toBe(true);
    expect(/height:\s*(44px|var\(--tap-min\))/.test(rule(".mf-seg__b"))).toBe(true);
    expect(/border-radius:\s*var\(--radius-pill\)/.test(rule(".mf-seg__b"))).toBe(true);
    expect(/display:\s*flex/.test(rule(".mf-seg"))).toBe(true);
    expect(/gap:\s*var\(--space-xs\)/.test(rule(".mf-seg"))).toBe(true);
    expect(/flex-wrap:\s*wrap/.test(rule(".mf-seg"))).toBe(false);
  });

  it(".mf-seg__b:disabled 는 opacity .6, 눌린 채 꺼진 칩은 opacity 1, .mf-seg__ok 는 18px", () => {
    expect(/opacity:\s*0?\.6/.test(rule(".mf-seg__b:disabled"))).toBe(true);
    expect(/opacity:\s*1[;\s]/.test(rule('.mf-seg__b:disabled[aria-pressed="true"]'))).toBe(true);
    expect(/width:\s*18px/.test(rule(".mf-seg__ok"))).toBe(true);
    expect(/height:\s*18px/.test(rule(".mf-seg__ok"))).toBe(true);
  });
});
