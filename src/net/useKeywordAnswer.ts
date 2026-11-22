// 첫날 키워드 단계의 답 입력 상태와 전송 흐름 (23-09, UI-SPEC P23-6·10~14, 결정 D-07).
//
// 서버가 규칙을 정하고 이 훅은 표시·전송만 한다(결정 0002). 서버가 단계 안이면 언제든 받으므로(재접속 안전) 잠금·연타 무시·빈 글 막기는 모두 화면 쪽 표시 한 겹이다.
// 단계 시작 전에는 잠기고, 시작 시 쓰기(open), 제출 시 확정(sent)으로 바뀐다. 정답을 받은 사람에게는 본인 카드와 일치하는 초안을 미리 알려 준다.
// 별칭 목록과 공개할 답의 판정은 서버가 관리한다.
//
// 초안(22 유언 useWill 과 같은 규칙·수치): 입력이 바뀌고 600ms 뒤 한 번, 마감 700ms 전에 한 번 더 {t:"answer", final:false}. 같은 글은 다시 보내지 않고 거절은 알림 없이 넘긴다.
// 확정: {t:"answer", final:true} 를 보내고 서버 응답을 기다리지 않고 곧바로 sent. 확정을 보낸 뒤 REJECT_WINDOW_MS 안에 서버 view 가 확정을 돌려주기 전에 오는 error 프레임은
// 그 확정의 거절이다. 금지어 거절은 BAD_MESSAGE 로만 온다(화면이 빈 글·20자 초과·잠김·연타를 미리 막아 그 시간의 BAD_MESSAGE 는 금지어뿐이다, GameMap sendGuard 선례).
// WRONG_PHASE(마감 직후 도착한 확정)·RATE_LIMITED 는 거절이 아니라 조용히 넘긴다 — 알림도 deny 소리도 없다(WR-02).
// 거절이면 글을 보존하고 입력 가능 상태로 돌아간다. 시간이 지난 뒤 온 거절은 조용히 넘긴다.
// 복원: 본인 view 의 me.answer(확정 우선, 없으면 초안)가 쓰던 글·제출 상태의 기준이다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { emitSignal } from "../audio/signals";
import { ANSWER_MAX_GRAPHEMES, ANSWER_MIN_GAP_MS } from "../../shared/game/answerRules";
import { sanitizeChatText } from "../../shared/game/chatRules";
import { violatesKeyword } from "../../shared/game/keywordGuard";
import { countGraphemes } from "../../shared/nickname";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { clampGraphemes } from "../components/v2/WillSheet";
import { useCountdown } from "./countdown";
import { usePendingServerTime } from "./usePendingServerTime";
import type { RoomEvent } from "./useRoomConnection";

/** 입력이 바뀐 뒤 초안을 보내기까지(ms) — 서버 간격(ANSWER_MIN_GAP_MS 400)보다 길다 */
export const KEYWORD_AUTOSAVE_MS = 600;
/** 마감 이만큼 전에 쓰던 글을 한 번 더 보낸다(ms) */
export const KEYWORD_LAST_SEND_LEAD_MS = 700;
/** 거절 알림이 떠 있는 시간(ms) — 채팅 거절 알림과 같다 */
export const KEYWORD_NOTICE_MS = 2500;
/** 확정을 보낸 뒤 이 시간 안의 error 프레임을 그 확정의 거절로 본다(ms) */
export const KEYWORD_REJECT_WINDOW_MS = 3000;
export const KEYWORD_REJECT_COPY = "쓸 수 없는 말이에요";
export const KEYWORD_BLOCKED_COPY = "제시어가 들어 있어요. 다른 표현으로 바꿔 주세요.";

export type KeywordAnswerState = "locked" | "open" | "sent";

export interface UseKeywordAnswerOptions {
  view: RoomView;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 서버 시각 − 로컬 시각(ms). 기본 0 */
  offset?: number;
  /** 서버 오류 프레임을 받는 구독(RoomConnection.onEvent) */
  onEvent?: (listener: (e: RoomEvent, meta: { epoch: number }) => void) => () => void;
}

export interface KeywordAnswerApi {
  /** 입력칸에 보이는 글(조합 중이 아니면 20자소로 잘린 값) */
  value: string;
  /** composing 이 참이면 조합 중이라 자르지 않고 담는다(조합이 깨지지 않게). 끝나면 다시 불러 자른다. locked·sent 에서는 무시한다 */
  setValue: (raw: string, composing?: boolean) => void;
  state: KeywordAnswerState;
  /** 마감까지 남은 초(올림, 0 이상) */
  secondsLeft: number;
  /** 글자 수(자소, 20 상한) */
  count: number;
  /** 거절 알림 문구. 없으면 null */
  notice: string | null;
  /** 공개할 수 없는 제시어가 포함된 본인 초안 */
  keywordBlocked: boolean;
  /** [보내기]가 눌릴 수 있는가: 쓰는 중 + 글이 있음 + 연결됨 */
  canSubmit: boolean;
  /** 확정 제출. text 는 조합이 끝난 DOM 값(없으면 지금 value). 400ms 안 연타는 조용히 무시한다 */
  submit: (text?: string) => void;
  /** 입력칸을 빛낼 때(쓸 수 있고 아직 한 글자도 안 썼다) */
  callInput: boolean;
}

