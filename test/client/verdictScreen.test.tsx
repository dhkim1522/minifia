import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 08-16: 최후 변론·찬반·처형 화면(DAY-05·06). RoomScreen 을 거쳐 GameMap 을 그리고, WorldStage 는 진짜를 쓴다 —
// 이름표(data-done·data-count·data-sure)는 WorldStage 가 그리는 DOM 이라서다.
// 런타임(three)만 가짜로 바꿔 건네받은 장면 표(setScene)와 조명·긴장은 그 표에서 읽는다. 표를 렌더러에 옮기는 일은 worldStage.test(08-12) 몫이다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

// 키보드 열림은 측정 훅을 가짜로 바꿔 시험이 정한다(훅 자체는 gameMap.test 가 고정한다)
const kb = vi.hoisted(() => ({ open: false }));
vi.mock("../../src/net/useMapInsets", async () => {
  const { useRef } = await import("react");
  return {
    useMapInsets: () => ({
      rootRef: useRef(null),
      headerRef: useRef(null),
      panelRef: useRef(null),
      inputRef: useRef(null),
      kbOpen: kb.open,
      logH: 96,
      stageInsets: undefined,
    }),
  };
});

const rt = vi.hoisted(() => ({ scenes: [] as unknown[], created: 0 }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => {
      rt.created += 1;
      return {
        start: () => Promise.resolve(),
        syncPlayers: () => {},
        deny: () => {},
        setScene: (look: unknown) => rt.scenes.push(look),
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
      };
    },
  };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];
const NOW = 1_700_000_000_000;

const player = (seat: number, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  seat,
  nickname: NAMES[seat] ?? `p${seat}`,
  connected: true,
  isHost: seat === 0,
  ...extra,
});

interface ViewOpts {
  phase?: PhaseId;
  count?: number;
  mySeat?: number;
  /** 변론자(후보) 좌석 */
  candidate?: number;
  dead?: number[];
  /** 찬반을 던진 좌석 */
  voted?: number[];
  /** 내 찬반(본인에게만 오는 값) */
  verdictVote?: boolean;
  /** 처형 단계의 찬반 결과 */
  verdict?: { yes: number; no: number; passed: boolean; last?: true };
  /** 처형 단계의 찬반 기록(day.ballots, 09.1.1-13) */
  ballots?: { yes: number[]; no: number[] };
  /** 단계 마감 시각(기본 NOW + 10초) */
  phaseEndsAt?: number;
  /** 그날 voteLog 의 cand.votes: [지목한 사람, 대상] 쌍 */
  candVotes?: Array<[number, number]>;
  nicknames?: string[];
}

