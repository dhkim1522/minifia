import { useState } from "react";
import type { ReactElement } from "react";
import "../../styles/v2.css";
import type { ClueChip as ClueChipItem, OutfitMark } from "../../game/causalView";
import type { RecordRow } from "../../game/recordView";
import { ClueChip } from "./ClueChip";
import { RecordRows } from "./RecordCard";
import { V2Icon } from "./V2Icon";

// 21페이즈 토론 · 의심 보드(P21-14, D-18·D-19·D-20): 나만 보는 카드. 남의 단서는 어디에도 없고 말은 채팅으로 한다.
// 정체 표시가 없다 — 얼굴 줄은 산 사람 얼굴과 같은 옷 배지뿐이고 처형된 사람의 정체를 알리는 것이 이 부품에 없다(D-20).
// 입력은 내가 받은 값(칩 = clueChipsOf(me.clues, me.record), 배지 = boardMarksOf)과 공개 얼굴 목록뿐이고 역할 prop 이 없다 — 같은 입력이면 같은 DOM 이다.
// 글은 머리 제목·칩 글(닫힌 표)뿐이다. 닉네임은 얼굴 칸의 접근성 이름에만 있고(React 속성), 목격 줄을 펼칠 때만 줄 안에 글로 나온다(RecordRows).

export interface SuspectBoardFace {
  seat: number;
  name: string;
}

export interface SuspectBoardProps {
  /** clueChipsOf 결과(목격 칩·단서 없음 칩 포함) */
  chips: readonly ClueChipItem[];
  /** 목격 줄(recordRowsOf). 없거나 비면 목격 칩은 펼치기 단추가 아니다 */
  rows: readonly RecordRow[] | null;
  /** 산 사람 전원(나 포함), 좌석 오름차순 */
  faces: readonly SuspectBoardFace[];
  /** boardMarksOf 결과: 좌석 → 같은 옷 배지(cloth·window 순) */
  marks: Readonly<Record<number, readonly OutfitMark[]>>;
  faceOf: (seat: number) => string;
  colorOf: (seat: number) => string;
  /** 이미 탈락한 좌석(공개 값) — 목격 줄의 그 얼굴만 흐리게 한다 */
  ghostSeats?: ReadonlySet<number>;
  /** 스테이지 높이 ≤ 640 인 폰이면 얼굴 칸 56, 아니면 64 */
  compact: boolean;
  onClose: () => void;
}

export function SuspectBoard({ chips, rows, faces, marks, faceOf, colorOf, ghostSeats, compact, onClose }: SuspectBoardProps): ReactElement {
  const [open, setOpen] = useState(false);
  const expandable = rows !== null && rows.length > 0;
  return (
    <section className={compact ? "mv-suspect-board is-compact" : "mv-suspect-board"} data-suspect-board="" aria-label="의심 보드">
      <div className="mv-suspect-board__head">
        <V2Icon name="timeline" size={24} />
        <span className="mv-suspect-board__title">내가 아는 것</span>
        <button type="button" className="mv-suspect-board__close mv-closepill" aria-label="닫기" onMouseDown={(e) => e.preventDefault()} onClick={onClose}>
          <V2Icon name="close" size={20} />
        </button>
      </div>
      <div className="mv-suspect-board__body">
        <ul className="mv-suspect-board__chips" aria-label="내가 아는 것">
          {chips.map((c, i) => (
            <li key={`${c.kind}:${i}`} className="mv-suspect-board__chip">
              {c.kind === "witness" && expandable ? (
                <button type="button" className="mv-suspect-board__witness" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                  <ClueChip kind={c.kind} text={c.text} icon={c.icon} size="chip" />
                </button>
              ) : (
                <ClueChip kind={c.kind} text={c.text} icon={c.icon} size="chip" />
              )}
            </li>
          ))}
        </ul>
        {open && expandable ? <RecordRows rows={rows} faceOf={faceOf} colorOf={colorOf} {...(ghostSeats ? { ghostSeats } : {})} /> : null}
        <div className="mv-suspect-board__faces" role="list" aria-label="참가자">
          {faces.map((f) => {
            const badges = marks[f.seat] ?? [];
            const marked = badges.length > 0;
            return (
              <div
                key={f.seat}
                className="mv-suspect-board__face"
                role="listitem"
                data-board-face={f.seat}
                {...(marked ? { "data-board-mark": badges.join(",") } : {})}
                aria-label={marked ? `${f.name}, 같은 옷 조각` : f.name}
              >
                <img className="mv-suspect-board__img" src={faceOf(f.seat)} alt="" draggable={false} style={{ borderColor: colorOf(f.seat) }} />
                {marked ? (
                  <span className="mv-suspect-board__badges" aria-hidden="true">
                    {badges.map((b) => (
                      <span key={b} className="mv-suspect-board__badge" data-badge={b}>
                        <V2Icon name={b} size={11} />
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
