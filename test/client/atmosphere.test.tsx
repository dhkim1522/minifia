/// <reference types="node" />
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, MorningView, PhaseId, RoomView, SpectateView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { SCENE_FADE_MS, SCENE_IMAGE_WAIT_MS, nightVignetteGradient } from "../../src/game/scenes";
import { DayScene } from "../../src/screens/DayScene";
import { ResultScreen } from "../../src/screens/ResultScreen";

// 분위기 두 층(05-03, LOOK-01, D-04·D-05·D-09): 밤 비네팅은 night 그림 층 안에, 아침 밝아짐은 장면 상자 안 DayTable 앞 형제로 있다.
// 어느 단계·전환·재접속에서 몇 개인지, 역할·관전 여부가 마크업을 바꾸지 않음을 단언한다. 단언은 문자열·불리언으로 둔다.

const NOW = 10_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연"];

interface ViewOpts {
  phase?: PhaseId;
  role?: RoleId;
  allies?: number[];
  dead?: number[];
  morning?: MorningView;
  spectate?: SpectateView;
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  const dead = o.dead ?? [];
  const phase = o.phase ?? "night";
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (phase === "morning" ? 5_000 : 30_000),
    phaseDurationMs: phase === "morning" ? 5_000 : 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, alive: !dead.includes(seat) })),
    me,
    day: { n: 1, roles: ["mafia", "police", "doctor", "citizen"], claimLog: [] },
  };
  if (o.morning !== undefined && view.day) view.day.morning = o.morning;
  if (o.spectate) view.spectate = o.spectate;
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

function scene(view: RoomView, over: Partial<RoomConnection> = {}) {
  const c = conn(view, over);
  const role = <button type="button">내 역할</button>;
  const utils = render(<DayScene view={view} connection={c} myRoleButton={role} />);
  const rerender = (v: RoomView) => utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} myRoleButton={role} />);
  return { ...utils, rerender };
}

const vignettes = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".mf-backdrop__vignette")];
const parentArt = (el: HTMLElement) => el.parentElement as HTMLElement;
const flush = async () => {
  const { act } = await import("@testing-library/react");
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
const advance = async (ms: number) => {
  const { act } = await import("@testing-library/react");
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

function stubImages() {
  class FakeImage {
    src = "";
    decode(): Promise<void> {
      return Promise.resolve();
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  stubImages();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("밤 비네팅 — 어디에 몇 개 (D-04·D-05, P5-1)", () => {
  it("밤 렌더(재접속처럼 첫 렌더가 밤): 비네팅이 정확히 1개이고 data-scene=night 인 그림 층의 자식이며 --mf-vignette 가 상수 함수 결과다", () => {
    const { container } = scene(makeView({ phase: "night", role: "citizen" }));
    const v = vignettes(container);
    expect(v.length).toBe(1);
    const art = parentArt(v[0]!);
    expect(art.classList.contains("mf-backdrop__art")).toBe(true);
    expect(art.dataset.scene).toBe("night");
    expect(v[0]!.style.getPropertyValue("--mf-vignette")).toBe(nightVignetteGradient());
    expect(v[0]!.getAttribute("aria-hidden") === "true" || art.getAttribute("aria-hidden") === "true").toBe(true);
  });

  it("night 가 아닌 DayScene 단계(dayAnnounce·claim·discussion·morning·execVote)에는 0개", () => {
    const phases: PhaseId[] = ["dayAnnounce", "claim", "discussion", "morning", "execVote"];
    const counts = phases.map((phase) => {
      const r = scene(makeView({ phase, role: "citizen", ...(phase === "morning" ? { morning: {} } : {}) }));
      const n = vignettes(r.container).length;
      r.unmount();
      return `${phase}:${n}`;
    });
    expect(counts.join(",")).toBe("dayAnnounce:0,claim:0,discussion:0,morning:0,execVote:0");
  });

  it("결과 화면(ended, 같은 night 그림)에는 0개", () => {
    const seats = NAMES.map((_, seat) => ({ seat, job: (seat === 3 ? "mafia" : "citizen") as RoleId }));
    const view = {
      ...makeView({ phase: "ended", role: "citizen" }),
      result: { winner: "citizenWin" as GameWinner, seats, summary: [] },
    } as RoomView & { result: NonNullable<RoomView["result"]> };
    const { container } = render(<ResultScreen view={view} onExit={() => {}} />);
    expect(container.querySelector('.mf-backdrop__art[data-scene="night"]') !== null).toBe(true);
    expect(vignettes(container).length).toBe(0);
  });

  it("discussion → night: 새 night 층(entering → current) 안에 1개. 이어서 morning 으로 가면 걷히는 night 층 안에만 남았다가 층이 걷히면 0개", async () => {
    const r = scene(makeView({ phase: "discussion", role: "citizen" }));
    expect(vignettes(r.container).length).toBe(0);
    r.rerender(makeView({ phase: "night", role: "citizen" }));
    expect(vignettes(r.container).length).toBe(1);
    expect(parentArt(vignettes(r.container)[0]!).dataset.state).toBe("entering");
    await flush();
    expect(vignettes(r.container).length).toBe(1);
    expect(parentArt(vignettes(r.container)[0]!).dataset.state).toBe("current");

    r.rerender(makeView({ phase: "morning", role: "citizen", morning: {} }));
    await flush();
    const left = vignettes(r.container);
    expect(left.length).toBe(1);
    expect(`${parentArt(left[0]!).dataset.scene}:${parentArt(left[0]!).dataset.state}`).toBe("night:leaving");
    await advance(SCENE_FADE_MS + 100);
    expect(vignettes(r.container).length).toBe(0);
    await advance(SCENE_IMAGE_WAIT_MS);
    expect(vignettes(r.container).length).toBe(0);
  });

  it("4역할·관전자 viewer 의 밤 렌더에서 비네팅 요소의 마크업이 같다 (D-09, T-05-07)", () => {
    const spectate: SpectateView = { seats: NAMES.map((_, seat) => ({ seat, job: seat === 1 ? "mafia" : "citizen" })) };
    const cases: Array<[string, ViewOpts]> = [
      ["citizen", { role: "citizen" }],
      ["mafia", { role: "mafia", allies: [1] }],
      ["police", { role: "police" }],
      ["doctor", { role: "doctor" }],
      ["spectator", { role: "citizen", dead: [0], spectate }],
    ];
    const html = cases.map(([name, o]) => {
      const r = scene(makeView({ phase: "night", ...o }));
      const v = vignettes(r.container);
      const out = `${v.length}|${v[0]?.outerHTML ?? ""}`;
      r.unmount();
      return [name, out] as const;
    });
    const first = html[0]![1];
    expect(first.startsWith("1|")).toBe(true);
    expect(html.filter(([, h]) => h !== first).map(([n]) => n).join(",")).toBe("");
  });
});
