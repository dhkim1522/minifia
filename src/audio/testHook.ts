// 12-05: window.__mfSound — 끝에서 끝 시험이 소리 요청을 읽는 훅 (D-22, A-4, LS-9, T-12-15).
// 켜진 문맥(?e2e=1·개발 빌드)에서만 만든다. 켜짐 여부는 부르는 쪽이 넘기는 불리언이다(src/world/testHooks.ts 를 import 하지 않는다).
// 노출하는 것은 엔진 상태의 읽기 전용 값과 요청 로그 사본뿐이다. 역할·좌석·nonce 는 어디에도 없다.
import type { BedId, SoundId } from "./recipes";
import type { LogEntry, SoundEngine } from "./engine";

export type HookState = "locked" | "running" | "suspended" | "off";

export interface MfSoundLogEntry {
  id: SoundId;
  at: number;
  gain: number;
  played: boolean;
}

export interface MfSoundHook {
  readonly state: HookState;
  readonly on: boolean;
  readonly bed: BedId | null;
  readonly voices: number;
  readonly log: MfSoundLogEntry[];
  clear(): void;
}

declare global {
  interface Window {
    __mfSound?: MfSoundHook;
  }
}

function copyEntry(e: LogEntry): MfSoundLogEntry {
  return { id: e.id, at: e.at, gain: e.gain, played: e.played };
}

function hookState(engine: SoundEngine): HookState {
  if (!engine.isOn()) return "off";
  const s = engine.state();
  return s === "running" ? "running" : s === "suspended" ? "suspended" : "locked";
}

/** enabled 가 거짓이면 아무것도 만들지 않고 null 을 돌려준다 */
export function installSoundHook(
  engine: SoundEngine,
  enabled: boolean,
  target: { __mfSound?: MfSoundHook } | undefined = typeof window === "undefined" ? undefined : window,
): MfSoundHook | null {
  if (!enabled || target === undefined) return null;
  const hook: MfSoundHook = {
    get state(): HookState {
      return hookState(engine);
    },
    get on(): boolean {
      return engine.isOn();
    },
    get bed(): BedId | null {
      return engine.currentBed();
    },
    get voices(): number {
      return engine.voiceCount();
    },
    get log(): MfSoundLogEntry[] {
      return engine.log().map(copyEntry);
    },
    clear(): void {
      engine.clearLog();
    },
  };
  target.__mfSound = hook;
  return hook;
}
