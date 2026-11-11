import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type CSSProperties, type ReactNode, type Ref } from "react";
import "../../styles/v2.css";
import { CHAT_MAX_GRAPHEMES } from "../../../shared/game/chatRules";
import { CHAT_TEXT } from "../../game/chatText";
import { AUTO_SCROLL_SLOP_PX, DUP_SUBMIT_MS, IME_WAIT_MS, LOG_FADE_H, LOG_H, LOG_OPEN_MAX, OPEN_STAGE_MIN, TAIL_WINDOW_MS } from "../../game/chatUi";
import type { EmoteId } from "../../../shared/protocol";
import { EMOTE_TEXT } from "../../game/chatText";
import { EmoteTray } from "./EmoteTray";
import { ChatLines } from "./ChatLines";
import { V2Icon, type V2IconName } from "./V2Icon";

// 채팅 패널(기록 칸 + 입력줄). design/v2.0/design-system/components/bundle.js 의 ChatPanel 과
// bundle.css 의 .mv-chat* 를 React 19 로 옮겼다(승인 2026-10-31). 같은 클래스 이름(mv-chat*)을 쓴다.
//
// 이 페이즈 속성 범위: messages·value·onChange·onSend·inputId + 변형 logHeight(고정 높이)·compact(키보드 열림)·channel(채널 아이콘).
// 승인 속성 tabs 는 받지 않는다(11페이즈). emotes·onEmote 는 10페이즈(10-05)에서 받는다: 입력줄 맨 앞 동작 버튼(face)이 5+4 아이콘 판을 연다
// (emotes 가 비었거나 onSend 가 없으면 버튼 DOM 이 없다). onWill·willOpen·willSaved 는 9페이즈에서 받는다:
// 깃펜은 입력줄 오른쪽 끝, 보내기 버튼 뒤에 둔다(사용자 결정 2026-11-03, 결정 0062 가 0054 의 위치를 바꾼다).
// form 이 flex 이고 입력칸이 flex 1 이라 깃펜 버튼(48×48)이 들어올 자리를 막지 않는다.
//
// 규칙
// - 줄 본문·닉네임은 React 텍스트 노드로만 그린다(HTML 주입·링크 변환·마크다운 없음, T-07-07).
// - 채널로 줄을 거르는 속성은 없다 — 받을 권리가 없는 줄은 서버가 보내지 않는다(결정 0002·0021).
// - 보내기 전에 내 줄을 미리 그리지 않는다(낙관적 표시 없음). 받은 messages 만 그린다.
// - 제출은 form onSubmit 한 길이다. 입력칸 값은 onChange 에서 가공하지 않고, 보낼 때 DOM 입력칸의 현재 값을 읽는다.
// - 한글 조합: 조합 중에 보내면 compositionend 를 기다려(최대 IME_WAIT_MS) 확정된 값을 보낸다. 같은 문장이 DUP_SUBMIT_MS 안에
//   다시 제출되면 무시하고, 보낸 직후 TAIL_WINDOW_MS 안에 끝난 조합이 보낸 문장의 끝부분이면 되살아난 꼬리 글자로 보고 한 번 더 비운다.
//   happy-dom 은 실제 IME 를 재현하지 못하므로 이벤트 순서만 시험한다(실제 조합은 07-19 CDP·07-21 iPhone).
// - 18.1: 기록 칸 = 두 줄 창. 0083-4: 누르면 별도 시트 없이 제자리에서 위로 늘어난다(open 상태 하나, [data-chat-open] 이 aria-expanded 로 말한다).
//   늘어난 높이는 CSS 한 규칙(.mv-chat__log.is-open 의 clamp, chatUi.openLogHeight 와 같은 식)이 그린다 — 키보드가 움직여도 다시 그리지 않는다.
// - 세 변형: logHeight(고정 높이)·compact(키보드 열림, 아래 여백은 부르는 쪽 CSS)·channel(입력칸 앞 채널 아이콘).
// - 역할 단어가 든 문구(마피아·유령)는 channelUi 의 해당 채널 분기 안에서만 꺼낸다 — all 이면 DOM 에 그 단어가 없다(T-07-08).

