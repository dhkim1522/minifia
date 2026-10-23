// RED 껍데기 — 동작 없음 (GREEN 에서 채운다)
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

export function sheetDebugEnabled(_search: string, _storage: StorageLike | null): boolean {
  return false;
}
export function setSheetProbe(_p: SheetProbe | null): void {}
export function getSheetProbe(): SheetProbe | null {
  return null;
}
export function initSheetDebug(_search?: string, _storage?: StorageLike | null): Promise<void> | null {
  return null;
}
