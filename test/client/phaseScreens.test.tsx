/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import { ROLE_TEXT } from "../../src/game/roleText";
import type { MorningView, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { MemoryStorage } from "../helpers/memoryStorage";
import { createSheetProbe } from "../../src/debug/sheetDebug";
import { setSheetProbe } from "../../src/debug/sheetProbe";

// 연결 훅은 반환값을 테스트가 정한다(roomScreen.test 와 같은 방식). 단계 화면은 서버 view 만 따른다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

// 직업 그림 미리 받기는 호출 여부만 본다(요청 목록은 assets 단위 테스트의 몫). 나머지 assets 는 그대로 쓴다.
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
const { RoleReveal } = await import("../../src/screens/RoleReveal");
const { TEST_PHASE_LABEL } = await import("../../src/components/TestTools");

const NOW = 1_700_000_000_000;

interface ViewOpts {
  phase: PhaseId;
  /** 지금 기준 마감까지 남은 ms. null 이면 마감 없음 */
  endsIn?: number | null;
  durationMs?: number | null;
  role?: RoleId;
  allies?: number[];
  isHost?: boolean;
  /** 앞에서부터 이 수만큼의 사람만 앉힌다(기본 4) */
  count?: number;
  /** 서버가 주는 일차. 없으면 view.day 자체가 없다(02-04 이전 서버) */
  day?: number;
  /** false 면 내 자리(seat 0)의 players[].alive 를 false 로 싣는다(탈락 — 결정 0021) */
  meAlive?: boolean;
  /** morning 단계의 아침 결과(day.morning). day 가 있어야 싣는다 */
  morning?: MorningView;
}

function makeView(o: ViewOpts): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: o.isHost ?? false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  const day: Pick<RoomView, "day"> =
    o.day === undefined
      ? {}
      : {
          day: {
            n: o.day ?? 1,
            roles: ["mafia", "police", "citizen"],
            ...(o.morning !== undefined ? { morning: o.morning } : {}),
          },
        };
  return {
    ...day,
    code: "0042",
    phase: o.phase,
    phaseEndsAt: o.endsIn == null ? null : NOW + o.endsIn,
    phaseDurationMs: o.durationMs ?? (o.endsIn == null ? null : 15_000),
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ]
      .slice(0, o.count ?? 4)
      .map((p) => (p.seat === 0 && o.meAlive === false ? { ...p, alive: false } : p)),
    me,
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
    send: vi.fn(),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}, onExit = vi.fn()) {
  connectionMock.current = conn(view, over);
  return render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />);
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function card(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".mf-card");
  expect(el, "카드(.mf-card)").not.toBeNull();
  return el!;
}

// getBy* 는 실패 때 DOM 전체를 여러 줄로 찍어 TAP 보고서를 깨뜨린다. 한 줄 메시지로 단언한다.
/** 띠([data-host-band]) 밖의 시간 표시(timer 역할). 14-05 가 역할 확인의 옛 Timer 를 지워 이제 0개여야 한다 */
function stageTimers(): HTMLElement[] {
  return screen.queryAllByRole("timer").filter((el) => el.closest("[data-host-band]") === null);
}

/** 역할 확인 머리의 제목 글자(14-05: PhaseHeader 의 .mv-phase__title) */
function revealTitle(container: HTMLElement): string {
  return container.querySelector(".mf-reveal__header .mv-phase__title")?.textContent ?? "(제목 없음)";
}

function byRole(role: string, name?: string): HTMLElement {
  const el = screen.queryByRole(role, name === undefined ? undefined : { name });
  expect(el, `role=${role} name=${name ?? ""}`).not.toBeNull();
  return el!;
}

