/// <reference types="node" />
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { MorningView, PhaseId, RoomView } from "../../shared/protocol";
import { defenseDisconnected, defenseStatus } from "../../src/game/verdict";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { CANDIDATE_SEAT, NAMES, verdictFixture } from "../helpers/verdictViews";
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

// ---- 05-01 Task 2: 주장·밤·아침·투표 구간 (부품이 data-guide 를 맡는다) ----

/** 투표 구간 칸: verdictViews 픽스처로 RoomScreen 을 그린다. 공개 단계는 시간표를 돌려 칩이 그려지게 한다 */
function renderVerdict(stage: VerdictStage, viewer: Viewer, meIsCandidate = false) {
  const fx = verdictFixture({ stage, viewer, count: 4, meIsCandidate });
  connectionMock.current = { ...conn(fx.view), ...fx.over };
  const r = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  return r;
}

describe("UX-01 낮 장면 부품: claim·night·morning (D-08)", () => {
  it("claim 내 차례: 하나 = `내 차례예요` (ClaimPanel 제목)", () => {
    const { container } = renderRoom(makeView({ phase: "claim", viewpoint: "citizen", turn: 0, endsIn: 8_000 }));
    expect(squish(onlyGuide(container, "claim/내 차례").textContent)).toBe("내 차례예요");
  });

  it("claim 남의 차례: 하나 = `{닉네임}님이 주장하는 중` (TurnPanel 상태 줄)", () => {
    const { container } = renderRoom(makeView({ phase: "claim", viewpoint: "police", turn: 1, endsIn: 8_000 }));
    const g = onlyGuide(container, "claim/남의 차례");
    expect(g.tagName).toBe("B");
    expect(squish(g.textContent)).toBe("하윤님이 주장하는 중");
  });

  it("claim 탈락 viewer: 하나 = `탈락했어요 · 볼 수만 있어요`", () => {
    const { container } = renderRoom(makeView({ phase: "claim", viewpoint: "spectator", turn: 1, endsIn: 8_000 }));
    expect(squish(onlyGuide(container, "claim/탈락").textContent)).toBe("탈락했어요 · 볼 수만 있어요");
  });

  it("night 경찰·의사·시민은 NightPanel 제목, 마피아는 헤더 `1일차 · 함께 지목하세요`, 탈락은 읽기 전용 줄", () => {
    const expected: Readonly<Record<Viewpoint, string>> = {
      police: "조사할 사람을 고르세요",
      doctor: "지킬 사람을 고르세요",
      citizen: "밤이 되었어요",
      mafia: "1일차 · 함께 지목하세요",
      spectator: "탈락했어요 · 볼 수만 있어요",
    };
    for (const vp of ALL_VIEWPOINTS) {
      const { container, unmount } = renderRoom(makeView({ phase: "night", viewpoint: vp, endsIn: 30_000 }));
      expect(squish(onlyGuide(container, `night/${vp}`).textContent), `night/${vp}`).toBe(expected[vp]);
      unmount();
    }
  });

  it("morning: 모든 viewer 하나 = `아침이 밝았습니다` (NightPanel 제목)", () => {
    for (const vp of ALL_VIEWPOINTS) {
      const { container, unmount } = renderRoom(makeView({ phase: "morning", viewpoint: vp, endsIn: 5_000, day: 1 }));
      expect(squish(onlyGuide(container, `morning/${vp}`).textContent), `morning/${vp}`).toBe("아침이 밝았습니다");
      unmount();
    }
  });
});

describe("UX-01 투표 구간 부품: execVote·candidateVote·reveal·defense·execution·noExecution (D-08)", () => {
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

  it("candidateVoteReveal: 하나, 글자가 비어 있지 않다 (공개 caption 제목)", () => {
    for (const viewer of ["alive", "spectator"] as const) {
      const { container, unmount } = renderVerdict("candidateVoteReveal", viewer);
      expect(squish(onlyGuide(container, `candidateVoteReveal/${viewer}`).textContent), `candidateVoteReveal/${viewer}`).not.toBe("");
      unmount();
    }
  });

  it("defense 후보 본인 `변론할 말을 고르세요` / 생존 비후보 `{이름}님이 변론하는 중` / 관전 `관전 중 · 볼 수만 있어요`", () => {
    const own = renderVerdict("defense", "alive", true);
    expect(squish(onlyGuide(own.container, "defense/후보 본인").textContent)).toBe("변론할 말을 고르세요");
    own.unmount();
    const other = renderVerdict("defense", "alive");
    const g = onlyGuide(other.container, "defense/생존");
    expect(g.tagName).toBe("B");
    expect(squish(g.textContent)).toBe(defenseStatus(NAMES[CANDIDATE_SEAT]!));
    other.unmount();
    const spec = renderVerdict("defense", "spectator");
    expect(squish(onlyGuide(spec.container, "defense/관전").textContent)).toBe("관전 중 · 볼 수만 있어요");
    expect(onlyGuide(spec.container, "defense/관전").classList.contains("mf-ro")).toBe(true);
  });

  it("defense 후보가 끊김: 하나 = 끊김 문구", () => {
    const { container } = renderVerdict("defense", "otherOffline");
    expect(squish(onlyGuide(container, "defense/후보 끊김").textContent)).toBe(defenseDisconnected(NAMES[CANDIDATE_SEAT]!));
  });

  it("execution: 하나 = `처형이 끝났어요`", () => {
    for (const viewer of ["alive", "spectator"] as const) {
      const { container, unmount } = renderVerdict("execution", viewer);
      expect(squish(onlyGuide(container, `execution/${viewer}`).textContent), `execution/${viewer}`).toBe("처형이 끝났어요");
      unmount();
    }
  });

  it("처형 무효로 온 밤: 마피아 하나 = 헤더, 시민 하나 = NightPanel 제목 (회색 카드가 떠 있어도)", () => {
    const mafia = renderVerdict("noExecution", "mafiaAlly");
    const gm = onlyGuide(mafia.container, "noExecution/마피아");
    expect(gm.classList.contains("mf-phasebar__do")).toBe(true);
    expect(squish(gm.textContent)).toBe("2일차 · 함께 지목하세요");
    mafia.unmount();
    const citizen = renderVerdict("noExecution", "alive");
    const gc = onlyGuide(citizen.container, "noExecution/시민");
    expect(squish(gc.textContent)).toBe("밤이 되었어요");
  });
});
