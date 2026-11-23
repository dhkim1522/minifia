import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ANSWER_MAX_GRAPHEMES } from "../../shared/game/answerRules";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { emitSignal } from "../audio/signals";
import { GamePhaseHeader } from "../components/v2/GamePhaseHeader";
import { V2Icon } from "../components/v2/V2Icon";
import { DAY_COPY } from "../game/dayView";
import { callTargetsOf } from "../game/hostLine";
import { sinceStartMs } from "../net/cardFace";
import { useComposedText } from "../net/useComposedText";
import { useKeyboardLift } from "../net/useKeyboardLift";
import { useKeywordAnswer } from "../net/useKeywordAnswer";
import type { RoomEvent } from "../net/useRoomConnection";
import "../styles/phase.css";

export interface KeywordProps {
  view: RoomView;
  /** 서버 시각 − 로컬 시각 */
  offset: number;
  /** 연결 번호. 재연결 뒤 조기 진행 표시를 초기화한다 */
  epoch?: number;
  /** [내 역할] 버튼. 모양은 RoomScreen 이 한 가지로 만들어 넘긴다 */
  myRoleButton: ReactNode;
  /** 답을 서버로 보낸다(보냈으면 true) */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 보낼 수 있는가 */
  canSend: boolean;
  /** 혼자 하기의 카드 예시와 미리 적힌 답. 무대의 타이머와 입력 포커스는 숨긴다. */
  timeless?: boolean;
  embedded?: boolean;
  introActive?: boolean;
  /** 서버 오류 프레임 구독 — 금지어 거절을 입력줄이 받는다 */
  onEvent?: (listener: (e: RoomEvent, meta: { epoch: number }) => void) => () => void;
}

/** 키워드 카드 글(P23-4·5). 이 화면의 문구는 이 한 곳이다 — 키워드·역할 값은 데이터 속성에 싣지 않는다. */
const KEYWORD_COPY = {
  genre: (genre: string): string => `주제 · ${genre}`,
  /** 마피아의 키워드 자리(서버가 단어를 보내지 않는다) */
  hidden: "???",
  /** 마피아 키워드 자리의 접근성 이름 */
  hiddenName: "제시어를 볼 수 없어요",
  /** 카드 접근성 이름 */
  cardName: "제시어 카드",
  /** 입력칸과 전송 버튼의 접근성 이름, 서버 접수 안내 */
  inputName: "단서 입력",
  sendName: "단서 보내기",
  sentName: "단서 보냄",
  /** 글자 수: `n/20` */
  count: (n: number): string => `${n}/${ANSWER_MAX_GRAPHEMES}`,
} as const;

/** 메타 줄 요소 id — 입력칸의 aria-describedby 가 가리킨다(한 화면에 하나) */
const META_ID = "mf-keyword-meta";

/** 카드 등장 모션(opacity·translateY, --dur-med)의 길이와 같은 값 — 이만큼 지난 뒤 들어오면(재접속) 모션 없이 바로 보인다. */
const CARD_ENTER_MS = 420;

