/// <reference types="node" />
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, MorningView, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// UX-01 (D-08, D-09): 모든 단계 화면에는 "지금 할 일 한 문장" 요소가 `data-guide` 로 정확히 하나 있다.
// 이 파일은 방 화면(RoomScreen)을 실제로 그려 단계 × 시점 점검표(05-UI-SPEC 8)를 고정한다. 08-27: 낮 시작~아침은 맵 화면(GameMap) 기준이다.
// 예외(08-UI-SPEC 단계표 '안내 없음'): 낮 시작·처형·아침의 산 사람 화면은 [data-guide] 가 0개이고, 유령만 헤더 안내 하나다(08-18).
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

// 06-15: 대기실은 맵(WorldStage) 위에 그려진다. 캔버스·런타임은 worldStage.test 가 보므로 여기서는 가짜로 바꾼다(lobby.test.tsx 와 같은 모양).
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));

const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { TIMELESS_PHASES } = await import("../../src/game/scenes");

const NOW = 1_700_000_000_000;

type Viewpoint = "mafia" | "police" | "doctor" | "citizen" | "spectator";
const ROLE_OF: Readonly<Record<Exclude<Viewpoint, "spectator">, RoleId>> = { mafia: "mafia", police: "police", doctor: "doctor", citizen: "citizen" };

interface ViewOpts {
  phase: PhaseId;
  viewpoint?: Viewpoint;
  endsIn?: number | null;
  day?: number;
  morning?: MorningView;
  isHost?: boolean;
  /** 변론·찬반·처형 단계의 변론자 좌석 */
  candidate?: number;
  /** 처형 없이 온 밤 */
  noExecution?: "tie" | "noVotes";
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
      ...(o.morning !== undefined ? { morning: o.morning } : {}),
      ...(o.candidate !== undefined ? { candidate: o.candidate } : {}),
      ...(o.noExecution !== undefined ? { noExecution: { reason: o.noExecution } } : {}),
    },
  } as RoomView;
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

// 낮 시작·낮 토론·변론·처형은 08-13 부터 맵 화면(GameMap)이다 — 옛 테이블 화면의 안내 요소 시험은 이 자리에서 뺐다.
// 맵 화면의 헤더 안내(`.mv-phase__hint[data-guide]`)는 gameMap.test.tsx 가 본다. 나머지 단계(밤·아침·옛 투표)의 시험은 아래에 그대로 있다.

// ---- 05-01 Task 2: 밤·아침·투표 구간 (부품이 data-guide 를 맡는다) ----

