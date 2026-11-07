/// <reference types="node" />
import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { ChatChannel, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 07-15: ChatPanel 기반 밤 마피아·탈락자 채팅 화면 시험. 08-27 에서 옛 고정 테이블 장면 대신 GameMap(RoomScreen 경유) 기준으로 다시 썼다.
// 화면은 서버가 보낸 줄과 view.me.chat 만 따른다. 시민 편 DOM 에는 마피아·유령 채널 문구가 없어야 한다(T-07-40).
// 서버와는 view 픽스처와 연결의 onEvent 로 흘리는 프레임으로만 만난다. WorldStage 는 맵 그림을 빼고 props 만 쥐는 가짜다(이름표·런타임은 worldStage.test 몫).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const T0 = 1_700_000_000_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연"];

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  role?: RoleId;
  /** 서버가 보낸 내 채널(view.me.chat). 없으면 키가 없다 */
  chat?: ChatChannel;
  dead?: number[];
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.chat !== undefined) me.chat = o.chat;
  const dead = o.dead ?? [];
  const view: RoomView = {
    code: "0042",
    phase: o.phase ?? "night",
    phaseEndsAt: T0 + 30_000,
    phaseDurationMs: 30_000,
    serverNow: T0,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, alive: !dead.includes(seat) })),
    me,
    day: { n: o.n ?? 1, roles: ["mafia", "police", "doctor", "citizen"] },
  };
  if (dead.includes(0)) view.spectate = { seats: NAMES.map((_, seat) => ({ seat, job: seat === 1 ? ("mafia" as const) : ("citizen" as const) })) };
  return view;
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

/** 방 화면과 맵 화면이 각각 구독한다 — 모든 구독자에게 같은 프레임을 보낸다 */
function scene(view: RoomView, opts: { epoch?: number; strict?: boolean } = {}) {
  const listeners: Array<(e: never, meta: { epoch: number }) => void> = [];
  const onEvent = vi.fn((l: (typeof listeners)[number]) => {
    listeners.push(l);
    return () => {};
  }) as unknown as RoomConnection["onEvent"];
  let epoch = opts.epoch ?? 1;
  connectionMock.current = conn(view, { onEvent, epoch });
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const wrap = (node: React.ReactElement) => (opts.strict ? <StrictMode>{node}</StrictMode> : node);
  const utils = render(wrap(ui()));
  const rerender = (v: RoomView, nextEpoch = epoch) => {
    epoch = nextEpoch;
    connectionMock.current = conn(v, { onEvent, epoch });
    utils.rerender(wrap(ui()));
  };
  /** 서버가 보낸 줄을 저장소에 넣는다 */
  const receive = (ch: ChatChannel, seat: number, seq: number, text: string, at: number) =>
    act(() => listeners.forEach((l) => l({ t: "chat", ch, seat, seq, text, at } as never, { epoch })));
  return { ...utils, rerender, receive };
}

const chatPanel = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-chat-panel]");
const input = (c: HTMLElement) => c.querySelector<HTMLInputElement>("[data-chat-input]");
/** 기록 칸의 줄을 순서대로: 시스템 줄은 글자와 아이콘 첫 경로, 사람 줄은 채널·이름·본문·앞 마크 */
function logLines(c: HTMLElement) {
  return [...c.querySelectorAll("[data-chat-log] > p.mv-chat__sys, [data-chat-log] > p.mv-chat__msg")].map((p) =>
    p.classList.contains("mv-chat__sys")
      ? { kind: "system" as const, text: (p.textContent ?? "").trim(), icon: p.querySelector("svg path")?.getAttribute("d")?.slice(0, 8) ?? "" }
      : {
          kind: "player" as const,
          ch: p.getAttribute("data-ch"),
          name: p.querySelector(".mv-chat__name")?.textContent ?? "",
          text: p.querySelector(".mv-chat__text")?.textContent ?? "",
          mark: p.querySelector(".mv-chat__mark.is-mafia") ? "mafia" : p.querySelector(".mv-chat__mark.is-ghost") ? "ghost" : "",
          mafiaName: p.classList.contains("is-mafia"),
        },
  );
}
const sysTexts = (c: HTMLElement) => logLines(c).filter((l) => l.kind === "system").map((l) => l.text);

