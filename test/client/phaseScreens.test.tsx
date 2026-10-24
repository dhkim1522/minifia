import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoomView } from "../../shared/protocol";
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
vi.mock("../../src/net/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/net/assets")>()),
  preloadRoleAssets: preloadMock,
}));

const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { RoleReveal } = await import("../../src/screens/RoleReveal");

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
}

function makeView(o: ViewOpts): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: o.isHost ?? false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  const day: Pick<RoomView, "day"> = o.day === undefined ? {} : { day: { n: o.day, roles: ["mafia", "police", "citizen"] } };
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
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("S-05 역할 확인 (GAME-01, ROLE-02, D-13 개정, D-14, D-15, R12)", () => {
  it("역할 확인 뒷면: 제목·안내·0:15 타이머·카드 뒷면과 카드 아래 안내 두 줄이 보인다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    expect(byRole("heading", "역할 확인")).toBeTruthy();
    expect(byText("카드를 눌러 확인하세요")).toBeTruthy();
    expect(byRole("timer").textContent).toContain("0:15");
    expect(byRole("button", "역할 카드 뒤집기")).toBeTruthy();
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
    expect(byText("카드를 눌러 직업을 확인하세요")).toBeTruthy();
    expect(byText("다른 사람에게 보이지 않게 가려 주세요")).toBeTruthy();
    expect(byRole("button", "내 역할")).toBeTruthy();
  });

  it("카드를 누르면 앞면(마피아·동료 · 민지)과 앞면 안내가 나오고, 다시 누르면 뒷면으로 돌아간다", () => {
    const { container } = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    fireEvent.click(byRole("button", "역할 카드 뒤집기"));
    expect(card(container).classList.contains("mf-card--front")).toBe(true);
    expect(byText("마피아")).toBeTruthy();
    expect(byText("동료 · 민지")).toBeTruthy();
    expect(byText("내 직업이에요")).toBeTruthy();
    expect(byText("확인했으면 그대로 기다리세요")).toBeTruthy();
    expect(byText("카드를 다시 누르면 가려져요")).toBeTruthy();
    expect(screen.queryByText("카드를 눌러 직업을 확인하세요")).toBeNull();

    fireEvent.click(card(container));
    expect(card(container).classList.contains("mf-card--front")).toBe(false);
    expect(byText("카드를 눌러 확인하세요")).toBeTruthy();
    expect(byText("카드를 눌러 직업을 확인하세요")).toBeTruthy();
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
      <RoleReveal view={view} offset={0} myRoleButton={<button type="button">내 역할</button>} onSeenFront={onSeenFront} />,
    );
    expect(card(container).classList.contains("mf-card--front")).toBe(true);
    expect(onSeenFront).toHaveBeenCalledTimes(1);
    advance(5_000);
    expect(onSeenFront).toHaveBeenCalledTimes(1);
  });

  it("처음부터 보면 마운트 때는 onSeenFront 가 불리지 않고 5초 자동 앞면에서 한 번 불린다", () => {
    const onSeenFront = vi.fn();
    const view = makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] });
    render(<RoleReveal view={view} offset={0} myRoleButton={<button type="button">내 역할</button>} onSeenFront={onSeenFront} />);
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

  it("15초가 지나도 서버가 day 를 보내기 전에는 역할 확인(0:00)에 머문다 (T-01-46)", () => {
    renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    advance(15_000);
    expect(byRole("heading", "역할 확인")).toBeTruthy();
    expect(byRole("timer").textContent).toContain("0:00");
    expect(screen.queryByText("낮이 되었습니다")).toBeNull();
  });
});

