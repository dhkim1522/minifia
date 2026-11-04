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

// ---- Task 2: 직접 쓰기·인용 카드 수명·동시 지목·공개·처형 (UI-SPEC E-2·E-3) ----

const picks = (c: ParentNode): HTMLButtonElement[] => [...c.querySelectorAll<HTMLButtonElement>("[data-pick]")];
const pickOf = (c: ParentNode, seat: number): HTMLButtonElement | null => c.querySelector(`[data-pick="${seat}"]`);
const headOf = (c: ParentNode, seat: number): HTMLElement | null => c.querySelector(`[data-seat="${seat}"] .mv-head`);
const lastScene = (): SceneLook => rt.scenes.at(-1) as SceneLook;
const lineSheet = (c: ParentNode): HTMLElement | null => c.querySelector("[data-line-sheet]");
const chatsOf = (send: ReturnType<typeof vi.fn>) => send.mock.calls.map((c) => c[0] as ClientMessage).filter((x) => x.t === "chat");

describe("마지막 3인 — 직접 쓰기 (UI-SPEC E-2)", () => {
  it("[직접 쓰기]: 같은 자리가 한 줄 시트('한마디', 0/30)로 바뀌고, 보내면 chat 이 한 번 나가고 시트가 닫힌다", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 0 }));
    fireEvent.click(m.container.querySelector("[data-speak-write]")!);
    expect(sheet(m.container)).toBeNull();
    const ls = lineSheet(m.container)!;
    expect(ls).not.toBeNull();
    expect(ls.querySelector(".mv-line__name")?.textContent).toBe("한마디");
    expect(ls.querySelector(".mv-line__count")?.textContent).toBe("0/30");
    expect(ls.querySelector(".mv-line__face")).toBeNull();
    const input = ls.querySelector<HTMLInputElement>("[data-line-input]")!;
    fireEvent.change(input, { target: { value: "제가 시민이에요" } });
    fireEvent.click(ls.querySelector("[data-line-send]")!);
    const chats = chatsOf(m.send);
    expect(chats).toHaveLength(1);
    expect(chats[0]).toMatchObject({ t: "chat", text: "제가 시민이에요" });
    expect(lineSheet(m.container)).toBeNull();
    expect(sheet(m.container)).toBeNull();
  });

  it("닫으면 칩 시트로 돌아온다(보낸 것은 없다)", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 0 }));
    fireEvent.click(m.container.querySelector("[data-speak-write]")!);
    fireEvent.click(m.container.querySelector("[data-line-close]")!);
    expect(lineSheet(m.container)).toBeNull();
    expect(sheet(m.container)).not.toBeNull();
    expect(chatsOf(m.send)).toHaveLength(0);
  });

  it("서버가 한마디를 확정하면(doneAt) 어떤 모드든 시트가 사라진다", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 0 }));
    fireEvent.click(m.container.querySelector("[data-speak-write]")!);
    expect(lineSheet(m.container)).not.toBeNull();
    m.show(makeShowdown({ i: 0, mySeat: 0, doneAt: NOW + 10, word: "서버가 확정" }));
    expect(lineSheet(m.container)).toBeNull();
    expect(sheet(m.container)).toBeNull();
  });
});

describe("마지막 3인 — 인용 카드 수명 (UI-SPEC E-2)", () => {
  it("확정 뒤 사이에는 보이고, 다음 차례가 시작되면 표식이 사라진다(페이드 아웃)", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 2, doneAt: NOW - 100, word: "쟤가 수상해요" }));
    expect(quote(m.container)!.textContent).toBe("쟤가 수상해요");
    m.show(makeShowdown({ i: 1, mySeat: 2 }));
    expect(quote(m.container)).toBeNull();
    // 페이드를 위해 마지막 글은 남아 있되 보이지 않는다
    expect(m.container.querySelector(".mv-quote")!.classList.contains("is-on")).toBe(false);
  });

  it("재접속 첫 화면은 등장 모션 없이 현재 카드를 바로 보인다(is-still)", () => {
    const { container } = mount(makeShowdown({ i: 0, mySeat: 2, doneAt: NOW - 100, word: "저를 믿어 주세요" }));
    expect(container.querySelector(".mv-quote")!.classList.contains("is-still")).toBe(true);
  });

  it("라이브로 확정되면 등장 모션이 있다(is-still 아님)", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 2 }));
    m.show(makeShowdown({ i: 0, mySeat: 2, doneAt: NOW, word: "끝까지 지켜봐요" }));
    expect(m.container.querySelector(".mv-quote")!.classList.contains("is-still")).toBe(false);
  });

  it("같은 글을 채팅 줄로 따로 만들지 않는다(서버 채팅 경로가 한 줄을 남긴다)", () => {
    const m = mount(makeShowdown({ i: 0, mySeat: 2 }));
    m.show(makeShowdown({ i: 0, mySeat: 2, doneAt: NOW, word: "끝까지 지켜봐요" }));
    expect(m.container.querySelectorAll(".mf-turn__line").length).toBeLessThanOrEqual(1);
    expect(m.container.querySelector(".mf-game__panel")?.textContent ?? "").not.toContain("끝까지 지켜봐요");
  });
});

