import { useState } from "react";
import type { ReactNode } from "react";
import type { RoomView } from "../../shared/protocol";
import { PhaseHeader } from "../components/v2/PhaseHeader";
import { DAY_COPY } from "../game/dayView";
import { sinceStartMs } from "../net/cardFace";
import "../styles/phase.css";

export interface KeywordProps {
  view: RoomView;
  /** 서버 시각 − 로컬 시각 */
  offset: number;
  /** [내 역할] 버튼. 모양은 RoomScreen 이 한 가지로 만들어 넘긴다 */
  myRoleButton: ReactNode;
}

/** 키워드 카드 글(P23-4·5). 이 화면의 문구는 이 한 곳이다 — 키워드·역할 값은 데이터 속성에 싣지 않는다. */
const KEYWORD_COPY = {
  /** 장르 줄: `장르 : 영화` */
  genre: (genre: string): string => `장르 : ${genre}`,
  /** 마피아의 키워드 자리(서버가 단어를 보내지 않는다) */
  hidden: "???",
  /** 마피아 키워드 자리의 접근성 이름 */
  hiddenName: "키워드는 알 수 없어요",
  /** 카드 접근성 이름 */
  cardName: "첫날 문제",
  note: "* 직접적인 키워드는 언급하면 안 됩니다.",
} as const;

/** 카드 등장 모션(opacity·translateY, --dur-med)의 길이와 같은 값 — 이만큼 지난 뒤 들어오면(재접속) 모션 없이 바로 보인다. */
const CARD_ENTER_MS = 420;

// 첫날 키워드 카드(23-01, P23-1~5). 역할 확인과 같은 3D 무대(PreGame, sceneKey preGame) 위 가운데 카드 하나다 — 무대는 PreGame 이 깐다.
// 카드는 맨 위 장르, 가운데 큰 키워드(마피아는 ???), 아래 각주 한 줄이다. 마피아 표식 칩·색·문구는 따로 두지 않는다 — 모양은 시민과 같고 ??? 하나만 다르다.
// 키워드는 서버가 시민 편 본인에게만 보낸다(me.keyword). 마피아는 키 자체가 없으니 DOM 에도 단어가 없다. 입력줄은 23-09 가 더한다.
export function Keyword({ view, offset, myRoleButton }: KeywordProps) {
  const word = view.me.keyword;
  const genre = view.day?.keyword?.genre ?? "";
  const endsAt = view.phaseEndsAt;
  const durationMs = view.phaseDurationMs;

  // 단계 시작 뒤 420ms 안에 마운트되면 등장 모션, 그보다 늦으면(재접속·새로고침) 바로 보인다. 마운트 때 한 번만 정한다.
  const [still] = useState(() => endsAt === null || durationMs === null || sinceStartMs(endsAt, durationMs, offset, Date.now()) >= CARD_ENTER_MS);

  return (
    <main className="mf-root mf-reveal mf-keyword" data-keyword-screen="">
      <div className="mf-reveal__dim" aria-hidden="true" />
      <header className="mf-reveal__header">
        <PhaseHeader title={DAY_COPY.titles.keyword ?? ""} extra={myRoleButton} />
      </header>
      <section className="mf-reveal__stage">
        <div className={still ? "mf-keyword__card is-still" : "mf-keyword__card"} data-keyword-card="" role="group" aria-label={KEYWORD_COPY.cardName}>
          <p className="mf-keyword__genre" data-keyword-genre="">
            {KEYWORD_COPY.genre(genre)}
          </p>
          {word !== undefined ? (
            <p className="mf-keyword__word" data-keyword-word="">
              {word}
            </p>
          ) : (
            <p className="mf-keyword__word is-hidden" data-keyword-word="" aria-label={KEYWORD_COPY.hiddenName}>
              {KEYWORD_COPY.hidden}
            </p>
          )}
          <p className="mf-keyword__note" data-keyword-note="">
            {KEYWORD_COPY.note}
          </p>
        </div>
      </section>
      <div className="mf-reveal__hints" />
    </main>
  );
}
