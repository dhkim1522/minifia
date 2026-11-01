/// <reference types="node" />
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { ChatChannel, PhaseId, RoomView } from "../../shared/protocol";
import { ChatStore } from "../../src/net/chatStore";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";

// 07-15: ChatPanel 기반 밤 마피아·탈락자 채팅 화면 시험(07-07 에서 지운 같은 이름 파일의 재작성).
// 화면은 서버가 보낸 줄과 view.me.chat 만 따른다. 시민 편 DOM 에는 마피아·유령 채널 문구가 없어야 한다(T-07-40).
// 서버와는 view 픽스처와 ChatStore 에 직접 넣는 프레임으로만 만난다.

const T0 = 1_700_000_000_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연"];

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  role?: RoleId;
  /** 서버가 보낸 내 채널(view.me.chat). 없으면 키가 없다 */
  chat?: ChatChannel;
  dead?: number[];
  candidate?: number;
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
    day: { n: o.n ?? 1, roles: ["mafia", "police", "doctor", "citizen"], ...(o.candidate !== undefined ? { candidate: o.candidate } : {}) },
  };
  if (dead.includes(0)) view.spectate = { seats: NAMES.map((_, seat) => ({ seat, job: seat === 1 ? ("mafia" as const) : ("citizen" as const) })) };
  return view;
}

function conn(view: RoomView, epoch = 1): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
  };
}

const role = <button type="button">내 역할</button>;

function scene(view: RoomView, opts: { epoch?: number; strict?: boolean } = {}) {
  const chat = new ChatStore();
  const ui = (v: RoomView, epoch: number) => <DayScene view={v} connection={conn(v, epoch)} chat={chat} myRoleButton={role} />;
  const wrap = (node: React.ReactElement) => (opts.strict ? <StrictMode>{node}</StrictMode> : node);
  const utils = render(wrap(ui(view, opts.epoch ?? 1)));
  const rerender = (v: RoomView, epoch = opts.epoch ?? 1) => utils.rerender(wrap(ui(v, epoch)));
  return { ...utils, chat, rerender };
}

/** 서버가 보낸 줄을 저장소에 넣는다(epoch 1) */
function receive(chat: ChatStore, ch: ChatChannel, seat: number, seq: number, text: string, at: number) {
  act(() => chat.apply({ t: "chat", ch, seat, seq, text, at }, 1, at));
}

