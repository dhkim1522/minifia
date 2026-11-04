import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { faceSrc } from "../../src/net/assets";
import { SceneCurtain } from "../../src/components/SceneCurtain";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜를 쓴다. 런타임(three)만 가짜로 바꿔 surprise 호출을 읽는다 (nightMap.test 와 같은 방식)
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ surprises: [] as number[] }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => ({
      start: () => Promise.resolve(),
      syncPlayers: () => {},
      deny: () => {},
      surprise: (seat: number) => rt.surprises.push(seat),
      setScene: () => {},
      tap: () => null,
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

// NIGHT-11·E8, UI-SPEC 143·214~261행. 장면 전환 막(SceneCurtain)은 공개 마감만의 함수다 — 덮기 시작은 phaseEndsAt − offset − 420ms,
// 모든 역할(시민·마피아·유령)이 같은 시각이다(결정 0061-4, 연구 Pitfall 8). 걷히는 때는 다음 단계(밤·아침) view 가 온 뒤다.
const NOW = 1_700_000_000_000;

interface CurtainViewOpts {
  phase: PhaseId;
  /** 지금부터 마감까지 ms */
  endsIn?: number;
  role?: "citizen" | "mafia" | "police" | "doctor";
  /** 내가 탈락(유령 화면) */
  dead?: boolean;
  /** 지목 단계의 지목 줄(seat → target) */
  points?: Array<{ seat: number; target: number }>;
  /** 지목 단계의 차례 정보(day.turn). "end" 는 끝 알림 단계(i = order.length), 숫자는 그 차례 중, -1 은 모이는 중 */
  turn?: "end" | number;
}

const ORDER = [0, 1, 2, 3, 4, 5];
const turnOf = (t: "end" | number) =>
  t === "end" ? { order: ORDER, i: ORDER.length } : t < 0 ? { order: ORDER, i: -1 } : { order: ORDER, i: t, endsAt: NOW + 1000 };

function curtainView(o: CurtainViewOpts): RoomView {
  const players = Array.from({ length: 6 }, (_, seat) => ({
    seat,
    nickname: `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead && seat === 0 ? { alive: false } : {}),
  }));
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: NOW + (o.endsIn ?? 30_000),
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: true, role: o.role ?? "citizen" },
    day: { n: 1, roles: [], ...(o.points ? { points: o.points } : {}), ...(o.turn !== undefined ? { turn: turnOf(o.turn) } : {}) },
  } as unknown as RoomView;
}

const curtain = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>("[data-curtain]");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("장면 전환 막 — 공개 마감 420ms 전 덮기 → 다음 단계 view 에서 800ms 걷기 (E8 #41)", () => {
  it("밤 view(마감 1000ms 뒤): 579ms 까지 막이 없고, 580ms 에 덮는 중(data-curtain), 1000ms 에 완전히 덮인다", () => {
    const { container } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000 })} offset={0} reducedMotion={false} />);
    expect(curtain(container)).toBeNull();
    advance(579);
    expect(curtain(container)).toBeNull();
    advance(1);
    const el = curtain(container)!;
    expect(el.getAttribute("data-curtain")).toBe("true");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("mf-curtain");
    expect(el.classList.contains("is-covering")).toBe(true);
    advance(420);
    expect(curtain(container)!.classList.contains("is-covered")).toBe(true);
    expect(curtain(container)!.classList.contains("is-covering")).toBe(false);
  });

  it("아침 view 가 오면 800ms 동안 걷히는 클래스(is-lifting), 그 뒤 막이 사라진다", () => {
    const night = curtainView({ phase: "night", endsIn: 1000 });
    const { container, rerender } = render(<SceneCurtain view={night} offset={0} reducedMotion={false} />);
    advance(1000);
    expect(curtain(container)!.classList.contains("is-covered")).toBe(true);
    rerender(<SceneCurtain view={curtainView({ phase: "morning", endsIn: 9000 })} offset={0} reducedMotion={false} />);
    expect(curtain(container)!.classList.contains("is-lifting")).toBe(true);
    advance(799);
    expect(curtain(container)).not.toBeNull();
    advance(1);
    expect(curtain(container)).toBeNull();
  });

  it("서버 시계 보정(offset): 서버가 로컬보다 500ms 앞서면 로컬 마감이 500ms 빨라져 덮기도 500ms 빨리 시작한다", () => {
    const { container } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000 })} offset={500} reducedMotion={false} />);
    advance(79);
    expect(curtain(container)).toBeNull();
    advance(1);
    expect(curtain(container)).not.toBeNull();
  });

  it.each([
    ["처형", { phase: "execution" as const }],
    ["끝 알림 단계의 단독 선두 없는 지목(동률)", { phase: "nomination" as const, turn: "end" as const, points: [{ seat: 1, target: 2 }, { seat: 2, target: 3 }] }],
    ["끝 알림 단계의 지목 0표", { phase: "nomination" as const, turn: "end" as const, points: [] }],
  ])("%s view 도 같은 시각(마감 − 420ms)에 덮는다", (_name, opts) => {
    const { container } = render(<SceneCurtain view={curtainView({ ...opts, endsIn: 1000 })} offset={0} reducedMotion={false} />);
    advance(579);
    expect(curtain(container)).toBeNull();
    advance(1);
    expect(curtain(container)?.getAttribute("data-curtain")).toBe("true");
  });

  it("지목 차례 중·모이는 중에는 동률·0표여도 차례 마감이 와도 덮지 않는다 (09.1)", () => {
    for (const turn of [-1, 0, 3] as const) {
      const { container, unmount } = render(<SceneCurtain view={curtainView({ phase: "nomination", turn, endsIn: 1000, points: [] })} offset={0} reducedMotion={false} />);
      advance(2000);
      expect(curtain(container), `turn ${turn}`).toBeNull();
      unmount();
    }
  });

  it("지목 차례 중 뒤 끝 알림 단계에서 동률이면 그때 덮는다 (09.1)", () => {
    const { container, rerender } = render(<SceneCurtain view={curtainView({ phase: "nomination", turn: 5, endsIn: 1000, points: [{ seat: 1, target: 2 }, { seat: 2, target: 3 }] })} offset={0} reducedMotion={false} />);
    advance(2000);
    expect(curtain(container)).toBeNull();
    rerender(<SceneCurtain view={curtainView({ phase: "nomination", turn: "end", endsIn: 2000, points: [{ seat: 1, target: 2 }, { seat: 2, target: 3 }] })} offset={0} reducedMotion={false} />);
    advance(1579);
    expect(curtain(container)).toBeNull();
    advance(1);
    expect(curtain(container)?.getAttribute("data-curtain")).toBe("true");
  });

  it("day.turn 이 없는 지목 view 는 덮지 않는다", () => {
    const { container } = render(<SceneCurtain view={curtainView({ phase: "nomination", endsIn: 1000, points: [] })} offset={0} reducedMotion={false} />);
    advance(2000);
    expect(curtain(container)).toBeNull();
  });

  it("단독 선두가 있는 지목, 토론, 변론, 아침 view 는 마감이 와도 덮지 않는다", () => {
    for (const opts of [
      { phase: "nomination" as const, turn: "end" as const, points: [{ seat: 1, target: 2 }] },
      { phase: "discussion" as const },
      { phase: "defense" as const },
      { phase: "morning" as const },
    ]) {
      const { container, unmount } = render(<SceneCurtain view={curtainView({ ...opts, endsIn: 1000 })} offset={0} reducedMotion={false} />);
      advance(2000);
      expect(curtain(container), opts.phase).toBeNull();
      unmount();
    }
  });

  it("지목 단계에서 덮기 전에 단독 선두가 생기면(다음이 변론) 덮지 않는다", () => {
    const tie = curtainView({ phase: "nomination", turn: "end", endsIn: 1000, points: [] });
    const { container, rerender } = render(<SceneCurtain view={tie} offset={0} reducedMotion={false} />);
    advance(300);
    rerender(<SceneCurtain view={curtainView({ phase: "nomination", turn: "end", endsIn: 700, points: [{ seat: 1, target: 2 }] })} offset={0} reducedMotion={false} />);
    advance(2000);
    expect(curtain(container)).toBeNull();
  });

  it("첫 렌더가 아침 view(재접속)이면 막이 없다", () => {
    const { container } = render(<SceneCurtain view={curtainView({ phase: "morning", endsIn: 9000 })} offset={0} reducedMotion={false} />);
    expect(curtain(container)).toBeNull();
    advance(10_000);
    expect(curtain(container)).toBeNull();
  });

  it("모션 줄이기: 마감 시각에 즉시 덮고(미리 덮지 않는다), 아침 view 에서 즉시 사라진다", () => {
    const { container, rerender } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000 })} offset={0} reducedMotion />);
    advance(999);
    expect(curtain(container)).toBeNull();
    advance(1);
    expect(curtain(container)!.classList.contains("is-covered")).toBe(true);
    rerender(<SceneCurtain view={curtainView({ phase: "morning", endsIn: 9000 })} offset={0} reducedMotion />);
    expect(curtain(container)).toBeNull();
  });

  it("시민·마피아·유령 view 에서 막이 덮기 시작하는 시각이 같다(T-09-43)", () => {
    const starts: number[] = [];
    for (const opts of [{ role: "citizen" as const }, { role: "mafia" as const }, { role: "police" as const }, { role: "citizen" as const, dead: true }]) {
      const { container, unmount } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000, ...opts })} offset={0} reducedMotion={false} />);
      let t = 0;
      while (curtain(container) === null && t < 2000) {
        advance(1);
        t += 1;
      }
      starts.push(t);
      unmount();
      vi.setSystemTime(NOW); // 다음 view 의 마감을 같은 기준에서 다시 잰다
    }
    expect(starts.join(",")).toBe("580,580,580,580");
  });

  it("holdUntil 이 있으면(피해자) 아침 view 가 와도 그 시각까지 걷히지 않고 이후 800ms 에 걷는다", () => {
    const { container, rerender } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000 })} offset={0} reducedMotion={false} />);
    advance(1000);
    const hold = Date.now() + 2800;
    rerender(<SceneCurtain view={curtainView({ phase: "morning", endsIn: 9000 })} offset={0} reducedMotion={false} holdUntil={hold} />);
    advance(2799);
    expect(curtain(container)!.classList.contains("is-covered")).toBe(true);
    expect(curtain(container)!.classList.contains("is-lifting")).toBe(false);
    advance(1);
    expect(curtain(container)!.classList.contains("is-lifting")).toBe(true);
    advance(800);
    expect(curtain(container)).toBeNull();
  });
});

// ---- 화면 단(RoomScreen → GameMap) 시험 공통 ----

const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];
// 0 마피아 · 1 경찰 · 2 의사 · 3 시민 · 4 마피아 · 5 시민
const JOBS: RoleId[] = ["mafia", "police", "doctor", "citizen", "mafia", "citizen", "citizen", "citizen"];

interface ScreenViewOpts {
  phase?: PhaseId;
  mySeat?: number;
  dead?: number[];
  endsIn?: number;
  morning?: { eliminated?: number; saved?: true };
  /** 경찰 본인에게 싣는 조사 기록 */
  records?: Array<{ n: number; target: number; isMafia: boolean }>;
}

function screenView(o: ScreenViewOpts = {}): RoomView {
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
    phaseEndsAt: NOW + (o.endsIn ?? 30_000),
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
      ...(o.records !== undefined ? { records: o.records } : {}),
    },
    day: { n: 1, roles: [], ...(o.morning ? { morning: o.morning } : {}) },
  } as unknown as RoomView;
  if (meDead) view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: JOBS[p.seat] ?? "citizen" })) };
  return view;
}

function connOf(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn((_m: ClientMessage) => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  } as RoomConnection;
}

const mount = (view: RoomView, over: Partial<RoomConnection> = {}) => {
  connectionMock.current = connOf(view, over);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  return {
    ...r,
    show: (v: RoomView, o: Partial<RoomConnection> = {}) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = connOf(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch, ...o });
      r.rerender(ui());
    },
  };
};

const killFx = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>('[data-kill-fx="true"]');
const announceText = (c: ParentNode): string => c.querySelector("[data-announce]")?.textContent ?? "";

describe("피해자 암살 이펙트 (NIGHT-11, E4 #25~#27, UI-SPEC 247~252행)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(NOW);
    rt.surprises.length = 0;
    installMemoryStorage();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const VICTIM = 3;
  const night = (mySeat = VICTIM, endsIn?: number) => screenView({ phase: "night", mySeat, ...(endsIn !== undefined ? { endsIn } : {}) });
  const morningOf = (mySeat: number, eliminated: number, dead: number[] = [eliminated]) => screenView({ phase: "morning", mySeat, dead, morning: { eliminated } });

  it("피해자 화면(같은 연결, 밤의 산 사람 → 아침의 탈락): 0.05초에 번쩍임·베기(data-kill-fx)가 생기고 0.95초에 사라진다. 그 전에는 없다", () => {
    const m = mount(night());
    m.show(morningOf(VICTIM, VICTIM));
    expect(killFx(m.container)).toBeNull();
    advance(49);
    expect(killFx(m.container)).toBeNull();
    advance(1);
    const fx = killFx(m.container)!;
    expect(fx).not.toBeNull();
    expect(fx.getAttribute("aria-hidden")).toBe("true");
    expect(fx.querySelector(".mf-killfx__flash")).not.toBeNull();
    expect(fx.querySelector(".mf-killfx__slash")).not.toBeNull();
    advance(899);
    expect(killFx(m.container)).not.toBeNull();
    advance(1);
    expect(killFx(m.container)).toBeNull();
    advance(5_000);
    expect(killFx(m.container)).toBeNull(); // 한 번뿐이다
  });

  it("0.7초에 내 캐릭터가 surprise 표정을 짓는다(WorldStage surprise → runtime.surprise(내 좌석))", () => {
    const m = mount(night());
    m.show(morningOf(VICTIM, VICTIM));
    advance(699);
    expect(rt.surprises.join(",")).toBe("");
    advance(1);
    expect(rt.surprises.join(",")).toBe(String(VICTIM));
    advance(5_000);
    expect(rt.surprises.join(",")).toBe(String(VICTIM));
  });

  it("막은 아침 view 가 와도 2.8초까지 걷히지 않고, 2.8초에 걷기 시작해 800ms 뒤 사라진다. 그 동안 알림 '암살당했습니다'는 막 위에 놓인다", () => {
    const m = mount(night(VICTIM, 1_000));
    advance(1_000);
    const curtain = (): HTMLElement | null => m.container.querySelector<HTMLElement>("[data-curtain]");
    expect(curtain()?.classList.contains("is-covered")).toBe(true);
    m.show(morningOf(VICTIM, VICTIM));
    advance(1_999);
    expect(announceText(m.container)).toBe("암살당했습니다");
    expect(curtain()?.classList.contains("is-held")).toBe(true);
    advance(800);
    expect(curtain()?.classList.contains("is-covered")).toBe(true);
    expect(curtain()?.classList.contains("is-lifting")).toBe(false);
    expect(curtain()?.classList.contains("is-held")).toBe(true);
    advance(1);
    expect(curtain()?.classList.contains("is-lifting")).toBe(true);
    expect(curtain()?.classList.contains("is-held")).toBe(false);
    advance(800);
    expect(curtain()).toBeNull();
  });

  it("의사가 살려 생존한 화면, 다른 시민 화면에는 번쩍임·베기·surprise 가 없고 막은 아침 view 에서 바로 걷는다 (E4 #26)", () => {
    for (const seat of [VICTIM, 5]) {
      const m = mount(night(seat, 1_000));
      advance(1_000);
      m.show(screenView({ phase: "morning", mySeat: seat, ...(seat === VICTIM ? { morning: { saved: true } } : { dead: [VICTIM], morning: { eliminated: VICTIM } }) }));
      expect(m.container.querySelector("[data-curtain]")?.classList.contains("is-lifting"), `seat ${seat}`).toBe(true);
      advance(5_000);
      expect(killFx(m.container), `seat ${seat}`).toBeNull();
      expect(rt.surprises.join(",")).toBe("");
      cleanup();
    }
  });

  it("재접속 첫 스냅샷(아침, 내가 탈락)·연결 번호가 바뀐 첫 스냅샷에는 번쩍임도 surprise 도 막도 없다", () => {
    const a = mount(morningOf(VICTIM, VICTIM));
    advance(5_000);
    expect(killFx(a.container)).toBeNull();
    expect(a.container.querySelector("[data-curtain]")).toBeNull();
    expect(rt.surprises.join(",")).toBe("");
    cleanup();
    const b = mount(night());
    b.show(morningOf(VICTIM, VICTIM), { epoch: 2 });
    advance(5_000);
    expect(killFx(b.container)).toBeNull();
    expect(rt.surprises.join(",")).toBe("");
  });

  it("모션 줄이기: 번쩍임·베기·surprise 없이 바로 유령 상태, 알림 '암살당했습니다'는 그대로, 막은 아침 view 에서 즉시 사라진다", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    const m = mount(night(VICTIM, 1_000));
    advance(1_000);
    expect(m.container.querySelector("[data-curtain]")).not.toBeNull();
    m.show(morningOf(VICTIM, VICTIM));
    expect(m.container.querySelector("[data-curtain]")).toBeNull();
    expect(m.container.querySelector("main.mf-game")?.getAttribute("data-ghost-view")).toBe("true");
    advance(700);
    expect(announceText(m.container)).toBe("암살당했습니다");
    advance(5_000);
    expect(killFx(m.container)).toBeNull();
    expect(rt.surprises.join(",")).toBe("");
  });

  it("막·번쩍임 시작은 비공개 정보에 따라 앞당기지 않는다: 같은 밤 view 에서 피해자가 될 사람과 아닌 사람의 막 시작 시각이 같다 (T-09-43)", () => {
    const startOf = (seat: number): number => {
      const m = mount(night(seat, 1_000));
      let t = 0;
      while (m.container.querySelector("[data-curtain]") === null && t < 2_000) {
        advance(1);
        t += 1;
      }
      cleanup();
      vi.setSystemTime(NOW);
      return t;
    };
    expect([startOf(VICTIM), startOf(5), startOf(0)].join(",")).toBe("580,580,580");
  });

  it("번쩍임은 한 번뿐이다: CSS 키프레임이 0 → 0.8@15% → 0 한 주기이고 반복 횟수 1, 베기는 -28° 에서 scaleX 0 → 1 (T-09-44)", () => {
    const css = readFileSync("src/styles/night.css", "utf8");
    const flash = css.match(/\.mf-killfx__flash\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(flash).toMatch(/crimson-700/);
    expect(flash).toMatch(/animation-iteration-count:\s*1\b/);
    expect(flash).not.toMatch(/infinite/);
    const frames = css.match(/@keyframes mf-killfx-flash\s*\{[\s\S]*?\}\s*\}/)?.[0] ?? "";
    expect(frames).toMatch(/0%\s*\{\s*opacity:\s*0;?\s*\}/);
    expect(frames).toMatch(/15%\s*\{\s*opacity:\s*0\.8;?\s*\}/);
    expect(frames).toMatch(/100%\s*\{\s*opacity:\s*0;?\s*\}/);
    const slash = css.match(/\.mf-killfx__slash\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(slash).toMatch(/rotate\(-28deg\)/);
    expect(slash).toMatch(/gray-50/);
    expect(slash).toMatch(/crimson-400/);
    expect(css).toMatch(/\.mf-killfx\s*\{[^}]*z-index:\s*calc\(var\(--z-toast\)\s*\+\s*9\)/);
  });
});

describe("경찰 조사 결과 카드 (NIGHT-09, UI-SPEC 245행)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(NOW);
    installMemoryStorage();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const POLICE = 1;
  const cards = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-police-card]")];
  const policeNight = (): RoomView => screenView({ phase: "night", mySeat: POLICE, records: [] });
  const policeMorning = (records: Array<{ n: number; target: number; isMafia: boolean }>, extra: Partial<ScreenViewOpts> = {}): RoomView =>
    screenView({ phase: "morning", mySeat: POLICE, morning: {}, records, ...extra });

  it("경찰 화면 밤 → 아침(대상 2 가 마피아): 카드 하나 — 얼굴 faceSrc(2), 글자 '마피아', roleMafia 아이콘, is-mafia. 2400ms 뒤 사라진다", () => {
    const m = mount(policeNight());
    expect(cards(m.container)).toHaveLength(0);
    m.show(policeMorning([{ n: 1, target: 2, isMafia: true }]));
    const [card] = cards(m.container);
    expect(cards(m.container)).toHaveLength(1);
    expect(card?.querySelector("img")?.getAttribute("src")).toBe(faceSrc(2));
    expect(card?.textContent).toContain("마피아");
    expect(card?.textContent).not.toContain("마피아 아님");
    expect(card?.classList.contains("is-mafia")).toBe(true);
    expect(card?.querySelector('[data-icon="roleMafia"]')).not.toBeNull();
    expect(card?.getAttribute("aria-hidden")).not.toBe("true");
    advance(2_399);
    expect(cards(m.container)).toHaveLength(1);
    advance(1);
    expect(cards(m.container)).toHaveLength(0);
  });

  it("대상이 마피아가 아니면 '마피아 아님' 과 check 아이콘, is-mafia 없음", () => {
    const m = mount(policeNight());
    m.show(policeMorning([{ n: 1, target: 3, isMafia: false }]));
    const [card] = cards(m.container);
    expect(card?.querySelector("img")?.getAttribute("src")).toBe(faceSrc(3));
    expect(card?.textContent).toContain("마피아 아님");
    expect(card?.classList.contains("is-mafia")).toBe(false);
    expect(card?.querySelector('[data-icon="check"]')).not.toBeNull();
    expect(card?.querySelector('[data-icon="roleMafia"]')).toBeNull();
  });

  it("WR-02: 얼굴 그림이 실패하면 대체 원이 좌석 0 은 var(--seat-1), 좌석 5 는 var(--seat-6) 색이다", () => {
    for (const [target, color] of [
      [0, "var(--seat-1)"],
      [5, "var(--seat-6)"],
    ] as const) {
      const m = mount(policeNight());
      m.show(policeMorning([{ n: 1, target, isMafia: false }]));
      const [card] = cards(m.container);
      fireEvent.error(card?.querySelector("img") as HTMLImageElement);
      const dot = cards(m.container)[0]?.querySelector<HTMLElement>("[data-face-fallback] i");
      expect(dot, `target ${target} 대체 원`).not.toBeNull();
      expect(dot?.style.background, `target ${target}`).toBe(color);
      cleanup();
    }
  });

  it("경찰이 그 밤에 안 골랐으면(새 줄 없음) 카드가 없다. 경찰이 그 밤에 당했어도 카드는 받는다", () => {
    const a = mount(policeNight());
    a.show(policeMorning([]));
    advance(3_000);
    expect(cards(a.container)).toHaveLength(0);
    cleanup();
    const b = mount(policeNight());
    b.show(policeMorning([{ n: 1, target: 3, isMafia: false }], { dead: [POLICE], morning: { eliminated: POLICE } }));
    expect(cards(b.container)).toHaveLength(1);
  });

  it("시민·마피아·의사·유령 화면에는 카드도 '마피아 아님' 문자열도 없다 (T-09-40)", () => {
    for (const seat of [3, 0, 2]) {
      const m = mount(screenView({ phase: "night", mySeat: seat }));
      m.show(screenView({ phase: "morning", mySeat: seat, morning: {} }));
      advance(3_000);
      expect(cards(m.container), `seat ${seat}`).toHaveLength(0);
      expect(m.container.textContent, `seat ${seat}`).not.toContain("마피아 아님");
      cleanup();
    }
    const ghost = mount(screenView({ phase: "night", mySeat: 5, dead: [5] }));
    ghost.show(screenView({ phase: "morning", mySeat: 5, dead: [5], morning: {} }));
    expect(cards(ghost.container)).toHaveLength(0);
    expect(ghost.container.textContent).not.toContain("마피아 아님");
  });

  it("재접속 첫 스냅샷이 아침(경찰 기록 있음)이면 카드가 없다", () => {
    const m = mount(policeMorning([{ n: 1, target: 3, isMafia: false }]));
    advance(3_000);
    expect(cards(m.container)).toHaveLength(0);
  });

  it("모션 줄이기: 등장 모션 클래스(is-enter) 없이 2400ms 표시된다", () => {
    const a = mount(policeNight());
    a.show(policeMorning([{ n: 1, target: 2, isMafia: true }]));
    expect(cards(a.container)[0]?.classList.contains("is-enter")).toBe(true);
    cleanup();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    const b = mount(policeNight());
    b.show(policeMorning([{ n: 1, target: 2, isMafia: true }]));
    expect(cards(b.container)).toHaveLength(1);
    expect(cards(b.container)[0]?.classList.contains("is-enter")).toBe(false);
    advance(2_399);
    expect(cards(b.container)).toHaveLength(1);
    advance(1);
    expect(cards(b.container)).toHaveLength(0);
  });

  it("카드 치수·색 규칙: 폭 220·반경 20·위 170·night-800 면·기본 테두리 night-600, 마피아는 crimson-500 테두리·crimson-300 글자, 토큰 변수만", () => {
    const css = readFileSync("src/styles/night.css", "utf8");
    const base = css.match(/\.mf-police-card\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(base).toMatch(/width:\s*220px/);
    expect(base).toMatch(/top:\s*170px/);
    expect(base).toMatch(/border-radius:\s*20px|border-radius:\s*var\(--radius-lg\)/);
    expect(base).toMatch(/var\(--night-800\)/);
    expect(base).toMatch(/border:\s*2px solid var\(--night-600\)/);
    expect(base).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const mafia = css.match(/\.mf-police-card\.is-mafia\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(mafia).toMatch(/crimson-500/);
    expect(css).toMatch(/\.mf-police-card\.is-mafia[^{]*\{[^}]*crimson-300/);
    const label = css.match(/\.mf-police-card__label\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(label).toMatch(/font-size:\s*16px/);
    expect(label).toMatch(/font-weight:\s*700/);
  });
});

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
