import type { CSSProperties } from "react";
import { CHAT_TEXT } from "../../game/chatText";
import type { ChatPanelMessage } from "./ChatPanel";
import { V2Icon } from "./V2Icon";

// 채팅 줄 부품(18.1, P181-4): 기록 칸과 기록 시트가 같은 줄 모양·클래스를 쓴다. 본문·닉네임은 텍스트 노드로만(T-07-07).
// 감싸는 요소 없음 — 기록 칸 직속 자식 선택자(`[data-chat-log] > p…`)가 그대로 통한다.
// 채널로 줄을 거르지 않는다: 받을 권리가 없는 줄은 서버가 보내지 않는다(결정 0002·0021).

export function ChatLines({ messages, channel }: { messages: readonly ChatPanelMessage[]; channel: "all" | "mafia" | "ghost" }) {
  return (
    <>
      {messages.map((m) => {
        if (m.kind === "card" && m.card === "ballots" && m.ballots) {
          // 찬반 기록 카드(UI-SPEC C-3): 제목 줄 없이 머리 "찬성 n"/"반대 m" + 이름들(자리 구분색 점 + 이름). 이름은 텍스트 노드로만 그린다(T-09.1.1-34)
          const ballots = m.ballots;
          return (
            <div key={m.key} className="mv-chat__card mv-chat__card--ballots" data-card="ballots">
              {(["yes", "no"] as const).map((side) => (
                <div key={side} className="mv-chat__ballots-side" data-ballot-side={side}>
                  <span className="mv-chat__ballots-head">
                    <V2Icon name={side === "yes" ? "thumbUp" : "thumbDown"} size={16} />
                    <span>{`${side === "yes" ? "찬성" : "반대"} ${ballots[side].length}`}</span>
                  </span>
                  <span className="mv-chat__ballots-names">
                    {ballots[side].map((v) => (
                      <span key={v.seat} className="mv-chat__ballots-voter">
                        <span className="mv-chat__ballots-dot" aria-hidden="true" style={{ "--ballot-seat": `var(--seat-${v.seat + 1})` } as CSSProperties} />
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
    </>
  );
}
