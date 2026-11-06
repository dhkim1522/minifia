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

  it("동작 버튼은 이름표 단추(.mv-tool 44 이상·면 36), 판은 z-overlay+1·night-700·night-600 테두리", () => {
    const b = block(".mv-tool__face");
    expect(/width:\s*36px/.test(b) && /height:\s*36px/.test(b)).toBe(true);
    expect(/min-width:\s*var\(--tap-min\)/.test(block(".mv-tool"))).toBe(true);
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
    expect(sent.map((m) => JSON.stringify(m)).join("|")).toBe(JSON.stringify({ t: "emote", id: "clap", pk: "1:0:lobby" }));
  });

  it("단계 키는 채팅과 같다(2일차 토론 = 2:discussion)", () => {
    const { result, sent } = mount(true, makeView({ phase: "discussion", day: { n: 2 } as RoomView["day"] }));
    act(() => result.current.onEmote?.("dance"));
    expect((sent[0] as { pk: string }).pk).toBe("1:2:discussion");
  });

  it("연결이 끊기면 보내지 않는다", () => {
    const { result, sent } = mount(false);
    act(() => result.current.onEmote?.("clap"));
    expect(sent.length).toBe(0);
  });
});

// ---- Task 2: 비활성·닫기·키보드 열림·초점·화살표키 ----

const open = (c: HTMLElement) => fireEvent.click(button(c)!);
const isOff = (el: Element | null | undefined) => el?.getAttribute("aria-disabled") === "true";

describe("칸 비활성 (D-10, D-11)", () => {
  it("emoteBlocked 면 아홉 칸 모두 aria-disabled 이고 눌러도 onEmote 가 없고 판은 열린 채 알림도 없다", () => {
    const onEmote = vi.fn();
    const { container } = mountPanel({ onEmote, emoteBlocked: true });
    open(container);
    expect(cells(container).every((c) => isOff(c))).toBe(true);
    fireEvent.click(cells(container)[0]!);
    expect(onEmote.mock.calls.length).toBe(0);
    expect(tray(container) !== null).toBe(true);
    expect(container.querySelector("[role=status],[data-chat-notice]") === null).toBe(true);
  });

  it("sendDisabled(끊김)이면 칸도 버튼도 aria-disabled 이고 열려 있던 판은 닫힌다", () => {
    const onEmote = vi.fn();
    const { container, rerender } = render(<Harness emotes={EMOTE_TRAY_ORDER} onEmote={onEmote} />);
    open(container);
    expect(tray(container) !== null).toBe(true);
    rerender(<Harness emotes={EMOTE_TRAY_ORDER} onEmote={onEmote} sendDisabled />);
    expect(tray(container) === null).toBe(true);
    expect(isOff(button(container))).toBe(true);
    open(container);
    expect(tray(container) === null).toBe(true);
  });

  it("버튼은 끊김이 아니면 aria-disabled 가 아니다(걷는 중에도 판은 열린다)", () => {
    const { container } = mountPanel({ emoteBlocked: true });
    expect(isOff(button(container))).toBe(false);
  });

  it("emotePlaying 칸에만 is-playing", () => {
    const { container } = mountPanel({ emoteBlocked: true, emotePlaying: "dance" });
    open(container);
    expect(cells(container).filter((c) => c.className.includes("is-playing")).map((c) => c.getAttribute("data-emote")).join(",")).toBe("dance");
  });

  it("풀리면 즉시 눌린다", () => {
    const onEmote = vi.fn();
    const { container, rerender } = render(<Harness emotes={EMOTE_TRAY_ORDER} onEmote={onEmote} emoteBlocked />);
    open(container);
    rerender(<Harness emotes={EMOTE_TRAY_ORDER} onEmote={onEmote} />);
    fireEvent.click(cells(container)[1]!);
    expect(onEmote.mock.calls.map((a) => String(a[0])).join(",")).toBe("praise");
  });
});

