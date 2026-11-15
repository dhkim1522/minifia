// 토론 의심 보드의 순수 파생(21페이즈 D-18~D-20, UI-SPEC P21-14·P21-18). DOM·window·시각을 읽지 않고 **역할을 읽지 않는다**(T-21-39).
// 읽는 값은 본인에게만 온 me.scene(내가 살핀 줄)·me.record(내 목격 기록)·공개 day.lamps·공개 players[](닉네임·생존·look)뿐이다 — 남의 단서·처형된 사람의 직업은 입력에 없다(T-21-40).
// 판 규칙(cause)을 확인하지 않는다: 튜토리얼(21-12)이 가짜 view 로 같은 함수를 쓴다. 보드를 그릴지는 GameMap 이 정한다.
// 닮은 옷 얼굴 = sameOutfitSeats(옷 조각 clue 의 조각, 창문 clue 의 조각) — 결정 0079 의 흔적↔옷 표시 그대로다.
import { isAlive } from "../../shared/game/alive";
import type { RoomView, SpotId, TracePiece } from "../../shared/protocol";
import { recordRowsOf } from "./recordView";
import type { RecordRow } from "./recordView";
import { sameOutfitSeats } from "./traceMark";

/** 단서 칩 한 장: 어느 지점·받은 결과(찾은 게 없는 none 은 칩이 없다) + (발자국 수 | 조각) */
export interface BoardChip {
  spot: SpotId;
  kind: "clue" | "touched" | "dark";
  n?: number;
  piece?: TracePiece;
}

/** 얼굴의 닮은 옷 표시 한 개: 어느 단서(옷 조각 | 창문) 의 어느 조각과 같은 옷인가 */
export interface BoardMark {
  kind: "cloth" | "window";
  piece: TracePiece;
}

/** 산 사람 얼굴 한 칸. 직업·역할 값이 없다(허용 키는 seat·nickname·marks 뿐) */
export interface BoardFace {
  seat: number;
  nickname: string;
  marks: BoardMark[];
}

export interface BoardModel {
  /** me.scene 순서(살핀 순서)의 칩. 0장일 수 있다 */
  chips: BoardChip[];
  /** day.lamps(공개 boolean 여덟). 없으면 빈 배열 — 줄 자체를 그리지 않는다 */
  lamps: boolean[];
  /** 꺼진 등불 수 */
  offCount: number;
  /** 산 사람 전원(나 포함), 좌석 오름차순. 유령은 없다 */
  faces: BoardFace[];
  /** 내 목격 기록 줄(me.record 가 없으면 null) */
  witness: RecordRow[] | null;
}

/** 단서 지점 줄 → 닮은 옷 표시의 종류(조각이 있는 clue 만) */
const MARK_KIND: Partial<Record<SpotId, BoardMark["kind"]>> = { cloth: "cloth", window: "window" };

export function boardOf(view: RoomView): BoardModel {
  const lines = view.me.scene ?? [];
  const chips: BoardChip[] = [];
  const marked: BoardMark[] = [];
  for (const l of lines) {
    if (l.r === "none") continue;
    chips.push({
      spot: l.spot,
      kind: l.r,
      ...(l.r === "clue" && l.n !== undefined ? { n: l.n } : {}),
      ...(l.r === "clue" && l.piece !== undefined ? { piece: l.piece } : {}),
    });
    const kind = MARK_KIND[l.spot];
    if (l.r === "clue" && l.piece !== undefined && kind !== undefined) marked.push({ kind, piece: l.piece });
  }
  const sameOf = new Map<BoardMark, ReadonlySet<number>>(marked.map((m) => [m, new Set(sameOutfitSeats(view.players, m.piece))]));
  const lamps = view.day?.lamps ?? [];
  const faces: BoardFace[] = view.players
    .filter(isAlive)
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({ seat: p.seat, nickname: p.nickname, marks: marked.filter((m) => sameOf.get(m)?.has(p.seat) === true) }));
  return { chips, lamps: [...lamps], offCount: lamps.filter((on) => !on).length, faces, witness: recordRowsOf(view) };
}
