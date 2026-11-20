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
        stopAllEmotes: () => {},
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
  /** 찬반 단계의 집계 수(day.verdictCount, 모두에게 같다) */
  verdictCount?: { yes: number; no: number };
  /** 내 찬반(본인에게만 오는 값) */
  verdictVote?: boolean;
  /** 처형 단계의 처형자(day.execution, 22-12): 있으면 seat = candidate(기본 3), will 은 비어 있지 않을 때만 */
  execution?: { will?: string };
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
      ...(o.candidate !== undefined && phase !== "verdict" ? { candidate: o.candidate } : {}),
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
      ...(phase === "verdict" && o.verdictCount !== undefined ? { verdictCount: o.verdictCount } : {}),
      ...(phase === "execution" && o.execution !== undefined ? { execution: { seat: o.candidate ?? 3, ...(o.execution.will !== undefined ? { will: o.execution.will } : {}) } } : {}),
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
const countRow = (c: ParentNode): HTMLElement | null => c.querySelector("[data-verdict-count-row]");
const yesNo = (c: ParentNode): [string | undefined, string | undefined] => [
  c.querySelector('[data-verdict-count="yes"]')?.textContent?.trim(),
  c.querySelector('[data-verdict-count="no"]')?.textContent?.trim(),
];
const countOf = (c: ParentNode): HTMLElement | null => c.querySelector(".mv-count");
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