function byText(text: string): HTMLElement {
  const el = screen.queryByText(text);
  expect(el, `text=${text}`).not.toBeNull();
  return el!;
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

describe("S-05 역할 확인 (GAME-01, ROLE-02, D-13 개정, D-14, D-15, R12)", () => {
  it("역할 확인 뒷면: 머리는 제목 '역할 확인' + [내 역할] 뿐이고 카드 뒷면이 보인다 — 안내·보조 줄·m:ss 타이머가 없다 (U-2, U-3, TOOL-02)", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    expect(revealTitle(container)).toBe("역할 확인");
    const header = container.querySelector(".mf-reveal__header") as HTMLElement;
    expect(header.querySelectorAll(".mv-phase__title").length).toBe(1);
    expect(Array.from(header.querySelectorAll("button")).map((b) => b.getAttribute("aria-label"))).toEqual(["내 역할"]);
    expect(header.querySelector(".mv-phase__hint")).toBeNull();
    expect(header.querySelector(".mv-ring")).toBeNull();
    expect(container.querySelector(".mf-phasebar")).toBeNull();
    expect(container.querySelector(".mf-phasebar__do")).toBeNull();
    expect(container.querySelector(".mf-timer")).toBeNull();
    expect(container.querySelector(".mf-reveal__hint")).toBeNull();
    expect(container.querySelector(".mf-reveal__sub")).toBeNull();
    expect(stageTimers()).toHaveLength(0);
    expect(container.textContent).not.toContain("0:15");
    for (const old of ["카드를 눌러 확인하세요", "카드를 눌러 직업을 확인하세요", "다른 사람에게 보이지 않게 가려 주세요"]) {
      expect(screen.queryByText(old), old).toBeNull();
    }
    expect(container.querySelectorAll("[data-pre-notice]").length).toBe(0);
    expect(byRole("button", "역할 카드 뒤집기")).toBeTruthy();
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
  });

  it("카드를 누르면 앞면(마피아·동료 · 민지)과 앞면 안내가 나오고, 다시 누르면 뒷면으로 돌아간다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    fireEvent.click(byRole("button", "역할 카드 뒤집기"));
    expect(card(container).classList.contains("mf-card--front")).toBe(true);
    expect(byText("마피아")).toBeTruthy();
    expect(byText("동료 · 민지")).toBeTruthy();
    expect(screen.queryByText("내 직업이에요")).toBeNull();
    expect(screen.queryByText("확인했으면 그대로 기다리세요")).toBeNull();

    fireEvent.click(card(container));
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
    expect(screen.queryByText("카드를 눌러 확인하세요")).toBeNull();
  });

  it("누르지 않고 5초가 지나면 저절로 앞면이 되고, 앞면에서 누르면 가려진 뒤 다시 저절로 뒤집히지 않는다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    advance(4_900);
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
    advance(100);
    expect(card(container).classList.contains("mf-card--front")).toBe(true);
    fireEvent.click(card(container));
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
    advance(9_000);
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
  });

  it("5초 뒤에 들어온 재접속은 앞면부터이고 마운트 직후 onSeenFront 가 한 번 불린다", () => {
    const onSeenFront = vi.fn();
    const view = makeView({ phase: "roleReveal", endsIn: 9_000, role: "mafia", allies: [2] });
    const { container } = render(
      <RoleReveal view={view} offset={0} myRoleButton={<button type="button">역할 카드</button>} onSeenFront={onSeenFront} />,
    );
    expect(card(container).classList.contains("mf-card--front")).toBe(true);
    expect(onSeenFront).toHaveBeenCalledTimes(1);
    advance(5_000);
    expect(onSeenFront).toHaveBeenCalledTimes(1);
  });

  it("처음부터 보면 마운트 때는 onSeenFront 가 불리지 않고 5초 자동 앞면에서 한 번 불린다", () => {
    const onSeenFront = vi.fn();
    const view = makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] });
    render(<RoleReveal view={view} offset={0} myRoleButton={<button type="button">역할 카드</button>} onSeenFront={onSeenFront} />);
    expect(onSeenFront).not.toHaveBeenCalled();
    advance(5_000);
    expect(onSeenFront).toHaveBeenCalledTimes(1);
  });

  it("me.role 이 없는 view 는 뒷면만 보이고 눌러도 앞면이 되지 않는다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000 }));
    fireEvent.click(byRole("button", "역할 카드 뒤집기"));
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
    advance(6_000);
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
    expect(screen.queryByText("마피아")).toBeNull();
  });

  it("경찰(allies 없음)은 앞면에 동료 줄이 없고, 혼자인 마피아(allies [])는 '혼자예요' 가 보인다", () => {
    const police = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "police" }));
    fireEvent.click(byRole("button", "역할 카드 뒤집기"));
    expect(byText("경찰")).toBeTruthy();
    expect(police.container.querySelector(".mf-card__mates")).toBeNull();
    cleanup();

    const alone = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [] }));
    fireEvent.click(byRole("button", "역할 카드 뒤집기"));
    expect(byText("혼자예요")).toBeTruthy();
    expect(alone.container.querySelector(".mf-card__mates")).not.toBeNull();
  });

  it("15초가 지나도 서버가 day 를 보내기 전에는 역할 확인에 머문다 (T-01-46)", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    advance(15_000);
    expect(revealTitle(container)).toBe("역할 확인");
    expect(stageTimers()).toHaveLength(0);
    expect(screen.queryByText("낮이 되었습니다")).toBeNull();
  });
});

describe("S-05 역할 확인 카드 빛남 (HOST-03, HOST-04, D-08, T-14-15)", () => {
  const lit = (el: HTMLElement) => `${el.classList.contains("is-call")}/${el.hasAttribute("data-call")}`;

  it("역할이 정해졌고 카드를 아직 안 봤으면 카드 루트가 빛난다(is-call + data-call, 값 없음)", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    expect(lit(card(container))).toBe("true/true");
    expect(card(container).getAttribute("data-call")).toBe("");
  });

  it("카드를 눌러 앞면을 보면 꺼지고, 다시 뒷면으로 가려도 되살아나지 않는다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "citizen" }));
    fireEvent.click(card(container));
    expect(lit(card(container))).toBe("false/false");
    fireEvent.click(card(container));
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
    expect(lit(card(container))).toBe("false/false");
  });

  it("누르지 않아도 5초 자동 앞면이 되면 꺼진다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "police" }));
    expect(lit(card(container))).toBe("true/true");
    advance(5_000);
    expect(lit(card(container))).toBe("false/false");
  });

  it("역할 없는 view 에서는 빛나지 않는다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000 }));
    expect(lit(card(container))).toBe("false/false");
  });

  it.each(["mafia", "police", "doctor", "citizen"] as const)("%s: 빛나는 카드 루트 모양이 역할과 무관하게 같다(T-14-15)", (role) => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role, allies: role === "mafia" ? [2] : [] }));
    const base = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "citizen" }));
    expect(card(container).outerHTML).toBe(card(base.container).outerHTML);
  });
});

