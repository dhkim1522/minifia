import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { CandidateVotePanel } from "../../src/components/CandidateVotePanel";
import { PickPill } from "../../src/components/NightPanel";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";

// 후보 선택(candidateVote) 화면 (04-18). Task 2: 하단 부품. Task 3: RoomScreen 한 경로(연결 훅은 반환값을 테스트가 정한다, execVote.test 와 같은 방식).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const { RoomScreen } = await import("../../src/screens/RoomScreen");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PickPill format (D-19)", () => {
  it("기본(밤): 선택 안 함 / 선택 ●이름 — 기존 모양 그대로", () => {
    const { container, rerender } = render(<PickPill pick={null} />);
    expect(container.textContent).toBe("선택 안 함");
    rerender(<PickPill pick={{ seat: 2, label: "민지" }} />);
    expect(container.textContent).toBe("선택 민지");
  });

  it("vote: 선택 안 함(회색) / 자리 색 점 + 굵은 이름 + 님에게 투표했어요, role=status polite", () => {
    const { container, rerender } = render(<PickPill pick={null} format="vote" />);
    const empty = screen.getByRole("status");
    expect(empty.textContent).toBe("선택 안 함");
    expect(empty.classList.contains("mf-pk--empty")).toBe(true);
    rerender(<PickPill pick={{ seat: 2, label: "민지" }} format="vote" />);
    const pill = screen.getByRole("status");
    expect(pill.textContent).toBe("민지님에게 투표했어요");
    expect(pill.getAttribute("aria-live")).toBe("polite");
    expect(pill.querySelector("b")?.textContent).toBe("민지");
    expect(container.querySelector<HTMLElement>(".mf-pk__dot")?.style.background).toBe("var(--seat-3)");
    expect(pill.textContent).not.toContain("선택 ");
  });
});