describe("마지막 3인 — 동시 지목 (UI-SPEC E-3)", () => {
  it("나를 뺀 두 사람의 이름표가 버튼(그룹 '지목', '{닉네임} 님 가리키기')이고 깜빡인다", () => {
    const { container } = mount(makeShowdown({ i: 3, mySeat: 0 }));
    expect(picks(container).map((b) => b.getAttribute("data-pick"))).toEqual(["2", "3"]);
    expect(pickOf(container, 2)?.getAttribute("aria-label")).toBe("서준 님 가리키기");
    expect(pickOf(container, 3)?.getAttribute("aria-label")).toBe("지아 님 가리키기");
    expect(container.querySelector('[role="group"][aria-label="지목"]')).not.toBeNull();
    expect(container.querySelectorAll(".mv-tag.is-blink").length).toBe(2);
  });

  it("유령·한마디 차례·공개에는 버튼이 없다", () => {
    expect(picks(mount(makeShowdown({ i: 3, mySeat: 1 })).container).length).toBe(0);
    cleanup();
    expect(picks(mount(makeShowdown({ i: 0, mySeat: 0 })).container).length).toBe(0);
    cleanup();
    expect(picks(mount(makeShowdown({ i: 4, mySeat: 0, points: [] })).container).length).toBe(0);
  });

  it("누르면 point 메시지, 같은 사람을 다시 누르면 보내지 않고, 다른 사람을 눌러 마감까지 바꿀 수 있다(mine 이 옮겨 간다)", () => {
    const m = mount(makeShowdown({ i: 3, mySeat: 0 }));
    fireEvent.click(pickOf(m.container, 2)!);
    expect(m.send).toHaveBeenLastCalledWith({ t: "point", target: 2 });
    expect(headOf(m.container, 2)?.getAttribute("data-mine")).toBe("true");
    const n = m.send.mock.calls.length;
    fireEvent.click(pickOf(m.container, 2)!);
    expect(m.send.mock.calls.length).toBe(n);
    fireEvent.click(pickOf(m.container, 3)!);
    expect(m.send).toHaveBeenLastCalledWith({ t: "point", target: 3 });
    expect(headOf(m.container, 3)?.getAttribute("data-mine")).toBe("true");
    expect(headOf(m.container, 2)?.hasAttribute("data-mine")).toBe(false);
  });

  it("내 캐릭터가 누른 사람을 가리킨다(장면 표 pointAt)", () => {
    const m = mount(makeShowdown({ i: 3, mySeat: 0 }));
    fireEvent.click(pickOf(m.container, 3)!);
    expect(lastScene().seats[0]?.pointAt).toBe(3);
  });

  it("던진 사람(voted)의 이름표에만 done 체크가 붙고 남의 선택(mine·누가 누구를)은 DOM 어디에도 없다", () => {
    const { container } = mount(makeShowdown({ i: 3, mySeat: 0, voted: [2, 3] }));
    expect([...container.querySelectorAll("[data-done]")].map((el) => el.closest("[data-seat]")?.getAttribute("data-seat"))).toEqual(["2", "3"]);
    expect(container.querySelectorAll("[data-mine]").length).toBe(0);
    expect(container.querySelectorAll("[data-count]").length).toBe(0);
  });

  it("서버 값(me.ballot)이 이긴다: 재접속하면 내 선택이 mine 으로 그려진다", () => {
    const { container } = mount(makeShowdown({ i: 3, mySeat: 0, ballot: 3 }));
    expect(headOf(container, 3)?.getAttribute("data-mine")).toBe("true");
  });

  it("마감 직후 거절(WRONG_PHASE)이면 '지금은 고를 수 없어요' 알림과 함께 선택이 서버 값으로 돌아간다", () => {
    let emit: (e: { t: "error"; code: string }) => void = () => {};
    const onEvent = vi.fn((cb: (e: { t: "error"; code: string }) => void) => {
      emit = cb;
      return () => {};
    });
    const m = mount(makeShowdown({ i: 3, mySeat: 0 }), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
    fireEvent.click(pickOf(m.container, 2)!);
    act(() => emit({ t: "error", code: "WRONG_PHASE" }));
    expect(m.container.querySelector(".mv-toast__text")?.textContent).toBe("지금은 고를 수 없어요");
    expect(headOf(m.container, 2)?.hasAttribute("data-mine")).toBe(false);
  });
});

describe("마지막 3인 — 공개 (UI-SPEC E-3, O-18)", () => {
  const points = [{ seat: 0, target: 2 }, { seat: 2, target: 3 }, { seat: 3, target: 2 }];
  it("세 사람이 같은 순간 가리키고(장면 표 pointAt 전체) 대상 머리 위에 득표 배지가 뜬다, 위 한 줄은 없다", () => {
    const { container } = mount(makeShowdown({ i: 4, mySeat: 0, points, left: 1500 }));
    expect(lastScene().seats[0]?.pointAt).toBe(2);
    expect(lastScene().seats[2]?.pointAt).toBe(3);
    expect(lastScene().seats[3]?.pointAt).toBe(2);
    expect(headOf(container, 2)?.getAttribute("data-count")).toBe("2");
    expect(headOf(container, 3)?.getAttribute("data-count")).toBe("1");
    expect(container.querySelectorAll("[data-done]").length).toBe(0);
    expect(block(container)!.getAttribute("data-showdown-step")).toBe("reveal");
    expect(container.querySelector(".mf-turn__pill")).toBeNull();
    expect(line(container)).toBeUndefined();
  });
});

describe("마지막 3인 — 처형 단계 (verdict.last, 득표/찬반 알림 없음)", () => {
  it("day.verdict.last 인 처형 view 에는 찬반 묶음이 없고 핀이 득표자에게 서 있다", () => {
    const v: RoomView = {
      ...makeShowdown({ i: 4, points: [] }),
      phase: "execution",
      phaseEndsAt: NOW + 3000,
      day: { n: 2, roles: [], candidate: 2, verdict: { yes: 0, no: 0, passed: true, last: true } },
    };
    const { container } = mount(v);
    expect(container.querySelector("[data-ballots]")).toBeNull();
    expect(lastScene().pin).toMatchObject({ mode: "fixed", seat: 2 });
  });
});
