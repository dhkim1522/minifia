import { Fragment, useState } from "react";
import type { ReactElement } from "react";
import { isAlive } from "../../shared/game/alive";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { execTallyText, VERDICT_TEXT } from "../game/verdict";
import { Icon } from "./Icon";
import { ReadOnlyRow } from "./ReadOnlyRow";
import "../styles/day.css";
import "../styles/verdict.css";

// 처형 여부 투표 하단 패널(UI-SPEC 3.3·8.1, 결정 0036): 제목 + 집계 줄 + [찬성][반대] 한 줄.
// 개인별 선택은 익명이다(D-02) — 이 패널이 그리는 것은 내 선택과 서버가 방송한 집계뿐이고, 남의 표는 입력에 없다.
// 이 단계 화면에는 말하기·이모티콘 입구를 두지 않는다(D-12 개정). 버튼은 .mf-seg__b 둘이고 고른 쪽만 aria-pressed·체크 배지다.
// 집계 줄은 aria-live 를 켜지 않는다 — 투표마다 읽히지 않게 하고, 선택 상태는 버튼 aria-pressed 가 알린다.
// 낙관적 선택: ClaimPanel 과 같이 어느 view 를 보고 있을 때 눌렀는지 함께 기억한다. 새 서버 view(다른 객체)가 오면 버려
// 서버 값(view.me.voteAgree)을 따른다 — 서버가 거절하면 같은 소켓에 state 를 다시 보낸다.

export interface ExecVotePanelProps {
  view: RoomView; // execVote 단계
  canSend: boolean;
  send: (msg: ClientMessage) => boolean;
  /** 탈락한 viewer: 버튼 없이 집계 줄과 관전 알약만 본다(D-35). 집계는 살아 있는 사람과 같은 값이다 */
  readOnly?: boolean;
  /** 처형 투표 인트로 카드가 떠 있는 동안(처음 1.6초) true: 집계 줄 회색 부분이 `카드 뒤에서도 바로 고를 수 있어요` 가 된다(UI-SPEC 9.1). 집계 앞부분은 그대로다 */
  introActive?: boolean;
}

export function ExecVotePanel({ view, canSend, send, readOnly = false, introActive = false }: ExecVotePanelProps): ReactElement {
  const [pending, setPending] = useState<{ view: RoomView; agree: boolean } | null>(null);
  const shown = pending !== null && pending.view === view ? pending.agree : view.me.voteAgree;

  const aliveCount = view.players.filter(isAlive).length;
  const { strong, rest: tallyRest } = execTallyText(view.day?.execTally ?? { yes: 0, no: 0 }, aliveCount);
  const rest = introActive ? VERDICT_TEXT.execIntroHint : tallyRest;

  const press = (agree: boolean): void => {
    if (agree === shown) return; // 같은 쪽을 다시 눌러도 아무것도 보내지 않는다. 번복은 반대쪽을 눌러서
    setPending({ view, agree });
    send({ t: "execVote", agree });
  };

  const choices: ReadonlyArray<{ agree: boolean; label: string }> = [
    { agree: true, label: "찬성" },
    { agree: false, label: "반대" },
  ];

  return (
    <div className="mf-execvote">
      <h2 className="mf-claimpanel__title" data-guide="">{VERDICT_TEXT.execTitle}</h2>
      <p className="mf-execvote__tally">
        <b>
          {/* 숫자는 값이 key 라 바뀔 때만 새 노드가 된다 — 팝 애니메이션이 그 숫자에서만 다시 돈다. 문구는 execTallyText 한 곳에서 온다 */}
          {strong.split(/(\d+)/).map((part, i) =>
            i % 2 === 1 ? (
              <span key={`${i}-${part}`} className="mf-execvote__num">
                {part}
              </span>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            ),
          )}
        </b>
        <span>{rest}</span>
      </p>
      {readOnly ? (
        <ReadOnlyRow text={VERDICT_TEXT.spectatorPill} />
      ) : (
        <div className="mf-seg mf-execvote__seg" role="group" aria-label="처형 여부">
          {choices.map(({ agree, label }) => (
            <button
              key={label}
              type="button"
              className="mf-seg__b"
              aria-pressed={shown === agree}
              disabled={!canSend}
              onClick={() => press(agree)}
            >
              {label}
              {shown === agree ? (
                <span className="mf-seg__ok" aria-hidden="true">
                  <Icon name="check" size={12} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
