import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { readFileSync } from "node:fs";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 09.1.1-15: 마지막 3인 화면 — 지목·결선과 같은 알약 부품(blockLook) 위에 한마디 칩 시트·인용 카드·동시 지목이 올라간다(UI-SPEC E). 틀은 결선 시험(09.1.1-14)과 같다.
// 08-15: 지목 화면(DAY-04·05, MAP-04). RoomScreen 을 거쳐 GameMap 을 그리고, WorldStage 는 진짜를 쓴다 —
// 이름표 버튼(data-pick)·득표 배지(data-count)·mine 은 WorldStage 가 그리는 DOM 이라서다.
// 런타임(three)만 가짜로 바꿔 건네받은 장면 표(setScene)·손사래(deny)를 기록한다. 런타임이 장면 표를 렌더러에 옮기는 일은 worldStage.test(08-12) 몫이다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ scenes: [] as unknown[], denies: [] as number[], created: 0 }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => {
      rt.created += 1;
      return {
        start: () => Promise.resolve(),
        syncPlayers: () => {},
        deny: (seat: number) => rt.denies.push(seat),
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

const NAMES = ["서연", "민준", "도윤", "지호", "하윤"];
const NOW = 1_700_000_000_000;
const TURN_MS = 8000;

interface ShowdownOpts {
  i?: number;
  left?: number;
  mySeat?: number;
  /** 산 세 사람 좌석(기본 0·2·3). 나머지는 탈락 */
  order?: number[];
  doneAt?: number;
  skip?: true;
  word?: string;
  voted?: number[];
  points?: Array<{ seat: number; target: number }>;
  ballot?: number;
  nicknames?: string[];
}

function makeShowdown(o: ShowdownOpts = {}): RoomView {
  const order = o.order ?? [0, 2, 3];
  const players: PublicPlayer[] = Array.from({ length: 5 }, (_, seat) => ({
    seat,
    nickname: o.nicknames?.[seat] ?? NAMES[seat]!,
    connected: true,
    isHost: seat === 0,
    ...(order.includes(seat) ? {} : { alive: false }),
  }));
  const mySeat = o.mySeat ?? 0;
  const i = o.i ?? 0;
  return {
    code: "0042",
    phase: "showdown",
    phaseEndsAt: NOW + (o.left ?? TURN_MS),
    phaseDurationMs: TURN_MS,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: order.includes(mySeat) ? "all" : "ghost", ...(o.ballot !== undefined ? { ballot: o.ballot } : {}) },
    day: {
      n: 2,
      roles: [],
      showdown: {
        order,
        i,
        ...(i >= 0 && i <= 3 ? { endsAt: NOW + (o.left ?? TURN_MS) } : {}),
        ...(o.doneAt !== undefined ? { doneAt: o.doneAt } : {}),
        ...(o.skip ? { skip: true as const } : {}),
        ...(o.word !== undefined ? { word: o.word } : {}),
        ...(i === 3 ? { voted: o.voted ?? [] } : {}),
        ...(i === 4 ? { points: o.points ?? [] } : {}),
      },
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
    send: (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn>,
    show: (v: RoomView, o: Partial<RoomConnection> = {}) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch, ...o });
      r.rerender(ui());
    },
  };
};

const block = (c: ParentNode): HTMLElement | null => c.querySelector("[data-turn-block]");
const sheet = (c: ParentNode): HTMLElement | null => c.querySelector(".mv-speak-sheet");
const quote = (c: ParentNode): HTMLElement | null => c.querySelector("[data-last-word]");
const line = (c: ParentNode): string | undefined => c.querySelector(".mf-turn__line.is-on")?.textContent ?? undefined;
const title = (c: ParentNode): string => c.querySelector(".mv-phase__title")?.textContent ?? "";
const hint = (c: ParentNode): string => c.querySelector(".mv-phase__hint")?.textContent ?? "";

