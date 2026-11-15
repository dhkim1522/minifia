import type { ReactElement } from "react";
import "../../styles/v2.css";
import { CARD_TEXT, footprintLabel } from "../../game/sceneText";
import type { ClueCardModel } from "../../game/sceneView";
import { TRACE_TEXT } from "../../game/traceText";
import { SPOT_ICON } from "./ClueSpot";
import { TraceArt } from "./placeArt";
import { V2Icon } from "./V2Icon";

// 내가 받은 단서 카드(21페이즈 D-14·D-15, UI-SPEC P21-12·P21-16): 아침 스테이지 아래(패널 윗변 위)에 살필 때마다 한 장씩 쌓인다(최대 3). 높이 56·night-800 면·안쪽 12·radius-badge.
// 테두리 1: 받은 단서 = light-lamp 실선 / 그 밖(먼저 손댄 흔적·어두워서 못 봄·아무것도 없음) = gray-500 점선(is-dim). 안: 아이콘 + 한 줄.
//   ① 발자국 = footprint + 숫자 n(aria "발자국 n개", data-count — 발자국 수는 내가 살핀 경우만 있다, P21-16)
//   ② 옷 조각 = TraceArt 28 + 조각 이름(TRACE_TEXT) ③ 창문 = window 아이콘(작게) + TraceArt 28 + 조각 이름
//   먼저 손댄 흔적 / 어두워서 못 봤어요 / 아무것도 없어요 = 그 지점 아이콘(흐림) + 고정 문장
// '범인'·'증거'·'확정'·진홍·역할 단어가 없다(시험이 막는다). 마피아도 시민과 같은 마크업이다(D-15·D-21): 역할 prop 이 없다. 조각 이름은 React 텍스트 노드로만 그린다.
// 등장 애니메이션은 CSS(--dur-pop, 모션 줄이기면 즉시) — 위치 계산이 없다. 값은 서버가 본인에게만 보낸 me.scene 에서만 온다.

export function ClueCard({ card }: { card: ClueCardModel }): ReactElement {
  const { spot, kind } = card;
  const isClue = kind === "clue";
  const cls = isClue ? "mv-clue-card" : "mv-clue-card is-dim";
  if (spot === "footprint" && isClue && card.n !== undefined) {
    return (
      <div className="mv-clue-card is-count" data-clue-card={spot} data-count={String(card.n)} role="status" aria-label={footprintLabel(card.n)}>
        <span className="mv-clue-card__spot" aria-hidden="true">
          <V2Icon name={SPOT_ICON.footprint} size={28} />
        </span>
        <span className="mv-clue-card__n">{card.n}</span>
      </div>
    );
  }
  if (isClue && card.piece !== undefined) {
    return (
      <div className={cls} data-clue-card={spot} role="status">
        <span className="mv-clue-card__art" aria-hidden="true">
          <TraceArt piece={card.piece} size={28} />
          {spot === "window" ? (
            <span className="mv-clue-card__spot mv-clue-card__spot--badge">
              <V2Icon name={SPOT_ICON.window} size={14} />
            </span>
          ) : null}
        </span>
        <span className="mv-clue-card__text">{TRACE_TEXT[card.piece]}</span>
      </div>
    );
  }
  // 받은 단서가 아닌 카드(손댄 흔적·어두워서 못 봄·찾은 게 없음). 단서 값이 빠진 clue 도 안전하게 "아무것도 없어요"로 그린다
  const text = kind === "touched" ? CARD_TEXT.touched : kind === "dark" ? CARD_TEXT.dark : CARD_TEXT.none;
  return (
    <div className="mv-clue-card is-dim" data-clue-card={spot} role="status">
      <span className="mv-clue-card__spot" aria-hidden="true">
        <V2Icon name={SPOT_ICON[spot]} size={28} />
      </span>
      <span className="mv-clue-card__text">{text}</span>
    </div>
  );
}
