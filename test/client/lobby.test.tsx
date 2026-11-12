import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import { openPlaza } from "../helpers/playable";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { LOBBY_PANEL_EXTRA, LOG_H, lobbyPanelHeight } from "../../src/game/chatUi";
import { bindSignals } from "../../src/audio/signals";
import { ChatStore } from "../../src/net/chatStore";
import { WorldStore } from "../../src/world/store";

/** 키보드 열림 패널 = 14 + 기록 칸 + 8 + 입력줄 48 + 아래 여백 8 (UI-SPEC B 계약 4: 146) */
const KB_PANEL = 14 + LOG_H + 8 + 48 + 8;

// 06-15: 대기실은 지하 재즈 바 맵(WorldStage) 위에 승인 로비 틀(헤더·알림·행동 줄·시트)을 얹는다.
// WorldStage 는 가벼운 가짜로 바꾼다 — 캔버스·런타임은 worldStage.test 가 따로 본다. 가짜는 받은 props 만 기억한다.
// 이 mock 의 모양(경로 "../../src/components/WorldStage", 가짜 컴포넌트가 props 를 stage.props 에 쥠)은 맵을 거쳐 가는 다른 client 테스트도 같이 쓴다.
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

const { Lobby } = await import("../../src/screens/Lobby");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  stage.props = null;
  chatStore = new ChatStore();
});

const player = (seat: number, nickname: string, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  seat,
  nickname,
  connected: true,
  isHost: seat === 0,
  ...extra,
});

const makeView = (players: PublicPlayer[], mySeat = 0, extra: Partial<RoomView> = {}): RoomView => ({
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players,
  me: { seat: mySeat, isHost: players.find((p) => p.seat === mySeat)?.isHost ?? false },
  ...extra,
});

type LobbyProps = Parameters<typeof Lobby>[0];
const store = new WorldStore();
/** 채팅 저장소: 시험마다 새로 만든다(줄이 시험 사이에 남지 않게). 같은 시험 안의 다시 그리기에서는 같은 저장소다 */
let chatStore = new ChatStore();
/** 필수 props(store·chat·send)를 채워 로비를 그린다 */
const lobby = (view: RoomView, extra: Partial<LobbyProps> = {}) => <Lobby view={view} store={store} chat={chatStore} send={() => {}} {...extra} />;
const props = (): WorldStageProps => {
  if (stage.props === null) throw new Error("WorldStage 가 그려지지 않았다");
  return stage.props;
};
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const toastText = (container: HTMLElement): string => container.querySelector(".mv-toast__text")?.textContent ?? "";
const toastOn = (container: HTMLElement): boolean => container.querySelector(".mv-toast")?.classList.contains("is-on") === true;

describe("Lobby — 맵 로비 틀 (MAP-01, 06-15)", () => {
  const view = makeView([player(0, "민수"), player(1, "<b>영희</b>"), player(2, "서준")], 0);

  it("루트는 main.mf-lobby 이고 WorldStage 한 장 위에 헤더·아래 패널이 얹힌다 — 옛 고정 테이블·배경 장면은 없다", () => {
    const { container } = render(lobby(view));
    const root = container.querySelector("main.mf-lobby");
    expect(root).not.toBeNull();
    expect(root?.querySelector("[data-world-stage-fake]")).not.toBeNull();
    expect(root?.querySelector(".mf-lobby__header")).not.toBeNull();
    expect(root?.querySelector(".mf-lobby__panel[data-world-panel]")).not.toBeNull();
    expect(container.querySelector(".mf-dt, .mf-backdrop, .mf-lobby__scene, .mf-lobby__sheet") === null).toBe(true);
  });

  it("WorldStage 에는 view·store·send·canSend·offset 과 콜백이 그대로 넘어간다", () => {
    const send = vi.fn();
    render(lobby(view, { send, canSend: false, offset: 250 }));
    const p = props();
    expect(p.view).toBe(view);
    expect(p.store).toBe(store);
    expect(p.send).toBe(send);
    expect(p.canSend).toBe(false);
    expect(p.offset).toBe(250);
    expect(typeof p.onNotice).toBe("function");
    expect(typeof p.onKick).toBe("function");
    expect(typeof p.onLeave).toBe("function");
    expect(p.exiting).toBeFalsy();
  });

  it("exiting 이면 WorldStage 가 나가는 가림막으로 간다", () => {
    render(lobby(view, { exiting: true }));
    expect(props().exiting).toBe(true);
  });

  it("헤더: 왼쪽 [나가기]·가운데 '대기실'·오른쪽 [공유], 방 코드는 어디에도 보이지 않는다 (3초 규칙)", () => {
    const { container } = render(lobby(view));
    const header = container.querySelector(".mf-lobby__header") as HTMLElement;
    expect(within(header).getByRole("button", { name: "나가기" })).toBeTruthy();
    expect(within(header).getByRole("button", { name: "공유" })).toBeTruthy();
    expect(within(header).getByText("대기실")).toBeTruthy();
    // 16-04(TOOL-04): 머리 단추는 글 없는 아이콘 단추 — 이름은 aria-label [나가기]·[공유]
    const leave = within(header).getByRole("button", { name: "나가기" });
    const share = within(header).getByRole("button", { name: "공유" });
    expect([leave.hasAttribute("data-tool-label"), share.hasAttribute("data-tool-label")]).toEqual([false, false]);
    expect([leave.textContent, share.textContent]).toEqual(["", ""]);
    expect(header.querySelector(".mv-tool__label")).toBeNull();
    expect(container.textContent).not.toContain("0042");
    expect(container.querySelector(".mf-lobby__code") === null).toBe(true);
    // 14-02(U-2): 읽을 글은 '대기실' 하나뿐 — 안내 줄은 자막 띠가 맡는다
    expect(header.querySelectorAll(".mv-phase__title").length).toBe(1);
    expect(header.querySelectorAll(".mv-phase__hint").length).toBe(0);
  });

  it("닉네임은 이 틀 어디에서도 글자로 그려지지 않는다 — 이름표는 WorldStage 몫이다", () => {
    const { container } = render(lobby(view));
    expect(container.textContent).not.toContain("영희");
    expect(container.querySelector("b") === null).toBe(true);
  });

  it("헤더는 제목만이다: 안내 줄(.mv-phase__hint)과 [data-guide] 가 없다(안내는 자막 띠 몫, 14-02 U-2)", () => {
    const { container } = render(lobby(view));
    expect(container.querySelectorAll("[data-guide]").length).toBe(0);
    expect(container.querySelectorAll(".mv-phase__hint").length).toBe(0);
    expect(container.querySelector(".mv-phase__title")!.textContent).toBe("대기실");
  });

  it("[테스트] 버튼은 헤더 아래 자리(.mf-lobby__test)에 놓인다", () => {
    const { container } = render(lobby(view, { testButton: <button type="button">테스트</button> }));
    const slot = container.querySelector(".mf-lobby__test") as HTMLElement;
    expect(slot).not.toBeNull();
    expect(within(slot).getByRole("button", { name: "테스트" })).toBeTruthy();
  });

  it("[테스트] 버튼이 없으면 자리도 없다", () => {
    const { container } = render(lobby(view));
    expect(container.querySelector(".mf-lobby__test") === null).toBe(true);
  });

  it("방 코드가 비어 있으면 [공유] 아이콘이 없다", () => {
    render(lobby(makeView([player(0, "민수")], 0, { code: "" })));
    expect(screen.queryByRole("button", { name: "공유" })).toBeNull();
  });
});

