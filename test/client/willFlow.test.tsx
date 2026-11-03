import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
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
  const chat = meDead ? "ghost" : phase === "night" ? (role === "mafia" ? "mafia" : undefined) : "all";
  const view = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
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
    day: { n: 1, roles: [] },
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

  it("쓰고 [저장] → {t:'will', text} 한 번, 서버 me.will 이 오기 전에는 '저장', 온 뒤에는 '저장됨'", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView(), { send });
    fireEvent.click(willBtn(m.container)!);
    fireEvent.change(area(m.container), { target: { value: "범인은 2번" } });
    fireEvent.click(saveBtn(m.container));
    expect(sent(send).filter((x) => x.t === "will")).toEqual([{ t: "will", text: "범인은 2번" }]);
    expect(saveBtn(m.container).textContent).toBe("저장");
    m.show(makeView({ will: "범인은 2번" }));
    expect(sheet(m.container)).not.toBeNull();
    expect(saveBtn(m.container).textContent).toBe("저장됨");
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
    fireEvent.click(saveBtn(m.container));
    fireEvent.blur(area(m.container));
    fireEvent.click(closeBtn(m.container));
    expect(typings(send)).toEqual([]);
    expect(sent(send).every((x) => x.t === "will")).toBe(true);
  });
});