// 단계 안내 영역은 방 화면 루트의 직접 자식이다. 낮 화면에는 다른 polite 영역(투표 안내 등)이 더 있을 수 있어
// 문서 순서 첫 번째 [aria-live] 로는 유일하게 찾을 수 없다(02-09).
function liveRegion(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.mf-room > [aria-live="polite"]');
  expect(el, "aria-live=polite 영역").not.toBeNull();
  return el!;
}

function rerenderRoom(rerender: (ui: React.ReactElement) => void, view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn(view, over);
  rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
}

describe("S-04 역할 배정 (GAME-01, D-12, R11, E7, T-01-44)", () => {
  it("배정 화면: 문구 둘·맥박 링 3개가 있고 테이블은 없으며 [역할 카드] 은 없다", () => {
    const { container } = renderRoom(makeView({ phase: "assigning" }));
    expect(byText("직업을 배정하고 있습니다…")).toBeTruthy();
    expect(byText("잠시만 기다려 주세요")).toBeTruthy();
    // 08-19: 사용자 확정(2026-11-02) 임시 처리 — v1.0 테이블 상자를 뺐다. 머리 .mf-assign__bar · 빈 패널 .mf-assign__panel 만 남는다
    expect(screen.queryByRole("group", { name: "테이블" })).toBeNull();
    expect(container.querySelector(".mf-assign__scene")).toBeNull();
    expect(container.querySelector(".mf-dt")).toBeNull();
    expect(container.querySelector(["table", "seat", "badge"].map((n) => `.mf-${n}`).join(", "))).toBeNull(); // 옛 Table 요소 없음
    expect(container.querySelector(".mf-assign__bar h1")?.textContent).toBe("역할 배정");
    const panel = container.querySelector(".mf-assign__panel");
    expect(panel).not.toBeNull();
    expect(panel?.children.length).toBe(0);
    expect(container.querySelectorAll(".mf-assign__veil").length).toBe(1);
    expect(container.querySelectorAll(".mf-assign__ring").length).toBe(3);
    expect(screen.queryByRole("button", { name: "내 역할" })).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("배정 화면에는 방장 왕관이 없고(방장 자리가 있어도 0개) 발밑 원·후광도 없다 (결정 0030)", () => {
    const { container } = renderRoom(makeView({ phase: "assigning" }));
    expect(container.querySelectorAll('[aria-label="방장"], .mf-dt__crown').length).toBe(0);
    expect(container.querySelectorAll(".mf-dt__ring, .mf-dt__sel, .mf-figure--halo-white, .mf-figure--halo-crimson").length).toBe(0);
  });

  it("배정 화면 마크업은 역할을 읽지 않는다 — 마피아로 억지로 채운 view 와 역할 없는 view 의 innerHTML 이 같다", () => {
    const withRole = renderRoom(makeView({ phase: "assigning", role: "mafia", allies: [2] }));
    const html = withRole.container.innerHTML;
    cleanup();
    const withoutRole = renderRoom(makeView({ phase: "assigning" }));
    expect(html.length).toBeGreaterThan(0);
    expect(withoutRole.container.innerHTML).toBe(html);
  });
});

describe("S-06 낮 시작 (D-01, D-02, R13, E9)", () => {

  it("낮 화면의 [역할 카드] 버튼 마크업은 마피아·시민·역할 없음에서 같다", () => {
    const html = (view: RoomView) => {
      renderRoom(view);
      const out = byRole("button", "내 역할").outerHTML;
      cleanup();
      return out;
    };
    const mafia = html(makeView({ phase: "dayAnnounce", role: "mafia", allies: [2] }));
    expect(html(makeView({ phase: "dayAnnounce", role: "citizen" }))).toBe(mafia);
    expect(html(makeView({ phase: "dayAnnounce" }))).toBe(mafia);
  });
});

describe("단계 안내 aria-live · 단계 전환 (UI-SPEC 접근성·Motion)", () => {
  it("단계가 바뀔 때만 보이지 않는 aria-live 영역이 새 단계를 읽는다", () => {
    const first = renderRoom(makeView({ phase: "lobby", isHost: true }));
    expect(liveRegion(first.container).textContent).toBe("");
    rerenderRoom(first.rerender, makeView({ phase: "assigning" }));
    expect(liveRegion(first.container).textContent).toBe("직업을 배정하고 있습니다");
    rerenderRoom(first.rerender, makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    expect(liveRegion(first.container).textContent).toBe("역할 확인");
    // 같은 단계 안의 view 갱신에는 그대로
    rerenderRoom(first.rerender, makeView({ phase: "roleReveal", endsIn: 14_000, role: "mafia", allies: [2] }));
    expect(liveRegion(first.container).textContent).toBe("역할 확인");
    rerenderRoom(first.rerender, makeView({ phase: "dayAnnounce", role: "mafia", allies: [2], day: 2 }));
    expect(liveRegion(first.container).textContent).toBe("2일차 낮이 되었습니다");
    rerenderRoom(first.rerender, makeView({ phase: "discussion", endsIn: 90_000, durationMs: 90_000, role: "mafia", allies: [2], day: 2 }));
    expect(liveRegion(first.container).textContent).toBe("낮 토론");
  });

  // CR-01: 서버는 찬반이 통과한 판에만 day.execution 을 싣는다. 부결이면 candidate 만 남는다.
  const executionView = (day: NonNullable<RoomView["day"]>): RoomView => {
    const base = makeView({ phase: "execution", endsIn: 6_000, durationMs: 6_000, role: "citizen", day: 1 });
    return { ...base, day: { ...base.day!, ...day } };
  };

  it("처형 단계: 찬반이 통과하면 '{이름} 님 처형' 을 읽는다", () => {
    const r = renderRoom(
      executionView({ n: 1, roles: ["mafia", "police", "citizen"], candidate: 1, execution: { seat: 1 }, verdict: { yes: 3, no: 0, passed: true } }),
    );
    expect(liveRegion(r.container).textContent).toBe("하윤 님 처형");
  });

  it("처형 단계: 찬반이 부결이면(day.execution 없음, candidate 만 있음) 변론자 이름 대신 '처형 없음' 을 읽는다", () => {
    const r = renderRoom(
      executionView({ n: 1, roles: ["mafia", "police", "citizen"], candidate: 1, verdict: { yes: 1, no: 2, passed: false } }),
    );
    const text = liveRegion(r.container).textContent;
    expect(text).toBe("처형 없음");
    expect(text).not.toContain("하윤");
  });

  it("단계 표 라벨(TEST_PHASE_LABEL)은 PhaseId 와 같은 키 집합이다", () => {
    const phases: Record<PhaseId, true> = {
      lobby: true,
      tutorial: true,
      assigning: true,
      roleReveal: true,
      dayAnnounce: true,
      errand: true,
      discussion: true,
      night: true,
      morning: true,
      defense: true,
      execution: true,
      nomination: true,
      runoff: true,
      showdown: true,
      verdict: true,
      ended: true,
    };
    expect(Object.keys(TEST_PHASE_LABEL).sort().join(",")).toBe(Object.keys(phases).sort().join(","));
  });

  it("단계 화면 루트에 mf-phase-enter 가 있고 장면이 바뀌면 새 요소로 바뀐다 (배정 → 확인은 같은 3D 무대라 같은 요소, feedback-3)", () => {
    const r = renderRoom(makeView({ phase: "assigning" }));
    const before = r.container.querySelector(".mf-phase-enter");
    expect(before).not.toBeNull();
    rerenderRoom(r.rerender, makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    const after = r.container.querySelector(".mf-phase-enter");
    expect(after).not.toBeNull();
    expect(after === before).toBe(true);
    // 같은 단계 안 갱신은 같은 요소(다시 나타나지 않는다)
    rerenderRoom(r.rerender, makeView({ phase: "roleReveal", endsIn: 14_000, role: "mafia", allies: [2] }));
    expect(r.container.querySelector(".mf-phase-enter") === after).toBe(true);
    // 장면이 바뀌면(역할 확인 → 낮 시작) 새 요소
    rerenderRoom(r.rerender, makeView({ phase: "dayAnnounce", endsIn: 5_000, role: "mafia", allies: [2], day: 1 }));
    const next = r.container.querySelector(".mf-phase-enter");
    expect(next).not.toBeNull();
    expect(next === after).toBe(false);
  });
});

describe("밤·아침 라우팅과 안내 (UI-SPEC C5·접근성, RESEARCH A6)", () => {
  const night = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "night", endsIn: 30_000, durationMs: 30_000, role: "citizen", day: 1, ...over });
  const morning = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "morning", endsIn: 5_000, durationMs: 5_000, role: "citizen", day: 1, ...over });

  it("night → morning: 장면 래퍼(.mf-phase-enter)와 맵 화면(GameMap) 루트가 같은 DOM 노드다 (C5, 밤·아침은 08-18 부터 맵 화면)", () => {
    const r = renderRoom(night());
    const scene = r.container.querySelector(".mf-phase-enter");
    const stage = r.container.querySelector("[data-game-stage]");
    expect(scene, "장면 래퍼").not.toBeNull();
    expect(stage, "맵").not.toBeNull();
    rerenderRoom(r.rerender, morning());
    expect(r.container.querySelector(".mf-phase-enter") === scene, "morning 래퍼 유지").toBe(true);
    expect(r.container.querySelector("[data-game-stage]") === stage, "morning 맵 유지").toBe(true);
  });

  it("morning view(eliminated 2) → 안내 '아침이 밝았습니다. 민지 님이 당했습니다'", () => {
    const r = renderRoom(morning({ morning: { eliminated: 2 } }));
    expect(liveRegion(r.container).textContent).toBe("아침이 밝았습니다. 민지 님이 당했습니다");
  });

  it("morning view(saved) → '아침이 밝았습니다. 누군가 살아났습니다' (누구인지 없음, 결정 0044-22)", () => {
    const r = renderRoom(morning({ morning: { saved: true } }));
    expect(liveRegion(r.container).textContent).toBe("아침이 밝았습니다. 누군가 살아났습니다");
  });

  it("morning view 에서 피해자 본인(좌석 0 탈락) → '아침이 밝았습니다. 암살당했습니다'", () => {
    const r = renderRoom(morning({ morning: { eliminated: 0 }, meAlive: false }));
    expect(liveRegion(r.container).textContent).toBe("아침이 밝았습니다. 암살당했습니다");
  });

  it("morning view 에서 이미 유령인 사람(처형으로 탈락)은 다른 시민과 같은 문장을 읽는다", () => {
    const r = renderRoom(morning({ morning: { eliminated: 2 }, meAlive: false }));
    expect(liveRegion(r.container).textContent).toBe("아침이 밝았습니다. 민지 님이 당했습니다");
  });

  it("morning view({}) → '아침이 밝았습니다. 아무 일도 없었습니다'", () => {
    const r = renderRoom(morning({ morning: {} }));
    expect(liveRegion(r.container).textContent).toBe("아침이 밝았습니다. 아무 일도 없었습니다");
  });

  it("night view, 마피아(allies [2]) 생존 → 안내 '1일차 밤. 함께 지목하세요'", () => {
    const r = renderRoom(night({ role: "mafia", allies: [2] }));
    expect(liveRegion(r.container).textContent).toBe("1일차 밤. 함께 지목하세요");
  });

  it("night view, 경찰·의사·시민 → 역할별 안내, 일차는 view.day.n 을 따른다", () => {
    const say = (over: Partial<ViewOpts>) => {
      const r = renderRoom(night(over));
      const text = liveRegion(r.container).textContent;
      cleanup();
      return text;
    };
    expect(say({ role: "police" })).toBe("1일차 밤. 조사할 사람을 고르세요");
    expect(say({ role: "doctor" })).toBe("1일차 밤. 지킬 사람을 고르세요");
    expect(say({ role: "citizen" })).toBe("1일차 밤. 밤이 되었어요");
    expect(say({ role: "police", day: 2 })).toBe("2일차 밤. 조사할 사람을 고르세요");
  });

  it("night view 에서 내 자리 players[].alive 가 false 면 역할과 무관하게 '1일차 밤. 탈락했어요, 관전 중'", () => {
    const say = (role: RoleId) => {
      const r = renderRoom(night({ role, allies: role === "mafia" ? [2] : undefined, meAlive: false }));
      const text = liveRegion(r.container).textContent;
      cleanup();
      return text;
    };
    expect(say("mafia")).toBe("1일차 밤. 탈락했어요, 관전 중");
    expect(say("police")).toBe("1일차 밤. 탈락했어요, 관전 중");
    expect(say("citizen")).toBe("1일차 밤. 탈락했어요, 관전 중");
  });

  it("phase 가 알 수 없는 문자열('vote')인 view 를 받으면 예외 없이 '연결 중…' 을 그리고 안내 영역은 빈 문자열이다 (A6)", () => {
    const unknown = { ...makeView({ phase: "discussion", endsIn: 90_000, role: "citizen", day: 1 }), phase: "vote" } as unknown as RoomView;
    const r = renderRoom(unknown);
    expect(byText("연결 중…")).toBeTruthy();
    expect(liveRegion(r.container).textContent).toBe("");
  });
});