describe("Lobby — 오른쪽 한 줄 열: 방장도 둘(소리·옷장) (16-06 D-05 → 19-04 D-13, UI-SPEC A-12)", () => {
  const players = [player(0, "민수"), player(1, "영희"), player(2, "서준")];
  const side = (c: ParentNode) => [...c.querySelectorAll("[data-side-column] [data-side-button]")].map((e) => e.getAttribute("data-side-button")).join(",");

  it("참가자: 소리 자리 다음 [dress] 뿐이다 — 맵 칩·봇 단추가 없다 (T-16-13)", () => {
    const { container } = render(lobby(makeView(players, 2)));
    expect(side(container)).toBe("dress");
    expect(container.querySelector("[data-map-chip], [data-float='bots']")).toBeNull();
    expect(container.querySelectorAll("[data-side-column]")).toHaveLength(1);
    expect(container.querySelector(".mv-side__col")!.firstElementChild!.classList.contains("mv-side__slot")).toBe(true);
  });

  it("방장 + 봇 도구가 켜진 방: 오른쪽 열은 참가자와 같은 [dress] 하나이고 맵·봇 단추는 열에 없다", () => {
    const view = makeView(players, 0);
    view.me = { ...view.me, testBots: 0 };
    const { container } = render(lobby(view));
    expect(side(container)).toBe("dress");
    expect(container.querySelectorAll("[data-side-column] [data-map-chip], [data-side-column] [data-float='bots']")).toHaveLength(0);
    expect(container.querySelector(".mv-side__col")!.firstElementChild!.classList.contains("mv-side__slot")).toBe(true);
    expect(container.querySelector("[data-float-stack]")).toBeNull();
    for (const b of container.querySelectorAll("[data-side-button]")) {
      expect(b.textContent).toBe(""); // 글 없음(접근성 이름만)
      expect(b.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("방장도 봇 도구가 없으면(testBots 없음) 봇 단추가 어디에도 없다", () => {
    const { container } = render(lobby(makeView(players, 0)));
    expect(container.querySelector("[data-float='bots']")).toBeNull();
    expect(side(container)).toBe("dress");
  });

  it("꾸미기 시트가 열려 있는 동안 열을 그리지 않는다", () => {
    const { container } = render(lobby(makeView(players, 2)));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    expect(container.querySelector("[data-side-column]")).toBeNull();
  });
});

describe("Lobby — 방장 줄과 판 종류 (19-04, D-13·D-05·D-07)", () => {
  const four = () => [player(0, "민수"), player(1, "영희"), player(2, "서준"), player(3, "하윤")];
  /** 방장 view: 4명, 봇 도구 켜짐(testBots 2) */
  const hostView = (extra: Partial<RoomView> = {}): RoomView => {
    const v = makeView(four(), 0, extra);
    return { ...v, me: { ...v.me, testBots: 2 } };
  };
  const guestView = (extra: Partial<RoomView> = {}): RoomView => makeView(four(), 2, extra);
  /** 줄 안 단추 표식(위 → 아래) */
  const railIds = (c: ParentNode) => [...c.querySelectorAll("[data-host-rail] [data-host-rail-btn]")].map((e) => e.getAttribute("data-host-rail-btn")).join(",");
  const mapId = PLAYABLE_MAPS.length > 1 ? ",map" : "";
  const side = (c: ParentNode) => [...c.querySelectorAll("[data-side-column] [data-side-button]")].map((e) => e.getAttribute("data-side-button")).join(",");
  const modeBtn = (c: ParentNode) => c.querySelector('[data-host-rail-btn="mode"]') as HTMLButtonElement | null;
  const card = (mode: "basic" | "extended") => document.querySelector(`[data-mode-card="${mode}"]`) as HTMLButtonElement | null;
  const pressedCards = () => `basic=${card("basic")?.getAttribute("aria-pressed") ?? "없음"},extended=${card("extended")?.getAttribute("aria-pressed") ?? "없음"}`;
  const chipOf = (c: ParentNode) => c.querySelector("[data-mode-chip]");
  /** [판 종류] 단추가 하나 있음을 확인하고 누른다 */
  const pressMode = (c: ParentNode) => {
    expect(c.querySelectorAll('[data-host-rail-btn="mode"]')).toHaveLength(1);
    fireEvent.click(modeBtn(c)!);
  };

  it("방장: 왼쪽 줄 하나에 위에서부터 [판 종류]·[봇]·[튜토리얼 먼저](확장판 — [맵] 없음, 20-07 D-02), 오른쪽 열은 [옷장] 하나(첫 칸은 소리 자리)다", () => {
    const { container } = render(lobby(hostView()));
    expect(container.querySelectorAll("[data-host-rail]")).toHaveLength(1);
    expect(railIds(container)).toBe("mode,bots,tutorial");
    expect(side(container)).toBe("dress");
    expect(container.querySelector(".mv-side__col")!.firstElementChild!.classList.contains("mv-side__slot")).toBe(true);
    expect(container.querySelectorAll("[data-side-column] [data-map-chip], [data-side-column] [data-float='bots']")).toHaveLength(0);
    expect(modeBtn(container)?.getAttribute("aria-label")).toBe("판 종류: 확장판");
    expect(container.querySelector('[data-host-rail-btn="bots"]')?.getAttribute("aria-label")).toBe("봇");
    expect(chipOf(container)).toBeNull(); // 방장에게는 칩이 없다
  });

  it("기본 마피아 방장: 위에서부터 [판 종류]·[맵]·[봇]이고 [튜토리얼 먼저]는 없다 (20-07 D-02 — [맵]은 기본 마피아에서만)", () => {
    const { container } = render(lobby(hostView({ mode: "basic" })));
    expect(container.querySelectorAll("[data-host-rail]")).toHaveLength(1);
    expect(railIds(container)).toBe(`mode${mapId},bots`);
    expect(modeBtn(container)?.getAttribute("aria-label")).toBe("판 종류: 기본 마피아");
    expect(container.querySelectorAll("[data-side-column] [data-map-chip], [data-side-column] [data-float='bots']")).toHaveLength(0);
  });

  it("봇 도구가 없는 방장은 줄에 [봇]이 없다(칸으로 세지 않는다)", () => {
    const { container, unmount } = render(lobby(makeView(four(), 0)));
    expect(railIds(container)).toBe("mode,tutorial");
    unmount();
    const basic = render(lobby(makeView(four(), 0, { mode: "basic" })));
    expect(railIds(basic.container)).toBe(`mode${mapId}`);
  });

  it("기본 마피아를 고르면 맨 아래 [튜토리얼 먼저]가 사라지고 [판 종류] 아래에 [맵]이 생긴다. 확장판으로 되돌리면 반대다 (D-10, UI-SPEC A-2 → 20-07 D-02)", () => {
    const { container, rerender } = render(lobby(hostView()));
    rerender(lobby(hostView({ mode: "basic" })));
    expect(railIds(container)).toBe(`mode${mapId},bots`);
    rerender(lobby(hostView({ mode: "extended" })));
    expect(railIds(container)).toBe("mode,bots,tutorial");
  });

  it("[판 종류] → 시트가 열리고 확장판이 골라져 있다. [기본 마피아]를 누르면 modePick 이 한 번 가고 표시는 서버 값이 올 때까지 그대로다", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    const { container, rerender } = render(lobby(hostView(), { send }));
    expect(document.querySelector("[data-mode-sheet]")).toBeNull();
    pressMode(container);
    expect(document.querySelectorAll("[data-mode-sheet]")).toHaveLength(1);
    expect(pressedCards()).toBe("basic=false,extended=true");
    expect(modeBtn(container)?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(card("basic")!);
    expect(JSON.stringify(send.mock.calls.map((c) => c[0]))).toBe(JSON.stringify([{ t: "modePick", mode: "basic" }]));
    expect(pressedCards()).toBe("basic=false,extended=true"); // 낙관 갱신 없음(P19-6)
    expect(modeBtn(container)?.getAttribute("aria-label")).toBe("판 종류: 확장판");
    rerender(lobby(hostView({ mode: "basic" }), { send }));
    expect(pressedCards()).toBe("basic=true,extended=false");
    expect(modeBtn(container)?.getAttribute("aria-label")).toBe("판 종류: 기본 마피아");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("[판 종류]를 누르면 채팅 입력칸의 포커스를 먼저 푼다", () => {
    const { container } = render(lobby(hostView()));
    const input = container.querySelector("[data-chat-input]") as HTMLInputElement;
    const blur = vi.spyOn(input, "blur");
    pressMode(container);
    expect(blur).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("[data-mode-sheet]")).toHaveLength(1);
  });

  it("시트를 [닫기]로 닫으면 초점이 [판 종류] 단추로 돌아온다", () => {
    vi.useFakeTimers();
    const { container } = render(lobby(hostView()));
    pressMode(container);
    fireEvent.click(within(screen.getByRole("dialog", { name: "판 종류" })).getByRole("button", { name: "닫기" }));
    advance(260);
    expect(document.querySelector("[data-mode-sheet]")).toBeNull();
    expect(document.activeElement?.getAttribute("data-host-rail-btn") ?? "없음").toBe("mode");
    expect(modeBtn(container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("연결이 끊기면(canSend 거짓) 줄 단추가 모두 aria-disabled 이고 눌러도 시트가 열리지 않는다", () => {
    const { container } = render(lobby(hostView(), { canSend: false }));
    const btns = [...container.querySelectorAll("[data-host-rail] [data-host-rail-btn]")];
    expect(btns.length).toBeGreaterThanOrEqual(2);
    expect(btns.map((b) => b.getAttribute("aria-disabled")).join(",")).toBe(btns.map(() => "true").join(","));
    pressMode(container);
    expect(document.querySelector("[data-mode-sheet]")).toBeNull();
    fireEvent.click(container.querySelector('[data-host-rail-btn="bots"]')!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("시트가 열린 채 연결이 끊기면 칸을 눌러도 아무것도 보내지 않는다", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    const { container, rerender } = render(lobby(hostView(), { send }));
    pressMode(container);
    rerender(lobby(hostView(), { send, canSend: false }));
    fireEvent.click(card("basic")!);
    expect(send).not.toHaveBeenCalled();
  });

  it("참가자: 방장 줄 마크업이 없고(미렌더) 왼쪽 위에 읽기 전용 칩 하나 '판 종류: 확장판' (T-19-13)", () => {
    const { container } = render(lobby(guestView()));
    expect(container.querySelectorAll("[data-host-rail], [data-host-rail-btn]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-mode-chip]")).toHaveLength(1);
    expect(chipOf(container)?.getAttribute("data-mode-chip")).toBe("extended");
    expect(chipOf(container)?.textContent).toBe("판 종류: 확장판");
    expect(chipOf(container)?.tagName).toBe("DIV"); // 누를 수 없다
  });

  it("참가자: 판 종류가 바뀐 view 가 오면 칩이 바뀌고 알림 한 줄 '판 종류: 기본 마피아' → 다시 바뀌면 '판 종류: 확장판'", () => {
    const { container, rerender } = render(lobby(guestView()));
    expect(toastText(container)).toBe("");
    rerender(lobby(guestView({ mode: "basic" })));
    expect(chipOf(container)?.getAttribute("data-mode-chip")).toBe("basic");
    expect(chipOf(container)?.textContent).toBe("판 종류: 기본 마피아");
    expect(toastText(container)).toBe("판 종류: 기본 마피아");
    expect(toastOn(container)).toBe(true);
    rerender(lobby(guestView({ mode: "extended" })));
    expect(toastText(container)).toBe("판 종류: 확장판");
  });

  it("알림이 없는 때: 방장 본인 · 처음 그릴 때 · 재연결 직후(epoch) · 재접속 띠가 떠 있는 동안", () => {
    const host = render(lobby(hostView()));
    host.rerender(lobby(hostView({ mode: "basic" })));
    expect(toastText(host.container)).toBe("");
    host.unmount();
    const first = render(<StrictMode>{lobby(guestView({ mode: "basic" }))}</StrictMode>);
    expect(toastText(first.container)).toBe("");
    first.unmount();
    const re = render(lobby(guestView(), { epoch: 0 }));
    re.rerender(lobby(guestView({ mode: "basic" }), { epoch: 1 }));
    expect(toastText(re.container)).toBe("");
    re.unmount();
    const band = render(lobby(guestView(), { bannerVisible: true }));
    band.rerender(lobby(guestView({ mode: "basic" }), { bannerVisible: true }));
    expect(toastText(band.container)).toBe("");
    // 띠가 사라져도 그사이 바뀜은 기준선에 들어가 뒤늦게 알리지 않는다
    band.rerender(lobby(guestView({ mode: "basic" }), { bannerVisible: false }));
    expect(toastText(band.container)).toBe("");
  });

  it("같은 방송에 입장과 판 종류 바뀜이 함께면 입장 알림이 먼저다(방장 변경 > 입장 > 퇴장 > 판 종류)", () => {
    const { container, rerender } = render(lobby(guestView()));
    rerender(lobby(makeView([...four(), player(4, "지아")], 2, { mode: "basic" })));
    expect(toastText(container)).toBe("지아 님 입장");
    expect(chipOf(container)?.getAttribute("data-mode-chip")).toBe("basic");
  });

  it("방장이 바뀌어 내가 방장이 되면 칩이 사라지고 줄이 나온다 — 서버 view 의 isHost 로만", () => {
    const { container, rerender } = render(lobby(guestView()));
    expect(`${container.querySelectorAll("[data-host-rail]").length}/${container.querySelectorAll("[data-mode-chip]").length}`).toBe("0/1");
    const players = four().map((p) => ({ ...p, isHost: p.seat === 2 }));
    rerender(lobby(makeView(players, 2)));
    expect(`${container.querySelectorAll("[data-host-rail]").length}/${container.querySelectorAll("[data-mode-chip]").length}`).toBe("1/0");
    // 거꾸로: 방장을 넘겨주면 줄이 사라지고 칩이 나온다
    rerender(lobby(guestView()));
    expect(`${container.querySelectorAll("[data-host-rail]").length}/${container.querySelectorAll("[data-mode-chip]").length}`).toBe("0/1");
  });

  it("꾸미기 시트가 열린 동안에는 줄도 칩도 그리지 않는다 (P19-16)", () => {
    const host = render(lobby(hostView()));
    expect(host.container.querySelectorAll("[data-host-rail]")).toHaveLength(1);
    fireEvent.click(within(host.container).getByRole("button", { name: "옷장" }));
    expect(host.container.querySelectorAll("[data-host-rail]")).toHaveLength(0);
    host.unmount();
    const guest = render(lobby(guestView()));
    expect(guest.container.querySelectorAll("[data-mode-chip]")).toHaveLength(1);
    fireEvent.click(within(guest.container).getByRole("button", { name: "옷장" }));
    expect(guest.container.querySelectorAll("[data-mode-chip]")).toHaveLength(0);
  });

  it("키보드가 열린 동안에는 줄도 칩도 그리지 않는다 (P19-16)", () => {
    const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
    const realInnerH = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
    vi.useFakeTimers();
    try {
      for (const [view, sel] of [[hostView(), "[data-host-rail]"], [guestView(), "[data-mode-chip]"]] as const) {
        vv.height = 844;
        const { container, unmount } = render(lobby(view));
        expect(container.querySelectorAll(sel)).toHaveLength(1);
        act(() => (container.querySelector("[data-chat-input]") as HTMLInputElement).focus());
        vv.height = 844 - 336;
        act(() => void vv.dispatchEvent(new Event("resize")));
        advance(20);
        expect(container.querySelector("main.mf-lobby")?.getAttribute("data-kb-open")).toBe("true");
        expect(container.querySelectorAll(sel)).toHaveLength(0);
        unmount();
      }
    } finally {
      Reflect.deleteProperty(window, "visualViewport");
      Object.defineProperty(window, "innerHeight", { value: realInnerH, configurable: true, writable: true });
    }
  });

  it("테스트 방([테스트] 단추가 있음)은 줄·칩이 그 아래에서 시작한다(data-test-shift), 없으면 표식이 없다 (P19-5)", () => {
    const test = <button type="button">테스트</button>;
    const host = render(lobby(hostView(), { testButton: test }));
    expect(host.container.querySelector("[data-host-rail]")?.hasAttribute("data-test-shift")).toBe(true);
    host.unmount();
    const plain = render(lobby(hostView()));
    expect(plain.container.querySelector("[data-host-rail]")?.hasAttribute("data-test-shift")).toBe(false);
    plain.unmount();
    const guest = render(lobby(guestView(), { testButton: test }));
    expect(guest.container.querySelector("[data-mode-chip]")?.hasAttribute("data-test-shift")).toBe(true);
    guest.unmount();
    const plainGuest = render(lobby(guestView()));
    expect(plainGuest.container.querySelector("[data-mode-chip]")?.hasAttribute("data-test-shift")).toBe(false);
  });

  it("테스트 방은 줄 최대 높이도 48 줄어든다 — 왕관 표식까지 들어가던 높이에서 [테스트]가 있으면 표식이 빠진다 (F-1)", () => {
    // 기본 마피아 방: 줄 단추가 [판 종류]·([맵])·[봇] 으로 고정이다(튜토리얼 토글 없음)
    const n = PLAYABLE_MAPS.length > 1 ? 3 : 2;
    const withCrown = n * 52 + (n - 1) * 12 + 32;
    const panelH = lobbyPanelHeight(LOG_H);
    // 오른쪽 열 최대 높이 = 방 높이 − 패널 − 8 − (헤더 62 + 12) = 표식까지의 높이 + 40 (48 을 빼면 표식이 안 들어간다)
    const roomH = withCrown + 40 + panelH + 8 + 62 + 12;
    const offset = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mf-lobby__panel")) return panelH;
      if (this.classList.contains("mf-lobby__header")) return 62;
      return 0;
    });
    const client = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("mf-lobby") ? roomH : 0;
    });
    try {
      const crowns = (c: ParentNode) => `${c.querySelectorAll("[data-host-rail]").length}/${c.querySelectorAll("[data-host-rail-crown]").length}/${c.querySelectorAll(".mf-hostrail__col").length}`;
      const plain = render(lobby(hostView({ mode: "basic" })));
      expect(crowns(plain.container)).toBe("1/1/1");
      plain.unmount();
      const test = render(lobby(hostView({ mode: "basic" }), { testButton: <button type="button">테스트</button> }));
      expect(crowns(test.container)).toBe("1/0/1");
    } finally {
      offset.mockRestore();
      client.mockRestore();
    }
  });

  it("[시작] 단추는 그대로다: 패널 행동 줄 안, 같은 클래스·접근성 이름, 방장 줄에 들어가지 않는다 (D-17)", () => {
    const { container } = render(lobby(hostView()));
    const start = container.querySelector("[data-lobby-start]") as HTMLButtonElement;
    expect(start.closest(".mf-lobby__panel") !== null).toBe(true);
    expect(start.closest("[data-host-rail]")).toBeNull();
    expect(start.getAttribute("aria-label")).toBe("게임 시작, 4명 모임");
    expect(start.classList.contains("mv-hostrail-btn")).toBe(false);
    expect(container.querySelectorAll("[data-host-rail] [data-lobby-start]")).toHaveLength(0);
  });

  it("가상 뷰포트가 밀리면 줄·칩도 헤더 계열과 함께 내려온다 (lobby.css)", () => {
    const css = readFileSync("src/styles/lobby.css", "utf8");
    const rule = (css.split("}").find((r) => r.includes(".mf-lobby .mv-side") && r.includes("translateY(var(--mf-vv-top")) ?? "").replace(/\s+/g, " ");
    expect(rule.includes(".mf-lobby .mf-hostrail")).toBe(true);
    expect(rule.includes(".mf-lobby .mf-modechip")).toBe(true);
  });
});

describe("Lobby — 확장판의 [맵] 숨김 (20-07, D-02·P20-16)", () => {
  // 확장판은 늘 마을이라 고를 것이 없다: [맵] 단추·맵 탭의 조건 = 허용 맵이 둘 이상 && 판 종류가 기본 마피아
  let restore = () => {};
  beforeEach(() => {
    restore = openPlaza();
  });
  afterEach(() => restore());
  const four = () => [player(0, "민수"), player(1, "영희"), player(2, "서준"), player(3, "하윤")];
  const hostView = (extra: Partial<RoomView> = {}): RoomView => makeView(four(), 0, extra);
  const guestView = (extra: Partial<RoomView> = {}): RoomView => makeView(four(), 2, extra);
  const mapBtns = (c: ParentNode) => c.querySelectorAll('[data-host-rail-btn="map"]').length;
  const chipName = (c: ParentNode) => c.querySelector("[data-map-chip]")?.getAttribute("aria-label") ?? "없음";

  it("방장: 확장판(mode 키 없음 = 기본값, extended)이면 [맵] 단추가 없고 기본 마피아면 하나 있다", () => {
    const cases: [Partial<RoomView>, number][] = [[{}, 0], [{ mode: "extended" }, 0], [{ mode: "basic" }, 1]];
    for (const [extra, n] of cases) {
      const { container, unmount } = render(lobby(hostView({ mapChoice: "plaza", ...extra })));
      expect(`${extra.mode ?? "키 없음"}: [맵] ${mapBtns(container)}`).toBe(`${extra.mode ?? "키 없음"}: [맵] ${n}`);
      expect(container.querySelectorAll("[data-map-chip]")).toHaveLength(n);
      unmount();
    }
  });

  it("확장판 → 기본 마피아로 view 가 바뀌면 [맵] 단추가 생기고 칩의 고른 맵은 view.mapChoice 그대로다. 확장판으로 되돌리면 다시 사라진다", () => {
    const { container, rerender } = render(lobby(hostView({ mapChoice: "plaza" })));
    expect(chipName(container)).toBe("없음");
    rerender(lobby(hostView({ mapChoice: "plaza", mode: "basic" })));
    expect(mapBtns(container)).toBe(1);
    expect(chipName(container)).toBe("맵 광장");
    rerender(lobby(hostView({ mapChoice: "plaza", mode: "extended" })));
    expect(chipName(container)).toBe("없음");
    rerender(lobby(hostView({ mapChoice: "plaza", mode: "basic" })));
    expect(chipName(container)).toBe("맵 광장");
  });

  it("참가자 화면은 두 판 모두 [맵] 단추가 없고 꾸미기 시트에 맵 탭도 없다", () => {
    for (const mode of ["extended", "basic"] as const) {
      const { container, unmount } = render(lobby(guestView({ mapChoice: "plaza", mode })));
      expect(container.querySelectorAll('[data-host-rail-btn="map"], [data-map-chip]')).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: "옷장" }));
      expect(container.querySelectorAll("[data-map-tab], [data-map-card]")).toHaveLength(0);
      unmount();
    }
  });

  it("확장판 방장이 [옷장]으로 연 시트에는 탭 줄이 없고 의상 카드만 있다", () => {
    const { container } = render(lobby(hostView({ mapChoice: "plaza" })));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    expect(container.querySelectorAll("[data-map-tab], [data-map-card]")).toHaveLength(0);
    expect(container.querySelectorAll("button[data-outfit]")).toHaveLength(9);
  });

  it("기본 마피아에서 [맵]으로 시트를 맵 탭으로 연 뒤 view 가 확장판으로 바뀌면 탭 줄이 없고 의상 카드가 보인다 (P20-16)", () => {
    const { container, rerender } = render(lobby(hostView({ mode: "basic" })));
    fireEvent.click(container.querySelector("[data-map-chip]")!);
    expect(container.querySelectorAll("button[data-map-card]")).toHaveLength(3);
    expect(container.querySelectorAll("button[data-map-tab]")).toHaveLength(2);
    rerender(lobby(hostView({ mode: "extended" })));
    expect(container.querySelectorAll("[data-dress-sheet]")).toHaveLength(1); // 시트는 열린 채다
    expect(container.querySelectorAll("[data-map-tab]")).toHaveLength(0);
    expect(container.querySelectorAll("button[data-map-card]")).toHaveLength(0);
    expect(container.querySelectorAll("button[data-outfit]")).toHaveLength(9);
    // 기본 마피아로 되돌리면 탭 줄이 돌아오지만 저절로 맵 탭으로 넘어가지 않는다
    rerender(lobby(hostView({ mode: "basic" })));
    expect(container.querySelectorAll("button[data-map-tab]")).toHaveLength(2);
    expect(container.querySelector("button[data-map-tab][aria-selected='true']")?.getAttribute("data-map-tab")).toBe("dress");
    expect(container.querySelectorAll("button[data-outfit]")).toHaveLength(9);
  });
});

describe("Lobby — 채팅 패널: 기록 + 입력줄 + 행동 줄 (CHAT-01, 07-13)", () => {
  const base = [player(0, "민수"), player(1, "서준")];
  const sysTexts = (container: HTMLElement): string => [...container.querySelectorAll(".mv-chat__sys")].map((el) => el.textContent ?? "").join("|");

  it("패널 안에서 [data-chat-panel][data-chat-channel=all] 이 위, 그 아래에 방장 [시작]", () => {
    const { container } = render(lobby(makeView(base, 0)));
    const panel = container.querySelector(".mf-lobby__panel") as HTMLElement;
    const chat = panel.querySelector('[data-chat-panel][data-chat-channel="all"]') as HTMLElement;
    const start = panel.querySelector("[data-lobby-start]") as HTMLElement;
    expect(chat === null || start === null).toBe(false);
    expect((chat.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
  });

  it("손님은 같은 자리에 '방장을 기다리는 중…' 이 채팅 아래에 온다", () => {
    const { container } = render(lobby(makeView(base, 1)));
    const panel = container.querySelector(".mf-lobby__panel") as HTMLElement;
    const chat = panel.querySelector("[data-chat-panel]") as HTMLElement;
    const wait = within(panel).getByRole("button", { name: "방장을 기다리는 중…" });
    expect((chat.compareDocumentPosition(wait) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
  });

  it("기록 칸 높이는 어느 방 높이에서나 68 한 값이다(P181-3)", () => {
    const realH = window.innerHeight;
    try {
      for (const h of [560, 640, 844, 932]) {
        Object.defineProperty(window, "innerHeight", { value: h, configurable: true, writable: true });
        const { container, unmount } = render(lobby(makeView(base, 0)));
        const log = container.querySelector("[data-chat-log]") as HTMLElement;
        expect(log.style.height).toBe("68px");
        unmount();
      }
    } finally {
      Object.defineProperty(window, "innerHeight", { value: realH, configurable: true, writable: true });
    }
    expect(LOG_H).toBe(68);
    expect(lobbyPanelHeight(LOG_H)).toBe(222);
    // 19-04(P19-12): 방장 패널 = 참가자 패널. 예전의 두 번째 인자(방장)를 줘도 값이 같다
    expect((lobbyPanelHeight as (logH: number, host?: boolean) => number)(LOG_H, true)).toBe(222);
    expect(KB_PANEL).toBe(146);
  });

  it("보내기는 단계 키와 함께 chat 메시지를 보낸다 (채널 필드 없음)", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    const { container } = render(lobby(makeView(base, 1), { send }));
    const input = container.querySelector("[data-chat-input]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "안녕하세요" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    // 입력 중 신호(typing)는 07-18 부터 글을 넣을 때 따로 나간다 — 채팅 메시지만 가려 본다.
    const chats = send.mock.calls.map((c) => c[0]).filter((m) => m.t === "chat");
    expect(chats.length).toBe(1);
    expect(JSON.stringify(chats[0])).toBe(JSON.stringify({ t: "chat", text: "안녕하세요", pk: "1:0:lobby" }));
  });

  it("재접속 띠가 떠 있어도(canSend 거짓) 입력칸은 쓸 수 있고 보내기만 aria-disabled 다", () => {
    const { container } = render(lobby(makeView(base, 1), { canSend: false, bannerVisible: true }));
    const input = container.querySelector("[data-chat-input]") as HTMLInputElement;
    expect(input.disabled).toBe(false);
    fireEvent.change(input, { target: { value: "쓰는 중" } });
    expect(input.value).toBe("쓰는 중");
    expect((container.querySelector("[data-chat-send]") as HTMLElement).getAttribute("aria-disabled")).toBe("true");
  });

  it("손님이 들어오면 기록 칸에 '{닉네임} 님 입장' 시스템 줄이 남는다 (위 알림과 같은 문구)", () => {
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0 }));
    expect(sysTexts(container)).toBe("");
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 0 }));
    expect(sysTexts(container)).toBe("하윤 님 입장");
    expect(toastText(container)).toBe("하윤 님 입장");
  });

  it("WR-02: 입장·퇴장 시스템 줄의 시각은 서버 시각 추정(Date.now() + offset)이고 offset 이 바뀌어도 효과가 다시 돌지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const three = [...base, player(2, "영희")];
    const { rerender } = render(lobby(makeView(base, 0), { epoch: 0, offset: 5000 }));
    rerender(lobby(makeView(three, 0), { epoch: 0, offset: 5000 }));
    rerender(lobby(makeView(base, 0), { epoch: 0, offset: 5000 }));
    const sys = chatStore.lines().filter((l) => l.kind === "system");
    expect(sys.map((l) => `${l.text}@${l.at}`).join("|")).toBe("영희 님 입장@1005000|영희 님 퇴장@1005000");
    // offset 만 바뀐 다시 그리기는 줄을 더하지 않는다
    rerender(lobby(makeView(base, 0), { epoch: 0, offset: 9000 }));
    expect(chatStore.lines().filter((l) => l.kind === "system").length).toBe(2);
  });

  it("한 번에 둘이 들어오면 둘 다 기록에 남는다", () => {
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0 }));
    rerender(lobby(makeView([...base, player(2, "하윤"), player(3, "지아")], 0), { epoch: 0 }));
    expect(sysTexts(container)).toBe("하윤 님 입장|지아 님 입장");
  });

  it("퇴장은 '{닉네임} 님 퇴장'", () => {
    const three = [...base, player(2, "영희")];
    const { container, rerender } = render(lobby(makeView(three, 0), { epoch: 0 }));
    rerender(lobby(makeView(base, 0), { epoch: 0 }));
    expect(sysTexts(container)).toBe("영희 님 퇴장");
  });

  it("epoch 가 바뀐 첫 view(재연결 직후)에서는 입장 줄을 만들지 않는다", () => {
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0 }));
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 1 }));
    expect(sysTexts(container)).toBe("");
    rerender(lobby(makeView([...base, player(2, "하윤"), player(3, "지아")], 0), { epoch: 1 }));
    expect(sysTexts(container)).toBe("지아 님 입장");
  });

  it("재접속 띠가 떠 있는 동안에도 기록에는 남는다 (알림만 억제)", () => {
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0, bannerVisible: true }));
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 0, bannerVisible: true }));
    expect(toastText(container)).toBe("");
    expect(sysTexts(container)).toBe("하윤 님 입장");
  });

  it("방장이 바뀌면 기록에 같은 문구의 crown 시스템 줄이 한 줄 남는다 (UI-SPEC E.1, 위 알림과 같은 글)", () => {
    const { container, rerender } = render(lobby(makeView(base, 1), { epoch: 0 }));
    rerender(lobby(makeView([player(0, "민수", { isHost: false }), player(1, "서준", { isHost: true })], 1), { epoch: 0 }));
    expect(sysTexts(container)).toBe("방장 · 서준");
    expect(toastText(container)).toBe("방장 · 서준");
    const lines = chatStore.lines().filter((l) => l.kind === "system");
    expect(lines.map((l) => `${l.text}|${l.icon}|${l.scope}`)).toEqual(["방장 · 서준|crown|all"]);
  });

  it("방장이 바뀐 줄은 재접속 직후 첫 스냅샷(epoch 가 바뀐 view)에는 만들지 않고 같은 view 를 다시 그려도 늘지 않는다", () => {
    const hosted = (n: number) => makeView([player(0, "민수", { isHost: n === 0 }), player(1, "서준", { isHost: n === 1 })], 1);
    const { container, rerender } = render(lobby(hosted(0), { epoch: 0 }));
    rerender(lobby(hosted(1), { epoch: 1 }));
    expect(sysTexts(container)).toBe("");
    rerender(lobby(hosted(1), { epoch: 1, bannerVisible: false }));
    expect(sysTexts(container)).toBe("");
    rerender(lobby(hosted(0), { epoch: 1 }));
    expect(sysTexts(container)).toBe("방장 · 민수");
  });

  it("재접속 띠가 떠 있는 동안에도 방장 변경은 기록에 남는다 (알림만 억제)", () => {
    const { container, rerender } = render(lobby(makeView(base, 1), { epoch: 0, bannerVisible: true }));
    rerender(lobby(makeView([player(0, "민수", { isHost: false }), player(1, "서준", { isHost: true })], 1), { epoch: 0, bannerVisible: true }));
    expect(toastText(container)).toBe("");
    expect(sysTexts(container)).toBe("방장 · 서준");
  });

  it("StrictMode 이중 효과에서도 입장 줄이 한 번만 남는다", () => {
    const { container, rerender } = render(<StrictMode>{lobby(makeView(base, 0), { epoch: 0 })}</StrictMode>);
    rerender(<StrictMode>{lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 0 })}</StrictMode>);
    expect(sysTexts(container)).toBe("하윤 님 입장");
  });
});

