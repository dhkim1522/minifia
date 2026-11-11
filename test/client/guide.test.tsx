/// <reference types="node" />
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, MorningView, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 14페이즈(결정 0073): 모든 방 화면에는 "지금 할 일 한 문장" 표식 `data-guide` 가 정확히 하나이고, 그것은 자막 띠의 문장(`<p data-host-line>`)이다.
// 이 파일은 방 화면(RoomScreen)을 실제로 그려 단계 × 시점 점검표를 고정한다. 08-18 의 "산 사람 안내 0개" 예외는 없어졌다(띠는 어느 단계에서나 한 줄을 말한다).
// 역할에 따라 달라지는 것은 밤 할 일 줄(마피아·경찰·의사)뿐이다. 그 줄은 내 역할 화면에만 있고 다른 역할 화면 DOM 에는 없다(HOST-05, T-14-06).
// 속성 값은 빈 문자열이다(T-14-07): 역할·좌석 값이 없다.

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
const { HOST_LINES, hostLineOf } = await import("../../src/game/hostLine");

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

// ---- 밤·아침: 띠 문장이 지금 할 일이다. 역할 줄은 밤뿐이고 그 줄은 내 화면에만 있다 ----

describe("UX-01 띠 문장: night·morning (14-02)", () => {
  it("night: 마피아·경찰·의사는 자기 줄, 시민은 이름표 줄, 탈락은 유령 줄 — 모두 띠 안 [data-guide] 하나", () => {
    const expected: Readonly<Record<Viewpoint, string>> = {
      mafia: HOST_LINES["night.mafia"] as string,
      police: HOST_LINES["night.police"] as string,
      doctor: HOST_LINES["night.doctor"] as string,
      citizen: HOST_LINES["night.citizen"] as string,
      spectator: HOST_LINES["night.ghost"] as string,
    };
    for (const vp of ALL_VIEWPOINTS) {
      const { container, unmount } = renderRoom(makeView({ phase: "night", viewpoint: vp, endsIn: 30_000 }));
      const g = onlyGuide(container, `night/${vp}`);
      expect(g.closest("[data-host-band]"), `night/${vp}: 띠 안`).not.toBeNull();
      expect(squish(g.textContent), `night/${vp}`).toBe(expected[vp]);
      expect(container.querySelectorAll('[role="timer"]').length, `night/${vp}: 타이머`).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it("morning: 산 사람과 유령 모두 띠 문장 하나(08-18 의 '산 사람 안내 0개' 예외는 없어졌다)", () => {
    for (const vp of ALL_VIEWPOINTS) {
      const { container, unmount } = renderRoom(makeView({ phase: "morning", viewpoint: vp, endsIn: 5_000, day: 1, morning: {} }));
      const g = onlyGuide(container, `morning/${vp}`);
      expect(g.closest("[data-host-band]"), `morning/${vp}: 띠 안`).not.toBeNull();
      expect(container.querySelectorAll('[role="timer"]').length, `morning/${vp}: 타이머`).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });
});

describe("18.1-12 띠 한 구절 (0083-8)", () => {
  it("토론·밤: 띠 문장은 앞말 없는 한 구절이고 띠 안에 종 아이콘(svg)이 없다", () => {
    const discussion = renderRoom(makeView({ phase: "discussion", viewpoint: "citizen", endsIn: 90_000 }));
    expect(squish(onlyGuide(discussion.container, "discussion").textContent)).toBe("의심 가는 사람을 이야기해 주세요");
    expect(discussion.container.querySelectorAll("[data-host-band] svg")).toHaveLength(0);
    discussion.unmount();
    const night = renderRoom(makeView({ phase: "night", viewpoint: "police", endsIn: 30_000 }));
    expect(squish(onlyGuide(night.container, "night").textContent)).toBe("조사할 사람의 얼굴을 눌러 주세요");
    expect(night.container.querySelectorAll("[data-host-band] svg")).toHaveLength(0);
  });

  it("처형·아침: 띠 문장은 빈 글(큰 글이 말한다)이고 [data-guide] 는 그래도 하나다 — 모든 시점", () => {
    for (const phase of ["execution", "morning"] as const) {
      for (const vp of ALL_VIEWPOINTS) {
        const { container, unmount } = renderCell(phase, vp);
        expect(squish(onlyGuide(container, `${phase}/${vp}`).textContent), `${phase}/${vp}`).toBe("");
        unmount();
      }
    }
  });
});

describe("UX-01 처형 없이 온 밤 (14-02)", () => {
  it("처형 무효로 온 밤: 마피아 하나 = 마피아 줄, 시민 하나 = 시민 줄(모두 띠 안)", () => {
    const mafia = renderRoom(makeView({ phase: "night", viewpoint: "mafia", endsIn: 30_000, noExecution: "tie" }));
    const gm = onlyGuide(mafia.container, "noExecution/마피아");
    expect(gm.hasAttribute("data-host-line")).toBe(true);
    expect(squish(gm.textContent)).toBe(HOST_LINES["night.mafia"]);
    mafia.unmount();
    const citizen = renderRoom(makeView({ phase: "night", viewpoint: "citizen", endsIn: 30_000, noExecution: "noVotes" }));
    const gc = onlyGuide(citizen.container, "noExecution/시민");
    expect(squish(gc.textContent)).toBe(HOST_LINES["night.citizen"]);
    expect(gc.hasAttribute("data-host-line")).toBe(true);
  });
});

// ---- 대기실·배정·역할 확인·결과 + 단계 × 시점 점검표 ----

/** 시점: 역할 넷 + 관전자, 그리고 역할이 아직 없는 단계의 한 칸(none) */
type CheckViewpoint = Viewpoint | "none";

/**
 * 점검표: 화면이 그리는 PhaseId × 시점. 낮 시작~아침은 맵 화면(GameMap)이다.
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

/** 칸 하나의 view. 결과는 endedView, 나머지는 이 파일의 makeView(변론·찬반·처형 단계는 좌석 2 가 변론자) */
function cellView(phase: CheckedPhase, vp: CheckViewpoint): RoomView {
  if (phase === "ended") return endedView(vp === "none" ? "citizen" : vp);
  const viewpoint: Viewpoint = vp === "none" ? "citizen" : vp;
  const endsIn = phase === "lobby" || phase === "dayAnnounce" ? null : phase === "assigning" ? 3_000 : phase === "morning" ? 5_000 : 15_000;
  const withCandidate = phase === "defense" || phase === "verdict" || phase === "execution";
  const view = makeView({ phase, viewpoint, endsIn, day: 1, ...(withCandidate ? { candidate: 2 } : {}), ...(phase === "morning" ? { morning: {} } : {}) });
  if (vp === "none") delete view.me.role;
  // 09.1: 지목은 서버가 항상 day.turn 을 보낸다 — 모이는 중이면 헤더 안내 '모이는 중' 이 있다
  if (phase === "nomination") view.day!.turn = { order: [0, 1, 2, 3], i: -1 };
  return view;
}

function renderCell(phase: CheckedPhase, vp: CheckViewpoint) {
  const view = cellView(phase, vp);
  return { view, ...renderRoom(view) };
}

/** 맵 화면 중 시간 링이 없는 단계(낮 시작) */
const NO_CLOCK: ReadonlySet<CheckedPhase> = new Set<CheckedPhase>(["dayAnnounce"]);

describe("UX-01 점검표: 단계 × 시점 모든 칸의 띠 문장과 남은 시간 (14-02)", () => {
  const phases = Object.keys(CHECKLIST) as CheckedPhase[];

  it("점검표가 화면이 그리는 12단계(대기실·배정·역할 확인·낮 시작~아침 8단계·결과)를 모두 가진다", () => {
    expect(phases.length).toBe(12);
    expect([...CHECKED_PHASES].sort()).toEqual([...phases].sort());
  });

  for (const phase of phases) {
    for (const vp of CHECKLIST[phase]) {
      const clock = TIMELESS_PHASES.includes(phase) || NO_CLOCK.has(phase) ? "타이머 없어도 됨" : "타이머 있음";
      it(`${phase}/${vp}: [data-guide] 정확히 하나·띠 안·글자 = hostLineOf·값 빈 문자열, ${clock}`, () => {
        const { container, view } = renderCell(phase, vp);
        const cell = `${phase}/${vp}`;
        const g = onlyGuide(container, cell);
        expect(g.closest("[data-host-band]"), `${cell}: 띠 안`).not.toBeNull();
        expect(g.hasAttribute("data-host-line"), `${cell}: 띠 문장 칸`).toBe(true);
        expect(squish(g.textContent), `${cell}: 안내 글자`).toBe(hostLineOf(view, { cardSeen: false }));
        expect(g.getAttribute("data-guide"), `${cell}: 속성 값`).toBe("");
        expect(g.getAttribute("data-host-line"), `${cell}: 띠 속성 값`).toBe("");
        if (phase === "nomination") {
          // 09.1-07: 지목 점검 칸은 모이는 중이다 — 헤더 링은 차례 중·확정에만 있다(UI-SPEC A-1). 차례 중 링은 nominationScreen 시험이 본다
          expect([...container.querySelectorAll('[role="timer"]')].filter((el) => el.closest("[data-host-band]") === null).length, `${cell}: 모이는 중 링 없음(자막 띠 시계 제외, 14-01)`).toBe(0);
        } else if (!TIMELESS_PHASES.includes(phase) && !NO_CLOCK.has(phase)) {
          expect(container.querySelectorAll('[role="timer"]').length, `${cell}: 타이머`).toBeGreaterThanOrEqual(1);
        }
      });
    }
  }
});

describe("UX-01 대기실·배정·역할 확인·결과의 안내 요소 (14-02)", () => {
  it("lobby 방장·손님: [data-guide] 는 띠 문장 하나이고 헤더에는 안내 줄이 없다", () => {
    for (const isHost of [true, false]) {
      const view = makeView({ phase: "lobby", endsIn: null, isHost });
      delete view.me.role;
      const { container, unmount } = renderRoom(view);
      const g = onlyGuide(container, `lobby/${isHost ? "방장" : "손님"}`);
      expect(g.closest("[data-host-band]")).not.toBeNull();
      expect(squish(g.textContent)).toBe(hostLineOf(view, { cardSeen: false }));
      expect(container.querySelectorAll(".mv-phase__hint").length).toBe(0);
      unmount();
    }
  });

  it("assigning: [data-guide] 는 띠 문장 하나, 가운데 글 `직업을 배정하고 있습니다…` 는 안내 표식이 아니다", () => {
    const { container } = renderRoom(makeView({ phase: "assigning", endsIn: 3_000 }));
    const g = onlyGuide(container, "assigning");
    expect(g.closest("[data-host-band]")).not.toBeNull();
    expect(squish(g.textContent)).toBe(HOST_LINES.assigning);
  });

  it("roleReveal: [data-guide] 는 띠 문장 하나이고 `.mf-reveal__hint` 는 안내 표식을 달지 않는다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", viewpoint: "police", endsIn: 15_000 }));
    const g = onlyGuide(container, "roleReveal");
    expect(g.closest("[data-host-band]")).not.toBeNull();
    for (const el of container.querySelectorAll(".mf-reveal__hint")) expect(el.hasAttribute("data-guide")).toBe(false);
  });

  it("ended: [data-guide] 는 띠 문장 하나이고 헤더 제목 `시민 승리`·`마피아 승리` 는 안내 표식을 달지 않는다 (생존·관전 모두)", () => {
    for (const [winner, title] of [
      ["citizenWin", "시민 승리"],
      ["mafiaWin", "마피아 승리"],
    ] as const) {
      for (const vp of ["citizen", "spectator"] as const) {
        const { container, unmount } = renderRoom(endedView(vp, winner));
        const g = onlyGuide(container, `ended/${winner}/${vp}`);
        expect(g.closest("[data-host-band]")).not.toBeNull();
        const titleEl = container.querySelector(".mf-result__title");
        expect(titleEl).not.toBeNull();
        expect(titleEl!.hasAttribute("data-guide")).toBe(false);
        expect(squish(titleEl!.textContent)).toBe(title);
        unmount();
      }
    }
  });
});

