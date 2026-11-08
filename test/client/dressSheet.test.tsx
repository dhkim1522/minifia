import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { OUTFIT_IDS } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { DRESS_ORDER, DRESS_TEXT, OUTFIT_LABEL } from "../../src/game/dressText";
import { ChatStore } from "../../src/net/chatStore";
import { mapCardSrc, outfitCardSrc } from "../../src/net/assets";
import { MAP_CARD_ORDER, MAP_LABEL, mapCardName } from "../../src/game/dressText";
import { openPlaza } from "../helpers/playable";
import { WorldStore } from "../../src/world/store";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import type { MapId } from "../../shared/protocol";

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
    expect(DRESS_TEXT.open).toBe("옷장");
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
    // 14-07: 닫기 알약의 글자 '닫기' 는 이름표다(TOOL-01 목록 12) — 읽을 글은 카드 이름 + 이름표 하나
    const text = (container.textContent ?? "").replace(/\s/g, "").replace(/^닫기/, "");
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
  it("떠 있는 버튼 하나(data-float=dress, 접근성 이름 옷장)가 있고 방장·손님 똑같다", () => {
    for (const mySeat of [0, 2]) {
      const { container, unmount } = render(lobby(makeView([player(0, "민수"), player(1, "영희"), player(2, "서준")], mySeat)));
      const btns = container.querySelectorAll("[data-float]");
      expect(btns).toHaveLength(1);
      expect(btns[0]!.getAttribute("data-float")).toBe("dress");
      expect(btns[0]!.getAttribute("aria-label")).toBe("옷장");
      expect(container.querySelector("[data-dress-sheet]")).toBeNull();
      unmount();
    }
  });

  it("누르면 시트가 열리고 떠 있는 버튼은 숨는다", () => {
    const { container } = render(lobby(view));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    expect(container.querySelector("[data-dress-sheet]")).not.toBeNull();
    expect(container.querySelector("[data-float='dress']")).toBeNull();
    // 내 지금 의상(서버 값 doctor)이 선택돼 있다
    expect(container.querySelector("button[data-outfit='doctor']")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("닫기를 누르면 시트가 사라지고 버튼이 돌아온다", () => {
    const { container } = render(lobby(view));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(container.querySelector("[data-dress-sheet]")).toBeNull();
    expect(container.querySelector("[data-float='dress']")).not.toBeNull();
  });

  it("카드를 누르면 {t:'dress', look} 만 서버로 간다", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    render(lobby(view, send));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    send.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "마피아" }));
    const dress = send.mock.calls.map((c) => c[0]).filter((m) => m.t === "dress");
    expect(dress).toEqual([{ t: "dress", look: "mafia" }]);
  });

  it("서버 state 로 look 이 오면 선택 카드가 그 값을 따른다", () => {
    const { container, rerender } = render(lobby(view));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    const next = makeView([player(0, "민수"), player(1, "영희"), player(2, "서준", { look: "noir" })], 2);
    rerender(lobby(next));
    act(() => {});
    expect(container.querySelector("button[data-outfit='noir']")?.getAttribute("aria-pressed")).toBe("true");
  });
});

