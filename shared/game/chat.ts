// 빠른 메시지 뼈대 — RED 단계용. GREEN 에서 구현한다.
import type { ChatLine, TemplateId } from "../protocol";
import type { RoleId } from "./roles";
import type { RoomState } from "./room";

export const QUICK_TEMPLATES = {} as Readonly<Record<TemplateId, { target: boolean; role: boolean }>>;
export const MESSAGE_KEEP = 0;
export const SEND_COOLDOWN_MS = 0;
export type SayInput = { template: TemplateId; target?: number; claimedRole?: RoleId };
export type ChatError = "WRONG_PHASE" | "BAD_MESSAGE" | "RATE_LIMITED";

export function say(
  _state: RoomState,
  _actorId: string,
  _input: SayInput,
  _now: number,
): { ok: true; state: RoomState; line: ChatLine } | { ok: false; error: ChatError } {
  return { ok: false, error: "BAD_MESSAGE" };
}
