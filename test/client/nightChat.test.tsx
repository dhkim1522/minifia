/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatLine, PublicPlayer, RoomView } from "../../shared/protocol";
import { DiscussionControls } from "../../src/components/DiscussionControls";
import { MessageLog } from "../../src/components/MessageLog";
import { READ_ONLY_TEXT, ReadOnlyRow } from "../../src/components/ReadOnlyRow";
import { NIGHT_TEMPLATE_ORDER } from "../../src/game/messageText";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 밤 마피아 채팅·관전자 읽기 전용 채팅을 낮 부품 그대로 그리기 위한 확장(D-17, 결정 0019·0021, UI-SPEC N-2·N-6).
// 실패 보고서가 한 줄로 남도록 요소·배열 비교 대신 문자열·숫자·불리언으로 단언한다.

afterEach(cleanup);

const players: PublicPlayer[] = ["지호", "서연", "하늘", "민수"].map((nickname, seat) => ({
  seat,
  nickname,
  connected: true,
  isHost: seat === 0,
}));
const L = (seq: number, seat: number): ChatLine => ({ seq, seat, template: "nightAgree", at: 1 });

const SYS = "마피아끼리만 보여요";
const css = readFileSync("src/styles/day.css", "utf8");

const log = (name: string) => screen.getByRole("log", { name });
const lis = (name: string) => [...log(name).querySelectorAll<HTMLElement>("li")];
const cls = (li: HTMLElement) => li.className;

describe("MessageLog 안내 줄 (UI-SPEC N-2)", () => {
  it("systemLine 만 있고 줄이 없으면 안내 li 하나뿐이고 '아직 메시지가 없어요' 가 없다. 안내 li 에는 점·이름이 없다", () => {
    render(<MessageLog lines={[]} players={players} mySeat={0} systemLine={SYS} label="마피아 채팅" />);
    const items = lis("마피아 채팅");
    expect(items.length).toBe(1);
    expect(cls(items[0]!).includes("mf-msglog__item--sys")).toBe(true);
    expect(items[0]!.textContent).toBe(SYS);
    expect(items[0]!.querySelector(".mf-msglog__dot, .mf-msglog__name, .mf-msglog__who")).toBeNull();
    expect(screen.queryByText("아직 메시지가 없어요")).toBeNull();
  });

  it("줄 하나: 안내 + 줄, 마지막 줄만 --latest. 안내 li 에는 --latest 가 없다", () => {
    render(<MessageLog lines={[L(1, 1)]} players={players} mySeat={0} systemLine={SYS} label="마피아 채팅" />);
    const items = lis("마피아 채팅");
    expect(items.map((li) => (cls(li).includes("--latest") ? "L" : "-")).join("")).toBe("-L");
    expect(cls(items[0]!).includes("mf-msglog__item--sys")).toBe(true);
  });

  it("줄 셋: 창은 마지막 3줄이라 안내가 밀려나고 li 셋이 모두 줄이다", () => {
    render(<MessageLog lines={[L(1, 1), L(2, 2), L(3, 3)]} players={players} mySeat={0} systemLine={SYS} label="마피아 채팅" />);
    const items = lis("마피아 채팅");
    expect(items.length).toBe(3);
    expect(items.some((li) => cls(li).includes("mf-msglog__item--sys"))).toBe(false);
    expect(items.map((li) => li.querySelector(".mf-msglog__name") !== null).join(",")).toBe("true,true,true");
  });

  it("label '마피아 채팅' 을 넘기면 role=log 의 이름이 '마피아 채팅', 넘기지 않으면 '최근 채팅'", () => {
    const a = render(<MessageLog lines={[]} players={players} mySeat={0} label="마피아 채팅" />);
    expect(screen.queryByRole("log", { name: "마피아 채팅" }) !== null).toBe(true);
    a.unmount();
    render(<MessageLog lines={[]} players={players} mySeat={0} />);
    expect(screen.queryByRole("log", { name: "최근 채팅" }) !== null).toBe(true);
  });

  it("systemLine 이 없으면 지금 그대로(빈 목록이면 '아직 메시지가 없어요')", () => {
    render(<MessageLog lines={[]} players={players} mySeat={0} />);
    expect(lis("최근 채팅").map((li) => li.textContent).join("|")).toBe("아직 메시지가 없어요");
  });

  it("CSS: .mf-msglog__item--sys 의 color 가 var(--gray-500) 이고 .mf-msglog__item--latest 규칙보다 뒤에 있다", () => {
    const sys = css.indexOf(".mf-msglog__item--sys {");
    const latest = css.indexOf(".mf-msglog__item--latest {");
    const m = /\.mf-msglog__item--sys\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(/color:\s*var\(--gray-500\)/.test(m)).toBe(true);
    expect(sys > latest && latest >= 0).toBe(true);
  });
});

