import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { OUTFIT_IDS } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { DRESS_ORDER, DRESS_TEXT, OUTFIT_LABEL } from "../../src/game/dressText";
import { ChatStore } from "../../src/net/chatStore";
import { outfitCardSrc } from "../../src/net/assets";
import { WorldStore } from "../../src/world/store";

// 10-07: 로비 꾸미기 — 떠 있는 hanger 버튼(D-4) → 패널을 덮는 카드 띠 시트(D-5) → 카드 하나 → {t:"dress", look}.
// WorldStage 는 가벼운 가짜로 바꾼다(lobby.test 와 같은 방식). 가짜는 받은 props 만 기억한다.
const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      return createElement("div", { "data-world-stage-fake": "" });
    },
  };
});

const { DressSheet } = await import("../../src/components/v2/DressSheet");
const { Lobby } = await import("../../src/screens/Lobby");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  stage.props = null;
});

describe("dressText — 고정 문구와 순서", () => {
  it("순서는 shared 의 OUTFIT_IDS 와 같고 이름 아홉 개가 UI-SPEC 순서다", () => {
    expect([...DRESS_ORDER]).toEqual([...OUTFIT_IDS]);
    expect(DRESS_ORDER.map((id) => OUTFIT_LABEL[id])).toEqual(["기본", "경찰", "의사", "마피아", "탐정", "기자", "어르신", "후드", "누아르"]);
    expect(DRESS_TEXT.open).toBe("꾸미기");
    expect(DRESS_TEXT.close).toBe("닫기");
    expect(DRESS_TEXT.selected).toBe(", 선택됨");
  });
});

describe("DressSheet — 부품", () => {
  it("아홉 카드가 순서대로 있고 카드마다 data-outfit·aria-pressed·그림(alt=이름)·이름이 있다", () => {
    const { container } = render(<DressSheet value="police" onPick={() => {}} onClose={() => {}} />);
    const sheet = container.querySelector("[data-dress-sheet]");
    expect(sheet).not.toBeNull();
    const cards = [...container.querySelectorAll<HTMLButtonElement>("button[data-outfit]")];
    expect(cards.map((c) => c.dataset.outfit)).toEqual([...OUTFIT_IDS]);
    for (const card of cards) {
      const id = card.dataset.outfit as (typeof OUTFIT_IDS)[number];
      const img = card.querySelector("img");
      expect(img?.getAttribute("alt")).toBe(OUTFIT_LABEL[id]);
      expect(img?.getAttribute("src")).toBe(outfitCardSrc(id));
      expect(card.textContent).toContain(OUTFIT_LABEL[id]);
    }
  });

  it("선택된 카드는 하나뿐이고 접근성 이름에 ', 선택됨' 이 붙으며 체크가 있다", () => {
    const { container } = render(<DressSheet value="mafia" onPick={() => {}} onClose={() => {}} />);
    const pressed = [...container.querySelectorAll("button[data-outfit][aria-pressed='true']")];
    expect(pressed).toHaveLength(1);
    expect(pressed[0]!.getAttribute("data-outfit")).toBe("mafia");
    expect(pressed[0]!.getAttribute("aria-label")).toBe("마피아, 선택됨");
    expect(pressed[0]!.querySelector("svg")).not.toBeNull();
    const other = container.querySelector("button[data-outfit='noir']")!;
    expect(other.getAttribute("aria-label")).toBe("누아르");
    expect(other.getAttribute("aria-pressed")).toBe("false");
    expect(other.querySelector("svg")).toBeNull();
  });

  it("카드를 누르면 onPick(id), 닫기 버튼은 onClose", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<DressSheet value="coat" onPick={onPick} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "탐정" }));
    expect(onPick).toHaveBeenCalledWith("detective");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("제목 글자가 없고 새 색(hex)도 쓰지 않는다 — 읽을 글은 카드 이름뿐", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} />);
    expect(container.querySelector("h1,h2,h3,[data-dress-title]")).toBeNull();
    const text = (container.textContent ?? "").replace(/\s/g, "");
    expect(text).toBe(DRESS_ORDER.map((id) => OUTFIT_LABEL[id]).join(""));
  });
});

// ── 로비 통합 ──
const player = (seat: number, nickname: string, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({ seat, nickname, connected: true, isHost: seat === 0, ...extra });
const makeView = (players: PublicPlayer[], mySeat = 0): RoomView => ({
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players,
  me: { seat: mySeat, isHost: players.find((p) => p.seat === mySeat)?.isHost ?? false },
});
const store = new WorldStore();
const lobby = (view: RoomView, send: (msg: ClientMessage) => boolean | void = () => {}, extra: Partial<Parameters<typeof Lobby>[0]> = {}) => (
  <Lobby view={view} store={store} chat={new ChatStore()} send={send} {...extra} />
);
const view = makeView([player(0, "민수"), player(1, "영희"), player(2, "서준", { look: "doctor" })], 2);

describe("Lobby — 꾸미기 버튼과 시트 (10-07, D-4·D-5)", () => {
  it("떠 있는 버튼 하나(data-float=dress, 접근성 이름 꾸미기)가 있고 방장·손님 똑같다", () => {
    for (const mySeat of [0, 2]) {
      const { container, unmount } = render(lobby(makeView([player(0, "민수"), player(1, "영희"), player(2, "서준")], mySeat)));
      const btns = container.querySelectorAll("[data-float]");
      expect(btns).toHaveLength(1);
      expect(btns[0]!.getAttribute("data-float")).toBe("dress");
      expect(btns[0]!.getAttribute("aria-label")).toBe("꾸미기");
      expect(container.querySelector("[data-dress-sheet]")).toBeNull();
      unmount();
    }
  });

  it("누르면 시트가 열리고 떠 있는 버튼은 숨는다", () => {
    const { container } = render(lobby(view));
    fireEvent.click(screen.getByRole("button", { name: "꾸미기" }));
    expect(container.querySelector("[data-dress-sheet]")).not.toBeNull();
    expect(container.querySelector("[data-float='dress']")).toBeNull();
    // 내 지금 의상(서버 값 doctor)이 선택돼 있다
    expect(container.querySelector("button[data-outfit='doctor']")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("닫기를 누르면 시트가 사라지고 버튼이 돌아온다", () => {
    const { container } = render(lobby(view));
    fireEvent.click(screen.getByRole("button", { name: "꾸미기" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(container.querySelector("[data-dress-sheet]")).toBeNull();
    expect(container.querySelector("[data-float='dress']")).not.toBeNull();
  });

  it("카드를 누르면 {t:'dress', look} 만 서버로 간다", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    render(lobby(view, send));
    fireEvent.click(screen.getByRole("button", { name: "꾸미기" }));
    send.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "마피아" }));
    const dress = send.mock.calls.map((c) => c[0]).filter((m) => m.t === "dress");
    expect(dress).toEqual([{ t: "dress", look: "mafia" }]);
  });

  it("서버 state 로 look 이 오면 선택 카드가 그 값을 따른다", () => {
    const { container, rerender } = render(lobby(view));
    fireEvent.click(screen.getByRole("button", { name: "꾸미기" }));
    const next = makeView([player(0, "민수"), player(1, "영희"), player(2, "서준", { look: "noir" })], 2);
    rerender(lobby(next));
    act(() => {});
    expect(container.querySelector("button[data-outfit='noir']")?.getAttribute("aria-pressed")).toBe("true");
  });
});