// 단계 안내 영역은 방 화면 루트의 직접 자식이다. 낮 토론에는 메시지 로그·이모티콘 live 줄도 polite 라서
// 문서 순서 첫 번째 [aria-live] 로는 더 이상 유일하게 찾을 수 없다(02-09).
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
  it("배정 화면: 문구 둘·테이블 위 막·맥박 링 3개가 있고 [내 역할] 은 없다", () => {
    const { container } = renderRoom(makeView({ phase: "assigning" }));
    expect(byText("직업을 배정하고 있습니다…")).toBeTruthy();
    expect(byText("잠시만 기다려 주세요")).toBeTruthy();
    expect(byRole("group", "테이블")).toBeTruthy();
    expect(container.querySelectorAll(".mf-assign__veil").length).toBe(1);
    expect(container.querySelectorAll(".mf-assign__ring").length).toBe(3);
    expect(screen.queryByRole("button", { name: "내 역할" })).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
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
  it("낮 시작 발표: 1일차(view.day 없음)·낮이 되었습니다·직업 공개 안내·[내 역할] 하나, 타이머·테이블 없음, 낮 배경", () => {
    const { container } = renderRoom(makeView({ phase: "dayAnnounce", role: "mafia", allies: [2] }));
    expect(byText("1일차")).toBeTruthy();
    expect(byRole("heading", "낮이 되었습니다")).toBeTruthy();
    expect(byText("토론 전에 먼저 직업을 공개해요")).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: "내 역할" }).length).toBe(1);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
    const art = container.querySelector<HTMLElement>(".mf-backdrop__art");
    expect(art?.style.backgroundImage).toContain("/backgrounds/bg_game_day.svg");
    expect(container.querySelector(".mf-day__morning")).not.toBeNull();
  });

  it("낮 화면의 [내 역할] 버튼 마크업은 마피아·시민·역할 없음에서 같다", () => {
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
    rerenderRoom(first.rerender, makeView({ phase: "claim", endsIn: 15_000, role: "mafia", allies: [2], day: 2 }));
    expect(liveRegion(first.container).textContent).toBe("직업 공개. 주장할 직업을 고르세요");
    rerenderRoom(first.rerender, makeView({ phase: "claimReveal", endsIn: 2_000, durationMs: 2_000, role: "mafia", allies: [2], day: 2 }));
    expect(liveRegion(first.container).textContent).toBe("직업이 공개되었습니다");
    rerenderRoom(first.rerender, makeView({ phase: "discussion", endsIn: 90_000, durationMs: 90_000, role: "mafia", allies: [2], day: 2 }));
    expect(liveRegion(first.container).textContent).toBe("낮 토론");
  });

  it("단계 화면 루트에 mf-phase-enter 가 있고 단계가 바뀌면 새 요소로 바뀐다", () => {
    const r = renderRoom(makeView({ phase: "assigning" }));
    const before = r.container.querySelector(".mf-phase-enter");
    expect(before).not.toBeNull();
    rerenderRoom(r.rerender, makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    const after = r.container.querySelector(".mf-phase-enter");
    expect(after).not.toBeNull();
    expect(after === before).toBe(false);
    // 같은 단계 안 갱신은 같은 요소(다시 나타나지 않는다)
    rerenderRoom(r.rerender, makeView({ phase: "roleReveal", endsIn: 14_000, role: "mafia", allies: [2] }));
    expect(r.container.querySelector(".mf-phase-enter") === after).toBe(true);
  });
});