describe("CandidateVotePanel (D-19, D-35, UI-SPEC 7.2)", () => {
  it("살아 있는 viewer: 제목·안내·알약 한 줄, 관전 줄과 말하기·이모티콘 입구 없음", () => {
    const { container } = render(<CandidateVotePanel pick={null} readOnly={false} />);
    expect(screen.getByRole("heading", { name: "처형할 사람을 고르세요" })).not.toBeNull();
    expect(container.textContent).toContain("자기 자신은 고를 수 없어요 · 마감까지 바꿀 수 있어요");
    expect(screen.getByRole("status").textContent).toBe("선택 안 함");
    expect(container.querySelector(".mf-ro")).toBeNull();
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("고른 뒤: 알약이 {이름}님에게 투표했어요", () => {
    render(<CandidateVotePanel pick={{ seat: 1, label: "하윤" }} readOnly={false} />);
    expect(screen.getByRole("status").textContent).toBe("하윤님에게 투표했어요");
  });

  it("관전: 제목·안내가 관전 문구이고 알약 자리에 관전 줄, 선택 알약은 없다", () => {
    const { container } = render(<CandidateVotePanel pick={{ seat: 1, label: "하윤" }} readOnly />);
    expect(screen.getByRole("heading", { name: "처형할 사람을 고르는 중이에요" })).not.toBeNull();
    expect(container.textContent).toContain("누구를 골랐는지는 공개될 때 볼 수 있어요");
    expect(container.querySelector(".mf-ro")?.textContent).toBe("관전 중 · 볼 수만 있어요");
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.textContent).not.toContain("하윤");
  });

  it("닉네임은 React 텍스트다(마크업 해석 없음)", () => {
    const { container } = render(<CandidateVotePanel pick={{ seat: 0, label: "<img src=x onerror=alert(1)>" }} readOnly={false} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("<img src=x onerror=alert(1)>님에게 투표했어요");
  });
});

// ---- Task 3: RoomScreen 한 경로 ----
const NOW = 1_700_000_000_000;

interface CandOpts {
  phase?: PhaseId;
  dead?: number[];
  offline?: number[];
  /** 내 선택 (me.voteTarget) */
  voteTarget?: number;
  /** 마피아 동료 seat (me.allies) — 주면 내 역할은 마피아 */
  allies?: number[];
}

function makeView(o: CandOpts = {}): RoomView {
  const dead = o.dead ?? [];
  const offline = o.offline ?? [];
  const me: RoomView["me"] = { seat: 0, isHost: false, role: o.allies ? "mafia" : "citizen" };
  if (o.voteTarget !== undefined) me.voteTarget = o.voteTarget;
  if (o.allies) me.allies = o.allies;
  return {
    code: "0042",
    phase: o.phase ?? "candidateVote",
    phaseEndsAt: NOW + 15_000,
    phaseDurationMs: 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ].map((p) => ({
      ...p,
      ...(dead.includes(p.seat) ? { alive: false } : {}),
      ...(offline.includes(p.seat) ? { connected: false } : {}),
    })),
    me,
    day: { n: 1, roles: ["mafia", "police", "citizen"], claimLog: [] },
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
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  connectionMock.current = conn(view, over);
  const utils = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = {}) => {
    connectionMock.current = conn(v, o);
    utils.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  };
  return { ...utils, rerenderRoom, send: (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn> };
}

const panel = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dayscene__panel");
const liveRegion = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-room > p.mf-sr-only[aria-live]");
const seatEl = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${n}"]`)!;
const voteBtn = (name: string) => screen.queryByRole("button", { name: `${name}, 투표 대상` }) as HTMLButtonElement | null;
const whiteHalos = (c: HTMLElement) => c.querySelectorAll("img.mf-figure--halo-white");
const sheet = (name: string) => document.querySelector(`dialog[aria-label="${name}"]`);

function emitter() {
  const listeners = new Set<(e: RoomEvent) => void>();
  return {
    onEvent: (l: (e: RoomEvent) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    emit: (e: RoomEvent) =>
      act(() => {
        for (const l of [...listeners]) l(e);
      }),
  };
}

describe("candidateVote 화면 한 경로 (VOTE-02, D-03, D-19)", () => {
  beforeEach(() => {
    cleanup();
  });

  it("연결 중… 이 아니라 낮 테이블: 헤더 `낮 · 후보 선택`/`1일차`, 하단 제목, 알약 `선택 안 함`, 읽기용 안내", () => {
    const { container } = renderRoom(makeView());
    expect(screen.queryByText("연결 중…")).toBeNull();
    expect(screen.queryByRole("heading", { name: "낮 · 후보 선택" })).not.toBeNull();
    expect(screen.queryByText("1일차")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "처형할 사람을 고르세요" })).not.toBeNull();
    expect(panel(container)?.querySelector("[role=status]")?.textContent).toBe("선택 안 함");
    expect(liveRegion(container)?.textContent).toBe("후보 선택 투표. 처형할 사람을 고르세요");
    expect(container.querySelector(".mf-timer--urgent")).toBeNull();
  });

  it("좌석 1·2·3 은 `{닉네임}, 투표 대상` 버튼, 나(0)와 탈락 좌석은 버튼이 아니다. 끊긴 살아 있는 좌석은 버튼이고 흐리다", () => {
    const { container } = renderRoom(makeView({ dead: [3], offline: [2] }));
    expect(voteBtn("하윤")).not.toBeNull();
    expect(voteBtn("민지")).not.toBeNull();
    expect(voteBtn("도현")).toBeNull();
    expect(voteBtn("지우")).toBeNull();
    expect(voteBtn("지우 (나)")).toBeNull();
    expect(container.querySelectorAll(".mf-dt button.mf-dt__seat--pick").length).toBe(2);
    expect(seatEl(container, 0).tagName).not.toBe("BUTTON");
    expect(seatEl(container, 3).tagName).not.toBe("BUTTON");
    expect(seatEl(container, 2).querySelector(".mf-figure--disconnected")).not.toBeNull();
    expect(voteBtn("민지")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("좌석 클릭 → send candidateVote, 눌림·흰 후광 한 개·알약. 다른 좌석 클릭은 번복(후광 이동), 같은 좌석 재클릭은 무전송", () => {
    const { container, send } = renderRoom(makeView());
    fireEvent.click(voteBtn("민지")!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ t: "candidateVote", target: 2 });
    expect(voteBtn("민지")?.getAttribute("aria-pressed")).toBe("true");
    expect(whiteHalos(container).length).toBe(1);
    expect(seatEl(container, 2).querySelector("img.mf-figure--halo-white")).not.toBeNull();
    expect(panel(container)?.querySelector("[role=status]")?.textContent).toBe("민지님에게 투표했어요");
    // 머리 위 배지·발밑 링 없음(후광만, 결정 0030)
    expect(container.querySelectorAll(".mf-dt__pick").length).toBe(0);
    fireEvent.click(voteBtn("도현")!);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ t: "candidateVote", target: 3 });
    expect(voteBtn("도현")?.getAttribute("aria-pressed")).toBe("true");
    expect(voteBtn("민지")?.getAttribute("aria-pressed")).toBe("false");
    expect(whiteHalos(container).length).toBe(1);
    expect(seatEl(container, 3).querySelector("img.mf-figure--halo-white")).not.toBeNull();
    fireEvent.click(voteBtn("도현")!);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("새 서버 view(me.voteTarget 1)가 오면 서버 값이 낙관적 선택을 이긴다. 남의 좌석에는 어떤 선택 표시도 없다 (T-04-51)", () => {
    const { container, rerenderRoom } = renderRoom(makeView());
    fireEvent.click(voteBtn("민지")!);
    expect(voteBtn("민지")?.getAttribute("aria-pressed")).toBe("true");
    rerenderRoom(makeView({ voteTarget: 1 }));
    expect(voteBtn("하윤")?.getAttribute("aria-pressed")).toBe("true");
    expect(voteBtn("민지")?.getAttribute("aria-pressed")).toBe("false");
    expect(voteBtn("도현")?.getAttribute("aria-pressed")).toBe("false");
    expect(panel(container)?.querySelector("[role=status]")?.textContent).toBe("하윤님에게 투표했어요");
    expect(whiteHalos(container).length).toBe(1);
    expect(container.querySelectorAll('img[class*="halo"]').length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__pick").length).toBe(0);
  });

  it("서버가 같은 view 로 거절해 새 view 를 다시 보내면(voteTarget 없음) 선택이 사라진다", () => {
    const { container, rerenderRoom } = renderRoom(makeView());
    fireEvent.click(voteBtn("민지")!);
    rerenderRoom(makeView());
    expect(whiteHalos(container).length).toBe(0);
    expect(panel(container)?.querySelector("[role=status]")?.textContent).toBe("선택 안 함");
  });

  it("canSend 가 false 이면 좌석 버튼이 disabled", () => {
    renderRoom(makeView(), { canSend: false });
    expect(voteBtn("하윤")?.disabled).toBe(true);
    expect(voteBtn("민지")?.disabled).toBe(true);
  });

  it("마피아 동료의 진홍 마름모·후광은 후보 선택 중에도 남고, 내 선택과 겹치면 흰이 이긴다 (D-33, 결정 0030)", () => {
    const { container } = renderRoom(makeView({ allies: [1] }));
    expect(seatEl(container, 1).querySelector("img.mf-figure--halo-crimson")).not.toBeNull();
    expect(container.querySelectorAll(".mf-dt__mark").length).toBe(1);
    fireEvent.click(voteBtn("민지")!);
    expect(seatEl(container, 2).querySelector("img.mf-figure--halo-white")).not.toBeNull();
    expect(seatEl(container, 1).querySelector("img.mf-figure--halo-crimson")).not.toBeNull();
    fireEvent.click(voteBtn("하윤")!);
    expect(seatEl(container, 1).querySelector("img.mf-figure--halo-white")).not.toBeNull();
    expect(seatEl(container, 1).querySelector("img.mf-figure--halo-crimson")).toBeNull();
    expect(container.querySelectorAll(".mf-dt__mark").length).toBe(1);
    expect(container.querySelectorAll('img[class*="halo"]').length).toBe(1);
  });

  it("탈락한 viewer: 투표 버튼 없이 좌석은 기록 카드 버튼, 하단은 관전 모양 (D-35)", () => {
    const { container, send } = renderRoom(makeView({ dead: [0] }));
    expect(container.querySelectorAll(".mf-dt button.mf-dt__seat--inspect").length).toBe(4);
    expect(container.querySelectorAll('.mf-dt button[aria-label$="투표 대상"]').length).toBe(0);
    expect(screen.queryByRole("heading", { name: "처형할 사람을 고르는 중이에요" })).not.toBeNull();
    expect(panel(container)?.textContent).toContain("누구를 골랐는지는 공개될 때 볼 수 있어요");
    expect(panel(container)?.querySelector(".mf-ro")?.textContent).toBe("관전 중 · 볼 수만 있어요");
    expect(panel(container)?.querySelectorAll("button").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "하윤, 주장 기록 보기" }));
    expect(sheet("하윤 기록")).not.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("BAD_MESSAGE 오류 이벤트 → 토스트 `보내지 못했어요. 다시 시도해 주세요` 한 번 (T-04-52)", () => {
    const ev = emitter();
    renderRoom(makeView(), { onEvent: ev.onEvent });
    expect(screen.queryAllByText("보내지 못했어요. 다시 시도해 주세요").length).toBe(0);
    ev.emit({ t: "error", code: "BAD_MESSAGE" });
    expect(screen.queryAllByText("보내지 못했어요. 다시 시도해 주세요").length).toBe(1);
  });

  it("execVote → candidateVote 에서 테이블(.mf-dt)과 장면 래퍼는 같은 DOM 노드이고 chat·emoji 가 와도 말풍선·이모티콘이 뜨지 않는다", () => {
    const ev = emitter();
    const r = renderRoom(makeView({ phase: "execVote" }), { onEvent: ev.onEvent });
    const scene = r.container.querySelector(".mf-phase-enter");
    const table = r.container.querySelector(".mf-dt");
    expect(table).not.toBeNull();
    r.rerenderRoom(makeView(), { onEvent: ev.onEvent });
    expect(r.container.querySelector(".mf-phase-enter") === scene).toBe(true);
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
    ev.emit({ t: "chat", seq: 1, seat: 2, template: "innocent", at: 0 } as RoomEvent);
    ev.emit({ t: "emoji", seat: 2, icon: "smile", at: 0 });
    expect(r.container.querySelector(".mf-dt__bubble")).toBeNull();
    expect(r.container.querySelector(".mf-dt__emoji")).toBeNull();
    expect(screen.queryByRole("button", { name: /빠른 메시지|이모티콘/ })).toBeNull();
  });
});
