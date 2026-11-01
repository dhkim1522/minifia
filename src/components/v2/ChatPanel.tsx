import { useRef, type FormEvent, type Ref } from "react";
import "../../styles/v2.css";
import { CHAT_MAX_GRAPHEMES } from "../../../shared/game/chatRules";
import { CHAT_TEXT } from "../../game/chatText";
import { V2Icon, type V2IconName } from "./V2Icon";

// 채팅 패널(기록 칸 + 입력줄). design/v2.0/design-system/components/bundle.js 의 ChatPanel 과
// bundle.css 의 .mv-chat* 를 React 19 로 옮겼다(승인 2026-10-31). 같은 클래스 이름(mv-chat*)을 쓴다.
//
// 이 페이즈 속성 범위: messages·value·onChange·onSend·inputId + 변형 logHeight(고정 높이)·compact(키보드 열림)·channel(채널 아이콘).
// 승인 속성 emotes·onEmote·onWill·willOpen·tabs 는 받지 않는다(10·9·11페이즈). form 이 flex 이고 입력칸이 flex 1 이라
// 입력줄 왼쪽에 그 버튼이 들어올 자리를 막지 않는다.
//
// 규칙
// - 줄 본문·닉네임은 React 텍스트 노드로만 그린다(HTML 주입·링크 변환·마크다운 없음, T-07-07).
// - 채널로 줄을 거르는 속성은 없다 — 받을 권리가 없는 줄은 서버가 보내지 않는다(결정 0002·0021).
// - 보내기 전에 내 줄을 미리 그리지 않는다(낙관적 표시 없음). 받은 messages 만 그린다.
// - 제출은 form onSubmit 한 길이다. 입력칸 값은 onChange 에서 가공하지 않고, 보낼 때 DOM 입력칸의 현재 값을 읽는다.

export interface ChatPanelMessage {
  key: string;
  kind: "player" | "system";
  text: string;
  /** 자리 번호 0~7 → 구분색 var(--seat-(n+1)) */
  seat?: number;
  name?: string;
  me?: boolean;
  ch?: "all" | "mafia" | "ghost";
  icon?: V2IconName;
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
}

export function ChatPanel({ messages, value, onChange, onSend, channel, logHeight, sendDisabled, inputId, inputRef }: ChatPanelProps) {
  const fieldRef = useRef<HTMLInputElement | null>(null);

  const bindInput = (el: HTMLInputElement | null) => {
    fieldRef.current = el;
    if (typeof inputRef === "function") inputRef(el);
    else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el;
  };

  const send = () => {
    const el = fieldRef.current;
    if (!el || !onSend || sendDisabled) return;
    const text = el.value;
    if (text.trim() === "") return;
    onSend(text);
    onChange("");
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    send();
  };

  const blank = value.trim() === "";
  const sendOff = blank || !!sendDisabled;

  return (
    <section className="mv-chat" data-chat-panel="" data-chat-channel={channel ?? "all"}>
      <div className="mv-chat__log" data-chat-log="" role="log" aria-live="polite" aria-label={CHAT_TEXT.logLabel} style={{ height: logHeight }}>
        {messages.map((m) =>
          m.kind === "player" ? (
            <p key={m.key} className={m.ch === "mafia" ? "mv-chat__msg is-mafia" : "mv-chat__msg"} data-seat={m.seat} data-ch={m.ch ?? "all"}>
              {m.seat !== undefined ? <span className="mv-chat__dot" style={{ background: `var(--seat-${m.seat + 1})` }} /> : null}
              <span className="mv-chat__name">{m.me ? CHAT_TEXT.me : (m.name ?? "")}</span>
              <span className="mv-chat__text">{m.text}</span>
            </p>
          ) : (
            <p key={m.key} className="mv-chat__sys">
              {m.icon ? <V2Icon name={m.icon} size={16} /> : null}
              <span>{m.text}</span>
            </p>
          ),
        )}
      </div>
      {onSend ? (
        <form className="mv-chat__form" onSubmit={onSubmit}>
          <div className="mv-chat__field">
            <input
              id={inputId}
              ref={bindInput}
              className="mv-chat__input"
              data-chat-input=""
              type="text"
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={CHAT_MAX_GRAPHEMES}
              aria-label={CHAT_TEXT.inputLabel.all}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
          <button type="submit" className="mv-chat__send" data-chat-send="" aria-label={CHAT_TEXT.send} aria-disabled={sendOff ? "true" : "false"}>
            <V2Icon name="send" />
          </button>
        </form>
      ) : null}
    </section>
  );
}
