/// <reference types="node" />
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { QuickMessageSheet } from "../../src/components/QuickMessageSheet";
import type { SayPayload } from "../../src/components/QuickMessageSheet";
import sourceText from "../../src/components/QuickMessageSheet.tsx?raw";
import talkCss from "../../src/styles/talk.css?raw";
import type { PublicPlayer } from "../../shared/protocol";
import type { RoleId } from "../../shared/game/roles";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NICKS = ["민지", "하윤", "서준", "도현", "지아", "시우", "예린", "태오"];
const mkPlayers = (n: number): PublicPlayer[] =>
  NICKS.slice(0, n).map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 }));
const ROLES5: RoleId[] = ["mafia", "police", "doctor", "citizen"];
const ROLES4: RoleId[] = ["mafia", "police", "citizen"];

interface Opts {
  players?: PublicPlayer[];
  roles?: RoleId[];
  canSend?: boolean;
  mySeat?: number;
}
const setup = (o: Opts = {}) => {
  const onSend = vi.fn<(p: SayPayload) => void>();
  const onClose = vi.fn();
  const utils = render(
    <QuickMessageSheet
      players={o.players ?? mkPlayers(5)}
      mySeat={o.mySeat ?? 0}
      roles={o.roles ?? ROLES5}
      canSend={o.canSend ?? true}
      onSend={onSend}
      onClose={onClose}
    />,
  );
  return { onSend, onClose, ...utils };
};

// 누르기 횟수를 센다(D-17): 시트를 연 뒤 누른 횟수만 센다.
let taps = 0;
const tap = (el: HTMLElement) => {
  taps += 1;
  fireEvent.click(el);
};
const group = (name: string) => within(screen.getByRole("group", { name }));
const sendBtn = () => screen.getByRole("button", { name: "보내기" }) as HTMLButtonElement;
const preview = (container: HTMLElement) => container.querySelector(".mf-qm__preview") as HTMLElement;
const chipNames = (name: string) => group(name).getAllByRole("button").map((b) => b.textContent);
const settle = () =>
  act(() => {
    vi.advanceTimersByTime(300);
  });

