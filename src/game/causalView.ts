// 21페이즈 자리 함수(RED 용) — 실제 계산은 GREEN 에서 채운다.
import type { ClueLine, PublicPlayer, RecordLine, RoomView } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";

export const KOREAN_COUNT: Readonly<Record<number, string>> = {};
export interface ClueChip { kind: string; icon: V2IconName | null; text: string; spot?: 1 | 2 | 3 }
export function clueChipsOf(_clues: readonly ClueLine[] | undefined, _record: readonly RecordLine[] | undefined): ClueChip[] { return []; }
export function clueSpotStates(_clues: readonly ClueLine[] | undefined): Record<1 | 2 | 3, "fresh" | "done" | "blurred"> { return { 1: "fresh", 2: "fresh", 3: "fresh" }; }
export function lampsOffOf(_lamps: readonly number[], _owners: readonly number[]): number[] { return []; }
export function windowsLitOf(_owners: readonly number[], _lamps: readonly number[]): number[] { return []; }
export function housePlatesOf(_view: RoomView): Array<{ seat: number; me: boolean }> { return []; }
export function nearestPlate(_points: ReadonlyArray<{ seat: number; x: number; y: number }>, _sx: number, _sy: number, _max = 28): number | null { return null; }
export function boardMarksOf(_players: ReadonlyArray<Pick<PublicPlayer, "seat" | "alive" | "look">>, _clues: readonly ClueLine[] | undefined): Record<number, Array<"cloth" | "window">> { return {}; }
// sameOutfitSeats