// 밤·아침은 맵 화면(GameMap)이다. 밤 안내는 역할마다 헤더 안내 줄(.mv-phase__hint) 하나다(09-15: 경찰·의사·시민도 헤더, 밤 알약 패널은 지웠다).
// 아침은 UI-SPEC 단계표에 안내가 없다(알림 + 채팅): 산 사람 화면에는 [data-guide] 가 0개이고 유령만 헤더 안내가 있다.
describe("UX-01 맵 화면: night·morning (D-08, 08-18)", () => {
  it("night 경찰·의사·시민·마피아는 역할별 헤더 안내 하나, 탈락은 헤더 `모두의 직업과 밤 행동이 보여요`", () => {
    const expected: Readonly<Record<Viewpoint, string>> = {
      police: "조사할 사람을 골라요",
      doctor: "지킬 사람을 골라요",
      citizen: "날이 밝길 기다려요",
      mafia: "대상에게 다가가요",
      spectator: "모두의 직업과 밤 행동이 보여요",
    };
    for (const vp of ALL_VIEWPOINTS) {
      const { container, unmount } = renderRoom(makeView({ phase: "night", viewpoint: vp, endsIn: 30_000 }));
      expect(squish(onlyGuide(container, `night/${vp}`).textContent), `night/${vp}`).toBe(expected[vp]);
      expect(container.querySelectorAll('[role="timer"]').length, `night/${vp}: 타이머`).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it("morning: 산 사람 화면은 안내 요소가 없고(UI-SPEC 단계표), 유령은 헤더 `모두의 직업이 보여요` 하나", () => {
    for (const vp of ALL_VIEWPOINTS) {
      const { container, unmount } = renderRoom(makeView({ phase: "morning", viewpoint: vp, endsIn: 5_000, day: 1 }));
      if (vp === "spectator") expect(squish(onlyGuide(container, "morning/spectator").textContent)).toBe("모두의 직업이 보여요");
      else expect(guides(container).length, `morning/${vp}`).toBe(0);
      expect(container.querySelectorAll('[role="timer"]').length, `morning/${vp}: 타이머`).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });
});

// execVote·candidateVote·candidateVoteReveal(옛 투표 세 단계)의 안내 시험은 08-27 에서 지웠다 — 맵 화면으로 대체된 v1.0 부품(제목 h2·후보 선택 안내 줄)만 보던 시험이다.
describe("UX-01 처형 없이 온 밤 (맵 화면, 08-18)", () => {
  it("처형 무효로 온 밤: 마피아 하나 = 헤더 `대상에게 다가가요`, 시민 하나 = 헤더 `날이 밝길 기다려요`", () => {
    const mafia = renderRoom(makeView({ phase: "night", viewpoint: "mafia", endsIn: 30_000, noExecution: "tie" }));
    const gm = onlyGuide(mafia.container, "noExecution/마피아");
    expect(gm.classList.contains("mv-phase__hint")).toBe(true);
    expect(squish(gm.textContent)).toBe("대상에게 다가가요");
    mafia.unmount();
    const citizen = renderRoom(makeView({ phase: "night", viewpoint: "citizen", endsIn: 30_000, noExecution: "noVotes" }));
    const gc = onlyGuide(citizen.container, "noExecution/시민");
    expect(squish(gc.textContent)).toBe("날이 밝길 기다려요");
    expect(gc.classList.contains("mv-phase__hint")).toBe(true);
  });
});

// ---- 05-01 Task 3: 대기실·배정·역할 확인·결과 + 14단계 × 시점 점검표 (D-08, D-09, P5-5) ----

/** 시점: 역할 넷 + 관전자, 그리고 역할이 아직 없는 단계의 한 칸(none) */
type CheckViewpoint = Viewpoint | "none";

/**
 * 점검표(05-UI-SPEC 8): 화면이 그리는 PhaseId × 시점. 낮 시작~아침은 맵 화면(GameMap)의 헤더 안내다.
 * 있을 수 없는 칸은 적지 않는다 — lobby·assigning 은 역할이 없어 none 한 칸, roleReveal 은 살아 있는 사람뿐(관전 없음).
 * 이 목록은 PhaseId 의 부분집합이어야 한다(satisfies).
 */
const CHECKED_PHASES = [
  "lobby",
  "assigning",
  "roleReveal",
  "dayAnnounce",
  "discussion",
  "nomination",
  "defense",
  "verdict",
  "execution",
  "night",
  "morning",
  "ended",
] as const satisfies readonly PhaseId[];
type CheckedPhase = (typeof CHECKED_PHASES)[number];

const CHECKLIST: Readonly<Record<CheckedPhase, readonly CheckViewpoint[]>> = {
  lobby: ["none"],
  assigning: ["none"],
  roleReveal: ["mafia", "police", "doctor", "citizen"],
  dayAnnounce: ["mafia", "police", "doctor", "citizen", "spectator"],
  discussion: ["mafia", "police", "doctor", "citizen", "spectator"],
  nomination: ["mafia", "police", "doctor", "citizen", "spectator"],
  defense: ["mafia", "police", "doctor", "citizen", "spectator"],
  verdict: ["mafia", "police", "doctor", "citizen", "spectator"],
  execution: ["mafia", "police", "doctor", "citizen", "spectator"],
  night: ["mafia", "police", "doctor", "citizen", "spectator"],
  morning: ["mafia", "police", "doctor", "citizen", "spectator"],
  ended: ["mafia", "police", "doctor", "citizen", "spectator"],
};

/** 끝난 판의 view: 결과(승리 팀·좌석 직업)가 실린다 */
function endedView(vp: Viewpoint, winner: GameWinner = "citizenWin"): RoomView {
  const view = makeView({ phase: "ended", viewpoint: vp, endsIn: null });
  view.result = {
    winner,
    seats: view.players.map((p) => ({ seat: p.seat, job: p.seat === 2 ? ("mafia" as const) : ("citizen" as const) })),
    summary: [],
  };
  return view;
}

/** 칸 하나를 그린다. 결과는 endedView, 나머지는 이 파일의 makeView(변론·찬반·처형 단계는 좌석 2 가 변론자) */
function renderCell(phase: CheckedPhase, vp: CheckViewpoint) {
  if (phase === "ended") return renderRoom(endedView(vp === "none" ? "citizen" : vp));
  const viewpoint: Viewpoint = vp === "none" ? "citizen" : vp;
  const endsIn = phase === "lobby" || phase === "dayAnnounce" ? null : phase === "assigning" ? 3_000 : phase === "morning" ? 5_000 : 15_000;
  const withCandidate = phase === "defense" || phase === "verdict" || phase === "execution";
  const view = makeView({ phase, viewpoint, endsIn, day: 1, ...(withCandidate ? { candidate: 2 } : {}), ...(phase === "morning" ? { morning: {} } : {}) });
  if (vp === "none") delete view.me.role;
  return renderRoom(view);
}

/** 맵 화면에서 UI-SPEC 단계표가 산 사람에게 안내를 두지 않는 단계. 유령은 어느 단계에서나 헤더 안내가 있다(`모두의 직업이 보여요`) */
const GUIDELESS_WHEN_ALIVE: ReadonlySet<CheckedPhase> = new Set<CheckedPhase>(["dayAnnounce", "execution", "morning"]);
/** 맵 화면 중 시간 링이 없는 단계(낮 시작) */
const NO_CLOCK: ReadonlySet<CheckedPhase> = new Set<CheckedPhase>(["dayAnnounce"]);

describe("UX-01 점검표: 단계 × 시점 모든 칸의 안내 문장과 남은 시간 (D-08, 05-UI-SPEC 8.4, 08-27 맵 화면 기준)", () => {
  const phases = Object.keys(CHECKLIST) as CheckedPhase[];

  it("점검표가 화면이 그리는 12단계(대기실·배정·역할 확인·낮 시작~아침 8단계·결과)를 모두 가진다", () => {
    expect(phases.length).toBe(12);
    expect([...CHECKED_PHASES].sort()).toEqual([...phases].sort());
  });

  for (const phase of phases) {
    for (const vp of CHECKLIST[phase]) {
      const none = GUIDELESS_WHEN_ALIVE.has(phase) && vp !== "spectator" && vp !== "none";
      const clock = TIMELESS_PHASES.includes(phase) || NO_CLOCK.has(phase) ? "타이머 없어도 됨" : "타이머 있음";
      it(`${phase}/${vp}: ${none ? "[data-guide] 0개(단계표에 안내 없음)" : "[data-guide] 정확히 하나·글자 있음·값 빈 문자열"}, ${clock}`, () => {
        const { container } = renderCell(phase, vp);
        const cell = `${phase}/${vp}`;
        if (none) expect(guides(container).length, `${cell}: [data-guide] 개수`).toBe(0);
        else {
          const g = onlyGuide(container, cell);
          expect(squish(g.textContent), `${cell}: 안내 글자`).not.toBe("");
          expect(g.getAttribute("data-guide"), `${cell}: 속성 값`).toBe("");
        }
        if (!TIMELESS_PHASES.includes(phase) && !NO_CLOCK.has(phase)) {
          expect(container.querySelectorAll('[role="timer"]').length, `${cell}: 타이머`).toBeGreaterThanOrEqual(1);
        }
      });
    }
  }
});

describe("UX-01 대기실·배정·역할 확인·결과의 안내 요소 (D-08)", () => {
  it("lobby 방장·손님: [data-guide] 는 헤더 안내 한 줄(`.mv-phase__hint` '바닥을 눌러 걸어요') 하나이고 글자가 비어 있지 않다", () => {
    for (const isHost of [true, false]) {
      const view = makeView({ phase: "lobby", endsIn: null, isHost });
      delete view.me.role;
      const { container, unmount } = renderRoom(view);
      const g = onlyGuide(container, `lobby/${isHost ? "방장" : "손님"}`);
      expect(g.classList.contains("mv-phase__hint")).toBe(true);
      expect(g.closest(".mf-lobby__header")).not.toBeNull();
      expect(squish(g.textContent)).toBe("바닥을 눌러 걸어요");
      unmount();
    }
  });

  it("assigning: 하나 = `직업을 배정하고 있습니다…`", () => {
    const { container } = renderRoom(makeView({ phase: "assigning", endsIn: 3_000 }));
    expect(squish(onlyGuide(container, "assigning").textContent)).toBe("직업을 배정하고 있습니다…");
  });

  it("roleReveal: 하나 = `.mf-reveal__hint`", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", viewpoint: "police", endsIn: 15_000 }));
    expect(onlyGuide(container, "roleReveal").classList.contains("mf-reveal__hint")).toBe(true);
  });

  it("ended: 하나 = 배너 제목 `시민 팀 승리` 또는 `마피아 팀 승리` (생존·관전 모두)", () => {
    for (const [winner, title] of [
      ["citizenWin", "시민 팀 승리"],
      ["mafiaWin", "마피아 팀 승리"],
    ] as const) {
      for (const vp of ["citizen", "spectator"] as const) {
        const { container, unmount } = renderRoom(endedView(vp, winner));
        const g = onlyGuide(container, `ended/${winner}/${vp}`);
        expect(g.classList.contains("mf-result__banner-title")).toBe(true);
        expect(squish(g.textContent)).toBe(title);
        unmount();
      }
    }
  });
});
