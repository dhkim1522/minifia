import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhaseId, RoomView, VoteLogEntry } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";

// 처형 여부 투표(execVote) 화면: 방 화면 라우팅 → 낮 장면 → 하단 패널 → 소켓 메시지까지 한 경로 (04-16 트레이서).
// 연결 훅은 반환값을 테스트가 정한다(phaseScreens.test 와 같은 방식). 화면은 서버 view 만 따른다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NOW = 1_700_000_000_000;

interface VoteOpts {
  phase?: PhaseId;
  /** 던진 표 집계 (기본 0·0) */
  tally?: { yes: number; no: number };
  /** 내 표 (me.voteAgree). 없으면 아직 안 던진 것 */
  voteAgree?: boolean;
  /** 탈락한 자리들 */
  dead?: number[];
  /** 연결이 끊긴 자리들 */
  offline?: number[];
  /** 마감까지 남은 ms (기본 10000) */
  endsIn?: number;
  /** 일차(기본 1) */
  n?: number;
  /** 날짜별 공개 투표 기록 (기본 없음) */
  voteLog?: VoteLogEntry[];
}

function makeView(o: VoteOpts = {}): RoomView {
  const dead = o.dead ?? [];
  const offline = o.offline ?? [];
  const phase = o.phase ?? "execVote";
  const me: RoomView["me"] = { seat: 0, isHost: false, role: "citizen" };
  if (o.voteAgree !== undefined) me.voteAgree = o.voteAgree;
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (o.endsIn ?? 10_000),
    phaseDurationMs: 10_000,
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
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "citizen"],
      ...(o.voteLog !== undefined ? { voteLog: o.voteLog } : {}),
      ...(phase === "execVote" ? { execTally: o.tally ?? { yes: 0, no: 0 } } : {}),
    },
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
  connectionMock.current = conn(view, over);
  const utils = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = {}) => {
    connectionMock.current = conn(v, o);
    utils.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  };
  return { ...utils, rerenderRoom, send: (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn> };
}

// 여러 줄 DOM 덤프로 TAP 보고서가 깨지지 않게 한 줄 메시지로 단언한다.
function button(name: string): HTMLButtonElement {
  const el = screen.queryByRole("button", { name });
  expect(el, `button ${name}`).not.toBeNull();
  return el as HTMLButtonElement;
}

