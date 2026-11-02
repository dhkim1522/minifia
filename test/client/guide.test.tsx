/// <reference types="node" />
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { MorningView, PhaseId, RoomView } from "../../shared/protocol";
import { VERDICT_TEXT } from "../../src/game/verdict";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { verdictFixture } from "../helpers/verdictViews";
import type { Viewer, VerdictStage } from "../helpers/verdictViews";

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

// 06-15: 대기실은 맵(WorldStage) 위에 그려진다. 캔버스·런타임은 worldStage.test 가 보므로 여기서는 가짜로 바꾼다(lobby.test.tsx 와 같은 모양).
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));

const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { PHASE_GUIDE_FILL, TIMELESS_PHASES } = await import("../../src/game/scenes");

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

// 낮 시작·낮 토론·변론·처형은 08-13 부터 맵 화면(GameMap)이다 — 옛 테이블 화면의 안내 요소 시험은 이 자리에서 뺐다.
// 맵 화면의 헤더 안내(`.mv-phase__hint[data-guide]`)는 gameMap.test.tsx 가 본다. 나머지 단계(밤·아침·옛 투표)의 시험은 아래에 그대로 있다.

// ---- 05-01 Task 2: 밤·아침·투표 구간 (부품이 data-guide 를 맡는다) ----

/** 투표 구간 칸: verdictViews 픽스처로 RoomScreen 을 그린다. 공개 단계는 시간표를 돌려 칩이 그려지게 한다 */
function renderVerdict(stage: VerdictStage, viewer: Viewer, meIsCandidate = false) {
  const fx = verdictFixture({ stage, viewer, count: 4, meIsCandidate });
  connectionMock.current = { ...conn(fx.view), ...fx.over };
  const r = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  return r;
}

