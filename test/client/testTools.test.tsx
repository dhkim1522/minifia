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
// 06-15: 대기실은 맵(WorldStage) 위에 그려진다. 캔버스·런타임은 worldStage.test 가 보므로 여기서는 가짜로 바꾼다(lobby.test.tsx 와 같은 모양).
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));
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
  testBots?: number;
  testBotVote?: { exec: "random" | "yes" | "no"; pick: "random" | "host" | "other" };
}

function makeView(o: Opts = {}): RoomView {
  const phase = o.phase ?? "lobby";
  const count = o.players ?? 4;
  const me: RoomView["me"] = { seat: 0, isHost: o.isHost ?? true };
  if (phase !== "lobby" && phase !== "assigning") me.role = "citizen";
  if (o.testMode) me.testMode = true;
  if (o.testRole) me.testRole = o.testRole;
  if (o.testBots !== undefined) me.testBots = o.testBots;
  if (o.testBotVote) me.testBotVote = o.testBotVote;
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
    ...(inDay ? { day: { n: 1, roles: ["mafia", "police", "citizen"], claimLog: [] } } : {}),
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
  it("버튼은 맵 로비의 [테스트] 자리(.mf-lobby__test) 안에 있다", () => {
    const { container } = open({ testMode: true });
    const btn = testBtn() as HTMLElement;
    expect(String(btn.closest("main.mf-lobby .mf-lobby__test") !== null)).toBe("true");
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

  it("낮 시작 발표에서는 버튼이 장면 상자(.mf-dayscene__scene)의 닻(.mf-tt-anchor) 안에 있다", () => {
    open({ phase: "dayAnnounce", testMode: true });
    expect(String((testBtn() as HTMLElement).closest(".mf-dayscene__scene .mf-tt-anchor") !== null)).toBe("true");
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

describe("대기실: 시트의 봇 줄 (U-10)", () => {
  const openSheet = (o: Opts, over: Partial<RoomConnection> = {}) => {
    const utils = open({ testMode: true, ...o }, over);
    fireEvent.click(testBtn() as HTMLElement);
    return utils;
  };
  const sent = (c: RoomConnection): string => JSON.stringify((c.send as ReturnType<typeof vi.fn>).mock.calls);
  const dec = () => within(sheet()).getByRole("button", { name: "봇 줄이기" }) as HTMLButtonElement;
  const inc = () => within(sheet()).getByRole("button", { name: "봇 늘리기" }) as HTMLButtonElement;
  const fill = () => within(sheet()).getByRole("button", { name: "5명 채우기" }) as HTMLButtonElement;

  it("사람 혼자·봇 0 이면 '봇' 제목과 '0명'이 있고 줄이기는 꺼져 있으며 늘리기는 count 1 을 보낸다", () => {
    const { conn: c } = openSheet({ players: 1, testBots: 0 });
    expect(within(sheet()).getByText("봇").textContent).toBe("봇");
    expect(within(sheet()).getByText("0명").textContent).toBe("0명");
    expect(String(dec().disabled)).toBe("true");
    fireEvent.click(inc());
    expect(sent(c)).toBe('[[{"t":"testBots","count":1}]]');
  });

  it("[5명 채우기] 는 사람 혼자일 때 count 4 를 보낸다", () => {
    const { conn: c } = openSheet({ players: 1, testBots: 0 });
    fireEvent.click(fill());
    expect(sent(c)).toBe('[[{"t":"testBots","count":4}]]');
  });

  it("인원 4·봇 3 이면 '3명'이고 줄이기는 count 2, 늘리기는 count 4, 채우기는 count 4 를 보낸다", () => {
    const { conn: c } = openSheet({ players: 4, testBots: 3 });
    expect(within(sheet()).getByText("3명").textContent).toBe("3명");
    fireEvent.click(dec());
    fireEvent.click(inc());
    fireEvent.click(fill());
    expect(sent(c)).toBe(
      '[[{"t":"testBots","count":2}],[{"t":"testBots","count":4}],[{"t":"testBots","count":4}]]',
    );
  });

  it("인원 8·봇 7 이면 늘리기가 꺼져 있다", () => {
    openSheet({ players: 8, testBots: 7 });
    expect(String(inc().disabled)).toBe("true");
    expect(String(dec().disabled)).toBe("false");
  });

  it("인원 8·봇 2(사람 6)도 늘리기가 꺼져 있다", () => {
    openSheet({ players: 8, testBots: 2 });
    expect(String(inc().disabled)).toBe("true");
  });

  it("인원이 5명 이상이면 [5명 채우기] 가 꺼져 있고 4명이면 켜져 있다", () => {
    openSheet({ players: 5, testBots: 2 });
    expect(String(fill().disabled)).toBe("true");
    cleanup();
    openSheet({ players: 4, testBots: 3 });
    expect(String(fill().disabled)).toBe("false");
  });

  it("me.testBots 가 없는 view 는 '0명' 으로 보인다", () => {
    openSheet({ players: 3 });
    expect(within(sheet()).getByText("0명").textContent).toBe("0명");
  });

  it("canSend 가 false 면 세 버튼 모두 꺼져 있다", () => {
    openSheet({ players: 4, testBots: 2 }, { canSend: false });
    expect([dec(), inc(), fill()].map((b) => b.disabled).join(",")).toBe("true,true,true");
  });

  it("discussion 단계 시트에는 봇 줄이 없다", () => {
    open({ testMode: true, phase: "discussion" });
    fireEvent.click(testBtn() as HTMLElement);
    expect(String(within(sheet()).queryByRole("button", { name: "봇 늘리기" }))).toBe("null");
  });

  it("아이콘 버튼이라 글자 대신 aria-label 이름을 가지고 값은 aria-live 영역이다", () => {
    openSheet({ players: 4, testBots: 3 });
    expect(within(sheet()).getByText("3명").getAttribute("aria-live")).toBe("polite");
  });

  it("CSS 에 hex 색이 없고 mf-tt-sheet__step 규칙과 var(--tap-min) 이 있다", () => {
    const css = readFileSync("src/styles/testtools.css", "utf8");
    expect(String(/#[0-9a-fA-F]{3,8}\b/.test(css))).toBe("false");
    expect(String(css.includes("mf-tt-sheet__step"))).toBe("true");
    expect(String(css.includes("var(--tap-min)"))).toBe("true");
  });
});

describe("대기실: 시트의 봇 처형 투표·봇 후보 선택 (P-13)", () => {
  const openSheet = (o: Opts, over: Partial<RoomConnection> = {}) => {
    const utils = open({ testMode: true, ...o }, over);
    fireEvent.click(testBtn() as HTMLElement);
    return utils;
  };
  const sent = (c: RoomConnection): string => JSON.stringify((c.send as ReturnType<typeof vi.fn>).mock.calls);
  const execGroup = () => within(sheet()).getByRole("group", { name: "봇 처형 투표" });
  const pickGroup = () => within(sheet()).getByRole("group", { name: "봇 후보 선택" });
  const execChip = (name: string) => within(execGroup()).getByRole("button", { name }) as HTMLButtonElement;
  const pickChip = (name: string) => within(pickGroup()).getByRole("button", { name }) as HTMLButtonElement;
  const pressed = (b: HTMLButtonElement) => b.getAttribute("aria-pressed");
  const EXEC_NAMES = ["무작위", "모두 찬성", "모두 반대"];
  const PICK_NAMES = ["무작위", "방장", "방장 아닌 사람"];

  it("두 그룹이 role=group 과 aria-label 을 가지고 칩 이름이 계약대로이며 기본은 둘 다 무작위다", () => {
    openSheet({});
    expect(EXEC_NAMES.map((n) => pressed(execChip(n))).join(",")).toBe("true,false,false");
    expect(PICK_NAMES.map((n) => pressed(pickChip(n))).join(",")).toBe("true,false,false");
    expect(within(sheet()).getByText("봇 처형 투표").textContent).toBe("봇 처형 투표");
    expect(within(sheet()).getByText("봇 후보 선택").textContent).toBe("봇 후보 선택");
  });

  it("봇이 0명이어도 칩은 켜져 있다", () => {
    openSheet({ players: 1, testBots: 0 });
    expect([...EXEC_NAMES.map(execChip), ...PICK_NAMES.map(pickChip)].map((b) => b.disabled).join(",")).toBe(
      "false,false,false,false,false,false",
    );
  });

  it("view.me.testBotVote 가 {no, host} 면 모두 반대와 방장이 눌려 있다", () => {
    openSheet({ testBotVote: { exec: "no", pick: "host" } });
    expect(EXEC_NAMES.map((n) => pressed(execChip(n))).join(",")).toBe("false,false,true");
    expect(PICK_NAMES.map((n) => pressed(pickChip(n))).join(",")).toBe("false,true,false");
  });

  it("모두 찬성을 누르면 다른 그룹 값(random)을 함께 싣고, 이어 방장 아닌 사람을 누르면 앞서 고른 yes 를 함께 싣는다 (낙관적 표시 유지)", () => {
    const { conn: c } = openSheet({});
    fireEvent.click(execChip("모두 찬성"));
    expect(sent(c)).toBe('[[{"t":"testBotVote","exec":"yes","pick":"random"}]]');
    expect(pressed(execChip("모두 찬성"))).toBe("true");
    expect(pressed(execChip("무작위"))).toBe("false");
    fireEvent.click(pickChip("방장 아닌 사람"));
    expect(sent(c)).toBe(
      '[[{"t":"testBotVote","exec":"yes","pick":"random"}],[{"t":"testBotVote","exec":"yes","pick":"other"}]]',
    );
    expect(pressed(execChip("모두 찬성"))).toBe("true");
    expect(pressed(pickChip("방장 아닌 사람"))).toBe("true");
  });

  it("서버 값이 no/host 일 때 후보를 무작위로 바꾸면 exec no 를 그대로 싣는다", () => {
    const { conn: c } = openSheet({ testBotVote: { exec: "no", pick: "host" } });
    fireEvent.click(pickChip("무작위"));
    expect(sent(c)).toBe('[[{"t":"testBotVote","exec":"no","pick":"random"}]]');
  });

  it("이미 눌린 칩을 다시 눌러도 보내지 않는다", () => {
    const { conn: c } = openSheet({ testBotVote: { exec: "no", pick: "host" } });
    fireEvent.click(execChip("모두 반대"));
    fireEvent.click(pickChip("방장"));
    expect(sent(c)).toBe("[]");
    cleanup();
    const { conn: c2 } = openSheet({});
    fireEvent.click(execChip("무작위"));
    expect(sent(c2)).toBe("[]");
  });

  it("새 view 객체가 오면 낙관적 선택을 버리고 서버 값을 따른다", () => {
    connectionMock.current = conn(makeView({ testMode: true }));
    const { rerender } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    fireEvent.click(testBtn() as HTMLElement);
    fireEvent.click(execChip("모두 찬성"));
    expect(pressed(execChip("모두 찬성"))).toBe("true");
    connectionMock.current = conn(makeView({ testMode: true, testBotVote: { exec: "no", pick: "other" } }));
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(EXEC_NAMES.map((n) => pressed(execChip(n))).join(",")).toBe("false,false,true");
    expect(PICK_NAMES.map((n) => pressed(pickChip(n))).join(",")).toBe("false,false,true");
  });

  it("canSend 가 거짓이면 칩이 모두 꺼진다", () => {
    openSheet({}, { canSend: false });
    expect([...EXEC_NAMES.map(execChip), ...PICK_NAMES.map(pickChip)].map((b) => b.disabled).join(",")).toBe(
      "true,true,true,true,true,true",
    );
  });

  it("canSend 가 거짓이면 눌러도 보내지 않는다", () => {
    const { conn: c } = openSheet({}, { canSend: false });
    fireEvent.click(execChip("모두 찬성"));
    expect(sent(c)).toBe("[]");
  });

  it("게임 중(낮 토론) 시트에는 두 그룹이 없다", () => {
    open({ testMode: true, phase: "discussion" });
    fireEvent.click(testBtn() as HTMLElement);
    expect(String(within(sheet()).queryByRole("group", { name: "봇 처형 투표" }))).toBe("null");
    expect(String(within(sheet()).queryByRole("group", { name: "봇 후보 선택" }))).toBe("null");
  });

  it("두 그룹은 봇 줄 아래, 두 동작 버튼 위에 놓인다", () => {
    openSheet({});
    const bots = sheet().querySelector(".mf-tt-sheet__bots") as HTMLElement;
    const list = sheet().querySelector(".mf-tt-sheet__list") as HTMLElement;
    const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(String(follows(bots, execGroup()) && follows(execGroup(), pickGroup()) && follows(pickGroup(), list))).toBe("true");
  });

  it("testtools.css 에 새 구역 규칙이 있고 hex 색이 없다", () => {
    const css = readFileSync("src/styles/testtools.css", "utf8");
    expect(String(css.includes(".mf-tt-sheet__botvote"))).toBe("true");
    expect(String(/#[0-9a-fA-F]{3,8}\b/.test(css))).toBe("false");
  });
});

describe("[테스트] 닻과 아침 어둡게 층 (03.1-10, D-16, UI-SPEC E)", () => {
  const css = readFileSync("src/styles/testtools.css", "utf8");
  const tokens = readFileSync("src/styles/tokens.css", "utf8");

  it("닻 규칙 불변: .mf-tt-anchor 는 height 0·z-index var(--z-overlay), .mf-tt 는 top var(--space-sm)·left 0, --z-overlay 는 50", () => {
    const anchor = css.match(/\.mf-tt-anchor \{([^}]*)\}/)?.[1] ?? "";
    const button = css.match(/\.mf-tt-anchor \.mf-tt \{([^}]*)\}/)?.[1] ?? "";
    expect(/height:\s*0\b/.test(anchor) && /z-index:\s*var\(--z-overlay\)/.test(anchor)).toBe(true);
    expect(/top:\s*var\(--space-sm\)/.test(button) && /left:\s*0\b/.test(button)).toBe(true);
    expect(/--z-overlay:\s*50;/.test(tokens)).toBe(true);
    // 닻은 DayTable 밖이라 숫자 비교가 아니라 쌓임 순서가 근거다 — 근거 주석이 있다
    expect(css.includes("시안 T1 왼쪽 위 유지")).toBe(true);
  });

  it("아침(어둡게 층 있음)에도 [테스트] 버튼은 장면 상자 안 닻에 있고 층(.mf-dt__dim)을 가리지 않는다", () => {
    open({ phase: "morning", testMode: true });
    const btn = testBtn() as HTMLElement;
    const scene = btn.closest(".mf-dayscene__scene");
    expect(String(scene !== null)).toBe("true");
    const dim = scene!.querySelector(".mf-dt__dim");
    expect(String(dim !== null)).toBe("true");
    // 닻이 테이블(층 포함)보다 문서 순서상 앞이고, 층과 버튼 어느 쪽도 pointer-events 가 막혀 있지 않다
    const anchor = btn.closest(".mf-tt-anchor") as HTMLElement;
    expect(String((anchor.compareDocumentPosition(dim as Node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)).toBe("true");
    expect(getComputedStyle(btn).pointerEvents).not.toBe("none");
    expect(String((btn as HTMLButtonElement).disabled)).toBe("false");
  });
});
