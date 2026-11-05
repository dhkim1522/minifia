import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { ChatPanel, type ChatPanelProps } from "../../src/components/v2/ChatPanel";
import { EMOTE_LABEL, EMOTE_SHORT, EMOTE_TRAY_ORDER, EMOTE_TEXT } from "../../src/game/chatText";
import { ChatStore } from "../../src/net/chatStore";
import { useChat } from "../../src/net/useChat";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// 10-05 Task 1 트레이서: 입력줄 동작 버튼 → 5+4 판 → 칸 하나 → onEmote(id) 한 번, 판은 즉시 닫힘.
// happy-dom 은 치수를 재현하지 못한다 — 마크업·순서·이벤트·CSS 계약만 본다.

const ORDER = ["clap", "praise", "handshake", "dance", "surprise", "cry", "deny", "point", "throat"] as const;
const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

function Harness(rest: Partial<ChatPanelProps>) {
  const [value, setValue] = useState("");
  return <ChatPanel messages={[]} logHeight={96} onSend={() => {}} {...rest} value={value} onChange={setValue} />;
}

const mountPanel = (rest: Partial<ChatPanelProps> = {}) => render(<Harness emotes={EMOTE_TRAY_ORDER} onEmote={() => {}} {...rest} />);
const button = (c: HTMLElement) => c.querySelector<HTMLButtonElement>("[data-emote-button]");
const tray = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-emote-tray]");
const cells = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>("[data-emote]")];

describe("판 순서와 고정 문구 (O-6, T-10-17)", () => {
  it("판 순서는 박수·최고·악수·춤·깜짝·엉엉·손사래·손가락·목긋기", () => {
    expect(EMOTE_TRAY_ORDER.join(",")).toBe(ORDER.join(","));
  });

  it("보이는 이름은 모두 3글자 이하 고정 문구다", () => {
    expect(ORDER.map((id) => EMOTE_SHORT[id]).join(",")).toBe("박수,최고,악수,춤,깜짝,엉엉,손사래,손가락,목긋기");
    expect(ORDER.every((id) => [...EMOTE_SHORT[id]].length <= 4)).toBe(true);
  });

  it("버튼·판 이름 문구", () => {
    expect(`${EMOTE_TEXT.button}|${EMOTE_TEXT.tray}`).toBe("동작 고르기|동작");
  });
});