describe("밤 조작 줄·모달", () => {
  const view: RoomView = {
    code: "0042",
    phase: "night",
    phaseEndsAt: 40_000,
    phaseDurationMs: 30_000,
    serverNow: 10_000,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: false },
    day: { n: 1, roles: ["mafia", "police", "citizen"], claimLog: [] },
  };
  const connection = (): RoomConnection => ({
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
  });

  it("DiscussionControls 에 templates NIGHT_TEMPLATE_ORDER 를 주면 [빠른 메시지] 시트의 칩이 밤 세 개다", () => {
    render(<DiscussionControls view={view} connection={connection()} showToast={() => {}} templates={NIGHT_TEMPLATE_ORDER} />);
    fireEvent.click(screen.getByRole("button", { name: "빠른 메시지" }));
    const chips = within(screen.getByRole("group", { name: "문구" })).getAllByRole("button");
    expect(chips.map((b) => b.textContent).join("|")).toBe("[○○] 지목해요|동의해요|다른 사람을 지목해요");
  });
});

describe("모달 안내 줄·관전 하단 부품 (결정 0021)", () => {
  const history = () => document.querySelector<HTMLDialogElement>('dialog[aria-label="채팅 내역"]');
  const rule = (sel: string): string => {
    const esc = sel.replace(/[.\[\]"=:()]/g, "\\$&");
    return new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
  };

  it("systemLine 을 주고 ^ 를 누르면 채팅 내역 모달 목록의 첫 li 가 안내 줄이고 그 뒤에 받은 줄 전부가 있다", () => {
    render(<MessageLog lines={[L(1, 1), L(2, 2), L(3, 3), L(4, 0)]} players={players} mySeat={0} systemLine={SYS} label="마피아 채팅" />);
    fireEvent.click(screen.getByRole("button", { name: "채팅 내역 크게 보기" }));
    const items = [...history()!.querySelectorAll<HTMLElement>(".mf-chatlog li")];
    expect(items.map((li) => (li.className.includes("mf-msglog__item--sys") ? "S" : "L")).join("")).toBe("SLLLL");
    expect(items[0]!.textContent).toBe(SYS);
  });

  it("줄이 없어도 모달에 '아직 메시지가 없어요' 가 없고 안내 줄만 있다", () => {
    render(<MessageLog lines={[]} players={players} mySeat={0} systemLine={SYS} label="마피아 채팅" />);
    fireEvent.click(screen.getByRole("button", { name: "채팅 내역 크게 보기" }));
    expect([...history()!.querySelectorAll(".mf-chatlog li")].map((li) => li.textContent).join("|")).toBe(SYS);
  });

  it("MessageLog more={false} 면 ^ 버튼(.mf-msglog__more)이 없다. 기본은 있다", () => {
    const a = render(<MessageLog lines={[]} players={players} mySeat={0} more={false} />);
    expect(a.container.querySelectorAll(".mf-msglog__more").length).toBe(0);
    a.unmount();
    const b = render(<MessageLog lines={[]} players={players} mySeat={0} />);
    expect(b.container.querySelectorAll(".mf-msglog__more").length).toBe(1);
  });

  it("MessageLog label '마피아 채팅(관전)'·systemLine '관전 중 · 마피아 채팅' → role=log 이름과 안내 줄이 그 글자", () => {
    render(<MessageLog lines={[]} players={players} mySeat={0} label="마피아 채팅(관전)" systemLine="관전 중 · 마피아 채팅" more={false} />);
    const items = lis("마피아 채팅(관전)");
    expect(items.map((li) => li.textContent).join("|")).toBe("관전 중 · 마피아 채팅");
  });

  it("ReadOnlyRow 는 p.mf-ro 하나이고 글자가 '탈락했어요 · 볼 수만 있어요'(READ_ONLY_TEXT), 버튼·포커스 가능한 요소가 없다", () => {
    const { container } = render(<ReadOnlyRow />);
    const root = container.firstElementChild as HTMLElement | null;
    expect(`${root?.tagName}.${root?.className}|${container.children.length}`).toBe("P.mf-ro|1");
    expect(root?.textContent).toBe("탈락했어요 · 볼 수만 있어요");
    expect(READ_ONLY_TEXT).toBe("탈락했어요 · 볼 수만 있어요");
    expect(container.querySelectorAll("button, a, input, [tabindex]").length).toBe(0);
  });

  it("CSS: .mf-ro 에 min-height 44px(--tap-min)·background var(--night-700)·color var(--gray-300)·font-size 14px·border-radius var(--radius-md)·justify-content center", () => {
    const r = rule(".mf-ro");
    const ok = [
      /min-height:\s*var\(--tap-min\)/,
      /background:\s*var\(--night-700\)/,
      /color:\s*var\(--gray-300\)/,
      /font-size:\s*14px/,
      /border-radius:\s*var\(--radius-md\)/,
      /justify-content:\s*center/,
    ].map((re) => (re.test(r) ? "1" : "0"));
    expect(ok.join("")).toBe("111111");
  });
});
