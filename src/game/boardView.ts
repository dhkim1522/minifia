// RED 자리표시자(21-11 Task 1) — GREEN 커밋이 실제 파생으로 바꾼다.
import type { RoomView, SpotId, TracePiece } from "../../shared/protocol";
import type { RecordRow } from "./recordView";

export interface BoardChip { spot: SpotId; kind: "clue" | "touched" | "dark"; n?: number; piece?: TracePiece }
export interface BoardMark { kind: "cloth" | "window"; piece: TracePiece }
export interface BoardFace { seat: number; nickname: string; marks: BoardMark[] }
export interface BoardModel { chips: BoardChip[]; lamps: boolean[]; offCount: number; faces: BoardFace[]; witness: RecordRow[] | null }

export function boardOf(_view: RoomView): BoardModel {
  return { chips: [], lamps: [], offCount: 0, faces: [], witness: null };
}
