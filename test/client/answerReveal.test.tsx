import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { ResultAnnounce } from "../../src/components/ResultAnnounce";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 23-07: 첫날 정답 공개(answerReveal) 화면 — 큰 글 "제시어"+키워드, 띠 blank, 제목 "제시어", 패널 잠금, 역할 무관, 재접속 모션 없음.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return { WorldStage: (_props: WorldStageProps) => createElement("div", { "data-world-stage-fake": "" }) };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NOW = 1_700_000_000_000;
const ANSWER = "해리포터";

const player = (seat: number, dead: boolean): PublicPlayer => ({
  seat,
  nickname: ["민수", "영희", "서준", "지아"][seat] ?? `p${seat}`,
  connected: true,
  isHost: seat === 0,
  ...(dead ? { alive: false } : {}),
});

interface Opts {
  phase?: PhaseId;
  role?: RoleId;
  ghost?: boolean;
  answer?: boolean;
  /** 남은 시간(ms). 기본 3000 */
  left?: number;
  execution?: boolean;
  noExecution?: "rejected" | "tie" | "noVotes";
}

function makeView(o: Opts = {}): RoomView {
  const phase = o.phase ?? "answerReveal";
  const left = o.left ?? 3000;
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + left,
    phaseDurationMs: 3000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [0, 1, 2, 3].map((s) => player(s, (o.ghost === true && s === 0) || (o.execution === true && s === 1 && phase !== "execution" && false))),
    me: { seat: 0, isHost: true, chat: o.ghost === true ? "ghost" : "all", ...(o.role !== undefined ? { role: o.role } : {}) },
    day: {
      n: 1,
      roles: [],
      ...(o.execution === true ? { execution: { seat: 1 } } : {}),
      ...(o.noExecution !== undefined ? { noExecution: { reason: o.noExecution } } : {}),
      keyword: { genre: "영화", ...(o.answer === false ? {} : { answer: ANSWER }) },
    },
  } as RoomView;
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return { status: "open", banner: "hidden", view, offset: 0, epoch: 1, removedReason: null, canSend: true, send: vi.fn(), onEvent: vi.fn(() => () => {}), reconnect: vi.fn(), retry: vi.fn(), ...over };
}

const mount = (view: RoomView) => {
  connectionMock.current = conn(view);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  return {
    ...r,
    show: (v: RoomView, o: Partial<RoomConnection> = {}) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch, ...o });
      r.rerender(ui());
    },
  };
};

const announceEl = (c: ParentNode) => c.querySelector<HTMLElement>("[data-announce]");
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ResultAnnounce label (23-07, P23-20)", () => {
  it("label 이 있으면 위 줄 '제시어' 이 키워드 줄 위에 서고 role=status 의 읽는 글은 '제시어 해리포터' 하나다", () => {
    const { container } = render(<ResultAnnounce text={ANSWER} label="제시어" />);
    const status = container.querySelector<HTMLElement>("[data-announce][role='status']")!;
    expect(status).not.toBeNull();
    const label = status.querySelector<HTMLElement>("[data-announce-label]")!;
    const text = status.querySelector<HTMLElement>(".mf-announce__text")!;
    expect(label.textContent).toBe("제시어");
    expect(text.textContent).toBe(ANSWER);
    expect(label.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(status.textContent).toBe("제시어 해리포터");
  });

  it("label 이 없으면 지금 모양 그대로다 — data-announce-label 0건", () => {
    const { container } = render(<ResultAnnounce text="영희 님 처형" />);
    expect(container.querySelectorAll("[data-announce-label]")).toHaveLength(0);
    expect(announceEl(container)?.textContent).toBe("영희 님 처형");
  });

  it("글자는 텍스트 노드다 — '<b>' 가 HTML 이 아니다(T-23-26)", () => {
    const { container } = render(<ResultAnnounce text="<b>x</b>" label="<i>정답</i>" />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("i")).toBeNull();
  });

  it("still 이면 모션 없는 모양 표식(is-still)이 선다", () => {
    const { container } = render(<ResultAnnounce text={ANSWER} label="제시어" still />);
    expect(announceEl(container)?.classList.contains("is-still")).toBe(true);
  });

  it("CSS: .mf-announce__label 은 Body 16/700 gray-300 이고 모션 줄이기·is-still 에서 애니메이션이 없다", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    expect(css).toMatch(/\.mf-announce__label\s*\{[^}]*font-size:\s*16px[^}]*font-weight:\s*700[^}]*var\(--gray-300\)/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.mf-announce__label/);
    expect(css).toMatch(/\.mf-announce\.is-still[^{]*\{[^}]*animation:\s*none/);
  });
});

