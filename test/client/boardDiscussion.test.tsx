import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { lockCause, openCause } from "../helpers/playable";
import type { RoleId } from "../../shared/game/roles";
import type { ClueLine, MorningView, OutfitId, PhaseId, PublicPlayer, RecordLine, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 21-11 토론 연결(D-18·D-19·P21-14·P21-15, LH7): 원인 흐름 토론은 의심 보드가 열린 채 시작하고 헤더 [보드] 가 [기록] 자리를 이어받는다.
// 기본판·옛 확장판은 지금 그대로([기록]·RecordCard). 방 화면(RoomScreen)을 거쳐 GameMap 을 그리고 3D 무대만 가짜로 둔다(recordTrace.test 와 같은 틀).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return { WorldStage: () => createElement("div", { "data-world-stage-fake": "" }) };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");

let restore: () => void = () => {};
beforeAll(() => {
  restore = openCause();
});
afterAll(() => restore());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NOW = 1_700_000_000_000;
const NAMES = ["민수", "영희", "서준", "지아", "도윤"];
const LOOKS: OutfitId[] = ["coat", "mafia", "doctor", "mafia", "police"];
const LAMPS = [true, false, true, true, false, false, true, false];
const REC: RecordLine[] = [
  { seat: 1, place: "glass" },
  { seat: 2, place: "piano" },
];
const SCENE: ClueLine[] = [
  { spot: "footprint", r: "clue", n: 2 },
  { spot: "cloth", r: "clue", piece: "blackCloth" },
];

interface Opts {
  phase?: PhaseId;
  mode?: "basic" | "extended";
  role?: RoleId;
  record?: RecordLine[] | null;
  scene?: ClueLine[];
  morning?: MorningView;
  endsInMs?: number;
}

function makeView(o: Opts = {}): RoomView {
  const phase = o.phase ?? "discussion";
  const players: PublicPlayer[] = NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, look: LOOKS[seat]! }));
  const record = o.record === undefined ? REC : o.record;
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (o.endsInMs ?? 60_000),
    phaseDurationMs: 90_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    map: "town",
    mode: o.mode ?? "extended",
    me: { seat: 0, isHost: true, chat: "all", role: o.role ?? "citizen", ...(record === null ? {} : { record }), scene: o.scene ?? SCENE },
    day: {
      n: 1,
      roles: [],
      lamps: LAMPS,
      ...(o.morning !== undefined ? { morning: o.morning, evidence: { ...(o.morning.trace !== undefined ? { trace: o.morning.trace } : {}) } } : {}),
    },
  } as unknown as RoomView;
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
    show: (v: RoomView) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch });
      r.rerender(ui());
    },
  };
};

const board = (c: ParentNode): HTMLElement | null => c.querySelector("[data-board]");
const boardButton = (c: ParentNode): HTMLButtonElement | null => c.querySelector("button[aria-label='보드']");
const recordButton = (c: ParentNode): HTMLButtonElement | null => c.querySelector("button[aria-label='기록']");
const band = (c: ParentNode): string => c.querySelector("[data-host-line]")?.textContent ?? "";

