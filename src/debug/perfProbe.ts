// RED 껍데기 — 구현은 GREEN 커밋에서 채운다
export const PERF_PARAM = "perf";
export const CHAT_MOCK_PARAM = "chat-mock";
export function perfEnabled(_search: string): boolean { return false; }
export function chatMockEnabled(_search: string): boolean { return false; }
export function initPerfDebug(_search?: string): boolean { return false; }
