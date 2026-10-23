// 시트 진입 위치 계측(G-01-9) — ?sheetdebug=1 탭에서만 켜진다. 플래그가 없으면 계측 본체를 내려받지 않는다.
// 이 파일이 운영 번들에 들어가는 몫이다: 플래그 판정과 계측기 등록 자리뿐이고 DOM 측정 코드는 두지 않는다.
// 계측 본체(sheetDebug.ts)는 아래 initSheetDebug 안의 동적 import 한 곳에서만 불러온다.
import type { StorageLike } from "../net/session";

export const SHEET_DEBUG_PARAM = "sheetdebug";
export const SHEET_DEBUG_KEY = "minifia:sheetdebug";

export type SheetMark = "shown" | "focused" | "entered" | "close";

export interface SheetTraceTarget {
  label: string;
  dialog: HTMLDialogElement;
  sheet: HTMLElement | null;
}

export interface SheetTrace {
  mark(ev: SheetMark): void;
  end(): void;
}

export interface SheetProbe {
  start(target: SheetTraceTarget): SheetTrace;
}

/**
 * 쿼리 sheetdebug=1 이면 저장소에 "1" 을 쓰고 켠다. =0 이면 지우고 끈다.
 * 그 밖에는 저장소 값이 "1" 인지로 정한다(방 만들기·참가로 주소가 바뀌거나 새로고침해도 유지).
 * 저장소 접근은 예외가 날 수 있어(사파리 개인 모드 등) 예외면 쿼리 값만으로 판정한다.
 */
export function sheetDebugEnabled(search: string, storage: StorageLike | null): boolean {
  const param = new URLSearchParams(search).get(SHEET_DEBUG_PARAM);
  if (param === "1") {
    try {
      storage?.setItem(SHEET_DEBUG_KEY, "1");
    } catch {
      // 저장소를 못 쓰는 환경: 이 로드에서만 켠다
    }
    return true;
  }
  if (param === "0") {
    try {
      storage?.removeItem(SHEET_DEBUG_KEY);
    } catch {
      // 무시
    }
    return false;
  }
  try {
    return storage?.getItem(SHEET_DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

let current: SheetProbe | null = null;

export function setSheetProbe(p: SheetProbe | null): void {
  current = p;
}

export function getSheetProbe(): SheetProbe | null {
  return current;
}

function browserSessionStorage(): StorageLike | null {
  try {
    return (globalThis.sessionStorage as StorageLike | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * 앱 시작 때 한 번. 꺼져 있으면 null, 켜져 있으면 계측 본체를 지연 로드해 등록하는 Promise.
 * 불러오기 실패는 경고 한 줄 뒤 삼킨다(계측이 앱을 막지 않는다).
 */
export function initSheetDebug(search?: string, storage?: StorageLike | null): Promise<void> | null {
  const s = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const store = storage === undefined ? browserSessionStorage() : storage;
  if (!sheetDebugEnabled(s, store)) return null;
  return import("./sheetDebug")
    .then((mod) => {
      setSheetProbe(mod.createSheetProbe({ storage: store }));
    })
    .catch(() => {
      console.warn("sheetdebug 불러오기 실패");
    });
}