describe("S-06a 낮 시작 발표 개정 (D-20, M6)", () => {

  it("[역할 카드] 버튼 마크업은 마피아·시민·역할 없음에서 같다", () => {
    const html = (view: RoomView) => {
      renderRoom(view);
      const out = byRole("button", "내 역할").outerHTML;
      cleanup();
      return out;
    };
    const mafia = html(makeView({ phase: "dayAnnounce", role: "mafia", allies: [2], day: 1 }));
    expect(html(makeView({ phase: "dayAnnounce", role: "citizen", day: 1 }))).toBe(mafia);
    expect(html(makeView({ phase: "dayAnnounce", day: 1 }))).toBe(mafia);
  });
});

describe("S-06b·S-06c·S-07 한 장면 맵 (DAY-01, UI-SPEC 장면)", () => {
  const dayAnnounce = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "dayAnnounce", endsIn: 2_000, durationMs: 2_000, role: "citizen", day: 1, ...over });
  const discussion = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "discussion", endsIn: 90_000, durationMs: 90_000, role: "citizen", ...over });

  it("dayAnnounce → discussion: 장면 바깥 래퍼(mf-phase-enter)가 같은 노드이고, 새 노드는 roleReveal → dayAnnounce 에서 생긴다", () => {
    const r = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "citizen", day: 1 }));
    const reveal = r.container.querySelector(".mf-phase-enter");
    rerenderRoom(r.rerender, makeView({ phase: "dayAnnounce", role: "citizen", day: 1 }));
    const announce = r.container.querySelector(".mf-phase-enter");
    expect(announce === reveal, "역할 확인 → 낮 시작은 새 래퍼").toBe(false);
    rerenderRoom(r.rerender, discussion());
    expect(r.container.querySelector(".mf-phase-enter") === announce, "낮 시작 → discussion 은 같은 래퍼").toBe(true);
  });

  it("마피아(allies [2])와 시민의 낮 토론 맵 화면은 마크업이 같다 — 역할이 화면 모양을 바꾸지 않는다 (08-13)", () => {
    const mafia = renderRoom(discussion({ role: "mafia", allies: [2] })).container.innerHTML;
    cleanup();
    const citizen = renderRoom(discussion({ role: "citizen" })).container.innerHTML;
    expect(citizen.includes("data-game-stage"), "맵 화면 마크업").toBe(true);
    expect(mafia).toBe(citizen);
  });
});