describe("대기실 [시작] 빛남 (HOST-03)", () => {
  const start = (container: HTMLElement) => container.querySelector("[data-lobby-start]") as HTMLButtonElement | null;
  const lit = (el: HTMLElement | null) => (el === null ? "없음" : `${el.classList.contains("is-call")}/${el.hasAttribute("data-call")}`);
  const hostView = (connected: number) => {
    const players = [player(0, "방장님")];
    for (let i = 1; i <= connected; i += 1) players.push(player(i, `친구${i}`));
    return makeView(players, 0);
  };

  it("방장 + 연결 4명(시작 가능): [시작] 에 is-call + 값 없는 data-call", () => {
    const { container } = render(lobby(hostView(3)));
    expect(lit(start(container))).toBe("true/true");
    expect(start(container)!.getAttribute("data-call")).toBe("");
  });

  it("누르면(send 성공) 꺼지고, 2초 잠금이 풀려도 같은 대기실 안에서는 다시 켜지지 않는다", () => {
    vi.useFakeTimers();
    const { container } = render(lobby(hostView(3), { send: vi.fn() }));
    fireEvent.click(start(container)!);
    expect(lit(start(container))).toBe("false/false");
    advance(2_000);
    expect(start(container)!.className).toContain("mf-act--primary");
    expect(lit(start(container))).toBe("false/false");
  });

  it("방장 + 연결 3명(모자람): 빛나지 않는다. 누르려 해도 켜지지 않는다", () => {
    const { container } = render(lobby(hostView(2)));
    expect(lit(start(container))).toBe("false/false");
    fireEvent.click(start(container)!);
    expect(lit(start(container))).toBe("false/false");
  });

  it("손님: [시작] 이 없고 data-call 도 없다", () => {
    const view = makeView([player(0, "방장님"), player(1, "친구1"), player(2, "친구2"), player(3, "친구3")], 1);
    const { container } = render(lobby(view));
    expect(lit(start(container))).toBe("없음");
    expect(container.querySelector("[data-call]")).toBeNull();
  });

  it("연결 끊김(canSend 거짓): 빛나지 않는다", () => {
    const { container } = render(lobby(hostView(3), { canSend: false }));
    expect(lit(start(container))).toBe("false/false");
  });
});