const panel = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dayscene__panel");
const liveRegion = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-room > p.mf-sr-only[aria-live]");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("execVote 화면 한 경로 (VOTE-01, D-02, D-14)", () => {
  it("연결 중… 이 아니라 낮 테이블과 하단 제목·집계 줄·[찬성][반대]를 그린다", () => {
    const { container } = renderRoom(makeView());
    expect(screen.queryByText("연결 중…")).toBeNull();
    expect(container.querySelector(".mf-dt")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "오늘 처형을 할까요?" })).not.toBeNull();
    const tally = container.querySelector<HTMLElement>(".mf-execvote__tally");
    expect(tally?.textContent).toBe("찬성 0 · 반대 0아직 4명 · 마감까지 바꿀 수 있어요");
    expect(button("찬성").getAttribute("aria-pressed")).toBe("false");
    expect(button("반대").getAttribute("aria-pressed")).toBe("false");
  });

  it("헤더는 `낮 · 처형 여부` / `1일차`이고 aria-live 안내는 `처형 여부 투표. 오늘 처형을 할까요?`", () => {
    const { container } = renderRoom(makeView());
    expect(screen.queryByRole("heading", { name: "낮 · 처형 여부" })).not.toBeNull();
    expect(screen.queryByText("1일차")).not.toBeNull();
    expect(liveRegion(container)?.textContent).toBe("처형 여부 투표. 오늘 처형을 할까요?");
  });

  it("타이머는 마지막 5초에도 진홍(urgent)이 되지 않는다", () => {
    const { container } = renderRoom(makeView({ endsIn: 3_000 }));
    expect(container.querySelector(".mf-timer")).not.toBeNull();
    expect(container.querySelector(".mf-timer--urgent")).toBeNull();
  });

  it("[찬성] 클릭 → {t:execVote, agree:true} 한 번, 즉시 눌림·체크 배지. 같은 버튼 재클릭은 아무것도 보내지 않는다", () => {
    const { container, send } = renderRoom(makeView());
    fireEvent.click(button("찬성"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ t: "execVote", agree: true });
    expect(button("찬성").getAttribute("aria-pressed")).toBe("true");
    expect(panel(container)?.querySelectorAll(".mf-seg__ok").length).toBe(1);
    fireEvent.click(button("찬성"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("[반대] 클릭 → {agree:false}, 번복하면 반대쪽이 눌린다", () => {
    const { send } = renderRoom(makeView());
    fireEvent.click(button("찬성"));
    fireEvent.click(button("반대"));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ t: "execVote", agree: false });
    expect(button("반대").getAttribute("aria-pressed")).toBe("true");
    expect(button("찬성").getAttribute("aria-pressed")).toBe("false");
  });

  it("새 서버 view(me.voteAgree false, 집계 2·1)가 오면 서버 값을 따른다 (T-04-48)", () => {
    const { container, rerenderRoom } = renderRoom(makeView());
    fireEvent.click(button("찬성"));
    expect(button("찬성").getAttribute("aria-pressed")).toBe("true");
    rerenderRoom(makeView({ voteAgree: false, tally: { yes: 2, no: 1 } }));
    expect(button("반대").getAttribute("aria-pressed")).toBe("true");
    expect(button("찬성").getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector(".mf-execvote__tally")?.textContent).toBe("찬성 2 · 반대 1아직 1명 · 마감까지 바꿀 수 있어요");
  });

  it("canSend 가 false 이면 두 버튼이 꺼진다", () => {
    renderRoom(makeView(), { canSend: false });
    expect(button("찬성").disabled).toBe(true);
    expect(button("반대").disabled).toBe(true);
  });

  it("discussion → execVote 로 바뀌어도 테이블 루트(.mf-dt)와 장면 래퍼(.mf-phase-enter)는 같은 DOM 노드다", () => {
    const r = renderRoom(makeView({ phase: "discussion" }));
    const scene = r.container.querySelector(".mf-phase-enter");
    const table = r.container.querySelector(".mf-dt");
    expect(scene).not.toBeNull();
    expect(table).not.toBeNull();
    r.rerenderRoom(makeView());
    expect(r.container.querySelector(".mf-phase-enter") === scene).toBe(true);
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
  });

  it("테이블 안에는 찬성·반대·투표 글자도 후광도 없고 화면 어디에도 `기권` 이 없다 (D-02, D-04, T-04-47)", () => {
    const { container } = renderRoom(makeView({ voteAgree: true, tally: { yes: 1, no: 0 } }));
    const table = container.querySelector<HTMLElement>(".mf-dt")!;
    const text = table.textContent ?? "";
    expect(/찬성|반대|투표/.test(text)).toBe(false);
    expect(table.querySelector('[class*="mf-figure--halo"]')).toBeNull();
    expect((container.textContent ?? "").includes("기권")).toBe(false);
    expect(container.querySelectorAll("button[aria-label*='기권']").length).toBe(0);
  });

  it("이 단계 하단에는 말하기·이모티콘 입구가 없다 (D-12 개정)", () => {
    const { container } = renderRoom(makeView());
    expect(panel(container)?.querySelectorAll("button").length).toBe(2);
    expect(screen.queryByRole("button", { name: /빠른 메시지|이모티콘/ })).toBeNull();
  });
});

// ---- Task 2: 관전·마감·집계 팝·오류 토스트·좌석 기록 카드 ----

function emitter() {
  const listeners = new Set<(e: RoomEvent, meta: { epoch: number }) => void>();
  return {
    onEvent: (l: (e: RoomEvent, meta: { epoch: number }) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    emit: (e: RoomEvent) =>
      act(() => {
        for (const l of [...listeners]) l(e, { epoch: 1 });
      }),
  };
}

const sheet = (name: string) => document.querySelector(`dialog[aria-label="${name}"]`);
const nums = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".mf-execvote__tally .mf-execvote__num")];