describe("대기실 연결 (C-02, R9) · 미리 받기 (Pattern 13 ②)", () => {
  const lobby = (count: number, over: Partial<ViewOpts> = {}) => makeView({ phase: "lobby", isHost: true, count, ...over });

  it("canSend 가 거짓이면 [시작] 은 흐리고(inactive) [나가기] 는 꺼진다", () => {
    const { container } = renderRoom(lobby(4), { canSend: false });
    expect(container.querySelector("[data-lobby-start]")?.className).toContain("mf-act--inactive");
    expect((byRole("button", "나가기") as HTMLButtonElement).disabled).toBe(true);
  });

  it("canSend 가 참이면 [시작] 이 켜지고 [나가기] 도 켜진다", () => {
    const { container } = renderRoom(lobby(4), { canSend: true });
    expect(container.querySelector("[data-lobby-start]")?.className).toContain("mf-act--primary");
    expect((byRole("button", "나가기") as HTMLButtonElement).disabled).toBe(false);
  });

  it("[나가기] 확인 뒤 onExit('left') 가 불린다", () => {
    const onExit = vi.fn();
    renderRoom(lobby(4), {}, onExit);
    fireEvent.click(byRole("button", "나가기"));
    const dialog = screen.queryByRole("dialog", { name: "방에서 나갈까요?" });
    expect(dialog, "나가기 확인 시트").not.toBeNull();
    const confirm = within(dialog!).queryByRole("button", { name: "나가기" });
    expect(confirm, "시트의 나가기").not.toBeNull();
    fireEvent.click(confirm!);
    expect(onExit.mock.calls.length, "onExit 호출 수").toBe(1);
    expect(String(onExit.mock.calls[0]?.[0]), "onExit 이유").toBe("left");
  });

  it("epoch 가 바뀌며 사람이 더해진 view 는 토스트가 없고, 같은 epoch 의 변화에는 토스트가 난다", () => {
    const r = renderRoom(lobby(2), { epoch: 1 });
    const toast = () => r.container.querySelector(".mv-toast__text")?.textContent ?? "";
    rerenderRoom(r.rerender, lobby(3), { epoch: 2 });
    expect(toast()).toBe("");
    rerenderRoom(r.rerender, lobby(4), { epoch: 2 });
    expect(toast()).toBe("도현 님 입장");
  });

  it("대기실과 배정 동안 preloadRoleAssets 를 부르고, 역할 확인에서는 새로 부르지 않는다", () => {
    const r = renderRoom(lobby(4));
    expect(preloadMock.mock.calls.length > 0, "preloadRoleAssets 호출").toBe(true);
    preloadMock.mockClear();
    rerenderRoom(r.rerender, makeView({ phase: "assigning" }));
    expect(preloadMock.mock.calls.length > 0, "preloadRoleAssets 호출").toBe(true);
    preloadMock.mockClear();
    rerenderRoom(r.rerender, makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    expect(preloadMock.mock.calls.length, "preloadRoleAssets 호출 수").toBe(0);
  });

  it("낮 토론에 들어서면 preloadDuskAssets 를 한 번 부르고, 다른 단계나 같은 단계의 다시 그리기에서는 부르지 않는다 (P-17)", () => {
    const r = renderRoom(lobby(4));
    rerenderRoom(r.rerender, makeView({ phase: "assigning" }));
    rerenderRoom(r.rerender, makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    rerenderRoom(r.rerender, makeView({ phase: "dayAnnounce", endsIn: 2_000, role: "mafia", allies: [2], day: 1 }));
    expect(preloadDuskMock.mock.calls.length, "토론 전 preloadDuskAssets 호출 수").toBe(0);
    rerenderRoom(r.rerender, makeView({ phase: "discussion", endsIn: 60_000, role: "mafia", allies: [2], day: 1 }));
    expect(preloadDuskMock.mock.calls.length, "토론 진입 preloadDuskAssets 호출 수").toBe(1);
    rerenderRoom(r.rerender, makeView({ phase: "discussion", endsIn: 59_000, role: "mafia", allies: [2], day: 1 }));
    expect(preloadDuskMock.mock.calls.length, "토론 다시 그리기 preloadDuskAssets 호출 수").toBe(1);
    rerenderRoom(r.rerender, makeView({ phase: "night", endsIn: 20_000, role: "mafia", allies: [2], day: 1 }));
    expect(preloadDuskMock.mock.calls.length, "밤 preloadDuskAssets 호출 수").toBe(1);
  });
});

describe("단계 전환은 서버 view 만 따른다 (T-01-46)", () => {
  it("역할 확인 마감 뒤 서버가 day 를 보내면 그때 낮 화면으로 바뀐다", () => {
    const r = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    advance(16_000);
    expect(r.container.querySelector("[data-game-stage]")).toBeNull();
    rerenderRoom(r.rerender, makeView({ phase: "dayAnnounce", role: "mafia", allies: [2] }));
    expect(r.container.querySelector("[data-game-stage]")).not.toBeNull();
  });
});

// ---- [역할 카드] 시트 (D-19 개정, 결정 0012, R14, E14, T-01-45) ----

function openRoleCard(): HTMLElement {
  fireEvent.click(byRole("button", "내 역할"));
  const dialog = document.querySelector<HTMLElement>('dialog[aria-label="역할 카드"]');
  expect(dialog, "역할 카드 시트(dialog)").not.toBeNull();
  return dialog!;
}

function sheetHas(dialog: HTMLElement, text: string): boolean {
  return (dialog.textContent ?? "").includes(text);
}

describe("C-01 [역할 카드] 시트", () => {
  const mafiaReveal = (endsIn: number) => makeView({ phase: "roleReveal", endsIn, role: "mafia", allies: [2] });

  it("카드를 뒤집지 않고 [역할 카드] 을 누르면 시트에는 카드 뒷면만 있고 역할 글자·그림이 없다 (T-01-45)", () => {
    renderRoom(mafiaReveal(15_000));
    const dialog = openRoleCard();
    expect(dialog.querySelector(".mf-rolecard__back")).not.toBeNull();
    expect(dialog.querySelectorAll("img").length).toBe(0);
    expect(sheetHas(dialog, "마피아")).toBe(false);
    expect(sheetHas(dialog, "동료")).toBe(false);
    expect(sheetHas(dialog, "역할 카드")).toBe(true);
  });

  it("카드를 한 번 뒤집은 뒤 [역할 카드] 을 누르면 직업 그림·마피아·한 줄 설명·동료 줄이 보인다", () => {
    const { container } = renderRoom(mafiaReveal(15_000));
    fireEvent.click(card(container));
    const dialog = openRoleCard();
    const img = dialog.querySelector("img");
    expect(img?.getAttribute("src") ?? "").toContain("mafia_default%402x.png");
    expect(within(dialog).queryByRole("heading", { name: "마피아" })).not.toBeNull();
    expect(sheetHas(dialog, ROLE_TEXT.mafia.desc)).toBe(true);
    expect(sheetHas(dialog, "동료 · 민지")).toBe(true);
    expect(dialog.querySelector(".mf-rolecard__back")).toBeNull();
  });

  it("시트를 연 채 서버가 day 를 보내면 시트는 열린 채 앞면 내용이고 뒤 화면은 낮이 된다", () => {
    const r = renderRoom(mafiaReveal(15_000));
    const dialog = openRoleCard();
    rerenderRoom(r.rerender, makeView({ phase: "dayAnnounce", role: "mafia", allies: [2] }));
    const after = document.querySelector<HTMLElement>('dialog[aria-label="역할 카드"]');
    expect(after === dialog, "같은 dialog 요소").toBe(true);
    expect(after?.hasAttribute("open")).toBe(true);
    expect(sheetHas(after!, "마피아")).toBe(true);
    expect(after!.querySelector(".mf-rolecard__back")).toBeNull();
    expect(r.container.querySelector("main.mf-game")?.getAttribute("data-phase")).toBe("dayAnnounce");
  });

  it("역할 확인을 통째로 놓치고 day 에 처음 들어온 사람도 [역할 카드] 에서 앞면 내용을 본다", () => {
    renderRoom(makeView({ phase: "dayAnnounce", role: "police" }));
    const dialog = openRoleCard();
    expect(within(dialog).queryByRole("heading", { name: "경찰" })).not.toBeNull();
    expect(sheetHas(dialog, ROLE_TEXT.police.desc)).toBe(true);
    expect(dialog.querySelector(".mf-rolecard__back")).toBeNull();
  });

  it("새로고침: 역할 확인 6초 뒤 처음 마운트해 카드를 누르지 않고 [역할 카드] 을 눌러도 카드·시트 모두 앞면이다", () => {
    const { container } = renderRoom(mafiaReveal(9_000));
    expect(card(container).classList.contains("mf-card--front")).toBe(true);
    const dialog = openRoleCard();
    expect(dialog.querySelectorAll("img").length).toBe(1);
    expect(within(dialog).queryByRole("heading", { name: "마피아" })).not.toBeNull();
    expect(sheetHas(dialog, "동료 · 민지")).toBe(true);
    expect(dialog.querySelector(".mf-rolecard__back")).toBeNull();
  });

  it("시작 직후 마운트하면 시트는 뒷면이고, 연 채 5초 자동 앞면이 되면 시트 내용이 앞면으로 바뀐다", () => {
    renderRoom(mafiaReveal(15_000));
    const dialog = openRoleCard();
    expect(dialog.querySelector(".mf-rolecard__back")).not.toBeNull();
    advance(5_000);
    expect(dialog.querySelector(".mf-rolecard__back")).toBeNull();
    expect(dialog.querySelectorAll("img").length).toBe(1);
    expect(within(dialog).queryByRole("heading", { name: "마피아" })).not.toBeNull();
  });

  it("me.role 이 없는 view 에서 [역할 카드] 은 '아직 역할이 없어요'", () => {
    renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000 }));
    const dialog = openRoleCard();
    expect(sheetHas(dialog, "아직 역할이 없어요")).toBe(true);
    expect(dialog.querySelectorAll("img").length).toBe(0);
  });

  it("[닫기] 를 누르면 260ms 뒤 시트가 사라지고, 시트가 열려 있어도 역할 확인에는 옛 타이머가 없다", () => {
    const { container } = renderRoom(mafiaReveal(15_000));
    const dialog = openRoleCard();
    advance(3_000);
    expect(stageTimers()).toHaveLength(0);
    const close = within(dialog).queryByRole("button", { name: "닫기" });
    expect(close, "시트 [닫기]").not.toBeNull();
    fireEvent.click(close!);
    advance(260);
    expect(document.querySelector('dialog[aria-label="역할 카드"]')).toBeNull();
  });

  it("[역할 카드] 버튼 마크업은 마피아·시민·역할 없음 view 에서 같고 대기실·배정에는 없다", () => {
    const html = (view: RoomView) => {
      renderRoom(view);
      const out = byRole("button", "내 역할").outerHTML;
      cleanup();
      return out;
    };
    const mafia = html(mafiaReveal(15_000));
    expect(html(makeView({ phase: "roleReveal", endsIn: 15_000, role: "citizen" }))).toBe(mafia);
    expect(html(makeView({ phase: "roleReveal", endsIn: 15_000 }))).toBe(mafia);
    renderRoom(makeView({ phase: "assigning" }));
    expect(screen.queryByRole("button", { name: "내 역할" })).toBeNull();
    cleanup();
    renderRoom(makeView({ phase: "lobby", isHost: true }));
    expect(screen.queryByRole("button", { name: "내 역할" })).toBeNull();
  });
});

