import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PublicPlayer, RoomView } from "../../shared/protocol";
import { readFileSync } from "node:fs";
import { DayTable } from "../../src/components/DayTable";
import type { DayTableSeat } from "../../src/components/DayTable";
import { dayTableGeometry, FIG_H, FIG_W } from "../../src/game/dayTable";
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
    expect(within(table).getByText("민수")).toBeTruthy();
    expect(within(table).getByText("<b>영희</b>")).toBeTruthy();
    expect(within(table).getByText("서준")).toBeTruthy();
    expect(screen.getByRole("group", { name: "민수 (나)" })).toBeTruthy();
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

  it("테이블은 낮과 같은 DayTable 이다(.mf-dt)이고 옛 대기실 테이블 요소는 없다", () => {
    const { container } = render(<Lobby view={view} send={() => {}} />);
    expect(container.querySelectorAll(".mf-lobby__scene > .mf-dt").length).toBe(1);
    expect(container.querySelector(".mf-table, .mf-seat, .mf-badge") === null).toBe(true);
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
    expect(screen.getByRole("group", { name: "테이블" }).querySelectorAll("img.mf-figure--disconnected").length).toBe(1);
  });

  it("방장 왕관(role=img, 이름 '방장')이 정확히 하나 보이고, 동료 표시는 없다(대기실에는 동료가 없다)", () => {
    render(<Lobby view={view} send={() => {}} />);
    const table = screen.getByRole("group", { name: "테이블" });
    expect(within(table).getAllByRole("img", { name: "방장" }).length).toBe(1);
    expect(screen.getByRole("group", { name: "민수 (나)" }).querySelector('[role="img"][aria-label="방장"]')).not.toBeNull();
    expect(table.querySelector('[aria-label="동료"]') === null).toBe(true);
  });

  it("마피아 동료가 있는 view(me.allies)면 그 자리에만 동료 표시가 있다 — 서버가 보낸 값에서만 만든다", () => {
    const v = makeView([player(0, "민수"), player(1, "서준"), player(2, "하윤")], 0, { me: { seat: 0, isHost: true, allies: [2] } });
    render(<Lobby view={v} send={() => {}} />);
    const table = screen.getByRole("group", { name: "테이블" });
    expect(table.querySelectorAll('[aria-label="동료"]').length).toBe(1);
    expect(screen.getByRole("group", { name: "하윤" }).querySelector('[aria-label="동료"]')).not.toBeNull();
  });

  it("내 자리가 방장이 아니어도 내 자리가 맨 아래 가운데에 놓이고 내 링이 있다", () => {
    const { container } = render(<Lobby view={makeView([player(0, "민수"), player(1, "지우")], 1)} send={() => {}} />);
    const mine = screen.getByRole("group", { name: "지우 (나)" });
    const geo = dayTableGeometry(366, 407, 12);
    expect(parseFloat(mine.style.left) + FIG_W / 2).toBeCloseTo(geo.cx, 0);
    expect(parseFloat(mine.style.top) + FIG_H).toBeCloseTo(geo.cy + geo.ry, 0);
    expect(mine.querySelector(".mf-dt__ring--me")).not.toBeNull();
    expect(container.querySelectorAll(".mf-dt__ring--me").length).toBe(1);
  });
});