beforeEach(() => {
  rt.scenes.length = 0;
  rt.denies.length = 0;
  rt.created = 0;
  installMemoryStorage();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("마지막 3인 화면 — 알약·위 한 줄·헤더 (UI-SPEC E-1, 트레이서)", () => {
  it("한마디 1번째(남은 8초): 제목 '마지막 셋', 알약 `1 / 3` · `서연 님 차례` · `8초`, 막대, data-turn-mode=speak", () => {
    const { container } = mount(makeShowdown({ i: 0, mySeat: 2 }));
    expect(title(container)).toBe("마지막 셋");
    const b = block(container)!;
    expect(b.getAttribute("data-turn-mode")).toBe("speak");
    expect(b.getAttribute("data-showdown-step")).toBe("speak");
    expect(b.querySelector(".mf-turn__count")?.textContent).toBe("1 / 3");
    expect(b.querySelector(".mf-turn__name")?.textContent).toBe("서연 님 차례");
    expect(b.querySelector(".mf-turn__sec")?.textContent).toBe("8초");
    expect(b.querySelector(".mf-turn__bar")).not.toBeNull();
  });

  it("남은 5초 이하는 내 차례가 아닌 화면에도 진홍(urgent), 헤더 링과 같은 값", () => {
    const { container } = mount(makeShowdown({ i: 1, mySeat: 0, left: 4200 }));
    expect(block(container)!.getAttribute("data-turn-tone")).toBe("urgent");
    expect(container.querySelector(".mv-ring")!.classList.contains("is-urgent")).toBe(true);
  });

  it("동시 지목: 알약 `지목` · `모두 동시에` · `{초}초`, data-turn-mode=point, 위 한 줄 없음", () => {
    const { container } = mount(makeShowdown({ i: 3, mySeat: 0, left: 7300 }));
    const b = block(container)!;
    expect(b.getAttribute("data-turn-mode")).toBe("point");
    expect(b.getAttribute("data-showdown-step")).toBe("point");
    expect(b.querySelector(".mf-turn__count")?.textContent).toBe("지목");
    expect(b.querySelector(".mf-turn__name")?.textContent).toBe("모두 동시에");
    expect(b.querySelector(".mf-turn__sec")?.textContent).toBe("8초");
    expect(line(container)).toBeUndefined();
  });

  it("모이는 중(i -1): 알약 없음, 라이브로 들어오면 위 한 줄 '마지막 셋이에요'", () => {
    const first = makeShowdown({ i: -1 });
    const m = mount({ ...first, phase: "dayAnnounce", day: { n: 2, roles: [] } });
    m.show(first);
    expect(title(m.container)).toBe("마지막 셋");
    expect(m.container.querySelector(".mf-turn__pill")).toBeNull();
    expect(line(m.container)).toBe("마지막 셋이에요");
  });

  it("헤더 안내: 내 한마디 차례 '한마디를 골라요', 남의 차례 없음, 동시 지목 '의심되는 사람을 눌러요', 유령은 기존", () => {
    expect(hint(mount(makeShowdown({ i: 0, mySeat: 0 })).container)).toBe("한마디를 골라요");
    cleanup();
    expect(hint(mount(makeShowdown({ i: 0, mySeat: 2 })).container)).toBe("");
    cleanup();
    expect(hint(mount(makeShowdown({ i: 3, mySeat: 2 })).container)).toBe("의심되는 사람을 눌러요");
    cleanup();
    expect(hint(mount(makeShowdown({ i: 3, mySeat: 1 })).container)).toBe("모두의 직업이 보여요");
  });

  it("닉네임은 글자로 그린다: 알약 이름에 '<b>서연</b>' 이 HTML 이 되지 않는다", () => {
    const { container } = mount(makeShowdown({ i: 0, mySeat: 2, nicknames: ["<b>서연</b>", "민준", "도윤", "지호", "하윤"] }));
    expect(block(container)!.querySelector(".mf-turn__name")?.textContent).toBe("<b>서연</b> 님 차례");
    expect(block(container)!.querySelector("b")).toBeNull();
  });
});

describe("마지막 3인 화면 — 내 한마디 차례의 칩 시트 (UI-SPEC E-2)", () => {
  it("내 차례: 칩 4개 + 직접 쓰기 가 채팅 패널 자리를 덮고, 채팅 패널은 숨는다", () => {
    const { container } = mount(makeShowdown({ i: 0, mySeat: 0 }));
    const s = sheet(container)!;
    expect(s).not.toBeNull();
    const buttons = [...s.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(buttons).toEqual(["저는 아니에요", "쟤가 수상해요", "저를 믿어 주세요", "끝까지 지켜봐요", "직접 쓰기"]);
    expect(container.querySelector(".mf-game__panel")!.getAttribute("data-will-hide-panel")).toBe("true");
  });

  it("칩을 누르면 chat 이 정확히 한 번 나가고 시트가 사라진다(서버 확정 전에도 다시 못 누른다)", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 0 }));
    fireEvent.click([...sheet(m.container)!.querySelectorAll("button")].find((b) => b.textContent?.includes("저는 아니에요"))!);
    const chats = m.send.mock.calls.map((c) => c[0] as ClientMessage).filter((x) => x.t === "chat");
    expect(chats).toHaveLength(1);
    expect(chats[0]).toMatchObject({ t: "chat", text: "저는 아니에요" });
    expect(typeof (chats[0] as { pk?: unknown }).pk).toBe("string");
    expect(sheet(m.container)).toBeNull();
    m.show(makeShowdown({ i: 0, mySeat: 0, left: 6000 })); // 서버가 아직 확정하지 않은 새 view
    expect(sheet(m.container)).toBeNull();
    expect(m.container.querySelector(".mf-game__panel")!.hasAttribute("data-will-hide-panel")).toBe(false);
  });

  it("다음 내 차례가 오면(다른 차례 번호) 시트가 다시 열린다", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 0 }));
    fireEvent.click(sheet(m.container)!.querySelector("button")!);
    m.show(makeShowdown({ i: 1, mySeat: 0, order: [2, 0, 3] }));
    expect(sheet(m.container)).not.toBeNull(); // order [2, 0, 3] 의 1번째 차례는 나(좌석 0) — 차례 번호가 달라 새로 열린다
  });

  it("내 차례가 아니면 시트가 없고 채팅 패널은 그대로, 확정된 뒤에도 시트가 없다", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 2 }));
    expect(sheet(m.container)).toBeNull();
    expect(m.container.querySelector("[data-chat-input]")).not.toBeNull();
    expect(m.container.querySelector(".mf-game__panel")!.hasAttribute("data-will-hide-panel")).toBe(false);
    m.show(makeShowdown({ i: 0, mySeat: 0, doneAt: NOW - 100, word: "안녕" }));
    expect(sheet(m.container)).toBeNull();
  });

  it("유령·연결 끊김에서는 시트 칩이 눌리지 않는다(aria-disabled)", () => {
    const { container } = mount(makeShowdown({ i: 0, mySeat: 0 }), { canSend: false });
    const chip = sheet(container)!.querySelector("button")!;
    expect(chip.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("마지막 3인 화면 — 인용 카드 (UI-SPEC E-2)", () => {
  it("확정된 한마디가 있으면 알약 아래에 [data-last-word] 가 글 그대로 뜬다(남의 화면도 같다)", () => {
    const { container } = mount(makeShowdown({ i: 1, mySeat: 0, doneAt: NOW - 200, word: "저는 아니에요" }));
    const q = quote(container)!;
    expect(q).not.toBeNull();
    expect(q.textContent).toBe("저는 아니에요");
    const b = block(container)!;
    expect(b.contains(q)).toBe(true);
    expect(b.querySelector(".mf-turn__pill")!.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("한마디 글은 HTML 이 되지 않는다", () => {
    const { container } = mount(makeShowdown({ i: 1, mySeat: 0, doneAt: NOW - 200, word: "<b>나</b>" }));
    expect(quote(container)!.textContent).toBe("<b>나</b>");
    expect(container.querySelector("[data-last-word] b")).toBeNull();
  });

  it("시간 초과(skip)에는 카드도 '건너뜀' 글도 없다", () => {
    const { container } = mount(makeShowdown({ i: 1, mySeat: 0, doneAt: NOW - 200, skip: true }));
    expect(quote(container)).toBeNull();
    expect(container.textContent).not.toContain("건너뜀");
  });
});