// ---- HOST-05 (T-14-06): 한 화면의 DOM 에 다른 역할 전용 줄이 없다 ----

describe("HOST-05 한 화면에 다른 역할 줄이 없다 (14-02)", () => {
  const ROLE_NIGHT_KEYS = ["night.mafia", "night.police", "night.doctor"] as const;
  const OWN: Readonly<Record<Viewpoint, (typeof ROLE_NIGHT_KEYS)[number] | null>> = {
    mafia: "night.mafia",
    police: "night.police",
    doctor: "night.doctor",
    citizen: null,
    spectator: null,
  };

  for (const vp of ALL_VIEWPOINTS) {
    it(`night/${vp}: 화면 글자에 ${OWN[vp] === null ? "역할 줄 셋 모두 없다" : `내 줄(${OWN[vp]})만 있고 다른 두 역할 줄은 없다`}`, () => {
      const { container } = renderRoom(makeView({ phase: "night", viewpoint: vp, endsIn: 30_000 }));
      const text = squish(container.textContent);
      for (const key of ROLE_NIGHT_KEYS) {
        const line = HOST_LINES[key] as string;
        if (key === OWN[vp]) expect(text, `night/${vp}: 내 줄`).toContain(line);
        else expect(text, `night/${vp}: ${key} 줄 누설`).not.toContain(line);
      }
    });
  }

  it("경찰·의사·시민·유령 화면에는 마피아 줄이 없고, 마피아 화면에는 경찰·의사 줄이 없다(밤 이외 단계도 같은 줄만)", () => {
    for (const phase of ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "morning"] as const) {
      for (const vp of ALL_VIEWPOINTS) {
        const { container, unmount } = renderCell(phase, vp);
        const text = squish(container.textContent);
        for (const key of ROLE_NIGHT_KEYS) expect(text, `${phase}/${vp}: ${key}`).not.toContain(HOST_LINES[key] as string);
        unmount();
      }
    }
  });

  it("할 일 없는 줄은 역할과 무관하다: 같은 단계(낮 시작·변론 비변론자·처형·아침)에서 산 마피아·경찰·의사·시민의 띠 문장이 같다", () => {
    for (const phase of ["dayAnnounce", "defense", "execution", "morning"] as const) {
      const seen = new Set<string>();
      for (const vp of ["mafia", "police", "doctor", "citizen"] as const) {
        const { container, unmount } = renderCell(phase, vp);
        seen.add(squish(onlyGuide(container, `${phase}/${vp}`).textContent));
        unmount();
      }
      expect([...seen], `${phase}: 역할별 띠 문장`).toHaveLength(1);
    }
  });
});