// ---- G-01-9 [역할 카드] 시트 진입 — 낮 화면 한 경로 (UAT Test 9) ----
describe("G-01-9 [역할 카드] 시트 진입 — 낮 화면 한 경로", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("G-01-9: 낮 화면에서 [역할 카드] 을 누르면 시트가 진입 전 상태로 열리고 두 프레임 뒤 올라온다", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const runFrame = () =>
      act(() => {
        frames.shift()?.(0);
      });
    renderRoom(makeView({ phase: "dayAnnounce", role: "police" }));
    const dialog = openRoleCard();
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.classList.contains("mf-dialog--open")).toBe(false);
    // 내용은 진입을 기다리지 않고 이미 DOM 에 있다
    expect(within(dialog).queryByRole("heading", { name: "경찰" }) !== null).toBe(true);
    runFrame();
    runFrame();
    expect(dialog.classList.contains("mf-dialog--open")).toBe(true);
  });
});

// ---- G-01-9 시트 계측 — 낮 화면 [역할 카드] 경로 (sheetdebug) ----
describe("G-01-9 시트 계측 — 낮 화면 [역할 카드] 경로 (sheetdebug)", () => {
  afterEach(() => {
    setSheetProbe(null);
    vi.unstubAllGlobals();
    document.querySelectorAll("[data-sheetdebug], .mf-sheetdebug-probes").forEach((el) => el.remove());
  });

  it("G-01-9: sheetdebug 패널이 시트 안에 뜨고 화면 종류가 day 로 기록되며 역할 글자는 없다", () => {
    setSheetProbe(createSheetProbe({ storage: new MemoryStorage() }));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    renderRoom(makeView({ phase: "dayAnnounce", role: "police" }));
    const dialog = openRoleCard();
    const panel = dialog.querySelector("[data-sheetdebug]");
    expect(panel !== null).toBe(true);
    const text = panel?.textContent ?? "";
    expect(text.includes("역할 카드")).toBe(true);
    expect(text.includes("day")).toBe(true);
    expect(text.includes("경찰")).toBe(false);
  });
});

