// RED 단계 자리 표시 — GREEN 커밋에서 실제 구현으로 바뀐다(quick 261025-fx1).
import type { Claim, EmojiId, TemplateId } from "../protocol";
import type { RoleId } from "./roles";
import type { Player, RoomState } from "./room";
import type { RandInt } from "./tick";

export type BotAct =
  | { t: "claim"; claim: Claim }
  | { t: "say"; template: TemplateId; target?: number; claimedRole?: RoleId }
  | { t: "emoji"; icon: EmojiId }
  | { t: "pick"; target: number };
export interface BotStep { at: number; botId: string; act: BotAct }
export interface BotPlan { key: string; steps: BotStep[] }

const notImplemented = (): never => {
  throw new Error("not implemented");
};
export const BOT_NAMES: readonly string[] = [];
export const isBot = (_p: Player): boolean => notImplemented();
export const botCount = (_s: RoomState): number => notImplemented();
export const botClaimChoice = (_s: RoomState, _b: Player, _r: RandInt): { claim: Claim; delayMs: number } | null => notImplemented();
export const botNightTarget = (_s: RoomState, _b: Player, _r: RandInt): number | undefined => notImplemented();
export const botPlanKey = (_s: RoomState): string | null => notImplemented();
export const planBotSteps = (_s: RoomState, _n: number, _r: RandInt): BotStep[] => notImplemented();
export const syncBotPlan = (_s: RoomState, _n: number, _r: RandInt): RoomState => notImplemented();
export const takeDueBotSteps = (_s: RoomState, _n: number): { state: RoomState; due: BotStep[] } => notImplemented();
export const botWakeAt = (_s: RoomState): number | null => notImplemented();