describe("execVote 나머지 상태 (D-35, D-36, D-12 개정, D-08)", () => {
  it("탈락한 viewer: 버튼 0, 제목 + 집계 줄(살아 있는 사람과 같은 값) + 알약 `관전 중 · 볼 수만 있어요`", () => {
    const tally = { yes: 2, no: 0 };
    const { container } = renderRoom(makeView({ dead: [0], tally }));
    expect(panel(container)?.querySelectorAll("button").length).toBe(0);
    expect(screen.queryByRole("heading", { name: "오늘 처형을 할까요?" })).not.toBeNull();
    expect(container.querySelector(".mf-execvote__tally")?.textContent).toBe("찬성 2 · 반대 0아직 1명 · 마감까지 바꿀 수 있어요");
    const pill = panel(container)?.querySelector(".mf-ro");
    expect(pill?.textContent).toBe("관전 중 · 볼 수만 있어요");
    cleanup();
    const alive = renderRoom(makeView({ dead: [1], tally }));
    expect(alive.container.querySelector(".mf-execvote__tally")?.textContent).toBe("찬성 2 · 반대 0아직 1명 · 마감까지 바꿀 수 있어요");
  });

  it("던진 표가 생존자 수와 같으면 뒤 문구가 `모두 냈어요 · 마감까지 바꿀 수 있어요`", () => {
    const { container } = renderRoom(makeView({ tally: { yes: 3, no: 1 } }));
    expect(container.querySelector(".mf-execvote__tally")?.textContent).toBe("찬성 3 · 반대 1모두 냈어요 · 마감까지 바꿀 수 있어요");
    cleanup();
    const spectator = renderRoom(makeView({ dead: [0], tally: { yes: 2, no: 1 } }));
    expect(spectator.container.querySelector(".mf-execvote__tally")?.textContent).toContain("모두 냈어요");
  });

  it("집계 숫자가 바뀐 노드만 새 요소가 되고(팝이 다시 돈다) 같은 값 재그리기에서는 같은 노드다", () => {
    const r = renderRoom(makeView({ tally: { yes: 1, no: 1 } }));
    const [yes0, no0] = nums(r.container);
    expect(yes0?.textContent).toBe("1");
    r.rerenderRoom(makeView({ tally: { yes: 1, no: 1 } }));
    const same = nums(r.container);
    expect(same[0] === yes0 && same[1] === no0).toBe(true);
    r.rerenderRoom(makeView({ tally: { yes: 2, no: 1 } }));
    const next = nums(r.container);
    expect(next[0] === yes0).toBe(false);
    expect(next[0]?.textContent).toBe("2");
    expect(next[1] === no0).toBe(true);
  });

  it("BAD_MESSAGE 오류 이벤트가 오면 토스트 `보내지 못했어요. 다시 시도해 주세요` 가 한 번 뜬다", () => {
    const ev = emitter();
    renderRoom(makeView(), { onEvent: ev.onEvent });
    expect(screen.queryAllByText("보내지 못했어요. 다시 시도해 주세요").length).toBe(0);
    ev.emit({ t: "error", code: "BAD_MESSAGE" });
    expect(screen.queryAllByText("보내지 못했어요. 다시 시도해 주세요").length).toBe(1);
  });

  it("execVote 가 아닌 단계에서는 이 오류 구독이 없다 (낮 시작 단계는 토스트를 띄우지 않는다)", () => {
    const ev = emitter();
    renderRoom(makeView({ phase: "dayAnnounce" }), { onEvent: ev.onEvent });
    ev.emit({ t: "error", code: "BAD_MESSAGE" });
    expect(screen.queryAllByText("보내지 못했어요. 다시 시도해 주세요").length).toBe(0);
  });

  it("좌석을 누르면 기록 카드가 열리고 투표는 영향받지 않는다 — 살아 있는 사람도 탈락한 사람도", () => {
    for (const dead of [[], [0]]) {
      const { container, send } = renderRoom(makeView({ dead, voteAgree: dead.length === 0 ? true : undefined, tally: { yes: 1, no: 0 } }));
      const seats = container.querySelectorAll<HTMLButtonElement>(".mf-dt button.mf-dt__seat--inspect");
      expect(seats.length).toBe(4);
      fireEvent.click(screen.getByRole("button", { name: "하윤, 기록 보기" }));
      expect(sheet("하윤 기록")).not.toBeNull();
      expect(send).not.toHaveBeenCalled();
      expect(container.querySelector(".mf-execvote__tally")?.textContent).toContain("찬성 1 · 반대 0");
      if (dead.length === 0) expect(button("찬성").getAttribute("aria-pressed")).toBe("true");
      cleanup();
    }
  });

  it("밤이 되면 열려 있던 기록 카드가 닫힌다(기존 규칙 불변)", () => {
    const r = renderRoom(makeView());
    fireEvent.click(screen.getByRole("button", { name: "하윤, 기록 보기" }));
    expect(sheet("하윤 기록")).not.toBeNull();
    r.rerenderRoom(makeView({ phase: "night" }));
    expect(sheet("하윤 기록")).toBeNull();
  });

  it("빠른 메시지·이모티콘 입구가 없고 말풍선·이모티콘 층이 테이블에 없다", () => {
    const { container } = renderRoom(makeView());
    expect(container.querySelector(".mf-dt__bubble, .mf-dt__emoji")).toBeNull();
    expect(panel(container)?.querySelector('[role="log"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /빠른 메시지|이모티콘/ })).toBeNull();
  });

  it("연결이 끊긴 살아 있는 사람의 캐릭터는 흐림 클래스(mf-figure--disconnected)를 가진다 (D-36)", () => {
    const { container } = renderRoom(makeView({ offline: [2] }));
    expect(container.querySelectorAll(".mf-dt .mf-figure--disconnected").length).toBe(1);
  });
});

// ---- 04-27: 기록 카드의 날짜별 투표 줄과 열리는·닫히는 단계 규칙 (VOTE-04, D-08) ----
describe("기록 카드 — 투표 줄·단계 규칙 (04-27)", () => {
  const VOTES: VoteLogEntry[] = [
    { n: 1, exec: { yes: 1, no: 3, passed: false }, cand: { votes: [{ seat: 1, target: 2 }, { seat: 0, target: 2 }], candidate: 2 } },
  ];
  const rowsOf = (name: string) => [...(sheet(name)?.querySelectorAll(".mf-urecord__row") ?? [])].map((li) => li.textContent);

  it("execVote 에서 좌석을 누르면 지난 일차의 처형 여부 집계와 이 사람의 후보 선택 줄이 보인다", () => {
    renderRoom(makeView({ n: 2, voteLog: VOTES }));
    fireEvent.click(screen.getByRole("button", { name: "하윤, 기록 보기" }));
    expect(rowsOf("하윤 기록")).toEqual(["1일차처형 여부 찬성 1 · 반대 3 · 미통과", "1일차민지님에게 투표했어요"]);
  });

  it("집계 줄은 모든 사람에게 같고 후보 선택 줄이 없는 사람에게는 후보 선택 행이 없다 (P-16)", () => {
    renderRoom(makeView({ n: 2, voteLog: VOTES }));
    fireEvent.click(screen.getByRole("button", { name: "도현, 기록 보기" }));
    expect(rowsOf("도현 기록")).toEqual(["1일차처형 여부 찬성 1 · 반대 3 · 미통과"]);
  });

  it("기록이 하나도 없으면 `아직 기록이 없어요`", () => {
    renderRoom(makeView({ voteLog: [] }));
    fireEvent.click(screen.getByRole("button", { name: "하윤, 기록 보기" }));
    expect(sheet("하윤 기록")?.textContent).toContain("아직 기록이 없어요");
  });

  it("카드가 열려 있을 때 execVote → candidateVote(살아 있는 viewer)가 되면 닫힌다 — 그 단계에서 좌석 탭은 투표이기 때문", () => {
    const r = renderRoom(makeView());
    fireEvent.click(screen.getByRole("button", { name: "하윤, 기록 보기" }));
    expect(sheet("하윤 기록")).not.toBeNull();
    r.rerenderRoom(makeView({ phase: "candidateVote" }));
    expect(sheet("하윤 기록")).toBeNull();
  });

  it("카드가 열려 있을 때 candidateVoteReveal·defense·execution 이 되면 닫힌다", () => {
    for (const phase of ["candidateVoteReveal", "defense", "execution"] as const) {
      const r = renderRoom(makeView());
      fireEvent.click(screen.getByRole("button", { name: "하윤, 기록 보기" }));
      expect(`${phase}:${sheet("하윤 기록") !== null}`).toBe(`${phase}:true`);
      r.rerenderRoom(makeView({ phase }));
      expect(`${phase}:${sheet("하윤 기록") !== null}`).toBe(`${phase}:false`);
      cleanup();
    }
  });

  it("탈락한 viewer 는 execVote → candidateVote 에서도 카드가 열려 있고, 그 단계에서 새로 열 수도 있다", () => {
    const r = renderRoom(makeView({ dead: [0] }));
    fireEvent.click(screen.getByRole("button", { name: "하윤, 기록 보기" }));
    r.rerenderRoom(makeView({ phase: "candidateVote", dead: [0] }));
    expect(sheet("하윤 기록")).not.toBeNull();
  });

  it("낮 → 낮 사이(discussion → execVote)에는 닫히지 않는다", () => {
    const r = renderRoom(makeView({ phase: "dayAnnounce" }));
    r.rerenderRoom(makeView({ phase: "discussion" }));
    fireEvent.click(screen.getByRole("button", { name: "하윤, 기록 보기" }));
    expect(sheet("하윤 기록")).not.toBeNull();
    r.rerenderRoom(makeView({ phase: "execVote" }));
    expect(sheet("하윤 기록")).not.toBeNull();
  });
});
