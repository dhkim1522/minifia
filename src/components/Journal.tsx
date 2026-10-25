import type { ReactElement, SyntheticEvent } from "react";
import type { PublicPlayer, RoleRecord } from "../../shared/protocol";
import { JOURNAL_TEXT, journalResult } from "../game/journalText";
import { journalArt } from "../net/assets";
import type { JournalRole } from "../net/assets";
import "../styles/rolecard.css";

// 역할 카드 시트의 [활동 기록] 본문(결정 0026, 시안 R3~R5). 입력은 서버가 본인에게만 보낸 me.records 뿐이다 —
// 남의 기록이 들어올 길이 없다(결정 0002). 기록 줄은 role 로 해석만 하고 서버 값을 바꾸지 않는다.
// 그림은 장식이다: 없거나 실패하면 그 그림만 숨기고 글자로 읽힌다.

export interface JournalProps {
  role: JournalRole;
  /** 일차 오름차순(서버 순서). 화면에서 최신이 위로 뒤집는다 */
  records: readonly RoleRecord[];
  players: readonly PublicPlayer[];
  mySeat: number;
  /** 맨 위(가장 새) 줄부터 몇 줄에 NEW 를 붙이는가 */
  newCount: number;
}

const hideBroken = (e: SyntheticEvent<HTMLImageElement>): void => {
  e.currentTarget.style.display = "none";
};

export function Journal({ role, records, players, mySeat, newCount }: JournalProps): ReactElement {
  const text = JOURNAL_TEXT[role];
  const nameOf = (seat: number): string => (seat === mySeat ? "나" : (players.find((p) => p.seat === seat)?.nickname ?? ""));
  // 읽을 수 없는 모양의 줄은 그리지 않는다. 그린 줄만 세어 NEW 를 단다.
  const rows = [...records].reverse().flatMap((r) => {
    const result = journalResult(role, r);
    return result === null ? [] : [{ r, result }];
  });

  return (
    <section className={`mf-journal mf-journal--${role}`} aria-label={text.name}>
      <header className="mf-journal__h">
        <img className="mf-journal__cover" src={journalArt(role, "cover").src} alt="" aria-hidden="true" draggable={false} onError={hideBroken} />
        <img className="mf-journal__icon" src={journalArt(role, "icon").src} width={20} height={20} alt="" aria-hidden="true" draggable={false} onError={hideBroken} />
        <b>{text.name}</b>
      </header>
      <ol className="mf-journal__l" role="list" style={{ backgroundImage: `url(${journalArt(role, "page").src})` }}>
        {rows.length === 0 ? (
          <li className="mf-journal__empty">{text.empty}</li>
        ) : (
          rows.map(({ r, result }, i) => {
            const isNew = i < newCount;
            const name = nameOf(r.target);
            return (
              <li key={r.n} className="mf-journal__row" aria-label={`${isNew ? "새 기록, " : ""}${r.n}일차 밤, ${name}, ${result.text}`}>
                <span className="mf-journal__d">{`${r.n}일차 밤`}</span>
                <span className="mf-journal__w">
                  <i className="mf-journal__dot" aria-hidden="true" style={{ background: `var(--seat-${(r.target % 8) + 1})` }} />
                  <b>{name}</b>
                </span>
                <span className={`mf-journal__rz mf-journal__rz--${result.tone}`}>{result.text}</span>
                <span className="mf-journal__nw">{isNew ? <span className="mf-journal__new">NEW</span> : null}</span>
              </li>
            );
          })
        )}
      </ol>
    </section>
  );
}
