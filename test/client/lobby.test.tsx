import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import type { PublicPlayer, RoomView } from "../../shared/protocol";
import { Lobby } from "../../src/screens/Lobby";

afterEach(cleanup);

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
