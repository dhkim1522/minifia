import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { openCause } from "../helpers/playable";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, GameMode, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { headerFor } from "../../src/game/dayView";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 21-09 밤 집 찾기 화면(D-10·D-11·D-25, UI-SPEC C): 확장판(원인 흐름) 밤에 모든 역할이 같은 개관 화면에서 집 문패를 눌러 pick { target } 을 보낸다.
// RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜를 쓴다(문패는 WorldStage 가 그리는 DOM). 런타임(three)만 가짜로 바꿔 장면 표를 읽는다 — nightMap.test 와 같은 방식.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

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
        surprise: () => {},
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
const LAMPS = [true, false, true, true, false, false, true, false];
const ROLES: RoleId[] = ["mafia", "police", "doctor", "citizen"];

const player = (seat: number, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({ seat, nickname: NAMES[seat] ?? `p${seat}`, connected: true, isHost: seat === 0, ...extra });

interface Opts {
  phase?: PhaseId;
  mode?: GameMode;
  role?: RoleId;
  mySeat?: number;
  /** 산 사람 수(앞 좌석부터) */
  count?: number;
  dead?: number[];
  pick?: number;
}

function makeView(o: Opts = {}): RoomView {
  const count = o.count ?? 5;
  const dead = new Set(o.dead ?? []);
  const mySeat = o.mySeat ?? 0;
  const meDead = dead.has(mySeat);
  const role = o.role ?? "citizen";
  const players = Array.from({ length: count }, (_, seat) => player(seat, dead.has(seat) ? { alive: false } : {}));
  const view = {
    code: "0042",
    phase: o.phase ?? "night",
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    map: "town",
    mode: o.mode ?? "extended",
    me: {
      seat: mySeat,
      isHost: mySeat === 0,
      role,
      ...(role === "mafia" ? { allies: [] } : {}),
      ...(meDead ? { chat: "ghost" } : {}),
      ...(o.pick !== undefined ? { pick: o.pick } : {}),
    },
    day: { n: 1, roles: [], lamps: LAMPS },
  } as unknown as RoomView;
  if (meDead) view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: "citizen" as RoleId })) };
  return view;
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return { status: "open", banner: "hidden", view, offset: 0, epoch: 1, removedReason: null, canSend: true, send: vi.fn(() => true), onEvent: vi.fn(() => () => {}), reconnect: vi.fn(), retry: vi.fn(), ...over };
}

const mount = (view: RoomView, over: Partial<RoomConnection> = {}) => {
  connectionMock.current = conn(view, over);
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

const tags = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-house-tag]")];
const buttons = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("button[data-house-tag]")];
const sends = (send: ReturnType<typeof vi.fn<(m: ClientMessage) => boolean>>): ClientMessage[] => send.mock.calls.map(([x]) => x).filter((x) => x.t === "pick");
const lastScene = (): SceneLook => rt.scenes[rt.scenes.length - 1] as SceneLook;