describe("Lobby — 행동 줄: [시작] 과 점, 손님 (ROOM-03, UI-SPEC 행동 줄)", () => {
  const start = (container: HTMLElement) => container.querySelector("[data-lobby-start]") as HTMLButtonElement | null;
  // 방장(seat 0) + 연결된 참가자 n 명 + 끊긴 참가자 away 명
  const hostView = (connected: number, away = 0) => {
    const players = [player(0, "방장님")];
    for (let i = 1; i <= connected; i += 1) players.push(player(i, `친구${i}`));
    for (let i = 0; i < away; i += 1) players.push(player(connected + 1 + i, `먼친구${i}`, { connected: false }));
    return makeView(players, 0);
  };
  const countText = (container: HTMLElement) => container.querySelector("[data-lobby-start] .mv-count")?.textContent;

  it("방장 · 연결 5명: 활성 [시작] — aria-label '게임 시작, 5명 모임', 숫자 5 / 8", () => {
    const { container } = render(lobby(hostView(4)));
    const b = start(container)!;
    expect(b.getAttribute("aria-label")).toBe("게임 시작, 5명 모임");
    expect(b.getAttribute("aria-disabled")).toBeNull();
    expect(b.className).toContain("mf-act--primary");
    expect(b.textContent).toContain("시작");
    expect(countText(container)).toBe("5 / 8");
    expect(container.querySelector(".mv-dots")).toBeNull();
    expect(container.querySelector(".mf-lobby__panel")?.contains(b)).toBe(true);
  });

  it("8명이면 숫자 8 / 8 이고 별도 문구는 없다", () => {
    const { container } = render(lobby(hostView(7)));
    expect(countText(container)).toBe("8 / 8");
    expect(container.textContent).not.toContain("가득");
  });

  it("누르면 start 를 한 번 보내고 2초 안에는 다시 보내지 않으며 2초 뒤 다시 보낼 수 있다", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const { container } = render(lobby(hostView(4), { send }));
    fireEvent.click(start(container)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "start", tutorial: true });
    fireEvent.click(start(container)!);
    advance(1999);
    fireEvent.click(start(container)!);
    expect(send).toHaveBeenCalledTimes(1);
    // 잠긴 동안은 흐리게 — 눌러도 알림을 띄우지 않는다
    expect(toastText(container)).toBe("");
    advance(1);
    fireEvent.click(start(container)!);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("연결 3명(모자람): 흐린 inactive — aria-disabled, 누르면 start 없이 알림 '4명부터 시작해요' 한 번", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const { container } = render(lobby(hostView(2), { send }));
    const b = start(container)!;
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(b.disabled).toBe(false);
    expect(b.className).toContain("mf-act--inactive");
    expect(b.getAttribute("aria-label")).toBe("게임 시작, 3명 모임, 4명부터 시작할 수 있어요");
    expect(countText(container)).toBe("3 / 8");
    fireEvent.click(b);
    expect(send).not.toHaveBeenCalled();
    expect(toastText(container)).toBe("4명부터 시작해요");
    expect(toastOn(container)).toBe(true);
  });

  it("방장 혼자면 숫자 1 / 8 이고 흐리다", () => {
    const { container } = render(lobby(hostView(0)));
    expect(countText(container)).toBe("1 / 8");
    expect(start(container)?.getAttribute("aria-disabled")).toBe("true");
  });

  it("끊긴 사람은 모인 사람 수에 들지 않는다: 연결 3 + 끊김 2 → 3 / 8, 흐림", () => {
    const { container } = render(lobby(hostView(2, 2)));
    expect(countText(container)).toBe("3 / 8");
    expect(start(container)?.getAttribute("aria-disabled")).toBe("true");
  });

  it("경계: 연결 4명이면 활성, 3명이면 흐림", () => {
    const four = render(lobby(hostView(3)));
    expect(start(four.container)?.className).toContain("mf-act--primary");
    four.unmount();
    const three = render(lobby(hostView(2)));
    expect(start(three.container)?.className).toContain("mf-act--inactive");
  });

  it("3명에서 4번째 사람이 연결되면 같은 버튼이 '4 / 8' 활성으로 바뀌고 누르면 start 를 보낸다", () => {
    const send = vi.fn();
    const { container, rerender } = render(lobby(hostView(2), { send }));
    expect(countText(container)).toBe("3 / 8");
    expect(start(container)?.getAttribute("aria-disabled")).toBe("true");
    rerender(lobby(hostView(3), { send }));
    expect(countText(container)).toBe("4 / 8");
    expect(start(container)?.getAttribute("aria-disabled")).toBeNull();
    expect(start(container)?.className).toContain("mf-act--primary");
    fireEvent.click(start(container)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "start", tutorial: true });
  });

  it("canSend 가 거짓이면 눌러도 start 를 보내지 않고 알림도 없다", () => {
    const send = vi.fn();
    const { container } = render(lobby(hostView(4), { send, canSend: false }));
    expect(start(container)?.className).toContain("mf-act--inactive");
    fireEvent.click(start(container)!);
    expect(send).not.toHaveBeenCalled();
    expect(toastText(container)).toBe("");
  });

  it("손님: 평평한 비활성 '방장을 기다리는 중…' 하나뿐 — 시작 버튼·숫자·공유 줄은 없다", () => {
    const view = makeView([player(0, "민수"), player(1, "서준"), player(2, "하윤")], 1);
    const { container } = render(lobby(view));
    const b = screen.getByRole("button", { name: "방장을 기다리는 중…" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.className).toContain("mf-act--flat");
    expect(container.querySelector("[data-lobby-start]") === null).toBe(true);
    expect(container.querySelector(".mv-count") === null).toBe(true);
    // 패널 안 버튼은 채팅 보내기(07-13)·동작 버튼(10-05)과 이 행동 줄 하나뿐이다
    expect(container.querySelectorAll(".mf-lobby__panel button:not([data-chat-send]):not([data-chat-open]):not([data-emote-button]):not([data-tutorial-toggle])").length).toBe(1);
  });

  it("손님 화면에서 방장이 끊겨 있어도 같은 라벨이다", () => {
    render(lobby(makeView([player(0, "민수", { connected: false }), player(1, "서준")], 1)));
    expect(screen.getByRole("button", { name: "방장을 기다리는 중…" })).toBeTruthy();
  });

  it("시작이 거절된 뒤 같은 view 가 다시 와도 같은 모양이다(화면이 따로 상태를 기억하지 않는다)", () => {
    const v = hostView(3);
    const { container, rerender } = render(lobby(v));
    rerender(lobby({ ...v, serverNow: 5 }));
    expect(start(container)?.className).toContain("mf-act--primary");
    expect(countText(container)).toBe("4 / 8");
  });
});

