// RED 껍데기 — 동작 없음 (GREEN 에서 채운다)
import type { StorageLike } from "../net/session";
import type { SheetProbe } from "./sheetProbe";

export function createSheetProbe(_options?: { doc?: Document; storage?: StorageLike | null }): SheetProbe {
  return {
    start() {
      return { mark() {}, end() {} };
    },
  };
}
