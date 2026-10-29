/// <reference types="node" />
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { MorningView, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// UX-01 (D-08, D-09): 모든 단계 화면에는 "지금 할 일 한 문장" 요소가 `data-guide` 로 정확히 하나 있다.
// 이 파일은 방 화면(RoomScreen)을 실제로 그려 14단계 × 시점 점검표(05-UI-SPEC 8)를 고정한다.
// 새 문장은 역할로 달라지지 않는다(T-05-01): 속성 값은 빈 문자열이고 4역할·관전자가 같은 글자를 본다.

const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const preloadMock = vi.hoisted(() => vi.fn());
const preloadDuskMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/net/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/net/assets")>()),
  preloadRoleAssets: preloadMock,
  preloadDuskAssets: preloadDuskMock,
}));

const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { PHASE_GUIDE_FILL } = await import("../../src/game/scenes");

const NOW = 1_700_000_000_000;

type Viewpoint = "mafia" | "police" | "doctor" | "citizen" | "spectator";
const ROLE_OF: Readonly<Record<Exclude<Viewpoint, "spectator">, RoleId>> = { mafia: "mafia", police: "police", doctor: "doctor", citizen: "citizen" };

interface ViewOpts {
  phase: PhaseId;
  viewpoint?: Viewpoint;
  endsIn?: number | null;
  day?: number;
  turn?: number;
  morning?: MorningView;
  isHost?: boolean;
}

function makeView(o: ViewOpts): RoomView {
  const vp = o.viewpoint ?? "citizen";
  const me: RoomView["me"] = { seat: 0, isHost: o.isHost ?? false };
  // 관전자도 탈락 전 역할은 있었다. 역할 값은 서버가 보낸 대로 view 에 두되 화면 문장에는 쓰이지 않는다.
  me.role = vp === "spectator" ? "citizen" : ROLE_OF[vp];
  if (vp === "mafia") me.allies = [2];
  const endsIn = o.endsIn === undefined ? 15_000 : o.endsIn;
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: endsIn === null ? null : NOW + endsIn,
    phaseDurationMs: endsIn === null ? null : 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ].map((p) => (p.seat === 0 && vp === "spectator" ? { ...p, alive: false } : p)),
    me,
    day: {
      n: o.day ?? 1,
      roles: ["mafia", "police", "citizen"],
      ...(o.turn !== undefined ? { turn: { seat: o.turn } } : {}),
      claimLog: [],
      ...(o.morning !== undefined ? { morning: o.morning } : {}),
    },
  };
}

function conn(view: RoomView): RoomConnection {
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
  };
}

function renderRoom(view: RoomView) {
  connectionMock.current = conn(view);
  return render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
}

const squish = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

function guides(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-guide]"));
}

/** `[data-guide]` 가 정확히 하나여야 하는 칸. 실패 메시지에 단계/시점이 들어간다 */
function onlyGuide(container: HTMLElement, cell: string): HTMLElement {
  const found = guides(container);
  expect(found.length, `${cell}: [data-guide] 개수`).toBe(1);
  return found[0]!;
}

beforeEach(() => {
  preloadMock.mockClear();
  preloadDuskMock.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ALL_VIEWPOINTS: readonly Viewpoint[] = ["mafia", "police", "doctor", "citizen", "spectator"];

describe("UX-01 트레이서: 낮 시작·낮 토론 빈 칸 두 곳 (D-08, D-09)", () => {
  it("dayAnnounce 시민 생존: [data-guide] 하나 = `낮이 되었어요`, 하단 패널에 `곧 직업 공개가 시작돼요`", () => {
    const { container } = renderRoom(makeView({ phase: "dayAnnounce", viewpoint: "citizen", endsIn: 2_000 }));
    const g = onlyGuide(container, "dayAnnounce/citizen");
    expect(squish(g.textContent)).toBe(PHASE_GUIDE_FILL.dayAnnounce.title);
    expect(squish(g.textContent)).toBe("낮이 되었어요");
    expect(squish(container.querySelector(".mf-dayscene__panel")?.textContent)).toContain("곧 직업 공개가 시작돼요");
  });

  it("dayAnnounce 탈락 관전자도 같은 두 줄이고 [data-guide] 하나다", () => {
    const { container } = renderRoom(makeView({ phase: "dayAnnounce", viewpoint: "spectator", endsIn: 2_000 }));
    const g = onlyGuide(container, "dayAnnounce/spectator");
    expect(squish(g.textContent)).toBe("낮이 되었어요");
    expect(squish(container.querySelector(".mf-dayscene__panel")?.textContent)).toContain("곧 직업 공개가 시작돼요");
  });

  it("dayAnnounce 의 [data-guide] 글자가 마피아·경찰·의사·시민·관전자에서 모두 같다", () => {
    const texts = new Set<string>();
    for (const vp of ALL_VIEWPOINTS) {
      const { container, unmount } = renderRoom(makeView({ phase: "dayAnnounce", viewpoint: vp, endsIn: 2_000 }));
      texts.add(`${squish(onlyGuide(container, `dayAnnounce/${vp}`).textContent)}|${squish(container.querySelector(".mf-nightpanel .mf-claimpanel__guide")?.textContent)}`);
      unmount();
    }
    expect([...texts]).toEqual(["낮이 되었어요|곧 직업 공개가 시작돼요"]);
  });

  it("discussion 생존 4역할: [data-guide] 는 `.mf-phasebar__do` 하나이고 `1일차 · 의견을 나눠요`", () => {
    for (const vp of ["mafia", "police", "doctor", "citizen"] as const) {
      const { container, unmount } = renderRoom(makeView({ phase: "discussion", viewpoint: vp, endsIn: 90_000 }));
      const g = onlyGuide(container, `discussion/${vp}`);
      expect(g.classList.contains("mf-phasebar__do"), `discussion/${vp}`).toBe(true);
      expect(squish(g.textContent), `discussion/${vp}`).toBe("1일차 · 의견을 나눠요");
      unmount();
    }
  });

  it("discussion 탈락 관전자: 헤더 안내줄은 `1일차`, [data-guide] 는 `p.mf-ro`(`탈락했어요 · 볼 수만 있어요`) 하나", () => {
    const { container } = renderRoom(makeView({ phase: "discussion", viewpoint: "spectator", endsIn: 90_000 }));
    expect(squish(container.querySelector(".mf-phasebar__do")?.textContent)).toBe("1일차");
    const g = onlyGuide(container, "discussion/spectator");
    expect(g.tagName).toBe("P");
    expect(g.classList.contains("mf-ro")).toBe(true);
    expect(squish(g.textContent)).toBe("탈락했어요 · 볼 수만 있어요");
  });

  it("data-guide 속성 값은 빈 문자열이다 (역할·자리 정보를 싣지 않는다)", () => {
    for (const phase of ["dayAnnounce", "discussion"] as const) {
      for (const vp of ALL_VIEWPOINTS) {
        const { container, unmount } = renderRoom(makeView({ phase, viewpoint: vp }));
        expect(onlyGuide(container, `${phase}/${vp}`).getAttribute("data-guide"), `${phase}/${vp}`).toBe("");
        unmount();
      }
    }
  });
});