function makeView(o: ViewOpts = {}): RoomView {
  const count = o.count ?? 5;
  const mySeat = o.mySeat ?? 0;
  const phase = o.phase ?? "verdict";
  const players = Array.from({ length: count }, (_, seat) =>
    player(seat, { ...(o.dead?.includes(seat) ? { alive: false } : {}), ...(o.nicknames?.[seat] !== undefined ? { nickname: o.nicknames[seat]! } : {}) }),
  );
  return {
    code: "0042",
    phase,
    phaseEndsAt: o.phaseEndsAt ?? NOW + 10_000,
    phaseDurationMs: 10_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: {
      seat: mySeat,
      isHost: mySeat === 0,
      chat: o.dead?.includes(mySeat) ? "ghost" : "all",
      ...(o.verdictVote !== undefined ? { verdictVote: o.verdictVote } : {}),
    },
    day: {
      n: 1,
      roles: [],
      ...(o.candidate !== undefined ? { candidate: o.candidate } : {}),
      ...(o.candVotes !== undefined
        ? {
            voteLog: [
              {
                n: 1,
                exec: { yes: 0, no: 0, passed: false },
                cand: { votes: o.candVotes.map(([seat, target]) => ({ seat, target })), ...(o.candidate !== undefined ? { candidate: o.candidate } : {}) },
              },
            ],
          }
        : {}),
      ...(phase === "verdict" ? { voted: o.voted ?? [] } : {}),
      ...(phase === "execution" && o.verdict !== undefined ? { verdict: o.verdict, execution: { seat: o.candidate ?? 3 } } : {}),
      ...(phase === "execution" && o.ballots !== undefined ? { ballots: o.ballots } : {}),
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

const mount = (view: RoomView, over: Partial<RoomConnection> = {}) => {
  connectionMock.current = conn(view, over);
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

const verdictBtns = (c: ParentNode): HTMLButtonElement[] => [...c.querySelectorAll<HTMLButtonElement>("[data-verdict]")];
const verdictBtn = (c: ParentNode, v: "yes" | "no"): HTMLButtonElement | null => c.querySelector(`[data-verdict="${v}"]`);
const headOf = (c: ParentNode, seat: number): HTMLElement | null => c.querySelector(`[data-seat="${seat}"] .mv-head`);
const countParts = (c: ParentNode): [number, number] => {
  const m = /^(\d+) \/ (\d+)$/.exec(c.querySelector(".mv-count")?.textContent ?? "");
  return m ? [Number(m[1]), Number(m[2])] : [-1, -1];
};
const countOf = (c: ParentNode): HTMLElement | null => c.querySelector(".mv-count");
const countNow = (c: ParentNode): number => countParts(c)[0];
const countMax = (c: ParentNode): number => countParts(c)[1];
const lastScene = (): SceneLook => rt.scenes[rt.scenes.length - 1] as SceneLook;

beforeEach(() => {
  rt.scenes.length = 0;
  rt.created = 0;
  kb.open = false;
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("찬반 화면 — 한 표 (DAY-06, 트레이서)", () => {
  it("산 5명 · 변론자 3 의 찬반: 나(변론자 아님)의 패널에 찬성·반대 버튼 둘과 '투표한 사람' 숫자 0 / 4(산 사람 − 1)", () => {
    const { container } = mount(makeView({ candidate: 3 }));
    expect(verdictBtns(container).map((b) => b.getAttribute("data-verdict"))).toEqual(["yes", "no"]);
    expect(countOf(container)?.getAttribute("aria-label")).toBe("투표한 사람");
    expect(countMax(container)).toBe(4);
    expect(countNow(container)).toBe(0);
  });

  it("찬성을 누르면 verdict {agree: true} 를 보내고 찬성만 즉시 눌린 상태, 반대로 바꾸면 agree false 와 반대만 눌림", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView({ candidate: 3 }), { send });
    fireEvent.click(verdictBtn(container, "yes")!);
    expect(send).toHaveBeenCalledWith({ t: "verdict", agree: true });
    expect(verdictBtn(container, "yes")?.getAttribute("aria-pressed")).toBe("true");
    expect(verdictBtn(container, "no")?.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(verdictBtn(container, "no")!);
    expect(send).toHaveBeenLastCalledWith({ t: "verdict", agree: false });
    expect(verdictBtn(container, "no")?.getAttribute("aria-pressed")).toBe("true");
    expect(verdictBtn(container, "yes")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("서버 view 가 오면 서버 값이 이긴다: 내가 찬성을 눌렀어도 서버가 me.verdictVote=false 를 주면 반대가 눌린 상태", () => {
    const m = mount(makeView({ candidate: 3 }));
    fireEvent.click(verdictBtn(m.container, "yes")!);
    expect(verdictBtn(m.container, "yes")?.getAttribute("aria-pressed")).toBe("true");
    m.show(makeView({ candidate: 3, voted: [0], verdictVote: false }));
    expect(verdictBtn(m.container, "no")?.getAttribute("aria-pressed")).toBe("true");
    expect(verdictBtn(m.container, "yes")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("소켓이 닫혀 못 보냈으면(send false) 눌린 표시를 바꾸지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => false);
    const { container } = mount(makeView({ candidate: 3 }), { send });
    fireEvent.click(verdictBtn(container, "yes")!);
    expect(verdictBtn(container, "yes")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("서버 view 의 voted 에 내가 들면 내 이름표에 체크(data-done)와 숫자 1 — 아직 아무도 안 던진 좌석에는 체크가 없다", () => {
    const m = mount(makeView({ candidate: 3 }));
    expect(m.container.querySelectorAll("[data-done]").length).toBe(0);
    m.show(makeView({ candidate: 3, voted: [0], verdictVote: true }));
    expect(headOf(m.container, 0)?.getAttribute("data-done")).toBe("true");
    expect(headOf(m.container, 1)?.hasAttribute("data-done")).toBe(false);
    expect(countNow(m.container)).toBe(1);
  });

  it("다른 좌석이 voted 에 들면 그 이름표에 체크만 붙고 무엇을 골랐는지는 어디에도 없다", () => {
    const m = mount(makeView({ candidate: 3 }));
    m.show(makeView({ candidate: 3, voted: [1, 2] }));
    expect(headOf(m.container, 1)?.getAttribute("data-done")).toBe("true");
    expect(headOf(m.container, 2)?.getAttribute("data-done")).toBe("true");
    expect(countNow(m.container)).toBe(2);
    // 내 버튼은 눌리지 않았고(내가 안 던짐), 남의 이름표 어디에도 찬성·반대 글자나 속성이 없다
    expect(verdictBtn(m.container, "yes")?.getAttribute("aria-pressed")).toBe("false");
    const tags = m.container.querySelector(".mf-world__tags")!;
    expect(tags.textContent).not.toMatch(/찬성|반대/);
    expect(tags.innerHTML).not.toMatch(/data-agree|data-verdict|data-yes|data-no/);
  });
});

// ---- Task 2: 변론·찬반 화면 — 헤더 문구·변론자 배지 유지·보기 패널·키보드 숨김·조명 (DAY-05·06) ----

const hintOf = (c: ParentNode): string => c.querySelector("[data-guide]")?.textContent ?? "";
const titleOf = (c: ParentNode): string => c.querySelector(".mv-phase__title")?.textContent ?? "";

describe("최후 변론 화면 (DAY-05)", () => {
  // 변론자 3(지아), 그날 voteLog 의 cand.votes 중 3 을 가리킨 표 4
  const defense = (mySeat = 0) =>
    makeView({ phase: "defense", candidate: 3, mySeat, count: 6, candVotes: [[0, 3], [1, 3], [2, 3], [4, 3], [5, 2]] });

  it("제목 '최후 변론', 다른 사람 안내 '지아 님의 변론'", () => {
    const { container } = mount(defense());
    expect(titleOf(container)).toBe("최후 변론");
    expect(hintOf(container)).toBe("지아 님의 변론");
  });

  it("변론자 본인의 안내는 '해명할 시간이에요'", () => {
    const { container } = mount(defense(3));
    expect(hintOf(container)).toBe("해명할 시간이에요");
  });

  it("변론자 이름표만 득표 배지(data-count=4)와 유력 도장(data-sure)을 유지하고 다른 이름표에는 배지·도장이 없다", () => {
    const { container } = mount(defense());
    expect(headOf(container, 3)?.getAttribute("data-count")).toBe("4");
    expect(headOf(container, 3)?.getAttribute("data-sure")).toBe("true");
    expect(container.querySelectorAll(".mv-head[data-count]").length).toBe(1);
    expect(container.querySelectorAll(".mv-head[data-sure]").length).toBe(1);
    expect(container.querySelectorAll("[data-lead]").length).toBe(0);
  });

  it("voteLog 줄이 없으면(공개 기록이 없을 때) 배지는 없고 변론자 안내만 그대로다", () => {
    const { container } = mount(makeView({ phase: "defense", candidate: 3, count: 6 }));
    expect(container.querySelectorAll(".mv-head[data-count]").length).toBe(0);
    expect(hintOf(container)).toBe("지아 님의 변론");
  });

  it("행동 줄이 없다: 찬반 버튼·토론 끝내기·지목 버튼이 하나도 없고 패널은 채팅뿐", () => {
    const { container } = mount(defense());
    expect(verdictBtns(container).length).toBe(0);
    expect(container.querySelector("[data-end-discussion]")).toBeNull();
    expect(container.querySelector("[data-pick]")).toBeNull();
    expect(countOf(container)).toBeNull();
    expect(container.querySelector(".mv-chat")).not.toBeNull();
  });

  it("조명 trial, 긴장 0, 카메라 고정", () => {
    mount(defense());
    expect(lastScene().lighting).toBe("trial");
    expect(lastScene().tension).toBe(0);
    expect(lastScene().camera.mode).toBe("fixed");
  });
});

// 08-27: 옛 변론 화면 시험(defense.test)에서 옮긴 것이다 — 변론 아래 채팅은 변론 단계 키로 간다.
describe("최후 변론 화면 — 채팅 단계 키 (VOTE-03, COMM-03, 08-27 옮김)", () => {
  it("변론 아래 채팅에서 보낸 글은 변론 단계 키(1:defense)와 본문만 서버로 간다 — 변론자 본인도 같다", () => {
    for (const mySeat of [0, 3]) {
      const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
      const { container } = mount(makeView({ phase: "defense", candidate: 3, mySeat, count: 6 }), { send });
      const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
      fireEvent.change(input, { target: { value: "억울해요" } });
      fireEvent.submit(input.closest("form")!);
      const chats = send.mock.calls.map(([m]) => m).filter((m) => m.t === "chat");
      expect(chats, `seat ${mySeat}`).toEqual([{ t: "chat", text: "억울해요", pk: "1:defense" }]);
      cleanup();
    }
  });
});

describe("찬반 화면 — 신분별 패널·안내·조명 (DAY-06)", () => {
  it("다른 산 사람: 안내 '도윤 님을 처형할까요?' + 찬반 줄(버튼·점), 제목 '찬반'", () => {
    const { container } = mount(makeView({ candidate: 4 }));
    expect(titleOf(container)).toBe("찬반");
    expect(hintOf(container)).toBe("도윤 님을 처형할까요?");
    expect(verdictBtns(container).length).toBe(2);
    expect(countOf(container)).not.toBeNull();
  });

  it("변론자 본인: 안내 '결과를 기다려요', 패널은 숫자 + 채팅뿐(찬반 버튼 없음)", () => {
    const { container } = mount(makeView({ candidate: 0, voted: [1, 2] }));
    expect(hintOf(container)).toBe("결과를 기다려요");
    expect(verdictBtns(container).length).toBe(0);
    expect(countNow(container)).toBe(2);
    expect(countMax(container)).toBe(4);
    expect(container.querySelector(".mv-chat")).not.toBeNull();
  });

  it("유령(탈락한 나): 찬반 버튼 없이 점 + 채팅, 안내는 유령 문구, 점 수는 산 사람(나 빼고 4명) − 1", () => {
    const { container } = mount(makeView({ candidate: 3, dead: [0], voted: [1] }));
    expect(verdictBtns(container).length).toBe(0);
    expect(countOf(container)).not.toBeNull();
    expect(hintOf(container)).toBe("모두의 직업이 보여요");
    expect(countMax(container)).toBe(3);
  });

  it("변론자 이름표에는 배지·도장이 없다(찬반에서는 사라진다) — 던진 사람에게는 체크", () => {
    const { container } = mount(makeView({ candidate: 3, voted: [1], candVotes: [[0, 3], [1, 3]] }));
    expect(container.querySelectorAll(".mv-head[data-count]").length).toBe(0);
    expect(container.querySelectorAll(".mv-head[data-sure]").length).toBe(0);
    expect(headOf(container, 1)?.getAttribute("data-done")).toBe("true");
  });

  it("조명 vote, 긴장 1 에 초점은 변론자 3", () => {
    mount(makeView({ candidate: 3 }));
    expect(lastScene().lighting).toBe("vote");
    expect(lastScene().tension).toBe(1);
    expect(lastScene().focusSeat).toBe(3);
  });

  it("찬반에는 지목 이름표 버튼이 없다(이름표를 누르지 않는다)", () => {
    const { container } = mount(makeView({ candidate: 3 }));
    expect(container.querySelector("[data-pick]")).toBeNull();
  });
});

describe("찬반 줄 — 키보드가 열리면 숨고 닫으면 돌아온다 (E4 #14·#15)", () => {
  it("키보드 열림: 찬반 버튼과 점이 없고 채팅은 그대로, 닫히면 다시 나온다 (변론자 아닌 사람)", () => {
    const m = mount(makeView({ candidate: 3 }));
    expect(verdictBtns(m.container).length).toBe(2);
    kb.open = true;
    m.show(makeView({ candidate: 3 }));
    expect(m.container.querySelector(".mv-verdict")).toBeNull();
    expect(countOf(m.container)).toBeNull();
    expect(m.container.querySelector(".mv-chat")).not.toBeNull();
    kb.open = false;
    m.show(makeView({ candidate: 3 }));
    expect(verdictBtns(m.container).length).toBe(2);
    expect(countOf(m.container)).not.toBeNull();
  });

  it("변론자 본인의 점도 키보드가 열리면 숨는다", () => {
    kb.open = true;
    const { container } = mount(makeView({ candidate: 0 }));
    expect(countOf(container)).toBeNull();
  });
});

describe("찬반 줄 배치 CSS (UI-SPEC 패널 높이 표)", () => {
  it("찬반 줄 간격 8, 점과 기록 사이는 패널 간격 10, 진홍·놋쇠 변수 없음", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    const rule = css.split("\n").find((l) => l.startsWith(".mf-game__verdict "));
    expect(rule).toBeDefined();
    expect(rule).toMatch(/flex-direction:\s*column/);
    expect(rule).toMatch(/gap:\s*8px/);
    expect(css).not.toMatch(/crimson|brass/);
    expect(css).toMatch(/\.mf-game__panel \{[^}]*gap:\s*10px/);
  });
});

// ---- Task 3: 처형 — 결과 알림 시간표·유령 떠오름·처형 없음·역할 비공개 (DAY-06, 결정 0053·0060-5) ----

describe("처형 화면 (DAY-06)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const announceText = (c: ParentNode): string => c.querySelector("[data-announce]")?.textContent ?? "";
  const hotLines = (c: ParentNode): string[] => [...c.querySelectorAll(".mv-chat__sys.is-hot")].map((el) => el.textContent ?? "");
  const sysLines = (c: ParentNode): string[] => [...c.querySelectorAll(".mv-chat__sys")].map((el) => el.textContent ?? "");
  const seatTag = (c: ParentNode, seat: number): Element | null => c.querySelector(`[data-seat="${seat}"]`);

  // 변론자 4(도윤)가 찬성 5 · 반대 2 로 처형된다. 처형 단계의 view 는 이미 탈락(alive false)으로 온다.
  const verdictView = () => makeView({ phase: "verdict", count: 8, candidate: 4, verdictVote: true });
  const passedView = (extra: Partial<ViewOpts> = {}) =>
    makeView({ phase: "execution", count: 8, candidate: 4, dead: [4], verdict: { yes: 5, no: 2, passed: true }, ...extra });
  const failedView = () => makeView({ phase: "execution", count: 8, candidate: 4, verdict: { yes: 2, no: 5, passed: false } });
  const enter = (to: RoomView = passedView()) => {
    const m = mount(verdictView());
    m.show(to);
    return m;
  };

  it("처형 단계 진입(0ms)은 판결 앞머리 0.6초라 알림·hot 줄이 없고, 0.6초에 결과 알림 '찬성 5 · 반대 2' 와 같은 글자의 hot 줄이 선다 (결정 0066-7)", () => {
    const m = enter();
    expect(announceText(m.container)).toBe("");
    expect(hotLines(m.container)).toEqual([]);
    advance(599);
    expect(announceText(m.container)).toBe("");
    advance(2);
    expect(announceText(m.container)).toBe("찬성 5 · 반대 2");
    expect(hotLines(m.container)).toEqual(["찬성 5 · 반대 2"]);
  });

  it("0ms 에 VerdictPicker 는 disabled 이고 내가 고른 찬성이 눌린 채 남는다(서버는 처형 단계에 내 값을 안 보낸다)", () => {
    const m = enter();
    const yes = verdictBtn(m.container, "yes");
    expect(verdictBtns(m.container).every((b) => b.disabled)).toBe(true);
    expect(yes?.getAttribute("aria-pressed")).toBe("true");
    expect(countOf(m.container)).toBeNull();
  });

  it("2.6초: 알림이 '도윤 님 처형' 으로 바뀌고 hot 줄 '도윤 님 처형' 이 더해진다(찬성·반대 줄은 다시 만들지 않는다)", () => {
    const m = enter();
    advance(2599);
    expect(announceText(m.container)).toBe("찬성 5 · 반대 2");
    advance(2);
    expect(announceText(m.container)).toBe("도윤 님 처형");
    expect(hotLines(m.container)).toEqual(["찬성 5 · 반대 2", "도윤 님 처형"]);
  });

  it("처형된 도윤은 단계 진입 순간부터 한 번도 사라지지 않고 서 있다가, 알림 시작(2.6초)에 fadeAt 이 걸리고 2.4초 뒤(5.0초)에 장면 표에서 빠진다", () => {
    const m = mount(verdictView());
    const from = rt.scenes.length;
    m.show(passedView());
    // 진입 직후: 연출 대기 중이라 표에 있고 fadeAt 은 2.6초 시각
    expect(lastScene().seats[4]?.show).toBe(true);
    expect(lastScene().seats[4]?.ghost).toBe(false);
    expect(lastScene().seats[4]?.fadeAt).toBe(NOW + 2600);
    // 진입 렌더부터 도윤 좌석이 빠진 장면은 한 번도 없다(떠오르기 전에 깜빡 사라졌다 돌아오지 않는다)
    expect((rt.scenes.slice(from) as SceneLook[]).every((s) => s.seats[4]?.show === true)).toBe(true);
    expect(seatTag(m.container, 4)).not.toBeNull();
    advance(2600);
    expect(lastScene().seats[4]?.fadeAt).toBe(NOW + 2600);
    advance(2399);
    expect(lastScene().seats[4]?.show).toBe(true);
    advance(2);
    expect(lastScene().seats[4]).toBeUndefined();
    expect(seatTag(m.container, 4)).toBeNull();
    // 다른 산 사람은 그대로
    expect(lastScene().seats[3]?.show).toBe(true);
    expect(lastScene().seats[3]?.fadeAt).toBeUndefined();
  });

  it("연출이 끝난 뒤 새 view 가 와도(타이머 이후 같은 단계의 갱신) 산 사람 화면에 도윤은 다시 나타나지 않는다", () => {
    const m = enter();
    advance(5100);
    m.show(passedView());
    expect(lastScene().seats[4]).toBeUndefined();
    expect(seatTag(m.container, 4)).toBeNull();
    advance(10_000);
    expect(lastScene().seats[4]).toBeUndefined();
  });

  it("부결(passed false): 2.6초에 '처형 없음' 알림이 1.4초 뜨고 사라지며, 연출(fadeAt)은 어떤 좌석에도 없다", () => {
    const m = enter(failedView());
    advance(601);
    expect(announceText(m.container)).toBe("찬성 2 · 반대 5");
    advance(2001);
    expect(announceText(m.container)).toBe("처형 없음");
    expect(sysLines(m.container)).toContain("처형 없음");
    advance(1396);
    expect(announceText(m.container)).toBe("처형 없음");
    advance(3);
    expect(announceText(m.container)).toBe("");
    expect(Object.values(lastScene().seats).every((s) => s.fadeAt === undefined)).toBe(true);
    expect(lastScene().seats[4]?.show).toBe(true);
  });

  it("재접속 첫 화면이 처형 단계(A1): 알림·채팅 줄·연출이 없고, 처형된 사람은 산 사람 화면에 없다", () => {
    const { container } = mount(passedView());
    advance(5000);
    expect(announceText(container)).toBe("");
    expect(container.querySelectorAll(".mv-chat__sys").length).toBe(0);
    expect(rt.scenes.every((s) => (s as SceneLook).seats[4] === undefined)).toBe(true);
    expect(seatTag(container, 4)).toBeNull();
  });

  it("역할 비공개(결정 0053-2): 처형 단계 DOM 전체에 마피아·경찰·의사·시민이 없고 직업 칩·진홍도 없다", () => {
    const m = enter();
    for (const ms of [0, 2000, 3000]) {
      advance(ms);
      const text = m.container.textContent ?? "";
      for (const word of ["마피아", "경찰", "의사", "시민"]) expect(text).not.toContain(word);
      expect(m.container.querySelector("[data-role-chip]")).toBeNull();
      expect(m.container.innerHTML).not.toMatch(/crimson/);
    }
  });

  it("8자 닉네임 알림: 글자 그대로 '○○○○○○○○ 님 처형' 한 요소에 담기고 CSS 는 36px 한 줄 규칙에 keep-all, 28px 로 줄이지 않는다", () => {
    const nick = "가나다라마바사아";
    const nicknames = [...NAMES.slice(0, 4), nick, ...NAMES.slice(5)];
    const m = mount(makeView({ phase: "verdict", count: 8, candidate: 4, nicknames }));
    m.show(makeView({ phase: "execution", count: 8, candidate: 4, dead: [4], nicknames, verdict: { yes: 5, no: 2, passed: true } }));
    advance(2601);
    expect(announceText(m.container)).toBe(`${nick} 님 처형`);
    expect(m.container.querySelectorAll(".mf-announce__text").length).toBe(1);
    const css = readFileSync("src/styles/game.css", "utf8");
    const rule = css.split("\n").find((l) => l.startsWith(".mf-announce__text ")) ?? "";
    expect(rule).toMatch(/font-size:\s*36px/);
    expect(rule).toMatch(/word-break:\s*keep-all/);
    expect(rule).not.toMatch(/white-space:\s*nowrap/);
    expect(css).not.toMatch(/\.mf-announce[^{]*\{[^}]*font-size:\s*28px/);
  });

  it("처형 확인 시트가 없고 찬반 버튼·결과에 진홍·놋쇠 색 규칙이 없다(UI-SPEC)", () => {
    const m = enter();
    expect(m.container.querySelector('[role="dialog"], [data-confirm-sheet]')).toBeNull();
    const v2 = readFileSync("src/styles/v2.css", "utf8");
    const verdictRules = v2.split("\n").filter((l) => l.startsWith(".mv-verdict"));
    expect(verdictRules.length).toBeGreaterThan(0);
    for (const l of verdictRules) expect(l).not.toMatch(/crimson|brass/);
  });

  it("처형 연출은 서버 유령 위치가 아니라 화면이 처형 이벤트 하나로 그린다: 장면 표의 도윤은 ghost 아님이고 world 프레임 없이도 fadeAt 만으로 서 있다", () => {
    const m = enter();
    expect(lastScene().seats[4]?.ghost).toBe(false);
    expect(lastScene().seats[4]?.fadeAt).toBeDefined();
    advance(5000);
    expect(m.container.querySelector("[data-ghost]")).toBeNull();
  });
});

// 09.1.1-13: 판결 순간 연출(UI-SPEC C-1, 결정 0066-7). 처형 진입 시각 T = phaseEndsAt - 5600 기준으로 막·핀·줌·알림 위치·찬반 묶음이 시간표대로 이어진다.
describe("판결 순간 연출 — 시간표 (09.1.1-13)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const BALLOTS = { yes: [0, 1, 2, 5, 6], no: [3, 7] };
  const ENDS_AT = NOW + 5600; // 진입 시각 T = NOW
  const execView = (extra: Partial<ViewOpts> = {}) =>
    makeView({ phase: "execution", count: 8, candidate: 4, dead: [4], verdict: { yes: 5, no: 2, passed: true }, ballots: BALLOTS, phaseEndsAt: ENDS_AT, ...extra });
  const enter = (to: RoomView = execView(), from: Partial<ViewOpts> = {}) => {
    const m = mount(makeView({ phase: "verdict", count: 8, candidate: 4, ...from }));
    m.show(to);
    return m;
  };
  const reveal = (c: ParentNode): HTMLElement | null => c.querySelector("[data-ballots]");
  const dimOf = (c: ParentNode): string | null => c.querySelector(".mf-game__dim")?.getAttribute("data-dim") ?? null;
  const announce = (c: ParentNode): Element | null => c.querySelector("[data-announce]");

  it("진입 직후: 어둡게 막이 켜지고(data-dim=verdict) 찬반 묶음은 아직 없다. 줌 1.10(0.6초 ease)과 변론자 고정 핀 창이 장면 표에 선다", () => {
    const m = enter();
    expect(dimOf(m.container)).toBe("verdict");
    expect(reveal(m.container)).toBeNull();
    const cam = lastScene().camera;
    expect(cam).toMatchObject({ mode: "fixed", zoom: 1.1, zoomMs: 600 });
    expect(lastScene().pin).toEqual({ mode: "fixed", seat: 4, startAt: NOW, endAt: NOW + 5000 });
  });

  it("0.6초에 찬성 묶음, 1.0초에 반대 묶음, 4.6초에 묶음이 사라지고 막이 걷히며 줌 목표가 1 로 돌아온다", () => {
    const m = enter();
    advance(599);
    expect(reveal(m.container)).toBeNull();
    advance(1);
    expect(reveal(m.container)?.getAttribute("data-stage")).toBe("yes");
    advance(399);
    expect(reveal(m.container)?.getAttribute("data-stage")).toBe("yes");
    advance(1);
    expect(reveal(m.container)?.getAttribute("data-stage")).toBe("both");
    expect(dimOf(m.container)).toBe("verdict");
    advance(3599);
    expect(reveal(m.container)).not.toBeNull();
    advance(1);
    expect(reveal(m.container)).toBeNull();
    expect(dimOf(m.container)).not.toBe("verdict");
    expect(lastScene().camera).toMatchObject({ mode: "fixed", zoom: 1, zoomMs: 600 });
  });

  it("결과 알림은 위 72(is-top) 자리에 뜬다", () => {
    const m = enter();
    advance(600);
    expect(announce(m.container)?.className).toContain("is-top");
  });

  it("모든 viewer 가 같은 연출을 본다: 변론자(탈락)·살아 있는 시민·유령 시점 모두 같은 묶음 시간표와 같은 장면 표", () => {
    const seen: string[] = [];
    for (const mySeat of [4, 0, 3]) {
      cleanup();
      rt.scenes.length = 0;
      vi.setSystemTime(NOW);
      const m = enter(execView({ mySeat }), { mySeat });
      const timeline: string[] = [dimOf(m.container) ?? "-", reveal(m.container)?.getAttribute("data-stage") ?? "-"];
      for (const ms of [600, 400, 3600]) {
        advance(ms);
        timeline.push(reveal(m.container)?.getAttribute("data-stage") ?? "-");
      }
      timeline.push(JSON.stringify({ cam: lastScene().camera, pin: lastScene().pin }));
      seen.push(timeline.join("|"));
    }
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBe(seen[0]);
  });

  it("부결(passed false)도 같은 시간표 — 핀 창만 4.0초에 닫힌다", () => {
    const m = enter(execView({ verdict: { yes: 2, no: 5, passed: false }, dead: [] }));
    expect(lastScene().pin).toEqual({ mode: "fixed", seat: 4, startAt: NOW, endAt: NOW + 4000 });
    advance(1000);
    expect(reveal(m.container)?.getAttribute("data-stage")).toBe("both");
    advance(3600);
    expect(reveal(m.container)).toBeNull();
  });

  it("재접속·새로 고침: 진입 후 2.0초에 처음 그리면 애니메이션 없이 묶음이 바로 보이고 줌 1.10·막이 이미 켜져 있다", () => {
    const m = mount(execView({ phaseEndsAt: NOW + 5600 - 2000 }));
    const el = reveal(m.container);
    expect(el?.getAttribute("data-stage")).toBe("both");
    expect(el?.querySelector(".is-enter")).toBeNull();
    expect(el?.querySelector(".is-pending")).toBeNull();
    expect(dimOf(m.container)).toBe("verdict");
    expect(lastScene().camera).toMatchObject({ zoom: 1.1 });
    advance(2600);
    expect(reveal(m.container)).toBeNull();
  });

  it("재접속이 4.6초를 지났으면 묶음·막이 없고 핀 창도 이미 지난 값이다", () => {
    const m = mount(execView({ phaseEndsAt: NOW + 5600 - 5200 }));
    expect(reveal(m.container)).toBeNull();
    expect(dimOf(m.container)).not.toBe("verdict");
    expect(lastScene().camera).toMatchObject({ zoom: 1 });
  });

  it("마지막 3인 처형(verdict.last)·찬반 기록이 없는 처형 단계에는 묶음·막이 없다", () => {
    const a = enter(execView({ verdict: { yes: 0, no: 0, passed: true, last: true } }));
    advance(1500);
    expect(reveal(a.container)).toBeNull();
    expect(dimOf(a.container)).not.toBe("verdict");
    cleanup();
    const b = enter(execView({ ballots: undefined }));
    advance(1500);
    expect(reveal(b.container)).toBeNull();
    expect(lastScene().camera).toMatchObject({ zoom: 1 });
  });

  it("모션 줄이기: 줌 없이 막·묶음만 쓴다", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    const m = enter();
    expect(lastScene().camera).toMatchObject({ mode: "fixed", zoom: 1 });
    expect((lastScene().camera as { zoomMs?: number }).zoomMs).toBeUndefined();
    expect(dimOf(m.container)).toBe("verdict");
  });

  it("타이머는 언마운트에서 정리된다(시간표가 끝나기 전에 닫아도 남는 타이머 없음)", () => {
    const m = enter();
    advance(100);
    m.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("--mf-panel-h 는 루트(<main>)에 한 번 설정된다(떠 있는 버튼 묶음이 따로 설정하지 않는다)", () => {
    const m = mount(makeView({ phase: "verdict", count: 8, candidate: 4 }));
    const root = m.container.querySelector("main.mf-game") as HTMLElement;
    expect(root.style.getPropertyValue("--mf-panel-h")).toMatch(/px$/);
  });

  it("어둡게 막 CSS: verdict 상태는 불투명도 1(= night-950 45% 그대로)에 dur-med 로 켜진다", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    const rule = css.split("\n").find((l) => l.startsWith('.mf-game__dim[data-dim="verdict"]')) ?? "";
    expect(rule).toMatch(/opacity:\s*1/);
    expect(rule).toMatch(/var\(--dur-med\)/);
  });
});
