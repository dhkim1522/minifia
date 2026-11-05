import type { ReactNode } from "react";
import "../../styles/v2.css";
import type { DayCard, NightCell } from "../../game/timelineView";
import { ROLE_TEXT } from "../../game/roleText";
import { faceSrc } from "../../net/assets";
import { RoleChip } from "./RoleChip";
import { V2Icon } from "./V2Icon";

// 일차 카드 띠 (11-11, 결정 D-8, UI-SPEC C). 카드 72×112 를 가로로 늘어놓는다(간격 8, 가로 스크롤 스냅). 첫 일차부터 보인다.
// 카드 위 절반 = 낮(처형된 사람 얼굴 32 + 진짜 직업 칩 소형, 처형 없음이면 quiet), 아래 절반 = 밤(습격 대상 얼굴 — 죽었으면 어둡게 + ghost,
// 의사가 지켰으면 얼굴 아래 모서리에 heal, 지목 없음이면 quiet). 카드 위 일차 숫자 14px. 마지막 일차가 낮에 끝났으면 밤 칸은 비운다.
// 순수 표시다: 어느 카드가 선택됐는지는 부르는 쪽이 쥔다. 닉네임은 img alt·aria-label 속성으로만 그린다(T-11-37).

export interface TimelineStripProps {
  cards: readonly DayCard[];
  /** 선택된 일차 */
  selected: number;
  onSelect(n: number): void;
  /** 좌석 → 닉네임(없으면 빈 이름) */
  contacts: ReadonlyMap<number, string>;
}

/** 기록 탭의 둥근 얼굴 한 개(카드·상세 공용) */
export function TlFace({ seat, name, size = 28, dead }: { seat: number; name: string; size?: number; dead?: boolean }) {
  return <img className={dead ? "mf-tl__face is-dead" : "mf-tl__face"} src={faceSrc(seat)} alt={name} width={size} height={size} draggable={false} />;
}

function nightCell(night: NightCell, contacts: ReadonlyMap<number, string>): { kind: string; body: ReactNode } {
  if (night === null) return { kind: "empty", body: null };
  if (night.kind === "none") return { kind: "none", body: <V2Icon name="quiet" size={24} className="mf-tl__quiet" /> };
  const name = contacts.get(night.seat) ?? "";
  if (night.kind === "died") {
    return {
      kind: "died",
      body: (
        <span className="mf-tl__face-wrap">
          <TlFace seat={night.seat} name={name} size={32} dead />
          <span className="mf-tl__mark" data-night-mark="ghost">
            <V2Icon name="ghost" size={16} />
          </span>
        </span>
      ),
    };
  }
  return {
    kind: "saved",
    body: (
      <span className="mf-tl__face-wrap">
        <TlFace seat={night.seat} name={name} size={32} />
        <span className="mf-tl__mark" data-night-mark="heal">
          <V2Icon name="heal" size={16} />
        </span>
      </span>
    ),
  };
}

export function TimelineStrip({ cards, selected, onSelect, contacts }: TimelineStripProps) {
  return (
    <div className="mf-tl__strip" data-timeline-strip="">
      {cards.map((card) => {
        const on = card.n === selected;
        const executed = card.day.kind === "executed" ? card.day : null;
        const night = nightCell(card.night, contacts);
        const who = executed ? `${contacts.get(executed.seat) ?? ""} ${ROLE_TEXT[executed.job].name}` : "";
        return (
          <div className="mf-tl__item" key={card.n}>
            <span className="mf-tl__num">{card.n}</span>
            <button type="button" className={on ? "mf-tl__card is-selected" : "mf-tl__card"} data-day-card={card.n} aria-pressed={on} aria-label={`${card.n}일차 ${who}`.trim()} onClick={() => onSelect(card.n)}>
              <span className="mf-tl__half" data-half="day" data-kind={card.day.kind}>
                {executed ? (
                  <span className="mf-tl__face-wrap">
                    <TlFace seat={executed.seat} name={contacts.get(executed.seat) ?? ""} size={32} />
                    <span className="mf-tl__chip">
                      <RoleChip role={executed.job} />
                    </span>
                  </span>
                ) : (
                  <V2Icon name="quiet" size={24} className="mf-tl__quiet" />
                )}
              </span>
              <span className="mf-tl__half" data-half="night" data-kind={night.kind}>
                {night.body}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
