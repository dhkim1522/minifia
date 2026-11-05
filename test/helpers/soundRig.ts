// 12-05: 소리 엔진 시험 도우미 — 가짜 컨텍스트·시계·저장소를 deps 로 꽂은 엔진.
import { createEngine, type EngineDeps } from "../../src/audio/engine";
import { createFakeRig, type FakeRig } from "./fakeAudio";
import { MemoryStorage } from "./memoryStorage";

export interface Rig {
  fake: FakeRig;
  storage: MemoryStorage;
  engine: ReturnType<typeof createEngine>;
}

export function makeRig(over: Partial<EngineDeps> = {}): Rig {
  const fake = createFakeRig();
  const storage = new MemoryStorage();
  const engine = createEngine({
    createContext: fake.createContext as unknown as EngineDeps["createContext"],
    now: fake.clock.now,
    setTimer: fake.clock.setTimer,
    clearTimer: fake.clock.clearTimer,
    storage,
    doc: { visibilityState: "visible" },
    nav: {},
    ...over,
  });
  return { fake, storage, engine };
}
