// 활동 기록 탭(역할 카드)에서 "읽은 일지 개수". 새 기록 점(마지막으로 읽은 뒤 늘어난 만큼)을 이 폰이 기억하는 데 쓴다.
// 읽은 개수만 저장한다 — 기록 내용·토큰은 저장하지 않는다(가정 A4, T-03-32).
// 사파리 개인 모드처럼 저장소가 예외를 던지거나 없는 환경에서는 이 모듈 안 메모리로 대신한다(session.ts 와 같은 모양).
import type { StorageLike } from "./session";

export const RECORDS_SEEN_PREFIX = "minifia:records:";

const memory = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

// 전역 localStorage 는 부를 때마다 읽는다(접근만으로 예외가 날 수 있고, 테스트가 바꿔 끼운다).
function browserStorage(): StorageLike {
  try {
    const storage = globalThis.localStorage as StorageLike | undefined;
    return storage ?? memoryStorage;
  } catch {
    return memoryStorage;
  }
}

const keyOf = (code: string): string => `${RECORDS_SEEN_PREFIX}${code}`;

// 저장된 값은 믿지 않는다: 0 이상 정수 문자열이 아니면 0 이다(T-03-33). 점 표시만 바뀌고 서버 값에는 영향이 없다.
function parseCount(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 0;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : 0;
}

export function loadSeenCount(code: string, storage: StorageLike = browserStorage()): number {
  const key = keyOf(code);
  try {
    const raw = storage.getItem(key);
    if (raw !== null) return parseCount(raw);
  } catch {
    // 읽을 수 없는 저장소는 메모리로 대신한다.
  }
  return parseCount(memory.get(key) ?? null);
}

export function saveSeenCount(code: string, count: number, storage: StorageLike = browserStorage()): void {
  const key = keyOf(code);
  const value = String(Number.isSafeInteger(count) && count > 0 ? count : 0);
  try {
    storage.setItem(key, value);
    memory.delete(key);
  } catch {
    memory.set(key, value);
  }
}

/** 아직 열어 보지 않은 기록 수. 저장값이 기록 수보다 커도(위조·새 판) 음수가 되지 않는다. */
export function unseenCount(recordsLength: number, seen: number): number {
  return Math.max(0, recordsLength - seen);
}
