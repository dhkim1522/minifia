// 12-07: useSound — 엔진 구독, 제스처 resume, 가시성, 훅 설치, 잠금 해제 함수 (D-7, D-9, B-3, T-12-24).
// 실제 소리는 나지 않는다: 가짜 컨텍스트가 든 엔진을 주입한다.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
