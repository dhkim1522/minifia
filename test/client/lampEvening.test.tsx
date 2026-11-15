import { act, cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import { CAUSE_MODES } from "../../shared/game/ruleset";
import type { PlaceId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { openCause } from "../helpers/playable";

// 21-08 Task 3: 원인 흐름 저녁 화면(D-06·D-24, P21-6·P21-7) — 안 켠 배정 등불 전부 빛남(callPlaces)·반경 안 [켜기](actLook)·길게 누르기 hold 전송·역할마다 같은 DOM.
// WorldStage 는 받은 props 만 쥐는 가짜(errandScreen.test 와 같은 틀) — 표지 DOM(깜빡임·접근성 이름)은 worldStage.test 의 errand 층 시험이 진짜 런타임으로 본다.
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
  vi.useRealTimers();
});

const NOW = 1_700_000_000_000;
// 마을 가로등(월드 단위): lamp0(-2.25, -3.75) · lamp3(3.75, 2.25) · lamp6(-3.75, 2.25)
const LAMPS: PlaceId[] = ["lamp0", "lamp3", "lamp6"];
const AT_LAMP0 = { x: -2.25, z: -3.75 };
const FAR = { x: 0, z: 0 }; // 세 등불 모두 1.2 보다 멀다

interface Opts {
  done?: PlaceId[];
  role?: RoleId;
  mode?: "basic" | "extended";
  bar?: boolean;
}

function makeView(o: Opts = {}): RoomView {
  const players: PublicPlayer[] = [0, 1, 2, 3].map((seat) => ({ seat, nickname: ["민수", "영희", "서준", "지아"][seat]!, connected: true, isHost: seat === 0 }));
  return {
    code: "0042",
    phase: "errand",
    phaseEndsAt: NOW + 40_000,
    phaseDurationMs: 40_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    map: o.bar === true ? "bar" : "town",
    mode: o.mode ?? "extended",
    players,
    me: { seat: 0, isHost: true, chat: "all", ...(o.role !== undefined ? { role: o.role } : {}), errand: { places: o.bar === true ? ["glass", "piano", "sax"] : [...LAMPS], done: [...(o.done ?? [])] } },
    day: { n: 1, roles: [] },
  } as unknown as RoomView;
}

function conn(view: RoomView, send: RoomConnection["send"]): RoomConnection {
  return { status: "open", banner: "hidden", view, offset: 0, epoch: 1, removedReason: null, canSend: true, send, onEvent: vi.fn(() => () => {}), reconnect: vi.fn(), retry: vi.fn() } as unknown as RoomConnection;
}

function mount(view: RoomView, send: RoomConnection["send"] = vi.fn(() => true)) {
  connectionMock.current = conn(view, send);
  const r = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />);
  return { ...r, send };
}

/** 내(좌석 0) 위치를 월드 단위로 서 있게 한다(서버 snap) */
function standAt(p: { x: number; z: number }): void {
  act(() => {
    stage.props!.store.applyFrame({ t: "world", k: "snap", at: Date.now(), ents: [{ s: 0, p: [Math.round(p.x * 100), Math.round(p.z * 100)], t0: Date.now() - 1000, v: 180 }], near: true }, 1);
  });
}

const errand = () => stage.props!.errand!;

