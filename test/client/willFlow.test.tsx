import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { WILL_QUIET_MS } from "../../src/net/useWill";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// WILL-01·NIGHT-12, UI-SPEC 279~286행. 유언·쪽지 화면 흐름: RoomScreen → GameMap → GamePanel·WillSheet 를 진짜로 그리고
// 연결(useRoomConnection)과 3D 런타임만 가짜로 바꾼다. 서버 응답은 새 view(me.will·me.note)를 다시 먹여 흉내 낸다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

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

const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];
// 0 마피아 · 1 경찰 · 2 의사 · 3 시민 · 4 마피아 · 5 시민
const JOBS: RoleId[] = ["mafia", "police", "doctor", "citizen", "mafia", "citizen", "citizen", "citizen"];
const NOW = 1_700_000_000_000;

interface ViewOpts {
  phase?: PhaseId;
  mySeat?: number;
  dead?: number[];
  will?: string;
  note?: string;
  nightSure?: number;
  /** 유언 단계(defense)의 처형자 좌석 — day.candidate */
  candidate?: number;
  /** 마감까지 남은 ms(기본 30초) */
  endsIn?: number;
}

function makeView(o: ViewOpts = {}): RoomView {
  const mySeat = o.mySeat ?? 3;
  const phase = o.phase ?? "night";
  const dead = o.dead ?? [];
  const meDead = dead.includes(mySeat);
  const role = JOBS[mySeat] ?? "citizen";
  const players: PublicPlayer[] = Array.from({ length: 6 }, (_, seat) => ({
    seat,
    nickname: NAMES[seat] ?? `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(dead.includes(seat) ? { alive: false } : {}),
  }));
  const allies = JOBS.flatMap((j, s) => (j === "mafia" && s !== mySeat && s < 6 ? [s] : []));
  // 유언 단계(22-11 D-16)는 서버가 채팅을 받지 않아 me.chat 키가 없다. 유령은 그대로 ghost 다.
  const chat = meDead ? "ghost" : phase === "night" ? (role === "mafia" ? "mafia" : undefined) : phase === "defense" ? undefined : "all";
  const view = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (o.endsIn ?? 30_000),
    phaseDurationMs: phase === "defense" ? 10_000 : 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: {
      seat: mySeat,
      isHost: mySeat === 0,
      role,
      ...(role === "mafia" ? { allies } : {}),
      ...(chat !== undefined ? { chat } : {}),
      ...(role === "mafia" && phase === "night" ? { nightTally: [] } : {}),
      ...(o.nightSure !== undefined ? { nightSure: o.nightSure } : {}),
      ...(o.will !== undefined ? { will: o.will } : {}),
      ...(o.note !== undefined ? { note: o.note } : {}),
    },
    day: { n: 1, roles: [], ...(o.candidate !== undefined ? { candidate: o.candidate } : {}) },
  } as RoomView;
  if (meDead) view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: JOBS[p.seat] ?? "citizen" })) };
  return view;
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

type Send = ReturnType<typeof vi.fn<(m: ClientMessage) => boolean>>;
const sent = (send: Send): ClientMessage[] => send.mock.calls.map(([x]) => x);
const typings = (send: Send): ClientMessage[] => sent(send).filter((x) => x.t === "typing");
const willBtn = (c: ParentNode): HTMLButtonElement | null => c.querySelector<HTMLButtonElement>("[data-will-button]");
const sheet = (c: ParentNode, kind: "will" | "note" = "will"): HTMLElement | null => c.querySelector<HTMLElement>(`[data-will-sheet="${kind}"]`);
const area = (c: ParentNode): HTMLTextAreaElement => c.querySelector("textarea.mv-will__text") as HTMLTextAreaElement;
const saveBtn = (c: ParentNode): HTMLButtonElement => c.querySelector(".mv-will__save") as HTMLButtonElement;
const closeBtn = (c: ParentNode): HTMLButtonElement => c.querySelector('.mv-will [aria-label="닫기"]') as HTMLButtonElement;

beforeEach(() => {
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("유언 한 번 저장 — 밤 시민 [유언] (WILL-01, 트레이서)", () => {
  it("밤 산 시민 아래 패널에는 [유언] 버튼 하나뿐이고 채팅 패널은 없다", () => {
    const { container } = mount(makeView());
    expect(container.querySelectorAll("[data-will-button]")).toHaveLength(1);
    expect(willBtn(container)?.textContent).toContain("유언");
    expect(container.querySelector(".mv-chat")).toBeNull();
    expect(sheet(container)).toBeNull();
  });

  it("누르면 유언 시트가 뜨고 textarea 에 초점, 버튼은 눌림(aria-pressed)이다", () => {
    const { container } = mount(makeView());
    fireEvent.click(willBtn(container)!);
    expect(sheet(container)).not.toBeNull();
    expect(document.activeElement).toBe(area(container));
    expect(willBtn(container)?.getAttribute("aria-pressed")).toBe("true");
  });

  it("쓰고 [저장] → {t:'will', text} 한 번, 곧바로 창이 닫히고 초점이 [유언] 단추로 돌아간다(0083-6). 저장됨은 서버가 me.will 을 돌려준 뒤 단추의 점·이름으로 안다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView(), { send });
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "범인은 2번" } });
    fireEvent.click(saveBtn(m.container));
    expect(sent(send).filter((x) => x.t === "will")).toEqual([{ t: "will", text: "범인은 2번" }]);
    expect(sheet(m.container)).toBeNull();
    expect(document.activeElement).toBe(willBtn(m.container));
    expect(willBtn(m.container)?.hasAttribute("data-will-saved")).toBe(false);
    m.show(makeView({ will: "범인은 2번" }));
    expect(sheet(m.container)).toBeNull();
    expect(sent(send).filter((x) => x.t === "will")).toHaveLength(1);
    expect(willBtn(m.container)?.hasAttribute("data-will-saved")).toBe(true);
    expect(willBtn(m.container)?.getAttribute("aria-label")).toBe("유언, 저장됨");
    expect(m.container.querySelectorAll(".mf-game__will-dot")).toHaveLength(1);
  });

  it("밤 시민·경찰·의사의 [유언] 단추: me.will 이 없으면 data-will-saved 없음·이름 '유언'·점 없음, 있으면 켜진다(0083-6)", () => {
    for (const seat of [1, 2, 3]) {
      const a = mount(makeView({ mySeat: seat }));
      expect(willBtn(a.container)?.hasAttribute("data-will-saved"), `seat ${seat}`).toBe(false);
      expect(willBtn(a.container)?.getAttribute("aria-label") ?? "유언", `seat ${seat}`).toBe("유언");
      expect(a.container.querySelector(".mf-game__will-dot")).toBeNull();
      cleanup();
      const b = mount(makeView({ mySeat: seat, will: "남긴 말" }));
      expect(willBtn(b.container)?.hasAttribute("data-will-saved"), `seat ${seat}`).toBe(true);
      expect(willBtn(b.container)?.getAttribute("aria-label"), `seat ${seat}`).toBe("유언, 저장됨");
      expect(b.container.querySelectorAll(".mf-game__will-dot")).toHaveLength(1);
      cleanup();
    }
  });

  it("me.will 이 있는 view 에서 열면 textarea 가 그 값으로 채워지고 '저장됨'이다. 같은 값은 보내지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ will: "범인은 2번" }), { send });
    fireEvent.click(willBtn(m.container)!);
    expect(area(m.container).value).toBe("범인은 2번");
    expect(saveBtn(m.container).textContent).toBe("저장됨");
    fireEvent.click(saveBtn(m.container));
    expect(sent(send)).toEqual([]);
  });

  it("바뀐 내용이 있는 채로 닫으면 저장 한 번 뒤 시트가 닫히고 초점이 [유언] 버튼으로 돌아간다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView(), { send });
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "안녕" } });
    fireEvent.click(closeBtn(m.container));
    expect(sent(send).filter((x) => x.t === "will")).toEqual([{ t: "will", text: "안녕" }]);
    expect(sheet(m.container)).toBeNull();
    expect(document.activeElement).toBe(willBtn(m.container));
    expect(willBtn(m.container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("바뀐 게 없으면 닫아도 보내지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ will: "그대로" }), { send });
    fireEvent.click(willBtn(m.container)!);
    fireEvent.click(closeBtn(m.container));
    expect(sent(send)).toEqual([]);
    expect(sheet(m.container)).toBeNull();
  });

  it("열고 쓰고 저장하고 닫는 전 과정에서 typing 메시지가 0회다(L7, T-09-38)", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView(), { send });
    fireEvent.click(willBtn(m.container)!);
    fireEvent.focus(area(m.container));
    fireEvent.change(area(m.container), { target: { value: "가" } });
    fireEvent.change(area(m.container), { target: { value: "가나" } });
    fireEvent.blur(area(m.container));
    fireEvent.click(saveBtn(m.container));
    fireEvent.click(willBtn(m.container)!);
    fireEvent.click(closeBtn(m.container));
    expect(typings(send)).toEqual([]);
    expect(sent(send).every((x) => x.t === "will")).toBe(true);
  });
});

// ---- Task 2: 깃펜 배선 · 실패 · 사망 · 쪽지 -----------------------------------------------------------------

function withHandlers(): { handlers: Array<(e: never, meta: { epoch: number }) => void>; onEvent: RoomConnection["onEvent"] } {
  const handlers: Array<(e: never, meta: { epoch: number }) => void> = [];
  const onEvent = vi.fn((cb: unknown) => {
    handlers.push(cb as (typeof handlers)[number]);
    return () => {};
  });
  return { handlers, onEvent: onEvent as unknown as RoomConnection["onEvent"] };
}
const emitError = (handlers: Array<(e: never, meta: { epoch: number }) => void>, code: string): void => {
  act(() => handlers.forEach((h) => h({ t: "error", code } as never, { epoch: 1 })));
};
const toastText = (c: ParentNode): string => c.querySelector(".mv-toast__text")?.textContent ?? "";
const noteBtn = (c: ParentNode): HTMLButtonElement | null => c.querySelector<HTMLButtonElement>("[data-note-button]");
const FAIL = "보내지 못했어요. 다시 해 보세요";

describe("깃펜 배선 (WILL-01, UI-SPEC 281행)", () => {
  it("낮 토론 산 사람: 도구 줄 깃펜을 누르면 유언 시트가 열리고, 닫으면 초점이 돌아간다", () => {
    const m = mount(makeView({ phase: "discussion" }));
    const pen = willBtn(m.container)!;
    expect(pen.closest('[role="group"][aria-label="토론 도구"]')).not.toBeNull();
    expect(pen.getAttribute("aria-label")).toBe("유언 쓰기");
    fireEvent.click(pen);
    expect(sheet(m.container)).not.toBeNull();
    expect(pen.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(closeBtn(m.container));
    expect(sheet(m.container)).toBeNull();
    expect(document.activeElement).toBe(willBtn(m.container));
  });

  it("낮 토론 깃펜은 입력줄 바깥에 있고, 열고 저장하는 동안 typing 이 0회다(WILL-01)", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ phase: "discussion" }), { send });
    const pen = willBtn(m.container)!;
    expect(pen.closest(".mv-chat__form")).toBeNull();
    fireEvent.click(pen);
    fireEvent.focus(area(m.container));
    fireEvent.change(area(m.container), { target: { value: "범인은 셋" } });
    fireEvent.click(saveBtn(m.container));
    expect(sheet(m.container)).toBeNull();
    expect(typings(send)).toEqual([]);
  });

  it("me.will 이 있으면 깃펜 aria-label 이 '유언 쓰기, 저장됨'이고 점이 켜진다. 아침 단계에도 있다", () => {
    const m = mount(makeView({ phase: "morning", will: "남긴 말" }));
    expect(willBtn(m.container)?.getAttribute("aria-label")).toBe("유언 쓰기, 저장됨");
    expect(m.container.querySelector(".mv-chat__will-dot")).not.toBeNull();
  });

  it("유령 화면(낮·밤)과 로비에는 깃펜·[유언]·시트가 0개다 (UI-SPEC 286행)", () => {
    for (const phase of ["discussion", "night", "morning"] as const) {
      const g = mount(makeView({ phase, mySeat: 5, dead: [5] }));
      expect(g.container.querySelectorAll("[data-will-button]"), phase).toHaveLength(0);
      expect(g.container.querySelector("[data-will-sheet]"), phase).toBeNull();
      cleanup();
    }
    const lobby = mount(makeView({ phase: "lobby" }));
    expect(lobby.container.querySelectorAll("[data-will-button]")).toHaveLength(0);
    expect(lobby.container.querySelector("[data-will-sheet]")).toBeNull();
  });

  it("밤 경찰·의사: 얼굴 목록 아래에 [유언] 행동 줄이 있다", () => {
    for (const seat of [1, 2]) {
      const m = mount(makeView({ mySeat: seat }));
      expect(m.container.querySelector("[data-face-list]")).not.toBeNull();
      expect(m.container.querySelectorAll("[data-will-button]"), `seat ${seat}`).toHaveLength(1);
      cleanup();
    }
  });
});

describe("저장 실패 · 빈 칸 · 사망 (E7 #36~#38)", () => {
  it("소켓이 닫혀 못 보내면(send false) 위 알림 한 번 뒤 창은 닫히고, 다시 열면 쓰던 글이 '저장'과 함께 남아 있다(0083-6)", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => false);
    const m = mount(makeView(), { send });
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "급해" } });
    fireEvent.click(saveBtn(m.container));
    expect(toastText(m.container)).toBe(FAIL);
    expect(sheet(m.container)).toBeNull();
    fireEvent.click(willBtn(m.container)!);
    expect(area(m.container).value).toBe("급해");
    expect(saveBtn(m.container).textContent).toBe("저장");
  });

  it("보낸 뒤 거절(error)이 오면 같은 알림 한 번만(지금은 고를 수 없어요 가 겹치지 않는다)이고 저장됨 표시가 없다. 창은 닫힌 채, 다시 열면 쓰던 글이 남아 있다", () => {
    const { handlers, onEvent } = withHandlers();
    const m = mount(makeView(), { onEvent });
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "급해" } });
    fireEvent.click(saveBtn(m.container));
    expect(sheet(m.container)).toBeNull();
    emitError(handlers, "WRONG_PHASE");
    expect(toastText(m.container)).toBe(FAIL);
    expect(willBtn(m.container)?.hasAttribute("data-will-saved")).toBe(false);
    fireEvent.click(willBtn(m.container)!);
    expect(area(m.container).value).toBe("급해");
    expect(saveBtn(m.container).textContent).toBe("저장");
  });

  it("IN-01: 조합 중 [저장] → [닫기] 후 조합이 끝나면 will 메시지 1회이고 시트가 닫히며 오류 알림이 없다", () => {
    vi.useFakeTimers();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView(), { send });
    fireEvent.click(willBtn(m.container)!);
    const ta = area(m.container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: "범인은" } });
    fireEvent.click(saveBtn(m.container));
    fireEvent.click(closeBtn(m.container));
    expect(sent(send)).toEqual([]);
    fireEvent.compositionEnd(ta);
    expect(sent(send).filter((x) => x.t === "will")).toEqual([{ t: "will", text: "범인은" }]);
    expect(sheet(m.container)).toBeNull();
    expect(toastText(m.container)).toBe("");
    act(() => void vi.advanceTimersByTime(300));
    expect(sent(send)).toHaveLength(1);
  });

  it("3초 동안 me.will 이 안 바뀌면 같은 알림이다. 그 전에 서버 값이 오면 알림이 없다", () => {
    vi.useFakeTimers();
    const m = mount(makeView());
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "느림" } });
    fireEvent.click(saveBtn(m.container));
    act(() => void vi.advanceTimersByTime(2900));
    expect(toastText(m.container)).toBe("");
    act(() => void vi.advanceTimersByTime(200));
    expect(toastText(m.container)).toBe(FAIL);
    expect(sheet(m.container)).toBeNull();
    fireEvent.click(willBtn(m.container)!);
    expect(area(m.container).value).toBe("느림");
    expect(saveBtn(m.container).textContent).toBe("저장");
    cleanup();
    // 제때 오면 알림 없음
    const ok = mount(makeView());
    fireEvent.click(willBtn(ok.container)!);
    fireEvent.change(area(ok.container), { target: { value: "빠름" } });
    fireEvent.click(saveBtn(ok.container));
    ok.show(makeView({ will: "빠름" }));
    act(() => void vi.advanceTimersByTime(5000));
    expect(toastText(ok.container)).toBe("");
    expect(willBtn(ok.container)?.hasAttribute("data-will-saved")).toBe(true);
  });

  it("앞뒤 공백·겹친 공백은 서버가 정리한 값과 같으면 저장됨이다(실패로 오인하지 않는다)", () => {
    vi.useFakeTimers();
    const m = mount(makeView());
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "  두  칸 " } });
    fireEvent.click(saveBtn(m.container));
    m.show(makeView({ will: "두 칸" }));
    act(() => void vi.advanceTimersByTime(5000));
    expect(toastText(m.container)).toBe("");
    expect(willBtn(m.container)?.hasAttribute("data-will-saved")).toBe(true);
  });

  it("빈 칸으로 저장하면 {t:'will', text:''} 를 보내고 서버 me.will 이 없어지면 '저장됨'·점이 꺼진다. 확인을 묻지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ phase: "discussion", will: "지울 말" }), { send });
    expect(m.container.querySelector(".mv-chat__will-dot")).not.toBeNull();
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "" } });
    expect(saveBtn(m.container).textContent).toBe("저장");
    fireEvent.click(saveBtn(m.container));
    expect(sent(send).filter((x) => x.t === "will")).toEqual([{ t: "will", text: "" }]);
    expect(m.container.querySelector('[role="alertdialog"], [role="dialog"]:not(.mv-will)')).toBeNull();
    expect(sheet(m.container)).toBeNull();
    m.show(makeView({ phase: "discussion" }));
    expect(m.container.querySelector(".mv-chat__will-dot")).toBeNull();
    expect(willBtn(m.container)?.getAttribute("aria-label")).toBe("유언 쓰기");
  });

  it("시트가 열린 채 내가 죽은 view 가 오면 시트가 닫히고 깃펜이 없다. 단계가 로비로 가도 닫힌다", () => {
    const m = mount(makeView({ phase: "discussion" }));
    fireEvent.click(willBtn(m.container)!);
    expect(sheet(m.container)).not.toBeNull();
    m.show(makeView({ phase: "discussion", dead: [3] }));
    expect(sheet(m.container)).toBeNull();
    expect(m.container.querySelectorAll("[data-will-button]")).toHaveLength(0);
    cleanup();
    const n = mount(makeView({ phase: "discussion" }));
    fireEvent.click(willBtn(n.container)!);
    n.show(makeView({ phase: "lobby" }));
    expect(n.container.querySelector("[data-will-sheet]")).toBeNull();
  });
});

describe("유언은 저장하면 창이 닫힌다 (0083-6) — 낮·밤 (유언 단계의 처형자는 [남기기], 아래 22-11 묶음)", () => {
  const cases: Array<[string, ViewOpts]> = [
    ["낮 토론(깃펜)", { phase: "discussion" }],
    ["밤([유언] 단추)", { phase: "night" }],
  ];
  for (const [name, opts] of cases) {
    it(`${name}: [저장] → will 한 번 보내고 곧바로 창이 닫히며 초점이 연 단추로 돌아간다. 저장됨은 단추가 말한다. 쪽지 창은 그대로다`, () => {
      const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
      const m = mount(makeView(opts), { send });
      const btn = willBtn(m.container)!;
      fireEvent.click(btn);
      fireEvent.change(area(m.container), { target: { value: "마지막 말" } });
      fireEvent.click(saveBtn(m.container));
      expect(sent(send).filter((x) => x.t === "will")).toEqual([{ t: "will", text: "마지막 말" }]);
      expect(sheet(m.container)).toBeNull();
      expect(document.activeElement).toBe(willBtn(m.container));
      expect(typings(send)).toEqual([]);
      m.show(makeView({ ...opts, will: "마지막 말" }));
      expect(willBtn(m.container)?.getAttribute("aria-label")).toMatch(/저장됨$/);
      expect(sent(send).filter((x) => x.t === "will")).toHaveLength(1);
    });
  }

  it("마피아 쪽지 창은 [저장] 뒤에도 열려 있고 '저장됨'으로 남는다(0083-6 은 유언만)", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ mySeat: 0, nightSure: 2 }), { send });
    fireEvent.click(noteBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "조용히" } });
    fireEvent.click(saveBtn(m.container));
    expect(sheet(m.container, "note")).not.toBeNull();
    m.show(makeView({ mySeat: 0, nightSure: 2, note: "조용히" }));
    expect(sheet(m.container, "note")).not.toBeNull();
    expect(saveBtn(m.container).textContent).toBe("저장됨");
  });
});

describe("마피아 [쪽지] (NIGHT-12, E2 #18·#19)", () => {
  it("확정 전: [쪽지]는 불투명 비활성(aria-disabled)이고 숨은 설명만 달며 눌러도 시트가 없다", () => {
    const m = mount(makeView({ mySeat: 0 }));
    const note = noteBtn(m.container)!;
    expect(note.getAttribute("aria-disabled")).toBe("true");
    const desc = m.container.querySelector(`[id="${note.getAttribute("aria-describedby")}"]`);
    expect(desc?.textContent).toBe("암살 대상을 모두 같게 고르면 쓸 수 있어요");
    expect(desc?.classList.contains("mf-sr-only")).toBe(true);
    fireEvent.click(note);
    expect(sheet(m.container, "note")).toBeNull();
  });

  it("확정(me.nightSure)이면 눌러 쪽지 시트(진홍 테두리 계열 mv-will--mafia)가 열리고 {t:'note'} 로 저장, me.note 로 채운다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ mySeat: 0, nightSure: 2 }), { send });
    const note = noteBtn(m.container)!;
    expect(note.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(note);
    const s = sheet(m.container, "note")!;
    expect(s.classList.contains("mv-will--mafia")).toBe(true);
    expect(s.getAttribute("aria-label")).toBe("쪽지");
    expect(area(m.container).getAttribute("placeholder")).toBe("이름 없이 아침에 공개돼요");
    fireEvent.change(area(m.container), { target: { value: "조용히 끝냈다" } });
    fireEvent.click(saveBtn(m.container));
    expect(sent(send).filter((x) => x.t === "note")).toEqual([{ t: "note", text: "조용히 끝냈다" }]);
    m.show(makeView({ mySeat: 0, nightSure: 2, note: "조용히 끝냈다" }));
    expect(saveBtn(m.container).textContent).toBe("저장됨");
    expect(area(m.container).value).toBe("조용히 끝냈다");
  });

  it("글자 수 상한: 유언 시트는 50(유언 상한), 쪽지 시트는 채팅과 같은 100 그대로다(사용자 결정 2026-11-05)", () => {
    const w = mount(makeView());
    fireEvent.click(willBtn(w.container)!);
    fireEvent.change(area(w.container), { target: { value: "가".repeat(60) } });
    expect(area(w.container).value).toBe("가".repeat(50));
    expect(w.container.querySelector(".mv-will__count")?.textContent).toBe("50/50");
    cleanup();
    const m = mount(makeView({ mySeat: 0, nightSure: 2 }));
    fireEvent.click(noteBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "나".repeat(60) } });
    expect(area(m.container).value).toBe("나".repeat(60));
    expect(m.container.querySelector(".mv-will__count")?.textContent).toBe("60/100");
  });

  it("쪽지 시트가 열린 동안 확정이 풀리면 시트가 닫히고, 다시 확정되어 열면 쓰던 글이 이어진다", () => {
    const m = mount(makeView({ mySeat: 0, nightSure: 2 }));
    fireEvent.click(noteBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "쓰던 글" } });
    m.show(makeView({ mySeat: 0 }));
    expect(sheet(m.container, "note")).toBeNull();
    expect(noteBtn(m.container)?.getAttribute("aria-disabled")).toBe("true");
    m.show(makeView({ mySeat: 0, nightSure: 2 }));
    fireEvent.click(noteBtn(m.container)!);
    expect(area(m.container).value).toBe("쓰던 글");
  });

  it("마피아가 아닌 사람·낮에는 [쪽지]가 없다", () => {
    for (const v of [makeView({ mySeat: 3 }), makeView({ mySeat: 1 }), makeView({ mySeat: 0, phase: "discussion" }), makeView({ mySeat: 4, dead: [4] })]) {
      expect(noteBtn(mount(v).container)).toBeNull();
      cleanup();
    }
  });

  it("[쪽지]·[유언] 버튼 면에는 진홍·놋쇠 클래스가 없다 (UI-SPEC 다르게 하는 곳 2)", () => {
    const a = mount(makeView({ mySeat: 0, nightSure: 2 }));
    const note = noteBtn(a.container)!;
    expect(note.className).not.toMatch(/crimson|brass/);
    expect(note.querySelector("svg")?.getAttribute("class") ?? "").not.toMatch(/brass/);
    cleanup();
    const b = mount(makeView());
    expect(willBtn(b.container)?.className ?? "").not.toMatch(/crimson|brass/);
  });
});

describe("연결 끊김 (UI-SPEC 433행)", () => {
  it("canSend 거짓이면 [유언]·[쪽지]·깃펜이 aria-disabled 이고 눌러도 시트가 없고 보내지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    for (const v of [makeView(), makeView({ phase: "discussion" })]) {
      const m = mount(v, { send, canSend: false });
      const b = willBtn(m.container)!;
      expect(b.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(b);
      expect(sheet(m.container)).toBeNull();
      cleanup();
    }
    const n = mount(makeView({ mySeat: 0, nightSure: 2 }), { send, canSend: false });
    expect(noteBtn(n.container)?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(noteBtn(n.container)!);
    expect(sheet(n.container, "note")).toBeNull();
    expect(sent(send)).toEqual([]);
  });

  it("시트가 열린 채 끊기면 [저장]이 aria-disabled 이고 눌러도 보내지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView(), { send });
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "끊김" } });
    m.show(makeView(), { canSend: false });
    expect(saveBtn(m.container).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(saveBtn(m.container));
    expect(sent(send)).toEqual([]);
  });
});

// ---- Task 3: 키보드 배치 -----------------------------------------------------------------------------------

describe("키보드 배치 — 패널 숨김 · compact · 초점 복귀 (UI-SPEC 282·442행)", () => {
  const INNER_H = 800;
  const PANEL_H = 250;
  const SHEET_H = 226;
  interface FakeVV extends EventTarget {
    height: number;
    offsetTop: number;
  }
  const installVV = (height: number): FakeVV => {
    const vv = Object.assign(new EventTarget(), { height, offsetTop: 0 }) as FakeVV;
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
    return vv;
  };
  const frame = (): void => void act(() => void vi.advanceTimersByTime(20));
  const resize = (vv: FakeVV, height: number): void => {
    vv.height = height;
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
  };
  const roomOf = (c: HTMLElement): HTMLElement => (c.querySelector("main.mf-game")?.closest(".mf-room") ?? c.querySelector("main.mf-game")) as HTMLElement;
  const panelOf = (c: ParentNode): HTMLElement => c.querySelector(".mf-game__panel") as HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"] });
    Object.defineProperty(window, "innerHeight", { value: INNER_H, configurable: true, writable: true });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mf-game__panel")) return PANEL_H;
      if (this.classList.contains("mf-will-layer")) return SHEET_H;
      if (this.classList.contains("mf-game__header")) return 62;
      return 0;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "visualViewport");
  });

  it("시트 textarea 초점도 키보드 lift 를 읽는다: --mf-kb-lift 가 방 틀에 쓰이고, 닫으면 0 으로 돌아간다", () => {
    const vv = installVV(500);
    const m = mount(makeView());
    fireEvent.click(willBtn(m.container)!);
    frame();
    expect(roomOf(m.container).style.getPropertyValue("--mf-kb-lift")).toBe("300px");
    expect(vv.height).toBe(500);
    fireEvent.click(closeBtn(m.container));
    frame();
    expect(roomOf(m.container).style.getPropertyValue("--mf-kb-lift")).toBe("0px");
  });

  it("패널 + 시트 + 8 이 visualViewport 높이 − 62 를 넘으면 패널을 숨기고(data-will-hide-panel) 시트만 키보드 위에 붙는다", () => {
    const vv = installVV(500); // 250 + 226 + 8 = 484 > 500 − 62
    const m = mount(makeView());
    fireEvent.click(willBtn(m.container)!);
    frame();
    expect(panelOf(m.container).getAttribute("data-will-hide-panel")).toBe("true");
    expect(m.container.querySelector(".mf-will-layer")?.getAttribute("data-panel-hidden")).toBe("true");
    // 높이가 충분하면 패널이 다시 보인다
    resize(vv, 700); // 484 <= 700 − 62
    expect(panelOf(m.container).getAttribute("data-will-hide-panel")).toBeNull();
    expect(m.container.querySelector(".mf-will-layer")?.getAttribute("data-panel-hidden")).toBeNull();
    // 닫으면 숨김이 풀린 채 남지 않는다
    resize(vv, 500);
    expect(panelOf(m.container).getAttribute("data-will-hide-panel")).toBe("true");
    fireEvent.click(closeBtn(m.container));
    frame();
    expect(panelOf(m.container).getAttribute("data-will-hide-panel")).toBeNull();
  });

  it("키보드가 없어 넉넉하면(시트 없음 포함) 패널은 숨지 않는다", () => {
    installVV(INNER_H);
    const m = mount(makeView());
    expect(panelOf(m.container).getAttribute("data-will-hide-panel")).toBeNull();
    fireEvent.click(willBtn(m.container)!);
    frame();
    expect(panelOf(m.container).getAttribute("data-will-hide-panel")).toBeNull();
  });

  it("visualViewport 높이가 300 미만이면 시트 textarea 가 2줄(compact), 300 이상이면 3줄이다", () => {
    const vv = installVV(280);
    const m = mount(makeView());
    fireEvent.click(willBtn(m.container)!);
    frame();
    expect(Number(area(m.container).rows)).toBe(2);
    resize(vv, 300);
    expect(Number(area(m.container).rows)).toBe(3);
    resize(vv, 299);
    expect(Number(area(m.container).rows)).toBe(2);
  });

  it("시트 textarea 초점·입력·blur 가 채팅 입력 중 상태를 켜지 않는다: typing 0회, 입력 중 알약 없음", () => {
    installVV(500);
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ phase: "discussion" }), { send });
    fireEvent.click(willBtn(m.container)!);
    frame();
    fireEvent.change(area(m.container), { target: { value: "쓰는 중" } });
    frame();
    act(() => area(m.container).blur());
    act(() => void vi.advanceTimersByTime(5000));
    expect(typings(send)).toEqual([]);
    expect(m.container.querySelector("[data-typing], .mv-typing")).toBeNull();
  });

  it("채팅 패널은 시트가 열려 키보드가 올라와도 글을 줄이거나 행동 줄을 숨기지 않는다 — 시트를 연 [유언] 버튼이 남아 초점이 돌아온다", () => {
    installVV(500);
    const m = mount(makeView());
    const opener = willBtn(m.container)!;
    fireEvent.click(opener);
    frame();
    expect(willBtn(m.container)).toBe(opener); // 키보드가 열려도 행동 줄이 사라지지 않는다
    fireEvent.click(closeBtn(m.container));
    frame();
    expect(document.activeElement).toBe(opener);
  });
});


// ---- 22-11: 유언 단계(defense) — 처형자 시트 자동 열림·[남기기]·자동 저장, 나머지 조용히 지켜보기 (P22-6~9·P22-17, D-15·D-16·D-28) ----
const secs = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>(".mv-will__secs");
const defenseOf = (o: ViewOpts = {}): RoomView => makeView({ phase: "defense", mySeat: 3, candidate: 3, endsIn: 10_000, ...o });
const willMsgs = (send: Send): Array<Extract<ClientMessage, { t: "will" }>> => sent(send).filter((x): x is Extract<ClientMessage, { t: "will" }> => x.t === "will");
const clock = (): void => {
  vi.useFakeTimers({ now: NOW });
};

describe("유언 단계 — 처형자 화면 (22-11 P22-6~8)", () => {
  it("유언 단계가 시작되면 시트가 미리 써 둔 글로 자동으로 열려 아래 패널을 대신하고, 아래줄에 n/50 · 남은 초 · [남기기] 가 있다", () => {
    clock();
    const m = mount(defenseOf({ will: "미리 쓴 글" }));
    expect(sheet(m.container)).not.toBeNull();
    expect(area(m.container).value).toBe("미리 쓴 글");
    const foot = m.container.querySelector(".mv-will__foot")!;
    expect([...foot.children].map((e) => e.classList[0]).join(",")).toBe("mv-will__count,mv-will__secs,mv-will__save");
    expect(secs(m.container)?.textContent).toBe("10초");
    expect(secs(m.container)?.getAttribute("aria-hidden")).toBe("true");
    expect(saveBtn(m.container).textContent).toBe("남기기");
    expect(saveBtn(m.container).hasAttribute("data-will-save")).toBe(true);
    expect(saveBtn(m.container).getAttribute("aria-label")).toBe("유언 남기기");
    expect(m.container.querySelector(".mv-will__head")?.textContent).toContain("유언");
  });

  it("마지막 5초는 남은 초가 진홍(urgent) 톤이다", () => {
    clock();
    const m = mount(defenseOf({ endsIn: 4_200 }));
    expect(secs(m.container)?.textContent).toBe("5초");
    expect(secs(m.container)?.getAttribute("data-tone")).toBe("urgent");
  });

  it("[남기기] → {t:'will', text, final:true} 한 번, 곧바로 '남김' 비활성이고 3초가 지나도 보내지 못했다는 알림이 없다(서버 응답 대기 표시 없음)", () => {
    clock();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(defenseOf(), { send });
    fireEvent.change(area(m.container), { target: { value: "잘 있어" } });
    fireEvent.click(saveBtn(m.container));
    expect(willMsgs(send).filter((x) => x.final === true)).toEqual([{ t: "will", text: "잘 있어", final: true }]);
    expect(saveBtn(m.container).textContent).toBe("남김");
    expect(saveBtn(m.container).disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(toastText(m.container)).toBe("");
    expect(willMsgs(send).filter((x) => x.final === true)).toHaveLength(1);
  });

  it("[남기기]가 거절되면(WR-01) '남김' 이 풀려 [남기기] 가 다시 켜지고, 알림은 '보내지 못했어요' 한 번이며, 다시 보낼 수 있다", () => {
    clock();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { handlers, onEvent } = withHandlers();
    const m = mount(defenseOf(), { send, onEvent });
    fireEvent.change(area(m.container), { target: { value: "잘 있어" } });
    fireEvent.click(saveBtn(m.container));
    expect(saveBtn(m.container).disabled).toBe(true);
    emitError(handlers, "BAD_MESSAGE");
    expect(toastText(m.container)).toBe(FAIL);
    expect(saveBtn(m.container).textContent).toBe("남기기");
    expect(saveBtn(m.container).disabled).toBe(false);
    expect(sheet(m.container)).not.toBeNull();
    fireEvent.click(saveBtn(m.container));
    expect(willMsgs(send).filter((x) => x.final === true)).toEqual([
      { t: "will", text: "잘 있어", final: true },
      { t: "will", text: "잘 있어", final: true },
    ]);
    expect(saveBtn(m.container).disabled).toBe(true);
  });

  it("빈 글이어도 [남기기]를 누를 수 있다", () => {
    clock();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(defenseOf(), { send });
    expect(saveBtn(m.container).disabled).toBe(false);
    fireEvent.click(saveBtn(m.container));
    expect(willMsgs(send)).toEqual([{ t: "will", text: "", final: true }]);
  });

  it("연결이 끊기면 [남기기] 가 aria-disabled 이고 눌러도 보내지 않는다", () => {
    clock();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(defenseOf(), { send, canSend: false });
    expect(saveBtn(m.container).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(saveBtn(m.container));
    expect(willMsgs(send)).toEqual([]);
  });

  it("입력이 바뀌고 600ms 뒤에 자동 저장(final 없음) — 500ms 에는 아직 보내지 않는다", () => {
    clock();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(defenseOf(), { send });
    fireEvent.change(area(m.container), { target: { value: "새 글" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(willMsgs(send)).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(willMsgs(send)).toEqual([{ t: "will", text: "새 글" }]);
  });

  it("마감 약 700ms 전에 쓰던 글을 한 번 더 보낸다(같은 글은 다시 보내지 않는다)", () => {
    clock();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(defenseOf(), { send });
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    fireEvent.change(area(m.container), { target: { value: "막판 글" } }); // 디바운스(600ms)는 9600 — 마감 직전 전송(9300)이 먼저다
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(willMsgs(send)).toEqual([{ t: "will", text: "막판 글" }]);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(willMsgs(send)).toHaveLength(1);
  });

  it("마감 직전 자동 저장이 마감을 넘겨 거절돼도(WR-02) 알림·되돌림 없이 조용하다 — 시트와 쓰던 글이 그대로이고, 조용한 구간이 지나면 다른 거절은 다시 알린다", () => {
    clock();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { handlers, onEvent } = withHandlers();
    const m = mount(defenseOf(), { send, onEvent });
    fireEvent.change(area(m.container), { target: { value: "막판 글" } });
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(willMsgs(send)).toEqual([{ t: "will", text: "막판 글" }]);
    emitError(handlers, "WRONG_PHASE");
    expect(toastText(m.container)).toBe("");
    expect(sheet(m.container)).not.toBeNull();
    expect(area(m.container).value).toBe("막판 글");
    // 단계가 처형으로 넘어간 뒤 닿은 거절도 알림이 없다
    m.show({ ...defenseOf(), phase: "execution" });
    emitError(handlers, "BAD_MESSAGE");
    expect(toastText(m.container)).toBe("");
    // 조용한 구간(WILL_QUIET_MS)이 지나면 일반 거절 알림은 그대로다
    m.show(makeView({ phase: "discussion", mySeat: 3 }));
    act(() => {
      vi.advanceTimersByTime(WILL_QUIET_MS + 100);
    });
    emitError(handlers, "WRONG_PHASE");
    expect(toastText(m.container)).toBe("지금은 고를 수 없어요");
  });

  it("[닫기]는 글을 저장하고 시트만 접는다 — 다시 열리지 않고 [유언] 단추가 빛난다(P22-17)", () => {
    clock();
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(defenseOf(), { send });
    fireEvent.change(area(m.container), { target: { value: "안녕" } });
    fireEvent.click(closeBtn(m.container));
    expect(willMsgs(send)).toEqual([{ t: "will", text: "안녕" }]);
    expect(sheet(m.container)).toBeNull();
    m.show(defenseOf({ will: "안녕" }));
    expect(sheet(m.container)).toBeNull();
    const pen = willBtn(m.container)!;
    expect(pen).not.toBeNull();
    expect(pen.hasAttribute("data-call")).toBe(true);
    fireEvent.click(pen);
    expect(sheet(m.container)).not.toBeNull();
    expect(area(m.container).value).toBe("안녕");
  });
});

describe("유언 단계 — 나머지 사람 화면 (22-11 P22-9, D-16)", () => {
  const lockedOk = (c: ParentNode): void => {
    expect(c.querySelector("[data-will-sheet]")).toBeNull();
    expect(c.querySelector("[data-chat-locked]")).not.toBeNull();
    const input = c.querySelector<HTMLInputElement>("[data-chat-input]")!;
    expect(input.getAttribute("aria-disabled")).toBe("true");
    expect(input.disabled).toBe(true);
    expect(input.getAttribute("placeholder")).toBeNull();
    expect(c.querySelectorAll("[data-chat-send], [data-will-button], [data-emote-button]")).toHaveLength(0);
  };

  it("처형자가 아닌 산 사람: 시트 없음, 입력줄만 잠김(안내 글자·[보내기]·[유언]·깃펜 없음), 기록 칸 높이는 채팅 패널 그대로", () => {
    clock();
    const normal = mount(makeView({ phase: "discussion", mySeat: 3 }));
    const normalLog = normal.container.querySelector<HTMLElement>("[data-chat-log]")!.style.height;
    cleanup();
    const m = mount(defenseOf({ mySeat: 3, candidate: 5 }));
    lockedOk(m.container);
    expect(m.container.querySelector<HTMLElement>("[data-chat-log]")!.style.height).toBe(normalLog);
  });

  it("유령: 시트·[유언]·깃펜 없고 입력줄이 잠긴다", () => {
    clock();
    const m = mount(defenseOf({ mySeat: 4, dead: [4], candidate: 5 }));
    lockedOk(m.container);
  });
});
