// RED 단계의 뼈대 — 테스트가 import 할 수 있게 모양과 상수만 둔다. 규칙은 GREEN 커밋에서 채운다.
import type { ChatChannel, ChatLineWire } from "../protocol";

export const CHAT_KEY_PREFIX = "chat:";
export const CHAT_REPLAY_PER_CHANNEL = 30;
export const CHAT_KEEP: Readonly<Record<ChatChannel, number>> = { all: 100, mafia: 300, ghost: 300 };
export const CHAT_EVICT_BATCH = 20;

export interface ChatRecord {
  g: number;
  ch: ChatChannel;
  seq: number;
  seat: number;
  text: string;
  at: number;
  n: number;
  r: number;
}
export interface ChatLog {
  records: readonly ChatRecord[];
  nextG: number;
  nextSeq: Readonly<Record<ChatChannel, number>>;
}

export function emptyChatLog(): ChatLog {
  return { records: [], nextG: 1, nextSeq: { all: 1, mafia: 1, ghost: 1 } };
}
export function chatKey(_g: number): string {
  return "";
}
export function seatMask(_players: readonly { id: string; seat: number }[], _ids: ReadonlySet<string>): number {
  return 0;
}
export function appendLine(
  log: ChatLog,
  input: { ch: ChatChannel; seat: number; text: string; at: number; n: number; r: number },
): { log: ChatLog; record: ChatRecord; evicted: number[] } {
  return { log, record: { g: 0, seq: 0, ...input }, evicted: [] };
}
export function toWire(record: ChatRecord): ChatLineWire {
  return { ch: record.ch, seat: record.seat, seq: record.seq, text: record.text, at: record.at };
}
export function replayFor(_log: ChatLog, _seat: number, _perChannel: number = CHAT_REPLAY_PER_CHANNEL): ChatLineWire[] {
  return [];
}
export function restoreChatLog(_stored: Iterable<unknown>): ChatLog {
  return emptyChatLog();
}
