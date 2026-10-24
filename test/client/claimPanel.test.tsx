/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { Claim, ClientMessage, PhaseId, RoomView, SeatClaim } from "../../shared/protocol";
import { ClaimPanel } from "../../src/components/ClaimPanel";

// 직업 공개 하단 패널(S-06b)·공개 연출 패널(S-06c) 단위 테스트. view 픽스처만 쓴다(서버와는 와이어 계약으로만 만난다).

const NOW = 1_700_000_000_000;

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  roles?: RoleId[];
  myClaim?: Claim;
  claims?: SeatClaim[];
  role?: RoleId;
  allies?: number[];
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  if (o.myClaim !== undefined) me.claim = o.myClaim;
  return {
    code: "0042",
    phase: o.phase ?? "claim",
    phaseEndsAt: NOW + 15_000,
    phaseDurationMs: 15_000,
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
      ...(o.claims ? { claims: o.claims } : {}),
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

describe("ClaimPanel 직업 공개 (S-06b, D-03·D-07·D-09)", () => {
  it("4명판: 제목·1일차 안내·칩 글자 순서 마피아·경찰·시민·말 안 함, 모두 선택 안 됨", () => {
    panel(makeView());
    expect(screen.queryByText("주장할 직업을 고르세요")).not.toBeNull();
    expect(screen.queryByText("거짓말도 괜찮아요. 시간이 끝나면 모두에게 한꺼번에 공개돼요")).not.toBeNull();
    expect(chips().map((c) => c.textContent)).toEqual(["마피아", "경찰", "시민", "말 안 함"]);
    expect(chips().every((c) => c.getAttribute("aria-pressed") === "false")).toBe(true);
  });

  it("4명판: 칩 그룹은 .mf-seg 한 줄이고 버튼 넷이 모두 .mf-seg__b 이며 체크 배지(.mf-seg__ok)가 없다 (결정 0017-6)", () => {
    const { container } = panel(makeView());
    expect(chipRow().classList.contains("mf-seg")).toBe(true);
    expect(chips().map((c) => (c.classList.contains("mf-seg__b") ? "1" : "0")).join("")).toBe("1111");
    expect(container.querySelectorAll(".mf-seg__ok").length).toBe(0);
    expect(container.querySelectorAll(".mf-chip, .mf-chips").length).toBe(0);
  });

  it("5명판: view.day.roles 4개 → 칩 5개(마피아·경찰·의사·시민·말 안 함)", () => {
    panel(makeView({ roles: ["mafia", "police", "doctor", "citizen"] }));
    expect(chips().map((c) => c.textContent)).toEqual(["마피아", "경찰", "의사", "시민", "말 안 함"]);
  });

  it("칩을 누르면 확인 없이 바로 보내고 즉시 선택된다. 같은 칩 재누름은 무시, 다른 칩은 다시 보낸다", () => {
    const { send } = panel(makeView());
    fireEvent.click(chip("경찰"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ t: "claim", claim: "police" });
    expect(chip("경찰").getAttribute("aria-pressed")).toBe("true");
    // 고른 칩에만 체크 배지 하나
    expect(chips().map((c) => c.querySelectorAll(".mf-seg__ok").length).join("")).toBe("0100");
    expect(chipRow().querySelectorAll(".mf-seg__ok").length).toBe(1);
    fireEvent.click(chip("경찰"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(chip("경찰").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip("시민"));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ t: "claim", claim: "citizen" });
    expect(chip("시민").getAttribute("aria-pressed")).toBe("true");
    expect(chip("경찰").getAttribute("aria-pressed")).toBe("false");
    expect(chips().map((c) => c.querySelectorAll(".mf-seg__ok").length).join("")).toBe("0010");
  });

  it("말 안 함 칩은 {claim: none} 을 보낸다", () => {
    const { send } = panel(makeView());
    fireEvent.click(chip("말 안 함"));
    expect(send).toHaveBeenCalledWith({ t: "claim", claim: "none" });
  });

  it("새 서버 view 가 오면 서버 값을 따른다 — 받아들이면 그 값, 거절해 이전 값이 오면 되돌아간다", () => {
    const r = panel(makeView({ myClaim: "police" }));
    expect(chip("경찰").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip("시민"));
    expect(chip("시민").getAttribute("aria-pressed")).toBe("true");
    r.rerender(makeView({ myClaim: "citizen" }));
    expect(chip("시민").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip("마피아"));
    expect(chip("마피아").getAttribute("aria-pressed")).toBe("true");
    // 서버가 거절하고 이전 값(citizen) 으로 state 를 다시 보냈다
    r.rerender(makeView({ myClaim: "citizen" }));
    expect(chip("시민").getAttribute("aria-pressed")).toBe("true");
    expect(chip("마피아").getAttribute("aria-pressed")).toBe("false");
  });

  it("2일차 이후: me.claim(어제 값)이 처음부터 선택돼 있고 안내는 2일차 문구", () => {
    panel(makeView({ n: 2, roles: ["mafia", "police", "doctor", "citizen"], myClaim: "doctor" }));
    expect(screen.queryByText("거짓말도 괜찮아요. 바꾸지 않으면 어제 선택이 공개돼요")).not.toBeNull();
    expect(chip("의사").getAttribute("aria-pressed")).toBe("true");
    expect(chip("마피아").getAttribute("aria-pressed")).toBe("false");
  });

  it("canSend 가 거짓이면 모든 칩이 꺼지고 눌러도 보내지 않는다", () => {
    const { send } = panel(makeView(), false);
    expect(chips().every((c) => c.disabled)).toBe(true);
    fireEvent.click(chip("경찰"));
    expect(send).not.toHaveBeenCalled();
  });

  it("공개 연출: 제목 '주장이 공개됐어요'·안내 '곧 토론이 시작돼요', 모든 칩 disabled, 내 공개 값(경찰) 칩만 눌려 있고 그 칩에만 배지 (D-04, 결정 0017-6)", () => {
    const claims: SeatClaim[] = [
      { seat: 0, claim: "police", changed: false },
      { seat: 1, claim: "none", changed: false },
    ];
    panel(makeView({ phase: "claimReveal", claims, myClaim: "citizen" }));
    expect(screen.queryByText("주장이 공개됐어요")).not.toBeNull();
    expect(screen.queryByText("곧 토론이 시작돼요")).not.toBeNull();
    expect(screen.queryByText("주장할 직업을 고르세요")).toBeNull();
    expect(chips().every((c) => c.disabled)).toBe(true);
    expect(chips().map((c) => c.getAttribute("aria-pressed")).join("|")).toBe("false|true|false|false");
    expect(chips().map((c) => c.querySelectorAll(".mf-seg__ok").length).join("")).toBe("0100");
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

  it(".mf-seg__b 는 flex 1·높이 44(--tap-min)·알약, .mf-seg 는 간격 6px 한 줄", () => {
    expect(/flex:\s*1[;\s]/.test(rule(".mf-seg__b"))).toBe(true);
    expect(/height:\s*(44px|var\(--tap-min\))/.test(rule(".mf-seg__b"))).toBe(true);
    expect(/border-radius:\s*var\(--radius-pill\)/.test(rule(".mf-seg__b"))).toBe(true);
    expect(/display:\s*flex/.test(rule(".mf-seg"))).toBe(true);
    expect(/gap:\s*6px/.test(rule(".mf-seg"))).toBe(true);
    expect(/flex-wrap:\s*wrap/.test(rule(".mf-seg"))).toBe(false);
  });

  it(".mf-seg__b:disabled 는 opacity .6, 눌린 채 꺼진 칩은 opacity 1, .mf-seg__ok 는 18px", () => {
    expect(/opacity:\s*0?\.6/.test(rule(".mf-seg__b:disabled"))).toBe(true);
    expect(/opacity:\s*1[;\s]/.test(rule('.mf-seg__b:disabled[aria-pressed="true"]'))).toBe(true);
    expect(/width:\s*18px/.test(rule(".mf-seg__ok"))).toBe(true);
    expect(/height:\s*18px/.test(rule(".mf-seg__ok"))).toBe(true);
  });
});
