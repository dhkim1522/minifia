/// <reference types="node" />
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoomPreview, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { installMemoryStorage } from "../helpers/memoryStorage";

// CHAR-01 점검표(UI-SPEC §10, 05-04): 자리 0~7 의 인물 8장은 서로 다르고, 5명·8명 방의 낮(토론)·결과·링크 참가 화면에서
// 모든 자리의 닉네임이 그 자리 그림과 함께 보인다. 외형은 자리 번호만으로 정한다(D-02, D-03) — 역할은 입력이 아니다.
// 08-27: 낮·밤 화면은 옛 테이블(.mf-dt) 대신 맵 화면(GameMap)의 이름표 기준으로 다시 썼다. 맵의 인물은 3D 캐릭터라 이름표 닉네임과 산·탈락 표시만 DOM 에서 본다
// (캐릭터 모양은 worldStage·world 시험 몫). 소스를 바꾸지 않는 점검이다.

// RoomScreen 의 연결 훅만 가짜로 바꾼다(phaseScreens.test.tsx 와 같은 방식). 서버와는 view 로만 만난다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
// 맵 화면: 이름표(DOM)는 진짜 WorldStage 가 그리고, 런타임(three)만 가짜로 바꾼다 — nightMap.test.tsx 와 같은 방식.
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => ({
      start: () => Promise.resolve(),
      syncPlayers: () => {},
      stopAllEmotes: () => {},
      deny: () => {},
      setScene: () => {},
      tap: () => ({ x: 1, z: 1 }),
      notifyMoveSent: () => {},
      cancelMove: () => {},
      retry: () => Promise.resolve(),
      dispose: () => {},
      sample: () => null,
      renderer: () => null,
      characterOf: () => null,
      ring: () => null,
      shown: () => null,
      status: () => ({ status: "ready" }),
      interactiveMs: () => null,
    }),
  };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { JoinByLink } = await import("../../src/screens/JoinByLink");
const { figureSrc, ghostSrc } = await import("../../src/net/assets");

const NOW = 1_700_000_000_000;
/** 5글자 닉네임 여덟 */
const NAMES = ["지우지우지", "하윤하윤하", "민지민지민", "도현도현도", "서연서연서", "수빈수빈수", "하준하준하", "지호지호지"] as const;

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

/** 끝난 판의 view: n 명, 결과 카드가 자리마다 한 장씩. 0번이 나 */
function endedView(n: number): RoomView {
  const view = simpleView("ended", n, "citizen");
  const mafia = n === 5 ? [2] : [2, 5, 6];
  view.phaseEndsAt = null;
  view.phaseDurationMs = null;
  view.result = {
    winner: "citizenWin",
    seats: Array.from({ length: n }, (_, seat) => ({ seat, job: mafia.includes(seat) ? ("mafia" as const) : ("citizen" as const) })),
    summary: [],
  };
  return view;
}

/** 맵 화면의 이름표: 산 자리마다 하나, 탈락한 자리는 산 사람 화면에서 이름표가 없다 */
const tagOf = (c: HTMLElement, seat: number): HTMLElement | null => c.querySelector<HTMLElement>(`.mf-world__tag[data-seat="${seat}"]`);

/** 맵 위 산 자리: 이름표가 있고 그 자리 닉네임을 담는다. 탈락 자리는 이름표 자체가 없다 */
function expectEverySeatNamed(c: HTMLElement, n: number, deadSeats: readonly number[] = []): void {
  for (let seat = 0; seat < n; seat++) {
    const tag = tagOf(c, seat);
    if (deadSeats.includes(seat)) {
      expect(tag, `탈락 자리 ${seat} 이름표`).toBeNull();
      continue;
    }
    expect(tag, `자리 ${seat} 이름표`).not.toBeNull();
    expect(tag!.textContent, `자리 ${seat} 닉네임`).toContain(NAMES[seat]);
  }
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

describe("CHAR-01: 맵 화면(낮 토론·밤) — 5명·8명 모두 이름표에 닉네임", () => {
  it.each([5, 8])("%i명 낮 토론: 모든 자리 이름표에 그 자리 닉네임", (n) => {
    const { container } = renderRoom(simpleView("discussion", n, "citizen"));
    expectEverySeatNamed(container, n);
    expect(container.querySelectorAll(".mf-world__tag").length).toBe(n);
  });

  it("내 역할이 시민이든 마피아든 이름표의 자리·닉네임은 같다 (능력 무관, D-03·T-05-10)", () => {
    const names = (role: RoleId) => {
      const { container } = renderRoom(simpleView("discussion", 5, role));
      const out = [...container.querySelectorAll<HTMLElement>(".mf-world__tag")].map((t) => `${t.dataset.seat}:${t.textContent}`);
      cleanup();
      return out;
    };
    expect(names("mafia")).toEqual(names("citizen"));
  });

  it("8명(7번 탈락): 산 자리는 닉네임 이름표, 탈락 자리는 산 사람 화면에서 이름표가 사라진다", () => {
    const view = simpleView("night", 8, "mafia"); // 09-10: 밤·산 시민 편 화면은 내 이름표 하나뿐이라 산 좌석 전부를 보는 마피아 viewer 로 본다
    view.players = view.players.map((p) => (p.seat === 7 ? { ...p, alive: false } : p));
    const { container } = renderRoom(view);
    expectEverySeatNamed(container, 8, [7]);
    expect(container.querySelectorAll(".mf-world__tag").length).toBe(7);
  });
});

describe("CHAR-01: 결과 — 자리마다 이름표(자리 색 점 + 닉네임)와 그림 (그림은 직업 그림 — P5-8, 바꾸지 않음)", () => {
  it.each([5, 8])("%i명: .mf-result__card 가 %i장, 각 카드에 그 자리 닉네임·자리 색 점·그림", (n) => {
    const { container } = renderRoom(endedView(n));
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