// 08-27: 낮 하단 패널 여백·칩 간격 단언은 맵 화면에 같은 뜻이 없어 지웠다(맵 패널 높이는 gameMap.test 의 측정 시험이 지킨다).
describe("헤더 줄바꿈 금지 (03.1-10, D-16, UI-SPEC A)", () => {
  const phaseCss = readFileSync("src/styles/phase.css", "utf8");
  const bodyOf = (css: string, selector: string) => {
    const at = css.indexOf(`${selector} {`);
    return at < 0 ? "" : css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  };

  it("phase.css: 헤더 제목과 안내는 nowrap 이고 윗줄 최소 높이는 50.4px 이다", () => {
    const rule = phaseCss.split("\n").find((l) => l.includes(".mf-phasebar .mf-t-heading") && l.includes(".mf-phasebar__do") && l.includes("white-space: nowrap")) ?? "";
    expect(rule !== "").toBe(true);
    expect(/min-height:\s*50\.4px/.test(bodyOf(phaseCss, ".mf-phasebar__row"))).toBe(true);
  });
});

// 18-11(D-09): 역할 확인의 공개 예고 줄을 없앴다 — 빈 .mf-reveal__hints 칸은 남아 카드·머리 위치가 바뀌지 않는다. 귓속말 시트(LineSheet)의 예고는 whisperUi 시험이 지킨다
describe("공개 예고 없음 (18-11, D-09)", () => {
  const PRE_WORDS = ["공개돼요", "끝나면 밤 대화"];

  it("역할 넷 모두 [data-pre-notice] 0개·예고 글 없음·빈 hints 칸 1개이고 4초가 지나도 같다(타이머 없음)", () => {
    const rows = (["citizen", "mafia", "police", "doctor"] as const).map((role) => {
      const { container, unmount } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role, allies: role === "mafia" ? [2] : [] }));
      const snap = () => {
        const hints = container.querySelectorAll(".mf-reveal__hints");
        expect(container.querySelectorAll("[data-pre-notice]").length).toBe(0);
        for (const w of PRE_WORDS) expect(container.textContent, w).not.toContain(w);
        expect(hints.length).toBe(1);
        expect(hints[0].children.length).toBe(0);
        return `${hints.length}|${hints[0].textContent}`;
      };
      const at0 = snap();
      advance(4_000);
      const at4 = snap();
      unmount();
      return `${at0}~${at4}`;
    });
    expect(new Set(rows).size).toBe(1);
  });

  it("카드를 뒤집어도 예고 줄이 생기지 않고 hints 칸은 비어 있다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    fireEvent.click(byRole("button", "역할 카드 뒤집기"));
    expect(container.querySelectorAll("[data-pre-notice]").length).toBe(0);
    expect(container.querySelector(".mf-reveal__hints")?.children.length).toBe(0);
    expect(stageTimers()).toHaveLength(0);
  });
});
