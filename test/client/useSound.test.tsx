// 12-07: useSound — 엔진 구독, 제스처 resume, 가시성, 훅 설치, 잠금 해제 함수 (D-7, D-9, B-3, T-12-24).
// 실제 소리는 나지 않는다: 가짜 컨텍스트가 든 엔진을 주입한다.
import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXECUTION_MS } from "../../shared/game/phases";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { emitSignal } from "../../src/audio/signals";
import { SOUND_PREF_KEY } from "../../src/audio/prefs";
import { getEngine, setEngineForTest, unlockAudio } from "../../src/audio/unlock";
import { useSound } from "../../src/audio/useSound";
import { MemoryStorage } from "../helpers/memoryStorage";
import { makeRig } from "../helpers/soundRig";

afterEach(() => {
  cleanup();
  setEngineForTest(null);
  vi.restoreAllMocks();
  delete window.__mfSound;
});

const PREF_OFF = JSON.stringify({ v: 1, on: false });

function pref(on: boolean): MemoryStorage {
  const storage = new MemoryStorage();
  if (!on) storage.setItem(SOUND_PREF_KEY, PREF_OFF);
  return storage;
}

const fire = (type: string, target: EventTarget = document) => act(() => void target.dispatchEvent(new Event(type, { bubbles: true })));

describe("unlockAudio (D-7, B-3)", () => {
  it("저장값이 켜짐(또는 없음)이면 엔진 unlock 을 동기로 한 번 부른다", () => {
    const rig = makeRig();
    setEngineForTest(rig.engine);
    const spy = vi.spyOn(rig.engine, "unlock");
    unlockAudio();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(rig.fake.contexts).toHaveLength(1);
  });

  it("저장값이 꺼짐이면 컨텍스트를 만들지 않는다", () => {
    const rig = makeRig({ storage: pref(false) });
    setEngineForTest(rig.engine);
    unlockAudio();
    expect(rig.fake.contexts).toHaveLength(0);
    expect(rig.engine.state()).toBe("none");
  });

  it("getEngine 은 같은 엔진을 돌려주고 시험은 교체·되돌릴 수 있다", () => {
    const a = getEngine();
    expect(getEngine()).toBe(a);
    const rig = makeRig();
    setEngineForTest(rig.engine);
    expect(getEngine()).toBe(rig.engine);
    setEngineForTest(null);
    expect(getEngine()).toBe(a);
  });
});

describe("useSound: 상태 (D-6, B-1, B-2)", () => {
  it("저장값 켜짐 + 컨텍스트 없음 → locked, 깨우면 on", () => {
    const rig = makeRig();
    const { result } = renderHook(() => useSound({ engine: rig.engine }));
    expect(result.current).toMatchObject({ supported: true, state: "locked" });
    act(() => rig.engine.unlock());
    expect(result.current.state).toBe("on");
  });

  it("저장값 꺼짐 → off (알약 대상이 아니다)", () => {
    const rig = makeRig({ storage: pref(false) });
    const { result } = renderHook(() => useSound({ engine: rig.engine }));
    expect(result.current.state).toBe("off");
    act(() => rig.engine.unlock());
    expect(result.current.state).toBe("off");
  });

  it("running 이 아니게 되면(suspended·interrupted) 다시 locked", () => {
    const rig = makeRig();
    const { result } = renderHook(() => useSound({ engine: rig.engine }));
    act(() => rig.engine.unlock());
    act(() => rig.fake.ctx().setState("interrupted"));
    expect(result.current.state).toBe("locked");
    act(() => rig.fake.ctx().setState("running"));
    expect(result.current.state).toBe("on");
  });

  it("AudioContext 를 만들 수 없는 환경이면 supported 가 거짓이다", () => {
    const rig = makeRig({ createContext: undefined });
    const { result } = renderHook(() => useSound({ engine: rig.engine }));
    expect(result.current.supported).toBe(false);
  });
});