describe("Lobby — 낮과 같은 기하: 좌석 번호 순서 등간격 (결정 0028)", () => {
  const geo = dayTableGeometry(366, 407, 12);
  const names = ["가나", "다라", "마바", "사아", "자차", "카타", "파하", "거너"];
  const make = (seatsList: number[], mySeat: number) =>
    makeView(
      seatsList.map((n, i) => player(n, names[i]!)),
      mySeat,
    );
  /** 자리 번호 -> 발 위치(좌표는 인라인 left·top 에서) */
  const feet = (container: HTMLElement): Map<number, { x: number; y: number }> => {
    const out = new Map<number, { x: number; y: number }>();
    for (const el of container.querySelectorAll<HTMLElement>(".mf-dt__seat[data-seat]")) {
      out.set(Number(el.dataset.seat), { x: parseFloat(el.style.left) + FIG_W / 2, y: parseFloat(el.style.top) + FIG_H });
    }
    return out;
  };
  const angleOf = (p: { x: number; y: number }): number => Math.atan2((p.y - geo.cy) / geo.ry, (p.x - geo.cx) / geo.rx);

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("%i명: 발이 모두 같은 타원 위에 있고 번호 순서로 각 간격이 2π/n 이며 내가 맨 아래 가운데다", (n) => {
    const seatNums = Array.from({ length: n }, (_, i) => i);
    const mySeat = seatNums[Math.min(1, n - 1)]!;
    const { container } = render(<Lobby view={make(seatNums, mySeat)} send={() => {}} />);
    const f = feet(container);
    expect(f.size).toBe(n);
    for (const p of f.values()) {
      const e = ((p.x - geo.cx) / geo.rx) ** 2 + ((p.y - geo.cy) / geo.ry) ** 2;
      expect(e).toBeCloseTo(1, 1);
    }
    const me = f.get(mySeat)!;
    expect(me.x).toBeCloseTo(geo.cx, 0);
    expect(me.y).toBeCloseTo(geo.cy + geo.ry, 0);
    if (n < 2) return;
    // 내 자리부터 번호 순서(원형)로 각이 2π/n 씩 늘어난다
    const order = [...seatNums.slice(seatNums.indexOf(mySeat)), ...seatNums.slice(0, seatNums.indexOf(mySeat))];
    for (let i = 1; i < order.length; i += 1) {
      const a = angleOf(f.get(order[i - 1]!)!);
      const b = angleOf(f.get(order[i]!)!);
      const d = (((b - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      expect(d).toBeCloseTo((2 * Math.PI) / n, 1);
    }
  });

  it("자리 번호에 빈칸이 있어도(0·3·5) 세 명이 고르게 앉는다", () => {
    const { container } = render(<Lobby view={make([0, 3, 5], 3)} send={() => {}} />);
    const f = feet(container);
    const d = (a: number, b: number) => Math.hypot(f.get(a)!.x - f.get(b)!.x, (f.get(a)!.y - f.get(b)!.y) * (geo.rx / geo.ry));
    expect(d(0, 3)).toBeCloseTo(d(3, 5), -1);
    expect(d(3, 5)).toBeCloseTo(d(5, 0), -1);
  });

  it("2명은 마주 본다: 상대의 가로 중심이 내 가로 중심과 같고 세로로 위쪽이다", () => {
    const { container } = render(<Lobby view={make([0, 1], 0)} send={() => {}} />);
    const f = feet(container);
    expect(f.get(1)!.x).toBeCloseTo(f.get(0)!.x, 0);
    expect(f.get(0)!.y - f.get(1)!.y).toBeGreaterThan(80);
  });

  it("3명은 한 직선 위에 있지 않다(삼각)", () => {
    const { container } = render(<Lobby view={make([0, 1, 2], 0)} send={() => {}} />);
    const f = feet(container);
    const [a, b, c] = [f.get(0)!, f.get(1)!, f.get(2)!];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    expect(Math.abs(cross)).toBeGreaterThan(100);
  });

  it("화면이 자기 기하를 따로 갖지 않는다: 같은 입력의 DayTable 직접 렌더와 자리 인라인 left·top·transform·z-index 가 같다", () => {
    const players = [player(0, "민수"), player(1, "서준", { connected: false }), player(2, "하윤"), player(4, "지아")];
    const lobby = render(<Lobby view={makeView(players, 2)} send={() => {}} />);
    const direct: DayTableSeat[] = players.map((p) => ({
      seat: p.seat,
      nickname: p.nickname,
      connected: p.connected,
      isHost: p.isHost,
      isMe: p.seat === 2,
      isAlly: false,
    }));
    const table = render(<DayTable seats={direct} mySeat={2} />);
    const styleOf = (c: HTMLElement) =>
      [...c.querySelectorAll<HTMLElement>(".mf-dt__seat[data-seat]")].map((e) => [e.dataset.seat, e.style.left, e.style.top, e.style.transform, e.style.zIndex].join("|"));
    expect(styleOf(lobby.container)).toEqual(styleOf(table.container));
    const tagOf = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".mf-dt__tag")].map((e) => [e.dataset.seat, e.style.left, e.style.top, e.style.zIndex].join("|"));
    expect(tagOf(lobby.container)).toEqual(tagOf(table.container));
  });

  it("대기실 CSS 는 장면 상자를 낮과 같이 잡는다: 높이는 100dvh 로 따로 계산하지 않고, 옛 퍼센트 기하 규칙이 없다", () => {
    const css = readFileSync("src/styles/lobby.css", "utf8");
    expect(/100dvh/.test(css)).toBe(false);
    expect(/\.mf-table|\.mf-seat\b|\.mf-seat__|aspect-ratio:\s*4\s*\/\s*5/.test(css)).toBe(false);
    expect(/\.mf-lobby__bar\s*\{[^}]*height:\s*119\.2px/.test(css)).toBe(true);
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
    expect(container.querySelector(".mf-dt__seat--enter") === null).toBe(true);
    expect(container.querySelector(".mf-dt__seat--leave") === null).toBe(true);
  });

  it("입장한 자리에 .mf-dt__seat--enter 가 420ms 동안 붙고 그 뒤 빠진다", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} />);
    rerender(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} />);
    expect(seatEl("하윤")?.classList.contains("mf-dt__seat--enter")).toBe(true);
    expect(seatEl("서준")?.classList.contains("mf-dt__seat--enter")).toBe(false);
    advance(419);
    expect(seatEl("하윤")?.classList.contains("mf-dt__seat--enter")).toBe(true);
    advance(1);
    expect(seatEl("하윤")?.classList.contains("mf-dt__seat--enter")).toBe(false);
  });

  it("나간 사람은 320ms 동안 .mf-dt__seat--leave 로 남았다가 사라진다", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} />);
    rerender(<Lobby view={makeView(base, 0)} send={() => {}} />);
    expect(seatEl("하윤")?.classList.contains("mf-dt__seat--leave")).toBe(true);
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
    expect(seatEl("지아")?.classList.contains("mf-dt__seat--enter")).toBe(true);
  });

  it("epoch 가 바뀐 직후의 변화는 전이 없이 보인다", () => {
    const { rerender } = render(<Lobby view={makeView(base, 0)} send={() => {}} epoch={0} />);
    rerender(<Lobby view={makeView([...base, player(2, "하윤")], 0)} send={() => {}} epoch={1} />);
    expect(seatEl("하윤")?.classList.contains("mf-dt__seat--enter")).toBe(false);
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

  it("시트를 연 뒤 연결이 끊기면 시트의 [나가기] 가 꺼져 leave 가 사라진 채 나가지 않는다 (WR-01)", () => {
    const send = vi.fn();
    const onLeave = vi.fn();
    const { rerender } = render(<Lobby view={lobbyView} send={send} onLeave={onLeave} canSend />);
    fireEvent.click(leaveButton());
    rerender(<Lobby view={lobbyView} send={send} onLeave={onLeave} canSend={false} />);
    const confirm = within(sheet()).getByRole("button", { name: "나가기" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(send).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("send 가 false 를 돌려주면(소켓이 이미 닫힘) onLeave 를 부르지 않고 토스트로 알린다 (WR-01)", () => {
    const send = vi.fn(() => false);
    const onLeave = vi.fn();
    render(<Lobby view={lobbyView} send={send} onLeave={onLeave} />);
    fireEvent.click(leaveButton());
    fireEvent.click(within(sheet()).getByRole("button", { name: "나가기" }));
    expect(send).toHaveBeenCalledWith({ t: "leave" });
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.getByText("연결이 불안정해요. 다시 시도해 주세요")).toBeTruthy();
  });

  it("참가자(방장 아님) 화면에서도 나갈 수 있다", () => {
    const send = vi.fn();
    render(<Lobby view={makeView([player(0, "민수"), player(1, "서준")], 1)} send={send} />);
    fireEvent.click(leaveButton());
    fireEvent.click(within(sheet()).getByRole("button", { name: "나가기" }));
    expect(send).toHaveBeenCalledWith({ t: "leave" });
  });
});

describe("Lobby — 공유 시트와 끊긴 사람 내보내기 (ROOM-01, D-16, R10)", () => {
  const shareDialog = () => screen.getByRole("dialog", { name: "친구 초대하기" });

  it("위쪽 바 [공유](aria-label) → '친구 초대하기' 시트(방 코드 포함), 방장도 참가자도 같다", () => {
    render(<Lobby view={makeView([player(0, "민수"), player(1, "서준")], 0)} send={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    expect(within(shareDialog()).getByText("0042")).toBeTruthy();
    expect(within(shareDialog()).getByRole("heading", { name: "친구 초대하기" })).toBeTruthy();
  });

  it("공유 시트의 링크 칸은 {origin}/r/{코드} 이다", () => {
    render(<Lobby view={makeView([player(0, "민수")], 0)} send={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    const input = within(shareDialog()).getByLabelText("초대 링크") as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/r/0042`);
  });

  it("참가자 화면: '친구가 더 오면 링크를 다시 보낼 수 있어요' + [링크 공유] → 같은 시트", () => {
    render(<Lobby view={makeView([player(0, "민수"), player(1, "서준")], 1)} send={() => {}} />);
    expect(screen.getByText("친구가 더 오면 링크를 다시 보낼 수 있어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "링크 공유" }));
    expect(shareDialog()).toBeTruthy();
  });

  it("방장 화면에는 하단 [링크 공유] 와 그 안내가 없다", () => {
    render(<Lobby view={makeView([player(0, "민수"), player(1, "서준")], 0)} send={() => {}} />);
    expect(screen.queryByRole("button", { name: "링크 공유" })).toBeNull();
    expect(screen.queryByText("친구가 더 오면 링크를 다시 보낼 수 있어요")).toBeNull();
  });

  it("자리 8개가 차면 공유 시트에 '방이 가득 찼어요'", () => {
    const players = Array.from({ length: 8 }, (_, i) => player(i, `친구${i}`));
    render(<Lobby view={makeView(players, 0)} send={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    expect(within(shareDialog()).getByText("방이 가득 찼어요")).toBeTruthy();
  });

  const kickView = () => makeView([player(0, "민수"), player(1, "서준", { connected: false }), player(2, "하윤")], 0);
  const kickDialog = () => screen.getByRole("dialog", { name: "서준님을 내보낼까요?" });

  it("방장이 끊긴 서준 자리를 누르면 '서준님을 내보낼까요?' → [내보내기] → send kick seat 1", () => {
    const send = vi.fn();
    render(<Lobby view={kickView()} send={send} />);
    fireEvent.click(screen.getByRole("button", { name: "서준, 연결 끊김" }));
    expect(within(kickDialog()).getByRole("heading", { name: "서준님을 내보낼까요?" })).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(within(kickDialog()).getByRole("button", { name: "내보내기" }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "kick", seat: 1 });
  });

  it("[취소] 하면 kick 을 보내지 않는다", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    render(<Lobby view={kickView()} send={send} />);
    fireEvent.click(screen.getByRole("button", { name: "서준, 연결 끊김" }));
    fireEvent.click(within(kickDialog()).getByRole("button", { name: "취소" }));
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("연결된 사람 자리·내 자리에는 누를 버튼이 없다", () => {
    render(<Lobby view={kickView()} send={() => {}} />);
    expect(screen.queryByRole("button", { name: "하윤" })).toBeNull();
    expect(screen.queryByRole("button", { name: "민수 (나)" })).toBeNull();
  });

  it("참가자 화면에서는 끊긴 자리도 누를 버튼이 없다", () => {
    render(<Lobby view={makeView([player(0, "민수"), player(1, "서준", { connected: false }), player(2, "하윤")], 2)} send={() => {}} />);
    expect(screen.queryByRole("button", { name: "서준, 연결 끊김" })).toBeNull();
  });

  it("canSend 가 거짓이면 끊긴 자리도 누를 버튼이 없다", () => {
    render(<Lobby view={kickView()} send={() => {}} canSend={false} />);
    expect(screen.queryByRole("button", { name: "서준, 연결 끊김" })).toBeNull();
  });

  it("내보내기를 눌렀는데 그사이 서준이 다시 연결됐으면 시트는 닫히고 화면은 새 view 대로 그린다", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const players = [player(0, "민수"), player(1, "서준", { connected: false }), player(2, "하윤")];
    const { rerender } = render(<Lobby view={makeView(players, 0)} send={send} />);
    fireEvent.click(screen.getByRole("button", { name: "서준, 연결 끊김" }));
    rerender(<Lobby view={makeView([players[0]!, player(1, "서준"), players[2]!], 0)} send={send} />);
    fireEvent.click(within(kickDialog()).getByRole("button", { name: "내보내기" }));
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(send).toHaveBeenCalledWith({ t: "kick", seat: 1 });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("group", { name: "서준" })).toBeTruthy();
  });

  it("내보낼 사람의 닉네임이 길어도 말줄임 없이 제목에 그대로 들어간다", () => {
    const long = "가나다라마바사아";
    render(<Lobby view={makeView([player(0, "민수"), player(1, long, { connected: false })], 0)} send={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: `${long}, 연결 끊김` }));
    expect(screen.getByRole("heading", { name: `${long}님을 내보낼까요?` })).toBeTruthy();
  });
});
