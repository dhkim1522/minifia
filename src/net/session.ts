// 입장 정보 한 칸과 마지막으로 쓴 닉네임. 토큰이 저장되는 유일한 장소다(T-01-19).
// 토큰은 주소·공유 링크·화면·콘솔에 쓰지 않는다. 서버에는 WebSocket hello 본문으로만 보낸다.
// 사파리 개인 모드처럼 저장소가 예외를 던지거나 없는 환경에서는 이 모듈 안 메모리로 대신한다.
import { isRoomCode } from "../../shared/roomCode";

export const SESSION_KEY = "minifia:session";
export const NICKNAME_KEY = "minifia:lastNickname";

export interface StoredSession {
  code: string;
  token: string;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const TOKEN_MIN = 16;
const TOKEN_MAX = 128;

// 저장소 접근이 막힌 환경의 대체 저장소. 페이지를 새로 열면 사라진다.
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

function read(key: string, storage: StorageLike): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string, storage: StorageLike): void {
  try {
    storage.setItem(key, value);
    // 저장소가 받아 주면 예전 대체본은 필요 없다.
    memory.delete(key);
  } catch {
    memory.set(key, value);
  }
}

function remove(key: string, storage: StorageLike): void {
  memory.delete(key);
  try {
    storage.removeItem(key);
  } catch {
    // 지울 수 없는 저장소는 메모리만 비운다.
  }
}

// 저장된 값은 믿지 않는다: 모양(코드 4자리, 토큰 길이)이 이상하면 없는 것으로 본다(T-01-20).
// 위조된 토큰은 서버 hello 가 4003 으로 거부한다.
export function loadSession(storage: StorageLike = browserStorage()): StoredSession | null {
  const raw = read(SESSION_KEY, storage);
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { code, token } = value as { code?: unknown; token?: unknown };
  if (typeof code !== "string" || !isRoomCode(code)) return null;
  if (typeof token !== "string" || token.length < TOKEN_MIN || token.length > TOKEN_MAX) return null;
  return { code, token };
}

export function saveSession(s: StoredSession, storage: StorageLike = browserStorage()): void {
  write(SESSION_KEY, JSON.stringify({ code: s.code, token: s.token }), storage);
}

export function clearSession(storage: StorageLike = browserStorage()): void {
  remove(SESSION_KEY, storage);
}

export function loadLastNickname(storage: StorageLike = browserStorage()): string {
  return read(NICKNAME_KEY, storage) ?? "";
}

export function saveLastNickname(nickname: string, storage: StorageLike = browserStorage()): void {
  write(NICKNAME_KEY, nickname, storage);
}
