import type { ReactElement } from "react";
import type { InvestigationRecord, PublicPlayer } from "../../shared/protocol";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import "../styles/day.css";
import "../styles/records.css";

// 경찰 전용 [수사 기록] 버튼과 시트(시안 N2·N6, 결정 0018~0021). 입력은 서버가 경찰 본인에게만 보낸 me.records 뿐이다 —
// 남의 기록이 들어올 길이 없다(결정 0002). 둘은 같은 상태(열림·NEW)를 나누어 쓰는 짝이라 한 파일에 둔다.

export interface RecordsButtonProps {
  /** 아직 열어 보지 않은 기록이 있는가 — 켜지면 오른쪽 위 점과 "새 기록" 이름 */
  hasNew: boolean;
  onOpen: () => void;
}

// [내 역할] 과 같은 보조 버튼. 점은 장식이고 새 기록 여부는 이름이 읽는다.
export function RecordsButton({ hasNew, onOpen }: RecordsButtonProps): ReactElement {
  return (
    <Button
      variant="secondary"
      compact
      className="mf-records-btn"
      icon={<Icon name="notebook" size={20} />}
      aria-label={hasNew ? "수사 기록, 새 기록" : "수사 기록"}
      onClick={onOpen}
    >
      수사 기록
      {hasNew ? <span className="mf-records-btn__dot" aria-hidden="true" /> : null}
    </Button>
  );
}

export interface RecordsSheetProps {
  /** 일차 오름차순(서버 순서). 화면에서 최신이 위로 뒤집는다 */
  records: InvestigationRecord[];
  players: PublicPlayer[];
  /** 맨 위(가장 새) 줄에 NEW 를 붙이는가 */
  newestIsNew: boolean;
  onClose: () => void;
}

export function RecordsSheet({ records, players, newestIsNew, onClose }: RecordsSheetProps): ReactElement {
  const nicknameOf = (seat: number): string => players.find((p) => p.seat === seat)?.nickname ?? "";
  const newestFirst = [...records].reverse();
  return (
    <Sheet label="수사 기록" showClose onClose={onClose} className="mf-sheet--chat mf-records-sheet">
      <h2 className="mf-t-heading mf-sheet__title">마피아 수사 기록</h2>
      <ol className="mf-records" role="list">
        {newestFirst.length === 0 ? (
          <li className="mf-records__empty">아직 조사한 사람이 없어요</li>
        ) : (
          newestFirst.map((r, i) => {
            const isNew = i === 0 && newestIsNew;
            const name = nicknameOf(r.target);
            const result = r.isMafia ? "마피아" : "마피아 아님";
            return (
              <li key={r.n} className="mf-records__row" aria-label={`${isNew ? "새 기록, " : ""}${r.n}일차 밤, ${name}, ${result}`}>
                <span className="mf-records__d">{`${r.n}일차 밤`}</span>
                <span className="mf-records__w">
                  <i className="mf-records__dot" aria-hidden="true" style={{ background: `var(--seat-${r.target + 1})` }} />
                  {name}
                </span>
                <span className={`mf-records__rz${r.isMafia ? " mf-records__rz--mafia" : ""}`}>{result}</span>
                <span className="mf-records__nw">{isNew ? <span className="mf-records__new">NEW</span> : null}</span>
              </li>
            );
          })
        )}
      </ol>
    </Sheet>
  );
}