describe("Lobby — 알림은 TopToast 하나 (D-10, CONN-04 WR-03)", () => {
  const base = [player(0, "민수"), player(1, "서준")];

  it("처음 render 에는 알림이 없고, StrictMode 이중 effect 에서도 없다", () => {
    const { container } = render(<StrictMode>{lobby(makeView(base, 0))}</StrictMode>);
    expect(toastText(container)).toBe("");
    expect(toastOn(container)).toBe(false);
  });

  it("같은 epoch 로 하윤이 더해진 view 가 오면 알림 '하윤 님 입장' 이 켜졌다 1.5초 뒤 사라진다", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0 }));
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 0 }));
    expect(toastText(container)).toBe("하윤 님 입장");
    expect(toastOn(container)).toBe(true);
    advance(1499);
    expect(toastOn(container)).toBe(true);
    advance(1);
    expect(toastOn(container)).toBe(false);
    advance(300);
    expect(toastText(container)).toBe("");
  });

  it("알림은 한 번에 하나다: 새 알림이 이전 알림을 바꾼다", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0 }));
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 0 }));
    rerender(lobby(makeView([...base, player(2, "하윤"), player(3, "지아")], 0), { epoch: 0 }));
    expect(container.querySelectorAll(".mv-toast").length).toBe(1);
    expect(toastText(container)).toBe("지아 님 입장");
  });

  it("epoch 를 바꾸며 사람이 더해진 view 를 주면(재연결 직후) 알림이 없다", () => {
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0 }));
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 1 }));
    expect(toastText(container)).toBe("");
  });

  it("재연결 뒤 같은 epoch 의 다음 변화에는 다시 알림이 난다", () => {
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0 }));
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 1 }));
    rerender(lobby(makeView([...base, player(2, "하윤"), player(3, "지아")], 0), { epoch: 1 }));
    expect(toastText(container)).toBe("지아 님 입장");
  });

  it("방장이 바뀌면 왕관 아이콘과 함께 '방장 · 서준'", () => {
    const { container, rerender } = render(lobby(makeView(base, 0)));
    rerender(lobby(makeView([player(0, "민수", { isHost: false }), player(1, "서준", { isHost: true })], 0)));
    expect(toastText(container)).toBe("방장 · 서준");
    expect(container.querySelector(".mv-toast svg") !== null).toBe(true);
  });

  it("입장 알림에는 아이콘이 없다", () => {
    const { container, rerender } = render(lobby(makeView(base, 0)));
    rerender(lobby(makeView([...base, player(2, "하윤")], 0)));
    expect(toastText(container)).toBe("하윤 님 입장");
    expect(container.querySelector(".mv-toast svg") === null).toBe(true);
  });

  it("같은 epoch 에서 한 명이 빠진 view 는 '영희 님 퇴장'", () => {
    const three = [player(0, "민수"), player(1, "서준"), player(2, "영희")];
    const { container, rerender } = render(lobby(makeView(three, 0)));
    rerender(lobby(makeView([player(0, "민수"), player(1, "서준")], 0)));
    expect(toastText(container)).toBe("영희 님 퇴장");
  });

  it("같은 변화에 입장과 방장 변경이 함께면 방장 변경을 보인다", () => {
    const { container, rerender } = render(lobby(makeView(base, 0)));
    rerender(lobby(makeView([player(0, "민수", { isHost: false }), player(1, "서준", { isHost: true }), player(2, "하윤")], 0)));
    expect(toastText(container)).toBe("방장 · 서준");
  });

  it("나 자신이 새로 앉은 변화에는 알림이 없다", () => {
    const { container, rerender } = render(lobby(makeView([player(0, "민수")], 0)));
    rerender(lobby(makeView([player(0, "민수"), player(1, "서준")], 1)));
    expect(toastText(container)).toBe("");
  });

  it("재접속 띠가 떠 있는 동안(bannerVisible)에는 알림을 띄우지 않고, 띠가 사라진 뒤 다음 변화부터 알린다", () => {
    const { container, rerender } = render(lobby(makeView(base, 0), { epoch: 0, bannerVisible: true }));
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 0, bannerVisible: true }));
    expect(toastText(container)).toBe("");
    // 띠가 사라져도 그 사이 일은 기준선으로 들어가 뒤늦게 알리지 않는다
    rerender(lobby(makeView([...base, player(2, "하윤")], 0), { epoch: 0, bannerVisible: false }));
    expect(toastText(container)).toBe("");
    rerender(lobby(makeView([...base, player(2, "하윤"), player(3, "지아")], 0), { epoch: 0, bannerVisible: false }));
    expect(toastText(container)).toBe("지아 님 입장");
  });

  it("맵이 알리는 글(onNotice)도 같은 알림 자리에 뜬다", () => {
    const { container } = render(lobby(makeView(base, 0)));
    act(() => props().onNotice("가는 길을 다시 찾고 있어요"));
    expect(toastText(container)).toBe("가는 길을 다시 찾고 있어요");
  });
});

