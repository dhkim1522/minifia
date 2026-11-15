import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PlaceId, PublicPlayer, RoomView } from "../../shared/protocol";
import { SkipPill } from "../../src/components/v2/SkipPill";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { GamePanel } from "../../src/screens/GamePanel";
import { openCause } from "../helpers/playable";

// 21-10 [건너뛰기](D-23, UI-SPEC P21-13): 저녁·아침의 산 사람에게만, 누른 수 n/N 만 보이고(누가 눌렀는지는 없다) 한 번 더 누르면 취소다. 유령·토론·기본판에는 없다.
// SkipPill 은 순수 표시, GamePanel(아침 채팅 패널 입력줄 오른쪽 끝)과 GameMap(저녁 진행 점 옆)이 연결한다. WorldStage 는 받은 props 만 쥐는 가짜.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      return createElement("div", { "data-world-stage-fake": "" });
    },
  };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");

let restore: () => void = () => {};
beforeAll(() => {
  restore = openCause();
});
afterAll(() => restore());
afterEach(() => {
  cleanup();
  stage.props = null;
});

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const NOW = 1_700_000_000_000;
const LAMPS: PlaceId[] = ["lamp0", "lamp3", "lamp6"];

describe("SkipPill — 순수 표시", () => {
  it("눌리지 않음: 아이콘 + '건너뛰기', aria-pressed false, data-skip·data-skip-count 'n/N', 접근성 이름에 수", () => {
    const { container } = render(<SkipPill count={2} total={5} pressed={false} onToggle={() => {}} />);
    const el = container.querySelector<HTMLElement>("[data-skip]")!;
    expect(el.tagName).toBe("BUTTON");
    expect(el.textContent).toBe("건너뛰기");
    expect(el.getAttribute("aria-pressed")).toBe("false");
    expect(el.getAttribute("data-skip-count")).toBe("2/5");
    expect(el.getAttribute("aria-label")).toBe("건너뛰기, 누른 사람 2명 중 5명");
  });

  it("눌림: check + 'n/N' 글, aria-pressed true", () => {
    const { container } = render(<SkipPill count={2} total={5} pressed onToggle={() => {}} />);
    const el = container.querySelector<HTMLElement>("[data-skip]")!;
    expect(el.textContent).toBe("2/5");
    expect(el.getAttribute("aria-pressed")).toBe("true");
    expect(el.getAttribute("data-skip-count")).toBe("2/5");
    expect(el.querySelector(".mv-skip__count")).not.toBeNull();
  });

  it("누르면 onToggle(!pressed): 안 눌렀으면 true, 눌렀으면 false", () => {
    const onToggle = vi.fn();
    const a = render(<SkipPill count={0} total={4} pressed={false} onToggle={onToggle} />);
    fireEvent.click(a.container.querySelector("[data-skip]")!);
    expect(onToggle).toHaveBeenLastCalledWith(true);
    a.unmount();
    const b = render(<SkipPill count={1} total={4} pressed onToggle={onToggle} />);
    fireEvent.click(b.container.querySelector("[data-skip]")!);
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it("disabled 면 aria-disabled 이고 눌러도 부르지 않는다", () => {
    const onToggle = vi.fn();
    const { container } = render(<SkipPill count={0} total={4} pressed={false} onToggle={onToggle} disabled />);
    const el = container.querySelector<HTMLElement>("[data-skip]")!;
    expect(el.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(el);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("v2.css: 폭 104·높이 48·테두리 1 gray-300·투명 면(금빛 아님)·토큰 변수만", () => {
    const at = V2_CSS.indexOf(".mv-skip");
    expect(at).toBeGreaterThan(0);
    const css = V2_CSS.slice(at);
    expect(css).toMatch(/\.mv-skip\s*\{[^}]*width: 104px[^}]*height: 48px/);
    expect(css).toMatch(/\.mv-skip\s*\{[^}]*border: 1px solid var\(--gray-300\)[^}]*background: transparent/);
    const rule = css.slice(0, css.indexOf("}") + 1);
    expect(rule).not.toMatch(/light-lamp|brass|crimson/);
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/)).toBeNull();
  });
});

interface Opts {
  phase?: PhaseId;
  mode?: "basic" | "extended";
  role?: RoleId;
  dead?: boolean;
  skip?: boolean;
  skipCount?: number;
  house?: number;
}

function makeView(o: Opts = {}): RoomView {
  const players: PublicPlayer[] = [0, 1, 2, 3, 4].map((seat) => ({ seat, nickname: `닉${seat}`, connected: true, isHost: seat === 0, ...(o.dead === true && seat === 0 ? { alive: false } : {}), ...(seat === 4 ? { alive: false } : {}) }));
  const phase = o.phase ?? "morning";
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    map: "town",
    mode: o.mode ?? "extended",
    players,
    me: {
      seat: 0,
      isHost: true,
      chat: o.dead === true ? "ghost" : "all",
      ...(o.role !== undefined ? { role: o.role } : {}),
      ...(o.skip === true ? { skip: true } : {}),
      ...(phase === "errand" ? { errand: { places: [...LAMPS], done: [] } } : {}),
    },
    day: { n: 1, roles: [], ...(phase === "morning" ? { scene: { house: o.house ?? 3 } } : {}), ...(o.skipCount === undefined ? {} : { skipCount: o.skipCount }) },
    ...(o.dead === true ? { spectate: { seats: players.map((p) => ({ seat: p.seat, job: "citizen" as RoleId })) } } : {}),
  } as unknown as RoomView;
}

