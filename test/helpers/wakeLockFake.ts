// 화면 꺼짐 방지(Screen Wake Lock) 시험용 모의. happy-dom 의 navigator 에는 wakeLock 이 없어 시험이 직접 넣고 뺀다.
// 훅 단독 시험(useWakeLock.test)과 방 화면 연결 시험(roomScreen.test)이 함께 쓴다.
import { vi } from "vitest";

/** 모의 sentinel: released 와 release() 호출 수를 센다. release() 는 실제처럼 "release" 이벤트를 보낸다. */
export class FakeSentinel extends EventTarget {
  released = false;
  releaseCalls = 0;
  release(): Promise<void> {
    this.releaseCalls += 1;
    this.released = true;
    this.dispatchEvent(new Event("release"));
    return Promise.resolve();
  }
}

export interface FakeWakeLock {
  request: ReturnType<typeof vi.fn>;
  sentinels: FakeSentinel[];
  /** pending 모드에서 아직 끝나지 않은 요청을 차례로 끝내는 함수들 */
  resolvers: Array<() => void>;
}

type Mode = "resolve" | "throw" | "reject" | "pending";

export interface InstallOptions {
  mode?: Mode;
}

const original = Object.getOwnPropertyDescriptor(navigator, "wakeLock");

/** navigator.wakeLock 을 모의로 바꾼다. mode: resolve(기본) | throw(동기 예외) | reject(NotAllowedError) | pending(직접 resolve) */
export function installWakeLock(opts: InstallOptions = {}): FakeWakeLock {
  const mode = opts.mode ?? "resolve";
  const sentinels: FakeSentinel[] = [];
  const resolvers: Array<() => void> = [];
  const request = vi.fn((type: string) => {
    void type;
    if (mode === "throw") throw new Error("sync boom");
    if (mode === "reject") return Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    const s = new FakeSentinel();
    sentinels.push(s);
    if (mode === "pending") return new Promise<FakeSentinel>((resolve) => resolvers.push(() => resolve(s)));
    return Promise.resolve(s);
  });
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
  return { request, sentinels, resolvers };
}

/** navigator.wakeLock 을 시험 전 상태(없음)로 되돌린다. */
export function removeWakeLock(): void {
  if (original) Object.defineProperty(navigator, "wakeLock", original);
  else delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
}

/** document.visibilityState 를 바꾸고 visibilitychange 를 보낸다. */
export function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** 시험 뒤 visibilityState 정의를 지워 happy-dom 기본값으로 돌린다. */
export function resetVisibility(): void {
  delete (document as unknown as { visibilityState?: unknown }).visibilityState;
}