describe("QuickMessageSheet — 문구 → 대상 → (직업) → 보내기 (S-08a, COMM-01)", () => {
  it("제목·라벨·문구 칩 다섯 개가 순서대로 보이고 첫 칩이 선택돼 있다", () => {
    const { container } = setup();
    expect(container.querySelector("dialog")?.getAttribute("aria-label")).toBe("빠른 메시지");
    expect(screen.getByRole("heading", { name: "빠른 메시지" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "닫기" })).toBeTruthy();
    expect(screen.getByText("무슨 말을 할까요?")).toBeTruthy();
    expect(chipNames("문구")).toEqual(["[○○] 의심돼요", "[○○] 믿어요", "저 아니에요", "[○○]는 [직업]이었어요", "[○○] 투표해요"]);
    const pressed = group("문구").getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));
    expect(pressed).toEqual(["true", "false", "false", "false", "false"]);
    expect(screen.queryByText("저는 [직업]이에요")).toBeNull();
  });

  it("대상 칩은 나를 뺀 사람들을 seat 순으로 보이고 직업 줄은 없다. 미리보기는 빈칸 그대로, 보내기는 꺼져 있다", () => {
    const { container } = setup();
    expect(screen.getByText("누구에게?")).toBeTruthy();
    expect(chipNames("대상")).toEqual(["하윤", "서준", "도현", "지아"]);
    expect(screen.queryByRole("group", { name: "직업" })).toBeNull();
    expect(screen.queryByText("무슨 직업이었나요?")).toBeNull();
    expect(screen.getByText("미리보기")).toBeTruthy();
    expect(preview(container).textContent).toBe("[○○] 의심돼요");
    expect(preview(container).className).toContain("mf-qm__preview--dim");
    expect(sendBtn().disabled).toBe(true);
  });

  it("대상을 고르면 미리보기가 문장이 되고 흐림이 사라지며 보내기가 켜진다. 보내면 {template,target} 만 담고 시트가 닫힌다", () => {
    vi.useFakeTimers();
    const { container, onSend, onClose } = setup();
    taps = 0;
    tap(group("대상").getByRole("button", { name: "하윤" }));
    expect(preview(container).textContent).toBe("하윤 의심돼요");
    expect(preview(container).className).not.toContain("mf-qm__preview--dim");
    expect(sendBtn().disabled).toBe(false);
    tap(sendBtn());
    expect(taps).toBe(2);
    expect(onSend).toHaveBeenCalledTimes(1);
    const payload = onSend.mock.calls[0]![0];
    expect(payload).toEqual({ template: "suspect", target: 1 });
    expect(Object.keys(payload).sort()).toEqual(["target", "template"]);
    expect(onClose).not.toHaveBeenCalled();
    settle();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("선택한 문구 칩을 다시 눌러도 선택은 풀리지 않는다", () => {
    setup();
    tap(group("문구").getByRole("button", { name: "[○○] 의심돼요" }));
    expect(group("문구").getByRole("button", { name: "[○○] 의심돼요" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("'저 아니에요' 는 대상 줄이 사라지고 보내기가 바로 켜지며 {template:'innocent'} 만 보낸다 (2번)", () => {
    vi.useFakeTimers();
    const { onSend, container } = setup();
    taps = 0;
    tap(group("문구").getByRole("button", { name: "저 아니에요" }));
    expect(screen.queryByRole("group", { name: "대상" })).toBeNull();
    expect(screen.queryByText("누구에게?")).toBeNull();
    expect(preview(container).textContent).toBe("저 아니에요");
    expect(sendBtn().disabled).toBe(false);
    tap(sendBtn());
    expect(taps).toBe(2);
    expect(onSend).toHaveBeenCalledTimes(1);
    const payload = onSend.mock.calls[0]![0];
    expect(payload).toEqual({ template: "innocent" });
    expect(Object.keys(payload)).toEqual(["template"]);
  });

  it("'[○○]는 [직업]이었어요' 는 대상 아래에 직업 칩 네 개(마피아·경찰·의사·시민)가 나오고 대상·직업을 모두 골라야 보낼 수 있다 (4번)", () => {
    vi.useFakeTimers();
    const { onSend, container } = setup();
    taps = 0;
    tap(group("문구").getByRole("button", { name: "[○○]는 [직업]이었어요" }));
    expect(screen.getByText("무슨 직업이었나요?")).toBeTruthy();
    expect(chipNames("직업")).toEqual(["마피아", "경찰", "의사", "시민"]);
    expect(sendBtn().disabled).toBe(true);
    tap(group("대상").getByRole("button", { name: "하윤" }));
    expect(sendBtn().disabled).toBe(true);
    expect(preview(container).textContent).toBe("하윤은 [직업]이었어요");
    expect(preview(container).className).toContain("mf-qm__preview--dim");
    tap(group("직업").getByRole("button", { name: "경찰" }));
    expect(preview(container).textContent).toBe("하윤은 경찰이었어요");
    expect(sendBtn().disabled).toBe(false);
    tap(sendBtn());
    expect(taps).toBe(4);
    expect(onSend).toHaveBeenCalledTimes(1);
    const payload = onSend.mock.calls[0]![0];
    expect(payload).toEqual({ template: "claimed", target: 1, claimedRole: "police" });
    expect(Object.keys(payload).sort()).toEqual(["claimedRole", "target", "template"]);
  });

  it("다른 대상 문구('믿어요')는 문구 → 대상 → 보내기 3번이다", () => {
    vi.useFakeTimers();
    const { onSend } = setup();
    taps = 0;
    tap(group("문구").getByRole("button", { name: "[○○] 믿어요" }));
    tap(group("대상").getByRole("button", { name: "서준" }));
    tap(sendBtn());
    expect(taps).toBe(3);
    expect(onSend).toHaveBeenCalledWith({ template: "trust", target: 2 });
  });

  it("문구를 바꾸면 고른 대상은 유지되고 필요 없는 직업은 버려진다", () => {
    const { container } = setup();
    tap(group("대상").getByRole("button", { name: "하윤" }));
    tap(group("문구").getByRole("button", { name: "[○○] 믿어요" }));
    expect(group("대상").getByRole("button", { name: "하윤" }).getAttribute("aria-pressed")).toBe("true");
    expect(preview(container).textContent).toBe("하윤 믿어요");
    tap(group("문구").getByRole("button", { name: "[○○]는 [직업]이었어요" }));
    tap(group("직업").getByRole("button", { name: "의사" }));
    tap(group("문구").getByRole("button", { name: "[○○] 투표해요" }));
    expect(screen.queryByRole("group", { name: "직업" })).toBeNull();
    expect(preview(container).textContent).toBe("하윤 투표해요");
  });

  it("4명판: 직업 칩 3개(의사 없음), 대상 칩 3개", () => {
    setup({ players: mkPlayers(4), roles: ROLES4 });
    expect(chipNames("대상")).toEqual(["하윤", "서준", "도현"]);
    tap(group("문구").getByRole("button", { name: "[○○]는 [직업]이었어요" }));
    expect(chipNames("직업")).toEqual(["마피아", "경찰", "시민"]);
  });

  it("8명판: 대상 칩 7개", () => {
    setup({ players: mkPlayers(8), roles: ROLES5 });
    expect(chipNames("대상")).toEqual(["하윤", "서준", "도현", "지아", "시우", "예린", "태오"]);
  });

  it("내가 seat 3 이면 나를 빼고 seat 오름차순이다", () => {
    setup({ mySeat: 3 });
    expect(chipNames("대상")).toEqual(["민지", "하윤", "서준", "지아"]);
  });

  it("끊긴 사람도 대상에 있고, 탈락자(alive false)는 대상에 없다", () => {
    const players = mkPlayers(5).map((p): PublicPlayer => (p.seat === 2 ? { ...p, connected: false } : p));
    const withDead = players.map((p) => (p.seat === 3 ? { ...p, alive: false } : p)) as PublicPlayer[];
    setup({ players: withDead });
    expect(chipNames("대상")).toEqual(["하윤", "서준", "지아"]);
  });

  it("닉네임 8자 칩도 한 칩 한 줄로 들어간다 (글자 그대로 보인다)", () => {
    const long = mkPlayers(5).map((p) => (p.seat === 1 ? { ...p, nickname: "가나다라마바사아" } : p));
    setup({ players: long });
    expect(chipNames("대상")[0]).toBe("가나다라마바사아");
  });

  it("canSend false 면 칸이 채워져도 보내기가 꺼져 있고 눌러도 아무것도 보내지 않는다", () => {
    const { onSend } = setup({ canSend: false });
    tap(group("대상").getByRole("button", { name: "하윤" }));
    expect(sendBtn().disabled).toBe(true);
    fireEvent.click(sendBtn());
    expect(onSend).not.toHaveBeenCalled();
  });

  it("닫았다가 다시 마운트하면 첫 칩이 선택되고 대상은 비어 있다 (고른 내용을 버린다)", () => {
    vi.useFakeTimers();
    const first = setup();
    tap(group("문구").getByRole("button", { name: "[○○] 믿어요" }));
    tap(group("대상").getByRole("button", { name: "하윤" }));
    first.unmount();
    setup();
    const pressed = group("문구").getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));
    expect(pressed).toEqual(["true", "false", "false", "false", "false"]);
    const targets = group("대상").getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));
    expect(targets.every((v) => v === "false")).toBe(true);
    expect(sendBtn().disabled).toBe(true);
  });

  it("닫기 버튼을 누르면 보내지 않고 닫힌다", () => {
    vi.useFakeTimers();
    const { onSend, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("시트 안에 글자를 쓸 수 있는 입력칸이 없다 (T-02-27)", () => {
    const { container } = setup();
    expect(container.querySelector("input, textarea, [contenteditable]")).toBeNull();
    tap(group("문구").getByRole("button", { name: "[○○]는 [직업]이었어요" }));
    expect(container.querySelector("input, textarea, [contenteditable]")).toBeNull();
    expect(/<input|<textarea|contenteditable/i.test(sourceText)).toBe(false);
  });

  it("규칙은 단일 출처에서 읽는다: QUICK_TEMPLATES·isAlive·messageText", () => {
    expect(sourceText).toContain("QUICK_TEMPLATES");
    expect(sourceText).toContain("isAlive(");
    expect(sourceText).toContain("messageText(");
  });

  it("talk.css: 흐린 미리보기 글자 불투명도 .6, 미리보기 알약은 시트 폭까지 늘어난다", () => {
    expect(talkCss).toMatch(/\.mf-qm__preview--dim[^}]*opacity:\s*0?\.6/);
    expect(talkCss).toMatch(/\.mf-qm__preview[^}]*max-width:\s*none/);
  });
});
