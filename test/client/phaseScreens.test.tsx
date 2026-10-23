import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 연결 훅은 반환값을 테스트가 정한다(roomScreen.test 와 같은 방식). 단계 화면은 서버 view 만 따른다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
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
}

function makeView(o: ViewOpts): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  return {
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
    ],
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
