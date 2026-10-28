import type { ReactElement } from "react";
import type { ClaimLogEntry, VoteLogEntry } from "../../shared/protocol";
import { recordRows } from "../game/recordRows";
import { CLAIM_JOSA, CLAIM_NONE_LINE, ROLE_TEXT } from "../game/roleText";
import { Sheet } from "./Sheet";
import "../styles/urecord.css";

export interface UserRecordSheetProps {
  /** 기록을 보는 사람의 자리 */
  seat: number;
  nickname: string;
  /** 서버가 모두에게 같게 보낸 공개 주장 기록(일차 오름차순). 이 카드의 유일한 데이터다 */
  claimLog: readonly ClaimLogEntry[];
  /** 서버가 모두에게 같게 보낸 날짜별 공개 투표 기록(04-27). 없으면 이전처럼 주장 줄만 나온다 */
  voteLog?: readonly VoteLogEntry[];
  /** 후보 선택 대상의 닉네임 조회. voteLog 와 함께 준다 */
  nicknameOf?: (seat: number) => string | undefined;
  onClose: () => void;
}

// 유저 기록 카드(03.1 UI-SPEC C, 결정 0023): 낮에 캐릭터를 누르면 그 사람이 일차마다 한 주장을 최신이 위로 보여 준다.
// 04-27(VOTE-04): 같은 일차에 날짜별 투표 줄이 이어진다 — 행 만들기는 game/recordRows.ts 가 하고 이 컴포넌트는 그리기만 한다.
// 입력은 공개 정보뿐이다 — 실제 역할이나 관전 정보를 받지 않으므로 주장을 참/거짓으로 표시할 수도 없다(D-19).
// 문자열은 모두 React 텍스트다. `<b>` 는 이 컴포넌트가 직접 만드는 직업명 하나뿐이다.
export function UserRecordSheet({ seat, nickname, claimLog, voteLog, nicknameOf, onClose }: UserRecordSheetProps): ReactElement {
  // 입력 배열은 바꾸지 않는다. 행은 일차 내림차순이고 같은 일차는 주장 → 투표 순이다.
  const rows = recordRows(seat, claimLog, voteLog ?? [], nicknameOf ?? (() => undefined));
  return (
    <Sheet label={`${nickname} 기록`} showClose onClose={onClose} className="mf-sheet--urecord">
      <h2 className="mf-t-heading mf-sheet__title mf-urecord__title">
        <i className="mf-urecord__dot" style={{ background: `var(--seat-${(seat % 8) + 1})` }} aria-hidden="true" />
        {nickname}
      </h2>
      <ol className="mf-urecord__list" role="list">
        {rows.length === 0 ? <li className="mf-urecord__empty">아직 기록이 없어요</li> : null}
        {rows.map((r) => {
          if (r.kind === "claim") {
            const claim = r.claim!;
            return (
              <li key={r.key} className={claim === "none" ? "mf-urecord__row mf-urecord__row--none" : "mf-urecord__row"}>
                <span className="mf-urecord__day">{r.day}일차</span>
                <span className="mf-urecord__text">
                  {claim === "none" ? (
                    CLAIM_NONE_LINE
                  ) : (
                    <>
                      <b>{ROLE_TEXT[claim].name}</b>
                      {CLAIM_JOSA[claim]} 주장했어요
                    </>
                  )}
                </span>
              </li>
            );
          }
          return (
            <li key={r.key} className="mf-urecord__row mf-urecord__row--vote">
              <span className="mf-urecord__day">{r.day}일차</span>
              <span className="mf-urecord__text">
                {r.kind === "exec" ? (
                  r.text
                ) : (
                  <>
                    <b>{r.target}</b>님에게 투표했어요
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
