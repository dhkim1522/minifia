import type { ReactElement } from "react";
import type { ClaimLogEntry } from "../../shared/protocol";
import { CLAIM_JOSA, CLAIM_NONE_LINE, ROLE_TEXT } from "../game/roleText";
import { Sheet } from "./Sheet";
import "../styles/urecord.css";

export interface UserRecordSheetProps {
  /** 기록을 보는 사람의 자리 */
  seat: number;
  nickname: string;
  /** 서버가 모두에게 같게 보낸 공개 주장 기록(일차 오름차순). 이 카드의 유일한 데이터다 */
  claimLog: readonly ClaimLogEntry[];
  onClose: () => void;
}

// 유저 기록 카드(03.1 UI-SPEC C, 결정 0023): 낮에 캐릭터를 누르면 그 사람이 일차마다 한 주장을 최신이 위로 보여 준다.
// 입력은 공개 정보뿐이다 — 실제 역할이나 관전 정보를 받지 않으므로 주장을 참/거짓으로 표시할 수도 없다(D-19).
// 문자열은 모두 React 텍스트다. `<b>` 는 이 컴포넌트가 직접 만드는 직업명 하나뿐이다.
export function UserRecordSheet({ seat, nickname, claimLog, onClose }: UserRecordSheetProps): ReactElement {
  // 입력 배열은 바꾸지 않는다: 이 사람의 줄만 골라 뒤집으면 일차 내림차순이고 같은 일차는 기록 역순이다.
  const mine = claimLog.filter((e) => e.seat === seat).reverse();
  return (
    <Sheet label={`${nickname} 기록`} showClose onClose={onClose} className="mf-sheet--urecord">
      <h2 className="mf-t-heading mf-sheet__title mf-urecord__title">
        <i className="mf-urecord__dot" style={{ background: `var(--seat-${(seat % 8) + 1})` }} aria-hidden="true" />
        {nickname}
      </h2>
      <ol className="mf-urecord__list" role="list">
        {mine.length === 0 ? <li className="mf-urecord__empty">아직 주장 기록이 없어요</li> : null}
        {mine.map((e, i) => (
          <li key={`${e.n}-${i}`} className={e.claim === "none" ? "mf-urecord__row mf-urecord__row--none" : "mf-urecord__row"}>
            <span className="mf-urecord__day">{e.n}일차</span>
            <span className="mf-urecord__text">
              {e.claim === "none" ? (
                CLAIM_NONE_LINE
              ) : (
                <>
                  <b>{ROLE_TEXT[e.claim].name}</b>
                  {CLAIM_JOSA[e.claim]} 주장했어요
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
