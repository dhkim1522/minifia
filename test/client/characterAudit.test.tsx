/// <reference types="node" />
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoomPreview, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { NAMES, viewAt } from "../helpers/verdictViews";
import type { Count } from "../helpers/verdictViews";

// CHAR-01 점검표(UI-SPEC §10, 05-04): 자리 0~7 의 테이블 인물 8장은 서로 다르고, 5명·8명 방의 대기실·낮(토론)·투표(후보 선택)·결과·
// 링크 참가 화면에서 모든 자리의 닉네임이 그 자리 그림과 함께 보인다. 외형은 자리 번호만으로 정한다(D-02, D-03) — 역할은 입력이 아니다.
// 소스를 바꾸지 않는 점검이다: 이 시험이 처음부터 통과하는 것이 UI-SPEC §10 "고칠 것 없음" 의 확인이다.

// RoomScreen 의 연결 훅만 가짜로 바꾼다(phaseScreens.test.tsx 와 같은 방식). 서버와는 view 로만 만난다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { JoinByLink } = await import("../../src/screens/JoinByLink");
const { figureSrc, ghostSrc } = await import("../../src/net/assets");

const NOW = 1_700_000_000_000;

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

/** lobby·discussion 용 간단한 view: n 명, 모두 접속, 0번이 방장이자 나. 닉네임은 5글자 NAMES */
function simpleView(phase: PhaseId, n: number, role?: RoleId): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: true };
  if (role !== undefined) me.role = role;
  if (role === "mafia") me.allies = [1];
  return {
    code: "0042",
    phase,
    phaseEndsAt: phase === "lobby" ? null : NOW + 15_000,
    phaseDurationMs: phase === "lobby" ? null : 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: Array.from({ length: n }, (_, seat) => ({ seat, nickname: NAMES[seat]!, connected: true, isHost: seat === 0 })),
    me,
    ...(phase === "discussion" || phase === "night" ? { day: { n: 1, roles: ["mafia", "police", "citizen"] as RoleId[] } } : {}),
  };
}

const seatImg = (c: HTMLElement, seat: number): HTMLImageElement[] =>
  Array.from(c.querySelectorAll<HTMLImageElement>(`.mf-dt__seat[data-seat="${seat}"] img`));
const tagOf = (c: HTMLElement, seat: number): HTMLElement | null => c.querySelector<HTMLElement>(`.mf-dt__tag[data-seat="${seat}"]`);

/** 테이블 위 모든 자리: 닉네임 이름표가 있고, 그림이 하나 이상 있다. 살아 있는 자리의 그림은 그 자리 번호의 인물이다 */
function expectEverySeatNamed(c: HTMLElement, n: number, deadSeats: readonly number[] = []): string[] {
  const srcs: string[] = [];
  for (let seat = 0; seat < n; seat++) {
    const tag = tagOf(c, seat);
    expect(tag, `자리 ${seat} 이름표`).not.toBeNull();
    expect(tag!.textContent, `자리 ${seat} 닉네임`).toContain(NAMES[seat]);
    const imgs = seatImg(c, seat);
    expect(imgs.length, `자리 ${seat} 그림`).toBeGreaterThanOrEqual(1);
    const want = deadSeats.includes(seat) ? ghostSrc().src : figureSrc(seat).src;
    expect(
      imgs.some((img) => img.getAttribute("src") === want),
      `자리 ${seat} 그림 src`,
    ).toBe(true);
    srcs.push(imgs[0]!.getAttribute("src")!);
  }
  return srcs;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CHAR-01: 테이블 인물 8장은 서로 다르고 자리 번호가 외형을 정한다 (D-02, D-03)", () => {
  it("figureSrc(0..7) 의 src 8개가 모두 다르다", () => {
    const srcs = Array.from({ length: 8 }, (_, seat) => figureSrc(seat).src);
    expect(new Set(srcs).size).toBe(8);
    expect(new Set(Array.from({ length: 8 }, (_, seat) => figureSrc(seat).srcSet)).size).toBe(8);
  });

  it("figureSrc(s + 8) 은 figureSrc(s) 와 같다 — 외형은 자리 번호만의 함수다(역할·능력 입력 없음)", () => {
    for (let seat = 0; seat < 8; seat++) expect(figureSrc(seat + 8)).toEqual(figureSrc(seat));
    expect(figureSrc.length).toBe(1);
  });
});