const BINDING = { messages: [], value: "", onChange: () => {}, onSend: () => {}, channel: "all" as const };

function panel(view: RoomView, send: (m: ClientMessage) => boolean = vi.fn(() => true)) {
  return { send, ...render(<GamePanel view={view} send={send} canSend binding={BINDING} logHeight={68} />) };
}
const skips = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-skip]")];

describe("GamePanel — 저녁·아침 [건너뛰기] 배치와 전송", () => {
  it("원인 흐름 아침의 산 사람: data-skip 한 개가 입력줄 오른쪽 끝(data-chat-trailing 안)에 있다", () => {
    const { container } = panel(makeView({ skipCount: 2 }));
    expect(skips(container)).toHaveLength(1);
    expect(skips(container)[0]!.closest("[data-chat-trailing]")).not.toBeNull();
    // 산 사람은 5명 중 탈락 1명 = 4명, 누른 수 2
    expect(skips(container)[0]!.getAttribute("data-skip-count")).toBe("2/4");
  });

  it("원인 흐름 저녁(errand)의 산 사람도 한 개", () => {
    const { container } = panel(makeView({ phase: "errand" }));
    expect(skips(container)).toHaveLength(1);
  });

  it("누르면 send { t: 'skip', on: true }, me.skip 이 있으면(눌린 상태) 다시 누를 때 { t: 'skip', on: false }", () => {
    const a = panel(makeView());
    fireEvent.click(skips(a.container)[0]!);
    expect(a.send).toHaveBeenCalledWith({ t: "skip", on: true });
    a.unmount();
    const b = panel(makeView({ skip: true, skipCount: 1 }));
    expect(skips(b.container)[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(skips(b.container)[0]!.textContent).toBe("1/4");
    fireEvent.click(skips(b.container)[0]!);
    expect(b.send).toHaveBeenCalledWith({ t: "skip", on: false });
  });

  it("누른 즉시 눌린 모양이 되고(낙관) 서버 view 가 오면 서버 값이 이긴다", () => {
    const send = vi.fn(() => true);
    const v0 = makeView({ skipCount: 0 });
    const { container, rerender } = render(<GamePanel view={v0} send={send} canSend binding={BINDING} logHeight={68} />);
    fireEvent.click(skips(container)[0]!);
    expect(skips(container)[0]!.getAttribute("aria-pressed")).toBe("true");
    rerender(<GamePanel view={makeView({ skipCount: 0 })} send={send} canSend binding={BINDING} logHeight={68} />);
    expect(skips(container)[0]!.getAttribute("aria-pressed")).toBe("false");
  });

  it("유령·토론·기본판 view 에는 data-skip 이 없다", () => {
    expect(skips(panel(makeView({ dead: true })).container)).toHaveLength(0);
    cleanup();
    expect(skips(panel(makeView({ phase: "discussion" })).container)).toHaveLength(0);
    cleanup();
    expect(skips(panel(makeView({ mode: "basic" })).container)).toHaveLength(0);
  });

  it("마피아·경찰·의사·시민 view 의 [건너뛰기] 마크업이 같다", () => {
    const base = skips(panel(makeView({ skipCount: 1 })).container)[0]!.outerHTML;
    cleanup();
    for (const role of ["mafia", "police", "doctor", "citizen"] as const) {
      expect(skips(panel(makeView({ role, skipCount: 1 })).container)[0]!.outerHTML).toBe(base);
      cleanup();
    }
  });
});

describe("GameMap 저녁 — 진행 점 옆 [건너뛰기]", () => {
  const mount = (view: RoomView, send: RoomConnection["send"] = vi.fn(() => true)) => {
    connectionMock.current = { status: "open", banner: "hidden", view, offset: 0, epoch: 1, removedReason: null, canSend: true, send, onEvent: vi.fn(() => () => {}), reconnect: vi.fn(), retry: vi.fn() } as unknown as RoomConnection;
    return { send, ...render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />) };
  };

  it("저녁 화면(아래 패널 없음)에도 data-skip 한 개, 누르면 skip 을 보낸다 — 눌린 뒤 다시 누르면 취소", () => {
    const { container, send } = mount(makeView({ phase: "errand", skipCount: 1 }));
    expect(skips(container)).toHaveLength(1);
    act(() => {
      fireEvent.click(skips(container)[0]!);
    });
    expect(send).toHaveBeenCalledWith({ t: "skip", on: true });
  });

  it("저녁이라도 유령이거나 기본판이면 없다", () => {
    expect(skips(mount(makeView({ phase: "errand", dead: true })).container)).toHaveLength(0);
    cleanup();
    expect(skips(mount(makeView({ phase: "errand", mode: "basic" })).container)).toHaveLength(0);
  });
});