const panelEl = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dayscene__panel")!;
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
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("밤 마피아 채팅 (CHAT-02, 채널 mafia)", () => {
  it("산 마피아의 밤 하단은 ChatPanel(mafia): 입력칸 '마피아 채팅 입력'·안내 '마피아끼리만 보여요'·입력칸 안 roleMafia 아이콘, 밤 버튼 패널이 아니다", () => {
    const { container } = scene(makeView({ role: "mafia", chat: "mafia" }));
    expect(chatPanel(container)?.getAttribute("data-chat-channel")).toBe("mafia");
    expect(input(container)?.getAttribute("aria-label")).toBe("마피아 채팅 입력");
    expect(input(container)?.getAttribute("placeholder")).toBe("마피아끼리만 보여요");
    expect(container.querySelector(".mv-chat__chan.is-mafia")).not.toBeNull();
    expect(panelEl(container).querySelector("h2")).toBeNull();
    expect(panelEl(container).querySelector(".mf-ro")).toBeNull();
    expect(panelEl(container).classList.contains("mf-dayscene__panel--chat")).toBe(true);
  });

  it("낮에서 밤으로 넘어오는 렌더에 roleMafia 아이콘 + '밤 · 마피아 채팅' 시스템 줄이 한 번 생기고, 같은 밤을 다시 그려도 늘지 않는다", () => {
    const r = scene(makeView({ phase: "discussion", role: "mafia", chat: "all" }));
    expect(sysTexts(r.container)).toEqual([]);
    vi.setSystemTime(T0 + 1000);
    r.rerender(makeView({ phase: "night", role: "mafia", chat: "mafia" }));
    expect(logLines(r.container)).toEqual([{ kind: "system", text: "밤 · 마피아 채팅", icon: ICON_MAFIA }]);
    r.rerender({ ...makeView({ phase: "night", role: "mafia", chat: "mafia" }), serverNow: T0 + 2000 });
    expect(sysTexts(r.container)).toEqual(["밤 · 마피아 채팅"]);
  });

  it("StrictMode 에서도 채널 시작 줄은 한 번이다", () => {
    const r = scene(makeView({ phase: "discussion", role: "mafia", chat: "all" }), { strict: true });
    r.rerender(makeView({ phase: "night", role: "mafia", chat: "mafia" }));
    expect(sysTexts(r.container)).toEqual(["밤 · 마피아 채팅"]);
  });

  it("기록에는 마피아 줄과 마피아 시스템 줄만 시간 순으로 보이고(이름 진홍 클래스), 낮의 공개 줄은 아침 뒤 다음 낮에 돌아오며 마피아 줄은 공개 기록에 없다", () => {
    const r = scene(makeView({ phase: "discussion", role: "mafia", chat: "all" }));
    receive(r.chat, "all", 2, 1, "낮에 한 말", T0 + 100);
    expect(logLines(r.container).map((l) => (l.kind === "player" ? l.text : l.text))).toEqual(["낮에 한 말"]);
    vi.setSystemTime(T0 + 1000);
    r.rerender(makeView({ phase: "night", role: "mafia", chat: "mafia" }));
    receive(r.chat, "mafia", 1, 1, "오늘은 도현", T0 + 1500);
    const night = logLines(r.container);
    expect(night.map((l) => l.text)).toEqual(["밤 · 마피아 채팅", "오늘은 도현"]);
    expect(night[1]).toMatchObject({ kind: "player", ch: "mafia", name: "하윤", mafiaName: true });
    expect(r.container.textContent).not.toContain("낮에 한 말");
    // 아침: 패널이 없다. 줄은 저장소에 남아 있다
    r.rerender(makeView({ phase: "morning", n: 1, role: "mafia", chat: "all" }));
    expect(chatPanel(r.container)).toBeNull();
    // 다음 낮 토론: 공개 줄이 돌아오고 마피아 줄·마피아 시스템 줄은 없다
    r.rerender(makeView({ phase: "discussion", n: 2, role: "mafia", chat: "all" }));
    expect(logLines(r.container).map((l) => l.text)).toEqual(["낮에 한 말"]);
    expect(r.container.textContent).not.toContain("오늘은 도현");
    expect(r.container.textContent).not.toContain("마피아 채팅");
  });

  it("재접속: 밤에 처음 마운트하거나 epoch 가 바뀐 첫 view 에서는 채널 시작 줄을 만들지 않는다", () => {
    const first = scene(makeView({ phase: "night", role: "mafia", chat: "mafia" }));
    expect(sysTexts(first.container)).toEqual([]);
    cleanup();
    const r = scene(makeView({ phase: "discussion", role: "mafia", chat: "all" }));
    r.rerender(makeView({ phase: "night", role: "mafia", chat: "mafia" }), 2);
    expect(sysTexts(r.container)).toEqual([]);
    // 그 뒤 같은 연결에서 다음 밤이 오면 만든다
    r.rerender(makeView({ phase: "morning", role: "mafia", chat: "all" }), 2);
    r.rerender(makeView({ phase: "night", n: 2, role: "mafia", chat: "mafia" }), 2);
    expect(sysTexts(r.container)).toEqual(["밤 · 마피아 채팅"]);
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
    it(`산 ${r} 의 밤: ChatPanel 이 없고 기존 NightPanel 이며 DOM 에 마피아·유령 채널 문구·표식이 0건`, () => {
      const { container } = scene(makeView({ role: r }));
      expect(chatPanel(container)).toBeNull();
      expect(input(container)).toBeNull();
      expect(panelEl(container).querySelector("h2")).not.toBeNull();
      expect(clean(container)).toEqual({ traces: [], mafiaLines: 0, ghostLines: 0, mafiaCh: 0 });
    });
  }

  it("낮 토론의 산 마피아도 채널은 all 이고 DOM 에 마피아·유령 채널 문구·표식이 0건이다", () => {
    const { container } = scene(makeView({ phase: "discussion", role: "mafia", chat: "all" }));
    expect(chatPanel(container)?.getAttribute("data-chat-channel")).toBe("all");
    expect(clean(container)).toEqual({ traces: [], mafiaLines: 0, ghostLines: 0, mafiaCh: 0 });
    expect(input(container)?.getAttribute("aria-label")).toBe("채팅 입력");
  });

  it("마피아가 밤에 나눈 줄을 시민 편 저장소가 받지 않는 한(서버가 보내지 않는다) 시민 밤 화면에는 줄 칸 자체가 없다", () => {
    const r = scene(makeView({ phase: "discussion", role: "citizen", chat: "all" }));
    receive(r.chat, "all", 2, 1, "낮에 한 말", T0 + 10);
    r.rerender(makeView({ phase: "night", role: "citizen" }));
    expect(r.container.querySelector("[data-chat-log]")).toBeNull();
    expect(clean(r.container).traces).toEqual([]);
  });

  it("서버 채널(view.me.chat)이 화면의 의도와 다르면 패널을 그리지 않는다: 산 사람에게 ghost, 탈락자에게 all, 시민 밤의 mafia, 마피아 낮의 mafia", () => {
    expect(chatPanel(scene(makeView({ phase: "discussion", role: "citizen", chat: "ghost" })).container)).toBeNull();
    cleanup();
    expect(chatPanel(scene(makeView({ phase: "discussion", role: "citizen", dead: [0], chat: "all" })).container)).toBeNull();
    cleanup();
    expect(chatPanel(scene(makeView({ phase: "night", role: "citizen", chat: "mafia" })).container)).toBeNull();
    cleanup();
    expect(chatPanel(scene(makeView({ phase: "discussion", role: "mafia", chat: "mafia" })).container)).toBeNull();
    cleanup();
    // 마피아 밤에 서버가 all 을 보내면(어긋남) 마피아 모양으로 그리지 않는다
    expect(chatPanel(scene(makeView({ phase: "night", role: "mafia", chat: "all" })).container)).toBeNull();
  });
});

describe("탈락자 채팅 (CHAT-03, 채널 ghost)", () => {
  const ghostView = (phase: PhaseId, n = 1) => makeView({ phase, n, role: "citizen", dead: [0], chat: "ghost" });

  it("낮 토론·최후 변론·밤의 탈락자 하단은 ChatPanel(ghost): '유령 채팅 입력'·'유령끼리만 보여요'·입력칸 안 ghost 아이콘, 관전 알약이 아니다", () => {
    for (const phase of ["discussion", "defense", "night"] as const) {
      const { container: c } = scene({ ...ghostView(phase), day: { n: 1, roles: ["citizen"], candidate: 2 } });
      expect(chatPanel(c)?.getAttribute("data-chat-channel")).toBe("ghost");
      expect(input(c)?.getAttribute("aria-label")).toBe("유령 채팅 입력");
      expect(input(c)?.getAttribute("placeholder")).toBe("유령끼리만 보여요");
      expect(c.querySelector(".mv-chat__chan.is-ghost")).not.toBeNull();
      expect(panelEl(c).querySelector(".mf-ro")).toBeNull();
      cleanup();
    }
  });

  it("기록은 공개 줄 + 밤 마피아 줄(roleMafia 아이콘·진홍 이름) + 유령 줄(ghost 아이콘)이 시간 순 한 흐름이다", () => {
    const r = scene(ghostView("discussion"));
    receive(r.chat, "all", 2, 1, "낮 이야기", T0 + 100);
    receive(r.chat, "mafia", 1, 1, "밤 모의", T0 + 200);
    receive(r.chat, "ghost", 3, 1, "유령 수다", T0 + 300);
    const lines = logLines(r.container).filter((l) => l.kind === "player");
    expect(lines).toEqual([
      expect.objectContaining({ ch: "all", text: "낮 이야기", mark: "", mafiaName: false }),
      expect.objectContaining({ ch: "mafia", text: "밤 모의", mark: "mafia", mafiaName: true }),
      expect.objectContaining({ ch: "ghost", text: "유령 수다", mark: "ghost", mafiaName: false }),
    ]);
  });

  it("탈락했을 때(내 채널이 ghost 로 바뀐 렌더) ghost 아이콘 + '유령 채팅 · 산 사람에게 안 보여요' 시스템 줄이 한 번 생기고 다음 낮 토론에서 보인다", () => {
    const r = scene(makeView({ phase: "execVote", role: "citizen", chat: "all" }));
    vi.setSystemTime(T0 + 500);
    r.rerender(makeView({ phase: "morning", role: "citizen", dead: [0], chat: "ghost" }));
    r.rerender({ ...makeView({ phase: "morning", role: "citizen", dead: [0], chat: "ghost" }), serverNow: T0 + 600 });
    vi.setSystemTime(T0 + 1000);
    r.rerender(ghostView("discussion", 2));
    expect(logLines(r.container)).toEqual([{ kind: "system", text: "유령 채팅 · 산 사람에게 안 보여요", icon: ICON_GHOST }]);
  });

  it("탈락자의 밤마다 같은 유령 시작 줄이 생기고(밤으로 넘어오는 렌더), 밤의 마피아 시스템 줄은 만들지 않는다", () => {
    const r = scene(ghostView("discussion", 2));
    vi.setSystemTime(T0 + 1000);
    r.rerender(ghostView("night", 2));
    expect(sysTexts(r.container)).toEqual(["유령 채팅 · 산 사람에게 안 보여요"]);
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

describe("D1: 입력줄을 붙이지 않는 단계 (UI-SPEC D1, 리서치 Pitfall 14)", () => {
  const phases: PhaseId[] = ["dayAnnounce", "execVote", "candidateVote", "candidateVoteReveal", "execution", "morning"];
  for (const phase of phases) {
    it(`${phase}: 산 사람·탈락자 모두 ChatPanel·입력칸이 없다(서버가 채널을 보내도)`, () => {
      const alive = scene(makeView({ phase, role: "citizen", chat: "all", candidate: 2 }));
      expect(chatPanel(alive.container)).toBeNull();
      expect(input(alive.container)).toBeNull();
      cleanup();
      const dead = scene(makeView({ phase, role: "citizen", dead: [0], chat: "ghost", candidate: 2 }));
      expect(chatPanel(dead.container)).toBeNull();
      expect(input(dead.container)).toBeNull();
    });
  }

  it("그 단계에 서버가 보낸 줄은 저장소에 쌓였다가 다음 낮 토론에서 보인다", () => {
    const r = scene(makeView({ phase: "execVote", role: "citizen", chat: "all" }));
    receive(r.chat, "all", 2, 1, "투표 중에 한 말", T0 + 50);
    expect(screen.queryByText("투표 중에 한 말")).toBeNull();
    r.rerender(makeView({ phase: "discussion", n: 2, role: "citizen", chat: "all" }));
    expect(logLines(r.container).map((l) => l.text)).toEqual(["투표 중에 한 말"]);
  });

  it("탈락자의 투표 단계 하단은 기존 관전 하단(읽기 전용)이다", () => {
    const { container: c } = scene(makeView({ phase: "execVote", role: "citizen", dead: [0], chat: "ghost" }));
    expect(c.querySelector("[data-chat-panel]")).toBeNull();
  });

  it("화면 파일에 임시 입력줄이 없다: 투표·공개·처형·아침 장면은 ChatPanel 을 가져오지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/components/ExecVotePanel.tsx", "src/components/CandidateVotePanel.tsx", "src/components/MorningCard.tsx", "src/components/NoExecutionCard.tsx", "src/components/RevealLayer.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/ChatPanel|useChat/);
    }
  });
});

describe("최후 변론 시작 줄은 낮 토론 채널에 섞이지 않는다", () => {
  it("변론 시작 시스템 줄은 공개 줄이라 밤 마피아 기록에는 보이지 않는다", () => {
    const r = scene({ ...makeView({ phase: "candidateVoteReveal", role: "mafia", chat: "all" }), day: { n: 1, roles: ["mafia"], candidate: 2 } });
    r.rerender({ ...makeView({ phase: "defense", role: "mafia", chat: "all" }), day: { n: 1, roles: ["mafia"], candidate: 2 } });
    expect(sysTexts(r.container)).toEqual(["민지 님이 변론하는 중"]);
    r.rerender(makeView({ phase: "night", role: "mafia", chat: "mafia" }));
    expect(sysTexts(r.container)).toEqual(["밤 · 마피아 채팅"]);
  });
});
