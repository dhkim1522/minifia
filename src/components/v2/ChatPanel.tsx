import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import "../../styles/v2.css";
import { CHAT_MAX_GRAPHEMES } from "../../../shared/game/chatRules";
import { CHAT_TEXT } from "../../game/chatText";
import { AUTO_SCROLL_SLOP_PX, DUP_SUBMIT_MS, IME_WAIT_MS, TAIL_WINDOW_MS } from "../../game/chatUi";
import type { EmoteId } from "../../../shared/protocol";
import { EMOTE_TEXT } from "../../game/chatText";
import { EmoteTray } from "./EmoteTray";
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

function atBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= AUTO_SCROLL_SLOP_PX;
}

export function ChatPanel(props: ChatPanelProps) {
  const { messages, value, onChange, onSend, channel = "all", logHeight, compact, sendDisabled, sendDim, notice, quiet, inputId, inputRef, onWill, willOpen, willSaved, callInput, callWill, trailing } = props;
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<{ text: string; at: number } | null>(null);
  const atBottomRef = useRef(true);
  const lastKeyRef = useRef<string | null>(messages.length ? (messages[messages.length - 1]?.key ?? null) : null);
  const [newDot, setNewDot] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
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

  // 자동 스크롤: 바뀌기 전에 바닥 24px 이내였으면 따라가고, 위로 올려 읽는 중이면 끌어내리지 않고 점을 띄운다.
  useLayoutEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const lastKey = messages.length ? (messages[messages.length - 1]?.key ?? null) : null;
    const added = lastKey !== lastKeyRef.current;
    lastKeyRef.current = lastKey;
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (added && !quiet) {
      setNewDot(true);
    }
  }, [messages, quiet]);

  // 막힘 알림은 기록 칸 맨 아래 줄이라 뜰 때 바닥으로 내려 보이게 한다.
  useLayoutEffect(() => {
    const el = logRef.current;
    if (!notice || !el) return;
    el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
  }, [notice]);

  const onScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const bottom = atBottom(el);
    atBottomRef.current = bottom;
    if (bottom) setNewDot(false);
  };

  const jumpToBottom = () => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setNewDot(false);
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
  const rootCls = ["mv-chat", onSend && ui.icon && "has-chan", compact && "is-compact"].filter(Boolean).join(" ");
  const sendCls = sendDim ? "mv-tool mv-chat__send is-dim" : "mv-tool mv-chat__send";

  return (
    <section className={rootCls} data-chat-panel="" data-chat-channel={channel}>
      <div className="mv-chat__logbox">
        <div
          ref={logRef}
          className="mv-chat__log"
          data-chat-log=""
          role="log"
          aria-live="polite"
          aria-label={CHAT_TEXT.logLabel}
          style={{ height: logHeight }}
          onScroll={onScroll}
        >
          {messages.map((m) => {
            if (m.kind === "card" && m.card === "ballots" && m.ballots) {
              // 찬반 기록 카드(UI-SPEC C-3): 제목 줄 없이 머리 "찬성 n"/"반대 m" + 이름들(자리 구분색 점 + 이름). 이름은 텍스트 노드로만 그린다(T-09.1.1-34)
              return (
                <div key={m.key} className="mv-chat__card mv-chat__card--ballots" data-card="ballots">
                  {(["yes", "no"] as const).map((side) => (
                    <div key={side} className="mv-chat__ballots-side" data-ballot-side={side}>
                      <span className="mv-chat__ballots-head">
                        <V2Icon name={side === "yes" ? "thumbUp" : "thumbDown"} size={16} />
                        <span>{`${side === "yes" ? "찬성" : "반대"} ${m.ballots![side].length}`}</span>
                      </span>
                      <span className="mv-chat__ballots-names">
                        {m.ballots![side].map((v) => (
                          <span key={v.seat} className="mv-chat__ballots-voter">
                            <span className="mv-chat__ballots-dot" aria-hidden="true" style={{ "--ballot-seat": `var(--seat-${v.seat + 1})` } as React.CSSProperties} />
                            <span className="mv-chat__ballots-name">{v.name}</span>
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }
            if (m.kind === "card") {
              // 카드 본문·제목은 React 텍스트 노드로만 그린다(T-09-23). 종류는 서버 k 로 정해진 값이다.
              return (
                <div key={m.key} className={m.tone === "mafia" ? "mv-chat__card mv-chat__card--mafia" : "mv-chat__card"} data-card={m.card ?? "will"}>
                  <span className="mv-chat__card-title">
                    {m.icon ? <V2Icon name={m.icon} size={16} /> : null}
                    <span>{m.title ?? ""}</span>
                  </span>
                  <p className="mv-chat__card-text">{m.text}</p>
                </div>
              );
            }
            if (m.kind === "whisper") {
              // 비공개 귓속말 블록(UI-SPEC B-3): 이 줄은 서버가 보낸·받은 사람 소켓에만 보낸 것이라 제3자 DOM 에는 존재하지 않는다(T-09.1.1-25). 제목·본문은 텍스트 노드로만 그린다
              return (
                <div key={m.key} className="mv-chat__whisper" data-whisper={m.whisper ?? "in"}>
                  <span className="mv-chat__whisper-title">
                    <V2Icon name="whisper" size={16} />
                    <span>{m.title ?? ""}</span>
                  </span>
                  <span className="mv-sr">, </span>
                  <p className="mv-chat__whisper-text">{m.text}</p>
                </div>
              );
            }
            if (m.kind !== "player") {
              // vote 는 아이콘을 point 14 로 정하고, hot 은 아이콘을 그리지 않는다(승인 .mv-chat__sys.is-vote/.is-hot).
              const icon = m.kind === "vote" ? <V2Icon name="point" size={14} /> : m.kind === "hot" ? null : m.icon ? <V2Icon name={m.icon} size={16} /> : null;
              const sysCls = m.kind === "vote" ? "mv-chat__sys is-vote" : m.kind === "hot" ? "mv-chat__sys is-hot" : "mv-chat__sys";
              return (
                <p key={m.key} className={sysCls} {...(m.whisper === "public" ? { "data-whisper": "public" } : {})}>
                  {icon}
                  <span>{m.text}</span>
                </p>
              );
            }
            // 줄 앞 채널 아이콘은 보는 사람이 유령일 때만(마피아 줄과 유령 줄을 색만으로 가르지 않는다).
            const mark =
              channel === "ghost" && m.ch === "mafia" ? (
                <span className="mv-chat__mark is-mafia">
                  <V2Icon name="roleMafia" size={14} />
                </span>
              ) : channel === "ghost" && m.ch === "ghost" ? (
                <span className="mv-chat__mark is-ghost">
                  <V2Icon name="ghost" size={14} />
                </span>
              ) : null;
            return (
              <p key={m.key} className={m.ch === "mafia" ? "mv-chat__msg is-mafia" : "mv-chat__msg"} data-seat={m.seat} data-ch={m.ch ?? "all"}>
                {m.seat !== undefined ? <span className="mv-chat__dot" style={{ background: `var(--seat-${m.seat + 1})` }} /> : null}
                {mark}
                <span className="mv-chat__name">{m.me ? CHAT_TEXT.me : (m.name ?? "")}</span>
                <span className="mv-chat__text">{m.text}</span>
              </p>
            );
          })}
          {notice ? (
            <p className="mv-chat__notice" role="status" data-chat-notice="">
              {notice}
            </p>
          ) : null}
        </div>
        {newDot ? (
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
              onFocus={() => latest.current.onInputFocus?.()}
              onBlur={onBlur}
            />
          </div>
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
          {onWill ? (
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
