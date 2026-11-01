// RED 단계의 뼈대 — 테스트가 import 할 수 있게 모양만 둔다. 구현은 GREEN 커밋에서 채운다.
import type { ChatChannel, PhaseId } from "../protocol";
import type { RoomState } from "./room";

export type AudienceEvent = { k: "chat" | "typing" | "emote"; ch: ChatChannel } | { k: "world" };
export const CHAT_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>();
export function phaseKey(_s: { phase: PhaseId; day?: number }): string {
  return "";
}
export function channelOf(_state: RoomState, _senderId: string): ChatChannel | null {
  return null;
}
export function audience(_state: RoomState, _ev: AudienceEvent): ReadonlySet<string> {
  return new Set();
}