describe("ChatPanel 동작 버튼 (D-1, D-20)", () => {
  it("emotes·onEmote·onSend 가 있으면 입력줄 맨 앞에 버튼이 있다", () => {
    const { container } = mountPanel();
    const form = container.querySelector("form");
    const b = button(container);
    expect(b !== null).toBe(true);
    expect(form?.firstElementChild === b).toBe(true);
    expect(`${b?.getAttribute("aria-label")}|${b?.getAttribute("aria-expanded")}|${b?.getAttribute("type")}`).toBe("동작 고르기|false|button");
    expect(b?.className.includes("mv-chat__emote")).toBe(true);
  });

  it("emotes 가 없거나 비었거나 onSend 가 없으면 버튼 DOM 이 없다", () => {
    const a = mountPanel({ emotes: undefined });
    expect(button(a.container) === null).toBe(true);
    a.unmount();
    const b = mountPanel({ emotes: [] });
    expect(button(b.container) === null).toBe(true);
    b.unmount();
    const c = mountPanel({ onSend: undefined });
    expect(button(c.container) === null).toBe(true);
  });

  it("버튼 mousedown 은 기본 동작을 막는다(입력칸 포커스를 뺏지 않는다)", () => {
    const { container } = mountPanel();
    const ev = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    button(container)?.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("판 열기와 칸 (D-2)", () => {
  it("처음에는 판이 없고 버튼을 누르면 role=group 판이 열린다", () => {
    const { container } = mountPanel();
    expect(tray(container) === null).toBe(true);
    fireEvent.click(button(container)!);
    const t = tray(container);
    expect(`${t?.getAttribute("role")}|${t?.getAttribute("aria-label")}|${button(container)?.getAttribute("aria-expanded")}|${button(container)?.getAttribute("aria-pressed")}`).toBe("group|동작|true|true");
  });

  it("칸은 정확히 아홉 개, 순서대로, 아이콘과 이름과 접근성 이름이 있다", () => {
    const { container } = mountPanel();
    fireEvent.click(button(container)!);
    const cs = cells(container);
    expect(cs.map((c) => c.getAttribute("data-emote")).join(",")).toBe(ORDER.join(","));
    expect(cs.map((c) => c.getAttribute("aria-label")).join(",")).toBe(ORDER.map((id) => EMOTE_LABEL[id]).join(","));
    expect(cs.map((c) => c.textContent).join(",")).toBe(ORDER.map((id) => EMOTE_SHORT[id]).join(","));
    expect(cs.every((c) => c.querySelector("svg") !== null)).toBe(true);
  });

  it("칸을 누르면 onEmote(id) 가 한 번 불리고 판이 닫히며 입력칸 값은 그대로다", () => {
    const onEmote = vi.fn();
    const { container } = mountPanel({ onEmote });
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    fireEvent.change(input, { target: { value: "안녕" } });
    fireEvent.click(button(container)!);
    fireEvent.click(cells(container)[0]!);
    expect(onEmote.mock.calls.map((a) => String(a[0])).join(",")).toBe("clap");
    expect(tray(container) === null).toBe(true);
    expect(input.value).toBe("안녕");
  });

  it("판은 DOM 에 사용자 문자열을 넣지 않는다(고정 표만)", () => {
    const { container } = mountPanel();
    fireEvent.click(button(container)!);
    expect(tray(container)?.textContent).toBe(ORDER.map((id) => EMOTE_SHORT[id]).join(""));
  });
});

describe("CSS 계약 (토큰만, 새 hex 없음)", () => {
  const block = (sel: string) => {
    const bare = V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => (m[1] ?? "").split(",").some((s) => s.trim() === sel)).map((m) => m[2] ?? "").join(";");
  };

  it("동작 버튼은 48×48 토큰, 판은 z-overlay+1·night-700·night-600 테두리", () => {
    const b = block(".mv-chat__emote");
    expect(/width:\s*var\(--control-input\)/.test(b) && /height:\s*var\(--control-input\)/.test(b)).toBe(true);
    const t = block(".mv-emote-tray");
    expect(/calc\(var\(--z-overlay\) \+ 1\)/.test(t)).toBe(true);
    expect(/var\(--night-700\)/.test(t) && /var\(--night-600\)/.test(t)).toBe(true);
    expect(/#[0-9a-fA-F]{3,8}\b/.test(`${b};${t};${block(".mv-emote-tray__cell")}`)).toBe(false);
  });
});

// useChat 바인딩
const player = (seat: number, nickname: string): PublicPlayer => ({ seat, nickname, connected: true, isHost: seat === 0 });
const makeView = (extra: Partial<RoomView> = {}): RoomView => ({
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players: [player(0, "민수"), player(1, "하윤")],
  me: { seat: 1, isHost: false },
  ...extra,
});

describe("useChat 동작 연결 (D-9)", () => {
  const mount = (canSend = true, view = makeView()) => {
    const sent: ClientMessage[] = [];
    const hook = renderHook(
      (p: { canSend: boolean }) =>
        useChat({
          store: new ChatStore(),
          connection: {
            canSend: p.canSend,
            send: (m) => {
              sent.push(m);
              return true;
            },
          },
          view,
        }),
      { initialProps: { canSend } },
    );
    return { ...hook, sent };
  };

  it("emotes 는 판 순서이고 onEmote(id) 는 {t:emote,id,pk} 만 한 번 보낸다", () => {
    const { result, sent } = mount();
    expect(result.current.emotes?.join(",")).toBe(ORDER.join(","));
    act(() => result.current.onEmote?.("clap"));
    expect(sent.map((m) => JSON.stringify(m)).join("|")).toBe(JSON.stringify({ t: "emote", id: "clap", pk: "0:lobby" }));
  });

  it("단계 키는 채팅과 같다(2일차 토론 = 2:discussion)", () => {
    const { result, sent } = mount(true, makeView({ phase: "discussion", day: { n: 2 } as RoomView["day"] }));
    act(() => result.current.onEmote?.("dance"));
    expect((sent[0] as { pk: string }).pk).toBe("2:discussion");
  });

  it("연결이 끊기면 보내지 않는다", () => {
    const { result, sent } = mount(false);
    act(() => result.current.onEmote?.("clap"));
    expect(sent.length).toBe(0);
  });
});