// V2Icon 경로 앞 8자(아이콘 구별용)
const ICON_MAFIA = "M3.5 15.";
const ICON_GHOST = "M5 21V11";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("산 마피아의 밤 채팅 패널은 화면에 없다 (15페이즈 D-05, 서버 채널은 그대로)", () => {
  it("산 마피아의 밤 아래: 채팅 패널·입력칸·기록 칸·마피아 아이콘이 없고(서버 채널이 mafia 여도) 얼굴 목록이 대신 있다", () => {
    const { container } = scene(makeView({ role: "mafia", chat: "mafia" }));
    expect(chatPanel(container)).toBeNull();
    expect(input(container)).toBeNull();
    expect(container.querySelector(".mv-chat__chan.is-mafia, [data-chat-log]")).toBeNull();
    expect(container.querySelector("[data-face-list]")).not.toBeNull();
    expect(container.querySelector(".mf-game__panel .mf-nightpanel")).toBeNull();
  });

  it("낮에서 밤으로 넘어와도 마피아 시스템 줄 '밤 · 마피아 채팅' 은 DOM 에 없고, 아침이 되면 공개 채널 패널이 돌아온다", () => {
    const r = scene(makeView({ phase: "discussion", role: "mafia", chat: "all" }));
    r.rerender(makeView({ phase: "night", role: "mafia", chat: "mafia" }));
    expect(r.container.textContent).not.toContain("마피아 채팅");
    expect(chatPanel(r.container)).toBeNull();
    r.rerender(makeView({ phase: "morning", n: 1, role: "mafia", chat: "all" }));
    expect(chatPanel(r.container)?.getAttribute("data-chat-channel")).toBe("all");
    expect(r.container.textContent).not.toContain("마피아 채팅");
  });
});

describe("시민 편 화면에는 비공개 채널의 흔적이 없다 (T-07-40)", () => {
  const TRACES = ["마피아 채팅", "마피아끼리만", "유령 채팅", "유령끼리만"];
  const clean = (c: HTMLElement) => {
    const labels = [...c.querySelectorAll("[aria-label],[placeholder]")].map((e) => `${e.getAttribute("aria-label") ?? ""}|${e.getAttribute("placeholder") ?? ""}`).join("|");
    const html = `${c.textContent}|${labels}`;
    return { traces: TRACES.filter((w) => html.includes(w)), mafiaLines: c.querySelectorAll('[data-ch="mafia"]').length, ghostLines: c.querySelectorAll('[data-ch="ghost"]').length, mafiaCh: c.querySelectorAll('[data-chat-channel="mafia"],[data-chat-channel="ghost"]').length };
  };

  for (const r of ["citizen", "police", "doctor"] as const) {
    it(`산 ${r} 의 밤: ChatPanel 이 없고 밤 알약 패널도 없으며 DOM 에 마피아·유령 채널 문구·표식이 0건`, () => {
      const { container } = scene(makeView({ role: r }));
      expect(chatPanel(container)).toBeNull();
      expect(input(container)).toBeNull();
      expect(container.querySelector(".mf-game__panel .mf-nightpanel")).toBeNull();
      expect(clean(container)).toEqual({ traces: [], mafiaLines: 0, ghostLines: 0, mafiaCh: 0 });
    });
  }

  it("낮 토론의 산 마피아도 채널은 all 이고 DOM 에 마피아·유령 채널 문구·표식이 0건이다", () => {
    const { container } = scene(makeView({ phase: "discussion", role: "mafia", chat: "all" }));
    expect(chatPanel(container)?.getAttribute("data-chat-channel")).toBe("all");
    expect(clean(container)).toEqual({ traces: [], mafiaLines: 0, ghostLines: 0, mafiaCh: 0 });
    expect(input(container)?.getAttribute("aria-label")).toBe("채팅 입력");
  });

  it("낮에 쌓인 공개 줄이 있어도 시민 밤 화면에는 줄 칸 자체가 없다", () => {
    const r = scene(makeView({ phase: "discussion", role: "citizen", chat: "all" }));
    r.receive("all", 2, 1, "낮에 한 말", T0 + 10);
    r.rerender(makeView({ phase: "night", role: "citizen" }));
    expect(r.container.querySelector("[data-chat-log]")).toBeNull();
    expect(clean(r.container).traces).toEqual([]);
  });

  it("밤에 서버 채널(view.me.chat)이 화면의 의도와 다르면 패널을 그리지 않는다: 시민 밤의 mafia, 마피아 밤의 all, 탈락자 밤의 all", () => {
    expect(chatPanel(scene(makeView({ phase: "night", role: "citizen", chat: "mafia" })).container)).toBeNull();
    cleanup();
    expect(chatPanel(scene(makeView({ phase: "night", role: "mafia", chat: "all" })).container)).toBeNull();
    cleanup();
    expect(chatPanel(scene(makeView({ phase: "night", role: "citizen", dead: [0], chat: "all" })).container)).toBeNull();
  });
});