describe("밤·아침 라우팅과 안내 (UI-SPEC C5·접근성, RESEARCH A6)", () => {
  const night = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "night", endsIn: 30_000, durationMs: 30_000, role: "citizen", day: 1, ...over });
  const morning = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "morning", endsIn: 5_000, durationMs: 5_000, role: "citizen", day: 1, ...over });
  const discussion = () =>
    makeView({ phase: "discussion", endsIn: 90_000, durationMs: 90_000, role: "citizen", day: 1 });

  it("discussion → night → morning: 장면 래퍼(.mf-phase-enter)와 테이블 루트(.mf-dt)가 같은 DOM 노드다 (C5)", () => {
    const r = renderRoom(discussion());
    const scene = r.container.querySelector(".mf-phase-enter");
    const table = r.container.querySelector(".mf-dt");
    expect(scene, "장면 래퍼").not.toBeNull();
    expect(table, "테이블").not.toBeNull();
    rerenderRoom(r.rerender, night());
    expect(r.container.querySelector(".mf-phase-enter") === scene, "night 래퍼 유지").toBe(true);
    expect(r.container.querySelector(".mf-dt") === table, "night 테이블 유지").toBe(true);
    rerenderRoom(r.rerender, morning());
    expect(r.container.querySelector(".mf-phase-enter") === scene, "morning 래퍼 유지").toBe(true);
    expect(r.container.querySelector(".mf-dt") === table, "morning 테이블 유지").toBe(true);
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
  it("view.day.n 이 있으면 그 일차를 그린다", () => {
    renderRoom(makeView({ phase: "dayAnnounce", role: "citizen", day: 3 }));
    expect(byText("3일차")).toBeTruthy();
    expect(screen.queryByText("1일차")).toBeNull();
  });

  it("[내 역할] 버튼 마크업은 마피아·시민·역할 없음에서 같다", () => {
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

describe("S-06b·S-06c·S-07 한 장면 DayScene (DAY-01, UI-SPEC 장면)", () => {
  const claim = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "claim", endsIn: 15_000, durationMs: 15_000, role: "citizen", ...over });
  const reveal = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "claimReveal", endsIn: 2_000, durationMs: 2_000, role: "citizen", ...over });
  const discussion = (over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "discussion", endsIn: 90_000, durationMs: 90_000, role: "citizen", ...over });

  it("직업 공개: 제목·1일차 안내·타이머 하나·테이블 하나·앉은 4명 자리·[내 역할]", () => {
    const { container } = renderRoom(claim());
    expect(byRole("heading", "낮 · 직업 공개")).toBeTruthy();
    expect(byText("1일차")).toBeTruthy();
    expect(screen.queryAllByRole("timer").length).toBe(1);
    expect(byRole("timer").textContent).toContain("0:15");
    expect(screen.queryAllByRole("group", { name: "테이블" }).length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__seat").length).toBe(4);
    expect(screen.queryAllByRole("button", { name: "내 역할" }).length).toBe(1);
    const art = container.querySelector<HTMLElement>(".mf-backdrop__art");
    expect(art?.style.backgroundImage).toContain("/backgrounds/bg_game_day.svg");
  });

  it("공개 연출: 같은 제목, 타이머는 0:00·빈 막대이고 진홍(urgent) 표시가 없다", () => {
    const { container } = renderRoom(reveal({ day: 2 }));
    expect(byRole("heading", "낮 · 직업 공개")).toBeTruthy();
    expect(byText("2일차")).toBeTruthy();
    expect(byRole("timer").textContent).toContain("0:00");
    expect(container.querySelector<HTMLElement>(".mf-timer__fill")?.style.transform).toBe("scaleX(0)");
    expect(container.querySelector(".mf-timer--urgent")).toBeNull();
  });

  it("낮 토론: 제목 '낮 · 토론'과 1:30 타이머", () => {
    renderRoom(discussion());
    expect(byRole("heading", "낮 · 토론")).toBeTruthy();
    expect(byRole("timer").textContent).toContain("1:30");
  });

  it("claim → claimReveal → discussion: 테이블은 같은 노드이고 위쪽 바·하단 패널은 단계마다 새 노드다", () => {
    const r = renderRoom(claim());
    const table = r.container.querySelector(".mf-dt");
    const bar = r.container.querySelector(".mf-dayscene__enter");
    const panel = r.container.querySelector(".mf-dayscene__panel");
    expect(table).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(panel).not.toBeNull();
    rerenderRoom(r.rerender, reveal());
    const table2 = r.container.querySelector(".mf-dt");
    const bar2 = r.container.querySelector(".mf-dayscene__enter");
    const panel2 = r.container.querySelector(".mf-dayscene__panel");
    expect(table2 === table, "claimReveal 테이블 같은 노드").toBe(true);
    expect(bar2 === bar, "claimReveal 위쪽 바 새 노드").toBe(false);
    expect(panel2 === panel, "claimReveal 패널 새 노드").toBe(false);
    rerenderRoom(r.rerender, discussion());
    expect(r.container.querySelector(".mf-dt") === table, "discussion 테이블 같은 노드").toBe(true);
    expect(r.container.querySelector(".mf-dayscene__enter") === bar2, "discussion 위쪽 바 새 노드").toBe(false);
    expect(r.container.querySelector(".mf-dayscene__panel") === panel2, "discussion 패널 새 노드").toBe(false);
  });

  it("같은 단계 안 갱신에는 위쪽 바·패널도 그대로다", () => {
    const r = renderRoom(discussion());
    const bar = r.container.querySelector(".mf-dayscene__enter");
    const panel = r.container.querySelector(".mf-dayscene__panel");
    expect(bar, "위쪽 바 래퍼").not.toBeNull();
    expect(panel, "하단 패널").not.toBeNull();
    rerenderRoom(r.rerender, discussion({ endsIn: 80_000 }));
    expect(r.container.querySelector(".mf-dayscene__enter") === bar).toBe(true);
    expect(r.container.querySelector(".mf-dayscene__panel") === panel).toBe(true);
  });

  it("dayAnnounce → claim: 장면 바깥 래퍼(mf-phase-enter)가 새 노드이고, 세 단계 사이에는 같은 노드다", () => {
    const r = renderRoom(makeView({ phase: "dayAnnounce", role: "citizen", day: 1 }));
    const announce = r.container.querySelector(".mf-phase-enter");
    rerenderRoom(r.rerender, claim());
    const scene = r.container.querySelector(".mf-phase-enter");
    expect(scene === announce, "장면 진입 때 새 래퍼").toBe(false);
    rerenderRoom(r.rerender, reveal());
    expect(r.container.querySelector(".mf-phase-enter") === scene, "claimReveal 래퍼 유지").toBe(true);
    rerenderRoom(r.rerender, discussion());
    expect(r.container.querySelector(".mf-phase-enter") === scene, "discussion 래퍼 유지").toBe(true);
  });

  it("마피아(allies [2])와 시민의 claim 화면은 동료 링·마름모를 뺀 나머지가 같고 역할 글자가 없다", () => {
    const strip = (html: string) =>
      html
        .replace(/<span class="mf-dt__ring mf-dt__ring--mate"><\/span>/g, "")
        .replace(/<svg[^>]*mf-dt__mark[\s\S]*?<\/svg>/g, "");
    const mafia = renderRoom(claim({ role: "mafia", allies: [2] })).container.innerHTML;
    cleanup();
    const citizen = renderRoom(claim({ role: "citizen" })).container.innerHTML;
    expect(citizen.includes("mf-dayscene"), "DayScene 마크업").toBe(true);
    expect(strip(mafia)).toBe(strip(citizen));
    expect(/마피아|경찰|의사/.test(citizen)).toBe(false);
  });
});

