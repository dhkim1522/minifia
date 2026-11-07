import type { ReactElement } from "react";
import "../../styles/v2.css";
import { placeIconOf } from "../../game/placeText";
import type { RecordRow } from "../../game/recordView";
import { V2Icon } from "./V2Icon";

export interface RecordCardProps {
  /** 시간순 줄(최대 RECORD_MAX). 비어 있으면 줄 영역 없이 "0" 만 */
  rows: readonly RecordRow[];
  /** 좌석 → 얼굴 그림 주소(faceSrc) */
  faceOf: (seat: number) => string;
  /** 좌석 → 테두리색(seatColorVar) */
  colorOf: (seat: number) => string;
  onClose: () => void;
}

// 목격 기록 카드(15-07, ERRAND-05·D-04, UI-SPEC "목격 기록 카드 계약"). 심부름 중 내 근처를 지나간 사람과 그때 가장 가까운 장소만 보여 준다.
// 역할·확신·수상함 표시와 채팅 자동 입력은 없다 — 서버가 준 사실의 목록이다. 위치는 모른다(GameMap 이 .mf-game__record 로 정한다).
// 닉네임은 React 텍스트 노드로만 그린다(innerHTML 없음, T-15-29). 속성 값에는 줄 수뿐이다.
export function RecordCard({ rows, faceOf, colorOf, onClose }: RecordCardProps): ReactElement {
  return (
    <section className="mv-record" data-record-card="" data-record-rows={rows.length} aria-label="기록">
      <div className="mv-record__head">
        <V2Icon name="eye" size={24} />
        <span className="mv-record__count">{rows.length}</span>
        <button type="button" className="mv-record__close mv-closepill" aria-label="닫기" data-tool-label="닫기" onMouseDown={(e) => e.preventDefault()} onClick={onClose}>
          <V2Icon name="close" size={20} />
          <span className="mv-closepill__label">닫기</span>
        </button>
      </div>
      {rows.length === 0 ? null : (
        <ul className="mv-record__rows">
          {rows.map((r) => (
            <li key={r.n} className="mv-record__row" data-record-row="">
              <span className="mv-record__n">{r.n}</span>
              <V2Icon name={placeIconOf(r.place)} size={24} />
              <img className="mv-record__face" src={faceOf(r.seat)} alt="" draggable={false} style={{ borderColor: colorOf(r.seat) }} />
              <span className="mv-record__name">{r.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