let restore: () => void = () => {};
beforeAll(() => {
  restore = openCause();
});
afterAll(() => restore());
beforeEach(() => {
  rt.scenes.length = 0;
  rt.created = 0;
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("밤 집 문패 화면 (D-10·D-11·D-25)", () => {
  it("산 사람 다섯: data-house-tag 가 8개이고 그중 단추가 다섯, 장면은 개관 시점이다", () => {
    const { container } = mount(makeView({ role: "citizen", mySeat: 3 }));
    expect(tags(container).map((t) => t.dataset.houseTag).join(",")).toBe("0,1,2,3,4,5,6,7");
    expect(buttons(container).map((t) => t.dataset.houseTag).join(",")).toBe("0,1,2,3,4");
    expect(lastScene().camera).toEqual({ mode: "overview" });
  });

  it("창 점·접근성 이름은 서버 공개 day.lamps 의 값이다", () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    expect(tags(container).map((t) => (t.dataset.lit === "true" ? "1" : "0")).join("")).toBe("10110010");
    expect(container.querySelector('[data-house-tag="0"]')?.getAttribute("aria-label")).toBe("민수의 집, 불 켜짐");
    expect(container.querySelector('[data-house-tag="1"]')?.getAttribute("aria-label")).toBe("영희의 집, 불 꺼짐");
  });

  it("아직 안 골랐으면 고를 수 있는 문패 전부가 is-call, 누르면 pick { target: 그 좌석 } 한 번이고 그 문패만 picked 이며 깜빡임은 모두 꺼진다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView({ mySeat: 3 }), { send });
    expect(buttons(container).every((b) => b.hasAttribute("data-call"))).toBe(true);
    fireEvent.click(container.querySelector('button[data-house-tag="2"]')!);
    expect(sends(send)).toEqual([{ t: "pick", target: 2 }]);
    const two = container.querySelector('button[data-house-tag="2"]')!;
    expect(two.getAttribute("aria-pressed")).toBe("true");
    expect(two.hasAttribute("data-picked")).toBe(true);
    expect(container.querySelectorAll("[data-picked]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-call]")).toHaveLength(0);
  });

  it("서버가 me.pick 을 주면 그 문패만 picked·깜빡임 모두 꺼짐, 다른 문패를 누르면 새 pick 이 가고 표시가 옮겨 간다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container, show } = mount(makeView({ mySeat: 3, pick: 1 }), { send });
    expect(container.querySelectorAll("[data-picked]")).toHaveLength(1);
    expect(container.querySelector("[data-picked]")?.getAttribute("data-house-tag")).toBe("1");
    expect(container.querySelectorAll("[data-call]")).toHaveLength(0);
    fireEvent.click(container.querySelector('button[data-house-tag="4"]')!);
    expect(sends(send)).toEqual([{ t: "pick", target: 4 }]);
    expect(container.querySelector("[data-picked]")?.getAttribute("data-house-tag")).toBe("4");
    // 이미 고른 집을 다시 눌러도 보내지 않는다
    fireEvent.click(container.querySelector('button[data-house-tag="4"]')!);
    expect(sends(send)).toHaveLength(1);
    show(makeView({ mySeat: 3, pick: 4 }));
    expect(container.querySelector("[data-picked]")?.getAttribute("data-house-tag")).toBe("4");
  });

  it("고름은 알림·토스트를 띄우지 않는다", () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    fireEvent.click(container.querySelector('button[data-house-tag="0"]')!);
    expect(container.querySelector("[role='alert'], .mv-toast")?.textContent ?? "").toBe("");
  });

  it("연결이 끊겨(canSend 거짓) 있으면 눌러도 보내지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView({ mySeat: 3 }), { send, canSend: false });
    fireEvent.click(container.querySelector('button[data-house-tag="0"]')!);
    expect(sends(send)).toEqual([]);
  });
});

