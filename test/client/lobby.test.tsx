import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PublicPlayer, RoomView } from "../../shared/protocol";
import { Lobby } from "../../src/screens/Lobby";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const player = (seat: number, nickname: string, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  seat,
  nickname,
  connected: true,
  isHost: seat === 0,
  ...extra,
});

const makeView = (players: PublicPlayer[], mySeat = 0, extra: Partial<RoomView> = {}): RoomView => ({
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players,
  me: { seat: mySeat, isHost: players.find((p) => p.seat === mySeat)?.isHost ?? false },
  ...extra,
});

describe("Lobby — 대기실 (S-03) 테이블", () => {
  const view = makeView([player(0, "민수"), player(1, "<b>영희</b>"), player(2, "서준")], 0);

  it("방 코드 라벨과 코드, 테이블 위 이름 3개를 보여 주고 닉네임은 텍스트로만 그린다", () => {
    const { container } = render(<Lobby view={view} send={() => {}} />);
    expect(screen.getByText("방 코드")).toBeTruthy();
    expect(screen.getByText("0042")).toBeTruthy();
    const table = screen.getByRole("group", { name: "테이블" });
    expect(within(table).getByText("민수 (나)")).toBeTruthy();
    expect(within(table).getByText("<b>영희</b>")).toBeTruthy();
    expect(within(table).getByText("서준")).toBeTruthy();
    expect(container.querySelector("b") === null).toBe(true);
  });

  it("01-02 의 임시 목록(ul)은 더 이상 없다", () => {
    const { container } = render(<Lobby view={view} send={() => {}} />);
    expect(container.querySelector("ul") === null).toBe(true);
    expect(container.querySelector(".lobby-players") === null).toBe(true);
  });

  it("대기 장면(bg_game_lobby.svg) 위에 그려진다", () => {
    const { container } = render(<Lobby view={view} send={() => {}} />);
    const art = container.querySelector(".mf-backdrop__art") as HTMLElement | null;
    expect(art?.style.backgroundImage).toContain("/backgrounds/bg_game_lobby.svg");
  });

  it("방장 혼자면 테이블에 인물 1개뿐이고 빈 자리 그림은 없다", () => {
    render(<Lobby view={makeView([player(0, "민수")], 0)} send={() => {}} />);
    const table = screen.getByRole("group", { name: "테이블" });
    expect(table.querySelectorAll("img").length).toBe(1);
  });

  it("끊긴 사람은 '{닉네임}, 연결 끊김' 으로 읽히고 인물이 흑백이다", () => {
    render(<Lobby view={makeView([player(0, "민수"), player(1, "하윤", { connected: false })], 0)} send={() => {}} />);
    const seatEl = screen.getByRole("group", { name: "하윤, 연결 끊김" });
    expect(seatEl.querySelector("img")?.classList.contains("mf-figure--disconnected")).toBe(true);
  });

  it("방장 배지 '방장' 이 하나 보이고, 동료 표시는 없다(대기실에는 동료가 없다)", () => {
    render(<Lobby view={view} send={() => {}} />);
    const table = screen.getByRole("group", { name: "테이블" });
    expect(within(table).getAllByText("방장").length).toBe(1);
    expect(table.querySelector('[aria-label="동료"]') === null).toBe(true);
  });

  it("내 자리가 방장이 아니어도 내 자리가 맨 아래 가운데에 '(나)' 로 놓인다", () => {
    render(<Lobby view={makeView([player(0, "민수"), player(1, "지우")], 1)} send={() => {}} />);
    const mine = screen.getByRole("group", { name: "지우 (나)" });
    expect(parseFloat(mine.style.left)).toBeCloseTo(50, 5);
  });
});

