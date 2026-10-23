import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
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

describe("Lobby — 입장·방장 변경 토스트와 자리 등장·퇴장 (D-10, R9)", () => {
  const base = [player(0, "민수"), player(1, "서준")];
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const seatEl = (name: string) => screen.queryByRole("group", { name }) as HTMLElement | null;

  it("처음 render 에는 토스트가 없고, StrictMode 이중 effect 에서도 없다", () => {
    render(
      <StrictMode>
        <Lobby view={makeView(base, 0)} send={() => {}} />
      </StrictMode>,
    );
    expect(screen.queryByRole("status") === null).toBe(true);
  });

  it("같은 epoch 로 하윤이 더해진 view 가 오면 토스트 '하윤님이 들어왔어요' 가 2초 보이고 사라진다", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} epoch={0} />);
    rerender(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} epoch={0} />);
    expect(screen.getByRole("status").textContent).toBe("하윤님이 들어왔어요");
    advance(1999);
    expect(screen.queryByRole("status") !== null).toBe(true);
    advance(1);
    expect(screen.queryByRole("status") === null).toBe(true);
  });

  it("epoch 를 바꾸며 사람이 더해진 view 를 주면(재연결 직후) 토스트가 없다", () => {
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} epoch={0} />);
    rerender(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} epoch={1} />);
    expect(screen.queryByRole("status") === null).toBe(true);
  });

  it("재연결 뒤 같은 epoch 의 다음 변화에는 다시 토스트가 난다", () => {
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} epoch={0} />);
    rerender(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} epoch={1} />);
    rerender(<Lobby view={makeView([...base, player(2, "하윤"), player(3, "지아")], 0)} send={() => {}} epoch={1} />);
    expect(screen.getByRole("status").textContent).toBe("지아님이 들어왔어요");
  });

  it("방장이 바뀌면 '서준님이 새 방장이 되었어요' 토스트", () => {
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} />);
    rerender(
      <Lobby view={makeView([player(0, "민수", { isHost: false }), player(1, "서준", { isHost: true })], 0)} send={() => {}} />,
    );
    expect(screen.getByRole("status").textContent).toBe("서준님이 새 방장이 되었어요");
  });

  it("같은 변화에 입장과 방장 변경이 함께면 방장 변경을 보인다", () => {
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} />);
    rerender(
      <Lobby
        view={makeView([player(0, "민수", { isHost: false }), player(1, "서준", { isHost: true }), player(2, "하윤")], 0)}
        send={() => {}}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("서준님이 새 방장이 되었어요");
  });

  it("나 자신이 새로 앉은 변화에는 토스트가 없다", () => {
    const { rerender } = render(<Lobby view={makeView([player(0, "민수")], 0)} send={() => {}} />);
    rerender(<Lobby view={makeView([player(0, "민수"), player(1, "서준")], 1)} send={() => {}} />);
    expect(screen.queryByRole("status") === null).toBe(true);
  });

  it("처음 그릴 때 이미 있던 자리에는 전이 클래스가 없다", () => {
    const { container } = render(<Lobby view={makeView(base, 0)} send={() => {}} />);
    expect(container.querySelector(".mf-seat--enter") === null).toBe(true);
    expect(container.querySelector(".mf-seat--leave") === null).toBe(true);
  });

  it("입장한 자리에 .mf-seat--enter 가 420ms 동안 붙고 그 뒤 빠진다", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} />);
    rerender(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} />);
    expect(seatEl("하윤")?.classList.contains("mf-seat--enter")).toBe(true);
    expect(seatEl("서준")?.classList.contains("mf-seat--enter")).toBe(false);
    advance(419);
    expect(seatEl("하윤")?.classList.contains("mf-seat--enter")).toBe(true);
    advance(1);
    expect(seatEl("하윤")?.classList.contains("mf-seat--enter")).toBe(false);
  });

  it("나간 사람은 320ms 동안 .mf-seat--leave 로 남았다가 사라진다", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} />);
    rerender(<Lobby view={makeView(base, 0)} send={() => {}} />);
    expect(seatEl("하윤")?.classList.contains("mf-seat--leave")).toBe(true);
    advance(319);
    expect(seatEl("하윤") !== null).toBe(true);
    advance(1);
    expect(seatEl("하윤") === null).toBe(true);
  });

  it("나간 자리에 다른 사람이 바로 앉으면 남긴 사람을 바로 빼고 새 사람이 등장한다", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} />);
    rerender(<Lobby view={makeView([player(0, "민수"), player(1, "지아")], 0)} send={() => {}} />);
    expect(seatEl("서준") === null).toBe(true);
    expect(seatEl("지아")?.classList.contains("mf-seat--enter")).toBe(true);
  });

  it("epoch 가 바뀐 직후의 변화는 전이 없이 보인다", () => {
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} epoch={0} />);
    rerender(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} epoch={1} />);
    expect(seatEl("하윤")?.classList.contains("mf-seat--enter")).toBe(false);
  });
});

describe("Lobby — [뒤로] 로 방 나가기 (D-17, R17)", () => {
  const lobbyView = makeView([player(0, "민수"), player(1, "서준"), player(2, "하윤")], 0);
  const leaveButton = () => screen.getByRole("button", { name: "나가기" }) as HTMLButtonElement;
  const sheet = () => screen.getByRole("dialog", { name: "방에서 나갈까요?" });

  it("위쪽 바에 [나가기](aria-label) 아이콘 버튼이 있고 시트는 닫혀 있다", () => {
    render(<Lobby view={lobbyView} send={() => {}} />);
    expect(leaveButton()).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("[나가기] → '방에서 나갈까요?' → 시트의 [나가기] → send leave 와 onLeave 가 각각 한 번", () => {
    const send = vi.fn();
    const onLeave = vi.fn();
    render(<Lobby view={lobbyView} send={send} onLeave={onLeave} />);
    fireEvent.click(leaveButton());
    expect(screen.getByRole("heading", { name: "방에서 나갈까요?" })).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(within(sheet()).getByRole("button", { name: "나가기" }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "leave" });
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("[취소] 는 아무것도 보내지 않고 시트가 닫힌다", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const onLeave = vi.fn();
    render(<Lobby view={lobbyView} send={send} onLeave={onLeave} />);
    fireEvent.click(leaveButton());
    fireEvent.click(within(sheet()).getByRole("button", { name: "취소" }));
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(send).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("canSend 가 거짓이면 [나가기] 아이콘 버튼이 꺼진다", () => {
    render(<Lobby view={lobbyView} send={() => {}} canSend={false} />);
    expect(leaveButton().disabled).toBe(true);
  });

  it("참가자(방장 아님) 화면에서도 나갈 수 있다", () => {
    const send = vi.fn();
    render(<Lobby view={makeView([player(0, "민수"), player(1, "서준")], 1)} send={send} />);
    fireEvent.click(leaveButton());
    fireEvent.click(within(sheet()).getByRole("button", { name: "나가기" }));
    expect(send).toHaveBeenCalledWith({ t: "leave" });
  });
});