describe("Lobby — [나가기] 로 방 나가기 (D-17, WR-01)", () => {
  const lobbyView = makeView([player(0, "민수"), player(1, "서준"), player(2, "하윤")], 0);
  const leaveButton = () => screen.getByRole("button", { name: "나가기" }) as HTMLButtonElement;
  const sheet = () => screen.getByRole("dialog", { name: "방에서 나갈까요?" });

  it("헤더에 [나가기](aria-label) 아이콘 버튼이 있고 시트는 닫혀 있다", () => {
    render(lobby(lobbyView));
    expect(leaveButton()).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("[나가기] → '방에서 나갈까요?' → 시트의 [나가기] → send leave 와 onLeave 가 각각 한 번", () => {
    const send = vi.fn();
    const onLeave = vi.fn();
    render(lobby(lobbyView, { send, onLeave }));
    fireEvent.click(leaveButton());
    expect(screen.getByRole("heading", { name: "방에서 나갈까요?" })).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(within(sheet()).getByRole("button", { name: "나가기" }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "leave" });
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("[취소] 는 아무것도 보내지 않고 시트가 닫힌다", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const onLeave = vi.fn();
    render(lobby(lobbyView, { send, onLeave }));
    fireEvent.click(leaveButton());
    fireEvent.click(within(sheet()).getByRole("button", { name: "취소" }));
    advance(260);
    expect(send).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("canSend 가 거짓이면 [나가기] 아이콘 버튼이 꺼진다", () => {
    render(lobby(lobbyView, { canSend: false }));
    expect(leaveButton().disabled).toBe(true);
  });

  it("시트를 연 뒤 연결이 끊기면 시트의 [나가기] 가 꺼져 leave 가 사라진 채 나가지 않는다 (WR-01)", () => {
    const send = vi.fn();
    const onLeave = vi.fn();
    const { rerender } = render(lobby(lobbyView, { send, onLeave, canSend: true }));
    fireEvent.click(leaveButton());
    rerender(lobby(lobbyView, { send, onLeave, canSend: false }));
    const confirm = within(sheet()).getByRole("button", { name: "나가기" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(send).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("send 가 false 를 돌려주면(소켓이 이미 닫힘) onLeave 를 부르지 않고 알림 '연결이 불안정해요. 다시 시도해 주세요' (WR-01)", () => {
    const send = vi.fn(() => false);
    const onLeave = vi.fn();
    const { container } = render(lobby(lobbyView, { send, onLeave }));
    fireEvent.click(leaveButton());
    fireEvent.click(within(sheet()).getByRole("button", { name: "나가기" }));
    expect(send).toHaveBeenCalledWith({ t: "leave" });
    expect(onLeave).not.toHaveBeenCalled();
    expect(toastText(container)).toBe("연결이 불안정해요. 다시 시도해 주세요");
  });

  it("send 가 false 인데 재접속 띠가 떠 있어도 이 알림은 막히지 않는다(내가 누른 일의 답이다)", () => {
    const send = vi.fn(() => false);
    const { container } = render(lobby(lobbyView, { send, bannerVisible: true }));
    fireEvent.click(leaveButton());
    fireEvent.click(within(sheet()).getByRole("button", { name: "나가기" }));
    expect(toastText(container)).toBe("연결이 불안정해요. 다시 시도해 주세요");
  });

  it("참가자(방장 아님) 화면에서도 나갈 수 있다", () => {
    const send = vi.fn();
    render(lobby(makeView([player(0, "민수"), player(1, "서준")], 1), { send }));
    fireEvent.click(leaveButton());
    fireEvent.click(within(sheet()).getByRole("button", { name: "나가기" }));
    expect(send).toHaveBeenCalledWith({ t: "leave" });
  });

  it("맵 상태 카드의 [나가기](WorldStage onLeave)도 같은 확인 시트로 간다", () => {
    render(lobby(lobbyView));
    act(() => props().onLeave());
    expect(sheet()).toBeTruthy();
  });
});

describe("Lobby — 공유 시트와 끊긴 사람 내보내기 (ROOM-01, D-16)", () => {
  const shareDialog = () => screen.getByRole("dialog", { name: "친구 초대하기" });

  it("헤더 [공유](aria-label) → '친구 초대하기' 시트(방 코드는 여기서만 보임), 방장도 참가자도 같다", () => {
    for (const mySeat of [0, 1]) {
      const { unmount } = render(lobby(makeView([player(0, "민수"), player(1, "서준")], mySeat)));
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "공유" }));
      expect(within(shareDialog()).getByText("0042")).toBeTruthy();
      expect(within(shareDialog()).getByRole("heading", { name: "친구 초대하기" })).toBeTruthy();
      unmount();
    }
  });

  it("공유 시트의 링크 칸은 {origin}/r/{코드} 이다", () => {
    render(lobby(makeView([player(0, "민수")], 0)));
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    const input = within(shareDialog()).getByLabelText("초대 링크") as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/r/0042`);
  });

  it("자리 8개가 차면 공유 시트에 '방이 가득 찼어요'", () => {
    const players = Array.from({ length: 8 }, (_, i) => player(i, `친구${i}`));
    render(lobby(makeView(players, 0)));
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    expect(within(shareDialog()).getByText("방이 가득 찼어요")).toBeTruthy();
  });

  const kickDialog = () => screen.getByRole("dialog", { name: "서준님을 내보낼까요?" });

  it("이름표의 내보내기(onKick 2, 영희) → '영희님을 내보낼까요?' → [내보내기] → send kick seat 2", () => {
    const send = vi.fn();
    render(lobby(makeView([player(0, "민수"), player(1, "서준"), player(2, "영희", { connected: false })], 0), { send }));
    act(() => props().onKick!(2, "영희"));
    expect(screen.getByRole("heading", { name: "영희님을 내보낼까요?" })).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog", { name: "영희님을 내보낼까요?" })).getByRole("button", { name: "내보내기" }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "kick", seat: 2 });
  });

  it("[취소] 하면 kick 을 보내지 않는다", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    render(lobby(makeView([player(0, "민수"), player(1, "서준", { connected: false })], 0), { send }));
    act(() => props().onKick!(1, "서준"));
    fireEvent.click(within(kickDialog()).getByRole("button", { name: "취소" }));
    advance(260);
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("canSend 가 거짓이면 시트의 [내보내기] 가 꺼진다", () => {
    const send = vi.fn();
    render(lobby(makeView([player(0, "민수"), player(1, "서준", { connected: false })], 0), { send, canSend: false }));
    act(() => props().onKick!(1, "서준"));
    const confirm = within(kickDialog()).getByRole("button", { name: "내보내기" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it("누른 시점의 닉네임을 쥐고 있어, 그사이 view 가 바뀌어도 제목이 흔들리지 않는다", () => {
    const players = [player(0, "민수"), player(1, "서준", { connected: false })];
    const { rerender } = render(lobby(makeView(players, 0)));
    act(() => props().onKick!(1, "서준"));
    rerender(lobby(makeView([players[0]!, player(1, "서준")], 0)));
    expect(kickDialog()).toBeTruthy();
  });

  it("내보낼 사람의 닉네임이 길어도 말줄임 없이 제목에 그대로 들어간다", () => {
    const long = "가나다라마바사아";
    render(lobby(makeView([player(0, "민수"), player(1, long, { connected: false })], 0)));
    act(() => props().onKick!(1, long));
    expect(screen.getByRole("heading", { name: `${long}님을 내보낼까요?` })).toBeTruthy();
  });
});

describe("Lobby — 스타일 계약 (lobby.css)", () => {
  const css = readFileSync("src/styles/lobby.css", "utf8");

  it("위쪽 가림막: night-900 88% → 70px 에서 60% → 120px 에서 0", () => {
    expect(css).toMatch(/\.mf-lobby__scrim[^}]*88%/);
    expect(css).toMatch(/\.mf-lobby__scrim[^}]*60%[^}]*70px/);
    expect(css).toMatch(/\.mf-lobby__scrim[^}]*120px/);
  });

  it("아래 패널: night-800 97%·위 모서리 radius-lg", () => {
    expect(css).toMatch(/\.mf-lobby__panel[^}]*var\(--night-800\)\s+97%/);
    expect(css).toMatch(/\.mf-lobby__panel[^}]*var\(--radius-lg\)\s+var\(--radius-lg\)\s+0\s+0/);
  });

  it("아래 패널 안쪽 여백은 14 16 22, 항목 간격 10 — 기록 LOG_H + 입력줄 48 + 행동 줄 52 라 높이 LOG_H + 154 (07-13, 6페이즈 때는 행동 줄 하나라 88)", () => {
    const rule = css.match(/\.mf-lobby__panel\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("padding: 14px var(--space-md) 22px");
    expect(rule).toContain("gap: 10px");
    expect(14 + 8 + 48 + 10 + 52 + 22).toBe(LOBBY_PANEL_EXTRA);
  });

  it("헤더: 위 18·좌우 space-md·높이 62(윗여백 8 + 이름표 단추), 맵 탭을 가로채지 않는다 (stageBox 의 옛 대기실 바 119.2 검사를 대신한다)", () => {
    const rule = css.match(/\.mf-lobby__header\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("height: 62px");
    expect(rule).toContain("padding: var(--space-sm) var(--space-md) 0"); // 14-07: 이름표 단추(약 57)가 들어가도록 윗여백을 토큰 간격 8 로
    expect(rule).toContain("pointer-events: none");
    expect(rule).not.toContain("overflow"); // 단추 아랫변(8 + 약 57)이 62 를 넘어도 자르지 않고, HostBand 가 단추 아랫변까지 재서 띠를 붙인다
  });

  it("[테스트] 자리는 자막 띠 아래 8(띠 없을 때 기본 62 + 8 = 70)·왼쪽 space-md·z-overlay (14-01 U-1)", () => {
    const rule = css.match(/\.mf-lobby__test\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("top: calc(var(--mf-host-bottom, 62px) + 8px)");
    expect(rule).toContain("left: var(--space-md)");
    expect(rule).toContain("var(--z-overlay)");
  });

  it("떠 있는 재접속 띠: 헤더 아래 top 72, 가로 전체, z-overlay — 흐름을 밀지 않는다", () => {
    const rule = css.match(/\.mf-reconnect--floating\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("top: 72px");
    expect(rule).toContain("left: 0");
    expect(rule).toContain("right: 0");
    expect(rule).toContain("var(--z-overlay)");
  });

  it("로비 UI 에는 진홍·놋쇠·색 직접 지정이 없다(따뜻한 빛은 3D 장면 안에서만)", () => {
    expect(css).not.toMatch(/crimson|brass|amber|#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("옛 대기실 규칙(방 코드 36px·장면 상자·시트 157)은 남아 있지 않다", () => {
    expect(css).not.toMatch(/mf-lobby__code|mf-lobby__scene|mf-lobby__sheet|mf-lobby__bar/);
  });
});

// ---------- 07-19: 키보드 배치 (CHAT-05, UI-SPEC 패널과 키보드, 사용자 확정 D3) ----------

describe("Lobby — 키보드가 열리면 패널이 올라가고 행동 줄이 숨는다 (CHAT-05, D3)", () => {
  const INNER_H = 844;
  const realInnerH = window.innerHeight;
  const lobbyView = makeView([player(0, "민수"), player(1, "서준")], 0);
  let panelH = lobbyPanelHeight(LOG_H);
  let resizeCallbacks: Array<() => void> = [];

  interface FakeVV extends EventTarget {
    height: number;
    offsetTop: number;
  }
  const installVV = (height: number, offsetTop = 0): FakeVV => {
    const vv = Object.assign(new EventTarget(), { height, offsetTop }) as FakeVV;
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
    return vv;
  };
  /** 패널·헤더의 높이를 DOM 대신 값으로 돌려준다(happy-dom 은 레이아웃이 없다). 패널 높이는 panelH 변수가 정한다 */
  const stubLayout = () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mf-lobby__panel")) return panelH;
      if (this.classList.contains("mf-lobby__header")) return 62;
      return 0;
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resizeCallbacks.push(cb);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  };
  const remeasure = () => act(() => void resizeCallbacks.forEach((cb) => cb()));
  const inputOf = (container: HTMLElement) => container.querySelector("[data-chat-input]") as HTMLInputElement;
  const rootOf = (container: HTMLElement) => container.querySelector("main.mf-lobby") as HTMLElement;
  const actionButtons = (container: HTMLElement) => container.querySelectorAll(".mf-lobby__panel button:not([data-chat-send]):not([data-chat-open]):not([data-emote-button]):not([data-tutorial-toggle])").length;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerHeight", { value: INNER_H, configurable: true, writable: true });
    panelH = lobbyPanelHeight(LOG_H);
    resizeCallbacks = [];
    stubLayout();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", { value: realInnerH, configurable: true, writable: true });
    Reflect.deleteProperty(window, "visualViewport");
  });

  /** 입력칸에 포커스를 주고 키보드 높이 lift 만큼 visualViewport 를 줄인다 */
  const focusWithKeyboard = (container: HTMLElement, vv: FakeVV, lift: number, offsetTop = 0) => {
    act(() => inputOf(container).focus());
    vv.height = INNER_H - lift - offsetTop;
    vv.offsetTop = offsetTop;
    act(() => void vv.dispatchEvent(new Event("resize")));
    advance(20);
  };

  const openLog = (c: HTMLElement) => (c.querySelector("[data-chat-log]") as HTMLElement).classList.contains("is-open") && (c.querySelector("[data-chat-log]") as HTMLElement).style.height === "";

  it("포커스 + lift 336: 루트 data-kb-open true, 행동 줄 없음, 기록 칸 68, 패널 --kb, 스테이지 아래 = 146 + 336", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    expect(props().stageInsets).toEqual({ top: 62, bottom: lobbyPanelHeight(LOG_H) });
    expect(actionButtons(container)).toBe(1);
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL;
    remeasure();
    expect(rootOf(container).getAttribute("data-kb-open")).toBe("true");
    expect(rootOf(container).style.getPropertyValue("--mf-kb-lift")).toBe("336px");
    expect(actionButtons(container)).toBe(0);
    // 포커스가 기록 칸을 늘린다(0083-4): 인라인 높이 없이 CSS 식이 높이를 정한다
    expect(openLog(container)).toBe(true);
    expect(container.querySelector(".mv-chat.is-compact")).not.toBeNull();
    expect(container.querySelector(".mf-lobby__panel")?.classList.contains("mf-lobby__panel--kb")).toBe(true);
    expect(props().stageInsets).toEqual({ top: 62, bottom: KB_PANEL + 336 });
  });

  it("lift 가 바뀌면(키보드 높이 340) 다시 그리지 않아도 스테이지 아래 끝이 따라간다", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL;
    remeasure();
    vv.height = INNER_H - 340;
    act(() => void vv.dispatchEvent(new Event("resize")));
    advance(20);
    expect(props().stageInsets?.bottom).toBe(KB_PANEL + 340);
  });

  it("포커스 중 lift 60(열림 경계 80 아래): data-kb-open 없음, 행동 줄 있음, 기록 칸은 포커스로 늘어남", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    focusWithKeyboard(container, vv, 60);
    expect(rootOf(container).hasAttribute("data-kb-open")).toBe(false);
    expect(actionButtons(container)).toBe(1);
    expect(openLog(container)).toBe(true);
    expect(container.querySelector(".mf-lobby__panel")?.classList.contains("mf-lobby__panel--kb")).toBe(false);
  });

  it("블러하면 원래대로: data-kb-open 없음, 행동 줄 복귀, 기록 칸은 접지 않고 늘어난 채(닫기는 단추 하나), 스테이지 아래 = 원래 패널 높이", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL;
    remeasure();
    act(() => inputOf(container).blur());
    panelH = lobbyPanelHeight(LOG_H);
    remeasure();
    expect(rootOf(container).hasAttribute("data-kb-open")).toBe(false);
    expect(rootOf(container).style.getPropertyValue("--mf-kb-lift")).toBe("0px");
    expect(actionButtons(container)).toBe(1);
    expect(openLog(container)).toBe(true);
    expect(props().stageInsets).toEqual({ top: 62, bottom: lobbyPanelHeight(LOG_H) });
  });

  it("vv.offsetTop 120 이면 --mf-vv-top 120px 가 쓰인다(헤더 계열이 이 값만큼 내려온다)", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    focusWithKeyboard(container, vv, 336, 120);
    expect(rootOf(container).style.getPropertyValue("--mf-vv-top")).toBe("120px");
  });

  it("키보드가 열려도 창 스크롤을 억지로 되돌리지 않는다(window.scrollTo 호출 없음)", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    focusWithKeyboard(container, vv, 336, 120);
    act(() => inputOf(container).blur());
    advance(1100);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("Lobby — 키보드 배치 스타일 계약 (lobby.css, room.css)", () => {
  const lobbyCss = readFileSync("src/styles/lobby.css", "utf8");
  const roomCss = readFileSync("src/styles/room.css", "utf8");

  it("패널 --kb: bottom 이 --mf-kb-lift, 아래 여백 8", () => {
    const rule = lobbyCss.match(/\.mf-lobby__panel--kb\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("bottom: var(--mf-kb-lift, 0px)");
    expect(rule).toContain("padding-bottom: 8px");
  });

  it("헤더·위 알림·재접속 띠(떠 있는 변형)는 translateY(var(--mf-vv-top)) 로 보이는 영역 맨 위에 머문다", () => {
    for (const sel of [".mf-lobby__header", ".mf-lobby .mv-toast", ".mf-reconnect--floating"]) {
      const rule = lobbyCss.split("}").find((r) => r.includes(sel) && r.includes("translateY(var(--mf-vv-top")) ?? "";
      expect(rule, sel).not.toBe("");
    }
  });

  it("방 높이는 --mf-room-h(px) 를 쓰고, 값이 없을 때만 100dvh 식이다", () => {
    const rule = roomCss.match(/\.mf-room\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("height: var(--mf-room-h, calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom)))");
  });
});

// ---- 08-13: 측정·키보드는 로비와 게임 맵이 한 훅을 쓴다 ----
describe("Lobby — 측정·키보드 코드는 useMapInsets 훅 하나다 (08-13)", () => {
  it("훅 파일이 있고 Lobby 가 그 훅을 쓰며 ResizeObserver·useKeyboardLift 를 직접 부르지 않는다", () => {
    const hook = readFileSync("src/net/useMapInsets.ts", "utf8");
    expect(hook).toContain("export function useMapInsets");
    const src = readFileSync("src/screens/Lobby.tsx", "utf8");
    expect(src).toContain("useMapInsets(");
    expect(src).not.toContain("new ResizeObserver");
    expect(src).not.toContain("useKeyboardLift(");
  });
});

// ---------- 17-07 → 19-04: 방장 줄 토글 '튜토리얼 먼저' (TUT-02, 결정 0078-3·0080-1·3, D-10, P19-8·P19-12) ----------

describe("Lobby — 방장 줄 토글 '튜토리얼 먼저' (19-04, D-10, P19-8)", () => {
  /** 지운 옛 패널 스위치 줄의 클래스 머리(이름을 그대로 적지 않는다 — 남은 곳을 찾는 검색에 걸리지 않게) */
  const OLD_ROW = ["tut", "toggle"].join("-");
  const toggleOf = (container: HTMLElement) => container.querySelector("[data-tutorial-toggle]") as HTMLButtonElement | null;
  const checked = (container: HTMLElement) => toggleOf(container)?.getAttribute("aria-checked") ?? "없음";
  const startOf = (container: HTMLElement) => container.querySelector("[data-lobby-start]") as HTMLButtonElement;
  const hostPlayers = () => [player(0, "방장님"), player(1, "친구1"), player(2, "친구2"), player(3, "친구3")];
  const hostView = (extra: Partial<RoomView> = {}) => makeView(hostPlayers(), 0, { round: 1, ...extra });
  const sent = (send: { mock: { calls: unknown[][] } }) => JSON.stringify(send.mock.calls.map((c) => c[0]));

  it("방장(첫 판·일반 방·확장판): 방장 줄 맨 아래 토글 하나 — role switch·aria-checked true·이름 '튜토리얼 먼저'·보이는 글 없음, 아래 패널 안에는 없다", () => {
    const { container } = render(lobby(hostView()));
    expect(container.querySelectorAll("[data-tutorial-toggle]")).toHaveLength(1);
    const t = toggleOf(container)!;
    expect(t.getAttribute("data-host-rail-btn")).toBe("tutorial");
    expect(t.closest("[data-host-rail]") !== null).toBe(true);
    expect(t.closest(".mf-hostrail__col")?.lastElementChild === t).toBe(true);
    expect(t.getAttribute("role")).toBe("switch");
    expect(t.getAttribute("aria-checked")).toBe("true");
    expect(t.getAttribute("aria-label")).toBe("튜토리얼 먼저");
    expect(t.textContent).toBe("");
    const panel = container.querySelector(".mf-lobby__panel")!;
    expect(panel.contains(t)).toBe(false);
    expect(panel.querySelectorAll(`[class*="${OLD_ROW}"], [role="switch"]`)).toHaveLength(0);
  });

  it("방장 패널 = 참가자 패널: 채팅(기록 칸 + 입력줄) + 행동 줄 두 자식뿐이고 첫 자식이 채팅이다 (P19-12)", () => {
    const shape = (mySeat: number) => {
      const { container, unmount } = render(lobby(makeView(hostPlayers(), mySeat, { round: 1 })));
      const panel = container.querySelector(".mf-lobby__panel")!;
      const out = `${panel.children.length}:${panel.firstElementChild?.hasAttribute("data-chat-panel") ? "chat" : "other"}`;
      unmount();
      return out;
    };
    expect(shape(0)).toBe("2:chat");
    expect(shape(1)).toBe("2:chat");
  });

  it("테스트 방 방장(me.testMode)은 꺼짐으로 시작하고 토글은 보인다", () => {
    const view = hostView();
    const { container } = render(lobby({ ...view, me: { ...view.me, testMode: true } }));
    expect(checked(container)).toBe("false");
  });

  it("두 번째 판(round 2)은 꺼짐으로 시작한다", () => {
    const { container } = render(lobby(hostView({ round: 2 })));
    expect(checked(container)).toBe("false");
  });

  it("참가자에게는 토글이 없다", () => {
    const { container } = render(lobby(makeView(hostPlayers(), 1, { round: 1 })));
    expect(container.querySelectorAll("[data-tutorial-toggle], [role='switch']")).toHaveLength(0);
  });

  it("누르면 켬 ↔ 끔이 바뀌고 알림 한 줄: '튜토리얼 껐어요' → '튜토리얼 먼저 켰어요'. 서버로는 아무것도 보내지 않는다 (P19-8, 0080-1)", () => {
    const send = vi.fn();
    const { container } = render(lobby(hostView(), { send }));
    expect(toastText(container)).toBe("");
    fireEvent.click(toggleOf(container)!);
    expect(checked(container)).toBe("false");
    expect(toastText(container)).toBe("튜토리얼 껐어요");
    expect(toastOn(container)).toBe(true);
    fireEvent.click(toggleOf(container)!);
    expect(checked(container)).toBe("true");
    expect(toastText(container)).toBe("튜토리얼 먼저 켰어요");
    expect(send).not.toHaveBeenCalled();
  });

  it("누를 때 누름 소리 신호(tap)를 한 번 낸다 — 옛 스위치 줄과 같다", () => {
    const kinds: string[] = [];
    const unbind = bindSignals((sig) => kinds.push(sig.kind));
    try {
      const { container } = render(lobby(hostView()));
      expect(container.querySelectorAll('[data-host-rail-btn="tutorial"]')).toHaveLength(1);
      fireEvent.click(toggleOf(container)!);
      expect(kinds.join(",")).toBe("tap");
    } finally {
      unbind();
    }
  });

  it("[시작]은 그 순간의 값을 싣는다 — 켬 {tutorial:true}, 끈 뒤 {tutorial:false}", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const on = render(lobby(hostView(), { send }));
    fireEvent.click(startOf(on.container));
    expect(sent(send)).toBe(JSON.stringify([{ t: "start", tutorial: true }]));
    on.unmount();
    send.mockClear();
    const off = render(lobby(hostView(), { send }));
    expect(off.container.querySelectorAll('[data-host-rail-btn="tutorial"]')).toHaveLength(1);
    fireEvent.click(toggleOf(off.container)!);
    fireEvent.click(startOf(off.container));
    expect(sent(send)).toBe(JSON.stringify([{ t: "start", tutorial: false }]));
  });

  it("기본 마피아: 토글이 DOM 에 없고 켜 둔 값이어도 [시작]은 {tutorial:false} 를 보낸다. 확장판으로 돌아오면 켜진 채 다시 보이고 {tutorial:true} (D-10, T-19-14)", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const { container, rerender } = render(lobby(hostView(), { send }));
    expect(checked(container)).toBe("true");
    rerender(lobby(hostView({ mode: "basic" }), { send }));
    expect(container.querySelectorAll("[data-tutorial-toggle], [role='switch']")).toHaveLength(0);
    fireEvent.click(startOf(container));
    expect(sent(send)).toBe(JSON.stringify([{ t: "start", tutorial: false }]));
    advance(2_000); // [시작] 잠금이 풀린다
    send.mockClear();
    rerender(lobby(hostView({ mode: "extended" }), { send }));
    expect(checked(container)).toBe("true");
    fireEvent.click(startOf(container));
    expect(sent(send)).toBe(JSON.stringify([{ t: "start", tutorial: true }]));
  });

  it("끈 값도 기본 마피아를 거쳐 그대로 돌아온다", () => {
    const { container, rerender } = render(lobby(hostView()));
    expect(container.querySelectorAll('[data-host-rail-btn="tutorial"]')).toHaveLength(1);
    fireEvent.click(toggleOf(container)!);
    rerender(lobby(hostView({ mode: "basic" })));
    expect(checked(container)).toBe("없음");
    rerender(lobby(hostView({ mode: "extended" })));
    expect(checked(container)).toBe("false");
  });

  it("연결이 끊겨 보낼 수 없으면(canSend 거짓) 토글이 aria-disabled 이고 눌러도 값·알림이 그대로다", () => {
    const { container } = render(lobby(hostView(), { canSend: false }));
    expect(toggleOf(container)?.getAttribute("aria-disabled") ?? "없음").toBe("true");
    fireEvent.click(toggleOf(container)!);
    expect(checked(container)).toBe("true");
    expect(toastText(container)).toBe("");
  });

  it("[시작] 잠금 2초 동안 토글은 aria-disabled 이고 눌러도 그대로다. 잠금이 풀리면 다시 눌린다", () => {
    vi.useFakeTimers();
    const { container } = render(lobby(hostView()));
    expect(toggleOf(container)?.getAttribute("aria-disabled") ?? "없음").toBe("없음");
    fireEvent.click(startOf(container));
    expect(toggleOf(container)?.getAttribute("aria-disabled") ?? "없음").toBe("true");
    fireEvent.click(toggleOf(container)!);
    expect(checked(container)).toBe("true");
    advance(2_000);
    expect(toggleOf(container)?.getAttribute("aria-disabled") ?? "없음").toBe("없음");
    fireEvent.click(toggleOf(container)!);
    expect(checked(container)).toBe("false");
  });

  it("키보드가 열리면 [시작]과 함께 토글도 숨는다", () => {
    const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
    const realInnerH = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
    vi.useFakeTimers();
    try {
      const { container } = render(lobby(hostView()));
      expect(toggleOf(container)).not.toBeNull();
      act(() => (container.querySelector("[data-chat-input]") as HTMLInputElement).focus());
      vv.height = 844 - 336;
      act(() => void vv.dispatchEvent(new Event("resize")));
      advance(20);
      expect(container.querySelector("main.mf-lobby")?.getAttribute("data-kb-open")).toBe("true");
      expect(toggleOf(container)).toBeNull();
      expect(container.querySelector("[data-lobby-start]")).toBeNull();
    } finally {
      Reflect.deleteProperty(window, "visualViewport");
      Object.defineProperty(window, "innerHeight", { value: realInnerH, configurable: true, writable: true });
    }
  });

  it("옛 패널 스위치 줄은 지웠다: 부품 파일·CSS 규칙이 없고 기다림 화면(.tut-wait) 규칙은 남는다", () => {
    const css = readFileSync("src/styles/tutorialRoom.css", "utf8");
    expect(css.split(OLD_ROW).length - 1).toBe(0);
    expect(css.includes(".tut-wait {")).toBe(true);
    expect(css.includes(".tut-wait__title")).toBe(true);
    const oldPart = `src/components/v2/${["Tutorial", "Toggle"].join("")}.tsx`;
    expect(existsSync(oldPart)).toBe(false);
    expect(readFileSync("src/screens/Lobby.tsx", "utf8").includes(["Tutorial", "Toggle"].join(""))).toBe(false);
  });
});

// 18-05(D-02): 로비 옷장 시트는 서버 view.players 에서 나를 뺀 "직접 고른 옷"을 잠근다
describe("Lobby — 옷장 잠금 (18-05, D-02)", () => {
  const openSheet = (container: HTMLElement) => {
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    return container.querySelector("[data-dress-sheet]") as HTMLElement;
  };

  it("다른 참가자가 직접 고른 hood 만 잠기고 look 없는 참가자의 기본 coat 는 잠기지 않는다", () => {
    const view = makeView([player(0, "민수"), player(1, "영희", { look: "hood" }), player(2, "서준")], 0);
    const { container } = render(lobby(view));
    const sheet = openSheet(container);
    const locked = [...sheet.querySelectorAll<HTMLElement>("[data-outfit][data-taken]")].map((c) => c.dataset.outfit);
    expect(locked).toEqual(["hood"]);
    expect(sheet.querySelector("[data-outfit='coat']")?.hasAttribute("data-taken")).toBe(false);
  });

  it("내 look 이 hood 이고 남도 hood 인 순간에도 내 카드는 잠기지 않는다", () => {
    const view = makeView([player(0, "민수", { look: "hood" }), player(1, "영희", { look: "hood" })], 0);
    const { container } = render(lobby(view));
    const sheet = openSheet(container);
    expect(sheet.querySelectorAll("[data-outfit][data-taken]")).toHaveLength(0);
    expect(sheet.querySelector("[data-outfit='hood']")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("남이 옷을 바꾸면 다음 방송에서 카드가 열리고 잠긴다", () => {
    const first = makeView([player(0, "민수"), player(1, "영희", { look: "hood" })], 0);
    const { container, rerender } = render(lobby(first));
    const sheet = openSheet(container);
    expect(sheet.querySelector("[data-outfit='hood']")?.hasAttribute("data-taken")).toBe(true);
    rerender(lobby(makeView([player(0, "민수"), player(1, "영희", { look: "noir" })], 0)));
    expect(sheet.querySelector("[data-outfit='hood']")?.hasAttribute("data-taken")).toBe(false);
    expect(sheet.querySelector("[data-outfit='noir']")?.hasAttribute("data-taken")).toBe(true);
  });
});
