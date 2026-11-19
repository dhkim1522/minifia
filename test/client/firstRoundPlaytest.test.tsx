import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { hostLineOf } from "../../src/game/hostLine";
import { GamePanel } from "../../src/screens/GamePanel";
import { RoleReveal } from "../../src/screens/RoleReveal";

const NOW = 1_700_000_000_000;
const roles: NonNullable<RoomView["day"]>["roles"] = ["mafia", "police", "citizen", "citizen"];
const players = ["민준", "지호", "하린", "유나"].map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 }));
const binding = { messages: [], value: "", onChange: () => {}, onSend: () => {} };

function fixture(overrides: Partial<RoomView>): RoomView {
  return {
    code: "0042",
    playtest: true,
    phase: "discussion",
    phaseEndsAt: NOW + 150_000,
    phaseDurationMs: 150_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, role: "citizen", isHost: true },
    day: { n: 1, roles },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("첫날 실험방의 최소 조작", () => {
  it("역할 카드를 바로 읽고 준비한 뒤에는 같은 카드에서 기다린다", () => {
    const view = fixture({ phase: "roleReveal" });
    const send = vi.fn();
    const onSeenFront = vi.fn();
    const node = (room: RoomView) => <RoleReveal view={room} offset={0} myRoleButton={null} onSeenFront={onSeenFront} send={send} canSend />;
    const { rerender } = render(node(view));
    expect(screen.queryByRole("button", { name: "역할 카드 뒤집기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "준비" }));
    expect(send).toHaveBeenCalledWith({ t: "roleReady" });

    const confirmed = { ...view, me: { ...view.me, roleReady: true as const } };
    rerender(node(confirmed));
    expect(screen.queryByRole("button", { name: "준비" })).toBeNull();
    expect(screen.getByText("시민")).toBeTruthy();
    expect(hostLineOf(confirmed)).toBe("다른 사람을 기다려요");
  });

  it("토론을 시작하면 곧바로 토론 스킵을 요청하고 45초 뒤 과반으로 바뀐다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const view = fixture({ day: { n: 1, roles, voteOpensAt: NOW + 45_000, voteReadyTotal: 4, voteReadyRequired: 3 } });
    const send = vi.fn();
    render(<GamePanel view={view} send={send} binding={binding} logHeight={68} canSend />);
    const vote = screen.getByRole("button", { name: /토론 스킵, 필요한 4명 중 0명 요청/ });
    fireEvent.click(vote);
    expect(send).toHaveBeenCalledWith({ t: "endDiscussion", on: true });
    act(() => { vi.advanceTimersByTime(45_000); });
    expect(screen.getByRole("button", { name: /토론 스킵 취소, 필요한 3명 중 0명 요청/ })).toBe(vote);
    expect(vote.getAttribute("aria-pressed")).toBe("true");
  });

  it("대상과 안 뽑기를 같은 화면에서 보내고 서버 결과로 선택 목록을 바꾼다", () => {
    const day = { n: 1, roles, firstBallot: { count: 0 } };
    const view = fixture({ phase: "verdict", day });
    const send = vi.fn();
    const node = (room: RoomView) => <GamePanel view={room} send={send} binding={binding} logHeight={68} canSend />;
    const { rerender } = render(node(view));
    fireEvent.click(screen.getByRole("button", { name: "하린" }));
    fireEvent.click(screen.getByRole("button", { name: "오늘은 안 뽑기" }));
    expect(send.mock.calls).toEqual([[{ t: "firstBallot", target: 2 }], [{ t: "firstBallot", target: null }]]);
    rerender(node({ ...view, day: { ...day, firstBallot: { count: 4, result: { target: 2, votes: 3, holds: 1 } } } }));
    expect(screen.queryByRole("button", { name: "하린" })).toBeNull();
    expect(screen.getByText("하린 님이 지목됐어요")).toBeTruthy();
    rerender(node({ ...view, day: { ...day, firstBallot: { count: 4, result: { target: null, votes: 0, holds: 4, reason: "held" } } } }));
    expect(screen.getByText("오늘은 아무도 지목되지 않았어요")).toBeTruthy();
    expect(screen.getByText("최다 득표 0표 · 안 뽑기 4표")).toBeTruthy();
  });

  it("밤 시민에게 선택이 없고 경찰은 자신을 제외한 사람을 고른다", () => {
    const view = fixture({ phase: "night" });
    const send = vi.fn();
    const node = (room: RoomView) => <GamePanel view={room} send={send} binding={binding} logHeight={68} canSend />;
    const { rerender } = render(node(view));
    expect(screen.queryByRole("group", { name: "밤 대상" })).toBeNull();
    const police = { ...view, me: { ...view.me, role: "police" as const } };
    rerender(node(police));
    expect(screen.queryByRole("button", { name: "민준 고르기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "지호 고르기" }));
    expect(send).toHaveBeenCalledWith({ t: "pick", target: 1 });
  });

  it.each(["night", "verdict"] as const)("%s 단계의 유령은 채팅을 직접 열고 닫는다", (phase) => {
    const view = fixture({ phase, players: players.map((player) => player.seat === 0 ? { ...player, alive: false } : player) });
    view.me.chat = "ghost";
    render(<GamePanel view={view} send={vi.fn()} binding={{ ...binding, channel: "ghost" }} logHeight={68} canSend />);
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "채팅" }));
    expect(screen.getByRole("textbox", { name: "유령 채팅 입력" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "채팅 닫기" }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