describe("찬반 화면 — 숫자 줄과 두 단추 (22-10, D-11·D-26)", () => {
  it("산 5명의 찬반: 산 사람 누구에게나 찬성·반대 단추 둘, 숫자 줄은 0 · 0 이다 (처형 후보 개념 없음)", () => {
    const { container } = mount(makeView());
    expect(verdictBtns(container).map((b) => b.getAttribute("data-verdict"))).toEqual(["yes", "no"]);
    expect(yesNo(container)).toEqual(["0", "0"]);
  });

  it("day.verdictCount {yes:2,no:1}: 찬성 2 · 반대 1 이 두 덩이로 보이고 줄은 role=status '찬성 2표, 반대 1표'", () => {
    const { container } = mount(makeView({ verdictCount: { yes: 2, no: 1 } }));
    expect(yesNo(container)).toEqual(["2", "1"]);
    const line = container.querySelector("[data-verdict-count-row]")!;
    expect(line.getAttribute("role")).toBe("status");
    expect(line.getAttribute("aria-label")).toBe("찬성 2표, 반대 1표");
    expect(container.querySelector('[data-verdict-count="yes"] svg')).not.toBeNull();
    expect(container.querySelector('[data-verdict-count="no"] svg')).not.toBeNull();
    expect(verdictBtns(container).length).toBe(2);
  });

  it("1명 판·8명 판에도 같은 두 덩이다 (0 · 0 부터 8 · 0 까지)", () => {
    for (const [count, vc] of [[1, { yes: 0, no: 0 }], [8, { yes: 5, no: 3 }], [8, { yes: 8, no: 0 }]] as const) {
      const { container } = mount(makeView({ count, verdictCount: vc }));
      expect(yesNo(container)).toEqual([String(vc.yes), String(vc.no)]);
      expect(container.querySelectorAll("[data-verdict-count]").length).toBe(2);
      cleanup();
    }
  });

  it("처형 후보가 없어 이름이 들어간 글이 없다 — 산 사람 모두가 같은 화면이다 (나 = 누구든 단추 둘)", () => {
    for (const mySeat of [0, 3, 4]) {
      const { container } = mount(makeView({ mySeat, verdictCount: { yes: 1, no: 0 } }));
      expect(verdictBtns(container).length, `seat ${mySeat}`).toBe(2);
      expect(container.querySelector("[data-world-panel]")?.textContent).not.toMatch(/님/);
      cleanup();
    }
  });

  it("찬성을 누르면 verdict {agree: true} 를 보내고 찬성만 즉시 눌린 상태, 반대로 바꾸면 agree false 와 반대만 눌림", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
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
    const m = mount(makeView());
    fireEvent.click(verdictBtn(m.container, "yes")!);
    expect(verdictBtn(m.container, "yes")?.getAttribute("aria-pressed")).toBe("true");
    m.show(makeView({ verdictVote: false, verdictCount: { yes: 0, no: 1 } }));
    expect(verdictBtn(m.container, "no")?.getAttribute("aria-pressed")).toBe("true");
    expect(verdictBtn(m.container, "yes")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("소켓이 닫혀 못 보냈으면(send false) 눌린 표시를 바꾸지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => false);
    const { container } = mount(makeView(), { send });
    fireEvent.click(verdictBtn(container, "yes")!);
    expect(verdictBtn(container, "yes")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("같은 단추를 다시 눌러도 눌림은 그대로이고 반대쪽을 누르면 바뀐다(마감 전 번복)", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(verdictBtn(container, "yes")!);
    fireEvent.click(verdictBtn(container, "yes")!);
    expect(verdictBtn(container, "yes")?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(verdictBtn(container, "no")!);
    expect(verdictBtn(container, "no")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("숫자가 바뀌어도 숫자 줄에는 애니메이션·transition 이 없다(모션 줄이기와 같다)", () => {
    const m = mount(makeView({ verdictCount: { yes: 0, no: 0 } }));
    m.show(makeView({ verdictCount: { yes: 3, no: 1 } }));
    expect(yesNo(m.container)).toEqual(["3", "1"]);
    const row = m.container.querySelector("[data-verdict-count-row]")!;
    expect(row.querySelector("[class*='anim'],[class*='transition'],[style*='transition'],[style*='animation']")).toBeNull();
    const css = readFileSync("src/styles/game.css", "utf8");
    const rule = css.split("\n").filter((l) => l.includes(".mf-game__vcount"));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule.join("\n")).not.toMatch(/transition|animation/);
  });

  it("누가 던졌는지는 어디에도 없다: 이름표 체크(data-done) 0개, 찬성·반대 글자나 속성이 이름표에 없다 (T-22-19)", () => {
    const m = mount(makeView({ verdictCount: { yes: 2, no: 1 } }));
    expect(m.container.querySelectorAll("[data-done]").length).toBe(0);
    m.show(makeView({ verdictVote: true, verdictCount: { yes: 3, no: 1 } }));
    expect(m.container.querySelectorAll("[data-done]").length).toBe(0);
    const tags = m.container.querySelector(".mf-world__tags")!;
    expect(tags.textContent).not.toMatch(/찬성|반대/);
    expect(tags.innerHTML).not.toMatch(/data-agree|data-verdict|data-yes|data-no/);
  });
});

// ---- Task 2: 변론·찬반 화면 — 헤더 문구·변론자 배지 유지·보기 패널·키보드 숨김·조명 (DAY-05·06) ----

// 14-02(U-2): 헤더 안내 줄은 없다(띠가 같은 말을 한다). 아래 시험은 '안내 줄 없음'을 확인한다 — 띠 문장은 hostLine·guide 시험이 본다.
const hintOf = (c: ParentNode): string => c.querySelector(".mv-phase__hint")?.textContent ?? "";
const titleOf = (c: ParentNode): string => c.querySelector(".mv-phase__title")?.textContent ?? "";

describe("유언 단계 화면 (22-11 D-15·P22-1)", () => {
  // 처형자 3(지아). 득표 기록(voteLog)이 있어도 화면에 득표 표시를 내지 않는다
  const defense = (mySeat = 0) =>
    makeView({ phase: "defense", candidate: 3, mySeat, count: 6, candVotes: [[0, 3], [1, 3], [2, 3], [4, 3], [5, 2]] });

  it("제목 '유언', 헤더 안내 줄은 없다", () => {
    const { container } = mount(defense());
    expect(titleOf(container)).toBe("유언");
    expect(hintOf(container)).toBe("");
  });

  it("처형자 본인도 헤더 안내 줄이 없다", () => {
    const { container } = mount(defense(3));
    expect(hintOf(container)).toBe("");
  });

  it("이름표에 득표 배지·유력 도장·맥박이 없다 — 처형자 스포트라이트(핀·콘)만 비춘다(UI-SPEC D: 득표 표시 없음)", () => {
    const { container } = mount(defense());
    expect(container.querySelectorAll(".mv-head[data-count]").length).toBe(0);
    expect(container.querySelectorAll(".mv-head[data-sure]").length).toBe(0);
    expect(container.querySelectorAll("[data-lead]").length).toBe(0);
  });

  it("voteLog 줄이 없으면(공개 기록이 없을 때) 배지가 없다", () => {
    const { container } = mount(makeView({ phase: "defense", candidate: 3, count: 6 }));
    expect(container.querySelectorAll(".mv-head[data-count]").length).toBe(0);
    expect(hintOf(container)).toBe("");
  });

  it("행동 줄이 없다: 찬반 버튼·토론 끝내기·지목 버튼이 하나도 없고 패널은 잠긴 채팅뿐", () => {
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

// 22-11 D-16: 유언 단계에서는 처형자도 다른 사람도 채팅하지 못한다 — 입력줄이 잠기고 서버로 chat 이 가지 않는다(서버도 받지 않는다).
describe("유언 단계 화면 — 채팅 잠금 (22-11 D-16)", () => {
  it("유언 단계 아래 입력줄은 잠겨 있어 제출해도 chat 이 서버로 가지 않는다 — 처형자 본인도 같다", () => {
    for (const mySeat of [0, 3]) {
      const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
      const { container } = mount(makeView({ phase: "defense", candidate: 3, mySeat, count: 6 }), { send });
      const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
      expect(input.disabled, `seat ${mySeat}`).toBe(true);
      fireEvent.submit(input.closest("form")!);
      expect(send.mock.calls.map(([m]) => m).filter((m) => m.t === "chat"), `seat ${mySeat}`).toEqual([]);
      cleanup();
    }
  });
});

describe("찬반 화면 — 유령·헤더·조명 (22-10)", () => {
  it("산 사람은 헤더 안내 줄 없이 중앙 카드에서 질문·두 선택·집계를 본다", () => {
    const { container } = mount(makeView());
    expect(titleOf(container)).toBe("찬반");
    expect(hintOf(container)).toBe("");
    expect(verdictBtns(container).length).toBe(2);
    expect(countRow(container)).not.toBeNull();
    const event = container.querySelector('[data-phase-event="verdict"]')!;
    expect(event.querySelector("h2")?.textContent).toBe("오늘 처형할까요?");
    expect(event.contains(countRow(container))).toBe(true);
    expect(verdictBtns(container).every((button) => event.contains(button))).toBe(true);
    expect(container.querySelector("[data-world-panel] [data-verdict-row]")).toBeNull();
  });

  it("유령(탈락한 나): 같은 숫자 줄과 채팅, 단추는 0개(보기 패널)", () => {
    const { container } = mount(makeView({ dead: [0], verdictCount: { yes: 2, no: 1 } }));
    expect(verdictBtns(container).length).toBe(0);
    expect(container.querySelectorAll("[data-verdict]").length).toBe(0);
    expect(yesNo(container)).toEqual(["2", "1"]);
    expect(hintOf(container)).toBe("");
    expect(container.querySelector(".mv-chat")).not.toBeNull();
  });

  it("이름표에는 배지·도장·체크가 없다(찬반에서는 모두 사라진다)", () => {
    const { container } = mount(makeView({ verdictCount: { yes: 1, no: 0 }, candVotes: [[0, 3], [1, 3]] }));
    expect(container.querySelectorAll(".mv-head[data-count]").length).toBe(0);
    expect(container.querySelectorAll(".mv-head[data-sure]").length).toBe(0);
    expect(container.querySelectorAll("[data-done]").length).toBe(0);
  });

  it("조명 talk(토론 장면 그대로, 22-13 P22-3), 긴장 0·초점 없음 — 찬반에는 후보가 없다", () => {
    mount(makeView());
    expect(lastScene().lighting).toBe("talk");
    expect(lastScene().tension).toBe(0);
    expect(lastScene().focusSeat).toBeUndefined();
  });

  it("찬반에는 지목 이름표 버튼이 없다(이름표를 누르지 않는다)", () => {
    const { container } = mount(makeView());
    expect(container.querySelector("[data-pick]")).toBeNull();
  });
});

describe("찬반 줄 — 키보드가 열리면 숨고 닫으면 돌아온다 (E4 #14·#15)", () => {
  it("키보드 열림: 찬반 단추와 숫자 줄이 없고 채팅은 그대로, 닫히면 다시 나온다", () => {
    const m = mount(makeView());
    expect(verdictBtns(m.container).length).toBe(2);
    kb.open = true;
    m.show(makeView());
    expect(m.container.querySelector(".mv-verdict")).toBeNull();
    expect(countRow(m.container)).toBeNull();
    expect(m.container.querySelector(".mv-chat")).not.toBeNull();
    kb.open = false;
    m.show(makeView());
    expect(verdictBtns(m.container).length).toBe(2);
    expect(countRow(m.container)).not.toBeNull();
  });
});

// ---- 처형 — 유언 카드 3.0초 → 처형 알림 3.0초 → 꼬리 0.6초 (DAY-06, 22-12 P22-11~14, 결정 0053·0060-5) ----

describe("처형 화면 (DAY-06, 22-12)", () => {
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
  const seatTag = (c: ParentNode, seat: number): Element | null => c.querySelector(`[data-seat="${seat}"]`);
  const willCard = (c: ParentNode): HTMLElement | null => c.querySelector("[data-will-reveal]");
  const cardBox = (c: ParentNode): HTMLElement | null => c.querySelector(".mv-quote--will");

  // 처형자 4(도윤)가 처형된다. 처형 단계의 view 는 이미 탈락(alive false)으로 온다. 진입 시각 T = phaseEndsAt − 6600 = NOW.
  const verdictView = () => makeView({ phase: "verdict", count: 8, candidate: 4, verdictVote: true });
  const passedView = (extra: Partial<ViewOpts> = {}) =>
    makeView({ phase: "execution", count: 8, candidate: 4, dead: [4], execution: { will: "다들 잘 있어" }, phaseEndsAt: NOW + 6600, ...extra });
  const enter = (to: RoomView = passedView()) => {
    const m = mount(verdictView());
    m.show(to);
    return m;
  };

  it("처형 단계 진입(0ms): 유언 카드가 중앙에 보이고 3초 뒤 같은 장면에 처형 결과가 이어진다", () => {
    const m = enter();
    const card = willCard(m.container);
    expect(card?.textContent).toBe("다들 잘 있어");
    const scene = card?.closest('[data-phase-event="execution"]');
    const status = scene?.querySelector('[role="status"]');
    expect(status?.contains(card)).toBe(true);
    expect(status?.querySelector('[role="status"]')).toBeNull();
    expect(cardBox(m.container)).not.toBeNull();
    expect(announceText(m.container)).toBe("");
    expect(hotLines(m.container)).toEqual([]);
    advance(2999);
    expect(willCard(m.container)).not.toBeNull();
    expect(announceText(m.container)).toBe("");
    advance(2);
    expect(willCard(m.container)).toBeNull();
    expect(m.container.querySelector(".mv-quote--will")).toBeNull();
    expect(m.container.querySelector("[data-announce]")?.closest('[data-phase-event="execution"]')).toBe(scene);
    expect(announceText(m.container)).toBe("도윤 님 처형");
    expect(hotLines(m.container)).toEqual(["도윤 님 처형"]);
  });

  it("빈 유언(will 키 없음): 같은 카드·같은 3.0초에 '말없이 떠났어요'", () => {
    const m = enter(passedView({ execution: {} }));
    expect(willCard(m.container)?.textContent).toBe("말없이 떠났어요");
    advance(3001);
    expect(willCard(m.container)).toBeNull();
    expect(announceText(m.container)).toBe("도윤 님 처형");
  });

  it("유언 글은 텍스트 노드다: <b> 가 들어 있어도 HTML 이 되지 않는다(T-22-28)", () => {
    const m = enter(passedView({ execution: { will: "<b>범인은 나</b>" } }));
    expect(willCard(m.container)?.textContent).toBe("<b>범인은 나</b>");
    expect(willCard(m.container)?.querySelector("b")).toBeNull();
  });

  it("중앙 유언은 조작 영역을 가리지 않고 인용문은 네 줄로 제한한다", () => {
    const css = readFileSync("src/styles/v2.css", "utf8");
    const will = css.split("\n").find((l) => l.startsWith(".mv-quote--will")) ?? "";
    expect(will).toMatch(/-webkit-line-clamp:\s*4/);
    const event = readFileSync("src/styles/phase-event.css", "utf8");
    expect(event).toMatch(/\.mf-phase-event \{[^}]*pointer-events:\s*none/);
    expect(event).toMatch(/inset-block-end:[^;]*--mf-panel-h/);
  });

  it("처형 단계에는 찬반 단추 줄이 없다 — [data-verdict-row] 0개·찬반 단추 0개이고 채팅 패널은 있다(18.1-13, 결정 0083-9)", () => {
    const m = enter();
    expect(m.container.querySelectorAll("[data-verdict-row]").length).toBe(0);
    expect(verdictBtns(m.container).length).toBe(0);
    expect(countOf(m.container)).toBeNull();
    expect(m.container.querySelector("[data-chat-panel]")).not.toBeNull();
  });

  it("처형 단계는 어느 시점(산 사람·유령·처형자)에서 보아도 찬반 단추 줄이 없고 같은 유언 카드가 보인다", () => {
    for (const mySeat of [0, 3, 4]) {
      cleanup();
      const m = enter(passedView({ mySeat }));
      expect(m.container.querySelectorAll("[data-verdict-row]").length, `seat ${mySeat}`).toBe(0);
      expect(willCard(m.container)?.textContent, `seat ${mySeat}`).toBe("다들 잘 있어");
    }
  });

  it("처형된 도윤은 공개 처형 연출이 끝나는 5.4초까지 장면에 남는다", () => {
    const m = mount(verdictView());
    const from = rt.scenes.length;
    m.show(passedView());
    expect(lastScene().seats[4]?.show).toBe(true);
    expect(lastScene().seats[4]?.ghost).toBe(false);
    expect(lastScene().seats[4]?.fadeAt).toBe(NOW + 3000);
    expect((rt.scenes.slice(from) as SceneLook[]).every((s) => s.seats[4]?.show === true)).toBe(true);
    expect(seatTag(m.container, 4)).not.toBeNull();
    advance(3000);
    expect(lastScene().seats[4]?.fadeAt).toBe(NOW + 3000);
    advance(2399);
    expect(lastScene().seats[4]?.show).toBe(true);
    advance(2);
    expect(lastScene().seats[4]).toBeUndefined();
    expect(seatTag(m.container, 4)).toBeNull();
    expect(lastScene().seats[3]?.show).toBe(true);
    expect(lastScene().seats[3]?.fadeAt).toBeUndefined();
  });

  it("처형 중 같은 단계의 갱신이 와도 연출이 끝난 탈락자는 생존자 화면에서 빠져 있다", () => {
    const m = enter();
    advance(5500);
    m.show(passedView());
    expect(lastScene().seats[4]).toBeUndefined();
    expect(seatTag(m.container, 4)).toBeNull();
    advance(10_000);
    expect(lastScene().seats[4]).toBeUndefined();
  });

  it("처형 단계 재접속에서는 유언 카드를 바로 보여 주고 생존자의 장면에 탈락자를 싣지 않는다", () => {
    const { container } = mount(passedView({ phaseEndsAt: NOW + 6600 - 1000 }));
    // 진입 후 1.0초에 처음 그림 → 카드는 이미 서 있고(모션 없음) 큰 글·줄은 만들지 않는다(재접속은 이벤트 없음)
    expect(willCard(container)?.classList.contains("is-still")).toBe(true);
    advance(6000);
    expect(announceText(container)).toBe("");
    expect(container.querySelectorAll(".mv-chat__sys").length).toBe(0);
    expect(rt.scenes.every((s) => (s as SceneLook).seats[4]?.fadeAt === undefined)).toBe(true);
    expect(lastScene().seats[4]).toBeUndefined();
  });

  it("보통의 도착(진입 직후)은 등장 모션이 있다: is-still 이 없다", () => {
    const m = enter();
    expect(willCard(m.container)?.classList.contains("is-still")).toBe(false);
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
    m.show(makeView({ phase: "execution", count: 8, candidate: 4, dead: [4], nicknames, execution: {}, phaseEndsAt: NOW + 6600 }));
    advance(3001);
    expect(announceText(m.container)).toBe(`${nick} 님 처형`);
    expect(m.container.querySelectorAll(".mf-announce__text").length).toBe(1);
    const css = readFileSync("src/styles/game.css", "utf8");
    const rule = css.split("\n").find((l) => l.startsWith(".mf-announce__text ")) ?? "";
    expect(rule).toMatch(/font:\s*var\(--type-headline\)/);
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
    expect(m.container.querySelector("[data-ghost]")).toBeNull();
    advance(6000);
    expect(lastScene().seats[4]).toBeUndefined();
    expect(m.container.querySelector("[data-role-chip]")).toBeNull();
  });
});

// 판결 순간 연출(UI-SPEC C-1, 22-12 P22-13·P22-14, D-27): 처형 진입 시각 T = phaseEndsAt − 6600 기준으로 막·핀·줌이 [0, 6.0초) 창을 따른다. 찬반 묶음은 없다.
describe("판결 순간 연출 — 시간표 (22-12)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const ENDS_AT = NOW + 6600; // 진입 시각 T = NOW
  const execView = (extra: Partial<ViewOpts> = {}) =>
    makeView({ phase: "execution", count: 8, candidate: 4, dead: [4], execution: { will: "안녕" }, phaseEndsAt: ENDS_AT, ...extra });
  const enter = (to: RoomView = execView(), from: Partial<ViewOpts> = {}) => {
    const m = mount(makeView({ phase: "verdict", count: 8, candidate: 4, ...from }));
    m.show(to);
    return m;
  };
  const dimOf = (c: ParentNode): string | null => c.querySelector(".mf-game__dim")?.getAttribute("data-dim") ?? null;
  const announce = (c: ParentNode): Element | null => c.querySelector("[data-announce]");

  it("진입 직후: 어둡게 막이 켜지고(data-dim=verdict) 찬반 묶음은 없다. 줌 1.10(0.6초 ease)과 처형자 고정 핀 창(6.0초)이 장면 표에 선다", () => {
    const m = enter();
    expect(dimOf(m.container)).toBe("verdict");
    expect(m.container.querySelector("[data-ballots]")).toBeNull();
    expect(lastScene().camera).toMatchObject({ mode: "fixed", zoom: 1.1, zoomMs: 600 });
    expect(lastScene().pin).toEqual({ mode: "fixed", seat: 4, startAt: NOW, endAt: NOW + 6000 });
  });

  it("막·줌은 6.0초까지 유지되고 6.0초에 막이 걷히며 줌 목표가 1 로 돌아온다", () => {
    const m = enter();
    advance(3000);
    expect(dimOf(m.container)).toBe("verdict");
    expect(lastScene().camera).toMatchObject({ zoom: 1.1 });
    advance(2999);
    expect(dimOf(m.container)).toBe("verdict");
    advance(1);
    expect(dimOf(m.container)).not.toBe("verdict");
    expect(lastScene().camera).toMatchObject({ mode: "fixed", zoom: 1, zoomMs: 600 });
  });

  it("결과 알림은 중앙 처형 카드 안에서 한 번만 뜬다", () => {
    const m = enter();
    advance(3000);
    expect(announce(m.container)?.closest('[data-phase-event="execution"]')).not.toBeNull();
    expect(m.container.querySelectorAll("[data-announce]")).toHaveLength(1);
  });

  it("모든 viewer 가 같은 연출을 본다: 처형자(탈락)·살아 있는 시민·유령 시점 모두 같은 막·카드 시간표와 같은 장면 표", () => {
    const seen: string[] = [];
    for (const mySeat of [4, 0, 3]) {
      cleanup();
      rt.scenes.length = 0;
      vi.setSystemTime(NOW);
      const m = enter(execView({ mySeat }), { mySeat });
      const timeline: string[] = [dimOf(m.container) ?? "-", m.container.querySelector("[data-will-reveal]") ? "card" : "-"];
      for (const ms of [3000, 3000]) {
        advance(ms);
        timeline.push(`${dimOf(m.container) ?? "-"}:${m.container.querySelector("[data-will-reveal]") ? "card" : "-"}`);
      }
      timeline.push(JSON.stringify({ cam: lastScene().camera, pin: lastScene().pin }));
      seen.push(timeline.join("|"));
    }
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBe(seen[0]);
  });

  it("처형자가 없는 처형 단계(이상한 값)에는 막·줌·카드가 없다", () => {
    const m = enter(makeView({ phase: "execution", count: 8, candidate: 4, phaseEndsAt: ENDS_AT }));
    advance(1500);
    expect(dimOf(m.container)).not.toBe("verdict");
    expect(m.container.querySelector(".mv-quote--will")).toBeNull();
    expect(lastScene().camera).toMatchObject({ zoom: 1 });
  });

  it("재접속·새로 고침: 진입 후 2.0초에 처음 그리면 카드가 모션 없이 바로 보이고 줌 1.10·막이 이미 켜져 있다", () => {
    const m = mount(execView({ phaseEndsAt: ENDS_AT - 2000 }));
    const card = m.container.querySelector("[data-will-reveal]");
    expect(card?.classList.contains("is-still")).toBe(true);
    expect(dimOf(m.container)).toBe("verdict");
    expect(lastScene().camera).toMatchObject({ zoom: 1.1 });
    advance(1001);
    expect(m.container.querySelector("[data-will-reveal]")).toBeNull(); // 진입 3.0초에 카드가 빠진다
    advance(3000);
    expect(dimOf(m.container)).not.toBe("verdict");
  });

  it("재접속이 6.0초를 지났으면 카드·막이 없고 줌은 이미 1 이다", () => {
    const m = mount(execView({ phaseEndsAt: ENDS_AT - 6200 }));
    expect(m.container.querySelector("[data-will-reveal]")).toBeNull();
    expect(dimOf(m.container)).not.toBe("verdict");
    expect(lastScene().camera).toMatchObject({ zoom: 1 });
  });

  it("모션 줄이기: 줌 없이 막·카드만 쓴다(카드 등장·사라짐은 CSS transition: none 으로 즉시)", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    const m = enter();
    expect(lastScene().camera).toMatchObject({ mode: "fixed", zoom: 1 });
    expect((lastScene().camera as { zoomMs?: number }).zoomMs).toBeUndefined();
    expect(dimOf(m.container)).toBe("verdict");
    expect(m.container.querySelector("[data-will-reveal]")).not.toBeNull();
    const css = readFileSync("src/styles/v2.css", "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.mv-quote \{ transition: none; \} \}/);
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