describe("원인 흐름 토론 — 열린 채 시작하는 의심 보드 (P21-14)", () => {
  it("첫 렌더에서 보드가 열려 있고 헤더 [보드](aria-expanded true)가 있으며 [기록]·RecordCard·증거 카드는 없다", () => {
    const { container } = mount(makeView());
    expect(board(container)).not.toBeNull();
    expect(boardButton(container)?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll("button[aria-label='보드']")).toHaveLength(1);
    expect(recordButton(container)).toBeNull();
    expect(container.querySelector("[data-record-card]")).toBeNull();
    expect(container.querySelector("[data-trace-card]")).toBeNull();
    expect(band(container)).toBe("단서를 말로 나눠 보세요");
  });

  it("[보드] 는 빛나지 않는다(빛남 계약) — data-call 이 없다", () => {
    const { container } = mount(makeView());
    expect(boardButton(container)?.hasAttribute("data-call")).toBe(false);
    expect(container.querySelectorAll("[data-call]").length).toBeLessThanOrEqual(1);
    expect(container.querySelector("[data-board]")?.hasAttribute("data-call")).toBe(false);
  });

  it("[보드] 는 [내 역할] 왼쪽(DOM 에서 앞)에 있다", () => {
    const { container } = mount(makeView());
    const header = container.querySelector(".mf-game__header") as HTMLElement;
    const order = [...header.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? "");
    const role = order.findIndex((n) => n.startsWith("내 역할"));
    expect(order.indexOf("보드")).toBeGreaterThanOrEqual(0);
    if (role >= 0) expect(order.indexOf("보드")).toBeLessThan(role);
  });

  it("입력칸에 포커스가 가면 접히고, [보드] 로 다시 열리며, [닫기] 로 접힌다", () => {
    const { container } = mount(makeView());
    const input = container.querySelector("input[data-chat-input]") as HTMLInputElement;
    act(() => input.focus());
    expect(board(container)).toBeNull();
    expect(boardButton(container)?.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(boardButton(container)!);
    expect(board(container)).not.toBeNull();
    expect(boardButton(container)?.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(container.querySelector("[data-board] button[aria-label='닫기']")!);
    expect(board(container)).toBeNull();
    fireEvent.click(boardButton(container)!);
    expect(board(container)).not.toBeNull();
    fireEvent.click(boardButton(container)!);
    expect(board(container)).toBeNull();
  });

  it("보드 안: 칩은 내 me.scene 만(둘), 등불 꺼진 수 4, 얼굴은 산 사람 다섯, 닮은 옷(검은 천) 얼굴에 cloth 표시, 목격 칸 줄 수 2", () => {
    const { container } = mount(makeView());
    expect(container.querySelectorAll("[data-board-chip]")).toHaveLength(2);
    expect(container.querySelector("[data-board-lamps]")?.getAttribute("data-board-lamps")).toBe("4");
    expect([...container.querySelectorAll("[data-board-face]")].map((f) => f.getAttribute("data-board-face")).join(",")).toBe("0,1,2,3,4");
    expect([...container.querySelectorAll("[data-board-face][data-mark]")].map((f) => f.getAttribute("data-board-face")).join(",")).toBe("1,3");
    expect(container.querySelector("[data-board-witness]")?.textContent).toBe("2");
  });

  it("기록이 없는 사람도 보드는 있고(칩·등불·얼굴) 목격 칸만 없다", () => {
    const { container } = mount(makeView({ record: null }));
    expect(board(container)).not.toBeNull();
    expect(container.querySelector("[data-board-witness]")).toBeNull();
    expect(container.querySelectorAll("[data-board-face]")).toHaveLength(5);
  });

  it("토론을 벗어나면(지목) 보드·[보드] 가 DOM 에 없다. 다시 토론이 오면 열린 채 시작한다", () => {
    const { container, show } = mount(makeView());
    fireEvent.click(boardButton(container)!);
    expect(board(container)).toBeNull();
    show(makeView({ phase: "nomination" }));
    expect(board(container)).toBeNull();
    expect(boardButton(container)).toBeNull();
    show(makeView({ phase: "discussion" }));
    expect(board(container)).not.toBeNull();
  });

  it("마피아·시민 view(me.role 만 다름)의 보드 마크업이 같다", () => {
    const html = (role: RoleId): string => {
      const { container } = mount(makeView({ role }));
      const out = board(container)?.outerHTML ?? "";
      cleanup();
      return out;
    };
    const base = html("citizen");
    expect(base.length).toBeGreaterThan(100);
    for (const role of ["mafia", "police", "doctor"] as RoleId[]) expect(html(role)).toBe(base);
  });

  it("아침의 공개 흔적 카드(EvidenceCard)는 원인 흐름에서 그리지 않는다", () => {
    const { container } = mount(makeView({ phase: "morning", morning: { eliminated: 2, trace: "pencil" }, endsInMs: 2000 }));
    expect(container.querySelector("[data-trace-card]")).toBeNull();
  });
});

describe("기본판·옛 확장판 토론은 지금 그대로", () => {
  it("기본판: [기록]·RecordCard 이고 보드·[보드] 가 없다", () => {
    const { container } = mount(makeView({ mode: "basic" }));
    expect(recordButton(container)).not.toBeNull();
    expect(boardButton(container)).toBeNull();
    expect(board(container)).toBeNull();
    expect(container.querySelector("[data-record-card]")).toBeNull();
    fireEvent.click(recordButton(container)!);
    expect(container.querySelector("[data-record-card]")).not.toBeNull();
    expect(board(container)).toBeNull();
  });

  it("옛 확장판(원인 흐름이 닫힌 판)도 [기록] 이고 보드가 없다", () => {
    // 꺼진 옛 확장판 경로 — 원인 흐름을 잠근 확장판(21-14 B): 이 시험 동안만 잠근다.
    const restoreLock = lockCause();
    try {
      const { container } = mount(makeView({ mode: "extended" }));
      expect(recordButton(container)).not.toBeNull();
      expect(boardButton(container)).toBeNull();
      expect(board(container)).toBeNull();
    } finally {
      restoreLock();
    }
  });
});