describe("탈락자 채팅 (CHAT-03, 채널 ghost)", () => {
  const ghostView = (phase: PhaseId, n = 1) => makeView({ phase, n, role: "citizen", dead: [0], chat: "ghost" });

  it("낮 토론·최후 변론·찬반·밤의 탈락자 아래는 ChatPanel(ghost): '유령 채팅 입력'·'유령끼리만 보여요'·입력칸 안 ghost 아이콘, 관전 알약이 아니다", () => {
    for (const phase of ["discussion", "defense", "verdict", "night"] as const) {
      const { container: c } = scene({ ...ghostView(phase), day: { n: 1, roles: ["citizen"], candidate: 2 } });
      expect(chatPanel(c)?.getAttribute("data-chat-channel"), phase).toBe("ghost");
      expect(input(c)?.getAttribute("aria-label"), phase).toBe("유령 채팅 입력");
      expect(input(c)?.getAttribute("placeholder"), phase).toBe("유령끼리만 보여요");
      expect(c.querySelector(".mv-chat__chan.is-ghost"), phase).not.toBeNull();
      expect(c.querySelector(".mf-game__panel .mf-ro"), phase).toBeNull();
      cleanup();
    }
  });

  it("기록은 공개 줄 + 밤 마피아 줄(마피아 마크·진홍 이름) + 유령 줄(ghost 마크)이 시간 순 한 흐름이다", () => {
    const r = scene(ghostView("discussion"));
    r.receive("all", 2, 1, "낮 이야기", T0 + 100);
    r.receive("mafia", 1, 1, "밤 모의", T0 + 200);
    r.receive("ghost", 3, 1, "유령 수다", T0 + 300);
    const lines = logLines(r.container).filter((l) => l.kind === "player");
    expect(lines).toEqual([
      expect.objectContaining({ ch: "all", text: "낮 이야기", mark: "", mafiaName: false }),
      expect.objectContaining({ ch: "mafia", text: "밤 모의", mark: "mafia", mafiaName: true }),
      expect.objectContaining({ ch: "ghost", text: "유령 수다", mark: "ghost", mafiaName: false }),
    ]);
  });

  it("탈락했을 때(내 채널이 ghost 로 바뀐 렌더) ghost 아이콘 + '유령 채팅 · 산 사람에게 안 보여요' 시스템 줄이 한 번 생기고 다음 단계에서도 한 번이다", () => {
    const r = scene(makeView({ phase: "verdict", role: "citizen", chat: "all" }));
    vi.setSystemTime(T0 + 500);
    r.rerender(makeView({ phase: "execution", role: "citizen", dead: [0], chat: "ghost" }));
    r.rerender({ ...makeView({ phase: "execution", role: "citizen", dead: [0], chat: "ghost" }), serverNow: T0 + 600 });
    vi.setSystemTime(T0 + 1000);
    r.rerender(ghostView("night"));
    expect(logLines(r.container)).toEqual([{ kind: "system", text: "유령 채팅 · 산 사람에게 안 보여요", icon: ICON_GHOST }]);
    expect(r.container.textContent).not.toContain("밤 · 마피아 채팅");
  });

  it("재접속(epoch 변화)이나 처음 마운트한 밤에는 유령 시작 줄을 만들지 않는다", () => {
    const first = scene(ghostView("night"));
    expect(sysTexts(first.container)).toEqual([]);
    cleanup();
    const r = scene(ghostView("discussion"));
    r.rerender(ghostView("night"), 2);
    expect(sysTexts(r.container)).toEqual([]);
  });
});

describe("맵 화면의 채팅 기록은 단계가 바뀌어도 이어진다", () => {
  it("낮 시작~아침 어느 단계에서 받은 공개 줄도 같은 기록 칸에 쌓여 있다가 다음 낮 토론에서 보인다", () => {
    const r = scene(makeView({ phase: "nomination", role: "citizen", chat: "all" }));
    r.receive("all", 2, 1, "지목 중에 한 말", T0 + 50);
    expect(logLines(r.container).map((l) => l.text)).toContain("지목 중에 한 말");
    r.rerender(makeView({ phase: "discussion", n: 2, role: "citizen", chat: "all" }));
    expect(logLines(r.container).map((l) => l.text)).toContain("지목 중에 한 말");
  });
});
