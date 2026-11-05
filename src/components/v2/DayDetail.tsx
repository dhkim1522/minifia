import "../../styles/v2.css";
import type { DayLines } from "../../game/timelineView";
import { ROLE_TEXT } from "../../game/roleText";
import { RoleChip } from "./RoleChip";
import { TlFace } from "./TimelineStrip";
import { V2Icon } from "./V2Icon";

// 하루 상세 (11-11, 결정 D-8·D-9, 0066-1). 선택한 일차의 줄들을 얼굴·아이콘·숫자로만 보여 준다 — 문장이 없다(보이는 글자는 숫자뿐).
// 줄: 지목(얼굴 → 얼굴 + 받은 사람 위 득표 숫자) · 찬반(thumbUp/thumbDown + 얼굴들) · 주장(얼굴 + 직업 칩, 마피아의 거짓 주장은 진홍 점선) ·
// 말 바꿈(얼굴 + swap) · 귓속말(얼굴 → 얼굴 쌍, 누르면 귓속말 탭으로) · 밤(마피아 얼굴 → 대상 얼굴 + 결과 아이콘). 해당 내용이 없는 줄은 그리지 않는다.
// 접근성 이름(img alt·aria-label)은 닉네임·직업 이름이고 닉네임은 React 속성으로만 그린다(T-11-37). 득표 배지는 숫자만 그린다(VoteBadge 의 '표' 단위가 글자라 쓰지 않는다).

export interface DayDetailProps {
  lines: DayLines;
  /** 좌석 → 닉네임(없으면 빈 이름) */
  contacts: ReadonlyMap<number, string>;
  /** 귓속말 쌍을 눌렀다: 귓속말 탭의 그날로 이동한다 */
  onJumpWhisper?(n: number): void;
}

function Arrow() {
  return (
    <svg className="mf-tl__arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

const RESULT_ICON = { died: "ghost", saved: "heal", none: "quiet" } as const;

export function DayDetail({ lines, contacts, onJumpWhisper }: DayDetailProps) {
  const name = (seat: number): string => contacts.get(seat) ?? "";
  const { pointing, ballots, claims, swaps, whispers, night } = lines;
  return (
    <div className="mf-tl__detail" data-day-detail={lines.n}>
      {pointing.counts.length > 0 ? (
        <div className="mf-tl__row" data-row="pointing">
          {pointing.counts.map(({ seat, count }) => (
            <div className="mf-tl__group" data-point-group={seat} key={seat}>
              <span className="mf-tl__faces" data-from="">
                {pointing.arrows.filter((a) => a.to === seat).map((a) => (
                  <TlFace key={a.from} seat={a.from} name={name(a.from)} />
                ))}
              </span>
              <Arrow />
              <span className="mf-tl__target" data-to="">
                <span className="mf-tl__votes" data-votes="">{count}</span>
                <TlFace seat={seat} name={name(seat)} />
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {ballots !== null ? (
        <div className="mf-tl__row" data-row="ballots">
          {ballots.yes.length > 0 ? (
            <span className="mf-tl__group" data-ballot="yes">
              <V2Icon name="thumbUp" size={24} />
              <span className="mf-tl__faces">
                {ballots.yes.map((seat) => (
                  <TlFace key={seat} seat={seat} name={name(seat)} />
                ))}
              </span>
            </span>
          ) : null}
          {ballots.no.length > 0 ? (
            <span className="mf-tl__group" data-ballot="no">
              <V2Icon name="thumbDown" size={24} />
              <span className="mf-tl__faces">
                {ballots.no.map((seat) => (
                  <TlFace key={seat} seat={seat} name={name(seat)} />
                ))}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      {claims.length > 0 ? (
        <div className="mf-tl__row" data-row="claims">
          {claims.map((c) => (
            <span className={c.lie ? "mf-tl__claim is-lie" : "mf-tl__claim"} data-claim={c.seat} data-lie={String(c.lie)} key={c.seat}>
              <TlFace seat={c.seat} name={name(c.seat)} />
              <span className="mf-tl__claimchip" aria-label={ROLE_TEXT[c.claimed].name}>
                <RoleChip role={c.claimed} />
              </span>
            </span>
          ))}
        </div>
      ) : null}
      {swaps.length > 0 ? (
        <div className="mf-tl__row" data-row="swaps">
          {swaps.map((seat) => (
            <span className="mf-tl__swap" data-swap={seat} key={seat}>
              <TlFace seat={seat} name={name(seat)} />
              <span className="mf-tl__mark">
                <V2Icon name="swap" size={16} />
              </span>
            </span>
          ))}
        </div>
      ) : null}
      {whispers.length > 0 ? (
        <div className="mf-tl__row" data-row="whispers">
          {whispers.map((w, i) => (
            <button type="button" className="mf-tl__pair" data-whisper-pair="" data-from={w.from} data-to={w.to} aria-label={`${name(w.from)} → ${name(w.to)}`} key={i} onClick={() => onJumpWhisper?.(lines.n)}>
              <TlFace seat={w.from} name={name(w.from)} size={24} />
              <Arrow />
              <TlFace seat={w.to} name={name(w.to)} size={24} />
            </button>
          ))}
        </div>
      ) : null}
      {night !== null ? (
        <div className="mf-tl__row" data-row="night">
          <span className="mf-tl__group">
            <span className="mf-tl__faces" data-from="">
              {night.mafias.map((seat) => (
                <TlFace key={seat} seat={seat} name={name(seat)} />
              ))}
            </span>
            {night.target !== undefined ? (
              <>
                <Arrow />
                <span className="mf-tl__target" data-to="">
                  <TlFace seat={night.target} name={name(night.target)} dead={night.result === "died"} />
                </span>
              </>
            ) : null}
            <span className="mf-tl__result" data-night-result={night.result}>
              <V2Icon name={RESULT_ICON[night.result]} size={24} />
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