// ── Task 2: 열 때 스크롤·초점·키보드 규칙, 연결 끊김, 미리 보기 ──
describe("DressSheet — 열 때와 키보드 (10-07 Task 2)", () => {
  it("열리면 선택된 카드가 가로 가운데로 오도록 맞추고 그 카드로 초점이 간다", () => {
    const spy = vi.fn();
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = spy;
    try {
      const { container } = render(<DressSheet value="elder" onPick={() => {}} onClose={() => {}} />);
      expect(document.activeElement).toBe(container.querySelector("button[data-outfit='elder']"));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.contexts[0]).toBe(container.querySelector("button[data-outfit='elder']"));
      expect(spy.mock.calls[0]![0]).toMatchObject({ inline: "center", block: "nearest" });
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });

  it("좌우 화살표키로 카드 초점이 옮겨 가고 양 끝에서 멈춘다", () => {
    const { container } = render(<DressSheet value="police" onPick={() => {}} onClose={() => {}} />);
    const card = (id: string) => container.querySelector<HTMLButtonElement>(`button[data-outfit='${id}']`)!;
    expect(document.activeElement).toBe(card("police"));
    fireEvent.keyDown(card("police"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(card("doctor"));
    fireEvent.keyDown(card("doctor"), { key: "ArrowLeft" });
    fireEvent.keyDown(card("police"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(card("coat"));
    fireEvent.keyDown(card("coat"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(card("coat"));
    card("noir").focus();
    fireEvent.keyDown(card("noir"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(card("noir"));
  });

  it("Esc 로 닫는다", () => {
    const onClose = vi.fn();
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={onClose} />);
    fireEvent.keyDown(container.querySelector("button[data-outfit='coat']")!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disabled 이면 카드가 aria-disabled 이고 눌러도 onPick 이 불리지 않는다", () => {
    const onPick = vi.fn();
    const { container } = render(<DressSheet value="coat" onPick={onPick} onClose={() => {}} disabled />);
    const card = container.querySelector<HTMLButtonElement>("button[data-outfit='mafia']")!;
    expect(card.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(card);
    expect(onPick).not.toHaveBeenCalled();
    // 닫기는 연결과 상관없이 동작한다
    expect(container.querySelector("button[aria-label='닫기']")?.getAttribute("aria-disabled")).toBeNull();
  });
});

describe("Lobby — 꾸미기 미리 보기와 초점 (10-07 Task 2)", () => {
  it("카드를 누르면 WorldStage 에 넘기는 view 의 내 좌석 look 이 즉시 바뀐다(밖의 view 는 그대로)", () => {
    render(lobby(view));
    expect(stage.props!.view.players.find((p) => p.seat === 2)?.look).toBe("doctor");
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    fireEvent.click(screen.getByRole("button", { name: "마피아" }));
    expect(stage.props!.view.players.find((p) => p.seat === 2)?.look).toBe("mafia");
    expect(stage.props!.view.players.find((p) => p.seat === 0)?.look).toBeUndefined();
    expect(document.querySelector("button[data-outfit='mafia']")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("서버가 거절하면(1200ms 안에 같은 값이 안 오면) 조용히 서버 값으로 돌아가고 알림이 없다", () => {
    vi.useFakeTimers();
    const { container } = render(lobby(view));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    fireEvent.click(screen.getByRole("button", { name: "마피아" }));
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(stage.props!.view.players.find((p) => p.seat === 2)?.look).toBe("doctor");
    expect(container.querySelector("button[data-outfit='doctor']")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".mv-toast.is-on")).toBeNull();
  });

  it("시트를 닫으면 초점이 꾸미기 버튼으로 돌아온다", () => {
    const { container } = render(lobby(view));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    expect(document.activeElement).toBe(container.querySelector("button[data-outfit='doctor']"));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(document.activeElement).toBe(container.querySelector("[data-float='dress']"));
  });

  it("버튼을 누르면 채팅 입력칸의 초점(키보드)을 뗀다", () => {
    const { container } = render(lobby(view));
    const input = container.querySelector<HTMLInputElement>(".mv-chat__form input")!;
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    expect(document.activeElement).not.toBe(input);
  });

  it("연결이 끊기면 시트의 카드가 비활성이고 눌러도 아무것도 가지 않는다", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    const { container, rerender } = render(lobby(view, send));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    rerender(lobby(view, send, { canSend: false }));
    const card = container.querySelector<HTMLButtonElement>("button[data-outfit='mafia']")!;
    expect(card.getAttribute("aria-disabled")).toBe("true");
    send.mockClear();
    fireEvent.click(card);
    expect(send.mock.calls.filter((c) => c[0].t === "dress")).toEqual([]);
    expect(stage.props!.view.players.find((p) => p.seat === 2)?.look).toBe("doctor");
  });
});

// ── 11-13: 맵 탭(방장 전용) ──
describe("DressSheet — 맵 탭 (11-13, D-20)", () => {
  it("방장이 아니면 탭 행이 없고 의상 카드만 있다", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} mapChoice="random" onPickMap={() => {}} />);
    expect(container.querySelector("[data-map-tab]")).toBeNull();
    expect(container.querySelector("[data-map-card]")).toBeNull();
    expect(container.querySelectorAll("button[data-outfit]")).toHaveLength(9);
  });

  it("방장은 [맵][의상] 탭 둘을 받고 tab 에 따라 처음 열리는 탭이 다르다", () => {
    for (const [tab, shown] of [["map", "map"], ["dress", "dress"], [undefined, "dress"]] as const) {
      const { container, unmount } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab={tab} mapChoice="random" onPickMap={() => {}} />);
      const tabs = [...container.querySelectorAll<HTMLButtonElement>("button[data-map-tab]")];
      expect(tabs.map((t) => t.dataset.mapTab)).toEqual(["map", "dress"]);
      expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["맵", "의상"]);
      expect(tabs.find((t) => t.getAttribute("aria-selected") === "true")?.dataset.mapTab).toBe(shown);
      expect(container.querySelectorAll("button[data-map-card]").length).toBe(shown === "map" ? 3 : 0);
      expect(container.querySelectorAll("button[data-outfit]").length).toBe(shown === "map" ? 0 : 9);
      unmount();
    }
  });

  it("탭을 누르면 내용이 바뀐다", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab="map" mapChoice="random" onPickMap={() => {}} />);
    fireEvent.click(container.querySelector("button[data-map-tab='dress']")!);
    expect(container.querySelectorAll("button[data-outfit]")).toHaveLength(9);
    expect(container.querySelector("button[data-map-card]")).toBeNull();
    fireEvent.click(container.querySelector("button[data-map-tab='map']")!);
    expect(container.querySelectorAll("button[data-map-card]")).toHaveLength(3);
  });

  it("카드 3장(bar·plaza·random), 이름·접근성 이름·그림, 선택은 mapChoice 와 같은 하나", () => {
    expect([...MAP_CARD_ORDER]).toEqual(["bar", "plaza", "random"]);
    expect(MAP_CARD_ORDER.map((id) => MAP_LABEL[id])).toEqual(["재즈 바", "광장", "랜덤"]);
    expect(mapCardName("bar", false)).toBe("지하 재즈 바");
    expect(mapCardName("plaza", true)).toBe("시계탑 광장, 선택됨");
    expect(mapCardName("random", false)).toBe("랜덤");
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab="map" mapChoice="plaza" onPickMap={() => {}} />);
    const cards = [...container.querySelectorAll<HTMLButtonElement>("button[data-map-card]")];
    expect(cards.map((c) => c.dataset.mapCard)).toEqual(["bar", "plaza", "random"]);
    expect(cards.map((c) => c.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
    expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual(["지하 재즈 바", "시계탑 광장, 선택됨", "랜덤"]);
    expect(cards.map((c) => c.querySelector(".mv-map-card__name")?.textContent)).toEqual(["재즈 바", "광장", "랜덤"]);
    expect(cards[0]!.querySelector("img")?.getAttribute("src")).toBe(mapCardSrc("bar"));
    expect(cards[1]!.querySelector("img")?.getAttribute("src")).toBe(mapCardSrc("plaza"));
    expect(cards[2]!.querySelector("img")).toBeNull(); // 랜덤은 shuffle 아이콘
    expect(cards[2]!.querySelector(".mv-map-card__shuffle svg")).not.toBeNull();
    expect(cards[1]!.querySelector(".mv-map-card__check svg")).not.toBeNull();
    expect(cards[0]!.querySelector(".mv-map-card__check")).toBeNull();
  });

  it("mapChoice 가 없으면 랜덤이 선택돼 있다(서버 기본값)", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab="map" onPickMap={() => {}} />);
    expect(container.querySelector("button[data-map-card='random']")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("카드를 누르면 onPickMap(id) 한 번, 연결이 끊기면 aria-disabled 로 아무 일 없다", () => {
    const onPickMap = vi.fn();
    const { container, rerender } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab="map" mapChoice="random" onPickMap={onPickMap} />);
    fireEvent.click(container.querySelector("button[data-map-card='plaza']")!);
    expect(onPickMap).toHaveBeenCalledWith("plaza");
    expect(onPickMap).toHaveBeenCalledTimes(1);
    onPickMap.mockClear();
    rerender(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab="map" mapChoice="random" onPickMap={onPickMap} disabled />);
    const card = container.querySelector<HTMLButtonElement>("button[data-map-card='bar']")!;
    expect(card.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(card);
    expect(onPickMap).not.toHaveBeenCalled();
  });

  it("맵 탭으로 열면 선택된 카드로 초점이 간다", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab="map" mapChoice="bar" onPickMap={() => {}} />);
    expect(document.activeElement).toBe(container.querySelector("button[data-map-card='bar']"));
  });
});

describe("Lobby — 지도 칩과 맵 탭 (11-13, D-20·MAP-06)", () => {
  let restore = () => {};
  beforeEach(() => {
    restore = openPlaza();
  });
  afterEach(() => restore());
  const hostView = (extra: Partial<RoomView> = {}): RoomView => ({ ...makeView([player(0, "민수"), player(1, "영희"), player(2, "서준")], 0), ...extra });
  const guestView = (extra: Partial<RoomView> = {}): RoomView => ({ ...makeView([player(0, "민수"), player(1, "영희"), player(2, "서준")], 2), ...extra });

  it("칩은 방장에게만 보이고 현재 선택(기본 랜덤)을 따른다 — 손님에게는 없다 (16-06 V-5, T-16-13)", () => {
    for (const [v, name] of [[hostView(), "맵 랜덤"], [hostView({ mapChoice: "plaza" }), "맵 광장"], [hostView({ mapChoice: "bar" }), "맵 재즈 바"]] as const) {
      const { container, unmount } = render(lobby(v));
      expect(container.querySelector("[data-map-chip]")?.getAttribute("aria-label")).toBe(name);
      unmount();
    }
    const { container } = render(lobby(guestView({ mapChoice: "plaza" })));
    expect(container.querySelector("[data-map-chip]")).toBeNull();
  });

  it("허용 맵이 하나뿐이면 칩을 그리지 않는다", () => {
    restore();
    const list = PLAYABLE_MAPS as MapId[];
    const saved = [...list];
    list.splice(0, list.length, "bar");
    try {
      const { container } = render(lobby(hostView()));
      expect(container.querySelector("[data-map-chip]")).toBeNull();
    } finally {
      list.splice(0, list.length, ...saved);
      restore = openPlaza();
    }
  });

  it("방장이 칩을 누르면 맵 탭으로, 꾸미기 버튼을 누르면 의상 탭으로 시트가 열린다", () => {
    const { container } = render(lobby(hostView()));
    fireEvent.click(container.querySelector("[data-map-chip]")!);
    expect(container.querySelector("[data-dress-sheet]")).not.toBeNull();
    expect(container.querySelectorAll("button[data-map-card]")).toHaveLength(3);
    expect(container.querySelector("[data-float='dress']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    expect(container.querySelector("button[data-map-card]")).toBeNull();
    expect(container.querySelectorAll("button[data-outfit]")).toHaveLength(9);
    expect(container.querySelectorAll("button[data-map-tab]")).toHaveLength(2);
  });

  it("손님은 맵 칩·봇 단추가 없고(열은 [dress] 하나), 꾸미기 시트에는 탭이 없다", () => {
    const { container } = render(lobby(guestView()));
    expect(container.querySelector("[data-map-chip]")).toBeNull();
    expect([...container.querySelectorAll("[data-side-column] [data-side-button]")].map((e) => e.getAttribute("data-side-button"))).toEqual(["dress"]);
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    expect(container.querySelector("button[data-map-tab]")).toBeNull();
    expect(container.querySelector("button[data-map-card]")).toBeNull();
  });

  it("카드를 누르면 {t:'mapPick', map} 만 가고, 서버 state 의 mapChoice 가 오기 전에는 칩·카드가 바뀌지 않는다", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    const { container, rerender } = render(lobby(hostView(), send));
    fireEvent.click(container.querySelector("[data-map-chip]")!);
    send.mockClear();
    fireEvent.click(container.querySelector("button[data-map-card='plaza']")!);
    expect(send.mock.calls.map((c) => c[0])).toEqual([{ t: "mapPick", map: "plaza" }]);
    expect(container.querySelector("button[data-map-card='random']")?.getAttribute("aria-pressed")).toBe("true");
    rerender(lobby(hostView({ mapChoice: "plaza" }), send));
    expect(container.querySelector("button[data-map-card='plaza']")?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "닫기" })); // 시트가 열린 동안 오른쪽 열은 그리지 않는다
    expect(container.querySelector("[data-map-chip]")?.getAttribute("aria-label")).toBe("맵 광장");
  });

  it("[테스트] 버튼은 왼쪽 위 묶음(.mf-lobby__test)에 혼자 있고 칩은 오른쪽 열로 옮겨 갔다 (16-06 A5)", () => {
    const { container } = render(lobby(hostView(), () => {}, { testButton: <button type="button">테스트</button> }));
    const slot = container.querySelector(".mf-lobby__test")!;
    expect([...slot.children].map((c) => c.textContent)).toEqual(["테스트"]);
    expect(slot.querySelector("[data-map-chip]")).toBeNull();
    expect(container.querySelector("[data-side-column] [data-map-chip]")).not.toBeNull();
  });

  it("[테스트] 버튼이 없으면 .mf-lobby__test 가 없고 칩은 열에 있다", () => {
    const { container } = render(lobby(hostView()));
    expect(container.querySelector(".mf-lobby__map")).toBeNull();
    expect(container.querySelector(".mf-lobby__test")).toBeNull();
    expect(container.querySelector("[data-side-column] [data-map-chip]")).not.toBeNull();
  });

  it("방장 대기실 열(봇 단추 없는 방)은 소리 자리 다음 [map, dress] 다 (위 → 아래)", () => {
    const { container } = render(lobby(hostView()));
    expect([...container.querySelectorAll("[data-side-column] [data-side-button]")].map((e) => e.getAttribute("data-side-button"))).toEqual(["map", "dress"]);
    expect(container.querySelectorAll("[data-side-column]")).toHaveLength(1);
    expect(container.querySelector(".mv-side__col")!.firstElementChild!.classList.contains("mv-side__slot")).toBe(true);
  });
});
