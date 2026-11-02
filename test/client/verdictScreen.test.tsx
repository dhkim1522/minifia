import { act, cleanup, fireEvent, render } from "@testing-library/react";
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
  verdict?: { yes: number; no: number; passed: boolean };
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
    phaseEndsAt: NOW + 10_000,
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
      ...(phase === "execution" && o.verdict !== undefined ? { verdict: o.verdict, execution: { seat: o.candidate ?? 3, phrase: 0 } } : {}),
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
const dotsOf = (c: ParentNode): HTMLElement | null => c.querySelector(".mv-dots");
const dotsOn = (c: ParentNode): number => c.querySelectorAll(".mv-dots__dot.is-on").length;
const dotsTotal = (c: ParentNode): number => c.querySelectorAll(".mv-dots__dot").length;
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
  it("산 5명 · 변론자 3 의 찬반: 나(변론자 아님)의 패널에 찬성·반대 버튼 둘과 '투표한 사람' 점 4개(산 사람 − 1)", () => {
    const { container } = mount(makeView({ candidate: 3 }));
    expect(verdictBtns(container).map((b) => b.getAttribute("data-verdict"))).toEqual(["yes", "no"]);
    expect(dotsOf(container)?.getAttribute("aria-label")).toBe("투표한 사람");
    expect(dotsTotal(container)).toBe(4);
    expect(dotsOn(container)).toBe(0);
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

  it("서버 view 의 voted 에 내가 들면 내 이름표에 체크(data-done)와 점 1개 — 아직 아무도 안 던진 좌석에는 체크가 없다", () => {
    const m = mount(makeView({ candidate: 3 }));
    expect(m.container.querySelectorAll("[data-done]").length).toBe(0);
    m.show(makeView({ candidate: 3, voted: [0], verdictVote: true }));
    expect(headOf(m.container, 0)?.getAttribute("data-done")).toBe("true");
    expect(headOf(m.container, 1)?.hasAttribute("data-done")).toBe(false);
    expect(dotsOn(m.container)).toBe(1);
  });

  it("다른 좌석이 voted 에 들면 그 이름표에 체크만 붙고 무엇을 골랐는지는 어디에도 없다", () => {
    const m = mount(makeView({ candidate: 3 }));
    m.show(makeView({ candidate: 3, voted: [1, 2] }));
    expect(headOf(m.container, 1)?.getAttribute("data-done")).toBe("true");
    expect(headOf(m.container, 2)?.getAttribute("data-done")).toBe("true");
    expect(dotsOn(m.container)).toBe(2);
    // 내 버튼은 눌리지 않았고(내가 안 던짐), 남의 이름표 어디에도 찬성·반대 글자나 속성이 없다
    expect(verdictBtn(m.container, "yes")?.getAttribute("aria-pressed")).toBe("false");
    const tags = m.container.querySelector(".mf-world__tags")!;
    expect(tags.textContent).not.toMatch(/찬성|반대/);
    expect(tags.innerHTML).not.toMatch(/data-agree|data-verdict|data-yes|data-no/);
  });
});