describe("네 역할의 밤 화면이 같다 (D-10, LH4, T-21-31)", () => {
  /** 한 화면의 구조 서명: 문패 단추 수·모든 문패의 data-* 이름·아래 패널 모양(클래스·인라인 높이·자식 구조). 읽어 주기 전용 글(mf-sr-only, 마피아 [쪽지] 안내)은 화면 자리가 없어 높이와 무관해 뺀다 */
  const sig = (c: ParentNode): string => {
    const panel = c.querySelector<HTMLElement>("[data-world-panel]");
    return JSON.stringify({
      buttons: buttons(c).length,
      tags: tags(c).map((t) => [t.dataset.houseTag, t.tagName, t.className, t.getAttributeNames().filter((n) => n.startsWith("data-")).sort()]),
      panel: panel === null ? null : [panel.className, panel.style.height, [...panel.children].filter((el) => !el.classList.contains("mf-sr-only")).map((el) => el.className.replace(/\s+/g, " "))],
    });
  };

  it("마피아·경찰·의사·시민: 문패 단추 수·data-* 이름·아래 패널 구조가 같다", () => {
    const base = (() => {
      const { container, unmount } = mount(makeView({ role: "citizen", mySeat: 3 }));
      const s = sig(container);
      unmount();
      return s;
    })();
    for (const role of ROLES) {
      const { container, unmount } = mount(makeView({ role, mySeat: 3 }));
      expect(sig(container), role).toBe(base);
      unmount();
    }
  });

  it("역할마다 data-ring-kind='mafia'·조준·눈/치료 아이콘이 0건이고 FaceList(밤 대상 묶음)가 없다", () => {
    for (const role of ROLES) {
      const { container, unmount } = mount(makeView({ role, mySeat: 3, pick: 1 }));
      expect(container.querySelectorAll("[data-ring-kind]").length, role).toBe(0);
      expect(container.querySelectorAll("[data-face-list], [data-face]").length, role).toBe(0);
      expect(container.querySelectorAll('[data-mark-icon="eye"], [data-mark-icon="heal"]').length, role).toBe(0);
      expect(container.querySelector("[data-house-layer]")?.innerHTML ?? "", role).not.toMatch(/mafia|police|doctor|citizen|crosshair/i);
      unmount();
    }
  });

  it("헤더에 역할별 힌트가 없다(제목 '밤'만) — 산 사람은 네 역할 모두, 유령은 지켜보는 줄만 남는다", () => {
    for (const role of ROLES) expect(headerFor(makeView({ role, mySeat: 3 })), role).toEqual({ title: "밤" });
    expect(headerFor(makeView({ mySeat: 4, dead: [4] })).hint).toBeDefined();
    // 화면에도 힌트 칸이 없다(맵이 열리기 전이라 접혀 있어도 DOM 자체가 없다)
    for (const role of ROLES) {
      const { container, unmount } = mount(makeView({ role, mySeat: 3 }));
      expect(container.querySelector(".mv-phase__hint"), role).toBeNull();
      unmount();
    }
  });

  it("마피아는 [쪽지] 줄, 그 밖은 [유언] 줄이 지금처럼 아래 패널에 있다(행 하나)", () => {
    const mafia = mount(makeView({ role: "mafia", mySeat: 0 }));
    expect(mafia.container.querySelector("[data-note-button]")).not.toBeNull();
    expect(mafia.container.querySelector("[data-will-button]")).toBeNull();
    mafia.unmount();
    const citizen = mount(makeView({ role: "citizen", mySeat: 3 }));
    expect(citizen.container.querySelector("[data-will-button]")).not.toBeNull();
    expect(citizen.container.querySelector("[data-note-button]")).toBeNull();
  });
});

describe("유령·기본판·단계", () => {
  it("유령 view: 개관 시점은 같고 문패 8개 모두 단추가 아니다", () => {
    const { container } = mount(makeView({ mySeat: 4, dead: [4] }));
    expect(lastScene().camera).toEqual({ mode: "overview" });
    expect(tags(container)).toHaveLength(8);
    expect(buttons(container)).toHaveLength(0);
    expect(container.querySelectorAll("[data-call]")).toHaveLength(0);
  });

  it("산 사람이 한 명뿐이어도 문패 8개이고 그 집만 단추다", () => {
    const { container } = mount(makeView({ mySeat: 0, count: 1 }));
    expect(tags(container)).toHaveLength(8);
    expect(buttons(container).map((b) => b.dataset.houseTag)).toEqual(["0"]);
  });

  it("기본판 밤은 지금 그대로: 문패 없음, 얼굴 목록(밤 대상)과 역할별 힌트(headerFor), 따라가기 카메라", () => {
    const { container } = mount(makeView({ mode: "basic", role: "citizen", mySeat: 3 }));
    expect(tags(container)).toHaveLength(0);
    expect(container.querySelector('[data-face-list][aria-label="밤 대상"]')).not.toBeNull();
    expect(headerFor(makeView({ mode: "basic", role: "citizen", mySeat: 3 }))).toEqual({ title: "밤", hint: "날이 밝길 기다려요" });
    expect(lastScene().camera).toEqual({ mode: "follow" });
  });

  it("밤이 아닌 단계(아침)에는 문패가 없고 카메라가 따라가기로 돌아온다", () => {
    const m = mount(makeView({ mySeat: 3 }));
    expect(tags(m.container)).toHaveLength(8);
    m.show(makeView({ phase: "morning", mySeat: 3 }));
    expect(tags(m.container)).toHaveLength(0);
    expect(lastScene().camera).toEqual({ mode: "follow" });
  });

  it("act 래퍼: 문패 누름 중 상태 갱신이 경고 없이 끝난다", async () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    await act(async () => {
      fireEvent.click(container.querySelector('button[data-house-tag="1"]')!);
    });
    expect(container.querySelector("[data-picked]")?.getAttribute("data-house-tag")).toBe("1");
  });
});