// 첫날 키워드 카드(23-01, P23-1~5) + 답 입력줄(23-09, P23-6·9~15). 역할 확인과 같은 3D 무대(PreGame, sceneKey preGame) 위 가운데 카드 안에 제시어와 답 입력을 모은다 — 무대는 PreGame 이 깐다.
// 카드는 맨 위 장르, 가운데 큰 키워드(마피아는 ???), 아래 단서 입력칸이다.
// 키워드는 서버가 시민 편 본인에게만 보낸다(me.keyword). 마피아는 키 자체가 없으니 DOM 에도 단어가 없다. 입력줄 표식(data-answer-*)에는 역할·키워드 값이 없다(T-23-33).
// 제시어가 표시되면 입력줄이 열린다. 글이 있으면 입력칸 안에 전송을, 서버 접수 뒤에는 같은 자리에 체크를 보여 준다.
// 입력과 초안 저장은 useKeywordAnswer가 관리한다. 키보드가 열리면 카드가 작아지고 보이는 영역 안에 놓인다.
export function Keyword({ view, offset, epoch = 0, myRoleButton, send, canSend, onEvent, timeless = false, embedded = false, introActive = false }: KeywordProps) {
  const Frame = embedded ? "section" : "main";
  const word = view.me.keyword;
  const genre = view.day?.keyword?.genre ?? "";
  const endsAt = view.phaseEndsAt;
  const durationMs = view.phaseDurationMs;
  const playtest = view.playtest === true;

  // 단계 시작 뒤 420ms 안에 마운트되면 등장 모션, 그보다 늦으면(재접속·새로고침) 바로 보인다. 마운트 때 한 번만 정한다.
  const [still] = useState(() => endsAt === null || durationMs === null || sinceStartMs(endsAt, durationMs, offset, Date.now()) >= CARD_ENTER_MS);

  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const answer = useKeywordAnswer({ view, send, canSend, offset, onEvent });
  const composed = useComposedText(inputRef);
  const { open: kbOpen } = useKeyboardLift({ inputRef, target: rootRef });
  const sent = answer.state === "sent";
  const confirmed = view.me.answer?.final === true;
  const showSend = answer.state === "open" && answer.value.trim() !== "";
  // 사회자가 단서를 요청하고 아직 입력하지 않은 상태에서 입력칸을 강조한다.
  const target = callTargetsOf(view);
  const call = answer.callInput && target !== null && target.kind === "tool" && target.tool === "chat";

  // 단계 안내 뒤 입력칸이 열리면 초점을 준다.
  const wasLocked = useRef(answer.state === "locked");
  useEffect(() => {
    if (!timeless && !playtest && wasLocked.current && answer.state === "open") inputRef.current?.focus({ preventScroll: true });
    wasLocked.current = answer.state === "locked";
  }, [answer.state, timeless, playtest]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!answer.canSubmit) return;
    emitSignal({ kind: "tap" });
    // 한글 조합 중이면 compositionend(최대 IME_WAIT_MS)를 기다려 확정된 값으로 보낸다
    composed.settle((text) => answer.submit(text), "send");
  };

  const onCompositionEnd = () => {
    composed.bind.onCompositionEnd();
    const el = inputRef.current;
    if (el) answer.setValue(el.value);
  };

  const rootCls = kbOpen ? "mf-root mf-reveal mf-keyword is-kb" : "mf-root mf-reveal mf-keyword";
  const cardCls = ["mf-keyword__card", still && "is-still", kbOpen && "is-compact"].filter(Boolean).join(" ");

  return (
    <Frame ref={rootRef} className={rootCls} data-keyword-screen="" data-kb-open={kbOpen ? "true" : undefined}>
      <div className="mf-reveal__dim" aria-hidden="true" />
      <header className="mf-reveal__header">
        <GamePhaseHeader title={DAY_COPY.titles.keyword ?? ""} view={view} offset={offset} epoch={epoch} extra={myRoleButton} timeless={timeless || introActive}
          skipControls={timeless || introActive ? undefined : { send, canSend }} />
      </header>
      <section className="mf-reveal__stage" hidden={introActive}>
        <div className={cardCls} data-keyword-card="" data-compact={kbOpen ? "true" : undefined} role="group" aria-label={KEYWORD_COPY.cardName}>
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
          {!timeless || view.me.answer !== undefined ? <div className="mf-keyword__answer" data-answer-state={answer.state}>
            <span className="mf-sr-only" role="status" data-answer-done={confirmed ? "" : undefined}>{confirmed ? KEYWORD_COPY.sentName : ""}</span>
            <form className="mv-chat__form" onSubmit={onSubmit}>
              <div className={call ? "mv-chat__field is-call" : "mv-chat__field"}>
                <input
                  ref={inputRef}
                  className="mv-chat__input"
                  data-answer-input=""
                  data-answer-action={showSend || sent ? "" : undefined}
                  data-call={call ? "" : undefined}
                  type="text"
                  inputMode="text"
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label={KEYWORD_COPY.inputName}
                  aria-describedby={META_ID}
                  aria-invalid={answer.keywordBlocked || undefined}
                  placeholder={KEYWORD_COPY.inputName}
                  disabled={answer.state === "locked"}
                  readOnly={sent || timeless}
                  value={answer.value}
                  onChange={(e) => answer.setValue(e.target.value, composed.composing())}
                  onCompositionStart={composed.bind.onCompositionStart}
                  onCompositionEnd={onCompositionEnd}
                  onBlur={composed.bind.onBlur}
                />
                {showSend && <button
                  type="submit"
                  className="mv-tool mf-keyword__action"
                  data-answer-send=""
                  disabled={!answer.canSubmit}
                  aria-label={KEYWORD_COPY.sendName}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <V2Icon name="send" size={20} />
                </button>}
                {confirmed && <span className="mf-keyword__action" data-answer-check="" aria-hidden="true">
                  <V2Icon name="check" size={20} />
                </span>}
              </div>
            </form>
            <div className="mf-keyword__meta" id={META_ID} hidden={timeless && playtest && !answer.notice}>
              <span className="mf-keyword__status" role="status" data-answer-notice="">
                {answer.notice ?? ""}
              </span>
              {!playtest ? <span className="mf-keyword__count" data-answer-count="" data-full={answer.count >= ANSWER_MAX_GRAPHEMES ? "true" : undefined}>
                {KEYWORD_COPY.count(answer.count)}
              </span> : null}
              {!timeless && endsAt !== null ? <span className="mf-keyword__seconds" data-answer-seconds="" aria-hidden="true">
                {answer.secondsLeft}초
              </span> : null}
            </div>
          </div> : null}
        </div>
      </section>
    </Frame>
  );
}