describe("정답 공개 화면 — 큰 글 (23-07, P23-20, D-22)", () => {
  it("처형 뒤 answerReveal 에 들어오면 0초부터 '제시어' + 키워드가 3초 서고, 3초 뒤 사라진다", () => {
    const m = mount(makeView({ phase: "execution", execution: true, answer: false }));
    expect(announceEl(m.container)).toBeNull();
    m.show(makeView());
    expect(announceEl(m.container)?.textContent).toBe("제시어 해리포터");
    expect(m.container.querySelector("[data-announce-label]")?.textContent).toBe("제시어");
    advance(2999);
    expect(announceEl(m.container)).not.toBeNull();
    advance(1);
    expect(announceEl(m.container)).toBeNull();
  });

  it("처형 없는 첫날: '처형 없음' 0~1.4초 다음에 '제시어' 3초 — 겹치지 않는다", () => {
    const m = mount(makeView({ phase: "verdict", answer: false }));
    m.show(makeView({ noExecution: "rejected", left: 4400 }));
    expect(announceEl(m.container)?.textContent).toBe("처형 없음");
    expect(m.container.querySelector("[data-announce-label]")).toBeNull();
    advance(1399);
    expect(announceEl(m.container)?.textContent).toBe("처형 없음");
    advance(1);
    expect(announceEl(m.container)?.textContent).toBe("제시어 해리포터");
    advance(3000);
    expect(announceEl(m.container)).toBeNull();
  });

  it("정답 공개 → 밤: '처형 없음' 알림이 다시 나오지 않는다(D-22)", () => {
    const m = mount(makeView({ phase: "verdict", answer: false }));
    m.show(makeView({ noExecution: "rejected", left: 4400 }));
    advance(4400);
    expect(announceEl(m.container)).toBeNull();
    m.show(makeView({ phase: "night", noExecution: "rejected" }));
    expect(announceEl(m.container)).toBeNull();
    advance(1500);
    expect(announceEl(m.container)).toBeNull();
  });

  it("재접속·새로고침으로 answerReveal 중간에 들어오면 남은 시간만 모션 없이 보인다", () => {
    const { container } = mount(makeView({ left: 1500 }));
    const el = announceEl(container)!;
    expect(el.textContent).toBe("제시어 해리포터");
    expect(el.classList.contains("is-still")).toBe(true);
    advance(1499);
    expect(announceEl(container)).not.toBeNull();
    advance(1);
    expect(announceEl(container)).toBeNull();
  });

  it("정답이 아직 없는 view(answer 키 없음)에는 큰 글이 없다", () => {
    const { container } = mount(makeView({ answer: false }));
    expect(announceEl(container)).toBeNull();
  });

  it("마피아·시민·유령이 같은 큰 글을 보고 DOM 에 역할 값이 없다(T-23-27)", () => {
    const texts: string[] = [];
    for (const o of [{ role: "mafia" as const }, { role: "citizen" as const }, { role: "citizen" as const, ghost: true }]) {
      const m = mount(makeView({ phase: "execution", answer: false, execution: true, ...o }));
      m.show(makeView(o));
      texts.push(announceEl(m.container)?.textContent ?? "");
      const html = m.container.innerHTML;
      expect(html).not.toMatch(/mafia|citizen|police|doctor/);
      cleanup();
    }
    expect(new Set(texts)).toEqual(new Set(["제시어 해리포터"]));
  });
});

describe("정답 공개 화면 — 띠·제목·패널 (23-07, P23-21)", () => {
  const checks = (c: HTMLElement) => {
    expect(c.querySelector(".mv-phase__title")?.textContent).toBe("제시어");
    expect(c.querySelector("[data-host-line]")?.textContent).toBe("");
    expect(c.querySelector("[data-host-time]")).not.toBeNull();
    const panel = c.querySelector("[data-chat-panel]")!;
    expect(panel.hasAttribute("data-chat-locked")).toBe(true);
    const input = c.querySelector<HTMLInputElement>("[data-chat-input]")!;
    expect(input.getAttribute("aria-disabled")).toBe("true");
    expect(c.querySelectorAll("[data-chat-send], [data-will-button], [data-emote-button]")).toHaveLength(0);
  };

  it("산 사람: 제목 '제시어', 띠는 초만, 채팅 패널 입력줄이 잠기고 동작 단추·보내기·유언 깃펜이 없다", () => {
    const { container } = mount(makeView({ role: "citizen" }));
    checks(container);
  });

  it("마피아와 유령도 같다", () => {
    checks(mount(makeView({ role: "mafia" })).container);
    cleanup();
    checks(mount(makeView({ role: "citizen", ghost: true })).container);
  });

  it("채팅 기록 칸 높이가 바뀌지 않는다 — 처형 단계의 산 사람 패널과 같다", () => {
    const logH = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-chat-log]")!.style.height;
    const a = logH(mount(makeView({ phase: "discussion" })).container);
    cleanup();
    expect(logH(mount(makeView()).container)).toBe(a);
  });
});
