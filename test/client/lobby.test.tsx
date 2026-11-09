import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { KB_PANEL_H, LOBBY_PANEL_EXTRA, LOG_H_KB, LOG_H_TALL, lobbyPanelHeight } from "../../src/game/chatUi";
import { ChatStore } from "../../src/net/chatStore";
import { WorldStore } from "../../src/world/store";

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

describe("Lobby — 오른쪽 한 줄 열: 방장 넷·손님 둘 (16-06 D-05, V-2·V-5)", () => {
  const players = [player(0, "민수"), player(1, "영희"), player(2, "서준")];
  const side = (c: ParentNode) => [...c.querySelectorAll("[data-side-column] [data-side-button]")].map((e) => e.getAttribute("data-side-button"));

  it("손님: 소리 자리 다음 [dress] 뿐이다 — 맵 칩·봇 단추가 없다 (T-16-13)", () => {
    const { container } = render(lobby(makeView(players, 2)));
    expect(side(container)).toEqual(["dress"]);
    expect(container.querySelector("[data-map-chip], [data-float='bots']")).toBeNull();
    expect(container.querySelectorAll("[data-side-column]")).toHaveLength(1);
    expect(container.querySelector(".mv-side__col")!.firstElementChild!.classList.contains("mv-side__slot")).toBe(true);
  });

  it("방장 + 봇 도구가 켜진 방: [bots, dress] 순서(맵이 켜지면 맵이 맨 위)이고 열 밖에 떠 있는 단추 묶음이 없다", () => {
    const view = makeView(players, 0);
    view.me = { ...view.me, testBots: 0 };
    const { container } = render(lobby(view));
    expect(side(container)).toEqual(expect.arrayContaining(["bots", "dress"]));
    expect(side(container).indexOf("bots")).toBeLessThan(side(container).indexOf("dress"));
    expect(container.querySelector("[data-float-stack]")).toBeNull();
    for (const b of container.querySelectorAll("[data-side-button]")) {
      expect(b.textContent).toBe(""); // 글 없음(접근성 이름만)
      expect(b.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("방장도 봇 도구가 없으면(testBots 없음) 봇 단추가 없다", () => {
    const { container } = render(lobby(makeView(players, 0)));
    expect(side(container)).not.toContain("bots");
    expect(side(container)).toContain("dress");
  });

  it("꾸미기 시트가 열려 있는 동안 열을 그리지 않는다", () => {
    const { container } = render(lobby(makeView(players, 2)));
    fireEvent.click(screen.getByRole("button", { name: "옷장" }));
    expect(container.querySelector("[data-side-column]")).toBeNull();
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

  it("기록 칸 높이는 방 높이로 한 번 정한 값이다(780 미만 96)", () => {
    const { container } = render(lobby(makeView(base, 0)));
    const log = container.querySelector("[data-chat-log]") as HTMLElement;
    expect(log.style.height).toBe("96px");
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
    expect(container.querySelectorAll(".mf-lobby__panel button:not([data-chat-send]):not([data-emote-button]):not([data-tutorial-toggle])").length).toBe(1);
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
  let panelH = lobbyPanelHeight(LOG_H_TALL);
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
  const actionButtons = (container: HTMLElement) => container.querySelectorAll(".mf-lobby__panel button:not([data-chat-send]):not([data-emote-button]):not([data-tutorial-toggle])").length;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerHeight", { value: INNER_H, configurable: true, writable: true });
    panelH = lobbyPanelHeight(LOG_H_TALL);
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

  it("포커스 + lift 336: 루트 data-kb-open true, 행동 줄 없음, 기록 칸 72, 패널 --kb, 스테이지 아래 = 150 + 336", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    expect(props().stageInsets).toEqual({ top: 62, bottom: lobbyPanelHeight(LOG_H_TALL) });
    expect(actionButtons(container)).toBe(1);
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL_H;
    remeasure();
    expect(rootOf(container).getAttribute("data-kb-open")).toBe("true");
    expect(rootOf(container).style.getPropertyValue("--mf-kb-lift")).toBe("336px");
    expect(actionButtons(container)).toBe(0);
    expect((container.querySelector("[data-chat-log]") as HTMLElement).style.height).toBe(`${LOG_H_KB}px`);
    expect(container.querySelector(".mv-chat.is-compact")).not.toBeNull();
    expect(container.querySelector(".mf-lobby__panel")?.classList.contains("mf-lobby__panel--kb")).toBe(true);
    expect(props().stageInsets).toEqual({ top: 62, bottom: KB_PANEL_H + 336 });
  });

  it("lift 가 바뀌면(키보드 높이 340) 다시 그리지 않아도 스테이지 아래 끝이 따라간다", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL_H;
    remeasure();
    vv.height = INNER_H - 340;
    act(() => void vv.dispatchEvent(new Event("resize")));
    advance(20);
    expect(props().stageInsets?.bottom).toBe(KB_PANEL_H + 340);
  });

  it("포커스 중 lift 60(열림 경계 80 아래): data-kb-open 없음, 행동 줄 있음, 기록 칸 그대로", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    focusWithKeyboard(container, vv, 60);
    expect(rootOf(container).hasAttribute("data-kb-open")).toBe(false);
    expect(actionButtons(container)).toBe(1);
    expect((container.querySelector("[data-chat-log]") as HTMLElement).style.height).toBe(`${LOG_H_TALL}px`);
    expect(container.querySelector(".mf-lobby__panel")?.classList.contains("mf-lobby__panel--kb")).toBe(false);
  });

  it("블러하면 원래대로: data-kb-open 없음, 행동 줄 복귀, 기록 칸 원래 값, 스테이지 아래 = 원래 패널 높이", () => {
    const vv = installVV(INNER_H);
    const { container } = render(lobby(lobbyView));
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL_H;
    remeasure();
    act(() => inputOf(container).blur());
    panelH = lobbyPanelHeight(LOG_H_TALL);
    remeasure();
    expect(rootOf(container).hasAttribute("data-kb-open")).toBe(false);
    expect(rootOf(container).style.getPropertyValue("--mf-kb-lift")).toBe("0px");
    expect(actionButtons(container)).toBe(1);
    expect((container.querySelector("[data-chat-log]") as HTMLElement).style.height).toBe(`${LOG_H_TALL}px`);
    expect(props().stageInsets).toEqual({ top: 62, bottom: lobbyPanelHeight(LOG_H_TALL) });
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

// ---------- 17-07: 방장 스위치 줄 '튜토리얼 후 진행' (TUT-02, 결정 0078-3·0080-1·3, UI Considerations #16) ----------

describe("Lobby — 방장 스위치 줄 '튜토리얼 후 진행' (17-07, TUT-02)", () => {
  const toggleOf = (container: HTMLElement) => container.querySelector("[data-tutorial-toggle]") as HTMLButtonElement | null;
  const startOf = (container: HTMLElement) => container.querySelector("[data-lobby-start]") as HTMLButtonElement;
  const hostPlayers = () => [player(0, "방장님"), player(1, "친구1"), player(2, "친구2"), player(3, "친구3")];

  it("방장(첫 판·일반 방): 스위치 줄 하나, role switch·aria-checked true·aria-label, [시작] 바로 위(같은 패널 안)", () => {
    const { container } = render(lobby(makeView(hostPlayers(), 0, { round: 1 })));
    const all = container.querySelectorAll("[data-tutorial-toggle]");
    expect(all).toHaveLength(1);
    const t = toggleOf(container)!;
    expect(t.getAttribute("role")).toBe("switch");
    expect(t.getAttribute("aria-checked")).toBe("true");
    expect(t.getAttribute("aria-label")).toBe("튜토리얼 후 진행");
    expect(t.textContent).toContain("튜토리얼 후 진행");
    expect(t.textContent).toContain("모두 1분 보고 시작");
    const panel = container.querySelector(".mf-lobby__panel")!;
    expect(panel.contains(t)).toBe(true);
    expect(t.compareDocumentPosition(startOf(container)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("테스트 방 방장(me.testMode)은 꺼짐으로 시작하고 줄은 보인다", () => {
    const view = makeView(hostPlayers(), 0, { round: 1 });
    const { container } = render(lobby({ ...view, me: { ...view.me, testMode: true } }));
    expect(toggleOf(container)?.getAttribute("aria-checked")).toBe("false");
  });

  it("두 번째 판(round 2)은 꺼짐으로 시작한다", () => {
    const { container } = render(lobby(makeView(hostPlayers(), 0, { round: 2 })));
    expect(toggleOf(container)?.getAttribute("aria-checked")).toBe("false");
  });

  it("손님에게는 줄이 없다", () => {
    const { container } = render(lobby(makeView(hostPlayers(), 1, { round: 1 })));
    expect(container.querySelectorAll("[data-tutorial-toggle]")).toHaveLength(0);
  });

  it("누르면 켬 ↔ 끔이 바뀌고 [시작]은 그 값을 싣는다 — 켬 {tutorial:true}, 끈 뒤 {tutorial:false}", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const on = render(lobby(makeView(hostPlayers(), 0, { round: 1 }), { send }));
    fireEvent.click(startOf(on.container));
    expect(send).toHaveBeenLastCalledWith({ t: "start", tutorial: true });
    on.unmount();
    send.mockClear();
    const off = render(lobby(makeView(hostPlayers(), 0, { round: 1 }), { send }));
    fireEvent.click(toggleOf(off.container)!);
    expect(toggleOf(off.container)?.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(startOf(off.container));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ t: "start", tutorial: false });
  });

  it("스위치는 서버로 아무것도 보내지 않는다(값은 [시작] 순간에만 간다, 0080-1)", () => {
    const send = vi.fn();
    const { container } = render(lobby(makeView(hostPlayers(), 0, { round: 1 }), { send }));
    fireEvent.click(toggleOf(container)!);
    fireEvent.click(toggleOf(container)!);
    expect(send).not.toHaveBeenCalled();
  });

  it("연결이 끊겨 보낼 수 없으면(canSend 거짓) 스위치가 disabled 이고 눌러도 바뀌지 않는다", () => {
    const { container } = render(lobby(makeView(hostPlayers(), 0, { round: 1 }), { canSend: false }));
    const t = toggleOf(container)!;
    expect(t.disabled).toBe(true);
    fireEvent.click(t);
    expect(t.getAttribute("aria-checked")).toBe("true");
  });

  it("키보드가 열리면 [시작]과 함께 줄도 숨는다", () => {
    const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
    const realInnerH = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
    vi.useFakeTimers();
    try {
      const { container } = render(lobby(makeView(hostPlayers(), 0, { round: 1 })));
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
});
