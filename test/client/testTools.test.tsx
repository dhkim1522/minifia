/// <reference types="node" />
// 테스트 방 방장 도구 화면(quick 261025-f09, 결정 0022): [테스트] 버튼과 '테스트 도구' 시트, ?test=1 방 만들기.
// 화면은 요청만 보낸다 — 역할 판정·단계 진행은 서버가 한다(결정 0002). 실패 출력은 한 줄이어야 해서 값은 문자열로 비교한다.
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const preloadMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/net/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/net/assets")>()),
  preloadRoleAssets: preloadMock,
}));

const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { Home } = await import("../../src/screens/Home");

const NOW = 1_700_000_000_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연", "가온", "나래", "다솜"];

interface Opts {
  phase?: PhaseId;
  players?: number;
  isHost?: boolean;
  testMode?: boolean;
  testRole?: "mafia" | "police" | "doctor" | "citizen";
}

function makeView(o: Opts = {}): RoomView {
  const phase = o.phase ?? "lobby";
  const count = o.players ?? 4;
  const me: RoomView["me"] = { seat: 0, isHost: o.isHost ?? true };
  if (phase !== "lobby" && phase !== "assigning") me.role = "citizen";
  if (o.testMode) me.testMode = true;
  if (o.testRole) me.testRole = o.testRole;
  const inDay = phase !== "lobby" && phase !== "assigning" && phase !== "roleReveal";
  return {
    code: "0042",
    phase,
    phaseEndsAt: phase === "lobby" ? null : NOW + 15_000,
    phaseDurationMs: phase === "lobby" ? null : 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: Array.from({ length: count }, (_, i) => ({ seat: i, nickname: NAMES[i]!, connected: true, isHost: i === 0 })),
    me,
    ...(inDay ? { day: { n: 1, roles: ["mafia", "police", "citizen"] } } : {}),
  };
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return {
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
    ...over,
  };
}

function open(o: Opts = {}, over: Partial<RoomConnection> = {}) {
  const c = conn(makeView(o), over);
  connectionMock.current = c;
  const utils = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  return { ...utils, conn: c };
}

const testBtn = () => screen.queryByRole("button", { name: "테스트" });
const sheet = () => screen.getByRole("dialog", { name: "테스트 도구" });
const chipOf = (name: string) => within(sheet()).getByRole("button", { name }) as HTMLButtonElement;
const actionOf = (re: RegExp) => within(sheet()).getByRole("button", { name: re }) as HTMLButtonElement;