describe("저녁 등불 화면: 빛남 (P21-6)", () => {
  it("반경 밖: 안 켠 배정 등불 전부가 빛나고(callPlaces), [켜기](actId)는 없고, 다음 장소 하나 빛남(callPlace)은 꺼진다", () => {
    mount(makeView({ done: ["lamp3"] }));
    standAt(FAR);
    expect(errand().places.map((p) => `${p.id}:${p.done}`).join(",")).toBe("lamp0:false,lamp3:true,lamp6:false");
    expect(errand().callPlaces?.join(",")).toBe("lamp0,lamp6");
    expect(errand().callPlace).toBe(false);
    expect(errand().actId).toBeNull();
  });

  it("처음(아무것도 안 켬)에는 배정 셋 모두 빛난다 — 배정이 3보다 적으면 그만큼만 표지가 있다", () => {
    mount(makeView());
    standAt(FAR);
    expect(errand().callPlaces?.join(",")).toBe("lamp0,lamp3,lamp6");
    cleanup();
    const v = makeView();
    (v.me.errand as { places: PlaceId[] }).places = ["lamp3", "lamp6"];
    mount(v);
    standAt(FAR);
    expect(errand().places.map((p) => p.id).join(",")).toBe("lamp3,lamp6");
    expect(errand().callPlaces?.join(",")).toBe("lamp3,lamp6");
  });

  it("반경 안: [켜기](actId lamp0)가 서고 표지 깜빡임(callPlaces)은 꺼진다 — 한 화면에 깜빡이는 종류는 하나", () => {
    mount(makeView());
    standAt(AT_LAMP0);
    expect(errand().actId).toBe("lamp0");
    expect(errand().callPlaces ?? []).toEqual([]);
    expect(errand().callPlace).toBe(false);
  });

  it("[켜기] 라벨·아이콘·접근성 동사: 원인 흐름은 켜기·flame·켜기, 3곳을 다 켜면 빛이 없다", () => {
    mount(makeView());
    expect(errand().actLook).toEqual({ label: "켜기", icon: "flame", verb: "켜기" });
    cleanup();
    mount(makeView({ done: [...LAMPS] }));
    standAt(AT_LAMP0);
    expect(errand().callPlaces ?? []).toEqual([]);
    expect(errand().actId).toBeNull();
  });

  it("옛 확장판(원인 흐름 꺼짐·재즈 바)은 지금처럼 다음 장소 하나만 빛나고 [처리] 라벨이다", () => {
    const off = openCauseOff();
    try {
      mount(makeView({ bar: true }));
      standAt({ x: -3.9, z: -2.2 });
      expect(errand().actId).toBe("glass");
      cleanup();
      mount(makeView({ bar: true }));
      standAt({ x: 5.2, z: 5.0 });
      expect(errand().callPlace).toBe(true);
      expect(errand().callPlaces).toBeUndefined();
      expect(errand().actLook).toBeUndefined();
    } finally {
      off();
    }
  });
});

describe("저녁 등불 화면: [켜기] 전송 (D-06, P21-7)", () => {
  it("짧게 누르면 { t: 'errand' }, 0.6초 길게 누르면 { t: 'errand', hold: true } 한 번씩", () => {
    const { send } = mount(makeView());
    standAt(AT_LAMP0);
    act(() => errand().onAct?.(false));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ t: "errand" });
    act(() => errand().onAct?.(true));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ t: "errand", hold: true });
  });

  it("반경 밖에서는 짧게도 길게도 보내지 않는다", () => {
    const { send } = mount(makeView());
    standAt(FAR);
    act(() => errand().onAct?.(true));
    act(() => errand().onAct?.(false));
    expect(send).not.toHaveBeenCalled();
  });

  it("옛 확장판에서는 길게 눌러도 지금 메시지({ t: 'errand' })만 간다", () => {
    const off = openCauseOff();
    try {
      const { send } = mount(makeView({ bar: true }));
      standAt({ x: -3.9, z: -2.2 });
      act(() => errand().onAct?.(true));
      expect(send).toHaveBeenLastCalledWith({ t: "errand" });
    } finally {
      off();
    }
  });
});

describe("저녁 등불 화면: 역할마다 같은 DOM (T-21-28)", () => {
  it("me.role 만 mafia·police·doctor·citizen 으로 바꾼 렌더: 저녁 화면 마크업·data-* 이름·errand prop 이 같다(역할 카드 시트를 열지 않은 상태)", () => {
    const outs: { html: string; names: string; prop: string }[] = [];
    for (const role of ["mafia", "police", "doctor", "citizen"] as const) {
      for (const at of [FAR, AT_LAMP0]) {
        const { container, unmount } = mount(makeView({ role, done: ["lamp3"] }));
        standAt(at);
        const names = new Set<string>();
        for (const el of container.querySelectorAll("*")) for (const a of el.getAttributeNames()) if (a.startsWith("data-") || a.startsWith("aria-")) names.add(`${el.tagName}.${a}`);
        outs.push({ html: container.innerHTML, names: [...names].sort().join(","), prop: JSON.stringify({ ...errand(), onWalk: undefined, onAct: undefined }) });
        unmount();
      }
    }
    for (let i = 2; i < outs.length; i += 2) {
      expect(outs[i]!.html, `far ${i}`).toBe(outs[0]!.html);
      expect(outs[i]!.names, `far names ${i}`).toBe(outs[0]!.names);
      expect(outs[i]!.prop, `far prop ${i}`).toBe(outs[0]!.prop);
      expect(outs[i + 1]!.html, `near ${i}`).toBe(outs[1]!.html);
      expect(outs[i + 1]!.prop, `near prop ${i}`).toBe(outs[1]!.prop);
    }
  });
});

/** 시험 동안 원인 흐름을 다시 끈다(openCause 위에서 옛 확장판 화면을 대조) */
function openCauseOff(): () => void {
  const list = CAUSE_MODES as string[];
  const saved = [...list];
  list.splice(0, list.length, ...saved.filter((m) => m !== "extended"));
  return () => list.splice(0, list.length, ...saved);
}
