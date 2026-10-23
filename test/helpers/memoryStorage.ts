// 테스트 전용 메모리 저장소. Node 25+ 는 --localstorage-file 없이 전역 localStorage 가 undefined 라서
// happy-dom 환경에서도 window.localStorage 를 쓸 수 없다. 저장소를 읽고 쓰는 테스트는 이 함수로 심는다.
import { vi } from "vitest";

export class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  [name: string]: unknown;
}

/** 전역 localStorage 를 새 메모리 저장소로 바꾼다. vi.unstubAllGlobals() 로 되돌아간다. */
export function installMemoryStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  return storage;
}