// 낮 토론은 08-13, 밤·아침은 08-18 부터 맵(WorldStage) 화면이라 테이블 인물 검사는 같은 DayTable 을 쓰는 처형 여부 투표로 옮겼다(테이블은 08-19 가 지울 때 함께 정리).
describe("CHAR-01: 처형 여부 투표(옛 테이블) — 5명·8명 모두 닉네임과 인물", () => {
  it.each([5, 8])("%i명: 모든 자리 이름표 닉네임, 인물 src 가 서로 다르다", (n) => {
    const { container } = renderRoom(simpleView("execVote", n, "citizen"));
    const srcs = expectEverySeatNamed(container, n);
    expect(new Set(srcs).size).toBe(n);
  });

  it("내 역할이 시민이든 마피아든 모든 자리의 인물 그림은 같다 (능력 무관, D-03·T-05-10)", () => {
    const citizen = renderRoom(simpleView("execVote", 5, "citizen"));
    const a = expectEverySeatNamed(citizen.container, 5);
    cleanup();
    const mafia = renderRoom(simpleView("execVote", 5, "mafia"));
    const b = expectEverySeatNamed(mafia.container, 5);
    expect(b).toEqual(a);
  });
});

describe("CHAR-01: 투표(후보 선택) — 탈락 자리도 닉네임을 유지한다", () => {
  it("8명(7번 탈락): 모든 자리 이름표 닉네임, 살아 있는 자리는 그 자리 인물, 탈락 자리는 유령 그림", () => {
    const view = viewAt("candidateVote", { stage: "candidateVote", viewer: "alive", count: 8 }, false);
    const { container } = renderRoom(view);
    const srcs = expectEverySeatNamed(container, 8, [7]);
    expect(new Set(srcs).size).toBe(8);
    expect(tagOf(container, 7)!.textContent).toContain(NAMES[7]);
  });

  it("5명 방도 같다(탈락 없음)", () => {
    const view = viewAt("candidateVote", { stage: "candidateVote", viewer: "alive", count: 5 as unknown as Count }, false);
    const { container } = renderRoom(view);
    const srcs = expectEverySeatNamed(container, 5);
    expect(new Set(srcs).size).toBe(5);
  });
});

describe("CHAR-01: 결과 — 자리마다 이름표(자리 색 점 + 닉네임)와 그림 (그림은 직업 그림 — P5-8, 바꾸지 않음)", () => {
  it.each([5, 8])("%i명: .mf-result__card 가 %i장, 각 카드에 그 자리 닉네임·자리 색 점·그림", (n) => {
    const view = viewAt("ended", { stage: "ended", viewer: "alive", count: n as unknown as Count }, false);
    const { container } = renderRoom(view);
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".mf-result__card"));
    expect(cards).toHaveLength(n);
    cards.forEach((card, i) => {
      expect(card.dataset.seat).toBe(String(i));
      expect(card.querySelector(".mf-result__tag")!.textContent).toContain(NAMES[i]);
      const dot = card.querySelector<HTMLElement>(".mf-result__dot")!;
      expect(dot.style.background).toContain(`--seat-${(i % 8) + 1}`);
      expect(card.querySelectorAll("img.mf-figure").length).toBeGreaterThanOrEqual(1);
    });
    // 자리 색 점은 8개가 서로 다르다(직업 그림이 같아도 이름표 점으로 구분된다)
    const dots = cards.map((c) => c.querySelector<HTMLElement>(".mf-result__dot")!.style.background);
    expect(new Set(dots).size).toBe(n);
  });
});

describe("CHAR-01: 링크 참가 — 미리보기 7명", () => {
  it("li.mf-tag 7개, 각각 그림과 그 자리 닉네임이 있고 그림은 자리 번호 인물이다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    installMemoryStorage();
    const preview: RoomPreview = {
      code: "0042",
      hostNickname: NAMES[0]!,
      playerCount: 7,
      maxPlayers: 8,
      phase: "lobby",
      players: Array.from({ length: 7 }, (_, seat) => ({ seat, nickname: NAMES[seat]! })),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(preview), { status: 200 })));
    const { container } = render(<JoinByLink code="0042" notice={null} onEnterRoom={vi.fn()} onHome={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText("7 / 8명이 모였어요")).not.toBeNull();
    const tags = Array.from(container.querySelectorAll<HTMLElement>("ul.mf-join__seated li.mf-tag"));
    expect(tags).toHaveLength(7);
    const srcs = tags.map((li, seat) => {
      const img = li.querySelector<HTMLImageElement>("img.mf-figure")!;
      expect(img.getAttribute("src"), `자리 ${seat}`).toBe(figureSrc(seat).src);
      expect(li.querySelector(".mf-tag__name")!.textContent).toBe(NAMES[seat]);
      return img.getAttribute("src");
    });
    expect(new Set(srcs).size).toBe(7);
  });
});