describe("닫기 네 가지와 초점 (D-2)", () => {
  it("버튼을 다시 누르면 닫히고 초점이 버튼에 있다", () => {
    const { container } = mountPanel();
    open(container);
    open(container);
    expect(tray(container) === null).toBe(true);
    expect(document.activeElement === button(container)).toBe(true);
  });

  it("판 바깥 pointerdown 으로 닫힌다 (안쪽·버튼 pointerdown 은 아니다)", () => {
    const { container } = mountPanel();
    open(container);
    fireEvent.pointerDown(cells(container)[2]!);
    fireEvent.pointerDown(button(container)!);
    expect(tray(container) !== null).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(tray(container) === null).toBe(true);
  });

  it("Esc 로 닫히고 초점이 버튼으로 돌아온다", () => {
    const { container } = mountPanel();
    open(container);
    fireEvent.keyDown(cells(container)[0]!, { key: "Escape" });
    expect(tray(container) === null).toBe(true);
    expect(document.activeElement === button(container)).toBe(true);
  });

  it("칸을 고르면 닫히고 초점이 버튼으로 돌아온다", () => {
    const { container } = mountPanel();
    open(container);
    fireEvent.click(cells(container)[4]!);
    expect(tray(container) === null).toBe(true);
    expect(document.activeElement === button(container)).toBe(true);
  });

  it("열리면 첫 칸으로 초점이 간다", () => {
    const { container } = mountPanel();
    open(container);
    expect(document.activeElement === cells(container)[0]).toBe(true);
  });
});

describe("키보드가 열려 있을 때 (입력칸 포커스)", () => {
  it("첫 누름은 판을 열지 않고 입력칸을 blur, 두 번째 누름에 열린다", () => {
    const { container } = mountPanel();
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    input.focus();
    expect(document.activeElement === input).toBe(true);
    open(container);
    expect(tray(container) === null).toBe(true);
    expect(document.activeElement === input).toBe(false);
    open(container);
    expect(tray(container) !== null).toBe(true);
  });
});

describe("판 안 화살표키", () => {
  const focusedId = () => document.activeElement?.getAttribute("data-emote");
  it("좌우 한 칸, 위아래 5칸, 끝에서 멈춘다", () => {
    const { container } = mountPanel();
    open(container);
    const down = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
    down("ArrowRight");
    expect(focusedId()).toBe("praise");
    down("ArrowDown");
    expect(focusedId()).toBe("deny");
    down("ArrowUp");
    expect(focusedId()).toBe("praise");
    down("ArrowLeft");
    down("ArrowLeft");
    expect(focusedId()).toBe("clap");
    down("ArrowUp");
    expect(focusedId()).toBe("clap");
    for (let i = 0; i < 12; i++) down("ArrowRight");
    expect(focusedId()).toBe("throat");
    down("ArrowDown");
    expect(focusedId()).toBe("throat");
  });

  it("칸은 진짜 button 이라 Enter·Space 의 기본 동작이 선택이다", () => {
    const { container } = mountPanel();
    open(container);
    expect(cells(container).every((c) => c.tagName === "BUTTON" && c.getAttribute("type") === "button")).toBe(true);
  });
});

describe("판 열림 중 떠 있는 버튼 숨김 (CSS)", () => {
  it("body:has([data-emote-tray]) .mf-float 가 visibility:hidden", () => {
    const bare = V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const m = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((x) => /body:has\(\[data-emote-tray\]\)\s+\.mf-float/.test(x[1] ?? ""));
    expect(m.map((x) => (x[2] ?? "").trim()).join("|")).toBe("visibility: hidden;");
  });

  it("판 등장은 transform·opacity 뿐이고 모션 줄이기에서는 없다", () => {
    const bare = V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(/prefers-reduced-motion[^{]*\{[^]*mv-emote-tray[^]*animation:\s*none/.test(bare)).toBe(true);
  });
});

describe("useChat 모션 연결", () => {
  it("motion 이 걷는 중이면 emoteBlocked, 동작 중이면 emotePlaying", () => {
    const mkView = makeView();
    const store = new ChatStore();
    const conn = { canSend: true, send: () => true };
    const hook = renderHook((p: { motion: { moving: boolean; emoting: "clap" | null } }) => useChat({ store, connection: conn, view: mkView, motion: p.motion }), {
      initialProps: { motion: { moving: false, emoting: null as "clap" | null } },
    });
    expect(`${hook.result.current.emoteBlocked}|${hook.result.current.emotePlaying}`).toBe("false|null");
    hook.rerender({ motion: { moving: true, emoting: null } });
    expect(`${hook.result.current.emoteBlocked}|${hook.result.current.emotePlaying}`).toBe("true|null");
    hook.rerender({ motion: { moving: false, emoting: "clap" } });
    expect(`${hook.result.current.emoteBlocked}|${hook.result.current.emotePlaying}`).toBe("true|clap");
  });
});

describe("화면 연결 (Lobby·GameMap)", () => {
  it.each(["src/screens/Lobby.tsx", "src/screens/GameMap.tsx"])("%s 는 useMyMotion 을 불러 useChat 에 넘긴다", (file) => {
    const src = readFileSync(file, "utf8");
    expect(/useMyMotion\(/.test(src) && /useChat\(\{[^\n]*motion/.test(src)).toBe(true);
  });
});
