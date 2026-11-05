// 12-05: 소리 켬/끔 저장값 (D-6, LS-9, T-12-17). 이 기기의 localStorage 에만 있고 서버로 가지 않는다.
// 읽기·쓰기 모두 예외를 삼킨다(사파리 개인 모드·저장소 막힘). 없거나 깨진 값은 기본값(켜짐)이다.

export const SOUND_PREF_KEY = "minifia:sound";
export const SOUND_PREF_VERSION = 1;

export type PrefStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): PrefStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** 저장된 켬/끔. 아무것도 없거나 읽을 수 없으면 켜짐 */
export function loadSoundPref(storage?: PrefStorage | null): boolean {
  try {
    const s = storage === undefined ? defaultStorage() : storage;
    if (s === null) return true;
    const raw = s.getItem(SOUND_PREF_KEY);
    if (raw === null) return true;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return true;
    const rec = v as { v?: unknown; on?: unknown };
    if (rec.v !== SOUND_PREF_VERSION || typeof rec.on !== "boolean") return true;
    return rec.on;
  } catch {
    return true;
  }
}

/** 켬/끔 저장. 저장소가 막혀 있어도 예외를 내지 않는다 */
export function saveSoundPref(on: boolean, storage?: PrefStorage | null): void {
  try {
    const s = storage === undefined ? defaultStorage() : storage;
    if (s === null) return;
    s.setItem(SOUND_PREF_KEY, JSON.stringify({ v: SOUND_PREF_VERSION, on }));
  } catch {
    // 저장소 예외는 삼킨다.
  }
}
