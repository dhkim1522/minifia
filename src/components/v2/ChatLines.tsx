import type { ReactNode } from "react";
import { CHAT_TEXT, type ChatTextPart } from "../../game/chatText";
import type { AnimalId } from "../../../shared/game/animals";
import { PlayerName } from "../PlayerName";
import { PlayerPortrait } from "../PlayerPortrait";
import type { ChatPanelMessage } from "./ChatPanel";
import { V2Icon } from "./V2Icon";

// 채팅 줄 부품(18.1, P181-4): 기록 칸과 기록 시트가 같은 줄 모양·클래스를 쓴다. 본문·닉네임은 텍스트 노드로만(T-07-07).
// 감싸는 요소 없음 — 기록 칸 직속 자식 선택자(`[data-chat-log] > p…`)가 그대로 통한다.
// 채널로 줄을 거르지 않는다: 받을 권리가 없는 줄은 서버가 보내지 않는다(결정 0002·0021).

function withPlayerNames(text: string | undefined, parts: readonly ChatTextPart[] | undefined) {
  return parts?.map((part, index) => typeof part === "string" ? part : <PlayerName key={index} seat={part.seat}>{part.name}</PlayerName>) ?? text;
}

export function ChatLines({ messages, channel }: {
  messages: readonly ChatPanelMessage[];
  channel: "all" | "mafia" | "ghost";
}) {
  return (
    <>
      {messages.map((m) => {
        if (m.kind === "card") {
          // 카드 본문·제목은 React 텍스트 노드로만 그린다(T-09-23). 종류는 서버 k 로 정해진 값이다.
          return (
            <div key={m.key} className={m.tone === "mafia" ? "mv-chat__card mv-chat__card--mafia" : "mv-chat__card"} data-card={m.card ?? "will"}>
              <span className="mv-chat__card-title">
                {m.icon ? <V2Icon name={m.icon} size={16} /> : null}
                <span>{withPlayerNames(m.title, m.titleParts)}</span>
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
                <span>{withPlayerNames(m.title, m.titleParts)}</span>
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
              <span>{withPlayerNames(m.text, m.textParts)}</span>
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
        const name = m.me ? CHAT_TEXT.me : (m.name ?? "");
        return (
          <ChatPlayerLine key={m.key} channel={m.ch ?? "all"} seat={m.seat} animal={m.animal} name={name} text={m.text} mark={mark} />
        );
      })}
    </>
  );
}

/** 플레이어가 고른 공개 동물 얼굴을 쓴다. 구형 뷰에는 좌석 초상화가 있다. */
export function ChatPlayerLine({ channel, seat, animal, name, text, mark }: {
  channel: "all" | "mafia" | "ghost";
  seat?: number;
  animal?: AnimalId | undefined;
  name: string;
  text: string;
  mark?: ReactNode;
}) {
  return (
    <p className={channel === "mafia" ? "mv-chat__msg is-mafia" : "mv-chat__msg"} data-seat={seat} data-ch={channel}>
      {seat === undefined ? null : <PlayerPortrait className="mv-chat__avatar" seat={seat} animal={animal} />}
      <span className="mv-chat__bubble-body">
        <span className="mv-chat__byline">{mark}<PlayerName className="mv-chat__name" seat={seat}>{name}</PlayerName></span>
        <span className="mv-chat__text">{text}</span>
      </span>
    </p>
  );
}
