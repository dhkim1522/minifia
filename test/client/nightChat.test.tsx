/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatLine, PublicPlayer } from "../../shared/protocol";
import { MessageLog } from "../../src/components/MessageLog";

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