describe("대기실 연결 (C-02, R9) · 미리 받기 (Pattern 13 ②)", () => {
  const lobby = (count: number, over: Partial<ViewOpts> = {}) => makeView({ phase: "lobby", isHost: true, count, ...over });

  it("canSend 가 거짓이면 [게임 시작]·[나가기] 가 꺼진다", () => {
    renderRoom(lobby(4), { canSend: false });
    expect((byRole("button", "게임 시작") as HTMLButtonElement).disabled).toBe(true);
    expect((byRole("button", "나가기") as HTMLButtonElement).disabled).toBe(true);
  });

  it("canSend 가 참이면 [게임 시작]·[나가기] 가 켜진다", () => {
    renderRoom(lobby(4), { canSend: true });
    expect((byRole("button", "게임 시작") as HTMLButtonElement).disabled).toBe(false);
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
    rerenderRoom(r.rerender, lobby(3), { epoch: 2 });
    expect(screen.queryByRole("status")?.textContent ?? "").toBe("");
    rerenderRoom(r.rerender, lobby(4), { epoch: 2 });
    expect(screen.queryByRole("status")?.textContent ?? "").toBe("도현님이 들어왔어요");
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
});

describe("단계 전환은 서버 view 만 따른다 (T-01-46)", () => {
  it("역할 확인 마감 뒤 서버가 day 를 보내면 그때 낮 화면으로 바뀐다", () => {
    const r = renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000, role: "mafia", allies: [2] }));
    advance(16_000);
    expect(screen.queryByRole("heading", { name: "낮이 되었습니다" })).toBeNull();
    rerenderRoom(r.rerender, makeView({ phase: "dayAnnounce", role: "mafia", allies: [2] }));
    expect(byRole("heading", "낮이 되었습니다")).toBeTruthy();
  });
});