// 밤·아침은 08-18 부터 맵 화면(GameMap)이다(임시 틀). 안내는 헤더 안내 줄(.mv-phase__hint) 또는 하단 NightPanel 제목이고 화면당 하나다.
// 아침은 UI-SPEC 단계표에 안내가 없다(알림 + 채팅): 산 사람 화면에는 [data-guide] 가 0개이고 유령만 헤더 안내가 있다.
describe("UX-01 맵 화면: night·morning (D-08, 08-18)", () => {
  it("night 경찰·의사·시민은 NightPanel 제목, 마피아는 헤더 `없앨 사람을 눌러요`, 탈락은 헤더 `모두의 직업과 밤 행동이 보여요`", () => {
    const expected: Readonly<Record<Viewpoint, string>> = {
      police: "조사할 사람을 고르세요",
      doctor: "지킬 사람을 고르세요",
      citizen: "밤이 되었어요",
      mafia: "없앨 사람을 눌러요",
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

describe("UX-01 투표 구간 부품: execVote·candidateVote·reveal·noExecution (D-08) — 변론·처형은 08-13 부터 맵 화면", () => {
  it("execVote 생존·관전: 하나 = `오늘 처형을 할까요?` (제목 h2), 관전 알약 p.mf-ro 에는 속성이 없다", () => {
    for (const viewer of ["alive", "spectator"] as const) {
      const { container, unmount } = renderVerdict("execVote", viewer);
      const g = onlyGuide(container, `execVote/${viewer}`);
      expect(g.tagName).toBe("H2");
      expect(squish(g.textContent), `execVote/${viewer}`).toBe("오늘 처형을 할까요?");
      for (const ro of Array.from(container.querySelectorAll(".mf-ro"))) expect(ro.hasAttribute("data-guide"), `execVote/${viewer} 관전 알약`).toBe(false);
      unmount();
    }
  });

  it("candidateVote: 생존 `처형할 사람을 고르세요`, 관전 `처형할 사람을 고르는 중이에요` — 각각 하나", () => {
    const alive = renderVerdict("candidateVote", "alive");
    expect(squish(onlyGuide(alive.container, "candidateVote/alive").textContent)).toBe("처형할 사람을 고르세요");
    alive.unmount();
    const spec = renderVerdict("candidateVote", "spectator");
    expect(squish(onlyGuide(spec.container, "candidateVote/spectator").textContent)).toBe("처형할 사람을 고르는 중이에요");
    for (const ro of Array.from(spec.container.querySelectorAll(".mf-ro"))) expect(ro.hasAttribute("data-guide")).toBe(false);
  });

  it("candidateVote 안내 줄(결정 0040): 네 역할이 같은 글자를 본다 — 고르기 전 `아무도 고르지 않으면 무효표가 돼요`, 고른 뒤 `빈 곳을 누르면 선택이 취소돼요`. 관전자는 기존 관전 안내. [data-guide] 는 어디서나 하나", () => {
    const guideText = (container: HTMLElement): string => squish(container.querySelector(".mf-dayscene__panel .mf-claimpanel__guide")?.textContent);
    expect(VERDICT_TEXT.candidateGuideNone).toBe("아무도 고르지 않으면 무효표가 돼요");
    expect(VERDICT_TEXT.candidateGuidePicked).toBe("빈 곳을 누르면 선택이 취소돼요");
    for (const picked of [false, true]) {
      const texts = new Set<string>();
      for (const vp of ["mafia", "police", "doctor", "citizen"] as const) {
        const viewer: Viewer = vp === "mafia" ? "mafiaAlly" : "alive";
        const fx = verdictFixture({ stage: "candidateVote", viewer, count: 4 });
        if (picked) fx.view.me.voteTarget = vp === "mafia" ? 3 : 2;
        else delete fx.view.me.voteTarget;
        connectionMock.current = { ...conn(fx.view), ...fx.over };
        const { container, unmount } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
        onlyGuide(container, `candidateVote/${vp}/${picked ? "고름" : "안 고름"}`);
        texts.add(guideText(container));
        unmount();
      }
      expect([...texts], picked ? "고른 뒤" : "고르기 전").toEqual([picked ? VERDICT_TEXT.candidateGuidePicked : VERDICT_TEXT.candidateGuideNone]);
    }
    const spec = renderCell("candidateVote", "spectator");
    onlyGuide(spec.container, "candidateVote/spectator");
    expect(guideText(spec.container)).toBe(VERDICT_TEXT.candidateSpectatorHint);
  });

  it("candidateVoteReveal: 하나, 글자가 비어 있지 않다 (공개 caption 제목)", () => {
    for (const viewer of ["alive", "spectator"] as const) {
      const { container, unmount } = renderVerdict("candidateVoteReveal", viewer);
      expect(squish(onlyGuide(container, `candidateVoteReveal/${viewer}`).textContent), `candidateVoteReveal/${viewer}`).not.toBe("");
      unmount();
    }
  });

  it("처형 무효로 온 밤(맵 화면, 08-18): 마피아 하나 = 헤더 `없앨 사람을 눌러요`, 시민 하나 = NightPanel 제목", () => {
    const mafia = renderVerdict("noExecution", "mafiaAlly");
    const gm = onlyGuide(mafia.container, "noExecution/마피아");
    expect(gm.classList.contains("mv-phase__hint")).toBe(true);
    expect(squish(gm.textContent)).toBe("없앨 사람을 눌러요");
    mafia.unmount();
    const citizen = renderVerdict("noExecution", "alive");
    const gc = onlyGuide(citizen.container, "noExecution/시민");
    expect(squish(gc.textContent)).toBe("밤이 되었어요");
  });
});

// ---- 05-01 Task 3: 대기실·배정·역할 확인·결과 + 14단계 × 시점 점검표 (D-08, D-09, P5-5) ----

/** 시점: 역할 넷 + 관전자, 그리고 역할이 아직 없는 단계의 한 칸(none) */
type CheckViewpoint = Viewpoint | "none";

/**
 * 점검표(05-UI-SPEC 8): 화면이 그리는 PhaseId 13개 × 시점(순차 직업 주장 단계는 화면에서 사라졌다, 07-04). 있을 수 없는 칸은 적지 않는다 —
 * lobby·assigning 은 역할이 없어 none 한 칸, roleReveal 은 살아 있는 사람뿐(관전 없음).
 * 이 목록은 PhaseId 의 부분집합이어야 한다(satisfies).
 */
const CHECKED_PHASES = [
  "lobby",
  "assigning",
  "roleReveal",
  "execVote",
  "candidateVote",
  "candidateVoteReveal",
  "ended",
] as const satisfies readonly PhaseId[];
type CheckedPhase = (typeof CHECKED_PHASES)[number];

const CHECKLIST: Readonly<Record<CheckedPhase, readonly CheckViewpoint[]>> = {
  lobby: ["none"],
  assigning: ["none"],
  roleReveal: ["mafia", "police", "doctor", "citizen"],
  execVote: ["mafia", "police", "doctor", "citizen", "spectator"],
  candidateVote: ["mafia", "police", "doctor", "citizen", "spectator"],
  candidateVoteReveal: ["mafia", "police", "doctor", "citizen", "spectator"],
  ended: ["mafia", "police", "doctor", "citizen", "spectator"],
};

const VERDICT_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["execVote", "candidateVote", "candidateVoteReveal", "ended"]);

/** 칸 하나를 그린다. 투표 구간·결과는 verdictViews 픽스처(역할은 마피아/그 밖만 구분), 나머지는 이 파일의 makeView */
function renderCell(phase: CheckedPhase, vp: CheckViewpoint) {
  if (VERDICT_PHASES.has(phase)) {
    const viewer: Viewer = vp === "spectator" ? "spectator" : vp === "mafia" ? "mafiaAlly" : "alive";
    const r = renderVerdict(phase as VerdictStage, viewer);
    if (phase === "candidateVoteReveal") act(() => vi.advanceTimersByTime(2_000));
    return r;
  }
  const viewpoint: Viewpoint = vp === "none" ? "citizen" : vp;
  const endsIn = phase === "lobby" ? null : phase === "assigning" ? 3_000 : 15_000;
  const view = makeView({ phase, viewpoint, endsIn, day: 1 });
  if (vp === "none") delete view.me.role;
  return renderRoom(view);
}

describe("UX-01 점검표: 맵 화면(낮 시작~아침)을 뺀 7단계 × 시점 모든 칸의 안내 문장과 남은 시간 (D-08, 05-UI-SPEC 8.4)", () => {
  const phases = Object.keys(CHECKLIST) as CheckedPhase[];

  it("점검표가 옛 화면이 그리는 7단계를 모두 가진다", () => {
    expect(phases.length).toBe(7);
  });

  for (const phase of phases) {
    for (const vp of CHECKLIST[phase]) {
      it(`${phase}/${vp}: [data-guide] 정확히 하나·글자 있음·값 빈 문자열, ${TIMELESS_PHASES.includes(phase) ? "타이머 없어도 됨" : "타이머 있음"}`, () => {
        const { container } = renderCell(phase, vp);
        const cell = `${phase}/${vp}`;
        const g = onlyGuide(container, cell);
        expect(squish(g.textContent), `${cell}: 안내 글자`).not.toBe("");
        expect(g.getAttribute("data-guide"), `${cell}: 속성 값`).toBe("");
        if (!TIMELESS_PHASES.includes(phase)) {
          expect(container.querySelectorAll('[role="timer"]').length, `${cell}: 타이머`).toBeGreaterThanOrEqual(1);
        }
      });
    }
  }

  it("TIMELESS_PHASES 밖의 단계(4개: 역할 확인·옛 투표 셋)는 모두 점검표에 있고 타이머를 시험한다", () => {
    expect(phases.filter((p) => !TIMELESS_PHASES.includes(p)).length).toBe(4);
  });
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
      for (const viewer of ["alive", "spectator"] as const) {
        const fx = verdictFixture({ stage: "ended", viewer, count: 4 });
        fx.view.result = { ...fx.view.result!, winner };
        connectionMock.current = { ...conn(fx.view), ...fx.over };
        const { container, unmount } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
        const g = onlyGuide(container, `ended/${winner}/${viewer}`);
        expect(g.classList.contains("mf-result__banner-title")).toBe(true);
        expect(squish(g.textContent)).toBe(title);
        unmount();
      }
    }
  });
});

describe("UX-01 누출 검사: 새 문장은 역할로 달라지지 않는다 (T-05-01, D-09)", () => {
  it("새 문장 상수에는 역할 이름이 없다", () => {
    const sentences = [PHASE_GUIDE_FILL.dayAnnounce.title, PHASE_GUIDE_FILL.dayAnnounce.guide, PHASE_GUIDE_FILL.discussion(1)].join(" ");
    for (const word of ["마피아", "경찰", "의사", "시민"]) expect(sentences).not.toContain(word);
  });
});