export interface ChatPanelMessage {
  key: string;
  /** vote = 지목 기록 줄(앞에 point 14), hot = 눈여겨볼 줄(brass-200, 아이콘 없음), card = 유언·쪽지·경찰 카드(9페이즈), whisper = 받은·보낸 귓속말 비공개 블록(09.1.1-09). divider·tabs 는 11페이즈 */
  kind: "player" | "system" | "vote" | "hot" | "card" | "whisper";
  /** 귓속말 줄의 보임: public = 공개 사실 줄(system), in = 받은 비공개 블록, out = 보낸 비공개 블록. data-whisper 값이다 */
  whisper?: "public" | "in" | "out";
  text: string;
  /** 자리 번호 0~7 → 구분색 var(--seat-(n+1)) */
  seat?: number;
  name?: string;
  me?: boolean;
  ch?: "all" | "mafia" | "ghost";
  icon?: V2IconName;
  /** kind card 일 때 종류(data-card 값) */
  card?: "will" | "note" | "eye" | "ballots";
  /** card ballots 일 때 찬반 기록: 좌석 + 이름(자리 번호 오름차순, 09.1.1-12) */
  ballots?: { yes: { seat: number; name: string }[]; no: { seat: number; name: string }[] };
  /** 카드 제목 */
  title?: string;
  /** mafia = 쪽지 카드(진홍 테두리·제목) */
  tone?: "mafia";
}

export interface ChatPanelProps {
  messages: ChatPanelMessage[];
  value: string;
  onChange(v: string): void;
  /** 없으면 입력줄을 그리지 않는다 */
  onSend?(text: string): void;
  /** 보는 사람의 채널. 기본 all */
  channel?: "all" | "mafia" | "ghost";
  /** 기록 칸 고정 높이 px */
  logHeight: number;
  compact?: boolean;
  sendDisabled?: boolean;
  sendDim?: boolean;
  notice?: string | null;
  quiet?: boolean;
  inputId?: string;
  inputRef?: Ref<HTMLInputElement>;
  onInputFocus?(): void;
  onInputBlur?(): void;
  onComposingChange?(composing: boolean): void;
  /** 동작 판의 칸 id(판 순서). 없거나 비면 동작 버튼을 그리지 않는다(10-05) */
  emotes?: readonly EmoteId[];
  /** 칸을 골랐다. 보내기만 하고 미리 재생하지 않는다(D-9) */
  onEmote?(id: EmoteId): void;
  /** 내 캐릭터가 걷는 중이거나 내 동작이 재생 중이다: 칸이 aria-disabled(불투명도 0.45)이고 눌러도 아무 일이 없다(D-10) */
  emoteBlocked?: boolean;
  /** 재생 중인 내 동작: 그 칸에 안쪽 테두리 */
  emotePlaying?: EmoteId | null;
  /** 있으면 입력줄 오른쪽 끝(보내기 버튼 뒤)에 깃펜(유언 쓰기) 버튼을 그린다. 입력 중 신호와 무관하다(WILL-01) */
  onWill?(): void;
  /** 유언 시트가 열려 있다(aria-pressed) */
  willOpen?: boolean;
  /** 저장된 유언이 있다(오른쪽 위 점, 접근성 이름에 '저장됨') */
  willSaved?: boolean;
  /** 빛남(14-04): 입력칸이 빛난다(토론 — 입력칸에 is-call, 입력칸에 data-call). 값 없는 표식 */
  callInput?: boolean;
  /** 빛남(14-04): [유언] 단추가 빛난다(최후 변론의 변론자 본인, HOST-04) */
  callWill?: boolean;
  /** 입력줄 맨 오른쪽(보내기·깃펜 뒤)에 놓을 요소. 결과 화면의 다시 하기 알약(11-12). 없으면 자리도 없다 */
  trailing?: ReactNode;
}

interface ChannelUi {
  label: string;
  hint: string | undefined;
  icon: V2IconName | null;
}

// 역할 단어 문구는 각 채널 분기 안에서만 읽는다.
function channelUi(channel: "all" | "mafia" | "ghost"): ChannelUi {
  if (channel === "mafia") return { label: CHAT_TEXT.inputLabel.mafia, hint: CHAT_TEXT.hint.mafia, icon: "roleMafia" };
  if (channel === "ghost") return { label: CHAT_TEXT.inputLabel.ghost, hint: CHAT_TEXT.hint.ghost, icon: "ghost" };
  return { label: CHAT_TEXT.inputLabel.all, hint: undefined, icon: null };
}