describe("Lobby — 하단 시트: 연결된 인원·안내·[게임 시작] (ROOM-03, R7)", () => {
  const startButton = () => screen.queryByRole("button", { name: "게임 시작" }) as HTMLButtonElement | null;
  // 방장(seat 0) + 연결된 참가자 n 명 + 끊긴 참가자 away 명
  const hostView = (connected: number, away = 0) => {
    const players = [player(0, "방장님")];
    for (let i = 1; i <= connected; i += 1) players.push(player(i, `친구${i}`));
    for (let i = 0; i < away; i += 1) players.push(player(connected + 1 + i, `먼친구${i}`, { connected: false }));
    return makeView(players, 0);
  };

  it("방장 혼자(연결) → 안내 '4명부터 시작할 수 있어요', 인원 '1 / 8명', [게임 시작] 꺼짐", () => {
    render(<Lobby view={hostView(0)} send={() => {}} />);
    expect(screen.getByText("4명부터 시작할 수 있어요")).toBeTruthy();
    expect(screen.getByText("1 / 8명")).toBeTruthy();
    expect(startButton()?.disabled).toBe(true);
  });

  it("방장 + 연결 3명 → '모두 모였으면 시작하세요', '4 / 8명', [게임 시작] 켜짐", () => {
    render(<Lobby view={hostView(3)} send={() => {}} />);
    expect(screen.getByText("모두 모였으면 시작하세요")).toBeTruthy();
    expect(screen.getByText("4 / 8명")).toBeTruthy();
    expect(startButton()?.disabled).toBe(false);
  });

  it("[게임 시작]을 누르면 start 를 한 번 보내고 2초 안에는 다시 보내지 않으며 2초 뒤 다시 켜진다", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    render(<Lobby view={hostView(3)} send={send} />);
    fireEvent.click(startButton()!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "start" });
    expect(startButton()?.disabled).toBe(true);
    fireEvent.click(startButton()!);
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    fireEvent.click(startButton()!);
    expect(send).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(startButton()?.disabled).toBe(false);
    fireEvent.click(startButton()!);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("연결 3 + 끊김 2 → '3 / 8명', 안내 '4명부터 시작할 수 있어요', [게임 시작] 꺼짐(끊긴 사람은 시작 인원에 들지 않는다)", () => {
    render(<Lobby view={hostView(2, 2)} send={() => {}} />);
    expect(screen.getByText("3 / 8명")).toBeTruthy();
    expect(screen.getByText("4명부터 시작할 수 있어요")).toBeTruthy();
    expect(startButton()?.disabled).toBe(true);
  });

  it("자리 8개가 차면(끊긴 사람 포함) '8 / 8명 · 가득 찼어요'", () => {
    render(<Lobby view={hostView(5, 2)} send={() => {}} />);
    expect(screen.getByText("8 / 8명 · 가득 찼어요")).toBeTruthy();
  });

  it("canSend 가 거짓이면 [게임 시작]이 꺼진다", () => {
    render(<Lobby view={hostView(3)} send={() => {}} canSend={false} />);
    expect(startButton()?.disabled).toBe(true);
  });

  it("canSend 가 꺼진 채로는 눌러도 start 를 보내지 않는다", () => {
    const send = vi.fn();
    render(<Lobby view={hostView(3)} send={send} canSend={false} />);
    fireEvent.click(startButton()!);
    expect(send).not.toHaveBeenCalled();
  });

  it("참가자 화면: [게임 시작]이 없고 안내는 '방장이 시작하길 기다리는 중이에요'", () => {
    const view = makeView([player(0, "민수"), player(1, "서준"), player(2, "하윤")], 1);
    render(<Lobby view={view} send={() => {}} />);
    expect(startButton() === null).toBe(true);
    expect(screen.getByText("방장이 시작하길 기다리는 중이에요")).toBeTruthy();
    expect(screen.getByText("3 / 8명")).toBeTruthy();
  });

  it("참가자 화면에서 방장이 끊겼으면 안내가 '방장 연결을 기다리는 중이에요'", () => {
    const view = makeView([player(0, "민수", { connected: false }), player(1, "서준")], 1);
    render(<Lobby view={view} send={() => {}} />);
    expect(screen.getByText("방장 연결을 기다리는 중이에요")).toBeTruthy();
    expect(screen.getByText("1 / 8명")).toBeTruthy();
  });

  it("시작이 거절된 뒤 같은 view 가 다시 와도 같은 문구·버튼 상태이다(화면이 따로 상태를 기억하지 않는다)", () => {
    vi.useFakeTimers();
    const view = hostView(3);
    const { rerender } = render(<Lobby view={view} send={() => {}} />);
    rerender(<Lobby view={{ ...view, serverNow: 5 }} send={() => {}} />);
    expect(screen.getByText("모두 모였으면 시작하세요")).toBeTruthy();
    expect(screen.getByText("4 / 8명")).toBeTruthy();
    expect(startButton()?.disabled).toBe(false);
  });

  it("안내 문장은 한 줄 고정 문구이고 방 코드는 4자리다", () => {
    render(<Lobby view={hostView(0)} send={() => {}} />);
    expect(screen.getByText("0042").textContent?.length).toBe(4);
    expect(screen.getByText("4명부터 시작할 수 있어요").textContent).not.toContain("\n");
  });
});