// ---- [내 역할] 시트 (D-19 개정, 결정 0012, R14, E14, T-01-45) ----

function openMyRole(): HTMLElement {
  fireEvent.click(byRole("button", "내 역할"));
  const dialog = document.querySelector<HTMLElement>('dialog[aria-label="내 역할"]');
  expect(dialog, "내 역할 시트(dialog)").not.toBeNull();
  return dialog!;
}

function sheetHas(dialog: HTMLElement, text: string): boolean {
  return (dialog.textContent ?? "").includes(text);
}

describe("C-01 [내 역할] 시트", () => {
  const mafiaReveal = (endsIn: number) => makeView({ phase: "roleReveal", endsIn, role: "mafia", allies: [2] });

  it("카드를 뒤집지 않고 [내 역할] 을 누르면 시트에는 카드 뒷면만 있고 역할 글자·그림이 없다 (T-01-45)", () => {
    renderRoom(mafiaReveal(15_000));
    const dialog = openMyRole();
    expect(dialog.querySelector(".mf-myrole-sheet__back")).not.toBeNull();
    expect(dialog.querySelectorAll("img").length).toBe(0);
    expect(sheetHas(dialog, "마피아")).toBe(false);
    expect(sheetHas(dialog, "동료")).toBe(false);
    expect(sheetHas(dialog, "내 역할")).toBe(true);
  });

  it("카드를 한 번 뒤집은 뒤 [내 역할] 을 누르면 직업 그림·마피아·한 줄 설명·동료 줄이 보인다", () => {
    const { container } = renderRoom(mafiaReveal(15_000));
    fireEvent.click(card(container));
    const dialog = openMyRole();
    const img = dialog.querySelector("img");
    expect(img?.getAttribute("src") ?? "").toContain("mafia_default%402x.png");
    expect(within(dialog).queryByRole("heading", { name: "마피아" })).not.toBeNull();
    expect(sheetHas(dialog, "밤에 함께 한 명을 지목해요")).toBe(true);
    expect(sheetHas(dialog, "동료 · 민지")).toBe(true);
    expect(dialog.querySelector(".mf-myrole-sheet__back")).toBeNull();
  });

  it("시트를 연 채 서버가 day 를 보내면 시트는 열린 채 앞면 내용이고 뒤 화면은 낮이 된다", () => {
    const r = renderRoom(mafiaReveal(15_000));
    const dialog = openMyRole();
    rerenderRoom(r.rerender, makeView({ phase: "dayAnnounce", role: "mafia", allies: [2] }));
    const after = document.querySelector<HTMLElement>('dialog[aria-label="내 역할"]');
    expect(after === dialog, "같은 dialog 요소").toBe(true);
    expect(after?.hasAttribute("open")).toBe(true);
    expect(sheetHas(after!, "마피아")).toBe(true);
    expect(after!.querySelector(".mf-myrole-sheet__back")).toBeNull();
    expect(r.container.querySelector("h1.mf-day__title")?.textContent).toBe("낮이 되었습니다");
  });

  it("역할 확인을 통째로 놓치고 day 에 처음 들어온 사람도 [내 역할] 에서 앞면 내용을 본다", () => {
    renderRoom(makeView({ phase: "dayAnnounce", role: "police" }));
    const dialog = openMyRole();
    expect(within(dialog).queryByRole("heading", { name: "경찰" })).not.toBeNull();
    expect(sheetHas(dialog, "밤마다 한 명을 조사해요")).toBe(true);
    expect(dialog.querySelector(".mf-myrole-sheet__back")).toBeNull();
  });

  it("새로고침: 역할 확인 6초 뒤 처음 마운트해 카드를 누르지 않고 [내 역할] 을 눌러도 카드·시트 모두 앞면이다", () => {
    const { container } = renderRoom(mafiaReveal(9_000));
    expect(card(container).classList.contains("mf-card--front")).toBe(true);
    const dialog = openMyRole();
    expect(dialog.querySelectorAll("img").length).toBe(1);
    expect(within(dialog).queryByRole("heading", { name: "마피아" })).not.toBeNull();
    expect(sheetHas(dialog, "동료 · 민지")).toBe(true);
    expect(dialog.querySelector(".mf-myrole-sheet__back")).toBeNull();
  });

  it("시작 직후 마운트하면 시트는 뒷면이고, 연 채 5초 자동 앞면이 되면 시트 내용이 앞면으로 바뀐다", () => {
    renderRoom(mafiaReveal(15_000));
    const dialog = openMyRole();
    expect(dialog.querySelector(".mf-myrole-sheet__back")).not.toBeNull();
    advance(5_000);
    expect(dialog.querySelector(".mf-myrole-sheet__back")).toBeNull();
    expect(dialog.querySelectorAll("img").length).toBe(1);
    expect(within(dialog).queryByRole("heading", { name: "마피아" })).not.toBeNull();
  });

  it("me.role 이 없는 view 에서 [내 역할] 은 '아직 역할이 없어요'", () => {
    renderRoom(makeView({ phase: "roleReveal", endsIn: 15_000 }));
    const dialog = openMyRole();
    expect(sheetHas(dialog, "아직 역할이 없어요")).toBe(true);
    expect(dialog.querySelectorAll("img").length).toBe(0);
  });

  it("[닫기] 를 누르면 260ms 뒤 시트가 사라지고, 시트가 열려 있어도 타이머 숫자는 줄어든다", () => {
    const { container } = renderRoom(mafiaReveal(15_000));
    const dialog = openMyRole();
    advance(3_000);
    expect(container.querySelector('[role="timer"]')?.textContent).toContain("0:12");
    const close = within(dialog).queryByRole("button", { name: "닫기" });
    expect(close, "시트 [닫기]").not.toBeNull();
    fireEvent.click(close!);
    advance(260);
    expect(document.querySelector('dialog[aria-label="내 역할"]')).toBeNull();
  });

  it("[내 역할] 버튼 마크업은 마피아·시민·역할 없음 view 에서 같고 대기실·배정에는 없다", () => {
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

// ---- G-01-9 [내 역할] 시트 진입 — 낮 화면 한 경로 (UAT Test 9) ----
describe("G-01-9 [내 역할] 시트 진입 — 낮 화면 한 경로", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("G-01-9: 낮 화면에서 [내 역할] 을 누르면 시트가 진입 전 상태로 열리고 두 프레임 뒤 올라온다", () => {
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
    const dialog = openMyRole();
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.classList.contains("mf-dialog--open")).toBe(false);
    // 내용은 진입을 기다리지 않고 이미 DOM 에 있다
    expect(within(dialog).queryByRole("heading", { name: "경찰" }) !== null).toBe(true);
    runFrame();
    runFrame();
    expect(dialog.classList.contains("mf-dialog--open")).toBe(true);
  });
});

// ---- G-01-9 시트 계측 — 낮 화면 [내 역할] 경로 (sheetdebug) ----
describe("G-01-9 시트 계측 — 낮 화면 [내 역할] 경로 (sheetdebug)", () => {
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
    const dialog = openMyRole();
    const panel = dialog.querySelector("[data-sheetdebug]");
    expect(panel !== null).toBe(true);
    const text = panel?.textContent ?? "";
    expect(text.includes("내 역할")).toBe(true);
    expect(text.includes("day")).toBe(true);
    expect(text.includes("경찰")).toBe(false);
  });
});
