import { useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import "../../styles/v2.css";
import type { BoardChip, BoardFace, BoardModel } from "../../game/boardView";
import { CARD_TEXT } from "../../game/sceneText";
import { TRACE_MARK } from "../../game/traceMark";
import { TRACE_TEXT } from "../../game/traceText";
import { SPOT_ICON } from "./ClueSpot";
import { PlaceArt } from "./placeArt";
import { V2Icon } from "./V2Icon";

export interface SuspectBoardProps {
  /** boardOf(view) 의 결과(또는 튜토리얼의 가짜 view 에서 같은 함수로 만든 결과) */
  model: BoardModel;
  /** 좌석 → 얼굴 그림 주소(faceSrc) */
  faceOf: (seat: number) => string;
  /** 좌석 → 테두리색(seatColorVar) */
  colorOf: (seat: number) => string;
  onClose: () => void;
}

// 토론의 의심 보드 카드(21페이즈 D-18~D-20, UI-SPEC P21-14·P21-18). 15 의 목격 기록 카드(RecordCard)와 같은 껍데기(.mv-record 면·자리는 GameMap 의 .mf-game__record)를 이어받아
// 위에서 아래로 머리줄("내가 아는 것" + [닫기]) → 내가 받은 단서 칩 → 등불 8개 점 → 산 사람 얼굴 줄(4열, 보기 전용) → 접힌 목격 칸(누르면 기존 기록 줄)을 그린다.
// 서버 훅·내 역할을 읽지 않고 props(파생 결과·얼굴 그림 함수·자리색 함수)만 받는다 — 튜토리얼(21-12)이 가짜 view 로 같은 부품을 쓴다. 안내 문단·"범인"·"증거"·직업 표시 없음(D-20).
// 닉네임은 React 텍스트 노드로만 그린다(innerHTML 없음, T-21-41). 속성 값에는 좌석·줄 수·닫힌 표의 조각 색뿐이다. 등장은 opacity 뿐(--dur-fast), 모션 줄이기에서 즉시.

function chipText(chip: BoardChip): string {
  if (chip.kind === "touched") return CARD_TEXT.touched;
  if (chip.kind === "dark") return CARD_TEXT.dark;
  if (chip.spot === "footprint" && chip.n !== undefined) return String(chip.n);
  return chip.piece !== undefined ? TRACE_TEXT[chip.piece] : CARD_TEXT.none;
}

function Chip({ chip }: { chip: BoardChip }): ReactElement {
  const icon = chip.kind === "clue" && chip.spot === "cloth" ? "thread" : SPOT_ICON[chip.spot];
  return (
    <li className={chip.kind === "clue" ? "mv-board__chip" : "mv-board__chip is-dim"} data-board-chip={chip.spot}>
      <V2Icon name={icon} size={14} />
      <span className="mv-board__chip-text">{chipText(chip)}</span>
    </li>
  );
}

function Face({ face, faceOf, colorOf }: { face: BoardFace; faceOf: (seat: number) => string; colorOf: (seat: number) => string }): ReactElement {
  const first = face.marks[0];
  return (
    <li
      className="mv-board__face"
      data-board-face={face.seat}
      data-mark={first !== undefined ? face.marks.map((m) => m.kind).join(" ") : undefined}
      style={first !== undefined ? ({ "--trace-mark": TRACE_MARK[first.piece] } as CSSProperties) : undefined}
    >
      <img className="mv-board__img" src={faceOf(face.seat)} alt="" draggable={false} style={{ borderColor: colorOf(face.seat) }} />
      <span className="mv-board__name">{face.nickname}</span>
      {first !== undefined ? (
        <span className="mv-board__badge" aria-hidden="true">
          <V2Icon name="thread" size={14} />
        </span>
      ) : null}
    </li>
  );
}

export function SuspectBoard({ model, faceOf, colorOf, onClose }: SuspectBoardProps): ReactElement {
  const [witnessOpen, setWitnessOpen] = useState(false);
  const witness = model.witness !== null && model.witness.length > 0 ? model.witness : null;
  return (
    <section className="mv-record mv-board" role="region" aria-label="의심 보드" data-board="">
      <div className="mv-board__head">
        <V2Icon name="lens" size={20} />
        <span className="mv-board__title">내가 아는 것</span>
        <button type="button" className="mv-board__close mv-closepill" aria-label="닫기" onMouseDown={(e) => e.preventDefault()} onClick={onClose}>
          <V2Icon name="close" size={20} />
        </button>
      </div>
      {model.chips.length > 0 ? (
        <ul className="mv-board__chips" data-board-chips="">
          {model.chips.map((c) => (
            <Chip key={c.spot} chip={c} />
          ))}
        </ul>
      ) : null}
      {model.lamps.length > 0 ? (
        <div className="mv-board__lamps" role="img" data-board-lamps={model.offCount} aria-label={`꺼진 등불 ${model.offCount}개`}>
          {model.lamps.map((on, i) => (
            <span key={i} className={on ? "mv-board__lamp is-on" : "mv-board__lamp"} />
          ))}
        </div>
      ) : null}
      <ul className="mv-board__faces" data-board-faces="">
        {model.faces.map((f) => (
          <Face key={f.seat} face={f} faceOf={faceOf} colorOf={colorOf} />
        ))}
      </ul>
      {witness !== null ? (
        <>
          <button type="button" className="mv-board__witness" data-board-witness="" aria-label={`목격 기록 ${witness.length}줄`} aria-expanded={witnessOpen} onClick={() => setWitnessOpen((o) => !o)}>
            <V2Icon name="eye" size={20} />
            <span className="mv-board__witness-n">{witness.length}</span>
            <span className={witnessOpen ? "mv-board__chev is-open" : "mv-board__chev"} aria-hidden="true">
              <V2Icon name="chevronRight" size={20} />
            </span>
          </button>
          {witnessOpen ? (
            <ul className="mv-record__rows mv-board__rows" data-board-record-rows={witness.length}>
              {witness.map((r) => (
                <li key={r.n} className="mv-record__row" data-record-row="">
                  <span className="mv-record__n">{r.n}</span>
                  <PlaceArt id={r.place} size={24} />
                  <img className="mv-record__face" src={faceOf(r.seat)} alt="" draggable={false} style={{ borderColor: colorOf(r.seat) }} />
                  <span className="mv-record__name">{r.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