beforeEach(() => {
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("[테스트] 버튼은 테스트 방 방장에게만 보인다 (U-02)", () => {
  it("일반 방 방장의 대기실에는 버튼이 없다", () => {
    open({ isHost: true });
    expect(String(testBtn())).toBe("null");
  });

  it("일반 방 방장의 낮 토론에는 버튼이 없다", () => {
    open({ phase: "discussion", isHost: true });
    expect(String(testBtn())).toBe("null");
  });

  it("방장이 아니면 testMode 가 있어도 버튼이 없다", () => {
    open({ isHost: false, testMode: true });
    expect(String(testBtn())).toBe("null");
  });
});

describe("대기실: 시트의 내 직업 칸 (U-12)", () => {
  it("버튼은 .mf-lobby__scene 안 .mf-tt-anchor 에 있다", () => {
    const { container } = open({ testMode: true });
    const btn = testBtn() as HTMLElement;
    expect(String(btn.closest(".mf-lobby__scene .mf-tt-anchor") !== null)).toBe("true");
    expect(String(container.querySelectorAll(".mf-tt").length)).toBe("1");
  });

  it("누르면 '테스트 도구' 대화상자에 안내와 내 직업 칩 다섯 개가 있고 랜덤이 눌려 있다", () => {
    open({ testMode: true });
    fireEvent.click(testBtn() as HTMLElement);
    expect(within(sheet()).getByText("테스트 방에서만 보이는 방장 도구예요").textContent).toBe("테스트 방에서만 보이는 방장 도구예요");
    expect(within(sheet()).getByText("내 직업").textContent).toBe("내 직업");
    const names = ["랜덤", "마피아", "경찰", "의사", "시민"];
    expect(names.map((n) => chipOf(n).getAttribute("aria-pressed")).join(",")).toBe("true,false,false,false,false");
  });

  it("4명이면 의사 칩만 꺼져 있다", () => {
    open({ testMode: true, players: 4 });
    fireEvent.click(testBtn() as HTMLElement);
    expect(["랜덤", "마피아", "경찰", "의사", "시민"].map((n) => chipOf(n).disabled).join(",")).toBe("false,false,false,true,false");
  });

  it("5명이면 의사 칩도 켜져 있다", () => {
    open({ testMode: true, players: 5 });
    fireEvent.click(testBtn() as HTMLElement);
    expect(String(chipOf("의사").disabled)).toBe("false");
  });

  it("마피아를 누르면 testRole mafia 를 보내고 칩이 바로 눌린 모양이 된다", () => {
    const { conn: c } = open({ testMode: true });
    fireEvent.click(testBtn() as HTMLElement);
    fireEvent.click(chipOf("마피아"));
    expect(JSON.stringify((c.send as ReturnType<typeof vi.fn>).mock.calls)).toBe('[[{"t":"testRole","role":"mafia"}]]');
    expect(chipOf("마피아").getAttribute("aria-pressed")).toBe("true");
    expect(chipOf("랜덤").getAttribute("aria-pressed")).toBe("false");
  });

  it("이미 눌린 칩을 다시 눌러도 보내지 않는다", () => {
    const { conn: c } = open({ testMode: true, testRole: "mafia" });
    fireEvent.click(testBtn() as HTMLElement);
    fireEvent.click(chipOf("마피아"));
    expect(String((c.send as ReturnType<typeof vi.fn>).mock.calls.length)).toBe("0");
  });

  it("서버 view 의 me.testRole 이 mafia 면 마피아가 눌려 있고 랜덤을 누르면 role null 을 보낸다", () => {
    const { conn: c } = open({ testMode: true, testRole: "mafia" });
    fireEvent.click(testBtn() as HTMLElement);
    expect(chipOf("마피아").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chipOf("랜덤"));
    expect(JSON.stringify((c.send as ReturnType<typeof vi.fn>).mock.calls)).toBe('[[{"t":"testRole","role":null}]]');
  });

  it("새 view 가 오면 낙관적 선택을 버리고 서버 값을 따른다", () => {
    const first = conn(makeView({ testMode: true }));
    connectionMock.current = first;
    const { rerender } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    fireEvent.click(testBtn() as HTMLElement);
    fireEvent.click(chipOf("경찰"));
    expect(chipOf("경찰").getAttribute("aria-pressed")).toBe("true");
    connectionMock.current = conn(makeView({ testMode: true, testRole: "citizen" }));
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(["경찰", "시민"].map((n) => chipOf(n).getAttribute("aria-pressed")).join(",")).toBe("false,true");
  });

  it("대기실에서는 두 동작 버튼이 꺼져 있고 아랫줄은 '지금: 대기실' 이다", () => {
    open({ testMode: true });
    fireEvent.click(testBtn() as HTMLElement);
    expect(String(actionOf(/^다음 단계로 넘기기/).disabled)).toBe("true");
    expect(String(actionOf(/^대기실로 되돌리기/).disabled)).toBe("true");
    expect(within(sheet()).getByText("지금: 대기실").textContent).toBe("지금: 대기실");
  });

  it("canSend 가 거짓이면 칩이 모두 꺼진다", () => {
    open({ testMode: true }, { canSend: false });
    fireEvent.click(testBtn() as HTMLElement);
    expect(["랜덤", "마피아", "경찰", "의사", "시민"].map((n) => chipOf(n).disabled).join(",")).toBe("true,true,true,true,true");
  });
});

describe("게임 중: 버튼 자리와 두 동작 (U-03, U-04)", () => {
  it("낮 토론: 버튼은 .mf-dayscene__scene 안 .mf-tt-anchor 에 있다", () => {
    open({ phase: "discussion", testMode: true });
    expect(String((testBtn() as HTMLElement).closest(".mf-dayscene__scene .mf-tt-anchor") !== null)).toBe("true");
  });

  it("시트에 '내 직업' 칸이 없고 아랫줄이 '지금: 낮 토론'·'인원 유지, 새 판' 이다", () => {
    open({ phase: "discussion", testMode: true });
    fireEvent.click(testBtn() as HTMLElement);
    expect(String(within(sheet()).queryByText("내 직업"))).toBe("null");
    expect(within(sheet()).getByText("지금: 낮 토론").textContent).toBe("지금: 낮 토론");
    expect(within(sheet()).getByText("인원 유지, 새 판").textContent).toBe("인원 유지, 새 판");
  });

  it("[다음 단계로 넘기기] 는 testSkip 을 보내고 시트는 열린 채다", async () => {
    const { conn: c } = open({ phase: "discussion", testMode: true });
    fireEvent.click(testBtn() as HTMLElement);
    fireEvent.click(actionOf(/^다음 단계로 넘기기/));
    expect(JSON.stringify((c.send as ReturnType<typeof vi.fn>).mock.calls)).toBe('[[{"t":"testSkip"}]]');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(String(screen.queryByRole("dialog", { name: "테스트 도구" }) !== null)).toBe("true");
  });

  it("[대기실로 되돌리기] 는 testReset 을 보내고 시트가 닫힌다", async () => {
    const { conn: c } = open({ phase: "discussion", testMode: true });
    fireEvent.click(testBtn() as HTMLElement);
    fireEvent.click(actionOf(/^대기실로 되돌리기/));
    expect(JSON.stringify((c.send as ReturnType<typeof vi.fn>).mock.calls)).toBe('[[{"t":"testReset"}]]');
    await waitFor(() => expect(String(screen.queryByRole("dialog", { name: "테스트 도구" }))).toBe("null"));
  });

  it("canSend 가 거짓이면 두 동작 버튼이 꺼진다", () => {
    open({ phase: "discussion", testMode: true }, { canSend: false });
    fireEvent.click(testBtn() as HTMLElement);
    expect(String(actionOf(/^다음 단계로 넘기기/).disabled)).toBe("true");
    expect(String(actionOf(/^대기실로 되돌리기/).disabled)).toBe("true");
  });

  it("역할 확인에서는 버튼이 위쪽 바 .mf-phasebar__extra 안에 있다", () => {
    open({ phase: "roleReveal", testMode: true });
    expect(String((testBtn() as HTMLElement).closest(".mf-phasebar__extra") !== null)).toBe("true");
  });

  it("낮 시작 발표에서는 버튼이 .mf-day__top 안에 있다", () => {
    open({ phase: "dayAnnounce", testMode: true });
    expect(String((testBtn() as HTMLElement).closest(".mf-day__top") !== null)).toBe("true");
  });

  it("배정 단계에는 버튼이 없다", () => {
    open({ phase: "assigning", testMode: true });
    expect(String(testBtn())).toBe("null");
  });

  it("단계가 바뀌어도 열린 시트는 닫히지 않고 아랫줄이 새 단계로 바뀐다", () => {
    connectionMock.current = conn(makeView({ phase: "night", testMode: true }));
    const { rerender } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    fireEvent.click(testBtn() as HTMLElement);
    expect(within(sheet()).getByText("지금: 밤").textContent).toBe("지금: 밤");
    connectionMock.current = conn(makeView({ phase: "morning", testMode: true }));
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(within(sheet()).getByText("지금: 아침").textContent).toBe("지금: 아침");
  });
});

describe("testtools.css", () => {
  it("색 hex 가 없다", () => {
    const css = readFileSync("src/styles/testtools.css", "utf8");
    expect(String(/#[0-9a-fA-F]{3,8}\b/.test(css))).toBe("false");
  });
  it("점선과 토큰 변수를 쓴다", () => {
    const css = readFileSync("src/styles/testtools.css", "utf8");
    expect(String(css.includes("dashed") && css.includes("var(--"))).toBe("true");
  });
});

describe("Home: ?test=1 방 만들기 (U-01)", () => {
  const TOKEN = "t".repeat(43);

  async function createWith(url: string): Promise<string> {
    window.history.replaceState({}, "", url);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "0042", token: TOKEN, seat: 0 }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    await waitFor(() => expect(onEnter).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return String(init.body);
  }

  it("주소가 /?test=1 이면 본문에 testMode true 가 실린다", async () => {
    expect(await createWith("/?test=1")).toBe(JSON.stringify({ nickname: "민수", testMode: true }));
  });

  it("주소가 / 이면 본문은 nickname 하나뿐이다", async () => {
    expect(await createWith("/")).toBe(JSON.stringify({ nickname: "민수" }));
  });

  it("test 값이 1 이 아니면 일반 방이다", async () => {
    expect(await createWith("/?test=true")).toBe(JSON.stringify({ nickname: "민수" }));
  });
});