export function ChatPanel(props: ChatPanelProps) {
  const { messages, value, onChange, onSend, channel = "all", logHeight, compact, sendDisabled, sendDim, notice, quiet, inputId, inputRef, onWill, willOpen, willSaved, callInput, callWill, trailing } = props;
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<{ text: string; at: number } | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  // 기록 칸이 늘어나 있다(0083-4). 켜는 길: [data-chat-open] 누름. 끄는 길: 같은 단추 하나.
  const [open, setOpen] = useState(false);
  // 늘어난 칸을 위로 올려 읽는 중이면 새 줄이 와도 끌어내리지 않고 새 글 알약을 띄운다(접힌 상태에는 없다)
  const [newDot, setNewDot] = useState(false);
  const atBottomRef = useRef(true);
  // 입력칸에 포커스가 있다. 포커스를 받으면 기록 칸이 늘어나고 [보내기] 가 유언 단추 자리에 뜬다(0083-4·0083-5)
  const [focused, setFocused] = useState(false);
  const lastKey = messages.length ? (messages[messages.length - 1]?.key ?? null) : null;
  const lastKeyRef = useRef<string | null>(lastKey);
  const hasEmotes = !!onSend && !!props.emotes && props.emotes.length > 0 && !!props.onEmote;
  const emoteBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstCellRef = useRef<HTMLButtonElement | null>(null);

  // 타이머·이벤트에서 최신 속성을 읽는다(오래된 클로저 방지).
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  useEffect(
    () => () => {
      if (pendingRef.current !== null) clearTimeout(pendingRef.current);
    },
    [],
  );

  // 접힌 두 줄 창(18.1): 칸 안에서는 스크롤하지 않는다. 새 줄·막힘 알림이 오면 언제나 맨 아래(가장 새 줄)로 따라간다.
  // 늘어난 칸(0083-4): 열 때 맨 아래이고, 맨 아래(여유 AUTO_SCROLL_SLOP_PX)에 있을 때만 새 줄을 따라간다.
  // 위로 올려 읽는 중 새 줄이 오면 새 글 알약(quiet 면 없음).
  useLayoutEffect(() => {
    const added = lastKey !== lastKeyRef.current;
    lastKeyRef.current = lastKey;
    const el = logRef.current;
    if (!el) return;
    if (!open || atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (added && !quiet) {
      setNewDot(true);
    }
  }, [messages, notice, lastKey, open, quiet]);

  const onLogScroll = () => {
    const el = logRef.current;
    if (!el || !open) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= AUTO_SCROLL_SLOP_PX;
    atBottomRef.current = bottom;
    if (bottom) setNewDot(false);
  };

  const jumpToBottom = () => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setNewDot(false);
  };

  // [data-chat-open]: 접힌 두 줄 창은 전체가 누르는 영역, 늘어난 칸에서는 오른쪽 위 44×44. 누를 때마다 맨 아래부터 다시 시작한다.
  const toggleLog = () => {
    atBottomRef.current = true;
    setNewDot(false);
    if (open) fieldRef.current?.blur();
    setOpen((o) => !o);
  };

  // 입력칸을 누르면 기록 칸이 커지고 키보드도 열린다(켜기만). 접는 길은 [data-chat-open] 하나다 — 포커스가 풀려도 저절로 접지 않는다.
  const onFocus = () => {
    setFocused(true);
    if (!open) {
      atBottomRef.current = true;
      setNewDot(false);
      setOpen(true);
    }
    latest.current.onInputFocus?.();
  };

  const bindInput = (el: HTMLInputElement | null) => {
    fieldRef.current = el;
    if (typeof inputRef === "function") inputRef(el);
    else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el;
  };

  // 값은 언제나 DOM 입력칸에서 읽는다(조합이 끝난 뒤의 값).
  const send = () => {
    const p = latest.current;
    const el = fieldRef.current;
    if (!el || !p.onSend || p.sendDisabled) return;
    const text = el.value;
    if (text.trim() === "") return;
    const now = Date.now();
    const last = lastSentRef.current;
    if (last && last.text === text && now - last.at < DUP_SUBMIT_MS) return;
    lastSentRef.current = { text, at: now };
    p.onSend(text);
    p.onChange("");
    // 보내기 버튼을 눌러 포커스가 옮겨 갔어도 입력칸으로 돌려 키보드가 닫히지 않게 한다.
    if (document.activeElement !== el) el.focus({ preventScroll: true });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (composingRef.current) {
      if (pendingRef.current === null) {
        pendingRef.current = setTimeout(() => {
          pendingRef.current = null;
          send();
        }, IME_WAIT_MS);
      }
      return;
    }
    send();
  };

  const onCompositionStart = () => {
    composingRef.current = true;
    latest.current.onComposingChange?.(true);
  };

  const onCompositionEnd = () => {
    composingRef.current = false;
    latest.current.onComposingChange?.(false);
    if (pendingRef.current !== null) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
      send();
      return;
    }
    const el = fieldRef.current;
    const last = lastSentRef.current;
    if (el && last && el.value !== "" && Date.now() - last.at <= TAIL_WINDOW_MS && last.text.endsWith(el.value)) {
      latest.current.onChange("");
    }
  };

  const onBlur = () => {
    setFocused(false);
    if (composingRef.current) {
      composingRef.current = false;
      latest.current.onComposingChange?.(false);
    }
    latest.current.onInputBlur?.();
  };

  // Esc 는 입력을 비우지 않고 blur 만 한다. 보내기는 onSubmit 한 길이다.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") e.currentTarget.blur();
  };

  // 동작 판 (10-05). 닫을 때 초점은 동작 버튼으로 돌아온다(바깥 누름으로 닫을 때만 빼고).
  const closeTray = (restoreFocus: boolean) => {
    setTrayOpen(false);
    if (restoreFocus) emoteBtnRef.current?.focus({ preventScroll: true });
  };

  const pickEmote = (id: EmoteId) => {
    closeTray(true);
    latest.current.onEmote?.(id);
  };

  const onEmoteButton = () => {
    if (sendDisabled) return;
    const field = fieldRef.current;
    // 키보드가 열려 있으면(입력칸 포커스) 판을 열지 않고 키보드부터 닫는다. 두 번째 누름에 열린다.
    if (!trayOpen && field !== null && document.activeElement === field) {
      field.blur();
      return;
    }
    if (trayOpen) closeTray(true);
    else setTrayOpen(true);
  };

  // 열리면 첫 칸으로 초점. 끊기면 닫힌다.
  useEffect(() => {
    if (trayOpen) firstCellRef.current?.focus({ preventScroll: true });
  }, [trayOpen]);
  useEffect(() => {
    if (sendDisabled) setTrayOpen(false);
  }, [sendDisabled]);

  // 열린 동안: 판·버튼 바깥 pointerdown 과 Esc 로 닫는다.
  useEffect(() => {
    if (!trayOpen) return;
    const onDown = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && (t.closest("[data-emote-tray]") !== null || t.closest("[data-emote-button]") !== null)) return;
      setTrayOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const a = document.activeElement;
      const inside = a === document.body || a === null || (a instanceof Element && (a.closest("[data-emote-tray]") !== null || a.closest("[data-emote-button]") !== null));
      setTrayOpen(false);
      if (inside) emoteBtnRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [trayOpen]);

  // 판 안 화살표키: 좌우 한 칸, 위아래 다섯 칸(끝에서 멈춘다). Enter·Space 는 칸이 button 이라 기본 동작이 선택이다.
  const onTrayKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 5 : e.key === "ArrowUp" ? -5 : 0;
    if (step === 0) return;
    const list = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-emote]")];
    const at = list.findIndex((c) => c === document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(list.length - 1, at + step));
    // 아랫줄에서 위로 5칸은 윗줄로, 윗줄에서 아래 5칸이 없으면 마지막 칸에서 멈춘다
    list[next]?.focus({ preventScroll: true });
  };

  const ui = channelUi(channel);
  const blank = value.trim() === "";
  const sendOff = blank || !!sendDisabled;
  // [보내기] 는 입력 중이거나 쓴 글이 있을 때만 보이고, 보이는 동안 같은 자리의 유언 단추는 없다(0083-5)
  const showSend = focused || !blank;
  const rootCls = ["mv-chat", onSend && ui.icon && "has-chan", compact && "is-compact"].filter(Boolean).join(" ");
  const sendCls = sendDim ? "mv-tool mv-chat__send is-dim" : "mv-tool mv-chat__send";

  return (
    <section className={rootCls} data-chat-panel="" data-chat-channel={channel}>
      <div
        className={open ? "mv-chat__logbox is-open" : "mv-chat__logbox"}
        // 숫자 한 곳은 chatUi.ts 다 — CSS 가 읽는 변수로 넘긴다(.mv-chat__log.is-open 의 clamp)
        style={
          {
            "--mv-chat-fade": `${LOG_FADE_H}px`,
            "--mv-chat-log-min": `${LOG_H}px`,
            "--mv-chat-open-max": `${LOG_OPEN_MAX}px`,
            "--mv-chat-open-stage-min": `${OPEN_STAGE_MIN}px`,
          } as CSSProperties
        }
      >
        <div
          ref={logRef}
          className={open ? "mv-chat__log is-open" : "mv-chat__log is-window"}
          data-chat-log=""
          role="log"
          aria-live="polite"
          aria-label={CHAT_TEXT.logLabel}
          style={open ? undefined : { height: logHeight }}
          onScroll={onLogScroll}
        >
          <ChatLines messages={messages} channel={channel} />
          {notice ? (
            <p className="mv-chat__notice" role="status" data-chat-notice="">
              {notice}
            </p>
          ) : null}
        </div>
        <button type="button" className="mv-chat__open" data-chat-open="" aria-label={open ? CHAT_TEXT.logClose : CHAT_TEXT.logOpen} aria-expanded={open} onClick={toggleLog}>
          <span className="mv-chat__open-arrow" aria-hidden="true">
            <V2Icon name="chevronRight" size={16} />
          </span>
        </button>
        {open && newDot ? (
          <button type="button" className="mv-chat__newdot" data-chat-newdot="" aria-label={CHAT_TEXT.newDot} onClick={jumpToBottom}>
            <span className="mv-chat__newdot-pill">{CHAT_TEXT.newDot}</span>
          </button>
        ) : null}
      </div>
      {onSend ? (
        <form className="mv-chat__form" onSubmit={onSubmit}>
          {hasEmotes ? (
            <button
              type="button"
              className="mv-tool mv-chat__emote"
              data-emote-button=""
              aria-label={EMOTE_TEXT.button}
              aria-expanded={trayOpen}
              aria-pressed={trayOpen}
              aria-disabled={sendDisabled ? "true" : undefined}
              ref={emoteBtnRef}
              onClick={onEmoteButton}
              // 포커스가 버튼으로 옮겨 가 입력칸이 blur 되지 않게 한다(보내기 버튼과 같다)
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className="mv-tool__face">
                <V2Icon name="face" size={22} />
              </span>
            </button>
          ) : null}
          {hasEmotes && trayOpen ? <EmoteTray ids={props.emotes ?? []} onPick={pickEmote} disabled={!!sendDisabled || !!props.emoteBlocked} playing={props.emotePlaying ?? null} firstRef={firstCellRef} onKeyDown={onTrayKeyDown} /> : null}
          <div className={callInput ? "mv-chat__field is-call" : "mv-chat__field"}>
            {ui.icon ? (
              <span className={channel === "mafia" ? "mv-chat__chan is-mafia" : "mv-chat__chan is-ghost"}>
                <V2Icon name={ui.icon} size={20} />
              </span>
            ) : null}
            <input
              id={inputId}
              ref={bindInput}
              className="mv-chat__input"
              data-chat-input=""
              data-call={callInput ? "" : undefined}
              type="text"
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={CHAT_MAX_GRAPHEMES}
              aria-label={ui.label}
              placeholder={ui.hint}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              onKeyDown={onKeyDown}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
          {showSend ? (
            <button
              type="submit"
              className={sendCls}
              data-chat-send=""
              aria-label={CHAT_TEXT.send}
              aria-disabled={sendOff ? "true" : "false"}
              // 누르는 순간 포커스가 버튼으로 옮겨 가면 입력칸이 blur 되어 키보드가 닫히고 패널이 손가락 밑에서 내려간다(Chromium·Android). 포커스는 입력칸에 둔다(07-19, 합격 검사 6).
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className="mv-tool__face">
                <V2Icon name="send" size={22} />
              </span>
            </button>
          ) : null}
          {onWill && !showSend ? (
            <button
              type="button"
              className={callWill ? "mv-tool mv-chat__will is-call" : "mv-tool mv-chat__will"}
              data-will-button=""
              data-call={callWill ? "" : undefined}
              aria-label={willSaved ? CHAT_TEXT.willSaved : CHAT_TEXT.will}
              aria-pressed={willOpen ? "true" : "false"}
              aria-disabled={sendDisabled ? "true" : undefined}
              onClick={() => latest.current.onWill?.()}
              // 포커스가 버튼으로 옮겨 가 키보드가 닫히지 않게 한다(보내기 버튼과 같다). 입력 중 경로(onChange)는 부르지 않는다.
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className="mv-tool__face">
                <V2Icon name="quill" size={22} />
                {willSaved ? <i className="mv-chat__will-dot" /> : null}
              </span>
            </button>
          ) : null}
          {trailing ? (
            <div className="mv-chat__trailing" data-chat-trailing="">
              {trailing}
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