export function useKeywordAnswer({ view, send, canSend = true, offset = 0, onEvent }: UseKeywordAnswerOptions): KeywordAnswerApi {
  const endsAt = view.phaseEndsAt;
  const durationMs = view.phaseDurationMs;
  const word = view.me.keyword;
  const serverAnswer = view.me.answer;
  const serverFinal = serverAnswer?.final === true;
  const serverText = serverAnswer?.text ?? "";

  const [value, setRaw] = useState(serverText);
  const [localSent, setLocalSent] = useState<number | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const typed = useRef(false); // 사용자가 직접 글을 바꿨는가(그 뒤 서버 초안으로 덮지 않는다)

  const sent = serverFinal || (localSent !== null && localSent === endsAt);

  // 복원: 서버가 확정을 돌려주면 그 값이 기준이다. 초안은 아직 아무것도 안 썼을 때만 채운다.
  useEffect(() => {
    if (serverFinal) {
      setRaw(serverText);
      return;
    }
    if (!typed.current && serverText !== "") setRaw(serverText);
  }, [serverFinal, serverText]);

  // 서버 시작 시각부터 바로 입력받는다. 예전 view에 시작 시각이 없으면 마감과 길이에서 구한다.
  const startAt = view.phaseStartsAt ?? (endsAt !== null && durationMs !== null ? endsAt - durationMs : undefined);
  const locked = usePendingServerTime(startAt, offset) !== undefined;
  const state: KeywordAnswerState = sent ? "sent" : locked ? "locked" : "open";
  const { seconds: secondsLeft } = useCountdown(endsAt ?? 0, durationMs ?? 0, offset);
  const clamped = clampGraphemes(value, ANSWER_MAX_GRAPHEMES);
  const count = Math.min(countGraphemes(value), ANSWER_MAX_GRAPHEMES);
  const isKeywordBlocked = (text: string): boolean => {
    if (word === undefined) return false;
    const cleaned = sanitizeChatText(text);
    return cleaned.ok && (
      (serverAnswer?.keywordBlocked === true && cleaned.text === serverText) ||
      violatesKeyword(cleaned.text, { word, aliases: [] })
    );
  };
  const keywordBlocked = state === "open" && isKeywordBlocked(clamped);
  const notice = keywordBlocked ? KEYWORD_BLOCKED_COPY
    : rejected === clamped ? KEYWORD_REJECT_COPY : null;

  const setValue = useCallback(
    (raw: string, composing = false) => {
      if (state !== "open") return;
      typed.current = true;
      setRaw(composing ? raw : clampGraphemes(raw, ANSWER_MAX_GRAPHEMES));
    },
    [state],
  );

  // 최신 값을 타이머 콜백이 읽는다
  const live = useRef({ clamped, send, canSend, serverText, serverFinal });
  useLayoutEffect(() => {
    live.current = { clamped, send, canSend, serverText, serverFinal };
  });
  /** 마지막으로 서버에 보낸 정리 전 글(같은 글은 다시 보내지 않는다) */
  const lastSent = useRef<string | null>(null);
  const draftOn = state === "open" && canSend;

  const saveDraft = useCallback(() => {
    const { clamped: text, send: out, canSend: ok, serverText: server, serverFinal: fin } = live.current;
    if (!ok || fin) return;
    // 지운 글도 보낸다: 서버는 공백뿐인 초안을 키째 지운다 — 안 보내면 지우기 전 초안이 마감에 나간다
    if (text === (lastSent.current ?? server)) return;
    if (out({ t: "answer", text, final: false }) === false) return;
    lastSent.current = text;
  }, []);

  useEffect(() => {
    if (!draftOn) return;
    const timer = setTimeout(saveDraft, KEYWORD_AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draftOn, value, saveDraft]);
  useEffect(() => {
    if (!draftOn || endsAt === null) return;
    const wait = Math.max(0, endsAt - (Date.now() + offset) - KEYWORD_LAST_SEND_LEAD_MS);
    const timer = setTimeout(saveDraft, wait);
    return () => clearTimeout(timer);
  }, [draftOn, endsAt, offset, saveDraft]);

  // 확정 제출 · 연타 무시
  const finalAt = useRef<number | null>(null);
  const lastSubmitAt = useRef<number | null>(null);
  const canSubmit = state === "open" && canSend && (endsAt === null || secondsLeft > 0) && clamped.trim() !== "" && !keywordBlocked;

  const submit = (text?: string): void => {
    const now = Date.now();
    if (state !== "open" || !canSend || (endsAt !== null && now + offset >= endsAt)) return;
    // 한글 조합 뒤 달라진 최종 DOM 값에도 같은 기준을 적용한다.
    const out = clampGraphemes(text ?? value, ANSWER_MAX_GRAPHEMES);
    if (out.trim() === "" || isKeywordBlocked(out)) return;
    if (lastSubmitAt.current !== null && now - lastSubmitAt.current < ANSWER_MIN_GAP_MS) return;
    lastSubmitAt.current = now;
    if (send({ t: "answer", text: out, final: true }) === false) return;
    typed.current = true;
    lastSent.current = out;
    finalAt.current = now;
    setRaw(out);
    setRejected(null);
    setLocalSent(endsAt);
  };

  // 거절: 확정을 보낸 뒤 3초 안, 서버가 확정을 돌려주기 전의 error 프레임
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    if (!onEvent) return;
    return onEvent((e) => {
      if (e.t !== "error" || e.code !== "BAD_MESSAGE") return; // 금지어 거절은 BAD_MESSAGE 뿐이다
      const at = finalAt.current;
      if (at === null || live.current.serverFinal) return;
      if (Date.now() - at > KEYWORD_REJECT_WINDOW_MS) return;
      finalAt.current = null;
      lastSent.current = null;
      setLocalSent(null);
      setRejected(live.current.clamped);
      emitSignal({ kind: "deny" });
      clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setRejected(null), KEYWORD_NOTICE_MS);
    });
  }, [onEvent]);

  return {
    value,
    setValue,
    state,
    secondsLeft,
    count,
    notice,
    keywordBlocked,
    canSubmit,
    submit,
    callInput: state === "open" && value === "",
  };
}