describe("useSound: 제스처 resume (D-9, B-3, T-12-24)", () => {
  it("방 화면이 있는 동안 pointerup·touchend·keydown·visibilitychange 만 듣는다 (touchstart·pointerdown·mousedown 은 아니다)", () => {
    const rig = makeRig();
    const add = vi.spyOn(document, "addEventListener");
    renderHook(() => useSound({ engine: rig.engine }));
    const types = add.mock.calls.map((c) => c[0] as string);
    expect(new Set(types)).toEqual(new Set(["pointerup", "touchend", "keydown", "visibilitychange"]));
  });

  it("언마운트하면 건 리스너를 모두 푼다", () => {
    const rig = makeRig();
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useSound({ engine: rig.engine }));
    unmount();
    const added = add.mock.calls.map((c) => `${c[0] as string}`).sort();
    const removed = remove.mock.calls.map((c) => `${c[0] as string}`).sort();
    expect(removed).toEqual(added);
    for (const [type, fn] of add.mock.calls) {
      expect(remove.mock.calls.some((r) => r[0] === type && r[1] === fn)).toBe(true);
    }
  });

  it("active 가 거짓이면 아무것도 걸지 않는다", () => {
    const rig = makeRig();
    const add = vi.spyOn(document, "addEventListener");
    renderHook(() => useSound({ engine: rig.engine, active: false }));
    expect(add).not.toHaveBeenCalled();
  });

  it.each(["pointerup", "touchend", "keydown"])("%s 첫 이벤트가 locked 를 깨운다", (type) => {
    const rig = makeRig();
    const spy = vi.spyOn(rig.engine, "unlock");
    const { result } = renderHook(() => useSound({ engine: rig.engine }));
    fire(type);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("on");
  });

  it("pointerdown·touchstart·mousedown 은 깨우지 않는다", () => {
    const rig = makeRig();
    const spy = vi.spyOn(rig.engine, "unlock");
    renderHook(() => useSound({ engine: rig.engine }));
    fire("pointerdown");
    fire("touchstart");
    fire("mousedown");
    expect(spy).not.toHaveBeenCalled();
  });

  it("이미 running 이면 시도하지 않는다 (running 이 아닐 때만)", () => {
    const rig = makeRig();
    renderHook(() => useSound({ engine: rig.engine }));
    fire("pointerup");
    const spy = vi.spyOn(rig.engine, "unlock");
    fire("pointerup");
    fire("keydown");
    expect(spy).not.toHaveBeenCalled();
  });

  it("저장값이 꺼짐이면 깨우지 않는다", () => {
    const rig = makeRig({ storage: pref(false) });
    const spy = vi.spyOn(rig.engine, "unlock");
    renderHook(() => useSound({ engine: rig.engine }));
    fire("pointerup");
    expect(spy).not.toHaveBeenCalled();
    expect(rig.fake.contexts).toHaveLength(0);
  });

  it("소리 단추 안에서 난 이벤트는 건너뛴다 (단추 자신의 누르기와 겹쳐 켜자마자 꺼지지 않게)", () => {
    const rig = makeRig();
    const spy = vi.spyOn(rig.engine, "unlock");
    renderHook(() => useSound({ engine: rig.engine }));
    const btn = document.createElement("button");
    btn.setAttribute("data-sound-button", "");
    const inner = document.createElement("span");
    btn.append(inner);
    document.body.append(btn);
    fire("pointerup", inner);
    fire("keydown", btn);
    btn.remove();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("useSound: 가시성·정리 (D-9)", () => {
  let visibility: "visible" | "hidden";
  beforeEach(() => {
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  });

  it("탭 숨김은 엔진 hidden(), 보임은 visible()", () => {
    const rig = makeRig();
    const hidden = vi.spyOn(rig.engine, "hidden");
    const visible = vi.spyOn(rig.engine, "visible");
    renderHook(() => useSound({ engine: rig.engine }));
    visibility = "hidden";
    fire("visibilitychange");
    expect(hidden).toHaveBeenCalledTimes(1);
    expect(visible).not.toHaveBeenCalled();
    visibility = "visible";
    fire("visibilitychange");
    expect(visible).toHaveBeenCalledTimes(1);
  });

  it("숨김 → 보임 사이에 엔진이 suspended → running 으로 돌아온다", async () => {
    const rig = makeRig();
    const { result } = renderHook(() => useSound({ engine: rig.engine }));
    act(() => rig.engine.unlock());
    visibility = "hidden";
    fire("visibilitychange");
    act(() => rig.fake.clock.advance(300));
    expect(rig.engine.state()).toBe("suspended");
    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.state).toBe("on");
  });

  it("방을 떠나면(언마운트) 침대·예약 대본이 정지한다", () => {
    const rig = makeRig();
    const stop = vi.spyOn(rig.engine, "stopAll");
    const { unmount } = renderHook(() => useSound({ engine: rig.engine }));
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe("useSound: 시험 훅 (D-22)", () => {
  it("hook 이 참이면 window.__mfSound 를 만들고 거짓이면 만들지 않는다", () => {
    const off = makeRig();
    renderHook(() => useSound({ engine: off.engine, hook: false }));
    expect(window.__mfSound).toBeUndefined();
    const on = makeRig();
    renderHook(() => useSound({ engine: on.engine, hook: true }));
    expect(window.__mfSound?.state).toBe("locked");
    act(() => on.engine.unlock());
    expect(window.__mfSound?.state).toBe("running");
  });
});


// ───────────────────────── 12-08: view 차이 → 감독 → 엔진 ─────────────────────────

function roomView(phase: PhaseId, over: Partial<RoomView> = {}, count = 4): RoomView {
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 }));
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 1, isHost: false },
    day: phase === "lobby" || phase === "assigning" ? undefined : { n: 1, roles: [] },
    ...over,
  };
}

interface Props {
  view: RoomView | null;
  epoch: number;
}

const logIds = (rig: ReturnType<typeof makeRig>): string[] => rig.engine.log().map((e) => e.id);

function mount(rig: ReturnType<typeof makeRig>, initial: Props, wrapper?: ({ children }: { children: ReactNode }) => ReactNode) {
  return renderHook((p: Props) => useSound({ engine: rig.engine, view: p.view, epoch: p.epoch, offset: 0, now: rig.fake.clock.now }), {
    initialProps: initial,
    wrapper: wrapper as never,
  });
}

describe("useSound: 방 view 의 차이가 감독을 거쳐 엔진 요청이 된다 (D-3, LS-10)", () => {
  it("첫 스냅샷은 현재 단계 침대만 요청한다 (일회성·대본 없음)", () => {
    const rig = makeRig();
    mount(rig, { view: roomView("discussion", { phaseEndsAt: rig.fake.clock.now() + 60_000 }), epoch: 1 });
    expect(logIds(rig)).toEqual(["bed.day"]);
    expect(rig.fake.clock.pending()).toBe(0);
  });

  it("로비 → assigning → roleReveal → dayAnnounce 가 game.start · role.flip · day.start 와 침대를 요청한다", () => {
    const rig = makeRig();
    const { rerender } = mount(rig, { view: roomView("lobby"), epoch: 1 });
    rerender({ view: roomView("assigning"), epoch: 1 });
    rerender({ view: roomView("roleReveal"), epoch: 1 });
    rerender({ view: roomView("dayAnnounce"), epoch: 1 });
    expect(logIds(rig)).toEqual(["bed.lobby", "game.start", "bed.reveal", "role.flip", "bed.day", "day.start"]);
    expect(rig.engine.currentBed()).toBe("bed.day");
  });

  it("같은 view 가 새 객체로 되풀이돼도 요청이 늘지 않는다", () => {
    const rig = makeRig();
    const { rerender } = mount(rig, { view: roomView("lobby"), epoch: 1 });
    rerender({ view: roomView("lobby"), epoch: 1 });
    rerender({ view: roomView("lobby"), epoch: 1 });
    expect(logIds(rig)).toEqual(["bed.lobby"]);
  });

  it("epoch 가 바뀐 렌더는 단계가 바뀌었어도 침대만 요청한다", () => {
    const rig = makeRig();
    const { rerender } = mount(rig, { view: roomView("lobby"), epoch: 1 });
    rerender({ view: roomView("roleReveal"), epoch: 2 });
    expect(logIds(rig)).toEqual(["bed.lobby", "bed.reveal"]);
  });

  it("개발 모드 이중 효과 실행(StrictMode)에서도 일회성 소리가 한 번이다", () => {
    const rig = makeRig();
    const { rerender } = mount(rig, { view: roomView("lobby"), epoch: 1 }, ({ children }) => <StrictMode>{children}</StrictMode>);
    expect(rig.engine.currentBed()).toBe("bed.lobby");
    rerender({ view: roomView("assigning"), epoch: 1 });
    expect(logIds(rig).filter((id) => id === "game.start")).toHaveLength(1);
    expect(rig.engine.currentBed()).toBeNull();
  });

  it("view 가 null 이면(연결 전) 아무것도 요청하지 않고, 뒤에 오는 첫 view 는 침대만", () => {
    const rig = makeRig();
    const { rerender } = mount(rig, { view: null, epoch: 0 });
    expect(logIds(rig)).toEqual([]);
    rerender({ view: roomView("night", { phaseEndsAt: rig.fake.clock.now() + 20_000 }), epoch: 1 });
    expect(logIds(rig)).toEqual(["bed.night"]);
  });

  it("토론 마지막 5초 틱: 엔진 시계로 예약되고 단계가 바뀌면 남은 틱이 취소된다", () => {
    const rig = makeRig();
    const t0 = rig.fake.clock.now();
    const { rerender } = mount(rig, { view: roomView("dayAnnounce"), epoch: 1 });
    rerender({ view: roomView("discussion", { phaseEndsAt: t0 + 10_000 }), epoch: 1 });
    act(() => rig.fake.clock.advance(5_100));
    expect(logIds(rig).filter((id) => id === "timer.tick")).toHaveLength(1);
    rerender({ view: roomView("nomination", { phaseEndsAt: t0 + 13_000, day: { n: 1, roles: [], turn: { order: [0, 1], i: -1 } } }), epoch: 1 });
    act(() => rig.fake.clock.advance(20_000));
    expect(logIds(rig).filter((id) => id === "timer.tick")).toHaveLength(1);
  });

  it("서버 시각 오프셋을 반영한다: 서버가 로컬보다 앞서 있으면 틱이 그만큼 일찍 난다", () => {
    const rig = makeRig();
    const t0 = rig.fake.clock.now();
    const { rerender } = renderHook((p: Props) => useSound({ engine: rig.engine, view: p.view, epoch: p.epoch, offset: 2_000, now: rig.fake.clock.now }), {
      initialProps: { view: roomView("dayAnnounce"), epoch: 1 } as Props,
    });
    // 서버 시각 = 로컬 + 2000 이므로 마감까지 로컬로 8000ms 남았다 → 첫 틱(남은 5초)은 3000ms 뒤
    rerender({ view: roomView("discussion", { phaseEndsAt: t0 + 10_000 }), epoch: 1 });
    act(() => rig.fake.clock.advance(2_900));
    expect(logIds(rig)).not.toContain("timer.tick");
    act(() => rig.fake.clock.advance(200));
    expect(logIds(rig)).toContain("timer.tick");
  });

  it("주요 버튼 신호: 낮에는 ui.tap, 밤에는 무음, 언마운트하면 바인딩이 풀린다", () => {
    const rig = makeRig();
    const { rerender, unmount } = mount(rig, { view: roomView("discussion"), epoch: 1 });
    emitSignal({ kind: "tap" });
    expect(logIds(rig).filter((id) => id === "ui.tap")).toHaveLength(1);
    rerender({ view: roomView("night"), epoch: 1 });
    emitSignal({ kind: "tap" });
    expect(logIds(rig).filter((id) => id === "ui.tap")).toHaveLength(1);
    unmount();
    emitSignal({ kind: "tap" });
    expect(logIds(rig).filter((id) => id === "ui.tap")).toHaveLength(1);
  });

  it("로비 입장은 1초에 한 번까지만 (사람 수가 늘 때)", () => {
    const rig = makeRig();
    const { rerender } = mount(rig, { view: roomView("lobby", {}, 3), epoch: 1 });
    rerender({ view: roomView("lobby", {}, 4), epoch: 1 });
    rerender({ view: roomView("lobby", {}, 5), epoch: 1 });
    expect(logIds(rig).filter((id) => id === "lobby.join")).toHaveLength(1);
    act(() => rig.fake.clock.advance(1_000));
    rerender({ view: roomView("lobby", {}, 6), epoch: 1 });
    expect(logIds(rig).filter((id) => id === "lobby.join")).toHaveLength(2);
  });

  it("밤 진입(소리 전용 갈래): night.fall + bed.night 즉시, 큐 night.cue 2개가 로컬 시계로 난다 (D-10, LS-3)", () => {
    const rig = makeRig();
    const t0 = rig.fake.clock.now();
    const { rerender } = renderHook((p: Props) => useSound({ engine: rig.engine, view: p.view, epoch: p.epoch, offset: 0, now: rig.fake.clock.now, random: () => 0 }), {
      initialProps: { view: roomView("execution"), epoch: 1 } as Props,
    });
    rerender({ view: roomView("night", { phaseEndsAt: t0 + 30_000 }), epoch: 1 });
    expect(logIds(rig)).toEqual(["bed.vote", "bed.night", "night.fall"]);
    act(() => rig.fake.clock.advance(5_100));
    expect(logIds(rig).filter((id) => id === "night.cue")).toHaveLength(1);
    act(() => rig.fake.clock.advance(4_000));
    expect(logIds(rig).filter((id) => id === "night.cue")).toHaveLength(2);
    act(() => rig.fake.clock.advance(30_000));
    expect(logIds(rig).filter((id) => id === "night.cue")).toHaveLength(2);
  });

  it("visualCues 가 참이면 소리 전용 큐 대본이 없고 tensionCue 신호마다 night.cue 한 번 (D-11)", () => {
    const rig = makeRig();
    const t0 = rig.fake.clock.now();
    const { rerender } = renderHook((p: Props) => useSound({ engine: rig.engine, view: p.view, epoch: p.epoch, offset: 0, now: rig.fake.clock.now, random: () => 0, visualCues: true }), {
      initialProps: { view: roomView("execution"), epoch: 1 } as Props,
    });
    rerender({ view: roomView("night", { phaseEndsAt: t0 + 30_000 }), epoch: 1 });
    expect(logIds(rig)).toContain("night.fall");
    act(() => rig.fake.clock.advance(30_000));
    expect(logIds(rig).filter((id) => id === "night.cue")).toHaveLength(0);
    emitSignal({ kind: "tensionCue" });
    emitSignal({ kind: "tensionCue" });
    expect(logIds(rig).filter((id) => id === "night.cue")).toHaveLength(2);
  });

  it("tensionCue 신호는 밤이 아니면 무음이고, visualCues 가 거짓이어도 무음이다", () => {
    const rig = makeRig();
    const { rerender } = mount(rig, { view: roomView("discussion"), epoch: 1 });
    emitSignal({ kind: "tensionCue" });
    expect(logIds(rig)).not.toContain("night.cue");
    rerender({ view: roomView("night", { phaseEndsAt: rig.fake.clock.now() + 30_000 }), epoch: 1 });
    emitSignal({ kind: "tensionCue" }); // visualCues 기본 거짓
    expect(logIds(rig)).not.toContain("night.cue");
  });

  it("밤 중 tap·card 신호는 무음이다 (LS-7)", () => {
    const rig = makeRig();
    mount(rig, { view: roomView("night", { phaseEndsAt: rig.fake.clock.now() + 20_000 }), epoch: 1 });
    emitSignal({ kind: "tap" });
    emitSignal({ kind: "card", delayMs: 0 });
    expect(logIds(rig).filter((id) => id.startsWith("ui."))).toEqual([]);
  });

  it("밤 중간 첫 view: bed.night 만 즉시, night.fall 은 없고 큐는 남은 시간 안에서 새로 뽑는다 (LS-10)", () => {
    const rig = makeRig();
    const t0 = rig.fake.clock.now();
    mount(rig, { view: roomView("night", { phaseEndsAt: t0 + 12_000 }), epoch: 1 });
    expect(logIds(rig)).toEqual(["bed.night"]);
    act(() => rig.fake.clock.advance(12_000));
    expect(logIds(rig)).not.toContain("night.fall");
  });

  describe("아침·암살음·유언·경찰 카드 (12-09, D-12, LS-8)", () => {
    interface P {
      view: RoomView | null;
      epoch: number;
      kill?: { nonce: number; at: number } | null;
      letter?: { t0: number; writeMs: number } | null;
      policeCard?: number | null;
    }
    const mountDay = (rig: ReturnType<typeof makeRig>, initial: P) =>
      renderHook((p: P) => useSound({ engine: rig.engine, view: p.view, epoch: p.epoch, offset: 0, now: rig.fake.clock.now, random: () => 0, kill: p.kill ?? null, letter: p.letter ?? null, policeCard: p.policeCard ?? null }), {
        initialProps: initial,
      });
    const morning = (t0: number, m: { eliminated?: number; saved?: true } = {}): RoomView => roomView("morning", { phaseEndsAt: t0 + 7_000, day: { n: 1, roles: [], morning: m } });

    it("밤 → 아침: morning.dawn 즉시 + bed.dawn, 평화면 400ms 에 morning.calm", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mountDay(rig, { view: roomView("night", { phaseEndsAt: t0 + 10_000 }), epoch: 1 });
      rerender({ view: morning(t0), epoch: 1 });
      expect(logIds(rig).slice(-2)).toEqual(["bed.dawn", "morning.dawn"]);
      expect(logIds(rig)).not.toContain("morning.calm");
      act(() => rig.fake.clock.advance(450));
      expect(logIds(rig)).toContain("morning.calm");
    });

    it("희생자 아침: 700ms 에 chalk.draw, killFx 새 nonce 는 +50ms 에 kill.slash 한 번 (같은 nonce 되풀이는 없음)", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mountDay(rig, { view: roomView("night", { phaseEndsAt: t0 + 10_000 }), epoch: 1 });
      rerender({ view: morning(t0, { eliminated: 1 }), epoch: 1 });
      rerender({ view: morning(t0, { eliminated: 1 }), epoch: 1, kill: { nonce: 1, at: t0 } });
      expect(logIds(rig)).not.toContain("kill.slash");
      act(() => rig.fake.clock.advance(60));
      expect(logIds(rig).filter((id) => id === "kill.slash")).toHaveLength(1);
      rerender({ view: morning(t0, { eliminated: 1 }), epoch: 1, kill: { nonce: 1, at: t0 } });
      act(() => rig.fake.clock.advance(1_000));
      expect(logIds(rig).filter((id) => id === "kill.slash")).toHaveLength(1);
      expect(logIds(rig)).toContain("chalk.draw");
    });

    it("처음부터 killFx 가 있는 마운트(재접속 직후)·밤 단계의 killFx·killFx 없는 아침은 kill.slash 가 없다", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const a = mountDay(rig, { view: morning(t0, { eliminated: 1 }), epoch: 1, kill: { nonce: 3, at: t0 } });
      act(() => rig.fake.clock.advance(5_000));
      expect(logIds(rig)).not.toContain("kill.slash");
      a.unmount();
      const rig2 = makeRig();
      const b = mountDay(rig2, { view: roomView("night", { phaseEndsAt: t0 + 10_000 }), epoch: 1 });
      b.rerender({ view: roomView("night", { phaseEndsAt: t0 + 10_000 }), epoch: 1, kill: { nonce: 1, at: t0 } });
      act(() => rig2.fake.clock.advance(5_000));
      expect(logIds(rig2)).not.toContain("kill.slash");
    });

    it("유언 편지: t0 기준으로 will.quill 들 → will.seal → will.fold, 다음 단계로 넘어가면 남은 줄이 취소된다", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mountDay(rig, { view: roomView("night", { phaseEndsAt: t0 + 10_000 }), epoch: 1 });
      rerender({ view: morning(t0, { eliminated: 1 }), epoch: 1 });
      rerender({ view: morning(t0, { eliminated: 1 }), epoch: 1, letter: { t0: t0 + 700, writeMs: 1_000 } });
      act(() => rig.fake.clock.advance(1_400));
      expect(logIds(rig)).not.toContain("will.quill");
      act(() => rig.fake.clock.advance(200)); // t0 + 800 = 1500
      expect(logIds(rig)).toContain("will.quill");
      act(() => rig.fake.clock.advance(1_500)); // 3100: 쓰기 끝(1500 + 1000)과 인장(+100) 뒤
      expect(logIds(rig)).toContain("will.seal");
      expect(logIds(rig)).not.toContain("will.fold");
      act(() => rig.fake.clock.advance(3_000)); // 6100 > t0 + 700 + 5000
      expect(logIds(rig).filter((id) => id === "will.fold")).toHaveLength(1);
    });

    it("경찰 카드: 새 id 가 서면 POLICE_CARD_AT(2400ms) 뒤 ui.card 한 번", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mountDay(rig, { view: roomView("night", { phaseEndsAt: t0 + 10_000 }), epoch: 1 });
      rerender({ view: morning(t0), epoch: 1 });
      rerender({ view: morning(t0), epoch: 1, policeCard: 1 });
      act(() => rig.fake.clock.advance(2_300));
      expect(logIds(rig)).not.toContain("ui.card");
      act(() => rig.fake.clock.advance(200));
      expect(logIds(rig).filter((id) => id === "ui.card")).toHaveLength(1);
      rerender({ view: morning(t0), epoch: 1, policeCard: 1 });
      act(() => rig.fake.clock.advance(5_000));
      expect(logIds(rig).filter((id) => id === "ui.card")).toHaveLength(1);
    });

    it("카드 신호(유언·쪽지)는 delayMs 뒤 ui.card 한 번", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      mountDay(rig, { view: morning(t0), epoch: 1 });
      emitSignal({ kind: "card", delayMs: 2_800 });
      act(() => rig.fake.clock.advance(2_700));
      expect(logIds(rig)).not.toContain("ui.card");
      act(() => rig.fake.clock.advance(200));
      expect(logIds(rig).filter((id) => id === "ui.card")).toHaveLength(1);
    });

    it("아침 중간 첫 view: bed.dawn 만 (morning.dawn·분기 소리 없음)", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      mountDay(rig, { view: morning(t0, { eliminated: 1 }), epoch: 1 });
      act(() => rig.fake.clock.advance(5_000));
      expect(logIds(rig)).toEqual(["bed.dawn"]);
    });
  });

  describe("판결 순간 (12-10, D-13, LS-10, LS-11)", () => {
    const execView = (t0: number, passed: boolean, last = false): RoomView =>
      roomView("execution", {
        phaseEndsAt: t0 + EXECUTION_MS,
        day: { n: 1, roles: [], candidate: 2, verdict: { yes: 2, no: 1, passed, ...(last ? { last: true as const } : {}) }, ...(last ? {} : { ballots: { yes: [0, 1], no: [3] } }) },
      });
    const verdictView = (t0: number): RoomView => roomView("verdict", { phaseEndsAt: t0, day: { n: 1, roles: [], candidate: 2 } });
    const timeline = (rig: ReturnType<typeof makeRig>, t0: number): [string, number][] =>
      rig.engine.log().filter((e) => e.id !== "bed.vote" && e.id !== "timer.tick").map((e) => [e.id, Math.round(e.at - t0)] as [string, number]);

    it("통과: 처형 진입 즉시 심장 박동·핀, 이후 서버 시각 기준으로 둔탁음·gavel+rise", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mount(rig, { view: verdictView(t0), epoch: 1 });
      rerender({ view: execView(t0, true), epoch: 1 });
      act(() => rig.fake.clock.advance(EXECUTION_MS));
      const tl = timeline(rig, t0);
      expect(tl.filter(([id]) => id === "verdict.heart").map(([, at]) => at)).toEqual([0, 800, 1500, 2050, 2400]);
      expect(tl).toContainEqual(["pin.on", 0]);
      expect(tl).toContainEqual(["ballot.yes", 600]);
      expect(tl).toContainEqual(["ballot.no", 1000]);
      expect(tl).toContainEqual(["execution.gavel", 2600]);
      expect(tl).toContainEqual(["execution.rise", 2600]);
      expect(tl).toContainEqual(["ui.card", 4600]);
    });

    it("부결: 2600 에 verdict.reject, gavel 은 없다", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mount(rig, { view: verdictView(t0), epoch: 1 });
      rerender({ view: execView(t0, false), epoch: 1 });
      act(() => rig.fake.clock.advance(EXECUTION_MS));
      const tl = timeline(rig, t0);
      expect(tl).toContainEqual(["verdict.reject", 2600]);
      expect(tl.some(([id]) => id === "execution.gavel")).toBe(false);
    });

    it("마지막 3인 처형: 0ms 에 gavel + rise 만", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mount(rig, { view: roomView("showdown", { phaseEndsAt: t0 }), epoch: 1 });
      rerender({ view: execView(t0, true, true), epoch: 1 });
      act(() => rig.fake.clock.advance(EXECUTION_MS));
      expect(timeline(rig, t0).map(([id]) => id).sort()).toEqual(["execution.gavel", "execution.rise", "pin.on"]);
    });

    it("처형 중간에 처음 받은 view(새로고침)는 침대뿐이고 예약도 없다", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      rig.fake.clock.advance(1500);
      mount(rig, { view: execView(t0, true), epoch: 1 });
      act(() => rig.fake.clock.advance(EXECUTION_MS));
      expect(logIds(rig)).toEqual(["bed.vote"]);
    });

    it("같은 처형 view 의 되풀이는 소리를 늘리지 않고, 밤으로 가면 남은 소리가 취소된다", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mount(rig, { view: verdictView(t0), epoch: 1 });
      rerender({ view: execView(t0, true), epoch: 1 });
      act(() => rig.fake.clock.advance(1000));
      rerender({ view: execView(t0, true), epoch: 1 });
      const before = logIds(rig).filter((id) => id === "verdict.heart").length;
      expect(before).toBe(2);
      rerender({ view: roomView("night", { phaseEndsAt: t0 + 60_000 }), epoch: 1 });
      act(() => rig.fake.clock.advance(6000));
      expect(logIds(rig)).not.toContain("execution.gavel");
      expect(logIds(rig).filter((id) => id === "verdict.heart")).toHaveLength(2);
    });
  });

  describe("동작 소리 신호 (12-10, D-14, LS-4)", () => {
    const emoteLog = (rig: ReturnType<typeof makeRig>) => rig.engine.log().filter((e) => e.id.startsWith("emote."));

    it("받은 프레임의 신호 하나가 emote.{id} 하나: 내 것은 0dB(gain 1), 남의 것은 −6dB", () => {
      const rig = makeRig();
      mount(rig, { view: roomView("discussion", { phaseEndsAt: rig.fake.clock.now() + 60_000 }), epoch: 1 });
      act(() => emitSignal({ kind: "emote", id: "clap", mine: true }));
      act(() => emitSignal({ kind: "emote", id: "cry", mine: false }));
      const log = emoteLog(rig);
      expect(log.map((e) => e.id)).toEqual(["emote.clap", "emote.cry"]);
      expect(log[0]!.gain).toBeCloseTo(1, 6);
      expect(log[1]!.gain).toBeCloseTo(10 ** (-6 / 20), 6);
    });

    it("신호가 없으면(받지 못한 프레임) 어떤 단계에서도 emote.* 가 없다", () => {
      const rig = makeRig();
      const t0 = rig.fake.clock.now();
      const { rerender } = mount(rig, { view: roomView("discussion", { phaseEndsAt: t0 + 60_000 }), epoch: 1 });
      rerender({ view: roomView("night", { phaseEndsAt: t0 + 30_000 }), epoch: 1 });
      act(() => rig.fake.clock.advance(30_000));
      expect(emoteLog(rig)).toEqual([]);
    });

    it("1초에 셋까지: 같은 시각의 네 번째는 버려지고 1초 뒤 다시 난다", () => {
      const rig = makeRig();
      mount(rig, { view: roomView("discussion", { phaseEndsAt: rig.fake.clock.now() + 60_000 }), epoch: 1 });
      for (const id of ["clap", "praise", "dance", "cry"] as const) act(() => emitSignal({ kind: "emote", id, mine: false }));
      expect(emoteLog(rig)).toHaveLength(3);
      act(() => rig.fake.clock.advance(1000));
      act(() => emitSignal({ kind: "emote", id: "point", mine: false }));
      expect(emoteLog(rig)).toHaveLength(4);
    });

    it("밤에 받은 프레임도 소리가 난다 (수신자는 서버가 정한 사람뿐)", () => {
      const rig = makeRig();
      mount(rig, { view: roomView("night", { phaseEndsAt: rig.fake.clock.now() + 30_000 }), epoch: 1 });
      act(() => emitSignal({ kind: "emote", id: "throat", mine: false }));
      expect(emoteLog(rig).map((e) => e.id)).toEqual(["emote.throat"]);
    });
  });

  it("active 가 거짓이면 감독도 쉰다", () => {
    const rig = makeRig();
    renderHook(() => useSound({ engine: rig.engine, active: false, view: roomView("lobby"), epoch: 1, offset: 0, now: rig.fake.clock.now }));
    expect(logIds(rig)).toEqual([]);
  });
});
